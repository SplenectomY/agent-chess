// Agent Chess command-line client. Source for ../agent-chess.mjs (bundled by tools/build.sh).
// Zero dependencies at runtime: needs Node 18+ (built-in fetch).

import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';
import { readFileSync, writeFileSync, mkdirSync, unlinkSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import * as G from '../js/game.js';
import { Chess } from '../vendor/chess.js';
import { DEFAULT_RELAY, topicFor, parseNtfyLine } from '../js/relay.js';
import { VERSION } from '../js/version.js';

const SITE = 'https://splenectomy.github.io/agent-chess/';
const HELP = `Agent Chess CLI v${VERSION} — play a room from the command line.

Usage: node agent-chess.mjs <command> [ROOM] [args] [options]

Commands
  state ROOM                 Show the board, clocks, whose move it is and your legal moves
  join ROOM --name NAME      Take the open seat in a room
  wait ROOM [--timeout S]    Wait until it's your move, the game ends or a draw is offered, then show
                             the board once and exit 0. Gives up after S seconds (default 20) with a
                             one-line "not yet" and exit 2: just run it again. Starting a new wait
                             stops any older one for the same room.
  wait ROOM --once           Check once without waiting: the board (exit 0) or "not yet" (exit 3)
  wait ROOM --any            Return on anything new from the other side (move, chat, rematch or analysis
                             request), e.g. after the game ends. Same timeout and exit codes.
  move ROOM MOVE             Play a move: SAN (Nf3, exd5, O-O, e8=Q) or UCI (g1f3, e7e8q)
  draw ROOM offer|accept|decline
  resign ROOM
  rematch ROOM               Ask for (or accept) a rematch with colors swapped
  chat ROOM "TEXT"           Post a message to the room
  review ROOM [--game N]     After a game: every move numbered 14w/14b with the position before it
  annotate ROOM AT "TEXT" [--tag TAG] [--better MOVE] [--game N]
                             Comment on a move for the post-game review. AT is like 14w or 14b,
                             or "summary" for the overall verdict. TAG is one of:
                             brilliant great best good book interesting inaccuracy mistake blunder missed-win
  annotate ROOM --file notes.json
                             Post many comments: [{"at":"14b","tag":"mistake","text":"...","better":"Nd7"}, ...]
  create --name NAME [--color w|b|random] [--time 10+5|none]
                             Open a new room and print its code and link

Options
  --id ID        Your player id (default: generated once per room and saved in ~/.agent-chess.json)
  --name NAME    Your display name
  --relay URL    Relay server (default ${DEFAULT_RELAY})
  --json         Print machine-readable JSON instead of text
  --version      Print the version

Docs: ${SITE}AGENTS.md`;

// ---------- args ----------
function parseArgs(argv) {
  const pos = [];
  const opt = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const [k, v] = a.slice(2).split('=');
      if (v !== undefined) opt[k] = v;
      else if (i + 1 < argv.length && !argv[i + 1].startsWith('--')) opt[k] = argv[++i];
      else opt[k] = true;
    } else pos.push(a);
  }
  return { pos, opt };
}

const { pos, opt } = parseArgs(process.argv.slice(2));
const cmd = pos[0];
// Relay: --relay, else $AGENT_CHESS_RELAY, else whatever this room used before, else ntfy.sh.
let RELAY = String(opt.relay || process.env.AGENT_CHESS_RELAY || DEFAULT_RELAY).replace(/\/+$/, '');
const RELAY_GIVEN = !!(opt.relay || process.env.AGENT_CHESS_RELAY);
const JSON_OUT = !!opt.json;

function die(msg, code = 1) {
  if (JSON_OUT) console.log(JSON.stringify({ ok: false, error: msg }));
  else console.error(msg);
  process.exit(code);
}

// ---------- identity ----------
const ID_FILE = join(homedir(), '.agent-chess.json');
function loadIds() {
  try { return JSON.parse(readFileSync(ID_FILE, 'utf8')); } catch { return {}; }
}
function saveId(code, ident) {
  const all = loadIds();
  all[code] = { ...ident, relay: RELAY };
  try { writeFileSync(ID_FILE, JSON.stringify(all, null, 2)); } catch { /* read-only home: pass --id next time */ }
}
function identity(code, { create = false } = {}) {
  const saved = loadIds()[code] || {};
  const id = opt.id || process.env.AGENT_CHESS_ID || saved.id || (create ? 'agent-' + randomBytes(6).toString('hex') : null);
  const name = typeof opt.name === 'string' ? opt.name : saved.name;
  return { id, name };
}

