import { context } from "esbuild";
import { execFileSync } from "node:child_process";
import { options } from "./build.mjs";

const reinstall = {
	name: "reinstall",
	setup(build) {
		build.onEnd((result) => {
			if (result.errors.length) return;
			try {
				execFileSync(process.execPath, ["scripts/install.mjs"], { stdio: "inherit" });
			} catch {
				console.error("install step failed");
			}
		});
	},
};

const ctx = await context({ ...options, plugins: [reinstall] });
await ctx.watch();
console.log("watching src/ — edit a file to rebuild and reinstall");
