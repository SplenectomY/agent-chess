# Make a chess lesson on Agent Chess (instructions for AI agents)

Someone asked you to teach them something about chess. Your job: plan a short lesson that fits their request, write it as JSON, turn it into a link, and send them the link. They open it on the Agent Chess lesson page and step through it slide by slide.

A lesson has:

- a **primer**: a longer introduction shown at the top (what they'll learn and why it matters);
- **slides**: each one is a board position with a title and an explanation. It can play moves, draw colored arrows, highlight squares and show move symbols (!!, ?, ★ and so on);
- optional **tasks** on any slide: the player must find the move (or a short line of moves) before Next unlocks. Tasks work like Agent Chess puzzles: hints, explanations for wrong moves, auto-played replies;
- a **conclusion** shown at the end.

A lesson can be a pure slideshow (no tasks at all), or mostly practice, or anything in between.

## 1. Plan the lesson

- **Fit the request.** Match the topic, level and length they asked for. If they mention one of their games (for example "from my game in room ABC234"), you can read it with `node agent-chess.mjs review ABC234` and build the lesson around real positions from it.
- **One idea per slide.** Give each slide a short title and 2 to 5 sentences. Use arrows and highlights to point at what the text is talking about. 6 to 12 slides is a good length.
- **Teach, then test.** Show the idea first, then let them use it in a task. Put the key lesson in the conclusion as 2 to 4 points.
- **Be correct. This is the most important rule.** Every claim about a position (that a square is attacked, that a move wins, that a line is the main line) must be true. Every move must be legal (the validator checks legality, not truth). Each task's answer must be the only move that does what the prompt asks, and the opponent's replies must be their best defense. If you can run code, check positions with `python-chess` (and Stockfish if available), or at least list the legal moves. If you can't verify something, simplify it.

## 2. Write it as JSON

```json
{
  "title": "Knight forks",
  "author": "Your name",
  "level": "Beginner",
  "primer": "A **fork** is one piece attacking two enemy pieces at once.\n\n### What you'll learn\n- How to see the knight's reach\n- How to find a royal fork",
  "orientation": "w",
  "slides": [
    {
      "title": "The royal fork",
      "fen": "r3k3/2N5/8/8/8/8/8/4K3 b - - 0 1",
      "text": "The knight on c7 checks the king **and** attacks the rook on a8.",
      "arrows": [{ "from": "c7", "to": "e8", "color": "red" }, { "from": "c7", "to": "a8", "color": "red" }]
    },
    {
      "title": "Your move",
      "fen": "q3k3/pp3ppp/8/1N6/8/8/PPP2PPP/4K3 w - - 0 1",
      "text": "Black's king and queen are both on light squares.",
      "task": {
        "prompt": "Win Black's queen with a knight fork.",
        "line": [
          { "move": "Nc7+", "tag": "great",
            "hints": ["Find a square a knight's jump from both e8 and a8.", "It's on the c-file."],
            "explain": "Check and an attack on the queen.",
            "replies": ["Kd7", "Kd8", "Ke7", "Kf8"],
            "wrong": { "Nd6+": "Check, but it doesn't attack the queen.", "*": "Look for a check that also hits the queen." } },
          { "move": "Kd7", "explain": "The king must move." },
          { "move": "Nxa8", "tag": "best", "explain": "Queen won." }
        ],
        "done": "Every king move leaves the queen hanging."
      }
    },
    {
      "title": "The knight is trapped, but who cares?",
      "moves": ["b6"],
      "text": "This slide has no \"fen\", so it continues from where the task ended. Black traps the knight, but White is still far ahead."
    }
  ],
  "conclusion": "Look for valuable pieces on squares of the same color, a knight's jump from one square."
}
```

### Lesson fields

| field | meaning |
|---|---|
| `title`, `author`, `level` | Short text shown at the top. `level` is free text such as "Beginner". |
| `lang` | The language of plain-string texts, like `"es"` (default `"en"`). See **Languages**. |
| `primer` | The introduction, shown in the "About this lesson" box. Formatting below. Up to 8000 characters. |
| `fen` | Starting position for the first slide. Default: the normal starting position. |
| `orientation` | `"w"` (default) or `"b"`: which side is at the bottom of the board. |
| `slides` | The slides, in order (up to 80). |
| `conclusion` | Shown when the player finishes. |

### Slide fields

| field | meaning |
|---|---|
| `title` | Short heading. |
| `text` | The explanation (up to 4000 characters). |
| `fen` | Jump to a new position. Without it, the slide continues from where the previous slide ended: after its moves and after its task. |
| `moves` | Moves played as the slide opens (SAN or UCI), for example `["e4", "e5", "Nf3"]`. The last one is highlighted on the board and the move list appears above the board. Use one or two moves per slide when you're walking through a line. |
| `tag` | A symbol on the last of `moves`: `brilliant` !!, `great` !, `best` ★, `good` ✓, `book`, `interesting` !?, `better-available` ↑ (good, but a better move was there), `inaccuracy` ?!, `mistake` ?, `blunder` ??, `missed-win`. On a task's wrong move, `better-available` tells the player their move is good but not the best, and they retry. |
| `arrows` | Arrows on the board: `"g1f3"`, `"g1-f3"`, a legal move in SAN (`"Nf3"`), or `{ "from": "g1", "to": "f3", "color": "red" }`. Colors: `green` (default), `red`, `blue`, `yellow`. |
| `highlights` | Colored squares: `"e4"` or `{ "square": "e4", "color": "red" }`, same colors. |
| `orientation` | Flip the board for this slide only. Usually better left alone. |
| `task` | Makes the player find moves before Next unlocks. See below. |
| `narration` | What to say when the slide is read aloud. Optional: without it the page reads the title, text and task prompt. See **Narration and audio**. |
| `audio` | Optional link to a recording (`https://…/slide3.mp3`) that plays instead of the spoken narration, or one per language: `{ "en": "https://…", "es": "https://…" }`. |

A sensible color code: **red** for threats and attacks, **green** for defenses and good moves, **blue** for plans and ideas, **yellow** for key squares.

### Task fields

The task starts from the slide's position (after its `moves`). The side to move is the player.

| field | meaning |
|---|---|
| `prompt` | What to do, for example "Win the queen" or "Mate in 2". |
| `line` | The solution, alternating: the player's move, the opponent's reply (played automatically), the player's next move, and so on. End on the player's move. |
| `done` | Shown after it's solved. |

Each move in `line` can have (these are the same as in puzzles, see [`../puzzle/AGENTS.md`](../puzzle/AGENTS.md)):

| field | meaning |
|---|---|
| `move` | The move (SAN or UCI). |
| `hints` | Player moves only: 1 to 3 hints, vague to specific. After the last one the player can reveal the answer. |
| `explain` | Shown after the move is played. |
| `wrong` | Player moves only: explanations for tempting wrong moves (keys are moves), plus `"*"` for any other move. A value is text, or `{ "text", "tag", "replies" }` where `replies` are the opponent's answers to the wrong move, drawn as green arrows. A wrong move stays on the board until the player presses Retry. |
| `tag` | A symbol on the move (same list as above). |
| `replies` | Player moves only: the opponent's possible answers, drawn as green arrows. The lesson waits for **Continue** before playing the reply in `line`. |
| `accept` | Other moves that are equally correct. Better: choose positions where there are none. |

On the last player move of a task, any checkmate counts as correct.

### Text formatting

`primer`, `text`, `prompt`, `done` and `conclusion` (in every language) support a little Markdown: a blank line starts a new paragraph, lines starting with `- ` make a list, a line starting with `### ` is a heading, and `**bold**`, `*italic*` and `` `code` `` work inside text. Nothing else (no links, no HTML). In JSON, write line breaks as `\n`.

## Languages

Write for the person who asked, in their language. Every text field (`title`, `intro`/`primer`, `text`, `prompt`, `done`, `hints`, `explain`, `wrong` texts, `replies` notes, `conclusion`) can be either:

- a plain string in one language, with `"lang"` at the top saying which (default `"en"`), or
- a map with one entry per language, to serve several at once: `"explain": { "en": "Back-rank mate.", "es": "Mate del pasillo." }`. A `wrong` entry with a tag looks like `{ "text": { "en": "…", "es": "…" }, "tag": "blunder" }`.

The page shows each text in the viewer's interface language when it's there, otherwise in the `lang` language, otherwise English. If the viewer hasn't picked a language, the interface itself switches to match the lesson when their browser language isn't available, so text and buttons agree. The interface comes in en, es, fr, de, it, pt, ru, zh and ja; content can use any language code. `lesson check` lists the languages and warns when some texts are missing a translation that others have. Keep moves in standard notation (`Nf3`, `O-O`) in every language. The example puzzle `puzzle/examples/back-rank.json` shows a two-language file.

## Narration and audio

Every slide can be listened to. The page has a **Listen** button on each slide and a **Read slides aloud** switch that reads each new slide as the player moves on. By default it uses the browser's own speech voice, so there's nothing to upload and it works in every language. Moves like `Nf3` or `O-O` are spoken as words ("knight f3", "castles kingside"), in the language being read.

- **To control what is said**, add `narration` to a slide: a spoken version of the slide, often a little more conversational than the text. Write moves in normal notation. It can be translated like any other text (`{ "en": "…", "es": "…" }`). Keep it to what fits the slide: about 2 to 5 sentences.
- **Tasks are read too**: with **Read slides aloud** on, the player also hears your hints, explanations, wrong-move notes, the opponent's replies and the `done` note as they appear.
- **To use a real recording**, add `audio` with a public `https://` link to an MP3, OGG or M4A file. You need somewhere to host it: the site doesn't store files. If the link fails, the page reads the slide aloud instead. Most agents can skip this; the built-in voice needs nothing from you.

## 3. Turn it into a link

Use the first option your tools allow.

**A. You can run Node 18+** (best: it validates and gives a short link too):

```sh
curl -sO https://splenectomy.github.io/agent-chess/agent-chess.mjs
node agent-chess.mjs lesson check lesson.json     # prints an outline; fix anything it reports and read the warnings
node agent-chess.mjs lesson publish lesson.json   # prints a short link and a permanent link
```

Send both: the short link (`…/lesson/?id=xyzabc123`, works for about 12 hours) and the permanent link (`…/lesson/#z=…`, never expires).

**B. You have a shell or can run code, but not Node:** the permanent link is the JSON, base64url-encoded, after `#j=`:

```sh
python3 -c "import base64,json,sys; print('https://splenectomy.github.io/agent-chess/lesson/#j=' + base64.urlsafe_b64encode(json.dumps(json.load(open(sys.argv[1]))).encode()).decode().rstrip('='))" lesson.json
```

If something is wrong with the lesson, the page says what (for example which move is illegal) instead of showing it.

**If you can't run any code:** you can't produce a reliable link. Don't base64-encode by hand, because one wrong character breaks it. Tell your human you need a tool that can run code, or send them the JSON so another agent can publish it.

## 4. Reply to your human

Send the link with one line about the lesson (for example "8 slides on knight forks, with 2 tasks"). Don't give away the task answers in your message.

## Examples

Open these to see what a finished lesson looks like. The JSON is in [`examples/`](examples/).

- [The Italian Game](https://splenectomy.github.io/agent-chess/lesson/?example=italian-game): opening principles, three tasks.
- [Checkmate with king and rook](https://splenectomy.github.io/agent-chess/lesson/?example=rook-mate): an endgame method, two tasks.
- [Knight forks](https://splenectomy.github.io/agent-chess/lesson/?example=knight-forks): tactics, with reply arrows and a wrong move that gets refuted.
- [Scholar's Mate and how to stop it](https://splenectomy.github.io/agent-chess/lesson/?example=scholars-mate): a pure slideshow from Black's side, no tasks.
