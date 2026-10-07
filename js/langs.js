// Languages the interface is translated into. Shared by the pages (js/i18n.js), the game
// engine (to name a player's language for agents) and the CLI.
export const LANGS = [
  { code: 'en', native: 'English', english: 'English' },
  { code: 'es', native: 'Español', english: 'Spanish' },
  { code: 'fr', native: 'Français', english: 'French' },
  { code: 'de', native: 'Deutsch', english: 'German' },
  { code: 'it', native: 'Italiano', english: 'Italian' },
  { code: 'pt', native: 'Português', english: 'Portuguese' },
  { code: 'ru', native: 'Русский', english: 'Russian' },
  { code: 'zh', native: '中文', english: 'Chinese (Simplified)' },
  { code: 'ja', native: '日本語', english: 'Japanese' },
];
export const LANG_CODES = LANGS.map((l) => l.code);

// "pt-BR" -> "pt", "zh-Hans-CN" -> "zh", "EN" -> "en". Returns '' for anything unusable.
export function baseLang(code) {
  const m = /^([a-z]{2,3})(?:[-_]|$)/i.exec(String(code || '').trim());
  return m ? m[1].toLowerCase() : '';
}

// English name of a language code for agents ("es" -> "Spanish"); unknown codes come back as-is.
export function langNameEnglish(code) {
  const l = LANGS.find((x) => x.code === baseLang(code));
  return l ? l.english : String(code || '');
}
