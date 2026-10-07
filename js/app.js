import { Chess } from '../vendor/chess.js';
import * as G from './game.js';
import { Relay, DEFAULT_RELAY, topicFor } from './relay.js';
import { VERSION } from './version.js';
import { SOFT_SVG, PIECE_SETS, BOARD_THEMES } from './pieces.js';
import { loadOpenings, identify, ecoVolume } from './openings.js';
import { primerFor } from './opening-primers.js';

const APP_TITLE = `Agent Chess v${VERSION}`;

const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);
const RELAY = (params.get('relay') || DEFAULT_RELAY).replace(/\/+$/, '');
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const GLYPH = { k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟' };
const OUTLINE = { k: '♔', q: '♕', r: '♖', b: '♗', n: '♘', p: '♙' };
const PIECE_NAME = { k: 'king', q: 'queen', r: 'rook', b: 'bishop', n: 'knight', p: 'pawn' };
const VS = '︎'; // ask for text (not emoji) presentation

// ---------- small utilities ----------
const store = {
  get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ } },
};
function randomString(n, alphabet = CODE_ALPHABET) {
  const bytes = new Uint8Array(n);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('');
}
const normalizeCode = (s) => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12);
const siteBase = () => location.origin + location.pathname.replace(/[^/]*$/, '');
function roomUrl(code) {
  const u = new URL(siteBase());
  u.searchParams.set('room', code);
  if (RELAY !== DEFAULT_RELAY) u.searchParams.set('relay', RELAY);
  return u.toString();
}
function el(tag, attrs = {}, ...children) {
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
function toast(msg) {
  const t = $('toast');
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (t.hidden = true), 2600);
}
async function copy(text, what = 'Copied') {
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
function pieceNode(color, type, cls = 'piece') {
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
const LOOK = {
  pieces: PIECE_SETS[store.get('agentchess:pieces')] ? store.get('agentchess:pieces') : 'classic',
  board: BOARD_THEMES[store.get('agentchess:board')] ? store.get('agentchess:board') : 'slate',
};
function applyLook() {
  document.documentElement.dataset.board = LOOK.board;
  document.documentElement.dataset.pieces = LOOK.pieces;
}
function wireStyleMenu() {
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
    if (R.s && R.s.room) renderBoard();
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

// ---------- captured pieces ----------
const START_COUNT = { p: 8, n: 2, b: 2, r: 2, q: 1 };
const VALUE = { p: 1, n: 3, b: 3, r: 5, q: 9 };
const CAPTURE_ORDER = ['p', 'n', 'b', 'r', 'q'];
function materialSummary(chess) {
  const count = { w: { p: 0, n: 0, b: 0, r: 0, q: 0 }, b: { p: 0, n: 0, b: 0, r: 0, q: 0 } };
  let wv = 0;
  let bv = 0;
  for (const row of chess.board()) {
    for (const sq of row) {
      if (!sq || sq.type === 'k') continue;
      count[sq.color][sq.type]++;
      if (sq.color === 'w') wv += VALUE[sq.type];
      else bv += VALUE[sq.type];
    }
  }
  // Pieces each side has taken = the opponent's missing pieces (promotions can't go below zero).
  const taken = (by) => {
    const victim = by === 'w' ? 'b' : 'w';
    const list = [];
    for (const t of CAPTURE_ORDER) for (let i = 0; i < Math.max(0, START_COUNT[t] - count[victim][t]); i++) list.push(t);
    return list;
  };
  return { w: taken('w'), b: taken('b'), lead: wv - bv };
}
function renderCaptures(chess) {
  const m = materialSummary(chess);
  document.querySelectorAll('.pb-captures[data-color]').forEach((box) => {
    const c = box.dataset.color;
    const victim = c === 'w' ? 'b' : 'w';
    const list = m[c];
    const lead = c === 'w' ? m.lead : -m.lead;
    const groups = [];
    let cur = null;
    for (const t of list) {
      if (!cur || cur.type !== t) groups.push((cur = { type: t, n: 0 }));
      cur.n++;
    }
    const words = groups.map((g) => `${g.n > 1 ? g.n + ' ' : ''}${PIECE_NAME[g.type]}${g.n > 1 ? 's' : ''}`).join(', ');
    box.setAttribute('aria-label', list.length ? `Captured by ${G.colorName(c)}: ${words}${lead > 0 ? `, up ${lead}` : ''}` : `${G.colorName(c)} has captured nothing`);
    box.replaceChildren(
      ...groups.map((g) => el('span', { class: 'cap-group' }, ...Array.from({ length: g.n }, () => pieceNode(victim, g.type, 'cap-piece')))),
      ...(lead > 0 ? [el('span', { class: 'cap-lead', text: `+${lead}` })] : []),
    );
  });
}

// ---------- sound (a soft click on each move) ----------
let audio = null;
function initAudio() {
  if (audio) return;
  try { audio = new (window.AudioContext || window.webkitAudioContext)(); } catch { audio = null; }
}
function click(strong = false) {
  if (!audio || audio.state !== 'running') return;
  const o = audio.createOscillator();
  const g = audio.createGain();
  o.type = 'triangle';
  o.frequency.value = strong ? 520 : 330;
  g.gain.setValueAtTime(0.0001, audio.currentTime);
  g.gain.exponentialRampToValueAtTime(0.25, audio.currentTime + 0.005);
  g.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + 0.12);
  o.connect(g).connect(audio.destination);
  o.start();
  o.stop(audio.currentTime + 0.13);
}
document.addEventListener('pointerdown', initAudio, { once: true });
document.addEventListener('keydown', initAudio, { once: true });

// =====================================================================
// Lobby
// =====================================================================
function showLobby() {
  $('lobby').hidden = false;
  $('room').hidden = true;
  const saved = store.get('agentchess:name');
  if (saved) $('create-name').value = saved;

  const grid = $('tc-grid');
  grid.addEventListener('change', () => {
    $('tc-custom').hidden = grid.querySelector('input:checked').value !== 'custom';
  });

  $('create-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const name = $('create-name').value.trim();
    if (!name) return;
    store.set('agentchess:name', name);
    let color = new FormData(e.target).get('color');
    if (color === 'random') color = Math.random() < 0.5 ? 'w' : 'b';
    const tcVal = grid.querySelector('input:checked').value;
    let time = null;
    if (tcVal === 'custom') {
      const min = Number($('tc-min').value);
      const inc = Number($('tc-inc').value);
      if (!(min > 0)) {
        $('create-error').textContent = 'Enter the minutes per player, for example 20.';
        return;
      }
      time = { initial: Math.round(min * 60), increment: Math.max(0, Math.round(inc || 0)) };
    } else if (tcVal !== 'none') {
      const [m, i] = tcVal.split('+').map(Number);
      time = { initial: m * 60, increment: i };
    }
    const code = randomString(6);
    const id = 'p-' + randomString(12, 'abcdefghijklmnopqrstuvwxyz0123456789');
    store.set(`agentchess:seat:${code}`, { id, name });
    enterRoom(code, { create: { v: G.PROTOCOL_VERSION, type: 'create', id, name, color, time } });
  });

  $('join-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const code = normalizeCode($('join-code').value);
    if (code.length < 4) return;
    location.href = roomUrl(code);
  });
}

// =====================================================================
// Room
// =====================================================================
const R = {
  code: null,
  relay: null,
  events: [],
  s: G.initialState(),
  me: null, // { id, name }
  loaded: false,
  creating: false,
  offsetSamples: [],
  pending: null, // { uci, game, ply }
  sel: null,
  drag: null,
  userFlip: false,
  bannerFor: null,
  flagSent: { key: null, at: 0 },
  resignArmed: false,
  lastMoveCount: 0,
  renderQueued: false,
  review: null, // { game, ply } while stepping through a finished game
  opening: null, // { ply } while the opening panel is open (ply within the named line)
  openingInfo: null, // result of identify() for the current game
};

