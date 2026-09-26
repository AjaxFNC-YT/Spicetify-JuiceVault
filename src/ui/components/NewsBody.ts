import type { NewsItem } from "../../core/api/news";
import { assetUrl } from "../../core/config";
import { openInBrowser } from "../../core/auth/oauth";
import { api } from "../bridge";
import { h, notify } from "../h";
import { Icon } from "../icons";
import { Markdown, songIdFromLink } from "./Markdown";
import { closeModal } from "../modal";

function playSong(songId: string): void {
	const jv = api();
	const song = jv?.catalog.get(songId);
	if (!jv || !song) {
		notify("That song isn't in your catalog yet. Try again in a moment.", true);
		return;
	}
	jv.playList([song], 0, "JuiceVault changelog");
	closeModal();
}

export function markdownLink(href: string, children: any[], key: string): any {
	const songId = songIdFromLink(href);
	if (songId) {
		return h(
			"button",
			{ key, className: "jv-md-song", title: "Play in Spotify", onClick: () => playSong(songId) },
			h("span", { className: "jv-md-song-icon" }, Icon("play", 10)),
			children,
		);
	}
	return h(
		"a",
		{
			key,
			href,
			className: "jv-md-link",
			onClick: (event: any) => {
				event.preventDefault();
				openInBrowser(href);
			},
		},
		children,
	);
}

function blocks(item: NewsItem): any[] {
	return item.blocks.map((block, index) => {
		if (block.type === "text" && typeof block.content?.text === "string") {
			return h("div", { key: `block${index}` }, Markdown(block.content.text, markdownLink));
		}
		if (block.type === "button" && typeof block.content?.url === "string") {
			const primary = block.content.style === "primary";
			return h(
				"button",
				{ key: `block${index}`, className: `jv-btn jv-btn--${primary ? "primary" : "secondary"} jv-news-button`, onClick: () => openInBrowser(block.content.url) },
				block.content.label ?? "Open",
			);
		}
		if (block.type === "image" && typeof block.content?.url === "string") {
			return h("img", { key: `block${index}`, className: "jv-news-image", src: assetUrl(block.content.url) ?? block.content.url, alt: "" });
		}
		return null;
	});
}

export function NewsBody(item: NewsItem): any {
	return h(
		"div",
		{ className: "jv-news-body" },
		item.image ? h("img", { className: "jv-news-image", src: assetUrl(item.image) ?? item.image, alt: "" }) : null,
		item.body ? Markdown(item.body, markdownLink) : null,
		...blocks(item),
	);
}

export function newsDate(iso: string): string {
	const date = new Date(iso);
	return Number.isNaN(date.getTime()) ? "" : date.toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" });
}
