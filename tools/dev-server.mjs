// Local development server: serves the site and a minimal ntfy-compatible relay
// on the same port, so you can play without touching ntfy.sh.
//
//   node tools/dev-server.mjs [port]
//   open http://localhost:8080/?relay=http://localhost:8080
//   node agent-chess.mjs state ROOM --relay http://localhost:8080
//
// Only implements what Agent Chess uses: POST /<topic>, GET /<topic>/json (poll or stream), GET /<topic>/sse.

import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, extname, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(fileURLToPath(import.meta.url), '..', '..');
const PORT = Number(process.argv.find((a) => /^\d+$/.test(a)) || process.env.PORT || 8080);
// --stuck-sse: accept /sse connections but never deliver on them, like a buffering
// proxy or an embedded browser that holds streamed responses. For testing fallbacks.
const STUCK_SSE = process.argv.includes('--stuck-sse');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.md': 'text/markdown; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.txt': 'text/plain' };

const topics = new Map(); // topic -> { messages: [], subs: Set<(msg) => void> }
let counter = 0;
const topic = (name) => {
  if (!topics.has(name)) topics.set(name, { messages: [], subs: new Set() });
  return topics.get(name);
};
const since = (t, s) => {
  if (!s || s === 'all') return t.messages;
  const i = t.messages.findIndex((m) => m.id === s);
  return i >= 0 ? t.messages.slice(i + 1) : t.messages;
};

http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const parts = url.pathname.split('/').filter(Boolean);
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') { res.writeHead(204, { 'Access-Control-Allow-Methods': 'GET,POST', 'Access-Control-Allow-Headers': '*' }); return res.end(); }

  if (parts[0] && parts[0].startsWith('agentchess-')) {
    const t = topic(parts[0]);
    if (req.method === 'POST' && parts.length === 1) {
      let body = '';
      for await (const c of req) body += c;
      const msg = { id: `m${++counter}${Math.random().toString(36).slice(2, 6)}`, time: Math.floor(Date.now() / 1000), event: 'message', topic: parts[0], message: body };
      t.messages.push(msg);
      for (const fn of t.subs) fn(msg);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify(msg));
    }
    const kind = parts[1];
    if (req.method === 'GET' && (kind === 'json' || kind === 'sse')) {
      const backlog = since(t, url.searchParams.get('since'));
      const sse = kind === 'sse';
      const write = (m) => res.write(sse ? `event: message\ndata: ${JSON.stringify(m)}\n\n` : JSON.stringify(m) + '\n');
      if (url.searchParams.get('poll') === '1') {
        res.writeHead(200, { 'Content-Type': 'application/x-ndjson' });
        backlog.forEach(write);
        return res.end();
      }
      res.writeHead(200, { 'Content-Type': sse ? 'text/event-stream' : 'application/x-ndjson', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
      res.write(sse ? `data: ${JSON.stringify({ event: 'open', topic: parts[0] })}\n\n` : JSON.stringify({ event: 'open' }) + '\n');
      if (sse && STUCK_SSE) return; // hold the connection open, send nothing
      backlog.forEach(write);
      t.subs.add(write);
      const ka = setInterval(() => res.write(sse ? `data: ${JSON.stringify({ event: 'keepalive' })}\n\n` : JSON.stringify({ event: 'keepalive' }) + '\n'), 25000);
      req.on('close', () => { t.subs.delete(write); clearInterval(ka); });
      return;
    }
    res.writeHead(404);
    return res.end();
  }

  // static files
  let path = normalize(decodeURIComponent(url.pathname)).replace(/^(\.\.[/\\])+/, '');
  if (path.endsWith('/')) path += 'index.html';
  try {
    const data = await readFile(join(ROOT, path));
    res.writeHead(200, { 'Content-Type': TYPES[extname(path)] || 'application/octet-stream' });
    res.end(data);
  } catch {
    res.writeHead(404);
    res.end('Not found');
  }
}).listen(PORT, () => console.log(`Agent Chess dev server${STUCK_SSE ? ' (stuck SSE)' : ''}: http://localhost:${PORT}/?relay=http://localhost:${PORT}`));
