// Agent Chess puzzle player. Loads a puzzle from ?id=<relay id>, #z=/#j= (inside the link)
// or ?example=<name>, then lets the player solve it with hints and explanations.

import { Chess } from '../vendor/chess.js';
import { VERSION } from './version.js';
import { $, el, toast, copy, pieceNode, PIECE_NAME, wireStyleMenu } from './ui.js';
import { DEFAULT_RELAY, parseNtfyLine } from './relay.js';
import {
  validatePuzzle, judgeMove, wrongEntry, TAGS, decodeFragment, joinParts, inflate, fromBase64Url, utf8,
  PUZZLE_TOPIC_PREFIX, encodeFragment,
} from './puzzle-core.js';

const params = new URLSearchParams(location.search);
const RELAY = (params.get('relay') || DEFAULT_RELAY).replace(/\/+$/, '');
const COLOR = { w: 'White', b: 'Black' };

const P = {
  pz: null,
  chess: null,
  step: 0, // index into pz.line of the next move to be played
  mistakes: 0,
  hintsUsed: 0,
  hintLevel: {}, // step index -> hints shown
  revealed: {}, // step index -> answer shown
  sel: null,
  last: null, // { from, to }
  flash: null, // { from, to, kind: 'bad' } briefly shows a wrong move
  wrongChess: null,
  arrow: null, // { from, to } for a revealed answer
  badge: null, // { sq, tag }: tag symbol on the last move's square
  replyArrows: [], // [{ san, from, to }]: the opponent's possible replies, as green arrows
  wrongInfo: null, // { tag, replies } for the wrong move on the board
  paused: false, // waiting for Continue so the player can study the reply arrows
  feedback: [], // [{ kind: 'good'|'bad'|'info'|'hint'|'reply', text }]
  solved: false,
  busy: false, // opponent reply pending
  replay: null, // ply index while replaying after solving
};

