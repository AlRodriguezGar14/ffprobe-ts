#!/usr/bin/env bash
# Host entry point: build the Docker image (cached) then run the Makefile
# inside it. WASM + .d.ts land in ./dist on the host via the bind mount.
#
# Usage:
#   ./build/build.sh            # build everything into dist/
#   ./build/build.sh clean      # remove dist/
#   ./build/build.sh wasm       # wasm only, skip tsc
set -euo pipefail

IMAGE=ffprobe-ts-build

# Always run from the repo root so the bind mount sees src/, native/, etc.
cd "$(dirname "$0")/.."

echo ">> docker build ($IMAGE)"
docker build -t "$IMAGE" -f build/Dockerfile .

echo ">> docker run -> make ${*:-all}"
docker run --rm -v "$PWD":/work "$IMAGE" "$@"

echo ">> done. artifacts in ./dist"
