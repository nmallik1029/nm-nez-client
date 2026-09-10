import { SHEETS, STYLE_IDS, UI_IDS } from '../../shared/ui';
import { defineStyle } from '../style';

/**
 * The scripts window.
 *
 * Empty on purpose for now: the shell, the styling and the open/close
 * behaviour are the part worth getting right once, and the scripts themselves
 * go in as they are written. `renderScripts` is the single place a list would
 * replace the placeholder.
 *
 * Same shell as the alt manager, and closed the same two ways: click the
 * backdrop or press Escape. No close button, because one control in a corner
 * is one control to keep aligned against nothing.
 */

const ID = UI_IDS.scriptsModal;

let close: (() => void) | null = null;

/** Open the scripts window, or close it if it is already open. */
export function toggleScripts(): void {
  if (close) {
    close();
    return;
  }
  open();
}

function open(): void {
  defineStyle(STYLE_IDS.scriptsModal, SHEETS.scriptsModal);

  const backdrop = document.createElement('div');
  backdrop.id = `${ID}-backdrop`;
  const panel = document.createElement('div');
  panel.id = ID;
  backdrop.appendChild(panel);

  // Captured ahead of Krunker's own handler, which otherwise eats Escape and
  // opens the game menu behind us.
  const onKey = (event: KeyboardEvent): void => {
    if (event.key !== 'Escape') return;
    event.stopPropagation();
    event.preventDefault();
    close?.();
  };
  backdrop.addEventListener('click', (event) => {
    if (event.target === backdrop) close?.();
  });

  close = () => {
    document.removeEventListener('keydown', onKey, true);
    backdrop.remove();
    close = null;
  };
  document.addEventListener('keydown', onKey, true);
  document.body.appendChild(backdrop);

  renderScripts(panel);
}

/** Everything inside the panel. Where the list will go. */
function renderScripts(panel: HTMLElement): void {
  panel.replaceChildren();

  const head = document.createElement('div');
  head.className = 'hd';
  const title = document.createElement('h2');
  title.textContent = 'SCRIPTS';
  head.appendChild(title);

  const body = document.createElement('div');
  body.className = 'bd';

  const empty = document.createElement('div');
  empty.className = 'empty';
  empty.textContent = 'No scripts yet.';

  const note = document.createElement('div');
  note.className = 'note';
  note.textContent = 'Quality-of-life and fun scripts will show up here.';

  body.append(empty, note);
  panel.append(head, body);
}