const seat = () => G.seatOf(R.s, R.me && R.me.id);
const flipped = () => (seat() === 'b') !== R.userFlip;

function serverNow() {
  if (!R.offsetSamples.length) return Date.now();
  const sorted = [...R.offsetSamples].sort((a, b) => a - b);
  return Date.now() + sorted[Math.floor(sorted.length / 2)];
}

async function publish(data) {
  try {
    await R.relay.publish({ v: G.PROTOCOL_VERSION, ...data });
    return true;
  } catch (err) {
    toast(err.message || 'Could not send. Try again.');
    return false;
  }
}

async function enterRoom(code, { create = null } = {}) {
  R.code = code;
  R.me = store.get(`agentchess:seat:${code}`);
  history.replaceState(null, '', roomUrl(code));
  $('lobby').hidden = true;
  $('room').hidden = false;
  $('topbar-room').hidden = false;
  $('room-code-btn').textContent = code;
  $('room-code-btn').onclick = () => copy(roomUrl(code), 'Room link copied');
  document.title = `Room ${code} — ${APP_TITLE}`;
  wireRoomControls();
  renderAgentHelp();
  loadOpenings(`data/openings.json?v=${VERSION}`).then(() => { if (R.loaded) render(); });

  R.relay = new Relay({
    base: RELAY,
    code,
    onEvent: (ev, live) => {
      R.events.push(ev);
      if (live) {
        R.offsetSamples.push(ev.time + 500 - Date.now());
        if (R.offsetSamples.length > 15) R.offsetSamples.shift();
      }
      queueRender(live);
    },
    onStatus: (st) => {
      const c = $('conn');
      c.dataset.state = st;
      c.textContent = { live: 'Live', connecting: 'Connecting', reconnecting: 'Reconnecting', polling: 'Live (polling)' }[st] || st;
      c.title = st === 'polling' ? 'The live stream is blocked on this network or browser, so the page checks for new moves every few seconds.' : '';
    },
  });

  try {
    await R.relay.start();
  } catch (err) {
    $('room-loading').textContent = `Couldn't reach the relay at ${RELAY}. Check your connection, then reload the page.`;
    return;
  }
  R.loaded = true;
  if (create) {
    R.creating = true;
    $('room-loading').textContent = 'Opening the room…';
    const ok = await publish(create);
    if (!ok) {
      $('room-loading').textContent = 'The room could not be opened. Reload to try again.';
      return;
    }
  }
  render();
  setInterval(tick, 100);
}

let liveSinceRender = false;
function queueRender(live) {
  liveSinceRender = liveSinceRender || live;
  if (R.renderQueued || !R.loaded) return;
  R.renderQueued = true;
  requestAnimationFrame(() => {
    R.renderQueued = false;
    render();
  });
}

function rebuild() {
  const prev = R.s;
  R.s = G.replay(R.events);
  const s = R.s;
  // Clear an optimistic move once the log has moved on.
  if (R.pending && (s.game !== R.pending.game || s.moves.length !== R.pending.ply || !G.isActive(s))) R.pending = null;
  const moved = s.moves.length !== R.lastMoveCount || s.game !== prev.game;
  if (moved && liveSinceRender) {
    click(s.chess.inCheck());
    R.sel = null;
  }
  R.lastMoveCount = s.moves.length;
  if (s.result && R.bannerFor !== `${s.game}`) {
    R.bannerFor = `${s.game}`;
    $('banner').hidden = false;
  }
  if (!s.result) $('banner').hidden = true;
  if (R.review && (R.review.game !== s.game || !s.result)) R.review = null;
  liveSinceRender = false;
}

function render() {
  rebuild();
  const s = R.s;
  if (!s.room) {
    if (R.creating) return;
    $('room-loading').hidden = true;
    $('room-missing').hidden = false;
    $('missing-code').textContent = R.code;
    $('game').hidden = true;
    return;
  }
  $('room-loading').hidden = true;
  $('room-missing').hidden = true;
  $('game').hidden = false;

  renderBars();
  renderBoard();
  renderStatus();
  renderSeatPanel();
  renderInvite();
  renderSheet();
  renderOpeningChip();
  renderReview();
  renderOpening();
  renderFeed();
  renderTextState();
  tick();
}

// ---------- player bars & clocks ----------
function renderBars() {
  const bottom = flipped() ? 'b' : 'w';
  for (const [slot, color] of [['bar-bottom', bottom], ['bar-top', G.other(bottom)]]) {
    const s = R.s;
    const p = s.players[color];
    const mine = seat() === color;
    const name = p ? p.name + (mine ? ' (you)' : '') : 'Open seat';
    const bar = $(slot);
    bar.replaceChildren(
      el('div', { class: 'pb-who' },
        el('span', { class: 'pb-name' }, el('span', { class: `pb-swatch pb-swatch-inline ${color}`, 'aria-hidden': 'true' }), name),
        el('span', { class: 'pb-meta' }, el('span', { class: `pb-swatch ${color}` }), G.colorName(color))),
      el('div', { class: 'pb-captures', 'data-color': color, role: 'img' }),
      el('div', { class: 'clock' + (s.clock ? '' : ' untimed'), 'data-color': color, role: 'timer', 'aria-label': `${G.colorName(color)} clock` },
        s.clock ? '' : 'No clock'),
    );
  }
}

function tick() {
  const s = R.s;
  if (!s.room) return;
  const now = serverNow();
  const clk = G.clockAt(s, now);
  const active = G.isActive(s);
  const t = G.turn(s);
  document.querySelectorAll('.clock[data-color]').forEach((node) => {
    if (!clk) return;
    const c = node.dataset.color;
    const ms = clk[c];
    node.textContent = G.formatClock(ms);
    node.classList.toggle('running', active && t === c);
    node.classList.toggle('low', ms < 20000);
    node.classList.toggle('flagged', ms <= 0);
  });
  // Claim a win on time when the side to move is past zero (players only).
  if (clk && active && seat()) {
    const key = `${s.game}:${s.moves.length}`;
    if (clk[t] < -(G.GRACE_MS + 700) && (R.flagSent.key !== key || Date.now() - R.flagSent.at > 4000)) {
      R.flagSent = { key, at: Date.now() };
      publish({ type: 'flag', id: R.me.id, game: s.game });
    }
  }
  const myTurn = active && seat() === t;
  const title = `Room ${R.code} — ${APP_TITLE}`;
  document.title = myTurn ? `● Your move — ${title}` : title;
}

// ---------- board ----------
function reviewRecord() {
  return R.review ? G.gameRecord(R.s, R.review.game) : null;
}
function reviewNotes(ply) {
  const a = R.review && R.s.analysis[R.review.game];
  return (a && a.notes[ply]) || [];
}
function displayChess() {
  const s = R.s;
  if (R.review) return new Chess(G.fenAfter(reviewRecord(), R.review.ply));
  if (!R.pending) return s.chess;
  const c = new Chess(s.chess.fen());
  try { c.move({ from: R.pending.uci.slice(0, 2), to: R.pending.uci.slice(2, 4), promotion: R.pending.uci[4] }); } catch { /* ignore */ }
  return c;
}
const canMove = () => G.isActive(R.s) && !R.pending && seat() === G.turn(R.s);
function legalFrom(sq) {
  try { return R.s.chess.moves({ square: sq, verbose: true }); } catch { return []; }
}

