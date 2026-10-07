// Build data/openings.json from the Lichess chess-openings dataset (CC0, public domain):
//   https://github.com/lichess-org/chess-openings
//
//   git clone --depth 1 https://github.com/lichess-org/chess-openings /tmp/chess-openings
//   node tools/build-openings.mjs /tmp/chess-openings
//
// Output: { "<epd>": [eco, name, "e4 e5 Nf3 ..."] }, keyed by position (FEN without the move
// counters), so transpositions into a named position are recognised too.

import { readFileSync, writeFileSync, readdirSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Chess } from '../vendor/chess.js';

const src = process.argv[2];
if (!src) {
  console.error('usage: node tools/build-openings.mjs <path to lichess chess-openings checkout>');
  process.exit(1);
}
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
export const epd = (fen) => fen.split(' ').slice(0, 4).join(' ');

const out = {};
let rows = 0;
let skipped = 0;
for (const file of readdirSync(src).filter((f) => /^[a-e]\.tsv$/.test(f)).sort()) {
  const lines = readFileSync(join(src, file), 'utf8').split('\n').slice(1).filter(Boolean);
  for (const line of lines) {
    const [eco, name, pgn] = line.split('\t');
    const sans = pgn.replace(/\d+\.(\.\.)?/g, ' ').trim().split(/\s+/);
    const c = new Chess();
    try {
      for (const m of sans) c.move(m);
    } catch {
      skipped++;
      continue;
    }
    rows++;
    const key = epd(c.fen());
    // Keep the first (shortest/most general) name for a position; later rows naming the same
    // position by a different move order are transpositions.
    if (!out[key]) out[key] = [eco, name, c.history().join(' ')];
  }
}
mkdirSync(join(root, 'data'), { recursive: true });
const json = JSON.stringify(out);
writeFileSync(join(root, 'data', 'openings.json'), json);
console.log(`${rows} lines, ${Object.keys(out).length} positions, ${skipped} skipped, ${(json.length / 1024).toFixed(0)} KB`);
