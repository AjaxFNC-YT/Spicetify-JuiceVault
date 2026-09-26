import type { Catalog } from "../core/catalog/catalog";
import { alternateNames, songKind, songTag } from "../core/models/song";
import { getDeviceSettings, onDeviceSettings } from "../core/settings/device";
import { injectStyle } from "../ui/styles";
import { isJvUri, parseSongId } from "./uri";

declare const Spicetify: any;

const ROW = ".main-trackList-trackListRow";
const MAIN = ".main-trackList-rowMainContent";
const TITLE = ".main-trackList-rowTitle";
const PLAYER_WIDGET = '[data-testid="now-playing-widget"]';
const PLAYER_SUBTITLE = `${PLAYER_WIDGET} .main-trackInfo-artists`;
const PLAYER_TITLE = `${PLAYER_WIDGET} .main-trackInfo-name`;
const GROUP_CLASS = "jv-native-tags";
const TAG_CLASS = "jv-native-tag";
const MAX_ALT = 1;
const MAX_DEPTH = 30;

interface Badge {
	text: string;
	kind: string;
	alt: boolean;
	title?: string;
}

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

function innermost(selector: string): Element | null {
	const matches = Array.from(document.querySelectorAll(selector));
	return matches.find((element) => !matches.some((other) => other !== element && element.contains(other))) ?? null;
}

export function registerNativeTags(catalog: Catalog): () => void {
	injectStyle();
	let frame: number | null = null;

	const badgesFor = (uri: string | null, include: { tag: boolean; alt: boolean }): Badge[] => {
		if (!uri || !isJvUri(uri)) return [];
		const song = catalog.get(parseSongId(uri) ?? "");
		if (!song) return [];

		const { showNativeTags, showAltNames } = getDeviceSettings();
		const badges: Badge[] = [];
		const tag = include.tag && showNativeTags ? songTag(song) : null;
		if (tag) badges.push({ text: tag, kind: songKind(song), alt: false });

		if (include.alt && showAltNames) {
			const names = alternateNames(song);
			const title = names.join(", ");
			for (const name of names.slice(0, MAX_ALT)) badges.push({ text: name, kind: "alt", alt: true, title });
			if (names.length > MAX_ALT) badges.push({ text: `+${names.length - MAX_ALT}`, kind: "alt", alt: true, title });
		}
		return badges;
	};

	const place = (scope: Element, slot: string, target: Element | null, uri: string | null, badges: Badge[], colored: string, append = false): void => {
		const existing = Array.from(scope.querySelectorAll<HTMLElement>(`.${GROUP_CLASS}[data-slot="${slot}"]`));
		const signature = `${uri}|${colored}|${badges.map((badge) => badge.text).join("|")}`;

		if (!badges.length || !target) {
			for (const group of existing) group.remove();
			return;
		}
		if (existing.length === 1 && existing[0]!.dataset.signature === signature && existing[0]!.parentElement === target) return;
		for (const group of existing) group.remove();

		const group = document.createElement("span");
		group.className = GROUP_CLASS;
		group.dataset.slot = slot;
		group.dataset.signature = signature;
		for (const badge of badges) {
			const element = document.createElement("span");
			element.className = badge.alt ? `${TAG_CLASS} ${TAG_CLASS}--alt` : TAG_CLASS;
			element.dataset.kind = badge.kind;
			element.dataset.colored = colored;
			element.textContent = badge.text;
			if (badge.title) element.title = badge.title;
			group.append(element);
		}
		if (append) target.append(group);
		else target.prepend(group);
	};

	const scan = (): void => {
		frame = null;
		const colored = String(getDeviceSettings().coloredTags);
		for (const row of Array.from(document.querySelectorAll<HTMLElement>(ROW))) {
			const uri = rowUri(row);
			place(row, "row", subtitleOf(row), uri, badgesFor(uri, { tag: true, alt: true }), colored);
		}

		const player = document.querySelector(PLAYER_WIDGET);
		if (!player) return;
		const playing = Spicetify.Platform?.PlayerAPI?._state?.item?.uri ?? null;
		place(player, "title", innermost(PLAYER_TITLE), playing, badgesFor(playing, { tag: true, alt: false }), colored, true);
		place(player, "subtitle", innermost(PLAYER_SUBTITLE), playing, badgesFor(playing, { tag: false, alt: true }), colored);
	};

	const schedule = (): void => {
		if (frame === null) frame = window.requestAnimationFrame(scan);
	};

	const observer = new MutationObserver(schedule);
	observer.observe(document.body, { childList: true, subtree: true });
	const stopCatalog = catalog.events.on("updated", schedule);
	const stopSettings = onDeviceSettings(schedule);
	schedule();

	return () => {
		observer.disconnect();
		stopCatalog();
		stopSettings();
		if (frame !== null) window.cancelAnimationFrame(frame);
		for (const group of Array.from(document.querySelectorAll(`.${GROUP_CLASS}`))) group.remove();
	};
}
