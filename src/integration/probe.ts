import { createLogger } from "../core/log";

const log = createLogger("probe");

export interface Capabilities {
	platform: boolean;
	playerApi: boolean;
	stateWritable: boolean;
	eventsEmit: boolean;
	transportShadowable: boolean;
	volumeReadable: boolean;
	nowPlayingWidget: boolean;
}

function descriptorWritable(target: object, key: string): boolean {
	const own = Object.getOwnPropertyDescriptor(target, key);
	const proto = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(target), key);
	const descriptor = own ?? proto;
	return Boolean(descriptor && (descriptor.writable || descriptor.configurable));
}

export function probeCapabilities(): Capabilities {
	const platform = typeof Spicetify !== "undefined" && Boolean(Spicetify.Platform);
	const playerApi = platform && Boolean(Spicetify.Platform.PlayerAPI);
	const api = playerApi ? Spicetify.Platform.PlayerAPI : null;

	const capabilities: Capabilities = {
		platform,
		playerApi,
		stateWritable: Boolean(api) && descriptorWritable(api, "_state"),
		eventsEmit: Boolean(api?._events) && typeof api._events.emit === "function",
		transportShadowable:
			Boolean(api) && ["pause", "resume", "seekTo"].every((key) => descriptorWritable(api, key)),
		volumeReadable:
			platform &&
			(typeof Spicetify.Platform.PlaybackAPI?.getVolume === "function" || typeof Spicetify.Player?.getVolume === "function"),
		nowPlayingWidget: Boolean(document.querySelector('[data-testid="now-playing-widget"]')),
	};

	const missing = Object.entries(capabilities)
		.filter(([, value]) => !value)
		.map(([key]) => key);

	if (missing.length) log.warn("unavailable capabilities:", missing.join(", "));
	else log.debug("all capabilities available");

	return capabilities;
}
