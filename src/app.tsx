import type { Song, SongCategory } from "./core/models/song";
import { LOGO } from "./assets/logo";
import { Icon } from "./ui/icons";

declare const Spicetify: any;

interface JuiceVaultApi {
	catalog: {
		ready: boolean;
		size: number;
		all(): Song[];
		load(force?: boolean): Promise<void>;
		search(query: string, limit?: number): Array<{ song: Song; score: number }>;
	};
	playList(songs: Song[], index: number, contextName?: string): void;
	playlists(): Promise<Array<{ uri: string; name: string }>>;
	addToPlaylist(playlistUri: string, songId: string): Promise<string>;
	player: { current: { songId: string } | null; isPlaying: boolean };
}

const CATEGORIES: Array<{ id: SongCategory | "all"; label: string }> = [
	{ id: "all", label: "Everything" },
	{ id: "main", label: "Unreleased" },
	{ id: "released", label: "Released" },
	{ id: "cut", label: "Cut Files" },
	{ id: "remaster", label: "Remasters" },
	{ id: "instrumental", label: "Instrumentals" },
	{ id: "stem", label: "Stems" },
];

const PAGE_SIZE = 60;
const STYLE_ID = "juicevault-app-style";

const CSS = `
.jv-root { --jv-accent: #f5c518; color: #fff; padding-bottom: 120px; }

.jv-hero { display: flex; align-items: flex-end; gap: 24px; padding: 56px 32px 24px; }
.jv-cover { width: 192px; height: 192px; flex: 0 0 auto; object-fit: contain; }
.jv-headtext { min-width: 0; padding-bottom: 6px; }
.jv-eyebrow { font-size: .75rem; font-weight: 700; margin: 0 0 12px; }
.jv-hero h1 { font-size: clamp(2rem, 6vw, 6rem); line-height: 1.05; font-weight: 900; margin: 0 0 16px; letter-spacing: -.035em; }
.jv-sub { color: #fff; font-size: .875rem; margin: 0; }
.jv-sub span { color: rgba(255,255,255,.72); }

.jv-actions { display: flex; align-items: center; gap: 16px; padding: 8px 32px 8px; }
.jv-sort { display: flex; align-items: center; gap: 6px; background: none; border: none; cursor: pointer;
  color: rgba(255,255,255,.7); font-size: .8rem; font-weight: 600; white-space: nowrap; }
.jv-sort:hover { color: #fff; }
.jv-big { background: none; border: none; cursor: pointer; flex: 0 0 auto; color: #fff; padding: 4px;
  display: flex; align-items: center; justify-content: center; transition: transform .12s ease; }
.jv-big:hover { transform: scale(1.06); }
.jv-icon { background: none; border: none; cursor: pointer; color: rgba(255,255,255,.7); padding: 4px;
  display: flex; align-items: center; }
.jv-icon:hover { color: #fff; }
.jv-spacer { flex: 1 1 auto; }

.jv-toolbar { display: none; }
.jv-tabs { display: flex; flex-wrap: nowrap; gap: 8px; width: 100%; overflow-x: auto; scrollbar-width: none;
  mask-image: linear-gradient(90deg, #000 calc(100% - 40px), transparent 100%);
  -webkit-mask-image: linear-gradient(90deg, #000 calc(100% - 40px), transparent 100%); }
.jv-tabs::-webkit-scrollbar { display: none; }
.jv-tab { flex: 0 0 auto; height: 32px; padding: 0 14px; border-radius: 500px; border: none; cursor: pointer;
  font-size: .78rem; font-weight: 600; background: rgba(255,255,255,.1); color: rgba(255,255,255,.9); white-space: nowrap;
  transition: background .15s ease, color .15s ease; }
.jv-tab:hover { background: rgba(255,255,255,.2); }
.jv-tab[data-active="true"] { background: #fff; color: #121212; }

.jv-input { width: 100%; height: 32px; padding: 0 12px 0 34px; border-radius: 4px; border: none;
  background: rgba(255,255,255,.1); color: #fff; font-size: .8rem; outline: none; }
.jv-input::placeholder { color: rgba(255,255,255,.55); }
.jv-input:focus { background: rgba(255,255,255,.18); }

.jv-list { padding: 16px 32px 0; contain: layout style; }
.jv-head, .jv-row { display: grid; grid-template-columns: 24px 6fr 4fr 96px; align-items: center; gap: 16px; }
.jv-head { padding: 0 16px 10px; border-bottom: 1px solid rgba(255,255,255,.12); margin-bottom: 12px;
  font-size: .75rem; color: rgba(255,255,255,.62); }
.jv-row { height: 56px; padding: 0 16px; border-radius: 4px; }
.jv-row:hover { background: rgba(255,255,255,.1); }
.jv-row:hover .jv-num { display: none; }
.jv-row:hover .jv-play { display: flex; }
.jv-num { color: rgba(255,255,255,.62); font-size: .9rem; text-align: right; font-variant-numeric: tabular-nums; }
.jv-play { display: none; align-items: center; justify-content: flex-end; background: none; border: none;
  color: #fff; cursor: pointer; padding: 0; width: 100%; }
.jv-cell { display: flex; align-items: center; gap: 14px; min-width: 0; }
.jv-art { width: 40px; height: 40px; border-radius: 2px; object-fit: cover; background: rgba(255,255,255,.08); flex: 0 0 auto; }
.jv-meta { min-width: 0; }
.jv-name { font-size: 1rem; margin: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.jv-artist { font-size: .8rem; color: rgba(255,255,255,.62); margin: 4px 0 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.jv-album { font-size: .875rem; color: rgba(255,255,255,.62); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.jv-time { color: rgba(255,255,255,.62); font-size: .875rem; text-align: right; font-variant-numeric: tabular-nums; }
.jv-row[data-playing="true"] .jv-name, .jv-row[data-playing="true"] .jv-num { color: var(--jv-accent); }
.jv-tag { display: inline-block; margin-left: 8px; padding: 1px 5px; border-radius: 2px; font-size: .6rem;
  font-weight: 700; letter-spacing: .05em; text-transform: uppercase; background: rgba(255,255,255,.14); color: rgba(255,255,255,.75); }
.jv-more { display: block; margin: 28px auto 0; height: 40px; padding: 0 28px; border-radius: 500px; border: 1px solid rgba(255,255,255,.22);
  background: transparent; color: #fff; font-weight: 700; font-size: .8rem; cursor: pointer; }
.jv-more:hover { border-color: #fff; transform: scale(1.02); }
.jv-empty { padding: 72px 32px; text-align: center; color: rgba(255,255,255,.6); }

.jv-searchbox { display: flex; align-items: center; }
.jv-wrap { position: relative; display: flex; align-items: center; flex: 0 0 auto; }
.jv-wrap input { width: 0; opacity: 0; padding: 0; border: none; background: transparent;
  will-change: width; transition: width .18s ease-out, opacity .12s ease-out, padding .18s ease-out; }
.jv-wrap[data-open="true"] input { width: 220px; opacity: 1; padding: 0 12px 0 34px; }
.jv-wrap[data-open="true"] { background: rgba(255,255,255,.1); border-radius: 4px; }
.jv-wrap input { height: 32px; color: #fff; font-size: .8rem; outline: none; }
.jv-wrap input::placeholder { color: rgba(255,255,255,.55); }
.jv-searchbtn { background: none; border: none; cursor: pointer; color: rgba(255,255,255,.7);
  display: flex; align-items: center; justify-content: center; width: 32px; height: 32px; padding: 0; }
.jv-searchbtn:hover { color: #fff; }
.jv-wrap[data-open="true"] .jv-searchbtn { position: absolute; left: 0; pointer-events: none; opacity: .7; }

.jv-dots { background: none; border: none; cursor: pointer; color: rgba(255,255,255,.7);
  padding: 4px; display: flex; align-items: center; opacity: 0; transition: opacity .12s ease; }
.jv-row:hover .jv-dots, .jv-row[data-menu="true"] .jv-dots { opacity: 1; }
.jv-dots:hover { color: #fff; }
.jv-end { display: flex; align-items: center; gap: 12px; justify-content: flex-end; }
`;

