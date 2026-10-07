// Agent Chess puzzles: format, validation and link encoding. Shared by the puzzle page
// (js/puzzle.js) and the CLI. Runs in the browser and in Node.
//
// A puzzle is JSON:
// {
//   "title": "Win the queen",                 // optional
//   "author": "Claude",                       // optional
//   "fen": "<starting position>",             // required; the side to move is the solver
//   "intro": "White to move and win material.",  // optional, shown before the first move
//   "opponentFirst": false,                   // optional: if true, line[0] is the opponent's move,
//                                             // auto-played first (like "Black just played ...")
//   "line": [                                 // required; alternates solver / opponent moves
//     { "move": "Nf7+",                       // the correct move (SAN or UCI)
//       "accept": ["Nxf7+"],                  // optional other moves that also count as correct
//       "hints": ["Look for a check.", "Which piece can attack king and queen at once?"],
//       "explain": "A fork: the knight checks the king and hits the queen.",
//       "wrong": { "Qxd8": "Black recaptures and you've only traded.", "*": "Fallback for any other move." },
//       "tag": "brilliant",                   // optional symbol on the move (same tags as game reviews)
//       "replies": ["Kg8", "Kh8"]             // optional: opponent replies drawn as green arrows after
//                                             // this move (the player presses Continue to go on)
//     },
//     { "move": "Kg8", "explain": "Forced: the king has only one square." },   // opponent reply
//     // A "wrong" value can also be an object: { "text": "...", "tag": "blunder", "replies": ["Kxg7"] }
//     // (replies = the opponent's answers to that wrong move, drawn as arrows).
//     { "move": "Nxd8", "explain": "The queen falls." }
//   ],
//   "conclusion": "Analysis of the whole idea, shown when solved."  // optional
// }
//
// On the final solver move, any checkmate also counts as correct.

import { Chess } from '../vendor/chess.js';
import { TAGS, tagKey } from './tags.js';
import { baseLang, langNameEnglish } from './langs.js';

export { TAGS };

export const PUZZLE_VERSION = 1;
export const PUZZLE_TOPIC_PREFIX = 'agentchess-puzzle-v1-';
export const ID_ALPHABET = 'abcdefghijkmnpqrstuvwxyz23456789';
const TEXT_MAX = 2000;

// ---------- text, possibly in several languages ----------
// Any text field can be a string or a map of language code -> string:
//   "explain": "Back-rank mate."      or      "explain": { "en": "Back-rank mate.", "es": "Mate del pasillo." }
// str() trims and returns either form ('' if empty). While a puzzle or lesson is validated,
// maps are counted per language so missing translations can be reported.
let langStats = null;
export function str(v, max = TEXT_MAX) {
  if (typeof v === 'string') return v.trim().slice(0, max);
  if (!isTextMap(v)) return '';
  const out = {};
  for (const [k, val] of Object.entries(v)) {
    const code = baseLang(k);
    const text = typeof val === 'string' ? val.trim().slice(0, max) : '';
    if (code && text) out[code] = text;
  }
  const keys = Object.keys(out);
  if (!keys.length) return '';
  if (langStats) {
    langStats.maps++;
    for (const k of keys) langStats.per[k] = (langStats.per[k] || 0) + 1;
  }
  return out;
}

// { "en": "...", "es": "..." } (every key a language code, every value a string).
export function isTextMap(v) {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return false;
  const keys = Object.keys(v);
  return keys.length > 0 && keys.every((k) => /^[a-z]{2,3}([-_][a-z0-9]+)*$/i.test(k) && !['text', 'tag', 'move'].includes(k)) && Object.values(v).every((x) => typeof x === 'string');
}

// The text in one language: exact, then `main`, then English, then any.
export function textIn(v, code = 'en', main = 'en') {
  if (typeof v === 'string') return v;
  if (!v || typeof v !== 'object') return '';
  return v[code] ?? v[main] ?? v.en ?? Object.values(v)[0] ?? '';
}

export function beginLangs() { langStats = { maps: 0, per: {} }; }

