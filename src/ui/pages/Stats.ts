import type { Profile } from "../../core/auth/session";
import type { ListeningActivity } from "../../core/api/account";
import type { Leaderboard, LeaderboardRow } from "../../core/api/history";
import { assetUrl } from "../../core/config";
import type { JuiceVaultApi } from "../bridge";
import { h, useEffect, useState } from "../h";
import { Avatar } from "../components/controls";
import { Heatmap, HourlyBars } from "../components/charts";

type Board = "hours" | "plays" | "completion" | "activeStreaks" | "longestStreaks";

const BOARDS: Array<{ id: Board; label: string; unit: (row: LeaderboardRow) => string }> = [
	{ id: "hours", label: "Hours", unit: (row) => `${row.value.toLocaleString(undefined, { maximumFractionDigits: 1 })} hr` },
	{ id: "plays", label: "Plays", unit: (row) => `${row.value.toLocaleString()} plays` },
	{ id: "completion", label: "Archive", unit: (row) => `${row.value}%${row.detail ? ` • ${row.detail}` : ""}` },
	{ id: "activeStreaks", label: "Active streak", unit: (row) => `${row.value.toLocaleString()} days` },
	{ id: "longestStreaks", label: "Longest streak", unit: (row) => `${row.value.toLocaleString()} days` },
];


function Tile(value: string, label: string): any {
	return h("div", { className: "jv-stat" }, h("div", { className: "jv-stat-value" }, value), h("div", { className: "jv-stat-label" }, label));
}

export function Stats({ jv, profile }: { jv: JuiceVaultApi | null; profile: Profile }): any {
	const [activity, setActivity] = useState<ListeningActivity | null>(null);
	const [board, setBoard] = useState<Leaderboard | null>(null);
	const [tab, setTab] = useState<Board>("hours");

	useEffect(() => {
		if (!jv) return;
		let cancelled = false;
		void jv.account.activity().then((result) => !cancelled && setActivity(result)).catch(() => undefined);
		void jv.leaderboard().then((result) => !cancelled && setBoard(result)).catch(() => undefined);
		const stop = jv.onListenCompleted(() => {
			void jv.account.activity().then((result) => !cancelled && setActivity(result)).catch(() => undefined);
		});
		return () => {
			cancelled = true;
			stop();
		};
	}, [jv]);

	const listening = profile.listening ?? {};
	const hours = Math.round((listening.totalDuration ?? 0) / 360) / 10;
	const rows = board ? board[tab] : [];
	const mine = rows.find((row) => row.user.username === profile.username);
	const current = BOARDS.find((entry) => entry.id === tab)!;

	return h(
		"div",
		{ className: "jv-settings jv-page" },
		h("h1", null, "Listening stats"),
		h(
			"div",
			{ className: "jv-stats" },
			Tile((listening.totalListens ?? 0).toLocaleString(), "Listens"),
			Tile(`${hours.toLocaleString()} hr`, "Time listened"),
			Tile(`${activity?.currentStreak ?? 0}`, "Day streak"),
			Tile(`${activity?.longestStreak ?? 0}`, "Longest streak"),
			Tile(`${activity?.activeDays ?? 0}`, "Active days this year"),
			Tile(`${Math.round(activity?.avgDailyPlays ?? 0)}`, "Plays per active day"),
		),
		h(
			"section",
			{ className: "jv-section jv-section--flush" },
			h("h2", { className: "jv-h2" }, "Activity"),
			activity?.daily ? Heatmap(activity.daily) : h("div", { className: "jv-empty" }, "Loading…"),
		),
		h(
			"section",
			{ className: "jv-section jv-section--flush" },
			h("h2", { className: "jv-h2" }, "When you listen"),
			activity?.hourly ? HourlyBars(activity.hourly) : h("div", { className: "jv-empty" }, "Loading…"),
		),
		h(
			"section",
			{ className: "jv-section jv-section--flush" },
			h(
				"div",
				{ className: "jv-section-head" },
				h(
					"div",
					null,
					h("h2", { className: "jv-h2" }, "Community leaderboard"),
					h(
						"p",
						{ className: "jv-section-sub" },
						mine ? `You're #${mine.rank} of ${rows.length.toLocaleString()} • ${current.unit(mine)}` : `You're not on this board yet • ${rows.length.toLocaleString()} listed`,
					),
				),
			),
			h(
				"div",
				{ className: "jv-tabs jv-tabs--static" },
				BOARDS.map((entry) =>
					h("button", { key: entry.id, className: "jv-tab", "data-active": String(tab === entry.id), onClick: () => setTab(entry.id) }, entry.label),
				),
			),
			!board
				? h("div", { className: "jv-empty" }, "Loading…")
				: h(
						"ol",
						{ className: "jv-board" },
						rows.map((row) =>
							h(
								"li",
								{ key: `${row.rank}-${row.user.id}`, className: "jv-board-row", "data-me": String(row.user.username === profile.username) },
								h("span", { className: "jv-board-rank" }, row.rank),
								Avatar(assetUrl(row.user.avatar), row.user.displayName, 32),
								h(
									"span",
									{ className: "jv-board-name" },
									h("span", null, row.user.displayName),
									h("span", { className: "jv-board-handle" }, `@${row.user.username}`),
								),
								h("span", { className: "jv-board-value" }, current.unit(row)),
							),
						),
					),
		),
	);
}
