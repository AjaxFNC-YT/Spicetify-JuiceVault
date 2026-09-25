import raw from "../../config.json";

export interface ApiConfig {
	baseUrl: string;
	playSource: string;
	timeoutMs: number;
}

export interface DevConfig {
	sampleSongId: string;
}

export interface AppConfig {
	api: ApiConfig;
	debug: boolean;
	dev: DevConfig;
}

export const config: AppConfig = raw as AppConfig;

export function streamUrl(songId: string): string {
	const base = config.api.baseUrl.replace(/\/+$/, "");
	return `${base}/music/stream/${encodeURIComponent(songId)}?src=${encodeURIComponent(config.api.playSource)}`;
}

export function coverUrl(songId: string): string {
	const base = config.api.baseUrl.replace(/\/+$/, "");
	return `${base}/cdn/music/covers/${encodeURIComponent(songId)}`;
}
