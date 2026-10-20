// Agent Chess relay for Cloudflare Workers + Durable Objects. See README.md for how to deploy it.
//
// A small ntfy-compatible server: just the part of ntfy's API that Agent Chess uses, so the site,
// the CLI and agents talk to it exactly as they talk to ntfy.sh.
//
//   POST /<topic>                      store a message (the request body); answers with the stored message
//   GET  /<topic>/json?poll=1&since=…  everything so far, one JSON object per line
//   GET  /<topic>/json?since=…         the same, then stays open and streams new messages (newline JSON)
//   GET  /<topic>/sse?since=…          the same as a text/event-stream
//   GET  /v1/health                    {"healthy":true}
//
// `since` is "all", "latest" (only new messages) or the id of the last message you saw.
// Topics are agentchess-v1-<ROOM>, agentchess-puzzle-v1-<id> and agentchess-lesson-v1-<id>. Each
// topic is one Durable Object, which keeps the messages for CACHE_HOURS after the last one.
//
// Settings (wrangler.toml [vars], and one secret):
//   CREATE_TOKEN  secret. When set, the first message on a new topic (opening a room, storing a
//                 puzzle or lesson) must carry "Authorization: Bearer <token>". Anyone with a room
//                 link can still join, move, chat and annotate. Set it with:
//                 npx wrangler secret put CREATE_TOKEN
//   CACHE_HOURS   how long a topic is kept after its last message (default 12, like ntfy.sh)
//   IDLE_MINUTES  a stream that has seen nothing new for this long is closed with an "idle" event;
//                 the page then polls every 30 s until something happens, then streams again.
//                 Open tabs would otherwise keep the object active (and use the free plan's
//                 duration allowance) all night. Default 30.
//   MAX_MESSAGES  per topic (default 3000; a long game is about 150)
//   KEEPALIVE_SECONDS  how often a stream gets a keepalive (default 30; clients give up after 75 s)

const TOPIC = /^agentchess-(v1|puzzle-v1|lesson-v1)-[A-Za-z0-9]{1,48}$/;
const MAX_BODY = 4096; // bytes, ntfy's limit too
const ID_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type, Last-Event-ID',
  'Access-Control-Max-Age': '86400',
};

const json = (obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json', ...CORS } });
// ntfy-style errors: {"code":42901,"http":429,"error":"…"}; the page and the CLI show `error`.
const fail = (http, code, error) => json({ code, http, error }, http);
const now = () => Math.floor(Date.now() / 1000);

function newId() {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => ID_CHARS[b % ID_CHARS.length]).join('');
}

// The create token, without the newline a piped `wrangler secret put` can leave on it.
const createToken = (env) => String(env.CREATE_TOKEN || '').trim();

// Constant-time comparison, so the token can't be guessed character by character.
function sameToken(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
    const url = new URL(request.url);
    const parts = url.pathname.split('/').filter(Boolean);
    if (!parts.length) {
      return new Response('Agent Chess relay.\n\nThis is a message relay for https://splenectomy.github.io/agent-chess/. '
        + 'To use it, open the site, choose "Open a room" and paste this address under Relay.\n',
      { headers: { 'Content-Type': 'text/plain; charset=utf-8', ...CORS } });
    }
    if (parts[0] === 'v1' && parts[1] === 'health' && parts.length === 2) {
      // With an Authorization header, also say whether that token is the one that opens rooms
      // here ("ok", "wrong", or "none" when this relay has no token), so the site can check a
      // pasted token before anyone tries to open a room.
      const out = { healthy: true };
      const auth = request.headers.get('Authorization');
      if (auth != null) {
        const want = createToken(env);
        out.token = !want ? 'none' : sameToken(auth.replace(/^Bearer\s+/i, '').trim(), want) ? 'ok' : 'wrong';
      }
      return json(out);
    }
    const topic = parts[0];
    if (!TOPIC.test(topic)) return fail(404, 40401, 'not an Agent Chess topic');
    if (parts.length > 2 || (parts.length === 2 && parts[1] !== 'json' && parts[1] !== 'sse')) return fail(404, 40402, 'not found');
    if (request.method !== 'GET' && request.method !== 'POST') return fail(405, 40501, 'method not allowed');
    return env.ROOMS.get(env.ROOMS.idFromName(topic)).fetch(request);
  },
};

export class Room {
  constructor(state, env) {
    this.state = state;
    this.storage = state.storage;
    this.env = env;
    this.streams = new Set();
    this.loaded = null; // promise: the topic's messages read from storage, once per activation
    this.meta = null; // { seq, last } or null for an empty topic
    this.msgs = [];
  }

  setting(name, dflt) {
    const v = Number(this.env[name]);
    return Number.isFinite(v) && v > 0 ? v : dflt;
  }
  get cacheMs() { return this.setting('CACHE_HOURS', 12) * 3600e3; }
  get idleMs() { return this.setting('IDLE_MINUTES', 30) * 60e3; }
  get keepaliveMs() { return this.setting('KEEPALIVE_SECONDS', 30) * 1000; }

