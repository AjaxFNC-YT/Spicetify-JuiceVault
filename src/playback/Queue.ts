export type RepeatMode = 0 | 1 | 2;

export interface ItemRef {
	uid?: string | null;
	uri?: string | null;
}

const SMART_EVERY = 3;

function shuffle<T>(list: T[]): T[] {
	const out = [...list];
	for (let i = out.length - 1; i > 0; i -= 1) {
		const j = Math.floor(Math.random() * (i + 1));
		[out[i], out[j]] = [out[j]!, out[i]!];
	}
	return out;
}

function matches(ref: ItemRef, item: any): boolean {
	if (!item) return false;
	return ref.uid ? item.uid === ref.uid : Boolean(ref.uri) && item.uri === ref.uri;
}

export class Queue {
	private items: any[] = [];
	private recommended: any[] = [];
	private order: number[] = [];
	private cursor = 0;
	private queued: any[] = [];
	private queuedCurrent: any = null;

	contextUri: string | undefined;
	shuffle = false;
	smart = false;
	repeat: RepeatMode = 0;

	load(items: any[], startIndex: number, contextUri?: string): void {
		this.items = items ?? [];
		this.recommended = [];
		this.contextUri = contextUri;
		this.queuedCurrent = null;
		this.rebuildOrder(Math.max(0, Math.min(startIndex, this.items.length - 1)));
	}

	adoptOrder(items: any[]): void {
		this.items = items ?? [];
		this.recommended = [];
		this.order = this.items.map((_, index) => index);
		this.cursor = 0;
	}

	private at(index: number | undefined): any | null {
		if (index === undefined) return null;
		return index < this.items.length ? (this.items[index] ?? null) : (this.recommended[index - this.items.length] ?? null);
	}

	private rebuildOrder(currentIndex: number): void {
		if (!this.shuffle) {
			this.order = this.items.map((_, index) => index);
			this.cursor = Math.min(currentIndex, Math.max(0, this.items.length - 1));
			return;
		}

		const rest = shuffle(this.items.map((_, index) => index).filter((index) => index !== currentIndex));
		const extras = this.smart ? shuffle(this.recommended.map((_, index) => this.items.length + index).filter((index) => index !== currentIndex)) : [];
		const order: number[] = this.at(currentIndex) ? [currentIndex] : [];
		rest.forEach((index, position) => {
			order.push(index);
			if ((position + 1) % SMART_EVERY === 0 && extras.length) order.push(extras.shift()!);
		});
		order.push(...extras);
		this.order = order;
		this.cursor = 0;
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

	get items_(): any[] {
		return this.items;
	}

	get recommendedItems(): any[] {
		return this.recommended;
	}

	get current(): any | null {
		if (this.queuedCurrent) return this.queuedCurrent;
		return this.at(this.order[this.cursor]);
	}

	get currentIndex(): number {
		return this.order[this.cursor] ?? 0;
	}

	enqueue(items: any[]): any[] {
		const added = items.map((item) => ({ ...item, provider: "queue" }));
		this.queued.push(...added);
		return added;
	}

	unqueue(test: (item: any) => boolean): number {
		const before = this.queued.length;
		this.queued = this.queued.filter((item) => !test(item));
		return before - this.queued.length;
	}

	removeUpcoming(refs: ItemRef[]): number {
		let removed = 0;
		for (const ref of refs) {
			for (let position = this.cursor + 1; position < this.order.length; position += 1) {
				if (!matches(ref, this.at(this.order[position]))) continue;
				this.order.splice(position, 1);
				removed += 1;
				break;
			}
		}
		return removed;
	}

	clearQueued(): number {
		const count = this.queued.length;
		this.queued = [];
		return count;
	}

	owns(ref: ItemRef): boolean {
		if (this.queued.some((item) => matches(ref, item))) return true;
		for (let position = this.cursor + 1; position < this.order.length; position += 1) {
			if (matches(ref, this.at(this.order[position]))) return true;
		}
		return false;
	}

	reorder(refs: ItemRef[], target: ItemRef, after: boolean): boolean {
		const moving: any[] = [];
		for (const ref of refs) {
			const queuedAt = this.queued.findIndex((item) => matches(ref, item));
			if (queuedAt >= 0) {
				moving.push(this.queued.splice(queuedAt, 1)[0]);
				continue;
			}
			for (let position = this.cursor + 1; position < this.order.length; position += 1) {
				const item = this.at(this.order[position]);
				if (!matches(ref, item)) continue;
				this.order.splice(position, 1);
				moving.push({ ...item, provider: "queue" });
				break;
			}
		}
		if (!moving.length) return false;

		const targetAt = this.queued.findIndex((item) => matches(target, item));
		if (targetAt >= 0) this.queued.splice(after ? targetAt + 1 : targetAt, 0, ...moving);
		else this.queued.push(...moving);
		return true;
	}

	setRecommendations(list: any[]): void {
		const current = this.currentIndex;
		const keep = current >= this.items.length ? this.at(current) : null;
		this.recommended = keep ? [keep, ...list.filter((item) => item.uri !== keep.uri)] : list;
		if (this.smart && this.shuffle) this.rebuildOrder(keep ? this.items.length : current);
	}

	setSmart(on: boolean): void {
		if (this.smart === on) return;
		this.smart = on;
		if (!on) {
			const current = this.currentIndex;
			this.recommended = [];
			this.rebuildOrder(current < this.items.length ? current : 0);
		} else if (this.shuffle) {
			this.rebuildOrder(this.currentIndex);
		}
	}

	next(): any | null {
		if (this.repeat === 2 && !this.queuedCurrent && this.current) return this.current;

		const queued = this.queued.shift();
		if (queued) {
			this.queuedCurrent = queued;
			return queued;
		}
		this.queuedCurrent = null;

		if (!this.order.length) return null;

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
			return this.current;
		}
		if (!this.order.length) return null;
		if (this.cursor > 0) this.cursor -= 1;
		return this.current;
	}

