import { createLogger } from "../core/log";
import { albumName } from "../core/settings/device";
import { assetUrl } from "../core/config";
import { getMetadata } from "../core/api/songs";
import { knownAlbum } from "../core/catalog/albums";
import { isJvUri, parseSongId, buildTrackUri } from "./uri";
import { getViewOptions, getContextName, onViewOptionsChanged, recordContextName } from "./Playability";
import type { ShadowPlayer } from "../playback/ShadowPlayer";
import type { Arbiter } from "../playback/Arbiter";
import type { Queue } from "../playback/Queue";

const log = createLogger("PlayInterceptor");
const HANDOFF_LEAD_MS = 450;
const BROWSE_CONTEXT = "juicevault:browse";
const SPOTIFY_LEAD_MS = 120;

function toQueueItem(item: any, template: any): any {
	if (!item) return item;
	return {
		...(template ?? {}),
		type: item.type ?? "track",
		uri: item.uri,
		uid: item.uid,
		name: item.name,
		mediaType: item.mediaType ?? "audio",
		duration: item.duration,
		album: item.album,
		artists: item.artists,
		isLocal: item.isLocal ?? false,
		isExplicit: item.isExplicit ?? false,
		is19PlusOnly: item.is19PlusOnly ?? false,
		hasAssociatedVideo: item.hasAssociatedVideo ?? false,
		provider: item.provider ?? "context",
		metadata: item.metadata ?? {},
		images: item.images ?? item.album?.images ?? [],
	};
}

type AnyFn = (...args: any[]) => any;

interface QueueSong {
	id: string;
	title: string;
	artist: string;
	album: string | null;
	durationSeconds: number;
	coverUrl: string | null;
}

function jvItem(song: QueueSong, uid: string): any {
	const uri = buildTrackUri({ songId: song.id, artist: song.artist, title: song.title, durationSeconds: song.durationSeconds });
	const artist = { type: "artist", uri, name: song.artist };
	const images = song.coverUrl ? [{ url: song.coverUrl, label: "standard" }] : [];
	return {
		type: "track",
		uri,
		uid,
		name: song.title,
		mediaType: "audio",
		duration: { milliseconds: Math.round(song.durationSeconds * 1000) },
		album: { type: "album", uri, name: albumName(song.album ?? knownAlbum(song.id)), artist, images },
		artists: [artist],
		isLocal: true,
		isExplicit: false,
		isPlayable: true,
		hasAssociatedVideo: false,
		provider: "juicevault",
		metadata: {},
		images,
	};
}

async function spotifyItems(uris: string[]): Promise<Map<string, any>> {
	const found = new Map<string, any>();
	const ids = uris.map((uri) => uri.split(":")[2]).filter(Boolean);
	if (!ids.length) return found;
	try {
		const response = await Spicetify.CosmosAsync.get(`https://api.spotify.com/v1/tracks?ids=${ids.join(",")}`);
		for (const track of response?.tracks ?? []) {
			if (!track?.uri) continue;
			const images = (track.album?.images ?? []).map((image: any) => ({ url: image.url, label: "standard" }));
			found.set(track.uri, {
				type: "track",
				uri: track.uri,
				name: track.name,
				mediaType: "audio",
				duration: { milliseconds: track.duration_ms },
				album: { type: "album", uri: track.album?.uri, name: track.album?.name, images },
				artists: (track.artists ?? []).map((artist: any) => ({ type: "artist", uri: artist.uri, name: artist.name })),
				isLocal: false,
				isExplicit: Boolean(track.explicit),
				hasAssociatedVideo: false,
				metadata: {},
				images,
			});
		}
	} catch (error) {
		log.debug("could not look up queued Spotify tracks", error);
	}
	return found;
}

interface InterceptTarget {
	uri: string;
	uid?: string;
	contextUri?: string;
	index?: number;
}

type SortField = "TITLE" | "ARTIST" | "ALBUM" | "DURATION" | "ADDED_AT" | "CUSTOM";

function sortKey(item: any, field: SortField): string | number {
	switch (field) {
		case "TITLE":
			return (item?.name ?? "").toLowerCase();
		case "ARTIST":
			return (item?.artists?.[0]?.name ?? "").toLowerCase();
		case "ALBUM":
			return (item?.album?.name ?? "").toLowerCase();
		case "DURATION":
			return Number(item?.duration?.milliseconds ?? 0);
		case "ADDED_AT":
			return String(item?.addedAt ?? "");
		default:
			return "";
	}
}

