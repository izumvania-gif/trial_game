// Keycaps: "E — Star stele · Esc — step back" becomes <kbd>E</kbd> Star stele  <kbd>Esc</kbd> step back.
import { h } from './dom.ts';

export function keycaps(keys: string[]): HTMLElement[] {
  return keys.map((k) => h('kbd', { className: k.length > 1 ? 'wide' : '' }, k));
}

/** Parses "KEYS — label" parts separated by " · "; a part without " — " is plain text. */
export function keyLine(text: string): (Node | string)[] {
  const out: (Node | string)[] = [];
  text.split(' · ').forEach((part, i) => {
    const m = /^(.+?) — (.+)$/.exec(part);
    const item = h('span', { className: 'key-item' });
    if (m) item.append(...keycaps(m[1]!.split(/\s+/).flatMap((k) => (/^[A-Z]{2,4}$/.test(k) && k !== 'Esc' && k !== 'Tab' ? [...k] : [k]))), ' ', m[2]!);
    else item.append(part);
    if (i) out.push(' ');
    out.push(item);
  });
  return out;
}
