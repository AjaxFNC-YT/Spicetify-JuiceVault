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

function patchCollection(payload: any): any {
	if (!payload) return payload;
	if (Array.isArray(payload)) {
		payload.forEach(markPlayable);
		return payload;
	}
	if (Array.isArray(payload.items)) payload.items.forEach(markPlayable);
	if (Array.isArray(payload.tracks)) payload.tracks.forEach(markPlayable);
	return payload;
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

	install(): void {
		this.patchAsync(Spicetify.Platform.PlaylistAPI, "getContents", "playlist.getContents", patchCollection);
		this.patchAsync(Spicetify.Platform.LibraryAPI, "getTracks", "library.getTracks", patchCollection);
		this.patchAsync(Spicetify.Platform.LocalFilesAPI, "getTracks", "localFiles.getTracks", patchCollection);
		this.patchAsync(Spicetify.Platform.RootlistAPI, "getContents", "rootlist.getContents", patchRootlist);
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

	private patchAsync(target: any, key: string, label: string, transform: (payload: any) => any): void {
		if (!target || typeof target[key] !== "function") return;
		if (this.patched.has(label)) return;

		const original = target[key].bind(target);
		this.patched.set(label, { target, key, original });

		Object.defineProperty(target, key, {
			value: async (...args: any[]) => {
				const result = await original(...args);
				this.patchCount += 1;
				return transform(result);
			},
			writable: true,
			configurable: true,
			enumerable: false,
		});
	}

	seed(uris: string[]): void {
		const api = Spicetify.Platform.PlayabilityAPI;
		if (!api || typeof api.setCachedPlayability !== "function") return;
		for (const uri of uris) {
			try {
				api.setCachedPlayability(uri, true);
			} catch {
				try {
					api.setCachedPlayability(uri, { playable: true });
				} catch (error) {
					log.debug("setCachedPlayability rejected both shapes", error);
					return;
				}
			}
		}
	}

	get diagnostics(): Record<string, unknown> {
		const api = Spicetify.Platform.PlayabilityAPI;
		return {
			patched: [...this.patched.keys()],
			patchCount: this.patchCount,
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
