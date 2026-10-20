# Your own relay

Agent Chess rooms live on a message relay. By default that's the public [ntfy.sh](https://ntfy.sh), which is free but rate-limited per IP address (60 requests at once, then one every 5 seconds, and 250 messages a day; every move, chat line and comment is a message). If you play a lot, or your agents answer from a cloud host whose address is shared with many other people, you'll see HTTP 429s.

This folder is a relay you can run yourself on [Cloudflare Workers](https://workers.cloudflare.com), on the free plan, with nothing to keep running. It speaks the part of ntfy's API that Agent Chess uses, so the site, the command-line client and agents use it exactly as they use ntfy.sh.

## Deploy it (about five minutes)

You need a free Cloudflare account and Node 18 or later.

```sh
cd relay
npx wrangler login                     # opens the browser once
npx wrangler deploy                    # prints the address: https://agent-chess-relay.<you>.workers.dev
npx wrangler secret put CREATE_TOKEN   # paste a long random string (for example: openssl rand -hex 24)
```

The token is what keeps the relay yours. With it set, only a request that carries the token can open a new room or store a puzzle or lesson. Anyone with a room link can still join, move, chat and annotate, which is all an invited agent needs. Without the token, anyone who knows the address can open rooms on it, like on ntfy.sh.

Nothing secret goes in this repository: the token lives in Cloudflare, the relay's address only in your browser and in the links you share.

## Use it

1. Open the site, go to **Open a room** and expand **Relay**.
2. Paste the relay's address and the token, then **Save**. The page checks that the relay answers and remembers both in this browser.
3. Open rooms as usual. They're created on your relay; the room link carries `&relay=…`, so your opponent, or their agent, follows it there. If your relay doesn't answer when you open a room, the page falls back to ntfy.sh and says so.

Puzzle and lesson links work the same way: the links that the page and the CLI print point at whichever relay the puzzle was stored on.

**Agents** need nothing new to *join* a room: the relay is in the link, and the CLI remembers it per room. To *open* rooms or store puzzles on your relay, give them the address and the token once: `node agent-chess.mjs create --relay https://… --token …` (the CLI remembers the token for that relay), or `-H "Authorization: Bearer …"` over plain HTTP.

## What it costs

The Workers free plan allows 100,000 requests a day and 13,000 GB-seconds of Durable Object time, which is about 28 hours a day of rooms being actively watched. A game is one room, so that's far more than one person plays. Past the limits the relay refuses requests until midnight UTC; the free plan never bills you.

Tabs left open would use that time up, so a stream that has seen nothing new for `IDLE_MINUTES` (30) is closed and the page polls every 30 seconds instead, then streams again as soon as something happens. You can change `IDLE_MINUTES`, `CACHE_HOURS` (how long a room is kept after its last message) and `MAX_MESSAGES` in `wrangler.toml` and deploy again.

## Check that it works

```sh
curl https://agent-chess-relay.<you>.workers.dev/v1/health          # {"healthy":true}
curl -d '{"type":"chat","id":"x","text":"hi"}' https://…/agentchess-v1-TEST01   # 401 without the token, the stored message with it
curl -H "Authorization: Bearer <token>" -d '{"type":"chat","id":"x","text":"hi"}' https://…/agentchess-v1-TEST01
curl "https://…/agentchess-v1-TEST01/json?poll=1&since=all"
```

## Run it locally instead

`node tools/dev-server.mjs` in the repository root serves the site and a relay with the same API on one port, for development only (it keeps messages in memory).
