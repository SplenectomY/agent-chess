// Agent Chess lessons: format and validation. Shared by the lesson page (js/lesson.js) and the
// CLI. A lesson is a slideshow of board positions with explanations; any slide can hold a task
// (a puzzle-style line the player must find before moving on). Links work like puzzle links
// (see puzzle-core.js): #z= / #j= inside the link, or ?id= on the relay.
//
// {
//   "title": "The Italian Game", "author": "Claude", "level": "Beginner",       // optional
//   "primer": "Longer introduction (paragraphs, - lists, **bold**).",            // optional
//   "fen": "<starting position>",            // optional, default: the normal starting position
//   "orientation": "w" | "b",                // optional board side, default White
//   "slides": [                              // required
//     { "title": "...", "text": "...",
//       "fen": "...",                         // optional: jump to a new position
//       "moves": ["e4", "e5"],                // optional: moves played as the slide opens
//       "tag": "best",                        // optional symbol on the last of those moves
//       "arrows": ["g1f3", { "from": "f1", "to": "c4", "color": "red" }],
//       "highlights": ["e4", { "square": "d5", "color": "red" }],
//       "task": { "prompt": "...", "line": [ ...puzzle line... ], "done": "shown when solved" } }
//   ],
//   "conclusion": "Shown at the end."
// }
// A slide without "fen" continues from where the previous slide ended (after its task, if any).

import { Chess } from '../vendor/chess.js';
import { validateLine, tryMove, str, TAGS, PUZZLE_VERSION, beginLangs, endLangs } from './puzzle-core.js';
import { tagKey } from './tags.js';

export const LESSON_TOPIC_PREFIX = 'agentchess-lesson-v1-';
export const ARROW_COLORS = ['green', 'red', 'blue', 'yellow'];
const MAX_SLIDES = 80;
const SQ = /^[a-h][1-8]$/;

function loadFen(fen) {
  const c = new Chess();
  c.load(String(fen)); // throws on a bad FEN
  return c;
}

