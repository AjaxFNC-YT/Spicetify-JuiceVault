import { createLogger } from "../log";
import { Emitter } from "../emitter";
import { getMetadata, peekMetadata } from "../api/songs";

declare const Spicetify: any;

const log = createLogger("albums");

const KEY = "juicevault:albums-v2";
const LEGACY_KEY = "juicevault:albums";
const CONCURRENCY = 6;
const SAVE_DELAY_MS = 1500;

const events = new Emitter<{ resolved: string[] }>();
const waiting = new Map<string, Array<() => void>>();
const backlog: string[] = [];
let active = 0;
let saveTimer: number | null = null;
let flushTimer: number | null = null;
let resolvedBatch: string[] = [];

let loaded: Record<string, string> | null = null;

function albums(): Record<string, string> {
	if (loaded) return loaded;
	try {
		Spicetify.LocalStorage.remove(LEGACY_KEY);
		const raw = Spicetify.LocalStorage.get(KEY);
		loaded = raw ? (JSON.parse(raw) as Record<string, string>) : {};
	} catch {
		loaded = {};
	}
	return loaded;
}

function save(): void {
	if (saveTimer !== null) return;
	saveTimer = window.setTimeout(() => {
		saveTimer = null;
		try {
			Spicetify.LocalStorage.set(KEY, JSON.stringify(albums()));
		} catch (error) {
			log.debug("could not save albums", error);
		}
	}, SAVE_DELAY_MS);
}

function announce(songId: string): void {
	resolvedBatch.push(songId);
	if (flushTimer !== null) return;
	flushTimer = window.setTimeout(() => {
		flushTimer = null;
		const batch = resolvedBatch;
		resolvedBatch = [];
		events.emit("resolved", batch);
	}, 50);
}

function settle(songId: string): void {
	for (const done of waiting.get(songId) ?? []) done();
	waiting.delete(songId);
}

function pump(): void {
	while (active < CONCURRENCY && backlog.length) {
		const songId = backlog.shift()!;
		active += 1;
		void getMetadata(songId)
			.then((meta) => {
				albums()[songId] = typeof meta?.album === "string" ? meta.album.trim() : "";
				save();
				announce(songId);
			})
			.catch((error) => log.debug("could not resolve album", songId, error))
			.finally(() => {
				active -= 1;
				settle(songId);
				pump();
			});
	}
}

export function knownAlbum(songId: string): string | null {
	const cached = albums()[songId];
	if (cached !== undefined) return cached || null;
	const album = peekMetadata(songId)?.album;
	return typeof album === "string" && album.trim() ? album.trim() : null;
}

export function isAlbumKnown(songId: string): boolean {
	return albums()[songId] !== undefined || Boolean(peekMetadata(songId)?.album);
}

export function requestAlbums(songIds: string[]): Promise<void> {
	const missing = [...new Set(songIds)].filter((songId) => songId && !isAlbumKnown(songId));
	if (!missing.length) return Promise.resolve();

	const pending = missing.map(
		(songId) =>
			new Promise<void>((resolve) => {
				const list = waiting.get(songId);
				if (list) {
					list.push(resolve);
					return;
				}
				waiting.set(songId, [resolve]);
				backlog.push(songId);
			}),
	);
	pump();
	return Promise.all(pending).then(() => undefined);
}

export function onAlbums(handler: (songIds: string[]) => void): () => void {
	return events.on("resolved", handler);
}
