import { createLogger } from "../core/log";
import type { Unsubscribe } from "../core/emitter";
import { probeCapabilities, type Capabilities } from "../integration/probe";
import { isJvUri } from "../integration/uri";
import { buildState, type PlaybackContext } from "./StateProjector";
import type { ShadowPlayer } from "./ShadowPlayer";
import { perceivedGain } from "./volume";
import { getDeviceSettings } from "../core/settings/device";
import type { Queue } from "./Queue";

const log = createLogger("Arbiter");
const PUSH_INTERVAL_MS = 1000;
const DRIFT_TOLERANCE_SECONDS = 1.5;

type AnyFn = (...args: any[]) => any;

export class Arbiter {
	private claimed = false;
	private snapshot: Record<string, any> | null = null;
	private originals = new Map<string, AnyFn>();
	private unsubscribes: Unsubscribe[] = [];
	private lastPush = 0;
	private anchorPosition = 0;
	private anchorTime = 0;
	private pushCount = 0;
	private lastError: string | null = null;
	private context: PlaybackContext | undefined;
	private lastEmitted: unknown = null;
	private unsubscribeUpdate: (() => void) | null = null;
	private lastReassert = 0;
	private trailingReassert: number | null = null;
	private reassertCount = 0;
	private volumeTimer: number | null = null;

	private capabilities: Capabilities;

	constructor(
		private readonly player: ShadowPlayer,
		private readonly queue: Queue,
		private readonly onAdvance: (direction: 1 | -1) => void,
		private readonly onRelease: () => void = () => {},
	) {
		this.capabilities = probeCapabilities();
		this.bindPlayer();
	}

	get isClaimed(): boolean {
		return this.claimed;
	}

	get playbackContext(): PlaybackContext | undefined {
		return this.context;
	}

	setPlaybackContext(context: PlaybackContext | undefined): void {
		this.context = context;
	}

	nameContext(contextUri: string, contextName: string): void {
		if (this.context?.contextUri !== contextUri || this.context.contextName === contextName) return;
		this.context = { ...this.context, contextName };
		this.push(true);
	}

	rememberOptions(options: { shuffle?: boolean; smartShuffle?: boolean; repeat?: number }): void {
		if (!this.snapshot) return;
		if (typeof options.shuffle === "boolean") this.snapshot.shuffle = options.shuffle;
		if (typeof options.smartShuffle === "boolean") this.snapshot.smartShuffle = options.smartShuffle;
		if (typeof options.repeat === "number") this.snapshot.repeat = options.repeat;
	}

	private get api(): any {
		return Spicetify.Platform.PlayerAPI;
	}

	private bindPlayer(): void {
		const { events } = this.player;
		this.unsubscribes.push(
			events.on("loading", () => this.claim()),
			events.on("ready", () => this.push(true)),
			events.on("play", () => this.push(true)),
			events.on("pause", () => this.push(true)),
			events.on("volume", () => this.push(true)),
			events.on("stalled", () => this.push(true)),
			events.on("progress", () => this.correctDrift()),
			events.on("ended", () => this.advance(1)),
			events.on("error", () => this.release()),
		);
	}

	claim(): void {
		if (this.claimed) return;

		this.capabilities = probeCapabilities();
		if (!this.capabilities.stateWritable || !this.capabilities.eventsEmit) {
			log.warn("cannot claim — capabilities:", this.capabilities);
			this.lastError = "capabilities unavailable";
			return;
		}

		this.snapshot = this.api._state ?? null;

		try {
			if (this.snapshot && this.snapshot.isPaused === false) Spicetify.Player.pause();
		} catch (error) {
			log.warn("could not pause Spotify before claiming", error);
		}

		this.shadowTransport();
		this.watchExternalUpdates();
		this.startVolumeSync();
		this.claimed = true;
		this.pushCount = 0;
		log.info("claimed player; baseline track was", this.snapshot?.item?.name ?? "(none)");
	}

	release(): void {
		if (!this.claimed) return;
		this.claimed = false;
		if (this.trailingReassert !== null) window.clearTimeout(this.trailingReassert);
		this.trailingReassert = null;
		this.stopVolumeSync();
		this.unsubscribeUpdate?.();
		this.unsubscribeUpdate = null;
		this.restoreTransport();

		try {
			if (this.snapshot) {
				this.api._state = this.snapshot;
				this.api._events.emit("update", this.snapshot);
			}
		} catch (error) {
			log.error("failed to restore player state", error);
		}

		this.snapshot = null;
		this.context = undefined;
		log.info("released player");
		this.onRelease();
	}

	private watchExternalUpdates(): void {
		try {
			const events = typeof this.api.getEvents === "function" ? this.api.getEvents() : this.api._events;
			const unsubscribe = events.addListener("update", this.onExternalUpdate);
			this.unsubscribeUpdate = typeof unsubscribe === "function" ? unsubscribe : null;
		} catch (error) {
			log.warn("could not watch external player updates", error);
		}
	}

	private onExternalUpdate = (event: any): void => {
		if (!this.claimed) return;

		const incoming = event?.data ?? event;
		if (!incoming || incoming === this.lastEmitted) return;
		if (isJvUri(incoming?.item?.uri)) return;

		const now = Date.now();
		if (now - this.lastReassert < 200) {
			if (this.trailingReassert === null) {
				this.trailingReassert = window.setTimeout(() => {
					this.trailingReassert = null;
					this.lastReassert = Date.now();
					this.push(true);
				}, 220);
			}
			return;
		}
		this.lastReassert = now;
		this.reassertCount += 1;

		log.debug("external update clobbered our state; re-asserting");
		this.push(true);
	};

