/**
 * How the running build got onto the machine, which decides whether it can
 * update itself and how it restarts.
 *
 * Pure, so the rules can be tested without Electron: the caller hands in
 * `app.isPackaged`, `process.platform` and `process.env`.
 */

export type InstallKind =
  /** `npm start`. No installer to replace, and electron-updater throws. */
  | 'dev'
  /** The NSIS install on Windows. Updates by running the new installer. */
  | 'installer'
  /** The single-exe Windows build. No install directory to update. */
  | 'portable'
  /** The Linux AppImage. Updates by swapping the file for the new one. */
  | 'appimage'
  /**
   * Packaged, but none of the above: an AppImage someone extracted, or a
   * repackaging. There is no one file for the updater to replace.
   */
  | 'unpacked';

export interface InstallRuntime {
  readonly isPackaged: boolean;
  readonly platform: NodeJS.Platform;
  readonly env: Readonly<Record<string, string | undefined>>;
}

export function installKind(runtime: InstallRuntime): InstallKind {
  if (!runtime.isPackaged) return 'dev';
  if (runtime.platform === 'linux') {
    // The AppImage runtime sets APPIMAGE to the file it was started from, and
    // that path is exactly what electron-updater replaces.
    return runtime.env['APPIMAGE'] ? 'appimage' : 'unpacked';
  }
  // Set by the portable exe's launcher to the folder the exe sits in.
  if (runtime.env['PORTABLE_EXECUTABLE_DIR'] !== undefined) return 'portable';
  return 'installer';
}

/** Why this build can't update itself, or null when it can. Shown as-is. */
export function selfUpdateBlocker(kind: InstallKind): string | null {
  switch (kind) {
    case 'installer':
    case 'appimage':
      return null;
    case 'dev':
      return 'Updates only work in an installed build.';
    case 'portable':
      return 'The portable build cannot update itself. Use the installer.';
    case 'unpacked':
      return 'Only the AppImage can update itself. Download the new version by hand.';
  }
}

/**
 * Closes every inherited descriptor past stderr, waits for the pid in $0 to be
 * gone, then runs "$@". Gives up waiting after about 20 seconds and runs it
 * anyway, rather than never. Bash rather than sh because dash can't close a
 * descriptor above 9, and bash is no new requirement: the AppImage's own
 * AppRun is a bash script.
 */
const WAIT_THEN_EXEC = [
  'for fd in /proc/$$/fd/*; do fd=${fd##*/}; [ "$fd" -gt 2 ] && eval "exec $fd>&-"; done 2>/dev/null',
  'n=0; while kill -0 "$0" 2>/dev/null && [ "$n" -lt 100 ]; do n=$((n+1)); sleep 0.2; done',
  'exec "$@"',
].join('\n');

/**
 * The command that brings an AppImage back after it exits, for spawning
 * detached. Null for every other kind of build, where `app.relaunch()` works.
 *
 * `app.relaunch()` can't do it, measured rather than guessed, for two reasons:
 *
 *  - Relaunching the binary itself: it lives in the AppImage's FUSE mount,
 *    and the AppImage runtime unmounts that as soon as the process it started
 *    exits, before the relaunch gets to it.
 *  - Relaunching the AppImage file instead (`execPath`): Chromium starts its
 *    relauncher with no_new_privs set, so the new AppImage's fusermount, a
 *    setuid helper, can't mount anything and it exits straight away.
 *
 * A child from Node's own spawn carries neither problem: bash isn't in the
 * mount, and no_new_privs isn't set. It has to wait for us to be gone first,
 * or the new instance finds our single-instance lock still held and hands its
 * command line to us on our way out. And it has to shed the descriptors it
 * inherits, which Node's spawn passes along: one is the old AppImage
 * runtime's keep-alive pipe, and while the new client holds that, the old
 * mount never goes away. Starting from the file also goes back through the
 * launcher, so the X11 and sandbox switches are worked out afresh.
 */
export function appImageRestart(
  kind: InstallKind,
  env: Readonly<Record<string, string | undefined>>,
  argv: readonly string[],
  pid: number,
): { command: string; args: string[] } | null {
  const appImage = env['APPIMAGE'];
  if (kind !== 'appimage' || !appImage) return null;
  return {
    command: '/bin/bash',
    args: ['-c', WAIT_THEN_EXEC, String(pid), appImage, ...argv.slice(1)],
  };
}
