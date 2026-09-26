import { siteUrl } from "../../core/config";
import { describeError } from "../../core/http/errors";
import { LOGO } from "../../assets/logo";
import type { JuiceVaultApi } from "../bridge";
import { h, notify, useState } from "../h";
import { navigate } from "../router";
import { Button } from "../components/controls";

export function Login({ jv, reason }: { jv: JuiceVaultApi | null; reason?: string }): any {
	const [login, setLogin] = useState("");
	const [password, setPassword] = useState("");
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const submit = async (event?: any): Promise<void> => {
		event?.preventDefault?.();
		if (!jv || busy) return;
		if (!login.trim() || !password) {
			setError("Enter your username or email and your password.");
			return;
		}

		setBusy(true);
		setError(null);
		try {
			const profile = await jv.session.signIn(login.trim(), password);
			notify(`Logged in as ${profile.displayName || profile.username}`);
			navigate("profile", true);
		} catch (failure) {
			setError(describeError(failure, "Could not log in."));
		} finally {
			setBusy(false);
		}
	};

	return h(
		"div",
		{ className: "jv-login" },
		h("img", { className: "jv-login-logo", src: LOGO, alt: "" }),
		h("h1", null, "Log in to JuiceVault"),
		reason ? h("p", { className: "jv-login-reason" }, reason) : null,
		h(
			"form",
			{ className: "jv-login-form", onSubmit: (event: any) => event.preventDefault() },
			error ? h("div", { className: "jv-login-error" }, error) : null,
			h("label", { htmlFor: "jv-login-user" }, "Email or username"),
			h("input", {
				id: "jv-login-user",
				className: "jv-login-input",
				autoComplete: "username",
				placeholder: "Email or username",
				value: login,
				onChange: (event: any) => setLogin(event.target.value),
				onKeyDown: (event: any) => {
					if (event.key === "Enter") void submit(event);
				},
			}),
			h("label", { htmlFor: "jv-login-pass" }, "Password"),
			h("input", {
				id: "jv-login-pass",
				className: "jv-login-input",
				type: "password",
				autoComplete: "current-password",
				placeholder: "Password",
				value: password,
				onChange: (event: any) => setPassword(event.target.value),
				onKeyDown: (event: any) => {
					if (event.key === "Enter") void submit(event);
				},
			}),
			h(
				"div",
				{ className: "jv-login-submit" },
				Button("primary", busy ? "Logging in…" : "Log in", { type: "button", disabled: busy, onClick: submit }),
			),
		),
		h(
			"p",
			{ className: "jv-login-links" },
			h("a", { href: siteUrl("/login"), target: "_blank", rel: "noopener" }, "Forgot your password?"),
		),
		h(
			"p",
			{ className: "jv-login-links" },
			"Don't have an account? ",
			h("a", { href: siteUrl("/register"), target: "_blank", rel: "noopener" }, "Sign up for JuiceVault"),
		),
	);
}
