// Agent Chess — game engine.
//
// A room is an append-only log of JSON events on a relay topic. Every client
// (browser, CLI, or an agent speaking raw HTTP) replays the same log with the
// same rules, so everyone agrees on the position, the result and the clocks.
// Clocks are computed from the relay's server timestamps, never from a
// player's own computer, which is what keeps the timer in sync for both sides.
//
// Runs unchanged in the browser and in Node.

import { Chess } from '../vendor/chess.js';
import { TAGS, tagKey } from './tags.js';
import { baseLang, langNameEnglish } from './langs.js';

export const PROTOCOL_VERSION = 1;
// Time that may pass after a clock reaches zero before the side is flagged.
// Relay timestamps have one-second resolution, so this absorbs rounding/lag.
export const GRACE_MS = 1000;

const NAME_MAX = 40;
const CHAT_MAX = 500;
const ID_MAX = 64;

export const other = (c) => (c === 'w' ? 'b' : 'w');
export const colorName = (c) => (c === 'w' ? 'White' : 'Black');

export function parseTimeControl(t) {
  if (!t || typeof t !== 'object') return null;
  const initial = Number(t.initial);
  const increment = Number(t.increment ?? 0);
  if (!Number.isFinite(initial) || initial <= 0) return null;
  return {
    initial: Math.round(Math.min(initial, 7 * 86400) * 1000),
    increment: Math.round(Math.max(0, Math.min(Number.isFinite(increment) ? increment : 0, 3600)) * 1000),
  };
}

export function describeTimeControl(tc) {
  if (!tc) return 'Untimed';
  const inc = `${tc.increment / 1000} s per move`;
  if (tc.initial < 60000) return `${tc.initial / 1000} s + ${inc}`;
  const mins = tc.initial / 60000;
  const m = Number.isInteger(mins) ? String(mins) : mins.toFixed(1).replace(/\.0$/, '');
  return `${m} min + ${inc}`;
}

