import { config, coverUrl, streamUrl } from "./core/config";
import { createLogger } from "./core/log";
import { ShadowPlayer, type ShadowTrack } from "./playback/ShadowPlayer";
import { Arbiter } from "./playback/Arbiter";
import { Queue } from "./playback/Queue";
import { saveSession, loadSession, clearSession, type SavedSession } from "./playback/Session";
import { Equalizer } from "./playback/Equalizer";
import { readEqualizer, describeEqualizer, watchEqualizer } from "./integration/SpotifyEq";
import { traceForJv } from "./integration/trace";
import { buildTrackUri, isJvUri, parseSongId } from "./integration/uri";
import { PlayInterceptor } from "./integration/PlayInterceptor";
import { Playability } from "./integration/Playability";
import { getMetadata } from "./core/api/songs";
import { Catalog } from "./core/catalog/catalog";

const log = createLogger("boot");

async function waitFor(predicate: () => boolean, timeoutMs = 30000): Promise<boolean> {
	const started = Date.now();
	while (Date.now() - started < timeoutMs) {
		try {
			if (predicate()) return true;
		} catch {
			/* keep waiting */
		}
		await new Promise((resolve) => setTimeout(resolve, 50));
	}
	return false;
}

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
	const platformReady = await waitFor(
		() => Boolean(typeof Spicetify !== "undefined" && Spicetify.Platform?.PlaylistAPI),
	);

	const earlyPlayability = new Playability();
	if (platformReady) {
		earlyPlayability.install();
		earlyPlayability.refreshViews();
		earlyPlayability.ensureFreshOnce();
		log.info("playability installed early");
	}

	const ready = await waitForSpicetify();
	if (!ready) {
		log.error("Spicetify never became available; aborting boot");
		return;
	}

	const disposers: Array<() => void> = [];
	const catalog = new Catalog();
	void catalog.load();
	const player = new ShadowPlayer();
	const queue = new Queue();

	let advance: (direction: 1 | -1) => void = () => {};
	const arbiter = new Arbiter(
		player,
		queue,
		(direction) => advance(direction),
		() => clearSession(),
	);
	const interceptor = new PlayInterceptor(player, arbiter, queue);
	advance = (direction) => interceptor.advanceQueue(direction);

	const playability = earlyPlayability;
	playability.install();
	playability.refreshViews();
	const eqSnapshot = readEqualizer();
	const equalizer = new Equalizer(player.element, eqSnapshot?.frequencies);

	const streamAllowsWebAudio = async (): Promise<boolean> => {
		try {
			const response = await fetch(streamUrl(config.dev.sampleSongId), { headers: { Range: "bytes=0-1" } });
			return Boolean(response.headers.get("access-control-allow-origin"));
		} catch {
			return false;
		}
	};

	const webAudioSafe = await streamAllowsWebAudio();

	if (!webAudioSafe) {
		log.warn(
			"equalizer disabled: api.juicevault.xyz does not send Access-Control-Allow-Origin. " +
				"Web Audio would silence the stream. Add the header to enable EQ.",
		);
	}

	if (webAudioSafe) {
		player.element.crossOrigin = "anonymous";
	}

	if (webAudioSafe && equalizer.attach()) {
		const applyEq = (): void => {
			const snapshot = readEqualizer();
			if (!snapshot) return;
			equalizer.setGains(snapshot.enabled ? snapshot.gains : snapshot.gains.map(() => 0));
		};
		applyEq();
		const stopEqWatch = watchEqualizer(() => applyEq());
		player.events.on("play", () => void equalizer.resume());
		disposers.push(stopEqWatch);
	}

	playability.install();
	interceptor.install();

	disposers.push(playability.watchNavigation());

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

	player.events.on("play", () => {
		persist(true);
		interceptor.syncQueueStore();
	});
	player.events.on("pause", () => persist(true));
	player.events.on("stalled", () => persist(true));
	player.events.on("progress", () => persist(false));
	window.addEventListener("beforeunload", () => persist(true));

	const restore = async (saved: SavedSession): Promise<void> => {
		try {
			const restoredUri = buildTrackUri({
				songId: saved.songId,
				artist: saved.artist,
				title: saved.title,
				durationSeconds: saved.durationSeconds,
			});

			if (saved.contextUri) {
				await interceptor.adoptContext(saved.contextUri, { uid: saved.uid, uri: restoredUri });
				queue.syncTo(saved.uid, restoredUri);
			}
			queue.setShuffle(saved.shuffle);
			queue.setRepeat((saved.repeat ?? 0) as 0 | 1 | 2);
			arbiter.setPlaybackContext({ uid: saved.uid, contextUri: saved.contextUri });

			const off = player.events.on("ready", () => {
				off();
				player.seek(saved.positionSeconds);
				arbiter.push(true);
				interceptor.syncQueueStore();
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
			catalog: catalog.diagnostics,
			...arbiter.diagnostics,
			interceptor: interceptor.diagnostics,
			playability: playability.diagnostics,
		}),
		interceptor,
		playability,
		catalog,
		search: (query: string, limit?: number) => catalog.search(query, limit).map((result) => result.song),
		reloadCatalog: () => catalog.load(true),
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
		bootLog: () => interceptor.bootLog,
		trace: (seconds?: number) => traceForJv(seconds),
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

	let settleTicks = 0;
	const settleTimer = window.setInterval(() => {
		settleTicks += 1;
		interceptor.syncQueueStore();
		if (settleTicks >= 20) window.clearInterval(settleTimer);
	}, 750);
	disposers.push(() => window.clearInterval(settleTimer));

	log.info("ready — try JuiceVault.play() in this console");
}

main().catch((error) => log.error("boot failed", error));
