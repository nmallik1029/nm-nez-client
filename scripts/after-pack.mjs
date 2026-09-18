/**
 * electron-builder afterPack hook. Linux only: puts a small shell launcher in
 * front of the Electron binary, which moves to `<name>-bin` beside it.
 *
 * Three things have to be decided before Chromium's own startup, which is
 * earlier than any of our JavaScript runs, so they can only live out here:
 *
 *   X11.        `--ozone-platform=x11`, so the game runs under XWayland on a
 *               Wayland desktop. Native Wayland is where Linux Krunker
 *               clients have broken: pointer lock lets the cursor escape the
 *               window on multi-monitor setups, which ends aim mid-fight, and
 *               ANGLE crashes the GPU process on NVIDIA's driver while
 *               creating its command buffer. Chromium picks its display
 *               backend in early C++ startup and ignores the switch if main
 *               appends it later. A command-line `--ozone-platform=wayland`
 *               still wins, since Chromium keeps the last value it sees.
 *   Sandbox.    An AppImage can't carry a setuid-root chrome-sandbox (it runs
 *               from a nosuid FUSE mount), so the renderer sandbox relies on
 *               unprivileged user namespaces. Ubuntu 24.04 and later block
 *               those by default, and Chromium then refuses to start at all.
 *               The launcher checks first and only drops to --no-sandbox, with
 *               a message saying so, when neither sandbox can work. Userscripts
 *               run in the renderer, so keeping it where the kernel allows is
 *               worth the check.
 *   NVIDIA.     `__GL_SYNC_TO_VBLANK=0` turns off the driver's own vsync, which
 *               --disable-gpu-vsync doesn't reach, and threaded optimisations
 *               cut GPU-process CPU time at high frame rates. Mesa ignores
 *               both. Either can be overridden from the environment.
 *
 * All of it is from Krunker Civilian Client's afterPack-linux.js and
 * launch-electron.js (GPL-3.0, bigjakk), which ship the same patched Electron
 * on Linux. Changes: X11 is only forced when there is an X server to reach,
 * the setuid helper is used where a system has set one up, and the NVIDIA
 * variables respect values already set.
 */

import { rename, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

/** The launcher, for a binary called `bin` in the same directory. */
function launcher(bin) {
  return `#!/bin/sh
# Launcher for the NM/NZ client, written by scripts/after-pack.mjs at package
# time. The Electron binary is ${bin}, next to this file.
here=$(dirname "$(readlink -f "$0")")

# XWayland rather than native Wayland; see scripts/after-pack.mjs. Only when
# there is an X server, so a Wayland-only desktop still starts.
display=
if [ -n "$DISPLAY" ]; then
  display=--ozone-platform=x11
fi

# User namespaces first, which is what Chromium itself tries first. Then a
# setuid-root chrome-sandbox, if one has been set up. Otherwise nothing is
# left, and Chromium would refuse to start rather than run without one.
sandbox=
if unshare --user --map-root-user true >/dev/null 2>&1; then
  :
elif [ -u "$here/chrome-sandbox" ] && [ "$(stat -c %u "$here/chrome-sandbox" 2>/dev/null)" = 0 ]; then
  :
else
  echo "[NM] No usable sandbox: unprivileged user namespaces are blocked here. Starting with --no-sandbox." >&2
  echo "[NM] See the Linux section of the README for turning it back on." >&2
  sandbox=--no-sandbox
fi

export __GL_SYNC_TO_VBLANK="\${__GL_SYNC_TO_VBLANK:-0}"
export __GL_THREADED_OPTIMIZATIONS="\${__GL_THREADED_OPTIMIZATIONS:-1}"

exec "$here/${bin}" $display $sandbox "$@"
`;
}

export default async function afterPack(context) {
  if (context.electronPlatformName !== 'linux') return;

  const name = context.packager.executableName;
  const exe = join(context.appOutDir, name);
  const bin = `${name}-bin`;

  try {
    await stat(exe);
  } catch {
    throw new Error(`after-pack: expected the Electron binary at ${exe}`);
  }

  await rename(exe, join(context.appOutDir, bin));
  await writeFile(exe, launcher(bin), { mode: 0o755 });
  console.log(`  • after-pack: ${name} is now a launcher for ${bin}`);
}
