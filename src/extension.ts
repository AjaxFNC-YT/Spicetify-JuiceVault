import { assetUrl, config, coverUrl } from "./core/config";
import { createLogger } from "./core/log";
import { ShadowPlayer, type ShadowTrack } from "./playback/ShadowPlayer";
import { Arbiter } from "./playback/Arbiter";
import { Queue } from "./playback/Queue";
import { saveSession, loadSession, clearSession, type SavedSession } from "./playback/Session";
import { Equalizer } from "./playback/Equalizer";
import { initialFrequencies, describeEqualizer, watchEqualizer } from "./integration/SpotifyEq";
import { traceForJv } from "./integration/trace";
import { buildTrackUri, isJvUri, parseSongId } from "./integration/uri";
import { PlayInterceptor } from "./integration/PlayInterceptor";
import { Playability } from "./integration/Playability";
import { forgetMetadata, getMetadata } from "./core/api/songs";
import { Catalog } from "./core/catalog/catalog";
import { Session } from "./core/auth/session";
import { updateProfile, changePassword, listeningStats, listeningActivity, type ProfilePatch } from "./core/api/account";
import { getDeviceSettings, setDeviceSettings } from "./core/settings/device";
import { logListen, getHistory, communityLeaderboard } from "./core/api/history";
import { cachedUnheardIds, forgetUnheardRequest, getPlaylist, UNHEARD_ID } from "./core/api/playlists";
import { Scrobbler } from "./playback/Scrobbler";
import { PlaylistSync } from "./integration/PlaylistSync";
import { registerSyncMenu } from "./integration/SyncMenu";
import { registerTrackMenu } from "./integration/TrackMenu";
import { registerNativeTags } from "./integration/NativeTags";
import { applyCuration, curationTargets } from "./integration/curation";
import { knownAlbum, onAlbums, requestAlbums } from "./core/catalog/albums";
import { onDeviceSettings } from "./core/settings/device";
import { SearchInjector } from "./integration/SearchInjector";
import { Announcements } from "./integration/Announcements";
import { Updates, type UpdateStatus } from "./integration/Updates";
import { linkUrl, unlink, type Connection } from "./core/api/connections";
import { openInBrowser } from "./core/auth/oauth";

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
		album: meta.album ?? null,
		cover: assetUrl(meta.cover ?? null),
	};
}