// Finish counting: returns { lang, langs } and pushes warnings for incomplete translations.
// `declared` is the author's "lang" (the language of plain-string fields).
export function endLangs(declared, firstMap, warnings) {
  const st = langStats || { maps: 0, per: {} };
  langStats = null;
  const main = baseLang(declared) || (firstMap && typeof firstMap === 'object' ? Object.keys(firstMap)[0] : '') || 'en';
  const others = Object.keys(st.per).filter((k) => k !== main).sort((a, b) => st.per[b] - st.per[a]);
  for (const k of [main, ...others]) {
    const have = st.per[k] || 0;
    if (st.maps && have < st.maps && (k !== main || have > 0)) {
      warnings.push(`${langNameEnglish(k)} (${k}) is missing from ${st.maps - have} of ${st.maps} translated text(s); those show in another language.`);
    }
  }
  return { lang: main, langs: [main, ...others] };
}

export function tryMove(chess, text) {
  if (typeof text !== 'string' || !text.trim()) return null;
  const t = text.trim();
  try {
    const m = /^([a-h][1-8])([a-h][1-8])([qrbn])?$/i.exec(t);
    if (m) return chess.move({ from: m[1].toLowerCase(), to: m[2].toLowerCase(), promotion: m[3] ? m[3].toLowerCase() : undefined });
    return chess.move(t.replace(/0/g, 'O'));
  } catch {
    return null;
  }
}

// Validates a solving line (alternating solver / opponent moves) from `fen` and returns the
// normalized steps: moves in SAN plus uci/from/to and the positions before and after.
// Problems are pushed onto `errors` / `warnings`. Shared by puzzles and lesson tasks.
export function validateLine({ fen, line, opponentFirst = false, errors, warnings, label = 'line' }) {
  const chess = new Chess(fen);
  const steps = [];
  const lastSolverIdx = (() => {
    let idx = -1;
    line.forEach((_, i) => { if ((i % 2 === 0) !== opponentFirst) idx = i; });
    return idx;
  })();
  line.forEach((raw, i) => {
    const step = typeof raw === 'string' ? { move: raw } : raw || {};
    const solver = (i % 2 === 0) !== opponentFirst;
    const where = `${label}[${i}] (${solver ? 'your move' : "opponent's reply"})`;
    const fenBefore = chess.fen();
    // Alternatives and wrong moves are checked in the position before this step.
    const check = (text) => tryMove(new Chess(fenBefore), text);
    const mv = tryMove(chess, step.move);
    if (!mv) {
      errors.push(`${where}: "${step.move}" isn't a legal move here (${chess.turn() === 'w' ? 'White' : 'Black'} to move, FEN ${fenBefore}).`);
      return;
    }
    const tagOf = (v, what) => {
      if (v == null || v === '') return undefined;
      const k = tagKey(v);
      if (!k) warnings.push(`${where}: ${what} tag "${v}" isn't one of ${Object.keys(TAGS).join(', ')}, so it's ignored.`);
      return k && k !== 'note' ? k : undefined;
    };
    // Opponent replies to draw as arrows, checked in the position `fen`.
    const repliesOf = (list, fen, what) => {
      if (list == null) return undefined;
      const out = [];
      for (const r of Array.isArray(list) ? list : [list]) {
        const moveText = typeof r === 'string' ? r : r && r.move;
        const m = tryMove(new Chess(fen), moveText);
        if (!m) { warnings.push(`${where}: ${what} reply "${moveText}" isn't legal there, so its arrow is left out.`); continue; }
        if (out.some((x) => x.san === m.san)) continue;
        const o = { san: m.san, from: m.from, to: m.to };
        if (r && typeof r === 'object' && r.text) { const tx = str(r.text, 300); if (tx) o.text = tx; }
        out.push(o);
      }
      return out.length ? out : undefined;
    };
    const out = { move: mv.san, uci: mv.from + mv.to + (mv.promotion || ''), from: mv.from, to: mv.to, solver, fenBefore, fenAfter: chess.fen() };
    if (step.explain) out.explain = str(step.explain);
    const tag = tagOf(step.tag, 'the');
    if (tag) out.tag = tag;
    if (step.replies != null) {
      if (!solver) warnings.push(`${where}: "replies" only works on your own moves (it shows the opponent's possible answers), so it's ignored here.`);
      else {
        const rep = repliesOf(step.replies, out.fenAfter, 'the');
        if (rep) out.replies = rep;
      }
    }
    if (solver) {
      const accept = [];
      for (const a of Array.isArray(step.accept) ? step.accept : []) {
        const m = check(a);
        if (!m) warnings.push(`${where}: accepted move "${a}" isn't legal there, so it's ignored.`);
        else if (m.san !== mv.san) accept.push(m.san);
      }
      if (accept.length) out.accept = accept;
      const hints = (Array.isArray(step.hints) ? step.hints : step.hint ? [step.hint] : []).map((h) => str(h)).filter(Boolean);
      if (hints.length) out.hints = hints;
      if (step.wrong && typeof step.wrong === 'object') {
        const wrong = {};
        for (const [k, v] of Object.entries(step.wrong)) {
          // Text, a translated text map, or { text, tag, replies }.
          const obj = v && typeof v === 'object' && !isTextMap(v) ? v : { text: v };
          const entry = { text: str(obj.text) };
          const wtag = tagOf(obj.tag, `wrong move "${k}"`);
          if (wtag) entry.tag = wtag;
          if (k === '*') {
            if (obj.replies != null) warnings.push(`${where}: the "*" fallback can't have replies (the move isn't known), so they're ignored.`);
            wrong['*'] = entry;
            continue;
          }
          const m = check(k);
          if (!m) warnings.push(`${where}: wrong-move key "${k}" isn't legal there, so its explanation is never shown.`);
          else if (m.san === mv.san || accept.includes(m.san)) warnings.push(`${where}: "${k}" is listed as wrong but it's the correct move.`);
          else {
            const after = new Chess(fenBefore);
            after.move(m.san);
            const rep = repliesOf(obj.replies, after.fen(), `wrong move ${m.san}:`);
            if (rep) entry.replies = rep;
            wrong[m.san] = entry;
          }
        }
        if (Object.keys(wrong).length) out.wrong = wrong;
      }
      if (i === lastSolverIdx) out.anyMate = true;
      if (!out.hints) warnings.push(`${where}: no hints. Players who get stuck can only reveal the answer.`);
    }
    steps.push(out);
  });
  return steps;
}