function applySort(items: any[], sort: any): any[] {
	const field = sort?.field as SortField | undefined;
	if (!field || field === "CUSTOM" || !items.length) return items;

	const direction = sort?.order === "DESC" ? -1 : 1;
	const decorated = items.map((item, index) => ({ item, index, key: sortKey(item, field) }));

	decorated.sort((a, b) => {
		if (typeof a.key === "number" && typeof b.key === "number") {
			if (a.key !== b.key) return (a.key - b.key) * direction;
			return a.index - b.index;
		}
		const compared = String(a.key).localeCompare(String(b.key));
		if (compared !== 0) return compared * direction;
		return a.index - b.index;
	});

	return decorated.map((entry) => entry.item);
}

function extractTarget(args: any[]): InterceptTarget | undefined {
	const [first, , options] = args;
	const contextUri = typeof first === "string" ? first : first?.uri;
	const skipTo = options?.skipTo;

	if (isJvUri(skipTo?.uri)) {
		return {
			uri: skipTo.uri,
			uid: skipTo.uid,
			contextUri: isJvUri(contextUri) ? undefined : contextUri,
			index: typeof skipTo.index === "number" ? skipTo.index : undefined,
		};
	}

	if (isJvUri(contextUri)) return { uri: contextUri };

	return undefined;
}

export class PlayInterceptor {
	private original: AnyFn | null = null;
	private originals = new Map<string, AnyFn>();
	private lastIntercepted: string | null = null;
	private contextUri: string | undefined;
	private unsubscribeUpdate: (() => void) | null = null;
	private shadowedTargets: Array<{ target: any; key: string }> = [];
	private lastSpotifyUri: string | null = null;
	private suppressUntil = 0;
	private rescueCount = 0;
	private handoffCount = 0;
	private handoffTimer: number | null = null;
	private handoffForUri: string | null = null;
	private pendingJvUri: string | null = null;
	private pendingSkipped: any = null;
	private lastEmittedQueue: unknown = null;
	private unsubscribeQueue: (() => void) | null = null;
	private lastQueueAssert = 0;
	private reassertWindow = 0;
	private reassertsInWindow = 0;
	private settleTimer: number | null = null;
	private unsubscribeViewOptions: (() => void) | null = null;
	private adopting: string | null = null;
	private shadowedService: any = null;
	private shadowedApi: any = null;
	private boot: Array<Record<string, unknown>> = [];
	private loosePlay: string | null = null;
	private resumeSpotify = false;
	private queueSerial = 0;

	constructor(
		private readonly player: ShadowPlayer,
		private readonly arbiter: Arbiter,
		private readonly queue: Queue,
	) {}

	private get api(): any {
		return Spicetify.Platform.PlayerAPI;
	}

	install(): void {
		if (this.original) return;
		const api = this.api;
		if (typeof api?.play !== "function") {
			log.warn("PlayerAPI.play unavailable; interception disabled");
			return;
		}

		this.original = api.play.bind(api);

		Object.defineProperty(api, "play", {
			value: (...args: any[]) => {
				this.suppress();
				this.loosePlay = null;
				this.resumeSpotify = false;
				this.queue.finishQueued();
				const target = extractTarget(args);
				if (target) {
					this.lastIntercepted = target.uri;
					void this.startFromClick(target);
					return Promise.resolve();
				}

				if (this.arbiter.isClaimed) {
					this.player.stop();
					this.arbiter.release();
				}
				const [first, , options] = args;
				const contextUri = typeof first === "string" ? first : first?.uri;
				void this.adoptContext(contextUri, options?.skipTo);
				return this.original?.(...args);
			},
			writable: true,
			configurable: true,
			enumerable: false,
		});

		this.shadowTransport();
		this.shadowQueueService();
		this.unsubscribeViewOptions = onViewOptionsChanged((uri) => {
			if (uri !== this.contextUri) return;
			log.info("playlist sort changed, rebuilding queue");
			void this.loadQueue(uri, undefined, this.nowPlayingUri() ?? undefined);
		});
		this.watchUpdates();
		this.watchQueueUpdates();
		this.syncFromCurrentState();
		log.info("installed");
	}

	private suppress(ms = 2500): void {
		this.suppressUntil = Date.now() + ms;
	}

	private shadow(key: string, replacement: AnyFn): void {
		const api = this.api;
		if (typeof api?.[key] !== "function") return;
		this.originals.set(key, api[key].bind(api));
		Object.defineProperty(api, key, {
			value: replacement,
			writable: true,
			configurable: true,
			enumerable: false,
		});
	}

