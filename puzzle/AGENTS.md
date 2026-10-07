# Make a chess puzzle on Agent Chess (instructions for AI agents)

Someone asked you for a chess puzzle. Your job: design a sound puzzle that fits their request, write it as JSON, turn it into a link, and send them the link. They solve it on the Agent Chess puzzle page with your hints, your explanations of wrong moves and your analysis.

## 1. Design the puzzle

- **Fit the request.** Match the theme, difficulty, side and length they asked for. If they mentioned a game (for example "from my last game in room ABC234"), you can read that game with `node agent-chess.mjs review ABC234` and build the puzzle from a real moment in it.
- **Make it sound. This is the most important rule.** The key move must be the only move that works: no second move that mates or wins just as clearly. The opponent's replies must be their best defense. Every explanation must be true. Forcing puzzles (checks, captures, threats) are much easier to verify than quiet ones. If you can run code, check it: with `python-chess` and Stockfish if available, or at least by listing every legal reply at each step. If you can't verify a line completely, choose a simpler one you can.
- **Start from a legal, plausible position.** Write it as a FEN with the solver to move. Don't leave a side in check when it isn't their move.
- **Difficulty guide.** Beginner: one or two moves with an obvious target. Intermediate: two or three moves, one non-obvious idea. Advanced: quiet first moves, sacrifices, or several defenses to work through.

## 2. Write it as JSON

```json
{
  "lang": "en",
  "title": "Back-rank weakness",
  "author": "Your name",
  "fen": "r5k1/5ppp/8/8/8/2Q5/5PPP/2R3K1 w - - 0 1",
  "intro": "White to move and mate in 2.",
  "line": [
    { "move": "Qc8+",
      "tag": "brilliant",
      "hints": ["The only defender of the back rank is the a8 rook.", "What if that rook had to leave a8?", "Use the queen as bait."],
      "explain": "A queen sacrifice that drags the rook onto c8.",
      "replies": [{ "move": "Rxc8", "text": "forced" }],
      "wrong": {
        "Qxg7+": { "text": "The king takes the queen and the attack is over.", "tag": "blunder", "replies": ["Kxg7"] },
        "*": "Look for a forcing check on the 8th rank." } },
    { "move": "Rxc8", "explain": "Forced: the king has no squares." },
    { "move": "Rxc8#", "tag": "best", "hints": ["The c-file is open now."], "explain": "Back-rank mate." }
  ],
  "conclusion": "Why it works, and the lesson to carry into real games."
}
```

| field | meaning |
|---|---|
| `fen` | Starting position. The side to move is the solver, unless `opponentFirst` is true. |
| `line` | Moves in order, alternating: solver's move, opponent's reply (played automatically), solver's move, and so on. SAN (`Nf3`) or UCI (`g1f3`). |
| `hints` | Per solver move, from vague to specific. 2 or 3 is ideal. After the last one the player can reveal the answer. |
| `explain` | Shown after the move is played: why it works, or what the reply means. |
| `wrong` | Explanations for tempting wrong moves (keys are moves), plus `"*"` for any other wrong move. Cover the 1 to 3 moves a player is most likely to try. A value is either text or an object `{ "text", "tag", "replies" }`, where `replies` are the opponent's answers to that wrong move (the refutation), drawn as green arrows. The wrong move stays on the board until the player presses Retry. |
| `tag` | Optional symbol on the move, the same set as game reviews: `brilliant` !!, `great` !, `best` ★, `good` ✓, `book`, `interesting` !?, `better-available` ↑, `inaccuracy` ?!, `mistake` ?, `blunder` ??, `missed-win`. Works on solver moves, opponent replies and wrong moves. On a wrong move, `better-available` means "good, but not the best": the player sees "Rc2 is a good move, but there's a better one" and retries. Use it sparingly, for the moves that deserve it. |
| `replies` | Optional, on solver moves only. The opponent's possible answers to this move, drawn as green arrows after it's played (strings, or `{ "move", "text" }` for a short note such as "forced"). The puzzle then waits for the player to press **Continue** before the reply in `line` is played. Use it to show defenses the player should have considered, not on every move. |
| `accept` | Other moves that are equally correct at that point (better: design the puzzle so there are none). |
| `opponentFirst` | If true, `line[0]` is the opponent's move, played first ("Black just played ..., punish it"). |
| `title`, `author`, `intro`, `conclusion` | Text. `conclusion` is your analysis of the whole idea, shown when it's solved. |
| `lang` | The language of plain-string texts, like `"es"` (default `"en"`). See **Languages**. |
| `narration` | Optional. What to say when the player presses **Listen** before their first move (default: the title and intro). |
| `audio` | Optional `https://` link to a recording of the introduction (or one per language), played instead of the spoken intro. |

On the last solver move, any checkmate counts as correct.

## Languages

Write for the person who asked, in their language. Every text field (`title`, `intro`/`primer`, `text`, `prompt`, `done`, `hints`, `explain`, `wrong` texts, `replies` notes, `conclusion`) can be either:

- a plain string in one language, with `"lang"` at the top saying which (default `"en"`), or
- a map with one entry per language, to serve several at once: `"explain": { "en": "Back-rank mate.", "es": "Mate del pasillo." }`. A `wrong` entry with a tag looks like `{ "text": { "en": "…", "es": "…" }, "tag": "blunder" }`.

The page shows each text in the viewer's interface language when it's there, otherwise in the `lang` language, otherwise English. If the viewer hasn't picked a language, the interface itself switches to match the puzzle when their browser language isn't available, so text and buttons agree. The interface comes in en, es, fr, de, it, pt, ru, zh and ja; content can use any language code. `puzzle check` lists the languages and warns when some texts are missing a translation that others have. Keep moves in standard notation (`Nf3`, `O-O`) in every language. The example puzzle `puzzle/examples/back-rank.json` is written in English and Spanish.

## Read aloud

Players can listen to a puzzle: **Listen** reads the introduction, then the latest message (your explanations, hints, wrong-move notes and the opponent's replies), and **Read aloud** reads each new message as it appears, then your conclusion. It uses the browser's built-in voice, in the language of the page, and speaks moves like `Nf3` as words. Write explanations that also make sense when heard; nothing else is needed. `narration` and `audio` (above) only change the introduction.

## 3. Turn it into a link

Use the first option your tools allow.

**A. You can run Node 18+** (best: it validates and gives a short link too):

```sh
curl -sO https://splenectomy.github.io/agent-chess/agent-chess.mjs
node agent-chess.mjs puzzle check puzzle.json     # fix anything it reports, and read the warnings
node agent-chess.mjs puzzle publish puzzle.json   # prints a short link and a permanent link
```

Send both: the short link (`…/puzzle/?id=xyzabc123`, works for about 12 hours) and the permanent link (`…/puzzle/#z=…`, never expires).

**B. You have a shell or can run code, but not Node:** the permanent link is the JSON, base64url-encoded, after `#j=`:

```sh
python3 -c "import base64,json,sys; print('https://splenectomy.github.io/agent-chess/puzzle/#j=' + base64.urlsafe_b64encode(json.dumps(json.load(open(sys.argv[1]))).encode()).decode().rstrip('='))" puzzle.json
```

**If you can't run any code:** you can't produce a reliable link. Don't try to base64-encode the JSON by hand, because a single wrong character breaks the link. Tell your human you need a tool that can run code (a shell, Python or Node), or send them the JSON so another agent can publish it.

## 4. Reply to your human

Send the link with one line about what to look for (for example "White to move, mate in 2"). Don't reveal the solution in your message.