function renderBoard() {
  const s = R.s;
  const chess = displayChess();
  const flip = flipped();
  const board = $('board');
  const files = 'abcdefgh';
  const rec = reviewRecord();
  const last = rec ? rec.moves[R.review.ply - 1]
    : R.pending ? { from: R.pending.uci.slice(0, 2), to: R.pending.uci.slice(2, 4) } : s.moves[s.moves.length - 1];
  const notesHere = rec ? reviewNotes(R.review.ply) : [];
  const badgeTag = notesHere.length ? notesHere[0].tag : null;
  const targets = R.sel ? legalFrom(R.sel) : [];
  let checkSq = null;
  if (chess.inCheck()) {
    const k = chess.findPiece({ type: 'k', color: chess.turn() });
    checkSq = k && k[0];
  }
  const mySeat = seat();
  const squares = [];
  for (let r = 0; r < 8; r++) {
    for (let f = 0; f < 8; f++) {
      const file = flip ? 7 - f : f;
      const rank = flip ? r + 1 : 8 - r;
      const sq = files[file] + rank;
      const piece = chess.get(sq);
      const dark = (file + rank) % 2 === 1; // a1 is dark
      const tgt = targets.find((m) => m.to === sq);
      const cls = ['sq', dark && 'dark',
        last && (last.from === sq || last.to === sq) && 'last',
        R.sel === sq && 'sel',
        tgt && 'target', tgt && (piece || tgt.flags.includes('e')) && 'capture',
        checkSq === sq && 'check',
        canMove() && piece && piece.color === mySeat && 'movable'].filter(Boolean).join(' ');
      const label = piece ? `${sq}, ${piece.color === 'w' ? 'white' : 'black'} ${PIECE_NAME[piece.type]}` : sq;
      const node = el('button', { class: cls, type: 'button', 'data-sq': sq, 'aria-label': label, tabindex: '-1' });
      if (piece) node.append(pieceNode(piece.color, piece.type));
      if (badgeTag && last && last.to === sq) {
        node.append(el('span', { class: `badge tag-${badgeTag}`, 'aria-hidden': 'true', text: G.TAGS[badgeTag].symbol }));
      }
      if (r === 7) node.append(el('span', { class: 'coord file', text: files[file] }));
      if (f === 0) node.append(el('span', { class: 'coord rank', text: String(rank) }));
      squares.push(node);
    }
  }
  board.replaceChildren(...squares);
  renderCaptures(chess);
  // Keep one square in the tab order for keyboard users.
  const focusSq = board.querySelector('.sq.sel') || board.querySelector('.sq.movable') || board.firstChild;
  if (focusSq) focusSq.tabIndex = 0;

  // Arrow for a suggested better move while reviewing.
  const arrows = $('arrows');
  arrows.replaceChildren();
  const better = notesHere.find((n) => n.better);
  if (better) {
    const xy = (sq) => {
      const file = sq.charCodeAt(0) - 97;
      const rank = Number(sq[1]);
      return flip ? [7 - file + 0.5, rank - 0.5] : [file + 0.5, 8 - rank + 0.5];
    };
    const [x1, y1] = xy(better.better.from);
    const [x2, y2] = xy(better.better.to);
    const len = Math.hypot(x2 - x1, y2 - y1);
    const ex = x2 - ((x2 - x1) / len) * 0.32;
    const ey = y2 - ((y2 - y1) / len) * 0.32;
    const NS = 'http://www.w3.org/2000/svg';
    const line = document.createElementNS(NS, 'line');
    for (const [k, v] of Object.entries({ x1, y1, x2: ex, y2: ey, class: 'arrow-better', 'marker-end': 'url(#arrowhead)' })) line.setAttribute(k, v);
    arrows.append(line);
  }

  const banner = $('banner');
  if (s.result) {
    const res = G.resultString(s.result);
    const head = s.result.winner ? `${G.playerName(s, s.result.winner)} wins` : 'Draw';
    const count = G.noteCount(s, s.game);
    banner.replaceChildren(
      el('strong', { text: `${res.replace('1/2-1/2', '½–½')}` }),
      el('div', { text: `${head} · ${s.result.reason}` }),
      el('div', { class: 'banner-actions' },
        analysisButton(),
        el('button', { class: 'btn on-dark', type: 'button', text: count ? `Review game (${count} comment${count === 1 ? '' : 's'})` : 'Review game', onclick: () => startReview() }),
        el('button', { class: 'link-btn', type: 'button', text: 'Hide', style: 'color:inherit', onclick: () => (banner.hidden = true) })),
    );
  }
  if (R.review) banner.hidden = true;
}

function squareFromPoint(x, y) {
  const node = document.elementFromPoint(x, y);
  const sq = node && node.closest && node.closest('.sq');
  return sq ? sq.dataset.sq : null;
}

function selectSquare(sq) {
  R.sel = sq;
  renderBoard();
}

function tryUserMove(from, to) {
  const moves = legalFrom(from).filter((m) => m.to === to);
  if (!moves.length) return false;
  if (moves.some((m) => m.promotion)) {
    askPromotion(from, to);
  } else {
    sendMove(from + to);
  }
  return true;
}

function askPromotion(from, to) {
  const box = $('promo');
  const color = seat();
  box.replaceChildren(...['q', 'r', 'b', 'n'].map((p) =>
    el('button', { type: 'button', 'aria-label': `Promote to ${PIECE_NAME[p]}`, onclick: () => { box.hidden = true; sendMove(from + to + p); } },
      pieceNode(color, p))));
  box.hidden = false;
  box.querySelector('button').focus();
  box.onkeydown = (e) => { if (e.key === 'Escape') { box.hidden = true; R.sel = null; renderBoard(); } };
}

async function sendMove(text) {
  const s = R.s;
  const err = $('move-error');
  err.textContent = '';
  $('move-note').textContent = '';
  if (!canMove()) {
    err.textContent = G.isActive(s) ? "It isn't your move." : 'The game is not in progress.';
    return false;
  }
  const mv = G.previewMove(s, text);
  if (!mv) {
    err.textContent = `"${text}" isn't a legal move here. Use SAN like Nf3 or squares like g1f3.`;
    return false;
  }
  const uci = mv.from + mv.to + (mv.promotion || '');
  R.pending = { uci, game: s.game, ply: s.moves.length };
  R.sel = null;
  renderBoard();
  renderStatus();
  click();
  const ok = await publish({ type: 'move', id: R.me.id, game: s.game, ply: s.moves.length, uci, san: mv.san, fen: mv.after });
  $('move-note').textContent = ok ? `Played ${mv.san}.` : '';
  if (!ok) {
    R.pending = null;
    renderBoard();
    renderStatus();
  }
  // Safety: if the echo never comes back, drop the optimistic move.
  setTimeout(() => {
    if (R.pending && R.pending.uci === uci && R.pending.ply === s.moves.length) {
      R.pending = null;
      R.relay.catchUp().then(render);
    }
  }, 12000);
  return ok;
}

