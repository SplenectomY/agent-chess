// Position evaluations for the advantage bar (like the bar beside the board on chess.com or
// Lichess). Shared by the engine (which stores them), the pages (which draw the bar), the
// puzzle/lesson validators and the CLI.
//
// An evaluation is written from White's point of view, the way engines print it:
//   1.3 / "+1.3" / "-0.5"   pawns (a plain number is pawns)
//   "150cp" / "-35cp"       centipawns
//   "M3" / "#3"             White mates in 3;   "-M3" / "#-3" / "M-3"   Black mates in 3
//   "0.0"                   equal
// Normalized form: { cp: 130 } or { mate: 3 } (negative mate = Black mates).

// Returns { cp } | { mate } | null.
export function parseEval(v) {
  if (v == null || v === '') return null;
  if (typeof v === 'object') {
    if (Number.isInteger(v.mate) && v.mate !== 0) return { mate: Math.max(-99, Math.min(99, v.mate)) };
    if (typeof v.cp === 'number' && Number.isFinite(v.cp)) return { cp: Math.max(-9999, Math.min(9999, Math.round(v.cp))) };
    return null;
  }
  if (typeof v === 'number') return Number.isFinite(v) ? { cp: Math.max(-9999, Math.min(9999, Math.round(v * 100))) } : null;
  const s = String(v).trim().replace(/\s+/g, '').replace(',', '.');
  let m = /^([+-]?)(?:M|#)([+-]?)(\d{1,2})$/i.exec(s);
  if (m) {
    const n = Number(m[3]);
    if (!n) return null;
    return { mate: m[1] === '-' || m[2] === '-' ? -n : n };
  }
  m = /^([+-]?\d+(?:\.\d+)?)cp$/i.exec(s);
  if (m) return { cp: Math.max(-9999, Math.min(9999, Math.round(Number(m[1])))) };
  m = /^[+-]?\d+(?:\.\d+)?$/.exec(s);
  if (m) return { cp: Math.max(-9999, Math.min(9999, Math.round(Number(s) * 100))) };
  return null;
}

// White's share of the bar, 0..1. Lichess's win-probability curve: a +1 pawn edge is about
// 59%, +3 is about 75%, and a forced mate fills the bar.
export function whiteShare(e) {
  if (!e) return 0.5;
  if (e.mate != null) return e.mate > 0 ? 1 : 0;
  const win = 2 / (1 + Math.exp(-0.00368208 * e.cp)) - 1; // -1..1
  return 0.5 + 0.5 * win;
}

// Short label: "+1.3", "-0.5", "0.0", "M3", "-M3".
export function evalLabel(e) {
  if (!e) return '';
  if (e.mate != null) return `${e.mate < 0 ? '-' : ''}M${Math.abs(e.mate)}`;
  const p = e.cp / 100;
  if (Math.abs(p) < 0.05) return '0.0';
  return `${p > 0 ? '+' : ''}${p.toFixed(1)}`;
}

// Compact form for storing in messages: a number (pawns) or "M3"/"-M3".
export function evalToJSON(e) {
  if (!e) return null;
  return e.mate != null ? evalLabel(e) : Math.round(e.cp) / 100;
}
