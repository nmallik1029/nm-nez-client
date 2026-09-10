import { BRANDING } from '../shared/branding';
import { CHANGELOG, type ChangeKind } from '../shared/changelog';
import { defineStyle } from './style';

/**
 * The changelog: a row in Krunker's left menu, and the panel it opens.
 *
 * Versions start collapsed; clicking one shows its changes. The exception is
 * `showPatchNotes`, which is what runs after an update installs and opens the
 * new version already expanded, since that is the thing you just asked to read.
 *
 * The row is cloned from one of the game's own menu items rather than built by
 * hand. The menu is Svelte-compiled and its styling hides behind a per-build
 * hash class ("menuItem svelte-fgmdj8"), so anything we assemble ourselves
 * matches none of it and renders unstyled. Cloning gets the icon sizing, the
 * type, the hover and the hash, whatever the hash is this build.
 */

const ITEM_ID = 'kc-changelog-item';
const MODAL_ID = 'kc-changelog-modal';
const STYLE_ID = 'kc-changelog-css';
const CONTAINER_ID = 'menuItemContainer';

/** Material icon name. Matches the game's own outlined set. */
const ICON = 'description';

const CSS = `
#${MODAL_ID}-backdrop{position:fixed;inset:0;z-index:100000;background:var(--nm-game-scrim);
  display:flex;align-items:center;justify-content:center}
#${MODAL_ID}{width:min(620px,92vw);max-height:80vh;display:flex;flex-direction:column;
  background:var(--nm-game-bg);border:2px solid var(--nm-game-border);color:var(--nm-game-text);
  font-family:var(--nm-font-display)}
#${MODAL_ID} .hd{padding:14px 18px;border-bottom:2px solid var(--nm-game-border);
  background:var(--nm-game-bg-head)}
#${MODAL_ID} .hd h2{margin:0;font-size:19px;letter-spacing:.12em;font-weight:normal}
#${MODAL_ID} .bd{overflow-y:auto;padding:6px 18px 18px}
/* One clickable row per version; the changes hang below it. */
#${MODAL_ID} .ver{display:flex;align-items:baseline;gap:10px;cursor:pointer;
  margin-top:8px;padding:10px 2px;border-bottom:2px solid var(--nm-game-rule);
  transition:color .12s}
#${MODAL_ID} .ver:hover{background:var(--nm-game-row-hover)}
#${MODAL_ID} .ver .caret{flex:0 0 14px;font-size:11px;color:var(--nm-game-text-faint);
  transition:transform .12s}
#${MODAL_ID} .ver.open .caret{transform:rotate(90deg)}
#${MODAL_ID} .ver .v{font-size:17px;letter-spacing:.08em}
#${MODAL_ID} .ver .d{font-size:12px;color:var(--nm-game-text-faint)}
#${MODAL_ID} .ver .n{margin-left:auto;font-size:11px;color:var(--nm-game-text-fainter)}
#${MODAL_ID} ul{list-style:none;margin:0;padding:4px 0 10px}
#${MODAL_ID} ul[hidden]{display:none}
#${MODAL_ID} li{display:flex;gap:10px;padding:5px 0;font-size:13px;line-height:1.5;
  color:var(--nm-game-text-body)}
/*
 * Uniform tag column. min-width:0 is the load-bearing part: a flex item
 * defaults to min-width:auto, so "CHANGED" refused to shrink into the basis
 * and shoved its own line's text further right than the shorter tags.
 * Centring makes the narrower words sit evenly in the same box.
 */
#${MODAL_ID} .tag{flex:0 0 74px;min-width:0;text-align:center;
  font-size:11px;letter-spacing:.06em;padding-top:2px}
#${MODAL_ID} .tag.added{color:var(--nm-ok)}
#${MODAL_ID} .tag.fixed{color:var(--nm-tag-fixed)}
#${MODAL_ID} .tag.changed{color:var(--nm-tag-changed)}
`;

let closeModal: (() => void) | null = null;

/**
 * Find a menu row worth copying. Skips anything with an id already or one of
 * the promo classes: battle pass and guide rows are .menuItem too but carry
 * extra structure, and the promo ones are hidden, which we'd inherit.
 */
function findTemplate(container: HTMLElement): HTMLElement | null {
  for (const el of container.querySelectorAll<HTMLElement>('.menuItem')) {
    if (el.id !== '') continue;
    const cls = String(el.className);
    if (cls.includes('bpItem') || cls.includes('dsItem') || cls.includes('guideItem')) continue;
    if (!el.querySelector('.menuItemIcon') || !el.querySelector('.menuItemTitle')) continue;
    return el;
  }
  return null;
}

