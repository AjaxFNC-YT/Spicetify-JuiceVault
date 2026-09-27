import { Emitter } from "../emitter";

const KEY = "juicevault:device";
const CHANGED_KEY = "juicevault:device-changed";

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
	showAltNames: boolean;
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
	showAltNames: true,
};

export interface DeviceSettingsChange {
	settings: DeviceSettings;
	patch: Partial<DeviceSettings>;
	remote: boolean;
}

const changes = new Emitter<{ changed: DeviceSettingsChange }>();

export function onDeviceSettings(handler: (change: DeviceSettingsChange) => void): () => void {
	return changes.on("changed", handler);
}

export const SYNCED_KEYS = Object.keys(DEFAULTS) as Array<keyof DeviceSettings>;

export function settingsChangedAt(): number {
	try {
		return Number(Spicetify.LocalStorage.get(CHANGED_KEY)) || 0;
	} catch {
		return 0;
	}
}

export function pickKnown(values: Record<string, unknown>): Partial<DeviceSettings> {
	const known: Record<string, unknown> = {};
	for (const key of SYNCED_KEYS) {
		if (key in values && typeof values[key] === typeof DEFAULTS[key]) known[key] = values[key];
	}
	return known as Partial<DeviceSettings>;
}

export function getDeviceSettings(): DeviceSettings {
	try {
		const raw = Spicetify.LocalStorage.get(KEY);
		return { ...DEFAULTS, ...(raw ? (JSON.parse(raw) as Partial<DeviceSettings>) : {}) };
	} catch {
		return { ...DEFAULTS };
	}
}

export function setDeviceSettings(patch: Partial<DeviceSettings>, remote = false, changedAt = Date.now()): DeviceSettings {
	const next = { ...getDeviceSettings(), ...patch };
	try {
		Spicetify.LocalStorage.set(KEY, JSON.stringify(next));
		Spicetify.LocalStorage.set(CHANGED_KEY, String(changedAt));
	} catch {
		return next;
	}
	changes.emit("changed", { settings: next, patch, remote });
	return next;
}

export function albumName(realAlbum?: string | null): string {
	const { albumMode, customAlbum } = getDeviceSettings();
	if (albumMode === "custom" && customAlbum.trim()) return customAlbum.trim();
	if (albumMode === "real" && realAlbum && realAlbum.trim()) return realAlbum.trim();
	return "JuiceVault";
}
