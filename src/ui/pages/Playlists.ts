import type { JvPlaylist } from "../../core/api/playlists";
import { describeError } from "../../core/http/errors";
import { isLikedUri, type Destination, type PlaylistLink } from "../../integration/PlaylistSync";
import type { JuiceVaultApi } from "../bridge";
import { h, native, notify, useCallback, useEffect, useState } from "../h";
import { Icon } from "../icons";
import { Button } from "../components/controls";
import { PlaylistCover } from "../components/PlaylistCover";
import { openModal } from "../modal";
import { ConfirmUnheardSync } from "../modals/ConfirmUnheardSync";

declare const Spicetify: any;

function ago(timestamp: number | null): string {
	if (!timestamp) return "not synced yet";
	const seconds = Math.round((Date.now() - timestamp) / 1000);
	if (seconds < 60) return "just now";
	const minutes = Math.round(seconds / 60);
	if (minutes < 60) return `${minutes} min ago`;
	const hours = Math.round(minutes / 60);
	if (hours < 24) return `${hours} hr ago`;
	return `${Math.round(hours / 24)} d ago`;
}

function describe(playlist: JvPlaylist): string {
	if (playlist.kind === "liked") return `Liked songs • ${playlist.songCount.toLocaleString()} songs`;
	if (playlist.kind === "unheard") return "Archive songs you haven't finished • updates from JuiceVault only";
	const kind = playlist.isCollaborator ? "Collaborative" : playlist.isPublic ? "Public playlist" : "Private playlist";
	return `${kind} • ${playlist.songCount.toLocaleString()} songs`;
}

function open(spotifyUri: string): void {
	if (isLikedUri(spotifyUri)) {
		Spicetify.Platform.History.push("/collection/tracks");
		return;
	}
	const id = spotifyUri.split(":").pop();
	if (id) Spicetify.Platform.History.push(`/playlist/${id}`);
}

