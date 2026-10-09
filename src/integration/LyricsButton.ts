import { createLogger } from "../core/log";
import { getLyrics } from "../core/api/lyrics";
import { getDeviceSettings, onDeviceSettings } from "../core/settings/device";
import { isJvUri, parseSongId } from "./uri";

declare const Spicetify: any;

const log = createLogger("LyricsButton");

const LYRICS_PATH = "/juicevault";
const LYRICS_VIEW = "lyrics";

function onLyricsView(): boolean {
	const location = Spicetify.Platform?.History?.location;
	return location?.pathname === LYRICS_PATH && new URLSearchParams(location.search ?? "").get("view") === LYRICS_VIEW;
}

function playingSongId(): string | null {
	const uri = Spicetify.Platform?.PlayerAPI?._state?.item?.uri;
	return isJvUri(uri) ? parseSongId(uri) : null;
}

export function registerLyricsButton(): () => void {
	if (typeof Spicetify.Playbar?.Button !== "function") {
		log.warn("Spicetify.Playbar is unavailable; no lyrics button");
		return () => undefined;
	}

	const toggle = (): void => {
		const history = Spicetify.Platform.History;
		if (!onLyricsView()) history.push(`${LYRICS_PATH}?view=${LYRICS_VIEW}`);
		else if (history.length > 1) history.goBack();
		else history.push(LYRICS_PATH);
	};

	const button = new Spicetify.Playbar.Button("Lyrics", "lyrics", toggle, false, false, false);
	let shown = false;
	let checking: string | null = null;

	const show = (visible: boolean): void => {
		if (visible === shown) return;
		shown = visible;
		if (visible) button.register();
		else button.deregister();
	};

	const refresh = (): void => {
		button.active = onLyricsView();
		const songId = getDeviceSettings().lyricsButton ? playingSongId() : null;
		if (!songId) {
			checking = null;
			show(false);
			return;
		}
		if (checking === songId) return;
		checking = songId;
		getLyrics(songId)
			.then((lyrics) => {
				if (checking === songId) show(Boolean(lyrics));
			})
			.catch(() => {
				if (checking === songId) show(false);
			});
	};

	const api = Spicetify.Platform.PlayerAPI;
	const events = typeof api.getEvents === "function" ? api.getEvents() : api._events;
	const onUpdate = (): void => refresh();
	events?.addListener?.("update", onUpdate);
	const stopHistory = Spicetify.Platform.History.listen(() => refresh());
	const stopSettings = onDeviceSettings(({ patch }) => {
		if ("lyricsButton" in patch) {
			checking = null;
			refresh();
		}
	});
	refresh();

	return () => {
		events?.removeListener?.("update", onUpdate);
		if (typeof stopHistory === "function") stopHistory();
		stopSettings();
		show(false);
	};
}