function wireBoard() {
  const board = $('board');
  board.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    const sqEl = e.target.closest('.sq');
    if (!sqEl || !canMove()) return;
    const sq = sqEl.dataset.sq;
    const piece = R.s.chess.get(sq);
    if (R.sel && R.sel !== sq && legalFrom(R.sel).some((m) => m.to === sq)) {
      e.preventDefault();
      tryUserMove(R.sel, sq);
      return;
    }
    if (piece && piece.color === seat()) {
      e.preventDefault();
      const wasSelected = R.sel === sq;
      // Measure before selectSquare() redraws the board and detaches sqEl.
      const size = sqEl.getBoundingClientRect().width;
      selectSquare(sq);
      const ghost = pieceNode(piece.color, piece.type, 'drag-ghost');
      ghost.style.fontSize = `${size * 0.82}px`;
      ghost.style.left = `${e.clientX}px`;
      ghost.style.top = `${e.clientY}px`;
      ghost.hidden = true;
      document.body.append(ghost);
      R.drag = { from: sq, ghost, startX: e.clientX, startY: e.clientY, moved: false, wasSelected, pointerId: e.pointerId };
      board.setPointerCapture(e.pointerId);
    } else {
      R.sel = null;
      renderBoard();
    }
  });
  board.addEventListener('pointermove', (e) => {
    const d = R.drag;
    if (!d || e.pointerId !== d.pointerId) return;
    if (!d.moved && Math.hypot(e.clientX - d.startX, e.clientY - d.startY) > 4) {
      d.moved = true;
      d.ghost.hidden = false;
      const fromEl = board.querySelector(`[data-sq="${d.from}"]`);
      if (fromEl) fromEl.classList.add('dragging');
    }
    if (d.moved) {
      d.ghost.style.left = `${e.clientX}px`;
      d.ghost.style.top = `${e.clientY}px`;
      const over = squareFromPoint(e.clientX, e.clientY);
      board.querySelectorAll('.hover-target').forEach((n) => n.classList.remove('hover-target'));
      if (over && legalFrom(d.from).some((m) => m.to === over)) {
        board.querySelector(`[data-sq="${over}"]`).classList.add('hover-target');
      }
    }
  });
  const endDrag = (e) => {
    const d = R.drag;
    if (!d || e.pointerId !== d.pointerId) return;
    R.drag = null;
    d.ghost.remove();
    if (d.moved) {
      d.ghost.hidden = true;
      const over = squareFromPoint(e.clientX, e.clientY);
      if (over && over !== d.from && tryUserMove(d.from, over)) return;
      renderBoard();
    } else if (d.wasSelected) {
      R.sel = null; // second tap on the same piece deselects
      renderBoard();
    }
  };
  board.addEventListener('pointerup', endDrag);
  board.addEventListener('pointercancel', (e) => { if (R.drag) { R.drag.ghost.remove(); R.drag = null; renderBoard(); } });

  // Keyboard: arrows move focus, Enter/Space selects or moves.
  board.addEventListener('keydown', (e) => {
    const sqEl = e.target.closest('.sq');
    if (!sqEl) return;
    const all = [...board.children];
    const i = all.indexOf(sqEl);
    const step = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -8, ArrowDown: 8 }[e.key];
    if (step) {
      e.preventDefault();
      const next = all[i + step];
      if (next) { all.forEach((n) => (n.tabIndex = -1)); next.tabIndex = 0; next.focus(); }
      return;
    }
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      const sq = sqEl.dataset.sq;
      if (!canMove()) return;
      if (R.sel && R.sel !== sq && tryUserMove(R.sel, sq)) return;
      const p = R.s.chess.get(sq);
      if (p && p.color === seat()) {
        selectSquare(R.sel === sq ? null : sq);
        $('board').querySelector(`[data-sq="${sq}"]`)?.focus();
      }
    }
    if (e.key === 'Escape') { R.sel = null; renderBoard(); }
  });
}

// ---------- status, actions ----------
function renderStatus() {
  const s = R.s;
  const me = seat();
  const line = $('status-line');
  const active = G.isActive(s);
  const t = G.turn(s);
  line.replaceChildren();
  if (!s.started) {
    line.textContent = me ? 'Waiting for your opponent to join. Share the room link.' : 'Waiting for a second player.';
  } else if (s.result) {
    const head = s.result.winner ? `${G.playerName(s, s.result.winner)} wins` : 'Drawn';
    line.textContent = `Game over: ${head} (${s.result.reason}).`;
  } else if (me && R.pending) {
    line.textContent = 'Sending your move…';
  } else if (me && me === t) {
    line.append(el('span', { class: 'your-move', text: 'Your move' }), s.chess.inCheck() ? ' — you are in check.' : '');
  } else if (me) {
    line.textContent = `Waiting for ${G.playerName(s, t)} to move.`;
  } else {
    line.textContent = `You're watching. ${G.playerName(s, t)} (${G.colorName(t)}) to move.`;
  }

  $('move-form').hidden = !(me && active);
  $('move-input').disabled = !canMove();
  $('move-form').querySelector('button').disabled = !canMove();

  // Draw offer from the opponent
  const offer = $('draw-offer');
  if (me && active && s.drawOffer === G.other(me)) {
    offer.hidden = false;
    offer.replaceChildren(
      el('p', { text: `${G.playerName(s, s.drawOffer)} offers a draw.` }),
      el('button', { class: 'btn primary', type: 'button', text: 'Accept draw', onclick: () => publish({ type: 'accept-draw', id: R.me.id, game: s.game }) }),
      el('button', { class: 'btn', type: 'button', text: 'Decline', onclick: () => publish({ type: 'decline-draw', id: R.me.id, game: s.game }) }),
    );
  } else offer.hidden = true;

  const acts = $('actions');
  const btns = [];
  if (me && active) {
    const offered = s.drawOffer === me;
    btns.push(el('button', { class: 'btn', type: 'button', disabled: offered, text: offered ? 'Draw offered' : 'Offer draw',
      onclick: () => publish({ type: 'offer-draw', id: R.me.id, game: s.game }) }));
    btns.push(el('button', { class: 'btn danger', type: 'button', text: R.resignArmed ? 'Confirm resign' : 'Resign',
      onclick: () => {
        if (!R.resignArmed) {
          R.resignArmed = true;
          renderStatus();
          setTimeout(() => { R.resignArmed = false; renderStatus(); }, 4000);
        } else {
          R.resignArmed = false;
          publish({ type: 'resign', id: R.me.id, game: s.game });
        }
      } }));
    if (s.clock) {
      btns.push(el('button', { class: 'btn', type: 'button', text: 'Give 15 s', title: 'Add 15 seconds to your opponent\'s clock',
        onclick: () => publish({ type: 'add-time', id: R.me.id, game: s.game, seconds: 15 }) }));
    }
  }
  if (me && s.result) {
    const asked = s.rematch[me];
    const theyAsked = s.rematch[G.other(me)];
    btns.push(el('button', { class: 'btn primary', type: 'button', disabled: asked,
      text: asked ? 'Rematch requested' : theyAsked ? 'Accept rematch' : 'Rematch',
      onclick: () => publish({ type: 'rematch', id: R.me.id, game: s.game }) }));
    btns.push(analysisButton('btn'));
    btns.push(el('a', { class: 'btn', href: './', text: 'New room' }));
  }
  if (s.result && !R.review) btns.push(el('button', { class: 'btn', type: 'button', text: 'Review game', onclick: () => startReview() }));
  btns.push(el('button', { class: 'btn', type: 'button', text: 'Flip board', onclick: () => { R.userFlip = !R.userFlip; renderBars(); renderBoard(); tick(); } }));
  acts.replaceChildren(...btns.filter(Boolean));
}

