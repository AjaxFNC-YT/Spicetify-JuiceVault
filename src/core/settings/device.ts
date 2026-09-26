const KEY = "juicevault:device";

export interface DeviceSettings {
	resumeOnLaunch: boolean;
}

const DEFAULTS: DeviceSettings = {
	resumeOnLaunch: true,
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
