import { ipcRenderer } from 'electron';
import { BRANDING } from '../shared/branding';
import { IPC, type UpdateState } from '../shared/ipc';
import { defineStyle } from './style';
import { SHEETS, STYLE_IDS, UI_IDS } from '../shared/ui';

/**
 * The update prompt.
 *
 * One panel, bottom right, that walks the whole flow: a new version is out,
 * do you want it, here's the download, restart when you're ready. It sits in
 * a corner rather than over the middle of the screen because an update is
 * never urgent enough to interrupt a round.
 *
 * Nothing shows until there is genuinely something to say. No "you're up to
 * date" popup on every launch; a check that finds nothing is silent unless
 * you asked for it from settings.
 *
 * Krunker's palette and GameFont so it reads as part of the client, and the
 * whole thing is textContent and createElement, no innerHTML, same as every
 * other overlay here.
 */

let panel: HTMLDivElement | null = null;
/** Dismissed for this session; a later state change should not bring it back. */
let dismissed = false;

function close(): void {
  panel?.remove();
  panel = null;
}

function ensurePanel(): HTMLDivElement {
  if (panel?.isConnected) return panel;
  defineStyle(STYLE_IDS.update, SHEETS.update);

  const el = document.createElement('div');
  el.id = UI_IDS.updatePanel;
  const head = document.createElement('div');
  head.className = 'hd';
  head.textContent = `${BRANDING.productName} UPDATE`;
  const body = document.createElement('div');
  body.className = 'bd';
  el.append(head, body);
  document.body.appendChild(el);
  panel = el;

  // Next frame, so the transition has a start value to move from.
  requestAnimationFrame(() => el.classList.add('kc-in'));
  return el;
}

function body(): HTMLElement {
  return ensurePanel().querySelector('.bd') as HTMLElement;
}

function message(text: string, version?: string): HTMLElement {
  const p = document.createElement('div');
  p.className = 'msg';
  if (version === undefined) {
    p.textContent = text;
    return p;
  }
  // Split rather than innerHTML so the version can be coloured without
  // building markup from a string.
  const [before, after] = text.split('{v}');
  p.append(
    document.createTextNode(before ?? ''),
    Object.assign(document.createElement('span'), { className: 'ver', textContent: version }),
    document.createTextNode(after ?? ''),
  );
  return p;
}

function button(label: string, primary: boolean, onClick: () => void): HTMLButtonElement {
  const b = document.createElement('button');
  if (primary) b.className = 'go';
  b.textContent = label;
  b.addEventListener('click', onClick);
  return b;
}

/** Draw whatever the current state calls for. */
export function renderUpdateState(state: UpdateState, manual: boolean): void {
  // A silent background check that finds nothing, or an error nobody asked
  // for, should not put anything on screen.
  if (!manual && (state.status === 'none' || state.status === 'error' || state.status === 'checking')) {
    return;
  }
  if (state.status === 'idle') return;
  if (dismissed && state.status === 'available') return;

  const bd = body();
  bd.replaceChildren();

  switch (state.status) {
    case 'checking':
      bd.append(message('Checking for updates...'));
      return;

    case 'none':
      bd.append(message('You are on the latest version, {v}.', state.version));
      setTimeout(close, 2600);
      return;

    case 'available': {
      bd.append(message('Version {v} is available. Update now?', state.version));
      const row = document.createElement('div');
      row.className = 'row';
      row.append(
        button('UPDATE', true, () => void ipcRenderer.invoke(IPC.updateDownload)),
        button('LATER', false, () => {
          dismissed = true;
          close();
        }),
      );
      bd.append(row);
      return;
    }

    case 'downloading': {
      bd.append(message(`Downloading ${state.percent}%`));
      const bar = document.createElement('div');
      bar.className = 'bar';
      const fill = document.createElement('i');
      fill.style.width = `${state.percent}%`;
      bar.appendChild(fill);
      bd.append(bar);
      return;
    }

    case 'ready': {
      bd.append(message('Version {v} is ready. The client will restart.', state.version));
      const row = document.createElement('div');
      row.className = 'row';
      row.append(
        button('RESTART', true, () => void ipcRenderer.invoke(IPC.updateInstall)),
        button('LATER', false, () => {
          // Only hides the panel. The download is already on disk and main
          // will not install it on its own, so nothing is lost either way.
          dismissed = true;
          close();
        }),
      );
      bd.append(row);
      return;
    }

    case 'error':
      bd.append(message(state.message));
      setTimeout(close, 4000);
      return;
  }
}

/**
 * Listen for update news from main.
 *
 * `manual` tracks whether the user pressed Check in settings, because that is
 * the only time "no update" and "it failed" are worth showing.
 */
export function installUpdatePrompt(): void {
  ipcRenderer.on(IPC.updateState, (_event, state: UpdateState) => {
    renderUpdateState(state, manualCheck);
    // One manual check answers once. Anything after it is background again.
    if (state.status === 'none' || state.status === 'error') manualCheck = false;
  });
}

let manualCheck = false;

/** Called from the settings button, so the next result is allowed to be visible. */
export function checkForUpdatesNow(): void {
  manualCheck = true;
  dismissed = false;
  void ipcRenderer.invoke(IPC.updateCheck);
}
