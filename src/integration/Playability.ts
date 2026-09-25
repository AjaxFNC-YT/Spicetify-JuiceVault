import { createLogger } from "../core/log";
import { coverUrl } from "../core/config";
import { isJvUri, parseSongId } from "./uri";
import { peekMetadata } from "../core/api/songs";

const log = createLogger("Playability");

type AnyFn = (...args: any[]) => any;

function markPlayable(item: any): void {
	if (!item || !isJvUri(item.uri)) return;

	item.isPlayable = true;
	item.isLocal = true;
	item.isBanned = false;
	if (item.playability) item.playability = "PLAYABLE";
	if (item.restrictions) item.restrictions = {};

	const songId = parseSongId(item.uri);
	if (songId) {
		const cover = coverUrl(songId);
		const known = peekMetadata(songId);
		const images = [
			{ url: cover, label: "xlarge" },
			{ url: cover, label: "large" },
			{ url: cover, label: "standard" },
			{ url: cover, label: "small" },
		];

		item.album = {
			...(item.album ?? {}),
			type: "album",
			name: known?.album || "JuiceVault",
			images,
		};
		item.images = images;
		item.metadata = {
			...(item.metadata ?? {}),
			album_title: known?.album || "JuiceVault",
			image_url: cover,
			image_small_url: cover,
			image_large_url: cover,
			image_xlarge_url: cover,
		};
	}

	if (item.track) markPlayable(item.track);
}

function deepMark(payload: any): any {
	if (!payload || typeof payload !== "object") return payload;

	const seen = new Set<any>();
	const walk = (node: any, depth: number): void => {
		if (!node || typeof node !== "object" || depth > 6 || seen.has(node)) return;
		seen.add(node);

		if (Array.isArray(node)) {
			for (const entry of node) walk(entry, depth + 1);
			return;
		}

		if (typeof node.uri === "string") markPlayable(node);

		for (const value of Object.values(node)) {
			if (value && typeof value === "object") walk(value, depth + 1);
		}
	};

	walk(payload, 0);
	return payload;
}

function patchCollection(payload: any): any {
	return deepMark(payload);
}

function fixCounts(entity: any): void {
	if (!entity || typeof entity !== "object") return;
	const total = Number(entity.totalLength);
	const unfiltered = Number(entity.unfilteredTotalLength);
	if (Number.isFinite(total) && Number.isFinite(unfiltered) && unfiltered > total) {
		entity.totalLength = unfiltered;
	}
}

function patchRootlist(payload: any): any {
	if (!payload) return payload;
	const walk = (node: any): void => {
		if (!node || typeof node !== "object") return;
		if (node.type === "playlist") fixCounts(node);
		if (Array.isArray(node.items)) node.items.forEach(walk);
	};
	walk(payload);
	if (Array.isArray(payload.items)) payload.items.forEach(walk);
	return payload;
}

export class Playability {
	private patched = new Map<string, { target: any; key: string; original: AnyFn }>();
	private patchCount = 0;
	private calls: Array<Record<string, unknown>> = [];

	install(): void {
		this.patchAsync(Spicetify.Platform.PlaylistAPI, "getContents", "playlist.getContents", patchCollection);
		this.patchAsync(Spicetify.Platform.PlaylistAPI, "getPlaylist", "playlist.getPlaylist", (payload: any) => {
			deepMark(payload);
			fixCounts(payload);
			fixCounts(payload?.metadata);
			return payload;
		});
		this.patchAsync(Spicetify.Platform.PlaylistAPI, "getItem", "playlist.getItem", patchCollection);
		this.patchAsync(Spicetify.Platform.LibraryAPI, "getTracks", "library.getTracks", patchCollection);
		this.patchAsync(Spicetify.Platform.LocalFilesAPI, "getTracks", "localFiles.getTracks", patchCollection);
		this.patchAsync(Spicetify.Platform.RootlistAPI, "getContents", "rootlist.getContents", patchRootlist);
		this.patchAsync(Spicetify.Platform.ListPlatformAPI, "getListContents", "list.getListContents", patchCollection);
		this.patchAsync(Spicetify.Platform.ListPlatformAPI, "getList", "list.getList", patchCollection);
		this.patchSubscription(Spicetify.Platform.ListPlatformAPI, "subscribeList", "list.subscribeList");
		this.patchSubscription(Spicetify.Platform.ListPlatformAPI, "onListUpdate", "list.onListUpdate");
		this.patchAsync(Spicetify.Platform.PlaylistAPI, "getMetadata", "playlist.getMetadata", (payload: any) => {
			fixCounts(payload);
			fixCounts(payload?.metadata);
			return payload;
		});
		log.info("installed on", [...this.patched.keys()].join(", ") || "nothing");
	}

	async inspectPlaylist(uri: string): Promise<Record<string, unknown>> {
		const entry = this.patched.get("playlist.getContents");
		const original = entry?.original;
		const contents = original ? await original(uri) : await Spicetify.Platform.PlaylistAPI.getContents(uri);
		const items: any[] = contents?.items ?? [];
		return {
			totalLength: contents?.totalLength,
			unfilteredTotalLength: contents?.unfilteredTotalLength,
			actualItemCount: items.length,
			jvCount: items.filter((item) => isJvUri(item?.uri)).length,
			localCount: items.filter((item) => item?.isLocal).length,
			unplayableCount: items.filter((item) => item?.isPlayable === false).length,
			topLevelKeys: contents ? Object.keys(contents) : null,
		};
	}

