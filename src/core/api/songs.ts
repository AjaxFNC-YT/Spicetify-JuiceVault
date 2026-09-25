import { config } from "../config";

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
}

const cache = new Map<string, SongMetadata>();

function base(): string {
	return config.api.baseUrl.replace(/\/+$/, "");
}

async function request<T>(path: string): Promise<T> {
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), config.api.timeoutMs);
	try {
		const response = await fetch(`${base()}${path}`, { signal: controller.signal });
		if (!response.ok) throw new Error(`${path} failed: ${response.status}`);
		return (await response.json()) as T;
	} finally {
		clearTimeout(timer);
	}
}

export async function getMetadata(songId: string): Promise<SongMetadata> {
	const hit = cache.get(songId);
	if (hit) return hit;
	const meta = await request<SongMetadata>(`/music/${encodeURIComponent(songId)}/metadata`);
	cache.set(songId, meta);
	return meta;
}

export function peekMetadata(songId: string): SongMetadata | undefined {
	return cache.get(songId);
}
