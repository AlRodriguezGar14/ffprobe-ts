import type { ProbeResult } from "./types/index.js";
export type { Chapter, Disposition, FileResponse, Format, ProbeResult, Rational, Stream, Tag, } from "./types/index.js";
/**
 * Probe a media File with ffprobe. Resolves with the ProbeResult; a non-zero
 * `error_code` is a normal ffprobe answer (e.g. unsupported file), not a
 * thrown error. Rejects only if the worker itself crashes.
 */
export declare function probe(file: File): Promise<ProbeResult>;
/** Terminate the shared worker. The next probe() spawns a fresh one. */
export declare function dispose(): void;
