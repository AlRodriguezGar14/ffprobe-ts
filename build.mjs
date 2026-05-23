// Bundles worker.ts (with dist/ffprobe.mjs inlined) into a single
// dist/worker.js. Run after emcc has produced dist/ffprobe.mjs and after
// tsc has emitted the declarations. See Makefile target `bundle`.

import { build } from "esbuild";
import { resolve } from "node:path";

// ffprobe-module.ts imports "./ffprobe.mjs" -- a path with no file at that
// location. This plugin redirects that one specifier to the emcc artifact
// in dist/ so esbuild inlines it. (esbuild's `alias` rejects relative keys.)
const redirectFfprobeModule = {
  name: "redirect-ffprobe-mjs",
  setup(api) {
    api.onResolve({ filter: /^\.\/ffprobe\.mjs$/ }, () => ({
      path: resolve("dist/ffprobe.mjs"),
    }));
  },
};

await build({
  entryPoints: ["worker.ts"],
  outfile: "dist/worker.js",
  bundle: true,
  format: "esm",
  platform: "browser",
  target: "es2020",
  plugins: [redirectFfprobeModule],
});
// Note: ffprobe.mjs fetches ffprobe.wasm at runtime via import.meta.url, not
// an import -- esbuild never sees it. ffprobe.wasm just has to sit beside
// dist/worker.js, which emcc already guarantees.

console.log("bundled dist/worker.js");
