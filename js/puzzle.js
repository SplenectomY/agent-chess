// Agent Chess puzzle player. Loads a puzzle from ?id=<relay id>, #z=/#j= (inside the link)
// or ?example=<name>, then lets the player solve it with hints and explanations.

import { Chess } from '../vendor/chess.js';
import { VERSION } from './version.js';
import { $, el, copy, wireStyleMenu } from './ui.js';
import { TAGS } from './tags.js';
import { validatePuzzle, PUZZLE_TOPIC_PREFIX } from './puzzle-core.js';
import { drawBoard, wireBoardInput, askPromotion, parseTyped } from './board-view.js';
import { Solver, COLOR, renderFeedback, solverButtons, continueButton } from './solver.js';
import { loadShared, permanentLink } from './share-load.js';

const P = {
  pz: null,
  S: null, // the Solver
  replay: null, // ply index while stepping through the solution after solving
  source: null,
};

function showMissing(title, text) {
  $('pz-loading').hidden = true;
  $('pz-missing').hidden = false;
  $('pz-missing-title').textContent = title;
  $('pz-missing-text').textContent = text;
}

// ---------- board ----------
function renderBoard() {
  const S = P.S;
  const flip = P.pz.solverColor === 'b';
  if (P.replay != null) {
    const c = new Chess(P.pz.fen);
    for (let i = 0; i < P.replay; i++) c.move(P.pz.line[i].move);
    const st = P.replay ? P.pz.line[P.replay - 1] : null;
    drawBoard({ board: $('board'), arrowsG: $('arrows'), chess: c, flip, last: st,
      badge: st && st.tag ? { sq: st.to, tag: st.tag } : null, arrows: (st && st.replies) || [] });
    return;
  }
  const d = S.decor();
  drawBoard({ board: $('board'), arrowsG: $('arrows'), chess: d.chess, flip, last: d.last, lastClass: d.lastClass,
    badge: d.badge, arrows: d.arrows, sel: S.sel,
    legal: S.sel && canMove() ? S.chess.moves({ square: S.sel, verbose: true }) : [],
    movableColor: canMove() ? S.chess.turn() : null });
}

const canMove = () => !!P.S && P.replay == null && P.S.canMove();

// ---------- rendering ----------
function render() {
  const S = P.S;
  renderBoard();
  $('pz-turn').replaceChildren(el('span', { class: `pb-swatch ${P.pz.solverColor}`, 'aria-hidden': 'true' }), S.statusText());
  renderFeedback($('pz-feedback'), S.feedback, 'Make your move on the board or type it below.');
  $('pz-progress').replaceChildren(...continueButton(S));
  $('move-form').hidden = S.solved;
  $('move-input').disabled = !canMove();
  const acts = solverButtons(S, { onRetry: () => { if (canMove()) $('move-input').focus(); } });
  if (!S.solved) acts.push(el('button', { class: 'btn', type: 'button', text: 'Start over', onclick: restart }));
  acts.push(el('button', { class: 'btn', type: 'button', text: 'Copy link', onclick: copyLink }));
  $('pz-actions').replaceChildren(...acts);
  renderDone();
  renderTextState();
}

function restart() {
  P.replay = null;
  P.S.restart();
}

