import type { Song } from "../models/song";

export interface SearchResult {
	song: Song;
	score: number;
	matchedName: string | null;
}

interface Name {
	raw: string;
	norm: string;
	tokens: Set<string>;
}

interface Indexed {
	song: Song;
	names: Name[];
	context: string;
	contextTokens: Set<string>;
}

function normalise(value: string): string {
	return value
		.toLowerCase()
		.replace(/[‘’“”]/g, "'")
		.replace(/[^a-z0-9'\s]/g, " ")
		.replace(/\s+/g, " ")
		.trim();
}

function tokenise(value: string): string[] {
	return normalise(value).split(" ").filter(Boolean);
}

function subsequenceScore(term: string, text: string): number {
	if (term.length < 2) return 0;
	let index = 0;
	let score = 0;
	let streak = 0;

	for (let i = 0; i < text.length && index < term.length; i += 1) {
		if (text[i] === term[index]) {
			index += 1;
			streak += 1;
			score += 2 + Math.min(streak, 6);
		} else if (streak) {
			streak = 0;
		}
	}

	if (index < term.length) return 0;
	return Math.min(score / 2, 22);
}

function toName(raw: string): Name | null {
	const norm = normalise(raw);
	if (!norm) return null;
	return { raw: raw.trim(), norm, tokens: new Set(norm.split(" ")) };
}

function scoreName(name: Name, entry: Indexed, terms: string[], phrase: string, fuzzy: boolean): number | null {
	let score = 0;

	for (const term of terms) {
		let termScore = 0;

		if (name.tokens.has(term)) termScore = name.norm.startsWith(term) ? 60 : 50;
		else if (name.norm.includes(term)) termScore = 30;
		else if (entry.contextTokens.has(term)) termScore = 20;
		else if (entry.context.includes(term)) termScore = 10;
		else if (fuzzy) termScore = Math.max(subsequenceScore(term, name.norm), subsequenceScore(term, entry.context) / 2);

		if (!termScore) return null;
		score += termScore;
	}

	if (name.norm === phrase) score += 200;
	else if (name.norm.startsWith(phrase)) score += 120;
	else if (name.norm.includes(phrase)) score += 60;

	return score;
}

export class SearchIndex {
	private entries: Indexed[] = [];

	build(songs: Song[]): void {
		this.entries = songs.map((song) => {
			const names = [song.title, ...song.altNames].map(toName).filter((name): name is Name => Boolean(name));
			const context = [song.artist, song.album ?? "", song.fileName ?? ""].map(normalise).join(" ").trim();
			return {
				song,
				names,
				context,
				contextTokens: new Set(context.split(" ").filter(Boolean)),
			};
		});
	}

	get size(): number {
		return this.entries.length;
	}

	search(query: string, limit = 50, fuzzy = true): SearchResult[] {
		const terms = tokenise(query);
		if (!terms.length) return [];
		const phrase = terms.join(" ");

		const results: SearchResult[] = [];

		for (const entry of this.entries) {
			let best: number | null = null;
			let bestIndex = 0;

			entry.names.forEach((name, index) => {
				const score = scoreName(name, entry, terms, phrase, fuzzy);
				if (score === null) return;
				const adjusted = index === 0 ? score + 1 : score;
				if (best === null || adjusted > best) {
					best = adjusted;
					bestIndex = index;
				}
			});

			if (best === null) continue;

			const main = entry.names[0];
			const mainCoversQuery = Boolean(main && main.norm.includes(phrase));
			const matchedName = bestIndex > 0 && !mainCoversQuery ? entry.names[bestIndex]!.raw : null;
			const score = (best as number) + Math.min(entry.song.playCount / 5000, 20);
			results.push({ song: entry.song, score, matchedName });
		}

		results.sort((a, b) => b.score - a.score || a.song.title.localeCompare(b.song.title));
		return results.slice(0, limit);
	}
}

export function displaySong(result: SearchResult): Song {
	return result.matchedName ? { ...result.song, title: result.matchedName } : result.song;
}
