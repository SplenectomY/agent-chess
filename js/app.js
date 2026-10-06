import { Chess } from '../vendor/chess.js';
import * as G from './game.js';
import { Relay, DEFAULT_RELAY, topicFor } from './relay.js';

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
function pieceNode(color, type, cls = 'piece') {
  return el('span', { class: `${cls} ${color}`, 'aria-hidden': 'true' },
    el('span', { class: 'fill', text: GLYPH[type] + VS }),
    el('span', { class: 'outline', text: (color === 'w' ? OUTLINE[type] : GLYPH[type]) + VS }));
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
  document.title = `Room ${code} — Agent Chess`;
  wireRoomControls();
  renderAgentHelp();

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
      c.textContent = st === 'live' ? 'Live' : st === 'connecting' ? 'Connecting' : 'Reconnecting';
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
        el('span', { class: 'pb-name', text: name }),
        el('span', { class: 'pb-meta' }, el('span', { class: `pb-swatch ${color}` }), G.colorName(color))),
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
  const title = `Room ${R.code} — Agent Chess`;
  document.title = myTurn ? `● Your move — ${title}` : title;
}

// ---------- board ----------
function displayChess() {
  const s = R.s;
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
  const last = R.pending ? { from: R.pending.uci.slice(0, 2), to: R.pending.uci.slice(2, 4) } : s.moves[s.moves.length - 1];
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
      if (r === 7) node.append(el('span', { class: 'coord file', text: files[file] }));
      if (f === 0) node.append(el('span', { class: 'coord rank', text: String(rank) }));
      squares.push(node);
    }
  }
  board.replaceChildren(...squares);
  // Keep one square in the tab order for keyboard users.
  const focusSq = board.querySelector('.sq.sel') || board.querySelector('.sq.movable') || board.firstChild;
  if (focusSq) focusSq.tabIndex = 0;

  const banner = $('banner');
  if (s.result) {
    const res = G.resultString(s.result);
    const head = s.result.winner ? `${G.playerName(s, s.result.winner)} wins` : 'Draw';
    banner.replaceChildren(el('strong', { text: `${res.replace('1/2-1/2', '½–½')}` }), el('div', { text: `${head} · ${s.result.reason}` }),
      el('button', { class: 'link-btn', type: 'button', text: 'Hide', style: 'color:inherit', onclick: () => (banner.hidden = true) }));
  }
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
      selectSquare(sq);
      const size = sqEl.getBoundingClientRect().width;
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
    btns.push(el('a', { class: 'btn', href: './', text: 'New room' }));
  }
  btns.push(el('button', { class: 'btn', type: 'button', text: 'Flip board', onclick: () => { R.userFlip = !R.userFlip; renderBars(); renderBoard(); tick(); } }));
  acts.replaceChildren(...btns);
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
    'Choose one way to play:',
    '',
    `A) Browser: open ${url}`,
    '   Enter your name and press "Join game". To move, type it in the "Your move" box (SAN like Nf3, or UCI like g1f3) and press Enter.',
    '   The "Game state (text)" section shows the FEN, move list and an ASCII board.',
    '',
    'B) Command line (Node 18+, no installs):',
    `   curl -sO ${siteBase()}agent-chess.mjs`,
    `   node agent-chess.mjs join ${R.code} --name "YOUR NAME"`,
    `   node agent-chess.mjs wait ${R.code}       # blocks until it's your move, then prints the board`,
    `   node agent-chess.mjs move ${R.code} e5     # SAN or UCI`,
    '',
    'C) Raw HTTP: each action is one POST of a small JSON message to the room relay.',
    `   Read the room:  curl -s "${topicUrl}/json?poll=1&since=all"`,
    `   Join:           curl -s -d '{"type":"join","id":"PICK-A-UNIQUE-ID","name":"YOUR NAME"}' ${topicUrl}`,
    `   Move:           curl -s -d '{"type":"move","id":"PICK-A-UNIQUE-ID","uci":"e7e5"}' ${topicUrl}`,
    '',
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
  for (let i = 0; i < s.moves.length; i += 2) {
    const w = s.moves[i];
    const b = s.moves[i + 1];
    const latest = s.moves.length - 1;
    items.push(el('li', {},
      el('span', { class: 'n', text: `${i / 2 + 1}.` }),
      el('span', { class: 'm' + (i === latest ? ' latest' : ''), text: w ? w.san : '' }),
      el('span', { class: 'm' + (i + 1 === latest ? ' latest' : ''), text: b ? b.san : '' })));
  }
  if (s.result) items.push(el('li', {}, el('span', { class: 'res', text: G.resultString(s.result).replace('1/2-1/2', '½–½') })));
  sheet.replaceChildren(...items);
  sheet.scrollTop = sheet.scrollHeight;
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

function renderTextState() {
  const s = R.s;
  let text = G.describeState(s, { me: R.me && R.me.id, now: serverNow() });
  if (canMove()) {
    const legal = s.chess.moves();
    text += `\n\nYour legal moves: ${legal.join(' ')}`;
  }
  $('text-state').textContent = text;
}

function renderAgentHelp() {
  const topicUrl = `${RELAY}/${topicFor(R.code)}`;
  $('agent-help-body').replaceChildren(
    el('p', { text: 'You can play right here: enter a name in "Join this game", press the join button, then type moves into "Your move" and press Enter. Moves can be SAN (Nf3, exd5, O-O, e8=Q) or UCI (g1f3, e7e8q).' }),
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
  $('copy-fen').addEventListener('click', () => copy(R.s.chess.fen(), 'FEN copied'));
  $('missing-retry').addEventListener('click', async () => {
    await R.relay.catchUp();
    render();
  });
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && R.relay) R.relay.catchUp().then(render);
  });
}

// ---------- boot ----------
const roomParam = normalizeCode(params.get('room'));
if (roomParam) enterRoom(roomParam);
else showLobby();
