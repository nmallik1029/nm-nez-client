import { ipcRenderer } from 'electron';
import { BRANDING } from '../shared/branding';
import { IPC, type UpdateState } from '../shared/ipc';

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

const ID = 'kc-update';
const STYLE_ID = 'kc-update-css';

const CSS = `
#${ID}{position:fixed;right:18px;bottom:18px;z-index:100001;width:320px;
  background:#1e1e1e;border:2px solid #3a3a3a;color:#fff;
  font-family:'GameFont',Impact,'Arial Black',sans-serif;
  box-shadow:0 6px 24px rgba(0,0,0,.5);
  transform:translateY(12px);opacity:0;transition:opacity .16s,transform .16s}
#${ID}.kc-in{opacity:1;transform:translateY(0)}
#${ID} .hd{padding:11px 14px;background:#171717;border-bottom:2px solid #3a3a3a;
  font-size:14px;letter-spacing:.1em}
#${ID} .bd{padding:13px 14px 14px}
#${ID} .msg{font-size:13px;line-height:1.5;color:#c8c8c8}
#${ID} .ver{color:#a9c4a6}
#${ID} .row{display:flex;gap:8px;margin-top:13px}
#${ID} button{flex:1;padding:8px 10px;cursor:pointer;font:inherit;font-size:12px;
  letter-spacing:.06em;color:#fff;background:#2a2a2a;border:2px solid #3f3f3f;
  transition:background .12s}
#${ID} button:hover{background:#343434}
#${ID} button.go{background:#2f6b3f;border-color:#3f8a52}
#${ID} button.go:hover{background:#38804b}
/* Track is always drawn so the panel doesn't resize when the bar appears. */
#${ID} .bar{height:6px;background:#2a2a2a;border:1px solid #3f3f3f;margin-top:12px}
#${ID} .bar i{display:block;height:100%;width:0;background:#3f8a52;transition:width .2s}
`;

let panel: HTMLDivElement | null = null;
/** Dismissed for this session; a later state change should not bring it back. */
let dismissed = false;

function injectStyle(): void {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = CSS;
  document.head?.appendChild(style);
}

function close(): void {
  panel?.remove();
  panel = null;
}

function ensurePanel(): HTMLDivElement {
  if (panel?.isConnected) return panel;
  injectStyle();

  const el = document.createElement('div');
  el.id = ID;
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
