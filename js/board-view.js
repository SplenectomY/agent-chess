// Board drawing and input for the puzzle and lesson pages: squares, last-move and highlight
// colors, tag badges, colored arrows, click/drag to move and the promotion picker.

import { Chess } from '../vendor/chess.js';
import { el, pieceNode } from './ui.js';
import { t, pieceName } from './i18n.js';
import { TAGS } from './tags.js';

const FILES = 'abcdefgh';
export const ARROW_COLORS = ['green', 'red', 'blue', 'yellow'];
const NS = 'http://www.w3.org/2000/svg';

// Make sure the arrows <svg> has one arrowhead marker per color.
function ensureMarkers(svg) {
  let defs = svg.querySelector('defs');
  if (!defs) { defs = document.createElementNS(NS, 'defs'); svg.prepend(defs); }
  for (const c of ARROW_COLORS) {
    const id = c === 'green' ? 'arrowhead' : `arrowhead-${c}`;
    if (svg.querySelector(`#${id}`)) continue;
    const m = document.createElementNS(NS, 'marker');
    for (const [k, v] of Object.entries({ id, markerWidth: 3, markerHeight: 3, refX: 1.4, refY: 1.5, orient: 'auto', markerUnits: 'strokeWidth' })) m.setAttribute(k, v);
    const path = document.createElementNS(NS, 'path');
    path.setAttribute('d', 'M0,0 L3,1.5 L0,3 z');
    path.setAttribute('class', c === 'green' ? 'arrowhead' : `arrowhead arrowhead-${c}`);
    m.append(path);
    defs.append(m);
  }
}

// opts: { board, arrowsG, chess, flip, last, lastClass ('last'|'wrong'), sel, legal (verbose moves),
//         movableColor, badge {sq, tag}, arrows [{from,to,color}], highlights [{sq,color}] }
export function drawBoard(opts) {
  const { board, arrowsG, chess, flip = false, last = null, animate = true, lastClass = 'last', sel = null, legal = [],
    movableColor = null, badge = null, arrows = [], highlights = [] } = opts;
  let checkSq = null;
  if (chess.inCheck()) {
    const k = chess.findPiece({ type: 'k', color: chess.turn() });
    checkSq = k && k[0];
  }
  const squares = [];
  for (let r = 0; r < 8; r++) {
    for (let f = 0; f < 8; f++) {
      const file = flip ? 7 - f : f;
      const rank = flip ? r + 1 : 8 - r;
      const sq = FILES[file] + rank;
      const piece = chess.get(sq);
      const tgt = legal.find((m) => m.to === sq);
      const hl = highlights.find((h) => h.sq === sq);
      const cls = ['sq', (file + rank) % 2 === 1 && 'dark',
        last && (last.from === sq || last.to === sq) && lastClass,
        hl && `hl hl-${hl.color || 'green'}`,
        sel === sq && 'sel', tgt && 'target', tgt && (piece || tgt.flags.includes('e')) && 'capture',
        checkSq === sq && 'check',
        movableColor && piece && piece.color === movableColor && 'movable'].filter(Boolean).join(' ');
      const label = piece ? t('board.square', { sq, piece: t(`piece.${piece.color}.${piece.type}`) }) : sq;
      const node = el('button', { class: cls, type: 'button', 'data-sq': sq, 'aria-label': label, tabindex: '-1' });
      if (piece) node.append(pieceNode(piece.color, piece.type));
      if (badge && badge.sq === sq && TAGS[badge.tag]) node.append(el('span', { class: `badge tag-${badge.tag}`, 'aria-hidden': 'true', text: TAGS[badge.tag].symbol }));
      if (r === 7) node.append(el('span', { class: 'coord file', text: FILES[file] }));
      if (f === 0) node.append(el('span', { class: 'coord rank', text: String(rank) }));
      squares.push(node);
    }
  }
  const prevFen = board.dataset.fen;
  board.replaceChildren(...squares);
  board.dataset.fen = chess.fen();
  if (animate) animateMove(board, prevFen, chess.fen(), last);
  else delete board.dataset.noAnim;

  ensureMarkers(arrowsG.ownerSVGElement);
  const xy = (sq) => {
    const file = sq.charCodeAt(0) - 97;
    const rank = Number(sq[1]);
    return flip ? [7 - file + 0.5, rank - 0.5] : [file + 0.5, 8 - rank + 0.5];
  };
  arrowsG.replaceChildren(...arrows.map((a) => {
    const color = ARROW_COLORS.includes(a.color) ? a.color : 'green';
    const [x1, y1] = xy(a.from);
    const [x2, y2] = xy(a.to);
    const len = Math.hypot(x2 - x1, y2 - y1);
    const line = document.createElementNS(NS, 'line');
    const attrs = {
      x1, y1, x2: x2 - ((x2 - x1) / len) * 0.32, y2: y2 - ((y2 - y1) / len) * 0.32,
      class: color === 'green' ? 'arrow-better' : `arrow-better arrow-${color}`,
      'marker-end': `url(#${color === 'green' ? 'arrowhead' : `arrowhead-${color}`})`,
    };
    for (const [k, v] of Object.entries(attrs)) line.setAttribute(k, v);
    return line;
  }));
}

