/**
 * Install the patched Electron binary over the stock one.
 *
 * Krunker wants uncapped FPS, which means --disable-frame-rate-limit. On stock
 * Chromium that switch is what causes the aim freeze: continuous mouse input
 * runs at kHighestPriority on the renderer's main-thread scheduler and starves
 * WebSocket and Worker dispatch, so the network task carrying your shots
 * stalls for 100-300ms. That is exactly while you're holding the mouse and
 * moving, which is to say during a fight. Separately, the compositor floods
 * the main thread with begin-frame tasks once the frame-rate-limit exemption
 * is in play.
 *
 * None of that is reachable from JavaScript or a command-line switch; the task
 * priorities are compiled in. Hence a patched build.
 *
 * The patches (bigjakk/Electron-Websocket-Fix, GPL-3.0):
 *
 *   ws-priority     main_thread_scheduler_impl.cc. Input drops from
 *                   kHighestPriority to kNormalPriority and compositor
 *                   priority is capped the same way, so held input stops
 *                   starving network tasks.
 *   frame-pacing    scheduler_state_machine.cc. IsDrawThrottled() loses its
 *                   frame-rate-limit exemption, which stops
 *                   BackToBackBeginFrameSource flooding the main thread. Adds
 *                   CustomMaxPendingFrames:count/N.
 *   frame-cap       display_scheduler.cc + base_window.cc. A pacing gate in
 *                   DidReceiveSwapBuffersAck() gives an exact FPS cap that
 *                   holds above the display refresh rate, plus the runtime
 *                   win.setFrameCap() API. Adds CustomFrameCap:fps/N.
 *
 * Worth being clear about what this does: it downloads a prebuilt, unsigned
 * Chromium from someone else's GitHub release and runs it with full local
 * privileges. Upstream publishes no checksums, so ASSET_SHA256 below is the
 * hash of the build we actually downloaded, looked at and decided to trust. A
 * mismatch aborts, because a mismatch means the release asset was swapped
 * after we pinned it, and that's the exact thing worth stopping for. To move
 * to a newer build, check it yourself and update the pin.
 */

