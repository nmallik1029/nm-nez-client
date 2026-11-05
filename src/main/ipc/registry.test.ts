import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createIpcRegistry,
  IpcOriginError,
  type InvokeEventLike,
  type IpcMainLike,
  type SyncEventLike,
} from './registry';

type Listener = (event: InvokeEventLike, ...args: unknown[]) => unknown;

/** In-memory stand-in for Electron's ipcMain. */
function fakeIpcMain() {
  const handlers = new Map<string, Listener>();
  const syncListeners = new Map<string, (event: SyncEventLike, ...args: unknown[]) => void>();
  const ipcMain: IpcMainLike = {
    handle: (channel, listener) => void handlers.set(channel, listener),
    removeHandler: (channel) => void handlers.delete(channel),
    on: (channel, listener) => void syncListeners.set(channel, listener),
    removeAllListeners: (channel) => void syncListeners.delete(channel),
  };
  return {
    ipcMain,
    handlers,
    syncListeners,
    /**
     * Simulate `sendSync` from a frame at `url`. What the renderer gets is
     * whatever ended up in returnValue, and 'unset' if nothing did, which in
     * the real thing is a page frozen on the call for good.
     */
    sendSync(channel: string, url: string | null, ...args: unknown[]): unknown {
      const listener = syncListeners.get(channel);
      if (!listener) throw new Error(`no sync listener for ${channel}`);
      const unset = Symbol('unset');
      const event: SyncEventLike = { senderFrame: url === null ? null : { url }, returnValue: unset };
      listener(event, ...args);
      return event.returnValue === unset ? 'unset' : event.returnValue;
    },
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

describe('createIpcRegistry: handleSync', () => {
  let env: ReturnType<typeof fakeIpcMain>;

  beforeEach(() => {
    env = fakeIpcMain();
  });

  it('answers a trusted frame through returnValue', () => {
    const registry = createIpcRegistry(env.ipcMain, { isTrustedOrigin });
    registry.handleSync('add', (_e, a: number, b: number) => a + b, 0);

    expect(env.sendSync('add', TRUSTED, 2, 3)).toBe(5);
  });

  it('gives an untrusted frame the fallback without running the handler', () => {
    const handler = vi.fn(() => ['secret']);
    const onRejected = vi.fn();
    const registry = createIpcRegistry(env.ipcMain, { isTrustedOrigin, onRejected });
    registry.handleSync('scripts', handler, []);

    expect(env.sendSync('scripts', HOSTILE)).toEqual([]);
    expect(handler).not.toHaveBeenCalled();
    expect(onRejected).toHaveBeenCalledWith('scripts', HOSTILE);
  });

  it('always sets returnValue, even when the frame is gone or the handler throws', () => {
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
    const registry = createIpcRegistry(env.ipcMain, { isTrustedOrigin });
    registry.handleSync('gone', () => 'ok', 'fallback');
    registry.handleSync(
      'boom',
      () => {
        throw new Error('disk on fire');
      },
      'fallback',
    );

    // Anything but a value here is a renderer blocked on sendSync for good.
    expect(env.sendSync('gone', null)).toBe('fallback');
    expect(env.sendSync('boom', TRUSTED)).toBe('fallback');
    expect(errors).toHaveBeenCalled();
    errors.mockRestore();
  });

  it('shares one namespace with handle and removes the right kind of listener', () => {
    const registry = createIpcRegistry(env.ipcMain, { isTrustedOrigin });
    registry.handle('a', () => 1);
    registry.handleSync('b', () => 2, 0);

    expect(() => registry.handleSync('a', () => 3, 0)).toThrow(/already registered/);
    expect(() => registry.handle('b', () => 3)).toThrow(/already registered/);
    expect(registry.channels).toEqual(['a', 'b']);

    registry.remove('b');
    expect(env.syncListeners.has('b')).toBe(false);
    expect(env.handlers.has('a')).toBe(true);
    expect(registry.channels).toEqual(['a']);
  });
});
