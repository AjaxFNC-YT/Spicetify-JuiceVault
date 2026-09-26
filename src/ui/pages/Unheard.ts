import type { Song } from "../../core/models/song";
import { UNHEARD_ID, type JvPlaylist } from "../../core/api/playlists";
import { describeError } from "../../core/http/errors";
import type { JuiceVaultApi } from "../bridge";
import { h, notify, useEffect, useState } from "../h";
import { useNowPlaying, usePlaylists } from "../hooks";
import { Icon } from "../icons";
import { Button } from "../components/controls";
import { openModal } from "../modal";
import { ConfirmUnheardSync } from "../modals/ConfirmUnheardSync";
import { PlaylistCover } from "../components/PlaylistCover";
import { TrackHeader, TrackRow } from "../components/TrackRow";

declare const Spicetify: any;

const PAGE = 100;

const SUMMARY: JvPlaylist = {
	id: UNHEARD_ID,
	kind: "unheard",
	name: "Unheard",
	description: "",
	isPublic: false,
	coverImage: null,
	songCount: 0,
	recentSongIds: [],
	isCollaborator: false,
	readOnly: true,
};

function openPlaylist(uri: string): void {
	const id = uri.split(":").pop();
	if (id) Spicetify.Platform.History.push(`/playlist/${id}`);
}

export function Unheard({ jv }: { jv: JuiceVaultApi | null }): any {
	const [songs, setSongs] = useState<Song[] | null>(() => {
		const cached = jv?.unheardCached() ?? [];
		return cached.length ? cached : null;
	});
	const [refreshing, setRefreshing] = useState(true);
	const [visible, setVisible] = useState(PAGE);
	const [error, setError] = useState<string | null>(null);
	const [busy, setBusy] = useState(false);
	const [links, setLinks] = useState(jv?.sync.links().filter((link) => link.jvId === UNHEARD_ID) ?? []);
	const nowPlaying = useNowPlaying();
	const playlists = usePlaylists(jv);

	const refresh = async (): Promise<void> => {
		if (!jv) return;
		setRefreshing(true);
		try {
			setSongs(await jv.unheard());
			setLinks(jv.sync.links().filter((link) => link.jvId === UNHEARD_ID));
			setError(null);
		} catch (failure) {
			setError(describeError(failure, "Could not load Unheard."));
		} finally {
			setRefreshing(false);
		}
	};

	useEffect(() => {
		if (!jv) return;
		void jv.sync.prune().catch(() => undefined);
		return jv.sync.onLinks((all) => setLinks(all.filter((link) => link.jvId === UNHEARD_ID)));
	}, [jv]);

	useEffect(() => {
		void refresh();
		if (!jv) return;
		return jv.onListenCompleted((songId) => {
			setSongs((current) => (current ? current.filter((song) => song.id !== songId) : current));
			window.setTimeout(() => void refresh(), 1500);
		});
	}, [jv]);

	const play = (index: number): void => {
		if (songs?.length) jv?.playList(songs, index, "Unheard");
	};

	const sync = async (): Promise<void> => {
		if (!jv || busy) return;
		setBusy(true);
		try {
			if (links.length) {
				for (const link of links) await jv.sync.syncNow(link.spotifyUri, true);
				notify("Unheard is up to date");
			} else {
				const uri = await jv.sync.syncNew(UNHEARD_ID, SUMMARY);
				notify("Unheard is now a Spotify playlist that updates as you listen");
				openPlaylist(uri);
			}
			setLinks(jv.sync.links().filter((link) => link.jvId === UNHEARD_ID));
		} catch (failure) {
			notify(describeError(failure, "Could not sync Unheard"), true);
		} finally {
			setBusy(false);
		}
	};

	const count = songs?.length ?? 0;

	return h(
		"div",
		null,
		h(
			"div",
			{ className: "jv-hero" },
			PlaylistCover(SUMMARY, 192),
			h(
				"div",
				{ className: "jv-headtext" },
				h("p", { className: "jv-eyebrow" }, "Playlist"),
				h("h1", null, "Unheard"),
				h(
					"p",
					{ className: "jv-sub" },
					"Archive songs you haven't finished",
					h("span", null, songs ? ` • ${count.toLocaleString()} songs${refreshing ? " • updating…" : ""}` : " • loading…"),
				),
			),
		),
		h(
			"div",
			{ className: "jv-actions" },
			h("button", { className: "jv-big", title: "Play", onClick: () => play(0) }, Icon("play", 30)),
			h("button", { className: "jv-icon", title: "Shuffle", onClick: () => play(Math.floor(Math.random() * Math.max(1, count))) }, Icon("shuffle", 28)),
			h("div", { className: "jv-spacer" }),
			links.length ? h("button", { className: "jv-link", onClick: () => openPlaylist(links[0]!.spotifyUri) }, "Open in your library") : null,
			Button("secondary", busy ? "Syncing…" : links.length ? "Sync now" : "Sync to Spotify", {
				disabled: busy,
				onClick: () => {
					if (links.length) void sync();
					else openModal("Sync Unheard to Spotify", h(ConfirmUnheardSync, { count, onConfirm: sync }));
				},
			}),
		),
		links.length
			? h("p", { className: "jv-page-note" }, "Synced to your library. Songs drop off it as soon as you finish them (70% or more).")
			: null,
		error && !songs
			? h("div", { className: "jv-empty" }, error)
			: songs === null
				? h("div", { className: "jv-empty" }, "Loading…")
				: !songs.length
					? h("div", { className: "jv-empty" }, "You've heard the whole archive. Respect.")
					: h(
							"div",
							{ className: "jv-list" },
							TrackHeader(),
							songs.slice(0, visible).map((song, index) =>
								h(TrackRow, {
									key: song.id,
									song,
									position: index + 1,
									playing: nowPlaying === song.id,
									onPlay: () => play(index),
									playlists,
								}),
							),
							visible < songs.length
								? h("button", { className: "jv-more", onClick: () => setVisible(visible + PAGE) }, `Show ${Math.min(PAGE, songs.length - visible)} more`)
								: null,
						),
	);
}
