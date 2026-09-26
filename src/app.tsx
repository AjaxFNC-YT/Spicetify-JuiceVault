import { h, useEffect } from "./ui/h";
import { useApi, useProfile } from "./ui/hooks";
import { useView } from "./ui/router";
import { injectStyle } from "./ui/styles";
import { AccountButton } from "./ui/components/AccountButton";
import { Browse } from "./ui/pages/Browse";
import { Login } from "./ui/pages/Login";
import { Profile } from "./ui/pages/Profile";
import { Settings } from "./ui/pages/Settings";

function App(): any {
	const jv = useApi();
	const profile = useProfile(jv);
	const view = useView();

	useEffect(() => injectStyle(), []);

	let page: any;
	if (view === "login") page = h(Login, { jv });
	else if (view === "profile") page = profile ? h(Profile, { jv, profile }) : h(Login, { jv, reason: "Log in to see your profile." });
	else if (view === "settings") page = profile ? h(Settings, { jv, profile }) : h(Login, { jv, reason: "Log in to change your settings." });
	else page = h(Browse, { jv, profile });

	return h(
		"div",
		{ className: "jv-root" },
		view === "login" ? null : h("div", { className: "jv-topbar" }, AccountButton(jv, profile)),
		page,
	);
}

function render(): any {
	return h(App);
}

(globalThis as any).render = render;
