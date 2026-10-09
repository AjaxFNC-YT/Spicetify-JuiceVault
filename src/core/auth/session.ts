import { createLogger } from "../log";
import { request, type RequestOptions } from "../http/client";
import { ApiError } from "../http/errors";
import { Emitter } from "../emitter";
import { captchaOf, clearTokens, loadTokens, saveTokens, type Tokens } from "./tokenStore";

const log = createLogger("session");
const REFRESH_MARGIN_MS = 60_000;
const PROFILE_RETRY_MS = [3000, 10_000, 30_000, 60_000];

export interface ListeningSummary {
	totalListens?: number;
	totalDuration?: number;
	uniqueSongs?: number;
	archive?: { completedSongs?: number; totalSongs?: number; completionRate?: number };
	streak?: { current?: number; longest?: number };
}

export interface Profile {
	id?: string;
	_id?: string;
	username: string;
	displayName?: string;
	email?: string;
	avatar?: string | null;
	banner?: string | null;
	bio?: string;
	isVerified?: boolean;
	hasPassword?: boolean;
	preferences?: Record<string, unknown>;
	stats?: { likedCount?: number; playlistCount?: number };
	listening?: ListeningSummary;
	createdAt?: string;
	badges?: unknown;
	[key: string]: unknown;
}

export interface SessionEvents {
	signedIn: Profile;
	signedOut: undefined;
	profile: Profile | null;
	unverified: Profile | null;
}

export class UnverifiedError extends Error {
	constructor(readonly email?: string) {
		super("Verify your email on juicevault.xyz to use your account in Spotify.");
		this.name = "UnverifiedError";
	}
}

interface Envelope<T> {
	success: boolean;
	data: T;
	error?: string;
}

export class Session {
	readonly events = new Emitter<SessionEvents>();

	private tokens: Tokens | null = loadTokens();
	private profile: Profile | null = null;
	private pending: Profile | null = null;
	private refreshing: Promise<Tokens | null> | null = null;
	private profileRetry: number | null = null;
	private profileAttempts = 0;

	get isSignedIn(): boolean {
		return Boolean(this.tokens) && !this.pending;
	}

	get unverified(): Profile | null {
		return this.tokens ? this.pending : null;
	}

	private requireVerified(): Profile {
		if (this.pending) throw new UnverifiedError(this.pending.email);
		return this.profile as Profile;
	}

	get user(): Profile | null {
		return this.profile;
	}

	get accessToken(): string | null {
		return this.tokens?.accessToken ?? null;
	}

	private get captcha(): string | null {
		return this.tokens ? captchaOf(this.tokens.accessToken) : null;
	}

	async signIn(login: string, password: string): Promise<Profile> {
		const token = await request<Envelope<{ token: string }>>("/user/auth/token", { method: "POST", retries: 1 });
		const loginToken = token?.data?.token;
		if (!loginToken) throw new Error("Could not obtain a login token");

		const ca = captchaOf(loginToken);
		if (!ca) throw new Error("Login token did not carry a captcha grant");

		const result = await request<Envelope<{ accessToken: string; refreshToken: string; user: Profile }>>(
			"/user/auth/login",
			{
				method: "POST",
				retries: 1,
				headers: { "X-CA": ca },
				body: { login, password, loginToken },
			},
		);

		const data = result?.data;
		if (!data?.accessToken) throw new Error(result?.error ?? "Login failed");

		this.tokens = saveTokens(data.accessToken, data.refreshToken);
		this.profile = data.user ?? null;
		this.pending = data.user?.isVerified === false ? data.user : null;
		if (this.pending) this.profile = null;
		await this.loadProfile(false);
		const profile = this.requireVerified();
		log.info("signed in as", profile?.username ?? login);

		if (profile) this.events.emit("signedIn", profile);
		this.events.emit("profile", profile);
		return profile;
	}

	async signInWithTokens(accessToken: string, refreshToken: string): Promise<Profile> {
		this.tokens = saveTokens(accessToken, refreshToken);
		const profile = (await this.loadProfile(false)) ?? this.pending;
		if (!profile) {
			this.tokens = null;
			clearTokens();
			throw new Error("Signed in, but JuiceVault didn't return your account.");
		}
		this.requireVerified();
		log.info("signed in as", profile.username);
		this.events.emit("signedIn", profile);
		this.events.emit("profile", profile);
		return profile;
	}

	setProfile(profile: Profile | null): void {
		this.profile = profile;
		this.events.emit("profile", profile);
	}

