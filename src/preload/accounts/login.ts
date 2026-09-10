import type { Credentials, LoginBlock } from '../../shared/accounts';

/**
 * Signing in as a saved account by driving Krunker's own login form.
 *
 * The form is `#accEmail` + `#accPass` inside a `.io-popup-content` popup that
 * the game's `loginOrRegister()` opens. Auth is FRVR's SDK underneath, but the
 * SDK puts up an ordinary email/password form, and filling that in is exactly
 * what you'd do by hand.
 *
 * Two modes to watch for. It opens on email (`#accEmail`, type="email") with a
 * toggle over to `#accName`, type="text". This matters more than it looks: a
 * bare username in email mode fails HTML5 validation, and requestSubmit() then
 * does absolutely nothing and says nothing about it. The popup just sits there.
 * So pick the mode to suit the credential before typing anything.
 *
 * The other awkward bit is that Krunker only allows one sign-in per page load.
 * The SDK caches auth state in memory and doesn't fully clear it on logout, so
 * a second go fails whatever you type. `loginBlock()` says so up front instead
 * of letting it come back as a wrong-password error.
 */

const FORM = {
  email: 'accEmail',
  username: 'accName',
  password: 'accPass',
  popup: '[class*="io-popup-content"]',
  /** Swaps the form between email and username mode. */
  toggle: '.auth-toggle-btn',
  /** Where Krunker prints "bad credentials err" and friends. */
  message: '.io-message',
} as const;

/**
 * True once this page has been through a login or a logout.
 *
 * Set from three places, because a session can end through any of them: the
 * game's own menu button, the SDK directly, or our switch.
 */
let sessionSpent = false;

/** Krunker's record of who is signed in. '' when signed out. */
export function currentUsername(): string {
  try {
    return window.localStorage.getItem('krunker_username') ?? '';
  } catch {
    return '';
  }
}

/**
 * Why a switch can't go ahead, or 'ok'. Checked before we try, so you get the
 * real reason instead of whatever Krunker says when its second attempt fails.
 */
export function loginBlock(): LoginBlock {
  if (currentUsername() !== '') return 'signed-in';
  if (sessionSpent) return 'needs-restart';
  return 'ok';
}

/**
 * Catch a session ending, so the next switch can be turned down cleanly.
 *
 * Both entry points get wrapped rather than polling `krunker_username`. A
 * logout has to be seen even if the page is torn down right after, and a poll
 * would miss that window.
 */
export function watchSessionEnd(): void {
  const w = window as unknown as {
    logoutAcc?: () => unknown;
    FRVR?: { auth?: { logout?: () => unknown } };
  };

  if (typeof w.logoutAcc === 'function') {
    const original = w.logoutAcc.bind(window);
    w.logoutAcc = () => {
      sessionSpent = true;
      return original();
    };
  }

  const auth = w.FRVR?.auth;
  if (auth && typeof auth.logout === 'function') {
    const original = auth.logout.bind(auth);
    auth.logout = () => {
      sessionSpent = true;
      return original();
    };
  }
}

export interface LoginResult {
  readonly ok: boolean;
  /** Empty when ok. */
  readonly message: string;
}

/**
 * Fill the form with `credentials` and submit it. Resolves when the game
 * reports a username, or fails once Krunker shows an error or the attempt
 * stops going anywhere.
 */
export async function signIn(credentials: Credentials): Promise<LoginResult> {
  const opened = openLoginForm();
  if (!opened) return { ok: false, message: 'Krunker did not open its login form' };

  // Address in the email field, anything else in the username field. A
  // username in the email field makes the form unsubmittable.
  const wantEmail = credentials.username.includes('@');
  const identifier = await ensureMode(wantEmail);
  const password = document.getElementById(FORM.password);
  if (!identifier || !(password instanceof HTMLInputElement)) {
    return { ok: false, message: 'Could not find the login fields' };
  }

  setInputValue(identifier, credentials.username);
  setInputValue(password, credentials.password);

  // Catch that here rather than submitting into the void.
  if (!identifier.checkValidity()) {
    return { ok: false, message: identifier.validationMessage || 'Krunker rejected that username' };
  }

  // From here the attempt is spent either way. The SDK won't take a second
  // one on this page.
  sessionSpent = true;

  if (!submit(identifier)) return { ok: false, message: 'Could not submit the login form' };

  return waitForOutcome();
}

/**
 * Put the form into email or username mode and hand back the identifier field.
 * Krunker remembers the last mode used, so even a fresh popup might not be in
 * the one we want.
 */
