import { siteUrl } from "../config";
import { request } from "../http/client";
import { ApiError } from "../http/errors";

export type OAuthProvider = "discord" | "google";

export interface OAuthTokens {
	accessToken: string;
	refreshToken: string;
}

export interface BrowserLogin {
	url: string;
	verifier: string;
	code: string;
}

const POLL_MS = 2000;
const GIVE_UP_MS = 5 * 60 * 1000;

function base64url(bytes: Uint8Array): string {
	let binary = "";
	for (const byte of bytes) binary += String.fromCharCode(byte);
	return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function displayCode(challenge: string): string {
	const letters = challenge.replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 8);
	return `${letters.slice(0, 4)}-${letters.slice(4, 8)}`;
}

export class OAuthUnavailableError extends Error {
	constructor() {
		super("Logging in through the website isn't available yet. Use your username and password for now.");
		this.name = "OAuthUnavailableError";
	}
}

export async function beginBrowserLogin(provider?: OAuthProvider): Promise<BrowserLogin> {
	const verifier = base64url(crypto.getRandomValues(new Uint8Array(32)));
	const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier)));
	const challenge = base64url(digest);

	const query = new URLSearchParams({ challenge, client: "spicetify" });
	if (provider) query.set("provider", provider);

	return { url: `${siteUrl("/connect/spotify")}?${query.toString()}`, verifier, code: displayCode(challenge) };
}

export async function waitForBrowserLogin(verifier: string, signal: AbortSignal): Promise<OAuthTokens> {
	const started = Date.now();

	while (!signal.aborted) {
		if (Date.now() - started > GIVE_UP_MS) throw new Error("Login timed out. Try again.");

		try {
			const result = await request<{ pending?: boolean; data?: Partial<OAuthTokens> }>("/user/auth/handoff", {
				method: "POST",
				retries: 1,
				body: { verifier },
				signal,
			});
			const tokens = result?.data;
			if (tokens?.accessToken && tokens?.refreshToken) {
				return { accessToken: tokens.accessToken, refreshToken: tokens.refreshToken };
			}
		} catch (error) {
			if (signal.aborted) break;
			if (error instanceof ApiError && error.status === 404) throw new OAuthUnavailableError();
			if (error instanceof ApiError && error.status === 410) throw new Error("That login expired. Try again.");
			if (error instanceof ApiError && error.status === 403) throw error;
			if (error instanceof ApiError && error.status !== 429) throw error;
		}

		await new Promise((resolve) => setTimeout(resolve, POLL_MS));
	}

	throw new Error("Login cancelled.");
}

export function openInBrowser(url: string): void {
	const link = document.createElement("a");
	link.href = url;
	link.target = "_blank";
	link.rel = "noopener noreferrer";
	document.body.appendChild(link);
	link.click();
	link.remove();
}
