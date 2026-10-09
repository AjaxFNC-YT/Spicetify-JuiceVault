import { createLogger } from "../core/log";
import { getLyrics, type Lyrics } from "../core/api/lyrics";

declare const Spicetify: any;

const log = createLogger("NativeLyrics");

const BASE62 = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
const MARKER = '"desktop-lyrics"';
const METADATA = /\/metadata\/4\/track\/([0-9a-f]{32})/i;
const COLOR_LYRICS = /\/color-lyrics\/v2\/track\/([0-9A-Za-z]{22})/;
const DYNAMIC_COLORS = /getDynamicColorsByUris|f0f112945d6d745bd8ff790317bbf8d310036da75df33130490e9d6dc96c59d9/;

const stands = new Map<string, { songId: string; cover: string | null }>();
let component: any | undefined;

function base62(hex: string): string {
	let value = BigInt(`0x${hex}`);
	let out = "";
	while (value > 0n) {
		out = BASE62[Number(value % 62n)] + out;
		value /= 62n;
	}
	return out.padStart(22, "0");
}

export function standInUri(songId: string, cover: string | null): string {
	const id = base62(songId.replace(/-/g, "").toLowerCase());
	stands.set(id, { songId, cover });
	stands.set(songId.replace(/-/g, "").toLowerCase(), { songId, cover });
	return `spotify:track:${id}`;
}

function rspackRequire(): any {
	let found: any = null;
	try {
		(window as any).rspackChunk?.push([[Symbol("jv")], {}, (req: any) => (found = req)]);
	} catch (error) {
		log.debug("could not reach Spotify's modules", error);
	}
	return found;
}

export function nativeLyricsComponent(): any | null {
	if (component !== undefined) return component;
	component = null;
	const require = rspackRequire();
	const modules = (window as any).__webpack_modules__ ?? require?.m ?? {};
	for (const id of Object.keys(modules)) {
		try {
			if (!String(modules[id]).includes(MARKER)) continue;
			const exported = require(id)?.A;
			if (exported) {
				component = exported;
				break;
			}
		} catch (error) {
			log.debug("lyrics module candidate failed", id, error);
		}
	}
	if (!component) log.warn("Spotify's lyrics component wasn't found; using the JuiceVault lyrics view");
	return component;
}

function argb(r: number, g: number, b: number): number {
	return ((0xff << 24) | (r << 16) | (g << 8) | b) | 0;
}

async function coverColor(url: string | null): Promise<number> {
	const fallback = argb(64, 64, 72);
	if (!url) return fallback;
	return new Promise((resolve) => {
		const image = new Image();
		image.crossOrigin = "anonymous";
		image.onload = () => {
			try {
				const canvas = document.createElement("canvas");
				canvas.width = canvas.height = 24;
				const context = canvas.getContext("2d")!;
				context.drawImage(image, 0, 0, 24, 24);
				const data = context.getImageData(0, 0, 24, 24).data;
				let best = { score: -1, r: 64, g: 64, b: 72 };
				for (let i = 0; i < data.length; i += 4) {
					const [r, g, b] = [data[i]!, data[i + 1]!, data[i + 2]!];
					const score = (Math.max(r, g, b) - Math.min(r, g, b)) * (Math.max(r, g, b) > 40 && Math.max(r, g, b) < 235 ? 1 : 0.3);
					if (score > best.score) best = { score, r, g, b };
				}
				const scale = 120 / Math.max(best.r, best.g, best.b, 1);
				resolve(argb(Math.round(best.r * scale), Math.round(best.g * scale), Math.round(best.b * scale)));
			} catch {
				resolve(fallback);
			}
		};
		image.onerror = () => resolve(fallback);
		image.src = url;
	});
}

function toColorLyrics(lyrics: Lyrics, background: number): any {
	const lines = lyrics.synced
		? lyrics.lines.map((line) => ({ startTimeMs: String(Math.round(line.time * 1000)), words: line.text || "♪", syllables: [], endTimeMs: "0" }))
		: (lyrics.plain ?? "").split("\n").map((text) => ({ startTimeMs: "0", words: text || "♪", syllables: [], endTimeMs: "0" }));
	return {
		lyrics: {
			syncType: lyrics.synced ? "LINE_SYNCED" : "UNSYNCED",
			lines,
			provider: lyrics.source ?? "juicevault",
			providerLyricsId: lyrics.songId,
			providerDisplayName: lyrics.source === "lrclib" ? "LRCLIB" : "JuiceVault",
			syncLyricsUri: "",
			isDenseTypeface: false,
			alternatives: [],
			language: "en",
			isRtlLanguage: false,
			capStatus: "NONE",
			previewLines: [],
		},
		colors: { background, text: argb(0, 0, 0), highlightText: argb(255, 255, 255) },
		hasVocalRemoval: false,
	};
}