function renderDone() {
  const box = $('pz-done');
  const S = P.S;
  if (!S.solved) { box.hidden = true; return; }
  box.hidden = false;
  const pz = P.pz;
  const revealed = Object.keys(S.revealed).length;
  const clean = !S.mistakes && !S.hintsUsed && !revealed;
  const stats = clean ? 'Solved with no mistakes and no hints.' : `Solved with ${S.mistakes} mistake${S.mistakes === 1 ? '' : 's'} and ${S.hintsUsed} hint${S.hintsUsed === 1 ? '' : 's'}${revealed ? ', answer revealed' : ''}.`;
  const lineItems = pz.line.map((st, i) => {
    const c = new Chess(st.fenBefore);
    const num = c.moveNumber();
    const label = c.turn() === 'w' ? `${num}. ${st.move}` : `${num}... ${st.move}`;
    return el('li', { class: st.solver ? 'mine' : 'theirs' },
      el('button', { class: 'op-move' + (P.replay === i + 1 ? ' current' : ''), type: 'button', onclick: () => { P.replay = i + 1; render(); } },
        label, st.tag ? el('span', { class: `sym tag-${st.tag}`, title: TAGS[st.tag].label, text: TAGS[st.tag].symbol }) : null),
      st.explain ? el('span', { text: ' ' + st.explain }) : null);
  });
  box.replaceChildren(
    el('h2', { text: clean ? 'Solved! Perfect.' : 'Solved!' }),
    el('p', { class: 'pz-stats', text: stats }),
    pz.conclusion ? el('div', { class: 'pz-conclusion' }, el('h3', { text: 'The idea' }), el('p', { text: pz.conclusion })) : null,
    el('h3', { text: 'Full solution' }),
    el('ol', { class: 'pz-line' }, ...lineItems),
    el('div', { class: 'actions-row' },
      el('button', { class: 'btn', type: 'button', text: '◀', 'aria-label': 'Previous position', disabled: (P.replay ?? pz.line.length) === 0, onclick: () => { P.replay = Math.max(0, (P.replay ?? pz.line.length) - 1); render(); } }),
      el('button', { class: 'btn', type: 'button', text: '▶', 'aria-label': 'Next position', disabled: P.replay == null || P.replay >= pz.line.length, onclick: () => { P.replay = Math.min(pz.line.length, (P.replay ?? pz.line.length) + 1); if (P.replay === pz.line.length) P.replay = null; render(); } }),
      el('button', { class: 'btn primary', type: 'button', text: 'Try again', onclick: restart })),
  );
}

function renderTextState() {
  const lines = [
    `Puzzle: ${P.pz.title}${P.pz.author ? ` by ${P.pz.author}` : ''}`,
    `You play: ${COLOR[P.pz.solverColor]}`,
    ...P.S.textLines(),
  ];
  $('text-state').textContent = lines.join('\n');
}

async function copyLink() {
  const link = await permanentLink(P.source);
  copy(link, location.hash || !P.source ? 'Link copied' : 'Permanent link copied');
}

// ---------- input ----------
function attempt(from, to) {
  return canMove() && P.S.attempt(from, to, null, (f, t, color, pick) => askPromotion($('promo'), color, pick));
}

function wireInput() {
  wireBoardInput($('board'), {
    canMove,
    chess: () => P.S.chess,
    getSel: () => P.S.sel,
    setSel: (sq) => { P.S.sel = sq; },
    attempt,
    redraw: renderBoard,
  });
  $('move-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const input = $('move-input');
    if (!canMove() || !input.value.trim()) return;
    const mv = parseTyped(P.S.chess, input.value);
    if (!mv) {
      P.S.feedback.push({ kind: 'bad', text: `"${input.value.trim()}" isn't a legal move here.` });
      render();
      return;
    }
    input.value = '';
    P.S.play(mv.from + mv.to + (mv.promotion || ''));
  });
}

// ---------- boot ----------
document.title = `Puzzle — Agent Chess v${VERSION}`;
$('app-version').textContent = `v${VERSION}`;
wireStyleMenu(() => { if (P.S) renderBoard(); });

let source;
try {
  source = await loadShared(PUZZLE_TOPIC_PREFIX, 'puzzle');
} catch (err) {
  showMissing(err.expired ? 'Puzzle expired' : "Couldn't load the puzzle", err.message || String(err));
  source = undefined;
}
if (source === null) {
  showMissing('No puzzle here', 'This link has no puzzle in it. Puzzle links look like …/puzzle/?id=abc123xyz. Ask an agent to make one (see puzzle/AGENTS.md), or try the example.');
} else if (source !== undefined) {
  const r = validatePuzzle(source);
  if (!r.ok) {
    showMissing('This puzzle has a problem', r.errors.join(' '));
  } else {
    P.pz = r.puzzle;
    P.source = source;
    document.title = `${P.pz.title} — Agent Chess puzzle`;
    $('pz-loading').hidden = true;
    $('pz-game').hidden = false;
    const toFind = P.pz.line.filter((s) => s.solver).length;
    $('pz-kicker').textContent = `${P.pz.author ? `Puzzle by ${P.pz.author}` : 'Puzzle'}, ${toFind} move${toFind === 1 ? '' : 's'} to find`;
    $('pz-title').textContent = P.pz.title;
    $('pz-intro').textContent = P.pz.intro || `${COLOR[P.pz.solverColor]} to move. Find the best continuation.`;
    P.S = new Solver({ fen: P.pz.fen, line: P.pz.line, solverColor: P.pz.solverColor, opponentFirst: P.pz.opponentFirst, onChange: render });
    wireInput();
    render();
  }
}
