import { config, coverUrl } from "./core/config";
import { createLogger } from "./core/log";
import { ShadowPlayer, type ShadowTrack } from "./playback/ShadowPlayer";
import { Arbiter } from "./playback/Arbiter";
import { Queue } from "./playback/Queue";
import { saveSession, loadSession, clearSession, type SavedSession } from "./playback/Session";
import { Equalizer } from "./playback/Equalizer";
import { readEqualizer, describeEqualizer, watchEqualizer } from "./integration/SpotifyEq";
import { buildTrackUri, isJvUri, parseSongId } from "./integration/uri";
import { PlayInterceptor } from "./integration/PlayInterceptor";
import { Playability } from "./integration/Playability";
import { getMetadata } from "./core/api/songs";

const log = createLogger("boot");

async function waitForSpicetify(timeoutMs = 30000): Promise<boolean> {
	const started = Date.now();
	while (Date.now() - started < timeoutMs) {
		const api = typeof Spicetify !== "undefined" ? Spicetify.Platform?.PlayerAPI : null;
		if (api && api._state && api._events && Spicetify.Player) return true;
		await new Promise((resolve) => setTimeout(resolve, 200));
	}
	return false;
}

function toTrack(meta: Awaited<ReturnType<typeof getMetadata>>): ShadowTrack {
	return {
		songId: meta.id,
		title: meta.title,
		artist: meta.artist,
		durationSeconds: meta.duration,
	};
}

async function main(): Promise<void> {
	const ready = await waitForSpicetify();
	if (!ready) {
		log.error("Spicetify never became available; aborting boot");
		return;
	}

	const disposers: Array<() => void> = [];
	const player = new ShadowPlayer();
	const queue = new Queue();

	let advance: (item: any) => void = () => {};
	const arbiter = new Arbiter(
		player,
		queue,
		(item) => advance(item),
		() => clearSession(),
	);
	const interceptor = new PlayInterceptor(player, arbiter, queue);
	advance = (item) => void interceptor.playQueueItem(item);

	const playability = new Playability();
	const eqSnapshot = readEqualizer();
	const equalizer = new Equalizer(player.element, eqSnapshot?.frequencies);

	if (equalizer.attach()) {
		const applyEq = (): void => {
			const snapshot = readEqualizer();
			if (!snapshot) return;
			equalizer.setGains(snapshot.enabled ? snapshot.gains : snapshot.gains.map(() => 0));
		};
		applyEq();
		const stopEqWatch = watchEqualizer(() => applyEq());
		player.events.on("play", () => void equalizer.resume());
		disposers.push(stopEqWatch);
	} else {
		log.warn("equalizer unavailable; JuiceVault audio will not be processed");
	}

	playability.install();
	interceptor.install();

	let lastPersist = 0;
	const persist = (force: boolean): void => {
		const track = player.current;
		if (!track || !arbiter.isClaimed) return;
		const now = Date.now();
		if (!force && now - lastPersist < 5000) return;
		lastPersist = now;
		saveSession({
			songId: track.songId,
			title: track.title,
			artist: track.artist,
			durationSeconds: track.durationSeconds,
			positionSeconds: player.position,
			contextUri: interceptor.currentContextUri,
			uid: arbiter.playbackContext?.uid,
			shuffle: queue.shuffle,
			repeat: queue.repeat,
			savedAt: now,
		});
	};

	player.events.on("play", () => persist(true));
	player.events.on("pause", () => persist(true));
	player.events.on("stalled", () => persist(true));
	player.events.on("progress", () => persist(false));
	window.addEventListener("beforeunload", () => persist(true));

	const restore = async (saved: SavedSession): Promise<void> => {
		try {
			if (saved.contextUri) await interceptor.adoptContext(saved.contextUri, undefined);
			queue.setShuffle(saved.shuffle);
			queue.setRepeat((saved.repeat ?? 0) as 0 | 1 | 2);
			arbiter.setPlaybackContext({ uid: saved.uid, contextUri: saved.contextUri });

			const off = player.events.on("ready", () => {
				off();
				player.seek(saved.positionSeconds);
				arbiter.push(true);
			});

			await player.load(
				{
					songId: saved.songId,
					title: saved.title,
					artist: saved.artist,
					durationSeconds: saved.durationSeconds,
				},
				false,
			);
			log.info(`restored "${saved.title}" paused at ${Math.round(saved.positionSeconds)}s`);
		} catch (error) {
			log.warn("could not restore previous session", error);
			clearSession();
		}
	};

	player.events.on("ready", ({ track, duration }) => {
		log.info(`loaded "${track.title}" by ${track.artist} (${Math.round(duration)}s)`);
	});

	player.events.on("error", ({ message }) => {
		log.error(message);
		Spicetify.showNotification(`JuiceVault: ${message}`, true);
	});

	player.events.on("ended", (track) => {
		log.info("ended", track.title);
	});

	const api = {
		player,
		arbiter,

		coverUrl,
		uriFor: (track: ShadowTrack) =>
			buildTrackUri({
				songId: track.songId,
				artist: track.artist,
				title: track.title,
				durationSeconds: track.durationSeconds,
			}),
		async play(songId: string = config.dev.sampleSongId): Promise<ShadowTrack> {
			const meta = await getMetadata(songId);
			const track = toTrack(meta);
			await player.load(track);
			return track;
		},
		pause: () => player.pause(),
		toggle: () => player.toggle(),
		seek: (seconds: number) => player.seek(seconds),
		volume: (value: number) => player.setVolume(value),
		stop: () => {
			player.stop();
			arbiter.release();
			clearSession();
		},
		session: () => loadSession(),
		clearSession,
		status: () => ({
			track: player.current,
			playing: player.isPlaying,
			position: Math.round(player.position),
			duration: Math.round(player.duration),
			volume: player.volume,
			...arbiter.diagnostics,
			interceptor: interceptor.diagnostics,
			playability: playability.diagnostics,
		}),
		interceptor,
		playability,
		queue,
		async addToPlaylist(playlistUri: string, songId: string = config.dev.sampleSongId): Promise<string> {
			const meta = await getMetadata(songId);
			const uri = buildTrackUri({
				songId: meta.id,
				artist: meta.artist,
				title: meta.title,
				durationSeconds: meta.duration,
			});
			playability.seed([uri]);
			await Spicetify.Platform.PlaylistAPI.add(playlistUri, [uri], { before: "end" });
			log.info("added", meta.title, "to", playlistUri);
			return uri;
		},
		dumpQueue: () => interceptor.inspectQueue(),
		dumpQueueStore: () => interceptor.inspectQueueStore(),
		dumpEqualizer: () => describeEqualizer(),
		dumpPlaylist: (uri: string) => playability.inspectPlaylist(uri),
		equalizer,
		isJvUri,
		parseSongId,
		claim: () => arbiter.claim(),
		release: () => arbiter.release(),
		forcePush: () => {
			arbiter.push(true);
			return arbiter.diagnostics;
		},
		dispose: () => {
			for (const stop of disposers) stop();
			equalizer.dispose();
			interceptor.dispose();
			playability.dispose();
			arbiter.dispose();
			player.dispose();
			delete window.JuiceVault;
			log.info("disposed");
		},
	};

	window.JuiceVault = api;

	const saved = loadSession();
	if (saved) await restore(saved);

	log.info("ready — try JuiceVault.play() in this console");
}

main().catch((error) => log.error("boot failed", error));