function response(body: unknown): any {
	return { body, status: 200, headers: {}, ok: true, url: "" };
}

export function installLyricsBridge(): () => void {
	const builder = Spicetify.Platform?.RequestBuilder;
	if (typeof builder?.build !== "function") return () => undefined;
	const prototype = Object.getPrototypeOf(builder.build());
	const original = prototype?.send;
	if (typeof original !== "function") return () => undefined;

	prototype.send = async function send(this: any, ...args: unknown[]): Promise<any> {
		const url = `${this._host ?? ""}${this.path ?? ""}`;
		if (stands.size && /pathfinder/.test(url)) {
			const payload = JSON.stringify([this.body ?? null, this.queryParameters ?? null]);
			const covers = [...stands.values()].map((stand) => stand.cover).filter((cover): cover is string => Boolean(cover));
			if (DYNAMIC_COLORS.test(payload) && covers.some((cover) => payload.includes(JSON.stringify(cover).slice(1, -1)))) {
				throw new Error("JuiceVault covers use the lyrics colors");
			}
		}
		const meta = url.match(METADATA);
		if (meta && stands.has(meta[1]!.toLowerCase())) return response({ has_lyrics: true });

		const color = url.match(COLOR_LYRICS);
		const stand = color ? stands.get(color[1]!) : undefined;
		if (stand) {
			const lyrics = await getLyrics(stand.songId);
			if (!lyrics) throw Object.assign(new Error("No lyrics"), { status: 404 });
			return response(toColorLyrics(lyrics, await coverColor(stand.cover)));
		}
		return original.apply(this, args);
	};

	return () => {
		prototype.send = original;
	};
}

const CONTEXT_PROVIDER = 10;

function fiberOf(element: Element): any {
	const key = Object.keys(element).find((name) => name.startsWith("__reactFiber$"));
	return key ? (element as any)[key] : null;
}

function registryAbove(anchor: Element): { type: any; value: any } | null {
	for (let fiber = fiberOf(anchor); fiber; fiber = fiber.return) {
		const value = fiber.tag === CONTEXT_PROVIDER ? fiber.memoizedProps?.value : null;
		if (value && typeof value.resolve === "function") return { type: fiber.type, value };
	}
	return null;
}

function playerFor(player: any, playingUri: string, standIn: string): any {
	const swap = (state: any): any => (state?.item?.uri === playingUri ? { ...state, item: { ...state.item, uri: standIn } } : state);
	const events = player.getEvents();
	const proxyEvents = new Proxy(events, {
		get(target, key) {
			if (key === "addListener") {
				return (name: string, handler: (event: any) => void, ...rest: unknown[]) =>
					target.addListener(name, (event: any) => handler(name === "update" && event?.data ? { ...event, data: swap(event.data) } : event), ...rest);
			}
			const value = Reflect.get(target, key);
			return typeof value === "function" ? value.bind(target) : value;
		},
	});
	return new Proxy(player, {
		get(target, key) {
			if (key === "getState") return () => swap(target.getState());
			if (key === "getEvents") return () => proxyEvents;
			const value = Reflect.get(target, key);
			return typeof value === "function" ? value.bind(target) : value;
		},
	});
}

export function lyricsScope(anchor: Element, playingUri: string, standIn: string): { type: any; value: any } | null {
	const registry = registryAbove(anchor);
	const player = Spicetify.Platform?.PlayerAPI;
	if (!registry || !player) return null;
	const proxied = playerFor(player, playingUri, standIn);
	const value = new Proxy(registry.value, {
		get(target, key) {
			if (key === "resolve") {
				return (token: unknown, ...rest: unknown[]) => {
					const resolved = target.resolve(token, ...rest);
					return resolved === player ? proxied : resolved;
				};
			}
			const value = Reflect.get(target, key);
			return typeof value === "function" ? value.bind(target) : value;
		},
	});
	return { type: registry.type, value };
}
