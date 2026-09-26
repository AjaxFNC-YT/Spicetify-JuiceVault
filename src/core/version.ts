declare const __JV_VERSION__: string;

export const VERSION: string = typeof __JV_VERSION__ === "string" ? __JV_VERSION__ : "0.0.0";

interface Parsed {
	core: number[];
	pre: string[];
}

function parse(version: string): Parsed {
	const [core = "", pre = ""] = version.trim().replace(/^v/i, "").split("-", 2);
	return {
		core: core.split(".").map((part) => Number.parseInt(part, 10) || 0),
		pre: pre ? pre.split(".") : [],
	};
}

export function compareVersions(a: string, b: string): number {
	const left = parse(a);
	const right = parse(b);

	for (let i = 0; i < 3; i += 1) {
		const diff = (left.core[i] ?? 0) - (right.core[i] ?? 0);
		if (diff) return Math.sign(diff);
	}

	if (!left.pre.length || !right.pre.length) return left.pre.length ? -1 : right.pre.length ? 1 : 0;

	for (let i = 0; i < Math.max(left.pre.length, right.pre.length); i += 1) {
		const x = left.pre[i];
		const y = right.pre[i];
		if (x === undefined) return -1;
		if (y === undefined) return 1;
		const nx = Number(x);
		const ny = Number(y);
		const diff = Number.isFinite(nx) && Number.isFinite(ny) ? nx - ny : x.localeCompare(y);
		if (diff) return Math.sign(diff);
	}
	return 0;
}

export function isPrerelease(version: string): boolean {
	return parse(version).pre.length > 0;
}
