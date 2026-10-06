// "Soft" piece set: chunky, rounded pieces with a slightly top-down, shaded look.
// Original artwork, drawn as small inline SVGs (100×100). Colors come from CSS
// variables on the piece (--pc-fill, --pc-side, --pc-top, --pc-edge, --pc-hi), so one
// drawing serves both sides and every board theme.
//
// Classes: f = body, s = darker side, t = lit top face, sh = shade, hi = highlight blob,
// hl = highlight stroke, ln = detail line, e = dark detail, gs = ground shadow.

const BASE =
  '<ellipse class="gs" cx="50" cy="87" rx="33" ry="8"/>' +
  '<path class="s" d="M20 77v6c0 5 13.4 9 30 9s30-4 30-9v-6z"/>' +
  '<ellipse class="f" cx="50" cy="77" rx="30" ry="8.5"/>' +
  '<path class="hl" d="M26 78c4-3 11-5 19-5.5"/>';

const SKIRT_TALL =
  '<path class="f" d="M32 77c2-11 8-17 10-27h16c2 10 8 16 10 27z"/>' +
  '<path class="sh" d="M58 50c2 10 8 16 10 27h-7c-2-9-3-18-3-27z"/>' +
  '<path class="hl" d="M38 72c1-7 4-13 6-18"/>';

const SHAPES = {
  p:
    BASE +
    '<path class="f" d="M33 77c1-11 8-17 10-24h14c2 7 9 13 10 24z"/>' +
    '<path class="sh" d="M57 53c2 7 9 13 10 24h-7c-1-9-5-17-6-24z"/>' +
    '<path class="hl" d="M39 72c0-7 4-12 6-16"/>' +
    '<ellipse class="f" cx="50" cy="52" rx="13" ry="4.5"/>' +
    '<circle class="f" cx="50" cy="36" r="15"/>' +
    '<path class="sh" d="M50 21a15 15 0 0 1 0 30a11 15 0 0 0 0-30z"/>' +
    '<ellipse class="hi" cx="44" cy="30" rx="5.5" ry="3.5" transform="rotate(-35 44 30)"/>',
  r:
    BASE +
    '<path class="f" d="M35 77l2-31h26l2 31z"/>' +
    '<path class="sh" d="M56 46h7l2 31h-8z"/>' +
    '<path class="hl" d="M40 72l1-21"/>' +
    '<path class="f" d="M31 47V23h8.5v5h6.5v-5h7v5h6.5v-5h8.5v24z"/>' +
    '<path class="sh" d="M61 28v-5h8v24h-8z"/>' +
    '<path class="t" d="M31 23h8.5v3.5H31zM46 23h7v3.5h-7zM60.5 23H69v3.5h-8.5z"/>' +
    '<ellipse class="f" cx="50" cy="47" rx="19" ry="4"/>' +
    '<path class="hl" d="M35 43V31"/>',
  n:
    BASE +
    '<path class="f" d="M35 77c0-10 3-17 8-23-7-1-14-3-18-7-4-5-1-11 5-14 6-3 10-8 13-14l2-9 7 7c11 2 19 13 19 27 0 13-5 21-5 33z"/>' +
    '<path class="sh" d="M56 18c11 3 17 14 17 27 0 13-4 21-4 32h-7c1-11 4-20 4-31-1-12-4-21-10-28z"/>' +
    '<path class="ln" d="M57 20c7 5 11 13 11 23"/>' +
    '<circle class="e" cx="44" cy="32" r="3"/>' +
    '<circle class="e" cx="29" cy="42" r="1.8"/>' +
    '<path class="hl" d="M33 34c4-2 7-5 9-9M40 70c0-6 1-11 4-15"/>',
  b:
    BASE +
    '<path class="f" d="M34 77c2-10 8-16 9-22h14c1 6 7 12 9 22z"/>' +
    '<path class="sh" d="M57 55c1 6 7 12 9 22h-7c-1-8-3-15-4-22z"/>' +
    '<path class="hl" d="M39 72c1-6 4-11 6-15"/>' +
    '<ellipse class="f" cx="50" cy="55" rx="13" ry="4.5"/>' +
    '<path class="f" d="M50 17c11 8 16 18 13 28-2 6-24 6-26 0-3-10 2-20 13-28z"/>' +
    '<path class="sh" d="M50 17c11 8 16 18 13 28-1 3-5 4.5-9 5 5-8 4-21-4-33z"/>' +
    '<path class="ln" d="M57 27l-8 10"/>' +
    '<circle class="f" cx="50" cy="13" r="5"/>' +
    '<ellipse class="hi" cx="43" cy="31" rx="3" ry="6.5" transform="rotate(25 43 31)"/>',
  q:
    BASE +
    SKIRT_TALL +
    '<ellipse class="f" cx="50" cy="50" rx="15" ry="5"/>' +
    '<path class="f" d="M35 48l-5-23 11 11 9-17 9 17 11-11-5 23z"/>' +
    '<path class="sh" d="M59 36l11-11-5 23h-6z"/>' +
    '<ellipse class="t" cx="50" cy="46.5" rx="15" ry="4"/>' +
    '<circle class="f" cx="30" cy="23" r="4"/><circle class="f" cx="50" cy="15.5" r="4.5"/><circle class="f" cx="70" cy="23" r="4"/>' +
    '<circle class="hi" cx="48.6" cy="14" r="1.6"/>',
  k:
    BASE +
    SKIRT_TALL +
    '<ellipse class="f" cx="50" cy="50" rx="15" ry="5"/>' +
    '<path class="f" d="M46 6h8v6h6v8h-6v9h-8v-9h-6v-8h6z"/>' +
    '<path class="sh" d="M54 6v23h-3V6z"/>' +
    '<path class="f" d="M35 49c-3-9-1-17 5-20h20c6 3 8 11 5 20z"/>' +
    '<path class="sh" d="M58 29h2c6 3 8 11 5 20h-6c2-7 1-15-1-20z"/>' +
    '<ellipse class="t" cx="50" cy="29" rx="10" ry="3.5"/>' +
    '<ellipse class="hi" cx="41" cy="38" rx="2.5" ry="5.5" transform="rotate(15 41 38)"/>',
};

export const SOFT_SVG = Object.fromEntries(
  Object.entries(SHAPES).map(([k, inner]) => [
    k,
    // viewBox is shifted so the shared baseline sits ~8% above the bottom of the square.
    `<svg class="soft-svg" viewBox="0 -4 100 100" aria-hidden="true" focusable="false">${inner}</svg>`,
  ]),
);

export const PIECE_SETS = {
  classic: 'Classic',
  soft: 'Soft',
};

export const BOARD_THEMES = {
  slate: 'Slate',
  midnight: 'Midnight',
  sand: 'Sand',
};
