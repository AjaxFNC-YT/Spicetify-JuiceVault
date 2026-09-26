import { h, useState } from "../h";
import { closeModal } from "../modal";
import { Button } from "../components/controls";

export function ConfirmUnheardSync({ count, onConfirm }: { count: number; onConfirm: () => Promise<void> }): any {
	const [busy, setBusy] = useState(false);

	const confirm = async (): Promise<void> => {
		setBusy(true);
		await onConfirm();
		closeModal();
	};

	return h(
		"div",
		{ className: "jv-modal jv-modal--form" },
		h(
			"p",
			{ className: "jv-modal-intro" },
			`This creates a real “Unheard” playlist in your Spotify library${count ? ` with ${count.toLocaleString()} songs` : ""}, and keeps it up to date on its own:`,
		),
		h(
			"ul",
			{ className: "jv-modal-points" },
			h("li", null, "Songs drop off as soon as you finish them (70% or more)."),
			h("li", null, "New archive songs are added when they show up on JuiceVault."),
			h("li", null, "If you remove a song from it yourself, it stays removed."),
			h("li", null, "Nothing on your JuiceVault account changes."),
		),
		h("p", { className: "jv-modal-note" }, "You can stop syncing any time from the playlist’s ⋯ menu → JuiceVault, and the playlist stays in your library."),
		h(
			"div",
			{ className: "jv-modal-actions" },
			Button("secondary", "Cancel", { onClick: closeModal, disabled: busy }),
			Button("primary", busy ? "Creating…" : "Create playlist", { disabled: busy, onClick: () => void confirm() }),
		),
	);
}
