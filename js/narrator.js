// Lesson narration: reads text aloud with the browser's own speech engine (no files, any
// language), or plays a hosted recording when a slide has one. Chess moves are spoken as
// words ("Nf3" -> "knight f3", "O-O" -> "castles kingside") in the language being read.

import { tFor, t, lang, onLangChange } from './i18n.js';
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

// ---------- picking a voice ----------
// Settings (per browser): the mode ('auto' = best built-in voice, 'hd' = Piper HD voice) and,
// per language, a specific built-in voice the person picked.
const MODE_KEY = 'agentchess:voiceMode';
const NAME_KEY = (code) => `agentchess:voiceName:${code}`;
export const voiceMode = () => (store.get(MODE_KEY) === 'hd' ? 'hd' : 'auto');
export const pickedVoice = (code) => store.get(NAME_KEY(code)) || null;
export function setVoiceChoice(code, choice) {
  if (choice === 'hd') store.set(MODE_KEY, 'hd');
  else {
    store.set(MODE_KEY, 'auto');
    store.set(NAME_KEY(code), choice && choice !== 'auto' ? choice : null);
  }
}

const baseOf = (v) => String(v.lang || '').toLowerCase().split(/[-_]/)[0];
export const voicesFor = (code) => (canSpeak() ? speechSynthesis.getVoices().filter((v) => baseOf(v) === code) : []);

// Higher is better. The good voices are the network/neural ones each browser ships:
// Chrome "Google …", Edge "… Online (Natural)", Apple "Premium"/"Enhanced"/Siri.
export function voiceScore(v) {
  const n = `${v.name} ${v.voiceURI || ''}`;
  let score = 0;
  if (/natural|neural/i.test(n)) score += 60;
  if (/online/i.test(n)) score += 30;
  if (/^google\b/i.test(v.name)) score += 45;
  if (/premium|enhanced|siri/i.test(n)) score += 40;
  if (/espeak/i.test(n)) score -= 80;
  if (/compact|novelty|whisper|bad news|bells|boing|bubbles|cellos|zarvox|trinoids|albert|jester|organ|superstar|wobble/i.test(n)) score -= 60;
  if (v.default) score += 5;
  return score;
}

function voiceFor(code) {
  const mine = voicesFor(code);
  const picked = pickedVoice(code);
  return (picked && mine.find((v) => v.voiceURI === picked || v.name === picked))
    || [...mine].sort((a, b) => voiceScore(b) - voiceScore(a))[0] || null;
}

// ---------- HD voices: Piper models running in the page ----------
// https://github.com/rhasspy/piper via @diffusionstudio/vits-web (ONNX runtime in WebAssembly).
// Each voice is downloaded once (about 60 MB) and kept in the browser's storage.
export const HD_VOICES = {
  en: 'en_US-hfc_female-medium',
  es: 'es_ES-davefx-medium',
  fr: 'fr_FR-siwis-medium',
  de: 'de_DE-thorsten-medium',
  it: 'it_IT-paola-medium',
  pt: 'pt_BR-faber-medium',
  ru: 'ru_RU-irina-medium',
  zh: 'zh_CN-huayan-medium',
};
const HD_LIB = 'https://cdn.jsdelivr.net/npm/@diffusionstudio/vits-web@1.0.3/+esm';
let hdLib = null;
const loadHD = () => (hdLib ||= import(HD_LIB).catch((e) => { hdLib = null; throw e; }));
const hdReady = {}; // voiceId -> promise of the download
export const hdAvailable = (code) => !!HD_VOICES[code];

// Download (or find in storage) the HD voice for a language. onProgress(0..1).
export async function prepareHD(code, onProgress = () => {}) {
  const id = HD_VOICES[code];
  if (!id) throw new Error('no HD voice');
  const tts = await loadHD();
  if (!hdReady[id]) {
    hdReady[id] = (async () => {
      const have = await tts.stored().catch(() => []);
      if (!have.includes(id)) {
        await tts.download(id, (p) => { if (p.total) onProgress(p.loaded / p.total); });
      }
      return id;
    })().catch((e) => { delete hdReady[id]; throw e; });
  }
  return hdReady[id];
}

// First sentence alone (so speech starts quickly), then the rest in one go.
function hdChunks(text) {
  const first = text.match(/^[^.!?。！？]+[.!?。！？]+\s*/);
  if (!first || first[0].length >= text.length) return chunks(text);
  // Then pieces of a sentence or two: each is synthesized while the previous one plays.
  return [first[0].trim(), ...chunks(text.slice(first[0].length).trim())].filter(Boolean);
}

export class Narrator {
  // onState(speaking), onStatus(text or '') for download progress and notices.
  constructor(onState = () => {}, onStatus = () => {}) {
    this.onState = onState;
    this.onStatus = onStatus;
    this.speaking = false;
    this.audio = null;
    this.token = 0;
    this.pending = 0;
    this.hdQueue = [];
    this.hdRunning = false;
    this.warnedHD = false;
  }

  stop() {
    this.token++;
    this.pending = 0;
    this.hdQueue = [];
    if (canSpeak()) speechSynthesis.cancel();
    if (this.audio) { this.audio.pause(); this.audio = null; }
    this.onStatus('');
    this.set(false);
  }

  set(on) {
    if (this.speaking !== on) { this.speaking = on; this.onState(on); }
  }

