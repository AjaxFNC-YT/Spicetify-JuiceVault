import type { Release } from "../../integration/Updates";
import { h, notify, useEffect, useState } from "../h";
import { closeModal } from "../modal";
import { navigate } from "../router";
import { Button } from "../components/controls";
import { Icon } from "../icons";
import { LOGO } from "../../assets/logo";
import { Markdown } from "../components/Markdown";
import { markdownLink } from "../components/NewsBody";
import { openInBrowser } from "../../core/auth/oauth";
import { config } from "../../core/config";

declare const Spicetify: any;

export function BetaNote(): any {
	return h(
		"p",
		{ className: "jv-beta" },
		h("span", { className: "jv-beta-pill" }, "Beta"),
		"Found a bug? Open a ticket in our ",
		h("button", { className: "jv-beta-link", onClick: () => openInBrowser(config.discordUrl) }, "Discord"),
		".",
	);
}

function releaseDate(iso: string): string {
	const date = new Date(iso);
	return Number.isNaN(date.getTime()) ? "" : date.toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" });
}

function Notes({ release }: { release: Release | null }): any {
	const body = release?.notes.trim()
		? Markdown(release.notes, markdownLink)
		: h("p", { className: "jv-update-empty" }, "Release notes aren't available right now.");
	return h("div", { className: "jv-update-notes" }, body);
}

function Version({ label, version, date }: { label: string; version: string; date?: string }): any {
	return h(
		"div",
		{ className: "jv-update-head" },
		h("div", { className: "jv-update-version" }, h("span", { className: "jv-update-label" }, label), h("span", { className: "jv-update-number" }, version)),
		date ? h("span", { className: "jv-update-date" }, `Released ${date}`) : null,
	);
}

export function WhatsNew({ version, release }: { version: string; release: Release | null }): any {
	return h(
		"div",
		{ className: "jv-modal jv-update" },
		h(
			"div",
			{ className: "jv-update-view" },
			h(Version, { label: "Now on", version, date: release ? releaseDate(release.date) : "" }),
			h(Notes, { release }),
			h("div", { className: "jv-update-footer" }, h(BetaNote, null), Button("primary", "Got it", { onClick: closeModal })),
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
		h(BetaNote, null),
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

const REMIND_OPTIONS: Array<{ label: string; hours: number }> = [
	{ label: "1 hour", hours: 1 },
	{ label: "2 hours", hours: 2 },
	{ label: "3 hours", hours: 3 },
	{ label: "6 hours", hours: 6 },
	{ label: "12 hours", hours: 12 },
	{ label: "1 day", hours: 24 },
	{ label: "3 days", hours: 72 },
	{ label: "1 week", hours: 168 },
];

const COPIED_MS = 1800;

function useHeight(): [(element: HTMLElement | null) => void, number | undefined] {
	const [element, setElement] = useState<HTMLElement | null>(null);
	const [height, setHeight] = useState<number | undefined>(undefined);

	useEffect(() => {
		if (!element) return;
		const measure = (): void => setHeight(element.offsetHeight);
		const observer = new ResizeObserver(measure);
		observer.observe(element);
		measure();
		return () => observer.disconnect();
	}, [element]);

	return [setElement, height];
}

function CopyCommand({ command }: { command: string }): any {
	const [copied, setCopied] = useState(false);

	useEffect(() => {
		if (!copied) return;
		const timer = window.setTimeout(() => setCopied(false), COPIED_MS);
		return () => window.clearTimeout(timer);
	}, [copied]);

	return h(
		"div",
		{ className: "jv-update-command" },
		h("code", null, command),
		h(
			"button",
			{
				className: "jv-update-copy",
				"data-copied": String(copied),
				title: copied ? "Copied" : "Copy",
				"aria-label": copied ? "Copied" : "Copy command",
				onClick: () => {
					Spicetify.Platform.ClipboardAPI.copy(command);
					setCopied(true);
				},
			},
			Icon(copied ? "check" : "copy", 16),
		),
	);
}

export function UpdateAvailable({
	current,
	release,
	command,
	shell,
	onSkip,
	onRemind,
}: {
	current: string;
	release: Release;
	command: string;
	shell: string;
	onSkip: () => void;
	onRemind: (hours: number) => void;
}): any {
	const [view, setView] = useState<"update" | "remind">("update");
	const show = (next: "update" | "remind") => (event: any): void => {
		event.stopPropagation();
		window.setTimeout(() => setView(next), 0);
	};
	const [measure, height] = useHeight();
	const date = releaseDate(release.date);

	const update = h(
		"div",
		{ key: "update", className: "jv-update-view" },
		h(
			"div",
			{ className: "jv-update-head" },
			h(
				"div",
				{ className: "jv-update-versions" },
				h("div", { className: "jv-update-version" }, h("span", { className: "jv-update-label" }, "You have"), h("span", { className: "jv-update-number jv-update-number--old" }, current)),
				h("span", { className: "jv-update-arrow" }, Icon("chevron", 16)),
				h("div", { className: "jv-update-version" }, h("span", { className: "jv-update-label" }, "New"), h("span", { className: "jv-update-number" }, release.version)),
			),
			date ? h("span", { className: "jv-update-date" }, `Released ${date}`) : null,
		),
		h(Notes, { release }),
		h("p", { className: "jv-update-how" }, `Run this in ${shell}, then restart Spotify:`),
		h(CopyCommand, { command }),
		h(
			"div",
			{ className: "jv-modal-actions" },
			Button("secondary", "Skip this version", {
				onClick: () => {
					onSkip();
					closeModal();
				},
			}),
			Button("primary", "Remind me later", { onClick: show("remind") }),
		),
	);

	const remind = h(
		"div",
		{ key: "remind", className: "jv-update-view" },
		h("p", { className: "jv-update-remind-title" }, "Remind me in"),
		h(
			"div",
			{ className: "jv-update-remind" },
			REMIND_OPTIONS.map((option) =>
				h(
					"button",
					{
						key: option.hours,
						className: "jv-update-remind-option",
						onClick: () => {
							onRemind(option.hours);
							closeModal();
							notify(`We'll remind you about ${release.version} in ${option.label}`);
						},
					},
					option.label,
				),
			),
		),
		h("div", { className: "jv-modal-actions" }, Button("secondary", "Back", { onClick: show("update") })),
	);

	return h(
		"div",
		{ className: "jv-modal jv-update" },
		h("div", { className: "jv-update-frame", style: { height } }, h("div", { ref: measure, className: "jv-update-inner" }, view === "update" ? update : remind)),
	);
}
