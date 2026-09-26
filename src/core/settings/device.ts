import { Emitter } from "../emitter";

const KEY = "juicevault:device";

export const DEFAULT_TRIM_DB = -6;

export type AlbumMode = "real" | "juicevault" | "custom";

export interface DeviceSettings {
	resumeOnLaunch: boolean;
	showInSearch: boolean;
	searchMode: "spotify" | "juicevault";
	fuzzySearch: boolean;
	volumeTrimDb: number;
	useSpotifyEq: boolean;
	autoChangelog: boolean;
	albumMode: AlbumMode;
	customAlbum: string;
	showTags: boolean;
	showNativeTags: boolean;
	coloredTags: boolean;
	hideCutMarker: boolean;
	tidyMenus: boolean;
	jvCopyLink: boolean;
	copySongName: boolean;
}

const DEFAULTS: DeviceSettings = {
	resumeOnLaunch: true,
	showInSearch: true,
	searchMode: "spotify",
	fuzzySearch: true,
	volumeTrimDb: DEFAULT_TRIM_DB,
	useSpotifyEq: true,
	autoChangelog: true,
	albumMode: "juicevault",
	customAlbum: "",
	showTags: true,
	showNativeTags: true,
	coloredTags: false,
	hideCutMarker: true,
	tidyMenus: true,
	jvCopyLink: true,
	copySongName: true,
};

const changes = new Emitter<{ changed: { settings: DeviceSettings; patch: Partial<DeviceSettings> } }>();

export function onDeviceSettings(handler: (change: { settings: DeviceSettings; patch: Partial<DeviceSettings> }) => void): () => void {
	return changes.on("changed", handler);
}

export function getDeviceSettings(): DeviceSettings {
	try {
		const raw = Spicetify.LocalStorage.get(KEY);
		return { ...DEFAULTS, ...(raw ? (JSON.parse(raw) as Partial<DeviceSettings>) : {}) };
	} catch {
		return { ...DEFAULTS };
	}
}

export function setDeviceSettings(patch: Partial<DeviceSettings>): DeviceSettings {
	const next = { ...getDeviceSettings(), ...patch };
	try {
		Spicetify.LocalStorage.set(KEY, JSON.stringify(next));
	} catch {
		return next;
	}
	changes.emit("changed", { settings: next, patch });
	return next;
}

export function albumName(realAlbum?: string | null): string {
	const { albumMode, customAlbum } = getDeviceSettings();
	if (albumMode === "custom" && customAlbum.trim()) return customAlbum.trim();
	if (albumMode === "real" && realAlbum && realAlbum.trim()) return realAlbum.trim();
	return "JuiceVault";
}
