#!/bin/sh
set -e
W="$(cd "$(dirname "$0")" && pwd)"
cp "$W/src/game/palette.ts" "$W/src/game/sketch.ts" "$W/src/game/render.ts" "$W/build/game/"
cp "$W/src/game/palette.ts" "$W/src/game/sketch.ts" "$W/src/game/render.ts" "$W/stub/game/"
npx esbuild "$W/harness/main.ts" --bundle --format=esm --outfile="$W/harness/bundle.js" --log-level=warning