function renderSeatPanel() {
  const s = R.s;
  const panel = $('seat-panel');
  const free = !s.players.w ? 'w' : !s.players.b ? 'b' : null;
  if (seat() || !free) {
    panel.hidden = true;
    return;
  }
  if (!panel.hidden && panel.dataset.free === free) return; // don't wipe what the user is typing
  panel.dataset.free = free;
  panel.hidden = false;
  const host = s.players[G.other(free)];
  const nameInput = el('input', { id: 'seat-name', maxlength: '40', placeholder: 'Your name', required: true, value: store.get('agentchess:name') || '' });
  const form = el('form', { autocomplete: 'off', onsubmit: async (e) => {
    e.preventDefault();
    const name = nameInput.value.trim();
    if (!name) { nameInput.focus(); return; }
    store.set('agentchess:name', name);
    const id = (R.me && R.me.id) || 'p-' + randomString(12, 'abcdefghijklmnopqrstuvwxyz0123456789');
    R.me = { id, name };
    store.set(`agentchess:seat:${R.code}`, R.me);
    form.querySelector('button').disabled = true;
    const ok = await publish({ type: 'join', id, name });
    if (!ok) form.querySelector('button').disabled = false;
  } },
    el('label', { class: 'field' }, el('span', { text: 'Your name' }), nameInput),
    el('button', { class: 'btn primary big', type: 'submit', text: `Join game as ${G.colorName(free)}` }));
  panel.replaceChildren(
    el('h2', { text: 'Join this game' }),
    el('p', { text: `${host ? host.name : 'The host'} is waiting. You'll play ${G.colorName(free)} · ${G.describeTimeControl(s.room.tc)}. The clock starts as soon as you join.` }),
    form,
    el('p', { class: 'hint', text: 'Or stay on this page to watch without joining.' }),
  );
}

function inviteText(s) {
  const me = seat();
  const theirs = me ? G.other(me) : null;
  const url = roomUrl(R.code);
  const topicUrl = `${RELAY}/${topicFor(R.code)}`;
  const host = me ? G.playerName(s, me) : 'me';
  return [
    `Let's play chess on Agent Chess. Room code: ${R.code}.`,
    `You'll play ${theirs ? G.colorName(theirs) : 'the open seat'} against ${host}. Time control: ${G.describeTimeControl(s.room.tc)}.${s.room.tc ? ' Your clock is real: it starts when you join (White moves first) and you lose if it runs out.' : ''}`,
    '',
    ...(s.room.tc ? [
      'Clock discipline (this is where agents lose games):',
      '- Play in a loop: wait for your turn, pick a move, send it, wait again. Don\'t stop to talk to your human between moves.',
      '- Whenever you are woken up (a new message, an interruption, wait timing out), check the game state first. If it\'s your move, move before saying anything.',
      '- Keep thinking short. An okay move on time beats a great one after your flag falls.',
      '- CLI: wait returns within 20 s. "Not yet" means run it again. Send move and wait as separate commands, never chained, and if you find old output, run state before acting.',
      '- Commentary is welcome, after you\'ve sent your move.',
      '',
    ] : []),
    'Choose one way to play:',
    '',
    `A) Browser: open ${url}`,
    '   Enter your name and press "Join game". To move, type it in the "Type a move" box (SAN like Nf3, or UCI like g1f3) and press Enter.',
    '   The "Game state (text)" section shows the FEN, move list and an ASCII board.',
    '   Important: keeping the page open does NOT keep you running. When you end your turn you stop seeing the game, and your clock keeps going.',
    '   After each move, stay in the same turn and keep re-checking the page until it\'s your move again (the tab title starts with "● Your move"). If you can\'t keep a turn open, use B or C instead, or tell me so I can prompt you after each move.',
    '',
    'B) Command line (Node 18+, no installs):',
    `   curl -sO ${siteBase()}agent-chess.mjs`,
    `   node agent-chess.mjs join ${R.code} --name "YOUR NAME"${RELAY !== DEFAULT_RELAY ? ` --relay ${RELAY}` : ''}`,
    `   node agent-chess.mjs wait ${R.code}       # returns when it's your move, or after 20 s with "not yet" (run it again)`,
    `   node agent-chess.mjs move ${R.code} e5     # SAN or UCI`,
    '',
    'C) Raw HTTP: each action is one POST of a small JSON message to the room relay.',
    `   Read the room:  curl -s "${topicUrl}/json?poll=1&since=all"`,
    `   Join:           curl -s -d '{"type":"join","id":"PICK-A-UNIQUE-ID","name":"YOUR NAME"}' ${topicUrl}`,
    `   Move:           curl -s -d '{"type":"move","id":"PICK-A-UNIQUE-ID","uci":"e7e5"}' ${topicUrl}`,
    `   Wait for news:  curl -s --max-time 20 "${topicUrl}/json?since=<last message id>"   (returns after 20 s at most)`,
    '   The relay only stores messages: you track the position yourself and watch for resign, draw offers and the result. Your clock starts when you join, so set up first.',
    '',
    'When the game ends, don\'t leave yet: stay in the room for at least 30 seconds (CLI: node agent-chess.mjs wait ROOM --any --timeout 30). I may ask for a short analysis (comments on key moves that show up next to them on my screen) or a rematch. The details are in the rules link below.',
    `Full rules and message formats: ${siteBase()}AGENTS.md`,
    'Feel free to chat in the room too: {"type":"chat","id":"...","text":"good luck"}',
  ].join('\n');
}

function renderInvite() {
  const s = R.s;
  const panel = $('invite-panel');
  const show = seat() && !s.started;
  panel.hidden = !show;
  if (!show || panel.dataset.ready === R.code) return;
  panel.dataset.ready = R.code;
  const link = el('input', { value: roomUrl(R.code), readonly: true, 'aria-label': 'Room link', onfocus: (e) => e.target.select() });
  const pre = el('pre', { text: inviteText(s) });
  panel.replaceChildren(
    el('h2', { text: `Room ${R.code} is open` }),
    el('p', { text: 'Send this link to your opponent. For an AI agent, copy the full invite: it explains how to join and move, in a browser or over HTTP.' }),
    el('div', { class: 'share-link' }, link, el('button', { class: 'btn', type: 'button', text: 'Copy link', onclick: () => copy(roomUrl(R.code), 'Room link copied') })),
    el('div', { class: 'actions-row' },
      el('button', { class: 'btn primary', type: 'button', text: 'Copy invite for an agent', onclick: () => copy(inviteText(R.s), 'Agent invite copied') })),
    el('details', {}, el('summary', { class: 'link-btn', text: 'Preview the agent invite' }), pre),
  );
}

function renderSheet() {
  const s = R.s;
  const sheet = $('sheet');
  const items = [];
  if (!s.moves.length) items.push(el('li', {}, el('span', { class: 'empty', text: s.started ? 'No moves yet.' : 'The game starts when both seats are filled.' })));
  const finished = !!s.result;
  const current = R.review ? R.review.ply - 1 : s.moves.length - 1;
  const a = s.analysis[s.game];
  const cell = (m, i) => {
    if (!m) return el('span', { class: 'm' });
    const notes = (a && a.notes[i + 1]) || [];
    const tag = notes.length ? notes[0].tag : null;
    const kids = [m.san, tag ? el('span', { class: `sym tag-${tag}`, title: G.TAGS[tag].label, text: G.TAGS[tag].symbol }) : null];
    const cls = 'm' + (i === current ? ' latest' : '') + (tag ? ' noted' : '');
    if (!finished) return el('span', { class: cls }, ...kids);
    return el('button', { class: cls, type: 'button', 'aria-label': `Review ${G.moveLabel(i + 1, m.san)}${tag ? `, ${G.TAGS[tag].label}` : ''}`,
      onclick: () => startReview(i + 1) }, ...kids);
  };
  for (let i = 0; i < s.moves.length; i += 2) {
    items.push(el('li', {},
      el('span', { class: 'n', text: `${i / 2 + 1}.` }),
      cell(s.moves[i], i),
      cell(s.moves[i + 1], i + 1)));
  }
  if (s.result) items.push(el('li', {}, el('span', { class: 'res', text: G.resultString(s.result).replace('1/2-1/2', '½–½') })));
  sheet.replaceChildren(...items);
  const cur = sheet.querySelector('.latest');
  if (R.review && cur) {
    // Scroll the move list itself, never the page (scrollIntoView would move the window too).
    const top = cur.offsetTop; // .sheet is position: relative, so this is within the list
    if (top < sheet.scrollTop) sheet.scrollTop = top;
    else if (top + cur.offsetHeight > sheet.scrollTop + sheet.clientHeight) sheet.scrollTop = top + cur.offsetHeight - sheet.clientHeight;
  }
  else if (!R.review) sheet.scrollTop = sheet.scrollHeight;
}

