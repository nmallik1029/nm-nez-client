import { describe, expect, it, vi } from 'vitest';
import { createAccountStore, type CryptoLike } from './accounts';
import type { StoredAccount } from '../shared/accounts';

/** Reversible stand-in for DPAPI, so encrypt/decrypt round-trips are testable. */
function fakeCrypto(available = true): CryptoLike {
  return {
    isEncryptionAvailable: () => available,
    encryptString: (plain) => Buffer.from(`enc:${plain}`, 'utf8'),
    decryptString: (buf) => {
      const s = buf.toString('utf8');
      if (!s.startsWith('enc:')) throw new Error('not our ciphertext');
      return s.slice(4);
    },
  };
}

function makeStore(available = true, initial: StoredAccount[] = []) {
  let accounts = initial;
  const store = createAccountStore({
    read: () => accounts,
    write: (next) => {
      accounts = next;
    },
    log: () => {},
    crypto: fakeCrypto(available),
  });
  return { store, peek: () => accounts };
}

const creds = (username: string, password = 'hunter2') => ({ username, password });

describe('account store', () => {
  it('round-trips credentials through encryption', () => {
    const { store } = makeStore();
    const saved = store.save('Main', creds('alice'));
    expect(store.reveal(saved.id)).toEqual(creds('alice'));
  });

  it('never writes the password in the clear', () => {
    const { store, peek } = makeStore();
    store.save('Main', creds('alice', 'correct-horse'));

    // The password must not survive anywhere in the persisted record.
    const onDisk = JSON.stringify(peek());
    expect(onDisk).not.toContain('correct-horse');
    expect(onDisk).not.toContain('password');

    // And the blob is base64 of ciphertext, not of plaintext. Base64 on its
    // own looks encrypted on disk and reverses in one line.
    const blob = peek()[0]?.blob ?? '';
    expect(Buffer.from(blob, 'base64').toString('utf8')).toMatch(/^enc:/);
  });

  it('keeps the username readable so the list needs no decryption', () => {
    const { store, peek } = makeStore();
    store.save('Main', creds('alice'));
    expect(peek()[0]?.username).toBe('alice');
  });

  it('refuses to save when OS encryption is unavailable', () => {
    const { store, peek } = makeStore(false);
    expect(store.canEncrypt).toBe(false);
    expect(() => store.save('Main', creds('alice'))).toThrow(/encryption/i);
    // The important half. Nothing got written in a weaker form as a fallback.
    expect(peek()).toEqual([]);
  });

  it('replaces rather than duplicates when the same user is saved twice', () => {
    const { store, peek } = makeStore();
    store.save('Main', creds('alice', 'old'));
    store.save('Main renewed', creds('alice', 'new'));
    expect(peek()).toHaveLength(1);
    expect(peek()[0]?.label).toBe('Main renewed');
    expect(store.reveal(peek()[0]?.id ?? '')?.password).toBe('new');
  });

  it('keeps separate users apart', () => {
    const { store, peek } = makeStore();
    store.save('Main', creds('alice'));
    store.save('Smurf', creds('bob'));
    expect(peek()).toHaveLength(2);
  });

  it('falls back to the username when no label is given', () => {
    const { store } = makeStore();
    expect(store.save('   ', creds('alice')).label).toBe('alice');
  });

  it('marks only the signed-in account active', () => {
    const { store } = makeStore();
    store.save('Main', creds('alice'));
    store.save('Smurf', creds('bob'));
    const list = store.list('bob');
    expect(list.find((a) => a.username === 'bob')?.active).toBe(true);
    expect(list.find((a) => a.username === 'alice')?.active).toBe(false);
  });

  it('marks nothing active when signed out', () => {
    const { store } = makeStore();
    store.save('Main', creds('alice'));
    expect(store.list('').every((a) => !a.active)).toBe(true);
  });

  it('never puts a password in a summary', () => {
    const { store } = makeStore();
    store.save('Main', creds('alice', 'hunter2'));
    expect(JSON.stringify(store.list('alice'))).not.toContain('hunter2');
  });

  it('removes and renames by id, reporting misses', () => {
    const { store } = makeStore();
    const saved = store.save('Main', creds('alice'));
    expect(store.rename(saved.id, 'Renamed')).toBe(true);
    expect(store.list('')[0]?.label).toBe('Renamed');
    expect(store.rename(saved.id, '  ')).toBe(false);
    expect(store.remove('no-such-id')).toBe(false);
    expect(store.remove(saved.id)).toBe(true);
    expect(store.list('')).toEqual([]);
  });

  it('returns null rather than throwing when ciphertext will not decrypt', () => {
    // What you get when config.json comes from another Windows account. DPAPI
    // ciphertext doesn't travel between users.
    const foreign: StoredAccount = {
      id: 'x',
      label: 'Foreign',
      username: 'alice',
      savedAt: Date.now(),
      blob: Buffer.from('someone elses ciphertext', 'utf8').toString('base64'),
    };
    const { store } = makeStore(true, [foreign]);
    expect(store.reveal('x')).toBeNull();
  });

  it('returns null for an unknown id instead of leaking another account', () => {
    const { store } = makeStore();
    store.save('Main', creds('alice'));
    expect(store.reveal('not-a-real-id')).toBeNull();
  });

  it('logs once when encryption is unavailable', () => {
    const log = vi.fn();
    createAccountStore({ read: () => [], write: () => {}, log, crypto: fakeCrypto(false) });
    expect(log).toHaveBeenCalledOnce();
  });
});
