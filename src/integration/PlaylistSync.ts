import { createLogger } from "../core/log";
import { Emitter, type Unsubscribe } from "../core/emitter";
import { assetUrl, coverUrl } from "../core/config";
import type { Session } from "../core/auth/session";
import {
	addSongs,
	getPlaylist,
	listPlaylists,
	removeSongs,
	UNHEARD_ID,
	type JvPlaylist,
	type JvPlaylistDetail,
} from "../core/api/playlists";
import { describeError } from "../core/http/errors";
import { isJvUri, parseSongId, uriForSong as uriFor } from "./uri";

const log = createLogger("PlaylistSync");

const KEY = "juicevault:sync-links";
const LEGACY_KEY = "juicevault:playlist-links";
const CHUNK = 100;
const COVER_SIZE = 640;
const POLL_MS = 2 * 60 * 1000;
const DEBOUNCE_MS = 1500;
const PAGE = 500;
const MASS_CHANGE_MIN = 10;
const PRUNE_DEBOUNCE_MS = 800;

class PlaylistGoneError extends Error {
	constructor() {
		super("That Spotify playlist no longer exists");
		this.name = "PlaylistGoneError";
	}
}

export const LIKED_SONGS_URI = "spotify:collection:tracks";

export interface PlaylistLink {
	spotifyUri: string;
	jvId: string;
	name: string;
	jvName: string;
	lastSynced: number | null;
	snapshot: string[];
	error: string | null;
}

export interface SyncResult {
	toSpotify: { added: number; removed: number };
	toJuiceVault: { added: number; removed: number };
	total: number;
}

export interface Destination {
	uri: string;
	name: string;
	image?: string | null;
}

export interface SyncApi {
	list(): Promise<JvPlaylist[]>;
	links(): PlaylistLink[];
	linkFor(spotifyUri: string): PlaylistLink | null;
	destinations(): Promise<Destination[]>;
	importNew(jvId: string, summary?: JvPlaylist): Promise<string>;
	importInto(spotifyUri: string, jvId: string): Promise<number>;
	syncNew(jvId: string, summary?: JvPlaylist): Promise<string>;
	syncWith(spotifyUri: string, jvId: string, name: string): Promise<SyncResult>;
	syncNow(spotifyUri: string, confirm?: boolean): Promise<SyncResult>;
	syncAll(): Promise<void>;
	unlink(spotifyUri: string): void;
	prune(): Promise<void>;
	onLinks(handler: (links: PlaylistLink[]) => void): Unsubscribe;
	countJv(spotifyUri: string): Promise<number>;
	removeAllJv(spotifyUri: string): Promise<number>;
}

interface JvItem {
	songId: string;
	uri: string;
	uid: string;
}

type AnyFn = (...args: any[]) => any;

export function isLikedUri(uri: unknown): boolean {
	return typeof uri === "string" && (uri === LIKED_SONGS_URI || /^spotify:user:[^:]+:collection$/.test(uri));
}

function normalise(uri: string): string {
	return isLikedUri(uri) ? LIKED_SONGS_URI : uri;
}

function chunks<T>(list: T[], size: number): T[][] {
	const out: T[][] = [];
	for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
	return out;
}

async function loadImage(url: string): Promise<HTMLImageElement | null> {
	try {
		const image = new Image();
		image.crossOrigin = "anonymous";
		image.src = url;
		await image.decode();
		return image.naturalWidth ? image : null;
	} catch {
		return null;
	}
}

function drawSquare(context: CanvasRenderingContext2D, image: HTMLImageElement, x: number, y: number, size: number): void {
	const side = Math.min(image.naturalWidth, image.naturalHeight);
	context.drawImage(
		image,
		(image.naturalWidth - side) / 2,
		(image.naturalHeight - side) / 2,
		side,
		side,
		x,
		y,
		size,
		size,
	);
}

