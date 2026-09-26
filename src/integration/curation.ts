declare const Spicetify: any;

export const LIKED_URI = "spotify:collection:tracks";

export interface CurationTarget {
	uri: string;
	name: string;
	image: string | null;
	count: number | null;
	curated: boolean;
}

function imageOf(item: any): string | null {
	const images = item?.images;
	if (Array.isArray(images)) return images[0]?.url ?? null;
	return typeof images === "string" ? images : null;
}

async function isLiked(uri: string): Promise<boolean> {
	try {
		const result = await Spicetify.Platform.LibraryAPI.contains(uri);
		return Array.isArray(result) ? Boolean(result[0]) : Boolean(result);
	} catch {
		return false;
	}
}

async function fromCuration(uri: string): Promise<CurationTarget[] | null> {
	const curation = Spicetify.Platform?.CurationAPI;
	if (typeof curation?.getCurationContexts !== "function") return null;
	try {
		const result = await curation.getCurationContexts({ curatedItemUri: uri, limit: 1000, flatten: true });
		if (!Array.isArray(result?.items)) return null;
		return result.items
			.filter((item: any) => item?.uri && item.uri !== LIKED_URI && String(item.type).toLowerCase().includes("playlist"))
			.map((item: any) => ({
				uri: item.uri,
				name: item.name || "Untitled",
				image: imageOf(item),
				count: Number.isFinite(item.trackCount) ? item.trackCount : null,
				curated: Boolean(item.hasCuratedItems),
			}));
	} catch {
		return null;
	}
}

async function fromRootlist(): Promise<CurationTarget[]> {
	const contents = await Spicetify.Platform.RootlistAPI.getContents({ limit: 1000 });
	const out: CurationTarget[] = [];
	const walk = (items: any[]): void => {
		for (const item of items ?? []) {
			if (item?.type === "folder") walk(item.items);
			else if (item?.type === "playlist" && item.isOwnedBySelf && item.canAdd !== false) {
				out.push({ uri: item.uri, name: item.name || "Untitled", image: imageOf(item), count: null, curated: false });
			}
		}
	};
	walk(contents?.items ?? []);
	return out;
}

export async function curationTargets(uri: string): Promise<CurationTarget[]> {
	const [liked, playlists] = await Promise.all([isLiked(uri), fromCuration(uri).then((found) => found ?? fromRootlist())]);
	return [{ uri: LIKED_URI, name: "Liked Songs", image: null, count: null, curated: liked }, ...playlists];
}

export async function applyCuration(uri: string, add: string[], remove: string[]): Promise<void> {
	const library = Spicetify.Platform.LibraryAPI;
	const playlists = Spicetify.Platform.PlaylistAPI;
	for (const target of add) {
		if (target === LIKED_URI) await library.add({ uris: [uri] });
		else await playlists.add(target, [uri], { before: "end" });
	}
	for (const target of remove) {
		if (target === LIKED_URI) await library.remove({ uris: [uri] });
		else await playlists.remove(target, [{ uri, uid: "" }]);
	}
}
