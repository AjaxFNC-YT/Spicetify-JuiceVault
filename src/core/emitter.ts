export type Unsubscribe = () => void;

export class Emitter<Events extends object> {
	private listeners = new Map<keyof Events, Set<(payload: never) => void>>();

	on<K extends keyof Events>(event: K, handler: (payload: Events[K]) => void): Unsubscribe {
		let set = this.listeners.get(event);
		if (!set) {
			set = new Set();
			this.listeners.set(event, set);
		}
		set.add(handler as (payload: never) => void);
		return () => {
			set?.delete(handler as (payload: never) => void);
		};
	}

	emit<K extends keyof Events>(event: K, payload: Events[K]): void {
		const set = this.listeners.get(event);
		if (!set) return;
		for (const handler of [...set]) {
			try {
				(handler as (p: Events[K]) => void)(payload);
			} catch (error) {
				console.error("[JV] emitter handler threw", event, error);
			}
		}
	}

	clear(): void {
		this.listeners.clear();
	}
}
