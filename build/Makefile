# Build steps run INSIDE the Docker container (see Dockerfile).
# The FFmpeg libs and emsdk are already present; this compiles the project
# sources, links the wasm module, type-checks/emits TypeScript, and bundles
# the worker.
#
# Invoked from the repo root via build/build.sh (the Dockerfile sets
#   ENTRYPOINT ["make", "-f", "build/Makefile"]
# so $(CURDIR) is /work, not /work/build).
#
# Run on the host via:  ./build/build.sh

FFMPEG_PREFIX ?= /opt/ffmpeg
DIST          ?= dist
NATIVE        ?= native
SRC           ?= src
TSCFG         ?= tsconfig

# emsdk's PATH puts /emsdk (a directory containing a `node` subdirectory)
# ahead of the real node bin. Bare `node` in a recipe gets resolved by
# execvp() to that directory and fails with EACCES. Resolve once via the
# shell, which skips non-executable matches, and use $(NODE) below.
NODE          ?= $(shell command -v node)

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
           -s EXPORTED_RUNTIME_METHODS='["FS","WORKERFS"]' \
           -s EXPORT_NAME=createFfprobe

SOURCES := $(NATIVE)/ffprobe.c $(NATIVE)/ffprobe_bindings.cpp

.PHONY: all wasm types client typecheck bundle clean
# Order matters: wasm first (emits dist/ffprobe.mjs, needed by bundle),
# then declarations + client JS, the worker type-check, then the bundle.
all: wasm types client typecheck bundle

# --- wasm -------------------------------------------------------------
# Compile C + C++ sources and link the wasm module in one emcc invocation.
wasm: $(DIST)/ffprobe.mjs
$(DIST)/ffprobe.mjs: $(SOURCES) $(NATIVE)/ffprobe.h | $(DIST)
	emcc $(CFLAGS) $(SOURCES) $(LDFLAGS) $(EMFLAGS) -o $@
	@echo "built $@ + $(DIST)/ffprobe.wasm"

# --- TypeScript -------------------------------------------------------
# Pure-type files (src/types/*, src/protocol.ts) -> .d.ts only.
types: $(DIST)/types/index.d.ts
$(DIST)/types/index.d.ts: $(SRC)/types/primitives.ts $(SRC)/types/stream.ts \
                          $(SRC)/types/format.ts $(SRC)/types/chapter.ts \
                          $(SRC)/types/response.ts $(SRC)/types/index.ts \
                          $(SRC)/protocol.ts \
                          $(TSCFG)/base.json $(TSCFG)/types.json | $(DIST)
	tsc --project $(TSCFG)/types.json

# Public entry: src/index.ts + src/helpers.ts -> .js + .d.ts. tsc also emits
# stubs for the declaration-only files it pulls into the program graph;
# drop those -- only their .d.ts (from `types`) ships.
client: $(DIST)/index.js
$(DIST)/index.js: $(SRC)/index.ts $(SRC)/helpers.ts $(SRC)/protocol.ts \
                  $(SRC)/types/index.ts \
                  $(TSCFG)/base.json $(TSCFG)/client.json | $(DIST)
	tsc --project $(TSCFG)/client.json
	rm -f $(DIST)/protocol.js
	rm -f $(DIST)/types/primitives.js $(DIST)/types/stream.js \
	      $(DIST)/types/format.js $(DIST)/types/chapter.js \
	      $(DIST)/types/response.js $(DIST)/types/index.js

# Type-check the worker sources (esbuild emits the actual bundle).
typecheck: $(SRC)/worker.ts $(SRC)/ffprobe-module.ts $(TSCFG)/worker.json
	tsc --project $(TSCFG)/worker.json

# Bundle src/worker.ts + dist/ffprobe.mjs into a single dist/worker.js.
# ffprobe.mjs stays in dist/ as the emcc artifact (a Make target output --
# deleting it would force a full wasm rebuild every run); it is fully
# inlined into worker.js, so the `files` allowlist in package.json controls
# what actually ships.
bundle: $(DIST)/worker.js
$(DIST)/worker.js: $(SRC)/worker.ts $(SRC)/ffprobe-module.ts \
                   build/build.mjs $(DIST)/ffprobe.mjs
	$(NODE) build/build.mjs

$(DIST):
	mkdir -p $(DIST)

clean:
	rm -rf $(DIST)