async function buildCover(detail: JvPlaylistDetail): Promise<Blob | null> {
	const custom = assetUrl(detail.coverImage);
	const ids = detail.recentSongIds;
	const sources = custom ? [custom] : ids.length >= 4 ? ids.slice(-4).map(coverUrl) : ids.length ? [coverUrl(ids[ids.length - 1]!)] : [];
	if (!sources.length) return null;

	const images = (await Promise.all(sources.map(loadImage))).filter((image): image is HTMLImageElement => Boolean(image));
	if (!images.length) return null;

	const canvas = document.createElement("canvas");
	canvas.width = COVER_SIZE;
	canvas.height = COVER_SIZE;
	const context = canvas.getContext("2d");
	if (!context) return null;

	if (images.length >= 4) {
		const half = COVER_SIZE / 2;
		images.slice(0, 4).forEach((image, index) => drawSquare(context, image, (index % 2) * half, Math.floor(index / 2) * half, half));
	} else {
		drawSquare(context, images[0]!, 0, 0, COVER_SIZE);
	}

	return await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.86));
}

export class PlaylistSync implements SyncApi {
	private store: Record<string, PlaylistLink> = this.read();
	private running = new Set<string>();
	private rerun = new Set<string>();
	private debounces = new Map<string, number>();
	private poll: number | null = null;
	private raw: Record<string, AnyFn> = {};
	private hooked: Array<{ target: any; key: string; descriptor?: PropertyDescriptor }> = [];
	private readonly events = new Emitter<{ links: PlaylistLink[] }>();
	private pruneTimer: number | null = null;
	private stopRootlist: (() => void) | null = null;

	constructor(private readonly session: Session) {
		this.captureRaw();
	}

	private get playlistApi(): any {
		return Spicetify.Platform.PlaylistAPI;
	}

	private get libraryApi(): any {
		return Spicetify.Platform.LibraryAPI;
	}

	private get rootlist(): any {
		return Spicetify.Platform.RootlistAPI;
	}

	private captureRaw(): void {
		const bind = (target: any, key: string, name: string): void => {
			if (typeof target?.[key] === "function") this.raw[name] = target[key].bind(target);
		};
		bind(this.playlistApi, "add", "playlistAdd");
		bind(this.playlistApi, "remove", "playlistRemove");
		bind(this.libraryApi, "add", "libraryAdd");
		bind(this.libraryApi, "remove", "libraryRemove");
	}

	private read(): Record<string, PlaylistLink> {
		try {
			const raw = Spicetify.LocalStorage.get(KEY);
			if (raw) return JSON.parse(raw) as Record<string, PlaylistLink>;

			const legacy = Spicetify.LocalStorage.get(LEGACY_KEY);
			if (!legacy) return {};
			const migrated: Record<string, PlaylistLink> = {};
			for (const [uri, link] of Object.entries(JSON.parse(legacy) as Record<string, any>)) {
				migrated[uri] = {
					spotifyUri: uri,
					jvId: link.jvId,
					name: link.name ?? "",
					jvName: link.name ?? "",
					lastSynced: link.lastSynced ?? null,
					snapshot: Array.isArray(link.managed) ? link.managed : [],
					error: null,
				};
			}
			Spicetify.LocalStorage.remove(LEGACY_KEY);
			return migrated;
		} catch {
			return {};
		}
	}

	private write(): void {
		try {
			Spicetify.LocalStorage.set(KEY, JSON.stringify(this.store));
		} catch (error) {
			log.warn("could not save sync links", error);
		}
		this.events.emit("links", this.links());
	}

	list(): Promise<JvPlaylist[]> {
		return listPlaylists(this.session);
	}

	links(): PlaylistLink[] {
		return Object.values(this.store);
	}

	linkFor(spotifyUri: string): PlaylistLink | null {
		return this.store[normalise(spotifyUri)] ?? null;
	}