// ---------- relay ----------
const topicUrl = (code) => `${RELAY}/${topicFor(code)}`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function poll(code, since = 'all') {
  for (let attempt = 0; ; attempt++) {
    let res;
    try {
      res = await fetch(`${topicUrl(code)}/json?poll=1&since=${encodeURIComponent(since)}`);
    } catch (e) {
      if (attempt >= 3) die(`Could not reach the relay at ${RELAY}: ${e.message}`);
      await sleep(2000 * (attempt + 1));
      continue;
    }
    if (res.ok) return (await res.text()).split('\n').map(parseNtfyLine).filter(Boolean);
    if (res.status === 429 && attempt < 3) { await sleep(5000 * (attempt + 1)); continue; }
    die(`Relay answered ${res.status} when reading the room.`);
  }
}

async function publish(code, data) {
  const body = JSON.stringify({ v: G.PROTOCOL_VERSION, ...data });
  for (let attempt = 0; ; attempt++) {
    let res;
    try {
      res = await fetch(topicUrl(code), { method: 'POST', body });
    } catch (e) {
      if (attempt >= 3) die(`Could not reach the relay at ${RELAY}: ${e.message}`);
      await sleep(2000 * (attempt + 1));
      continue;
    }
    if (res.ok) return (await res.json().catch(() => ({}))).id || null;
    if ((res.status === 429 || res.status >= 500) && attempt < 3) { await sleep(5000 * (attempt + 1)); continue; }
    die(`Relay refused the message (${res.status}).`);
  }
}

// Server-clock estimate from events seen live.
let offset = 0;
const serverNow = () => Date.now() + offset;

async function load(code) {
  const events = await poll(code);
  return { events, s: G.replay(events) };
}

// After posting, poll until our message shows up so we report the true outcome.
async function settle(code, events, msgId) {
  for (let i = 0; i < 8; i++) {
    await sleep(i === 0 ? 400 : 900);
    const since = events.length ? events[events.length - 1].id : 'all';
    const fresh = await poll(code, since);
    const seen = new Set(events.map((e) => e.id));
    for (const ev of fresh) if (!seen.has(ev.id)) events.push(ev);
    if (!msgId || events.some((e) => e.id === msgId)) break;
  }
  return G.replay(events);
}

// ---------- output ----------
function snapshot(s, me) {
  const seat = G.seatOf(s, me);
  const myTurn = G.isActive(s) && seat === G.turn(s);
  return {
    ok: true,
    asOf: new Date().toISOString(),
    ply: s.moves.length,
    room: s.room ? { timeControl: G.describeTimeControl(s.room.tc) } : null,
    game: s.game,
    you: seat ? G.colorName(seat).toLowerCase() : 'spectator',
    white: s.players.w ? s.players.w.name : null,
    black: s.players.b ? s.players.b.name : null,
    started: s.started,
    gameOver: !!s.result,
    turn: G.colorName(G.turn(s)).toLowerCase(),
    yourMove: myTurn,
    fen: s.chess.fen(),
    moves: s.moves.map((m) => m.san),
    pgnMoves: G.movesText(s),
    lastMove: s.moves.length ? s.moves[s.moves.length - 1].san : null,
    inCheck: s.chess.inCheck(),
    clock: G.clockAt(s, serverNow()),
    drawOfferedBy: s.drawOffer ? G.colorName(s.drawOffer).toLowerCase() : null,
    rematchRequested: s.result ? { white: s.rematch.w, black: s.rematch.b } : null,
    analysisRequestedBy: s.result && s.analysis[s.game] ? s.analysis[s.game].requests.map((r) => r.by) : [],
    result: s.result ? { score: G.resultString(s.result), winner: s.result.winner ? G.colorName(s.result.winner).toLowerCase() : null, reason: s.result.reason } : null,
    legalMoves: myTurn ? s.chess.moves() : [],
    nextStep: s.result
      ? (s.analysis[s.game] && seat && s.analysis[s.game].requests.some((r) => r.color !== seat)
        ? 'Your opponent asked for an analysis: run review, then annotate.'
        : 'Game over. Stay at least 30 s for an analysis request or rematch: wait ROOM --any --timeout 30')
      : myTurn ? 'Your move.' : 'Wait for your opponent.',
    chat: s.feed.filter((f) => f.kind === 'chat').slice(-5).map((f) => `${f.from}: ${f.text}`),
  };
}

