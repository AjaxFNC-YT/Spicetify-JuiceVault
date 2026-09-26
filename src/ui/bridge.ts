import type { Song } from "../core/models/song";
import type { Profile } from "../core/auth/session";
import type { ListeningActivity, ListeningStats, ProfilePatch } from "../core/api/account";
import type { HistoryPage, Leaderboard } from "../core/api/history";
import type { NewsItem } from "../core/api/news";
import type { Connection } from "../core/api/connections";
import type { DeviceSettings } from "../core/settings/device";
import type { SyncApi } from "../integration/PlaylistSync";
import type { CurationTarget } from "../integration/curation";
import type { UpdateStatus } from "../integration/Updates";

export interface JuiceVaultApi {
	catalog: {
		ready: boolean;
		events: { on(event: "updated", handler: (count: number) => void): () => void };
		all(): Song[];
		get(songId: string): Song | undefined;
		load(force?: boolean): Promise<void>;
		search(query: string, limit?: number): Array<{ song: Song; score: number; matchedName: string | null }>;
		searchSongs(query: string, limit?: number): Song[];
	};
	session: {
		isSignedIn: boolean;
		user: Profile | null;
		events: { on(event: "profile", handler: (profile: Profile | null) => void): () => void };
		signIn(login: string, password: string): Promise<Profile>;
		signInWithTokens(accessToken: string, refreshToken: string): Promise<Profile>;
		signOut(): Promise<void>;
		loadProfile(): Promise<Profile | null>;
	};
	sync: SyncApi;
	news: { list(limit?: number, offset?: number): Promise<{ items: NewsItem[]; total: number }>; markSeen(id: string): void; hasUnseen(): boolean };
	onNews(handler: (unseen: boolean) => void): () => void;
	connections: { link(connection: Connection): Promise<boolean>; unlink(connection: Connection): Promise<void> };
	history: { list(limit?: number, offset?: number): Promise<HistoryPage> };
	leaderboard(): Promise<Leaderboard>;
	unheard(): Promise<Song[]>;
	unheardCached(): Song[];
	onListenCompleted(handler: (songId: string) => void): () => void;
	account: {
		update(patch: ProfilePatch): Promise<Profile>;
		changePassword(current: string, next: string): Promise<void>;
		stats(): Promise<ListeningStats | null>;
		activity(): Promise<ListeningActivity | null>;
	};
	device: {
		get(): DeviceSettings;
		set(patch: Partial<DeviceSettings>): DeviceSettings;
	};
	player: { current: { songId: string } | null; isPlaying: boolean };
	playList(songs: Song[], index: number, contextName?: string): void;
	playlists(): Promise<Array<{ uri: string; name: string }>>;
	addToPlaylist(playlistUri: string, songId: string): Promise<string>;
	saveToLiked(songId: string): Promise<void>;
	updates: { status(): UpdateStatus; check(): Promise<UpdateStatus>; whatsNew(): Promise<void>; on(handler: (status: UpdateStatus) => void): () => void };
	albums: { get(songId: string): string | null; request(songIds: string[]): Promise<void>; on(handler: (songIds: string[]) => void): () => void };
	curation: { targets(songId: string): Promise<CurationTarget[]>; apply(songId: string, add: string[], remove: string[]): Promise<void> };
	newPlaylistWith(songId: string): Promise<string>;
}

export function api(): JuiceVaultApi | null {
	return ((window as any).JuiceVault as JuiceVaultApi | undefined) ?? null;
}
