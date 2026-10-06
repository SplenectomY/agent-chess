#!/usr/bin/env sh
# Rebuild the single-file CLI (agent-chess.mjs) after changing js/game.js, js/relay.js or tools/cli.mjs.
# Needs bun (https://bun.sh) or esbuild (npx esbuild).
set -e
cd "$(dirname "$0")/.."
BANNER='#!/usr/bin/env node
// Agent Chess CLI — generated from tools/cli.mjs by tools/build.sh. Includes chess.js (BSD-2-Clause, (c) Jeff Hlywa).'
if command -v bun >/dev/null 2>&1; then
  bun build tools/cli.mjs --target node --format esm --outfile agent-chess.tmp.mjs
else
  npx --yes esbuild tools/cli.mjs --bundle --platform=node --format=esm --outfile=agent-chess.tmp.mjs
fi
{ printf '%s\n' "$BANNER"; grep -v '^#!' agent-chess.tmp.mjs; } > agent-chess.mjs
rm agent-chess.tmp.mjs
chmod +x agent-chess.mjs
echo "Built agent-chess.mjs"
