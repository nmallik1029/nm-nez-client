import { appendFileSync } from 'node:fs';
import { join } from 'node:path';
import { app } from 'electron';
import { autoUpdater } from 'electron-updater';
import type { UpdateState } from '../shared/ipc';

/**
 * Self-update, against GitHub Releases.
 *
 * electron-updater reads `latest.yml` from the newest release, compares it to
 * the running version and fetches the installer. electron-builder writes that
 * yml alongside the exe and bakes the repo coordinates into `app-update.yml`
 * inside the package, so there's no URL to configure here.
 *
 * Two things it will not do:
 *
 *  - Download without being asked. `autoDownload` is off so the user gets a
 *    prompt with the version in it first, which is the whole point.
 *  - Install behind your back. `autoInstallOnAppQuit` is off too, so closing
 *    the client after declining an update doesn't quietly apply it next
 *    launch. Nothing happens until the Update button is pressed.
 *
 * Only a packaged NSIS install can do any of this. See `canUpdate`.
 */

export interface UpdaterDeps {
  readonly onState: (state: UpdateState) => void;
  readonly log: (...args: unknown[]) => void;
}

/**
 * Whether this build can update itself.
 *
 * Unpackaged is `npm start`, where there's no installer to replace and
 * electron-updater throws rather than no-ops. Portable builds set
 * PORTABLE_EXECUTABLE_DIR: they run from a single exe with no install
 * directory, so there's nothing for an installer to update. Offering the
 * button in either case would only produce an error.
 */
export function canUpdate(): boolean {
  return app.isPackaged && process.env['PORTABLE_EXECUTABLE_DIR'] === undefined;
}

/**
 * Where update trouble goes.
 *
 * A packaged app has no console, so console.log from main lands nowhere.
 * Without this there is no way to tell a check that found nothing from one
 * that fell over, which is exactly as annoying to debug as it sounds.
 */
function fileLog(level: string, ...args: unknown[]): void {
  try {
    const line = args
      .map((a) => (a instanceof Error ? (a.stack ?? a.message) : String(a)))
      .join(' ');
    const path = join(app.getPath('userData'), 'update.log');
    appendFileSync(path, `${new Date().toISOString()} [${level}] ${line}\n`, 'utf8');
  } catch {
    // Logging is never allowed to be the thing that breaks an update.
  }
}

let state: UpdateState = { status: 'idle' };
let wired = false;

export function currentUpdateState(): UpdateState {
  return state;
}

export interface UpdaterControls {
  /** `manual` decides whether a no-op reports a reason or stays quiet. */
  check: (manual: boolean) => void;
  download: () => void;
  install: () => void;
}

export function createUpdater(deps: UpdaterDeps): UpdaterControls {
  const set = (next: UpdateState): void => {
    state = next;
    deps.onState(next);
  };

  if (!wired) {
    wired = true;
    autoUpdater.autoDownload = false;
    autoUpdater.autoInstallOnAppQuit = false;
    autoUpdater.logger = {
      info: (m: unknown) => fileLog('info', m),
      warn: (m: unknown) => fileLog('warn', m),
      error: (m: unknown) => fileLog('error', m),
      debug: () => {},
    };

    autoUpdater.on('checking-for-update', () => set({ status: 'checking' }));

    autoUpdater.on('update-available', (info) => {
      deps.log(`update available: ${info.version}`);
      set({ status: 'available', version: info.version });
    });

    autoUpdater.on('update-not-available', () => {
      set({ status: 'none', version: app.getVersion() });
    });

    autoUpdater.on('download-progress', (progress) => {
      const version = 'version' in state ? state.version : app.getVersion();
      set({ status: 'downloading', version, percent: Math.round(progress.percent) });
    });

    autoUpdater.on('update-downloaded', (info) => {
      deps.log(`update ready: ${info.version}`);
      set({ status: 'ready', version: info.version });
    });

    autoUpdater.on('error', (err: Error) => {
      // Never fatal. A client that can't reach GitHub is still a client, so
      // this reports and goes quiet rather than interrupting the game.
      deps.log('update check failed:', err.message);
      set({ status: 'error', message: friendlyError(err) });
    });
  }

  return {
    check(manual) {
      if (!canUpdate()) {
        if (manual) {
          set({
            status: 'error',
            message: app.isPackaged
              ? 'The portable build cannot update itself. Use the installer.'
              : 'Updates only work in an installed build.',
          });
        }
        return;
      }
      void autoUpdater.checkForUpdates()?.catch(() => {
        // The error event already reported it.
      });
    },

    download() {
      if (!canUpdate()) return;
      set({ status: 'downloading', version: 'version' in state ? state.version : '', percent: 0 });
      void autoUpdater.downloadUpdate().catch(() => {
        // Reported through the error event.
      });
    },

    install() {
      if (state.status !== 'ready') return;

      /*
       * Silent, so the update skips the installer wizard. That is only
       * safe because the app installs per-user under LOCALAPPDATA, so
       * there is no elevation prompt to answer and nothing for NSIS to
       * ask about. A per-machine build could not do this.
       *
       * isForceRunAfter brings the client back up by itself.
       */
      set({ status: 'installing', version: state.version });

      // A silent install puts nothing on screen, so the window vanishing
      // with no explanation is all the user would get. The delay is for
      // the renderer to paint the message first.
      setTimeout(() => autoUpdater.quitAndInstall(true, true), 120);
    },
  };
}

/** GitHub's failures read like stack traces; these are the ones worth naming. */
function friendlyError(err: Error): string {
  const text = `${err.message}`;
  if (/ENOTFOUND|EAI_AGAIN|ENETUNREACH|ETIMEDOUT/i.test(text)) {
    return 'Could not reach GitHub. Check your connection.';
  }
  if (/404/.test(text)) {
    return 'No published release to update to yet.';
  }
  return text.split('\n')[0] ?? 'Update failed.';
}
