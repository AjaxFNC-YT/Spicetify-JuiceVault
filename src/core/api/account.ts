import type { Profile, Session } from "../auth/session";

interface Envelope<T> {
	success: boolean;
	data: T;
	error?: string;
}

export interface ProfilePatch {
	displayName?: string;
	bio?: string;
	preferences?: Record<string, unknown>;
}

export interface TopSongEntry {
	songId: string;
	count: number;
	totalDuration: number;
	song: unknown;
}

export interface ListeningStats {
	stats: {
		totalListens: number;
		totalDuration: number;
		uniqueSongs: number;
		completionRate: number;
	};
	topSongs: TopSongEntry[];
}

export async function profileBadges(session: Session, username: string): Promise<unknown[]> {
	const result = await session.authed<{ success: boolean; data?: { badges?: unknown } }>(`/user/profile/${encodeURIComponent(username)}`, { retries: 1 });
	return Array.isArray(result?.data?.badges) ? result.data.badges : [];
}

export async function updateProfile(session: Session, patch: ProfilePatch): Promise<Profile> {
	const current = session.user;
	const body: ProfilePatch = { ...patch };
	if (patch.preferences) body.preferences = { ...(current?.preferences ?? {}), ...patch.preferences };

	const result = await session.authed<Envelope<Profile>>("/user/profile", { method: "PUT", body, retries: 1 });
	const next = { ...(current ?? {}), ...(result?.data ?? {}) } as Profile;
	session.setProfile(next);
	return next;
}

export async function changePassword(session: Session, currentPassword: string, newPassword: string): Promise<void> {
	await session.authed("/user/profile/password", {
		method: "PUT",
		body: { currentPassword, newPassword },
		retries: 1,
	});
}

export interface ListeningActivity {
	currentStreak: number;
	longestStreak: number;
	activeDays: number;
	avgDailyPlays?: number;
	daily?: Array<{ date: string; plays: number; duration: number }>;
	hourly?: Array<{ hour: number; count: number }>;
}

export async function listeningActivity(session: Session): Promise<ListeningActivity | null> {
	const result = await session.authed<Envelope<ListeningActivity>>("/user/history/activity?days=371");
	return result?.data ?? null;
}

export async function listeningStats(session: Session): Promise<ListeningStats | null> {
	const result = await session.authed<Envelope<ListeningStats>>("/user/history/stats");
	return result?.data ?? null;
}
