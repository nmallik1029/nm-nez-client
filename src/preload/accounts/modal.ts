import { ipcRenderer } from 'electron';
import { blockMessage, type AccountSummary, type Credentials } from '../../shared/accounts';
import { IPC } from '../../shared/ipc';
import { showToast } from '../toast';
import { currentUsername, loginBlock, signIn } from './login';

/**
 * The Alt Manager window.
 *
 * Add accounts with "+". They're stored as credentials, so you don't need to
 * be signed in to anything first, and switching replays them through Krunker's
 * own login form.
 *
 * Because the game only allows one sign-in per page load, the two states that
 * make a switch impossible get reported before we try rather than after: an
 * active session, and a page that's already signed in or out once. See
 * `loginBlock()`.
 *
 * Krunker's palette, so it reads as part of the game.
 */

const ID = 'kc-alt-modal';
const STYLE_ID = 'kc-alt-modal-css';

const CSS = `
#${ID}-backdrop{position:fixed;inset:0;z-index:100000;background:rgba(0,0,0,.72);
  display:flex;align-items:center;justify-content:center}
#${ID}{width:min(560px,92vw);max-height:82vh;display:flex;flex-direction:column;
  background:#1e1e1e;border:2px solid #3a3a3a;color:#fff;
  font-family:'GameFont',Impact,'Arial Black',sans-serif}
#${ID} .hd{display:flex;align-items:center;justify-content:space-between;
  padding:14px 18px;border-bottom:2px solid #3a3a3a;background:#171717}
#${ID} .hd h2{margin:0;font-size:19px;letter-spacing:.12em;font-weight:normal}
#${ID} .bd{overflow-y:auto;padding:14px 18px 18px}
/* Column so the button sits on its own line: inline after wrapped text, it
   never lines up with anything. */
#${ID} .warn{display:flex;flex-direction:column;align-items:flex-start;gap:10px;
  font-size:13px;line-height:1.5;margin-bottom:14px;padding:10px 12px;
  background:#2a2320;border:2px solid #6d4b47;color:#d8a9a3}
#${ID} .row{display:flex;align-items:center;gap:12px;padding:11px 12px;margin-bottom:8px;
  background:#262626;border:2px solid #3a3a3a}
#${ID} .row.on{border-color:#7d9d7a;background:#232922}
#${ID} .who{flex:1;min-width:0}
#${ID} .nm{font-size:16px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
#${ID} .sub{font-size:12px;color:#8b8b8b;margin-top:2px;
  overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
#${ID} button{font-family:inherit;cursor:pointer;border:2px solid #4a4a4a;
  background:#2f2f2f;color:#ddd;padding:7px 14px;font-size:13px;letter-spacing:.06em}
#${ID} button:hover{background:#3b3b3b;color:#fff}
#${ID} button.go{border-color:#7d9d7a;color:#a9c4a6}
#${ID} button.go:hover{background:#2c3a2b;color:#d6e6d4}
#${ID} button.del{border-color:#6d4b47;color:#c98b84;padding:7px 11px}
#${ID} button.del:hover{background:#3a2a28;color:#e8bab4}
#${ID} button:disabled{opacity:.4;cursor:default}
/* Square, and centred on the title's optical middle rather than its box. The
   plus is drawn rather than typed: GameFont's own "+" is a heavy pixel glyph
   that reads as some other icon at this size. */
#${ID} button.add{display:flex;align-items:center;justify-content:center;
  width:30px;height:30px;padding:0;border-color:#7d9d7a;color:#a9c4a6}
#${ID} button.add svg{width:14px;height:14px;fill:none;stroke:currentColor;
  stroke-width:2.4;stroke-linecap:round}
#${ID} .form{display:flex;flex-direction:column;gap:8px;margin-top:14px;
  padding-top:14px;border-top:2px solid #3a3a3a}
#${ID} .form input{font-family:inherit;font-size:14px;padding:8px 10px;
  background:#141414;border:2px solid #3a3a3a;color:#fff}
#${ID} .form input:focus{outline:none;border-color:#5a5a5a}
#${ID} .form .actions{display:flex;gap:8px;justify-content:flex-end}
#${ID} .empty{padding:22px 0;text-align:center;color:#8b8b8b;font-size:14px}
#${ID} .note{font-size:12px;color:#7a7a7a;line-height:1.5;margin-top:12px}
`;

