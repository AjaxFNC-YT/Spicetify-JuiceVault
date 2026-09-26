import type { JvPlaylist } from "../../core/api/playlists";
import { assetUrl, coverUrl } from "../../core/config";
import { h } from "../h";
import { Icon } from "../icons";

export function PlaylistCover(playlist: JvPlaylist, size: number): any {
	const style = { width: size, height: size };
	const custom = assetUrl(playlist.coverImage);
	if (custom) return h("img", { className: "jv-pl-cover", src: custom, alt: "", loading: "lazy", style });

	const ids = playlist.recentSongIds;
	if (ids.length >= 4) {
		return h(
			"div",
			{ className: "jv-pl-cover jv-pl-mosaic", style },
			ids.slice(-4).map((id) => h("img", { key: id, src: coverUrl(id), alt: "", loading: "lazy" })),
		);
	}
	if (ids.length) return h("img", { className: "jv-pl-cover", src: coverUrl(ids[ids.length - 1]!), alt: "", loading: "lazy", style });

	const glyph = playlist.kind === "liked" ? "heart-active" : playlist.kind === "unheard" ? "headphones" : "playlist";
	return h("div", { className: `jv-pl-cover jv-pl-cover--${playlist.kind}`, style }, Icon(glyph, Math.round(size * 0.38)));
}
