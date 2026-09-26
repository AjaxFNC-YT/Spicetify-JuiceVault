import { createLogger } from "../core/log";

const log = createLogger("Equalizer");

const DEFAULT_BANDS = [60, 150, 400, 1000, 2400, 15000];
const PEAK_Q = 0.9;
const RAMP_SECONDS = 0.05;
const RESPONSE_POINTS = 256;

export class Equalizer {
	private context: AudioContext | null = null;
	private source: MediaElementAudioSourceNode | null = null;
	private filters: BiquadFilterNode[] = [];
	private gain: GainNode | null = null;
	private preamp: GainNode | null = null;
	private boost: GainNode | null = null;
	private limiter: DynamicsCompressorNode | null = null;
	private headroomDb = 0;
	private probe: Float32Array<ArrayBuffer> = Equalizer.probeFrequencies();
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
			this.preamp = this.context.createGain();
			this.boost = this.context.createGain();
			this.limiter = this.context.createDynamicsCompressor();
			this.limiter.threshold.value = -1;
			this.limiter.knee.value = 0;
			this.limiter.ratio.value = 20;
			this.limiter.attack.value = 0.003;
			this.limiter.release.value = 0.12;

			this.filters = this.frequencies.map((frequency, index) => {
				const filter = this.context!.createBiquadFilter();
				filter.type = index === 0 ? "lowshelf" : index === this.frequencies.length - 1 ? "highshelf" : "peaking";
				filter.frequency.value = frequency;
				filter.Q.value = PEAK_Q;
				filter.gain.value = 0;
				return filter;
			});

			let node: AudioNode = this.source;
			for (const filter of this.filters) {
				node.connect(filter);
				node = filter;
			}
			node.connect(this.preamp);
			this.preamp.connect(this.boost);
			this.boost.connect(this.gain);
			this.gain.connect(this.limiter);
			this.limiter.connect(this.context.destination);

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

	private static probeFrequencies(): Float32Array<ArrayBuffer> {
		const points = new Float32Array(RESPONSE_POINTS);
		const low = Math.log10(20);
		const high = Math.log10(20000);
		for (let i = 0; i < RESPONSE_POINTS; i += 1) points[i] = Math.pow(10, low + ((high - low) * i) / (RESPONSE_POINTS - 1));
		return points;
	}

	private peakBoostDb(): number {
		const combined = new Float32Array(RESPONSE_POINTS).fill(1);
		const magnitude = new Float32Array(RESPONSE_POINTS);
		const phase = new Float32Array(RESPONSE_POINTS);
		for (const filter of this.filters) {
			filter.getFrequencyResponse(this.probe, magnitude, phase);
			for (let i = 0; i < RESPONSE_POINTS; i += 1) combined[i]! *= magnitude[i]!;
		}
		let peak = 0;
		for (const value of combined) if (value > peak) peak = value;
		return peak > 0 ? 20 * Math.log10(peak) : 0;
	}

	setGains(gains: number[]): void {
		if (!this.available || !this.context) return;
		this.lastGains = gains;
		const now = this.context.currentTime;

		this.filters.forEach((filter, index) => {
			const value = Number(gains[index]);
			const target = Number.isFinite(value) ? value : 0;
			filter.gain.cancelScheduledValues(now);
			filter.gain.value = target;
		});

		this.headroomDb = Math.max(0, this.peakBoostDb());
		if (this.preamp) {
			this.preamp.gain.cancelScheduledValues(now);
			this.preamp.gain.setTargetAtTime(Math.pow(10, -this.headroomDb / 20), now, RAMP_SECONDS / 3);
		}
	}

	setBoostDb(db: number): void {
		if (!this.boost || !this.context) return;
		const target = Math.pow(10, Math.max(0, Math.min(12, db)) / 20);
		if (Math.abs(this.boost.gain.value - target) < 0.001) return;
		const now = this.context.currentTime;
		this.boost.gain.cancelScheduledValues(now);
		this.boost.gain.setTargetAtTime(target, now, RAMP_SECONDS / 3);
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
			headroomDb: Math.round(this.headroomDb * 10) / 10,
			boostDb: this.boost ? Math.round(20 * Math.log10(Math.max(this.boost.gain.value, 1e-6)) * 10) / 10 : null,
		};
	}

	private teardown(): void {
		try {
			this.gain?.disconnect();
			this.preamp?.disconnect();
			this.boost?.disconnect();
			this.limiter?.disconnect();
			for (const filter of this.filters) filter.disconnect();
			this.source?.disconnect();
			if (this.source && this.context) this.source.connect(this.context.destination);
		} catch {
			/* nothing safe to do here */
		}
		this.filters = [];
		this.gain = null;
		this.preamp = null;
		this.boost = null;
		this.limiter = null;
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
