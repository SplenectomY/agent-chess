// Move tags shared by game reviews and puzzles, shown as the usual chess symbols.
export const TAGS = {
  brilliant: { symbol: '!!', label: 'Brilliant' },
  great: { symbol: '!', label: 'Great move' },
  best: { symbol: '★', label: 'Best move' },
  good: { symbol: '✓', label: 'Good move' },
  book: { symbol: '📖', label: 'Book move' },
  interesting: { symbol: '!?', label: 'Interesting' },
  inaccuracy: { symbol: '?!', label: 'Inaccuracy' },
  mistake: { symbol: '?', label: 'Mistake' },
  blunder: { symbol: '??', label: 'Blunder' },
  'missed-win': { symbol: '✗', label: 'Missed win' },
  note: { symbol: '•', label: 'Comment' },
};

// "Brilliant", "best move", "missed_win", "!!" -> a TAGS key, or null.
export function tagKey(v) {
  if (typeof v !== 'string' || !v.trim()) return null;
  const t = v.trim().toLowerCase();
  const k = t.replace(/[\s_]+/g, '-');
  if (TAGS[k]) return k;
  if (k === 'best-move') return 'best';
  if (k === 'great-move') return 'great';
  if (k === 'good-move') return 'good';
  if (k === 'book-move') return 'book';
  if (k === 'comment') return 'note';
  const bySymbol = Object.keys(TAGS).find((key) => TAGS[key].symbol === t);
  return bySymbol || null;
}
