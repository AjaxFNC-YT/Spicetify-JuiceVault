import { build } from "esbuild";
import { readFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, resolve } from "node:path";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const pkg = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8"));

const shared = {
	bundle: true,
	format: "iife",
	platform: "browser",
	target: ["chrome110"],
	sourcemap: false,
	legalComments: "none",
	logLevel: "info",
	define: { __JV_VERSION__: JSON.stringify(pkg.version) },
};

export const extensionOptions = {
	...shared,
	entryPoints: [resolve(root, "src", "extension.ts")],
	outfile: resolve(root, "dist", "juicevault-app", "extension.js"),
	banner: { js: `/* JuiceVault for Spotify v${pkg.version} */` },
};

export const appOptions = {
	...shared,
	entryPoints: [resolve(root, "src", "app.tsx")],
	outfile: resolve(root, "dist", "juicevault-app", "index.js"),
	jsx: "transform",
	jsxFactory: "Spicetify.React.createElement",
	jsxFragment: "Spicetify.React.Fragment",
	banner: { js: `/* JuiceVault app v${pkg.version} */` },
};

export const options = extensionOptions;

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
	await build(extensionOptions);
	await build(appOptions);
}