	peekNext(): any | null {
		return this.upcoming(1)[0] ?? null;
	}

	contextUpcoming(count: number): any[] {
		const out: any[] = [];
		for (let i = this.cursor + 1; i < this.order.length && out.length < count; i += 1) {
			const item = this.at(this.order[i]);
			if (item) out.push(item);
		}
		if (this.repeat === 1 && out.length < count) {
			for (let i = 0; i < this.cursor && out.length < count; i += 1) {
				const item = this.at(this.order[i]);
				if (item) out.push(item);
			}
		}
		return out;
	}

	upcoming(count: number): any[] {
		return [...this.queued.slice(0, count), ...this.contextUpcoming(Math.max(0, count - this.queued.length))];
	}

	history(count: number): any[] {
		const out: any[] = [];
		for (let i = this.cursor - 1; i >= 0 && out.length < count; i -= 1) {
			const item = this.at(this.order[i]);
			if (item) out.push(item);
		}
		return out.reverse();
	}

	private seek(test: (item: any) => boolean): boolean {
		if (!this.order.length || this.queuedCurrent) return false;
		const position = this.order.findIndex((index) => test(this.at(index)));
		if (position < 0) return false;
		this.cursor = position;
		return true;
	}

	syncTo(uid?: string, uri?: string): boolean {
		if (uid && this.seek((item) => item?.uid === uid)) return true;
		return Boolean(uri) && this.seek((item) => item?.uri === uri);
	}

	syncWhere(predicate: (item: any) => boolean): boolean {
		return this.seek((item) => Boolean(item) && predicate(item));
	}

	contains(uri: string): boolean {
		return this.items.some((item) => item.uri === uri) || this.recommended.some((item) => item.uri === uri);
	}

	setShuffle(value: boolean): void {
		if (this.shuffle === value) return;
		this.shuffle = value;
		const current = this.currentIndex;
		if (!value) this.recommended = this.recommended.filter((_, index) => this.items.length + index === current);
		this.rebuildOrder(current < this.items.length ? current : value ? current : 0);
	}

	setRepeat(mode: RepeatMode): void {
		this.repeat = mode;
	}

	clear(): void {
		this.items = [];
		this.recommended = [];
		this.order = [];
		this.cursor = 0;
		this.contextUri = undefined;
	}

	finishQueued(): void {
		this.queuedCurrent = null;
	}
}