// Returns { ok, errors: [...], warnings: [...], puzzle } where puzzle is normalized:
// moves in SAN, plus uci/from/to and the position before each step.
export function validatePuzzle(input) {
  const errors = [];
  const warnings = [];
  let p = input;
  if (typeof p === 'string') {
    try { p = JSON.parse(p); } catch (e) { return { ok: false, errors: [`Not valid JSON: ${e.message}`], warnings, puzzle: null }; }
  }
  if (!p || typeof p !== 'object') return { ok: false, errors: ['The puzzle must be a JSON object.'], warnings, puzzle: null };
  beginLangs();
  const chess = new Chess();
  try {
    chess.load(String(p.fen || ''));
  } catch (e) {
    return { ok: false, errors: [`"fen" isn't a valid position: ${e.message}`], warnings, puzzle: null };
  }
  if (!Array.isArray(p.line) || !p.line.length) errors.push('"line" must be a non-empty list of moves.');
  const opponentFirst = !!p.opponentFirst;
  const solverColor = opponentFirst ? (chess.turn() === 'w' ? 'b' : 'w') : chess.turn();
  const steps = validateLine({ fen: chess.fen(), line: p.line || [], opponentFirst, errors, warnings });
  if (steps.length && !errors.length && !steps[steps.length - 1].solver) {
    warnings.push("The line ends with the opponent's move. Usually a puzzle ends on the solver's move.");
  }
  const title = str(p.title, 120);
  const author = str(p.author, 60);
  const intro = str(p.intro);
  const conclusion = str(p.conclusion, 4000);
  const { lang, langs } = endLangs(p.lang, title || intro, warnings);
  const puzzle = errors.length ? null : {
    v: PUZZLE_VERSION,
    lang,
    langs,
    title: title || 'Puzzle',
    author,
    fen: new Chess(String(p.fen)).fen(),
    intro,
    opponentFirst,
    solverColor,
    line: steps,
    conclusion,
  };
  return { ok: !errors.length, errors, warnings, puzzle };
}

