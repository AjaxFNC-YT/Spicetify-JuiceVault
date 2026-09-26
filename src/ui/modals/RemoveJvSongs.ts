import { describeError } from "../../core/http/errors";
import type { Destination, SyncApi } from "../../integration/PlaylistSync";
import { h, notify, useEffect, useState } from "../h";
import { closeModal } from "../modal";
import { Button } from "../components/controls";

export function RemoveJvSongs({ sync, initial }: { sync: SyncApi; initial?: Destination }): any {
	const [destinations, setDestinations] = useState<Destination[] | null>(initial ? [initial] : null);
	const [selected, setSelected] = useState<Destination | null>(initial ?? null);
	const [count, setCount] = useState<number | null>(null);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		if (initial) return;
		let cancelled = false;
		void sync
			.destinations()
			.then((list) => {
				if (!cancelled) setDestinations(list);
			})
			.catch((failure) => {
				if (!cancelled) setError(describeError(failure, "Could not load your playlists."));
			});
		return () => {
			cancelled = true;
		};
	}, []);

	useEffect(() => {
		if (!selected) return;
		let cancelled = false;
		setCount(null);
		void sync
			.countJv(selected.uri)
			.then((value) => {
				if (!cancelled) setCount(value);
			})
			.catch(() => {
				if (!cancelled) setCount(0);
			});
		return () => {
			cancelled = true;
		};
	}, [selected?.uri]);

	const link = selected ? sync.linkFor(selected.uri) : null;

	const remove = async (): Promise<void> => {
		if (!selected || busy) return;
		setBusy(true);
		setError(null);
		try {
			const removed = await sync.removeAllJv(selected.uri);
			notify(`Removed ${removed} JuiceVault songs from “${selected.name}”`);
			closeModal();
		} catch (failure) {
			setError(describeError(failure, "Could not remove the songs."));
		} finally {
			setBusy(false);
		}
	};

	const label =
		count === null ? "Counting…" : count === 0 ? "No JuiceVault songs" : `Remove ${count.toLocaleString()} JuiceVault song${count === 1 ? "" : "s"}`;

	return h(
		"div",
		{ className: "jv-modal" },
		h("p", { className: "jv-modal-intro" }, "Pick a playlist. Every JuiceVault song in it will be removed. Your Spotify songs stay."),
		error ? h("div", { className: "jv-login-error" }, error) : null,
		destinations === null
			? h("div", { className: "jv-empty" }, "Loading…")
			: h(
					"div",
					{ className: "jv-modal-list jv-modal-list--short" },
					destinations.map((destination) =>
						h(
							"button",
							{
								key: destination.uri,
								className: "jv-modal-row",
								"data-selected": String(selected?.uri === destination.uri),
								onClick: () => setSelected(destination),
							},
							h("span", { className: "jv-radio", "data-on": String(selected?.uri === destination.uri) }),
							h("span", { className: "jv-modal-row-text" }, h("span", { className: "jv-pl-name" }, destination.name)),
						),
					),
				),
		link ? h("p", { className: "jv-modal-note" }, `This playlist syncs with “${link.jvName || link.name}”. Syncing will be turned off first, so nothing is removed on JuiceVault.`) : null,
		h(
			"div",
			{ className: "jv-modal-actions" },
			Button("secondary", "Cancel", { onClick: closeModal }),
			Button("primary", busy ? "Removing…" : label, {
				disabled: !selected || busy || !count,
				onClick: () => void remove(),
			}),
		),
	);
}
