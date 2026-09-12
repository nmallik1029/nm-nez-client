/**
 * One row in the QoL panel: icon, name over a line of explanation, switch.
 *
 * Shared by both tabs on purpose. A built-in feature and a userscript are
 * the same kind of thing to whoever is looking at them, something that is on
 * or off, and two tabs that drew that differently would read as two panels
 * that happened to be filed together.
 *
 * Some of ours have more to say than on or off, so a row can carry a button
 * in front of its switch. That is the whole difference between a feature and
 * a feature with an editor behind it, and it should look like that much.
 */

export interface RowSpec {
  /** Material Icons ligature. Krunker has the font loaded already. */
  readonly icon: string;
  readonly name: string;
  readonly sub: string;
  readonly on: boolean;
  readonly onToggle: () => void;
  /** An extra button before the switch, e.g. the one that opens an editor. */
  readonly action?: { readonly label: string; readonly onClick: () => void };
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

  row.append(glyph, text);

  if (spec.action) {
    const button = document.createElement('button');
    button.textContent = spec.action.label;
    button.addEventListener('click', spec.action.onClick);
    row.appendChild(button);
  }

  row.appendChild(toggle);
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

/**
 * Something has changed that only a page load can apply.
 *
 * Krunker flags a pending setting in red; this is the same idea in the
 * client's own caution colours, with the reload attached to it rather than
 * left as an instruction.
 */
export function pendingStrip(text: string, onReload: () => void): HTMLElement {
  const strip = document.createElement('div');
  strip.className = 'pend';

  const body = document.createElement('div');
  body.className = 'txt';
  body.textContent = text;

  const go = document.createElement('button');
  go.textContent = 'Reload now';
  go.addEventListener('click', onReload);

  strip.append(body, go);
  return strip;
}
