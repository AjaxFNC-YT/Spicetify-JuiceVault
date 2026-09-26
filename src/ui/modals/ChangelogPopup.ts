import type { NewsItem } from "../../core/api/news";
import { h } from "../h";
import { closeModal } from "../modal";
import { navigate } from "../router";
import { Button } from "../components/controls";
import { NewsBody, newsDate } from "../components/NewsBody";

export function ChangelogPopup({ item }: { item: NewsItem }): any {
	return h(
		"div",
		{ className: "jv-modal jv-news-popup" },
		h("p", { className: "jv-news-date" }, newsDate(item.createdAt)),
		h("div", { className: "jv-news-scroll" }, NewsBody(item)),
		h(
			"div",
			{ className: "jv-modal-actions" },
			Button("secondary", "See full changelog", {
				onClick: () => {
					closeModal();
					navigate("changelog");
				},
			}),
			Button("primary", "Got it", { onClick: closeModal }),
		),
	);
}
