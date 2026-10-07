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
  const { board, arrowsG, chess, flip = false, last = null, lastClass = 'last', sel = null, legal = [],
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
  board.replaceChildren(...squares);

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
      if (over && over !== d.from && hooks.attempt(d.from, over)) return;
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
