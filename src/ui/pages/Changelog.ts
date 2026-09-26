import type { NewsItem } from "../../core/api/news";
import { describeError } from "../../core/http/errors";
import type { JuiceVaultApi } from "../bridge";
import { h, useEffect, useState } from "../h";
import { Icon } from "../icons";
import { NewsBody, newsDate } from "../components/NewsBody";

const PAGE = 10;

export function Changelog({ jv }: { jv: JuiceVaultApi | null }): any {
	const [items, setItems] = useState<NewsItem[] | null>(null);
	const [total, setTotal] = useState(0);
	const [open, setOpen] = useState<Record<string, boolean>>({});
	const [error, setError] = useState<string | null>(null);

	const load = async (offset: number): Promise<void> => {
		if (!jv) return;
		try {
			const page = await jv.news.list(PAGE, offset);
			setTotal(page.total);
			setItems((current) => (offset ? [...(current ?? []), ...page.items] : page.items));
			if (!offset && page.items[0]) {
				jv.news.markSeen(page.items[0].id);
				setOpen({ [page.items[0].id]: true });
			}
		} catch (failure) {
			setError(describeError(failure, "Could not load the changelog."));
		}
	};

	useEffect(() => {
		void load(0);
	}, [jv]);

	return h(
		"div",
		{ className: "jv-settings jv-page" },
		h("h1", null, "Changelog"),
		h("p", { className: "jv-page-sub" }, "Archive updates and announcements from JuiceVault. Tap a song to play it."),
		error
			? h("div", { className: "jv-empty" }, error)
			: items === null
				? h("div", { className: "jv-empty" }, "Loading…")
				: !items.length
					? h("div", { className: "jv-empty" }, "Nothing here yet.")
					: h(
							"div",
							{ className: "jv-news-list" },
							items.map((item) =>
								h(
									"article",
									{ key: item.id, className: "jv-news-card", "data-open": String(Boolean(open[item.id])) },
									h(
										"button",
										{ className: "jv-news-head", onClick: () => setOpen({ ...open, [item.id]: !open[item.id] }) },
										h(
											"span",
											{ className: "jv-news-heading" },
											h("span", { className: "jv-news-title" }, item.title || "Update"),
											h("span", { className: "jv-news-date" }, newsDate(item.createdAt)),
										),
										h("span", { className: "jv-news-chevron" }, Icon("chevron-down", 16)),
									),
									open[item.id] ? NewsBody(item) : null,
								),
							),
							items.length < total ? h("button", { className: "jv-more", onClick: () => void load(items.length) }, "Show older") : null,
						),
	);
}