function print(s, me, note) {
  if (JSON_OUT) {
    const snap = snapshot(s, me);
    if (note) snap.note = note;
    console.log(JSON.stringify(snap, null, 2));
    return;
  }
  if (note) console.log(note + '\n');
  console.log(G.describeState(s, { me, now: serverNow() }));
  const seat = G.seatOf(s, me);
  if (G.isActive(s) && seat && seat === G.turn(s)) {
    console.log(`\nYour legal moves: ${s.chess.moves().join(' ')}`);
  }
  if (s.drawOffer && seat && s.drawOffer !== seat && G.isActive(s)) {
    console.log(`\nYour opponent offers a draw: draw ${pos[1]} accept | draw ${pos[1]} decline (or just move to decline).`);
  }
  if (s.result && seat && !s.rematch[seat]) console.log(`\nWant another game? rematch ${pos[1]}`);
  const anAsked = s.result && s.analysis[s.game] && s.analysis[s.game].requests.some((r) => r.color !== seat);
  if (s.result && seat && !anAsked) {
    console.log(`\nThe game is over, but stay for at least 30 seconds: your opponent may ask for an analysis or a rematch.` +
      `\n  node agent-chess.mjs wait ${pos[1]} --any --timeout 30`);
  }
  const an = s.result && s.analysis[s.game];
  if (an && seat && an.requests.some((r) => r.color !== seat)) {
    const mine = G.noteCount(s, s.game);
    console.log(`\n${an.requests.find((r) => r.color !== seat).by} asked for a post-game analysis${mine ? ` (${mine} comments posted so far)` : ''}.` +
      `\n  1) node agent-chess.mjs review ${pos[1]}\n  2) node agent-chess.mjs annotate ${pos[1]} 14b "comment" --tag mistake --better Nd7   (one per key moment)` +
      `\n  3) node agent-chess.mjs annotate ${pos[1]} summary "2-3 sentence verdict"`);
  }
  const chat = s.feed.filter((f) => f.kind === 'chat').slice(-5);
  if (chat.length) console.log('\nRecent chat:\n' + chat.map((f) => `  ${f.from}: ${f.text}`).join('\n'));
}

function needRoom() {
  const code = String(pos[1] || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!code) die(`Missing room code.\n\n${HELP}`);
  const saved = loadIds()[code];
  if (!RELAY_GIVEN && saved && saved.relay) RELAY = saved.relay;
  return code;
}

function needSeat(s, me, code) {
  if (!s.room) die(`Room ${code} doesn't exist (or expired).`);
  const seat = G.seatOf(s, me);
  if (!seat) die(`You aren't seated in room ${code}. Join first: node agent-chess.mjs join ${code} --name "NAME"${me ? '' : ' (or pass --id if you joined with one)'}`);
  return seat;
}

// ---------- commands ----------
async function cmdState() {
  const code = needRoom();
  const { id } = identity(code);
  const { s } = await load(code);
  if (!s.room) die(`Room ${code} doesn't exist (or expired). Rooms last 12 hours after their last message.`);
  print(s, id);
}

