// Wire contract between index.ts and worker.ts. Imported by both sides so
// the postMessage payloads are checked at compile time on each end.

import type { ProbeResult } from "./types/index.js";

// Client -> worker. Discriminated on `type` to leave room for future ops.
export type ProbeRequest = {
  type: "probe";
  file: File;
};

// worker -> client. `ok` discriminates success from a thrown/crashed worker.
// A non-zero ProbeResult.error_code is still `ok: true` -- it is a valid
// ffprobe answer, not a worker failure.
export type ProbeResponse =
  | { ok: true; result: ProbeResult }
  | { ok: false; error: string };
