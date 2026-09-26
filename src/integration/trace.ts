import { createLogger } from "../core/log";

const log = createLogger("trace");

function containsJv(value: any, depth = 0, seen = new Set<any>()): boolean {
	if (!value || depth > 6) return false;
	if (typeof value === "string") return value.includes(":jv-");
	if (typeof value !== "object" || seen.has(value)) return false;
	seen.add(value);

	if (Array.isArray(value)) {
		for (const entry of value.slice(0, 500)) if (containsJv(entry, depth + 1, seen)) return true;
		return false;
	}

	for (const entry of Object.values(value)) {
		if (containsJv(entry, depth + 1, seen)) return true;
	}
	return false;
}

export function traceForJv(seconds = 25): Promise<Record<string, unknown>> {
	const platform = Spicetify.Platform;
	const restores: Array<() => void> = [];
	const called = new Set<string>();
	const hits: Array<{ method: string; at: string }> = [];

	const record = (method: string, result: any): void => {
		called.add(method);
		try {
			if (result && typeof result.then === "function") {
				result.then((value: any) => {
					if (containsJv(value)) hits.push({ method, at: new Date().toISOString().slice(11, 19) });
				}).catch(() => {});
				return;
			}
			if (containsJv(result)) hits.push({ method, at: new Date().toISOString().slice(11, 19) });
		} catch {
			/* ignore */
		}
	};

	for (const apiName of Object.keys(platform)) {
		let api: any;
		try {
			api = platform[apiName];
		} catch {
			continue;
		}
		if (!api || typeof api !== "object") continue;

		const proto = Object.getPrototypeOf(api) ?? {};
		const keys = new Set([...Object.keys(api), ...Object.getOwnPropertyNames(proto)]);

		for (const key of keys) {
			if (key === "constructor") continue;
			let fn: any;
			try {
				fn = api[key];
			} catch {
				continue;
			}
			if (typeof fn !== "function") continue;

			const own = Object.getOwnPropertyDescriptor(api, key);
			const label = `${apiName}.${key}`;

			try {
				const proxy = new Proxy(fn, {
					apply: (_target: any, thisArg: any, args: any[]) => {
						const result = Reflect.apply(fn, thisArg ?? api, args);
						record(label, result);
						return result;
					},
					construct: (_target: any, args: any[], newTarget: any) => Reflect.construct(fn, args, newTarget),
				});

				Object.defineProperty(api, key, {
					value: proxy,
					writable: true,
					configurable: true,
					enumerable: own?.enumerable ?? false,
				});
				restores.push(() => {
					try {
						if (own) Object.defineProperty(api, key, own);
						else delete api[key];
					} catch {
						/* ignore */
					}
				});
			} catch {
				continue;
			}
		}
	}

	log.info(`tracing ${restores.length} methods for ${seconds}s — navigate away and back now`);

	return new Promise((resolve) => {
		window.setTimeout(() => {
			for (const restore of restores) restore();
			log.info("trace finished");
			resolve({
				wrapped: restores.length,
				jvHits: hits,
				jvMethods: [...new Set(hits.map((hit) => hit.method))],
				totalCalled: called.size,
				calledMethods: [...called].sort(),
			});
		}, seconds * 1000);
	});
}
