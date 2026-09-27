import { createLogger } from "../core/log";
import { ApiError } from "../core/http/errors";
import type { Session } from "../core/auth/session";
import { getDeviceSettings, onDeviceSettings, pickKnown, setDeviceSettings, settingsChangedAt, SYNCED_KEYS } from "../core/settings/device";

const log = createLogger("SettingsSync");

const PATH = "/user/spicetify/settings";
const PUSH_DELAY_MS = 800;

interface Envelope {
	success: boolean;
	data: { settings: Record<string, unknown>; updatedAt: string | null };
}

export class SettingsSync {
	private timer: number | null = null;
	private unavailable = false;
	private stops: Array<() => void> = [];

	constructor(private readonly session: Session) {}

	start(): void {
		this.stops.push(
			this.session.events.on("signedIn", () => void this.pull()),
			onDeviceSettings(({ remote }) => {
				if (!remote) this.schedulePush();
			}),
		);
		if (this.session.isSignedIn) void this.pull();
	}

	private available(error: unknown): boolean {
		if (error instanceof ApiError && error.status === 404) {
			this.unavailable = true;
			log.debug("settings sync isn't available on the API yet");
			return false;
		}
		return true;
	}

	async pull(): Promise<void> {
		if (this.unavailable || !this.session.isSignedIn) return;
		try {
			const result = await this.session.authed<Envelope>(PATH, { retries: 1 });
			const remote = pickKnown(result?.data?.settings ?? {});
			const remoteAt = result?.data?.updatedAt ? Date.parse(result.data.updatedAt) : 0;

			if (remoteAt && Object.keys(remote).length && remoteAt > settingsChangedAt()) {
				setDeviceSettings(remote, true, remoteAt);
				log.info("loaded settings from your JuiceVault account");
			} else {
				await this.push();
			}
		} catch (error) {
			if (this.available(error)) log.debug("could not load settings", error);
		}
	}

	private schedulePush(): void {
		if (this.unavailable || !this.session.isSignedIn) return;
		if (this.timer !== null) window.clearTimeout(this.timer);
		this.timer = window.setTimeout(() => {
			this.timer = null;
			void this.push();
		}, PUSH_DELAY_MS);
	}

	private async push(): Promise<void> {
		if (this.unavailable || !this.session.isSignedIn) return;
		const current = getDeviceSettings();
		const settings = Object.fromEntries(SYNCED_KEYS.map((key) => [key, current[key]]));
		try {
			await this.session.authed<Envelope>(PATH, { method: "PUT", body: { settings }, retries: 1 });
		} catch (error) {
			if (this.available(error)) log.debug("could not save settings", error);
		}
	}

	dispose(): void {
		if (this.timer !== null) window.clearTimeout(this.timer);
		this.timer = null;
		for (const stop of this.stops) stop();
		this.stops = [];
	}
}
