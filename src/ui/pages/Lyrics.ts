import { activeLine, type Lyrics as LyricsData } from "../../core/api/lyrics";
import type { Song } from "../../core/models/song";
import type { JuiceVaultApi } from "../bridge";
import { h, useEffect, useMemo, useState } from "../h";
import { Icon } from "../icons";

declare const Spicetify: any;

const FALLBACK_COLOR = "rgb(64, 64, 72)";
const MANUAL_SCROLL_MS = 3500;

function playingSongId(jv: JuiceVaultApi | null): string | null {
	const uri = Spicetify.Platform?.PlayerAPI?._state?.item?.uri;
	return jv && jv.isJvUri(uri) ? jv.parseSongId(uri) : null;
}

function usePlayingSong(jv: JuiceVaultApi | null): string | null {
	const [songId, setSongId] = useState<string | null>(() => playingSongId(jv));

	useEffect(() => {
		const api = Spicetify.Platform.PlayerAPI;
		const events = typeof api.getEvents === "function" ? api.getEvents() : api._events;
		const update = (): void => setSongId(playingSongId(jv));
		events?.addListener?.("update", update);
		update();
		return () => events?.removeListener?.("update", update);
	}, [jv]);

	return songId;
}

function usePosition(jv: JuiceVaultApi | null, enabled: boolean): number {
	const [position, setPosition] = useState(0);

	useEffect(() => {
		if (!enabled || !jv) return;
		let frame = 0;
		const tick = (): void => {
			setPosition(jv.player.position ?? 0);
			frame = window.requestAnimationFrame(tick);
		};
		tick();
		return () => window.cancelAnimationFrame(frame);
	}, [jv, enabled]);

	return position;
}

function useCoverColor(url: string | null | undefined): string {
	const [color, setColor] = useState(FALLBACK_COLOR);

	useEffect(() => {
		if (!url) return setColor(FALLBACK_COLOR);
		let cancelled = false;
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
					const max = Math.max(r, g, b);
					const min = Math.min(r, g, b);
					const score = (max - min) * (max > 40 && max < 235 ? 1 : 0.3);
					if (score > best.score) best = { score, r, g, b };
				}
				const scale = 120 / Math.max(best.r, best.g, best.b, 1);
				if (!cancelled) setColor(`rgb(${Math.round(best.r * scale)}, ${Math.round(best.g * scale)}, ${Math.round(best.b * scale)})`);
			} catch {
				if (!cancelled) setColor(FALLBACK_COLOR);
			}
		};
		image.onerror = () => {
			if (!cancelled) setColor(FALLBACK_COLOR);
		};
		image.src = url;
		return () => {
			cancelled = true;
		};
	}, [url]);

	return color;
}

function useViewHeight(stage: HTMLElement | null): number | undefined {
	const [height, setHeight] = useState<number | undefined>(undefined);

	useEffect(() => {
		const scroller = stage?.closest(".main-view-container__scroll-node") as HTMLElement | null;
		if (!scroller) return;
		const measure = (): void => setHeight(scroller.clientHeight);
		const observer = new ResizeObserver(measure);
		observer.observe(scroller);
		measure();
		return () => observer.disconnect();
	}, [stage]);

	return height;
}

function Message({ title, text }: { title: string; text: string }): any {
	return h("div", { className: "jv-lyrics-message" }, h("h2", null, title), h("p", null, text));
}

