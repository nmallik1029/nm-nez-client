// Electron's own fs, which reads inside .asar files: the extra archive is
// unpacked through it.
import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { app, net } from 'electron';
// Plain fs, which does not. Anything done to an .asar file itself goes
// through this, or Electron treats the file as a folder.
import * as ofs from 'original-fs';
import {
  extraRoots,
  extraUpToDate,
  LITE_MANIFEST_NAME,
  liteVerdict,
  parseLiteManifest,
  releaseAssetUrl,
  type LiteAsset,
  type LiteFile,
  type LiteManifest,
} from '../shared/lite-update';
import { sha512, swapAsar, swapFolder } from './lite-swap';

/**
 * The main-process half of updating without the installer: download, check,
 * stage, and swap in on restart. See `shared/lite-update.ts` for why.
 *
 * Nothing touches the running install until `apply()`, which runs at the very
 * end of quitting. Until then everything new sits beside what it replaces
 * (`app.asar.update`, `killstreak.update/`), so a download that fails or is
 * never used leaves the client exactly as it was, and the next launch tidies
 * it away.
 */

/** Where releases are published. Matches `publish` in electron-builder.yml. */
const RELEASES = { owner: 'nmallik1029', repo: 'nm-nez-client' } as const;

declare const __NM_RUNTIME__: string | undefined;

/**
 * The patched Electron build this app was made for, baked in by
 * vite.main.config.ts from the stamp postinstall writes. `unknown` in a build
 * made without one, which always takes the installer.
 */
export function runtimePin(): string {
  return typeof __NM_RUNTIME__ === 'string' && __NM_RUNTIME__ !== '' ? __NM_RUNTIME__ : 'unknown';
}

const resources = (): string => process.resourcesPath;
const liveAsar = (): string => join(resources(), 'app.asar');
const stagedAsar = (): string => `${liveAsar()}.update`;
const partialAsar = (): string => `${liveAsar()}.download`;
const previousAsar = (): string => `${liveAsar()}.old`;
const scratch = (): string => join(app.getPath('userData'), 'update');

export type Prepared = { readonly lite: true } | { readonly lite: false; readonly reason: string };

interface Staged {
  readonly asar: LiteAsset;
  /** Folders under resources/ with a replacement waiting beside them. */
  readonly roots: readonly string[];
}

let staged: Staged | null = null;

async function fetchManifest(version: string): Promise<LiteManifest | null> {
  const res = await net.fetch(releaseAssetUrl(RELEASES, version, LITE_MANIFEST_NAME));
  if (!res.ok) throw new Error(`no ${LITE_MANIFEST_NAME} on the release (HTTP ${res.status})`);
  return parseLiteManifest(await res.json());
}

/**
 * Download one release asset to `dest`, checking it on the way in.
 *
 * Hashed as it streams, and refused if it runs past its stated size, so a
 * wrong file never gets written whole before it is caught. A file that does
 * not match is deleted, not left for anything to pick up.
 */
async function download(
  version: string,
  asset: LiteAsset,
  dest: string,
  onBytes: (count: number) => void,
): Promise<void> {
  const res = await net.fetch(releaseAssetUrl(RELEASES, version, asset.name));
  if (!res.ok || !res.body) throw new Error(`${asset.name}: HTTP ${res.status}`);

  const hash = createHash('sha512');
  let size = 0;
  const fd = ofs.openSync(dest, 'w');
  try {
    const reader = res.body.getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > asset.size) throw new Error(`${asset.name}: bigger than the release says`);
      ofs.writeSync(fd, value);
      hash.update(value);
      onBytes(value.length);
    }
  } catch (err) {
    ofs.closeSync(fd);
    ofs.rmSync(dest, { force: true });
    throw err;
  }
  ofs.closeSync(fd);

  if (size !== asset.size || hash.digest('base64') !== asset.sha512) {
    ofs.rmSync(dest, { force: true });
    throw new Error(`${asset.name}: does not match the release`);
  }
}

/** Every file under `resources/<root>`, by its path relative to resources, with forward slashes. */
function listRoot(root: string, into: string[]): void {
  const base = join(resources(), root);
  if (!ofs.existsSync(base)) return;
  const walk = (dir: string): void => {
    for (const entry of ofs.readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else into.push(relative(resources(), full).split(sep).join('/'));
    }
  };
  walk(base);
}

/** What the install has now under the folders the release ships. */
async function localHashes(roots: readonly string[]): Promise<Map<string, string | null>> {
  const paths: string[] = [];
  for (const root of roots) listRoot(root, paths);
  const out = new Map<string, string | null>();
  for (const path of paths) {
    try {
      out.set(path, sha512(await ofs.promises.readFile(join(resources(), path))));
    } catch {
      out.set(path, null);
    }
  }
  return out;
}

/**
 * Unpack the extra archive into `<root>.update` folders beside the live ones.
 *
 * Every file is checked against the manifest as it comes out, on top of the
 * archive having been checked whole, because this is what ends up on disk.
 */
