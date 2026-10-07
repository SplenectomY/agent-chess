// The solving state machine shared by puzzles and lesson tasks: the player finds the solver
// moves of a line, opponent replies are auto-played, wrong moves stay on the board until Retry,
// hints come one at a time, reply arrows wait for Continue.

import { Chess } from '../vendor/chess.js';
import { el } from './ui.js';
import { TAGS } from './tags.js';
import { judgeMove, wrongEntry } from './puzzle-core.js';

export const COLOR = { w: 'White', b: 'Black' };
const UCI = /^([a-h][1-8])([a-h][1-8])([qrbn])?$/;

export class Solver {
  // fen: start; line: validated steps; opponentFirst: line[0] is auto-played first;
  // onChange(): called whenever the state changes (re-render).
  constructor({ fen, line, solverColor, opponentFirst = false, onChange = () => {} }) {
    Object.assign(this, { fen, line, solverColor, opponentFirst, onChange: () => {} });
    this.restart(true);
    this.onChange = onChange; // only after setup, so the caller can finish storing this solver
  }

  restart(silent = false) {
    Object.assign(this, {
      chess: new Chess(this.fen), step: 0, mistakes: 0, hintsUsed: 0, hintLevel: {}, revealed: {}, sel: null,
      last: null, flash: null, wrongChess: null, wrongInfo: null, arrow: null, badge: null, replyArrows: [],
      paused: false, feedback: [], solved: false, busy: false,
    });
    clearTimeout(this.timer);
    if (this.opponentFirst) this.advance();
    if (!silent) this.onChange();
  }

  get started() { return this.step > (this.opponentFirst ? 1 : 0) || !!this.wrongChess || !!this.arrow || this.mistakes > 0; }

  canMove() {
    return !this.solved && !this.busy && !this.wrongChess && !this.paused && this.step < this.line.length && this.line[this.step].solver;
  }

  // The position on the board (a wrong move stays visible until Retry).
  displayChess() { return this.wrongChess || this.chess; }

  // What to draw: { chess, last, lastClass, badge, arrows }.
  decor() {
    if (this.wrongChess) {
      const w = this.wrongInfo || {};
      return { chess: this.wrongChess, last: this.flash, lastClass: 'wrong', badge: w.tag ? { sq: this.flash.to, tag: w.tag } : null, arrows: w.replies || [] };
    }
    return { chess: this.chess, last: this.last, lastClass: 'last', badge: this.badge, arrows: [...this.replyArrows, ...(this.arrow ? [this.arrow] : [])] };
  }

  // Returns true if the input was taken (a move was played or a promotion choice is needed).
  // askPromotion(from, to, color, pick) is called when the player must choose a piece.
  attempt(from, to, promotion, askPromotion) {
    if (!this.canMove()) return false;
    const step = this.line[this.step];
    const moves = this.chess.moves({ square: from, verbose: true }).filter((m) => m.to === to);
    if (!moves.length) return false;
    if (moves.some((m) => m.promotion) && !promotion) {
      // Prefer the promotion the line expects; otherwise ask.
      if (step.from === from && step.to === to && step.uci.length === 5) return this.attempt(from, to, step.uci[4], askPromotion);
      askPromotion(from, to, this.chess.turn(), (p) => this.play(from + to + p));
      return true;
    }
    this.play(from + to + (promotion || ''));
    return true;
  }

  play(text) {
    if (!this.canMove()) return;
    const step = this.line[this.step];
    const trial = new Chess(this.chess.fen());
    let mv;
    try {
      const m = UCI.exec(text);
      mv = m ? trial.move({ from: m[1], to: m[2], promotion: m[3] }) : trial.move(text);
    } catch {
      mv = null;
    }
    if (!mv) return;
    this.sel = null;
    if (judgeMove(step, trial, mv.san)) {
      this.chess = trial;
      this.last = { from: mv.from, to: mv.to };
      this.arrow = null;
      // The tag belongs to the intended move; an accepted alternative gets no symbol.
      this.badge = step.tag && mv.san === step.move ? { sq: mv.to, tag: step.tag } : null;
      this.replyArrows = step.replies || [];
      const alt = mv.san !== step.move ? ` (${step.move} also works.)` : '';
      this.feedback.push({ kind: 'good', tag: this.badge && step.tag, text: `${mv.san}: correct!${alt}${step.explain ? ' ' + step.explain : ''}` });
      if (step.replies) this.feedback.push({ kind: 'reply', text: this.repliesText(step.replies) });
      this.step++;
      if (step.replies && this.step < this.line.length) {
        this.paused = true; // let the player study the arrows; Continue plays the reply
        this.onChange();
        return;
      }
      this.advance();
    } else {
      this.mistakes++;
      // Leave the wrong move on the board so the player can study it; Retry takes it back.
      this.wrongChess = trial;
      this.flash = { from: mv.from, to: mv.to };
      const w = wrongEntry(step, mv.san) || {};
      this.wrongInfo = { tag: w.tag, replies: w.replies };
      this.feedback.push({ kind: 'bad', tag: w.tag, text: `${mv.san} isn't it.${w.text ? ' ' + w.text : ''}${w.replies ? ' ' + this.repliesText(w.replies) : ''} Press Retry when you're ready to try again.` });
    }
    this.onChange();
  }

