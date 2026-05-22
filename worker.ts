/// <reference lib="webworker" />
// ffprobe-ts worker. esbuild bundles this with dist/ffprobe.mjs into
// dist/worker.js; ffprobe.wasm is fetched next to that bundle at runtime.
// Consumers do not load this directly -- client.ts spawns it.
import createFfprobe, { type FfprobeModule } from "./ffprobe-module.js";
import type { ProbeRequest, ProbeResponse } from "./protocol.js";

const ctx = self as DedicatedWorkerGlobalScope;

// Instantiate the wasm module once and reuse it across messages.
const modulePromise: Promise<FfprobeModule> = createFfprobe();

const MOUNT = "/work";

function reply(port: MessagePort, msg: ProbeResponse): void {
  port.postMessage(msg);
}

async function handleProbe(file: File, port: MessagePort): Promise<void> {
  const mod = await modulePromise;
  const { FS, WORKERFS } = mod;

  // Zero-copy mount of the File via WORKERFS.
  if (!FS.analyzePath(MOUNT).exists) {
    FS.mkdir(MOUNT);
  }
  FS.mount(WORKERFS, { files: [file] }, MOUNT);

  try {
    const result = mod.probe(`${MOUNT}/${file.name}`);
    reply(port, { ok: true, result });
  } finally {
    // Always unmount, even if probe threw, so the next message starts clean.
    FS.unmount(MOUNT);
  }
}

ctx.onmessage = (event: MessageEvent<ProbeRequest>): void => {
  const req = event.data;
  const port = event.ports[0];
  if (!port) {
    return; // No reply channel -- client always supplies one.
  }

  switch (req.type) {
    case "probe":
      handleProbe(req.file, port).catch((err: unknown) => {
        const error =
          err instanceof Error ? (err.stack ?? err.message) : String(err);
        reply(port, { ok: false, error: `ffprobe worker crashed: ${error}` });
      });
      break;
  }
};
