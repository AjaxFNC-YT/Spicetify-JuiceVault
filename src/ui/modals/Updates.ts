import type { Release } from "../../integration/Updates";
import { h, notify } from "../h";
import { closeModal } from "../modal";
import { navigate } from "../router";
import { Button } from "../components/controls";
import { Icon } from "../icons";
import { LOGO } from "../../assets/logo";
import { Markdown } from "../components/Markdown";
import { markdownLink } from "../components/NewsBody";
import { openInBrowser } from "../../core/auth/oauth";

declare const Spicetify: any;

function releaseDate(iso: string): string {
	const date = new Date(iso);
	return Number.isNaN(date.getTime()) ? "" : date.toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" });
}

function Notes({ release }: { release: Release | null }): any {
	if (!release?.notes.trim()) return h("p", { className: "jv-modal-note" }, "Release notes aren't available right now.");
	return h("div", { className: "jv-news-scroll jv-update-notes" }, Markdown(release.notes, markdownLink));
}

export function WhatsNew({ version, release }: { version: string; release: Release | null }): any {
	const date = release ? releaseDate(release.date) : "";
	return h(
		"div",
		{ className: "jv-modal jv-news-popup" },
		h("p", { className: "jv-modal-intro" }, `JuiceVault was updated to version ${version}${date ? `, released ${date}` : ""}.`),
		h(Notes, { release }),
		h(
			"div",
			{ className: "jv-modal-actions" },
			release ? Button("secondary", "View on GitHub", { onClick: () => openInBrowser(release.url) }) : null,
			Button("primary", "Got it", { onClick: closeModal }),
		),
	);
}

const WELCOME_POINTS: Array<{ icon: any; title: string; text: string }> = [
	{
		icon: () => h("img", { src: LOGO, alt: "" }),
		title: "Open JuiceVault from the top bar",
		text: "Its button sits in Spotify's top bar, next to your other apps.",
	},
	{
		icon: () => Icon("play", 16),
		title: "Vault songs are native",
		text: "They play in Spotify's own player and queue, and go in your playlists and Liked Songs like any other song.",
	},
	{
		icon: () => Icon("search", 16),
		title: "Search the vault",
		text: "Flip the switch at the top of Spotify search to JuiceVault.",
	},
	{
		icon: () => Icon("playlist", 16),
		title: "Log in for more",
		text: "Sync your JuiceVault playlists, see your stats and find songs you haven't heard.",
	},
];

export function Welcome(): any {
	return h(
		"div",
		{ className: "jv-modal jv-modal--form" },
		h("p", { className: "jv-modal-intro" }, "JuiceVault adds the Juice WRLD archive to Spotify natively, so vault songs work just like the rest of your music."),
		h(
			"ul",
			{ className: "jv-welcome" },
			WELCOME_POINTS.map((point) =>
				h(
					"li",
					{ key: point.title, className: "jv-welcome-point" },
					h("span", { className: "jv-welcome-icon" }, point.icon()),
					h("span", { className: "jv-welcome-text" }, h("strong", null, point.title), h("span", null, point.text)),
				),
			),
		),
		h(
			"div",
			{ className: "jv-modal-actions" },
			Button("secondary", "Maybe later", { onClick: closeModal }),
			Button("primary", "Open JuiceVault", {
				onClick: () => {
					closeModal();
					navigate("browse");
				},
			}),
		),
	);
}

export function UpdateAvailable({ current, release, command, onLater }: { current: string; release: Release; command: string; onLater: () => void }): any {
	const copy = (): void => {
		Spicetify.Platform.ClipboardAPI.copy(command);
		notify("Copied. Paste it into PowerShell, then restart Spotify.");
	};

	return h(
		"div",
		{ className: "jv-modal jv-news-popup" },
		h("p", { className: "jv-modal-intro" }, `Version ${release.version} is out. You have version ${current}.`),
		h(Notes, { release }),
		h("p", { className: "jv-modal-intro" }, "To update, run this in PowerShell and restart Spotify:"),
		h("code", { className: "jv-code" }, command),
		h(
			"div",
			{ className: "jv-modal-actions" },
			Button("secondary", "Later", {
				onClick: () => {
					onLater();
					closeModal();
				},
			}),
			Button("secondary", "View on GitHub", { onClick: () => openInBrowser(release.url) }),
			Button("primary", "Copy command", { onClick: copy }),
		),
	);
}
