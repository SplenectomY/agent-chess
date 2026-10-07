#!/usr/bin/env node
// Checks every catalog in js/locales against en.js: same keys, same {placeholders}, and plural
// values that cover the language's plural categories. Usage: node tools/check-locales.mjs [code...]
import { readdirSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';

const dir = join(dirname(fileURLToPath(import.meta.url)), '..', 'js', 'locales');
const en = (await import(pathToFileURL(join(dir, 'en.js')).href)).default;
const codes = process.argv.slice(2).length ? process.argv.slice(2) : readdirSync(dir).filter((f) => f.endsWith('.js') && f !== 'en.js').map((f) => f.slice(0, -3));
const holes = (s) => new Set([...String(s).matchAll(/\{(\w+)\}/g)].map((m) => m[1]));
const forms = (v) => (typeof v === 'object' ? Object.values(v) : [v]);
let bad = 0;
for (const code of codes) {
  const cat = (await import(pathToFileURL(join(dir, `${code}.js`)).href)).default;
  const problems = [];
  const cats = new Intl.PluralRules(code).resolvedOptions().pluralCategories;
  for (const [k, v] of Object.entries(en)) {
    if (!(k in cat)) { problems.push(`missing ${k}`); continue; }
    const tv = cat[k];
    const want = new Set(forms(v).flatMap((x) => [...holes(x)]));
    if (typeof v === 'object') {
      if (typeof tv !== 'object') { problems.push(`${k}: should have plural forms`); continue; }
      for (const c of cats) if (!(c in tv)) problems.push(`${k}: missing plural form "${c}"`);
      for (const f of Object.keys(tv)) if (!cats.includes(f)) problems.push(`${k}: "${f}" isn't a plural form in ${code} (${cats.join(', ')})`);
    } else if (typeof tv !== 'string') { problems.push(`${k}: should be a string`); continue; }
    for (const f of forms(tv)) {
      for (const h of holes(f)) if (!want.has(h)) problems.push(`${k}: unknown placeholder {${h}}`);
    }
    const got = new Set(forms(tv).flatMap((x) => [...holes(x)]));
    for (const h of want) if (h !== 'n' && !got.has(h)) problems.push(`${k}: placeholder {${h}} is missing`);
    for (const f of forms(tv)) if (!String(f).trim()) problems.push(`${k}: empty`);
  }
  for (const k of Object.keys(cat)) if (!(k in en)) problems.push(`extra key ${k}`);
  console.log(`${code}: ${problems.length ? `${problems.length} problem(s)` : 'ok'}`);
  for (const p of problems) console.log(`  ${p}`);
  bad += problems.length;
}
process.exit(bad ? 1 : 0);
