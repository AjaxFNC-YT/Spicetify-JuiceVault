import { createLogger } from "../log";

const log = createLogger("tokens");
const KEY = "juicevault:tokens";

export interface Tokens {
	accessToken: string;
	refreshToken: string;
	expiresAt: number;
}

function decodePayload(token: string): Record<string, any> | null {
	try {
		const part = token.split(".")[1];
		if (!part) return null;
		const json = atob(part.replace(/-/g, "+").replace(/_/g, "/"));
		return JSON.parse(json);
	} catch {
		return null;
	}
}

export function expiryOf(accessToken: string): number {
	const payload = decodePayload(accessToken);
	const exp = Number(payload?.exp);
	if (Number.isFinite(exp)) return exp * 1000;
	return Date.now() + 15 * 60 * 1000;
}

export function captchaOf(token: string): string | null {
	const payload = decodePayload(token);
	const ca = payload?.ca;
	return typeof ca === "string" && ca ? ca : null;
}

export function saveTokens(accessToken: string, refreshToken: string): Tokens {
	const tokens: Tokens = { accessToken, refreshToken, expiresAt: expiryOf(accessToken) };
	try {
		Spicetify.LocalStorage.set(KEY, JSON.stringify(tokens));
	} catch (error) {
		log.warn("could not persist tokens", error);
	}
	return tokens;
}

export function loadTokens(): Tokens | null {
	try {
		const raw = Spicetify.LocalStorage.get(KEY);
		if (!raw) return null;
		const parsed = JSON.parse(raw) as Tokens;
		if (!parsed?.accessToken || !parsed?.refreshToken) return null;
		return parsed;
	} catch {
		return null;
	}
}

export function clearTokens(): void {
	try {
		Spicetify.LocalStorage.remove(KEY);
	} catch {
		/* nothing to do */
	}
}
