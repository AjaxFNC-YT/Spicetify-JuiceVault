import { h, native } from "../h";

export function Button(kind: "primary" | "secondary", label: string, props: Record<string, unknown> = {}): any {
	const RC = native();
	const Component = kind === "primary" ? RC.ButtonPrimary : RC.ButtonSecondary;
	if (Component) return h(Component, { buttonSize: "sm", ...props }, label);
	return h("button", { className: `jv-btn jv-btn--${kind}`, ...props }, label);
}

export function Toggle(value: boolean, onChange: (next: boolean) => void, disabled = false, label = ""): any {
	return h(
		"label",
		{ className: "jv-toggle", "data-disabled": String(disabled), "aria-label": label },
		h("input", {
			type: "checkbox",
			checked: value,
			disabled,
			onChange: (event: any) => onChange(Boolean(event.target.checked)),
		}),
		h("span", { className: "jv-toggle-track" }, h("span", { className: "jv-toggle-knob" })),
	);
}

export function Avatar(src: string | null, name: string, size: number): any {
	if (src) return h("img", { className: "jv-avatar", src, alt: "", style: { width: size, height: size } });
	const initial = (name || "?").trim().charAt(0).toUpperCase();
	return h(
		"span",
		{ className: "jv-avatar jv-avatar--empty", style: { width: size, height: size, fontSize: Math.round(size * 0.42) } },
		initial,
	);
}
