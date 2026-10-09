import { h, useEffect, useState } from "../h";
import { Icon } from "../icons";
import { navigate, type View } from "../router";
import { MenuButton } from "./StandaloneMenu";

const GAP = 8;

const SECTIONS: Array<{ view: View; label: string; account: boolean }> = [
	{ view: "browse", label: "Browse", account: false },
	{ view: "changelog", label: "Changelog", account: false },
	{ view: "unheard", label: "Unheard", account: true },
	{ view: "playlists", label: "Playlists", account: true },
	{ view: "history", label: "Recently played", account: true },
	{ view: "stats", label: "Stats", account: true },
];

function go(view: View, current: View): void {
	if (view !== current) navigate(view);
}

export function SectionNav({ view, signedIn, unseenChangelog }: { view: View; signedIn: boolean; unseenChangelog: boolean }): any {
	const sections = SECTIONS.filter((section) => signedIn || !section.account);
	const [nav, setNav] = useState<HTMLElement | null>(null);
	const [ruler, setRuler] = useState<HTMLElement | null>(null);
	const [fit, setFit] = useState(sections.length);

	useEffect(() => {
		if (!nav || !ruler) return;
		const measure = (): void => {
			const widths = Array.from(ruler.children, (child) => (child as HTMLElement).offsetWidth);
			const more = widths.pop() ?? 0;
			const available = nav.clientWidth;
			const total = widths.reduce((sum, width) => sum + width, 0) + GAP * (widths.length - 1);
			if (total <= available) return setFit(widths.length);
			let used = more;
			let count = 0;
			for (const width of widths) {
				if (used + GAP + width > available) break;
				used += GAP + width;
				count++;
			}
			setFit(count);
		};
		const observer = new ResizeObserver(measure);
		observer.observe(nav);
		measure();
		return () => observer.disconnect();
	}, [nav, ruler, sections.length]);

	const shown = sections.slice(0, fit);
	const hidden = sections.slice(fit);
	const hiddenActive = hidden.find((section) => section.view === view);
	const dot = (section: { view: View }): any =>
		section.view === "changelog" && unseenChangelog ? h("span", { className: "jv-nav-dot", "aria-label": "New" }) : null;

	const pill = (section: { view: View; label: string }): any =>
		h(
			"button",
			{
				key: section.view,
				className: "jv-nav-pill",
				"data-active": String(view === section.view),
				"aria-current": view === section.view ? "page" : undefined,
				onClick: () => go(section.view, view),
			},
			section.label,
			dot(section),
		);

	const overflow = hidden.length
		? h(MenuButton, {
				key: "more",
				align: "left",
				items: hidden.map((section) => ({ key: section.view, label: section.label, checked: section.view === view, onClick: () => go(section.view, view) })),
				trigger: h(
						"button",
						{ className: "jv-nav-pill jv-nav-more", "data-active": String(Boolean(hiddenActive)) },
						hiddenActive?.label ?? "More",
						Icon("chevron-down", 12),
						hidden.some((section) => section.view === "changelog") ? dot({ view: "changelog" }) : null,
					),
			})
		: null;

	return h(
		"nav",
		{ className: "jv-nav", "aria-label": "JuiceVault", ref: setNav },
		shown.map(pill),
		overflow,
		h(
			"div",
			{ className: "jv-nav-ruler", ref: setRuler, "aria-hidden": "true" },
			sections.map((section) => h("span", { key: section.view, className: "jv-nav-pill" }, section.label)),
			h("span", { key: "more", className: "jv-nav-pill jv-nav-more" }, "Recently played", Icon("chevron-down", 12)),
		),
	);
}
