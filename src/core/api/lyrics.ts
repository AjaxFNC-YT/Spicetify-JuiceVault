import { get } from "../http/client";

export interface LyricLine {
	time: number;
	text: string;
}

export interface Lyrics {
	songId: string;
	synced: boolean;
	lines: LyricLine[];
	plain: string | null;
	source: string | null;
}

interface Envelope {
	success: boolean;
	data: {
		songId?: string;
		status?: string;
		synced?: boolean;
		lines?: Array<{ time?: number; text?: string }>;
		plain?: string | null;
		source?: string | null;
	};
}

const cache = new Map<string, Promise<Lyrics | null>>();

function toLyrics(songId: string, data: Envelope["data"] | undefined): Lyrics | null {
	if (!data || data.status === "not_found") return null;
	const lines = (data.lines ?? [])
		.filter((line) => Number.isFinite(line.time))
		.map((line) => ({ time: Number(line.time), text: typeof line.text === "string" ? line.text.trim() : "" }))
		.sort((a, b) => a.time - b.time);
	const plain = typeof data.plain === "string" && data.plain.trim() ? data.plain.trim() : null;
	const synced = Boolean(data.synced) && lines.some((line) => line.text);
	if (!synced && !plain) return null;
	return { songId, synced, lines: synced ? lines : [], plain, source: data.source ?? null };
}

export function getLyrics(songId: string): Promise<Lyrics | null> {
	let pending = cache.get(songId);
	if (!pending) {
		pending = get<Envelope>(`/music/lyrics/${encodeURIComponent(songId)}`, { retries: 1 })
			.then((result) => toLyrics(songId, result?.data))
			.catch((error) => {
				cache.delete(songId);
				throw error;
			});
		cache.set(songId, pending);
	}
	return pending;
}

export function activeLine(lines: LyricLine[], seconds: number): number {
	let low = 0;
	let high = lines.length - 1;
	let found = -1;
	while (low <= high) {
		const middle = (low + high) >> 1;
		if (lines[middle]!.time <= seconds) {
			found = middle;
			low = middle + 1;
		} else {
			high = middle - 1;
		}
	}
	return found;
}
