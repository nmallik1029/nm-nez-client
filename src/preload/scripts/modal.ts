import { ipcRenderer } from 'electron';
import { IPC } from '../../shared/ipc';
import { SHEETS, STYLE_IDS, UI_IDS } from '../../shared/ui';
import { defineStyle } from '../style';
import { CLIENT_SCRIPTS } from './registry';
import { isScriptRunning, setScriptEnabled } from './runner';

/**
 * The scripts window.
 *
 * One row per built-in script, with a switch. The switch reads from the
 * runner rather than from config, because the runner is what is actually
 * true: a script that threw on the way in is off however the config has it.
 * Config is written alongside so the choice survives a restart.
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

/** Persist the on/off list. The runner has already acted on it. */
function saveEnabled(): void {
  const enabled = CLIENT_SCRIPTS.filter((s) => isScriptRunning(s.id)).map((s) => s.id);
  void ipcRenderer.invoke(IPC.configPatch, 'features', { enabledScripts: enabled });
}

/** One row: icon, name and description, switch. */
function scriptRow(id: string, icon: string, name: string, description: string): HTMLElement {
  const row = document.createElement('div');
  row.className = 'row';

  const glyph = document.createElement('span');
  // Krunker already loads Material Icons, so the ligature is enough.
  glyph.className = 'material-icons ico';
  glyph.textContent = icon;

  const text = document.createElement('div');
  text.className = 'txt';
  const title = document.createElement('div');
  title.className = 'nm';
  title.textContent = name;
  const sub = document.createElement('div');
  sub.className = 'sub';
  sub.textContent = description;
  text.append(title, sub);

  const toggle = document.createElement('button');
  const paint = (): void => {
    const on = isScriptRunning(id);
    toggle.textContent = on ? 'ON' : 'OFF';
    toggle.classList.toggle('on', on);
    // The icon lights up too, so a glance down the list reads as a list
    // rather than as a column of identical buttons.
    row.classList.toggle('live', on);
  };
  toggle.addEventListener('click', () => {
    setScriptEnabled(id, !isScriptRunning(id));
    saveEnabled();
    paint();
  });
  paint();

  row.append(glyph, text, toggle);
  return row;
}

/** Everything inside the panel. */
function renderScripts(panel: HTMLElement): void {
  panel.replaceChildren();

  const head = document.createElement('div');
  head.className = 'hd';
  const title = document.createElement('h2');
  title.textContent = 'SCRIPTS';
  head.appendChild(title);

  const body = document.createElement('div');
  body.className = 'bd';

  if (CLIENT_SCRIPTS.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'empty';
    empty.textContent = 'No scripts yet.';
    body.appendChild(empty);
  } else {
    for (const script of CLIENT_SCRIPTS) {
      body.appendChild(scriptRow(script.id, script.icon, script.name, script.description));
    }
  }

  const note = document.createElement('div');
  note.className = 'note';
  note.textContent = 'Your own .js files still go in the swap folder, switched on under Settings.';
  body.appendChild(note);

  panel.append(head, body);
}
