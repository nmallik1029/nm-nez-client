import {
  buildQueueUrl,
  parseQueueMessage,
  type QueueMessage,
} from '../../shared/ranked';

/**
 * The ranked queue connection, in main rather than in a page.
 *
 * Krunker's own queue dies with the tab holding it. This one is a socket the
 * app owns, so you can close, reload or navigate the game window and keep your
 * place in line. That's the whole reason to queue externally.
 *
 * The socket is injectable so the state machine can be tested with no network.
 * What's interesting here is cooldown, disconnect and match, and none of those
 * are convenient to trigger for real.
 */

export type QueueState =
  | { readonly status: 'idle' }
  | { readonly status: 'connecting' }
  | { readonly status: 'queued'; readonly since: number }
  | { readonly status: 'matched'; readonly mapId: number; readonly region: string }
  | { readonly status: 'cooldown'; readonly until: number }
  | { readonly status: 'error'; readonly code: string };

/** The slice of WebSocket this client uses; lets tests supply a fake. */
export interface SocketLike {
  send?(data: string): void;
  close(): void;
  onopen: ((this: unknown, ev: unknown) => unknown) | null;
  onmessage: ((this: unknown, ev: { data: unknown }) => unknown) | null;
  onclose: ((this: unknown, ev: unknown) => unknown) | null;
  onerror: ((this: unknown, ev: unknown) => unknown) | null;
}

export interface RankedQueueOptions {
  readonly onState: (state: QueueState) => void;
  /** Fired once per match, before the state change, for alerts and sound. */
  readonly onMatch?: (mapId: number, region: string) => void;
  readonly connect?: (url: string) => SocketLike;
  readonly now?: () => number;
}

function defaultConnect(url: string): SocketLike {
  // Electron's main process has a global WebSocket, so no dependency needed.
  return new WebSocket(url) as unknown as SocketLike;
}

export class RankedQueue {
  private socket: SocketLike | null = null;
  private state: QueueState = { status: 'idle' };
  private readonly connect: (url: string) => SocketLike;
  private readonly now: () => number;

  /**
   * Bumped on every start and stop. Socket callbacks capture it and ignore
   * anything stale, so a socket closing after the user already re-queued
   * cannot knock the new attempt back to idle.
   */
  private generation = 0;

  constructor(private readonly options: RankedQueueOptions) {
    this.connect = options.connect ?? defaultConnect;
    this.now = options.now ?? (() => Date.now());
  }

  get current(): QueueState {
    return this.state;
  }

  get active(): boolean {
    return this.state.status === 'connecting' || this.state.status === 'queued';
  }

  start(token: string, mapIds: readonly number[], regionIds: readonly string[]): void {
    if (token === '') {
      this.setState({ status: 'error', code: 'NO_TOKEN' });
      return;
    }
    if (mapIds.length === 0 || regionIds.length === 0) {
      // The server takes this happily and then never matches anything, which
      // looks like a hang rather than a setting you forgot.
      this.setState({ status: 'error', code: 'NO_SELECTION' });
      return;
    }

    this.stop();
    const generation = ++this.generation;
    this.setState({ status: 'connecting' });

    let socket: SocketLike;
    try {
      socket = this.connect(buildQueueUrl(token, mapIds, regionIds));
    } catch {
      this.setState({ status: 'error', code: 'CONNECT_FAILED' });
      return;
    }
    this.socket = socket;

    socket.onopen = () => {
      if (this.generation !== generation) return;
      this.setState({ status: 'queued', since: this.now() });
    };

    socket.onmessage = (event) => {
      if (this.generation !== generation) return;
      this.handle(parseQueueMessage(String(event.data)));
    };

    socket.onerror = () => {
      if (this.generation !== generation) return;
      this.setState({ status: 'error', code: 'SOCKET_ERROR' });
    };

    socket.onclose = () => {
      if (this.generation !== generation) return;
      // A close after a match or a cooldown is expected. Don't paint over the
      // more useful state with a bare idle.
      if (this.state.status === 'matched' || this.state.status === 'cooldown') return;
      if (this.state.status === 'error') return;
      this.setState({ status: 'idle' });
    };
  }

  stop(): void {
    this.generation += 1;
    const socket = this.socket;
    this.socket = null;
    if (socket) {
      try {
        socket.close();
      } catch {
        // Already gone.
      }
    }
    if (this.state.status !== 'idle') this.setState({ status: 'idle' });
  }

  private handle(message: QueueMessage): void {
    switch (message.kind) {
      case 'matched':
        this.options.onMatch?.(message.mapId, message.region);
        this.setState({ status: 'matched', mapId: message.mapId, region: message.region });
        this.closeSocket();
        return;

      case 'cooldown':
        this.setState({ status: 'cooldown', until: this.now() + message.seconds * 1000 });
        this.closeSocket();
        return;

      case 'fatal':
        this.setState({ status: 'error', code: message.code });
        this.closeSocket();
        return;

      case 'queued':
        if (this.state.status === 'connecting') {
          this.setState({ status: 'queued', since: this.now() });
        }
        return;

      case 'other':
        return;
    }
  }

  /** Drop the socket without resetting state, which stop() would do. */
  private closeSocket(): void {
    const socket = this.socket;
    this.socket = null;
    try {
      socket?.close();
    } catch {
      // Already gone.
    }
  }

  private setState(state: QueueState): void {
    this.state = state;
    this.options.onState(state);
  }
}
