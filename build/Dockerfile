# Reproducible WASM build environment for ffprobe-ts.
#
# Layers, slowest first so Docker caches them:
#   1. emsdk  - pinned Emscripten toolchain
#   2. ffmpeg - minimal LGPL FFmpeg libs, probe-only, no decoders
#   3. node   - tsc for emitting .d.ts from types.ts
# Project sources (ffprobe.c etc.) are NOT baked in: they are mounted at
# `docker run` time and built by the Makefile, so editing them does not
# invalidate the expensive FFmpeg layer.

# --- Pinned versions ------------------------------------------------------
# Bump these deliberately; each change rebuilds the FFmpeg layer.
FROM emscripten/emsdk:3.1.74 AS build

ARG FFMPEG_VERSION=8.1
ARG FFMPEG_SHA256=b072aed6871998cce9b36e7774033105ca29e33632be5b6347f3206898e0756a

# --- FFmpeg: fetch, configure (decoder-free, LGPL), build -----------------
WORKDIR /opt/src
RUN curl -fsSL "https://ffmpeg.org/releases/ffmpeg-${FFMPEG_VERSION}.tar.xz" -o ffmpeg.tar.xz \
    && echo "${FFMPEG_SHA256}  ffmpeg.tar.xz" | sha256sum -c - \
    && tar xf ffmpeg.tar.xz \
    && rm ffmpeg.tar.xz

WORKDIR /opt/src/ffmpeg-${FFMPEG_VERSION}
# --disable-everything then whitelist only what the probe feature touches.
# No decoders/encoders/muxers/bsf: coded_width/height fall back to the
# parsed frame size (see fill_coded_dimensions in ffprobe.c). Parsers ARE
# kept because they populate codecpar width/height/profile/level.
# LGPL: no --enable-gpl / --enable-nonfree.
RUN emconfigure ./configure \
      --cc=emcc --cxx=em++ --ranlib=emranlib --ar=emar --nm=emnm \
      --prefix=/opt/ffmpeg \
      --enable-cross-compile --target-os=none --arch=x86_32 \
      --disable-everything \
      --disable-programs --disable-doc --disable-debug \
      --disable-avdevice --disable-swscale --disable-swresample \
      --disable-avfilter --disable-network \
      --disable-asm --disable-x86asm --disable-pthreads \
      --enable-protocol=file \
      --enable-demuxer=mov,matroska,webm,mpegts,flv,avi,wav,mp3,ogg,flac,aac,m4v \
      --enable-parser=h264,hevc,av1,vp9,vp8,mpeg4video,aac,flac,mpegaudio,vorbis,opus \
      --extra-cflags="-O3" \
      --pkg-config-flags="--static" \
    && emmake make -j"$(nproc)" \
    && emmake make install \
    && make distclean

# --- Node toolchain for tsc + esbuild ------------------------------------
# emsdk image ships Node already. Install the build tools into a fixed
# prefix (/opt/buildtools) outside the mounted /work, and point NODE_PATH
# there so build.mjs -- run from /work -- can `import "esbuild"`.
RUN npm install --prefix /opt/buildtools typescript@5.7.2 esbuild@0.24.2
ENV NODE_PATH=/opt/buildtools/node_modules
ENV PATH=/opt/buildtools/node_modules/.bin:$PATH

# Sources are mounted here at run time; Makefile drives the rest.
WORKDIR /work
ENV FFMPEG_PREFIX=/opt/ffmpeg
ENTRYPOINT ["make", "-f", "build/Makefile"]
CMD ["all"]