import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { createWriteStream } from 'node:fs';
import { mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const RELEASE_TAG = 'v44.0.0';
const ASSET = 'electron-v44.0.0-ws-frameThrottle-frameCap2-patched-windows-x64.zip';
const ASSET_SHA256 = '02ec5c8b383a65938559957ffc20492ed9198b638d8cb08a254b31e4e345d72d';
/** Has to match the `electron` devDependency or the ABI won't line up. */
const ELECTRON_VERSION = '44.0.0';

const URL_BASE = 'https://github.com/bigjakk/Electron-Websocket-Fix/releases/download';
const CACHE_DIR = join(ROOT, '.electron-cache');
const CACHED_ZIP = join(CACHE_DIR, ASSET);
const DIST_DIR = join(ROOT, 'node_modules', 'electron', 'dist');
const PATH_TXT = join(ROOT, 'node_modules', 'electron', 'path.txt');
/** Records which build is installed, so reruns are cheap. */
const STAMP = join(ROOT, 'node_modules', 'electron', '.patched-build.json');

const force = process.argv.includes('--force');

async function main() {
  // The asset is a windows-x64 build, and unpacking it needs bsdtar or
  // PowerShell, neither of which a Linux runner has. Without this guard
  // postinstall downloads 380MB on every CI job and then fails trying to
  // extract it, which is exactly what it did the first time this was pushed.
  if (process.platform !== 'win32') {
    console.log(`skipping patched Electron: windows-x64 only, this is ${process.platform}`);
    return;
  }

  // The conventional "don't fetch binaries" flag. CI sets it on the job that
  // only typechecks, lints and tests. An explicit --force still wins, since
  // asking for the patch by name beats an ambient env var.
  if (!force && process.env.ELECTRON_SKIP_BINARY_DOWNLOAD) {
    console.log('skipping patched Electron: ELECTRON_SKIP_BINARY_DOWNLOAD is set');
    return;
  }

  await assertVersionMatch();

  if (!force && (await installedHash()) === ASSET_SHA256) {
    console.log(`patched Electron ${RELEASE_TAG} already installed`);
    return;
  }

  await mkdir(CACHE_DIR, { recursive: true });

  let hash = await hashIfPresent(CACHED_ZIP);
  if (hash === ASSET_SHA256) {
    console.log(`using cached ${ASSET}`);
  } else {
    if (hash !== null) {
      console.log('cached archive does not match the pin; re-downloading');
      await rm(CACHED_ZIP, { force: true });
    }
    await download(`${URL_BASE}/${RELEASE_TAG}/${ASSET}`, CACHED_ZIP);
    hash = await hashIfPresent(CACHED_ZIP);
  }

  if (hash !== ASSET_SHA256) {
    await rm(CACHED_ZIP, { force: true });
    throw new Error(
      `SHA-256 mismatch.\n  expected ${ASSET_SHA256}\n  got      ${hash}\n` +
        'The release asset changed since it was pinned. Verify the new build ' +
        'before updating ASSET_SHA256 in this script.',
    );
  }

  console.log(`extracting into ${DIST_DIR}`);
  // The archive has the contents of dist/ at its root, so it unpacks straight
  // over the stock tree. Anything not in the archive is a stock file the patch
  // doesn't touch and has to stay put.
  extract(CACHED_ZIP, DIST_DIR);

  // Tells the electron package where its binary is, so its own postinstall
  // sees one already there and doesn't pull a stock build down over ours.
  await writeFile(PATH_TXT, 'electron.exe', 'utf8');
  await writeFile(
    STAMP,
    `${JSON.stringify({ tag: RELEASE_TAG, asset: ASSET, sha256: ASSET_SHA256 }, null, 2)}\n`,
    'utf8',
  );

  await assertPatched();
  console.log(`patched Electron ${RELEASE_TAG} installed`);
}

/** A patched build for the wrong Electron version breaks the ABI. */
async function assertVersionMatch() {
  const pkg = JSON.parse(await readFile(join(ROOT, 'package.json'), 'utf8'));
  const declared = pkg.devDependencies?.electron;
  if (declared !== ELECTRON_VERSION) {
    throw new Error(
      `package.json pins electron ${declared} but this script installs a ` +
        `${ELECTRON_VERSION} build. Update both together.`,
    );
  }
}

/**
 * Check the installed binary really is the patched one.
 *
 * setFrameCap is the Electron-layer patch's exported method name and isn't in
 * a stock build, so it's a reliable marker. The point is catching a quiet
 * fallback to stock here, because otherwise the only symptom is "aim still
 * freezes" and that takes a while to trace back to the binary.
 */
async function assertPatched() {
  const exe = join(DIST_DIR, 'electron.exe');
  const bytes = await readFile(exe);
  if (!bytes.includes('setFrameCap')) {
    throw new Error(`${exe} does not look patched: setFrameCap marker missing`);
  }
}

async function installedHash() {
  try {
    return JSON.parse(await readFile(STAMP, 'utf8')).sha256 ?? null;
  } catch {
    return null;
  }
}

async function hashIfPresent(file) {
  try {
    await stat(file);
  } catch {
    return null;
  }
  return createHash('sha256').update(await readFile(file)).digest('hex');
}

async function download(url, dest) {
  console.log(`downloading ${url}`);
  const response = await fetch(url, { redirect: 'follow' });
  if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);

  const total = Number(response.headers.get('content-length') ?? 0);
  let seen = 0;
  let printed = 0;

  const progress = new TransformStream({
    transform(chunk, controller) {
      seen += chunk.byteLength;
      const pct = total > 0 ? Math.floor((seen / total) * 100) : 0;
      if (pct >= printed + 10) {
        printed = pct;
        process.stdout.write(`  ${pct}%\n`);
      }
      controller.enqueue(chunk);
    },
  });

  await pipeline(response.body.pipeThrough(progress), createWriteStream(dest));
}

/**
 * bsdtar ships with Windows 10 1803 and up and reads zip. It's far quicker
 * than Expand-Archive on a 380 MB tree, so that's only the fallback.
 */
function extract(zip, dest) {
  try {
    execFileSync('tar', ['-xf', zip, '-C', dest], { stdio: 'inherit' });
  } catch {
    console.log('tar unavailable; falling back to Expand-Archive');
    const cmd = `Expand-Archive -LiteralPath '${zip}' -DestinationPath '${dest}' -Force`;
    execFileSync('powershell', ['-NoProfile', '-Command', cmd], { stdio: 'inherit' });
  }
}

main().catch((err) => {
  console.error(`\nfetch-electron failed: ${err.message}`);
  process.exit(1);
});
