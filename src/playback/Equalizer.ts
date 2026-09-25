import { createLogger } from "../core/log";

const log = createLogger("Equalizer");

const DEFAULT_BANDS = [60, 150, 400, 1000, 2400, 15000];

export class Equalizer {
	private context: AudioContext | null = null;
	private source: MediaElementAudioSourceNode | null = null;
	private filters: BiquadFilterNode[] = [];
	private gain: GainNode | null = null;
	private frequencies: number[] = DEFAULT_BANDS;
	private available = false;
	private lastGains: number[] = [];

	constructor(
		private readonly element: HTMLAudioElement,
		frequencies?: number[] | null,
	) {
		if (frequencies?.length) this.frequencies = frequencies;
	}

	attach(): boolean {
		if (this.context) return this.available;

		try {
			const Ctor = window.AudioContext ?? (window as any).webkitAudioContext;
			if (!Ctor) return false;

			this.context = new Ctor();
			this.source = this.context.createMediaElementSource(this.element);
			this.gain = this.context.createGain();

			this.filters = this.frequencies.map((frequency, index) => {
				const filter = this.context!.createBiquadFilter();
				filter.type = index === 0 ? "lowshelf" : index === this.frequencies.length - 1 ? "highshelf" : "peaking";
				filter.frequency.value = frequency;
				filter.Q.value = 1.1;
				filter.gain.value = 0;
				return filter;
			});

			let node: AudioNode = this.source;
			for (const filter of this.filters) {
				node.connect(filter);
				node = filter;
			}
			node.connect(this.gain);
			this.gain.connect(this.context.destination);

			this.available = true;
			log.info(`attached with ${this.filters.length} bands`);
			return true;
		} catch (error) {
			log.warn("could not attach equalizer; audio stays unprocessed", error);
			this.teardown();
			return false;
		}
	}

	async resume(): Promise<void> {
		if (!this.context) return;
		if (this.context.state === "suspended") {
			try {
				await this.context.resume();
			} catch (error) {
				log.debug("context resume failed", error);
			}
		}
	}

	setGains(gains: number[]): void {
		if (!this.available) return;
		this.lastGains = gains;
		this.filters.forEach((filter, index) => {
			const value = Number(gains[index]);
			filter.gain.value = Number.isFinite(value) ? value : 0;
		});
	}

	setFadeGain(value: number): void {
		if (!this.gain) return;
		this.gain.gain.value = Math.max(0, Math.min(1, value));
	}

	rampFadeGain(target: number, seconds: number): void {
		if (!this.gain || !this.context) return;
		const now = this.context.currentTime;
		this.gain.gain.cancelScheduledValues(now);
		this.gain.gain.setValueAtTime(this.gain.gain.value, now);
		this.gain.gain.linearRampToValueAtTime(Math.max(0, Math.min(1, target)), now + Math.max(0.01, seconds));
	}

	get diagnostics(): Record<string, unknown> {
		return {
			available: this.available,
			contextState: this.context?.state ?? null,
			frequencies: this.frequencies,
			gains: this.lastGains,
		};
	}

	private teardown(): void {
		try {
			this.gain?.disconnect();
			for (const filter of this.filters) filter.disconnect();
			this.source?.disconnect();
			if (this.source && this.context) this.source.connect(this.context.destination);
		} catch {
			/* nothing safe to do here */
		}
		this.filters = [];
		this.gain = null;
		this.available = false;
	}

	dispose(): void {
		this.teardown();
		try {
			void this.context?.close();
		} catch {
			/* ignore */
		}
		this.context = null;
		this.source = null;
	}
}
