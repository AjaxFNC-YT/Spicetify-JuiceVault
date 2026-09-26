import { createLogger } from "../core/log";
import { getDeviceSettings, setDeviceSettings } from "../core/settings/device";
import { h } from "../ui/h";
import { injectStyle } from "../ui/styles";
import { SearchPanel, type SearchMode } from "../ui/components/SearchPanel";

declare const Spicetify: any;

const log = createLogger("SearchInjector");
const HOST_ID = "juicevault-search-host";
const PAGE_SELECTOR = ".main-view-container__scroll-node-child";
const TAKEOVER_CLASS = "jv-search-takeover";

function queryFromPath(pathname: string): string | null {
	const match = pathname.match(/^\/search\/([^/]+)(?:\/[^/]*)?\/?$/);
	if (!match) return null;
	try {
		const query = decodeURIComponent(match[1]!).trim();
		return query ? query : null;
	} catch {
		return null;
	}
}

export class SearchInjector {
	private root: any = null;
	private host: HTMLElement | null = null;
	private page: Element | null = null;
	private query: string | null = null;
	private mode: SearchMode = getDeviceSettings().searchMode;
	private observer: MutationObserver | null = null;
	private stopHistory: (() => void) | null = null;
	private frame: number | null = null;

	start(): void {
		injectStyle();
		const history = Spicetify.Platform?.History;
		if (!history?.listen) {
			log.warn("History is unavailable; search injection disabled");
			return;
		}

		const stop = history.listen(() => this.schedule());
		this.stopHistory = typeof stop === "function" ? stop : null;

		this.observer = new MutationObserver(() => this.schedule());
		this.observer.observe(document.querySelector(".main-view-container") ?? document.body, { childList: true, subtree: true });

		this.schedule();
	}

	private schedule(): void {
		if (this.frame !== null) return;
		this.frame = window.requestAnimationFrame(() => {
			this.frame = null;
			this.reconcile();
		});
	}

	private setMode = (mode: SearchMode): void => {
		this.mode = mode;
		setDeviceSettings({ searchMode: mode });
		this.applyTakeover();
		if (this.query) this.render(this.query);
		this.page?.closest(".main-view-container__scroll-node")?.scrollTo?.({ top: 0 });
	};

	private applyTakeover(): void {
		if (!this.page) return;
		this.page.classList.toggle(TAKEOVER_CLASS, this.mode === "juicevault" && Boolean(this.query));
	}

	private reconcile(): void {
		const pathname: string = Spicetify.Platform?.History?.location?.pathname ?? "";
		const query = getDeviceSettings().showInSearch ? queryFromPath(pathname) : null;

		if (!query) {
			this.unmount();
			return;
		}

		const page = document.querySelector(PAGE_SELECTOR);
		if (!page) return;

		if (this.page && this.page !== page) this.page.classList.remove(TAKEOVER_CLASS);
		this.page = page;

		if (!this.host) {
			this.host = document.createElement("div");
			this.host.id = HOST_ID;
			this.host.className = "jv-search-host";
		}

		if (this.host.parentElement !== page || page.firstElementChild !== this.host) page.prepend(this.host);

		this.applyTakeover();

		if (query !== this.query || !this.root) {
			this.query = query;
			this.render(query);
		}
	}

	private render(query: string): void {
		if (!this.host) return;
		const ReactDOM = Spicetify.ReactDOM;
		const element = h(SearchPanel, { query, mode: this.mode, onMode: this.setMode });

		if (typeof ReactDOM.createRoot === "function") {
			if (!this.root) this.root = ReactDOM.createRoot(this.host);
			this.root.render(element);
		} else {
			ReactDOM.render(element, this.host);
			this.root = true;
		}
	}

	private unmount(): void {
		this.page?.classList.remove(TAKEOVER_CLASS);
		this.page = null;
		if (!this.host) return;

		try {
			if (this.root && typeof this.root.unmount === "function") this.root.unmount();
			else Spicetify.ReactDOM.unmountComponentAtNode?.(this.host);
		} catch (error) {
			log.debug("unmount failed", error);
		}

		this.host.remove();
		this.host = null;
		this.root = null;
		this.query = null;
	}

	dispose(): void {
		if (this.frame !== null) window.cancelAnimationFrame(this.frame);
		this.frame = null;
		this.observer?.disconnect();
		this.observer = null;
		this.stopHistory?.();
		this.stopHistory = null;
		this.unmount();
	}
}
