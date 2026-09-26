import type { Profile } from "../../core/auth/session";
import { assetUrl } from "../../core/config";
import type { JuiceVaultApi } from "../bridge";
import { h, native, notify } from "../h";
import { navigate } from "../router";
import { Avatar } from "./controls";

export function AccountButton(jv: JuiceVaultApi | null, profile: Profile | null): any {
	if (!profile) {
		return h("button", { className: "jv-login-pill", onClick: () => navigate("login") }, "Log in");
	}

	const RC = native();
	const name = profile.displayName || profile.username;

	const signOut = async (): Promise<void> => {
		await jv?.session.signOut();
		notify("Logged out of JuiceVault");
		navigate("browse", true);
	};

	const menu = h(
		RC.Menu,
		null,
		h(RC.MenuItem, { key: "profile", onClick: () => navigate("profile") }, "Profile"),
		h(RC.MenuItem, { key: "settings", onClick: () => navigate("settings") }, "Settings"),
		h(RC.MenuItem, { key: "logout", onClick: () => void signOut() }, "Log out"),
	);

	return h(
		RC.ContextMenu,
		{ menu, trigger: "click", action: "toggle" },
		h(
			"button",
			{ className: "jv-account", title: name },
			Avatar(assetUrl(profile.avatar), name, 28),
			h("span", { className: "jv-account-name" }, name),
		),
	);
}