function injectStyle(): void {
	if (document.getElementById(STYLE_ID)) return;
	const style = document.createElement("style");
	style.id = STYLE_ID;
	style.textContent = CSS;
	document.head.appendChild(style);
}

function api(): JuiceVaultApi | null {
	return (window as any).JuiceVault ?? null;
}

const LABELS: Partial<Record<SongCategory, string>> = {
	instrumental: "inst",
	remaster: "remaster",
	stem: "stem",
	released: "released",
	cut: "cut",
};

function sortSongs(list: Song[], mode: string): Song[] {
	if (mode === "custom") return list;
	const copy = [...list];
	copy.sort((a, b) => {
		if (mode === "title") return a.title.localeCompare(b.title);
		if (mode === "artist") return a.artist.localeCompare(b.artist) || a.title.localeCompare(b.title);
		if (mode === "duration") return a.durationSeconds - b.durationSeconds;
		if (mode === "plays") return b.playCount - a.playCount;
		return 0;
	});
	return copy;
}

function Row({ song, position, playing, onPlay, playlists }: any): any {
	const React = Spicetify.React;
	const RC = Spicetify.ReactComponent;
	const tag = LABELS[song.category as SongCategory];

	const menu = buildMenu(song, playlists, onPlay);

	const content = React.createElement(
		"div",
		{ className: "jv-row", "data-playing": String(playing), onDoubleClick: onPlay },
		React.createElement(
			"div",
			null,
			React.createElement("div", { className: "jv-num" }, position),
			React.createElement("button", { className: "jv-play", onClick: onPlay, title: "Play" }, Icon("play", 14)),
		),
		React.createElement(
			"div",
			{ className: "jv-cell" },
			React.createElement("img", { className: "jv-art", src: song.coverUrl, loading: "lazy", alt: "" }),
			React.createElement(
				"div",
				{ className: "jv-meta" },
				React.createElement(
					"p",
					{ className: "jv-name" },
					song.title,
					tag ? React.createElement("span", { className: "jv-tag" }, tag) : null,
				),
				React.createElement("p", { className: "jv-artist" }, song.artist),
			),
		),
		React.createElement("div", { className: "jv-album" }, song.album || "JuiceVault"),
		React.createElement(
			"div",
			{ className: "jv-end" },
			React.createElement("span", { className: "jv-time" }, song.length),
			React.createElement(
				RC.ContextMenu,
				{ menu, trigger: "click", action: "toggle" },
				React.createElement(
					"button",
					{ className: "jv-dots", title: "More options", onClick: (e: any) => e.stopPropagation() },
					Icon("more", 16),
				),
			),
		),
	);

	return React.createElement(RC.ContextMenu, { menu, trigger: "right-click" }, content);
}

