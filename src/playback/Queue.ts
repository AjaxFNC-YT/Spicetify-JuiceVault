export type RepeatMode = 0 | 1 | 2;

function shuffled(length: number, keepFirst: number): number[] {
	const rest = [];
	for (let i = 0; i < length; i += 1) if (i !== keepFirst) rest.push(i);
	for (let i = rest.length - 1; i > 0; i -= 1) {
		const j = Math.floor(Math.random() * (i + 1));
		[rest[i], rest[j]] = [rest[j]!, rest[i]!];
	}
	return keepFirst >= 0 ? [keepFirst, ...rest] : rest;
}

export class Queue {
	private items: any[] = [];
	private order: number[] = [];
	private cursor = 0;
	private queued: any[] = [];
	private queuedCurrent: any = null;

	contextUri: string | undefined;
	shuffle = false;
	repeat: RepeatMode = 0;

	load(items: any[], startIndex: number, contextUri?: string): void {
		this.items = items ?? [];
		this.contextUri = contextUri;
		this.queuedCurrent = null;
		const safeStart = Math.max(0, Math.min(startIndex, this.items.length - 1));
		this.rebuildOrder(safeStart);
	}

	adoptOrder(items: any[]): void {
		this.items = items ?? [];
		this.order = this.items.map((_, index) => index);
		this.cursor = 0;
	}

	private rebuildOrder(currentIndex: number): void {
		if (this.shuffle) {
			this.order = shuffled(this.items.length, currentIndex);
			this.cursor = 0;
		} else {
			this.order = this.items.map((_, index) => index);
			this.cursor = currentIndex;
		}
	}

	get size(): number {
		return this.items.length;
	}

	get isEmpty(): boolean {
		return this.items.length === 0;
	}

	get isIdle(): boolean {
		return this.isEmpty && !this.queued.length && !this.queuedCurrent;
	}

	get playingQueued(): boolean {
		return this.queuedCurrent !== null;
	}

	get queuedItems(): any[] {
		return this.queued;
	}

	enqueue(items: any[]): void {
		this.queued.push(...items.map((item) => ({ ...item, provider: "queue" })));
	}

	unqueue(matches: (item: any) => boolean): number {
		const before = this.queued.length;
		this.queued = this.queued.filter((item) => !matches(item));
		return before - this.queued.length;
	}

	get current(): any | null {
		if (this.queuedCurrent) return this.queuedCurrent;
		const index = this.order[this.cursor];
		return index === undefined ? null : (this.items[index] ?? null);
	}

	get currentIndex(): number {
		return this.order[this.cursor] ?? 0;
	}

	next(): any | null {
		if (this.repeat === 2 && !this.queuedCurrent && !this.isEmpty) return this.current;

		const queued = this.queued.shift();
		if (queued) {
			this.queuedCurrent = queued;
			return queued;
		}
		this.queuedCurrent = null;

		if (this.isEmpty) return null;

		if (this.cursor + 1 < this.order.length) {
			this.cursor += 1;
			return this.current;
		}

		if (this.repeat === 1) {
			this.cursor = 0;
			return this.current;
		}

		return null;
	}

	previous(): any | null {
		if (this.queuedCurrent) {
			this.queuedCurrent = null;
			return this.isEmpty ? null : this.current;
		}
		if (this.isEmpty) return null;
		if (this.cursor > 0) {
			this.cursor -= 1;
			return this.current;
		}
		return this.current;
	}

	peekNext(): any | null {
		return this.upcoming(1)[0] ?? null;
	}

	upcoming(count: number): any[] {
		const out: any[] = this.queued.slice(0, count);
		for (let i = this.cursor + 1; i < this.order.length && out.length < count; i += 1) {
			const item = this.items[this.order[i]!];
			if (item) out.push(item);
		}
		if (this.repeat === 1 && out.length < count) {
			for (let i = 0; i < this.cursor && out.length < count; i += 1) {
				const item = this.items[this.order[i]!];
				if (item) out.push(item);
			}
		}
		return out;
	}

	history(count: number): any[] {
		const out: any[] = [];
		for (let i = this.cursor - 1; i >= 0 && out.length < count; i -= 1) {
			const item = this.items[this.order[i]!];
			if (item) out.push(item);
		}
		return out.reverse();
	}

	syncTo(uid?: string, uri?: string): boolean {
		if (this.isEmpty || this.queuedCurrent) return false;
		let index = uid ? this.items.findIndex((item) => item.uid === uid) : -1;
		if (index < 0 && uri) index = this.items.findIndex((item) => item.uri === uri);
		if (index < 0) return false;
		const position = this.order.indexOf(index);
		if (position < 0) return false;
		this.cursor = position;
		return true;
	}

	get items_(): any[] {
		return this.items;
	}

	syncWhere(predicate: (item: any) => boolean): boolean {
		if (this.isEmpty || this.queuedCurrent) return false;
		const index = this.items.findIndex(predicate);
		if (index < 0) return false;
		const position = this.order.indexOf(index);
		if (position < 0) return false;
		this.cursor = position;
		return true;
	}

	contains(uri: string): boolean {
		return this.items.some((item) => item.uri === uri);
	}

	setShuffle(value: boolean): void {
		if (this.shuffle === value) return;
		this.shuffle = value;
		this.rebuildOrder(this.currentIndex);
	}

	setRepeat(mode: RepeatMode): void {
		this.repeat = mode;
	}

	clear(): void {
		this.items = [];
		this.order = [];
		this.cursor = 0;
		this.contextUri = undefined;
	}

	finishQueued(): void {
		this.queuedCurrent = null;
	}
}
