import { Emitter } from "../core/emitter";
import { createLogger } from "../core/log";
import { streamUrl } from "../core/config";

const log = createLogger("ShadowPlayer");

export interface ShadowTrack {
	songId: string;
	title: string;
	artist: string;
	durationSeconds: number;
}

export interface ShadowPlayerEvents {
	loading: ShadowTrack;
	ready: { track: ShadowTrack; duration: number };
	play: ShadowTrack;
	pause: ShadowTrack;
	progress: { position: number; duration: number };
	ended: ShadowTrack;
	stalled: ShadowTrack;
	volume: number;
	error: { track: ShadowTrack | null; message: string };
}

const ELEMENT_ID = "juicevault-audio";

export class ShadowPlayer {
	readonly events = new Emitter<ShadowPlayerEvents>();

	private audio: HTMLAudioElement;
	private track: ShadowTrack | null = null;

	constructor() {
		const existing = document.getElementById(ELEMENT_ID);
		if (existing) existing.remove();

		this.audio = new Audio();
		this.audio.id = ELEMENT_ID;
		this.audio.preload = "auto";
		this.audio.style.display = "none";
		document.body.appendChild(this.audio);

		this.bind();
	}

	private bind(): void {
		this.audio.addEventListener("loadedmetadata", () => {
			if (!this.track) return;
			this.events.emit("ready", { track: this.track, duration: this.audio.duration });
			log.debug("ready", this.track.title, `${Math.round(this.audio.duration)}s`);
		});

		this.audio.addEventListener("play", () => {
			if (this.track) this.events.emit("play", this.track);
		});

		this.audio.addEventListener("pause", () => {
			if (this.track) this.events.emit("pause", this.track);
		});

		this.audio.addEventListener("timeupdate", () => {
			this.events.emit("progress", { position: this.audio.currentTime, duration: this.audio.duration });
		});

		this.audio.addEventListener("ended", () => {
			if (this.track) this.events.emit("ended", this.track);
		});

		for (const name of ["waiting", "stalled", "playing", "seeked"]) {
			this.audio.addEventListener(name, () => {
				if (this.track) this.events.emit("stalled", this.track);
			});
		}

		this.audio.addEventListener("volumechange", () => {
			this.events.emit("volume", this.audio.volume);
		});

		this.audio.addEventListener("error", () => {
			const err = this.audio.error;
			const message = err ? `code ${err.code}: ${err.message || "media error"}` : "unknown media error";
			log.error(message, this.track?.songId);
			this.events.emit("error", { track: this.track, message });
		});
	}

	get element(): HTMLAudioElement {
		return this.audio;
	}

	get current(): ShadowTrack | null {
		return this.track;
	}

	get isPlaying(): boolean {
		return !this.audio.paused && !this.audio.ended;
	}

	get position(): number {
		return this.audio.currentTime;
	}

	get duration(): number {
		return Number.isFinite(this.audio.duration) ? this.audio.duration : (this.track?.durationSeconds ?? 0);
	}

	get volume(): number {
		return this.audio.volume;
	}

	async load(track: ShadowTrack, autoplay = true): Promise<void> {
		this.track = track;
		this.events.emit("loading", track);
		this.audio.src = streamUrl(track.songId);
		this.audio.load();
		if (autoplay) await this.play();
	}

	async play(): Promise<void> {
		if (!this.track) return;
		try {
			await this.audio.play();
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			log.error("play rejected", message);
			this.events.emit("error", { track: this.track, message });
		}
	}

	pause(): void {
		this.audio.pause();
	}

	async toggle(): Promise<void> {
		if (this.isPlaying) this.pause();
		else await this.play();
	}

	seek(seconds: number): void {
		if (!Number.isFinite(seconds)) return;
		const max = this.duration || 0;
		this.audio.currentTime = Math.max(0, Math.min(seconds, max));
	}

	setVolume(value: number): void {
		this.audio.volume = Math.max(0, Math.min(1, value));
	}

	stop(): void {
		this.audio.pause();
		this.audio.removeAttribute("src");
		this.audio.load();
		this.track = null;
	}

	dispose(): void {
		this.stop();
		this.events.clear();
		this.audio.remove();
	}
}