// ---------- post-game analysis ----------
function myAnalysisRequest() {
  const a = R.s.analysis[R.s.game];
  return !!(a && a.requests.some((r) => r.color === seat()));
}

function analysisButton(cls = 'btn on-dark') {
  const s = R.s;
  if (!seat() || !s.result) return null;
  if (myAnalysisRequest()) {
    return el('button', { class: cls, type: 'button', text: 'Copy analysis request', title: 'Copy the request again to paste to your opponent',
      onclick: () => copy(analysisPrompt(), 'Analysis request copied') });
  }
  return el('button', { class: cls + ' primary-ish', type: 'button', text: 'Request analysis', onclick: requestAnalysis });
}

async function requestAnalysis() {
  const s = R.s;
  const ok = await publish({ type: 'analysis-request', id: R.me.id, game: s.game });
  if (!ok) return;
  await copy(analysisPrompt(), 'Analysis requested. The request is also on your clipboard: paste it to your opponent if they stopped listening.');
  startReview();
}

function analysisPrompt() {
  const s = R.s;
  const me = seat();
  const opp = me ? G.other(me) : null;
  const topicUrl = `${RELAY}/${topicFor(R.code)}`;
  const g = s.game;
  return [
    `Thanks for the game! Please give me a post-game analysis on Agent Chess (room ${R.code}, game ${g}). I played ${me ? G.colorName(me) : ''}${opp ? `, you played ${G.colorName(opp)}` : ''}.`,
    'Comment on the key moments: good moves, inaccuracies, mistakes, blunders and missed chances. Suggest a better move where there was one, and finish with a 2–3 sentence summary. Your comments appear on my screen next to each move, with an arrow for each better move.',
    '',
    'With the command-line client (same id you played with):',
    `   node agent-chess.mjs review ${R.code}                  # every move with its position, numbered like 14w / 14b`,
    `   node agent-chess.mjs annotate ${R.code} 14b "Nf6 drops the e5 pawn." --tag mistake --better Nd7`,
    `   node agent-chess.mjs annotate ${R.code} summary "Your 2–3 sentence summary."`,
    '   Tags: brilliant, great, best, good, book, interesting, inaccuracy, mistake, blunder, missed-win (or leave it out for a plain comment).',
    '',
    'Over HTTP: POST one message per comment to the room relay, using your player id:',
    `   curl -s -d '{"type":"annotation","id":"YOUR-ID","game":${g},"at":"14b","tag":"mistake","text":"...","better":"Nd7"}' ${topicUrl}`,
    `   curl -s -d '{"type":"annotation","id":"YOUR-ID","game":${g},"at":"summary","text":"..."}' ${topicUrl}`,
    '',
    `Details: ${siteBase()}AGENTS.md (section "Post-game analysis").`,
  ].join('\n');
}

function startReview(ply) {
  const s = R.s;
  if (!s.result) return;
  const rec = G.gameRecord(s, s.game);
  const p = ply != null ? ply : Math.min(1, rec.moves.length); // start at the first move
  R.review = { game: s.game, ply: Math.max(0, Math.min(p, rec.moves.length)) };
  R.sel = null;
  render();
}

function firstNotedPly() {
  const a = R.s.analysis[R.s.game];
  if (!a) return null;
  const plies = Object.keys(a.notes).map(Number).sort((x, y) => x - y);
  return plies[0] || null;
}

function stepReview(to) {
  if (!R.review) return;
  const rec = reviewRecord();
  R.review.ply = Math.max(0, Math.min(to, rec.moves.length));
  renderBoard();
  renderSheet();
  renderReview();
}

function nextNoted(dir) {
  const a = R.s.analysis[R.review.game];
  if (!a) return;
  const plies = Object.keys(a.notes).map(Number).sort((x, y) => x - y);
  const cur = R.review.ply;
  const target = dir > 0 ? plies.find((p) => p > cur) : [...plies].reverse().find((p) => p < cur);
  if (target != null) stepReview(target);
}

function renderReview() {
  const panel = $('review-panel');
  if (!R.review) {
    panel.hidden = true;
    return;
  }
  panel.hidden = false;
  // Don't wipe a comment someone is typing when other messages arrive.
  const active = document.activeElement;
  if (active && active.matches && active.matches('#review-panel .rv-form :is(textarea, input, select)') && panel.dataset.ply === String(R.review.ply)) return;
  panel.dataset.ply = String(R.review.ply);
  const s = R.s;
  const rec = reviewRecord();
  const ply = R.review.ply;
  const a = s.analysis[R.review.game] || { requests: [], notes: {}, summaries: [] };
  const notes = reviewNotes(ply);
  const move = ply ? rec.moves[ply - 1] : null;
  const total = rec.moves.length;
  const plies = Object.keys(a.notes).map(Number);

  const body = [];
  if (ply === 0) {
    body.push(el('p', { class: 'rv-where', text: 'Starting position' })); // replaced below by the header row
  } else {
    body.push(el('p', { class: 'rv-where', text: G.moveLabel(ply, move.san) + ` · ${G.colorName(move.color)}` }));
  }
  if (notes.length) {
    for (const n of notes) {
      body.push(el('div', { class: 'rv-note' },
        el('span', { class: `rv-tag tag-${n.tag}` }, el('b', { text: G.TAGS[n.tag].symbol }), ` ${G.TAGS[n.tag].label}`),
        n.text ? el('p', { text: n.text }) : null,
        n.better ? el('p', { class: 'rv-better' }, 'Better: ', el('strong', { text: n.better.san }), ' (arrow on the board)') : null,
        el('p', { class: 'rv-by', text: `— ${n.author}` })));
    }
  } else if (ply > 0) {
    body.push(el('p', { class: 'rv-empty', text: 'No comment on this move.' }));
  }
  if (a.summaries.length && (ply === 0 || ply === total)) {
    for (const x of a.summaries) {
      body.push(el('div', { class: 'rv-summary' }, el('h3', { text: `Summary from ${x.author}` }), el('p', { text: x.text })));
    }
  }
  const mine = seat();
  // The room's host is the human; the side that joined from the invite is the bot. Only
  // the invited side gets the comment form; the host keeps the plain review.
  const invited = !!(mine && s.room && R.me && s.room.host !== R.me.id);
  const askedOfMe = invited && a.requests.find((r) => r.color !== mine);
  const iAsked = mine && a.requests.some((r) => r.color === mine);
  if (askedOfMe) {
    body.push(el('p', { class: 'rv-ask', text: `${askedOfMe.by} asked you for an analysis. Step to a key moment and add a comment below, and finish with a summary on the last move.` }));
  }
  if (!plies.length && !a.summaries.length && !askedOfMe) {
    body.push(el('p', { class: 'rv-empty', text: iAsked
      ? `Analysis requested. Comments appear here as ${mine ? G.playerName(s, G.other(mine)) : 'your opponent'} adds them.`
      : 'No analysis yet. Use "Request analysis" to ask your opponent to annotate this game.' }));
  }
  if (invited) body.push(annotateForm(ply, total, notes, a));

  const nav = (label, text, to, disabled) =>
    el('button', { class: 'btn nav', type: 'button', 'aria-label': label, title: label, text, disabled, onclick: () => stepReview(to) });
  // Header row: the move on the left, compact ◀ ▶ » controls on the right (shown on mobile;
  // desktop keeps the full button row below).
  const whereText = ply === 0 ? 'Starting position' : G.moveLabel(ply, move.san) + ` · ${G.colorName(move.color)}`;
  const hasNext = plies.some((p) => p > ply);
  body[0] = el('div', { class: 'rv-top' },
    el('p', { class: 'rv-where', text: whereText }),
    el('div', { class: 'rv-mininav' },
      el('button', { class: 'mini', type: 'button', 'aria-label': 'Previous move', title: 'Previous move', text: '◀', disabled: ply === 0, onclick: () => stepReview(ply - 1) }),
      el('button', { class: 'mini', type: 'button', 'aria-label': 'Next move', title: 'Next move', text: '▶', disabled: ply >= total, onclick: () => stepReview(ply + 1) }),
      el('button', { class: 'mini', type: 'button', 'aria-label': 'Next comment', title: 'Next comment', text: '»', disabled: !hasNext, onclick: () => nextNoted(1) })));
  panel.replaceChildren(
    el('div', { class: 'panel-head rv-head' },
      el('h2', { text: `Game review${plies.length || a.summaries.length ? ` · ${G.noteCount(s, R.review.game)} comment${G.noteCount(s, R.review.game) === 1 ? '' : 's'}` : ''}` }),
      el('button', { class: 'link-btn', type: 'button', text: 'Close review', onclick: () => { R.review = null; render(); } })),
    ...body,
    el('div', { class: 'rv-nav' },
      el('span', { class: 'nav-end' }, nav('First position', '⏮', 0, ply === 0)),
      nav('Previous move', '◀', ply - 1, ply === 0),
      nav('Next move', '▶', ply + 1, ply >= total),
      el('span', { class: 'nav-end' }, nav('Last move', '⏭', total, ply >= total)),
      el('button', { class: 'btn', type: 'button', text: 'Next comment', disabled: !plies.some((p) => p > ply), onclick: () => nextNoted(1) })),
    el('p', { class: 'hint rv-tip', text: 'Tip: ← and → step through the moves.' }),
    el('button', { class: 'btn rv-close-bottom', type: 'button', text: 'Close review', onclick: () => { R.review = null; render(); } }),
  );
}

