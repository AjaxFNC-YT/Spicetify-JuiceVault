import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve, join } from "node:path";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const built = resolve(root, "dist", "juicevault.js");

if (!existsSync(built)) {
	console.error("dist/juicevault.js is missing — run `npm run build` first");
	process.exit(1);
}

function spicetify(...args) {
	return execFileSync("spicetify", args, { encoding: "utf8" }).trim();
}

const configPath = spicetify("-c");
const spicetifyRoot = dirname(configPath);
const extensionsDir = join(spicetifyRoot, "Extensions");

if (!existsSync(extensionsDir)) mkdirSync(extensionsDir, { recursive: true });

const target = join(extensionsDir, "juicevault.js");
copyFileSync(built, target);
console.log(`copied -> ${target}`);

const current = spicetify("config", "extensions");
if (!current.includes("juicevault.js")) {
	spicetify("config", "extensions", "juicevault.js");
	console.log("registered extension");
}

console.log(spicetify("apply"));