	async signOut(): Promise<void> {
		const refreshToken = this.tokens?.refreshToken;
		this.tokens = null;
		this.profile = null;
		this.pending = null;
		clearTokens();

		if (refreshToken) {
			try {
				await request("/user/auth/logout", { method: "POST", retries: 1, body: { refreshToken } });
			} catch (error) {
				log.debug("logout call failed", error);
			}
		}

		this.events.emit("signedOut", undefined);
		this.events.emit("profile", null);
		log.info("signed out");
	}

	private async refresh(): Promise<Tokens | null> {
		if (this.refreshing) return this.refreshing;
		const refreshToken = this.tokens?.refreshToken;
		if (!refreshToken) return null;

		this.refreshing = (async () => {
			try {
				const result = await request<Envelope<{ accessToken: string; refreshToken: string }>>("/user/auth/refresh", {
					method: "POST",
					retries: 2,
					body: { refreshToken },
				});
				const data = result?.data;
				if (!data?.accessToken) throw new Error("refresh returned no token");
				this.tokens = saveTokens(data.accessToken, data.refreshToken ?? refreshToken);
				log.debug("refreshed access token");
				return this.tokens;
			} catch (error) {
				if (!(error instanceof ApiError) || ![400, 401, 403].includes(error.status)) {
					log.warn("could not refresh the login right now; staying signed in", error);
					return null;
				}
				log.warn("JuiceVault rejected the saved login; signing out", error);
				this.tokens = null;
				this.profile = null;
				this.pending = null;
				clearTokens();
				this.events.emit("signedOut", undefined);
				this.events.emit("profile", null);
				return null;
			} finally {
				this.refreshing = null;
			}
		})();

		return this.refreshing;
	}

	private async ensureFresh(): Promise<void> {
		if (!this.tokens) return;
		if (Date.now() < this.tokens.expiresAt - REFRESH_MARGIN_MS) return;
		await this.refresh();
	}

	async authed<T>(path: string, options: RequestOptions = {}): Promise<T> {
		if (!this.tokens) throw new Error("Not signed in");
		await this.ensureFresh();

		const send = (): Promise<T> =>
			request<T>(path, {
				...options,
				headers: {
					...(options.headers ?? {}),
					Authorization: `Bearer ${this.tokens?.accessToken ?? ""}`,
					...(this.captcha ? { "X-CA": this.captcha } : {}),
				},
			});

		try {
			return await send();
		} catch (error) {
			if (error instanceof ApiError && error.isUnauthorized) {
				const refreshed = await this.refresh();
				if (refreshed) return await send();
			}
			throw error;
		}
	}

	async loadProfile(announce = true): Promise<Profile | null> {
		if (!this.tokens) return null;
		try {
			const result = await this.authed<Envelope<Profile>>("/user/auth/me");
			const loaded = result?.data ?? null;

			if (loaded?.isVerified === false) {
				const wasActive = Boolean(this.profile) && !this.pending;
				this.pending = loaded;
				this.profile = null;
				log.info("account isn't verified yet; staying signed out");
				if (announce) {
					if (wasActive) this.events.emit("signedOut", undefined);
					this.events.emit("profile", null);
					this.events.emit("unverified", loaded);
				}
				return null;
			}

			const wasPending = Boolean(this.pending);
			this.pending = null;
			this.profile = loaded;
			if (announce) {
				if (wasPending && loaded) this.events.emit("signedIn", loaded);
				this.events.emit("profile", this.profile);
			}
			return this.profile;
		} catch (error) {
			log.debug("could not load profile", error);
			this.retryProfile();
			return null;
		}
	}

	private retryProfile(): void {
		if (this.profileRetry !== null || !this.tokens || this.profile) return;
		const delay = PROFILE_RETRY_MS[Math.min(this.profileAttempts, PROFILE_RETRY_MS.length - 1)]!;
		this.profileAttempts += 1;
		this.profileRetry = window.setTimeout(() => {
			this.profileRetry = null;
			void this.loadProfile().then((profile) => {
				if (profile) this.profileAttempts = 0;
			});
		}, delay);
	}

	async checkVerification(): Promise<boolean> {
		return Boolean(await this.loadProfile());
	}

	async resendVerification(): Promise<void> {
		await this.authed("/user/auth/resend-verification", { method: "POST", retries: 0 });
	}

	get diagnostics(): Record<string, unknown> {
		return {
			signedIn: this.isSignedIn,
			awaitingVerification: Boolean(this.unverified),
			username: this.profile?.username ?? null,
			verified: this.profile?.isVerified ?? null,
			expiresIn: this.tokens ? Math.round((this.tokens.expiresAt - Date.now()) / 1000) + "s" : null,
			hasCaptcha: Boolean(this.captcha),
		};
	}
}