let close: (() => void) | null = null;
/** The add form only appears once "+" is pressed. */
let adding = false;

const list = (active: string): Promise<AccountSummary[]> =>
  ipcRenderer.invoke(IPC.accountsList, active).then((r: unknown) => (r as AccountSummary[]) ?? []);

function injectStyle(): void {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = CSS;
  document.head?.appendChild(style);
}

export interface AltModalDeps {
  /** False when the OS cannot encrypt, which disables saving entirely. */
  readonly canStore: boolean;
}

/** Open the manager, or close it if it's already open. */
export function toggleAltManager(deps: AltModalDeps): void {
  if (close) {
    close();
    return;
  }
  void open(deps);
}

async function open(deps: AltModalDeps): Promise<void> {
  injectStyle();
  adding = false;

  const backdrop = document.createElement('div');
  backdrop.id = `${ID}-backdrop`;
  const panel = document.createElement('div');
  panel.id = ID;
  backdrop.appendChild(panel);

  // Captured ahead of Krunker's handler, which otherwise eats Escape and opens
  // the game menu behind us.
  const onKey = (event: KeyboardEvent): void => {
    if (event.key !== 'Escape') return;
    event.stopPropagation();
    event.preventDefault();
    close?.();
  };
  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) close?.();
  });

  close = () => {
    document.removeEventListener('keydown', onKey, true);
    backdrop.remove();
    close = null;
  };
  document.addEventListener('keydown', onKey, true);
  document.body.appendChild(backdrop);

  await render(panel, deps);
}

async function render(panel: HTMLElement, deps: AltModalDeps): Promise<void> {
  const active = currentUsername();
  const accounts = await list(active);
  const block = loginBlock();

  panel.replaceChildren();

  // ── Header, with the add button ──
  const head = document.createElement('div');
  head.className = 'hd';
  const title = document.createElement('h2');
  title.textContent = 'ALT MANAGER';

  // No close button. Click outside or press Escape. One control in the corner
  // also can't be misaligned against another one.
  head.appendChild(title);
  if (deps.canStore) {
    const add = document.createElement('button');
    add.className = 'add';
    add.innerHTML = '<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>';
    add.title = 'Add an account';
    add.addEventListener('click', () => {
      adding = !adding;
      void render(panel, deps);
    });
    head.appendChild(add);
  }

  const body = document.createElement('div');
  body.className = 'bd';

  // ── Why switching is unavailable, if it is ──
  if (block !== 'ok') {
    const warn = document.createElement('div');
    warn.className = 'warn';
    const text = document.createElement('div');
    text.textContent = blockMessage(block);
    const restart = document.createElement('button');
    restart.textContent = 'Restart client';
    restart.addEventListener('click', () => {
      void ipcRenderer.invoke(IPC.relaunch);
    });
    warn.append(text, restart);
    body.appendChild(warn);
  }

  if (!deps.canStore) {
    const warn = document.createElement('div');
    warn.className = 'warn';
    const text = document.createElement('div');
    text.textContent =
      'Windows encryption is unavailable, so passwords cannot be stored safely and saving is disabled.';
    warn.appendChild(text);
    body.appendChild(warn);
  }

  if (accounts.length === 0 && !adding) {
    const empty = document.createElement('div');
    empty.className = 'empty';
    empty.textContent = deps.canStore
      ? 'No saved accounts. Press + to add one.'
      : 'No saved accounts.';
    body.appendChild(empty);
  }

  for (const account of accounts) {
    body.appendChild(accountRow(account, panel, deps, block === 'ok'));
  }

  if (adding && deps.canStore) body.appendChild(addForm(panel, deps));
  panel.append(head, body);
}