// Returns { ok, errors, warnings, lesson } with every slide's positions worked out:
// slide.fenStart (before its moves), slide.fen (shown), slide.fenEnd (after its task).
export function validateLesson(input) {
  const errors = [];
  const warnings = [];
  let p = input;
  if (typeof p === 'string') {
    try { p = JSON.parse(p); } catch (e) { return { ok: false, errors: [`Not valid JSON: ${e.message}`], warnings, lesson: null }; }
  }
  if (!p || typeof p !== 'object') return { ok: false, errors: ['The lesson must be a JSON object.'], warnings, lesson: null };
  beginLangs();
  let chess;
  try {
    chess = p.fen ? loadFen(p.fen) : new Chess();
  } catch (e) {
    return { ok: false, errors: [`"fen" isn't a valid position: ${e.message}`], warnings, lesson: null };
  }
  const startFen = chess.fen();
  if (!Array.isArray(p.slides) || !p.slides.length) errors.push('"slides" must be a non-empty list.');
  const rawSlides = Array.isArray(p.slides) ? p.slides.slice(0, MAX_SLIDES) : [];
  if (Array.isArray(p.slides) && p.slides.length > MAX_SLIDES) warnings.push(`Only the first ${MAX_SLIDES} slides are used.`);
  const orientation = p.orientation === 'b' || p.orientation === 'black' ? 'b' : 'w';

  const slides = rawSlides.map((raw, i) => {
    const where = `slides[${i}]`;
    const s = raw && typeof raw === 'object' ? raw : { text: String(raw ?? '') };
    const out = { title: str(s.title, 120), text: str(s.text, 4000) };
    if (s.fen) {
      try { chess = loadFen(s.fen); } catch (e) { errors.push(`${where}: "fen" isn't a valid position: ${e.message}`); }
    }
    out.fenStart = chess.fen();
    // Demonstration moves.
    const moves = Array.isArray(s.moves) ? s.moves : s.move ? [s.move] : [];
    out.moves = [];
    for (const m of moves) {
      const before = chess.fen();
      const mv = tryMove(chess, m);
      if (!mv) {
        errors.push(`${where}: move "${m}" isn't legal (${chess.turn() === 'w' ? 'White' : 'Black'} to move, FEN ${before}).`);
        break;
      }
      out.moves.push({ san: mv.san, from: mv.from, to: mv.to, color: mv.color });
    }
    if (s.tag != null && s.tag !== '') {
      const k = tagKey(s.tag);
      if (!k) warnings.push(`${where}: tag "${s.tag}" isn't one of ${Object.keys(TAGS).join(', ')}, so it's ignored.`);
      else if (!out.moves.length) warnings.push(`${where}: "tag" marks the slide's last move, but the slide has no "moves".`);
      else if (k !== 'note') out.tag = k;
    }
    out.fen = chess.fen();
    if (s.orientation === 'b' || s.orientation === 'black') out.orientation = 'b';
    else if (s.orientation === 'w' || s.orientation === 'white') out.orientation = 'w';
    // Arrows: "e2e4", "e2-e4", a move in SAN (legal in the shown position), or {from, to, color}.
    out.arrows = [];
    for (const a of Array.isArray(s.arrows) ? s.arrows : s.arrows ? [s.arrows] : []) {
      let from; let to; let color = 'green';
      if (a && typeof a === 'object') {
        ({ from, to } = a);
        if (a.color) color = String(a.color).toLowerCase();
        if ((!from || !to) && a.move) { const m = tryMove(new Chess(out.fen), a.move); if (m) ({ from, to } = m); }
      } else if (typeof a === 'string') {
        const m = /^([a-h][1-8])-?([a-h][1-8])$/i.exec(a.trim());
        if (m) { from = m[1].toLowerCase(); to = m[2].toLowerCase(); } else {
          const mv = tryMove(new Chess(out.fen), a);
          if (mv) ({ from, to } = mv);
        }
      }
      from = String(from || '').toLowerCase();
      to = String(to || '').toLowerCase();
      if (!SQ.test(from) || !SQ.test(to) || from === to) { warnings.push(`${where}: arrow ${JSON.stringify(a)} isn't two squares (like "e2e4") or a legal move, so it's left out.`); continue; }
      if (!ARROW_COLORS.includes(color)) { warnings.push(`${where}: arrow color "${color}" isn't one of ${ARROW_COLORS.join(', ')}; using green.`); color = 'green'; }
      out.arrows.push({ from, to, color });
    }
    out.highlights = [];
    for (const h of Array.isArray(s.highlights) ? s.highlights : s.highlights ? [s.highlights] : []) {
      const sq = String((h && typeof h === 'object' ? h.square || h.sq : h) || '').toLowerCase();
      let color = String((h && typeof h === 'object' && h.color) || 'green').toLowerCase();
      if (!SQ.test(sq)) { warnings.push(`${where}: highlight ${JSON.stringify(h)} isn't a square like "e4", so it's left out.`); continue; }
      if (!ARROW_COLORS.includes(color)) { warnings.push(`${where}: highlight color "${color}" isn't one of ${ARROW_COLORS.join(', ')}; using green.`); color = 'green'; }
      out.highlights.push({ sq, color });
    }
    // Task: the player must find the solver moves before going on.
    if (s.task) {
      const t = typeof s.task === 'object' ? s.task : {};
      const line = Array.isArray(t.line) ? t.line : t.move ? [t] : [];
      if (!line.length) errors.push(`${where}.task: "line" must be a non-empty list of moves.`);
      else {
        const steps = validateLine({ fen: out.fen, line, errors, warnings, label: `${where}.task.line` });
        if (steps.length === line.length) {
          out.task = { prompt: str(t.prompt, 1000), done: str(t.done || t.conclusion, 2000), line: steps, solverColor: chess.turn() };
          if (!steps[steps.length - 1].solver) warnings.push(`${where}.task: the line ends with the opponent's move. Usually a task ends on the player's move.`);
          chess = new Chess(steps[steps.length - 1].fenAfter);
        }
      }
    }
    out.fenEnd = chess.fen();
    if (!out.text && !out.title && !out.task) warnings.push(`${where}: no title, text or task, so the slide only shows a board.`);
    return out;
  });

  const title = str(p.title, 120);
  const head = { author: str(p.author, 60), level: str(p.level, 40), primer: str(p.primer, 8000), conclusion: str(p.conclusion, 4000) };
  const { lang, langs } = endLangs(p.lang, title || head.primer, warnings);
  const lesson = errors.length ? null : {
    v: PUZZLE_VERSION,
    lang,
    langs,
    title: title || 'Lesson',
    author: head.author,
    level: head.level,
    primer: head.primer,
    fen: startFen,
    orientation,
    slides,
    conclusion: head.conclusion,
  };
  return { ok: !errors.length, errors, warnings, lesson };
}
