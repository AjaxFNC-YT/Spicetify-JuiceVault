import { coverUrl } from "../core/config";
import { albumName } from "../core/settings/device";
import { buildTrackUri } from "../integration/uri";
import type { ShadowTrack } from "./ShadowPlayer";

type PlayerState = Record<string, any>;

export interface PlaybackContext {
	uid?: string;
	contextUri?: string;
	contextName?: string;
	index?: number;
}

const VIDEO_KEY = /(video|canvas|vsi|visual|clip)/i;

function stripMedia(metadata: PlayerState | null | undefined): PlayerState {
	const clean: PlayerState = {};
	for (const [key, value] of Object.entries(metadata ?? {})) {
		if (VIDEO_KEY.test(key)) continue;
		clean[key] = value;
	}
	return clean;
}

export function buildItem(track: ShadowTrack, baselineItem: PlayerState | null, context?: PlaybackContext): PlayerState {
	const uri = buildTrackUri({
		songId: track.songId,
		artist: track.artist,
		title: track.title,
		durationSeconds: track.durationSeconds,
	});

	const artist = { type: "artist", uri, name: track.artist || "Juice WRLD" };
	const cover = track.cover || coverUrl(track.songId);

	return {
		...(baselineItem ?? {}),
		type: "track",
		uid: context?.uid ?? `jv-${track.songId}`,
		uri,
		name: track.title,
		duration: { milliseconds: Math.round(track.durationSeconds * 1000) },
		artists: [artist],
		album: {
			...(baselineItem?.album ?? {}),
			type: "album",
			uri,
			name: albumName(track.album),
			artist,
			images: [
				{ url: cover, label: "xlarge" },
				{ url: cover, label: "large" },
				{ url: cover, label: "standard" },
				{ url: cover, label: "small" },
			],
		},
		images: [
			{ url: cover, label: "xlarge" },
			{ url: cover, label: "large" },
			{ url: cover, label: "standard" },
			{ url: cover, label: "small" },
		],
		mediaType: "audio",
		hasAssociatedVideo: false,
		associatedVideoUri: null,
		metadata: {
			...stripMedia(baselineItem?.metadata),
			title: track.title,
			artist_name: track.artist,
			album_title: albumName(track.album),
			image_url: cover,
			image_small_url: cover,
			image_large_url: cover,
			image_xlarge_url: cover,
			"image_url_hq": cover,
			duration: String(Math.round(track.durationSeconds * 1000)),
			is_local: "true",
		},
		isLocal: true,
		isPlayable: true,
		isExplicit: false,
		isBanned: false,
	};
}

export interface ProjectionInput {
	baseline: PlayerState | null;
	track: ShadowTrack;
	positionSeconds: number;
	durationSeconds: number;
	isPaused: boolean;
	context?: PlaybackContext;
	nextItems?: any[];
	previousItems?: any[];
	shuffle?: boolean;
	repeat?: number;
}

function clone(state: PlayerState | null): PlayerState {
	if (!state) return {};
	try {
		return structuredClone(state);
	} catch {
		return JSON.parse(JSON.stringify(state));
	}
}

function permit(restrictions: PlayerState | null | undefined): PlayerState {
	const result: PlayerState = { ...(restrictions ?? {}) };
	for (const key of Object.keys(result)) {
		if (key.startsWith("disallow")) result[key] = [];
		else if (key.startsWith("can")) result[key] = true;
	}
	result.disallowPausingReasons = [];
	result.disallowResumingReasons = [];
	result.disallowSeekingReasons = [];
	return result;
}

export function buildState(input: ProjectionInput): PlayerState {
	const state = clone(input.baseline);
	const durationMs = Math.round((input.durationSeconds || input.track.durationSeconds) * 1000);

	state.item = buildItem(input.track, input.baseline?.item ?? null, input.context);

	if (input.context?.contextUri) {
		const metadata = { ...(state.context?.metadata ?? {}) };
		if (input.context.contextName) {
			metadata.context_description = input.context.contextName;
			metadata.context_uri = input.context.contextUri;
		}
		state.context = { ...(state.context ?? {}), uri: input.context.contextUri, metadata };
	}
	if (typeof input.context?.index === "number") {
		state.index = { pageIndex: 0, itemIndex: input.context.index };
	}
	state.duration = durationMs;
	state.positionAsOfTimestamp = Math.round(input.positionSeconds * 1000);
	state.timestamp = Date.now();
	state.isPaused = input.isPaused;
	state.isBuffering = false;
	state.hasContext = true;
	state.restrictions = permit(input.baseline?.restrictions);
	state.mediaPlaybackMode = 0;
	state.format = null;
	state.nextItems = input.nextItems ?? [];
	state.previousItems = input.previousItems ?? [];
	if (typeof input.shuffle === "boolean") state.shuffle = input.shuffle;
	if (typeof input.repeat === "number") state.repeat = input.repeat;

	return state;
}
