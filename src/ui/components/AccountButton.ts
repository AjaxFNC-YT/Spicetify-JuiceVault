import type { Profile } from "../../core/auth/session";
import { assetUrl } from "../../core/config";
import type { JuiceVaultApi } from "../bridge";
import { h, notify } from "../h";
import { navigate } from "../router";
import { Avatar } from "./controls";
import { MenuButton } from "./StandaloneMenu";

export function AccountButton(jv: JuiceVaultApi | null, profile: Profile | null): any {
	if (!profile) {
		return h("button", { className: "jv-login-pill", onClick: () => navigate("login") }, "Log in");
	}

	const name = profile.displayName || profile.username;

	const signOut = async (): Promise<void> => {
		await jv?.session.signOut();
		notify("Logged out of JuiceVault");
		navigate("browse", true);
	};

	return h(MenuButton, {
		items: [
			{ key: "profile", label: "Profile", onClick: () => navigate("profile") },
			{ key: "settings", label: "Settings", onClick: () => navigate("settings"), dividerAfter: true },
			{ key: "logout", label: "Log out", onClick: () => void signOut() },
		],
		trigger: h(
			"button",
			{ className: "jv-account", title: name },
			Avatar(assetUrl(profile.avatar), name, 28),
			h("span", { className: "jv-account-name" }, name),
		),
	});
}
