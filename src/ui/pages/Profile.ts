import type { Profile as ProfileData } from "../../core/auth/session";
import type { ListeningActivity, ListeningStats } from "../../core/api/account";
import { assetUrl } from "../../core/config";
import { toSong, type Song } from "../../core/models/song";
import type { JuiceVaultApi } from "../bridge";
import { h, useEffect, useMemo, useState } from "../h";
import { useNowPlaying, usePlaylists } from "../hooks";
import { navigate } from "../router";
import { Avatar, Button } from "../components/controls";
import { TrackHeader, TrackRow } from "../components/TrackRow";

const TOP_PREVIEW = 10;

function formatDuration(seconds: number | undefined): string {
	const total = Math.max(0, Math.round(seconds ?? 0));
	const hours = Math.floor(total / 3600);
	if (hours >= 1) return `${hours.toLocaleString()} hr`;
	return `${Math.floor(total / 60).toLocaleString()} min`;
}

function memberSince(createdAt: string | undefined): string | null {
	if (!createdAt) return null;
	const date = new Date(createdAt);
	if (Number.isNaN(date.getTime())) return null;
	return date.toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

function plural(count: number, word: string): string {
	return `${count.toLocaleString()} ${word}${count === 1 ? "" : "s"}`;
}

function Stat(value: string, label: string, progress?: number): any {
	return h(
		"div",
		{ className: "jv-stat" },
		h("div", { className: "jv-stat-value" }, value),
		h("div", { className: "jv-stat-label" }, label),
		typeof progress === "number"
			? h(
					"div",
					{ className: "jv-progress" },
					h("div", { className: "jv-progress-fill", style: { width: `${Math.max(0, Math.min(100, progress))}%` } }),
				)
			: null,
	);
}

export function Profile({ jv, profile }: { jv: JuiceVaultApi | null; profile: ProfileData }): any {
	const [stats, setStats] = useState<ListeningStats | null>(null);
	const [activity, setActivity] = useState<ListeningActivity | null>(null);
	const [expanded, setExpanded] = useState(false);
	const nowPlaying = useNowPlaying();
	const playlists = usePlaylists(jv);

	useEffect(() => {
		if (!jv) return;
		let cancelled = false;
		void jv.session.loadProfile();
		void jv.account
			.stats()
			.then((result) => {
				if (!cancelled) setStats(result);
			})
			.catch(() => undefined);
		void jv.account
			.activity()
			.then((result) => {
				if (!cancelled) setActivity(result);
			})
			.catch(() => undefined);
		return () => {
			cancelled = true;
		};
	}, [jv]);

	const topSongs = useMemo(() => {
		const songs: Array<{ song: Song; count: number }> = [];
		for (const entry of stats?.topSongs ?? []) {
			const song = jv?.catalog.get(entry.songId) ?? toSong(entry.song);
			if (song) songs.push({ song, count: entry.count });
		}
		return songs;
	}, [stats, jv]);

	const name = profile.displayName || profile.username;
	const listening = profile.listening ?? {};
	const archive = listening.archive ?? {};
	const streak = listening.streak ?? {};
	const liked = profile.stats?.likedCount ?? 0;
	const playlistCount = profile.stats?.playlistCount ?? 0;
	const since = memberSince(profile.createdAt);
	const completion = archive.completionRate ?? stats?.stats.completionRate ?? 0;
	const heard = archive.completedSongs ?? stats?.stats.uniqueSongs ?? listening.uniqueSongs ?? 0;

	const shown = expanded ? topSongs : topSongs.slice(0, TOP_PREVIEW);
	const queue = topSongs.map((entry) => entry.song);

	const facts = [`@${profile.username}`, plural(liked, "liked song"), plural(playlistCount, "playlist")];
	if (since) facts.push(`Joined ${since}`);

	return h(
		"div",
		null,
		h(
			"div",
			{ className: "jv-hero" },
			h("div", { className: "jv-profile-avatar" }, Avatar(assetUrl(profile.avatar), name, 232)),
			h(
				"div",
				{ className: "jv-headtext" },
				h("p", { className: "jv-eyebrow" }, "Profile"),
				h("h1", null, name),
				h("p", { className: "jv-sub" }, facts.join(" • ")),
			),
		),
		h(
			"div",
			{ className: "jv-actions" },
			Button("secondary", "Edit profile", { onClick: () => navigate("settings") }),
		),
		profile.bio ? h("p", { className: "jv-bio" }, profile.bio) : null,
		h(
			"section",
			{ className: "jv-section" },
			h(
				"div",
				{ className: "jv-section-head" },
				h("h2", { className: "jv-h2" }, "Listening"),
				h("button", { className: "jv-link", onClick: () => navigate("stats") }, "See your stats"),
			),
			h(
				"div",
				{ className: "jv-stats" },
				Stat((listening.totalListens ?? stats?.stats.totalListens ?? 0).toLocaleString(), "Listens"),
				Stat(formatDuration(listening.totalDuration ?? stats?.stats.totalDuration), "Time listened"),
				Stat(
					`${Math.round(completion)}%`,
					archive.totalSongs
						? `${(archive.completedSongs ?? 0).toLocaleString()} of ${archive.totalSongs.toLocaleString()} archive songs heard`
						: `of the archive heard${heard ? ` \u2022 ${heard.toLocaleString()} songs` : ""}`,
					completion,
				),
				Stat(plural(activity?.currentStreak ?? streak.current ?? 0, "day"), "Current streak"),
				Stat(plural(activity?.longestStreak ?? streak.longest ?? 0, "day"), "Longest streak"),
			),
		),
		h(
			"section",
			{ className: "jv-section" },
			h(
				"div",
				{ className: "jv-section-head" },
				h("div", null, h("h2", { className: "jv-h2" }, "Top tracks"), h("p", { className: "jv-section-sub" }, "Only visible to you")),
				topSongs.length > TOP_PREVIEW
					? h("button", { className: "jv-link", onClick: () => setExpanded(!expanded) }, expanded ? "Show less" : "Show all")
					: null,
			),
			stats === null
				? h("div", { className: "jv-empty" }, "Loading…")
				: topSongs.length
					? h(
							"div",
							{ className: "jv-list jv-list--flush" },
							TrackHeader("Plays"),
							shown.map((entry, index) =>
								h(TrackRow, {
									key: entry.song.id,
									song: entry.song,
									position: index + 1,
									playing: nowPlaying === entry.song.id,
									onPlay: () => jv?.playList(queue, index, "Your top tracks"),
									playlists,
									detail: plural(entry.count, "play"),
								}),
							),
						)
					: h("div", { className: "jv-empty" }, "Nothing here yet — play something from the vault."),
		),
	);
}