// Is `san` (just played by the solver at step i) correct?
export function judgeMove(step, chessAfter, san) {
  if (san === step.move) return true;
  if (step.accept && step.accept.includes(san)) return true;
  if (step.anyMate && chessAfter.isCheckmate()) return true;
  return false;
}

// What to show for a wrong move: { text, tag?, replies? } (specific entry, else the "*"
// fallback), or null.
export function wrongEntry(step, san) {
  if (step.wrong && step.wrong[san]) return step.wrong[san];
  if (step.wrong && step.wrong['*']) return step.wrong['*'];
  return null;
}

// Just the explanation text for a wrong move, or null.
export function wrongMessage(step, san) {
  const e = wrongEntry(step, san);
  return e && e.text ? e.text : null;
}

// ---------- links ----------
// Source format kept in links: the author's JSON (re-validated on load), so links stay
// readable by future versions.

export function toBase64Url(bytes) {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  const b64 = typeof btoa === 'function' ? btoa(s) : Buffer.from(bytes).toString('base64');
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function fromBase64Url(text) {
  const b64 = text.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (text.length % 4)) % 4);
  if (typeof atob === 'function') return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  return new Uint8Array(Buffer.from(b64, 'base64'));
}

export const utf8 = {
  encode: (s) => new TextEncoder().encode(s),
  decode: (b) => new TextDecoder().decode(b),
};

async function streamThrough(bytes, stream) {
  const out = new Response(new Blob([bytes]).stream().pipeThrough(stream));
  return new Uint8Array(await out.arrayBuffer());
}
export const deflate = (bytes) => streamThrough(bytes, new CompressionStream('deflate-raw'));
export const inflate = (bytes) => streamThrough(bytes, new DecompressionStream('deflate-raw'));

// "#z=<deflated base64url JSON>" (compact) or "#j=<base64url JSON>" (no compression needed,
// easy for any agent to build). Returns the parsed JSON or throws.
export async function decodeFragment(hash) {
  const h = new URLSearchParams(String(hash || '').replace(/^#/, ''));
  if (h.get('z')) return JSON.parse(utf8.decode(await inflate(fromBase64Url(h.get('z')))));
  if (h.get('j')) return JSON.parse(utf8.decode(fromBase64Url(h.get('j'))));
  return null;
}

export async function encodeFragment(json) {
  return '#z=' + toBase64Url(await deflate(utf8.encode(typeof json === 'string' ? json : JSON.stringify(json))));
}

// Relay storage: ntfy messages are limited to 4096 bytes, so a puzzle is deflated,
// base64url-encoded and split into parts: {type:"puzzle-part", pid, n, of, data}.
export const CHUNK = 3000;

export function splitParts(pid, encoded) {
  const parts = [];
  for (let i = 0; i < encoded.length; i += CHUNK) parts.push(encoded.slice(i, i + CHUNK));
  return parts.map((data, n) => ({ type: 'puzzle-part', v: PUZZLE_VERSION, pid, n, of: parts.length, data }));
}

// Given relay events ({data}), reassemble the newest complete puzzle. Returns encoded string or null.
export function joinParts(events) {
  const byPid = new Map();
  for (const ev of events) {
    const d = ev && ev.data;
    if (!d || d.type !== 'puzzle-part' || typeof d.data !== 'string' || !Number.isInteger(d.n) || !Number.isInteger(d.of)) continue;
    if (!byPid.has(d.pid)) byPid.set(d.pid, { of: d.of, parts: new Map(), order: byPid.size });
    byPid.get(d.pid).parts.set(d.n, d.data);
  }
  const complete = [...byPid.values()].filter((x) => x.parts.size === x.of).sort((a, b) => b.order - a.order);
  if (!complete.length) return null;
  const c = complete[0];
  return Array.from({ length: c.of }, (_, i) => c.parts.get(i)).join('');
}
