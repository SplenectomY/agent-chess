// Interface translations. Catalogs live in js/locales/<code>.js (English is built in and is
// the fallback for any missing key). The language comes from, in order: ?lang= in the URL,
// the viewer's saved choice, a hint from the page (a puzzle or lesson written in one
// language), the browser's languages, then English.
//
//   t('status.yourMove')                       plain text
//   t('log.joined', { name, color: 'w' })      {placeholders}; colors 'w'/'b' are translated
//   t('rv.comments', { n: 3 })                 plural forms: { one: '…', other: '…' } by Intl.PluralRules
//
// In HTML: data-i18n="key" sets the text; data-i18n-attr="placeholder:key;aria-label:key"
// sets attributes. translateDom() applies both.

import en from './locales/en.js';
import { VERSION } from './version.js';
import { LANGS, LANG_CODES, baseLang } from './langs.js';
import { store } from './ui.js';

export { LANGS };
const STORE_KEY = 'agentchess:lang';
const catalogs = { en };
let current = 'en';
let plural = new Intl.PluralRules('en');
const listeners = new Set();

export const lang = () => current;

function lookup(key) {
  const c = catalogs[current];
  if (c && c[key] != null) return c[key];
  return en[key];
}

function fill(text, vars) {
  return text.replace(/\{(\w+)\}/g, (m, k) => {
    if (!(k in vars)) return m;
    const v = vars[k];
    if (k === 'color' || k.endsWith('Color')) return colorName(v);
    return v == null ? '' : String(v);
  });
}

export function t(key, vars = {}) {
  let v = lookup(key);
  if (v == null) return key;
  if (typeof v === 'object') {
    const n = Number(vars.n ?? vars.count ?? 0);
    v = v[plural.select(n)] ?? v.other ?? Object.values(v)[0];
  }
  return fill(String(v), vars);
}

// 'w' / 'b' -> "White" / "Black" (also accepts already-translated text).
export function colorName(c) {
  if (c === 'w') return t('color.w');
  if (c === 'b') return t('color.b');
  return c == null ? '' : String(c);
}

export const pieceName = (type) => t(`piece.${type}`);

// "5 min + 3 s per move" / "Untimed" for a time control in ms ({ initial, increment }).
export function timeControl(tc) {
  if (!tc) return t('tc.untimed');
  const num = (x) => new Intl.NumberFormat(current, { maximumFractionDigits: 1 }).format(x);
  const inc = num(tc.increment / 1000);
  if (tc.initial < 60000) return t('tc.seconds', { s: num(tc.initial / 1000), inc });
  return t('tc.minutes', { m: num(tc.initial / 60000), inc });
}

export function moveLabel(ply, san) {
  const n = Math.ceil(ply / 2);
  return ply % 2 === 1 ? `${n}. ${san}` : `${n}... ${san}`;
}

// ---------- choosing a language ----------
function fromBrowser(allowed) {
  for (const l of navigator.languages || [navigator.language]) {
    const b = baseLang(l);
    if (allowed.includes(b)) return b;
  }
  return null;
}

// The language the viewer asked for explicitly (URL or saved choice), or null.
export function explicitLang() {
  const q = baseLang(new URLSearchParams(location.search).get('lang'));
  if (LANG_CODES.includes(q)) return q;
  const saved = baseLang(store.get(STORE_KEY));
  return LANG_CODES.includes(saved) ? saved : null;
}

// contentLangs: languages a puzzle or lesson is written in (first = its main language).
// Without an explicit choice, the viewer's browser language wins if the content has it;
// otherwise the content's own language, so text and interface match.
export function chooseLang(contentLangs = []) {
  const explicit = explicitLang();
  if (explicit) return explicit;
  const content = contentLangs.map(baseLang).filter((c) => LANG_CODES.includes(c));
  const browser = fromBrowser(LANG_CODES);
  if (!content.length) return browser || 'en';
  if (browser && content.includes(browser)) return browser;
  return content[0];
}

async function loadCatalog(code) {
  if (catalogs[code]) return catalogs[code];
  try {
    const mod = await import(new URL(`./locales/${code}.js?v=${VERSION}`, import.meta.url).href);
    catalogs[code] = mod.default;
  } catch {
    catalogs[code] = {};
  }
  return catalogs[code];
}

// Switch the interface language. save: remember it for this browser.
export async function setLang(code, { save = false } = {}) {
  const c = LANG_CODES.includes(baseLang(code)) ? baseLang(code) : 'en';
  await loadCatalog(c);
  current = c;
  plural = new Intl.PluralRules(c);
  document.documentElement.lang = c;
  if (save) store.set(STORE_KEY, c);
  translateDom();
  for (const fn of listeners) fn(c);
}

export const onLangChange = (fn) => listeners.add(fn);

export function translateDom(root = document) {
  root.querySelectorAll('[data-i18n]').forEach((node) => { node.textContent = t(node.dataset.i18n); });
  root.querySelectorAll('[data-i18n-attr]').forEach((node) => {
    for (const pair of node.dataset.i18nAttr.split(';')) {
      const [attr, key] = pair.split(':').map((x) => x.trim());
      if (attr && key) node.setAttribute(attr, t(key));
    }
  });
}

// Fill the language <select> in the Style menu and keep the menu's label in sync.
export function wireLangPicker() {
  const sel = document.getElementById('look-lang');
  if (!sel) return;
  sel.replaceChildren(...LANGS.map((l) => {
    const o = document.createElement('option');
    o.value = l.code;
    o.textContent = l.native;
    o.selected = l.code === current;
    return o;
  }));
  sel.addEventListener('change', () => setLang(sel.value, { save: true }));
  const sync = () => {
    sel.value = current;
    // Piece set and board names in the same menu.
    for (const [id, group] of [['look-pieces', 'pieces'], ['look-board', 'board']]) {
      document.querySelectorAll(`#${id} option`).forEach((o) => { o.textContent = t(`look.${group}.${o.value}`); });
    }
    const badge = document.getElementById('style-lang');
    if (badge) badge.textContent = current.toUpperCase();
  };
  onLangChange(sync);
  sync();
}

// ---------- translated content (puzzles and lessons) ----------
// A text field is a string or { "en": "...", "es": "..." }. Pick the best one for the current
// language: exact, then the content's main language, then English, then anything.
let contentMain = 'en';
export const setContentLang = (code) => { contentMain = baseLang(code) || 'en'; };
export function loc(v) {
  if (v == null) return '';
  if (typeof v === 'string') return v;
  if (typeof v !== 'object') return String(v);
  return v[current] ?? v[contentMain] ?? v.en ?? Object.values(v)[0] ?? '';
}