function buildMenu(song: Song, playlists: any[], onPlay: () => void): any {
	const React = Spicetify.React;
	const RC = Spicetify.ReactComponent;

	const add = async (playlistUri: string): Promise<void> => {
		try {
			await api()?.addToPlaylist(playlistUri, song.id);
			Spicetify.showNotification("Added to playlist");
		} catch {
			Spicetify.showNotification("Could not add to that playlist", true);
		}
	};

	const items = [
		React.createElement(RC.MenuItem, { key: "play", onClick: onPlay }, "Play"),
		React.createElement(
			RC.MenuSubMenuItem,
			{ key: "add", displayText: "Add to playlist" },
			playlists.length
				? playlists.map((playlist: any) =>
						React.createElement(
							RC.MenuItem,
							{ key: playlist.uri, onClick: () => void add(playlist.uri) },
							playlist.name,
						),
					)
				: React.createElement(RC.MenuItem, { key: "none", disabled: true }, "No editable playlists"),
		),
		React.createElement(
			RC.MenuItem,
			{
				key: "copy",
				onClick: () => {
					Spicetify.Platform.ClipboardAPI.copy(song.title + " \u2014 " + song.artist);
					Spicetify.showNotification("Copied");
				},
			},
			"Copy title",
		),
	];

	return React.createElement(RC.Menu, null, items);
}

