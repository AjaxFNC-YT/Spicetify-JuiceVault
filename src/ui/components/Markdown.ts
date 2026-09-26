import { h } from "../h";

export interface LinkHandler {
	(href: string, children: any[], key: string): any;
}

const WORD = /[A-Za-z0-9]/;
const BARE_URL = /^(?:https?:\/\/|www\.)[^\s<>()]+(?:\([^\s<>()]*\)[^\s<>()]*)*/;
const SONG_LINK = /juicevault\.xyz\/(?:archive|sessions)\/([0-9a-f-]{36})/i;

export function songIdFromLink(href: string): string | null {
	return href.match(SONG_LINK)?.[1] ?? null;
}

function inline(text: string, link: LinkHandler, prefix: string): any[] {
	const out: any[] = [];
	let buffer = "";
	let index = 0;
	let key = 0;

	const flush = (): void => {
		if (buffer) out.push(buffer);
		buffer = "";
	};

	while (index < text.length) {
		const char = text[index]!;

		if (char === "\\" && index + 1 < text.length) {
			buffer += text[index + 1];
			index += 2;
			continue;
		}

		if (char === "`") {
			const end = text.indexOf("`", index + 1);
			if (end > index) {
				flush();
				out.push(h("code", { key: `${prefix}c${key++}` }, text.slice(index + 1, end)));
				index = end + 1;
				continue;
			}
		}

		if (char === "*" && text[index + 1] === "*") {
			const end = findClosing(text, "**", index + 2);
			if (end > 0) {
				flush();
				out.push(h("strong", { key: `${prefix}b${key++}` }, inline(text.slice(index + 2, end), link, `${prefix}b${key}`)));
				index = end + 2;
				continue;
			}
		}

		if ((char === "*" || char === "_") && text[index + 1] !== char && text[index + 1] !== " " && (char === "*" || !WORD.test(text[index - 1] ?? ""))) {
			const end = findEmphasisEnd(text, char, index + 1);
			if (end > index + 1) {
				flush();
				out.push(h("em", { key: `${prefix}i${key++}` }, inline(text.slice(index + 1, end), link, `${prefix}i${key}`)));
				index = end + 1;
				continue;
			}
		}

		if (char === "[") {
			const close = findBalanced(text, index, "[", "]");
			if (close > 0 && text[close + 1] === "(") {
				const end = findBalanced(text, close + 1, "(", ")");
				if (end > 0) {
					flush();
					const label = inline(text.slice(index + 1, close), link, `${prefix}l${key}`);
					out.push(link(text.slice(close + 2, end).trim(), label, `${prefix}l${key++}`));
					index = end + 1;
					continue;
				}
			}
		}

		if ((char === "h" || char === "w") && !WORD.test(text[index - 1] ?? "")) {
			const url = text.slice(index).match(BARE_URL)?.[0]?.replace(/[.,;:!?'"]+$/, "");
			if (url) {
				flush();
				const href = url.startsWith("www.") ? `https://${url}` : url;
				out.push(link(href, [url], `${prefix}u${key++}`));
				index += url.length;
				continue;
			}
		}

		buffer += char;
		index += 1;
	}

	flush();
	return out;
}

function findBalanced(text: string, open: number, opener: string, closer: string): number {
	let depth = 0;
	for (let i = open; i < text.length; i += 1) {
		const char = text[i];
		if (char === "\\") {
			i += 1;
			continue;
		}
		if (char === opener) depth += 1;
		else if (char === closer && --depth === 0) return i;
	}
	return -1;
}

function findEmphasisEnd(text: string, marker: string, from: number): number {
	for (let i = from; i < text.length; i += 1) {
		if (text[i] === "\\") {
			i += 1;
			continue;
		}
		if (text[i] !== marker || text[i - 1] === " ") continue;
		if (marker === "_" && WORD.test(text[i + 1] ?? "")) continue;
		return i;
	}
	return -1;
}

function findClosing(text: string, marker: string, from: number): number {
	for (let i = from; i <= text.length - marker.length; i += 1) {
		if (text[i] === "\\") {
			i += 1;
			continue;
		}
		if (text.startsWith(marker, i)) return i;
	}
	return -1;
}

export function Markdown(source: string, link: LinkHandler): any {
	const lines = source.replace(/\r\n/g, "\n").split("\n");
	const blocks: any[] = [];
	let list: string[] = [];
	let ordered = false;
	let paragraph: string[] = [];
	let key = 0;

	const flushParagraph = (): void => {
		if (!paragraph.length) return;
		blocks.push(h("p", { key: `p${key}` }, inline(paragraph.join(" "), link, `p${key++}`)));
		paragraph = [];
	};

	const flushList = (): void => {
		if (!list.length) return;
		const items = list.map((item, index) => h("li", { key: index }, inline(item, link, `li${key}-${index}`)));
		blocks.push(h(ordered ? "ol" : "ul", { key: `l${key++}` }, items));
		list = [];
	};

	for (const raw of lines) {
		const line = raw.trimEnd();
		const heading = line.match(/^(#{1,6})\s+(.*)$/);
		const bullet = line.match(/^\s*[-*+]\s+(.*)$/);
		const numbered = line.match(/^\s*\d+[.)]\s+(.*)$/);

		if (!line.trim()) {
			flushParagraph();
			flushList();
		} else if (/^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) {
			flushParagraph();
			flushList();
			blocks.push(h("hr", { key: `hr${key++}` }));
		} else if (heading) {
			flushParagraph();
			flushList();
			const level = Math.min(heading[1]!.length + 1, 6);
			blocks.push(h(`h${level}`, { key: `h${key}` }, inline(heading[2]!, link, `h${key++}`)));
		} else if (bullet || numbered) {
			flushParagraph();
			const isOrdered = Boolean(numbered && !bullet);
			if (list.length && isOrdered !== ordered) flushList();
			ordered = isOrdered;
			list.push((bullet ?? numbered)![1]!);
		} else {
			flushList();
			paragraph.push(line.trim());
		}
	}

	flushParagraph();
	flushList();
	return h("div", { className: "jv-md" }, blocks);
}
