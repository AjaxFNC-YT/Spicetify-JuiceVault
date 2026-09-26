import { openInBrowser } from "../../core/auth/oauth";
import type { Profile } from "../../core/auth/session";
import { siteUrl, config } from "../../core/config";
import { describeError } from "../../core/http/errors";
import { DEFAULT_TRIM_DB, getDeviceSettings, type AlbumMode } from "../../core/settings/device";
import type { JuiceVaultApi } from "../bridge";
import { h, native, notify, useEffect, useState } from "../h";
import { Icon } from "../icons";
import { openModal } from "../modal";
import { navigate } from "../router";
import { Button, Toggle } from "../components/controls";
import { ChangePassword } from "../modals/ChangePassword";
import { RemoveJvSongs } from "../modals/RemoveJvSongs";
import { GoogleMark } from "../components/brand";
import type { Connection } from "../../core/api/connections";

const LIBRARY: Array<{ key: string; label: string }> = [
	{ key: "hideSessions", label: "Studio sessions" },
	{ key: "hideReleased", label: "Released songs" },
	{ key: "hideCutFiles", label: "Cut files" },
	{ key: "hideRemasters", label: "Remasters" },
	{ key: "hideInstrumentals", label: "Instrumentals" },
	{ key: "hideStems", label: "Stems" },
];

const ALBUM_MODES: Array<{ id: AlbumMode; label: string }> = [
	{ id: "juicevault", label: "JuiceVault" },
	{ id: "real", label: "The song's real album" },
	{ id: "custom", label: "Custom" },
];

function Section(title: string, note: string | null, ...rows: any[]): any {
	return h("section", { className: "jv-set-section" }, h("h2", null, title), note ? h("p", { className: "jv-set-note" }, note) : null, ...rows);
}

function Row(label: string, control: any, key?: string, hint?: string): any {
	return h(
		"div",
		{ className: "jv-set-row", key },
		h("span", { className: "jv-set-text" }, h("span", { className: "jv-set-label" }, label), hint ? h("span", { className: "jv-set-hint" }, hint) : null),
		control,
	);
}