	async destinations(): Promise<Destination[]> {
		const contents = await this.rootlist.getContents({ limit: 500 });
		const playlists: Destination[] = [];
		const walk = (items: any[]): void => {
			for (const item of items ?? []) {
				if (item?.type === "folder") walk(item.items);
				else if (item?.type === "playlist" && item.isOwnedBySelf && item.canAdd !== false) {
					playlists.push({ uri: item.uri, name: item.name, image: item.images?.[0]?.url ?? null });
				}
			}
		};
		walk(contents?.items ?? []);
		return [{ uri: LIKED_SONGS_URI, name: "Liked Songs" }, ...playlists];
	}

	private async inLibrary(spotifyUri: string): Promise<boolean> {
		const contents = await this.rootlist.getContents({ limit: 500 });
		const walk = (items: any[]): boolean =>
			(items ?? []).some((item) => (item?.type === "folder" ? walk(item.items) : normalise(item?.uri ?? "") === spotifyUri));
		return walk(contents?.items ?? []);
	}

	private async readPage(spotifyUri: string, offset: number): Promise<any> {
		try {
			return await this.playlistApi.getContents(spotifyUri, { offset, limit: PAGE });
		} catch (error) {
			if (!/invalid playlist response/i.test(error instanceof Error ? error.message : "")) throw error;
			if (!(await this.inLibrary(spotifyUri))) throw new PlaylistGoneError();
			return { items: [], totalLength: offset };
		}
	}

	private async readDestination(spotifyUri: string): Promise<JvItem[]> {
		const liked = isLikedUri(spotifyUri);
		const all: any[] = [];

		for (let offset = 0; offset < 100000; ) {
			const page = liked ? await this.libraryApi.getTracks({ offset, limit: PAGE }) : await this.readPage(spotifyUri, offset);
			const items: any[] = page?.items ?? [];
			all.push(...items);

			const total = Number(page?.totalLength ?? page?.total ?? NaN);
			offset += items.length;
			const known = Number.isFinite(total);
			if (!items.length || (known ? offset >= total : items.length < PAGE)) {
				if (known && all.length < total) {
					throw new Error(`Spotify only returned ${all.length} of ${total} songs, so sync was skipped to be safe`);
				}
				break;
			}
		}

		const jv: JvItem[] = [];
		for (const item of all) {
			if (!isJvUri(item?.uri)) continue;
			const songId = parseSongId(item.uri);
			if (songId) jv.push({ songId, uri: item.uri, uid: item.uid ?? "" });
		}
		return jv;
	}

	private async addToDestination(spotifyUri: string, uris: string[]): Promise<void> {
		for (const batch of chunks(uris, CHUNK)) {
			if (isLikedUri(spotifyUri)) await this.raw.libraryAdd!({ uris: batch, silent: true });
			else await this.raw.playlistAdd!(spotifyUri, batch, { before: "end" });
		}
	}

	private async removeFromDestination(spotifyUri: string, items: JvItem[]): Promise<void> {
		for (const batch of chunks(items, CHUNK)) {
			if (isLikedUri(spotifyUri)) await this.raw.libraryRemove!({ uris: batch.map((item) => item.uri), silent: true });
			else await this.raw.playlistRemove!(spotifyUri, batch.map((item) => ({ uid: item.uid, uri: item.uri })));
		}
	}

	private async applyLook(spotifyUri: string, detail: JvPlaylistDetail): Promise<void> {
		try {
			if (detail.description) await this.playlistApi.updateDetails(spotifyUri, { description: detail.description });
		} catch (error) {
			log.debug("could not set the description", error);
		}

		try {
			await this.rootlist.setPublishedState(spotifyUri, detail.isPublic);
		} catch (error) {
			log.debug("could not set privacy", error);
		}

		try {
			const cover = await buildCover(detail);
			if (!cover) return;
			const token = await this.playlistApi.uploadImage(await cover.arrayBuffer());
			if (token) await this.playlistApi.updateDetails(spotifyUri, { imageUploadToken: token });
		} catch (error) {
			log.warn("could not set the playlist cover", error);
		}
	}

