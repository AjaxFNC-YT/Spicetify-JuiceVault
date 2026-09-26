import type { Session } from "../auth/session";
import { get } from "../http/client";
import { toSong, type Song } from "../models/song";

interface Envelope<T> {
	success: boolean;
	data: T;
	total?: number;
}

export interface Listen {
	songId: string;
	duration: number;
	playSessionId: string;
	source?: "spotify" | "playlist" | "search" | "queue" | "library";
	playlistId?: string | null;
}

export interface HistoryEntry {
	id: string;
	song: Song;
	duration: number;
	completed: boolean;
	source: string;
	listenedAt: string;
}

export interface HistoryPage {
	entries: HistoryEntry[];
	total: number;
}

export interface LeaderboardUser {
	id: string;
	username: string;
	displayName: string;
	avatar: string | null;
}

export interface LeaderboardRow {
	rank: number;
	user: LeaderboardUser;
	value: number;
	detail?: string;
}

export interface Leaderboard {
	updatedAt: string | null;
	nextRefreshAt: string | null;
	hours: LeaderboardRow[];
	plays: LeaderboardRow[];
	completion: LeaderboardRow[];
	activeStreaks: LeaderboardRow[];
	longestStreaks: LeaderboardRow[];
}

export async function logListen(session: Session, listen: Listen, keepalive = false): Promise<void> {
	await session.authed("/user/history", {
		method: "POST",
		retries: 1,
		keepalive,
		body: {
			songId: listen.songId,
			duration: listen.duration,
			source: listen.source ?? "spotify",
			playlistId: listen.playlistId ?? null,
			playSessionId: listen.playSessionId,
		},
	});
}

export async function getHistory(session: Session, limit = 50, offset = 0): Promise<HistoryPage> {
	const result = await session.authed<Envelope<any[]>>(`/user/history?limit=${limit}&offset=${offset}`);
	const entries: HistoryEntry[] = [];
	for (const raw of result?.data ?? []) {
		const song = toSong(raw?.song);
		if (!song) continue;
		entries.push({
			id: String(raw?._id ?? `${raw?.songId}-${raw?.listenedAt}`),
			song,
			duration: Number(raw?.duration ?? 0),
			completed: raw?.completed === true,
			source: typeof raw?.source === "string" ? raw.source : "",
			listenedAt: typeof raw?.listenedAt === "string" ? raw.listenedAt : "",
		});
	}
	return { entries, total: Number(result?.total ?? entries.length) };
}

function user(raw: any): LeaderboardUser {
	return {
		id: String(raw?.id ?? ""),
		username: String(raw?.username ?? ""),
		displayName: String(raw?.displayName || raw?.username || "Unknown"),
		avatar: typeof raw?.avatar === "string" && raw.avatar ? raw.avatar : null,
	};
}

function rows(list: unknown, value: (entry: any) => number, detail?: (entry: any) => string): LeaderboardRow[] {
	if (!Array.isArray(list)) return [];
	return list.map((entry: any, index) => ({
		rank: Number(entry?.rank ?? index + 1),
		user: user(entry?.user),
		value: value(entry),
		detail: detail?.(entry),
	}));
}

export async function communityLeaderboard(): Promise<Leaderboard> {
	const raw = await get<any>("/music/community-leaderboard");
	const categories = raw?.categories ?? {};
	return {
		updatedAt: raw?.updatedAt ?? null,
		nextRefreshAt: raw?.nextRefreshAt ?? null,
		hours: rows(categories.mostHoursListened, (entry) => Number(entry?.totalListenHours ?? 0)),
		plays: rows(categories.mostTotalPlays, (entry) => Number(entry?.plays ?? 0)),
		completion: rows(
			categories.archiveCompletion,
			(entry) => Number(entry?.completionRate ?? 0),
			(entry) => `${Number(entry?.completedSongs ?? 0).toLocaleString()} of ${Number(entry?.totalSongs ?? 0).toLocaleString()}`,
		),
		activeStreaks: rows(categories.streaks?.active, (entry) => Number(entry?.days ?? 0)),
		longestStreaks: rows(categories.streaks?.longest, (entry) => Number(entry?.days ?? 0)),
	};
}
