// Shared page helpers: DOM, storage, toasts, piece drawing and the Style menu.
// Used by the room page (js/app.js) and the puzzle page (js/puzzle.js).
import { SOFT_SVG, PIECE_SETS, BOARD_THEMES } from './pieces.js';

export const $ = (id) => document.getElementById(id);
export const GLYPH = { k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟' };
export const OUTLINE = { k: '♔', q: '♕', r: '♖', b: '♗', n: '♘', p: '♙' };
export const PIECE_NAME = { k: 'king', q: 'queen', r: 'rook', b: 'bishop', n: 'knight', p: 'pawn' };
export const VS = '︎'; // ask for text (not emoji) presentation

export const store = {
  get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ } },
};

export function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'class') node.className = v;
    else if (k === 'text') node.textContent = v;
    else if (k.startsWith('on')) node.addEventListener(k.slice(2), v);
    else node.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat()) if (c != null) node.append(c);
  return node;
}
let toastTimer;
export function toast(msg) {
  const t = $('toast');
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (t.hidden = true), 2600);
}
export async function copy(text, what = 'Copied') {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const ta = el('textarea', { style: 'position:fixed;opacity:0' });
    ta.value = text;
    document.body.append(ta);
    ta.select();
    try { document.execCommand('copy'); } catch { /* ignore */ }
    ta.remove();
  }
  toast(what);
}
// Glyphs are drawn with CSS (content: attr(data-g)) so they never show up in the page's
// text: agents reading the page get square names and the text state, not symbol noise.
export function pieceNode(color, type, cls = 'piece') {
  if (LOOK.pieces === 'soft') {
    const node = el('span', { class: `${cls} ${color} soft`, 'aria-hidden': 'true' });
    node.innerHTML = SOFT_SVG[type];
    return node;
  }
  return el('span', { class: `${cls} ${color}`, 'aria-hidden': 'true' },
    el('span', { class: 'fill', 'data-g': GLYPH[type] + VS }),
    el('span', { class: 'outline', 'data-g': (color === 'w' ? OUTLINE[type] : GLYPH[type]) + VS }));
}

// ---------- look: piece set and board colors (per viewer, remembered in this browser) ----------
export const LOOK = {
  pieces: PIECE_SETS[store.get('agentchess:pieces')] ? store.get('agentchess:pieces') : 'classic',
  board: BOARD_THEMES[store.get('agentchess:board')] ? store.get('agentchess:board') : 'slate',
};
export function applyLook() {
  document.documentElement.dataset.board = LOOK.board;
  document.documentElement.dataset.pieces = LOOK.pieces;
}
export function wireStyleMenu(onChange = () => {}) {
  const fill = (sel, options, value) => {
    sel.replaceChildren(...Object.entries(options).map(([k, label]) => el('option', { value: k, text: label, selected: k === value })));
  };
  const pieces = $('look-pieces');
  const board = $('look-board');
  fill(pieces, PIECE_SETS, LOOK.pieces);
  fill(board, BOARD_THEMES, LOOK.board);
  const changed = () => {
    LOOK.pieces = pieces.value;
    LOOK.board = board.value;
    store.set('agentchess:pieces', LOOK.pieces);
    store.set('agentchess:board', LOOK.board);
    applyLook();
    onChange();
    renderLookPreview();
  };
  pieces.addEventListener('change', changed);
  board.addEventListener('change', changed);
  // Close the menu when clicking elsewhere.
  document.addEventListener('pointerdown', (e) => {
    const menu = $('style-menu');
    if (menu.open && !menu.contains(e.target)) menu.open = false;
  });
  $('style-menu').addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { $('style-menu').open = false; $('style-menu').querySelector('summary').focus(); }
  });
  renderLookPreview();
}
function renderLookPreview() {
  const box = $('look-preview');
  box.replaceChildren(...['k', 'q', 'r', 'b', 'n', 'p'].map((t, i) =>
    el('span', { class: `lp-sq${i % 2 ? ' dark' : ''}` }, pieceNode(i < 3 ? 'w' : 'b', t))));
}
applyLook();
