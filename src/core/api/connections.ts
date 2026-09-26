import type { Session } from "../auth/session";

export type Connection = "discord" | "google";

interface Envelope<T> {
	success: boolean;
	data: T;
}

export async function linkUrl(session: Session, connection: Connection): Promise<string> {
	const result = await session.authed<Envelope<{ url: string }>>(`/user/${connection}/link-url`);
	const url = result?.data?.url;
	if (!url) throw new Error(`JuiceVault didn't return a ${connection === "discord" ? "Discord" : "Google"} link`);
	return url;
}

export async function unlink(session: Session, connection: Connection): Promise<void> {
	await session.authed(`/user/${connection}/link`, { method: "DELETE", retries: 1 });
	await session.loadProfile();
}
