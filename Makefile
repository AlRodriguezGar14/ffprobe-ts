# Build steps run INSIDE the Docker container (see Dockerfile).
# The FFmpeg libs and emsdk are already present; this only compiles the
# project sources, links the wasm module, and emits TypeScript declarations.
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

.PHONY: all wasm types clean
all: wasm types

# Compile C + C++ sources and link the wasm module in one emcc invocation.
wasm: $(DIST)/ffprobe.mjs
$(DIST)/ffprobe.mjs: $(SOURCES) ffprobe.h | $(DIST)
	emcc $(CFLAGS) $(SOURCES) $(LDFLAGS) $(EMFLAGS) -o $@
	@echo "built $@ + $(DIST)/ffprobe.wasm"

# types.ts -> declarations only; helpers.ts -> .js + .d.ts. Two configs
# so the pure-types file does not emit an empty types.js.
types: $(DIST)/types.d.ts
$(DIST)/types.d.ts: types.ts helpers.ts tsconfig.json tsconfig.types.json | $(DIST)
	tsc --project tsconfig.json
	tsc --project tsconfig.types.json

$(DIST):
	mkdir -p $(DIST)

clean:
	rm -rf $(DIST)
