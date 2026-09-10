import { describe, expect, it, vi } from 'vitest';
import { RankedQueue, type QueueState, type SocketLike } from './queue';

/** Controllable stand-in for the queue WebSocket. */
function fakeSocket() {
  const socket: SocketLike & { closed: boolean; url?: string } = {
    closed: false,
    close() { this.closed = true; },
    onopen: null,
    onmessage: null,
    onclose: null,
    onerror: null,
  };
  return socket;
}

function harness(over: { now?: () => number } = {}) {
  const states: QueueState[] = [];
  const sockets: ReturnType<typeof fakeSocket>[] = [];
  const urls: string[] = [];
  const onMatch = vi.fn();

  const queue = new RankedQueue({
    onState: (s) => states.push(s),
    onMatch,
    now: over.now ?? (() => 1000),
    connect: (url) => {
      urls.push(url);
      const s = fakeSocket();
      sockets.push(s);
      return s;
    },
  });

  return { queue, states, sockets, urls, onMatch };
}

const send = (socket: SocketLike, obj: unknown): void => {
  socket.onmessage?.call(null, { data: JSON.stringify(obj) });
};

describe('RankedQueue', () => {
  it('connects and reports queued once the socket opens', () => {
    const h = harness();
    h.queue.start('tok', [0, 2], ['eu']);

    expect(h.states.map((s) => s.status)).toEqual(['connecting']);
    h.sockets[0]?.onopen?.call(null, {});
    expect(h.queue.current.status).toBe('queued');
    expect(h.queue.active).toBe(true);
  });

  it('puts the selection into the URL', () => {
    const h = harness();
    h.queue.start('tok', [2, 0], ['eu', 'na']);
    const url = new URL(h.urls[0]!);
    expect(url.searchParams.get('maps')).toBe('0,2');
    expect(url.searchParams.get('regions')).toBe('eu,na');
    expect(url.searchParams.get('token')).toBe('tok');
  });

  it('refuses to start without a token', () => {
    const h = harness();
    h.queue.start('', [0], ['eu']);
    expect(h.queue.current).toEqual({ status: 'error', code: 'NO_TOKEN' });
    expect(h.sockets).toHaveLength(0);
  });

  it('refuses an empty map or region selection', () => {
    // The server accepts it and simply never matches, which looks like a hang.
    const h = harness();
    h.queue.start('tok', [], ['eu']);
    expect(h.queue.current).toEqual({ status: 'error', code: 'NO_SELECTION' });
    h.queue.start('tok', [0], []);
    expect(h.queue.current).toEqual({ status: 'error', code: 'NO_SELECTION' });
  });

  it('reports a match and closes the socket', () => {
    const h = harness();
    h.queue.start('tok', [0], ['eu']);
    const socket = h.sockets[0]!;
    socket.onopen?.call(null, {});

    send(socket, {
      type: 'QUEUE_STATUS',
      payload: { status: 'MATCHED', assignment: { extensions: { map: ' 14 ', region: 'xxeu' } } },
    });

    expect(h.onMatch).toHaveBeenCalledWith(14, 'xxeu');
    expect(h.queue.current).toEqual({ status: 'matched', mapId: 14, region: 'xxeu' });
    expect(socket.closed).toBe(true);
  });

  it('does not let the socket close overwrite a match', () => {
    // Closing after a match is expected; reverting to idle would wipe the
    // result off the screen before the user saw it.
    const h = harness();
    h.queue.start('tok', [0], ['eu']);
    const socket = h.sockets[0]!;
    socket.onopen?.call(null, {});
    send(socket, {
      type: 'QUEUE_STATUS',
      payload: { status: 'MATCHED', assignment: { extensions: { map: '0', region: 'eu' } } },
    });
    socket.onclose?.call(null, {});

    expect(h.queue.current.status).toBe('matched');
  });

  it('records a cooldown deadline and stops queueing', () => {
    const h = harness({ now: () => 10_000 });
    h.queue.start('tok', [0], ['eu']);
    const socket = h.sockets[0]!;
    socket.onopen?.call(null, {});

    send(socket, { type: 'ERROR', payload: { code: 'COOLDOWN', payload: { cooldown: 90 } } });

    expect(h.queue.current).toEqual({ status: 'cooldown', until: 10_000 + 90_000 });
    expect(h.queue.active).toBe(false);
    expect(socket.closed).toBe(true);
  });

  it('treats other server errors as fatal', () => {
    const h = harness();
    h.queue.start('tok', [0], ['eu']);
    send(h.sockets[0]!, { type: 'INTERNAL_ERROR' });
    expect(h.queue.current).toEqual({ status: 'error', code: 'INTERNAL_ERROR' });
  });

  it('ignores frames it does not understand', () => {
    const h = harness();
    h.queue.start('tok', [0], ['eu']);
    const socket = h.sockets[0]!;
    socket.onopen?.call(null, {});
    const before = h.queue.current;

    send(socket, { type: 'SOMETHING_NEW', payload: {} });
    socket.onmessage?.call(null, { data: 'not json' });

    expect(h.queue.current).toEqual(before);
  });

  it('goes idle when the socket closes mid-queue', () => {
    const h = harness();
    h.queue.start('tok', [0], ['eu']);
    const socket = h.sockets[0]!;
    socket.onopen?.call(null, {});
    socket.onclose?.call(null, {});
    expect(h.queue.current.status).toBe('idle');
  });

  it('ignores callbacks from a superseded socket', () => {
    // Re-queueing fast leaves the old socket to close later; without the
    // generation check it would knock the new queue back to idle.
    const h = harness();
    h.queue.start('tok', [0], ['eu']);
    const first = h.sockets[0]!;

    h.queue.start('tok', [2], ['na']);
    const second = h.sockets[1]!;
    second.onopen?.call(null, {});

    first.onclose?.call(null, {});

    expect(h.queue.current.status).toBe('queued');
  });

  it('closes the previous socket when restarted', () => {
    const h = harness();
    h.queue.start('tok', [0], ['eu']);
    h.queue.start('tok', [2], ['na']);
    expect(h.sockets[0]?.closed).toBe(true);
  });

  it('stop() closes and returns to idle', () => {
    const h = harness();
    h.queue.start('tok', [0], ['eu']);
    h.sockets[0]?.onopen?.call(null, {});
    h.queue.stop();

    expect(h.sockets[0]?.closed).toBe(true);
    expect(h.queue.current.status).toBe('idle');
    expect(h.queue.active).toBe(false);
  });

  it('survives a connect that throws', () => {
    const states: QueueState[] = [];
    const queue = new RankedQueue({
      onState: (s) => states.push(s),
      connect: () => { throw new Error('offline'); },
    });
    expect(() => queue.start('tok', [0], ['eu'])).not.toThrow();
    expect(queue.current).toEqual({ status: 'error', code: 'CONNECT_FAILED' });
  });
});