// ---------- agent wake-up hooks ----------
// A player (usually an agent) can give an https URL to be called when its opponent does
// something it must react to. The opponent's page sends a small POST (no secrets in it), so an
// agent that isn't running a wait loop gets woken by its host (for example a webhook routine).
export const WAKE_EVENTS = ['move', 'game-over', 'draw-offer', 'analysis-request', 'rematch', 'chat'];
export const WAKE_DEFAULT = ['game-over', 'draw-offer', 'analysis-request', 'rematch', 'chat'];
export function cleanWake(url, on) {
  const u = typeof url === 'string' ? url.trim() : '';
  if (!/^https:\/\/[^\s"'<>]+$/i.test(u) || u.length > 500) return null;
  const list = Array.isArray(on) ? on.map(String).filter((e) => WAKE_EVENTS.includes(e)) : WAKE_DEFAULT;
  return { url: u, on: list.length ? [...new Set(list)] : WAKE_DEFAULT };
}

// A language code like "es" or "pt-BR" -> "es" / "pt"; anything else -> null.
function cleanLang(v) {
  const b = baseLang(v);
  return b || null;
}

function cleanText(s, max) {
  return typeof s === 'string' ? s.replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max) : '';
}

export function initialState() {
  return {
    room: null, // { host, tc, createdAt }
    game: 1,
    players: { w: null, b: null }, // { id, name }
    chess: new Chess(),
    moves: [], // { ply, san, uci, from, to, color, time, clock: {w,b}|null, fen }
    clock: null, // { w, b } ms remaining at turnStart
    turnStart: null, // server ms when the side to move started thinking
    started: false,
    result: null, // { winner: 'w'|'b'|null, reason, time }
    drawOffer: null, // color that offered
    rematch: { w: false, b: false },
    history: [], // finished games: { game, white, black, players, moves, result, pgn }
    analysis: {}, // game number -> { requests: [], notes: { [ply]: [note] }, summaries: [] }
    feed: [], // { time, kind: 'system'|'chat', text, from?, color? }
    lastEventTime: null,
  };
}

export function seatOf(s, id) {
  if (!id) return null;
  if (s.players.w && s.players.w.id === id) return 'w';
  if (s.players.b && s.players.b.id === id) return 'b';
  return null;
}

export const isActive = (s) => s.started && !s.result;
export const turn = (s) => s.chess.turn();
export const playerName = (s, c) => (s.players[c] ? s.players[c].name : colorName(c));

// A room-log line. `text` is English (the CLI and agents read it); `key`/`vars` let the page
// show it in the viewer's language (keys in js/locales/en.js under "log.").
function system(s, time, text, key = null, vars = null) {
  s.feed.push({ time, kind: 'system', text, key, vars });
}

// Does `color` have enough material that a checkmate is still possible?
// Used for "flagged, but the opponent can't mate" -> draw.
function canStillMate(chess, color) {
  let minors = 0;
  let opponentHasPieces = false;
  for (const row of chess.board()) {
    for (const sq of row) {
      if (!sq || sq.type === 'k') continue;
      if (sq.color === color) {
        if (sq.type === 'p' || sq.type === 'r' || sq.type === 'q') return true;
        minors++;
      } else {
        opponentHasPieces = true;
      }
    }
  }
  if (minors >= 2) return true;
  if (minors === 1) return opponentHasPieces;
  return false;
}

// code: checkmate | stalemate | insufficient | threefold | fifty | agreed | resigned | timeout |
// timeoutDraw. `reason` is the English text; code + vars let the page translate it.
function finish(s, winner, reason, time, code, vars = {}) {
  s.result = { winner, reason, time, code, vars };
  s.drawOffer = null;
  const text = winner
    ? `${playerName(s, winner)} (${colorName(winner)}) wins — ${reason}.`
    : `Draw — ${reason}.`;
  system(s, time, text, winner ? 'win' : 'drawResult', { name: playerName(s, winner), color: winner, code, ...vars });
}

// Remaining time for each side at server time `now` (ms). null when untimed.
export function clockAt(s, now) {
  if (!s.clock) return null;
  const c = { w: s.clock.w, b: s.clock.b };
  if (isActive(s) && s.turnStart != null && now != null) {
    c[turn(s)] -= Math.max(0, now - s.turnStart);
  }
  return c;
}

// If the side to move ran out of time before `time`, end the game.
function checkFlag(s, time) {
  if (!isActive(s) || !s.clock) return false;
  const side = turn(s);
  const remaining = s.clock[side] - (time - s.turnStart);
  if (remaining >= -GRACE_MS) return false;
  // The flag fell at turnStart + remaining time.
  const fellAt = s.turnStart + s.clock[side];
  s.clock[side] = 0;
  const winner = other(side);
  const v = { who: playerName(s, side), winnerName: playerName(s, winner) };
  if (canStillMate(s.chess, winner)) finish(s, winner, `${playerName(s, side)} ran out of time`, fellAt, 'timeout', v);
  else finish(s, null, `${playerName(s, side)} ran out of time, but ${playerName(s, winner)} cannot checkmate`, fellAt, 'timeoutDraw', v);
  return true;
}

const UCI_RE = /^([a-h][1-8])([a-h][1-8])([qrbn])?$/i;

function tryMove(chess, text) {
  if (typeof text !== 'string') return null;
  const t = text.trim();
  if (!t) return null;
  try {
    const m = UCI_RE.exec(t);
    if (m) {
      const from = m[1].toLowerCase();
      const to = m[2].toLowerCase();
      let promotion = m[3] ? m[3].toLowerCase() : undefined;
      const piece = chess.get(from);
      if (!promotion && piece && piece.type === 'p' && (to[1] === '8' || to[1] === '1')) promotion = 'q';
      return chess.move({ from, to, promotion });
    }
    return chess.move(t.replace(/0/g, 'O'));
  } catch {
    return null;
  }
}

// Check whether a move would be legal in the current state without applying it.
export function previewMove(s, text) {
  const c = new Chess(s.chess.fen());
  return tryMove(c, text);
}

function startNewGame(s, time) {
  s.history.push({
    game: s.game,
    white: playerName(s, 'w'),
    black: playerName(s, 'b'),
    players: { w: s.players.w, b: s.players.b },
    moves: s.moves,
    result: s.result,
    pgn: toPgn(s),
  });
  s.game += 1;
  s.players = { w: s.players.b, b: s.players.w };
  s.chess = new Chess();
  s.moves = [];
  s.clock = s.room.tc ? { w: s.room.tc.initial, b: s.room.tc.initial } : null;
  s.turnStart = time;
  s.result = null;
  s.drawOffer = null;
  s.rematch = { w: false, b: false };
  system(s, time, `Game ${s.game} started. ${playerName(s, 'w')} has White, ${playerName(s, 'b')} has Black.`, 'started', { g: s.game, white: playerName(s, 'w'), black: playerName(s, 'b') });
}

// Apply one relay event. `ev` = { id, time (server ms), data (parsed JSON) }.
export function applyEvent(s, ev) {
  const d = ev && ev.data;
  if (!d || typeof d !== 'object' || typeof d.type !== 'string') return;
  const T = ev.time;
  if (!Number.isFinite(T)) return;
  s.lastEventTime = T;
  const pid = cleanText(d.id, ID_MAX);
  if (!pid) return;
  const seat = seatOf(s, pid);

  // Game-scoped actions can name the game they're meant for; stale ones are ignored.
  const gameScoped = ['move', 'resign', 'offer-draw', 'accept-draw', 'decline-draw', 'add-time', 'rematch', 'flag'];
  if (gameScoped.includes(d.type) && d.game != null && Number(d.game) !== s.game) return;

  switch (d.type) {
    case 'create': {
      if (s.room) return;
      const color = d.color === 'b' ? 'b' : 'w';
      const tc = parseTimeControl(d.time);
      s.room = { host: pid, tc, createdAt: T };
      s.players[color] = { id: pid, name: cleanText(d.name, NAME_MAX) || 'Host', lang: cleanLang(d.lang), wake: cleanWake(d.wake, d.wakeOn) };
      s.clock = tc ? { w: tc.initial, b: tc.initial } : null;
      system(s, T, `${s.players[color].name} opened the room as ${colorName(color)} (${describeTimeControl(tc)}).`, 'opened', { name: s.players[color].name, color, tc });
      return;
    }
    case 'join': {
      if (!s.room) return;
      const name = cleanText(d.name, NAME_MAX);
      if (seat) {
        if (name && name !== s.players[seat].name) s.players[seat].name = name;
        if (cleanLang(d.lang)) s.players[seat].lang = cleanLang(d.lang);
        if (d.wake !== undefined) s.players[seat].wake = cleanWake(d.wake, d.wakeOn);
        return;
      }
      const free = !s.players.w ? 'w' : !s.players.b ? 'b' : null;
      if (!free) return; // room full: watching needs no event
      s.players[free] = { id: pid, name: name || `Player ${free === 'w' ? 1 : 2}`, lang: cleanLang(d.lang), wake: cleanWake(d.wake, d.wakeOn) };
      s.started = true;
      s.turnStart = T; // White's clock starts once both seats are filled
      system(s, T, `${s.players[free].name} joined as ${colorName(free)}. White to move.`, 'joined', { name: s.players[free].name, color: free });
      return;
    }
    case 'wake': {
      // Set (or clear, with no url) your wake-up hook. Seated players only.
      if (!seat) return;
      s.players[seat].wake = cleanWake(d.url, d.on);
      return;
    }
    case 'move': {
      if (!isActive(s)) return;
      const side = turn(s);
      if (seat !== side) return;
      if (d.ply != null && Number(d.ply) !== s.moves.length) return;
      if (checkFlag(s, T)) return;
      const mv = tryMove(s.chess, d.uci ?? d.move ?? d.san);
      if (!mv) return;
      if (s.clock) {
        const remaining = s.clock[side] - Math.max(0, T - s.turnStart);
        s.clock[side] = Math.max(0, remaining) + s.room.tc.increment;
      }
      s.turnStart = T;
      s.moves.push({
        ply: s.moves.length,
        san: mv.san,
        uci: mv.from + mv.to + (mv.promotion || ''),
        from: mv.from,
        to: mv.to,
        color: side,
        time: T,
        clock: s.clock ? { ...s.clock } : null,
        fen: s.chess.fen(),
      });
      if (s.drawOffer && s.drawOffer !== side) {
        s.drawOffer = null; // moving declines
        system(s, T, `${playerName(s, side)} declined the draw by playing on.`, 'declinedByMoving', { name: playerName(s, side) });
      }
      const c = s.chess;
      if (c.isCheckmate()) finish(s, side, 'checkmate', T, 'checkmate');
      else if (c.isStalemate()) finish(s, null, 'stalemate', T, 'stalemate');
      else if (c.isInsufficientMaterial()) finish(s, null, 'insufficient material', T, 'insufficient');
      else if (c.isThreefoldRepetition()) finish(s, null, 'threefold repetition', T, 'threefold');
      else if (c.isDrawByFiftyMoves()) finish(s, null, 'fifty-move rule', T, 'fifty');
      return;
    }
    case 'resign': {
      if (!isActive(s) || !seat) return;
      if (checkFlag(s, T)) return;
      finish(s, other(seat), `${playerName(s, seat)} resigned`, T, 'resigned', { who: playerName(s, seat) });
      return;
    }
    case 'offer-draw': {
      if (!isActive(s) || !seat) return;
      if (checkFlag(s, T)) return;
      if (s.drawOffer === other(seat)) {
        finish(s, null, 'agreed', T, 'agreed');
      } else if (s.drawOffer !== seat) {
        s.drawOffer = seat;
        system(s, T, `${playerName(s, seat)} offers a draw.`, 'offersDraw', { name: playerName(s, seat) });
      }
      return;
    }
    case 'accept-draw': {
      if (!isActive(s) || !seat || s.drawOffer !== other(seat)) return;
      if (checkFlag(s, T)) return;
      finish(s, null, 'agreed', T, 'agreed');
      return;
    }
    case 'decline-draw': {
      if (!isActive(s) || !seat || s.drawOffer !== other(seat)) return;
      s.drawOffer = null;
      system(s, T, `${playerName(s, seat)} declined the draw.`, 'declinedDraw', { name: playerName(s, seat) });
      return;
    }
    case 'add-time': {
      if (!isActive(s) || !seat || !s.clock) return;
      if (checkFlag(s, T)) return;
      const secs = Math.max(1, Math.min(Number(d.seconds) || 15, 600));
      s.clock[other(seat)] += secs * 1000;
      system(s, T, `${playerName(s, seat)} gave ${playerName(s, other(seat))} ${secs} seconds.`, 'gaveTime', { name: playerName(s, seat), other: playerName(s, other(seat)), n: secs });
      return;
    }
    case 'flag': {
      checkFlag(s, T);
      return;
    }
    case 'rematch': {
      if (!s.result || !seat || s.rematch[seat]) return;
      s.rematch[seat] = true;
      if (s.rematch.w && s.rematch.b) startNewGame(s, T);
      else system(s, T, `${playerName(s, seat)} wants a rematch (colors swap).`, 'rematch', { name: playerName(s, seat) });
      return;
    }
    case 'analysis-request': {
      const g = targetGame(s, d.game);
      const rec = g && gameRecord(s, g);
      if (!rec || !rec.result) return;
      const color = seatIn(rec, pid);
      if (!color) return;
      const a = analysisFor(s, g);
      if (a.requests.some((r) => r.color === color)) return;
      a.requests.push({ color, by: rec.players[color].name, time: T });
      system(s, T, `${rec.players[color].name} asked for a post-game analysis of game ${g}.`, 'askedAnalysis', { name: rec.players[color].name, g });
      return;
    }
    case 'analysis-status': {
      // The analyst says they've started ("working") or finished ("done").
      const g = targetGame(s, d.game);
      const rec = g && gameRecord(s, g);
      if (!rec || !rec.result) return;
      const color = seatIn(rec, pid);
      if (!color) return;
      const state = d.state === 'done' ? 'done' : d.state === 'working' ? 'working' : null;
      if (!state) return;
      const a = analysisFor(s, g);
      const author = rec.players[color].name;
      const prev = a.status && a.status.authorId === pid ? a.status.state : null;
      if (prev === state) return;
      a.status = { state, authorId: pid, author, color, since: (a.status && a.status.since) || T, updated: T };
      if (state === 'working') system(s, T, `${author} started the analysis of game ${g}.`, 'analysisStarted', { name: author, g });
      else {
        const n = noteCount(s, g);
        system(s, T, `${author} finished the analysis of game ${g} (${n} comment${n === 1 ? '' : 's'}).`, 'analysisDone', { name: author, g, n });
      }
      return;
    }
    case 'annotation': {
      const g = targetGame(s, d.game);
      const rec = g && gameRecord(s, g);
      if (!rec || !rec.result) return;
      const color = seatIn(rec, pid);
      if (!color) return;
      const text = cleanText(d.text, NOTE_MAX);
      const a = analysisFor(s, g);
      const author = rec.players[color].name;
      const firstFromAuthor = !a.summaries.some((x) => x.authorId === pid) &&
        !Object.values(a.notes).some((list) => list.some((n) => n.authorId === pid));
      if (d.at == null || /^(summary|game|overall)$/i.test(String(d.at))) {
        if (!text) return;
        a.summaries = a.summaries.filter((x) => x.authorId !== pid);
        a.summaries.push({ authorId: pid, author, color, text, time: T });
      } else {
        const ply = parseAt(d.at);
        if (!ply || ply > rec.moves.length) return;
        const tag = tagKey(d.tag) || 'note';
        let better = null;
        if (typeof d.better === 'string' && d.better.trim()) {
          const c = new Chess(fenBefore(rec, ply));
          const mv = tryMove(c, d.better);
          if (mv) better = { san: mv.san, from: mv.from, to: mv.to };
        }
        if (!text && !better && tag === 'note') return;
        const list = (a.notes[ply] = (a.notes[ply] || []).filter((n) => n.authorId !== pid));
        list.push({ authorId: pid, author, color, ply, tag, text, better, time: T });
      }
      // Posting a comment counts as accepting the request (status "working") unless the
      // analyst already said they're done.
      if (!a.status || (a.status.authorId === pid && a.status.state !== 'done')) {
        if (!a.status) system(s, T, `${author} started the analysis of game ${g}.`, 'analysisStarted', { name: author, g });
        a.status = { state: 'working', authorId: pid, author, color, since: (a.status && a.status.since) || T, updated: T };
      } else if (a.status.authorId === pid) {
        a.status.updated = T;
      } else if (firstFromAuthor) {
        system(s, T, `${author} is annotating game ${g}.`, 'annotating', { name: author, g });
      }
      return;
    }
    case 'chat': {
      const text = cleanText(d.text, CHAT_MAX);
      if (!text) return;
      const from = seat ? playerName(s, seat) : cleanText(d.name, NAME_MAX) || 'Spectator';
      s.feed.push({ time: T, kind: 'chat', text, from, color: seat });
      return;
    }
    default:
      return;
  }
}

export function replay(events) {
  const s = initialState();
  for (const ev of events) applyEvent(s, ev);
  return s;
}

// ---------- post-game analysis ----------

const NOTE_MAX = 1000;

// Annotation tags live in tags.js (shared with puzzles).
export { TAGS };

// "14w" / "14b" / "14..." / "14" (White) -> 1-based ply. Also accepts {at: 27} as a raw ply.
export function parseAt(at) {
  if (typeof at === 'number') return Number.isInteger(at) && at > 0 ? at : null;
  const m = /^\s*(\d+)\s*(\.\.\.|\.|w|white|b|black)?\s*$/i.exec(String(at));
  if (!m) return null;
  const n = Number(m[1]);
  if (n < 1) return null;
  const side = (m[2] || 'w').toLowerCase();
  const black = side === '...' || side === 'b' || side === 'black';
  return (n - 1) * 2 + (black ? 2 : 1);
}

export function plyLabel(ply) {
  const n = Math.ceil(ply / 2);
  return ply % 2 === 1 ? `${n}w` : `${n}b`;
}

// Moves "14. Nf3" / "14... Nf6" for display.
export function moveLabel(ply, san) {
  const n = Math.ceil(ply / 2);
  return ply % 2 === 1 ? `${n}. ${san}` : `${n}... ${san}`;
}

export function gameRecord(s, g) {
  if (g === s.game) return { game: g, players: s.players, moves: s.moves, result: s.result };
  const h = s.history.find((x) => x.game === g);
  return h ? { game: g, players: h.players, moves: h.moves, result: h.result } : null;
}

export const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
export function fenBefore(rec, ply) {
  return ply <= 1 ? START_FEN : rec.moves[ply - 2].fen;
}
export function fenAfter(rec, ply) {
  return ply <= 0 ? START_FEN : rec.moves[ply - 1].fen;
}

function seatIn(rec, id) {
  if (rec.players.w && rec.players.w.id === id) return 'w';
  if (rec.players.b && rec.players.b.id === id) return 'b';
  return null;
}

// Which finished game an analysis message refers to: the one named, else the
// current game if it's over, else the most recent finished one.
function targetGame(s, g) {
  if (g != null && Number.isInteger(Number(g))) return Number(g);
  if (s.result) return s.game;
  return s.history.length ? s.history[s.history.length - 1].game : null;
}

export function analysisFor(s, g) {
  if (!s.analysis[g]) s.analysis[g] = { requests: [], notes: {}, summaries: [], status: null };
  return s.analysis[g];
}

export function noteCount(s, g) {
  const a = s.analysis[g];
  if (!a) return 0;
  return Object.values(a.notes).reduce((n, list) => n + list.length, 0) + a.summaries.length;
}

export function resultString(result) {
  if (!result) return '*';
  return result.winner === 'w' ? '1-0' : result.winner === 'b' ? '0-1' : '1/2-1/2';
}

export function toPgn(s) {
  const c = new Chess();
  for (const m of s.moves) c.move(m.san);
  c.setHeader('Event', 'Agent Chess');
  c.setHeader('Site', 'Agent Chess room');
  if (s.room) c.setHeader('Date', new Date(s.room.createdAt).toISOString().slice(0, 10).replace(/-/g, '.'));
  c.setHeader('Round', String(s.game));
  c.setHeader('White', playerName(s, 'w'));
  c.setHeader('Black', playerName(s, 'b'));
  c.setHeader('Result', resultString(s.result));
  if (s.room) c.setHeader('TimeControl', s.room.tc ? `${s.room.tc.initial / 1000}+${s.room.tc.increment / 1000}` : '-');
  if (s.result) c.setHeader('Termination', s.result.reason);
  let pgn = c.pgn();
  if (!/(1-0|0-1|1\/2-1\/2|\*)\s*$/.test(pgn)) pgn += ` ${resultString(s.result)}`;
  return pgn;
}

export function formatClock(ms) {
  if (ms == null) return '—';
  const t = Math.max(0, ms);
  if (t < 10000) return `0:0${(Math.floor(t / 100) / 10).toFixed(1)}`;
  const total = Math.ceil(t / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const sec = String(total % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`;
}

// Plain-text board for agents and logs. White at the bottom unless flipped.
export function asciiBoard(chess, flip = false) {
  const rows = chess.board();
  const ranks = flip ? [...rows].reverse() : rows;
  const lines = [];
  ranks.forEach((row, i) => {
    const rank = flip ? i + 1 : 8 - i;
    const cells = (flip ? [...row].reverse() : row).map((sq) =>
      sq ? (sq.color === 'w' ? sq.type.toUpperCase() : sq.type) : '.'
    );
    lines.push(`${rank}  ${cells.join(' ')}`);
  });
  lines.push(`   ${(flip ? 'hgfedcba' : 'abcdefgh').split('').join(' ')}`);
  return lines.join('\n');
}

// Shared by the CLI and the page: the room's state as plain text.
export function describeState(s, { me = null, now = null } = {}) {
  const lines = [];
  if (!s.room) return 'This room has not been created (or it expired).';
  const mySeat = seatOf(s, me);
  lines.push(`Game ${s.game} · ${describeTimeControl(s.room.tc)}`);
  lines.push(`White: ${playerName(s, 'w')}${s.players.w ? '' : ' (open seat)'}${mySeat === 'w' ? ' ← you' : ''}`);
  lines.push(`Black: ${playerName(s, 'b')}${s.players.b ? '' : ' (open seat)'}${mySeat === 'b' ? ' ← you' : ''}`);
  lines.push(...languageNotes(s, mySeat));
  const clk = clockAt(s, now);
  if (clk) lines.push(`Clock: White ${formatClock(clk.w)} · Black ${formatClock(clk.b)}`);
  if (!s.started) lines.push('Status: waiting for a second player to join.');
  else if (s.result) lines.push(`Status: game over — ${resultString(s.result)} (${s.result.reason}).`);
  else {
    const t = turn(s);
    let st = `Status: ${colorName(t)} to move`;
    if (mySeat) st += t === mySeat ? ' (your move)' : ' (waiting for opponent)';
    if (s.chess.inCheck()) st += ', in check';
    lines.push(st + '.');
    if (s.drawOffer) {
      lines.push(mySeat && s.drawOffer !== mySeat
        ? `Draw offered by ${colorName(s.drawOffer)}: accept, decline, or just move to decline.`
        : `Draw offered by ${colorName(s.drawOffer)}, waiting for an answer.`);
    }
  }
  lines.push(`FEN: ${s.chess.fen()}`);
  lines.push(`Moves: ${movesText(s) || '(none yet)'}`);
  lines.push('');
  lines.push(asciiBoard(s.chess, mySeat === 'b'));
  return lines.join('\n');
}

// "Language: John reads Spanish (es). Write chat and analysis comments for them in Spanish."
// for every other player whose page isn't in English. Agents use this to pick a language.
export function languageNotes(s, mySeat = null) {
  const out = [];
  for (const c of ['w', 'b']) {
    const p = s.players[c];
    if (!p || !p.lang || p.lang === 'en' || c === mySeat) continue;
    const name = langNameEnglish(p.lang);
    out.push(`Language: ${p.name} reads ${name} (${p.lang}). Write chat messages and analysis comments for them in ${name}.`);
  }
  return out;
}

export function movesText(s) {
  const out = [];
  s.moves.forEach((m, i) => {
    if (m.color === 'w') out.push(`${Math.floor(i / 2) + 1}. ${m.san}`);
    else out.push(i === 0 ? `1... ${m.san}` : m.san);
  });
  return out.join(' ');
}
