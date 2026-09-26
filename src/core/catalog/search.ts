import type { Song } from "../models/song";

export interface SearchResult {
	song: Song;
	score: number;
}

interface Indexed {
	song: Song;
	title: string;
	artist: string;
	album: string;
	haystack: string;
	tokens: Set<string>;
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

export class SearchIndex {
	private entries: Indexed[] = [];

	build(songs: Song[]): void {
		this.entries = songs.map((song) => {
			const title = normalise(song.title);
			const artist = normalise(song.artist);
			const album = normalise(song.album ?? "");
			const alt = song.altNames.map(normalise).join(" ");
			const haystack = [title, artist, album, alt, normalise(song.fileName ?? "")].join(" ");
			return {
				song,
				title,
				artist,
				album,
				haystack,
				tokens: new Set(haystack.split(" ").filter(Boolean)),
			};
		});
	}

	get size(): number {
		return this.entries.length;
	}

	search(query: string, limit = 50): SearchResult[] {
		const terms = tokenise(query);
		if (!terms.length) return [];

		const results: SearchResult[] = [];

		for (const entry of this.entries) {
			let score = 0;
			let matchedAll = true;

			for (const term of terms) {
				let termScore = 0;

				if (entry.title === term) termScore = 120;
				else if (entry.title.startsWith(term)) termScore = 80;
				else if (entry.tokens.has(term)) termScore = 50;
				else if (entry.haystack.includes(term)) termScore = 25;

				if (!termScore) {
					matchedAll = false;
					break;
				}

				if (entry.artist.includes(term)) termScore += 5;
				score += termScore;
			}

			if (!matchedAll) continue;

			if (entry.title.includes(normalise(query))) score += 40;
			score += Math.min(entry.song.playCount / 5000, 20);

			results.push({ song: entry.song, score });
		}

		results.sort((a, b) => b.score - a.score || a.song.title.localeCompare(b.song.title));
		return results.slice(0, limit);
	}
}
