// Public entry point. Consumers import { probe } and never touch the Worker
// or wasm directly:
//
//   import { probe } from "ffprobe-ts";
//   const res = await probe(file);
//   if (res.error_code === 0) console.log(res.response.format);

import type { ProbeRequest, ProbeResponse } from "./protocol.js";
import type { ProbeResult } from "./types/index.js";

export type {
  Chapter,
  Disposition,
  FileResponse,
  Format,
  ProbeResult,
  Rational,
  Stream,
  Tag,
} from "./types/index.js";

// Lazily spawned, then reused: the wasm module is instantiated once inside
// the worker and amortized across every probe() call.
let worker: Worker | undefined;

function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(new URL("./worker.js", import.meta.url), {
      type: "module",
    });
  }
  return worker;
}

/**
 * Probe a media File with ffprobe. Resolves with the ProbeResult; a non-zero
 * `error_code` is a normal ffprobe answer (e.g. unsupported file), not a
 * thrown error. Rejects only if the worker itself crashes.
 */
export function probe(file: File): Promise<ProbeResult> {
  return new Promise((resolve, reject) => {
    const channel = new MessageChannel();

    channel.port1.onmessage = (event: MessageEvent<ProbeResponse>) => {
      channel.port1.close();
      const msg = event.data;
      if (msg.ok) {
        resolve(msg.result);
      } else {
        reject(new Error(msg.error));
      }
    };

    const request: ProbeRequest = { type: "probe", file };
    getWorker().postMessage(request, [channel.port2]);
  });
}

/** Terminate the shared worker. The next probe() spawns a fresh one. */
export function dispose(): void {
  worker?.terminate();
  worker = undefined;
}
