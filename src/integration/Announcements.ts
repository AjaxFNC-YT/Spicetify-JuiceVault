import { createLogger } from "../core/log";
import { Emitter } from "../core/emitter";
import { getDeviceSettings } from "../core/settings/device";
import { listNews, type NewsItem } from "../core/api/news";
import { h } from "../ui/h";
import { openModal, whenNoModal } from "../ui/modal";
import { ChangelogPopup } from "../ui/modals/ChangelogPopup";

declare const Spicetify: any;

const log = createLogger("Announcements");

const SEEN_KEY = "juicevault:news-seen";
const FIRST_CHECK_MS = 4000;
const POLL_MS = 45_000;
const POLL_JITTER_MS = 5000;

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

export class Announcements {
	readonly events = new Emitter<{ news: boolean }>();
	private latestId: string | null = null;
	private checking = false;
	private timer: number | null = null;
	private stopped = false;

	get hasUnseenNews(): boolean {
		return Boolean(this.latestId && this.latestId !== read(SEEN_KEY));
	}

	readonly news = {
		list: (limit?: number, offset?: number) => listNews(limit, offset),
		markSeen: (id: string) => {
			write(SEEN_KEY, id);
			this.events.emit("news", this.hasUnseenNews);
		},
		hasUnseen: () => this.hasUnseenNews,
	};

	start(): void {
		this.schedule(FIRST_CHECK_MS);
	}

	private schedule(delay: number): void {
		if (this.stopped) return;
		this.timer = window.setTimeout(async () => {
			await this.check();
			this.schedule(POLL_MS + Math.round((Math.random() * 2 - 1) * POLL_JITTER_MS));
		}, delay);
	}

	private async check(): Promise<void> {
		if (this.checking) return;
		this.checking = true;
		try {
			const { items } = await listNews(1, 0);
			const latest = items[0];
			this.latestId = latest?.id || null;
			this.events.emit("news", this.hasUnseenNews);
			if (latest && this.hasUnseenNews && getDeviceSettings().autoChangelog) {
				await whenNoModal();
				if (this.hasUnseenNews) this.show(latest);
			}
		} catch (error) {
			log.debug("could not check the changelog", error);
		} finally {
			this.checking = false;
		}
	}

	private show(item: NewsItem): void {
		this.news.markSeen(item.id);
		openModal(item.title || "What's new on JuiceVault", h(ChangelogPopup, { item }), true);
	}

	dispose(): void {
		this.stopped = true;
		if (this.timer !== null) window.clearTimeout(this.timer);
		this.timer = null;
	}
}
