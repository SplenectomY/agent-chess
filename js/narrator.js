// Lesson narration: reads text aloud with the browser's own speech engine (no files, any
// language), or plays a hosted recording when a slide has one. Chess moves are spoken as
// words ("Nf3" -> "knight f3", "O-O" -> "castles kingside") in the language being read.

import { tFor, t, lang } from './i18n.js';
import { el, store } from './ui.js';

// One switch for the whole site: lessons, puzzles and reviews.
const AUTO_KEY = 'agentchess:narrate';
export const autoRead = () => !!store.get(AUTO_KEY);
export const setAutoRead = (on) => store.set(AUTO_KEY, !!on);

// Browsers only allow sound after the person has interacted with the page.
let acted = false;
if (typeof document !== 'undefined' && document.addEventListener) {
  for (const ev of ['pointerdown', 'keydown']) document.addEventListener(ev, () => { acted = true; }, { capture: true });
}
export const userActed = () => acted;

export const canSpeak = () => typeof window !== 'undefined' && 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;

const PIECE = { K: 'k', Q: 'q', R: 'r', B: 'b', N: 'n' };
const SAN = /\b(O-O-O|O-O|0-0-0|0-0|[KQRBN][a-h]?[1-8]?x?[a-h][1-8]|[a-h]x[a-h][1-8](?:=[QRBN])?|[a-h][18]=[QRBN])([+#])?/g;

// "Qxf7#" -> "queen takes f7, checkmate" (in `code`). Move numbers ("3." / "3...") are dropped.
export function sayMoves(text, code) {
  return String(text || '')
    .replace(/\b\d+\.(?:\.\.)?\s*(?=[KQRBNa-hO0])/g, '')
    .replace(/(^|[\s(])\.\.\.(?=[KQRBNa-hO0])/g, '$1')
    .replace(SAN, (m, mv, suffix) => {
      let out;
      if (/^(O-O-O|0-0-0)$/.test(mv)) out = tFor(code, 'speak.castleQ');
      else if (/^(O-O|0-0)$/.test(mv)) out = tFor(code, 'speak.castleK');
      else {
        const piece = PIECE[mv[0]] ? tFor(code, `piece.${PIECE[mv[0]]}`) : '';
        const body = PIECE[mv[0]] ? mv.slice(1) : mv;
        const [, from, x, to, promo] = /^([a-h]?[1-8]?)(x?)([a-h][1-8])(?:=([QRBN]))?$/.exec(body) || [];
        if (!to) return m;
        out = [piece, from ? from.split('').join(' ') : '', x ? tFor(code, 'speak.takes') : '', to].filter(Boolean).join(' ');
        if (promo) out += `, ${tFor(code, 'speak.promotes', { piece: tFor(code, `piece.${PIECE[promo]}`) })}`;
      }
      if (suffix === '+') out += `, ${tFor(code, 'speak.check')}`;
      if (suffix === '#') out += `, ${tFor(code, 'speak.mate')}`;
      return out;
    });
}

// Markdown-ish lesson text -> plain sentences.
export function plainText(md) {
  return String(md || '')
    .replace(/^#{1,4}\s+(.*)$/gm, '$1.')
    .replace(/^[-*•]\s+/gm, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/[◀▶✓★]/g, '')
    .replace(/([.:!?;,。！？：])?\s*\n+\s*/g, (m, p) => (p ? `${p} ` : '. '))
    .replace(/\.\.+(?=\s|$)/g, '.')
    .trim();
}

// Chrome stops long utterances after ~15 s, so speak sentence-sized pieces in a row.
function chunks(text, max = 220) {
  const out = [];
  for (const sentence of text.match(/[^.!?。！？]+[.!?。！？]*\s*/g) || [text]) {
    if (out.length && (out[out.length - 1] + sentence).length <= max) out[out.length - 1] += sentence;
    else out.push(sentence);
  }
  return out.map((x) => x.trim()).filter(Boolean);
}

function voiceFor(code) {
  const voices = speechSynthesis.getVoices();
  const mine = voices.filter((v) => v.lang && v.lang.toLowerCase().split(/[-_]/)[0] === code);
  return mine.find((v) => v.localService && v.default) || mine.find((v) => v.default) || mine.find((v) => v.localService) || mine[0] || null;
}

export class Narrator {
  constructor(onState = () => {}) {
    this.onState = onState;
    this.speaking = false;
    this.audio = null;
    this.token = 0;
    this.pending = 0;
  }

  stop() {
    this.token++;
    this.pending = 0;
    if (canSpeak()) speechSynthesis.cancel();
    if (this.audio) { this.audio.pause(); this.audio = null; }
    this.set(false);
  }

  set(on) {
    if (this.speaking !== on) { this.speaking = on; this.onState(on); }
  }

  // Read `text` (in language `code`). queue: add it after whatever is being read now
  // (for feedback that arrives while the previous message is still being spoken).
  speak(text, code = lang(), { queue = false } = {}) {
    if (!queue || this.audio) this.stop();
    if (!canSpeak()) return false;
    const pieces = chunks(plainText(sayMoves(text, code)));
    if (!pieces.length) return false;
    const token = this.token;
    const voice = voiceFor(code);
    for (const piece of pieces) {
      const u = new SpeechSynthesisUtterance(piece);
      u.lang = voice ? voice.lang : code;
      if (voice) u.voice = voice;
      u.rate = 1;
      this.pending++;
      u.onend = u.onerror = () => {
        if (token !== this.token) return;
        this.pending = Math.max(0, this.pending - 1);
        if (!this.pending) this.set(false);
      };
      speechSynthesis.speak(u);
    }
    this.set(true);
    return true;
  }

  // Play a recording; if it can't play, call fallback() (usually: speak the text instead).
  play(url, fallback) {
    this.stop();
    const token = this.token;
    const a = new Audio(url);
    this.audio = a;
    a.onended = () => { if (token === this.token) { this.audio = null; this.set(false); } };
    a.onerror = () => { if (token === this.token) { this.audio = null; this.set(false); fallback(); } };
    a.play().then(() => { if (token === this.token) this.set(true); }).catch(() => { if (token === this.token) { this.audio = null; fallback(); } });
    this.set(true);
  }
}

// Spoken form of a puzzle/lesson feedback message: its tag, then the message.
export function feedbackSpeech(f) {
  const msg = f.msg ? f.msg() : f.text || '';
  return f.tag ? `${t(`tag.${f.tag}`)}. ${msg}` : msg;
}

// Listen button + "read aloud" switch, for pages that build their panels in code.
// readNow() reads whatever is current. Returns { el, refresh }.
export function voiceControls(narrator, readNow, { title = '' } = {}) {
  const btn = el('button', { class: 'btn ls-listen', type: 'button', onclick: () => (narrator.speaking ? narrator.stop() : readNow()) });
  const box = el('input', { type: 'checkbox' });
  const label = el('span');
  box.addEventListener('change', () => {
    setAutoRead(box.checked);
    if (box.checked) { if (!narrator.speaking) readNow(); } else narrator.stop();
  });
  const wrap = el('div', { class: 'ls-voice' }, btn, el('label', { class: 'ls-auto' }, box, ' ', label));
  const refresh = () => {
    btn.textContent = narrator.speaking ? t('ls.stopListening') : t('ls.listen');
    btn.title = title ? t(title) : '';
    btn.classList.toggle('speaking', narrator.speaking);
    box.checked = autoRead();
    label.textContent = t('voice.auto');
    wrap.title = t('voice.autoTitle');
    wrap.hidden = !canSpeak();
  };
  refresh();
  return { el: wrap, refresh };
}
