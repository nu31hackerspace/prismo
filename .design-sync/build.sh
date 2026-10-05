#!/usr/bin/env bash
# Builds client/src/components/ui into a package the design-sync converter consumes.
set -euo pipefail
cd "$(dirname "$0")/.."
OUT=.design-sync/.cache/pkg
rm -rf "$OUT" && mkdir -p "$OUT"
.ds-sync/node_modules/.bin/esbuild .design-sync/entry.ts --bundle --format=esm --jsx=automatic \
  --tsconfig=client/tsconfig.app.json --external:react --external:react-dom --external:react/jsx-runtime \
  --outfile="$OUT/index.js" --log-level=warning
node_modules/.bin/tsc -p .design-sync/tsconfig.json
.ds-sync/node_modules/.bin/tailwindcss -i .design-sync/ds.css -o "$OUT/styles.css" 2>/dev/null
printf '{"name":"@prismo/ui","version":"0.1.0","type":"module","module":"index.js","types":"types/.design-sync/entry.d.ts"}\n' > "$OUT/package.json"
