const KEY = "juicevault:device";

export type AlbumMode = "real" | "juicevault" | "custom";

export interface DeviceSettings {
	resumeOnLaunch: boolean;
	albumMode: AlbumMode;
	customAlbum: string;
}

const DEFAULTS: DeviceSettings = {
	resumeOnLaunch: true,
	albumMode: "juicevault",
	customAlbum: "",
};

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
	return next;
}

export function albumName(realAlbum?: string | null): string {
	const { albumMode, customAlbum } = getDeviceSettings();
	if (albumMode === "custom" && customAlbum.trim()) return customAlbum.trim();
	if (albumMode === "real" && realAlbum && realAlbum.trim()) return realAlbum.trim();
	return "JuiceVault";
}
