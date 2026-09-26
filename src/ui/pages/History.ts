import type { HistoryEntry } from "../../core/api/history";
import { describeError } from "../../core/http/errors";
import type { JuiceVaultApi } from "../bridge";
import { h, useEffect, useState } from "../h";
import { useNowPlaying, usePlaylists } from "../hooks";
import { TrackRow } from "../components/TrackRow";

const PAGE = 50;

function dayLabel(iso: string): string {
	const date = new Date(iso);
	if (Number.isNaN(date.getTime())) return "Earlier";
	const today = new Date();
	today.setHours(0, 0, 0, 0);
	const day = new Date(date);
	day.setHours(0, 0, 0, 0);
	const diff = Math.round((today.getTime() - day.getTime()) / 86400000);
	if (diff === 0) return "Today";
	if (diff === 1) return "Yesterday";
	if (diff < 7) return date.toLocaleDateString(undefined, { weekday: "long" });
	return date.toLocaleDateString(undefined, { month: "long", day: "numeric", year: today.getFullYear() === date.getFullYear() ? undefined : "numeric" });
}

function detail(entry: HistoryEntry): string {
	const time = new Date(entry.listenedAt);
	const clock = Number.isNaN(time.getTime()) ? "" : time.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
	const minutes = Math.floor(entry.duration / 60);
	const seconds = Math.round(entry.duration % 60);
	const heard = `${minutes}:${String(seconds).padStart(2, "0")} heard`;
	return [clock, entry.completed ? "Finished" : heard].filter(Boolean).join(" • ");
}

export function History({ jv }: { jv: JuiceVaultApi | null }): any {
	const [entries, setEntries] = useState<HistoryEntry[] | null>(null);
	const [total, setTotal] = useState(0);
	const [loadingMore, setLoadingMore] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const nowPlaying = useNowPlaying();
	const playlists = usePlaylists(jv);

	const load = async (offset: number): Promise<void> => {
		if (!jv) return;
		try {
			const page = await jv.history.list(PAGE, offset);
			setTotal(page.total);
			setEntries((current) => (offset === 0 ? page.entries : [...(current ?? []), ...page.entries]));
		} catch (failure) {
			setError(describeError(failure, "Could not load your history."));
		}
	};

	useEffect(() => {
		void load(0);
		if (!jv) return;
		return jv.onListenCompleted(() => void load(0));
	}, [jv]);

	const loadMore = async (): Promise<void> => {
		if (!entries || loadingMore) return;
		setLoadingMore(true);
		await load(entries.length);
		setLoadingMore(false);
	};

	const queue = (entries ?? []).map((entry) => entry.song);
	const groups: Array<{ label: string; items: Array<{ entry: HistoryEntry; index: number }> }> = [];
	(entries ?? []).forEach((entry, index) => {
		const label = dayLabel(entry.listenedAt);
		const last = groups[groups.length - 1];
		if (last && last.label === label) last.items.push({ entry, index });
		else groups.push({ label, items: [{ entry, index }] });
	});

	return h(
		"div",
		{ className: "jv-settings jv-page" },
		h("h1", null, "Recently played"),
		h("p", { className: "jv-page-sub" }, total ? `${total.toLocaleString()} listens` : ""),
		error
			? h("div", { className: "jv-empty" }, error)
			: entries === null
				? h("div", { className: "jv-empty" }, "Loading…")
				: !entries.length
					? h("div", { className: "jv-empty" }, "Nothing yet. Songs you play from JuiceVault show up here.")
					: h(
							"div",
							null,
							groups.map((group) =>
								h(
									"section",
									{ key: `${group.label}-${group.items[0]!.index}`, className: "jv-history-day" },
									h("h2", { className: "jv-history-label" }, group.label),
									h(
										"div",
										{ className: "jv-list jv-list--flush" },
										group.items.map(({ entry, index }) =>
											h(TrackRow, {
												key: entry.id,
												song: entry.song,
												position: index + 1,
												playing: nowPlaying === entry.song.id,
												onPlay: () => jv?.playList(queue, index, "Recently played"),
												playlists,
												detail: detail(entry),
											}),
										),
									),
								),
							),
							entries.length < total
								? h("button", { className: "jv-more", disabled: loadingMore, onClick: () => void loadMore() }, loadingMore ? "Loading…" : "Show more")
								: null,
						),
	);
}
