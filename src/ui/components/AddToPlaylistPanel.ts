import type { CurationTarget } from "../../integration/curation";
import { api } from "../bridge";
import { h, notify, useEffect, useState } from "../h";
import { Icon } from "../icons";
import { overlayLayer, type MenuPosition } from "./StandaloneMenu";

declare const Spicetify: any;

const WIDTH = 320;
const HEIGHT = 480;
const LIKED_URI = "spotify:collection:tracks";

function place(position: MenuPosition): MenuPosition {
	return {
		x: Math.max(8, Math.min(position.x, window.innerWidth - WIDTH - 8)),
		y: Math.max(8, Math.min(position.y, window.innerHeight - HEIGHT - 8)),
	};
}

function Cover({ target }: { target: CurationTarget }): any {
	if (target.uri === LIKED_URI) return h("span", { className: "jv-atp-cover jv-atp-cover--liked" }, Icon("heart-active", 14));
	if (target.image) return h("img", { className: "jv-atp-cover", src: target.image, alt: "" });
	return h("span", { className: "jv-atp-cover" }, Icon("playlist", 16));
}

function Panel({ songId, position, onClose }: { songId: string; position: MenuPosition; onClose: () => void }): any {
	const [targets, setTargets] = useState<CurationTarget[] | null>(null);
	const [picked, setPicked] = useState<Record<string, boolean>>({});
	const [filter, setFilter] = useState("");
	const [saving, setSaving] = useState(false);

	useEffect(() => {
		let cancelled = false;
		api()
			?.curation.targets(songId)
			.then((list) => {
				if (cancelled) return;
				setTargets(list);
				setPicked(Object.fromEntries(list.map((target) => [target.uri, target.curated])));
			})
			.catch(() => {
				if (!cancelled) setTargets([]);
			});
		return () => {
			cancelled = true;
		};
	}, [songId]);

	const changes = (targets ?? []).filter((target) => picked[target.uri] !== target.curated);

	const done = async (): Promise<void> => {
		const jv = api();
		if (!jv || saving) return;
		if (!changes.length) return onClose();
		setSaving(true);
		try {
			await jv.curation.apply(
				songId,
				changes.filter((target) => picked[target.uri]).map((target) => target.uri),
				changes.filter((target) => !picked[target.uri]).map((target) => target.uri),
			);
			onClose();
		} catch {
			notify("Spotify couldn't update your playlists", true);
			setSaving(false);
		}
	};

	const create = async (): Promise<void> => {
		const jv = api();
		if (!jv) return;
		onClose();
		try {
			await jv.newPlaylistWith(songId);
		} catch {
			notify("Could not create the playlist", true);
		}
	};

	const needle = filter.trim().toLowerCase();
	const visible = (targets ?? []).filter((target) => !needle || target.name.toLowerCase().includes(needle));
	const at = place(position);

	return h(
		"div",
		{
			className: "jv-atp",
			role: "dialog",
			"aria-label": "Add to playlist",
			style: { left: at.x, top: at.y, width: WIDTH, maxHeight: HEIGHT },
			onClick: (event: any) => event.stopPropagation(),
			onContextMenu: (event: any) => event.preventDefault(),
		},
		h("p", { className: "jv-atp-title" }, "Add to playlist"),
		h(
			"div",
			{ className: "jv-mi-search jv-atp-search" },
			Icon("search", 16),
			h("input", { placeholder: "Find a playlist", value: filter, autoFocus: true, spellCheck: false, onChange: (event: any) => setFilter(event.target.value) }),
		),
		h(
			"button",
			{ className: "jv-atp-new", onClick: () => void create() },
			h("span", { className: "jv-atp-cover jv-atp-cover--new" }, Icon("plus", 16)),
			h("span", null, "New playlist"),
		),
		h(
			"ul",
			{ className: "jv-atp-list", role: "listbox", "aria-multiselectable": "true" },
			targets === null
				? h("li", { className: "jv-mi-empty" }, "Loading…")
				: !visible.length
					? h("li", { className: "jv-mi-empty" }, "No matches")
					: visible.map((target) =>
							h(
								"li",
								{ key: target.uri },
								h(
									"button",
									{
										className: "jv-atp-row",
										role: "option",
										"aria-selected": String(Boolean(picked[target.uri])),
										onClick: () => setPicked({ ...picked, [target.uri]: !picked[target.uri] }),
									},
									h(Cover, { target }),
									h(
										"span",
										{ className: "jv-atp-text" },
										h("span", { className: "jv-atp-name" }, target.name),
										target.count !== null ? h("span", { className: "jv-atp-count" }, `${target.count} ${target.count === 1 ? "song" : "songs"}`) : null,
									),
									h("span", { className: "jv-atp-check", "data-checked": String(Boolean(picked[target.uri])) }, picked[target.uri] ? Icon("check", 12) : null),
								),
							),
						),
		),
		h(
			"div",
			{ className: "jv-atp-actions" },
			h("button", { className: "jv-atp-cancel", onClick: onClose }, "Cancel"),
			h("button", { className: "jv-atp-done", disabled: saving || targets === null, onClick: () => void done() }, "Done"),
		),
	);
}

export function AddToPlaylistPanel({ songId, position, onClose }: { songId: string; position: MenuPosition | null; onClose: () => void }): any {
	useEffect(() => {
		if (!position) return;
		const press = (event: PointerEvent): void => {
			if (!(event.target instanceof Element && event.target.closest(".jv-atp"))) onClose();
		};
		const key = (event: KeyboardEvent): void => {
			if (event.key === "Escape") onClose();
		};
		window.addEventListener("pointerdown", press, true);
		window.addEventListener("keydown", key);
		window.addEventListener("resize", onClose);
		return () => {
			window.removeEventListener("pointerdown", press, true);
			window.removeEventListener("keydown", key);
			window.removeEventListener("resize", onClose);
		};
	}, [position]);

	if (!position) return null;
	return Spicetify.ReactDOM.createPortal(h(Panel, { songId, position, onClose }), overlayLayer());
}
