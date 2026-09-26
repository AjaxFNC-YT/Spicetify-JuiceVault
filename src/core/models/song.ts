import { coverUrl } from "../config";

export type SongCategory = "main" | "instrumental" | "remaster" | "stem" | "released" | "cut";

export interface Song {
	id: string;
	title: string;
	artist: string;
	album: string | null;
	year: number | null;
	durationSeconds: number;
	length: string;
	coverUrl: string;
	playCount: number;
	fileName: string | null;
	fileSizeBytes: number | null;
	category: SongCategory;
	altNames: string[];
	isSessionEdit: boolean;
	archiveAddedAt: string | null;
}

export interface SongListDto {
	total: number;
	songs: unknown[];
}

function parseLength(length: unknown): number {
	if (typeof length !== "string") return 0;
	const parts = length.split(":").map(Number);
	if (parts.some((part) => !Number.isFinite(part))) return 0;
	return parts.reduce((total, part) => total * 60 + part, 0);
}

function formatLength(seconds: number): string {
	if (!Number.isFinite(seconds) || seconds <= 0) return "0:00";
	const minutes = Math.floor(seconds / 60);
	const remainder = Math.floor(seconds % 60);
	return `${minutes}:${String(remainder).padStart(2, "0")}`;
}

export function toSong(raw: any, fallbackCategory: SongCategory = "main"): Song | null {
	if (!raw || typeof raw.id !== "string") return null;

	const durationSeconds = Number.isFinite(raw.duration) ? Number(raw.duration) : parseLength(raw.length);

	return {
		id: raw.id,
		title: typeof raw.title === "string" && raw.title ? raw.title : "Unknown",
		artist: typeof raw.artist === "string" && raw.artist ? raw.artist : "Juice WRLD",
		album: typeof raw.album === "string" ? raw.album : null,
		year: Number.isFinite(raw.year) ? Number(raw.year) : null,
		durationSeconds,
		length: typeof raw.length === "string" ? raw.length : formatLength(durationSeconds),
		coverUrl: coverUrl(raw.id),
		playCount: Number.isFinite(raw.play_count) ? Number(raw.play_count) : 0,
		fileName: typeof raw.file_name === "string" ? raw.file_name : null,
		fileSizeBytes: Number.isFinite(raw.file_size_bytes) ? Number(raw.file_size_bytes) : null,
		category: (typeof raw.category === "string" ? raw.category : fallbackCategory) as SongCategory,
		altNames: Array.isArray(raw.alt_names) ? raw.alt_names.filter((name: unknown) => typeof name === "string") : [],
		isSessionEdit: raw.is_session_edit === true,
		archiveAddedAt: typeof raw.archive_added_at === "string" ? raw.archive_added_at : null,
	};
}

export function toSongs(raw: unknown[], fallbackCategory?: SongCategory): Song[] {
	const songs: Song[] = [];
	for (const entry of raw ?? []) {
		const song = toSong(entry, fallbackCategory);
		if (song) songs.push(song);
	}
	return songs;
}
