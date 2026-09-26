import { createLogger } from "../core/log";
import { ApiError } from "../core/http/errors";
import { Emitter, type Unsubscribe } from "../core/emitter";
import type { Listen } from "../core/api/history";
import type { ShadowPlayer, ShadowTrack } from "./ShadowPlayer";

const log = createLogger("Scrobbler");

const EARLY_CHECKPOINT_SECONDS = 30;
const COMPLETION_RATIO = 0.7;
const MIN_FINAL_SECONDS = 5;
const TICK_TOLERANCE_SECONDS = 0.35;
const RESTART_POSITION_SECONDS = 1;

type Send = (listen: Listen, keepalive: boolean) => Promise<void>;

interface Play {
	songId: string;
	playSessionId: string;
	duration: number;
	listened: number;
	sent: number;
	earlySent: boolean;
	completeSent: boolean;
	completionReported: boolean;
	intervals: Array<[number, number]>;
}

function newSessionId(): string {
	const bytes = new Uint8Array(12);
	crypto.getRandomValues(bytes);
	return `jvs_${Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}

export class Scrobbler {
	readonly events = new Emitter<{ completed: string }>();
	private play: Play | null = null;
	private lastPosition = 0;
	private lastWall = 0;
	private seeking = false;
	private disabled = false;
	private sentCount = 0;
	private lastError: string | null = null;
	private unsubscribes: Unsubscribe[] = [];

	constructor(
		private readonly player: ShadowPlayer,
		private readonly send: Send,
		private readonly canSend: () => boolean,
	) {
		const { events } = player;
		this.unsubscribes.push(
			events.on("loading", (track) => this.begin(track)),
			events.on("play", () => this.anchor(this.player.position)),
			events.on("seeking", () => {
				this.seeking = true;
			}),
			events.on("seeked", (position) => this.onSeeked(position)),
			events.on("progress", ({ position }) => this.tick(position)),
			events.on("pause", () => this.flush(false)),
			events.on("ended", () => this.finish(false)),
			events.on("stopped", () => this.finish(false)),
		);
	}

	enable(): void {
		this.disabled = false;
	}

	private begin(track: ShadowTrack): void {
		this.finish(false);
		this.play = {
			songId: track.songId,
			playSessionId: newSessionId(),
			duration: track.durationSeconds,
			listened: 0,
			sent: 0,
			earlySent: false,
			completeSent: false,
			completionReported: false,
			intervals: [],
		};
		this.anchor(0);
	}

	private anchor(position: number): void {
		this.lastPosition = position;
		this.lastWall = performance.now();
		this.seeking = false;
	}

	private onSeeked(position: number): void {
		const play = this.play;
		const track = this.player.current;
		if (play && track && position < RESTART_POSITION_SECONDS && play.listened >= MIN_FINAL_SECONDS) {
			this.begin(track);
		}
		this.anchor(position);
	}

	private cover(from: number, to: number): number {
		const play = this.play!;
		const merged: Array<[number, number]> = [];
		for (const range of [...play.intervals, [from, to] as [number, number]].sort((a, b) => a[0] - b[0])) {
			const last = merged[merged.length - 1];
			if (last && range[0] <= last[1] + 0.05) last[1] = Math.max(last[1], range[1]);
			else merged.push([range[0], range[1]]);
		}
		play.intervals = merged;
		return merged.reduce((total, [start, end]) => total + (end - start), 0);
	}

	private tick(position: number): void {
		const play = this.play;
		const now = performance.now();
		const wall = (now - this.lastWall) / 1000;
		const previous = this.lastPosition;
		this.lastPosition = position;
		this.lastWall = now;

		if (!play || !this.player.isPlaying || this.seeking) return;

		const delta = position - previous;
		const rate = this.player.element.playbackRate || 1;
		if (delta <= 0 || delta > wall * rate + TICK_TOLERANCE_SECONDS) return;

		play.listened = this.cover(previous, position);
		const duration = this.player.duration || play.duration;
		if (duration > 0) play.duration = duration;

		if (!play.earlySent && play.listened >= Math.min(EARLY_CHECKPOINT_SECONDS, play.duration * 0.5)) {
			play.earlySent = true;
			void this.report(play, false);
		}

		if (!play.completeSent && play.duration > 0 && play.listened >= play.duration * COMPLETION_RATIO) {
			play.completeSent = true;
			void this.report(play, false);
		}
	}

	private flush(keepalive: boolean): void {
		const play = this.play;
		if (!play || play.listened < MIN_FINAL_SECONDS || play.listened - play.sent < 1) return;
		void this.report(play, keepalive);
	}

	finish(keepalive: boolean): void {
		this.flush(keepalive);
		this.play = null;
	}

	private async report(play: Play, keepalive: boolean): Promise<void> {
		if (this.disabled || !this.canSend()) return;

		const duration = Math.max(1, Math.round(play.listened * 10) / 10);
		if (duration <= play.sent) return;
		play.sent = duration;

		try {
			await this.send({ songId: play.songId, duration, playSessionId: play.playSessionId, source: "spotify" }, keepalive);
			this.sentCount += 1;
			this.lastError = null;
			log.debug(`logged ${duration}s of ${play.songId}`);
			if (!play.completionReported && play.duration > 0 && duration >= play.duration * COMPLETION_RATIO) {
				play.completionReported = true;
				this.events.emit("completed", play.songId);
			}
		} catch (error) {
			if (error instanceof ApiError && error.status === 409) {
				play.playSessionId = newSessionId();
				play.sent = 0;
				return;
			}
			if (error instanceof ApiError && error.status === 403) {
				this.disabled = true;
				this.lastError = "email not verified";
				log.warn("listens are not being saved: verify your email on juicevault.xyz");
				return;
			}
			play.sent = 0;
			this.lastError = error instanceof Error ? error.message : String(error);
			log.debug("could not log listen", error);
		}
	}

	get diagnostics(): Record<string, unknown> {
		return {
			active: this.play
				? {
						songId: this.play.songId,
						heard: Math.round(this.play.listened),
						of: Math.round(this.play.duration),
						percent: this.play.duration ? Math.round((this.play.listened / this.play.duration) * 100) : 0,
						sent: this.play.sent,
						ranges: this.play.intervals.map(([start, end]) => `${Math.round(start)}-${Math.round(end)}`),
					}
				: null,
			sentCount: this.sentCount,
			disabled: this.disabled,
			lastError: this.lastError,
		};
	}

	dispose(): void {
		this.finish(true);
		for (const unsubscribe of this.unsubscribes) unsubscribe();
		this.unsubscribes = [];
	}
}
