import { app, type BrowserWindow } from 'electron';
import { IPC } from '../shared/ipc';
import { PROTOCOL_SCHEME } from '../shared/protocol';

/**
 * `nmnez://` links, on the main side.
 *
 * Windows hands a link to the client one of two ways: as an argument on a
 * cold start, or, because we hold a single-instance lock, as the argv of the
 * second instance that was started and immediately quit. Both end up here,
 * and both end up in the page, which is where the link is acted on.
 *
 * The registration itself is the installer's job. electron-builder writes the
 * `protocols:` block into the NSIS script, so an installed client owns the
 * scheme from the moment it is installed, with or without this file. What is
 * left for runtime is the portable build, which has no installer to do it,
 * and repairing a registration something else has taken over.
 */

export interface ProtocolInbox {
  /**
   * A link arrived. Null is ignored, so a caller can hand over the result of
   * `findProtocolUrl` without checking it first.
   */
  offer(url: string | null): void;
  /** Deliver to this window, once its page has finished loading. */
  attach(window: BrowserWindow): void;
}

/**
 * Claim the scheme with Windows.
 *
 * Never in development. `setAsDefaultProtocolClient` registers whatever
 * `process.execPath` is, and in a `npm start` run that is
 * `node_modules/electron/dist/electron.exe`: registering there would point
 * every `nmnez://` link on the machine at a bare Electron that knows nothing
 * about this repo, and it would keep pointing there after the dev run ended.
 * Someone's real, installed client would stop opening its own links.
 */
export function registerProtocolClient(log: (...args: unknown[]) => void): void {
  if (!app.isPackaged) {
    log(`dev run: leaving ${PROTOCOL_SCHEME}:// registered to whatever owns it`);
    return;
  }

  const claimed = app.setAsDefaultProtocolClient(PROTOCOL_SCHEME);
  log(`${PROTOCOL_SCHEME}:// ${claimed ? 'registered' : 'could not be registered'}`);
}

export function createProtocolInbox(log: (...args: unknown[]) => void): ProtocolInbox {
  /**
   * The link waiting for a page to arrive in.
   *
   * One, not a queue. These are "host this match" links: if two turn up
   * before the first has been acted on, the second is the one that is still
   * true, and hosting the first would put a lobby up for a match nobody is
   * waiting in.
   */
  let pending: string | null = null;
  let target: BrowserWindow | null = null;

  function flush(): void {
    const url = pending;
    if (url === null || !target || target.isDestroyed()) return;

    const contents = target.webContents;
    // Mid-navigation. The listener in the page is installed per load, so a
    // send now would land nowhere; did-finish-load below brings us back.
    if (contents.isDestroyed() || contents.isLoading()) return;

    pending = null;
    // A link is someone asking for the client, so put it in front of them.
    if (target.isMinimized()) target.restore();
    target.show();
    target.focus();

    try {
      contents.send(IPC.protocolUrl, url);
      log('protocol link handed to the page');
    } catch {
      // Frame went away between the checks above and here.
      pending = url;
    }
  }

  return {
    offer(url) {
      if (url === null) return;
      pending = url;
      flush();
    },

    attach(window) {
      target = window;
      // Every load, not once: a link can arrive while the page is still
      // coming up, and the region switch reloads the page under us.
      window.webContents.on('did-finish-load', flush);
      flush();
    },
  };
}
