import type { Song, SongCategory } from "../../core/models/song";
import { albumName } from "../../core/settings/device";
import { api } from "../bridge";
import { h, native, notify, useState } from "../h";
import { Icon } from "../icons";
import { StandaloneMenu, type MenuPosition, type MenuSpec } from "./StandaloneMenu";

declare const Spicetify: any;

const TAGS: Partial<Record<SongCategory, string>> = {
	instrumental: "inst",
	remaster: "remaster",
	stem: "stem",
	released: "released",
	cut: "cut",
};

export interface TrackRowProps {
	song: Song;
	position: number;
	playing: boolean;
	onPlay: () => void;
	playlists: Array<{ uri: string; name: string }>;
	detail?: string;
	standaloneMenu?: boolean;
}

function menuSpec(song: Song, playlists: Array<{ uri: string; name: string }>): MenuSpec[] {
	const run = async (task: () => Promise<unknown>, done: string, failed: string): Promise<void> => {
		try {
			await task();
			notify(done);
		} catch {
			notify(failed, true);
		}
	};

	return [
		{
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
					onClick: () => void run(() => api()!.newPlaylistWith(song.id), `Added to a new playlist`, "Could not create the playlist"),
				},
				...playlists.map((playlist) => ({
					key: playlist.uri,
					label: playlist.name,
					onClick: () => void run(() => api()!.addToPlaylist(playlist.uri, song.id), `Added to \u201c${playlist.name}\u201d`, "Could not add to that playlist"),
				})),
			],
		},
		{
			key: "like",
			label: "Save to your Liked Songs",
			icon: "heart",
			dividerAfter: true,
			onClick: () => void run(() => api()!.saveToLiked(song.id), "Added to Liked Songs", "Spotify wouldn't add this to Liked Songs"),
		},
		{
			key: "copy",
			label: "Copy song name",
			icon: "copy",
			onClick: () => {
				Spicetify.Platform.ClipboardAPI.copy(`${song.title} \u2014 ${song.artist}`);
				notify("Copied");
			},
		},
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

export function TrackRow({ song, position, playing, onPlay, playlists, detail, standaloneMenu }: TrackRowProps): any {
	const [menuAt, setMenuAt] = useState<MenuPosition | null>(null);
	const RC = native();
	const tag = TAGS[song.category];
	const items = menuSpec(song, playlists);

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
			"data-menu": String(Boolean(menuAt)),
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
				h("p", { className: "jv-name" }, song.title, tag ? h("span", { className: "jv-tag" }, tag) : null),
				h("p", { className: "jv-artist" }, song.artist),
			),
		),
		h("div", { className: "jv-album" }, detail ?? albumName(song.album)),
		h(
			"div",
			{ className: "jv-end" },
			h("span", { className: "jv-time" }, song.length),
			standaloneMenu ? dots : h(RC.ContextMenu, { menu: nativeMenu(items), trigger: "click", action: "toggle" }, dots),
		),
	);

	if (standaloneMenu) {
		return h("div", null, row, h(StandaloneMenu, { items, position: menuAt, onClose: () => setMenuAt(null) }));
	}

	return h(RC.ContextMenu, { menu: nativeMenu(items), trigger: "right-click" }, row);
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
