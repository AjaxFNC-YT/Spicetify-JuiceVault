import { createLogger } from "../log";
import type { Song } from "../models/song";

const log = createLogger("catalog");

const DB_NAME = "juicevault";
const DB_VERSION = 1;
const SONGS = "songs";
const META = "meta";

interface CacheMeta {
	key: string;
	savedAt: number;
	total: number;
}

function open(): Promise<IDBDatabase> {
	return new Promise((resolve, reject) => {
		const request = indexedDB.open(DB_NAME, DB_VERSION);
		request.onupgradeneeded = () => {
			const db = request.result;
			if (!db.objectStoreNames.contains(SONGS)) db.createObjectStore(SONGS, { keyPath: "id" });
			if (!db.objectStoreNames.contains(META)) db.createObjectStore(META, { keyPath: "key" });
		};
		request.onsuccess = () => resolve(request.result);
		request.onerror = () => reject(request.error);
	});
}

function done(transaction: IDBTransaction): Promise<void> {
	return new Promise((resolve, reject) => {
		transaction.oncomplete = () => resolve();
		transaction.onerror = () => reject(transaction.error);
		transaction.onabort = () => reject(transaction.error);
	});
}

export async function saveSongs(songs: Song[]): Promise<void> {
	try {
		const db = await open();
		const transaction = db.transaction([SONGS, META], "readwrite");
		const store = transaction.objectStore(SONGS);
		store.clear();
		for (const song of songs) store.put(song);
		transaction.objectStore(META).put({ key: "catalog", savedAt: Date.now(), total: songs.length } satisfies CacheMeta);
		await done(transaction);
		db.close();
		log.debug(`cached ${songs.length} songs`);
	} catch (error) {
		log.warn("could not cache catalog", error);
	}
}

export async function loadSongs(maxAgeMs: number): Promise<Song[] | null> {
	try {
		const db = await open();
		const meta = await new Promise<CacheMeta | undefined>((resolve, reject) => {
			const request = db.transaction(META, "readonly").objectStore(META).get("catalog");
			request.onsuccess = () => resolve(request.result as CacheMeta | undefined);
			request.onerror = () => reject(request.error);
		});

		if (!meta || Date.now() - meta.savedAt > maxAgeMs) {
			db.close();
			return null;
		}

		const songs = await new Promise<Song[]>((resolve, reject) => {
			const request = db.transaction(SONGS, "readonly").objectStore(SONGS).getAll();
			request.onsuccess = () => resolve((request.result ?? []) as Song[]);
			request.onerror = () => reject(request.error);
		});

		db.close();
		return songs.length ? songs : null;
	} catch (error) {
		log.warn("could not read cached catalog", error);
		return null;
	}
}

export async function clearCache(): Promise<void> {
	try {
		const db = await open();
		const transaction = db.transaction([SONGS, META], "readwrite");
		transaction.objectStore(SONGS).clear();
		transaction.objectStore(META).clear();
		await done(transaction);
		db.close();
	} catch (error) {
		log.warn("could not clear catalog cache", error);
	}
}
