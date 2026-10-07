// Agent Chess puzzle player. Loads a puzzle from ?id=<relay id>, #z=/#j= (inside the link)
// or ?example=<name>, then lets the player solve it with hints and explanations.

import { Chess } from '../vendor/chess.js';
import { VERSION } from './version.js';
import { $, el, copy, wireStyleMenu } from './ui.js';
import { TAGS } from './tags.js';
import { validatePuzzle, PUZZLE_TOPIC_PREFIX } from './puzzle-core.js';
import { drawBoard, wireBoardInput, askPromotion, parseTyped } from './board-view.js';
import { Solver, renderFeedback, solverButtons, continueButton } from './solver.js';
import { t, loc, setLang, chooseLang, onLangChange, wireLangPicker, setContentLang } from './i18n.js';
import { loadShared, permanentLink } from './share-load.js';
import { Narrator, voiceControls, feedbackSpeech, autoRead, userActed } from './narrator.js';
import { locWith, lang } from './i18n.js';

const P = {
  pz: null,
  S: null, // the Solver
  replay: null, // ply index while stepping through the solution after solving
  source: null,
};

// ---------- reading aloud ----------
const narrator = new Narrator(() => voice && voice.refresh());
let voice = null;
let wasSolved = false;

function introSpeech() {
  const pz = P.pz;
  if (pz.narration) return locWith(pz.narration);
  const title = locWith(pz.title);
  const intro = pz.intro ? locWith(pz.intro) : { text: t('pz.defaultIntro', { color: pz.solverColor }), lang: lang() };
  return { text: `${title.text}.\n${intro.text}`, lang: intro.lang };
}
const solvedSpeech = () => `${t('pz.solved')} ${P.pz.conclusion ? locWith(P.pz.conclusion).text : ''}`;

// Listen: the latest message, or the introduction before the first move.
function readNow() {
  const S = P.S;
  if (S.solved) return narrator.speak(solvedSpeech());
  if (S.feedback.length) return narrator.speak(feedbackSpeech(S.feedback[S.feedback.length - 1]));
  const sp = introSpeech();
  if (P.pz.audio && !P.pz.narration) {
    const url = typeof P.pz.audio === 'string' ? P.pz.audio : locWith(P.pz.audio).text;
    return narrator.play(url, () => narrator.speak(sp.text, sp.lang));
  }
  return narrator.speak(sp.text, sp.lang);
}
const autoOn = () => autoRead() && userActed();

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
  renderFeedback($('pz-feedback'), S.feedback, t('sv.emptyFeedback'));
  $('pz-progress').replaceChildren(...continueButton(S, { onRetry: () => { if (canMove()) $('move-input').focus(); } }));
  $('move-form').hidden = S.solved;
  $('move-input').disabled = !canMove();
  const acts = solverButtons(S, { onRetry: () => { if (canMove()) $('move-input').focus(); } });
  if (!S.solved) acts.push(el('button', { class: 'btn', type: 'button', text: t('common.startOver'), onclick: restart }));
  acts.push(el('button', { class: 'btn', type: 'button', text: t('common.copyLink'), onclick: copyLink }));
  $('pz-actions').replaceChildren(...acts);
  renderDone();
  renderTextState();
  if (S.solved && !wasSolved && autoOn()) narrator.speak(solvedSpeech(), lang(), { queue: true });
  wasSolved = S.solved;
  if (voice) voice.refresh();
}