	private get queueService(): any {
		return this.api?._queue ?? null;
	}

	private shadowQueueService(): void {
		const service = this.queueService;
		if (!service || typeof service.getQueue !== "function") return;

		const original = service.getQueue.bind(service);
		this.shadowedService = service;
		this.shadowedApi = this.api;
		this.originals.set("service.getQueue", original);
		this.shadowedTargets.push({ target: service, key: "getQueue" });

		Object.defineProperty(service, "getQueue", {
			value: (...args: any[]) => {
				const real = original(...args);
				if (real && typeof real.then === "function") return real.then((value: any) => this.projectQueue(value));
				return this.projectQueue(real);
			},
			writable: true,
			configurable: true,
			enumerable: false,
		});
	}

	nowPlayingUri(): string | null {
		const track = this.player.current;
		if (this.arbiter.isClaimed && track) {
			return buildTrackUri({
				songId: track.songId,
				artist: track.artist,
				title: track.title,
				durationSeconds: track.durationSeconds,
			});
		}
		return this.lastSpotifyUri;
	}

	private syncCursor(): boolean {
		const track = this.player.current;

		if (this.arbiter.isClaimed && track) {
			const matched = this.queue.syncWhere((item) => parseSongId(item?.uri ?? "") === track.songId);
			if (matched) return true;
		}

		const uri = this.nowPlayingUri();
		if (!uri) return false;

		const uid = this.arbiter.isClaimed ? this.arbiter.playbackContext?.uid : undefined;
		return this.queue.syncTo(uid, uri);
	}

	private shadowTransport(): void {
		this.shadow("skipToNext", (...args: any[]) => {
			this.suppress();
			if (!this.ownsQueue) return this.originals.get("skipToNext")?.(...args);
			this.syncCursor();
			const item = this.queue.next();
			if (!item) {
				if (this.resumeSpotify) return this.handBackToSpotify();
				return this.originals.get("skipToNext")?.(...args);
			}
			void this.playQueueItem(item);
			return Promise.resolve();
		});

		this.shadow("skipToPrevious", (...args: any[]) => {
			this.suppress();
			if (!this.ownsQueue) return this.originals.get("skipToPrevious")?.(...args);
			this.syncCursor();
			const item = this.queue.previous();
			if (!item) return this.originals.get("skipToPrevious")?.(...args);
			void this.playQueueItem(item);
			return Promise.resolve();
		});

		this.shadow("setShuffle", (value: boolean, ...rest: any[]) => {
			this.queue.setShuffle(Boolean(value));
			this.arbiter.rememberOptions({ shuffle: Boolean(value) });
			if (this.arbiter.isClaimed) this.arbiter.push(true);
			this.assertQueue(true);
			return this.originals.get("setShuffle")?.(value, ...rest);
		});

		this.shadow("setRepeat", (mode: number, ...rest: any[]) => {
			this.queue.setRepeat((mode ?? 0) as 0 | 1 | 2);
			this.arbiter.rememberOptions({ repeat: mode ?? 0 });
			if (this.arbiter.isClaimed) this.arbiter.push(true);
			this.assertQueue(true);
			return this.originals.get("setRepeat")?.(mode, ...rest);
		});

		this.shadow("addToQueue", (items: any[], ...rest: any[]) => {
			const list = Array.isArray(items) ? items.filter((item) => typeof item?.uri === "string") : [];
			if (!list.length || (!this.ownsQueue && !list.some((item) => isJvUri(item.uri)))) {
				return this.originals.get("addToQueue")?.(items, ...rest);
			}
			return this.enqueue(list.map((item) => item.uri));
		});

		this.shadow("removeFromQueue", (items: any[], ...rest: any[]) => {
			const list = Array.isArray(items) ? items : [];
			const removed = this.queue.unqueue((queued) =>
				list.some((item) => (item?.uid ? item.uid === queued.uid : item?.uri === queued.uri)),
			);
			if (!removed) return this.originals.get("removeFromQueue")?.(items, ...rest);
			this.afterQueueChange();
			return Promise.resolve();
		});

		this.shadow("getQueue", (...args: any[]) => {
			const original = this.originals.get("getQueue");
			const real = original ? original(...args) : {};
			if (real && typeof real.then === "function") return real.then((value: any) => this.projectQueue(value));
			return this.projectQueue(real);
		});
	}

	private get ownsQueue(): boolean {
		if (this.queue.queuedItems.length || this.queue.playingQueued) return true;
		if (this.queue.isEmpty) return false;
		if (this.contextUri === BROWSE_CONTEXT) return true;
		return this.queue.items_.some((item: any) => isJvUri(item?.uri));
	}

