import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createIpcRegistry,
  IpcOriginError,
  type InvokeEventLike,
  type IpcMainLike,
} from './registry';

type Listener = (event: InvokeEventLike, ...args: unknown[]) => unknown;

/** In-memory stand-in for Electron's ipcMain. */
function fakeIpcMain() {
  const handlers = new Map<string, Listener>();
  const ipcMain: IpcMainLike = {
    handle: (channel, listener) => void handlers.set(channel, listener),
    removeHandler: (channel) => void handlers.delete(channel),
  };
  return {
    ipcMain,
    handlers,
    /** Simulate a renderer calling `invoke` from a frame at `url`. */
    invoke(channel: string, url: string | null, ...args: unknown[]): unknown {
      const listener = handlers.get(channel);
      if (!listener) throw new Error(`no handler for ${channel}`);
      const event: InvokeEventLike = { senderFrame: url === null ? null : { url } };
      return listener(event, ...args);
    },
  };
}

const TRUSTED = 'https://krunker.io/';
const HOSTILE = 'https://evil.example/';

const isTrustedOrigin = (url: string) => {
  try {
    return new URL(url).origin === 'https://krunker.io';
  } catch {
    return false;
  }
};

describe('createIpcRegistry', () => {
  let env: ReturnType<typeof fakeIpcMain>;

  beforeEach(() => {
    env = fakeIpcMain();
  });

  it('runs the handler for a trusted frame and passes arguments through', () => {
    const registry = createIpcRegistry(env.ipcMain, { isTrustedOrigin });
    registry.handle('add', (_e, a: number, b: number) => a + b);

    expect(env.invoke('add', TRUSTED, 2, 3)).toBe(5);
  });

  it('rejects a call from an untrusted origin without running the handler', () => {
    const handler = vi.fn(() => 'secret');
    const onRejected = vi.fn();
    const registry = createIpcRegistry(env.ipcMain, { isTrustedOrigin, onRejected });
    registry.handle('alt-get-credentials', handler);

    expect(() => env.invoke('alt-get-credentials', HOSTILE)).toThrow(IpcOriginError);
    // The point of the guard: the body never executes, so nothing is computed
    // or returned for an attacker to read.
    expect(handler).not.toHaveBeenCalled();
    expect(onRejected).toHaveBeenCalledWith('alt-get-credentials', HOSTILE);
  });

  it('fails closed when the sender frame is gone', () => {
    const handler = vi.fn();
    const registry = createIpcRegistry(env.ipcMain, { isTrustedOrigin });
    registry.handle('ping', handler);

    expect(() => env.invoke('ping', null)).toThrow(IpcOriginError);
    expect(handler).not.toHaveBeenCalled();
  });

  it('rejects an unparseable sender URL', () => {
    const registry = createIpcRegistry(env.ipcMain, { isTrustedOrigin });
    registry.handle('ping', () => 'ok');

    expect(() => env.invoke('ping', 'not a url')).toThrow(IpcOriginError);
  });

  it('refuses to silently overwrite an existing channel', () => {
    const registry = createIpcRegistry(env.ipcMain, { isTrustedOrigin });
    registry.handle('dup', () => 1);

    expect(() => registry.handle('dup', () => 2)).toThrow(/already registered/);
    // The original handler survives the failed re-registration.
    expect(env.invoke('dup', TRUSTED)).toBe(1);
  });

  it('tracks and removes channels', () => {
    const registry = createIpcRegistry(env.ipcMain, { isTrustedOrigin });
    registry.handle('a', () => 1);
    registry.handle('b', () => 2);
    expect(registry.channels).toEqual(['a', 'b']);

    registry.remove('a');
    expect(registry.channels).toEqual(['b']);
    expect(env.handlers.has('a')).toBe(false);
  });
});
