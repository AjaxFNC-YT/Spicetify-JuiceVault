import { config } from "./config";

type Level = "debug" | "info" | "warn" | "error";

const STYLE = "background:#1db954;color:#000;font-weight:bold;padding:2px 6px;border-radius:3px";

function emit(level: Level, scope: string, args: unknown[]): void {
	if (level === "debug" && !config.debug) return;
	const method = level === "debug" ? "log" : level;
	(console[method] as (...a: unknown[]) => void)(`%cJV%c ${scope}`, STYLE, "color:inherit", ...args);
}

export interface Logger {
	debug(...args: unknown[]): void;
	info(...args: unknown[]): void;
	warn(...args: unknown[]): void;
	error(...args: unknown[]): void;
}

export function createLogger(scope: string): Logger {
	return {
		debug: (...args) => emit("debug", scope, args),
		info: (...args) => emit("info", scope, args),
		warn: (...args) => emit("warn", scope, args),
		error: (...args) => emit("error", scope, args),
	};
}
