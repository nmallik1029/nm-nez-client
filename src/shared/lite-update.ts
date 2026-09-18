/**
 * Updating without the installer.
 *
 * WHY. The installer is an unsigned exe, and Windows Smart App Control
 * refuses to run one: electron-updater's `quitAndInstall` dies with "spawn
 * UNKNOWN", then again through elevate.exe, and the client never updates.
 * Nothing about the installer can be fixed from here short of code signing.
 *
 * But an update almost never needs it. Everything that changes between two
 * releases lives in `resources/`: the app itself in `app.asar`, and any data
 * shipped in folders beside it. The Electron runtime, the one part that
 * needs an installer, only changes when the patched build is re-pinned. So
 * every release also publishes those files on their own, and the client
 * fetches them, checks them and swaps them in on restart. It runs nothing new,
 * so there is nothing for Windows to block.
 *
 * WHAT A RELEASE PUBLISHES, beside the installer (scripts/lite-release.mjs):
 *
 *   lite.json                the manifest below
 *   NM-NZ-<v>.asar           resources/app.asar
 *   NM-NZ-<v>-extra.asar     every folder beside it, packed as one archive
 *
 * `runtime` is the pin of the patched Electron build the release was made
 * with. The running app carries its own, baked in at build time, and an app
 * file is only ever swapped for one built against the same runtime. That
 * keeps the pin true of the exe actually running, so the day it differs is
 * the day the installer is genuinely needed, and the client says so.
 *
 * Pure, so every check a download has to pass is tested without one.
 */

export const LITE_MANIFEST_NAME = 'lite.json';

/** One published file: its release asset name, and how to know it arrived whole. */
export interface LiteAsset {
  readonly name: string;
  readonly size: number;
  /** Base64 SHA-512, the same form electron-updater's latest.yml uses. */
  readonly sha512: string;
}

/** One file inside the extra archive, by its path under `resources/`. */
export interface LiteFile {
  readonly path: string;
  readonly size: number;
  readonly sha512: string;
}

export interface LiteManifest {
  readonly version: string;
  readonly runtime: string;
  readonly asar: LiteAsset;
  /** Null for a release with nothing beside app.asar. */
  readonly extra: (LiteAsset & { readonly files: readonly LiteFile[] }) | null;
}

const SHA512_BASE64 = /^[A-Za-z0-9+/]{86}==$/;
/** An asset name: one path segment, nothing to escape, nothing to traverse. */
const ASSET_NAME = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
const SEGMENT = /^[A-Za-z0-9_][A-Za-z0-9._ -]{0,127}$/;

/**
 * Is this safe to write under `resources/`?
 *
 * Every path in a manifest becomes a file the client writes, so this is what
 * stands between a bad manifest and a write anywhere else on the disk: no
 * absolute paths, no `..`, no backslashes, no drive letters. And never a top
 * level file: those are app.asar and the installer's own, which the extra
 * archive has no business touching.
 */
export function isSafeResourcePath(path: string): boolean {
  const segments = path.split('/');
  if (segments.length < 2) return false;
  return segments.every((s) => SEGMENT.test(s) && s !== '.' && s !== '..' && !s.endsWith('.'));
}

function isSize(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

function asset(value: unknown): LiteAsset | null {
  if (typeof value !== 'object' || value === null) return null;
  const { name, size, sha512 } = value as Record<string, unknown>;
  if (typeof name !== 'string' || !ASSET_NAME.test(name)) return null;
  if (!isSize(size) || typeof sha512 !== 'string' || !SHA512_BASE64.test(sha512)) return null;
  return { name, size, sha512 };
}

function file(value: unknown): LiteFile | null {
  if (typeof value !== 'object' || value === null) return null;
  const { path, size, sha512 } = value as Record<string, unknown>;
  if (typeof path !== 'string' || !isSafeResourcePath(path)) return null;
  if (!isSize(size) || typeof sha512 !== 'string' || !SHA512_BASE64.test(sha512)) return null;
  return { path, size, sha512 };
}

/**
 * The manifest, or null if any part of it is not what a release publishes.
 *
 * All or nothing. A manifest with one bad entry is not a partly usable one:
 * it is one this client does not understand, and the installer is the safe
 * way through that.
 */
export function parseLiteManifest(value: unknown): LiteManifest | null {
  if (typeof value !== 'object' || value === null) return null;
  const raw = value as Record<string, unknown>;
  if (typeof raw['version'] !== 'string' || !/^\d+\.\d+\.\d+$/.test(raw['version'])) return null;
  if (typeof raw['runtime'] !== 'string' || raw['runtime'] === '') return null;

  const app = asset(raw['asar']);
  if (!app) return null;

  let extra: LiteManifest['extra'] = null;
  if (raw['extra'] !== null && raw['extra'] !== undefined) {
    const pack = asset(raw['extra']);
    const list = (raw['extra'] as { files?: unknown }).files;
    if (!pack || !Array.isArray(list)) return null;
    const files: LiteFile[] = [];
    const seen = new Set<string>();
    for (const entry of list) {
      const parsed = file(entry);
      if (!parsed || seen.has(parsed.path.toLowerCase())) return null;
      seen.add(parsed.path.toLowerCase());
      files.push(parsed);
    }
    extra = { ...pack, files };
  }

  return { version: raw['version'], runtime: raw['runtime'], asar: app, extra };
}

export type LiteVerdict = { readonly lite: true } | { readonly lite: false; readonly reason: string };

/**
 * Can this client take the update without the installer?
 *
 * Only for the version it was offered, and only on the runtime it is running.
 * A runtime of `unknown` is a build that could not read its own pin, and it
 * gets the installer rather than a guess.
 */
export function liteVerdict(
  manifest: LiteManifest,
  expect: { readonly version: string; readonly runtime: string },
): LiteVerdict {
  if (manifest.version !== expect.version) {
    return { lite: false, reason: `manifest is for ${manifest.version}, not ${expect.version}` };
  }
  if (expect.runtime === 'unknown' || manifest.runtime !== expect.runtime) {
    return { lite: false, reason: 'this release changes the Electron runtime' };
  }
  return { lite: true };
}

/** The folders under `resources/` the extra archive covers. */
export function extraRoots(files: readonly LiteFile[]): string[] {
  return [...new Set(files.map((f) => f.path.split('/')[0] ?? ''))].filter((r) => r !== '').sort();
}

/**
 * Does the install already have exactly the extra files this release ships?
 *
 * `local` is what is on disk under the same roots, path to hash, with a hash
 * of null for a file that could not be read. A file missing, different, or
 * present but not in the release all mean the folders are refreshed as a
 * whole, which is simpler to get right than patching them file by file and
 * costs one download that only happens when those folders actually change.
 */
export function extraUpToDate(
  files: readonly LiteFile[],
  local: ReadonlyMap<string, string | null>,
): boolean {
  if (local.size !== files.length) return false;
  return files.every((f) => local.get(f.path) === f.sha512);
}

/** Where a release asset is downloaded from. */
export function releaseAssetUrl(
  repo: { readonly owner: string; readonly repo: string },
  version: string,
  name: string,
): string {
  return `https://github.com/${repo.owner}/${repo.repo}/releases/download/v${version}/${name}`;
}