function annotateForm(ply, total, notes, a) {
  const s = R.s;
  const g = R.review.game;
  const myId = R.me.id;
  const form = el('form', { class: 'rv-form', autocomplete: 'off' });
  if (ply > 0) {
    const mineHere = notes.find((n) => n.authorId === myId);
    const select = el('select', { id: 'rv-tag', 'aria-label': 'Tag' },
      ...Object.entries(G.TAGS).map(([k, t]) => el('option', { value: k, text: `${t.symbol} ${t.label}`, selected: (mineHere ? mineHere.tag : 'note') === k })));
    const text = el('textarea', { id: 'rv-text', rows: '3', maxlength: '1000', 'aria-label': 'Comment', placeholder: 'What happened on this move?' });
    text.value = mineHere ? mineHere.text : '';
    const better = el('input', { id: 'rv-better', 'aria-label': 'Better move', placeholder: 'Better move (optional), e.g. Nf3', value: mineHere && mineHere.better ? mineHere.better.san : '' });
    const err = el('p', { class: 'form-error', role: 'alert' });
    form.append(
      el('h3', { text: `${mineHere ? 'Edit your' : 'Your'} comment on ${G.moveLabel(ply, reviewRecord().moves[ply - 1].san)}` }),
      el('div', { class: 'rv-row' }, select, better), text, err,
      el('button', { class: 'btn primary', type: 'submit', text: mineHere ? 'Update comment' : 'Post comment' }));
    form.onsubmit = async (e) => {
      e.preventDefault();
      err.textContent = '';
      const b = better.value.trim();
      if (b) {
        const c = new Chess(G.fenBefore(reviewRecord(), ply));
        if (!G.previewMove({ chess: c }, b)) { err.textContent = `"${b}" isn't legal in the position before this move.`; return; }
      }
      if (!text.value.trim() && !b && select.value === 'note') { err.textContent = 'Write a comment, pick a tag or suggest a better move.'; return; }
      const ok = await publish({ type: 'annotation', id: myId, game: g, at: G.plyLabel(ply), tag: select.value, text: text.value.trim(), better: b || undefined });
      if (ok) { toast('Comment posted'); document.activeElement.blur(); renderReview(); }
    };
  }
  if (ply === 0 || ply === total) {
    const mineSum = a.summaries.find((x) => x.authorId === myId);
    const sum = el('textarea', { id: 'rv-summary', rows: '3', maxlength: '1000', 'aria-label': 'Summary', placeholder: 'Two or three sentences on the whole game' });
    sum.value = mineSum ? mineSum.text : '';
    const sumBtn = el('button', { class: 'btn', type: 'button', text: mineSum ? 'Update summary' : 'Post summary', onclick: async () => {
      if (!sum.value.trim()) return;
      if (await publish({ type: 'annotation', id: myId, game: g, at: 'summary', text: sum.value.trim() })) { toast('Summary posted'); document.activeElement.blur(); renderReview(); }
    } });
    form.append(el('h3', { text: 'Game summary' }), sum, sumBtn);
  }
  return form;
}

function renderFeed() {
  const feed = $('feed');
  const fmt = (t) => new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const items = R.s.feed.slice(-200).map((f) =>
    f.kind === 'chat'
      ? el('li', {}, el('b', { text: `${f.from}: ` }), f.text)
      : el('li', { class: 'system', title: fmt(f.time), text: f.text }));
  if (!items.length) items.push(el('li', { class: 'system', text: 'Nothing here yet.' }));
  feed.replaceChildren(...items);
  feed.scrollTop = feed.scrollHeight;
}

// ---------- opening names ----------
function renderOpeningChip() {
  const s = R.s;
  const rec = R.review ? reviewRecord() : { moves: s.moves };
  R.openingInfo = identify(rec.moves);
  const chip = $('opening-chip');
  if (!R.openingInfo) {
    chip.hidden = true;
    if (R.opening) { R.opening = null; $('opening-panel').hidden = true; }
    return;
  }
  chip.hidden = false;
  chip.replaceChildren(el('span', { class: 'eco', text: R.openingInfo.eco }), el('span', { class: 'oname', text: R.openingInfo.name }), el('span', { class: 'more', 'aria-hidden': 'true', text: '›' }));
  chip.title = `${R.openingInfo.eco} ${R.openingInfo.name}: show the opening line and a short primer`;
}

function openOpening() {
  if (!R.openingInfo) return;
  R.opening = { ply: R.openingInfo.line.length };
  renderOpening();
}

function stepOpening(to) {
  if (!R.opening || !R.openingInfo) return;
  R.opening.ply = Math.max(0, Math.min(to, R.openingInfo.line.length));
  renderOpening();
}

