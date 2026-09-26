import { h } from "../h";

const DAY_MS = 86400000;
const WEEKS = 53;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function dayKey(date: Date): string {
	return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function level(value: number, max: number): number {
	if (value <= 0 || max <= 0) return 0;
	const ratio = value / max;
	if (ratio > 0.75) return 4;
	if (ratio > 0.45) return 3;
	if (ratio > 0.2) return 2;
	return 1;
}

export function Heatmap(daily: Array<{ date: string; plays: number }>): any {
	const plays = new Map(daily.map((entry) => [entry.date, entry.plays]));
	const today = new Date();
	today.setHours(0, 0, 0, 0);

	const start = new Date(today.getTime() - (WEEKS * 7 - 1) * DAY_MS);
	start.setDate(start.getDate() - start.getDay());

	const days: Array<{ key: string; date: Date; plays: number } | null> = [];
	for (let time = start.getTime(); time <= today.getTime(); time += DAY_MS) {
		const date = new Date(time);
		const key = dayKey(date);
		days.push({ key, date, plays: plays.get(key) ?? 0 });
	}

	const max = Math.max(1, ...days.map((day) => day?.plays ?? 0));
	const columns = Math.ceil(days.length / 7);

	const labels: any[] = [];
	let lastMonth = -1;
	for (let column = 0; column < columns; column += 1) {
		const first = days[column * 7];
		const month = first?.date.getMonth() ?? -1;
		if (month !== lastMonth && first) {
			labels.push(h("span", { key: column, style: { gridColumn: column + 1 } }, MONTHS[month]));
			lastMonth = month;
		}
	}

	return h(
		"div",
		{ className: "jv-heatmap" },
		h("div", { className: "jv-heatmap-months", style: { gridTemplateColumns: `repeat(${columns}, 1fr)` } }, labels),
		h(
			"div",
			{ className: "jv-heatmap-grid", style: { gridTemplateColumns: `repeat(${columns}, 1fr)` } },
			days.map((day, index) =>
				day
					? h("span", {
							key: day.key,
							className: "jv-heatmap-cell",
							"data-level": level(day.plays, max),
							title: `${day.plays.toLocaleString()} play${day.plays === 1 ? "" : "s"} on ${day.date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}`,
						})
					: h("span", { key: `empty-${index}` }),
			),
		),
		h(
			"div",
			{ className: "jv-heatmap-legend" },
			"Less",
			[0, 1, 2, 3, 4].map((value) => h("span", { key: value, className: "jv-heatmap-cell", "data-level": value })),
			"More",
		),
	);
}

export function HourlyBars(hourly: Array<{ hour: number; count: number }>): any {
	const counts = Array.from({ length: 24 }, (_, hour) => hourly.find((entry) => entry.hour === hour)?.count ?? 0);
	const max = Math.max(1, ...counts);
	const label = (hour: number): string => (hour === 0 ? "12am" : hour === 12 ? "12pm" : hour < 12 ? `${hour}am` : `${hour - 12}pm`);

	return h(
		"div",
		{ className: "jv-hours" },
		h(
			"div",
			{ className: "jv-hours-bars" },
			counts.map((count, hour) =>
				h(
					"div",
					{ key: hour, className: "jv-hours-col", title: `${label(hour)}: ${count.toLocaleString()} plays` },
					h("div", { className: "jv-hours-bar", style: { height: `${Math.max(2, (count / max) * 100)}%` } }),
				),
			),
		),
		h(
			"div",
			{ className: "jv-hours-axis" },
			[0, 6, 12, 18].map((hour) => h("span", { key: hour, style: { gridColumn: hour + 1 } }, label(hour))),
		),
	);
}
