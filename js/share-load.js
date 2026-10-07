// Loading a shared puzzle or lesson from its link: ?id=<relay id>, #z= / #j= (inside the link)
// or ?example=<name> (a file in the page's examples/ folder).

import { VERSION } from './version.js';
import { DEFAULT_RELAY, parseNtfyLine } from './relay.js';
import { decodeFragment, joinParts, inflate, fromBase64Url, utf8, encodeFragment } from './puzzle-core.js';

export const params = new URLSearchParams(location.search);
export const RELAY = (params.get('relay') || DEFAULT_RELAY).replace(/\/+$/, '');

// Returns the JSON, null if the link has nothing in it, or throws an Error (with .expired for
// relay links that are gone). `what` is "puzzle" or "lesson".
export async function loadShared(topicPrefix, what) {
  const id = (params.get('id') || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const example = (params.get('example') || '').replace(/[^a-z0-9-]/g, '');
  if (location.hash.length > 3) return decodeFragment(location.hash);
  if (example) {
    const r = await fetch(`examples/${example}.json?v=${VERSION}`);
    if (!r.ok) throw new Error(`There's no example called "${example}".`);
    return r.json();
  }
  if (id) {
    const r = await fetch(`${RELAY}/${topicPrefix}${id}/json?poll=1&since=all`, { cache: 'no-store' });
    if (!r.ok) throw new Error(`The relay answered ${r.status}.`);
    const events = (await r.text()).split('\n').map(parseNtfyLine).filter(Boolean);
    const enc = joinParts(events);
    if (!enc) {
      const e = new Error(`This ${what} link has expired or never existed. Short links last about 12 hours. Ask whoever sent it for the permanent link.`);
      e.expired = true;
      throw e;
    }
    return JSON.parse(utf8.decode(await inflate(fromBase64Url(enc))));
  }
  return null;
}

// The permanent form of the current link (the content inside the link), so it keeps working
// after the relay forgets a short link.
export async function permanentLink(source) {
  if (location.hash || !source) return location.href;
  try { return location.origin + location.pathname + (await encodeFragment(source)); } catch { return location.href; }
}
