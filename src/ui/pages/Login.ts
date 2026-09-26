import { siteUrl } from "../../core/config";
import { describeError } from "../../core/http/errors";
import { beginBrowserLogin, openInBrowser, waitForBrowserLogin, type OAuthProvider } from "../../core/auth/oauth";
import { LOGO } from "../../assets/logo";
import type { JuiceVaultApi } from "../bridge";
import { h, notify, useEffect, useState } from "../h";
import { Icon } from "../icons";
import { navigate } from "../router";
import { Button } from "../components/controls";
import { GoogleMark } from "../components/brand";

const REGISTER_URL = "https://juicevault.xyz/register";

const PROVIDERS: Array<{ id: OAuthProvider; label: string }> = [
	{ id: "google", label: "Continue with Google" },
	{ id: "discord", label: "Continue with Discord" },
];

function field(id: string, label: string, value: string, set: (value: string) => void, submit: () => void, masked = false): any[] {
	return [
		h("label", { key: `${id}-label`, htmlFor: id }, label),
		h("input", {
			key: id,
			id,
			type: "text",
			className: masked ? "jv-login-input jv-masked" : "jv-login-input",
			autoComplete: "off",
			autoCorrect: "off",
			autoCapitalize: "off",
			spellCheck: false,
			"data-lpignore": "true",
			"data-form-type": "other",
			placeholder: label,
			value,
			onChange: (event: any) => set(event.target.value),
			onKeyDown: (event: any) => {
				if (event.key === "Enter") submit();
			},
		}),
	];
}

export function Login({ jv, reason }: { jv: JuiceVaultApi | null; reason?: string }): any {
	const [login, setLogin] = useState("");
	const [password, setPassword] = useState("");
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [waiting, setWaiting] = useState<{ provider?: OAuthProvider; code: string; controller: AbortController } | null>(null);

	useEffect(() => () => waiting?.controller.abort(), [waiting]);

	const done = (name: string): void => {
		notify(`Logged in as ${name}`);
		navigate("profile", true);
	};

	const submit = async (): Promise<void> => {
		if (!jv || busy) return;
		if (!login.trim() || !password) {
			setError("Enter your username or email and your password.");
			return;
		}
		setBusy(true);
		setError(null);
		try {
			const profile = await jv.session.signIn(login.trim(), password);
			done(profile.displayName || profile.username);
		} catch (failure) {
			setError(describeError(failure, "Could not log in."));
		} finally {
			setBusy(false);
		}
	};

	const browser = async (provider?: OAuthProvider): Promise<void> => {
		if (!jv || waiting) return;
		setError(null);
		const controller = new AbortController();
		try {
			const attempt = await beginBrowserLogin(provider);
			setWaiting({ provider, code: attempt.code, controller });
			openInBrowser(attempt.url);
			const tokens = await waitForBrowserLogin(attempt.verifier, controller.signal);
			const profile = await jv.session.signInWithTokens(tokens.accessToken, tokens.refreshToken);
			done(profile.displayName || profile.username);
		} catch (failure) {
			if (!controller.signal.aborted) setError(describeError(failure, "Could not log in."));
		} finally {
			setWaiting(null);
		}
	};

	const header = [
		h("img", { key: "logo", className: "jv-login-logo", src: LOGO, alt: "" }),
		h("h1", { key: "title" }, "Log in to JuiceVault"),
		reason ? h("p", { key: "reason", className: "jv-login-reason" }, reason) : null,
	];

	if (waiting) {
		const via = waiting.provider === "google" ? " with Google" : waiting.provider === "discord" ? " with Discord" : "";
		return h(
			"div",
			{ className: "jv-login" },
			...header,
			h(
				"div",
				{ className: "jv-login-form jv-login-waiting" },
				h("div", { className: "jv-spinner" }),
				h("p", null, `Finish logging in${via} on juicevault.xyz.`),
				h("p", { className: "jv-login-hint" }, "Only approve if the website shows this code:"),
				h("div", { className: "jv-login-code" }, waiting.code),
				h("p", { className: "jv-login-hint" }, "This page updates on its own once you approve."),
				Button("secondary", "Cancel", { onClick: () => waiting.controller.abort() }),
			),
		);
	}

	return h(
		"div",
		{ className: "jv-login" },
		...header,
		h(
			"div",
			{ className: "jv-login-form" },
			error ? h("div", { className: "jv-login-error" }, error) : null,
			h(
				"div",
				{ className: "jv-social" },
				PROVIDERS.map((provider) =>
					h(
						"button",
						{ key: provider.id, className: "jv-social-button", onClick: () => void browser(provider.id) },
						h("span", { className: `jv-social-icon jv-social-icon--${provider.id}` }, provider.id === "google" ? GoogleMark() : Icon("discord", 20)),
						h("span", null, provider.label),
					),
				),
				h(
					"button",
					{ key: "browser", className: "jv-social-button", onClick: () => void browser() },
					h("span", { className: "jv-social-icon" }, h("img", { src: LOGO, alt: "", width: 20, height: 20, style: { borderRadius: 4 } })),
					h("span", null, "Log in with your browser"),
				),
			),
			h("div", { className: "jv-divider" }, h("span", null, "or")),
			...field("jv-login-user", "Email or username", login, setLogin, () => void submit()),
			...field("jv-login-pass", "Password", password, setPassword, () => void submit(), true),
			h(
				"div",
				{ className: "jv-login-submit" },
				Button("primary", busy ? "Logging in…" : "Log in", { disabled: busy, onClick: () => void submit() }),
			),
		),
		h("p", { className: "jv-login-links" }, h("a", { href: siteUrl("/login"), target: "_blank", rel: "noopener" }, "Forgot your password?")),
		h(
			"p",
			{ className: "jv-login-links" },
			"Don't have an account? ",
			h("a", { href: REGISTER_URL, target: "_blank", rel: "noopener" }, "Sign up on juicevault.xyz"),
		),
	);
}
