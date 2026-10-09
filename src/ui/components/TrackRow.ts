import { alternateNames, songKind, songTag, type Song } from "../../core/models/song";
import { albumName, getDeviceSettings } from "../../core/settings/device";
import { api } from "../bridge";
import { h, notify, useEffect, useState } from "../h";
import { Icon } from "../icons";
import { StandaloneMenu, type MenuPosition, type MenuSpec } from "./StandaloneMenu";
import { AddToPlaylistPanel } from "./AddToPlaylistPanel";
import { uriForSong } from "../../integration/uri";

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
			key: "queue",
			label: "Add to queue",
			icon: "queue",
			onClick: () =>
				void run(async () => {
					await Spicetify.Platform.PlayerAPI.addToQueue([{ uri: uriForSong(song), uid: null }]);
				}, "Couldn't add this to the queue"),
		},
		{
			key: "like",
			label: "Save to your Liked Songs",
			icon: "heart",
			dividerAfter: true,
			onClick: () => void run(() => api()!.saveToLiked(song.id), "Spotify wouldn't add this to Liked Songs"),
		},
		{
			key: "info",
			label: "Song info",
			icon: "info",
			onClick: () => api()?.showSongInfo(song.id),
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
	return h(Row, { ...props, standaloneMenu: true });
}

function Row({ song, position, playing, onPlay, playlists, detail, standaloneMenu }: TrackRowProps): any {
	const [menuAt, setMenuAt] = useState<MenuPosition | null>(null);
	const [panelAt, setPanelAt] = useState<MenuPosition | null>(null);
	const album = useAlbum(song);
	const known = api()?.catalog.get(song.id) ?? song;
	const display = getDeviceSettings();
	const tag = display.showTags ? songTag(known) : null;
	const others = display.showAltNames ? alternateNames(known, song.title) : [];
	const kind = songKind(known);
	const items = menuSpec(song, playlists, standaloneMenu ? () => setPanelAt(menuAt) : undefined);

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
				h("p", { className: "jv-name" }, song.title, tag ? h("span", { className: "jv-tag", "data-kind": kind, "data-colored": String(display.coloredTags) }, tag) : null,
					...others.slice(0, 1).map((name) => h("span", { key: name, className: "jv-tag jv-tag--alt", title: others.join(", ") }, name)),
					others.length > 1 ? h("span", { className: "jv-tag jv-tag--alt", title: others.join(", ") }, `+${others.length - 1}`) : null),
				h("p", { className: "jv-artist" }, song.artist),
			),
		),
		h("div", { className: "jv-album" }, detail ?? albumName(album)),
		h(
			"div",
			{ className: "jv-end" },
			h("span", { className: "jv-time" }, song.length),
			dots,
		),
	);

	return h(
		"div",
		null,
		row,
		h(StandaloneMenu, { items, position: menuAt, onClose: () => setMenuAt(null) }),
		h(AddToPlaylistPanel, { songId: song.id, position: panelAt, onClose: () => setPanelAt(null) }),
	);


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
