import { Socket } from 'node:net';

/**
 * Real server ping.
 *
 * The number Krunker shows is its own estimate, worked out from game traffic.
 * This is a TCP connect to the same host and port the game's WebSocket uses,
 * so it's the actual network path with no game-loop scheduling or smoothing
 * in the way.
 *
 * Fresh connect per sample rather than holding a socket open. Reusing one
 * measures an already-warm path, and it leaves the game server with an idle
 * connection nobody asked for.
 */
export const PING_TIMEOUT_MS = 1800;
export const PING_INTERVAL_MS = 2000;

/** Round-trip in ms, or -1 on timeout/refusal/error. Never rejects. */
export function tcpPing(host: string, port: number, timeoutMs = PING_TIMEOUT_MS): Promise<number> {
  return new Promise((resolve) => {
    const socket = new Socket();
    const start = process.hrtime.bigint();
    let settled = false;

    const finish = (ms: number): void => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve(ms);
    };

    socket.setTimeout(timeoutMs);
    socket.once('connect', () => {
      // hrtime is monotonic. Date.now() jumps if the clock is adjusted mid
      // measurement, and then you get a negative or nonsense latency.
      finish(Math.round(Number(process.hrtime.bigint() - start) / 1_000_000));
    });
    socket.once('error', () => finish(-1));
    socket.once('timeout', () => finish(-1));

    try {
      socket.connect(port, host);
    } catch {
      finish(-1);
    }
  });
}

export interface PingTarget {
  readonly host: string;
  readonly port: number;
}

export interface ServerPingerOptions {
  /** Delivers each successful sample. Failures are swallowed, not reported. */
  readonly onSample: (ms: number) => void;
  readonly intervalMs?: number;
  readonly ping?: (host: string, port: number) => Promise<number>;
}

/**
 * Polls one target on an interval. Re-targeting to the same host and port does
 * nothing, so an F5 (which re-detects the same server) doesn't reset the timer.
 */
export class ServerPinger {
  private timer: ReturnType<typeof setInterval> | null = null;
  private target: PingTarget | null = null;
  /**
   * Bumped on every stop and re-target. A probe grabs it before awaiting and
   * throws its result away if it moved, or a sample already in flight lands
   * after stop() and reports latency for a server we already left.
   */
  private generation = 0;
  private readonly intervalMs: number;
  private readonly ping: (host: string, port: number) => Promise<number>;

  constructor(private readonly options: ServerPingerOptions) {
    this.intervalMs = options.intervalMs ?? PING_INTERVAL_MS;
    this.ping = options.ping ?? tcpPing;
  }

  get current(): PingTarget | null {
    return this.target;
  }

  get running(): boolean {
    return this.timer !== null;
  }

  setTarget(host: string, port: number): void {
    if (this.target?.host === host && this.target.port === port && this.timer !== null) return;
    this.stop();
    this.target = { host, port };
    void this.measure();
    this.timer = setInterval(() => void this.measure(), this.intervalMs);
  }

  stop(): void {
    if (this.timer !== null) clearInterval(this.timer);
    this.timer = null;
    this.generation += 1;
  }

  /** Stop and forget the target, so the next setTarget always restarts. */
  reset(): void {
    this.stop();
    this.target = null;
  }

  private async measure(): Promise<void> {
    const target = this.target;
    if (!target) return;
    const generation = this.generation;

    const ms = await this.ping(target.host, target.port);

    // Failed probe reports nothing rather than a bogus number. The HUD holding
    // its last good value beats flashing "-1".
    if (ms < 0) return;
    // Stopped or re-targeted while this probe was in flight.
    if (this.generation !== generation || this.target !== target) return;
    this.options.onSample(ms);
  }
}

/**
 * Pull a ping target out of a game WebSocket URL. Match servers are `lobby-*`
 * hosts; anything else on the domain is API or social traffic and would
 * measure the wrong path.
 */
export function gameSocketTarget(url: string): PingTarget | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (!parsed.hostname.includes('lobby-')) return null;

  const port = parsed.port !== '' ? Number(parsed.port) : parsed.protocol === 'wss:' ? 443 : 80;
  if (!Number.isInteger(port) || port <= 0 || port > 65535) return null;

  return { host: parsed.hostname, port };
}
