import { createServer, type Server } from 'node:net';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { gameSocketTarget, ServerPinger, tcpPing } from './ping';

let server: Server | null = null;

afterEach(() => {
  server?.close();
  server = null;
});

/** A real listening socket on a free port, so tcpPing is exercised for real. */
function listen(): Promise<number> {
  return new Promise((resolve) => {
    server = createServer();
    server.listen(0, '127.0.0.1', () => {
      const address = server?.address();
      resolve(typeof address === 'object' && address !== null ? address.port : 0);
    });
  });
}

describe('tcpPing', () => {
  it('measures a real connect', async () => {
    const port = await listen();
    const ms = await tcpPing('127.0.0.1', port);
    expect(ms).toBeGreaterThanOrEqual(0);
    expect(ms).toBeLessThan(1000);
  });

  it('returns -1 for a refused port rather than throwing', async () => {
    // Port 1 on loopback is not listening; connect is refused immediately.
    expect(await tcpPing('127.0.0.1', 1, 500)).toBe(-1);
  });

  it('returns -1 on timeout', async () => {
    // 203.0.113.0/24 is TEST-NET-3: reserved, guaranteed unroutable.
    expect(await tcpPing('203.0.113.1', 9, 300)).toBe(-1);
  });

  it('never rejects on a malformed host', async () => {
    await expect(tcpPing('not a host', 80, 300)).resolves.toBe(-1);
  });
});

describe('gameSocketTarget', () => {
  it('accepts a lobby host and defaults the wss port', () => {
    expect(gameSocketTarget('wss://lobby-fra-1.krunker.io/')).toEqual({
      host: 'lobby-fra-1.krunker.io',
      port: 443,
    });
  });

  it('honours an explicit port', () => {
    expect(gameSocketTarget('wss://lobby-nyc-2.krunker.io:8443/sock')).toEqual({
      host: 'lobby-nyc-2.krunker.io',
      port: 8443,
    });
  });

  it('ignores non-lobby sockets', () => {
    // Social and API traffic goes elsewhere; pinging it would measure the
    // wrong path entirely.
    expect(gameSocketTarget('wss://social.krunker.io/')).toBeNull();
    expect(gameSocketTarget('wss://matchmaker.krunker.io/')).toBeNull();
  });

  it('survives a malformed URL', () => {
    expect(gameSocketTarget('::::')).toBeNull();
  });
});

describe('ServerPinger', () => {
  it('samples immediately and then on an interval', async () => {
    const onSample = vi.fn();
    const pinger = new ServerPinger({
      onSample,
      intervalMs: 30,
      ping: () => Promise.resolve(42),
    });

    pinger.setTarget('host', 443);
    await new Promise((r) => setTimeout(r, 100));
    pinger.stop();

    expect(onSample).toHaveBeenCalledWith(42);
    expect(onSample.mock.calls.length).toBeGreaterThan(1);
  });

  it('suppresses failed probes instead of reporting -1', async () => {
    const onSample = vi.fn();
    const pinger = new ServerPinger({ onSample, intervalMs: 20, ping: () => Promise.resolve(-1) });

    pinger.setTarget('host', 443);
    await new Promise((r) => setTimeout(r, 70));
    pinger.stop();

    // The HUD holding its last good value reads better than flashing -1.
    expect(onSample).not.toHaveBeenCalled();
  });

  it('ignores a re-target to the same running host and port', async () => {
    const ping = vi.fn(() => Promise.resolve(10));
    const pinger = new ServerPinger({ onSample: () => {}, intervalMs: 10_000, ping });

    pinger.setTarget('host', 443);
    pinger.setTarget('host', 443);
    await new Promise((r) => setTimeout(r, 30));
    pinger.stop();

    // An F5 re-detects the same server; restarting would reset the cadence.
    expect(ping).toHaveBeenCalledTimes(1);
  });

  it('restarts on a genuinely different target', async () => {
    const ping = vi.fn(() => Promise.resolve(10));
    const pinger = new ServerPinger({ onSample: () => {}, intervalMs: 10_000, ping });

    pinger.setTarget('a', 443);
    pinger.setTarget('b', 443);
    await new Promise((r) => setTimeout(r, 30));
    pinger.stop();

    expect(ping).toHaveBeenCalledTimes(2);
    expect(pinger.current).toEqual({ host: 'b', port: 443 });
  });

  it('drops a sample that lands after the target changed', async () => {
    const onSample = vi.fn();
    // Held on an object rather than a `let`: TypeScript's control-flow
    // analysis cannot see an assignment made inside the executor callback and
    // narrows a bare local to `never` at the call site.
    const first: { resolve?: (value: number) => void } = {};
    const ping = vi.fn((host: string) =>
      host === 'a'
        ? new Promise<number>((resolve) => { first.resolve = resolve; })
        : Promise.resolve(5),
    );
    const pinger = new ServerPinger({ onSample, intervalMs: 10_000, ping });

    pinger.setTarget('a', 443);
    pinger.setTarget('b', 443);
    first.resolve?.(999);
    await new Promise((r) => setTimeout(r, 30));
    pinger.stop();

    // 999 belonged to the old server; reporting it would show the previous
    // lobby's latency on the new one.
    expect(onSample).not.toHaveBeenCalledWith(999);
  });

  it('stops firing after stop()', async () => {
    const onSample = vi.fn();
    const pinger = new ServerPinger({ onSample, intervalMs: 15, ping: () => Promise.resolve(1) });

    pinger.setTarget('host', 443);
    pinger.stop();
    onSample.mockClear();
    await new Promise((r) => setTimeout(r, 60));

    expect(onSample).not.toHaveBeenCalled();
  });
});