	private projectQueue(real: any): any {
		if (!this.ownsQueue || !real || typeof real !== "object") return real;

		this.syncCursor();
		const template = (Array.isArray(real.nextUp) ? real.nextUp[0] : null) ?? real.current ?? null;

		if (this.queue.isEmpty) {
			const shaped = { ...real };
			if (this.queue.playingQueued) shaped.current = toQueueItem(this.queue.current, template);
			shaped.nextUp = [
				...this.queue.queuedItems.map((item: any) => toQueueItem(item, template)),
				...(Array.isArray(real.nextUp) ? real.nextUp : []),
			];
			return shaped;
		}

		const upcoming = this.queue.upcoming(40);
		if (!upcoming.length) return real;

		const shaped = { ...real };
		const current = this.queue.current;
		if (current) shaped.current = toQueueItem(current, template);
		shaped.nextUp = upcoming.map((item: any) => toQueueItem(item, template));
		return shaped;
	}

	private snapshot(tag: string): void {
		const api = this.api;
		const service = api?._queue;
		this.boot.push({
			t: new Date().toISOString().slice(11, 23),
			tag,
			ownsQueue: this.ownsQueue,
			queueSize: this.queue.size,
			contextUri: this.contextUri ?? null,
			claimed: this.arbiter.isClaimed,
			apiSame: api === this.shadowedApi,
			serviceSame: service === this.shadowedService,
			playShadowed: api ? Object.prototype.hasOwnProperty.call(api, "play") : null,
			getQueueShadowed: api ? Object.prototype.hasOwnProperty.call(api, "getQueue") : null,
			serviceGetQueueShadowed: service ? Object.prototype.hasOwnProperty.call(service, "getQueue") : null,
			stateCurrent: service?._queueState?.current?.name ?? null,
		});
		if (this.boot.length > 60) this.boot.shift();
	}

	get bootLog(): Array<Record<string, unknown>> {
		return this.boot;
	}

	private scheduleSettledAssert(delayMs = 600): void {
		if (this.settleTimer !== null) window.clearTimeout(this.settleTimer);

		const now = Date.now();
		if (now - this.reassertWindow > 2000) {
			this.reassertWindow = now;
			this.reassertsInWindow = 0;
		}
		if (this.reassertsInWindow >= 12) return;
		this.reassertsInWindow += 1;

		this.settleTimer = window.setTimeout(() => {
			this.settleTimer = null;
			this.assertQueue(true);
		}, delayMs);
	}

	assertQueue(force: boolean): void {
		this.snapshot(force ? "assert" : "assert-throttled");
		if (!this.ownsQueue) return;
		const now = Date.now();
		if (!force && now - this.lastQueueAssert < 250) return;
		this.lastQueueAssert = now;

		const service = this.queueService;
		if (!service) return;

		try {
			const projected = this.projectQueue(service._queueState);
			if (!projected || projected === service._queueState) return;
			service._queueState = projected;
			this.lastEmittedQueue = projected;
			this.api._events.emit("queue_update", projected);
		} catch (error) {
			log.debug("could not assert queue", error);
		}
	}

	private watchQueueUpdates(): void {
		try {
			const events = typeof this.api.getEvents === "function" ? this.api.getEvents() : this.api._events;
			const unsubscribe = events.addListener("queue_update", (event: any) => {
				if (!this.ownsQueue) return;
				const payload = event?.data ?? event;
				if (payload === this.lastEmittedQueue) return;
				this.scheduleSettledAssert();
			});

			this.unsubscribeQueue = typeof unsubscribe === "function" ? unsubscribe : null;
		} catch (error) {
			log.warn("could not watch queue updates", error);
		}
	}

	syncQueueStore(): void {
		this.assertQueue(true);
	}

	inspectQueueStore(): Record<string, unknown> {
		const service = this.api?._queue;
		if (!service) return { present: false };

		const describe = (value: any): any => {
			if (Array.isArray(value)) {
				return { isArray: true, length: value.length, firstKeys: value[0] ? Object.keys(value[0]) : null, firstUri: value[0]?.uri ?? null };
			}
			if (value && typeof value === "object") return { keys: Object.keys(value).slice(0, 40) };
			return { value };
		};

		const state = service._queueState;
		return {
			serviceKeys: Object.keys(service),
			serviceProto: Object.getOwnPropertyNames(Object.getPrototypeOf(service)),
			queueStateKeys: state && typeof state === "object" ? Object.keys(state) : null,
			queueStateFields:
				state && typeof state === "object"
					? Object.fromEntries(Object.entries(state).map(([k, v]) => [k, describe(v)]))
					: null,
			innerQueueKeys: service._queue && typeof service._queue === "object" ? Object.keys(service._queue) : null,
			innerQueueFields:
				service._queue && typeof service._queue === "object"
					? Object.fromEntries(Object.entries(service._queue).map(([k, v]) => [k, describe(v)]))
					: null,
			eventNames: service._events?._emitter?._listeners ? Object.keys(service._events._emitter._listeners) : null,
			eventsIsSameAsPlayer: service._events === this.api._events,
		};
	}

