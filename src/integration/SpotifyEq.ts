import { createLogger } from "../core/log";

declare const Spicetify: any;

const log = createLogger("SpotifyEq");

const ENABLED_KEY = "audio.equalizer_v2";
const POLL_MS = 3000;

export interface EqSnapshot {
	enabled: boolean;
	gains: number[];
	frequencies: number[] | null;
}

interface Filter {
	key: string;
	gain: number;
	frequency?: number;
}

function api(): any {
	return Spicetify.Platform?.EqualizerAPI ?? null;
}

function parse(list: unknown): Filter[] {
	if (!Array.isArray(list)) return [];
	const filters: Filter[] = [];
	for (const entry of list as any[]) {
		const gain = Number(entry?.gain);
		if (!Number.isFinite(gain)) continue;
		const frequency = Number(entry?.frequency ?? entry?.freq ?? entry?.hz);
		filters.push({ key: String(entry?.key ?? ""), gain, frequency: Number.isFinite(frequency) ? frequency : undefined });
	}
	return filters;
}

export function initialFrequencies(): number[] | null {
	const filters = parse(api()?.filters);
	const frequencies = filters.map((filter) => filter.frequency).filter((value): value is number => typeof value === "number");
	return frequencies.length === filters.length && frequencies.length ? frequencies : null;
}

async function readEnabled(eq: any): Promise<boolean> {
	try {
		const result = await eq.prefs?.get?.({ key: ENABLED_KEY });
		const value = result?.entries?.[ENABLED_KEY]?.bool;
		if (typeof value === "boolean") return value;
	} catch (error) {
		log.debug("could not read the equalizer switch", error);
	}
	return false;
}

export async function readEqualizer(): Promise<EqSnapshot | null> {
	const eq = api();
	if (!eq) return null;

	let filters: Filter[] = [];
	try {
		filters = parse(typeof eq.getFilters === "function" ? await eq.getFilters() : eq.filters);
	} catch (error) {
		log.debug("getFilters failed, using the cached filters", error);
		filters = parse(eq.filters);
	}
	if (!filters.length) return null;

	const frequencies = filters.map((filter) => filter.frequency);
	return {
		enabled: await readEnabled(eq),
		gains: filters.map((filter) => filter.gain),
		frequencies: frequencies.every((value) => typeof value === "number") ? (frequencies as number[]) : null,
	};
}

export async function describeEqualizer(): Promise<Record<string, unknown>> {
	const eq = api();
	if (!eq) return { present: false };
	return {
		present: true,
		keys: parse(eq.filters).map((filter) => filter.key),
		snapshot: await readEqualizer(),
	};
}

export function watchEqualizer(onChange: (snapshot: EqSnapshot) => void): () => void {
	const eq = api();
	const cancels: Array<() => void> = [];
	let pending = false;

	const refresh = (): void => {
		if (pending) return;
		pending = true;
		void readEqualizer()
			.then((snapshot) => {
				if (snapshot) onChange(snapshot);
			})
			.finally(() => {
				pending = false;
			});
	};

	const subscribe = (key: string): void => {
		try {
			const subscription = eq?.prefs?.sub?.({ key }, () => refresh());
			const cancel = typeof subscription === "function" ? subscription : subscription?.cancel;
			if (typeof cancel === "function") cancels.push(() => cancel.call(subscription));
		} catch (error) {
			log.debug(`could not subscribe to ${key}`, error);
		}
	};

	subscribe(ENABLED_KEY);
	for (const filter of parse(eq?.filters)) if (filter.key) subscribe(filter.key);

	const timer = window.setInterval(refresh, POLL_MS);
	refresh();

	return () => {
		window.clearInterval(timer);
		for (const cancel of cancels) cancel();
	};
}
