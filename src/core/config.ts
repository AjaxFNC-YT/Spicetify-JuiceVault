import raw from "../../config.json";

export interface ApiConfig {
	baseUrl: string;
	playSource: string;
	timeoutMs: number;
}

export interface DevConfig {
	sampleSongId: string;
}

export interface GithubConfig {
	repo: string;
	branch: string;
}

export interface AppConfig {
	api: ApiConfig;
	github: GithubConfig;
	siteUrl: string;
	debug: boolean;
	dev: DevConfig;
}

export const config: AppConfig = raw as AppConfig;

export function repoUrl(path = ""): string {
	return `https://github.com/${config.github.repo}${path}`;
}

export function installCommand(): string {
	return `iwr -useb https://raw.githubusercontent.com/${config.github.repo}/${config.github.branch}/install.ps1 | iex`;
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