function place(): void {
  const container = document.getElementById(CONTAINER_ID);
  if (!container) return;
  if (document.getElementById(ITEM_ID)) return;

  const template = findTemplate(container);
  if (!template) return;

  const item = template.cloneNode(true) as HTMLElement;
  item.id = ITEM_ID;
  // The template might be hidden itself, and ids inside the clone would
  // duplicate the game's own.
  item.style.removeProperty('display');
  item.removeAttribute('onclick');
  for (const el of item.querySelectorAll('[id]')) el.removeAttribute('id');

  const icon = item.querySelector('.menuItemIcon');
  if (icon) icon.textContent = ICON;

  const title = item.querySelector('.menuItemTitle');
  if (!title) return;
  // replaceChildren throws out whatever the template had in it (badges,
  // counters, Svelte's comment markers) and leaves just our label.
  title.replaceChildren(document.createTextNode(`${BRANDING.productName} Changelog`));
  title.removeAttribute('onclick');

  item.addEventListener('mouseenter', () => {
    const tick = (window as unknown as { playTick?: () => void }).playTick;
    if (typeof tick === 'function') tick();
  });
  item.addEventListener('click', () => {
    const select = (window as unknown as { playSelect?: (v: number) => void }).playSelect;
    if (typeof select === 'function') select(0.1);
    toggleChangelog();
  });

  container.insertBefore(item, container.firstChild);
}

/** Open the changelog, or close it if it's already open. */
export function toggleChangelog(): void {
  if (closeModal) {
    closeModal();
    return;
  }
  open(null);
}

/**
 * Open on a specific version, expanded.
 *
 * Called once after an update, so the first thing you see is what changed.
 * Re-opening an already-open panel would be worse than doing nothing, so an
 * existing one is left alone.
 */
export function showPatchNotes(version: string): void {
  if (closeModal) return;
  open(version);
}

function open(expandVersion: string | null): void {
  defineStyle(STYLE_ID, CSS);

  const backdrop = document.createElement('div');
  backdrop.id = `${MODAL_ID}-backdrop`;
  const panel = document.createElement('div');
  panel.id = MODAL_ID;
  backdrop.appendChild(panel);

  const head = document.createElement('div');
  head.className = 'hd';
  const title = document.createElement('h2');
  title.textContent = `${BRANDING.productName} CHANGELOG`.toUpperCase();
  head.appendChild(title);

  const body = document.createElement('div');
  body.className = 'bd';

  for (const entry of CHANGELOG) {
    const ver = document.createElement('div');
    ver.className = 'ver';

    const caret = document.createElement('span');
    caret.className = 'caret';
    caret.textContent = '▶';
    const v = document.createElement('span');
    v.className = 'v';
    v.textContent = `v${entry.version}`;
    const d = document.createElement('span');
    d.className = 'd';
    d.textContent = entry.date;
    const n = document.createElement('span');
    n.className = 'n';
    n.textContent = `${entry.changes.length} change${entry.changes.length === 1 ? '' : 's'}`;
    ver.append(caret, v, d, n);

    const ul = document.createElement('ul');
    // Collapsed to start. It's a table of contents until you ask for more,
    // which is the point of splitting it up. The version we were opened for,
    // if any, is the one thing already showing.
    const expanded = expandVersion !== null && entry.version === expandVersion;
    ul.hidden = !expanded;
    if (expanded) ver.classList.add('open');
    for (const change of entry.changes) {
      const li = document.createElement('li');
      const tag = document.createElement('span');
      tag.className = `tag ${change.kind satisfies ChangeKind}`;
      tag.textContent = change.kind.toUpperCase();
      const text = document.createElement('span');
      text.textContent = change.text;
      li.append(tag, text);
      ul.appendChild(li);
    }

    ver.addEventListener('click', () => {
      ul.hidden = !ul.hidden;
      ver.classList.toggle('open', !ul.hidden);
      const tick = (window as unknown as { playTick?: () => void }).playTick;
      if (typeof tick === 'function') tick();
    });

    body.append(ver, ul);
  }

  panel.append(head, body);

  // Captured ahead of Krunker's handler, which otherwise eats Escape and opens
  // the game menu behind us.
  const onKey = (event: KeyboardEvent): void => {
    if (event.key !== 'Escape') return;
    event.stopPropagation();
    event.preventDefault();
    closeModal?.();
  };
  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) closeModal?.();
  });
  closeModal = () => {
    document.removeEventListener('keydown', onKey, true);
    backdrop.remove();
    closeModal = null;
  };
  document.addEventListener('keydown', onKey, true);
  document.body.appendChild(backdrop);
}

/**
 * Add the row and keep it there. Krunker rebuilds the menu list on navigation
 * and throws the clone away. `place()` bails after one getElementById when the
 * row is already up.
 */
export function installChangelogItem(): void {
  place();
  const root = document.getElementById('menuHider') ?? document.body;
  if (!root) return;
  new MutationObserver(() => place()).observe(root, { childList: true, subtree: true });
}
