import { h, useEffect } from "./ui/h";
import { useApi, useProfile, useUnseenChangelog } from "./ui/hooks";
import { useView } from "./ui/router";
import { injectStyle } from "./ui/styles";
import { AccountButton } from "./ui/components/AccountButton";
import { SectionNav } from "./ui/components/SectionNav";
import { Changelog } from "./ui/pages/Changelog";
import { Browse } from "./ui/pages/Browse";
import { Login } from "./ui/pages/Login";
import { Profile } from "./ui/pages/Profile";
import { Settings } from "./ui/pages/Settings";
import { Playlists } from "./ui/pages/Playlists";
import { History } from "./ui/pages/History";
import { Stats } from "./ui/pages/Stats";
import { Unheard } from "./ui/pages/Unheard";

function App(): any {
	const jv = useApi();
	const profile = useProfile(jv);
	const view = useView();
	const unseenChangelog = useUnseenChangelog(jv);

	useEffect(() => injectStyle(), []);

	let page: any;
	if (view === "login") page = h(Login, { jv });
	else if (view === "profile") page = profile ? h(Profile, { jv, profile }) : h(Login, { jv, reason: "Log in to see your profile." });
	else if (view === "playlists") page = profile ? h(Playlists, { jv }) : h(Login, { jv, reason: "Log in to import your JuiceVault playlists." });
	else if (view === "history") page = profile ? h(History, { jv }) : h(Login, { jv, reason: "Log in to see what you've played." });
	else if (view === "stats") page = profile ? h(Stats, { jv, profile }) : h(Login, { jv, reason: "Log in to see your listening stats." });
	else if (view === "unheard") page = profile ? h(Unheard, { jv }) : h(Login, { jv, reason: "Log in to see the songs you haven't heard yet." });
	else if (view === "changelog") page = h(Changelog, { jv });
	else if (view === "settings") page = profile ? h(Settings, { jv, profile }) : h(Login, { jv, reason: "Log in to change your settings." });
	else page = h(Browse, { jv, profile });

	return h(
		"div",
		{ className: "jv-root" },
		view === "login"
			? null
			: h(
					"div",
					{ className: "jv-topbar" },
					h(SectionNav, { view, signedIn: Boolean(profile), unseenChangelog }),
					h("div", { className: "jv-topbar-right" }, AccountButton(jv, profile)),
				),
		page,
	);
}

function render(): any {
	return h(App);
}

(globalThis as any).render = render;