	private async createFrom(detail: JvPlaylistDetail): Promise<string> {
		const spotifyUri: string | null = await this.rootlist.createPlaylist(detail.name, { after: "start" });
		if (!spotifyUri) throw new Error("Spotify did not create the playlist");
		await this.addToDestination(spotifyUri, detail.songs.map(uriFor));
		await this.applyLook(spotifyUri, detail);
		return spotifyUri;
	}

	async importNew(jvId: string, summary?: JvPlaylist): Promise<string> {
		const detail = await getPlaylist(this.session, jvId, summary);
		const spotifyUri = await this.createFrom(detail);
		log.info(`imported "${detail.name}" (${detail.songs.length} songs)`);
		return spotifyUri;
	}

	async importInto(spotifyUri: string, jvId: string): Promise<number> {
		const detail = await getPlaylist(this.session, jvId);
		const present = new Set((await this.readDestination(spotifyUri)).map((item) => item.songId));
		const missing = detail.songs.filter((song) => !present.has(song.id));
		await this.addToDestination(spotifyUri, missing.map(uriFor));
		return missing.length;
	}

	async syncNew(jvId: string, summary?: JvPlaylist): Promise<string> {
		const detail = await getPlaylist(this.session, jvId, summary);
		const spotifyUri = await this.createFrom(detail);
		this.store[spotifyUri] = {
			spotifyUri,
			jvId,
			name: detail.name,
			jvName: detail.name,
			lastSynced: Date.now(),
			snapshot: detail.songs.map((song) => song.id),
			error: null,
		};
		this.write();
		return spotifyUri;
	}

	async syncWith(spotifyUri: string, jvId: string, name: string): Promise<SyncResult> {
		if (jvId === UNHEARD_ID) throw new Error("Unheard can only sync to its own new playlist. Use Sync on the Unheard page.");
		const uri = normalise(spotifyUri);
		this.store[uri] = { spotifyUri: uri, jvId, name, jvName: "", lastSynced: null, snapshot: [], error: null };
		this.write();
		return this.syncNow(uri);
	}

	unlink(spotifyUri: string): void {
		delete this.store[normalise(spotifyUri)];
		this.write();
	}

	onLinks(handler: (links: PlaylistLink[]) => void): Unsubscribe {
		return this.events.on("links", handler);
	}

	async prune(): Promise<void> {
		const linked = this.links().filter((link) => !isLikedUri(link.spotifyUri));
		if (!linked.length) return;

		const present = new Set<string>();
		const walk = (items: any[]): void => {
			for (const item of items ?? []) {
				if (item?.type === "folder") walk(item.items);
				else if (item?.uri) present.add(normalise(item.uri));
			}
		};
		const contents = await this.rootlist.getContents({ limit: 5000 });
		if (!Array.isArray(contents?.items)) return;
		if (Number.isFinite(contents.totalLength) && contents.items.length < contents.totalLength) return;
		walk(contents.items);

		const gone = linked.filter((link) => !present.has(link.spotifyUri));
		if (!gone.length) return;
		for (const link of gone) {
			log.info(`"${link.name}" was deleted in Spotify, so it is no longer synced`);
			delete this.store[link.spotifyUri];
		}
		this.write();
	}

	private schedulePrune(): void {
		if (this.pruneTimer !== null) window.clearTimeout(this.pruneTimer);
		this.pruneTimer = window.setTimeout(() => {
			this.pruneTimer = null;
			void this.prune().catch((error) => log.debug("could not check for deleted playlists", error));
		}, PRUNE_DEBOUNCE_MS);
	}

	private watchRootlist(): void {
		const events = this.rootlist?.getEvents?.();
		if (typeof events?.addListener !== "function") return;
		const handler = (): void => this.schedulePrune();
		events.addListener("update", handler);
		events.addListener("operation_complete", handler);
		this.stopRootlist = () => {
			events.removeListener?.("update", handler);
			events.removeListener?.("operation_complete", handler);
		};
	}

