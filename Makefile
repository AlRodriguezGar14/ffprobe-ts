# Build steps run INSIDE the Docker container (see Dockerfile).
# The FFmpeg libs and emsdk are already present; this compiles the project
# sources, links the wasm module, type-checks/emits TypeScript, and bundles
# the worker.
#
# Run on the host via:  ./build.sh        (wraps docker build + run)
# Or directly:          docker run --rm -v "$PWD":/work ffprobe-ts-build

FFMPEG_PREFIX ?= /opt/ffmpeg
DIST          ?= dist

# Define FFPROBE_USE_DECODER here (DECODER=1) to opt into the decoder-open
# path for exact coded_width/height. Requires an FFmpeg build WITH decoders
# (the default Dockerfile ships none) -- see fill_coded_dimensions comment.
DECODER ?= 0
ifeq ($(DECODER),1)
  DECODER_FLAG := -DFFPROBE_USE_DECODER
endif

CFLAGS  := -O3 -Wall -Wextra -I$(FFMPEG_PREFIX)/include $(DECODER_FLAG)
LDFLAGS := -L$(FFMPEG_PREFIX)/lib -lavformat -lavcodec -lavutil

# Emscripten link-time settings. WORKERFS lets the worker mount a File/Blob
# with zero copy; EXPORT_ES6 + MODULARIZE match the postMessage worker flow.
EMFLAGS := --bind -O3 \
           -s MODULARIZE=1 -s EXPORT_ES6=1 \
           -s ALLOW_MEMORY_GROWTH=1 \
           -s ENVIRONMENT=worker \
           -s FILESYSTEM=1 -lworkerfs.js \
           -s EXPORT_NAME=createFfprobe

SOURCES := ffprobe.c ffprobe_bindings.cpp

.PHONY: all wasm types client typecheck bundle clean
# Order matters: wasm first (emits dist/ffprobe.mjs, needed by bundle),
# then declarations + client JS, the worker type-check, then the bundle.
all: wasm types client typecheck bundle

# --- wasm -------------------------------------------------------------
# Compile C + C++ sources and link the wasm module in one emcc invocation.
wasm: $(DIST)/ffprobe.mjs
$(DIST)/ffprobe.mjs: $(SOURCES) ffprobe.h | $(DIST)
	emcc $(CFLAGS) $(SOURCES) $(LDFLAGS) $(EMFLAGS) -o $@
	@echo "built $@ + $(DIST)/ffprobe.wasm"

# --- TypeScript -------------------------------------------------------
# Pure-type files (types.ts, protocol.ts) -> .d.ts only.
types: $(DIST)/types.d.ts
$(DIST)/types.d.ts: types.ts protocol.ts tsconfig.json tsconfig.types.json | $(DIST)
	tsc --project tsconfig.types.json

# Public entry: client.ts + helpers.ts -> .js + .d.ts. tsc also emits a
# stub types.js / protocol.js for the declaration-only files it pulls into
# the program graph; drop those -- only their .d.ts (from `types`) ships.
client: $(DIST)/client.js
$(DIST)/client.js: client.ts helpers.ts protocol.ts types.ts \
                   tsconfig.json tsconfig.client.json | $(DIST)
	tsc --project tsconfig.client.json
	rm -f $(DIST)/types.js $(DIST)/protocol.js

# Type-check the worker sources (esbuild emits the actual bundle).
typecheck: worker.ts ffprobe-module.ts tsconfig.worker.json
	tsc --project tsconfig.worker.json

# Bundle worker.ts + dist/ffprobe.mjs into a single dist/worker.js.
# ffprobe.mjs stays in dist/ as the emcc artifact (a Make target output --
# deleting it would force a full wasm rebuild every run); it is fully
# inlined into worker.js, so the `files` allowlist in package.json controls
# what actually ships.
bundle: $(DIST)/worker.js
$(DIST)/worker.js: worker.ts ffprobe-module.ts build.mjs $(DIST)/ffprobe.mjs
	node build.mjs

$(DIST):
	mkdir -p $(DIST)

clean:
	rm -rf $(DIST)
