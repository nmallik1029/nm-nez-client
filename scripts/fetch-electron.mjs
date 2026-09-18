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
 * privileges. Upstream publishes no checksums, so each sha256 in BUILDS below
 * is the hash of the build we actually downloaded, looked at and decided to
 * trust. A mismatch aborts, because a mismatch means the release asset was
 * swapped after we pinned it, and that's the exact thing worth stopping for.
 * To move to a newer build, check it yourself and update the pin.
 *
 * Upstream builds the same patches for Windows x64, Linux x64 and macOS arm64
 * from one tag. The first two are pinned; anything else gets stock Electron.
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
/** Has to match the `electron` devDependency or the ABI won't line up. */
const ELECTRON_VERSION = '44.0.0';

/**
 * One entry per `${process.platform}-${process.arch}` we ship. `exe` is the
 * binary inside the archive, which is also what path.txt has to name.
 */
const BUILDS = {
  'win32-x64': {
    asset: 'electron-v44.0.0-ws-frameThrottle-frameCap2-patched-windows-x64.zip',
    sha256: '02ec5c8b383a65938559957ffc20492ed9198b638d8cb08a254b31e4e345d72d',
    exe: 'electron.exe',
  },
  'linux-x64': {
    asset: 'electron-v44.0.0-ws-frameThrottle-frameCap2-patched-linux-x64.zip',
    sha256: '065cc0710379068249f0e4a9fde81241288c1ffd173bb2b1b6ddf93053c58a12',
    exe: 'electron',
  },
};

const URL_BASE = 'https://github.com/bigjakk/Electron-Websocket-Fix/releases/download';
const CACHE_DIR = join(ROOT, '.electron-cache');
const DIST_DIR = join(ROOT, 'node_modules', 'electron', 'dist');
const PATH_TXT = join(ROOT, 'node_modules', 'electron', 'path.txt');
/** Records which build is installed, so reruns are cheap. */
const STAMP = join(ROOT, 'node_modules', 'electron', '.patched-build.json');

const force = process.argv.includes('--force');

async function main() {
  // No patched build for this machine means stock Electron, which is what
  // the electron package's own postinstall has already put in place. The
  // client runs on it; only the uncapped frame rate turns bad.
  const target = `${process.platform}-${process.arch}`;
  const build = BUILDS[target];
  if (build === undefined) {
    console.log(`skipping patched Electron: none pinned for ${target}`);
    return;
  }
  const cachedZip = join(CACHE_DIR, build.asset);

  // The conventional "don't fetch binaries" flag. CI sets it on the job that
  // only typechecks, lints and tests. An explicit --force still wins, since
  // asking for the patch by name beats an ambient env var.
  if (!force && process.env.ELECTRON_SKIP_BINARY_DOWNLOAD) {
    console.log('skipping patched Electron: ELECTRON_SKIP_BINARY_DOWNLOAD is set');
    return;
  }

  await assertVersionMatch();

  if (!force && (await installedHash()) === build.sha256) {
    console.log(`patched Electron ${RELEASE_TAG} already installed`);
    return;
  }

  await mkdir(CACHE_DIR, { recursive: true });

  let hash = await hashIfPresent(cachedZip);
  if (hash === build.sha256) {
    console.log(`using cached ${build.asset}`);
  } else {
    if (hash !== null) {
      console.log('cached archive does not match the pin; re-downloading');
      await rm(cachedZip, { force: true });
    }
    await download(`${URL_BASE}/${RELEASE_TAG}/${build.asset}`, cachedZip);
    hash = await hashIfPresent(cachedZip);
  }

  if (hash !== build.sha256) {
    await rm(cachedZip, { force: true });
    throw new Error(
      `SHA-256 mismatch.\n  expected ${build.sha256}\n  got      ${hash}\n` +
        'The release asset changed since it was pinned. Verify the new build ' +
        `before updating the ${target} sha256 in this script.`,
    );
  }

  console.log(`extracting into ${DIST_DIR}`);
  // The archive has the contents of dist/ at its root, so it unpacks straight
  // over the stock tree. Anything not in the archive is a stock file the patch
  // doesn't touch and has to stay put.
  extract(cachedZip, DIST_DIR);

  // Tells the electron package where its binary is, so its own postinstall
  // sees one already there and doesn't pull a stock build down over ours.
  await writeFile(PATH_TXT, build.exe, 'utf8');
  await writeFile(
    STAMP,
    `${JSON.stringify({ tag: RELEASE_TAG, asset: build.asset, sha256: build.sha256 }, null, 2)}\n`,
    'utf8',
  );

  await assertPatched(join(DIST_DIR, build.exe));
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
async function assertPatched(exe) {
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

function extract(zip, dest) {
  if (process.platform === 'win32') extractOnWindows(zip, dest);
  else extractOnUnix(zip, dest);
}

/**
 * bsdtar ships with Windows 10 1803 and up and reads zip. It's far quicker
 * than Expand-Archive on a 380 MB tree, so that's only the fallback.
 */
function extractOnWindows(zip, dest) {
  try {
    execFileSync('tar', ['-xf', zip, '-C', dest], { stdio: 'inherit' });
  } catch {
    console.log('tar unavailable; falling back to Expand-Archive');
    const cmd = `Expand-Archive -LiteralPath '${zip}' -DestinationPath '${dest}' -Force`;
    execFileSync('powershell', ['-NoProfile', '-Command', cmd], { stdio: 'inherit' });
  }
}

/**
 * GNU tar, the tar on most Linux machines, can't read zip at all, so this is
 * unzip first and bsdtar after. Both keep the archive's Unix permissions,
 * which matters here: the Linux zip carries the executable bits for electron,
 * chrome-sandbox and chrome_crashpad_handler, and a binary without them is a
 * "permission denied" at npm start rather than anything that says why.
 */
function extractOnUnix(zip, dest) {
  try {
    execFileSync('unzip', ['-o', '-q', zip, '-d', dest], { stdio: 'inherit' });
    return;
  } catch {
    console.log('unzip unavailable or failed; trying bsdtar');
  }
  try {
    execFileSync('bsdtar', ['-xf', zip, '-C', dest], { stdio: 'inherit' });
  } catch {
    throw new Error(
      'Could not extract the patched Electron: neither unzip nor bsdtar worked. ' +
        'Install unzip (apt install unzip, dnf install unzip, pacman -S unzip) and ' +
        'run npm run electron:patch.',
    );
  }
}

main().catch((err) => {
  console.error(`\nfetch-electron failed: ${err.message}`);
  process.exit(1);
});
