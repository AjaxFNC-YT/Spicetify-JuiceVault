import type { Session } from "../auth/session";
import { toSong, type Song } from "../models/song";

interface Envelope<T> {
	success: boolean;
	data: T;
	total?: number;
	collaborated?: unknown[];
}

export type PlaylistKind = "playlist" | "liked" | "unheard";

export interface JvPlaylist {
	id: string;
	kind: PlaylistKind;
	name: string;
	description: string;
	isPublic: boolean;
	coverImage: string | null;
	songCount: number;
	recentSongIds: string[];
	isCollaborator: boolean;
	readOnly: boolean;
}

export interface JvPlaylistDetail extends JvPlaylist {
	songs: Song[];
}

export const LIKED_ID = "liked";
export const UNHEARD_ID = "unheard";

const LIKES_PAGE = 200;
const ADD_BATCH = 100;

function isLocalId(id: unknown): boolean {
	return String(id ?? "").startsWith("local:");
}

function recent(ids: string[]): string[] {
	return ids.filter((id) => id && !isLocalId(id)).slice(-4);
}

function summarise(raw: any, isCollaborator: boolean): JvPlaylist {
	const entries: any[] = Array.isArray(raw?.songs) ? raw.songs : [];
	const ids = entries.map((entry) => String(entry?.songId ?? entry?.song?.id ?? entry?.id ?? ""));
	return {
		id: String(raw?._id ?? raw?.id ?? ""),
		kind: "playlist",
		name: typeof raw?.name === "string" && raw.name ? raw.name : "Untitled playlist",
		description: typeof raw?.description === "string" ? raw.description : "",
		isPublic: raw?.isPublic === true,
		coverImage: typeof raw?.coverImage === "string" && raw.coverImage ? raw.coverImage : null,
		songCount: entries.length || Number(raw?.songCount ?? 0),
		recentSongIds: recent(ids),
		isCollaborator,
		readOnly: false,
	};
}

function songsFrom(entries: unknown[]): Song[] {
	const songs: Song[] = [];
	for (const entry of entries ?? []) {
		const raw = (entry as any)?.song ?? entry;
		if (!raw || raw.local === true || isLocalId(raw.id)) continue;
		const song = toSong(raw);
		if (song) songs.push(song);
	}
	return songs;
}

export async function listPlaylists(session: Session): Promise<JvPlaylist[]> {
	const result = await session.authed<Envelope<unknown[]>>("/user/playlists");
	const owned = (result?.data ?? []).map((raw) => summarise(raw, false));
	const collaborated = (result?.collaborated ?? []).map((raw) => summarise(raw, true));

	const liked: JvPlaylist = {
		id: LIKED_ID,
		kind: "liked",
		name: "JuiceVault Liked Songs",
		description: "Songs you liked on JuiceVault.",
		isPublic: false,
		coverImage: null,
		songCount: Number(session.user?.stats?.likedCount ?? 0),
		recentSongIds: [],
		isCollaborator: false,
		readOnly: false,
	};

	const unheard: JvPlaylist = {
		id: UNHEARD_ID,
		kind: "unheard",
		name: "Unheard",
		description: "Archive songs you haven't finished yet.",
		isPublic: false,
		coverImage: null,
		songCount: 0,
		recentSongIds: [],
		isCollaborator: false,
		readOnly: true,
	};

	return [liked, unheard, ...owned, ...collaborated];
}

async function likedSongs(session: Session): Promise<Song[]> {
	const songs: Song[] = [];
	for (let offset = 0; offset < 10000; offset += LIKES_PAGE) {
		const result = await session.authed<Envelope<unknown[]>>(`/user/likes?limit=${LIKES_PAGE}&offset=${offset}`);
		const page = result?.data ?? [];
		songs.push(...songsFrom(page));
		const total = Number(result?.total ?? 0);
		if (page.length < LIKES_PAGE || songs.length >= total) break;
	}
	return songs;
}

export async function getPlaylist(session: Session, id: string, summary?: JvPlaylist): Promise<JvPlaylistDetail> {
	if (id === LIKED_ID) {
		const songs = await likedSongs(session);
		const base = summary ?? (await listPlaylists(session)).find((entry) => entry.id === LIKED_ID)!;
		return { ...base, songs, songCount: songs.length, recentSongIds: songs.slice(0, 4).map((song) => song.id) };
	}

	const path = id === UNHEARD_ID ? "/user/playlists/unheard" : `/user/playlists/${encodeURIComponent(id)}`;
	const result = await session.authed<Envelope<any>>(path);
	const raw = result?.data ?? {};
	const songs = songsFrom(raw.songs ?? []);
	const base = summarise(raw, summary?.isCollaborator ?? false);

	return {
		...base,
		id,
		kind: id === UNHEARD_ID ? "unheard" : "playlist",
		name: id === UNHEARD_ID ? "Unheard" : base.name,
		readOnly: id === UNHEARD_ID,
		songs,
		songCount: songs.length,
		recentSongIds: recent(songs.map((song) => song.id)),
	};
}

export async function addSongs(session: Session, id: string, songIds: string[]): Promise<void> {
	if (!songIds.length) return;

	if (id === LIKED_ID) {
		for (const songId of songIds) {
			await session.authed(`/user/likes/${encodeURIComponent(songId)}`, { method: "POST", retries: 1 });
		}
		return;
	}

	if (id === UNHEARD_ID) return;

	for (let i = 0; i < songIds.length; i += ADD_BATCH) {
		await session.authed(`/user/playlists/${encodeURIComponent(id)}/songs`, {
			method: "POST",
			retries: 1,
			body: { songIds: songIds.slice(i, i + ADD_BATCH) },
		});
	}
}

export async function removeSongs(session: Session, id: string, songIds: string[]): Promise<void> {
	if (!songIds.length || id === UNHEARD_ID) return;

	const base = id === LIKED_ID ? "/user/likes" : `/user/playlists/${encodeURIComponent(id)}/songs`;
	for (const songId of songIds) {
		await session.authed(`${base}/${encodeURIComponent(songId)}`, { method: "DELETE", retries: 1 });
	}
}
