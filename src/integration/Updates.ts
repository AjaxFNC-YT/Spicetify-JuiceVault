import { createLogger } from "../core/log";
import { Emitter } from "../core/emitter";
import { config, installCommand } from "../core/config";
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
const CHECK_EVERY_MS = 6 * 60 * 60 * 1000;

export interface Release {
	version: string;
	name: string;
	notes: string;
	url: string;
	date: string;
	prerelease: boolean;
}

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

async function fetchReleases(): Promise<Release[]> {
	const response = await fetch(`https://api.github.com/repos/${config.github.repo}/releases?per_page=20`, {
		headers: { Accept: "application/vnd.github+json" },
	});
	if (!response.ok) throw new Error(`GitHub answered ${response.status}`);
	const list: any[] = await response.json();
	return list
		.filter((entry) => !entry?.draft && typeof entry?.tag_name === "string")
		.map((entry) => ({
			version: entry.tag_name.replace(/^v/i, ""),
			name: entry.name || entry.tag_name,
			notes: typeof entry.body === "string" ? entry.body : "",
			url: entry.html_url,
			date: entry.published_at ?? entry.created_at ?? "",
			prerelease: Boolean(entry.prerelease),
		}));
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
			const includePre = isPrerelease(VERSION);
			const newest = (await this.load())
				.filter((entry) => includePre || !entry.prerelease)
				.sort((a, b) => compareVersions(b.version, a.version))[0];
			const available = Boolean(newest && compareVersions(newest.version, VERSION) > 0);
			this.setState({ latest: newest ?? null, available, checking: false, checkedAt: Date.now() });

			if (available && newest && (manual || read(DISMISSED_KEY) !== newest.version)) {
				await whenNoModal();
				openModal(
					"Update available",
					h(UpdateAvailable, {
						current: VERSION,
						release: newest,
						command: installCommand(),
						onLater: () => write(DISMISSED_KEY, newest.version),
					}),
					true,
				);
			}
		} catch (error) {
			log.debug("update check failed", error);
			this.setState({ checking: false, checkedAt: Date.now(), error: "Couldn't reach GitHub. Try again in a bit." });
		}
		return this.state;
	}

	dispose(): void {
		if (this.timer !== null) window.clearInterval(this.timer);
		this.timer = null;
	}
}
