# ffprobe-ts

FFprobe compiled to WebAssembly with TypeScript bindings. Probes a
media `File` in a Web Worker. No setup, no worker wiring.

## Usage

```sh
npm install ffprobe-ts
```

```ts
import { probe } from "ffprobe-ts";

const result = await probe(file); // file: File (e.g. from <input type="file">)

if (result.error_code === 0) {
  console.log(result.response.format); // streams, chapters, format...
} else {
  console.error(result.error_message);
}
```

`probe()` lazily spawns a shared worker and reuses it. Call `dispose()` to
terminate it. A non-zero `error_code` is a normal ffprobe answer (e.g.
unsupported file), not a thrown error. The Promise only rejects if the
worker itself crashes.

Types are exported from the package root and `ffprobe-ts/types`; the
`ffTime` formatting helper from `ffprobe-ts/helpers`.
