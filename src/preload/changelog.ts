import { BRANDING } from '../shared/branding';
import { CHANGELOG, type ChangeKind } from '../shared/changelog';
import { SHEETS, STYLE_IDS, UI_IDS } from '../shared/ui';
import { installMenuItem } from './menu-item';
import { defineStyle } from './style';

/**
 * The changelog: a row in Krunker's left menu, and the panel it opens.
 *
 * Versions start collapsed; clicking one shows its changes. The exception is
 * `showPatchNotes`, which is what runs after an update installs and opens the
 * new version already expanded, since that is the thing you just asked to read.
 *
 * The row itself is one of Krunker's own, cloned and relabelled by
 * `menu-item.ts`, which is also what puts it back when the game rebuilds
 * its menu.
 */

const ITEM_ID = UI_IDS.changelogItem;
const MODAL_ID = UI_IDS.changelogModal;
/** Material icon name. Matches the game's own outlined set. */
const ICON = 'description';

let closeModal: (() => void) | null = null;

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
  defineStyle(STYLE_IDS.changelog, SHEETS.changelog);

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

/** Add the row, at the top of the list. */
export function installChangelogItem(): void {
  installMenuItem({
    id: ITEM_ID,
    icon: ICON,
    label: `${BRANDING.productName} Changelog`,
    position: 'top',
    onClick: toggleChangelog,
  });
}
