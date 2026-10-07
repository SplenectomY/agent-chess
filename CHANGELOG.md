# Changelog

All notable changes to Agent Chess. Versions follow [semantic versioning](https://semver.org).

## 0.7.1 — 2026-10-06

From a ChatGPT game (browser agent, 10 + 5): the app behaved correctly, but the agent stopped seeing the game whenever it ended its chat turn, and its slow page checks lost it the game on time.

- The invite's browser option and AGENTS.md now warn that an open tab is not a running agent, and give browser agents a loop to follow: stay in one turn, check cheaply, move first and talk after, and prefer the CLI or HTTP when there's a shell.
- Lobby hint under the time controls: playing an AI through its browser? Pick 10 + 30 or Untimed.

## 0.7.0 — 2026-10-06

- Added: the opening name (with ECO code) above the move list. It updates as the game goes on and recognizes transpositions, because it's looked up by position, not move order.
- Added: clicking the name opens an opening panel with its own small board (the live board isn't touched, so it works mid-game). You can step through the named line with buttons, ← →, or by clicking a move. The panel shows where your game left the line, a short primer (about the opening, ideas for White, ideas for Black), and notes on well-known variations.
- Data: `data/openings.json` (3,865 named positions, about 88 KB compressed) built from the [Lichess chess-openings](https://github.com/lichess-org/chess-openings) dataset, which is CC0 (public domain). Rebuild with `node tools/build-openings.mjs <checkout>`. Primers are original text in `js/opening-primers.js`, covering about 97% of named lines by family. The rest get a one-line ECO description.
- The "Game state (text)" section includes an `Opening:` line.
- `tools/version.sh` accepts pre-release versions (X.Y.Z-tag).
- Dev: `tools/dev-server.mjs` now serves `/` on Windows (it returned "Not found").

## 0.6.5 — 2026-10-06

Mobile/stacked layout polish, so the board and the review box fit on one phone screen:

- Review: small ◀ ▶ » (next comment) buttons sit in the top-right, across from the move header. Close review stays at the bottom.
- Player bars: one line each. The color swatch is beside the name, then the captured pieces, then a clock at the same size as the name (it was 1.5–2.4rem). The "White"/"Black" label is hidden on phones.
- Top bar: one line (41 px instead of about 110 px), down to 360 px wide.
- Desktop layout unchanged.

## 0.6.4 — 2026-10-06

From Claude Sonnet's game: the analysis request arrived 5 s after mate, before the agent started `wait --any`, so the wait never saw it.

- Fixed: `wait --any` returns immediately when the opponent has an unanswered analysis request or rematch offer, including one that arrived before the wait started.
- Added: `"pending"` in every JSON snapshot (`["analysis"]`, `["rematch"]` or `[]`).
- Changed: a post-game `wait --any` that times out now says the game is over and nothing was asked (JSON: `gameOver: true`, `pending: []`, `note`), instead of the in-game "Not your move yet".

## 0.6.3 — 2026-10-06

- Fixed: stepping through review comments scrolled the whole page to center the move. Only the move list scrolls now; the page stays put.
- Changed: the review opens at the game's first move (it used to open at the first comment or the last move).
- Mobile/stacked layout: the review panel is compact. The move header is at the top, Close review sits across the bottom, and there are no per-comment signatures, no first/last buttons and no keyboard tip, so ◀ ▶ and Next comment fit on one line. The desktop layout is unchanged.

## 0.6.2 — 2026-10-06

- Changed: the game review is back to the plain panel for the room's host (the human). The comment and summary form, and the "asked you for an analysis" notice, now show only for the side that joined from the invite (the bot). Agent Chess is meant for playing agents, so the host reads the analysis and the bot writes it.
- Fixed: "1 comments" now reads "1 comment".

## 0.6.1 — 2026-10-06

- Fixed: Soft pieces sat about 9% right of center and flush with the bottom of the square. The piece box is now sized so it centers, and all pieces share a baseline about 8% above the bottom.
- Fixed: the piece you drag had zero size (both sets, since 0.1). Its size was measured after the board redraw had replaced the square. Dragging now shows the piece under the pointer.

## 0.6.0 — 2026-10-06

- Added: a Style menu in the top bar (lobby and in-game) with a piece set and board colors. The choice is remembered in this browser.
- Added: "Soft" piece set. These are original, chunky, rounded pieces with a slightly top-down shaded look, drawn as small inline SVGs. Classic stays the default.
- Added: board themes Slate (default), Midnight and Sand. On Midnight, dark pieces get a light rim so they stay visible.
- Changed: agents are told to stay in the room for at least 30 seconds after a game ends (invite, AGENTS.md, CLI output and a `nextStep` field in `--json`), because analysis requests often arrive a few seconds after the result.
- The Style menu closes with Escape or by clicking elsewhere.

## 0.5.0 — 2026-10-06

- Added: captured pieces in each player bar, between the name and the clock, with a "+N" material lead. It follows the review position too.
- Added: comment form in game review for both players (tag, comment, better move, plus a summary on the first or last move). Browser agents and humans can now answer an analysis request on the page.
- Added: the review panel tells you when your opponent asked you for an analysis. The requester sees "comments appear here as X adds them" (grammar fixed).
- Added: "Played Nf3." confirmation under the move box.
- Added: the room log records when a draw offer is declined by playing on, and the text state says how to answer a pending offer.
- Changed: piece symbols are drawn with CSS, so the page's text (what browser agents read) has square names and the text state instead of about 100 lines of glyphs.
- CLI: remembers the relay per room (so `--relay` is only needed once), `wait --any` for after the game, `gameOver` in JSON.
- Invite: carries `--relay` when the room isn't on ntfy.sh, a bounded HTTP wait (`curl --max-time 20`), a note that HTTP agents track the position themselves and should set up before joining, and a heads-up about post-game analysis.
- AGENTS.md: HTTP-agent checklist, bounded long-poll, the `v` field, how each kind of agent finds and answers an analysis request.

Found by three fresh test agents (CLI under a 30 s tool cap, HTTP-only, browser-only) playing a scripted opponent.

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
