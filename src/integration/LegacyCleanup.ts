import { createLogger } from "../core/log";

const log = createLogger("LegacyCleanup");

const INSTALLED_KEY = "marketplace:installed-extensions";
const LEGACY_EXTENSION = "Spicetify-JuiceVault/JuiceVault.js";
const LEGACY_KEYS = ["juicevault-settings", "juicevault-eq-state"];

export function removeLegacyExtension(): void {
	try {
		const list: unknown[] = JSON.parse(window.localStorage.getItem(INSTALLED_KEY) ?? "[]");
		const legacy = list.filter((key) => String(key).includes(LEGACY_EXTENSION));
		if (legacy.length) {
			for (const key of legacy) window.localStorage.removeItem(String(key));
			window.localStorage.setItem(INSTALLED_KEY, JSON.stringify(list.filter((key) => !legacy.includes(key))));
			log.info("removed the old JuiceVault extension from Marketplace");
		}
		for (const key of LEGACY_KEYS) window.localStorage.removeItem(key);
	} catch (error) {
		log.debug("could not clean up the old extension", error);
	}
}
