#!/usr/bin/env bash
# Host entry point: build the Docker image (cached) then run the Makefile
# inside it. WASM + .d.ts land in ./dist on the host via the bind mount.
#
# Usage:
#   ./build.sh            # build everything into dist/
#   ./build.sh clean      # remove dist/
#   ./build.sh wasm       # wasm only, skip tsc
set -euo pipefail

IMAGE=ffprobe-ts-build
cd "$(dirname "$0")"

echo ">> docker build ($IMAGE)"
docker build -t "$IMAGE" .

echo ">> docker run -> make ${*:-all}"
docker run --rm -v "$PWD":/work "$IMAGE" "$@"

echo ">> done. artifacts in ./dist"
