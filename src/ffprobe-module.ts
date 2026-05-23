// Typed wrapper around the Emscripten artifact dist/ffprobe.mjs (emcc emits
// no .d.ts). worker.ts imports the factory from here; esbuild resolves the
// real ./ffprobe.mjs at bundle time, when it sits beside the output.
import type { ProbeResult } from "./types/index.js";

// Emscripten FS node, narrowed to what the worker mounts/unmounts.
export interface EmscriptenFS {
  analyzePath(path: string): { exists: boolean };
  mkdir(path: string): void;
  mount(type: unknown, opts: { files: File[] }, mountpoint: string): void;
  unmount(mountpoint: string): void;
}

// Instance returned by createFfprobe(). `probe` is the embind export from
// ffprobe_bindings.cpp; FS/WORKERFS come from -lworkerfs.js.
export interface FfprobeModule {
  probe(path: string): ProbeResult;
  FS: EmscriptenFS;
  WORKERFS: unknown;
}

// MODULARIZE=1 + EXPORT_ES6=1 factory signature.
export type CreateFfprobe = (
  moduleArg?: Record<string, unknown>,
) => Promise<FfprobeModule>;

// ./ffprobe.mjs does not exist at type-check time -- it is produced by emcc
// into dist/ and only present when esbuild bundles. The cast pins the type.
// @ts-expect-error -- resolved by esbuild, absent during tsc.
import createFfprobeUntyped from "./ffprobe.mjs";

const createFfprobe = createFfprobeUntyped as CreateFfprobe;

export default createFfprobe;