	inspectQueue(): Record<string, unknown> {
		const original = this.originals.get("getQueue");
		let real: any = null;
		try {
			real = original ? original() : null;
		} catch (error) {
			real = { threw: String(error) };
		}
		const describe = (value: any): any => {
			if (Array.isArray(value)) {
				return {
					isArray: true,
					length: value.length,
					firstKeys: value[0] ? Object.keys(value[0]) : null,
					firstUri: value[0]?.uri ?? null,
				};
			}
			if (value && typeof value === "object") return { keys: Object.keys(value) };
			return { value };
		};
		return {
			isPromise: Boolean(real && typeof real.then === "function"),
			topLevel: real && typeof real === "object" ? Object.keys(real) : null,
			fields: real && typeof real === "object" ? Object.fromEntries(Object.entries(real).map(([k, v]) => [k, describe(v)])) : null,
			rawQueueProperty: this.api?._queue ? Object.keys(this.api._queue) : null,
			ourQueueSize: this.queue.size,
			ourUpcoming: this.queue.upcoming(5).map((item: any) => item?.uri),
			ourCurrent: this.queue.current?.uri ?? null,
		};
	}

	private watchUpdates(): void {
		try {
			const events = typeof this.api.getEvents === "function" ? this.api.getEvents() : this.api._events;
			const unsubscribe = events.addListener("update", (event: any) => {
				const state = event?.data ?? event;
				this.onSpotifyState(state);
			});
			this.unsubscribeUpdate = typeof unsubscribe === "function" ? unsubscribe : null;
		} catch (error) {
			log.warn("could not watch player updates", error);
		}
	}

	private clearHandoff(): void {
		if (this.handoffTimer !== null) window.clearTimeout(this.handoffTimer);
		this.handoffTimer = null;
		this.handoffForUri = null;
	}

	private scheduleHandoff(state: any, uri: string): void {
		this.clearHandoff();
		if (state?.isPaused || !this.ownsQueue) return;

		const next = this.queue.peekNext();
		if (!next) return;

		const nextIsJv = isJvUri(next.uri);

		const duration = Number(state?.duration) || 0;
		if (duration <= 0) return;

		const base = Number(state?.positionAsOfTimestamp) || 0;
		const timestamp = Number(state?.timestamp) || Date.now();
		const position = base + (Date.now() - timestamp);
		const remaining = duration - position - (nextIsJv ? HANDOFF_LEAD_MS : SPOTIFY_LEAD_MS);
		if (remaining < 0) return;

		this.handoffForUri = uri;
		this.handoffTimer = window.setTimeout(() => {
			this.handoffTimer = null;
			if (this.handoffForUri !== uri) return;

			this.syncCursor();
			const fromSpotify = this.queue.isEmpty;
			const target = this.queue.next();
			if (!target) return;
			if (fromSpotify && isJvUri(target.uri)) this.resumeSpotify = true;

			this.handoffCount += 1;
			log.info("driving next track from the JuiceVault queue:", target.name);
			this.suppress();
			void this.playQueueItem(target);
		}, remaining);
	}

	private adoptFromState(state: any): void {
		if (this.arbiter.isClaimed) return;
		if (this.loosePlay && state?.item?.uri === this.loosePlay) return;

		const contextUri = state?.context?.uri;
		if (typeof contextUri !== "string") return;

		if (!this.isSupportedContext(contextUri)) {
			if (this.contextUri) {
				this.contextUri = undefined;
				this.queue.clear();
			}
			return;
		}

		if (contextUri === this.contextUri || this.adopting === contextUri) return;

		this.adopting = contextUri;
		void this.adoptContext(contextUri, { uid: state?.item?.uid, uri: state?.item?.uri })
			.then(() => {
				log.info("adopted active context", contextUri, `(${this.queue.size} items)`);
				this.assertQueue(true);
			})
			.finally(() => {
				this.adopting = null;
			});
	}