function miniBoard(fen, last, flip) {
  const c = new Chess(fen);
  const files = 'abcdefgh';
  const squares = [];
  for (let r = 0; r < 8; r++) {
    for (let f = 0; f < 8; f++) {
      const file = flip ? 7 - f : f;
      const rank = flip ? r + 1 : 8 - r;
      const sq = files[file] + rank;
      const piece = c.get(sq);
      const node = el('div', { class: ['sq', (file + rank) % 2 === 1 && 'dark', last && (last.from === sq || last.to === sq) && 'last'].filter(Boolean).join(' ') });
      if (piece) node.append(pieceNode(piece.color, piece.type));
      squares.push(node);
    }
  }
  return el('div', { class: 'mini-board', role: 'img', 'aria-label': `Board after the shown move. FEN ${fen}` }, ...squares);
}

function renderOpening() {
  const panel = $('opening-panel');
  const info = R.openingInfo;
  if (!R.opening || !info) {
    panel.hidden = true;
    return;
  }
  panel.hidden = false;
  const ply = R.opening.ply;
  const line = info.line;
  // Replay the line up to the shown ply.
  const c = new Chess();
  let last = null;
  for (let i = 0; i < ply; i++) last = c.move(line[i]);
  const primer = primerFor(info.name);
  const fam = primer && primer.family;
  const close = () => { R.opening = null; renderOpening(); };
  const mini = (label, text, to, disabled) =>
    el('button', { class: 'mini', type: 'button', 'aria-label': label, title: label, text, disabled, onclick: () => stepOpening(to) });

  const moveItems = line.map((san, i) => {
    const label = i % 2 === 0 ? `${i / 2 + 1}. ${san}` : san;
    return el('button', { class: 'op-move' + (i + 1 === ply ? ' current' : ''), type: 'button', text: label, onclick: () => stepOpening(i + 1) });
  });
  const played = R.review ? reviewRecord().moves.length : R.s.moves.length;
  const followed = info.ply;
  const where = followed >= played
    ? 'Your game is still in this line.'
    : `Your game reached this position after ${G.moveLabel(followed, (R.review ? reviewRecord() : R.s).moves[followed - 1].san)} and then left the named lines.`;

  panel.replaceChildren(
    el('div', { class: 'op-top' },
      el('div', { class: 'op-title' }, el('span', { class: 'eco', text: info.eco }), el('h2', { text: info.name })),
      el('div', { class: 'rv-mininav op-nav' },
        mini('Start position', '⏮', 0, ply === 0),
        mini('Previous move', '◀', ply - 1, ply === 0),
        mini('Next move', '▶', ply + 1, ply >= line.length),
        mini('End of line', '⏭', line.length, ply >= line.length))),
    miniBoard(c.fen(), last, flipped()),
    el('div', { class: 'op-line', 'aria-label': 'Opening moves' }, ...moveItems),
    el('p', { class: 'op-where', text: where }),
    fam ? el('div', { class: 'op-primer' },
      el('p', { text: fam.about }),
      el('h3', { text: 'Ideas for White' }), el('p', { text: fam.white }),
      el('h3', { text: 'Ideas for Black' }), el('p', { text: fam.black })) : el('p', { class: 'op-primer', text: ecoVolume(info.eco) }),
    ...(primer ? primer.notes.map((n) => el('div', { class: 'op-note' }, el('h3', { text: n.match.split(':').pop().trim() }), el('p', { text: n.text }))) : []),
    el('p', { class: 'op-credit' }, 'Names and lines: ', el('a', { href: 'https://github.com/lichess-org/chess-openings', target: '_blank', rel: 'noopener', text: 'Lichess openings (public domain)' }), '.'),
    el('button', { class: 'btn op-close', type: 'button', text: 'Close', onclick: close }),
  );
}

function renderTextState() {
  const s = R.s;
  let text = G.describeState(s, { me: R.me && R.me.id, now: serverNow() });
  const op = identify(s.moves);
  if (op) text = text.replace(/\nFEN:/, `\nOpening: ${op.eco} ${op.name}\nFEN:`);
  if (canMove()) {
    const legal = s.chess.moves();
    text += `\n\nYour legal moves: ${legal.join(' ')}`;
  }
  $('text-state').textContent = text;
}

function renderAgentHelp() {
  const topicUrl = `${RELAY}/${topicFor(R.code)}`;
  $('agent-help-body').replaceChildren(
    el('p', { text: 'You can play right here: enter a name in "Join this game", press the join button, then type moves into the "Type a move" box and press Enter. Moves can be SAN (Nf3, exd5, O-O, e8=Q) or UCI (g1f3, e7e8q).' }),
    el('p', { text: 'Without a browser, use the command-line client (Node 18+):' }),
    el('pre', { text: `curl -sO ${siteBase()}agent-chess.mjs\nnode agent-chess.mjs join ${R.code} --name "YOUR NAME"\nnode agent-chess.mjs wait ${R.code}\nnode agent-chess.mjs move ${R.code} <move>` }),
    el('p', { text: 'Or speak to the relay directly. Every action is a POST of one JSON message; reading the room returns every message so far, one per line:' }),
    el('pre', { text: `curl -s "${topicUrl}/json?poll=1&since=all"\ncurl -s -d '{"type":"join","id":"YOUR-ID","name":"YOUR NAME"}' ${topicUrl}\ncurl -s -d '{"type":"move","id":"YOUR-ID","uci":"e2e4"}' ${topicUrl}` }),
    el('p', {}, 'The full protocol is in ', el('a', { href: 'AGENTS.md', text: 'AGENTS.md' }), '.'),
  );
}

let roomWired = false;
function wireRoomControls() {
  if (roomWired) return;
  roomWired = true;
  wireBoard();
  $('move-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const input = $('move-input');
    const text = input.value.trim();
    if (!text) return;
    if (await sendMove(text)) input.value = '';
  });
  $('chat-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const input = $('chat-input');
    const text = input.value.trim();
    if (!text) return;
    const id = (R.me && R.me.id) || (R.me = { id: 'p-' + randomString(12, 'abcdefghijklmnopqrstuvwxyz0123456789'), name: store.get('agentchess:name') || 'Spectator' }).id;
    if (await publish({ type: 'chat', id, name: R.me.name || store.get('agentchess:name') || 'Spectator', text })) input.value = '';
  });
  $('copy-pgn').addEventListener('click', () => copy(G.toPgn(R.s), 'PGN copied'));
  $('opening-chip').addEventListener('click', () => (R.opening ? (R.opening = null, renderOpening()) : openOpening()));
  $('copy-fen').addEventListener('click', () => copy(R.s.chess.fen(), 'FEN copied'));
  $('missing-retry').addEventListener('click', async () => {
    await R.relay.catchUp();
    render();
  });
  document.addEventListener('keydown', (e) => {
    if (R.opening && !R.review && !e.target.closest('input, textarea, select, .board')) {
      if (e.key === 'ArrowLeft') { e.preventDefault(); stepOpening(R.opening.ply - 1); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); stepOpening(R.opening.ply + 1); }
      else if (e.key === 'Escape') { R.opening = null; renderOpening(); }
      return;
    }
    if (!R.review || e.target.closest('input, textarea, select, .board')) return;
    const steps = { ArrowLeft: -1, ArrowRight: 1 };
    if (e.key in steps) {
      e.preventDefault();
      stepReview(R.review.ply + steps[e.key]);
    } else if (e.key === 'Home') stepReview(0);
    else if (e.key === 'End') stepReview(Infinity);
    else if (e.key === 'Escape') { R.review = null; render(); }
  });
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && R.relay) R.relay.catchUp().then(render);
  });
}

// ---------- boot ----------
wireStyleMenu();
document.title = APP_TITLE;
$('app-version').textContent = `v${VERSION}`;
const roomParam = normalizeCode(params.get('room'));
if (roomParam) enterRoom(roomParam);
else showLobby();
