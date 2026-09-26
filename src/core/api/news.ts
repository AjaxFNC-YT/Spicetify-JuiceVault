import { get } from "../http/client";

export interface NewsBlock {
	type: string;
	content: Record<string, any>;
	inline?: boolean;
}

export interface NewsItem {
	id: string;
	title: string;
	body: string;
	blocks: NewsBlock[];
	icon: string;
	priority: string;
	image: string | null;
	popupEnabled: boolean;
	createdAt: string;
}

interface Envelope<T> {
	success: boolean;
	data: T;
	total?: number;
}

function toNews(raw: any): NewsItem | null {
	if (!raw || typeof raw !== "object") return null;
	return {
		id: String(raw._id ?? raw.id ?? ""),
		title: typeof raw.title === "string" ? raw.title : "",
		body: typeof raw.body === "string" ? raw.body : "",
		blocks: Array.isArray(raw.blocks) ? raw.blocks : [],
		icon: typeof raw.icon === "string" ? raw.icon : "info",
		priority: typeof raw.priority === "string" ? raw.priority : "normal",
		image: typeof raw.image === "string" && raw.image ? raw.image : null,
		popupEnabled: raw.popupEnabled === true,
		createdAt: typeof raw.createdAt === "string" ? raw.createdAt : "",
	};
}

export async function listNews(limit = 20, offset = 0): Promise<{ items: NewsItem[]; total: number }> {
	const result = await get<Envelope<unknown[]>>(`/misc/news?limit=${limit}&offset=${offset}`);
	const items = (result?.data ?? []).map(toNews).filter((item): item is NewsItem => Boolean(item));
	return { items, total: Number(result?.total ?? items.length) };
}