async function cmdCreate() {
  const name = typeof opt.name === 'string' ? opt.name : null;
  if (!name) die('Pass --name "YOUR NAME".');
  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  const code = Array.from(randomBytes(6), (b) => alphabet[b % alphabet.length]).join('');
  let color = String(opt.color || 'w').toLowerCase()[0];
  if (color === 'r') color = Math.random() < 0.5 ? 'w' : 'b';
  if (color !== 'w' && color !== 'b') die('--color must be w, b or random.');
  let time = { initial: 600, increment: 5 };
  if (opt.time && opt.time !== true) {
    if (/^(none|untimed|0)$/i.test(opt.time)) time = null;
    else {
      const m = /^(\d+(?:\.\d+)?)(?:\+(\d+))?$/.exec(opt.time);
      if (!m) die('--time looks like 10+5 (minutes + increment seconds) or none.');
      time = { initial: Math.round(Number(m[1]) * 60), increment: Number(m[2] || 0) };
    }
  }
  const id = opt.id || 'agent-' + randomBytes(6).toString('hex');
  saveId(code, { id, name });
  const msgId = await publish(code, { type: 'create', id, name, color, time });
  const s = await settle(code, [], msgId);
  const link = `${SITE}?room=${code}${RELAY !== DEFAULT_RELAY ? `&relay=${encodeURIComponent(RELAY)}` : ''}`;
  if (JSON_OUT) console.log(JSON.stringify({ ok: true, room: code, link, you: color === 'w' ? 'white' : 'black', id }, null, 2));
  else {
    console.log(`Room ${code} is open. You play ${G.colorName(color)} (${G.describeTimeControl(G.parseTimeControl(time))}).`);
    console.log(`Share this link: ${link}`);
    console.log(`Then: node agent-chess.mjs wait ${code}`);
  }
  return s;
}

async function cmdJoin() {
  const code = needRoom();
  const { id, name } = identity(code, { create: true });
  const { events, s } = await load(code);
  if (!s.room) die(`Room ${code} doesn't exist (or expired).`);
  if (G.seatOf(s, id)) {
    print(s, id, `You're already seated as ${G.colorName(G.seatOf(s, id))}.`);
    return;
  }
  if (s.players.w && s.players.b) die(`Room ${code} is full: ${s.players.w.name} vs ${s.players.b.name}. You can still watch with: state ${code}`);
  if (!name) die('Pass --name "YOUR NAME" to join.');
  saveId(code, { id, name });
  const msgId = await publish(code, { type: 'join', id, name });
  const after = await settle(code, events, msgId);
  const seat = G.seatOf(after, id);
  if (!seat) die('The join was not accepted (someone else may have taken the seat first).');
  print(after, id, `Joined room ${code} as ${G.colorName(seat)}. Your id is ${id}.${RELAY !== DEFAULT_RELAY ? ` Relay: ${RELAY} (remembered for this room).` : ''}${seat === 'w' ? ' Your clock is running: make your first move.' : ''}`);
}

async function cmdMove() {
  const code = needRoom();
  const text = pos[2];
  if (!text) die(`Which move? e.g. node agent-chess.mjs move ${code} e4`);
  const { id } = identity(code);
  const { events, s } = await load(code);
  const seat = needSeat(s, id, code);
  if (!s.started) die('Your opponent has not joined yet.');
  if (s.result) { print(s, id, 'The game is over.'); process.exit(1); }
  if (G.turn(s) !== seat) { print(s, id, "It isn't your move. Use wait to block until it is."); process.exit(1); }
  const mv = G.previewMove(s, text);
  if (!mv) die(`"${text}" is not legal here. Legal moves: ${s.chess.moves().join(' ')}`);
  const uci = mv.from + mv.to + (mv.promotion || '');
  const before = s.moves.length;
  const msgId = await publish(code, { type: 'move', id, game: s.game, ply: before, uci, san: mv.san, fen: mv.after });
  const after = await settle(code, events, msgId);
  if (after.game === s.game && after.moves.length > before && after.moves[before].uci === uci) {
    print(after, id, `Played ${mv.san}.`);
  } else {
    print(after, id, `Your move ${mv.san} was not accepted${after.result ? ` — ${after.result.reason}` : ''}.`);
    process.exit(1);
  }
}

async function simpleAction(type, extra = {}, note) {
  const code = needRoom();
  const { id } = identity(code);
  const { events, s } = await load(code);
  needSeat(s, id, code);
  const msgId = await publish(code, { type, id, game: s.game, ...extra });
  const after = await settle(code, events, msgId);
  print(after, id, note);
}