	syncFromCurrentState(timeoutMs = 20000): void {
		const started = Date.now();

		const tick = (): void => {
			try {
				const state = this.api?._state;
				if (this.arbiter.isClaimed) return;
				if (state?.context?.uri) {
					this.adoptFromState(state);
					if (this.contextUri) return;
				}
			} catch (error) {
				log.debug("could not read initial state", error);
			}

			if (Date.now() - started < timeoutMs) window.setTimeout(tick, 500);
		};

		tick();
	}

	private onSpotifyState(state: any): void {
		const uri: string | undefined = state?.item?.uri;
		if (!uri) return;

		if (this.arbiter.isClaimed) {
			if (isJvUri(uri)) this.lastSpotifyUri = uri;
			this.clearHandoff();
			return;
		}

		this.adoptFromState(state);

		if (isJvUri(uri)) {
			this.lastSpotifyUri = uri;
			this.clearHandoff();
			return;
		}

		const previous = this.lastSpotifyUri;
		if (uri !== previous) {
			this.lastSpotifyUri = uri;

			const userDirected = Date.now() < this.suppressUntil;

			if (!userDirected && previous && this.pendingJvUri && this.pendingJvUri !== uri) {
				const target = this.pendingSkipped;
				this.pendingJvUri = null;
				this.pendingSkipped = null;
				if (target) {
					this.rescueCount += 1;
					log.info("Spotify auto-skipped a JuiceVault track; taking over");
					this.suppress();
					void this.playQueueItem(target);
					return;
				}
			}

			this.queue.syncTo(state?.item?.uid, uri);
			this.syncQueueStore();
		}

		const upcoming = this.queue.peekNext();
		this.pendingJvUri = upcoming && isJvUri(upcoming.uri) ? upcoming.uri : null;
		this.pendingSkipped = this.pendingJvUri ? upcoming : null;

		this.scheduleHandoff(state, uri);
	}

	private async startFromClick(target: InterceptTarget): Promise<void> {
		this.arbiter.setPlaybackContext({
			uid: target.uid,
			contextUri: target.contextUri,
			contextName: target.contextUri ? (getContextName(target.contextUri) ?? undefined) : undefined,
			index: target.index,
		});

		const playing = this.playJuiceVault(target.uri);

		if (target.contextUri && this.isSupportedContext(target.contextUri)) {
			this.contextUri = target.contextUri;
			void this.loadQueue(target.contextUri, target.uid, target.uri).then(() => this.syncQueueStore());
		} else {
			this.contextUri = undefined;
			this.queue.clear();
		}

		await playing;
	}

	private isSupportedContext(uri: string | undefined): boolean {
		if (!uri) return false;
		if (uri === BROWSE_CONTEXT) return true;
		return uri.startsWith("spotify:playlist:") || uri === "spotify:collection:tracks";
	}

	async adoptContext(contextUri: string | undefined, skipTo: any): Promise<void> {
		if (!this.isSupportedContext(contextUri)) {
			if (this.contextUri) log.debug("unsupported context, standing down:", contextUri);
			this.contextUri = undefined;
			this.queue.clear();
			return;
		}
		this.contextUri = contextUri;
		await this.loadQueue(contextUri!, skipTo?.uid, skipTo?.uri);
	}

	private async fetchContextItems(contextUri: string): Promise<any[]> {
		if (contextUri === BROWSE_CONTEXT) return this.queue.items_;

		if (contextUri === "spotify:collection:tracks") {
			const library = Spicetify.Platform.LibraryAPI;
			const result = await library.getTracks({ limit: 1000, offset: 0 });
			return result?.items ?? [];
		}

		const view = getViewOptions(contextUri);
		const options: Record<string, unknown> = { offset: 0, limit: 1000 };
		if (view?.sort?.field) options.sort = view.sort;
		if (view?.filter) options.filter = view.filter;
		if (view?.filterPredicates?.length) options.filterPredicates = view.filterPredicates;
		if (view?.descriptorFilter?.length) options.descriptorFilter = view.descriptorFilter;

		const api = Spicetify.Platform.PlaylistAPI;
		let items: any[] = [];

		try {
			const contents = await api.getContents(contextUri, options);
			items = contents?.items ?? [];
		} catch (error) {
			log.debug("sorted getContents failed, falling back", error);
		}

		if (!items.length) {
			const plain = await api.getContents(contextUri);
			items = plain?.items ?? [];
		}

		if (view?.sort?.field) items = applySort(items, view.sort);

		return items;
	}