export function Lyrics({ jv }: { jv: JuiceVaultApi | null }): any {
	const songId = usePlayingSong(jv);
	const song: Song | undefined = songId ? jv?.catalog.get(songId) : undefined;
	const [lyrics, setLyrics] = useState<LyricsData | null | undefined>(undefined);
	const [stage, setStage] = useState<HTMLElement | null>(null);
	const [fullscreen, setFullscreen] = useState(false);
	const [manualUntil, setManualUntil] = useState(0);
	const color = useCoverColor(song?.coverUrl);
	const height = useViewHeight(stage);
	const synced = Boolean(lyrics?.synced);
	const Native = lyrics && jv ? jv.nativeLyrics.component() : null;
	const playingUri: string | undefined = Spicetify.Platform.PlayerAPI._state?.item?.uri;
	const standIn = Native && song ? jv!.nativeLyrics.standIn(song.id, song.coverUrl) : null;
	const scope = useMemo(
		() => (Native && stage && playingUri && standIn ? jv!.nativeLyrics.scope(stage, playingUri, standIn) : null),
		[Native, stage, playingUri, standIn],
	);
	const position = usePosition(jv, synced && !Native);
	const active = synced ? activeLine(lyrics!.lines, position + 0.15) : -1;

	useEffect(() => {
		if (!jv || !songId) return setLyrics(undefined);
		let cancelled = false;
		setLyrics(undefined);
		jv.lyrics(songId)
			.then((result) => {
				if (!cancelled) setLyrics(result);
			})
			.catch(() => {
				if (!cancelled) setLyrics(null);
			});
		return () => {
			cancelled = true;
		};
	}, [jv, songId]);

	useEffect(() => {
		const change = (): void => setFullscreen(Boolean(stage && document.fullscreenElement === stage));
		document.addEventListener("fullscreenchange", change);
		return () => document.removeEventListener("fullscreenchange", change);
	}, [stage]);

	useEffect(() => {
		if (!stage || active < 0 || Date.now() < manualUntil) return;
		const line = stage.querySelector<HTMLElement>(`[data-line="${active}"]`);
		line?.scrollIntoView({ block: "center", behavior: "smooth" });
	}, [stage, active, manualUntil]);

	const toggleFullscreen = (): void => {
		if (document.fullscreenElement) void document.exitFullscreen();
		else void stage?.requestFullscreen?.();
	};

	if (Native && standIn) {
		const view = h(Native, { format: "fullscreen", item: { ...(Spicetify.Platform.PlayerAPI._state?.item ?? {}), uri: standIn } });
		const background = fullscreen
			? stage?.querySelector<HTMLElement>("[style*='--lyrics-color-background']")?.style.getPropertyValue("--lyrics-color-background")
			: undefined;
		return h(
			"div",
			{ className: "jv-lyrics-native", "data-fullscreen": String(fullscreen), ref: setStage, style: { background, height: fullscreen ? undefined : height } },
			h(
				"div",
				{ className: "jv-lyrics-bar" },
				h("span", null),
				h(
					"button",
					{ className: "jv-lyrics-fullscreen", title: fullscreen ? "Exit full screen" : "Full screen", onClick: toggleFullscreen },
					Icon(fullscreen ? "minimize" : "fullscreen", 16),
				),
			),
			scope ? h(scope.type, { value: scope.value }, view) : null,
		);
	}

	let body: any;
	if (!songId) body = h(Message, { title: "Play a JuiceVault song", text: "Lyrics show here for songs from the vault. For other songs, use Spotify's lyrics." });
	else if (lyrics === undefined) body = h("div", { className: "jv-lyrics-message" }, h("div", { className: "jv-spinner" }));
	else if (!lyrics) body = h(Message, { title: "No lyrics for this one yet", text: "We don't have lyrics for this song. Check back later." });
	else if (!synced)
		body = h(
			"div",
			{ className: "jv-lyrics-lines jv-lyrics-lines--plain" },
			h("p", { className: "jv-lyrics-note" }, "These lyrics aren't synced to the song yet."),
			lyrics.plain!.split("\n").map((text, index) => h("p", { key: index, className: "jv-lyrics-line" }, text || "♪")),
		);
	else
		body = h(
			"div",
			{ className: "jv-lyrics-lines" },
			lyrics.lines.map((line, index) =>
				h(
					"button",
					{
						key: index,
						"data-line": index,
						className: "jv-lyrics-line",
						"data-state": index < active ? "past" : index === active ? "active" : "future",
						onClick: () => {
							Spicetify.Player.seek(Math.round(line.time * 1000));
							setManualUntil(0);
						},
					},
					line.text || "♪",
				),
			),
		);

	return h(
		"div",
		{
			className: "jv-lyrics",
			"data-fullscreen": String(fullscreen),
			style: { "--jv-lyrics-bg": color, height: fullscreen ? undefined : height },
			ref: setStage,
			onWheel: () => setManualUntil(Date.now() + MANUAL_SCROLL_MS),
		},
		h(
			"div",
			{ className: "jv-lyrics-bar" },
			fullscreen && song
				? h(
						"div",
						{ className: "jv-lyrics-song" },
						h("img", { src: song.coverUrl, alt: "" }),
						h("div", null, h("p", { className: "jv-lyrics-title" }, song.title), h("p", { className: "jv-lyrics-artist" }, song.artist)),
					)
				: h("span", null),
			h(
				"button",
				{ className: "jv-lyrics-fullscreen", title: fullscreen ? "Exit full screen" : "Full screen", onClick: toggleFullscreen },
				Icon(fullscreen ? "minimize" : "fullscreen", 16),
			),
		),
		body,
		lyrics
			? h(
					"div",
					{ className: "jv-lyrics-footer" },
					h("p", null, "Lyrics are in beta and may not be right."),
					lyrics.source ? h("p", null, `Lyrics provided by ${lyrics.source === "lrclib" ? "LRCLIB" : lyrics.source}`) : null,
				)
			: null,
	);
}