function guard<T>(label: string, task: () => T, fallback: T): T {
	try {
		return task();
	} catch (error) {
		log.error(`${label} failed; continuing without it`, error);
		return fallback;
	}
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
	onDeviceSettings(({ patch }) => {
		if (patch.hideCutMarker === undefined) return;
		forgetMetadata();
		void catalog.load(true);
	});
	const session = new Session();
	void session.loadProfile();
	const playlistSync = new PlaylistSync(session);
	session.events.on("signedIn", () => {
		scrobbler.enable();
		guard("playlist sync", () => playlistSync.start(), undefined);
	});
	const searchInjector = new SearchInjector();
	const announcements = new Announcements();
	const updates = new Updates();
	let unregisterSyncMenu: () => void = () => {};
	let unregisterTrackMenu: () => void = () => {};
	let unregisterNativeTags: () => void = () => {};
	const player = new ShadowPlayer();
	const scrobbler = new Scrobbler(
		player,
		(listen, keepalive) => logListen(session, listen, keepalive),
		() => session.isSignedIn,
	);
	window.addEventListener("beforeunload", () => scrobbler.finish(true));
	scrobbler.events.on("completed", (songId) => {
		forgetUnheardRequest();
		for (const link of playlistSync.links()) {
			if (link.jvId !== UNHEARD_ID) continue;
			void playlistSync
				.syncNow(link.spotifyUri)
				.then(() => log.debug(`unheard updated after finishing ${songId}`))
				.catch((error) => log.warn("could not update the synced Unheard playlist", error));
		}
	});
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
	const equalizer = new Equalizer(player.element, initialFrequencies());

	const streamAllowsWebAudio = async (): Promise<boolean> => {
		try {
			const image = new Image();
			image.crossOrigin = "anonymous";
			image.src = `${coverUrl(config.dev.sampleSongId)}?cors-check=${Date.now()}`;
			await image.decode();
			const canvas = document.createElement("canvas");
			canvas.width = 1;
			canvas.height = 1;
			const context = canvas.getContext("2d");
			if (!context) return false;
			context.drawImage(image, 0, 0, 1, 1);
			context.getImageData(0, 0, 1, 1);
			return true;
		} catch {
			return false;
		}
	};

	const webAudioSafe = await streamAllowsWebAudio();

	if (!webAudioSafe) {
		log.warn(
			"equalizer disabled: JuiceVault media is not readable cross-origin here, so Web Audio would silence it.",
		);
	}

	if (webAudioSafe) {
		player.element.crossOrigin = "anonymous";
	}

	if (webAudioSafe && equalizer.attach()) {
		const stopEqWatch = watchEqualizer((snapshot) => {
			const device = getDeviceSettings();
			equalizer.setBoostDb(device.volumeTrimDb);
			const active = snapshot.enabled && device.useSpotifyEq;
			equalizer.setGains(active ? snapshot.gains : snapshot.gains.map(() => 0));
		});
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

	const trackUriFor = async (songId: string): Promise<string> => {
		const meta = await getMetadata(songId);
		const uri = buildTrackUri({ songId: meta.id, artist: meta.artist, title: meta.title, durationSeconds: meta.duration });
		playability.seed([uri]);
		return uri;
	};

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
		savedSession: () => loadSession(),
		clearSession,
		status: () => ({
			track: player.current,
			playing: player.isPlaying,
			position: Math.round(player.position),
			duration: Math.round(player.duration),
			volume: player.volume,
			catalog: catalog.diagnostics,
			session: session.diagnostics,
			scrobbler: scrobbler.diagnostics,
			...arbiter.diagnostics,
			interceptor: interceptor.diagnostics,
			playability: playability.diagnostics,
		}),
		interceptor,
		playability,
		catalog,
		session,
		signIn: (login: string, password: string) => session.signIn(login, password),
		signOut: () => session.signOut(),
		me: () => session.user,
		sync: playlistSync,
		news: announcements.news,
		onNews: (handler: (unseen: boolean) => void) => announcements.events.on("news", handler),
		connections: {
			link: async (connection: Connection): Promise<boolean> => {
				openInBrowser(await linkUrl(session, connection));
				const started = Date.now();
				while (Date.now() - started < 3 * 60 * 1000) {
					await new Promise((resolve) => setTimeout(resolve, 3000));
					const profile = await session.loadProfile();
					if (profile?.[connection]) return true;
				}
				return false;
			},
			unlink: (connection: Connection) => unlink(session, connection),
		},
		history: {
			list: (limit?: number, offset?: number) => getHistory(session, limit, offset),
		},
		leaderboard: () => communityLeaderboard(),
		unheard: async () => (await getPlaylist(session, UNHEARD_ID)).songs,
		unheardCached: () => cachedUnheardIds().map((id) => catalog.get(id)).filter((song): song is NonNullable<typeof song> => Boolean(song)),
		onListenCompleted: (handler: (songId: string) => void) => scrobbler.events.on("completed", handler),
		account: {
			update: (patch: ProfilePatch) => updateProfile(session, patch),
			changePassword: (current: string, next: string) => changePassword(session, current, next),
			stats: () => listeningStats(session),
			activity: () => listeningActivity(session),
		},
		device: {
			get: getDeviceSettings,
			set: setDeviceSettings,
		},
		search: (query: string, limit?: number) => catalog.searchSongs(query, limit),
		reloadCatalog: () => catalog.load(true),
		queue,
		async addToPlaylist(playlistUri: string, songId: string = config.dev.sampleSongId): Promise<string> {
			const uri = await trackUriFor(songId);
			await Spicetify.Platform.PlaylistAPI.add(playlistUri, [uri], { before: "end" });
			return uri;
		},
		updates: {
			status: () => updates.status,
			check: () => updates.check(true),
			whatsNew: () => updates.whatsNew(),
			on: (handler: (status: UpdateStatus) => void) => updates.events.on("status", handler),
		},
		albums: {
			get: knownAlbum,
			request: requestAlbums,
			on: onAlbums,
		},
		curation: {
			targets: async (songId: string) => curationTargets(await trackUriFor(songId)),
			apply: async (songId: string, add: string[], remove: string[]) => applyCuration(await trackUriFor(songId), add, remove),
		},
		async saveToLiked(songId: string): Promise<void> {
			const uri = await trackUriFor(songId);
			await Spicetify.Platform.LibraryAPI.add({ uris: [uri] });
		},
		async newPlaylistWith(songId: string): Promise<string> {
			const meta = await getMetadata(songId);
			const playlistUri: string | null = await Spicetify.Platform.RootlistAPI.createPlaylist(meta.title, { after: "start" });
			if (!playlistUri) throw new Error("Spotify did not create the playlist");
			await Spicetify.Platform.PlaylistAPI.add(playlistUri, [await trackUriFor(songId)], { before: "end" });
			return playlistUri;
		},
		dumpQueue: () => interceptor.inspectQueue(),
		dumpQueueStore: () => interceptor.inspectQueueStore(),
		bootLog: () => interceptor.bootLog,
		trace: (seconds?: number) => traceForJv(seconds),
		dumpEqualizer: () => describeEqualizer(),
		dumpPlaylist: (uri: string) => playability.inspectPlaylist(uri),
		equalizer,
		playList: (songs: any[], index: number, contextName?: string) => interceptor.playFromSongs(songs, index, contextName),
		playlists: async () => {
			const contents = await Spicetify.Platform.RootlistAPI.getContents({ limit: 200 });
			return (contents?.items ?? [])
				.filter((item: any) => item.type === "playlist" && item.canAdd !== false && item.isOwnedBySelf)
				.map((item: any) => ({ uri: item.uri, name: item.name }));
		},
		isJvUri,
		parseSongId,
		claim: () => arbiter.claim(),
		release: () => arbiter.release(),
		forcePush: () => {
			arbiter.push(true);
			return arbiter.diagnostics;
		},
		dispose: () => {
			scrobbler.dispose();
			playlistSync.dispose();
			unregisterSyncMenu();
			unregisterTrackMenu();
			unregisterNativeTags();
			searchInjector.dispose();
			announcements.dispose();
			updates.dispose();
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

	guard("search", () => searchInjector.start(), undefined);
	guard("updates", () => updates.start(), undefined);
	guard("announcements", () => announcements.start(), undefined);
	unregisterSyncMenu = guard("playlist menu", () => registerSyncMenu(playlistSync, session), () => {});
	unregisterTrackMenu = guard("track menu", () => registerTrackMenu(catalog), () => {});
	unregisterNativeTags = guard("native tags", () => registerNativeTags(catalog), () => {});
	if (session.isSignedIn) guard("playlist sync", () => playlistSync.start(), undefined);

	const saved = loadSession();
	if (saved && getDeviceSettings().resumeOnLaunch) await restore(saved);

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