	private async loadQueue(contextUri: string, targetUid?: string, targetUri?: string): Promise<void> {
		try {
			const items = await this.fetchContextItems(contextUri);
			let index = targetUid ? items.findIndex((item) => item.uid === targetUid) : -1;
			if (index < 0 && targetUri) index = items.findIndex((item) => item.uri === targetUri);
			if (!items.length) {
				log.warn("context returned no items, standing down:", contextUri);
				this.queue.clear();
				this.contextUri = undefined;
				return;
			}

			this.queue.load(items, Math.max(0, index), contextUri);
			this.arbiter.setPlaybackContext({
				...(this.arbiter.playbackContext ?? {}),
				contextUri,
				contextName: getContextName(contextUri) ?? undefined,
			});
			this.announceContext(contextUri);
			void this.nameContext(contextUri);
			log.debug(`queue loaded: ${items.length} items from ${contextUri}, start ${index}`);
			this.syncQueueStore();
			this.scheduleSettledAssert(900);
		} catch (error) {
			log.warn("could not load queue from context", error);
			this.queue.clear();
			this.contextUri = undefined;
		}
	}

	private async nameContext(contextUri: string): Promise<void> {
		if (contextUri === BROWSE_CONTEXT || getContextName(contextUri)) return;
		try {
			const meta = await Spicetify.Platform.PlaylistAPI.getMetadata(contextUri);
			const name = meta?.name ?? meta?.metadata?.name;
			if (typeof name !== "string" || !name) return;
			recordContextName(contextUri, name);
			this.arbiter.nameContext(contextUri, name);
		} catch (error) {
			log.debug("could not look up the playlist name", error);
		}
	}

	private announceContext(contextUri: string): void {
		if (!this.arbiter.isClaimed) return;
		const update = this.api?.updateContext;
		if (typeof update !== "function") return;

		for (const shape of [{ uri: contextUri }, contextUri]) {
			try {
				update.call(this.api, shape);
				log.debug("announced context to Spotify:", contextUri);
				return;
			} catch {
				continue;
			}
		}
	}

	reloadQueue(): void {
		if (this.contextUri) void this.loadQueue(this.contextUri, undefined, this.lastSpotifyUri ?? undefined);
	}

	playFromSongs(songs: any[], index: number, contextName = "JuiceVault"): void {
		if (!songs?.length) return;

		const items = songs.map((song) => jvItem(song, `jv-${song.id}`));

		const start = Math.max(0, Math.min(index, items.length - 1));
		this.contextUri = BROWSE_CONTEXT;
		this.queue.load(items, start, BROWSE_CONTEXT);
		this.arbiter.setPlaybackContext({
			uid: items[start].uid,
			contextUri: BROWSE_CONTEXT,
			contextName,
		});

		void this.playJuiceVault(items[start].uri).then(() => this.syncQueueStore());
	}

	advanceQueue(direction: 1 | -1): void {
		if (this.queue.isIdle && !this.resumeSpotify) {
			log.warn("advance requested with an empty queue");
			this.player.pause();
			return;
		}

		this.syncCursor();
		const item = direction === 1 ? this.queue.next() : this.queue.previous();

		if (!item && direction === 1 && this.resumeSpotify) {
			void this.handBackToSpotify();
			return;
		}

		if (!item) {
			log.info("reached the end of the queue");
			this.player.pause();
			return;
		}

		void this.playQueueItem(item);
	}

	async playQueueItem(item: any): Promise<void> {
		if (!item?.uri) return;
		this.suppress();
		this.clearHandoff();

		if (isJvUri(item.uri)) {
			this.loosePlay = null;
			const named = this.arbiter.playbackContext?.contextUri === this.contextUri ? this.arbiter.playbackContext?.contextName : undefined;
			this.arbiter.setPlaybackContext({
				uid: item.uid,
				contextUri: this.contextUri,
				contextName: named ?? (this.contextUri ? (getContextName(this.contextUri) ?? undefined) : undefined),
			});
			await this.playJuiceVault(item.uri);
			this.syncQueueStore();
			return;
		}

		this.player.stop();
		this.arbiter.release();

		try {
			if (item.provider === "queue" || !this.contextUri) {
				this.loosePlay = item.uri;
				await this.original?.(item.uri, {}, {});
			} else {
				this.loosePlay = null;
				await this.original?.({ uri: this.contextUri }, {}, { skipTo: { uid: item.uid, uri: item.uri } });
			}
		} catch (error) {
			log.error("could not hand playback back to Spotify", error);
		}
	}