async function ensureMode(wantEmail: boolean): Promise<HTMLInputElement | null> {
  const wantedId = wantEmail ? FORM.email : FORM.username;

  let field = await waitFor<HTMLInputElement>(wantedId, 6000);
  if (field) return field;

  // Wrong mode. Note the toggle is labelled with the mode it switches to.
  const wanted = wantEmail ? /use email/i : /use username/i;
  const toggle = [...document.querySelectorAll<HTMLElement>(FORM.toggle)].find((el) =>
    wanted.test(el.textContent ?? ''),
  );
  if (!toggle) return null;
  toggle.click();

  field = await waitFor<HTMLInputElement>(wantedId, 4000);
  return field;
}

/** Ask Krunker to show the login popup. */
function openLoginForm(): boolean {
  // Either mode counts as open. Check only the email field and you reopen the
  // popup any time it was left in username mode.
  if (document.getElementById(FORM.email) ?? document.getElementById(FORM.username)) return true;
  const open = (window as unknown as { loginOrRegister?: (register?: boolean) => void })
    .loginOrRegister;
  if (typeof open !== 'function') return false;
  try {
    open(false);
    return true;
  } catch {
    return false;
  }
}

/**
 * Set a value the way a keystroke would.
 *
 * The form is Svelte-compiled and binds on the `input` event, so assigning
 * `.value` updates the DOM but not the component state, and it submits empty.
 * Going through the native setter first is what makes the framework notice.
 */
function setInputValue(input: HTMLInputElement, value: string): void {
  // unbound-method fires on lifting an accessor off a prototype, which is the
  // whole point here. It's invoked with .call(input, ...) below, so nothing
  // loses its receiver.
  // eslint-disable-next-line @typescript-eslint/unbound-method
  const setter = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    'value',
  )?.set;
  if (setter) setter.call(input, value);
  else input.value = value;
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
}

/**
 * Submit however the form lets us, most reliable first.
 *
 * requestSubmit runs validation and fires the framework's submit handler,
 * which is what the Login button does anyway. The button and the Enter key are
 * there in case Krunker drops the form element.
 */
function submit(anchor: HTMLElement): boolean {
  const form = anchor.closest('form');
  if (form) {
    form.requestSubmit();
    return true;
  }

  const popup = anchor.closest(FORM.popup) ?? document;
  for (const el of popup.querySelectorAll('button, [class*="button"]')) {
    if (/^(log ?in|sign ?in)$/i.test((el.textContent ?? '').trim())) {
      (el as HTMLElement).click();
      return true;
    }
  }

  anchor.dispatchEvent(
    new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }),
  );
  return true;
}

/**
 * Wait for the login to land.
 *
 * Success is Krunker writing `krunker_username`. Failure is an error in the
 * popup, or nothing at all: a login that neither works nor complains is the
 * SDK quietly refusing a second attempt, and that's worth saying out loud
 * rather than leaving a spinner up.
 */
function waitForOutcome(): Promise<LoginResult> {
  const deadline = Date.now() + 15000;

  return new Promise((resolve) => {
    const tick = (): void => {
      const user = currentUsername();
      if (user !== '') {
        resolve({ ok: true, message: '' });
        return;
      }

      const error = visibleError();
      if (error !== '') {
        resolve({ ok: false, message: error });
        return;
      }

      if (Date.now() >= deadline) {
        resolve({
          ok: false,
          message: 'Krunker did not respond. Restart the client and try again.',
        });
        return;
      }
      window.setTimeout(tick, 250);
    };
    tick();
  });
}

/**
 * Whatever error Krunker is showing in the popup, or ''.
 *
 * The element is `.io-message`, found by submitting deliberately wrong
 * credentials and reading what came back ("bad credentials err"). Nothing in
 * the popup is classed "error", which is why looking for that name turned up
 * nothing and every failed login looked like a timeout.
 */
function visibleError(): string {
  const popup = document.querySelector(FORM.popup);
  if (!popup) return '';
  for (const el of popup.querySelectorAll(`${FORM.message}, [class*="error"]`)) {
    const text = (el.textContent ?? '').trim();
    if (text !== '' && text.length < 200) return text;
  }
  return '';
}

/** Poll for an element that Krunker renders asynchronously. */
function waitFor<T extends HTMLElement>(id: string, timeoutMs: number): Promise<T | null> {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolve) => {
    const tick = (): void => {
      const el = document.getElementById(id);
      if (el) {
        resolve(el as T);
        return;
      }
      if (Date.now() >= deadline) {
        resolve(null);
        return;
      }
      window.setTimeout(tick, 100);
    };
    tick();
  });
}
