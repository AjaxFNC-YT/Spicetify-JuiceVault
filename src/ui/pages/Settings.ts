import type { Profile } from "../../core/auth/session";
import { siteUrl } from "../../core/config";
import { describeError } from "../../core/http/errors";
import type { JuiceVaultApi } from "../bridge";
import { h, notify, useEffect, useState } from "../h";
import { navigate } from "../router";
import { Button, Toggle } from "../components/controls";

const PRIVACY: Array<{ key: string; label: string }> = [
	{ key: "privateProfile", label: "Make my profile private" },
	{ key: "showListeningHistory", label: "Show my listening history on my public profile" },
];

const LIBRARY: Array<{ key: string; label: string }> = [
	{ key: "hideSessions", label: "Studio sessions" },
	{ key: "hideReleased", label: "Released songs" },
	{ key: "hideCutFiles", label: "Cut files" },
	{ key: "hideRemasters", label: "Remasters" },
	{ key: "hideInstrumentals", label: "Instrumentals" },
	{ key: "hideStems", label: "Stems" },
];

function Section(title: string, note: string | null, ...rows: any[]): any {
	return h(
		"section",
		{ className: "jv-set-section" },
		h("h2", null, title),
		note ? h("p", { className: "jv-set-note" }, note) : null,
		...rows,
	);
}

function Row(label: string, control: any, key?: string): any {
	return h("div", { className: "jv-set-row", key }, h("span", { className: "jv-set-label" }, label), control);
}

export function Settings({ jv, profile }: { jv: JuiceVaultApi | null; profile: Profile }): any {
	const [displayName, setDisplayName] = useState(profile.displayName ?? "");
	const [bio, setBio] = useState(profile.bio ?? "");
	const [savingProfile, setSavingProfile] = useState(false);
	const [prefs, setPrefs] = useState<Record<string, unknown>>(profile.preferences ?? {});
	const [device, setDevice] = useState(jv?.device.get() ?? { resumeOnLaunch: true });
	const [passwordOpen, setPasswordOpen] = useState(false);
	const [current, setCurrent] = useState("");
	const [next, setNext] = useState("");
	const [confirm, setConfirm] = useState("");
	const [passwordError, setPasswordError] = useState<string | null>(null);
	const [savingPassword, setSavingPassword] = useState(false);

	useEffect(() => setPrefs(profile.preferences ?? {}), [profile.preferences]);

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

	const savePassword = async (): Promise<void> => {
		if (!jv || savingPassword) return;
		if (!current || !next) return setPasswordError("Fill in both password fields.");
		if (next.length < 8) return setPasswordError("Your new password needs at least 8 characters.");
		if (next !== confirm) return setPasswordError("The new passwords don't match.");

		setSavingPassword(true);
		setPasswordError(null);
		try {
			await jv.account.changePassword(current, next);
			await jv.session.signOut();
			notify("Password changed. Log in again with your new password.");
			navigate("login", true);
		} catch (error) {
			setPasswordError(describeError(error, "Could not change your password."));
		} finally {
			setSavingPassword(false);
		}
	};

	const signOut = async (): Promise<void> => {
		await jv?.session.signOut();
		notify("Logged out of JuiceVault");
		navigate("browse", true);
	};

	const passwordForm = passwordOpen
		? h(
				"div",
				{ className: "jv-set-block" },
				passwordError ? h("div", { className: "jv-login-error" }, passwordError) : null,
				h("input", {
					className: "jv-field",
					type: "password",
					placeholder: "Current password",
					autoComplete: "current-password",
					value: current,
					onChange: (event: any) => setCurrent(event.target.value),
				}),
				h("input", {
					className: "jv-field",
					type: "password",
					placeholder: "New password",
					autoComplete: "new-password",
					value: next,
					onChange: (event: any) => setNext(event.target.value),
				}),
				h("input", {
					className: "jv-field",
					type: "password",
					placeholder: "Confirm new password",
					autoComplete: "new-password",
					value: confirm,
					onChange: (event: any) => setConfirm(event.target.value),
				}),
				h(
					"div",
					{ className: "jv-set-actions" },
					Button("secondary", "Cancel", {
						onClick: () => {
							setPasswordOpen(false);
							setPasswordError(null);
							setCurrent("");
							setNext("");
							setConfirm("");
						},
					}),
					Button("primary", savingPassword ? "Saving…" : "Change password", {
						disabled: savingPassword,
						onClick: () => void savePassword(),
					}),
				),
			)
		: null;

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
				Button("primary", savingProfile ? "Saving…" : "Save profile", {
					disabled: !dirty || savingProfile,
					onClick: () => void saveProfile(),
				}),
			),
			Row(
				"Email",
				h(
					"span",
					{ className: "jv-set-value" },
					profile.email ?? "—",
					h(
						"span",
						{ className: profile.isVerified ? "jv-pill jv-pill--ok" : "jv-pill" },
						profile.isVerified ? "Verified" : "Not verified",
					),
				),
			),
			profile.hasPassword === false
				? Row(
						"Password",
						h("a", { className: "jv-link", href: siteUrl("/settings"), target: "_blank", rel: "noopener" }, "Set a password on juicevault.xyz"),
					)
				: Row("Password", passwordOpen ? h("span") : Button("secondary", "Change password", { onClick: () => setPasswordOpen(true) })),
			passwordForm,
		),
		Section(
			"Privacy",
			"Synced with your JuiceVault account.",
			...PRIVACY.map((entry) =>
				Row(entry.label, Toggle(prefs[entry.key] === true, (value) => void setPreference(entry.key, value), false, entry.label), entry.key),
			),
		),
		Section(
			"Library",
			"Choose what appears in the vault. Synced with your JuiceVault account.",
			...LIBRARY.map((entry) =>
				Row(
					entry.label,
					Toggle(prefs[entry.key] !== true, (value) => void setPreference(entry.key, !value), false, entry.label),
					entry.key,
				),
			),
		),
		Section(
			"This device",
			null,
			Row(
				"Resume the last JuiceVault song when Spotify starts",
				Toggle(device.resumeOnLaunch, (value) => {
					if (jv) setDevice(jv.device.set({ resumeOnLaunch: value }));
				}),
			),
		),
		h("div", { className: "jv-set-footer" }, Button("secondary", "Log out", { onClick: () => void signOut() })),
	);
}
