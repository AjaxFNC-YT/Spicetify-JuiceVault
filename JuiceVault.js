(function juiceVaultMoved() {
	const API = "https://api.juicevault.xyz";
	const DISCORD = "https://discord.com/invite/h76mqj5dWQ";
	const STUB = "Spicetify-JuiceVault/JuiceVault.js";
	const SNOOZE_KEY = "juicevault:legacy-snoozed";
	const SNOOZE_MS = 24 * 60 * 60 * 1000;

	if (!window.Spicetify?.PopupModal || !Spicetify.React || !Spicetify.Platform?.ClipboardAPI) {
		setTimeout(juiceVaultMoved, 300);
		return;
	}

	const windows = /windows/i.test(navigator.userAgent);
	const command = windows
		? `iwr -useb ${API}/juicevault-spicetify-installer.ps1 | iex`
		: `curl -fsSL ${API}/juicevault-spicetify-installer.sh | sh`;

	function removeFromMarketplace() {
		try {
			const listKey = "marketplace:installed-extensions";
			const list = JSON.parse(localStorage.getItem(listKey) || "[]");
			const kept = list.filter((key) => !String(key).includes(STUB));
			for (const key of list) if (String(key).includes(STUB)) localStorage.removeItem(key);
			localStorage.setItem(listKey, JSON.stringify(kept));
		} catch (error) {
			console.warn("[JuiceVault] could not remove the old extension from Marketplace", error);
		}
		for (const key of ["juicevault-settings", "juicevault-eq-state"]) localStorage.removeItem(key);
	}

	if ((Spicetify.Config?.custom_apps || []).includes("juicevault")) {
		removeFromMarketplace();
		return;
	}

	if (Number(localStorage.getItem(SNOOZE_KEY) || 0) > Date.now()) return;

	const h = Spicetify.React.createElement;
	const style = {
		text: { margin: 0, fontSize: ".875rem", lineHeight: 1.5, color: "rgba(255,255,255,.75)" },
		box: { display: "flex", alignItems: "center", gap: "8px", padding: "6px 6px 6px 12px", borderRadius: "6px", background: "rgba(255,255,255,.07)" },
		code: { flex: "1 1 auto", minWidth: 0, overflowX: "auto", scrollbarWidth: "none", whiteSpace: "nowrap", fontFamily: "ui-monospace, Consolas, monospace", fontSize: ".76rem", color: "#fff" },
		button: (primary) => ({
			height: "32px",
			padding: "0 16px",
			borderRadius: "500px",
			border: primary ? "none" : "1px solid rgba(255,255,255,.4)",
			background: primary ? "#fff" : "transparent",
			color: primary ? "#000" : "#fff",
			fontWeight: 700,
			fontSize: ".875rem",
			cursor: "pointer",
		}),
	};

	function Moved() {
		const [copied, setCopied] = Spicetify.React.useState(false);
		return h(
			"div",
			{ style: { display: "flex", flexDirection: "column", gap: "14px", width: "min(460px, 78vw)", color: "#fff" } },
			h("p", { style: style.text }, "This old JuiceVault extension has been replaced by JuiceVault for Spotify 2.0, which adds the vault to Spotify natively. The old version no longer works."),
			h("p", { style: style.text }, `To switch, run this in ${windows ? "PowerShell" : "Terminal"}, then restart Spotify. It also removes this old version.`),
			h(
				"div",
				{ style: style.box },
				h("code", { style: style.code }, command),
				h(
					"button",
					{
						style: { ...style.button(true), height: "28px", padding: "0 12px", fontSize: ".75rem" },
						onClick: () => {
							Spicetify.Platform.ClipboardAPI.copy(command);
							setCopied(true);
						},
					},
					copied ? "Copied" : "Copy",
				),
			),
			h(
				"p",
				{ style: { ...style.text, fontSize: ".78rem", color: "rgba(255,255,255,.55)" } },
				"Need help? Ask in our ",
				h("a", { href: DISCORD, style: { color: "#fff" } }, "Discord"),
				".",
			),
			h(
				"div",
				{ style: { display: "flex", justifyContent: "flex-end", gap: "12px" } },
				h(
					"button",
					{
						style: style.button(false),
						onClick: () => {
							removeFromMarketplace();
							Spicetify.PopupModal.hide();
							Spicetify.showNotification("Old JuiceVault removed. Restart Spotify to finish.");
						},
					},
					"Just remove it",
				),
				h(
					"button",
					{
						style: style.button(true),
						onClick: () => {
							localStorage.setItem(SNOOZE_KEY, String(Date.now() + SNOOZE_MS));
							Spicetify.PopupModal.hide();
						},
					},
					"Remind me tomorrow",
				),
			),
		);
	}

	setTimeout(() => Spicetify.PopupModal.display({ title: "JuiceVault has moved", content: h(Moved) }), 2500);
})();