// ---------- loading ----------
async function loadPuzzle() {
  const id = (params.get('id') || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const example = (params.get('example') || '').replace(/[^a-z0-9-]/g, '');
  try {
    if (location.hash.length > 3) return await decodeFragment(location.hash);
    if (example) {
      const r = await fetch(`examples/${example}.json?v=${VERSION}`);
      if (!r.ok) throw new Error(`There's no example called "${example}".`);
      return await r.json();
    }
    if (id) {
      const r = await fetch(`${RELAY}/${PUZZLE_TOPIC_PREFIX}${id}/json?poll=1&since=all`, { cache: 'no-store' });
      if (!r.ok) throw new Error(`The relay answered ${r.status}.`);
      const events = (await r.text()).split('\n').map(parseNtfyLine).filter(Boolean);
      const enc = joinParts(events);
      if (!enc) {
        const e = new Error('This puzzle link has expired or never existed. Short links last about 12 hours. Ask whoever sent it for the permanent link.');
        e.expired = true;
        throw e;
      }
      return JSON.parse(utf8.decode(await inflate(fromBase64Url(enc))));
    }
    return null;
  } catch (err) {
    showMissing(err.expired ? 'Puzzle expired' : "Couldn't load the puzzle", err.message || String(err));
    return undefined;
  }
}

function showMissing(title, text) {
  $('pz-loading').hidden = true;
  $('pz-missing').hidden = false;
  $('pz-missing-title').textContent = title;
  $('pz-missing-text').textContent = text;
}

// ---------- board ----------
const flipped = () => P.pz && P.pz.solverColor === 'b';

function displayChess() {
  if (P.replay != null) {
    const c = new Chess(P.pz.fen);
    for (let i = 0; i < P.replay; i++) c.move(P.pz.line[i].move);
    return c;
  }
  return P.wrongChess || P.chess;
}

function renderBoard() {
  const chess = displayChess();
  const flip = flipped();
  const files = 'abcdefgh';
  const legal = P.sel && canMove() ? P.chess.moves({ square: P.sel, verbose: true }) : [];
  let checkSq = null;
  if (chess.inCheck()) {
    const k = chess.findPiece({ type: 'k', color: chess.turn() });
    checkSq = k && k[0];
  }
  const last = P.replay != null ? (P.replay ? P.pz.line[P.replay - 1] : null) : P.flash || P.last;
  let badge = null;
  let arrows = [];
  if (P.replay != null) {
    const st = P.replay ? P.pz.line[P.replay - 1] : null;
    if (st && st.tag) badge = { sq: st.to, tag: st.tag };
    if (st && st.replies) arrows = st.replies;
  } else if (P.wrongChess) {
    const w = P.wrongInfo || {};
    if (w.tag) badge = { sq: P.flash.to, tag: w.tag };
    arrows = w.replies || [];
  } else {
    badge = P.badge;
    arrows = [...P.replyArrows, ...(P.arrow ? [P.arrow] : [])];
  }
  const squares = [];
  for (let r = 0; r < 8; r++) {
    for (let f = 0; f < 8; f++) {
      const file = flip ? 7 - f : f;
      const rank = flip ? r + 1 : 8 - r;
      const sq = files[file] + rank;
      const piece = chess.get(sq);
      const tgt = legal.find((m) => m.to === sq);
      const cls = ['sq', (file + rank) % 2 === 1 && 'dark',
        last && (last.from === sq || last.to === sq) && (P.flash && P.replay == null ? 'wrong' : 'last'),
        P.sel === sq && 'sel', tgt && 'target', tgt && (piece || tgt.flags.includes('e')) && 'capture',
        checkSq === sq && 'check',
        canMove() && piece && piece.color === P.chess.turn() && 'movable'].filter(Boolean).join(' ');
      const label = piece ? `${sq}, ${piece.color === 'w' ? 'white' : 'black'} ${PIECE_NAME[piece.type]}` : sq;
      const node = el('button', { class: cls, type: 'button', 'data-sq': sq, 'aria-label': label, tabindex: '-1' });
      if (piece) node.append(pieceNode(piece.color, piece.type));
      if (badge && badge.sq === sq) node.append(el('span', { class: `badge tag-${badge.tag}`, 'aria-hidden': 'true', text: TAGS[badge.tag].symbol }));
      if (r === 7) node.append(el('span', { class: 'coord file', text: files[file] }));
      if (f === 0) node.append(el('span', { class: 'coord rank', text: String(rank) }));
      squares.push(node);
    }
  }
  $('board').replaceChildren(...squares);
  // Green arrows: a revealed answer, or the opponent's possible replies.
  const g = $('arrows');
  const xy = (sq) => {
    const file = sq.charCodeAt(0) - 97;
    const rank = Number(sq[1]);
    return flip ? [7 - file + 0.5, rank - 0.5] : [file + 0.5, 8 - rank + 0.5];
  };
  const NS = 'http://www.w3.org/2000/svg';
  g.replaceChildren(...arrows.map((a) => {
    const [x1, y1] = xy(a.from);
    const [x2, y2] = xy(a.to);
    const len = Math.hypot(x2 - x1, y2 - y1);
    const line = document.createElementNS(NS, 'line');
    for (const [k, v] of Object.entries({ x1, y1, x2: x2 - ((x2 - x1) / len) * 0.32, y2: y2 - ((y2 - y1) / len) * 0.32, class: 'arrow-better', 'marker-end': 'url(#arrowhead)' })) line.setAttribute(k, v);
    return line;
  }));
}

const canMove = () => !!P.pz && !P.solved && !P.busy && P.replay == null && !P.wrongChess && !P.paused && P.step < P.pz.line.length && P.pz.line[P.step].solver;

function attempt(from, to, promotion) {
  if (!canMove()) return false;
  const step = P.pz.line[P.step];
  const moves = P.chess.moves({ square: from, verbose: true }).filter((m) => m.to === to);
  if (!moves.length) return false;
  if (moves.some((m) => m.promotion) && !promotion) {
    // Prefer the promotion the puzzle expects; otherwise ask.
    if (step.from === from && step.to === to && step.uci.length === 5) return attempt(from, to, step.uci[4]);
    askPromotion(from, to);
    return true;
  }
  play(from + to + (promotion || ''));
  return true;
}

function askPromotion(from, to) {
  const box = $('promo');
  const color = P.chess.turn();
  box.replaceChildren(...['q', 'r', 'b', 'n'].map((p) =>
    el('button', { type: 'button', 'aria-label': `Promote to ${PIECE_NAME[p]}`, onclick: () => { box.hidden = true; play(from + to + p); } }, pieceNode(color, p))));
  box.hidden = false;
  box.querySelector('button').focus();
}

function tryText(text) {
  const c = new Chess(P.chess.fen());
  try {
    const m = /^([a-h][1-8])([a-h][1-8])([qrbn])?$/i.exec(text.trim());
    return m ? c.move({ from: m[1].toLowerCase(), to: m[2].toLowerCase(), promotion: m[3] && m[3].toLowerCase() }) : c.move(text.trim().replace(/0/g, 'O'));
  } catch {
    return null;
  }
}

// ---------- solving ----------
function play(text) {
  const step = P.pz.line[P.step];
  const trial = new Chess(P.chess.fen());
  let mv;
  try {
    const m = /^([a-h][1-8])([a-h][1-8])([qrbn])?$/.exec(text);
    mv = m ? trial.move({ from: m[1], to: m[2], promotion: m[3] }) : trial.move(text);
  } catch {
    mv = null;
  }
  if (!mv) return;
  P.sel = null;
  if (judgeMove(step, trial, mv.san)) {
    P.chess = trial;
    P.last = { from: mv.from, to: mv.to };
    P.arrow = null;
    // The tag belongs to the intended move; an accepted alternative gets no symbol.
    P.badge = step.tag && mv.san === step.move ? { sq: mv.to, tag: step.tag } : null;
    P.replyArrows = step.replies || [];
    const alt = mv.san !== step.move ? ` (${step.move} also works.)` : '';
    P.feedback.push({ kind: 'good', tag: P.badge && step.tag, text: `${mv.san}: correct!${alt}${step.explain ? ' ' + step.explain : ''}` });
    if (step.replies) P.feedback.push({ kind: 'reply', text: repliesText(step.replies) });
    P.step++;
    if (step.replies && P.step < P.pz.line.length) {
      P.paused = true; // let the player study the arrows; Continue plays the reply
      render();
      return;
    }
    advance();
  } else {
    P.mistakes++;
    // Leave the wrong move on the board so the solver can study it; Retry takes it back.
    P.wrongChess = trial;
    P.flash = { from: mv.from, to: mv.to };
    const w = wrongEntry(step, mv.san) || {};
    P.wrongInfo = { tag: w.tag, replies: w.replies };
    P.feedback.push({ kind: 'bad', tag: w.tag, text: `${mv.san} isn't it.${w.text ? ' ' + w.text : ''}${w.replies ? ' ' + repliesText(w.replies) : ''} Press Retry when you're ready to try again.` });
  }
  render();
}

// Auto-play opponent replies, then wait for the solver or finish.
function advance() {
  const line = P.pz.line;
  if (P.step >= line.length) {
    P.solved = true;
    render();
    return;
  }
  const next = line[P.step];
  if (next.solver) {
    render();
    return;
  }
  P.busy = true;
  render();
  setTimeout(() => {
    const mv = P.chess.move(next.move);
    P.last = { from: mv.from, to: mv.to };
    P.badge = next.tag ? { sq: mv.to, tag: next.tag } : null;
    P.replyArrows = [];
    P.feedback.push({ kind: 'reply', tag: next.tag, text: `${COLOR[mv.color]} replies ${mv.san}.${next.explain ? ' ' + next.explain : ''}` });
    P.step++;
    P.busy = false;
    advance();
  }, 650);
}

function hint() {
  const i = P.step;
  const step = P.pz.line[i];
  if (!step || !step.solver) return;
  const hints = step.hints || [];
  const shown = P.hintLevel[i] || 0;
  if (shown < hints.length) {
    P.hintLevel[i] = shown + 1;
    P.hintsUsed++;
    P.feedback.push({ kind: 'hint', text: `Hint ${shown + 1}${hints.length > 1 ? ` of ${hints.length}` : ''}: ${hints[shown]}` });
  } else if (!P.revealed[i]) {
    P.revealed[i] = true;
    P.arrow = { from: step.from, to: step.to };
    P.feedback.push({ kind: 'hint', text: `The answer is ${step.move} (shown by the arrow). Play it to continue.` });
  }
  render();
}

// "Black can answer Rxc8 (forced) or Kf8: see the green arrows."
function repliesText(list) {
  const names = list.map((r) => r.san + (r.text ? ` (${r.text})` : ''));
  const joined = names.length > 1 ? `${names.slice(0, -1).join(', ')} or ${names[names.length - 1]}` : names[0];
  const side = COLOR[P.pz.solverColor === 'w' ? 'b' : 'w'];
  return `${side} can answer ${joined}: see the green arrow${list.length > 1 ? 's' : ''}.`;
}

// Play the opponent's reply after the player has looked at the reply arrows.
function cont() {
  if (!P.paused) return;
  P.paused = false;
  P.replyArrows = [];
  advance();
}

// Take back the wrong move that's on the board.
function retry() {
  if (!P.wrongChess) return;
  P.wrongChess = null;
  P.wrongInfo = null;
  P.flash = null;
  P.sel = null;
  render();
  if (canMove()) $('move-input').focus();
}

function restart() {
  Object.assign(P, {
    chess: new Chess(P.pz.fen), step: 0, mistakes: 0, hintsUsed: 0, hintLevel: {}, revealed: {}, sel: null,
    last: null, flash: null, wrongChess: null, wrongInfo: null, arrow: null, badge: null, replyArrows: [], paused: false, feedback: [], solved: false, busy: false, replay: null,
  });
  $('pz-done').hidden = true;
  if (P.pz.opponentFirst) advance();
  render();
}

// ---------- rendering ----------
function render() {
  renderBoard();
  const pz = P.pz;
  const toMove = P.chess.turn();
  $('pz-turn').replaceChildren(
    el('span', { class: `pb-swatch ${pz.solverColor}`, 'aria-hidden': 'true' }),
    P.solved ? 'Solved!' : P.wrongChess ? 'Not quite. Press Retry to take it back.' : P.paused ? 'Look at the replies, then press Continue.' : P.busy ? `${COLOR[toMove]} is replying…` : `${COLOR[pz.solverColor]} to move`,
  );
  // Feedback: the latest few messages, newest last.
  const fb = $('pz-feedback');
  fb.replaceChildren(...P.feedback.slice(-4).map((f) => el('p', { class: `fb ${f.kind}` },
    f.tag ? el('span', { class: `rv-tag tag-${f.tag}` }, el('b', { text: TAGS[f.tag].symbol }), ` ${TAGS[f.tag].label}`) : null,
    f.tag ? ' ' : null, f.text)));
  if (!P.feedback.length) fb.replaceChildren(el('p', { class: 'fb info', text: 'Make your move on the board or type it below.' }));

  $('move-form').hidden = P.solved;
  $('move-input').disabled = !canMove();

  const acts = [];
  if (!P.solved) {
    const step = pz.line[P.step];
    const hints = (step && step.hints) || [];
    const shown = P.hintLevel[P.step] || 0;
    if (P.wrongChess) acts.push(el('button', { class: 'btn primary', type: 'button', text: 'Retry', id: 'pz-retry', onclick: retry }));
    if (P.paused) acts.push(el('button', { class: 'btn primary', type: 'button', text: 'Continue', id: 'pz-continue', onclick: cont }));
    const label = shown < hints.length ? (shown ? 'Another hint' : 'Hint') : P.revealed[P.step] ? 'Answer shown' : 'Show the answer';
    if (!P.paused && !P.wrongChess) acts.push(el('button', { class: 'btn', type: 'button', text: label, disabled: !canMove() || !!P.revealed[P.step], onclick: hint }));
    acts.push(el('button', { class: 'btn', type: 'button', text: 'Start over', onclick: restart }));
  }
  acts.push(el('button', { class: 'btn', type: 'button', text: 'Copy link', onclick: copyLink }));
  $('pz-actions').replaceChildren(...acts);

  renderDone();
  renderTextState();
}

function renderDone() {
  const box = $('pz-done');
  if (!P.solved) { box.hidden = true; return; }
  box.hidden = false;
  const pz = P.pz;
  const clean = !P.mistakes && !P.hintsUsed && !Object.keys(P.revealed).length;
  const stats = clean ? 'Solved with no mistakes and no hints.' : `Solved with ${P.mistakes} mistake${P.mistakes === 1 ? '' : 's'} and ${P.hintsUsed} hint${P.hintsUsed === 1 ? '' : 's'}${Object.keys(P.revealed).length ? ', answer revealed' : ''}.`;
  const lineItems = pz.line.map((st, i) => {
    const c = new Chess(st.fenBefore);
    const num = c.moveNumber();
    const label = c.turn() === 'w' ? `${num}. ${st.move}` : `${num}... ${st.move}`;
    return el('li', { class: st.solver ? 'mine' : 'theirs' },
      el('button', { class: 'op-move' + (P.replay === i + 1 ? ' current' : ''), type: 'button', onclick: () => { P.replay = i + 1; render(); } },
        label, st.tag ? el('span', { class: `sym tag-${st.tag}`, title: TAGS[st.tag].label, text: TAGS[st.tag].symbol }) : null),
      st.explain ? el('span', { text: ' ' + st.explain }) : null);
  });
  box.replaceChildren(
    el('h2', { text: clean ? 'Solved! Perfect.' : 'Solved!' }),
    el('p', { class: 'pz-stats', text: stats }),
    pz.conclusion ? el('div', { class: 'pz-conclusion' }, el('h3', { text: 'The idea' }), el('p', { text: pz.conclusion })) : null,
    el('h3', { text: 'Full solution' }),
    el('ol', { class: 'pz-line' }, ...lineItems),
    el('div', { class: 'actions-row' },
      el('button', { class: 'btn', type: 'button', text: '◀', 'aria-label': 'Previous position', disabled: (P.replay ?? pz.line.length) === 0, onclick: () => { P.replay = Math.max(0, (P.replay ?? pz.line.length) - 1); render(); } }),
      el('button', { class: 'btn', type: 'button', text: '▶', 'aria-label': 'Next position', disabled: P.replay == null || P.replay >= pz.line.length, onclick: () => { P.replay = Math.min(pz.line.length, (P.replay ?? pz.line.length) + 1); if (P.replay === pz.line.length) P.replay = null; render(); } }),
      el('button', { class: 'btn primary', type: 'button', text: 'Try again', onclick: restart })),
  );
}

function renderTextState() {
  const c = P.chess;
  const lines = [
    `Puzzle: ${P.pz.title}${P.pz.author ? ` by ${P.pz.author}` : ''}`,
    `You play: ${COLOR[P.pz.solverColor]}`,
    `Status: ${P.solved ? 'solved' : P.wrongChess ? 'wrong move on the board; press Retry to take it back' : P.paused ? 'press Continue' : canMove() ? 'your move' : 'opponent replying'}`,
    `FEN: ${c.fen()}`,
  ];
  if (P.wrongChess) lines.push(`Wrong move on the board: ${P.flash ? P.flash.from + P.flash.to : ''}`);
  const shown = P.wrongChess ? (P.wrongInfo && P.wrongInfo.replies) || [] : P.replyArrows;
  if (shown.length) lines.push(`Green arrows (opponent's possible replies): ${shown.map((r) => `${r.san} (${r.from}-${r.to})`).join(', ')}`);
  if (P.paused) lines.push('Press Continue to see the reply.');
  if (canMove()) lines.push(`Legal moves: ${c.moves().join(' ')}`);
  $('text-state').textContent = lines.join('\n');
}

async function copyLink() {
  // Share the permanent form so the link keeps working after the relay forgets it.
  let link = location.href;
  if (!location.hash && P.source) {
    try { link = location.origin + location.pathname + (await encodeFragment(P.source)); } catch { /* keep current */ }
  }
  copy(link, location.hash || !P.source ? 'Link copied' : 'Permanent link copied');
}

// ---------- input ----------
function squareFromPoint(x, y) {
  const node = document.elementFromPoint(x, y);
  const sq = node && node.closest && node.closest('.sq');
  return sq ? sq.dataset.sq : null;
}

function wireBoard() {
  const board = $('board');
  let drag = null;
  board.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 || !canMove()) return;
    const sqEl = e.target.closest('.sq');
    if (!sqEl) return;
    const sq = sqEl.dataset.sq;
    if (P.sel && P.sel !== sq && P.chess.moves({ square: P.sel, verbose: true }).some((m) => m.to === sq)) {
      e.preventDefault();
      attempt(P.sel, sq);
      return;
    }
    const piece = P.chess.get(sq);
    if (piece && piece.color === P.chess.turn()) {
      e.preventDefault();
      const size = sqEl.getBoundingClientRect().width;
      P.sel = sq;
      renderBoard();
      const ghost = pieceNode(piece.color, piece.type, 'drag-ghost');
      ghost.style.fontSize = `${size * 0.82}px`;
      ghost.hidden = true;
      document.body.append(ghost);
      drag = { from: sq, ghost, x: e.clientX, y: e.clientY, moved: false, id: e.pointerId };
      board.setPointerCapture(e.pointerId);
    } else {
      P.sel = null;
      renderBoard();
    }
  });
  board.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    if (!drag.moved && Math.hypot(e.clientX - drag.x, e.clientY - drag.y) > 4) {
      drag.moved = true;
      drag.ghost.hidden = false;
      board.querySelector(`[data-sq="${drag.from}"]`)?.classList.add('dragging');
    }
    if (drag.moved) {
      drag.ghost.style.left = `${e.clientX}px`;
      drag.ghost.style.top = `${e.clientY}px`;
    }
  });
  const end = (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const d = drag;
    drag = null;
    d.ghost.remove();
    if (d.moved) {
      const over = squareFromPoint(e.clientX, e.clientY);
      if (over && over !== d.from && attempt(d.from, over)) return;
      renderBoard();
    }
  };
  board.addEventListener('pointerup', end);
  board.addEventListener('pointercancel', () => { if (drag) { drag.ghost.remove(); drag = null; renderBoard(); } });

  $('move-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const input = $('move-input');
    if (!canMove() || !input.value.trim()) return;
    const mv = tryText(input.value);
    if (!mv) {
      P.feedback.push({ kind: 'bad', text: `"${input.value.trim()}" isn't a legal move here.` });
      render();
      return;
    }
    input.value = '';
    play(mv.from + mv.to + (mv.promotion || ''));
  });
}

