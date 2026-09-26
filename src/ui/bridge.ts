import type { Song } from "../core/models/song";
import type { Profile } from "../core/auth/session";
import type { ListeningStats, ProfilePatch } from "../core/api/account";
import type { DeviceSettings } from "../core/settings/device";

export interface JuiceVaultApi {
	catalog: {
		ready: boolean;
		all(): Song[];
		get(songId: string): Song | undefined;
		load(force?: boolean): Promise<void>;
		search(query: string, limit?: number): Array<{ song: Song; score: number }>;
	};
	session: {
		isSignedIn: boolean;
		user: Profile | null;
		events: { on(event: "profile", handler: (profile: Profile | null) => void): () => void };
		signIn(login: string, password: string): Promise<Profile>;
		signOut(): Promise<void>;
		loadProfile(): Promise<Profile | null>;
	};
	account: {
		update(patch: ProfilePatch): Promise<Profile>;
		changePassword(current: string, next: string): Promise<void>;
		stats(): Promise<ListeningStats | null>;
	};
	device: {
		get(): DeviceSettings;
		set(patch: Partial<DeviceSettings>): DeviceSettings;
	};
	player: { current: { songId: string } | null; isPlaying: boolean };
	playList(songs: Song[], index: number, contextName?: string): void;
	playlists(): Promise<Array<{ uri: string; name: string }>>;
	addToPlaylist(playlistUri: string, songId: string): Promise<string>;
}

export function api(): JuiceVaultApi | null {
	return ((window as any).JuiceVault as JuiceVaultApi | undefined) ?? null;
}
