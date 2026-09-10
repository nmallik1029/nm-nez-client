/**
 * Stands in for the `electron` module under Vitest. Wired up by the alias in
 * vitest.config.ts; nothing imports it directly.
 *
 * The real package's entry point doesn't export an API at all. It reads
 * `path.txt`, hands back the path to electron.exe, and throws outright if the
 * binary was never downloaded. So on a machine or a CI runner without the
 * binary, importing anything that imports electron kills the whole test file
 * before a single test runs, whether or not the test touches Electron.
 *
 * Everything here throws when used rather than returning undefined. Nothing in
 * the suite is supposed to reach real Electron, so if one of these ever fires
 * it means a module needs its dependency injected, and the message says so.
 */

function unavailable(name: string): never {
  throw new Error(
    `Tests do not have real Electron. Something reached for ${name}. ` +
      'Inject a fake through the module under test instead.',
  );
}

/** Throws on any property access, naming what was touched. */
function stub(name: string): never {
  return new Proxy(
    {},
    {
      get: (_target, prop) => unavailable(`${name}.${String(prop)}`),
      apply: () => unavailable(`${name}()`),
    },
  ) as never;
}

export const app = stub('app');
export const clipboard = stub('clipboard');
export const ipcMain = stub('ipcMain');
export const net = stub('net');
export const protocol = stub('protocol');
export const safeStorage = stub('safeStorage');
export const session = stub('session');
export const shell = stub('shell');
export const BrowserWindow = stub('BrowserWindow');
export const ClipboardItem = stub('ClipboardItem');
