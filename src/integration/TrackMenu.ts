import type { Catalog } from "../core/catalog/catalog";
import { siteUrl } from "../core/config";
import { getDeviceSettings } from "../core/settings/device";
import { whenMenuReady } from "./SyncMenu";
import { isJvUri, parseSongId } from "./uri";

declare const Spicetify: any;

const COPY_NAME = "Copy song name";
const HIDDEN_KEYS = ["contextmenu.go-to-song-radio", "contextmenu.show-credits", "contextmenu.share"];
const HIDDEN_FALLBACK = ["Go to song radio", "View credits", "Share"];
const JV_MENU_WINDOW_MS = 1500;
const SONG_IN_LINK = /jv-([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i;

function hiddenLabels(): Set<string> {
	const labels = new Set(HIDDEN_FALLBACK);
	for (const key of HIDDEN_KEYS) {
		try {
			const text = Spicetify.Locale?.get?.(key);
			if (typeof text === "string" && text) labels.add(text);
		} catch {
			continue;
		}
	}
	return labels;
}

function jvLink(text: string): string | null {
	if (!/open\.spotify\.com\/local|spotify:local:/i.test(text)) return null;
	let decoded = text;
	try {
		decoded = decodeURIComponent(text);
	} catch {
		decoded = text;
	}
	const songId = decoded.match(SONG_IN_LINK)?.[1];
	return songId ? siteUrl(`/archive/${songId}`) : null;
}

let lastJvMenuAt = 0;

function watchMenus(): () => void {
	const labels = hiddenLabels();
	let frame: number | null = null;

	const scan = (): void => {
		frame = null;
		if (!getDeviceSettings().tidyMenus) return;
		for (const menu of document.querySelectorAll<HTMLElement>('ul[role="menu"]')) {
			const items = [...menu.querySelectorAll<HTMLElement>(":scope > li")];
			const isJv = Date.now() - lastJvMenuAt < JV_MENU_WINDOW_MS || items.some((item) => item.textContent?.trim() === COPY_NAME);
			if (!isJv) continue;
			for (const item of items) {
				const text = item.querySelector("button span, a span, span")?.textContent?.trim() ?? item.textContent?.trim() ?? "";
				if (labels.has(text)) item.style.setProperty("display", "none", "important");
			}
		}
	};

	const observer = new MutationObserver(() => {
		if (frame === null) frame = window.requestAnimationFrame(scan);
	});
	observer.observe(document.body, { childList: true, subtree: true });

	return () => {
		observer.disconnect();
		if (frame !== null) window.cancelAnimationFrame(frame);
	};
}

function rewriteCopiedLinks(): () => void {
	const clipboard = Spicetify.Platform?.ClipboardAPI;
	if (typeof clipboard?.copy !== "function") return () => undefined;
	const original = clipboard.copy.bind(clipboard);

	Object.defineProperty(clipboard, "copy", {
		value: (text: unknown, ...rest: unknown[]) =>
			original(typeof text === "string" && getDeviceSettings().jvCopyLink ? (jvLink(text) ?? text) : text, ...rest),
		writable: true,
		configurable: true,
		enumerable: false,
	});

	return () => {
		delete clipboard.copy;
	};
}

export function registerTrackMenu(catalog: Catalog): () => void {
	const stopWatching = watchMenus();
	const stopRewriting = rewriteCopiedLinks();

	const stopMenu = whenMenuReady("track menu", () => {
		const copy = new Spicetify.ContextMenu.Item(
			COPY_NAME,
			(uris: string[]) => {
				const song = catalog.get(parseSongId(uris[0]!) ?? "");
				if (!song) return;
				Spicetify.Platform.ClipboardAPI.copy(`${song.title} — ${song.artist}`);
				Spicetify.showNotification("Copied");
			},
			(uris: string[]) => {
				if (uris.length !== 1 || !isJvUri(uris[0])) return false;
				lastJvMenuAt = Date.now();
				return getDeviceSettings().copySongName;
			},
			"copy",
		);
		copy.register();
		return () => copy.deregister();
	});

	return () => {
		stopMenu();
		stopWatching();
		stopRewriting();
	};
}