  // Read `text` (in language `code`). queue: add it after whatever is being read now
  // (for feedback that arrives while the previous message is still being spoken).
  speak(text, code = lang(), { queue = false } = {}) {
    if (!queue || this.audio && !this.hdRunning) this.stop();
    const spoken = plainText(sayMoves(text, code));
    if (!spoken) return false;
    if (voiceMode() === 'hd' && hdAvailable(code)) return this.speakHD(spoken, code);
    return this.speakBrowser(spoken, code);
  }

  speakBrowser(spoken, code) {
    if (!canSpeak()) return false;
    const pieces = chunks(spoken);
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
        if (!this.pending && !this.hdRunning) this.set(false);
      };
      speechSynthesis.speak(u);
    }
    this.set(true);
    return true;
  }

  speakHD(spoken, code) {
    const token = this.token;
    for (const piece of hdChunks(spoken)) this.hdQueue.push({ text: piece, code });
    this.set(true);
    if (!this.hdRunning) this.runHD(token);
    return true;
  }

  async runHD(token) {
    this.hdRunning = true;
    try {
      const tts = await loadHD();
      while (this.hdQueue.length && token === this.token) {
        const item = this.hdQueue[0];
        const voiceId = await prepareHD(item.code, (f) => { if (token === this.token) this.onStatus(t('voice.downloading', { n: Math.round(f * 100) })); });
        if (token !== this.token) break;
        this.onStatus(this.audio ? '' : t('voice.preparing'));
        // Start synthesizing what comes next while this piece plays.
        for (const x of this.hdQueue.slice(0, 2)) {
          if (!x.wav && HD_VOICES[x.code] === voiceId) x.wav = tts.predict({ text: x.text, voiceId });
        }
        const wav = await (item.wav || tts.predict({ text: item.text, voiceId }));
        if (token !== this.token) break;
        this.onStatus('');
        this.hdQueue.shift();
        if (this.hdQueue[0] && !this.hdQueue[0].wav && HD_VOICES[this.hdQueue[0].code] === voiceId) {
          this.hdQueue[0].wav = tts.predict({ text: this.hdQueue[0].text, voiceId });
        }
        await this.playBlob(wav, token);
      }
    } catch (e) {
      // The HD voice couldn't load (offline, blocked CDN, old browser): use the built-in voice.
      if (token === this.token) {
        const rest = this.hdQueue.splice(0);
        if (!this.warnedHD) { this.warnedHD = true; this.onStatus(t('voice.hdFailed')); setTimeout(() => this.onStatus(''), 5000); }
        this.hdRunning = false;
        for (const x of rest) this.speakBrowser(x.text, x.code);
        return;
      }
    } finally {
      if (this.hdRunning) {
        this.hdRunning = false;
        if (token === this.token && !this.pending) this.set(false);
      }
    }
  }

  playBlob(blob, token) {
    return new Promise((resolve) => {
      const url = URL.createObjectURL(blob);
      const a = new Audio(url);
      this.audio = a;
      const done = () => { URL.revokeObjectURL(url); if (this.audio === a) this.audio = null; resolve(); };
      a.onended = done;
      a.onerror = done;
      a.onpause = () => { if (token !== this.token) done(); };
      a.play().catch(done);
    });
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
  const status = el('span', { class: 'ls-voice-status', role: 'status' });
  narrator.onStatus = (text) => { status.textContent = text; };
  const wrap = el('div', { class: 'ls-voice' }, btn, el('label', { class: 'ls-auto' }, box, ' ', label), status);
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

// The "Voice" choice in the Style menu: automatic (best built-in voice), the HD voice, or a
// specific built-in voice for the current language. Choosing one plays a short sample.
export function wireVoicePicker() {
  const sel = document.getElementById('look-voice');
  const note = document.getElementById('look-voice-note');
  if (!sel) return;
  const sampler = new Narrator(() => {}, (text) => { if (note && text && text !== t('voice.preparing')) note.textContent = text; });
  const fill = () => {
    const code = lang();
    const mine = voicesFor(code).sort((a, b) => voiceScore(b) - voiceScore(a));
    const opt = (value, text, extra = {}) => el('option', { value, text, ...extra });
    sel.replaceChildren(
      opt('auto', t('voice.autoBest')),
      hdAvailable(code) ? opt('hd', t('voice.hd')) : opt('hd', t('voice.hdNone'), { disabled: true }),
      ...mine.map((v) => opt(v.voiceURI || v.name, v.name.replace(/\s*\(.*?\)\s*$/, '') || v.name)),
    );
    const want = voiceMode() === 'hd' && hdAvailable(code) ? 'hd' : pickedVoice(code) || 'auto';
    sel.value = [...sel.options].some((o) => o.value === want && !o.disabled) ? want : 'auto';
    sel.disabled = !canSpeak() && !hdAvailable(code);
  };
  sel.addEventListener('change', async () => {
    const code = lang();
    setVoiceChoice(code, sel.value);
    if (sel.value === 'hd') {
      try {
        await prepareHD(code, (f) => { if (note) note.textContent = t('voice.downloading', { n: Math.round(f * 100) }); });
        if (note) note.textContent = t('voice.hdReady');
      } catch {
        if (note) note.textContent = t('voice.hdFailed');
        return;
      }
    } else if (note) note.textContent = '';
    sampler.speak(t('voice.sample'), code);
  });
  if (canSpeak()) speechSynthesis.addEventListener?.('voiceschanged', fill);
  onLangChange(fill);
  fill();
}
