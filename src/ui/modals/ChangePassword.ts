import { describeError } from "../../core/http/errors";
import type { JuiceVaultApi } from "../bridge";
import { h, notify, useState } from "../h";
import { closeModal } from "../modal";
import { navigate } from "../router";
import { Button } from "../components/controls";

export function ChangePassword({ jv }: { jv: JuiceVaultApi }): any {
	const [current, setCurrent] = useState("");
	const [next, setNext] = useState("");
	const [confirm, setConfirm] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [busy, setBusy] = useState(false);

	const save = async (): Promise<void> => {
		if (busy) return;
		if (!current || !next) return setError("Fill in both password fields.");
		if (next.length < 8) return setError("Your new password needs at least 8 characters.");
		if (next !== confirm) return setError("The new passwords don't match.");

		setBusy(true);
		setError(null);
		try {
			await jv.account.changePassword(current, next);
			await jv.session.signOut();
			closeModal();
			notify("Password changed. Log in again with your new password.");
			navigate("login", true);
		} catch (failure) {
			setError(describeError(failure, "Could not change your password."));
		} finally {
			setBusy(false);
		}
	};

	const field = (placeholder: string, value: string, set: (value: string) => void, autoComplete: string): any =>
		h("input", {
			className: "jv-login-input",
			type: "password",
			placeholder,
			autoComplete,
			value,
			onChange: (event: any) => set(event.target.value),
			onKeyDown: (event: any) => {
				if (event.key === "Enter") void save();
			},
		});

	return h(
		"div",
		{ className: "jv-modal jv-modal--form" },
		h("p", { className: "jv-modal-intro" }, "You'll be logged out everywhere and need to log in again with the new password."),
		error ? h("div", { className: "jv-login-error" }, error) : null,
		field("Current password", current, setCurrent, "current-password"),
		field("New password", next, setNext, "new-password"),
		field("Confirm new password", confirm, setConfirm, "new-password"),
		h(
			"div",
			{ className: "jv-modal-actions" },
			Button("secondary", "Cancel", { onClick: closeModal }),
			Button("primary", busy ? "Saving…" : "Change password", { disabled: busy, onClick: () => void save() }),
		),
	);
}
