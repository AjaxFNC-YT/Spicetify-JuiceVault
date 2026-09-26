import { useEffect, useState } from "./h";

declare const Spicetify: any;

export type View = "browse" | "profile" | "settings" | "login";

const VIEWS: View[] = ["browse", "profile", "settings", "login"];
const BASE = "/juicevault";

function readView(): View {
	const search: string = Spicetify.Platform?.History?.location?.search ?? "";
	const value = new URLSearchParams(search).get("view");
	return VIEWS.includes(value as View) ? (value as View) : "browse";
}

export function navigate(view: View, replace = false): void {
	const history = Spicetify.Platform?.History;
	if (!history) return;
	const target = view === "browse" ? BASE : `${BASE}?view=${view}`;
	if (replace) history.replace(target);
	else history.push(target);
}

export function useView(): View {
	const [view, setView] = useState<View>(readView());

	useEffect(() => {
		const history = Spicetify.Platform?.History;
		if (!history?.listen) return;
		const stop = history.listen(() => setView(readView()));
		return () => {
			if (typeof stop === "function") stop();
		};
	}, []);

	return view;
}