// ---------- boot ----------
document.title = `Puzzle — Agent Chess v${VERSION}`;
$('app-version').textContent = `v${VERSION}`;
wireStyleMenu(() => { if (P.pz) renderBoard(); });

const source = await loadPuzzle();
if (source === null) {
  showMissing('No puzzle here', 'This link has no puzzle in it. Puzzle links look like …/puzzle/?id=abc123xyz. Ask an agent to make one (see AGENTS.md, "Puzzles"), or try the example.');
} else if (source !== undefined) {
  const r = validatePuzzle(source);
  if (!r.ok) {
    showMissing('This puzzle has a problem', r.errors.join(' '));
  } else {
    P.pz = r.puzzle;
    P.source = source;
    document.title = `${P.pz.title} — Agent Chess puzzle`;
    $('pz-loading').hidden = true;
    $('pz-game').hidden = false;
    const toFind = P.pz.line.filter((s) => s.solver).length;
    $('pz-kicker').textContent = `${P.pz.author ? `Puzzle by ${P.pz.author}` : 'Puzzle'}, ${toFind} move${toFind === 1 ? '' : 's'} to find`;
    $('pz-title').textContent = P.pz.title;
    $('pz-intro').textContent = P.pz.intro || `${COLOR[P.pz.solverColor]} to move. Find the best continuation.`;
    wireBoard();
    restart();
  }
}
