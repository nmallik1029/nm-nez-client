/**
 * One row in the QoL panel: icon, name over a line of explanation, switch.
 *
 * Shared by both tabs on purpose. A built-in feature and a userscript are
 * the same kind of thing to whoever is looking at them, something that is on
 * or off, and two tabs that drew that differently would read as two panels
 * that happened to be filed together.
 */

export interface RowSpec {
  /** Material Icons ligature. Krunker has the font loaded already. */
  readonly icon: string;
  readonly name: string;
  readonly sub: string;
  readonly on: boolean;
  readonly onToggle: () => void;
}

export function featureRow(spec: RowSpec): HTMLElement {
  const row = document.createElement('div');
  row.className = spec.on ? 'row live' : 'row';

  const glyph = document.createElement('span');
  glyph.className = 'material-icons ico';
  glyph.textContent = spec.icon;

  const text = document.createElement('div');
  text.className = 'txt';
  const name = document.createElement('div');
  name.className = 'nm';
  name.textContent = spec.name;
  const sub = document.createElement('div');
  sub.className = 'sub';
  sub.textContent = spec.sub;
  text.append(name, sub);

  const toggle = document.createElement('button');
  toggle.className = spec.on ? 'sw on' : 'sw';
  toggle.textContent = spec.on ? 'ON' : 'OFF';
  toggle.addEventListener('click', spec.onToggle);

  row.append(glyph, text, toggle);
  return row;
}

/** A line of small print under a list. */
export function note(text: string): HTMLElement {
  const el = document.createElement('div');
  el.className = 'note';
  el.textContent = text;
  return el;
}

/** Said when a list has nothing in it. */
export function empty(text: string): HTMLElement {
  const el = document.createElement('div');
  el.className = 'empty';
  el.textContent = text;
  return el;
}