	private async enqueue(uris: string[]): Promise<void> {
		const spotify = await spotifyItems(uris.filter((uri) => !isJvUri(uri)));
		const items: any[] = [];

		for (const uri of uris) {
			this.queueSerial += 1;
			const uid = `jvq-${Date.now().toString(36)}-${this.queueSerial}`;
			if (!isJvUri(uri)) {
				items.push({ ...(spotify.get(uri) ?? { type: "track", uri, name: "", artists: [], images: [] }), uid });
				continue;
			}
			const songId = parseSongId(uri);
			if (!songId) continue;
			try {
				const meta = await getMetadata(songId);
				items.push(
					jvItem(
						{ id: meta.id, title: meta.title, artist: meta.artist, album: meta.album ?? null, durationSeconds: meta.duration, coverUrl: assetUrl(meta.cover ?? null) },
						uid,
					),
				);
			} catch (error) {
				log.warn("could not queue a JuiceVault song", error);
			}
		}

		if (!items.length) return;
		this.queue.enqueue(items);
		this.afterQueueChange();

		const events = typeof this.api?.getEvents === "function" ? this.api.getEvents() : this.api?._events;
		if (typeof events?.emitQueueActionComplete === "function") events.emitQueueActionComplete("add", null, true);
		else Spicetify.showNotification("Added to queue");
	}

	private afterQueueChange(): void {
		if (this.arbiter.isClaimed) {
			this.arbiter.push(true);
		} else {
			const state = this.api?._state;
			const uri = state?.item?.uri;
			if (uri && !isJvUri(uri)) {
				const upcoming = this.queue.peekNext();
				this.pendingJvUri = upcoming && isJvUri(upcoming.uri) ? upcoming.uri : null;
				this.pendingSkipped = this.pendingJvUri ? upcoming : null;
				this.scheduleHandoff(state, uri);
			}
		}
		this.syncQueueStore();
	}

	private async handBackToSpotify(): Promise<void> {
		this.resumeSpotify = false;
		this.queue.finishQueued();
		this.player.stop();
		this.arbiter.release();
		log.info("queue finished, handing playback back to Spotify");
		try {
			await this.originals.get("skipToNext")?.();
		} catch (error) {
			log.error("could not hand playback back to Spotify", error);
		}
	}

	async playJuiceVault(uri: string): Promise<void> {
		const songId = parseSongId(uri);
		if (!songId) {
			log.warn("could not parse a JuiceVault id from", uri);
			return;
		}

		try {
			const meta = await getMetadata(songId);
			await this.player.load({
				songId: meta.id,
				title: meta.title,
				artist: meta.artist,
				durationSeconds: meta.duration,
				album: meta.album ?? null,
				cover: assetUrl(meta.cover ?? null),
			});
			log.info("playing", meta.title);
		} catch (error) {
			log.error("failed to start JuiceVault playback", error);
			Spicetify.showNotification("JuiceVault: could not start this track", true);
		}
	}

	get currentContextUri(): string | undefined {
		return this.contextUri;
	}

	get diagnostics(): Record<string, unknown> {
		return {
			installed: Boolean(this.original),
			shadowed: Object.prototype.hasOwnProperty.call(this.api ?? {}, "play"),
			lastIntercepted: this.lastIntercepted,
			contextUri: this.contextUri ?? null,
			transportShadowed: [...this.originals.keys()],
			queueSize: this.queue.size,
			rescueCount: this.rescueCount,
			ownsQueue: this.ownsQueue,
			handoffCount: this.handoffCount,
			handoffScheduled: this.handoffTimer !== null,
			lastSpotifyUri: this.lastSpotifyUri,
			sortField: getViewOptions(this.contextUri ?? "")?.sort?.field ?? null,
			cursorTrack: this.queue.current?.name ?? null,
			upcoming: this.queue.upcoming(5).map((item: any) => item?.name ?? item?.uri),
		};
	}

	dispose(): void {
		this.unsubscribeViewOptions?.();
		this.unsubscribeViewOptions = null;
		if (this.settleTimer !== null) window.clearTimeout(this.settleTimer);
		this.settleTimer = null;
		this.clearHandoff();
		this.unsubscribeQueue?.();
		this.unsubscribeQueue = null;
		this.unsubscribeUpdate?.();
		this.unsubscribeUpdate = null;
		for (const { target, key } of this.shadowedTargets) delete target[key];
		this.shadowedTargets = [];
		for (const key of this.originals.keys()) delete this.api[key];
		this.originals.clear();
		if (!this.original) return;
		delete this.api.play;
		this.original = null;
		log.info("removed");
	}
}