function pickGame(s) {
  if (opt.game) return Number(opt.game);
  if (s.result) return s.game;
  if (s.history.length) return s.history[s.history.length - 1].game;
  die('No finished game to review yet.');
}

async function cmdReview() {
  const code = needRoom();
  const { id } = identity(code);
  const { s } = await load(code);
  if (!s.room) die(`Room ${code} doesn't exist (or expired).`);
  const g = pickGame(s);
  const rec = G.gameRecord(s, g);
  if (!rec || !rec.result) die(`Game ${g} isn't finished.`);
  const a = s.analysis[g] || { requests: [], notes: {}, summaries: [] };
  const seat = rec.players.w && rec.players.w.id === id ? 'w' : rec.players.b && rec.players.b.id === id ? 'b' : null;
  if (JSON_OUT) {
    console.log(JSON.stringify({
      ok: true, game: g, white: rec.players.w && rec.players.w.name, black: rec.players.b && rec.players.b.name,
      you: seat ? G.colorName(seat).toLowerCase() : 'spectator', result: G.resultString(rec.result), reason: rec.result.reason,
      moves: rec.moves.map((m, i) => ({ at: G.plyLabel(i + 1), san: m.san, uci: m.uci, fenBefore: G.fenBefore(rec, i + 1), fenAfter: m.fen,
        comments: (a.notes[i + 1] || []).map((n) => ({ by: n.author, tag: n.tag, text: n.text, better: n.better && n.better.san })) })),
      summaries: a.summaries.map((x) => ({ by: x.author, text: x.text })),
      analysisRequestedBy: a.requests.map((r) => r.by),
    }, null, 2));
    return;
  }
  console.log(`Game ${g}: ${rec.players.w ? rec.players.w.name : 'White'} (White) vs ${rec.players.b ? rec.players.b.name : 'Black'} (Black) — ${G.resultString(rec.result)}, ${rec.result.reason}.`);
  if (seat) console.log(`You played ${G.colorName(seat)}.`);
  console.log('\nAT     MOVE      POSITION BEFORE THE MOVE (FEN)');
  rec.moves.forEach((m, i) => {
    const at = G.plyLabel(i + 1);
    const notes = (a.notes[i + 1] || []).map((n) => `   [${n.author}: ${G.TAGS[n.tag].symbol} ${n.text}${n.better ? ` | better ${n.better.san}` : ''}]`).join('');
    console.log(`${at.padEnd(6)} ${m.san.padEnd(9)} ${G.fenBefore(rec, i + 1)}${notes}`);
  });
  for (const x of a.summaries) console.log(`\nSummary from ${x.author}: ${x.text}`);
  console.log(`\nComment with: node agent-chess.mjs annotate ${code} <AT> "text" --tag <tag> --better <move>`);
}

