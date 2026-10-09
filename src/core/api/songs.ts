import { get } from "../http/client";
import { ApiError } from "../http/errors";
import { assetUrl } from "../config";
import { cleanTitle, toSong, toSongs, type Song, type SongCategory } from "../models/song";

export interface SongMetadata {
	id: string;
	title: string;
	artist: string;
	album?: string;
	year?: number | null;
	duration: number;
	length: string;
	bitrate?: number;
	cover?: string;
	play_count?: number;
	category?: string;
}

const CATEGORY_PATHS: Record<SongCategory, string> = {
	main: "/music/list",
	instrumental: "/music/instrumentals/list",
	remaster: "/music/remasters/list",
	stem: "/music/stems/list",
	released: "/music/released/list",
	cut: "/music/cuts/list",
	acapella: "/music/acapellas/list",
	freestyle: "/music/freestyles/list",
};

const metadataCache = new Map<string, SongMetadata>();
const fetched = new Set<string>();

export async function getMetadata(songId: string): Promise<SongMetadata> {
	const hit = metadataCache.get(songId);
	if (hit && fetched.has(songId)) return hit;
	const raw = await get<SongMetadata>(`/music/${encodeURIComponent(songId)}/metadata`);
	const meta = { ...raw, title: cleanTitle(raw.title, raw.category), cover: assetUrl(raw.cover) ?? undefined };
	metadataCache.set(songId, meta);
	fetched.add(songId);
	return meta;
}

export interface TrackerInfo {
	era: string | null;
	trackNumber: number | null;
	title: string | null;
	altNames: string[];
	artists: string | null;
	producers: string | null;
	engineers: string | null;
	additionalInfo: string | null;
	fileNames: string | null;
	instrumentalNames: string | null;
	recordingLocation: string | null;
	recordDate: string | null;
	previewDate: string | null;
	dates: string | null;
	duration: string | null;
	category: string | null;
	availableFiles: string | null;
}

export async function getTrackerInfo(songId: string): Promise<TrackerInfo | null> {
	try {
		return await get<TrackerInfo>(`/music/tracker/info/${encodeURIComponent(songId)}`, { retries: 1 });
	} catch (error) {
		if (error instanceof ApiError && error.status === 404) return null;
		throw error;
	}
}

export function forgetMetadata(): void {
	metadataCache.clear();
	fetched.clear();
}

export function peekMetadata(songId: string): SongMetadata | undefined {
	return metadataCache.get(songId);
}

export function rememberMetadata(song: Song): void {
	if (fetched.has(song.id)) return;
	const previous = metadataCache.get(song.id);
	metadataCache.set(song.id, {
		...(previous ?? {}),
		id: song.id,
		title: song.title,
		artist: song.artist,
		album: song.album ?? previous?.album,
		year: song.year ?? previous?.year ?? null,
		duration: song.durationSeconds || previous?.duration || 0,
		length: song.length,
		cover: song.coverUrl,
		play_count: song.playCount,
	});
}

export async function listCategory(category: SongCategory): Promise<Song[]> {
	const response = await get<{ total: number; songs: unknown[] }>(CATEGORY_PATHS[category]);
	return toSongs(response?.songs ?? [], category);
}

export async function listAll(categories: SongCategory[]): Promise<Song[]> {
	const results = await Promise.allSettled(categories.map((category) => listCategory(category)));
	const seen = new Set<string>();
	const songs: Song[] = [];

	for (const result of results) {
		if (result.status !== "fulfilled") continue;
		for (const song of result.value) {
			if (seen.has(song.id)) continue;
			seen.add(song.id);
			songs.push(song);
		}
	}

	return songs;
}

export async function searchRemote(query: string): Promise<Song[]> {
	const response = await get<{ results: unknown[] }>(`/music/search?q=${encodeURIComponent(query)}`);
	return toSongs(response?.results ?? []);
}

export async function getSong(songId: string): Promise<Song | null> {
	const meta = await getMetadata(songId);
	return toSong(meta);
}
