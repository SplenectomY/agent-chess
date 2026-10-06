// Relay transport: an ntfy server (https://ntfy.sh by default) used as a
// public append-only message log. Each room is one topic. No accounts needed.

export const DEFAULT_RELAY = 'https://ntfy.sh';
export const TOPIC_PREFIX = 'agentchess-v1-';

export const topicFor = (code) => TOPIC_PREFIX + code.toUpperCase();

export function parseNtfyLine(line) {
  if (!line || !line.trim()) return null;
  let msg;
  try {
    msg = JSON.parse(line);
  } catch {
    return null;
  }
  return parseNtfyMessage(msg);
}

export function parseNtfyMessage(msg) {
  if (!msg || msg.event !== 'message' || typeof msg.message !== 'string') return null;
  let data;
  try {
    data = JSON.parse(msg.message);
  } catch {
    return null;
  }
  return { id: msg.id, time: msg.time * 1000, data };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// If the stream hasn't echoed one of our own messages within this long, assume
// it's stuck (buffering proxy, embedded browser) and poll instead.
const ECHO_TIMEOUT_MS = 4000;
const POLL_INTERVAL_MS = 5000; // ntfy.sh refills one request every 5 s per visitor
const STREAM_SILENCE_MS = 75000; // ntfy sends a keepalive every 45 s

export class Relay {
  constructor({ base = DEFAULT_RELAY, code, onEvent, onStatus }) {
    this.base = base.replace(/\/+$/, '');
    this.topic = topicFor(code);
    this.onEvent = onEvent;
    this.onStatus = onStatus || (() => {});
    this.seen = new Set();
    // Read cursor. Only advanced by in-order sources (polls and the stream), never by
    // our own POST replies, so a poll can't skip a message we haven't seen yet.
    this.lastId = null;
    this.es = null;
    this.closed = false;
    this.catchupTimer = null;
    this.watchdog = null;
    this.pollTimer = null; // set while in polling fallback
    this.streamIds = new Set(); // ids that actually arrived over the stream
    this.lastStreamActivity = 0;
    this.polling = false;
  }

  get url() {
    return `${this.base}/${this.topic}`;
  }

  _deliver(ev, live, { advance = true } = {}) {
    if (!ev) return;
    if (advance) this.lastId = ev.id;
    if (this.seen.has(ev.id)) return;
    this.seen.add(ev.id);
    this.onEvent(ev, live);
  }

  get mode() {
    return this.pollTimer ? 'polling' : 'live';
  }

  // Fetch everything cached on the topic (rooms live ~12h on ntfy.sh).
  async poll(since = 'all') {
    const res = await fetch(`${this.url}/json?poll=1&since=${encodeURIComponent(since)}`, { cache: 'no-store' });
    if (!res.ok) throw new Error(`Relay answered ${res.status}`);
    const text = await res.text();
    const events = text.split('\n').map(parseNtfyLine).filter(Boolean);
    return events;
  }

  async start() {
    this.onStatus('connecting');
    const history = await this.poll('all');
    for (const ev of history) this._deliver(ev, false);
    this._openStream();
    // Safety net in case the stream silently drops a message.
    this.catchupTimer = setInterval(() => this.catchUp(), 45000);
    // Reopen a stream that has gone completely quiet (not even keepalives).
    this.watchdog = setInterval(() => {
      if (this.es && Date.now() - this.lastStreamActivity > STREAM_SILENCE_MS) this._reopenStream();
    }, 15000);
    return history.length;
  }

  async catchUp() {
    if (this.closed || this.polling || (typeof document !== 'undefined' && document.hidden)) return;
    this.polling = true;
    try {
      const evs = await this.poll(this.lastId || 'all');
      for (const ev of evs) this._deliver(ev, true);
    } catch {
      /* next time */
    } finally {
      this.polling = false;
    }
  }

  _startPolling() {
    if (this.pollTimer || this.closed) return;
    this.pollTimer = setInterval(() => this.catchUp(), POLL_INTERVAL_MS);
    this.onStatus('polling');
    this.catchUp();
    this._reopenStream(); // and keep trying the stream in the background
  }

  _stopPolling() {
    if (!this.pollTimer) return;
    clearInterval(this.pollTimer);
    this.pollTimer = null;
    this.onStatus('live');
  }

  _reopenStream() {
    if (this.es) this.es.close();
    this.es = null;
    this._openStream();
  }

  _openStream() {
    if (this.closed) return;
    const since = this.lastId || 'all';
    const es = new EventSource(`${this.url}/sse?since=${encodeURIComponent(since)}`);
    this.es = es;
    this.lastStreamActivity = Date.now();
    const alive = () => (this.lastStreamActivity = Date.now());
    es.onopen = () => {
      alive();
      if (!this.pollTimer) this.onStatus('live');
    };
    es.addEventListener('open', alive);
    es.addEventListener('keepalive', alive);
    es.onmessage = (e) => {
      alive();
      const ev = parseNtfyLine(e.data);
      if (!ev) return;
      this.streamIds.add(ev.id);
      // A message arriving over the stream proves it works again.
      if (this.pollTimer) this._stopPolling();
      this._deliver(ev, true);
    };
    es.onerror = () => {
      if (!this.pollTimer) this.onStatus('reconnecting');
      // Reopen from the last message we saw rather than the original URL.
      es.close();
      if (this.es === es) {
        setTimeout(() => {
          if (this.es === es) {
            this.catchUp();
            this._openStream();
          }
        }, 3000);
      }
    };
  }

  async publish(data) {
    const body = JSON.stringify(data);
    let delay = 1500;
    for (let attempt = 0; attempt < 4; attempt++) {
      let res = null;
      try {
        res = await fetch(this.url, { method: 'POST', body });
      } catch (err) {
        if (attempt === 3) throw new Error('Could not reach the relay. Check your connection.');
      }
      if (res && res.ok) {
        // ntfy answers with the stored message. Apply it now instead of waiting for
        // the stream to echo it, so our own actions never depend on the stream.
        let ev = null;
        try { ev = parseNtfyMessage(await res.json()); } catch { /* older relay: fall back to the echo */ }
        if (ev) {
          this._deliver(ev, true, { advance: false });
          setTimeout(() => {
            if (!this.closed && !this.streamIds.has(ev.id) && !this.pollTimer) this._startPolling();
          }, ECHO_TIMEOUT_MS);
        }
        return true;
      }
      if (res && res.status !== 429 && res.status < 500) throw new Error(`Relay refused the message (${res.status}).`);
      await sleep(delay);
      delay *= 2;
    }
    throw new Error('Relay is busy. Try again in a few seconds.');
  }

  close() {
    this.closed = true;
    clearInterval(this.catchupTimer);
    clearInterval(this.watchdog);
    clearInterval(this.pollTimer);
    if (this.es) this.es.close();
    this.es = null;
  }
}