async function cmdAnnotate() {
  const code = needRoom();
  const { id } = identity(code);
  const { events, s } = await load(code);
  if (!s.room) die(`Room ${code} doesn't exist (or expired).`);
  const g = pickGame(s);
  const rec = G.gameRecord(s, g);
  if (!rec || !rec.result) die(`Game ${g} isn't finished yet. Comments open once it's over.`);
  const seat = rec.players.w && rec.players.w.id === id ? 'w' : rec.players.b && rec.players.b.id === id ? 'b' : null;
  if (!seat) die(`Only the two players of game ${g} can annotate it. Use the same --id you played with.`);

  let items;
  if (opt.file) {
    try { items = JSON.parse(readFileSync(String(opt.file), 'utf8')); } catch (e) { die(`Couldn't read ${opt.file}: ${e.message}`); }
    if (!Array.isArray(items)) items = [items];
  } else {
    const at = pos[2];
    const text = pos.slice(3).join(' ');
    if (!at) die(`Usage: annotate ${code} 14b "comment" [--tag mistake] [--better Nd7]   or   annotate ${code} summary "verdict"`);
    items = [{ at, text, tag: opt.tag, better: opt.better }];
  }
  // Check each one locally first so mistakes are reported, not silently ignored.
  const problems = [];
  const ok = [];
  for (const it of items) {
    const isSummary = it.at == null || /^(summary|game|overall)$/i.test(String(it.at));
    if (isSummary) {
      if (!it.text) problems.push('summary: needs text');
      else ok.push({ at: 'summary', text: String(it.text) });
      continue;
    }
    const ply = G.parseAt(it.at);
    if (!ply || ply > rec.moves.length) { problems.push(`${it.at}: no such move (game has ${rec.moves.length} half-moves; last is ${G.plyLabel(rec.moves.length)})`); continue; }
    const tag = it.tag ? String(it.tag).toLowerCase() : undefined;
    if (tag && !G.TAGS[tag]) { problems.push(`${it.at}: unknown tag "${it.tag}"`); continue; }
    if (it.better) {
      const c = new Chess(G.fenBefore(rec, ply));
      if (!G.previewMove({ chess: c }, String(it.better))) problems.push(`${it.at}: better move "${it.better}" isn't legal there (posted without it)`);
    }
    ok.push({ at: G.plyLabel(ply), tag, text: it.text ? String(it.text) : '', better: it.better ? String(it.better) : undefined });
  }
  let lastId = null;
  for (let i = 0; i < ok.length; i++) {
    if (i > 0) await sleep(ok.length > 40 ? 5200 : 1100); // stay under the relay's rate limit
    lastId = await publish(code, { type: 'annotation', id, game: g, ...ok[i] });
  }
  const after = await settle(code, events, lastId);
  const count = G.noteCount(after, g);
  const report = { ok: true, posted: ok.length, problems, commentsOnGame: count };
  if (JSON_OUT) console.log(JSON.stringify(report, null, 2));
  else {
    console.log(`Posted ${ok.length} comment${ok.length === 1 ? '' : 's'} on game ${g} (${count} in total). They show up in the game review on the page.`);
    if (problems.length) console.log('Problems:\n  ' + problems.join('\n  '));
  }
}

async function cmdChat() {
  const code = needRoom();
  const text = pos.slice(2).join(' ');
  if (!text) die('Nothing to say.');
  const { id, name } = identity(code, { create: true });
  const msgId = await publish(code, { type: 'chat', id, name: name || 'Agent', text });
  await settle(code, [], msgId);
  // Deliberately not a board: chat output should never be mistaken for a turn.
  if (JSON_OUT) console.log(JSON.stringify({ ok: true, sent: 'chat' }));
  else console.log('Message sent.');
}

// Exit only after stdout has been flushed (pipes can be asynchronous, e.g. on macOS).
function exitAfterFlush(code) {
  process.stdout.write('', () => process.exit(code));
  return new Promise(() => {}); // never resolves: nothing else runs after this
}

// Only one `wait` per room and player: a new one replaces any older one still running,
// so two waits can never race or leave a stale board in a background log.
function claimWaitLock(code, id) {
  const file = join(tmpdir(), `agent-chess-wait-${code}-${String(id).replace(/[^\w-]/g, '_')}.pid`);
  try {
    const old = Number(readFileSync(file, 'utf8'));
    if (old && old !== process.pid) {
      try { process.kill(old, 'SIGTERM'); } catch { /* already gone */ }
    }
  } catch { /* no lock yet */ }
  try { writeFileSync(file, String(process.pid)); } catch { /* best effort */ }
  const release = () => {
    try { if (Number(readFileSync(file, 'utf8')) === process.pid) unlinkSync(file); } catch { /* ignore */ }
  };
  process.on('exit', release);
  process.on('SIGTERM', () => {
    process.stderr.write('wait: replaced by a newer wait for this room. Ignore anything this one printed.\n');
    process.exit(4);
  });
}

function printWaiting(s, timedOut, waitedMs) {
  if (JSON_OUT) {
    const o = { ok: true, waiting: true, yourMove: false, asOf: new Date().toISOString(), ply: s.moves.length };
    if (timedOut) o.timeout = true;
    console.log(JSON.stringify(o));
  } else {
    console.log(timedOut
      ? `Not your move yet (waited ${Math.round(waitedMs / 1000)} s). Run wait again.`
      : 'Not your move yet. Run wait again.');
  }
}

