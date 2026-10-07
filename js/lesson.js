// Agent Chess lesson player: a slideshow of positions with explanations, arrows and highlights.
// A slide can hold a task (a puzzle-style line) that the player must solve before going on.

import { Chess } from '../vendor/chess.js';
import { VERSION } from './version.js';
import { $, el, copy, wireStyleMenu, store, toast } from './ui.js';
import { TAGS } from './tags.js';
import { validateLesson, LESSON_TOPIC_PREFIX } from './lesson-core.js';
import { drawBoard, wireBoardInput, askPromotion, parseTyped } from './board-view.js';
import { Solver, renderFeedback, solverButtons, continueButton } from './solver.js';
import { t, loc, locWith, lang, setLang, chooseLang, onLangChange, wireLangPicker, setContentLang } from './i18n.js';
import { loadShared, permanentLink } from './share-load.js';
import { Narrator, canSpeak, autoRead as autoReadOn, setAutoRead, feedbackSpeech } from './narrator.js';

const L = {
  ls: null,
  source: null,
  idx: 0,
  seen: 0, // furthest slide visited
  finished: false,
  solvers: {}, // slide index -> Solver
  sel: null, // selection on a slide's board before the task starts
};

// ---------- small markdown: paragraphs, "- " lists, "### " headings, **bold**, *italic*, `code` ----------
function inline(text) {
  const out = [];
  const re = /(\*\*([^*]+)\*\*|\*([^*]+)\*|`([^`]+)`)/g;
  let at = 0;
  let m;
  while ((m = re.exec(text))) {
    if (m.index > at) out.push(text.slice(at, m.index));
    if (m[2]) out.push(el('strong', { text: m[2] }));
    else if (m[3]) out.push(el('em', { text: m[3] }));
    else out.push(el('code', { text: m[4] }));
    at = m.index + m[0].length;
  }
  if (at < text.length) out.push(text.slice(at));
  return out;
}

function rich(text) {
  const nodes = [];
  for (const block of String(loc(text) || '').split(/\n\s*\n/)) {
    const lines = block.split('\n').map((l) => l.trim()).filter(Boolean);
    let list = null;
    let para = [];
    const flush = () => { if (para.length) { nodes.push(el('p', {}, ...inline(para.join(' ')))); para = []; } };
    for (const line of lines) {
      const li = /^[-*•]\s+(.*)$/.exec(line);
      const h = /^#{1,4}\s+(.*)$/.exec(line);
      if (li) {
        flush();
        if (!list) { list = el('ul'); nodes.push(list); }
        list.append(el('li', {}, ...inline(li[1])));
      } else if (h) {
        flush();
        list = null;
        nodes.push(el('h4', {}, ...inline(h[1])));
      } else {
        list = null;
        para.push(line);
      }
    }
    flush();
  }
  return nodes;
}

// "1. e4 e5 2. Nf3" from a slide's demo moves.
function movesLabel(slide) {
  const c = new Chess(slide.fenStart);
  const parts = [];
  slide.moves.forEach((m, i) => {
    const n = c.moveNumber();
    if (c.turn() === 'w') parts.push(`${n}. ${m.san}`);
    else parts.push(i === 0 ? `${n}... ${m.san}` : m.san);
    c.move(m.san);
  });
  return parts.join(' ');
}

// ---------- narration ----------
const narrator = new Narrator(() => renderVoice());

// What to read for a slide: its "narration", else its title, text and task prompt.
function slideSpeech(s) {
  if (s.narration) return locWith(s.narration);
  const parts = [s.title, s.text, s.task && s.task.prompt].filter(Boolean).map(locWith);
  return { text: parts.map((p) => p.text).join('\n\n'), lang: (parts[0] || {}).lang || lang() };
}
const hasVoice = (s) => !!s && (canSpeak() || !!s.audio);

function readSlide() {
  const s = slide();
  if (!s || L.finished) return;
  const speech = slideSpeech(s);
  const speakIt = () => narrator.speak(speech.text, speech.lang);
  if (s.audio) {
    const url = typeof s.audio === 'string' ? s.audio : locWith(s.audio).text;
    narrator.play(url, () => { if (canSpeak()) { toast(t('ls.audioFailed')); speakIt(); } });
  } else speakIt();
}

function renderVoice() {
  const s = L.ls && slide();
  const box = $('ls-voice');
  box.hidden = !hasVoice(s) || L.finished;
  const btn = $('ls-listen');
  btn.textContent = narrator.speaking ? t('ls.stopListening') : t('ls.listen');
  btn.title = t('ls.listenTitle');
  btn.classList.toggle('speaking', narrator.speaking);
  $('ls-auto').checked = autoReadOn();
}

// ---------- state helpers ----------
const slide = () => L.ls.slides[L.idx];

function solverFor(i) {
  const s = L.ls.slides[i];
  if (!s.task) return null;
  if (!L.solvers[i]) {
    let wasSolved = false;
    L.solvers[i] = new Solver({ fen: s.fen, line: s.task.line, solverColor: s.task.solverColor,
      onChange: () => {
        const S = L.solvers[i];
        // Read the "done" note once, right after the task is solved.
        if (S && S.solved && !wasSolved && s.task.done && autoReadOn() && L.userActed && L.idx === i) {
          const d = locWith(s.task.done);
          narrator.speak(d.text, d.lang, { queue: true });
        }
        wasSolved = !!(S && S.solved);
        if (L.idx === i) render();
      },
      onFeedback: (f) => { if (autoReadOn() && L.userActed && L.idx === i) narrator.speak(feedbackSpeech(f), lang(), { queue: true }); } });
  }
  return L.solvers[i];
}

// The furthest slide the player may open: up to and including the first unsolved task.
function reachable() {
  for (let i = 0; i < L.ls.slides.length; i++) {
    const S = L.ls.slides[i].task ? solverFor(i) : null;
    if (S && !S.solved) return i;
  }
  return L.ls.slides.length - 1;
}

const canMove = () => {
  if (L.finished) return false;
  const S = solverFor(L.idx);
  return !!S && S.canMove();
};

function go(i) {
  const n = L.ls.slides.length;
  if (i < 0 || i >= n || i > reachable()) return;
  L.idx = i;
  L.finished = false;
  L.sel = null;
  if (i > 0 && L.seen === 0) $('ls-primer').open = false; // keep the slide text in view; the primer stays one click away
  L.seen = Math.max(L.seen, i);
  const S = solverFor(i);
  if (S) S.sel = null;
  narrator.stop();
  render();
  if (autoReadOn() && L.userActed) readSlide();
}

function next() {
  if (L.finished) return;
  const S = solverFor(L.idx);
  if (S && !S.solved) return;
  if (L.idx < L.ls.slides.length - 1) go(L.idx + 1);
  else { L.finished = true; narrator.stop(); render(); }
}

function prev() {
  if (L.finished) { L.finished = false; render(); return; }
  go(L.idx - 1);
}

function restartLesson() {
  for (const S of Object.values(L.solvers)) clearTimeout(S.timer);
  L.solvers = {};
  L.seen = 0;
  L.finished = false;
  go(0);
  $('ls-primer').open = true;
}

// ---------- rendering ----------
function orientation() {
  const s = slide();
  return s.orientation || L.ls.orientation;
}

function renderBoard() {
  const s = slide();
  const S = solverFor(L.idx);
  const flip = orientation() === 'b';
  const common = { board: $('board'), arrowsG: $('arrows'), flip };
  if (S && S.started && !L.finished) {
    const d = S.decor();
    drawBoard({ ...common, chess: d.chess, last: d.last, lastClass: d.lastClass, badge: d.badge, arrows: d.arrows, sel: S.sel,
      legal: S.sel && canMove() ? S.chess.moves({ square: S.sel, verbose: true }) : [],
      movableColor: canMove() ? S.chess.turn() : null });
    return;
  }
  if (S && S.started) {
    const d = S.decor();
    drawBoard({ ...common, chess: d.chess, last: d.last, badge: d.badge });
    return;
  }
  // The slide as the author set it up (also a task before the first try).
  const last = s.moves[s.moves.length - 1] || null;
  const sel = S ? S.sel : null;
  drawBoard({ ...common, chess: S ? S.chess : new Chess(s.fen), last, badge: s.tag && last ? { sq: last.to, tag: s.tag } : null,
    arrows: s.arrows, highlights: s.highlights, sel,
    legal: sel && canMove() ? S.chess.moves({ square: sel, verbose: true }) : [],
    movableColor: canMove() ? S.chess.turn() : null });
}

function render() {
  const ls = L.ls;
  const s = slide();
  const S = solverFor(L.idx);
  const n = ls.slides.length;
  renderBoard();

  // Line above the board.
  let turn;
  if (L.finished) turn = t('ls.complete');
  else if (S) turn = S.statusText();
  else if (s.moves.length) {
    turn = el('span', {}, movesLabel(s), s.tag ? el('span', { class: `sym tag-${s.tag}`, title: t(`tag.${s.tag}`), text: TAGS[s.tag].symbol }) : null);
  }
  else turn = t('sv.toMove', { color: new Chess(s.fen).turn() });
  $('ls-turn').replaceChildren(el('span', { class: `pb-swatch ${S ? S.solverColor : new Chess(s.fen).turn()}`, 'aria-hidden': 'true' }), turn);

  // Slide panel.
  $('ls-slide').hidden = L.finished;
  $('ls-slide-kicker').textContent = `${t('ls.slideOf', { i: L.idx + 1, n })}${s.task ? ` · ${t('ls.yourTurnTag')}` : ''}`;
  $('ls-slide-title').textContent = loc(s.title);
  $('ls-slide-title').hidden = !s.title;
  $('ls-slide-text').replaceChildren(...rich(s.text));
  $('ls-task').hidden = !S;
  if (S) {
    $('ls-task-head').replaceChildren(el('span', { class: `pb-swatch ${S.solverColor}`, 'aria-hidden': 'true' }), S.solved ? t('ls.taskSolved') : t('ls.yourTurn', { color: S.solverColor }));
    $('ls-task-prompt').replaceChildren(...rich(s.task.prompt || t('ls.defaultPrompt')));
    renderFeedback($('ls-feedback'), S.feedback, t('sv.emptyFeedback'));
    if (S.solved && s.task.done) $('ls-feedback').append(el('div', { class: 'ls-done-note rich' }, ...rich(s.task.done)));
    $('ls-progress').replaceChildren(...continueButton(S, { onRetry: () => { if (canMove()) $('move-input').focus(); } }));
    $('move-form').hidden = S.solved;
    $('move-input').disabled = !canMove();
    const acts = solverButtons(S, { onRetry: () => { if (canMove()) $('move-input').focus(); } });
    if (S.started && !S.busy) acts.push(el('button', { class: 'btn', type: 'button', text: S.solved ? t('ls.tryItAgain') : t('ls.resetPosition'), onclick: () => S.restart() }));
    $('ls-task-actions').replaceChildren(...acts);
  }

  // End panel.
  const end = $('ls-end');
  end.hidden = !L.finished;
  if (L.finished) {
    const solvers = Object.values(L.solvers);
    const mistakes = solvers.reduce((a, x) => a + x.mistakes, 0);
    const hints = solvers.reduce((a, x) => a + x.hintsUsed, 0);
    const tasks = ls.slides.filter((x) => x.task).length;
    end.replaceChildren(
      el('h2', { text: t('ls.complete') }),
      tasks ? el('p', { class: 'pz-stats', text: t('ls.stats', { tasks: t('ls.tasks', { n: tasks }), mistakes: t('pz.mistakes', { n: mistakes }), hints: t('pz.hints', { n: hints }) }) }) : null,
      ls.conclusion ? el('div', { class: 'rich' }, ...rich(ls.conclusion)) : null,
      el('div', { class: 'actions-row' },
        el('button', { class: 'btn', type: 'button', text: t('ls.backToLast'), onclick: prev }),
        el('button', { class: 'btn primary', type: 'button', text: t('common.startOver'), onclick: restartLesson })),
    );
  }

  // Navigation.
  const reach = reachable();
  $('ls-prev').disabled = L.idx === 0 && !L.finished;
  const locked = !!S && !S.solved;
  const nextBtn = $('ls-next');
  nextBtn.disabled = L.finished || locked;
  nextBtn.textContent = L.idx === n - 1 ? t('ls.finish') : t('ls.next');
  nextBtn.classList.toggle('go', !nextBtn.disabled);
  // A second Next right under the slide text, where the reader's eyes already are.
  $('ls-inline-next').replaceChildren(...(L.finished || locked ? [] : [el('button', { class: 'btn go wide', type: 'button', id: 'ls-next-inline', onclick: next },
    L.idx === n - 1 ? t('ls.finishLesson') : t('ls.nextSlide'), el('span', { 'aria-hidden': 'true', text: L.idx === n - 1 ? '✓' : '▶' }))]));
  nextBtn.title = locked ? t('ls.locked') : '';
  $('ls-count').textContent = `${L.idx + 1} / ${n}`;
  $('ls-dots').replaceChildren(...ls.slides.map((x, i) => el('button', {
    class: ['ls-dot', i <= L.seen && 'seen', x.task && 'task', i === L.idx && !L.finished && 'current'].filter(Boolean).join(' '),
    type: 'button', disabled: i > reach, 'aria-label': `${t(x.task ? 'ls.dotTask' : 'ls.dot', { i: i + 1 })}${x.title ? `: ${loc(x.title)}` : ''}`,
    title: `${i + 1}. ${loc(x.title) || t(x.task ? 'ls.dotTask' : 'ls.dot', { i: i + 1 })}`, onclick: () => go(i),
  })));
  renderTextState();
  renderVoice();
}

function renderTextState() {
  const s = slide();
  const S = solverFor(L.idx);
  const lines = [
    `Lesson: ${loc(L.ls.title)}${L.ls.author ? ` by ${loc(L.ls.author)}` : ''}`,
    L.finished ? 'Lesson complete.' : `Slide ${L.idx + 1} of ${L.ls.slides.length}${s.title ? `: ${loc(s.title)}` : ''}`,
  ];
  if (!L.finished) {
    if (s.moves.length) lines.push(`Moves on this slide: ${movesLabel(s)}${s.tag ? ` (${TAGS[s.tag].label})` : ''}`);
    if (!S || !S.started) {
      if (s.arrows.length) lines.push(`Arrows: ${s.arrows.map((a) => `${a.from}-${a.to} (${a.color})`).join(', ')}`);
      if (s.highlights.length) lines.push(`Highlighted: ${s.highlights.map((h) => `${h.sq} (${h.color})`).join(', ')}`);
    }
    if (S) {
      lines.push(`Task: ${S.solverColor === 'w' ? 'White' : 'Black'} to move.${S.solved ? ' Solved.' : ' Solve it to unlock Next.'}`, ...S.textLines());
    } else {
      lines.push(`FEN: ${s.fen}`, L.idx < L.ls.slides.length - 1 ? 'Press Next to continue.' : 'Press Finish to end the lesson.');
    }
  }
  $('text-state').textContent = lines.join('\n');
}

// ---------- input ----------
function attempt(from, to) {
  const S = solverFor(L.idx);
  return canMove() && S.attempt(from, to, null, (f, t, color, pick) => askPromotion($('promo'), color, pick));
}

function wireInput() {
  wireBoardInput($('board'), {
    canMove,
    chess: () => solverFor(L.idx).chess,
    getSel: () => solverFor(L.idx).sel,
    setSel: (sq) => { solverFor(L.idx).sel = sq; },
    attempt,
    redraw: renderBoard,
  });
  $('move-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const input = $('move-input');
    const S = solverFor(L.idx);
    if (!canMove() || !input.value.trim()) return;
    const mv = parseTyped(S.chess, input.value);
    if (!mv) {
      const typed = input.value.trim();
      S.feedback.push({ kind: 'bad', msg: () => t('sv.illegalTyped', { text: typed }) });
      render();
      return;
    }
    input.value = '';
    S.play(mv.from + mv.to + (mv.promotion || ''));
  });
  // Narration may only start after the player has done something (browser autoplay rules).
  for (const ev of ['pointerdown', 'keydown']) document.addEventListener(ev, () => { L.userActed = true; }, { capture: true });
  $('ls-listen').addEventListener('click', () => (narrator.speaking ? narrator.stop() : readSlide()));
  $('ls-auto').addEventListener('change', (e) => {
    setAutoRead(e.target.checked);
    if (e.target.checked && !narrator.speaking) readSlide();
    else if (!e.target.checked) narrator.stop();
  });
  $('ls-next').addEventListener('click', next);
  $('ls-prev').addEventListener('click', prev);
  $('ls-restart').addEventListener('click', restartLesson);
  $('ls-copy').addEventListener('click', async () => {
    const link = await permanentLink(L.source);
    copy(link, location.hash || !L.source ? t('common.linkCopied') : t('common.permanentLinkCopied'));
  });
  document.addEventListener('keydown', (e) => {
    if (e.target.closest && e.target.closest('input, textarea, select, [contenteditable]')) return;
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    if (e.key === 'ArrowRight') { e.preventDefault(); next(); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); prev(); }
  });
}

function showMissing(title, text) {
  $('ls-loading').hidden = true;
  $('ls-missing').hidden = false;
  $('ls-missing-title').textContent = title;
  $('ls-missing-text').textContent = text;
}

function renderIntro() {
  const ls = L.ls;
  document.title = t('ls.titleNamed', { title: loc(ls.title) });
  const tasks = ls.slides.filter((x) => x.task).length;
  $('ls-kicker').textContent = [ls.author ? t('ls.by', { author: loc(ls.author) }) : t('ls.title'), loc(ls.level),
    t('ls.slides', { n: ls.slides.length }), tasks ? t('ls.tasks', { n: tasks }) : null].filter(Boolean).join(' · ');
  $('ls-title').textContent = loc(ls.title);
  if (ls.primer) {
    $('ls-primer').hidden = false;
    $('ls-primer-body').replaceChildren(...rich(ls.primer));
  }
}

// ---------- boot ----------
$('app-version').textContent = `v${VERSION}`;
wireStyleMenu(() => { if (L.ls) renderBoard(); });

let source;
let loadError = null;
try {
  source = await loadShared(LESSON_TOPIC_PREFIX, 'lesson');
} catch (err) {
  loadError = err;
  source = undefined;
}
const checked = source ? validateLesson(source) : null;
// The interface follows the viewer's choice, else the browser, else the lesson's own language.
await setLang(chooseLang(checked && checked.ok ? checked.lesson.langs : []));
wireLangPicker();
document.title = `${t('ls.title')} — Agent Chess v${VERSION}`;
if (loadError) {
  showMissing(loadError.expired ? t('ls.expired') : t('ls.loadFailed'), loadError.expired ? t('load.expiredLesson') : loadError.message || String(loadError));
} else if (source === null) {
  showMissing(t('ls.noneTitle'), t('ls.noneText'));
} else if (!checked.ok) {
  showMissing(t('ls.problem'), checked.errors.join(' '));
} else {
  L.ls = checked.lesson;
  L.source = source;
  setContentLang(L.ls.lang);
  $('ls-loading').hidden = true;
  $('ls-game').hidden = false;
  renderIntro();
  $('ls-primer').open = true;
  wireInput();
  go(0);
}
onLangChange(() => { if (L.ls) { narrator.stop(); renderIntro(); render(); } });
window.addEventListener('pagehide', () => narrator.stop());