	private patchSubscription(target: any, key: string, label: string): void {
		if (!target || typeof target[key] !== "function") return;
		if (this.patched.has(label)) return;

		const original = target[key].bind(target);
		const wasEnumerable = Object.getOwnPropertyDescriptor(target, key)?.enumerable ?? false;
		this.patched.set(label, { target, key, original });

		Object.defineProperty(target, key, {
			value: (...args: any[]) => {
				const wrapped = args.map((arg) =>
					typeof arg === "function"
						? (...callbackArgs: any[]) => {
								this.patchCount += 1;
								this.calls.unshift({ label, at: new Date().toISOString().slice(11, 19), arg: "callback", itemCount: -1, jvCount: -1 });
								this.calls = this.calls.slice(0, 12);
								return arg(...callbackArgs.map((value) => deepMark(value)));
							}
						: arg,
				);
				return original(...wrapped);
			},
			writable: true,
			configurable: true,
			enumerable: wasEnumerable,
		});
	}

	private patchAsync(target: any, key: string, label: string, transform: (payload: any) => any): void {
		if (!target || typeof target[key] !== "function") return;
		if (this.patched.has(label)) return;

		const original = target[key].bind(target);
		const wasEnumerable = Object.getOwnPropertyDescriptor(target, key)?.enumerable ?? false;
		this.patched.set(label, { target, key, original });

		Object.defineProperty(target, key, {
			value: async (...args: any[]) => {
				const result = await original(...args);
				this.patchCount += 1;
				const items: any[] = result?.items ?? (Array.isArray(result) ? result : []);
				this.calls.unshift({
					label,
					at: new Date().toISOString().slice(11, 19),
					arg: typeof args[0] === "string" ? args[0] : (args[0]?.uri ?? null),
					itemCount: items.length,
					jvCount: items.filter((item: any) => isJvUri(item?.uri)).length,
				});
				this.calls = this.calls.slice(0, 12);
				return transform(result);
			},
			writable: true,
			configurable: true,
			enumerable: wasEnumerable,
		});
	}

	refreshViews(): void {
		const api = Spicetify.Platform?.PlaylistAPI;
		if (!api) return;

		try {
			api.emitUpdate?.();
		} catch (error) {
			log.debug("emitUpdate failed", error);
		}

		const path: string = Spicetify.Platform?.History?.location?.pathname ?? "";
		const match = path.match(/^\/playlist\/([A-Za-z0-9]+)/);
		if (!match) return;

		const uri = `spotify:playlist:${match[1]}`;
		for (const attempt of [() => api.resync?.({ uri }), () => api.resync?.(uri)]) {
			try {
				const result = attempt();
				if (result !== undefined) {
					log.info("resynced", uri);
					return;
				}
			} catch {
				continue;
			}
		}
	}

	private bounced = false;

	private bounce(path: string): void {
		const history = Spicetify.Platform?.History;
		if (!history?.push || this.bounced) return;
		this.bounced = true;

		try {
			history.push("/search");
			window.setTimeout(() => {
				try {
					if (typeof history.goBack === "function") history.goBack();
					else history.push(path);
					log.info("forced a refetch of", path);
				} catch (error) {
					log.debug("route restore failed", error);
				}
			}, 400);
		} catch (error) {
			log.debug("route bounce failed", error);
		}
	}

	ensureFreshOnce(timeoutMs = 20000): void {
		const started = Date.now();
		const isListRoute = (path: string): boolean => /^\/(playlist|collection|album|artist)/.test(path);

		const tick = (): void => {
			if (this.bounced) return;
			const path: string = Spicetify.Platform?.History?.location?.pathname ?? "";
			if (isListRoute(path)) {
				this.bounce(path);
				return;
			}
			if (Date.now() - started < timeoutMs) window.setTimeout(tick, 250);
		};

		tick();
	}

	watchNavigation(): () => void {
		const history = Spicetify.Platform?.History;
		if (!history?.listen) return () => {};
		try {
			const stop = history.listen(() => this.refreshViews());
			return typeof stop === "function" ? stop : () => {};
		} catch {
			return () => {};
		}
	}

	seed(uris: string[]): void {
		const api = Spicetify.Platform.PlayabilityAPI;
		if (!api || typeof api.setCachedPlayability !== "function") return;
		try {
			api.setCachedPlayability(
				uris.map((uri) => ({
					uri,
					playability: "PLAYABLE",
					isPlayable: true,
					reason: null,
				})),
			);
		} catch (error) {
			log.debug("setCachedPlayability rejected", error);
		}
	}

	get diagnostics(): Record<string, unknown> {
		const api = Spicetify.Platform.PlayabilityAPI;
		const listApi = Spicetify.Platform.ListPlatformAPI;
		return {
			patched: [...this.patched.keys()],
			patchCount: this.patchCount,
			recentCalls: this.calls,
			listPlatformAPI: listApi
				? {
						present: true,
						ownKeys: Object.keys(listApi),
						protoMethods: Object.getOwnPropertyNames(Object.getPrototypeOf(listApi)),
					}
				: { present: false },
			playerListFlags: {
				likedSongs: Spicetify.Platform.PlayerAPI?._isLikedSongsListPlatformEnabled,
				localFiles: Spicetify.Platform.PlayerAPI?._isLocalFilesListPlatformEnabled,
			},
			playabilitySignature: api?.setCachedPlayability ? String(api.setCachedPlayability).slice(0, 200) : null,
			cachedSignature: api?.getCachedPlayability ? String(api.getCachedPlayability).slice(0, 200) : null,
		};
	}

	dispose(): void {
		for (const { target, key } of this.patched.values()) delete target[key];
		this.patched.clear();
		log.info("removed");
	}
}
