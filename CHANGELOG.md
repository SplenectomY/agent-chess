# Changelog

All notable changes to Agent Chess. Versions follow [semantic versioning](https://semver.org).

## 0.17.0 — 2026-10-07

- Better built-in voices: read-aloud now picks the best voice your browser has (Chrome's online "Google" voices, Edge's "Natural" voices, Apple's Premium/Enhanced voices) instead of the basic offline one, and avoids robotic eSpeak voices.
- Added: a **Voice** choice in the Style menu: Automatic, **HD voice**, or any specific voice your browser has for the current language. Picking one plays a short sample. The choice applies to lessons, puzzles and reviews.
- Added: **HD voice**: natural-sounding Piper voices that run inside the page (no account, no server). Each language's voice downloads once (about 60 MB, with progress shown) and is kept by the browser. Available for English, Spanish, French, German, Italian, Portuguese, Russian and Chinese; Japanese keeps the browser voice. Speech starts with the first sentence while the rest is prepared. If the HD voice can't load, the built-in voice takes over with a short notice.

## 0.16.0 — 2026-10-07

- Added: read-aloud for puzzles and game reviews, with the same **Listen** button and **Read aloud** switch as lessons (one switch for the whole site).
  - Puzzles: Listen reads the introduction, then the latest message. With Read aloud on, every explanation, hint, wrong-move note and opponent reply is read as it appears (queued, so nothing is cut off), then the conclusion when solved. Optional `narration` / `audio` replace the spoken introduction.
  - Lesson tasks: with Read slides aloud on, task messages and the `done` note are read too.
  - Game reviews: Listen reads the current move, its tags, comments and better move (and the summary on the first and last positions); with Read aloud on, each move is read as you step through.
- Agent guides explain what gets read so agents write comments that work when heard.

## 0.15.0 — 2026-10-07

- Added: lessons can be listened to. Each slide has a **Listen** button, and a **Read slides aloud** switch (remembered in this browser) reads every new slide as you move on. It uses the browser's built-in voice, so nothing is uploaded or hosted, and it speaks in the language of the text: a Spanish slide gets a Spanish voice. Moves are read as words in that language ("Nf3" is "knight f3", "O-O" is "castles kingside").
- Lesson format: optional `narration` per slide (what to say; translatable like other text) and optional `audio` (a hosted `https://` recording, or one per language) that plays instead. If a recording fails to play, the slide is read aloud. Documented in `lesson/AGENTS.md` under "Narration and audio".

## 0.14.0 — 2026-10-07

- Added: moves glide to their square instead of jumping (170 ms, a touch quicker than chess.com). It works for your moves, your opponent's, puzzle and lesson replies, stepping forward through reviews and solutions, and slides that play one move. Castling slides the rook too, and a captured piece stays visible until the attacker lands. A piece you drag and drop isn't animated again, and nothing animates if your system asks for reduced motion.

## 0.13.0 — 2026-10-07

- Added: the whole site is translated: English, Spanish, French, German, Italian, Portuguese (Brazil), Russian, Simplified Chinese and Japanese. The page follows your browser's language; pick another under **Style → Language** (the menu shows the current code, like "Style DE"), or add `?lang=es` to any link. Switching applies at once, without reloading.
- Translated: the lobby, room, clocks, status lines, room log and results (the engine now records structured events, so the log is shown in each viewer's language), game review and analysis, opening panel headings, puzzles, lessons, hints, feedback, tags and screen-reader labels. Plural forms follow each language's rules. Opening names and the opening notes stay in English.
- Puzzles and lessons can be written in any language or several at once: any text can be `{ "en": "...", "es": "..." }`, with `"lang"` naming the language of plain strings. The page picks the viewer's language, and when the viewer hasn't chosen one and the content isn't in their browser's language, the interface follows the content. `puzzle check` / `lesson check` list the languages and flag missing translations. The example puzzle is now in English and Spanish.
- Agents learn each player's language: the page sends `lang` on `create`/`join`, and the CLI's `state`, `wait` and `review` tell the agent which language to chat and annotate in. Copied invites and analysis requests say it too. The CLI has `--lang` for agents. Agent-facing text (CLI, AGENTS.md, text views, invite prompt) stays English; `&lang=en` gives a browser agent the English page.
- Changed: after a wrong move, **Retry** sits right under the explanation (where Continue appears), full width, in a muted slate with a gentle pulse.
- Fixed: the result banner showed a stray "null" when no analysis had been requested.
- Tools: `node tools/check-locales.mjs` checks every catalog against English (keys, placeholders, plural forms).

## 0.12.0 — 2026-10-07

- Added: a **Better move available** tag (↑, `better-available`) for a move that's good but misses a stronger one. It works in game reviews (pair it with a `better` move to draw the arrow), puzzles and lessons. On a puzzle or lesson task's wrong move, the player sees "Nc3 is a good move, but there's a better one" instead of "Nc3 isn't it", then retries.
- Tag names are more forgiving everywhere: "Better move available", "best move", "Brilliant" and the symbols themselves (for example "??") are all understood.
- The examples use it: Rc2 in the back-rank puzzle, and Nc3 and Be2 in the Italian Game lesson.

## 0.11.1 — 2026-10-07

- Changed: the buttons that move you forward stand out. They're now brand yellow with a slow, soft pulse (a static ring if your system asks for reduced motion).
- Puzzles and lesson tasks: **Continue** sits right under the explanation, above the move box, and says what it does ("Continue: see Black's reply").
- Lessons: a full-width **Next slide** button under the slide text (or under the solved task), in addition to Next below the board.

## 0.11.0 — 2026-10-07

- Added: lessons at `/lesson/`. An agent writes a lesson as JSON: a primer, then slides with positions, moves, explanations, colored arrows (green, red, blue, yellow), highlighted squares and move tags. Any slide can hold a task, which works like a puzzle (hints, wrong-move explanations with Retry, reply arrows with Continue), and Next unlocks once it's solved. Lessons can also be pure slideshows.
- Lesson page: Back/Next buttons, arrow keys and a progress bar (task slides marked; you can jump back to any slide you've reached), a collapsible "About this lesson" primer with light formatting (paragraphs, lists, headings, bold), an end screen with the conclusion and your task stats, Copy link and a text view of the state.
- CLI: `lesson check`, `lesson publish` (short `?id=` link plus a permanent link) and `lesson show`.
- `lesson/AGENTS.md`: a self-contained guide for agents, plus four example lessons: the Italian Game, checkmate with king and rook, knight forks, and Scholar's Mate (a slideshow from Black's side).
- Internal: puzzles and lessons now share the solving logic, board drawing and link loading.

## 0.10.0 — 2026-10-07

- Added: puzzle moves can carry the same tags as game reviews (`"tag": "brilliant"`, `best`, `blunder`, `interesting` and the rest). The symbol shows on the board on the move's square, in the feedback and in the full solution. Solver moves, opponent replies and wrong moves can all be tagged.
- Added: puzzle `replies`. On a solver move it lists the opponent's possible answers, drawn as green arrows like the better-move arrows in game reviews; the puzzle waits for **Continue** before playing the actual reply. A wrong move can carry `replies` too (its refutation), shown while the wrong move is on the board. Arrows and tags also appear when stepping through the solution.
- `puzzle check` lists tags and reply arrows and warns about unknown tags or illegal replies. The example puzzle uses both.

## 0.9.2 — 2026-10-07

- Changed: a wrong move in a puzzle now stays on the board, highlighted, with its explanation, until you press **Retry**. It used to be taken back automatically after about a second, which was too fast to see what went wrong.

## 0.9.1 — 2026-10-06

- Added: `puzzle/AGENTS.md`, a self-contained guide to give an agent when you want a puzzle. It covers designing a sound puzzle (fit the request, unique solution, verify replies, difficulty guide), the JSON format, and making the link: with Node (`puzzle publish`, short and permanent links) or with any shell (a tested Python one-liner for the permanent link). The main AGENTS.md links to it.

## 0.9.0 — 2026-10-06

- Added: puzzles. An agent writes a puzzle as JSON and publishes it with `node agent-chess.mjs puzzle publish puzzle.json`. That prints a short link (`/puzzle/?id=xyzabc123`, kept on the relay for about 12 hours) and a permanent link (the puzzle compressed inside the link).
- Puzzle features: multi-move lines with auto-played opponent replies; per-move hints revealed one at a time, then the answer as an arrow; explanations for specific wrong moves plus a fallback (the wrong move is shown, explained and taken back); alternative correct moves; any mate accepted on the final move; and a closing analysis with the full solution to step through.
- Puzzle page: same board, Style menu and mobile layout as the game; drag, click or type moves; Start over / Try again; Copy link (always the permanent form); and a text state for agents.
- CLI: `puzzle check`, `puzzle publish` and `puzzle show`, plus `--site` to point links at a local dev server. Without Node, agents can build a `#j=` link by base64url-encoding the JSON.
- Example: `puzzle/?example=back-rank`, a mate in 2 that was checked exhaustively for a unique solution.
- Internal: shared page helpers moved to `js/ui.js`; `tools/version.sh` also updates `puzzle/index.html`.

## 0.8.0 — 2026-10-06

- Added: an analysis progress indicator for the player who asked. The results box and the review panel show "Waiting for X to start", then a spinner with "X is analyzing the game… N comments so far" (plus "no update for N min" if it goes quiet), then a check mark: "X finished the analysis (N comments)". The room log records start and finish.
- Added: `analysis-status` message (`working` / `done`). The agent starts by running `review`, posting its first comment, or (in the browser) opening Review game. It finishes with `annotate ROOM --done`, the **Mark analysis done** button, or a `--file` batch that includes a summary.
- CLI: an analysis request stays in `pending` until you mark it done. The JSON includes `analysisStatus`, and `nextStep` and the printed hints include the `--done` step.
- The copied analysis request, AGENTS.md and the message table document it.

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
