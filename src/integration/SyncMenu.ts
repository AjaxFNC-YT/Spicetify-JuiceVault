import { createLogger } from "../core/log";
import type { Session } from "../core/auth/session";
import { describeError } from "../core/http/errors";
import { h, notify } from "../ui/h";
import { openModal } from "../ui/modal";
import { SourcePicker, type PickerMode } from "../ui/modals/SourcePicker";
import { RemoveJvSongs } from "../ui/modals/RemoveJvSongs";
import { LIKED_SONGS_URI, isLikedUri, type Destination, type PlaylistSync } from "./PlaylistSync";

declare const Spicetify: any;

const log = createLogger("SyncMenu");

function isTarget(uris: string[]): boolean {
	if (uris.length !== 1) return false;
	const uri = uris[0]!;
	return isLikedUri(uri) || Boolean(Spicetify.URI.isPlaylistV1OrV2?.(uri));
}

const RETRY_MS = 500;
const GIVE_UP_MS = 30000;

function menuRuntimeReady(): boolean {
	return Boolean(Spicetify.ReactJSX && Spicetify.ContextMenu?.Item && Spicetify.ContextMenu?.SubMenu && Spicetify.URI);
}

export function registerSyncMenu(sync: PlaylistSync, session: Session): () => void {
	return whenMenuReady("playlist menu", () => build(sync, session));
}

export function whenMenuReady(label: string, create: () => () => void): () => void {
	const started = Date.now();
	let stop: (() => void) | null = null;
	let timer: number | null = null;
	let disposed = false;

	const attempt = (): void => {
		timer = null;
		if (disposed) return;
		if (menuRuntimeReady()) {
			try {
				stop = create();
				return;
			} catch (error) {
				log.debug("menu not ready yet", error);
			}
		}
		if (Date.now() - started > GIVE_UP_MS) {
			log.warn(`could not add the JuiceVault ${label}; Spotify's menu runtime never became ready`);
			return;
		}
		timer = window.setTimeout(attempt, RETRY_MS);
	};

	attempt();

	return () => {
		disposed = true;
		if (timer !== null) window.clearTimeout(timer);
		stop?.();
	};
}

function build(sync: PlaylistSync, session: Session): () => void {
	const menu = Spicetify.ContextMenu;

	const resolve = async (uri: string): Promise<Destination | null> => {
		if (!session.isSignedIn) {
			notify("Log in to JuiceVault first", true);
			Spicetify.Platform.History.push("/juicevault?view=login");
			return null;
		}
		const target = isLikedUri(uri) ? LIKED_SONGS_URI : uri;
		const found = (await sync.destinations()).find((entry) => entry.uri === target);
		if (!found) notify("JuiceVault only works with playlists you own", true);
		return found ?? null;
	};

	const picker = (mode: PickerMode) => async (uris: string[]) => {
		const destination = await resolve(uris[0]!);
		if (!destination) return;
		const title = mode === "import" ? "Import from JuiceVault" : "Sync with JuiceVault";
		openModal(title, h(SourcePicker, { sync, mode, destination }), true);
	};

	const linked = (uris: string[]): boolean => uris.length === 1 && Boolean(sync.linkFor(uris[0]!));

	const items = [
		new menu.Item("Import from JuiceVault…", picker("import")),
		new menu.Item("Sync with JuiceVault…", picker("sync"), (uris: string[]) => !linked(uris)),
		new menu.Item(
			"Sync now",
			async (uris: string[]) => {
				try {
					const result = await sync.syncNow(uris[0]!, true);
					const changes = result.toSpotify.added + result.toSpotify.removed + result.toJuiceVault.added + result.toJuiceVault.removed;
					notify(changes ? "Synced with JuiceVault" : "Already up to date");
				} catch (error) {
					notify(describeError(error, "Could not sync"), true);
				}
			},
			linked,
		),
		new menu.Item(
			"Stop syncing with JuiceVault",
			(uris: string[]) => {
				sync.unlink(uris[0]!);
				notify("This playlist will no longer sync with JuiceVault");
			},
			linked,
		),
		new menu.Item("Remove JuiceVault songs…", async (uris: string[]) => {
			const destination = await resolve(uris[0]!);
			if (destination) openModal("Remove JuiceVault songs", h(RemoveJvSongs, { sync, initial: destination }));
		}),
	];

	const submenu = new menu.SubMenu("JuiceVault", items, isTarget);
	submenu.register();

	return () => submenu.deregister();
}
