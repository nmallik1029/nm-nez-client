import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The userscript channels, wired the way main wires them.
 *
 * A unit test on the filtering function would have told me nothing I could
 * not read off the source. What was actually in doubt after driving the live
 * client was the wiring: whether the switch in the panel reaches the list the
 * loader reads. So this builds the real registry over a real ConfigStore and
 * a real folder, and calls the handlers the way the renderer does.
 *
 * Electron is faked here rather than through the suite-wide alias, which
 * throws on any access. `registerHandlers` builds an account store on the way
 * in, and that asks `safeStorage` whether it can encrypt before any test has
 * a chance to inject anything.
 */
vi.mock('electron', () => ({
  app: {
    getVersion: () => '0.0.0-test',
    getAppPath: () => join(tmpdir(), 'nmnez-test-app'),
    getPath: () => join(tmpdir(), 'nmnez-test-userdata'),
    isPackaged: false,
  },
  shell: { openPath: () => Promise.resolve('') },
  safeStorage: {
    isEncryptionAvailable: () => false,
    encryptString: () => Buffer.from(''),
    decryptString: () => '',
  },
}));

const { ConfigStore } = await import('../config/store');
const { DEFAULT_CONFIG } = await import('../../shared/config');
const { IPC } = await import('../../shared/ipc');
const { registerHandlers } = await import('./handlers');

type AppConfig = import('../../shared/config').AppConfig;
type InvokeEventLike = import('./registry').InvokeEventLike;
type UserscriptInfo = import('../../shared/ipc').UserscriptInfo;
type UserscriptSaveResult = import('../../shared/ipc').UserscriptSaveResult;

let dir: string;
let scripts: string;
let config: InstanceType<typeof ConfigStore<AppConfig>>;
let handlers: Map<string, (event: InvokeEventLike, ...args: unknown[]) => unknown>;

const FROM_GAME: InvokeEventLike = { senderFrame: { url: 'https://krunker.io/' } };

function call(channel: string, ...args: unknown[]): unknown {
  const handler = handlers.get(channel);
  if (!handler) throw new Error(`no handler for ${channel}`);
  return handler(FROM_GAME, ...args);
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'handlers-'));
  scripts = join(dir, 'scripts');
  mkdirSync(scripts);

  config = new ConfigStore<AppConfig>({
    filePath: join(dir, 'config.json'),
    defaults: DEFAULT_CONFIG,
    writeDelayMs: 0,
  });

  handlers = new Map();
  registerHandlers({
    ipcMain: {
      handle: (channel, listener) => handlers.set(channel, listener),
      removeHandler: (channel) => void handlers.delete(channel),
    },
    config,
    paths: {
      userData: dir,
      config: join(dir, 'config.json'),
      swap: dir,
      themes: join(dir, 'themes'),
      scripts,
      backgrounds: join(dir, 'backgrounds'),
      sounds: join(dir, 'sounds'),
      screenshots: join(dir, 'shots'),
    },
    getWindow: () => null,
    log: () => {},
    rescanSwap: () => 0,
    updater: { check: () => {}, download: () => {}, install: () => {} },
  });
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe('userscript handlers', () => {
  it('loads nothing while the feature is off', () => {
    writeFileSync(join(scripts, 'one.js'), 'console.log(1)');
    expect(call(IPC.userscriptsGet)).toEqual([]);
  });

  it('loads the folder once the feature is on', () => {
    config.patch('features', { userscripts: true });
    writeFileSync(join(scripts, 'one.js'), 'console.log(1)');
    expect((call(IPC.userscriptsGet) as { name: string }[]).map((s) => s.name)).toEqual(['one.js']);
  });

  it('leaves out a script the panel has switched off', () => {
    config.patch('features', { userscripts: true, disabledUserscripts: ['off.js'] });
    writeFileSync(join(scripts, 'on.js'), 'console.log(1)');
    writeFileSync(join(scripts, 'off.js'), 'console.log(2)');
    expect((call(IPC.userscriptsGet) as { name: string }[]).map((s) => s.name)).toEqual(['on.js']);
  });

  it('switching one back on brings it back', () => {
    config.patch('features', { userscripts: true, disabledUserscripts: ['off.js'] });
    writeFileSync(join(scripts, 'off.js'), 'console.log(2)');
    expect(call(IPC.userscriptsGet)).toEqual([]);

    config.patch('features', { disabledUserscripts: [] });
    expect((call(IPC.userscriptsGet) as { name: string }[]).map((s) => s.name)).toEqual(['off.js']);
  });

  it('lists what is in the folder without the sources', () => {
    const body = '// @name Reload\nconsole.log(1)';
    writeFileSync(join(scripts, 'named.js'), body);
    const list = call(IPC.userscriptsList) as UserscriptInfo[];
    expect(list).toEqual([{ name: 'named.js', title: 'Reload', bytes: body.length }]);
  });

  it('saves a dropped file and answers with the folder', () => {
    const result = call(IPC.userscriptsAdd, 'drop.js', 'console.log(1)') as UserscriptSaveResult;
    expect(result.ok).toBe(true);
    expect(result.problem).toBe('');
    expect(result.scripts.map((s) => s.name)).toEqual(['drop.js']);
    expect(readFileSync(join(scripts, 'drop.js'), 'utf8')).toBe('console.log(1)');
  });

  it('refuses a name that is not a plain .js, with something to show', () => {
    const result = call(IPC.userscriptsAdd, '../escape.js', 'x') as UserscriptSaveResult;
    expect(result.ok).toBe(false);
    expect(result.problem).toContain('plain .js filename');
    expect(result.scripts).toEqual([]);
  });

  it('refuses anything that is not two strings', () => {
    const result = call(IPC.userscriptsAdd, 42, null) as UserscriptSaveResult;
    expect(result.ok).toBe(false);
    expect(result.problem).not.toBe('');
  });

  it('deletes a file and answers with what is left', () => {
    writeFileSync(join(scripts, 'a.js'), '1');
    writeFileSync(join(scripts, 'b.js'), '2');
    const left = call(IPC.userscriptsRemove, 'a.js') as UserscriptInfo[];
    expect(left.map((s) => s.name)).toEqual(['b.js']);
  });
});