  // Auto-play opponent replies, then wait for the solver or finish.
  advance() {
    if (this.step >= this.line.length) {
      this.solved = true;
      this.onChange();
      return;
    }
    const next = this.line[this.step];
    if (next.solver) {
      this.onChange();
      return;
    }
    this.busy = true;
    this.onChange();
    this.timer = setTimeout(() => {
      const mv = this.chess.move(next.move);
      this.last = { from: mv.from, to: mv.to };
      this.badge = next.tag ? { sq: mv.to, tag: next.tag } : null;
      this.replyArrows = [];
      this.feedback.push({ kind: 'reply', tag: next.tag, text: `${COLOR[mv.color]} replies ${mv.san}.${next.explain ? ' ' + next.explain : ''}` });
      this.step++;
      this.busy = false;
      this.advance();
    }, 650);
  }

  hint() {
    const i = this.step;
    const step = this.line[i];
    if (!step || !step.solver || !this.canMove()) return;
    const hints = step.hints || [];
    const shown = this.hintLevel[i] || 0;
    if (shown < hints.length) {
      this.hintLevel[i] = shown + 1;
      this.hintsUsed++;
      this.feedback.push({ kind: 'hint', text: `Hint ${shown + 1}${hints.length > 1 ? ` of ${hints.length}` : ''}: ${hints[shown]}` });
    } else if (!this.revealed[i]) {
      this.revealed[i] = true;
      this.arrow = { from: step.from, to: step.to };
      this.feedback.push({ kind: 'hint', text: `The answer is ${step.move} (shown by the arrow). Play it to continue.` });
    }
    this.onChange();
  }

  hintLabel() {
    const step = this.line[this.step];
    const hints = (step && step.hints) || [];
    const shown = this.hintLevel[this.step] || 0;
    return shown < hints.length ? (shown ? 'Another hint' : 'Hint') : this.revealed[this.step] ? 'Answer shown' : 'Show the answer';
  }

  // "Black can answer Rxc8 (forced) or Kf8: see the green arrows."
  repliesText(list) {
    const names = list.map((r) => r.san + (r.text ? ` (${r.text})` : ''));
    const joined = names.length > 1 ? `${names.slice(0, -1).join(', ')} or ${names[names.length - 1]}` : names[0];
    const side = COLOR[this.solverColor === 'w' ? 'b' : 'w'];
    return `${side} can answer ${joined}: see the green arrow${list.length > 1 ? 's' : ''}.`;
  }

  // Play the opponent's reply after the player has looked at the reply arrows.
  cont() {
    if (!this.paused) return;
    this.paused = false;
    this.replyArrows = [];
    this.advance();
  }

  // Take back the wrong move that's on the board.
  retry() {
    if (!this.wrongChess) return;
    this.wrongChess = null;
    this.wrongInfo = null;
    this.flash = null;
    this.sel = null;
    this.onChange();
  }

  statusText() {
    if (this.solved) return 'Solved!';
    if (this.wrongChess) return 'Not quite. Press Retry to take it back.';
    if (this.paused) return 'Look at the replies, then press Continue.';
    if (this.busy) return `${COLOR[this.chess.turn()]} is replying…`;
    return `${COLOR[this.solverColor]} to move`;
  }

  // Plain-text state for agents and screen readers.
  textLines() {
    const lines = [`Status: ${this.solved ? 'solved' : this.wrongChess ? 'wrong move on the board; press Retry to take it back' : this.paused ? 'press Continue' : this.canMove() ? 'your move' : 'opponent replying'}`,
      `FEN: ${this.displayChess().fen()}`];
    if (this.wrongChess && this.flash) lines.push(`Wrong move on the board: ${this.flash.from}${this.flash.to}`);
    const shown = this.wrongChess ? (this.wrongInfo && this.wrongInfo.replies) || [] : this.replyArrows;
    if (shown.length) lines.push(`Green arrows (opponent's possible replies): ${shown.map((r) => `${r.san} (${r.from}-${r.to})`).join(', ')}`);
    if (this.canMove()) lines.push(`Legal moves: ${this.chess.moves().join(' ')}`);
    return lines;
  }
}

// The newest few feedback messages, with tag chips.
export function renderFeedback(box, feedback, emptyText) {
  box.replaceChildren(...feedback.slice(-4).map((f) => el('p', { class: `fb ${f.kind}` },
    f.tag ? el('span', { class: `rv-tag tag-${f.tag}` }, el('b', { text: TAGS[f.tag].symbol }), ` ${TAGS[f.tag].label}`) : null,
    f.tag ? ' ' : null, f.text)));
  if (!feedback.length && emptyText) box.replaceChildren(el('p', { class: 'fb info', text: emptyText }));
}

// The Continue button, shown right under the explanation while the reply arrows are up
// (the caller puts it above the move box). Empty when there's nothing to continue.
export function continueButton(S) {
  if (!S.paused) return [];
  const side = COLOR[S.chess.turn()];
  return [el('button', { class: 'btn go wide', type: 'button', id: 'pz-continue', onclick: () => S.cont() },
    `Continue: see ${side}'s reply`, el('span', { 'aria-hidden': 'true', text: '▶' }))];
}

// Retry / Hint buttons for an unsolved solver.
export function solverButtons(S, { onRetry } = {}) {
  const out = [];
  if (S.solved) return out;
  if (S.wrongChess) out.push(el('button', { class: 'btn primary', type: 'button', text: 'Retry', id: 'pz-retry', onclick: () => { S.retry(); if (onRetry) onRetry(); } }));
  if (!S.paused && !S.wrongChess) {
    out.push(el('button', { class: 'btn', type: 'button', text: S.hintLabel(), id: 'pz-hint', disabled: !S.canMove() || !!S.revealed[S.step], onclick: () => S.hint() }));
  }
  return out;
}