	private advance(direction: 1 | -1): void {
		this.onAdvance(direction);
	}

	emitQueueUpdate(): void {
		if (!this.claimed) return;
		try {
			const queue = typeof this.api.getQueue === "function" ? this.api.getQueue() : this.api._queue;
			if (queue && typeof queue.then === "function") {
				void queue.then((value: unknown) => this.api._events.emit("queue_update", value));
				return;
			}
			this.api._events.emit("queue_update", queue ?? {});
		} catch (error) {
			log.debug("queue_update emit failed", error);
		}
	}

	private correctDrift(): void {
		if (!this.claimed || !this.player.isPlaying) return;
		const elapsed = (Date.now() - this.anchorTime) / 1000;
		const expected = this.anchorPosition + elapsed;
		if (Math.abs(this.player.position - expected) > DRIFT_TOLERANCE_SECONDS) this.push(true);
	}

	push(force: boolean): void {
		if (!this.claimed) {
			this.lastError = "not claimed";
			return;
		}
		const now = Date.now();
		if (!force && now - this.lastPush < PUSH_INTERVAL_MS) return;
		this.lastPush = now;

		const track = this.player.current;
		if (!track) {
			this.lastError = "no current track";
			return;
		}

		try {
			const state = buildState({
				baseline: this.snapshot,
				track,
				positionSeconds: this.player.position,
				durationSeconds: this.player.duration,
				isPaused: !this.player.isPlaying,
				context: this.context,
				nextItems: this.queue.upcoming(50),
				previousItems: this.queue.history(20),
				shuffle: this.queue.shuffle,
				smartShuffle: this.queue.shuffle && this.queue.smart,
				repeat: this.queue.repeat,
			});
			this.lastEmitted = state;
			this.api._state = state;
			this.api._events.emit("update", state);
			this.anchorPosition = this.player.position;
			this.anchorTime = now;
			this.pushCount += 1;
			this.lastError = null;
			if (this.pushCount === 1) log.info("first state push sent", state.item?.name);
		} catch (error) {
			this.lastError = error instanceof Error ? error.message : String(error);
			log.error("state push failed", error);
		}
	}

	get diagnostics(): Record<string, unknown> {
		return {
			claimed: this.claimed,
			pushCount: this.pushCount,
			reassertCount: this.reassertCount,
			watchingUpdates: Boolean(this.unsubscribeUpdate),
			queueSize: this.queue.size,
			queueShuffle: this.queue.shuffle,
			queueRepeat: this.queue.repeat,
			lastError: this.lastError,
			hasSnapshot: Boolean(this.snapshot),
			shadowed: [...this.originals.keys()],
			capabilities: this.capabilities,
			liveStateTrack: this.api?._state?.item?.name ?? null,
			playerDataTrack: Spicetify.Player?.data?.item?.name ?? null,
		};
	}

	private shadow(key: string, replacement: AnyFn): void {
		const api = this.api;
		const original = api[key];
		if (typeof original !== "function") return;
		this.originals.set(key, original.bind(api));
		Object.defineProperty(api, key, {
			value: replacement,
			writable: true,
			configurable: true,
			enumerable: false,
		});
	}

	private shadowTransport(): void {
		if (!this.capabilities.transportShadowable) {
			log.warn("transport methods are not shadowable on this client");
			return;
		}

		this.shadow("pause", () => {
			this.player.pause();
			this.push(true);
			return Promise.resolve();
		});

		this.shadow("resume", () => {
			void this.player.play();
			this.push(true);
			return Promise.resolve();
		});

		this.shadow("seekTo", (ms: number) => {
			this.player.seek(ms / 1000);
			this.push(true);
			return Promise.resolve();
		});

		this.shadow("seekBy", (ms: number) => {
			this.player.seek(this.player.position + ms / 1000);
			this.push(true);
			return Promise.resolve();
		});

	}

	private restoreTransport(): void {
		const api = this.api;
		for (const key of this.originals.keys()) delete api[key];
		this.originals.clear();
	}

	private readSpotifyVolume(): number | null {
		const candidates = [
			() => Spicetify.Platform.PlaybackAPI?.getVolume?.(),
			() => Spicetify.Player?.getVolume?.(),
		];
		for (const read of candidates) {
			try {
				const value = read();
				if (typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1) return value;
			} catch {
				continue;
			}
		}
		return null;
	}

	private syncVolume(): void {
		const volume = this.readSpotifyVolume();
		if (volume === null) return;
		const gain = perceivedGain(volume, getDeviceSettings().volumeTrimDb);
		if (Math.abs(this.player.volume - gain) < 0.0005) return;
		this.player.setVolume(gain);
	}

	private startVolumeSync(): void {
		this.syncVolume();
		if (this.volumeTimer !== null) return;
		this.volumeTimer = window.setInterval(() => this.syncVolume(), 400);
	}

	private stopVolumeSync(): void {
		if (this.volumeTimer !== null) window.clearInterval(this.volumeTimer);
		this.volumeTimer = null;
	}

	dispose(): void {
		this.release();
		for (const unsubscribe of this.unsubscribes) unsubscribe();
		this.unsubscribes = [];
	}
}
