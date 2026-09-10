import { randomUUID } from 'node:crypto';
import { safeStorage } from 'electron';
import type { AccountSummary, Credentials, StoredAccount } from '../shared/accounts';

/**
 * Encrypted storage for saved accounts.
 *
 * These are real passwords, so they go through `safeStorage`, which on Windows
 * is DPAPI keyed to your Windows user. Another user on the same machine can't
 * read them even holding the file.
 *
 * With DPAPI unavailable this refuses to save at all rather than falling back
 * to base64. Base64 is the worst option going: it looks encrypted in the file
 * so it earns trust it hasn't got, and it reverses in one line. Better to fail
 * loudly and let the user decide.
 */

export interface AccountStore {
  list(activeUsername: string): AccountSummary[];
  save(label: string, credentials: Credentials): AccountSummary;
  remove(id: string): boolean;
  rename(id: string, label: string): boolean;
  /** Decrypted credentials, or null if missing or undecryptable. */
  reveal(id: string): Credentials | null;
  readonly canEncrypt: boolean;
}

export interface AccountStoreDeps {
  readonly read: () => StoredAccount[];
  readonly write: (accounts: StoredAccount[]) => void;
  readonly log: (...args: unknown[]) => void;
  /** Injectable so the store is testable without Electron. */
  readonly crypto?: CryptoLike;
}

/** The slice of `safeStorage` this needs. */
export interface CryptoLike {
  isEncryptionAvailable(): boolean;
  encryptString(plain: string): Buffer;
  decryptString(encrypted: Buffer): string;
}

export function createAccountStore(deps: AccountStoreDeps): AccountStore {
  const crypto: CryptoLike = deps.crypto ?? safeStorage;
  const canEncrypt = crypto.isEncryptionAvailable();

  if (!canEncrypt) {
    deps.log('OS encryption unavailable, account saving is off');
  }

  function summarise(account: StoredAccount, activeUsername: string): AccountSummary {
    return {
      id: account.id,
      label: account.label,
      username: account.username,
      savedAt: account.savedAt,
      active: activeUsername !== '' && account.username === activeUsername,
    };
  }

  return {
    canEncrypt,

    list(activeUsername) {
      return deps.read().map((a) => summarise(a, activeUsername));
    },

    save(label, credentials) {
      if (!canEncrypt) {
        throw new Error('OS encryption is unavailable, so passwords cannot be stored safely');
      }

      const username = credentials.username;
      const account: StoredAccount = {
        id: randomUUID(),
        label: label.trim() === '' ? username : label.trim(),
        username,
        savedAt: Date.now(),
        blob: crypto.encryptString(JSON.stringify(credentials)).toString('base64'),
      };

      // Saving the same account again replaces it rather than duplicating.
      // The usual reason to re-save is that the password changed.
      const accounts = deps.read().filter((a) => a.username !== username);
      accounts.push(account);
      deps.write(accounts);
      deps.log(`saved account "${account.label}"`);
      return summarise(account, username);
    },

    remove(id) {
      const accounts = deps.read();
      const next = accounts.filter((a) => a.id !== id);
      if (next.length === accounts.length) return false;
      deps.write(next);
      return true;
    },

    rename(id, label) {
      const trimmed = label.trim();
      if (trimmed === '') return false;
      const accounts = deps.read();
      const index = accounts.findIndex((a) => a.id === id);
      if (index === -1) return false;
      const existing = accounts[index];
      if (existing === undefined) return false;
      accounts[index] = { ...existing, label: trimmed };
      deps.write(accounts);
      return true;
    },

    reveal(id) {
      const account = deps.read().find((a) => a.id === id);
      if (account === undefined) return null;
      try {
        const json = crypto.decryptString(Buffer.from(account.blob, 'base64'));
        return JSON.parse(json) as Credentials;
      } catch (err) {
        // Config copied from another machine or another Windows account.
        // DPAPI ciphertext doesn't travel.
        deps.log(`could not decrypt account "${account.label}":`, err);
        return null;
      }
    },
  };
}
