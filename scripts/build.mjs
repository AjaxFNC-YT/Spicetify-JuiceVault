import { build } from "esbuild";
import { readFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, resolve } from "node:path";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const pkg = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8"));

export const outfile = resolve(root, "dist", "juicevault.js");

export const options = {
	entryPoints: [resolve(root, "src", "extension.ts")],
	outfile,
	bundle: true,
	format: "iife",
	platform: "browser",
	target: ["chrome110"],
	sourcemap: false,
	legalComments: "none",
	banner: { js: `/* JuiceVault for Spotify v${pkg.version} */` },
	logLevel: "info",
};

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
	await build(options);
}