  async fetch(request) {
    const url = new URL(request.url);
    const parts = url.pathname.split('/').filter(Boolean);
    const topic = parts[0];
    await this.load();
    if (request.method === 'POST' && parts.length === 1) return this.post(request, topic);
    if (request.method === 'GET' && (parts[1] === 'json' || parts[1] === 'sse')) return this.read(request, url, topic, parts[1]);
    return fail(405, 40501, 'method not allowed');
  }

  // Load the topic into memory on the object's first request after it wakes up. The object is
  // the only writer, so the copy stays right until it is evicted or the topic expires.
  load() {
    if (!this.loaded) {
      this.loaded = (async () => {
        this.meta = (await this.storage.get('meta')) || null;
        this.msgs = this.meta ? [...(await this.storage.list({ prefix: 'm:' })).values()] : [];
        if (this.meta && this.expired()) await this.clear();
      })().catch((e) => { this.loaded = null; throw e; }); // try again on the next request
    }
    return this.loaded;
  }

  expired() { return !this.meta || Date.now() - this.meta.last * 1000 >= this.cacheMs; }

  async clear() {
    for (const s of this.streams) s.end();
    await this.storage.deleteAll();
    this.meta = null;
    this.msgs = [];
  }

  async post(request, topic) {
    const body = await request.text();
    if (!body.length) return fail(400, 40001, 'empty message');
    if (new TextEncoder().encode(body).length > MAX_BODY) return fail(413, 41301, `message too long (max ${MAX_BODY} bytes)`);
    if (!this.meta) {
      // A new topic. With CREATE_TOKEN set, only someone with the token can open one; after that,
      // anyone with the link can post, the same as on ntfy.sh.
      const want = createToken(this.env);
      if (want) {
        const got = (request.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '').trim();
        if (!got || !sameToken(got, want)) return fail(401, 40101, 'this relay needs its token to open a room or store a puzzle (Authorization: Bearer …)');
      }
      this.meta = { seq: 0, last: 0 };
    }
    if (this.msgs.length >= this.setting('MAX_MESSAGES', 3000)) return fail(429, 42901, 'limit reached: this room has too many messages');
    const time = now();
    const msg = { id: newId(), time, expires: time + Math.floor(this.cacheMs / 1000), event: 'message', topic, message: body };
    this.meta = { seq: this.meta.seq + 1, last: time };
    this.msgs.push(msg);
    await this.storage.put({ [`m:${String(this.meta.seq).padStart(8, '0')}`]: msg, meta: this.meta });
    // The whole topic is dropped CACHE_HOURS after its last message (see alarm()).
    await this.storage.setAlarm(Date.now() + this.cacheMs + 1000);
    for (const s of this.streams) s.send(msg);
    return json(msg);
  }

  async alarm() {
    await this.load();
    if (!this.meta) return;
    if (this.expired()) { await this.clear(); return; }
    await this.storage.setAlarm(this.meta.last * 1000 + this.cacheMs + 1000);
  }

  read(request, url, topic, kind) {
    const since = url.searchParams.get('since') || request.headers.get('Last-Event-ID') || 'all';
    let backlog = this.msgs;
    if (since === 'latest') backlog = [];
    else if (since !== 'all') {
      // Unknown id (from another relay, or expired): send everything, the clients skip repeats.
      const i = backlog.findIndex((m) => m.id === since);
      if (i >= 0) backlog = backlog.slice(i + 1);
    }
    const sse = kind === 'sse';
    const fmt = (obj) => (sse ? `event: ${obj.event}\n${obj.id ? `id: ${obj.id}\n` : ''}data: ${JSON.stringify(obj)}\n\n` : `${JSON.stringify(obj)}\n`);
    const headers = { 'Content-Type': sse ? 'text/event-stream' : 'application/x-ndjson', 'Cache-Control': 'no-cache', ...CORS };
    if (url.searchParams.get('poll') === '1') return new Response(backlog.map(fmt).join(''), { headers });

    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();
    const enc = new TextEncoder();
    const stream = {
      lastNews: Date.now(), // when this stream last had a message to deliver
      timer: null,
      send: (obj) => {
        if (obj.event === 'message') stream.lastNews = Date.now();
        // A failed write means the client has gone.
        writer.write(enc.encode(fmt(obj))).catch(() => stream.end());
      },
      end: () => {
        clearInterval(stream.timer);
        this.streams.delete(stream);
        writer.close().catch(() => {});
      },
    };
    this.streams.add(stream);
    stream.send({ id: newId(), time: now(), event: 'open', topic });
    for (const m of backlog) stream.send(m);
    stream.lastNews = Date.now();
    stream.timer = setInterval(() => {
      if (Date.now() - stream.lastNews >= this.idleMs) {
        // Nothing has happened for a while: let the client go and poll instead.
        stream.send({ time: now(), event: 'idle', topic });
        stream.end();
      } else {
        stream.send({ time: now(), event: 'keepalive', topic });
      }
    }, this.keepaliveMs);
    return new Response(readable, { headers });
  }
}
