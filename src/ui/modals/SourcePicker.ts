import type { JvPlaylist } from "../../core/api/playlists";
import { describeError } from "../../core/http/errors";
import type { Destination, SyncApi } from "../../integration/PlaylistSync";
import { h, notify, useEffect, useState } from "../h";
import { closeModal } from "../modal";
import { PlaylistCover } from "../components/PlaylistCover";

export type PickerMode = "import" | "sync";

function subtitle(playlist: JvPlaylist, mode: PickerMode): string {
	if (playlist.kind === "unheard") return mode === "sync" ? "Syncs only as its own playlist • use the Unheard page" : "Archive songs you haven't finished";
	if (playlist.kind === "liked") return `Liked songs • ${playlist.songCount.toLocaleString()} songs`;
	return `${playlist.isCollaborator ? "Collaborative" : playlist.isPublic ? "Public" : "Private"} • ${playlist.songCount.toLocaleString()} songs`;
}

export function SourcePicker({ sync, mode, destination }: { sync: SyncApi; mode: PickerMode; destination: Destination }): any {
	const [playlists, setPlaylists] = useState<JvPlaylist[] | null>(null);
	const [busy, setBusy] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);
	const current = sync.linkFor(destination.uri);

	useEffect(() => {
		let cancelled = false;
		void sync
			.list()
			.then((list) => {
				if (!cancelled) setPlaylists(list);
			})
			.catch((failure) => {
				if (!cancelled) setError(describeError(failure, "Could not load your JuiceVault playlists."));
			});
		return () => {
			cancelled = true;
		};
	}, []);

	const choose = async (playlist: JvPlaylist): Promise<void> => {
		if (busy) return;
		setBusy(playlist.id);
		setError(null);
		try {
			if (mode === "import") {
				const added = await sync.importInto(destination.uri, playlist.id);
				notify(added ? `Added ${added} songs from “${playlist.name}”` : "Everything was already in this playlist");
			} else {
				await sync.syncWith(destination.uri, playlist.id, destination.name);
				notify(`“${destination.name}” is now synced with “${playlist.name}”`);
			}
			closeModal();
		} catch (failure) {
			setError(describeError(failure, "That didn't work."));
		} finally {
			setBusy(null);
		}
	};

	const intro =
		mode === "import"
			? `Copy a JuiceVault playlist into “${destination.name}” once. Later changes won't carry over.`
			: `Keep “${destination.name}” and a JuiceVault playlist in step. Adding or removing JuiceVault songs on either side updates the other. Spotify songs stay in Spotify.`;

	return h(
		"div",
		{ className: "jv-modal" },
		h("p", { className: "jv-modal-intro" }, intro),
		mode === "sync" && current ? h("p", { className: "jv-modal-note" }, `Currently synced with “${current.jvName || current.name}”. Picking another playlist replaces it.`) : null,
		error ? h("div", { className: "jv-login-error" }, error) : null,
		playlists === null
			? h("div", { className: "jv-empty" }, error ? "" : "Loading…")
			: h(
					"div",
					{ className: "jv-modal-list" },
					playlists.map((playlist) =>
						h(
							"button",
							{
								key: playlist.id,
								className: "jv-modal-row",
								disabled: Boolean(busy) || (mode === "sync" && playlist.kind === "unheard"),
								"data-current": String(current?.jvId === playlist.id),
								onClick: () => void choose(playlist),
							},
							PlaylistCover(playlist, 48),
							h(
								"span",
								{ className: "jv-modal-row-text" },
								h("span", { className: "jv-pl-name" }, playlist.name),
								h("span", { className: "jv-pl-sub" }, subtitle(playlist, mode)),
							),
							busy === playlist.id
								? h("span", { className: "jv-modal-row-state" }, mode === "import" ? "Importing…" : "Syncing…")
								: current?.jvId === playlist.id
									? h("span", { className: "jv-pill jv-pill--ok" }, "Synced")
									: null,
						),
					),
				),
	);
}