function restart() {
  P.replay = null;
  narrator.stop();
  wasSolved = false;
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
  const stats = clean ? t('pz.statsClean') : t(revealed ? 'pz.statsRevealed' : 'pz.stats', { mistakes: t('pz.mistakes', { n: S.mistakes }), hints: t('pz.hints', { n: S.hintsUsed }) });
  const lineItems = pz.line.map((st, i) => {
    const c = new Chess(st.fenBefore);
    const num = c.moveNumber();
    const label = c.turn() === 'w' ? `${num}. ${st.move}` : `${num}... ${st.move}`;
    return el('li', { class: st.solver ? 'mine' : 'theirs' },
      el('button', { class: 'op-move' + (P.replay === i + 1 ? ' current' : ''), type: 'button', onclick: () => { P.replay = i + 1; render(); } },
        label, st.tag ? el('span', { class: `sym tag-${st.tag}`, title: t(`tag.${st.tag}`), text: TAGS[st.tag].symbol }) : null),
      st.explain ? el('span', { text: ' ' + loc(st.explain) }) : null);
  });
  box.replaceChildren(
    el('h2', { text: clean ? t('pz.solvedPerfect') : t('pz.solved') }),
    el('p', { class: 'pz-stats', text: stats }),
    pz.conclusion ? el('div', { class: 'pz-conclusion' }, el('h3', { text: t('pz.idea') }), el('p', { text: loc(pz.conclusion) })) : null,
    el('h3', { text: t('pz.fullSolution') }),
    el('ol', { class: 'pz-line' }, ...lineItems),
    el('div', { class: 'actions-row' },
      el('button', { class: 'btn', type: 'button', text: '◀', 'aria-label': t('pz.prevPos'), disabled: (P.replay ?? pz.line.length) === 0, onclick: () => { P.replay = Math.max(0, (P.replay ?? pz.line.length) - 1); render(); } }),
      el('button', { class: 'btn', type: 'button', text: '▶', 'aria-label': t('pz.nextPos'), disabled: P.replay == null || P.replay >= pz.line.length, onclick: () => { P.replay = Math.min(pz.line.length, (P.replay ?? pz.line.length) + 1); if (P.replay === pz.line.length) P.replay = null; render(); } }),
      el('button', { class: 'btn primary', type: 'button', text: t('pz.tryAgain'), onclick: restart })),
  );
}

function renderTextState() {
  const lines = [
    `Puzzle: ${loc(P.pz.title)}${P.pz.author ? ` by ${loc(P.pz.author)}` : ''}`,
    `You play: ${P.pz.solverColor === 'w' ? 'White' : 'Black'}`,
    ...P.S.textLines(),
  ];
  $('text-state').textContent = lines.join('\n');
}

async function copyLink() {
  const link = await permanentLink(P.source);
  copy(link, location.hash || !P.source ? t('common.linkCopied') : t('common.permanentLinkCopied'));
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
      const typed = input.value.trim();
      P.S.feedback.push({ kind: 'bad', msg: () => t('sv.illegalTyped', { text: typed }) });
      render();
      return;
    }
    input.value = '';
    P.S.play(mv.from + mv.to + (mv.promotion || ''));
  });
}

function renderIntro() {
  const pz = P.pz;
  document.title = t('pz.titleNamed', { title: loc(pz.title) });
  const toFind = pz.line.filter((x) => x.solver).length;
  $('pz-kicker').textContent = `${pz.author ? t('pz.by', { author: loc(pz.author) }) : t('pz.title')}, ${t('pz.toFind', { n: toFind })}`;
  $('pz-title').textContent = loc(pz.title);
  $('pz-intro').textContent = loc(pz.intro) || t('pz.defaultIntro', { color: pz.solverColor });
}

// ---------- boot ----------
$('app-version').textContent = `v${VERSION}`;
wireStyleMenu(() => { if (P.S) renderBoard(); });

let source;
let loadError = null;
try {
  source = await loadShared(PUZZLE_TOPIC_PREFIX, 'puzzle');
} catch (err) {
  loadError = err;
  source = undefined;
}
const checked = source ? validatePuzzle(source) : null;
// The interface follows the viewer's choice, else the browser, else the puzzle's own language.
await setLang(chooseLang(checked && checked.ok ? checked.puzzle.langs : []));
wireLangPicker();
document.title = `${t('pz.title')} — Agent Chess v${VERSION}`;
if (loadError) {
  showMissing(loadError.expired ? t('pz.expired') : t('pz.loadFailed'), loadError.expired ? t('load.expiredPuzzle') : loadError.message || String(loadError));
} else if (source === null) {
  showMissing(t('pz.noneTitle'), t('pz.noneText'));
} else if (!checked.ok) {
  showMissing(t('pz.problem'), checked.errors.join(' '));
} else {
  P.pz = checked.puzzle;
  P.source = source;
  setContentLang(P.pz.lang);
  $('pz-loading').hidden = true;
  $('pz-game').hidden = false;
  renderIntro();
  P.S = new Solver({ fen: P.pz.fen, line: P.pz.line, solverColor: P.pz.solverColor, opponentFirst: P.pz.opponentFirst, onChange: render,
    onFeedback: (f) => { if (autoOn()) narrator.speak(feedbackSpeech(f), lang(), { queue: true }); } });
  voice = voiceControls(narrator, readNow, { title: 'pz.listenTitle' });
  $('pz-voice').replaceChildren(voice.el);
  wireInput();
  render();
}
onLangChange(() => { if (P.S) { narrator.stop(); renderIntro(); render(); } });
window.addEventListener('pagehide', () => narrator.stop());