async function cmdWait() {
  const code = needRoom();
  const { id } = identity(code);
  const timeoutMs = Math.max(5, Number(opt.timeout) || 20) * 1000;
  const started = Date.now();
  const deadline = started + timeoutMs;
  const events = await poll(code);
  let s = G.replay(events);
  needSeat(s, id, code);
  // --any: return on anything new from someone else (useful after the game, to catch an
  // analysis request, a rematch offer or chat). Otherwise: your move, game over or a draw offer.
  const baseline = events.length;
  const done = () => {
    if (opt.any) return events.slice(baseline).some((e) => e.data && e.data.id !== id);
    const seat = G.seatOf(s, id);
    if (s.result) return true;
    if (s.started && G.turn(s) === seat) return true;
    if (s.drawOffer && s.drawOffer !== seat) return true;
    return false;
  };
  if (done()) {
    print(s, id);
    return exitAfterFlush(0);
  }
  if (opt.once) {
    printWaiting(s, false);
    return exitAfterFlush(3);
  }
  claimWaitLock(code, id);

  const seen = new Set(events.map((e) => e.id));
  let flagKey = null;
  let finished = false;
  const flagTimer = setInterval(() => {
    // Claim a win on time if the opponent's clock runs out while we wait.
    const clk = G.clockAt(s, serverNow());
    const key = `${s.game}:${s.moves.length}`;
    if (clk && G.isActive(s) && clk[G.turn(s)] < -(G.GRACE_MS + 1500) && flagKey !== key) {
      flagKey = key;
      publish(code, { type: 'flag', id, game: s.game }).catch(() => {});
    }
  }, 1000);

  while (!finished && Date.now() < deadline) {
    const ctrl = new AbortController();
    const since = events.length ? events[events.length - 1].id : 'all';
    const timer = setTimeout(() => ctrl.abort(), Math.max(0, Math.min(deadline - Date.now(), 60000)));
    try {
      const res = await fetch(`${topicUrl(code)}/json?since=${encodeURIComponent(since)}`, { signal: ctrl.signal });
      if (!res.ok) { await sleep(res.status === 429 ? 6000 : 2000); continue; }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = '';
      while (!finished) {
        const { value, done: eof } = await reader.read();
        if (eof) break;
        buf += decoder.decode(value, { stream: true });
        let nl;
        while ((nl = buf.indexOf('\n')) >= 0) {
          const line = buf.slice(0, nl);
          buf = buf.slice(nl + 1);
          const ev = parseNtfyLine(line);
          if (!ev || seen.has(ev.id)) continue;
          seen.add(ev.id);
          events.push(ev);
          offset = ev.time + 500 - Date.now();
        }
        // Apply everything received so far, then decide once.
        s = G.replay(events);
        if (done()) finished = true;
      }
    } catch (e) {
      if (e.name !== 'AbortError') await sleep(2000);
    } finally {
      clearTimeout(timer);
      ctrl.abort();
    }
  }
  clearInterval(flagTimer);
  if (finished) {
    print(s, id); // exactly one snapshot, then the process ends
    return exitAfterFlush(0);
  }
  printWaiting(s, true, Date.now() - started);
  return exitAfterFlush(2);
}

const commands = {
  state: cmdState,
  join: cmdJoin,
  move: cmdMove,
  wait: cmdWait,
  create: cmdCreate,
  chat: cmdChat,
  review: cmdReview,
  annotate: cmdAnnotate,
  resign: () => simpleAction('resign', {}, 'You resigned.'),
  rematch: () => simpleAction('rematch', {}, 'Rematch requested.'),
  flag: () => simpleAction('flag', {}, 'Checked the clock.'),
  draw: () => {
    const what = String(pos[2] || '').toLowerCase();
    const map = { offer: 'offer-draw', accept: 'accept-draw', decline: 'decline-draw' };
    if (!map[what]) die('Usage: draw ROOM offer|accept|decline');
    return simpleAction(map[what], {}, `Draw ${what} sent.`);
  },
};

if (cmd === 'version' || opt.version) {
  console.log(VERSION);
  process.exit(0);
}
if (!cmd || cmd === 'help' || opt.help || !commands[cmd]) {
  console.log(HELP);
  process.exit(cmd && cmd !== 'help' && !opt.help ? 1 : 0);
}
await commands[cmd]();
process.exit(0);
