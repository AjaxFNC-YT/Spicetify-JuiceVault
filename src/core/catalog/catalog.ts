import { createLogger } from "../log";
import { listAll, rememberMetadata, searchRemote } from "../api/songs";
import type { Song, SongCategory } from "../models/song";
import { loadSongs, saveSongs, clearCache } from "./store";
import { SearchIndex, type SearchResult } from "./search";

const log = createLogger("catalog");

const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const CATEGORIES: SongCategory[] = ["main", "instrumental", "remaster", "stem", "released", "cut"];

export class Catalog {
	private songs: Song[] = [];
	private byId = new Map<string, Song>();
	private index = new SearchIndex();
	private loading: Promise<void> | null = null;
	private loadedAt = 0;
	private source: "cache" | "network" | "none" = "none";

	get ready(): boolean {
		return this.songs.length > 0;
	}

	get size(): number {
		return this.songs.length;
	}

	all(): Song[] {
		return this.songs;
	}

	get(songId: string): Song | undefined {
		return this.byId.get(songId);
	}

	byCategory(category: SongCategory): Song[] {
		return this.songs.filter((song) => song.category === category);
	}

	async load(force = false): Promise<void> {
		if (this.loading) return this.loading;
		if (this.ready && !force) return;

		this.loading = this.run(force).finally(() => {
			this.loading = null;
		});
		return this.loading;
	}

	private async run(force: boolean): Promise<void> {
		if (!force) {
			const cached = await loadSongs(CACHE_TTL_MS);
			if (cached?.length) {
				this.apply(cached, "cache");
				log.info(`loaded ${cached.length} songs from cache`);
				void this.refresh();
				return;
			}
		}

		await this.refresh();
	}

	private async refresh(): Promise<void> {
		try {
			const songs = await listAll(CATEGORIES);
			if (!songs.length) return;
			this.apply(songs, "network");
			await saveSongs(songs);
			log.info(`loaded ${songs.length} songs from the archive`);
		} catch (error) {
			log.warn("could not refresh the catalog", error);
		}
	}

	private apply(songs: Song[], source: "cache" | "network"): void {
		this.songs = songs;
		this.byId = new Map(songs.map((song) => [song.id, song]));
		this.index.build(songs);
		this.loadedAt = Date.now();
		this.source = source;
		for (const song of songs) rememberMetadata(song);
	}

	search(query: string, limit = 50): SearchResult[] {
		return this.index.search(query, limit);
	}

	async searchOnline(query: string): Promise<Song[]> {
		try {
			return await searchRemote(query);
		} catch (error) {
			log.debug("remote search failed, falling back to local", error);
			return this.search(query).map((result) => result.song);
		}
	}

	async invalidate(): Promise<void> {
		await clearCache();
		this.songs = [];
		this.byId.clear();
		this.index.build([]);
		this.source = "none";
	}

	get diagnostics(): Record<string, unknown> {
		return {
			ready: this.ready,
			size: this.size,
			source: this.source,
			loadedAt: this.loadedAt ? new Date(this.loadedAt).toISOString() : null,
			indexed: this.index.size,
			categories: CATEGORIES.map((category) => ({ category, count: this.byCategory(category).length })),
		};
	}
}
