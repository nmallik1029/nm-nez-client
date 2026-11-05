/**
 * Origin-checked IPC.
 *
 * We run the game view with contextIsolation off, because hooking page globals
 * needs the main world. That means any script on the Krunker page can invoke
 * any handler we register, including the one that hands back a decrypted
 * account password. Encrypting passwords at rest does nothing about that.
 *
 * So every handler goes through `registry.handle`, which throws out calls from
 * a frame that isn't a trusted origin before the handler body runs. There's no
 * bare `ipcMain.handle` anywhere, and lint keeps it that way.
 */

/** Structural view of Electron's IpcMainInvokeEvent, so this file stays testable. */
export interface InvokeEventLike {
  readonly senderFrame: { readonly url: string } | null;
}

/** Structural view of Electron's IpcMainEvent, which is what a `sendSync` arrives as. */
export interface SyncEventLike extends InvokeEventLike {
  returnValue: unknown;
}

/** Structural view of the parts of `ipcMain` we use. */
export interface IpcMainLike {
  handle(
    channel: string,
    listener: (event: InvokeEventLike, ...args: unknown[]) => unknown,
  ): void;
  removeHandler(channel: string): void;
  on(channel: string, listener: (event: SyncEventLike, ...args: unknown[]) => void): void;
  removeAllListeners(channel: string): void;
}

export interface IpcRegistryOptions {
  /** Returns true when a frame URL is allowed to call our handlers. */
  readonly isTrustedOrigin: (url: string) => boolean;
  /** Called when a call is rejected. Wire this to the logger. */
  readonly onRejected?: (channel: string, senderUrl: string | null) => void;
}

export interface IpcRegistry {
  /** Register an origin-checked handler. Throws if the channel is already taken. */
  handle<TArgs extends unknown[], TResult>(
    channel: string,
    handler: (event: InvokeEventLike, ...args: TArgs) => TResult,
  ): void;
  /**
   * Register an origin-checked handler for `ipcRenderer.sendSync`.
   *
   * For the few things the page needs before it can afford an await: a sync
   * call blocks the renderer until main answers, so it is only worth it when
   * being a turn late is the same as not running at all.
   *
   * A sync call has no way to throw back to the renderer, and one whose
   * returnValue is never set leaves the page frozen for good. So a rejected
   * frame, or a handler that throws, gets `fallback` instead, and nothing
   * else reaches the page.
   */
  handleSync<TArgs extends unknown[], TResult>(
    channel: string,
    handler: (event: InvokeEventLike, ...args: TArgs) => TResult,
    fallback: TResult,
  ): void;
  /** Unregister a channel. */
  remove(channel: string): void;
  /** Channels currently registered, for diagnostics and tests. */
  readonly channels: readonly string[];
}

/** Thrown back to the renderer when a frame is not allowed to call a channel. */
export class IpcOriginError extends Error {
  constructor(channel: string) {
    super(`Rejected IPC call to "${channel}" from an untrusted frame`);
    this.name = 'IpcOriginError';
  }
}

export function createIpcRegistry(ipcMain: IpcMainLike, options: IpcRegistryOptions): IpcRegistry {
  /** Channel -> whether it was registered sync, which decides how it is removed. */
  const registered = new Map<string, boolean>();

  function claim(channel: string, sync: boolean): void {
    if (registered.has(channel)) {
      // Electron replaces an existing handler without a word, and that is a
      // miserable bug to go looking for.
      throw new Error(`IPC channel "${channel}" is already registered`);
    }
    registered.set(channel, sync);
  }

  return {
    handle(channel, handler) {
      claim(channel, false);

      ipcMain.handle(channel, (event, ...args) => {
        const url = event.senderFrame?.url ?? null;
        // A destroyed or detached frame has no URL. Fail closed.
        if (url === null || !options.isTrustedOrigin(url)) {
          options.onRejected?.(channel, url);
          throw new IpcOriginError(channel);
        }
        return (handler as (event: InvokeEventLike, ...a: unknown[]) => unknown)(event, ...args);
      });
    },

    handleSync(channel, handler, fallback) {
      claim(channel, true);

      ipcMain.on(channel, (event, ...args) => {
        const url = event.senderFrame?.url ?? null;
        if (url === null || !options.isTrustedOrigin(url)) {
          options.onRejected?.(channel, url);
          event.returnValue = fallback;
          return;
        }
        try {
          event.returnValue = (handler as (event: InvokeEventLike, ...a: unknown[]) => unknown)(
            event,
            ...args,
          );
        } catch (err) {
          event.returnValue = fallback;
          console.error(`[ipc] sync handler "${channel}" threw:`, err);
        }
      });
    },

    remove(channel) {
      const sync = registered.get(channel);
      if (sync === undefined) return;
      registered.delete(channel);
      if (sync) ipcMain.removeAllListeners(channel);
      else ipcMain.removeHandler(channel);
    },

    get channels() {
      return [...registered.keys()];
    },
  };
}