	async syncNow(spotifyUri: string, confirm = false): Promise<SyncResult> {
		const uri = normalise(spotifyUri);
		const link = this.store[uri];
		if (!link) throw new Error("That playlist isn't synced with JuiceVault");

		const empty: SyncResult = { toSpotify: { added: 0, removed: 0 }, toJuiceVault: { added: 0, removed: 0 }, total: link.snapshot.length };
		if (this.running.has(uri)) {
			this.rerun.add(uri);
			return empty;
		}

		this.running.add(uri);
		try {
			const result = await this.merge(link, confirm);
			this.write();
			return result;
		} catch (error) {
			if (error instanceof PlaylistGoneError) {
				log.info(`"${link.name}" was deleted in Spotify, so it is no longer synced`);
				this.unlink(uri);
				return empty;
			}
			const message = error instanceof Error ? error.message : String(error);
			if (this.store[uri]) this.store[uri] = { ...this.store[uri]!, error: message };
			this.write();
			throw error;
		} finally {
			this.running.delete(uri);
			if (this.rerun.delete(uri)) this.schedule(uri);
		}
	}

	private async merge(link: PlaylistLink, confirm: boolean): Promise<SyncResult> {
		const detail = await getPlaylist(this.session, link.jvId);
		const songsById = new Map(detail.songs.map((song) => [song.id, song]));
		const jv = new Set(songsById.keys());

		const items = await this.readDestination(link.spotifyUri);
		const spotify = new Map<string, JvItem[]>();
		for (const item of items) spotify.set(item.songId, [...(spotify.get(item.songId) ?? []), item]);

		const base = new Set(link.snapshot);
		const writable = !detail.readOnly;

		const toJvAdd = writable ? [...spotify.keys()].filter((id) => !base.has(id) && !jv.has(id)) : [];
		const toJvRemove = writable ? [...base].filter((id) => !spotify.has(id) && jv.has(id)) : [];
		const toSpotifyAdd = detail.songs.filter((song) => !base.has(song.id) && !spotify.has(song.id));
		const toSpotifyRemove = [...base].filter((id) => !jv.has(id) && spotify.has(id)).flatMap((id) => spotify.get(id) ?? []);

		const massive = (count: number): boolean => !confirm && count >= MASS_CHANGE_MIN && count > base.size / 2;
		if (massive(toJvRemove.length)) {
			throw new Error(`Paused: ${toJvRemove.length} songs disappeared from Spotify at once. Use Sync now to confirm, or Stop syncing.`);
		}
		if (massive(new Set(toSpotifyRemove.map((item) => item.songId)).size)) {
			throw new Error(`Paused: ${toSpotifyRemove.length} songs disappeared from JuiceVault at once. Use Sync now to confirm, or Stop syncing.`);
		}

		let pushError: string | null = null;
		let pushedAdds: string[] = [];
		let pushedRemoves: string[] = [];

		try {
			await addSongs(this.session, link.jvId, toJvAdd);
			pushedAdds = toJvAdd;
			await removeSongs(this.session, link.jvId, toJvRemove);
			pushedRemoves = toJvRemove;
		} catch (error) {
			pushError = describeError(error, "JuiceVault rejected the change");
			log.warn(`could not update "${detail.name}" on JuiceVault`, error);
		}

		if (toSpotifyAdd.length) await this.addToDestination(link.spotifyUri, toSpotifyAdd.map(uriFor));
		if (toSpotifyRemove.length) await this.removeFromDestination(link.spotifyUri, toSpotifyRemove);

		const settled = new Set(songsById.keys());
		for (const id of pushedAdds) settled.add(id);
		for (const id of pushedRemoves) settled.delete(id);

		this.store[link.spotifyUri] = {
			...link,
			jvName: detail.name,
			lastSynced: Date.now(),
			snapshot: [...settled],
			error: pushError,
		};

		const changes = toJvAdd.length + toJvRemove.length + toSpotifyAdd.length + toSpotifyRemove.length;
		if (changes) {
			log.info(
				`synced "${detail.name}": spotify +${toSpotifyAdd.length} -${toSpotifyRemove.length}, juicevault +${toJvAdd.length} -${toJvRemove.length}`,
			);
		}

		return {
			toSpotify: { added: toSpotifyAdd.length, removed: toSpotifyRemove.length },
			toJuiceVault: { added: toJvAdd.length, removed: toJvRemove.length },
			total: settled.size,
		};
	}

