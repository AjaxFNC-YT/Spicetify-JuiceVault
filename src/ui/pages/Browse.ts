import type { Song, SongCategory } from "../../core/models/song";
import type { Profile } from "../../core/auth/session";
import { LOGO } from "../../assets/logo";
import type { JuiceVaultApi } from "../bridge";
import { h, native, useCallback, useEffect, useMemo, useState } from "../h";
import { useNowPlaying, usePlaylists } from "../hooks";
import { useQueryParam } from "../router";
import { Icon } from "../icons";
import { TrackHeader, TrackRow } from "../components/TrackRow";

type Filter = SongCategory | "all";

const CATEGORIES: Array<{ id: Filter; label: string; hideKey?: string }> = [
	{ id: "all", label: "Everything" },
	{ id: "main", label: "Unreleased" },
	{ id: "released", label: "Released", hideKey: "hideReleased" },
	{ id: "cut", label: "Cut Files", hideKey: "hideCutFiles" },
	{ id: "remaster", label: "Remasters", hideKey: "hideRemasters" },
	{ id: "instrumental", label: "Instrumentals", hideKey: "hideInstrumentals" },
	{ id: "stem", label: "Stems", hideKey: "hideStems" },
];

const PAGE_SIZE = 60;

function hiddenCategories(profile: Profile | null): Set<Filter> {
	const prefs = profile?.preferences ?? {};
	const hidden = new Set<Filter>();
	for (const entry of CATEGORIES) {
		if (entry.hideKey && prefs[entry.hideKey] === true) hidden.add(entry.id);
	}
	return hidden;
}

export function Browse({ jv, profile }: { jv: JuiceVaultApi | null; profile: Profile | null }): any {
	const [songs, setSongs] = useState<Song[]>([]);
	const [loading, setLoading] = useState(true);
	const linkedQuery = useQueryParam("q");
	const [query, setQuery] = useState(linkedQuery);
	const [category, setCategory] = useState<Filter>("all");
	const [visible, setVisible] = useState(PAGE_SIZE);
	const [searchOpen, setSearchOpen] = useState(Boolean(linkedQuery));
	const nowPlaying = useNowPlaying();
	const playlists = usePlaylists(jv);

	useEffect(() => {
		if (!jv) return;
		let cancelled = false;
		void jv.catalog.load().then(() => {
			if (cancelled) return;
			setSongs(jv.catalog.all());
			setLoading(false);
		});
		const stop = jv.catalog.events.on("updated", () => {
			if (!cancelled) setSongs(jv.catalog.all());
		});
		return () => {
			cancelled = true;
			stop();
		};
	}, [jv]);

	const hidden = useMemo(() => hiddenCategories(profile), [profile]);
	const hideSessions = profile?.preferences?.hideSessions === true;
	const options = CATEGORIES.filter((entry) => !hidden.has(entry.id));

	useEffect(() => {
		if (hidden.has(category)) setCategory("all");
	}, [hidden, category]);

	useEffect(() => {
		if (!linkedQuery) return;
		setQuery(linkedQuery);
		setSearchOpen(true);
	}, [linkedQuery]);

	useEffect(() => setVisible(PAGE_SIZE), [query, category]);

	const filtered = useMemo(() => {
		let list: Song[] = query.trim() && jv ? jv.catalog.searchSongs(query, 1000) : songs;
		list = list.filter((song) => !hidden.has(song.category) && !(hideSessions && song.isSessionEdit));
		if (category !== "all") list = list.filter((song) => song.category === category);
		return list;
	}, [songs, query, category, hidden, hideSessions, jv]);

	const label = options.find((entry) => entry.id === category)?.label ?? "Everything";
	const shown = filtered.slice(0, visible);

	const play = useCallback(
		(index: number) => jv?.playList(filtered, index, query.trim() ? `Search: ${query}` : label),
		[jv, filtered, query, label],
	);

	const RC = native();
	const filterMenu = h(
		RC.Menu,
		null,
		options.map((entry) =>
			h(
				RC.MenuItem,
				{
					key: entry.id,
					onClick: () => setCategory(entry.id),
					trailingIcon: category === entry.id ? Icon("check", 16) : undefined,
				},
				entry.label,
			),
		),
	);

	return h(
		"div",
		null,
		h(
			"div",
			{ className: "jv-hero" },
			h("img", { className: "jv-cover", src: LOGO, alt: "" }),
			h(
				"div",
				{ className: "jv-headtext" },
				h("p", { className: "jv-eyebrow" }, "Archive"),
				h("h1", null, "JuiceVault"),
				h(
					"p",
					{ className: "jv-sub" },
					"Juice WRLD",
					h("span", null, loading ? " • loading…" : ` • ${filtered.length.toLocaleString()} songs`),
				),
			),
		),
		h(
			"div",
			{ className: "jv-actions" },
			h("button", { className: "jv-big", title: "Play", onClick: () => play(0) }, Icon("play", 30)),
			h(
				"button",
				{
					className: "jv-icon",
					title: "Shuffle",
					onClick: () => play(Math.floor(Math.random() * Math.max(1, filtered.length))),
				},
				Icon("shuffle", 28),
			),
			h("div", { className: "jv-spacer" }),
			h(
				"div",
				{ className: "jv-wrap", "data-open": String(searchOpen) },
				h("button", { className: "jv-searchbtn", title: "Search", onClick: () => setSearchOpen(!searchOpen) }, Icon("search", 16)),
				h("input", {
					placeholder: "Search the vault",
					value: query,
					onChange: (event: any) => setQuery(event.target.value),
					onBlur: () => {
						if (!query) setSearchOpen(false);
					},
					ref: (node: any) => {
						if (searchOpen && node) node.focus();
					},
				}),
			),
			h(
				RC.ContextMenu,
				{ trigger: "click", action: "toggle", menu: filterMenu },
				h("button", { className: "jv-sort", title: "Filter" }, label, Icon("sort", 16)),
			),
		),
		shown.length
			? h(
					"div",
					{ className: "jv-list" },
					TrackHeader(),
					shown.map((song, index) =>
						h(TrackRow, {
							key: song.id,
							song,
							position: index + 1,
							playing: nowPlaying === song.id,
							onPlay: () => play(index),
							playlists,
						}),
					),
					visible < filtered.length
						? h(
								"button",
								{ className: "jv-more", onClick: () => setVisible(visible + PAGE_SIZE) },
								`Show ${Math.min(PAGE_SIZE, filtered.length - visible)} more`,
							)
						: null,
				)
			: h("div", { className: "jv-empty" }, loading ? "Loading…" : "Nothing matched that search."),
	);
}