function accountRow(
  account: AccountSummary,
  panel: HTMLElement,
  deps: AltModalDeps,
  canSwitch: boolean,
): HTMLElement {
  const row = document.createElement('div');
  row.className = account.active ? 'row on' : 'row';

  const who = document.createElement('div');
  who.className = 'who';
  const name = document.createElement('div');
  name.className = 'nm';
  name.textContent = account.label;
  const sub = document.createElement('div');
  sub.className = 'sub';
  sub.textContent = account.active ? `${account.username} · signed in` : account.username;
  who.append(name, sub);

  const use = document.createElement('button');
  use.className = 'go';
  use.textContent = account.active ? 'Current' : 'Switch';
  use.disabled = account.active || !canSwitch;
  use.addEventListener('click', () => void switchTo(account, use, panel, deps));

  const del = document.createElement('button');
  del.className = 'del';
  del.textContent = '✕';
  del.title = `Forget ${account.label}`;
  del.addEventListener('click', () => {
    void ipcRenderer.invoke(IPC.accountsRemove, account.id).then(() => {
      showToast(`Forgot "${account.label}"`);
      return render(panel, deps);
    });
  });

  row.append(who, use, del);
  return row;
}

function addForm(panel: HTMLElement, deps: AltModalDeps): HTMLElement {
  const wrap = document.createElement('div');
  wrap.className = 'form';

  const label = field('Label (optional)', 'text');
  // Krunker's field is an email input but takes either, so word it after what
  // you've actually got rather than after the input type.
  const username = field('Email or username', 'text');
  const password = field('Password', 'password');

  const actions = document.createElement('div');
  actions.className = 'actions';
  const cancel = document.createElement('button');
  cancel.textContent = 'Cancel';
  cancel.addEventListener('click', () => {
    adding = false;
    void render(panel, deps);
  });
  const save = document.createElement('button');
  save.className = 'go';
  save.textContent = 'Save';

  const commit = (): void => {
    const credentials: Credentials = {
      username: username.value.trim(),
      password: password.value,
    };
    if (credentials.username === '' || credentials.password === '') {
      showToast('Enter both a username and a password');
      return;
    }
    void ipcRenderer
      .invoke(IPC.accountsSave, label.value, credentials)
      .then(() => {
        showToast(`Saved "${label.value.trim() === '' ? credentials.username : label.value.trim()}"`);
        adding = false;
        return render(panel, deps);
      })
      .catch((err: unknown) => {
        showToast(`Could not save: ${err instanceof Error ? err.message : String(err)}`);
      });
  };

  save.addEventListener('click', commit);
  for (const input of [label, username, password]) {
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') commit();
      // Krunker binds bare letters to game actions. Keep them in the field.
      e.stopPropagation();
    });
  }

  actions.append(cancel, save);
  wrap.append(label, username, password, actions);
  queueMicrotask(() => username.focus());
  return wrap;
}

function field(placeholder: string, type: string): HTMLInputElement {
  const input = document.createElement('input');
  input.type = type;
  input.placeholder = placeholder;
  input.autocomplete = 'off';
  input.spellcheck = false;
  return input;
}

/** Sign in as a saved account through Krunker's own login form. */
async function switchTo(
  account: AccountSummary,
  button: HTMLButtonElement,
  panel: HTMLElement,
  deps: AltModalDeps,
): Promise<void> {
  // Re-checked on the click itself, since you might have signed in or out in
  // another window since this list was drawn.
  const block = loginBlock();
  if (block !== 'ok') {
    showToast(blockMessage(block));
    void render(panel, deps);
    return;
  }

  const credentials = (await ipcRenderer.invoke(IPC.accountsReveal, account.id)) as
    | Credentials
    | null;
  if (credentials === null) {
    showToast(`Could not read "${account.label}". It may have been saved on another machine`);
    return;
  }

  button.disabled = true;
  button.textContent = 'Signing in…';

  const result = await signIn(credentials);
  if (result.ok) {
    showToast(`Signed in as ${account.label}`);
    close?.();
    return;
  }

  showToast(result.message);
  await render(panel, deps);
}
