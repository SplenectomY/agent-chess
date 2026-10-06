# Changelog

All notable changes to Agent Chess. Versions follow [semantic versioning](https://semver.org).

## 0.4.0 — 2026-10-06

Changes from the Grok game in room JQ3CX6, where about 100 seconds of clock were lost to a `wait` running unread in the background.

- Fixed: `wait` didn't exit when it was your move. It printed the board, then kept running and printed again on every later move until it timed out, which put several boards in one output. It now prints exactly one snapshot and exits.
- Changed: `wait` gives up after 20 s by default (was 240 s), so it fits inside agent hosts that background commands after about 30 s. A timeout prints one small `{"waiting":true,"timeout":true}` (or one line of text), with no board, and exits 2.
- Added: `wait --once` checks without waiting (exits 0 with the board, or 3 with "not yet").
- Added: starting a `wait` stops any older `wait` for the same room and player (the old one exits 4).
- Added: JSON snapshots include `asOf` and `ply`, so stale output is easy to spot. `chat` prints a short acknowledgement instead of a board.
- Docs: a "host-safe loop" section in AGENTS.md (short waits, one command per call, old output isn't the board), the `wait` exit codes, and an updated invite.

## 0.3.1 — 2026-10-06

- Fixed: "Open room" could hang on "Opening the room…" until a refresh in browsers or networks that buffer the relay's live stream (seen in the Claude app's built-in browser). The page now applies the relay's reply to its own messages right away instead of waiting for the stream to echo them.
- Added: if the live stream doesn't echo a message within 4 s, the page switches to checking every 5 s ("Live (polling)") and switches back once the stream delivers again. A stream that goes completely silent is reopened.
- Dev: `node tools/dev-server.mjs 8090 --stuck-sse` simulates a stuck stream.

## 0.3.0 — 2026-10-06

- Added: post-game analysis. "Request analysis" in the results box (and the actions row) asks the opponent to annotate the game. It also copies a ready-to-paste request for agents.
- Added: game review mode. Step through the finished game (buttons or ← →). Annotated moves show chess symbols (!!, !, ?!, ?, ?? …) in the move list and on the board, the comment appears in a side panel, and suggested better moves are drawn as arrows.
- Added: `analysis-request` and `annotation` messages, and CLI `review` and `annotate` (including `--file` for many comments at once).

## 0.2.0 — 2026-10-06

- Added: app version shown in the page title, next to the logo, and by `agent-chess.mjs --version`.
- Added: versioned module URLs, so a new release isn't masked by cached scripts.
- Added: clock-discipline guidance for agents in the invite and AGENTS.md.
- Added: 10 + 30 "for agents" time-control preset (replaces 60 + 30).
- Fixed: the invite now names the "Type a move" box.

## 0.1.0 — 2026-10-06

- First release: room-code chess on GitHub Pages over an ntfy relay, a shared clock computed from relay timestamps, an agent invite, AGENTS.md, and the `agent-chess.mjs` CLI.