// ---------- move animation ----------
// Pieces glide to their new square instead of jumping. Slightly quicker than chess.com's
// default so it never feels like it's holding the game up.
export const MOVE_MS = 170;
const placement = (fen) => String(fen || '').split(' ')[0];

// After the board was redrawn from prevFen to newFen: if the change is exactly the move
// `last` ({ from, to }), slide the moved piece (and the rook, when castling) from its old
// square, and let a captured piece fade out underneath. Anything else (jumps of several
// moves, undo, the first draw, a piece the player just dragged) is shown as is.
export function animateMove(board, prevFen, newFen, last) {
  const dragged = board.dataset.noAnim;
  delete board.dataset.noAnim;
  // Redrawn mid-slide with the same position (a status update, the relay's echo): carry on
  // from where the previous drawing was, instead of snapping to the end.
  const running = board._anim;
  if (running && prevFen && placement(prevFen) === placement(newFen)) {
    const elapsed = performance.now() - running.start;
    if (running.fen === placement(newFen) && elapsed < MOVE_MS) play(board, running, elapsed);
    return;
  }
  board._anim = null;
  if (!prevFen || !last || !last.from || !last.to || placement(prevFen) === placement(newFen)) return;
  if (dragged === last.to) return;
  if (typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  let before;
  let mv;
  try {
    before = new Chess(prevFen);
    const probe = new Chess(prevFen);
    const cands = probe.moves({ square: last.from, verbose: true }).filter((m) => m.to === last.to);
    mv = cands.find((m) => {
      const c = new Chess(prevFen);
      c.move(m);
      return placement(c.fen()) === placement(newFen);
    });
  } catch { return; }
  if (!mv) return;
  const slides = [[mv.from, mv.to]];
  if (mv.flags.includes('k') || mv.flags.includes('q')) {
    const rank = mv.from[1];
    slides.push(mv.flags.includes('k') ? [`h${rank}`, `f${rank}`] : [`a${rank}`, `d${rank}`]);
  }
  const capSq = mv.flags.includes('e') ? mv.to[0] + mv.from[1] : mv.to;
  const victim = mv.captured ? before.get(capSq) : null;
  board._anim = { fen: placement(newFen), start: performance.now(), slides, capSq, victim };
  play(board, board._anim, 0);
}

function play(board, spec, elapsed) {
  const at = (sq) => board.querySelector(`[data-sq="${sq}"]`);
  for (const [from, to] of spec.slides) {
    const a = at(from);
    const b = at(to);
    const piece = b && b.querySelector('.piece');
    if (!a || !b || !piece) continue;
    const ra = a.getBoundingClientRect();
    const rb = b.getBoundingClientRect();
    const dx = ra.left - rb.left;
    const dy = ra.top - rb.top;
    b.style.zIndex = '8';
    const anim = piece.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'translate(0, 0)' }],
      { duration: MOVE_MS, easing: 'cubic-bezier(.25,.75,.35,1)' });
    anim.currentTime = elapsed;
    anim.onfinish = anim.oncancel = () => { b.style.zIndex = ''; };
  }
  // The captured piece stays visible until the attacker lands on it.
  const capEl = spec.victim && at(spec.capSq);
  if (capEl) {
    const ghost = pieceNode(spec.victim.color, spec.victim.type, 'piece cap-ghost');
    capEl.prepend(ghost);
    const fade = ghost.animate([{ opacity: 1 }, { opacity: 1, offset: 0.7 }, { opacity: 0 }], { duration: MOVE_MS, easing: 'linear' });
    fade.currentTime = elapsed;
    fade.onfinish = fade.oncancel = () => ghost.remove();
  }
}

