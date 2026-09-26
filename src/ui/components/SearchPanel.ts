import type { Song } from "../../core/models/song";
import { LOGO_SMALL } from "../../assets/logoSmall";
import { api } from "../bridge";
import { h, useEffect, useState } from "../h";
import { useNowPlaying, usePlaylists } from "../hooks";
import { Icon } from "../icons";
import { TrackHeader, TrackRow } from "./TrackRow";

export type SearchMode = "spotify" | "juicevault";

const PAGE_SIZE = 50;

export interface SearchPanelProps {
	query: string;
	mode: SearchMode;
	onMode: (mode: SearchMode) => void;
}

function Switch({ mode, onMode, count }: { mode: SearchMode; onMode: (mode: SearchMode) => void; count: number | null }): any {
	const option = (value: SearchMode, label: string, icon: any): any =>
		h(
			"button",
			{
				className: "jv-switch-option",
				"data-active": String(mode === value),
				"aria-pressed": mode === value,
				onClick: () => onMode(value),
			},
			icon,
			h("span", null, label),
		);

	return h(
		"div",
		{ className: "jv-switch", role: "group", "aria-label": "Search source" },
		option("spotify", "Spotify", h("span", { className: "jv-switch-icon jv-switch-icon--spotify" }, Icon("spotify", 16))),
		option(
			"juicevault",
			count === null ? "JuiceVault" : `JuiceVault • ${count.toLocaleString()}`,
			h("img", { className: "jv-switch-icon", src: LOGO_SMALL, alt: "" }),
		),
	);
}

export function SearchPanel({ query, mode, onMode }: SearchPanelProps): any {
	const [results, setResults] = useState<Song[] | null>(null);
	const [visible, setVisible] = useState(PAGE_SIZE);
	const nowPlaying = useNowPlaying();
	const jv = api();
	const playlists = usePlaylists(jv);

	useEffect(() => {
		let cancelled = false;
		setVisible(PAGE_SIZE);
		const run = async (): Promise<void> => {
			const current = api();
			if (!current) return;
			await current.catalog.load();
			if (!cancelled) setResults(current.catalog.searchSongs(query, 1000));
		};
		void run();
		return () => {
			cancelled = true;
		};
	}, [query]);

	const body =
		mode !== "juicevault"
			? null
			: results === null
				? h("div", { className: "jv-empty" }, "Searching the vault…")
				: results.length === 0
					? h("div", { className: "jv-empty" }, `No JuiceVault songs match “${query}”.`)
					: h(
							"div",
							{ className: "jv-list jv-list--flush jv-search-results" },
							TrackHeader(),
							results.slice(0, visible).map((song, index) =>
								h(TrackRow, {
									key: song.id,
									song,
									position: index + 1,
									playing: nowPlaying === song.id,
									onPlay: () => jv?.playList(results, index, `Search: ${query}`),
									playlists,
									standaloneMenu: true,
								}),
							),
							visible < results.length
								? h(
										"button",
										{ className: "jv-more", onClick: () => setVisible(visible + PAGE_SIZE) },
										`Show ${Math.min(PAGE_SIZE, results.length - visible)} more`,
									)
								: null,
						);

	return h("div", { className: "jv-search-panel" }, Switch({ mode, onMode, count: results?.length ?? null }), body);
}