function unpackExtra(archive: string, files: readonly LiteFile[], roots: readonly string[]): void {
  for (const root of roots)
    ofs.rmSync(join(resources(), `${root}.update`), {
      recursive: true,
      force: true,
    });
  for (const file of files) {
    const [root, ...rest] = file.path.split('/');
    const data = fs.readFileSync(join(archive, ...file.path.split('/')));
    if (data.length !== file.size || sha512(data) !== file.sha512) {
      throw new Error(`${file.path}: does not match the release`);
    }
    const dest = join(resources(), `${root}.update`, ...rest);
    ofs.mkdirSync(dirname(dest), { recursive: true });
    ofs.writeFileSync(dest, data);
  }
}

/**
 * Get an update ready to swap in, or say why it needs the installer.
 *
 * Throws on anything unexpected; the caller falls back to the installer then
 * too, so this can only ever make updating work more often, never less.
 */
export async function prepareLite(
  version: string,
  onPercent: (percent: number) => void,
  log: (...args: unknown[]) => void,
): Promise<Prepared> {
  staged = null;
  const manifest = await fetchManifest(version);
  if (!manifest)
    return {
      lite: false,
      reason: `${LITE_MANIFEST_NAME} is not one this client understands`,
    };

  const verdict = liteVerdict(manifest, { version, runtime: runtimePin() });
  if (!verdict.lite) return verdict;

  // A folder the user cannot write to, like Program Files, is a job for the
  // installer and its elevation prompt.
  try {
    ofs.writeFileSync(partialAsar(), '');
  } catch (err) {
    return {
      lite: false,
      reason: `cannot write to ${resources()}: ${(err as Error).message}`,
    };
  }

  const roots = manifest.extra ? extraRoots(manifest.extra.files) : [];
  const extraNeeded =
    manifest.extra !== null && !extraUpToDate(manifest.extra.files, await localHashes(roots));

  const total = manifest.asar.size + (extraNeeded && manifest.extra ? manifest.extra.size : 0);
  let done = 0;
  let shown = -1;
  const onBytes = (count: number): void => {
    done += count;
    const percent = total > 0 ? Math.floor((done / total) * 100) : 100;
    if (percent !== shown) onPercent((shown = percent));
  };

  await download(version, manifest.asar, partialAsar(), onBytes);
  ofs.rmSync(stagedAsar(), { force: true });
  ofs.renameSync(partialAsar(), stagedAsar());

  if (extraNeeded && manifest.extra) {
    ofs.mkdirSync(scratch(), { recursive: true });
    // Named .asar so Electron's fs can read inside it.
    const archive = join(scratch(), `extra-${version}.asar`);
    const part = `${archive}.download`;
    await download(version, manifest.extra, part, onBytes);
    ofs.rmSync(archive, { force: true });
    ofs.renameSync(part, archive);
    unpackExtra(archive, manifest.extra.files, roots);
  }

  staged = { asar: manifest.asar, roots: extraNeeded ? roots : [] };
  log(
    `update ${version} staged without the installer${extraNeeded ? `, with ${roots.join(', ')}` : ''}`,
  );
  return { lite: true };
}

export function hasStagedLite(): boolean {
  return staged !== null;
}

/**
 * Swap everything staged in. Called from `will-quit`, after the windows are
 * gone, with `app.relaunch()` already asked for.
 *
 * app.asar first, because it is the update. The folders after it are data
 * the app reads whatever is there, so if one of them cannot be swapped the
 * new app runs on the old packs and the next update tries again.
 */
export function applyLite(log: (...args: unknown[]) => void): void {
  if (!staged) return;
  const { asar, roots } = staged;
  staged = null;
  const how = swapAsar(
    ofs,
    { live: liveAsar(), staged: stagedAsar(), previous: previousAsar() },
    asar.sha512,
  );
  log(`app.asar swapped in (${how})`);
  for (const root of roots) {
    try {
      swapFolder(ofs, resources(), root);
    } catch (err) {
      log(`could not swap in ${root}: ${(err as Error).message}`);
    }
  }
}

/**
 * Remove whatever an earlier update left behind: the previous app.asar and
 * folders, and anything staged but never used. Run at launch, when none of it
 * can be open. Never throws; what cannot go now goes next launch.
 */
export function cleanupLite(log: (...args: unknown[]) => void): void {
  const remove = (path: string): void => {
    try {
      ofs.rmSync(path, { recursive: true, force: true });
    } catch (err) {
      log(`could not remove ${path}: ${(err as Error).message}`);
    }
  };
  if (!app.isPackaged) return;
  for (const path of [previousAsar(), stagedAsar(), partialAsar()]) remove(path);
  try {
    for (const entry of ofs.readdirSync(resources(), { withFileTypes: true })) {
      if (entry.isDirectory() && /\.(update|old)$/.test(entry.name))
        remove(join(resources(), entry.name));
    }
  } catch {
    // No resources folder to look in is nothing to clean.
  }
  remove(scratch());
}
