import type { Catalog } from "../core/catalog/catalog";
import { songKind, songTag } from "../core/models/song";
import { getDeviceSettings, onDeviceSettings } from "../core/settings/device";
import { injectStyle } from "../ui/styles";
import { isJvUri, parseSongId } from "./uri";

const ROW = ".main-trackList-trackListRow";
const MAIN = ".main-trackList-rowMainContent";
const TITLE = ".main-trackList-rowTitle";
const TAG_CLASS = "jv-native-tag";
const MAX_DEPTH = 30;

function fiberOf(element: Element): any {
	const key = Object.keys(element).find((name) => name.startsWith("__reactFiber$"));
	return key ? (element as any)[key] : null;
}

function rowUri(row: Element): string | null {
	let fiber = fiberOf(row);
	for (let depth = 0; fiber && depth < MAX_DEPTH; depth += 1, fiber = fiber.return) {
		const props = fiber.memoizedProps;
		if (!props || typeof props !== "object") continue;
		const uri = props.uri ?? props.item?.uri ?? props.track?.uri ?? props.value?.uri ?? props.data?.uri;
		if (typeof uri === "string" && uri.startsWith("spotify:")) return uri;
	}
	return null;
}

function subtitleOf(row: Element): Element | null {
	const main = row.querySelector(MAIN);
	if (!main) return null;
	const title = main.querySelector(TITLE);
	for (const child of Array.from(main.children)) {
		if (child !== title && !child.contains(title)) return child;
	}
	return null;
}

export function registerNativeTags(catalog: Catalog): () => void {
	injectStyle();
	let frame: number | null = null;

	const label = (uri: string | null, show: boolean): { tag: string; kind: string } | null => {
		if (!show || !uri || !isJvUri(uri)) return null;
		const song = catalog.get(parseSongId(uri) ?? "");
		const tag = song ? songTag(song) : null;
		return song && tag ? { tag, kind: songKind(song) } : null;
	};

	const scan = (): void => {
		frame = null;
		const { showNativeTags, coloredTags } = getDeviceSettings();
		const colored = String(coloredTags);
		for (const row of Array.from(document.querySelectorAll<HTMLElement>(ROW))) {
			const uri = rowUri(row);
			const wanted = label(uri, showNativeTags);
			const existing = row.querySelector<HTMLElement>(`.${TAG_CLASS}`);

			if (!wanted) {
				existing?.remove();
				continue;
			}
			if (existing?.dataset.uri === uri && existing.textContent === wanted.tag && existing.dataset.colored === colored) continue;
			existing?.remove();

			const subtitle = subtitleOf(row);
			if (!subtitle) continue;
			const badge = document.createElement("span");
			badge.className = TAG_CLASS;
			badge.dataset.uri = uri!;
			badge.dataset.kind = wanted.kind;
			badge.dataset.colored = colored;
			badge.textContent = wanted.tag;
			subtitle.prepend(badge);
		}
	};

	const schedule = (): void => {
		if (frame === null) frame = window.requestAnimationFrame(scan);
	};

	const observer = new MutationObserver((mutations) => {
		if (mutations.every((mutation) => (mutation.target as Element).classList?.contains(TAG_CLASS))) return;
		schedule();
	});
	observer.observe(document.body, { childList: true, subtree: true });
	const stopCatalog = catalog.events.on("updated", schedule);
	const stopSettings = onDeviceSettings(schedule);
	schedule();

	return () => {
		observer.disconnect();
		stopCatalog();
		stopSettings();
		if (frame !== null) window.cancelAnimationFrame(frame);
		for (const badge of Array.from(document.querySelectorAll(`.${TAG_CLASS}`))) badge.remove();
	};
}
