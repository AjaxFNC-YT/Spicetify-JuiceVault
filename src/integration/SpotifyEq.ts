import { createLogger } from "../core/log";

const log = createLogger("SpotifyEq");

export interface EqSnapshot {
	enabled: boolean;
	gains: number[];
	frequencies: number[] | null;
	source: string;
}

function readFilters(raw: any): { gains: number[]; frequencies: number[] | null } | null {
	const list = Array.isArray(raw) ? raw : Array.isArray(raw?.filters) ? raw.filters : null;
	if (!list || !list.length) return null;

	const gains: number[] = [];
	const frequencies: number[] = [];

	for (const entry of list) {
		if (typeof entry === "number") {
			gains.push(entry);
			continue;
		}
		const gain = Number(entry?.gain ?? entry?.value ?? entry?.gainDb);
		if (!Number.isFinite(gain)) return null;
		gains.push(gain);
		const frequency = Number(entry?.frequency ?? entry?.freq ?? entry?.hz);
		if (Number.isFinite(frequency)) frequencies.push(frequency);
	}

	if (!gains.length) return null;
	return { gains, frequencies: frequencies.length === gains.length ? frequencies : null };
}

export function readEqualizer(): EqSnapshot | null {
	const api = Spicetify.Platform?.EqualizerAPI;
	if (!api) return null;

	const readers: Array<[string, () => any]> = [
		["getFilters", () => api.getFilters?.()],
		["filters", () => api.filters],
		["getEqualizer", () => api.getEqualizer?.()],
		["getBands", () => api.getBands?.()],
		["prefs", () => api.prefs],
	];

	for (const [name, read] of readers) {
		try {
			const raw = read();
			if (!raw || typeof raw.then === "function") continue;
			const parsed = readFilters(raw);
			if (!parsed) continue;
			return {
				enabled: readEnabled(api),
				gains: parsed.gains,
				frequencies: parsed.frequencies,
				source: name,
			};
		} catch {
			continue;
		}
	}

	return null;
}

function readEnabled(api: any): boolean {
	for (const read of [() => api.isEnabled?.(), () => api.enabled, () => api.prefs?.enabled]) {
		try {
			const value = read();
			if (typeof value === "boolean") return value;
		} catch {
			continue;
		}
	}
	return true;
}

export function describeEqualizer(): Record<string, unknown> {
	const api = Spicetify.Platform?.EqualizerAPI;
	if (!api) return { present: false };
	return {
		present: true,
		ownKeys: Object.keys(api),
		protoMethods: Object.getOwnPropertyNames(Object.getPrototypeOf(api)),
		rawFilters: (() => {
			try {
				return api.getFilters?.() ?? api.filters ?? null;
			} catch (error) {
				return { threw: String(error) };
			}
		})(),
		isSupported: (() => {
			try {
				return api.isSupported?.();
			} catch {
				return null;
			}
		})(),
		snapshot: readEqualizer(),
	};
}

export function watchEqualizer(onChange: (snapshot: EqSnapshot) => void): () => void {
	const api = Spicetify.Platform?.EqualizerAPI;
	let stop = () => {};

	try {
		const unsubscribe = api?.subscribeToEnabledState?.(() => {
			const snapshot = readEqualizer();
			if (snapshot) onChange(snapshot);
		});
		if (typeof unsubscribe === "function") stop = unsubscribe;
	} catch (error) {
		log.debug("no equalizer subscription", error);
	}

	const timer = window.setInterval(() => {
		const snapshot = readEqualizer();
		if (snapshot) onChange(snapshot);
	}, 2000);

	return () => {
		stop();
		window.clearInterval(timer);
	};
}
