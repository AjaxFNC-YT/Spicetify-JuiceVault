import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const pkg = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8"));
const name = `JuiceVault-Spicetify-${pkg.version}`;
const built = resolve(root, "dist", "juicevault-app");
const releaseDir = resolve(root, "dist", "release");
const stage = join(releaseDir, name);
const zip = join(releaseDir, `${name}.zip`);

execFileSync(process.execPath, [resolve(root, "scripts", "build.mjs")], { stdio: "inherit" });

rmSync(stage, { recursive: true, force: true });
rmSync(zip, { force: true });
mkdirSync(join(stage, "juicevault"), { recursive: true });

for (const file of ["index.js", "extension.js"]) {
	if (!existsSync(join(built, file))) throw new Error(`dist/juicevault-app/${file} is missing`);
	copyFileSync(join(built, file), join(stage, "juicevault", file));
}
copyFileSync(resolve(root, "customapp", "manifest.json"), join(stage, "juicevault", "manifest.json"));
copyFileSync(resolve(root, "juicevault-spicetify-installer.ps1"), join(stage, "juicevault-spicetify-installer.ps1"));
writeFileSync(join(stage, "juicevault-spicetify-installer.sh"), readFileSync(resolve(root, "juicevault-spicetify-installer.sh"), "utf8").replace(/\r\n/g, "\n"), { mode: 0o755 });

if (process.platform === "win32") {
	const tar = join(process.env.SystemRoot ?? "C:\\Windows", "System32", "tar.exe");
	execFileSync(tar, ["-a", "-c", "-f", zip, "-C", stage, "juicevault", "juicevault-spicetify-installer.ps1", "juicevault-spicetify-installer.sh"], { stdio: "inherit" });
} else {
	execFileSync("zip", ["-r", "-q", zip, "juicevault", "juicevault-spicetify-installer.ps1", "juicevault-spicetify-installer.sh"], { cwd: stage, stdio: "inherit" });
}
rmSync(stage, { recursive: true, force: true });

console.log(`\npackaged -> ${zip}`);
