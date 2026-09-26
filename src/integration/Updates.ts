import { createLogger } from "../core/log";
import { Emitter } from "../core/emitter";
import { assetUrl, installCommand, isWindows } from "../core/config";
import { get } from "../core/http/client";
import { VERSION, compareVersions, isPrerelease } from "../core/version";
import { h } from "../ui/h";
import { openModal, whenNoModal } from "../ui/modal";
import { UpdateAvailable, Welcome, WhatsNew } from "../ui/modals/Updates";

declare const Spicetify: any;

const log = createLogger("Updates");

const SEEN_KEY = "juicevault:version-seen";
const INSTALL_KEY = "juicevault:installed-version";
const DISMISSED_KEY = "juicevault:update-dismissed";
const LEGACY_VERSION_KEY = "juicevault-version";
const FIRST_CHECK_MS = 2500;
const CHECK_EVERY_MS = 60 * 60 * 1000;

export interface Release {
	version: string;
	notes: string;
	date: string;
	downloadUrl: string | null;
}

interface ApiRelease {
	version?: string;
	notes?: string;
	releasedAt?: string;
	downloadUrl?: string;
}

interface Envelope<T> {
	success: boolean;
	data: T;
}

const CHANNEL = isPrerelease(VERSION) ? "beta" : "stable";

export interface UpdateStatus {
	current: string;
	latest: Release | null;
	available: boolean;
	checking: boolean;
	checkedAt: number | null;
	error: string | null;
}

function read(key: string): string | null {
	try {
		return Spicetify.LocalStorage.get(key);
	} catch {
		return null;
	}
}

function write(key: string, value: string): void {
	try {
		Spicetify.LocalStorage.set(key, value);
	} catch {
		return;
	}
}

function hadLegacyExtension(): boolean {
	try {
		return Boolean(window.localStorage.getItem(LEGACY_VERSION_KEY));
	} catch {
		return false;
	}
}

function toRelease(raw: ApiRelease | null | undefined): Release | null {
	if (!raw || typeof raw.version !== "string") return null;
	return {
		version: raw.version.replace(/^v/i, ""),
		notes: typeof raw.notes === "string" ? raw.notes : "",
		date: raw.releasedAt ?? "",
		downloadUrl: assetUrl(raw.downloadUrl),
	};
}

async function fetchReleases(): Promise<Release[]> {
	const result = await get<Envelope<{ current: ApiRelease | null; history: ApiRelease[] }>>(`/misc/spicetify/versions?channel=${CHANNEL}`, { retries: 1 });
	const list = [result?.data?.current, ...(result?.data?.history ?? [])].map(toRelease).filter((entry): entry is Release => Boolean(entry));
	const unique = new Map(list.map((entry) => [entry.version, entry]));
	return [...unique.values()].sort((a, b) => compareVersions(b.version, a.version));
}

async function fetchLatest(): Promise<Release | null> {
	const result = await get<Envelope<{ updateAvailable?: boolean; latest?: ApiRelease }>>(
		`/misc/spicetify/checkUpdate?version=${encodeURIComponent(VERSION)}&channel=${CHANNEL}`,
		{ retries: 1 },
	);
	return result?.data?.updateAvailable ? toRelease(result.data.latest) : null;
}

export class Updates {
	readonly events = new Emitter<{ status: UpdateStatus }>();
	private state: UpdateStatus = { current: VERSION, latest: null, available: false, checking: false, checkedAt: null, error: null };
	private releases: Release[] | null = null;
	private timer: number | null = null;

	get status(): UpdateStatus {
		return this.state;
	}

	start(): void {
		void this.trackInstall();
		window.setTimeout(() => void this.boot(), FIRST_CHECK_MS);
		this.timer = window.setInterval(() => void this.check(false), CHECK_EVERY_MS);
	}

	private setState(patch: Partial<UpdateStatus>): void {
		this.state = { ...this.state, ...patch };
		this.events.emit("status", this.state);
	}

	private async trackInstall(): Promise<void> {
		if (read(INSTALL_KEY)) return;
		if (hadLegacyExtension()) {
			write(INSTALL_KEY, VERSION);
			return;
		}
		try {
			await get(`/misc/spicetify/newInstall?v=${encodeURIComponent(VERSION)}`, { retries: 1 });
			write(INSTALL_KEY, VERSION);
		} catch (error) {
			log.debug("install ping failed", error);
		}
	}

	private async boot(): Promise<void> {
		await this.announceVersion();
		await this.check(false);
	}

	private async load(): Promise<Release[]> {
		if (!this.releases) this.releases = await fetchReleases();
		return this.releases;
	}

	private async announceVersion(): Promise<void> {
		const seen = read(SEEN_KEY);
		if (seen === VERSION) return;
		write(SEEN_KEY, VERSION);

		if (!seen && !hadLegacyExtension()) {
			await whenNoModal();
			openModal("Welcome to JuiceVault", h(Welcome, null));
			return;
		}
		await this.whatsNew();
	}

	async whatsNew(): Promise<void> {
		let release: Release | null = null;
		try {
			release = (await this.load()).find((entry) => compareVersions(entry.version, VERSION) === 0) ?? null;
		} catch (error) {
			log.debug("could not load release notes", error);
		}
		await whenNoModal();
		openModal(`What's new in ${VERSION}`, h(WhatsNew, { version: VERSION, release }), true);
	}

	async check(manual: boolean): Promise<UpdateStatus> {
		this.setState({ checking: true, error: null });
		try {
			this.releases = null;
			const found = await fetchLatest();
			const newest = found && compareVersions(found.version, VERSION) > 0 ? found : null;
			const available = Boolean(newest);
			this.setState({ latest: newest, available, checking: false, checkedAt: Date.now() });

			if (available && newest && (manual || read(DISMISSED_KEY) !== newest.version)) {
				await whenNoModal();
				openModal(
					"Update available",
					h(UpdateAvailable, {
						current: VERSION,
						release: newest,
						command: installCommand(),
						shell: isWindows() ? "PowerShell" : "Terminal",
						onLater: () => write(DISMISSED_KEY, newest.version),
					}),
					true,
				);
			}
		} catch (error) {
			log.debug("update check failed", error);
			this.setState({ checking: false, checkedAt: Date.now(), error: "Couldn't check for updates. Try again in a bit." });
		}
		return this.state;
	}

	dispose(): void {
		if (this.timer !== null) window.clearInterval(this.timer);
		this.timer = null;
	}
}
