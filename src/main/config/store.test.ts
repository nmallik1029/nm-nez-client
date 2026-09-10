import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ConfigStore } from './store';

interface TestConfig {
  readonly [k: string]: unknown;
  nested: { a: number; b: string };
  flag: boolean;
}

const DEFAULTS: TestConfig = { nested: { a: 1, b: 'x' }, flag: false };

let dir: string;
let file: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'cfg-'));
  file = join(dir, 'config.json');
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

const store = (writeDelayMs = 0) =>
  new ConfigStore<TestConfig>({ filePath: file, defaults: DEFAULTS, writeDelayMs });

describe('ConfigStore', () => {
  it('starts from defaults when no file exists', () => {
    expect(store().get('nested')).toEqual({ a: 1, b: 'x' });
  });

  it('does not mutate the caller-supplied defaults', () => {
    const s = store();
    s.patch('nested', { a: 99 });
    // A shared defaults object leaking mutations across stores would be a
    // nasty, action-at-a-distance bug.
    expect(DEFAULTS.nested.a).toBe(1);
  });

  it('round-trips through disk on flush', () => {
    const s = store();
    s.set('flag', true);
    s.flush();

    expect(new ConfigStore<TestConfig>({ filePath: file, defaults: DEFAULTS }).get('flag')).toBe(true);
  });

  it('leaves no temp file behind after an atomic write', () => {
    const s = store();
    s.set('flag', true);
    s.flush();
    expect(() => readFileSync(`${file}.tmp`, 'utf8')).toThrow();
  });

  it('falls back to defaults on a corrupt file rather than throwing', () => {
    // A malformed config must never stop the client from starting.
    writeFileSync(file, '{ this is not json', 'utf8');
    expect(store().get('flag')).toBe(false);
  });

  it('falls back to defaults when the file holds a non-object', () => {
    writeFileSync(file, '["nope"]', 'utf8');
    expect(store().get('nested')).toEqual({ a: 1, b: 'x' });
  });

  it('merges a partial section so old configs pick up new fields', () => {
    writeFileSync(file, JSON.stringify({ nested: { a: 42 } }), 'utf8');
    // `b` is absent from the stored file but present in defaults.
    expect(store().get('nested')).toEqual({ a: 42, b: 'x' });
  });

  it('ignores a stored value whose type does not match the default', () => {
    writeFileSync(file, JSON.stringify({ flag: 'not-a-boolean' }), 'utf8');
    expect(store().get('flag')).toBe(false);
  });

  it('drops keys that are not part of the schema', () => {
    writeFileSync(file, JSON.stringify({ flag: true, bogus: 1 }), 'utf8');
    expect(Object.keys(store().all())).toEqual(['nested', 'flag']);
  });

  it('keeps a stored value for a key the previous schema did not have', () => {
    // Real-world shape: a config written by an older build carries keys that
    // no longer exist, and a key added since must still survive the merge.
    writeFileSync(
      file,
      JSON.stringify({ nested: { a: 5, b: 'y', removedKey: true }, flag: true, goneSection: {} }),
      'utf8',
    );
    const s = store();
    expect(s.get('flag')).toBe(true);
    expect(s.get('nested')).toMatchObject({ a: 5, b: 'y' });
  });

  it('flush is a no-op when nothing is pending', () => {
    const s = store();
    s.flush();
    // Never written, so the file should still not exist.
    expect(() => readFileSync(file, 'utf8')).toThrow();
  });

  it('coalesces a burst of writes into one debounced flush', async () => {
    const s = new ConfigStore<TestConfig>({ filePath: file, defaults: DEFAULTS, writeDelayMs: 20 });
    s.set('flag', true);
    s.patch('nested', { a: 2 });
    s.patch('nested', { b: 'y' });
    expect(() => readFileSync(file, 'utf8')).toThrow(); // nothing on disk yet

    await new Promise((r) => setTimeout(r, 50));
    expect(JSON.parse(readFileSync(file, 'utf8'))).toEqual({
      nested: { a: 2, b: 'y' },
      flag: true,
    });
  });
});
