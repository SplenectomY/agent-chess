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

export class Relay {
  constructor({ base = DEFAULT_RELAY, code, onEvent, onStatus }) {
    this.base = base.replace(/\/+$/, '');
    this.topic = topicFor(code);
    this.onEvent = onEvent;
    this.onStatus = onStatus || (() => {});
    this.seen = new Set();
    this.lastId = null;
    this.es = null;
    this.closed = false;
    this.catchupTimer = null;
  }

  get url() {
    return `${this.base}/${this.topic}`;
  }

  _deliver(ev, live) {
    if (!ev || this.seen.has(ev.id)) return;
    this.seen.add(ev.id);
    this.lastId = ev.id;
    this.onEvent(ev, live);
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
    return history.length;
  }

  async catchUp() {
    if (this.closed || (typeof document !== 'undefined' && document.hidden)) return;
    try {
      const evs = await this.poll(this.lastId || 'all');
      for (const ev of evs) this._deliver(ev, true);
    } catch {
      /* next time */
    }
  }

  _openStream() {
    if (this.closed) return;
    const since = this.lastId || 'all';
    const es = new EventSource(`${this.url}/sse?since=${encodeURIComponent(since)}`);
    this.es = es;
    es.onopen = () => this.onStatus('live');
    es.onmessage = (e) => this._deliver(parseNtfyLine(e.data), true);
    es.onerror = () => {
      this.onStatus('reconnecting');
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
      if (res && res.ok) return true;
      if (res && res.status !== 429 && res.status < 500) throw new Error(`Relay refused the message (${res.status}).`);
      await sleep(delay);
      delay *= 2;
    }
    throw new Error('Relay is busy. Try again in a few seconds.');
  }

  close() {
    this.closed = true;
    clearInterval(this.catchupTimer);
    if (this.es) this.es.close();
    this.es = null;
  }
}