function squareFromPoint(x, y) {
  const node = document.elementFromPoint(x, y);
  const sq = node && node.closest && node.closest('.sq');
  return sq ? sq.dataset.sq : null;
}

// Click-click or drag to move. hooks: { canMove(), chess() (position to move in), getSel(), setSel(sq),
// attempt(from, to) -> true if the move was taken, redraw() }
export function wireBoardInput(board, hooks) {
  let drag = null;
  board.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 || !hooks.canMove()) return;
    const sqEl = e.target.closest('.sq');
    if (!sqEl) return;
    const sq = sqEl.dataset.sq;
    const chess = hooks.chess();
    const sel = hooks.getSel();
    if (sel && sel !== sq && chess.moves({ square: sel, verbose: true }).some((m) => m.to === sq)) {
      e.preventDefault();
      hooks.attempt(sel, sq);
      return;
    }
    const piece = chess.get(sq);
    if (piece && piece.color === chess.turn()) {
      e.preventDefault();
      const size = sqEl.getBoundingClientRect().width;
      hooks.setSel(sq);
      hooks.redraw();
      const ghost = pieceNode(piece.color, piece.type, 'drag-ghost');
      ghost.style.fontSize = `${size * 0.82}px`;
      ghost.hidden = true;
      document.body.append(ghost);
      drag = { from: sq, ghost, x: e.clientX, y: e.clientY, moved: false, id: e.pointerId };
      board.setPointerCapture(e.pointerId);
    } else {
      hooks.setSel(null);
      hooks.redraw();
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
  board.addEventListener('pointerup', (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const d = drag;
    drag = null;
    d.ghost.remove();
    if (d.moved) {
      const over = squareFromPoint(e.clientX, e.clientY);
      // A dragged piece is already where it lands: don't slide it in again.
      if (over) board.dataset.noAnim = over;
      if (over && over !== d.from && hooks.attempt(d.from, over)) return;
      delete board.dataset.noAnim;
      hooks.redraw();
    }
  });
  board.addEventListener('pointercancel', () => { if (drag) { drag.ghost.remove(); drag = null; hooks.redraw(); } });
}

export function askPromotion(box, color, onPick) {
  box.replaceChildren(...['q', 'r', 'b', 'n'].map((p) =>
    el('button', { type: 'button', 'aria-label': t('board.promote', { piece: pieceName(p) }), onclick: () => { box.hidden = true; onPick(p); } }, pieceNode(color, p))));
  box.hidden = false;
  box.querySelector('button').focus();
}

// Parse typed text (SAN or UCI) as a move in `chess` without changing it. Returns the move or null.
export function parseTyped(chess, text) {
  const c = new Chess(chess.fen());
  try {
    const t = text.trim();
    const m = /^([a-h][1-8])([a-h][1-8])([qrbn])?$/i.exec(t);
    return m ? c.move({ from: m[1].toLowerCase(), to: m[2].toLowerCase(), promotion: m[3] && m[3].toLowerCase() }) : c.move(t.replace(/0/g, 'O'));
  } catch {
    return null;
  }
}
