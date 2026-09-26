import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve, join } from "node:path";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const built = resolve(root, "dist", "juicevault-app");
const manifest = resolve(root, "customapp", "manifest.json");

if (!existsSync(join(built, "index.js")) || !existsSync(join(built, "extension.js"))) {
	console.error("dist/juicevault-app is incomplete — run `npm run build` first");
	process.exit(1);
}

function spicetify(...args) {
	return execFileSync("spicetify", args, { encoding: "utf8" }).trim();
}

const spicetifyRoot = dirname(spicetify("-c"));
const appDir = join(spicetifyRoot, "CustomApps", "juicevault");

if (!existsSync(appDir)) mkdirSync(appDir, { recursive: true });

copyFileSync(join(built, "index.js"), join(appDir, "index.js"));
copyFileSync(join(built, "extension.js"), join(appDir, "extension.js"));
copyFileSync(manifest, join(appDir, "manifest.json"));
console.log(`installed -> ${appDir}`);

const apps = spicetify("config", "custom_apps");
if (!apps.includes("juicevault")) {
	spicetify("config", "custom_apps", "juicevault");
	console.log("registered custom app");
}

const extensions = spicetify("config", "extensions");
if (extensions.includes("juicevault.js")) {
	spicetify("config", "extensions", "juicevault.js-");
	console.log("removed the standalone extension registration");
}

const legacy = join(spicetifyRoot, "Extensions", "juicevault.js");
if (existsSync(legacy)) {
	rmSync(legacy);
	console.log("removed the legacy extension file");
}

console.log(spicetify("apply"));