function App(): any {
	const React = Spicetify.React;
	const [songs, setSongs] = React.useState([]) as [Song[], (value: Song[]) => void];
	const [query, setQuery] = React.useState("");
	const [category, setCategory] = React.useState("all") as [SongCategory | "all", (value: SongCategory | "all") => void];
	const [visible, setVisible] = React.useState(PAGE_SIZE);
	const [loading, setLoading] = React.useState(true);
	const [nowPlaying, setNowPlaying] = React.useState(null) as [string | null, (value: string | null) => void];
	const [searchOpen, setSearchOpen] = React.useState(false);
	const sort = "custom";
	const [playlists, setPlaylists] = React.useState([]) as [any[], (value: any[]) => void];

	React.useEffect(() => {
		injectStyle();
		let cancelled = false;

		const load = async (): Promise<void> => {
			const jv = api();
			if (!jv) {
				window.setTimeout(load, 300);
				return;
			}
			await jv.catalog.load();
			if (cancelled) return;
			setSongs(jv.catalog.all());
			setLoading(false);
			void jv.playlists().then((list: any[]) => {
				if (!cancelled) setPlaylists(list);
			});
		};

		void load();
		return () => {
			cancelled = true;
		};
	}, []);

	React.useEffect(() => {
		const timer = window.setInterval(() => setNowPlaying(api()?.player?.current?.songId ?? null), 800);
		return () => window.clearInterval(timer);
	}, []);

	React.useEffect(() => setVisible(PAGE_SIZE), [query, category, sort]);

	const filtered = React.useMemo(() => {
		const jv = api();
		let list: Song[] = songs;
		if (query.trim() && jv) list = jv.catalog.search(query, 1000).map((result) => result.song);
		if (category !== "all") list = list.filter((song: Song) => song.category === category);
		return sortSongs(list, query.trim() ? "custom" : sort);
	}, [songs, query, category, sort]);

	const shown: Song[] = filtered.slice(0, visible);
	const label = CATEGORIES.find((entry) => entry.id === category)?.label ?? "JuiceVault";

	const play = React.useCallback(
		(index: number) => {
			api()?.playList(filtered, index, query.trim() ? "Search: " + query : label);
		},
		[filtered, query, label],
	);

	return React.createElement(
		"div",
		{ className: "jv-root" },
		React.createElement(
			"div",
			{ className: "jv-hero" },
			React.createElement("img", { className: "jv-cover", src: LOGO, alt: "" }),
			React.createElement(
				"div",
				{ className: "jv-headtext" },
				React.createElement("p", { className: "jv-eyebrow" }, "Archive"),
				React.createElement("h1", null, "JuiceVault"),
				React.createElement(
					"p",
					{ className: "jv-sub" },
					"Juice WRLD",
					React.createElement(
						"span",
						null,
						loading ? " \u2022 loading\u2026" : " \u2022 " + filtered.length.toLocaleString() + " songs",
					),
				),
			),
		),
		React.createElement(
			"div",
			{ className: "jv-actions" },
			React.createElement("button", { className: "jv-big", title: "Play", onClick: () => play(0) }, Icon("play", 30)),
			React.createElement(
				"button",
				{
					className: "jv-icon",
					title: "Shuffle",
					onClick: () => play(Math.floor(Math.random() * Math.max(1, filtered.length))),
				},
				Icon("shuffle", 28),
			),
			React.createElement("div", { className: "jv-spacer" }),
			React.createElement(
				"div",
				{ className: "jv-wrap", "data-open": String(searchOpen) },
				React.createElement(
					"button",
					{
						className: "jv-searchbtn",
						title: "Search",
						onClick: () => setSearchOpen(!searchOpen),
					},
					Icon("search", 16),
				),
				React.createElement("input", {
					className: "jv-input",
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
			React.createElement(
				Spicetify.ReactComponent.ContextMenu,
				{
					trigger: "click",
					action: "toggle",
					menu: React.createElement(
						Spicetify.ReactComponent.Menu,
						null,
						CATEGORIES.map((entry) =>
							React.createElement(
								Spicetify.ReactComponent.MenuItem,
								{
									key: entry.id,
									onClick: () => setCategory(entry.id),
									trailingIcon: category === entry.id ? Icon("check", 16) : undefined,
								},
								entry.label,
							),
						),
					),
				},
				React.createElement(
					"button",
					{ className: "jv-sort", title: "Filter" },
					CATEGORIES.find((entry) => entry.id === category)?.label ?? "Everything",
					Icon("sort", 16),
				),
			),
		),
		shown.length
			? React.createElement(
					"div",
					{ className: "jv-list" },
					React.createElement(
						"div",
						{ className: "jv-head" },
						React.createElement("div", { style: { textAlign: "right" } }, "#"),
						React.createElement("div", null, "Title"),
						React.createElement("div", null, "Album"),
						React.createElement("div", { style: { textAlign: "right", paddingRight: 32 } }, Icon("clock", 16)),
					),
					shown.map((song: Song, index: number) =>
						React.createElement(Row, {
							key: song.id,
							song,
							position: index + 1,
							playing: nowPlaying === song.id,
							onPlay: () => play(index),
							playlists,
						}),
					),
					visible < filtered.length
						? React.createElement(
								"button",
								{ className: "jv-more", onClick: () => setVisible(visible + PAGE_SIZE) },
								"Show " + Math.min(PAGE_SIZE, filtered.length - visible) + " more",
							)
						: null,
				)
			: React.createElement("div", { className: "jv-empty" }, loading ? "Loading\u2026" : "Nothing matched that search."),
	);
}

function render(): any {
	return Spicetify.React.createElement(App);
}

(globalThis as any).render = render;
