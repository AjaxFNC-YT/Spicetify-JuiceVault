import type { Song, SongCategory } from "../../core/models/song";
import { api } from "../bridge";
import { h, native, notify } from "../h";
import { Icon } from "../icons";

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
}

function trackMenu(song: Song, playlists: Array<{ uri: string; name: string }>, onPlay: () => void): any {
	const RC = native();

	const add = async (playlistUri: string): Promise<void> => {
		try {
			await api()?.addToPlaylist(playlistUri, song.id);
			notify("Added to playlist");
		} catch {
			notify("Could not add to that playlist", true);
		}
	};

	return h(
		RC.Menu,
		null,
		h(RC.MenuItem, { key: "play", onClick: onPlay }, "Play"),
		h(
			RC.MenuSubMenuItem,
			{ key: "add", displayText: "Add to playlist" },
			playlists.length
				? playlists.map((playlist) =>
						h(RC.MenuItem, { key: playlist.uri, onClick: () => void add(playlist.uri) }, playlist.name),
					)
				: h(RC.MenuItem, { key: "none", disabled: true }, "No editable playlists"),
		),
		h(
			RC.MenuItem,
			{
				key: "copy",
				onClick: () => {
					Spicetify.Platform.ClipboardAPI.copy(`${song.title} — ${song.artist}`);
					notify("Copied");
				},
			},
			"Copy title",
		),
	);
}

export function TrackRow({ song, position, playing, onPlay, playlists, detail }: TrackRowProps): any {
	const RC = native();
	const tag = TAGS[song.category];
	const menu = trackMenu(song, playlists, onPlay);

	const row = h(
		"div",
		{ className: "jv-row", "data-playing": String(playing), onDoubleClick: onPlay },
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
		h("div", { className: "jv-album" }, detail ?? (song.album || "JuiceVault")),
		h(
			"div",
			{ className: "jv-end" },
			h("span", { className: "jv-time" }, song.length),
			h(
				RC.ContextMenu,
				{ menu, trigger: "click", action: "toggle" },
				h(
					"button",
					{ className: "jv-dots", title: "More options", onClick: (event: any) => event.stopPropagation() },
					Icon("more", 16),
				),
			),
		),
	);

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
