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

/** Structural view of the parts of `ipcMain` we use. */
export interface IpcMainLike {
  handle(
    channel: string,
    listener: (event: InvokeEventLike, ...args: unknown[]) => unknown,
  ): void;
  removeHandler(channel: string): void;
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
  const registered = new Set<string>();

  return {
    handle(channel, handler) {
      if (registered.has(channel)) {
        // Electron replaces an existing handler without a word, and that is a
        // miserable bug to go looking for.
        throw new Error(`IPC channel "${channel}" is already registered`);
      }
      registered.add(channel);

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

    remove(channel) {
      if (!registered.delete(channel)) return;
      ipcMain.removeHandler(channel);
    },

    get channels() {
      return [...registered];
    },
  };
}
