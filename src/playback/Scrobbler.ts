import { createLogger } from "../core/log";
import { ApiError } from "../core/http/errors";
import type { Unsubscribe } from "../core/emitter";
import type { Listen } from "../core/api/history";
import type { ShadowPlayer, ShadowTrack } from "./ShadowPlayer";

const log = createLogger("Scrobbler");

const EARLY_CHECKPOINT_SECONDS = 30;
const COMPLETION_RATIO = 0.7;
const MIN_FINAL_SECONDS = 5;
const MAX_TICK_SECONDS = 2.5;

type Send = (listen: Listen, keepalive: boolean) => Promise<void>;

interface Play {
	songId: string;
	playSessionId: string;
	duration: number;
	listened: number;
	sent: number;
	earlySent: boolean;
	completeSent: boolean;
}

function newSessionId(): string {
	const bytes = new Uint8Array(12);
	crypto.getRandomValues(bytes);
	return `jvs_${Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}

export class Scrobbler {
	private play: Play | null = null;
	private lastPosition = 0;
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
			events.on("play", () => {
				this.lastPosition = this.player.position;
			}),
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
		};
		this.lastPosition = 0;
	}

	private tick(position: number): void {
		const play = this.play;
		if (!play || !this.player.isPlaying) {
			this.lastPosition = position;
			return;
		}

		const delta = position - this.lastPosition;
		this.lastPosition = position;
		if (delta <= 0 || delta > MAX_TICK_SECONDS) return;

		play.listened += delta;
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
			active: this.play ? { songId: this.play.songId, listened: Math.round(this.play.listened), sent: this.play.sent } : null,
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
