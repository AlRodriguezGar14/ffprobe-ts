// Public entry point. Consumers import { probe } and never touch the Worker
// or wasm directly:
//
//   import { probe } from "ffprobe-ts";
//   const res = await probe(file);
//   if (res.error_code === 0) console.log(res.response.format);
// Lazily spawned, then reused: the wasm module is instantiated once inside
// the worker and amortized across every probe() call.
let worker;
function getWorker() {
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
export function probe(file) {
    return new Promise((resolve, reject) => {
        const channel = new MessageChannel();
        channel.port1.onmessage = (event) => {
            channel.port1.close();
            const msg = event.data;
            if (msg.ok) {
                resolve(msg.result);
            }
            else {
                reject(new Error(msg.error));
            }
        };
        const request = { type: "probe", file };
        getWorker().postMessage(request, [channel.port2]);
    });
}
/** Terminate the shared worker. The next probe() spawns a fresh one. */
export function dispose() {
    worker?.terminate();
    worker = undefined;
}
