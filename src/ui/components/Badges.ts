import { h } from "../h";

export interface Badge {
	id: string;
	label: string;
	icon: string;
	tone: string;
	priority?: number;
}

const TONES: Record<string, { color: string; glow: string }> = {
	gold: { color: "#fbbf24", glow: "drop-shadow(0 0 10px rgba(245,158,11,0.16))" },
	green: { color: "#4ade80", glow: "drop-shadow(0 0 10px rgba(74,222,128,0.12))" },
	purple: { color: "#a78bfa", glow: "drop-shadow(0 0 10px rgba(167,139,250,0.14))" },
	blue: { color: "#7dd3fc", glow: "drop-shadow(0 0 10px rgba(125,211,252,0.12))" },
	pink: { color: "#f9a8d4", glow: "drop-shadow(0 0 10px rgba(249,168,212,0.14))" },
	cyan: { color: "#22d3ee", glow: "drop-shadow(0 0 11px rgba(34,211,238,0.2))" },
	violet: { color: "#a78bfa", glow: "drop-shadow(0 0 12px rgba(139,92,246,0.24))" },
	amber: { color: "#fbbf24", glow: "drop-shadow(0 0 11px rgba(251,191,36,0.22))" },
	orange: { color: "#fb923c", glow: "drop-shadow(0 0 12px rgba(249,115,22,0.24))" },
	crimson: { color: "#fb7185", glow: "drop-shadow(0 0 13px rgba(225,29,72,0.3))" },
};

const ICONS: Record<string, string> = {
	owner: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.15" stroke-linecap="round" stroke-linejoin="round"><path d="M11.562 3.266a.5.5 0 0 1 .876 0L15.39 8.87a1 1 0 0 0 1.516.294L21.183 5.5a.5.5 0 0 1 .798.519l-2.834 10.246a1 1 0 0 1-.956.734H5.81a1 1 0 0 1-.957-.734L2.02 6.02a.5.5 0 0 1 .798-.519l4.276 3.664a1 1 0 0 0 1.516-.294z"/><path d="M5 21h14"/></svg>`,
	verified: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M12 3.75 14.55 5.6l3.1-.05 1.03 2.92 2.48 1.82-.95 2.96.95 2.96-2.48 1.82-1.03 2.92-3.1-.05L12 22.25l-2.55-1.85-3.1.05-1.03-2.92-2.48-1.82.95-2.96-.95-2.96 2.48-1.82 1.03-2.92 3.1.05L12 3.75Z" fill="currentColor"/><path d="m8.35 12.35 2.3 2.3 5-5.2" stroke="rgba(7,18,11,0.92)" stroke-width="2.15" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
	moderator: `<svg width="23" height="23" viewBox="0 0 24 24" fill="none"><path d="M12 2.9 19.1 5.8v5.45c0 4.55-2.82 8.12-7.1 9.85-4.28-1.73-7.1-5.3-7.1-9.85V5.8L12 2.9Z" fill="currentColor"/><path d="m8.55 12.05 2.15 2.15 4.75-4.75" stroke="rgba(4,20,25,0.9)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
	og: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M12 3.9 14.35 8.6l5.18.75-3.75 3.66.88 5.15L12 15.73l-4.66 2.43.88-5.15-3.75-3.66 5.18-.75L12 3.9Z" fill="currentColor"/><path d="M9.35 12.2h5.3" stroke="rgba(31,18,52,0.34)" stroke-width="1.55" stroke-linecap="round"/><circle cx="12" cy="9.95" r="1.35" fill="rgba(255,255,255,0.88)"/></svg>`,
	"first-1000": `<svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M12 2.75 20.25 7.5v9L12 21.25 3.75 16.5v-9L12 2.75Z" fill="currentColor"/><text x="12" y="15.1" text-anchor="middle" font-size="7.6" font-weight="900" font-family="inherit" fill="rgba(36,22,4,0.9)">1K</text></svg>`,
	listens: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M12 3.5a1.5 1.5 0 0 1 1.5 1.5v8.9a3.9 3.9 0 1 1-2.2-3.52V5A1.5 1.5 0 0 1 12 3.5Z" fill="currentColor"/><path d="M14.5 6.5c1.45.28 2.44 1.06 3.2 2.2" stroke="rgba(255,255,255,0.52)" stroke-width="1.4" stroke-linecap="round"/><path d="M14.8 9.35c.7.15 1.2.52 1.67 1.06" stroke="rgba(255,255,255,0.44)" stroke-width="1.3" stroke-linecap="round"/></svg>`,
	streak: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M12.08 3.8c.25 2.55-1.02 3.93-2.28 5.18-1.24 1.24-2.48 2.47-2.48 4.52 0 2.62 1.94 4.5 4.68 4.5s4.68-1.88 4.68-4.5c0-1.9-.95-3.08-2.05-4.2-.95-.97-1.95-1.97-2.02-3.92-.32.35-.45.56-.53.8Z" fill="currentColor"/><path d="M11.95 10.85c.12 1.12-.4 1.7-.96 2.27-.57.58-1.16 1.17-1.16 2.15 0 1.22.93 2.12 2.17 2.12s2.17-.9 2.17-2.12c0-.9-.44-1.46-.92-1.99-.45-.5-.94-1.03-1.03-2.43-.18.18-.22.29-.27.48Z" fill="rgba(255,255,255,0.34)"/></svg>`,
	completion: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none"><rect x="4.5" y="5" width="15" height="14" rx="3.2" fill="currentColor"/><path d="m8.25 12.15 2.15 2.2 5.3-5.1" stroke="rgba(7,14,21,0.92)" stroke-width="2.15" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
};

export function sortBadges(value: unknown): Badge[] {
	if (!Array.isArray(value)) return [];
	return value
		.filter((badge): badge is Badge => typeof badge?.id === "string" && typeof badge?.icon === "string" && ICONS[badge.icon] !== undefined)
		.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
}

export function Badges({ badges }: { badges: unknown }): any {
	const list = sortBadges(badges);
	if (!list.length) return null;
	return h(
		"div",
		{ className: "jv-badges" },
		list.map((badge) => {
			const tone = TONES[badge.tone] ?? { color: "currentColor", glow: "" };
			return h("span", {
				key: badge.id,
				className: "jv-badge",
				title: badge.label,
				"aria-label": badge.label,
				role: "img",
				style: { color: tone.color, filter: tone.glow },
				dangerouslySetInnerHTML: { __html: ICONS[badge.icon] },
			});
		}),
	);
}
