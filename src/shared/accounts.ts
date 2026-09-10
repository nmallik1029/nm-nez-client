/**
 * Types for the alt manager.
 *
 * Accounts are stored as credentials and replayed through Krunker's own login
 * form (`#accEmail` + `#accPass` inside `.io-popup-content`, opened by the
 * game's `loginOrRegister()`). Auth is FRVR's SDK underneath, but the SDK
 * still puts up a plain email/password form.
 *
 * The page can only log in once per load. FRVR keeps auth state in memory, so
 * a second attempt after any login or logout fails whatever you type at it.
 * `LoginBlock` reports that before we waste an attempt finding out.
 */

/** What the user types. `username` is whatever Krunker's field accepts. */
export interface Credentials {
  readonly username: string;
  readonly password: string;
}

/**
 * - `ok`            nothing in the way.
 * - `signed-in`     a session is active; Krunker refuses a second login.
 * - `needs-restart` this page already logged in or out once, so FRVR's
 *                   in-memory state is spent and only a reload clears it.
 */
export type LoginBlock = 'ok' | 'signed-in' | 'needs-restart';

/** An account as the UI sees it. Never carries the password. */
export interface AccountSummary {
  readonly id: string;
  readonly label: string;
  readonly username: string;
  /** Epoch ms the account was saved. */
  readonly savedAt: number;
  readonly active: boolean;
}

/** One stored account. `blob` is ciphertext; only main can read it. */
export interface StoredAccount {
  readonly id: string;
  readonly label: string;
  /** In the clear so the list can be drawn without decrypting anything. */
  readonly username: string;
  readonly savedAt: number;
  /** base64 of the safeStorage-encrypted Credentials JSON. */
  readonly blob: string;
}

export function blockMessage(block: LoginBlock): string {
  switch (block) {
    case 'signed-in':
      return 'Already signed in. Sign out of Krunker first, then restart the client.';
    case 'needs-restart':
      return 'Krunker only allows one sign-in per session. Restart the client to switch.';
    case 'ok':
      return '';
  }
}
