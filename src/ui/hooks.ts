import type { Profile } from "../core/auth/session";
import { api, type JuiceVaultApi } from "./bridge";
import { useEffect, useState } from "./h";

export function useApi(): JuiceVaultApi | null {
	const [jv, setJv] = useState<JuiceVaultApi | null>(api());

	useEffect(() => {
		if (jv) return;
		const timer = window.setInterval(() => {
			const found = api();
			if (!found) return;
			setJv(found);
			window.clearInterval(timer);
		}, 250);
		return () => window.clearInterval(timer);
	}, [jv]);

	return jv;
}

export function useProfile(jv: JuiceVaultApi | null): Profile | null {
	const [profile, setProfile] = useState<Profile | null>(jv?.session.user ?? null);

	useEffect(() => {
		if (!jv) return;
		setProfile(jv.session.user);
		return jv.session.events.on("profile", (next) => setProfile(next ? { ...next } : null));
	}, [jv]);

	return profile;
}

export function useNowPlaying(): string | null {
	const [songId, setSongId] = useState<string | null>(null);

	useEffect(() => {
		const timer = window.setInterval(() => setSongId(api()?.player?.current?.songId ?? null), 800);
		return () => window.clearInterval(timer);
	}, []);

	return songId;
}

export function usePlaylists(jv: JuiceVaultApi | null): Array<{ uri: string; name: string }> {
	const [playlists, setPlaylists] = useState<Array<{ uri: string; name: string }>>([]);

	useEffect(() => {
		if (!jv) return;
		let cancelled = false;
		void jv
			.playlists()
			.then((list) => {
				if (!cancelled) setPlaylists(list);
			})
			.catch(() => undefined);
		return () => {
			cancelled = true;
		};
	}, [jv]);

	return playlists;
}
