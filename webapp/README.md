# ffprobe-ts demo

Minimal SPA that probes local media files in the browser with [ffprobe-ts](../).

```bash
npm install
npm run dev
```

Open the printed URL, drop a media file onto the page.

## Build

```bash
npm run build      # output: dist/
npm run preview    # serve dist/ locally
```

## Layout

```
src/
  main.tsx         # React entry
  ProbeDemo.tsx    # the inspector
  app.css          # Tailwind import
  ffprobe-ts/      # prebuilt worker + wasm
```
