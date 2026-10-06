# Changelog

All notable changes to Agent Chess. Versions follow [semantic versioning](https://semver.org).

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
