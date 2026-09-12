import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

/**
 * Small typed config store.
 *
 * Not electron-store, which drags in around twenty transitive packages that
 * all have to be listed by hand in electron-builder's `files:` block, and that
 * list breaks quietly whenever a dependency moves. This is 80 lines with no
 * dependencies and it's testable on its own.
 *
 * Writes are debounced, because the settings UI produces them in bursts, and
 * atomic (temp file then rename) so a crash mid-write can't leave a truncated
 * config behind. Call flush() before quitting or a pending write is lost.
 */
export interface ConfigStoreOptions<T> {
  readonly filePath: string;
  readonly defaults: T;
  /** Debounce window for disk writes. Default 250ms. */
  readonly writeDelayMs?: number;
  readonly onError?: (err: unknown) => void;
}

export class ConfigStore<T extends object> {
  private data: T;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private dirty = false;

  private readonly filePath: string;
  private readonly writeDelayMs: number;
  private readonly onError: (err: unknown) => void;

  constructor(options: ConfigStoreOptions<T>) {
    this.filePath = options.filePath;
    this.writeDelayMs = options.writeDelayMs ?? 250;
    this.onError = options.onError ?? (() => {});
    this.data = this.load(options.defaults);
  }

  /** Read a top-level section. */
  get<K extends keyof T>(key: K): T[K] {
    return this.data[key];
  }

  /** Replace a top-level section and schedule a write. */
  set<K extends keyof T>(key: K, value: T[K]): void {
    this.data[key] = value;
    this.schedule();
  }

  /** Shallow-merge into a section and schedule a write. */
  patch<K extends keyof T>(key: K, partial: Partial<T[K]>): void {
    this.data[key] = { ...this.data[key], ...partial };
    this.schedule();
  }

  /** Snapshot of the whole config. */
  all(): T {
    return this.data;
  }

  /** Write immediately if anything is pending. Call before quit. */
  flush(): void {
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    if (!this.dirty) return;
    this.dirty = false;
    this.writeNow();
  }

  private schedule(): void {
    this.dirty = true;
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.timer = null;
      this.dirty = false;
      this.writeNow();
    }, this.writeDelayMs);
  }

  private writeNow(): void {
    const tmp = `${this.filePath}.tmp`;
    try {
      mkdirSync(dirname(this.filePath), { recursive: true });
      writeFileSync(tmp, JSON.stringify(this.data, null, 2), 'utf8');
      renameSync(tmp, this.filePath);
    } catch (err) {
      this.onError(err);
    }
  }

  /**
   * Missing or corrupt config falls back to defaults instead of throwing. A
   * bad config file should never be the reason the client won't start.
   *
   * Unknown keys are dropped and known ones merge a level deep, so a config
   * written by an older build still picks up fields added since.
   */
  private load(defaults: T): T {
    let parsed: unknown;
    try {
      parsed = JSON.parse(stripBom(readFileSync(this.filePath, 'utf8')));
    } catch {
      return structuredClone(defaults);
    }
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return structuredClone(defaults);
    }

    const stored = parsed as Record<string, unknown>;
    const merged = structuredClone(defaults);
    for (const key of Object.keys(merged) as (keyof T)[]) {
      const incoming = stored[key as string];
      if (incoming === undefined) continue;
      const base = merged[key];
      if (
        base !== null &&
        typeof base === 'object' &&
        !Array.isArray(base) &&
        incoming !== null &&
        typeof incoming === 'object' &&
        !Array.isArray(incoming)
      ) {
        merged[key] = { ...base, ...incoming };
      } else if (typeof incoming === typeof base) {
        merged[key] = incoming as T[keyof T];
      }
      // Type mismatch, so keep the default rather than trust the file.
    }
    return merged;
  }
}

/**
 * Drop a leading byte-order mark.
 *
 * Several Windows editors write one, and PowerShell's `Set-Content -Encoding
 * utf8` does too. JSON.parse treats it as a syntax error, so a config saved
 * by one of those reads as corrupt and every setting silently goes back to
 * its default. Found the hard way, on a real config, which is also why the
 * character is written as an escape here rather than sitting invisibly in
 * the source.
 */
function stripBom(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}
