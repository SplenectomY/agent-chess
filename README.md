# Agent Chess

One-to-one chess by room code, hosted as a static GitHub Pages site. It has a shared clock and is built so you can hand the link to AI agents and play them.

**Play:** https://splenectomy.github.io/agent-chess/

## How it works

- **Open a room**: pick your color and a time control (presets or custom minutes + increment, or untimed). You get a six-character room code and a link.
- **Share it**: "Copy invite for an agent" copies a self-contained prompt. It tells an agent how to join and move from a browser, the command-line client or raw HTTP.
- **No server of our own**: moves go through a public [ntfy](https://ntfy.sh) relay topic (`agentchess-v1-<CODE>`). The site stays pure static files.
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
| `agent-chess.mjs` | Bundled CLI for agents (built from `tools/cli.mjs` by `tools/build.sh`) |
| `tools/dev-server.mjs` | Local static server plus a minimal ntfy-compatible relay for offline testing |

## Local development

```sh
node tools/dev-server.mjs 8080
# open http://localhost:8080/?relay=http://localhost:8080
node agent-chess.mjs state ROOM --relay http://localhost:8080
```

Add `?relay=https://your-ntfy-server` to the page URL (or `--relay` in the CLI) to use a self-hosted ntfy instead of ntfy.sh. After editing `js/game.js`, `js/relay.js` or `tools/cli.mjs`, run `sh tools/build.sh` to rebuild the CLI.

## Versioning

The app follows [semantic versioning](https://semver.org). The version lives in `js/version.js` and is shown in the page title (for example "Agent Chess v0.2.0"), next to the logo, and by `node agent-chess.mjs --version`. If the title shows the version you expect, you're testing the latest build. GitHub Pages can cache files for up to 10 minutes, so hard-refresh if it doesn't.

- **Major:** set by the owner.
- **Minor:** new features or behavior changes.
- **Patch:** fixes and wording changes.

To change it, run `sh tools/version.sh X.Y.Z`. That updates `js/version.js`, the title and the cache-busting query strings in `index.html`, then rebuilds the CLI. Log each release in [CHANGELOG.md](CHANGELOG.md).

## Limits

- Rooms are public to anyone with the code, and the relay keeps messages for 12 hours.
- Seats are tied to a player id stored in your browser. Someone who copies another player's id could act for them. This is meant for friendly games, not tournaments.
- ntfy.sh rate-limits each IP (a burst of about 60 requests, then one every 5 seconds). That's plenty for normal play but tight for sustained bullet chess.
- Relay timestamps have one-second resolution, so each move's clock charge may be off by up to about a second.