export function Settings({ jv, profile }: { jv: JuiceVaultApi | null; profile: Profile }): any {
	const [displayName, setDisplayName] = useState(profile.displayName ?? "");
	const [bio, setBio] = useState(profile.bio ?? "");
	const [savingProfile, setSavingProfile] = useState(false);
	const [prefs, setPrefs] = useState<Record<string, unknown>>(profile.preferences ?? {});
	const [device, setDevice] = useState(jv?.device.get() ?? getDeviceSettings());
	const [customAlbum, setCustomAlbum] = useState(device.customAlbum);
	const [update, setUpdate] = useState(jv?.updates.status() ?? null);

	useEffect(() => {
		if (!jv) return;
		setUpdate(jv.updates.status());
		return jv.updates.on(setUpdate);
	}, [jv]);

	useEffect(() => setPrefs(profile.preferences ?? {}), [profile.preferences]);

	const [linking, setLinking] = useState<Connection | null>(null);

	const identity = (connection: Connection): string | null => {
		const value: any = (profile as any)[connection];
		if (!value) return null;
		return String(value.username ?? value.globalName ?? value.email ?? value.name ?? "Connected");
	};

	const link = async (connection: Connection): Promise<void> => {
		if (!jv || linking) return;
		setLinking(connection);
		try {
			const linked = await jv.connections.link(connection);
			notify(linked ? `${connection === "discord" ? "Discord" : "Google"} connected` : "Finish linking in your browser, then come back");
		} catch (error) {
			notify(describeError(error, "Could not start linking"), true);
		} finally {
			setLinking(null);
		}
	};

	const disconnect = async (connection: Connection): Promise<void> => {
		if (!jv) return;
		try {
			await jv.connections.unlink(connection);
			notify(`${connection === "discord" ? "Discord" : "Google"} disconnected`);
		} catch (error) {
			notify(describeError(error, "Could not disconnect"), true);
		}
	};

	const connectionRow = (connection: Connection, label: string, icon: any): any => {
		const who = identity(connection);
		return h(
			"div",
			{ className: "jv-set-row", key: connection },
			h(
				"span",
				{ className: "jv-connection" },
				h("span", { className: `jv-connection-icon jv-connection-icon--${connection}` }, icon),
				h("span", { className: "jv-set-text" }, h("span", { className: "jv-set-label" }, label), h("span", { className: "jv-set-hint" }, who ? `Connected as ${who}` : "Not connected")),
			),
			who
				? Button("secondary", "Disconnect", { onClick: () => void disconnect(connection) })
				: Button("secondary", linking === connection ? "Waiting for browser\u2026" : "Connect", { disabled: Boolean(linking), onClick: () => void link(connection) }),
		);
	};

	const dirty = displayName !== (profile.displayName ?? "") || bio !== (profile.bio ?? "");

	const saveProfile = async (): Promise<void> => {
		if (!jv || !dirty || savingProfile) return;
		setSavingProfile(true);
		try {
			await jv.account.update({ displayName: displayName.trim(), bio });
			notify("Profile saved");
		} catch (error) {
			notify(describeError(error, "Could not save your profile"), true);
		} finally {
			setSavingProfile(false);
		}
	};

	const setPreference = async (key: string, value: boolean): Promise<void> => {
		if (!jv) return;
		const previous = prefs[key];
		setPrefs({ ...prefs, [key]: value });
		try {
			await jv.account.update({ preferences: { [key]: value } });
		} catch (error) {
			setPrefs({ ...prefs, [key]: previous });
			notify(describeError(error, "Could not update that setting"), true);
		}
	};

	const updateDevice = (patch: Parameters<JuiceVaultApi["device"]["set"]>[0]): void => {
		if (jv) setDevice(jv.device.set(patch));
	};

	const signOut = async (): Promise<void> => {
		await jv?.session.signOut();
		notify("Logged out of JuiceVault");
		navigate("browse", true);
	};

	const RC = native();
	const formatDb = (db: number): string => (db === 0 ? "0 dB" : `${db > 0 ? "+" : ""}${db} dB`);
	const albumLabel = ALBUM_MODES.find((mode) => mode.id === device.albumMode)?.label ?? "JuiceVault";
	const albumMenu = h(
		RC.Menu,
		null,
		ALBUM_MODES.map((mode) =>
			h(
				RC.MenuItem,
				{
					key: mode.id,
					onClick: () => updateDevice({ albumMode: mode.id }),
					trailingIcon: device.albumMode === mode.id ? Icon("check", 16) : undefined,
				},
				mode.label,
			),
		),
	);

	return h(
		"div",
		{ className: "jv-settings" },
		h("h1", null, "Settings"),
		Section(
			"Account",
			null,
			Row(
				"Display name",
				h("input", {
					className: "jv-field",
					maxLength: 32,
					value: displayName,
					placeholder: profile.username,
					onChange: (event: any) => setDisplayName(event.target.value),
				}),
			),
			h(
				"div",
				{ className: "jv-set-row jv-set-row--top" },
				h("span", { className: "jv-set-label" }, "Bio"),
				h("textarea", {
					className: "jv-field jv-field--area",
					maxLength: 500,
					value: bio,
					placeholder: "Tell people about yourself",
					onChange: (event: any) => setBio(event.target.value),
				}),
			),
			h(
				"div",
				{ className: "jv-set-actions" },
				Button("primary", savingProfile ? "Saving…" : "Save profile", { disabled: !dirty || savingProfile, onClick: () => void saveProfile() }),
			),
			Row(
				"Email",
				h(
					"span",
					{ className: "jv-set-value" },
					profile.email ?? "—",
					h("span", { className: profile.isVerified ? "jv-pill jv-pill--ok" : "jv-pill" }, profile.isVerified ? "Verified" : "Not verified"),
				),
			),
			profile.hasPassword === false
				? Row("Password", h("a", { className: "jv-link", href: siteUrl("/settings"), target: "_blank", rel: "noopener" }, "Set a password on juicevault.xyz"))
				: Row(
						"Password",
						Button("secondary", "Change password", {
							onClick: () => {
								if (jv) openModal("Change password", h(ChangePassword, { jv }));
							},
						}),
					),
		),
		Section(
			"Connected accounts",
			"Log in with these, or unlink them. Linking opens juicevault.xyz in your browser.",
			connectionRow("discord", "Discord", Icon("discord", 18)),
			connectionRow("google", "Google", GoogleMark()),
		),
		Section(
			"Library",
			"Choose what appears in the vault. Synced with your JuiceVault account.",
			...LIBRARY.map((entry) =>
				Row(entry.label, Toggle(prefs[entry.key] !== true, (value) => void setPreference(entry.key, !value), false, entry.label), entry.key),
			),
		),
		Section(
			"Playlists",
			null,
			Row(
				"Remove JuiceVault songs from a playlist",
				Button("secondary", "Choose playlist", {
					onClick: () => {
						if (jv) openModal("Remove JuiceVault songs", h(RemoveJvSongs, { sync: jv.sync }));
					},
				}),
				undefined,
				"Your Spotify songs in that playlist are kept.",
			),
		),
		Section(
			"Playback",
			"These settings only apply to this computer.",
			Row(
				"Use Spotify's equalizer for JuiceVault songs",
				Toggle(device.useSpotifyEq, (value) => updateDevice({ useSpotifyEq: value })),
				undefined,
				"Applies the bands from Spotify's Settings → Playback → Equalizer.",
			),
			Row(
				"JuiceVault volume",
				h(
					"div",
					{ className: "jv-range" },
					device.volumeTrimDb !== DEFAULT_TRIM_DB
						? h("button", { className: "jv-link jv-range-reset", onClick: () => updateDevice({ volumeTrimDb: DEFAULT_TRIM_DB }) }, "Reset")
						: null,
					h("input", {
						type: "range",
						min: -12,
						max: 12,
						step: 0.5,
						value: device.volumeTrimDb,
						"aria-label": "JuiceVault volume",
						onChange: (event: any) => updateDevice({ volumeTrimDb: Number(event.target.value) }),
					}),
					h("span", { className: "jv-range-value" }, formatDb(device.volumeTrimDb)),
				),
				undefined,
				"Many leaks are mastered louder than Spotify's songs. Lower this if they sound louder, raise it for quiet ones. Boosts are limited so they never clip.",
			),
			Row(
				"Resume the last JuiceVault song when Spotify starts",
				Toggle(device.resumeOnLaunch, (value) => updateDevice({ resumeOnLaunch: value })),
			),
		),
		Section(
			"Display",
			null,
			Row(
				"Album shown for JuiceVault songs",
				h(RC.ContextMenu, { menu: albumMenu, trigger: "click", action: "toggle" }, h("button", { className: "jv-select" }, albumLabel, Icon("chevron-down", 16))),
				undefined,
				"Used in the player, queue and track lists. The real album is shown when JuiceVault knows it.",
			),
			device.albumMode === "custom"
				? Row(
						"Custom album name",
						h("input", {
							className: "jv-field",
							maxLength: 60,
							value: customAlbum,
							placeholder: "JuiceVault",
							onChange: (event: any) => setCustomAlbum(event.target.value),
							onBlur: () => updateDevice({ customAlbum: customAlbum.trim() }),
							onKeyDown: (event: any) => {
								if (event.key === "Enter") updateDevice({ customAlbum: customAlbum.trim() });
							},
						}),
					)
				: null,
			Row(
				"Show song tags",
				Toggle(device.showTags, (value) => updateDevice({ showTags: value })),
				undefined,
				"Labels like SESSION, INST, STEM and CUT next to songs on JuiceVault pages.",
			),
			Row(
				"Show song tags in Spotify lists",
				Toggle(device.showNativeTags, (value) => updateDevice({ showNativeTags: value })),
				undefined,
				"Adds the same labels to JuiceVault songs in Liked Songs, playlists, search and the queue.",
			),
			Row(
				"Show alternate song names as a tag",
				Toggle(device.showAltNames, (value) => updateDevice({ showAltNames: value })),
				undefined,
				"Known alternate names show next to the song's tag, on JuiceVault pages, in Spotify lists and in the player.",
			),
			Row(
				"Colored tags",
				Toggle(device.coloredTags, (value) => updateDevice({ coloredTags: value })),
				undefined,
				"Gives each kind of song its own color.",
			),
			Row(
				"Hide [Cut] in song names",
				Toggle(device.hideCutMarker, (value) => updateDevice({ hideCutMarker: value })),
				undefined,
				"Cut Files still get the CUT tag. Changing this reloads the song list.",
			),
			Row(
				"Automatically show changelog",
				Toggle(device.autoChangelog, (value) => updateDevice({ autoChangelog: value })),
				undefined,
				"Opens new changelog posts as soon as they come out. Each one only shows once.",
			),
		),
		Section(
			"Menus",
			"How right-click menus behave for JuiceVault songs.",
			Row(
				"Hide options that don't work",
				Toggle(device.tidyMenus, (value) => updateDevice({ tidyMenus: value })),
				undefined,
				"Removes Go to song radio, View credits and Share.",
			),
			Row(
				"Copy Link copies the JuiceVault link",
				Toggle(device.jvCopyLink, (value) => updateDevice({ jvCopyLink: value })),
				undefined,
				"Anyone can open the link on juicevault.xyz to play the song.",
			),
			Row(
				"Show Copy song name",
				Toggle(device.copySongName, (value) => updateDevice({ copySongName: value })),
			),
		),
		Section(
			"Search",
			null,
			Row(
				"Show JuiceVault in Spotify search",
				Toggle(device.showInSearch, (value) => updateDevice({ showInSearch: value })),
				undefined,
				"Adds a Spotify / JuiceVault switch to the top of search results.",
			),
			Row(
				"Fuzzy search",
				Toggle(device.fuzzySearch, (value) => updateDevice({ fuzzySearch: value })),
				undefined,
				"Finds songs even with typos or missing letters, like “lcd drms” for Lucid Dreams.",
			),
		),
		Section(
			"About",
			null,
			Row(
				"Version",
				h(
					"span",
					{ className: "jv-set-value" },
					update?.current ?? "—",
					update?.available && update.latest
						? h("span", { className: "jv-pill" }, `${update.latest.version} available`)
						: update?.checkedAt && !update.error
							? h("span", { className: "jv-pill jv-pill--ok" }, "Up to date")
							: null,
				),
				undefined,
				update?.error ?? undefined,
			),
			Row(
				"Updates",
				Button("secondary", update?.checking ? "Checking…" : "Check for updates", {
					disabled: !jv || update?.checking,
					onClick: () => {
						if (!jv) return;
						void jv.updates.check().then((status) => {
							if (!status.error && !status.available) notify("JuiceVault is up to date");
						});
					},
				}),
			),
			Row("Release notes", Button("secondary", "See what's new", { disabled: !jv, onClick: () => void jv?.updates.whatsNew() })),
			Row(
				"Found a bug?",
				Button("secondary", "Report it on Discord", { onClick: () => openInBrowser(config.discordUrl) }),
				undefined,
				"JuiceVault for Spotify is in beta. Open a ticket in our Discord server and tell us what happened.",
			),
		),
		h("div", { className: "jv-set-footer" }, Button("secondary", "Log out", { onClick: () => void signOut() })),
	);
}
