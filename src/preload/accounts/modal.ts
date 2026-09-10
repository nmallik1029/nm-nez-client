import { ipcRenderer } from 'electron';
import { blockMessage, type AccountSummary, type Credentials } from '../../shared/accounts';
import { IPC } from '../../shared/ipc';
import { showToast } from '../toast';
import { SHEETS, STYLE_IDS, UI_IDS } from '../../shared/ui';
import { defineStyle } from '../style';
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
 * Styled to pass for one of Krunker's own panels; see `shared/ui/sheets.ts`.
 */

const ID = UI_IDS.altModal;

let close: (() => void) | null = null;
/** The add form only appears once "+" is pressed. */
let adding = false;

const list = (active: string): Promise<AccountSummary[]> =>
  ipcRenderer.invoke(IPC.accountsList, active).then((r: unknown) => (r as AccountSummary[]) ?? []);

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
  defineStyle(STYLE_IDS.altModal, SHEETS.altModal);
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
