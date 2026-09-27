import raw from "../../config.json";

export interface ApiConfig {
	baseUrl: string;
	playSource: string;
	timeoutMs: number;
}

export interface DevConfig {
	sampleSongId: string;
}

export interface InstallerConfig {
	windows: string;
	unix: string;
}

export interface AppConfig {
	api: ApiConfig;
	installer: InstallerConfig;
	discordUrl: string;
	siteUrl: string;
	debug: boolean;
	dev: DevConfig;
}

export const config: AppConfig = raw as AppConfig;

export function isWindows(): boolean {
	return /windows/i.test(navigator.userAgent);
}

export function installCommand(): string {
	return isWindows() ? `iwr -useb ${assetUrl(config.installer.windows)} | iex` : `curl -fsSL ${assetUrl(config.installer.unix)} | sh`;
}

export function streamUrl(songId: string): string {
	const base = config.api.baseUrl.replace(/\/+$/, "");
	return `${base}/music/stream/${encodeURIComponent(songId)}?src=${encodeURIComponent(config.api.playSource)}`;
}

export function coverUrl(songId: string): string {
	const base = config.api.baseUrl.replace(/\/+$/, "");
	return `${base}/cdn/music/covers/${encodeURIComponent(songId)}`;
}

export function assetUrl(path: string | null | undefined): string | null {
	if (!path) return null;
	if (/^https?:\/\//.test(path)) return path;
	const base = config.api.baseUrl.replace(/\/+$/, "");
	return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

export function siteUrl(path = ""): string {
	return `${config.siteUrl.replace(/\/+$/, "")}${path}`;
}
