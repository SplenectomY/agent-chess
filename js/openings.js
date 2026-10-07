// Opening names: a position -> [eco, name, line] table built from the Lichess
// chess-openings dataset (CC0) by tools/build-openings.mjs. Looked up by position,
// so move-order transpositions into a named opening are recognised too.

let DATA = null;
let loading = null;

export function loadOpenings(url) {
  if (!loading) {
    loading = fetch(url)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => (DATA = d))
      .catch(() => null);
  }
  return loading;
}

export const isLoaded = () => !!DATA;
export const epd = (fen) => fen.split(' ').slice(0, 4).join(' ');

// Deepest named position reached in the game's moves (each move carries the FEN after it).
// Returns { eco, name, line: [san...], ply } or null.
export function identify(moves) {
  if (!DATA) return null;
  let best = null;
  const n = Math.min(moves.length, 40); // the deepest named line is 36 plies
  for (let i = 0; i < n; i++) {
    const e = DATA[epd(moves[i].fen)];
    if (e) best = { eco: e[0], name: e[1], line: e[2].split(' '), ply: i + 1 };
  }
  return best;
}

// One-line descriptions of the ECO volumes, for openings without a written primer.
export function ecoVolume(eco) {
  switch ((eco || '')[0]) {
    case 'A': return 'ECO volume A: flank openings (1.c4, 1.Nf3, 1.f4 and others) and unusual replies to 1.d4.';
    case 'B': return 'ECO volume B: semi-open games, where Black answers 1.e4 with something other than 1...e5 (except the French).';
    case 'C': return 'ECO volume C: open games after 1.e4 e5, plus the French Defense.';
    case 'D': return 'ECO volume D: closed games with 1.d4 d5, including the Queen\'s Gambit, plus the Grünfeld.';
    case 'E': return 'ECO volume E: Indian defenses after 1.d4 Nf6 2.c4 e6 or ...g6, such as the Nimzo-Indian and King\'s Indian.';
    default: return '';
  }
}
