import type { JvPlaylist } from "../../core/api/playlists";
import { describeError } from "../../core/http/errors";
import { isLikedUri, type Destination, type SyncApi } from "../../integration/PlaylistSync";
import { h, notify, useEffect, useState } from "../h";
import { Icon } from "../icons";
import { closeModal } from "../modal";
import type { PickerMode } from "./SourcePicker";

const NEW = "new";
const SEARCH_FROM = 8;

function Cover({ target }: { target: Destination | null }): any {
	if (!target) return h("span", { className: "jv-atp-cover jv-dp-cover" }, Icon("plus", 20));
	if (isLikedUri(target.uri)) return h("span", { className: "jv-atp-cover jv-atp-cover--liked jv-dp-cover" }, Icon("heart-active", 18));
	if (target.image) return h("img", { className: "jv-atp-cover jv-dp-cover", src: target.image, alt: "" });
	return h("span", { className: "jv-atp-cover jv-dp-cover" }, Icon("playlist", 20));
}

export function DestinationPicker({
	sync,
	mode,
	playlist,
	onDone,
}: {
	sync: SyncApi;
	mode: PickerMode;
	playlist: JvPlaylist;
	onDone: (spotifyUri: string | null) => void;
}): any {
	const [targets, setTargets] = useState<Destination[] | null>(null);
	const [filter, setFilter] = useState("");
	const [busy, setBusy] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);
	const synced = new Set(sync.links().map((link) => link.spotifyUri));
	const onlyNew = mode === "sync" && playlist.kind === "unheard";

	useEffect(() => {
		let cancelled = false;
		void sync
			.destinations()
			.then((list) => {
				if (!cancelled) setTargets(list);
			})
			.catch((failure) => {
				if (!cancelled) setError(describeError(failure, "Could not load your Spotify playlists."));
			});
		return () => {
			cancelled = true;
		};
	}, []);

	const choose = async (target: Destination | null): Promise<void> => {
		if (busy) return;
		setBusy(target?.uri ?? NEW);
		setError(null);
		try {
			if (!target) {
				const uri = mode === "import" ? await sync.importNew(playlist.id, playlist) : await sync.syncNew(playlist.id, playlist);
				notify(mode === "import" ? `Imported “${playlist.name}” into your library` : `“${playlist.name}” is now synced to your library`);
				closeModal();
				onDone(uri);
				return;
			}
			if (mode === "import") {
				const added = await sync.importInto(target.uri, playlist.id);
				notify(added ? `Added ${added} songs to “${target.name}”` : `“${target.name}” already has them all`);
			} else {
				await sync.syncWith(target.uri, playlist.id, target.name);
				notify(`“${target.name}” is now synced with “${playlist.name}”`);
			}
			closeModal();
			onDone(null);
		} catch (failure) {
			setError(describeError(failure, "That didn't work."));
			setBusy(null);
		}
	};

	const needle = filter.trim().toLowerCase();
	const visible = (targets ?? []).filter((target) => !needle || target.name.toLowerCase().includes(needle));
	const working = mode === "import" ? "Importing…" : "Syncing…";

	const row = (target: Destination | null): any => {
		const key = target?.uri ?? NEW;
		const taken = mode === "sync" && target !== null && synced.has(target.uri);
		return h(
			"button",
			{ key, className: "jv-modal-row", disabled: Boolean(busy) || taken, onClick: () => void choose(target) },
			h(Cover, { target }),
			h(
				"span",
				{ className: "jv-modal-row-text" },
				h("span", { className: "jv-pl-name" }, target ? target.name : "New playlist"),
				h(
					"span",
					{ className: "jv-pl-sub" },
					target ? (isLikedUri(target.uri) ? "Your Liked Songs" : "Your playlist") : `Creates “${playlist.name}” in your library`,
				),
			),
			busy === key ? h("span", { className: "jv-modal-row-state" }, working) : taken ? h("span", { className: "jv-pill" }, "Already synced") : null,
		);
	};

	const intro =
		mode === "import"
			? `Copy the songs from “${playlist.name}” into a Spotify playlist. This happens once, later changes won't carry over.`
			: `Keep “${playlist.name}” in step with a Spotify playlist. Adding or removing JuiceVault songs on either side updates the other. Spotify songs stay in Spotify.`;

	return h(
		"div",
		{ className: "jv-modal jv-dp" },
		h("p", { className: "jv-modal-intro" }, intro),
		onlyNew ? h("p", { className: "jv-modal-note" }, "Unheard can only sync to its own new playlist, so your other playlists are never touched.") : null,
		error ? h("div", { className: "jv-login-error" }, error) : null,
		!onlyNew && (targets?.length ?? 0) >= SEARCH_FROM
			? h(
					"div",
					{ className: "jv-mi-search jv-dp-search" },
					Icon("search", 16),
					h("input", { placeholder: "Find a playlist", value: filter, spellCheck: false, onChange: (event: any) => setFilter(event.target.value) }),
				)
			: null,
		h(
			"div",
			{ className: "jv-modal-list" },
			row(null),
			onlyNew
				? null
				: targets === null
					? h("div", { className: "jv-empty jv-dp-empty" }, error ? "" : "Loading your playlists…")
					: visible.length
						? visible.map(row)
						: h("div", { className: "jv-empty jv-dp-empty" }, needle ? "No matches" : "You don't have any playlists you can edit."),
		),
	);
}
