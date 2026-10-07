// Agent Chess lesson player: a slideshow of positions with explanations, arrows and highlights.
// A slide can hold a task (a puzzle-style line) that the player must solve before going on.

import { Chess } from '../vendor/chess.js';
import { VERSION } from './version.js';
import { $, el, copy, wireStyleMenu } from './ui.js';
import { TAGS } from './tags.js';
import { validateLesson, LESSON_TOPIC_PREFIX } from './lesson-core.js';
import { drawBoard, wireBoardInput, askPromotion, parseTyped } from './board-view.js';
import { Solver, COLOR, renderFeedback, solverButtons, continueButton } from './solver.js';
import { loadShared, permanentLink } from './share-load.js';

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
  for (const block of String(text || '').split(/\n\s*\n/)) {
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

// ---------- state helpers ----------
const slide = () => L.ls.slides[L.idx];

function solverFor(i) {
  const s = L.ls.slides[i];
  if (!s.task) return null;
  if (!L.solvers[i]) {
    L.solvers[i] = new Solver({ fen: s.fen, line: s.task.line, solverColor: s.task.solverColor, onChange: () => { if (L.idx === i) render(); } });
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
  render();
}

function next() {
  if (L.finished) return;
  const S = solverFor(L.idx);
  if (S && !S.solved) return;
  if (L.idx < L.ls.slides.length - 1) go(L.idx + 1);
  else { L.finished = true; render(); }
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
  if (L.finished) turn = 'Lesson complete';
  else if (S) turn = S.statusText();
  else if (s.moves.length) {
    turn = el('span', {}, movesLabel(s), s.tag ? el('span', { class: `sym tag-${s.tag}`, title: TAGS[s.tag].label, text: TAGS[s.tag].symbol }) : null);
  }
  else turn = `${COLOR[new Chess(s.fen).turn()]} to move`;
  $('ls-turn').replaceChildren(el('span', { class: `pb-swatch ${S ? S.solverColor : new Chess(s.fen).turn()}`, 'aria-hidden': 'true' }), turn);

  // Slide panel.
  $('ls-slide').hidden = L.finished;
  $('ls-slide-kicker').textContent = `Slide ${L.idx + 1} of ${n}${s.task ? ' · your turn' : ''}`;
  $('ls-slide-title').textContent = s.title;
  $('ls-slide-title').hidden = !s.title;
  $('ls-slide-text').replaceChildren(...rich(s.text));
  $('ls-task').hidden = !S;
  if (S) {
    $('ls-task-head').replaceChildren(el('span', { class: `pb-swatch ${S.solverColor}`, 'aria-hidden': 'true' }), S.solved ? 'Task solved' : `Your turn: ${COLOR[S.solverColor]} to move`);
    $('ls-task-prompt').replaceChildren(...rich(s.task.prompt || 'Find the best move.'));
    renderFeedback($('ls-feedback'), S.feedback, 'Make your move on the board or type it below.');
    if (S.solved && s.task.done) $('ls-feedback').append(el('div', { class: 'ls-done-note rich' }, ...rich(s.task.done)));
    $('ls-progress').replaceChildren(...continueButton(S));
    $('move-form').hidden = S.solved;
    $('move-input').disabled = !canMove();
    const acts = solverButtons(S, { onRetry: () => { if (canMove()) $('move-input').focus(); } });
    if (S.started && !S.busy) acts.push(el('button', { class: 'btn', type: 'button', text: S.solved ? 'Try it again' : 'Reset position', onclick: () => S.restart() }));
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
      el('h2', { text: 'Lesson complete' }),
      tasks ? el('p', { class: 'pz-stats', text: `${tasks} task${tasks === 1 ? '' : 's'} solved with ${mistakes} mistake${mistakes === 1 ? '' : 's'} and ${hints} hint${hints === 1 ? '' : 's'}.` }) : null,
      ls.conclusion ? el('div', { class: 'rich' }, ...rich(ls.conclusion)) : null,
      el('div', { class: 'actions-row' },
        el('button', { class: 'btn', type: 'button', text: '◀ Back to the last slide', onclick: prev }),
        el('button', { class: 'btn primary', type: 'button', text: 'Start over', onclick: restartLesson })),
    );
  }

  // Navigation.
  const reach = reachable();
  $('ls-prev').disabled = L.idx === 0 && !L.finished;
  const locked = !!S && !S.solved;
  const nextBtn = $('ls-next');
  nextBtn.disabled = L.finished || locked;
  nextBtn.textContent = L.idx === n - 1 ? 'Finish ✓' : 'Next ▶';
  nextBtn.classList.toggle('go', !nextBtn.disabled);
  // A second Next right under the slide text, where the reader's eyes already are.
  $('ls-inline-next').replaceChildren(...(L.finished || locked ? [] : [el('button', { class: 'btn go wide', type: 'button', id: 'ls-next-inline', onclick: next },
    L.idx === n - 1 ? 'Finish the lesson' : 'Next slide', el('span', { 'aria-hidden': 'true', text: L.idx === n - 1 ? '✓' : '▶' }))]));
  nextBtn.title = locked ? 'Solve the task to go on' : '';
  $('ls-count').textContent = `${L.idx + 1} / ${n}`;
  $('ls-dots').replaceChildren(...ls.slides.map((x, i) => el('button', {
    class: ['ls-dot', i <= L.seen && 'seen', x.task && 'task', i === L.idx && !L.finished && 'current'].filter(Boolean).join(' '),
    type: 'button', disabled: i > reach, 'aria-label': `Slide ${i + 1}${x.title ? `: ${x.title}` : ''}${x.task ? ' (task)' : ''}`,
    title: `${i + 1}. ${x.title || (x.task ? 'Task' : 'Slide')}`, onclick: () => go(i),
  })));
  renderTextState();
}

function renderTextState() {
  const s = slide();
  const S = solverFor(L.idx);
  const lines = [
    `Lesson: ${L.ls.title}${L.ls.author ? ` by ${L.ls.author}` : ''}`,
    L.finished ? 'Lesson complete.' : `Slide ${L.idx + 1} of ${L.ls.slides.length}${s.title ? `: ${s.title}` : ''}`,
  ];
  if (!L.finished) {
    if (s.moves.length) lines.push(`Moves on this slide: ${movesLabel(s)}${s.tag ? ` (${TAGS[s.tag].label})` : ''}`);
    if (!S || !S.started) {
      if (s.arrows.length) lines.push(`Arrows: ${s.arrows.map((a) => `${a.from}-${a.to} (${a.color})`).join(', ')}`);
      if (s.highlights.length) lines.push(`Highlighted: ${s.highlights.map((h) => `${h.sq} (${h.color})`).join(', ')}`);
    }
    if (S) {
      lines.push(`Task: ${COLOR[S.solverColor]} to move.${S.solved ? ' Solved.' : ' Solve it to unlock Next.'}`, ...S.textLines());
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
      S.feedback.push({ kind: 'bad', text: `"${input.value.trim()}" isn't a legal move here.` });
      render();
      return;
    }
    input.value = '';
    S.play(mv.from + mv.to + (mv.promotion || ''));
  });
  $('ls-next').addEventListener('click', next);
  $('ls-prev').addEventListener('click', prev);
  $('ls-restart').addEventListener('click', restartLesson);
  $('ls-copy').addEventListener('click', async () => {
    const link = await permanentLink(L.source);
    copy(link, location.hash || !L.source ? 'Link copied' : 'Permanent link copied');
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

// ---------- boot ----------
document.title = `Lesson — Agent Chess v${VERSION}`;
$('app-version').textContent = `v${VERSION}`;
wireStyleMenu(() => { if (L.ls) renderBoard(); });

let source;
try {
  source = await loadShared(LESSON_TOPIC_PREFIX, 'lesson');
} catch (err) {
  showMissing(err.expired ? 'Lesson expired' : "Couldn't load the lesson", err.message || String(err));
  source = undefined;
}
if (source === null) {
  showMissing('No lesson here', 'This link has no lesson in it. Lesson links look like …/lesson/?id=abc123xyz. Ask an agent to make one (point it at lesson/AGENTS.md), or try an example.');
} else if (source !== undefined) {
  const r = validateLesson(source);
  if (!r.ok) {
    showMissing('This lesson has a problem', r.errors.join(' '));
  } else {
    L.ls = r.lesson;
    L.source = source;
    document.title = `${L.ls.title} — Agent Chess lesson`;
    $('ls-loading').hidden = true;
    $('ls-game').hidden = false;
    const tasks = L.ls.slides.filter((x) => x.task).length;
    $('ls-kicker').textContent = [L.ls.author ? `Lesson by ${L.ls.author}` : 'Lesson', L.ls.level,
      `${L.ls.slides.length} slide${L.ls.slides.length === 1 ? '' : 's'}`, tasks ? `${tasks} task${tasks === 1 ? '' : 's'}` : null].filter(Boolean).join(' · ');
    $('ls-title').textContent = L.ls.title;
    if (L.ls.primer) {
      $('ls-primer').hidden = false;
      $('ls-primer').open = true;
      $('ls-primer-body').replaceChildren(...rich(L.ls.primer));
    }
    wireInput();
    go(0);
  }
}