	async syncAll(): Promise<void> {
		if (!this.session.isSignedIn) return;
		await this.prune().catch((error) => log.debug("could not check for deleted playlists", error));
		for (const link of this.links()) {
			try {
				await this.syncNow(link.spotifyUri);
			} catch (error) {
				log.warn(`could not sync "${link.name}"`, error);
			}
		}
	}

	async countJv(spotifyUri: string): Promise<number> {
		return (await this.readDestination(normalise(spotifyUri))).length;
	}

	async removeAllJv(spotifyUri: string): Promise<number> {
		const uri = normalise(spotifyUri);
		this.unlink(uri);
		const items = await this.readDestination(uri);
		await this.removeFromDestination(uri, items);
		return items.length;
	}

	private schedule(spotifyUri: string): void {
		const uri = normalise(spotifyUri);
		if (!this.store[uri] || !this.session.isSignedIn) return;
		const existing = this.debounces.get(uri);
		if (existing) window.clearTimeout(existing);
		this.debounces.set(
			uri,
			window.setTimeout(() => {
				this.debounces.delete(uri);
				void this.syncNow(uri).catch((error) => log.warn("sync after edit failed", error));
			}, DEBOUNCE_MS),
		);
	}

	private touched(args: any[]): string[] {
		const uris: string[] = [];
		for (const arg of args) {
			const candidate = typeof arg === "string" ? arg : arg?.uri;
			if (typeof candidate === "string" && candidate.startsWith("spotify:") && this.store[normalise(candidate)]) {
				uris.push(normalise(candidate));
			}
		}
		return uris;
	}

	private hook(target: any, key: string, affectsLiked: boolean): void {
		if (!target || typeof target[key] !== "function") return;
		const original = target[key].bind(target);
		const descriptor = Object.getOwnPropertyDescriptor(target, key);

		Object.defineProperty(target, key, {
			value: (...args: any[]) => {
				const result = original(...args);
				const after = (): void => {
					for (const uri of this.touched(args)) this.schedule(uri);
					if (affectsLiked) this.schedule(LIKED_SONGS_URI);
				};
				if (result && typeof result.then === "function") void result.then(after, () => undefined);
				else after();
				return result;
			},
			writable: true,
			configurable: true,
			enumerable: descriptor?.enumerable ?? false,
		});

		this.hooked.push({ target, key, descriptor });
	}

	start(): void {
		if (this.hooked.length === 0) {
			this.hook(this.playlistApi, "add", false);
			this.hook(this.playlistApi, "remove", false);
			this.hook(this.libraryApi, "add", true);
			this.hook(this.libraryApi, "remove", true);
			this.hook(Spicetify.Platform.ListPlatformAPI, "add", false);
			this.hook(Spicetify.Platform.ListPlatformAPI, "remove", false);
			this.hook(Spicetify.Platform.ListPlatformAPI, "removeAll", false);
		}

		if (!this.stopRootlist) this.watchRootlist();

		if (this.poll === null) {
			void this.syncAll();
			this.poll = window.setInterval(() => void this.syncAll(), POLL_MS);
		}
	}

	dispose(): void {
		if (this.poll !== null) window.clearInterval(this.poll);
		this.poll = null;
		this.stopRootlist?.();
		this.stopRootlist = null;
		if (this.pruneTimer !== null) window.clearTimeout(this.pruneTimer);
		this.pruneTimer = null;
		for (const timer of this.debounces.values()) window.clearTimeout(timer);
		this.debounces.clear();
		for (const { target, key, descriptor } of this.hooked) {
			if (descriptor) Object.defineProperty(target, key, descriptor);
			else delete target[key];
		}
		this.hooked = [];
	}
}