export function Playlists({ jv }: { jv: JuiceVaultApi | null }): any {
	const [playlists, setPlaylists] = useState<JvPlaylist[] | null>(null);
	const [links, setLinks] = useState<PlaylistLink[]>(jv?.sync.links() ?? []);
	const [destinations, setDestinations] = useState<Destination[]>([]);
	const [busy, setBusy] = useState<Record<string, string>>({});
	const [error, setError] = useState<string | null>(null);

	const refreshLinks = useCallback(() => setLinks(jv?.sync.links() ?? []), [jv]);

	useEffect(() => {
		if (!jv) return;
		refreshLinks();
		void jv.sync.prune().catch(() => undefined);
		return jv.sync.onLinks(setLinks);
	}, [jv]);

	useEffect(() => {
		if (!jv) return;
		let cancelled = false;
		void jv.sync
			.list()
			.then((list) => {
				if (!cancelled) setPlaylists(list);
			})
			.catch((failure) => {
				if (!cancelled) setError(describeError(failure, "Could not load your JuiceVault playlists."));
			});
		void jv.sync
			.destinations()
			.then((list) => {
				if (!cancelled) setDestinations(list);
			})
			.catch(() => undefined);
		const timer = window.setInterval(refreshLinks, 5000);
		return () => {
			cancelled = true;
			window.clearInterval(timer);
		};
	}, [jv]);

	const run = async (key: string, label: string, task: () => Promise<void>): Promise<void> => {
		setBusy((current) => ({ ...current, [key]: label }));
		try {
			await task();
		} catch (failure) {
			notify(describeError(failure, "Something went wrong"), true);
		} finally {
			setBusy((current) => {
				const next = { ...current };
				delete next[key];
				return next;
			});
			refreshLinks();
		}
	};

	const nameOf = (link: PlaylistLink): string => destinations.find((entry) => entry.uri === link.spotifyUri)?.name ?? link.name;

	const actions = {
		syncNew: (playlist: JvPlaylist) =>
			run(playlist.id, "Syncing…", async () => {
				const uri = await jv!.sync.syncNew(playlist.id, playlist);
				notify(`“${playlist.name}” is now synced to your library`);
				open(uri);
			}),
		importNew: (playlist: JvPlaylist) =>
			run(playlist.id, "Importing…", async () => {
				const uri = await jv!.sync.importNew(playlist.id, playlist);
				notify(`Imported “${playlist.name}” into your library`);
				open(uri);
			}),
		importInto: (playlist: JvPlaylist, target: Destination) =>
			run(playlist.id, "Importing…", async () => {
				const added = await jv!.sync.importInto(target.uri, playlist.id);
				notify(added ? `Added ${added} songs to “${target.name}”` : `“${target.name}” already has them all`);
			}),
		syncWith: (playlist: JvPlaylist, target: Destination) =>
			run(playlist.id, "Syncing…", async () => {
				await jv!.sync.syncWith(target.uri, playlist.id, target.name);
				notify(`“${target.name}” is now synced with “${playlist.name}”`);
			}),
		syncNow: (playlist: JvPlaylist, links: PlaylistLink[]) =>
			run(playlist.id, "Syncing…", async () => {
				for (const link of links) await jv!.sync.syncNow(link.spotifyUri, true);
				notify("Synced with JuiceVault");
			}),
	};

	const RC = native();

	const destinationMenu = (label: string, key: string, choose: (target: Destination) => void, exclude: Set<string>): any =>
		h(
			RC.MenuSubMenuItem,
			{ key, displayText: label },
			destinations.filter((target) => !exclude.has(target.uri)).length
				? destinations
						.filter((target) => !exclude.has(target.uri))
						.map((target) => h(RC.MenuItem, { key: target.uri, onClick: () => choose(target) }, target.name))
				: h(RC.MenuItem, { key: "none", disabled: true }, "No editable playlists"),
		);

	const rowFor = (playlist: JvPlaylist): any => {
		const linked = links.filter((link) => link.jvId === playlist.id);
		const syncedAnywhere = new Set(links.map((link) => link.spotifyUri));
		const pending = busy[playlist.id];
		const failing = linked.find((link) => link.error);

		const menu = h(
			RC.Menu,
			null,
			h(RC.MenuItem, { key: "import", onClick: () => void actions.importNew(playlist) }, "Import as a new playlist"),
			destinationMenu("Import into…", "into", (target) => void actions.importInto(playlist, target), new Set()),
			playlist.kind === "unheard" ? null : destinationMenu("Sync with…", "with", (target) => void actions.syncWith(playlist, target), syncedAnywhere),
			...linked.map((link) =>
				h(RC.MenuItem, { key: `open-${link.spotifyUri}`, onClick: () => open(link.spotifyUri) }, `Open “${nameOf(link)}”`),
			),
			...linked.map((link) =>
				h(
					RC.MenuItem,
					{
						key: `unlink-${link.spotifyUri}`,
						onClick: () => {
							jv?.sync.unlink(link.spotifyUri);
							refreshLinks();
							notify(`“${nameOf(link)}” will no longer sync`);
						},
					},
					`Stop syncing “${nameOf(link)}”`,
				),
			),
		);

		const status = failing
			? h("p", { className: "jv-pl-status jv-pl-status--error" }, h("span", { className: "jv-pl-dot" }), failing.error)
			: linked.length
				? h(
						"p",
						{ className: "jv-pl-status" },
						h("span", { className: "jv-pl-dot" }),
						`Synced with ${linked.map((link) => `“${nameOf(link)}”`).join(", ")} • ${ago(Math.max(...linked.map((link) => link.lastSynced ?? 0)) || null)}`,
					)
				: null;

		const primary = pending
			? Button("secondary", pending, { disabled: true })
			: linked.length
				? Button("secondary", "Sync now", { onClick: () => void actions.syncNow(playlist, linked) })
				: Button("primary", "Sync", {
						onClick: () =>
							playlist.kind === "unheard"
								? openModal("Sync Unheard to Spotify", h(ConfirmUnheardSync, { count: playlist.songCount, onConfirm: () => actions.syncNew(playlist) }))
								: void actions.syncNew(playlist),
					});

		return h(
			"div",
			{ className: "jv-pl-row", key: playlist.id },
			PlaylistCover(playlist, 64),
			h(
				"div",
				{ className: "jv-pl-meta" },
				h("p", { className: "jv-pl-name" }, playlist.name),
				h("p", { className: "jv-pl-sub" }, describe(playlist)),
				status,
			),
			h(
				"div",
				{ className: "jv-pl-actions" },
				linked.length || pending ? null : Button("secondary", "Import", { onClick: () => void actions.importNew(playlist) }),
				primary,
				h(
					RC.ContextMenu,
					{ menu, trigger: "click", action: "toggle" },
					h("button", { className: "jv-icon", title: "More options" }, Icon("more", 20)),
				),
			),
		);
	};

	return h(
		"div",
		{ className: "jv-settings jv-pl" },
		h("h1", null, "Your JuiceVault playlists"),
		h(
			"div",
			{ className: "jv-pl-explain" },
			h("p", null, h("strong", null, "Sync"), " creates a Spotify playlist that stays in step with JuiceVault. Add or remove a JuiceVault song on either side and the other follows. Spotify songs stay in Spotify."),
			h("p", null, h("strong", null, "Import"), " copies the songs once. Nothing changes on JuiceVault afterwards."),
			h("p", null, "You can also do this from any of your playlists or Liked Songs: right-click it, or use its ⋯ menu, and pick JuiceVault."),
		),
		error
			? h("div", { className: "jv-empty" }, error)
			: playlists === null
				? h("div", { className: "jv-empty" }, "Loading…")
				: playlists.length
					? h("div", { className: "jv-pl-list" }, playlists.map(rowFor))
					: h("div", { className: "jv-empty" }, "You don't have any JuiceVault playlists yet."),
	);
}
