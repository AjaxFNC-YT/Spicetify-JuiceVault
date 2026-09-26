import { songKind, songTag, type Song } from "../../core/models/song";
import { albumName, getDeviceSettings } from "../../core/settings/device";
import { api } from "../bridge";
import { h, native, notify, useEffect, useState } from "../h";
import { Icon } from "../icons";
import { StandaloneMenu, type MenuPosition, type MenuSpec } from "./StandaloneMenu";
import { AddToPlaylistPanel } from "./AddToPlaylistPanel";
import { uriForSong } from "../../integration/uri";
import { NativeFallback, nativeMenusAvailable } from "../nativeScope";

declare const Spicetify: any;

export interface TrackRowProps {
	song: Song;
	position: number;
	playing: boolean;
	onPlay: () => void;
	playlists: Array<{ uri: string; name: string }>;
	detail?: string;
	standaloneMenu?: boolean;
}

function menuSpec(song: Song, playlists: Array<{ uri: string; name: string }>, openPanel?: () => void): MenuSpec[] {
	const run = async (task: () => Promise<unknown>, failed: string): Promise<void> => {
		try {
			await task();
		} catch {
			notify(failed, true);
		}
	};

	const add: MenuSpec = openPanel
		? { key: "add", label: "Add to playlist", icon: "plus", onClick: openPanel }
		: {
				key: "add",
				label: "Add to playlist",
				icon: "plus",
				searchable: "Find a playlist",
				children: [
					{
						key: "new",
						label: "New playlist",
						icon: "plus",
						pinned: true,
						dividerAfter: true,
						onClick: () => void run(() => api()!.newPlaylistWith(song.id), "Could not create the playlist"),
					},
					...playlists.map((playlist) => ({
						key: playlist.uri,
						label: playlist.name,
						onClick: () => void run(() => api()!.addToPlaylist(playlist.uri, song.id), "Could not add to that playlist"),
					})),
				],
			};

	const copyName = getDeviceSettings().copySongName;

	return [
		add,
		{
			key: "like",
			label: "Save to your Liked Songs",
			icon: "heart",
			dividerAfter: copyName,
			onClick: () => void run(() => api()!.saveToLiked(song.id), "Spotify wouldn't add this to Liked Songs"),
		},
		...(copyName
			? [
					{
						key: "copy",
						label: "Copy song name",
						icon: "copy",
						onClick: () => {
							Spicetify.Platform.ClipboardAPI.copy(`${song.title} — ${song.artist}`);
							notify("Copied");
						},
					},
				]
			: []),
	];
}

function nativeMenu(items: MenuSpec[]): any {
	const RC = native();
	const render = (spec: MenuSpec): any =>
		spec.children
			? h(
					RC.MenuSubMenuItem,
					{ key: spec.key, displayText: spec.label, leadingIcon: spec.icon ? Icon(spec.icon, 16) : undefined },
					spec.children.map(render),
				)
			: h(
					RC.MenuItem,
					{
						key: spec.key,
						onClick: spec.onClick,
						disabled: spec.disabled,
						leadingIcon: spec.icon ? Icon(spec.icon, 16) : undefined,
						divider: spec.dividerAfter ? "after" : undefined,
					},
					spec.label,
				);
	return h(RC.Menu, null, items.map(render));
}

function useAlbum(song: Song): string | null {
	const [album, setAlbum] = useState<string | null>(() => song.album ?? api()?.albums.get(song.id) ?? null);

	useEffect(() => {
		const jv = api();
		if (!jv || song.album) return;
		const current = jv.albums.get(song.id);
		if (current) return setAlbum(current);
		if (getDeviceSettings().albumMode !== "real") return;
		const stop = jv.albums.on((ids) => {
			if (ids.includes(song.id)) setAlbum(jv.albums.get(song.id));
		});
		void jv.albums.request([song.id]);
		return stop;
	}, [song.id]);

	return song.album ?? album;
}

export function TrackRow(props: TrackRowProps): any {
	if (!props.standaloneMenu || !nativeMenusAvailable()) return h(Row, props);
	return h(NativeFallback(), { fallback: () => h(Row, props) }, h(Row, { ...props, standaloneMenu: false }));
}

function Row({ song, position, playing, onPlay, playlists, detail, standaloneMenu }: TrackRowProps): any {
	const [menuAt, setMenuAt] = useState<MenuPosition | null>(null);
	const [panelAt, setPanelAt] = useState<MenuPosition | null>(null);
	const RC = native();
	const album = useAlbum(song);
	const known = api()?.catalog.get(song.id) ?? song;
	const display = getDeviceSettings();
	const tag = display.showTags ? songTag(known) : null;
	const kind = songKind(known);
	const items = menuSpec(song, playlists, standaloneMenu ? () => setPanelAt(menuAt) : undefined);
	const menu = !standaloneMenu && RC.TrackMenu ? h(RC.TrackMenu, { uri: uriForSong(song) }) : nativeMenu(items);

	const dots = h(
		"button",
		{
			className: "jv-dots",
			title: "More options",
			"data-jv-menu-trigger": standaloneMenu ? "true" : undefined,
			onClick: (event: any) => {
				event.stopPropagation();
				if (!standaloneMenu) return;
				const rect = event.currentTarget.getBoundingClientRect();
				setMenuAt(menuAt ? null : { x: rect.right - 240, y: rect.bottom + 4 });
			},
		},
		Icon("more", 16),
	);

	const row = h(
		"div",
		{
			className: "jv-row",
			"data-playing": String(playing),
			"data-menu": String(Boolean(menuAt || panelAt)),
			onDoubleClick: onPlay,
			onContextMenu: standaloneMenu
				? (event: any) => {
						event.preventDefault();
						setMenuAt({ x: event.clientX, y: event.clientY });
					}
				: undefined,
		},
		h(
			"div",
			null,
			h("div", { className: "jv-num" }, position),
			h("button", { className: "jv-play", onClick: onPlay, title: "Play" }, Icon("play", 14)),
		),
		h(
			"div",
			{ className: "jv-cell" },
			h("img", { className: "jv-art", src: song.coverUrl, loading: "lazy", alt: "" }),
			h(
				"div",
				{ className: "jv-meta" },
				h("p", { className: "jv-name" }, song.title, tag ? h("span", { className: "jv-tag", "data-kind": kind, "data-colored": String(display.coloredTags) }, tag) : null),
				h("p", { className: "jv-artist" }, song.artist),
			),
		),
		h("div", { className: "jv-album" }, detail ?? albumName(album)),
		h(
			"div",
			{ className: "jv-end" },
			h("span", { className: "jv-time" }, song.length),
			standaloneMenu ? dots : h(RC.ContextMenu, { menu, trigger: "click", action: "toggle" }, dots),
		),
	);

	if (standaloneMenu) {
		return h(
			"div",
			null,
			row,
			h(StandaloneMenu, { items, position: menuAt, onClose: () => setMenuAt(null) }),
			h(AddToPlaylistPanel, { songId: song.id, position: panelAt, onClose: () => setPanelAt(null) }),
		);
	}

	return h(RC.ContextMenu, { menu, trigger: "right-click" }, row);
}

export function TrackHeader(secondLabel = "Album"): any {
	return h(
		"div",
		{ className: "jv-head" },
		h("div", { style: { textAlign: "right" } }, "#"),
		h("div", null, "Title"),
		h("div", null, secondLabel),
		h("div", { style: { textAlign: "right", paddingRight: 32 } }, Icon("clock", 16)),
	);
}
