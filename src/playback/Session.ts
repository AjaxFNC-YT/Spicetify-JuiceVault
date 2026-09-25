import { createLogger } from "../core/log";

const log = createLogger("Session");
const KEY = "juicevault:session";

export interface SavedSession {
	songId: string;
	title: string;
	artist: string;
	durationSeconds: number;
	positionSeconds: number;
	contextUri?: string;
	uid?: string;
	shuffle: boolean;
	repeat: number;
	savedAt: number;
}

export function saveSession(session: SavedSession): void {
	try {
		Spicetify.LocalStorage.set(KEY, JSON.stringify(session));
	} catch (error) {
		log.debug("could not persist session", error);
	}
}

export function loadSession(): SavedSession | null {
	try {
		const raw = Spicetify.LocalStorage.get(KEY);
		if (!raw) return null;
		const parsed = JSON.parse(raw) as SavedSession;
		if (!parsed?.songId) return null;
		return parsed;
	} catch (error) {
		log.debug("could not read session", error);
		return null;
	}
}

export function clearSession(): void {
	try {
		Spicetify.LocalStorage.remove(KEY);
	} catch (error) {
		log.debug("could not clear session", error);
	}
}
