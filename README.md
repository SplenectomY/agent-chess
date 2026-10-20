# Agent Chess

One-to-one chess by room code, hosted as a static GitHub Pages site. It has a shared clock and is built so you can hand the link to AI agents and play them.

**Play:** https://splenectomy.github.io/agent-chess/

## How it works

- **Open a room**: pick your color and a time control (presets or custom minutes + increment, or untimed). You get a six-character room code and a link.
- **Share it**: "Copy invite for an agent" copies a self-contained prompt. It tells an agent how to join and move from a browser, the command-line client or raw HTTP.
- **No server of our own**: moves go through a public [ntfy](https://ntfy.sh) relay topic (`agentchess-v1-<CODE>`). The site stays pure static files. If ntfy.sh's rate limits get in the way, you can run [your own relay](relay/README.md) on Cloudflare's free plan and point the site at it.
- **Synced clock**: both clocks are computed from the relay's own timestamps, never from either player's computer. Every client replays the same message log and gets the same clock readings. When a clock runs out, the opponent's client claims the win automatically.
- **Agent-friendly**: you can type moves in SAN or UCI, read the position as plain text (FEN, move list, ASCII board, legal moves), and play over HTTP. There's also a dependency-free CLI ([`agent-chess.mjs`](agent-chess.mjs)) with a blocking `wait` command. The full protocol is in [AGENTS.md](AGENTS.md).
- Also included: draw offers, resign, give 15 s, rematch with colors swapped, chat, spectators, copy PGN/FEN, drag-and-drop or click-to-move, keyboard play, and light/dark themes.

## Files

| Path | What |
|---|---|
| `index.html`, `css/style.css`, `js/app.js` | The web app |
| `js/game.js` | Game engine: replays the room log into position, result and clocks (shared by the page and the CLI) |
| `js/relay.js` | ntfy relay transport |
| `vendor/chess.js` | [chess.js](https://github.com/jhlywa/chess.js) 1.4.0 (BSD-2-Clause) for move legality |
| `puzzle/`, `js/puzzle.js`, `js/puzzle-core.js` | Puzzle page and puzzle format/validation (guide for agents: `puzzle/AGENTS.md`) |
| `lesson/`, `js/lesson.js`, `js/lesson-core.js` | Lesson page and lesson format/validation (guide for agents: `lesson/AGENTS.md`, examples in `lesson/examples/`) |
| `js/solver.js`, `js/board-view.js`, `js/share-load.js`, `js/tags.js` | Shared by puzzles and lessons: solving logic, board drawing and input, link loading, move tags |
| `agent-chess.mjs` | Bundled CLI for agents (built from `tools/cli.mjs` by `tools/build.sh`) |
| `tools/dev-server.mjs` | Local static server plus a minimal ntfy-compatible relay for offline testing |
| `relay/` | An ntfy-compatible relay of your own, for Cloudflare Workers (`relay/README.md`) |

## Your own relay

ntfy.sh allows each IP address 250 messages a day and one request every 5 seconds after a burst of 60, and every move, chat line and comment is a message. The `relay/` folder has a drop-in replacement for Cloudflare Workers that runs on the free plan: deploy it, set a create token so only you (and the agents you tell) can open rooms on it, then paste its address under **Relay** in the lobby. Rooms you open go there and carry the relay in their link, so opponents and agents follow; if your relay doesn't answer, the lobby falls back to ntfy.sh. Details and the deploy steps are in [`relay/README.md`](relay/README.md).

## Read-aloud voices

Lessons, puzzles and reviews can be read aloud. By default the page uses the best voice the browser offers (Chrome's "Google" voices, Edge's "Natural" voices, Apple's Premium/Enhanced voices). The **HD voice** option in the Style menu runs [Piper](https://github.com/rhasspy/piper) voices in the page through [vits-web](https://github.com/diffusionstudio/vits-web): the library loads from jsDelivr, the voice models (about 60 MB each, cached after the first download) from Hugging Face. Voice ids per language are in `js/narrator.js` (`HD_VOICES`). Japanese has no Piper voice yet and always uses the browser's voice.

## Languages

The interface strings live in `js/locales/<code>.js`; `en.js` is the reference. To add a language, copy `en.js`, translate the values (keep `{placeholders}` and the plural forms your language uses), add it to `js/langs.js`, and run `node tools/check-locales.mjs`.

## Local development

```sh
node tools/dev-server.mjs 8080
# open http://localhost:8080/?relay=http://localhost:8080
node agent-chess.mjs state ROOM --relay http://localhost:8080
```

Add `?relay=https://your-relay` to the page URL (or `--relay` in the CLI) to use a self-hosted ntfy, or the Worker in `relay/`, instead of ntfy.sh; the lobby's **Relay** box saves one for the rooms you open. After editing `js/game.js`, `js/relay.js` or `tools/cli.mjs`, run `sh tools/build.sh` to rebuild the CLI.

## Versioning

The app follows [semantic versioning](https://semver.org). The version lives in `js/version.js` and is shown in the page title (for example "Agent Chess v0.2.0"), next to the logo, and by `node agent-chess.mjs --version`. If the title shows the version you expect, you're testing the latest build. GitHub Pages can cache files for up to 10 minutes, so hard-refresh if it doesn't.

- **Major:** set by the owner.
- **Minor:** new features or behavior changes.
- **Patch:** fixes and wording changes.

To change it, run `sh tools/version.sh X.Y.Z`. That updates `js/version.js`, the title and the cache-busting query strings in `index.html`, then rebuilds the CLI. Log each release in [CHANGELOG.md](CHANGELOG.md).

## Limits

- Rooms are public to anyone with the code, and the relay keeps messages for 12 hours.
- Seats are tied to a player id stored in your browser. Someone who copies another player's id could act for them. This is meant for friendly games, not tournaments.
- ntfy.sh rate-limits each IP (a burst of about 60 requests, then one every 5 seconds, and 250 messages a day). That's enough for a few games a day; for more, or for agents on hosts with shared addresses, run [your own relay](relay/README.md).
- Relay timestamps have one-second resolution, so each move's clock charge may be off by up to about a second.
