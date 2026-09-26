import { createLogger } from "../log";
import { request, type RequestOptions } from "../http/client";
import { ApiError } from "../http/errors";
import { Emitter } from "../emitter";
import { captchaOf, clearTokens, loadTokens, saveTokens, type Tokens } from "./tokenStore";

const log = createLogger("session");
const REFRESH_MARGIN_MS = 60_000;

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
	[key: string]: unknown;
}

export interface SessionEvents {
	signedIn: Profile;
	signedOut: undefined;
	profile: Profile | null;
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
	private refreshing: Promise<Tokens | null> | null = null;

	get isSignedIn(): boolean {
		return Boolean(this.tokens);
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
		await this.loadProfile();
		log.info("signed in as", this.profile?.username ?? login);

		if (this.profile) this.events.emit("signedIn", this.profile);
		this.events.emit("profile", this.profile);
		return this.profile as Profile;
	}

	setProfile(profile: Profile | null): void {
		this.profile = profile;
		this.events.emit("profile", profile);
	}

	async signOut(): Promise<void> {
		const refreshToken = this.tokens?.refreshToken;
		this.tokens = null;
		this.profile = null;
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
				log.warn("refresh failed; signing out", error);
				this.tokens = null;
				this.profile = null;
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

	async loadProfile(): Promise<Profile | null> {
		if (!this.tokens) return null;
		try {
			const result = await this.authed<Envelope<Profile>>("/user/auth/me");
			this.profile = result?.data ?? null;
			this.events.emit("profile", this.profile);
			return this.profile;
		} catch (error) {
			log.debug("could not load profile", error);
			return null;
		}
	}

	get diagnostics(): Record<string, unknown> {
		return {
			signedIn: this.isSignedIn,
			username: this.profile?.username ?? null,
			verified: this.profile?.isVerified ?? null,
			expiresIn: this.tokens ? Math.round((this.tokens.expiresAt - Date.now()) / 1000) + "s" : null,
			hasCaptcha: Boolean(this.captcha),
		};
	}
}
