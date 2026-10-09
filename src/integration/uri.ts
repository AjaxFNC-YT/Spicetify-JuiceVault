const JV_PREFIX = "jv-";

export interface JvTrackUriParts {
	songId: string;
	artist: string;
	title: string;
	durationSeconds: number;
}

function encodeSegment(value: string): string {
	return encodeURIComponent(value)
		.replace(/[!'()*]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`)
		.replace(/%20/g, "+");
}

function decodeSegment(value: string): string {
	return decodeURIComponent(value.replace(/\+/g, "%20"));
}

export function buildTrackUri(parts: JvTrackUriParts): string {
	const artist = encodeSegment(parts.artist || "Juice WRLD");
	const album = encodeSegment(`${JV_PREFIX}${parts.songId}`);
	const title = encodeSegment(parts.title || "Unknown");
	const duration = Math.max(0, Math.round(parts.durationSeconds || 0));
	return `spotify:local:${artist}:${album}:${title}:${duration}`;
}

export function uriForSong(song: { id: string; artist: string; title: string; durationSeconds: number }): string {
	return buildTrackUri({ songId: song.id, artist: song.artist, title: song.title, durationSeconds: song.durationSeconds });
}

export function isJvUri(uri: unknown): uri is string {
	return typeof uri === "string" && uri.startsWith("spotify:local:") && uri.includes(`:${JV_PREFIX}`);
}

export function parseSongId(uri: string): string | null {
	if (!isJvUri(uri)) return null;
	const segments = uri.split(":");
	if (segments.length < 6) return null;
	const album = decodeSegment(segments[3] ?? "");
	return album.startsWith(JV_PREFIX) ? album.slice(JV_PREFIX.length) : null;
}
