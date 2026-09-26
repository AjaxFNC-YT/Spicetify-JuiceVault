import type { Session } from "../auth/session";

export interface Listen {
	songId: string;
	duration: number;
	playSessionId: string;
	source?: "spotify" | "playlist" | "search" | "queue" | "library";
	playlistId?: string | null;
}

export async function logListen(session: Session, listen: Listen, keepalive = false): Promise<void> {
	await session.authed("/user/history", {
		method: "POST",
		retries: 1,
		keepalive,
		body: {
			songId: listen.songId,
			duration: listen.duration,
			source: listen.source ?? "spotify",
			playlistId: listen.playlistId ?? null,
			playSessionId: listen.playSessionId,
		},
	});
}
