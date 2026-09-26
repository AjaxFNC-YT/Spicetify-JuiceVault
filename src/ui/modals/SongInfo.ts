import type { Song } from "../../core/models/song";
import { songKind, songTag } from "../../core/models/song";
import { getTrackerInfo, type TrackerInfo } from "../../core/api/songs";
import { siteUrl } from "../../core/config";
import { albumName, getDeviceSettings } from "../../core/settings/device";
import { knownAlbum } from "../../core/catalog/albums";
import { describeError } from "../../core/http/errors";
import { openInBrowser } from "../../core/auth/oauth";
import { h, useEffect, useState } from "../h";
import { closeModal } from "../modal";
import { Button } from "../components/controls";

const FIELDS: Array<{ key: keyof TrackerInfo; label: string }> = [
	{ key: "era", label: "Era" },
	{ key: "category", label: "Type" },
	{ key: "artists", label: "Artists" },
	{ key: "producers", label: "Producers" },
	{ key: "engineers", label: "Engineers" },
	{ key: "recordDate", label: "Recorded" },
	{ key: "previewDate", label: "Previewed" },
	{ key: "dates", label: "Surfaced" },
	{ key: "recordingLocation", label: "Recorded at" },
	{ key: "fileNames", label: "File names" },
	{ key: "instrumentalNames", label: "Instrumental" },
	{ key: "availableFiles", label: "Available files" },
	{ key: "duration", label: "Length" },
	{ key: "altNames", label: "Also known as" },
	{ key: "additionalInfo", label: "Notes" },
];

function text(value: unknown): string {
	if (Array.isArray(value)) return value.filter((entry) => typeof entry === "string" && entry.trim()).join(", ");
	if (typeof value === "number") return String(value);
	return typeof value === "string" ? value.replace(/\r/g, "").trim() : "";
}

export function SongInfo({ songId, song }: { songId: string; song: Song | null }): any {
	const [info, setInfo] = useState<TrackerInfo | null | undefined>(undefined);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		let cancelled = false;
		getTrackerInfo(songId)
			.then((result) => {
				if (!cancelled) setInfo(result);
			})
			.catch((failure) => {
				if (!cancelled) setError(describeError(failure, "Couldn't load the tracker info."));
			});
		return () => {
			cancelled = true;
		};
	}, [songId]);

	const tag = song && getDeviceSettings().showTags ? songTag(song) : null;
	const album = albumName(song?.album ?? knownAlbum(songId));
	const rows = info ? FIELDS.map((field) => ({ ...field, value: text(info[field.key]) })).filter((field) => field.value) : [];

	return h(
		"div",
		{ className: "jv-modal jv-info" },
		song
			? h(
					"div",
					{ className: "jv-info-head" },
					h("img", { className: "jv-info-cover", src: song.coverUrl, alt: "" }),
					h(
						"div",
						{ className: "jv-info-title" },
						h("p", { className: "jv-info-name" }, song.title, tag ? h("span", { className: "jv-tag", "data-kind": songKind(song), "data-colored": String(getDeviceSettings().coloredTags) }, tag) : null),
						h("p", { className: "jv-info-sub" }, `${song.artist} • ${album} • ${song.length}`),
					),
				)
			: null,
		error
			? h("p", { className: "jv-modal-note" }, error)
			: info === undefined
				? h("p", { className: "jv-modal-intro" }, "Loading tracker info…")
				: !rows.length
					? h("p", { className: "jv-modal-note" }, "The tracker doesn't have details for this song yet.")
					: h(
							"dl",
							{ className: "jv-info-grid" },
							rows.map((row) => [h("dt", { key: `${row.key}-label` }, row.label), h("dd", { key: `${row.key}-value` }, row.value)]),
						),
		h(
			"div",
			{ className: "jv-modal-actions" },
			Button("secondary", "Open on JuiceVault", { onClick: () => openInBrowser(siteUrl(`/archive/${songId}`)) }),
			Button("primary", "Close", { onClick: closeModal }),
		),
	);
}
