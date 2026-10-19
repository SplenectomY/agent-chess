// The advantage bar beside the board: White's share grows from White's side of the board,
// Black's from the other, with the evaluation written at the end that's ahead.

import { whiteShare, evalLabel } from './evals.js';
import { t } from './i18n.js';

// e: { cp } | { mate } | null (null hides the bar). flip: Black is at the bottom.
export function renderEvalBar(bar, e, flip = false) {
  if (!bar) return;
  if (!e) { bar.hidden = true; return; }
  bar.hidden = false;
  const share = whiteShare(e);
  const white = bar.querySelector('.eval-white');
  const val = bar.querySelector('.eval-val');
  // White's part is anchored to White's edge of the board.
  white.style.height = `${(share * 100).toFixed(1)}%`;
  white.style.top = flip ? '0' : 'auto';
  white.style.bottom = flip ? 'auto' : '0';
  const label = evalLabel(e);
  const whiteAhead = share >= 0.5;
  val.textContent = label;
  // The number sits at the advantaged side's end, in that side's color, on the other's part.
  val.className = `eval-val ${whiteAhead ? 'on-white' : 'on-black'} ${(whiteAhead !== flip) ? 'at-bottom' : 'at-top'}`;
  bar.classList.toggle('mate', e.mate != null);
  const spoken = e.mate != null
    ? t('eval.mate', { color: e.mate > 0 ? 'w' : 'b', n: Math.abs(e.mate) })
    : Math.abs(e.cp) < 5 ? t('eval.equal') : t('eval.better', { color: e.cp > 0 ? 'w' : 'b', n: label.replace(/^[+-]/, '') });
  bar.setAttribute('aria-label', `${t('eval.label')}: ${spoken}`);
  bar.title = spoken;
}

// Spoken form for read-aloud: "Evaluation: White is better by 1.3."
export function evalSpeech(e) {
  if (!e) return '';
  if (e.mate != null) return t('eval.mate', { color: e.mate > 0 ? 'w' : 'b', n: Math.abs(e.mate) });
  if (Math.abs(e.cp) < 5) return t('eval.equal');
  return t('eval.better', { color: e.cp > 0 ? 'w' : 'b', n: evalLabel(e).replace(/^[+-]/, '') });
}
