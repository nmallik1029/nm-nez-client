/**
 * `npm start`, after the build: run Electron on the repo, on either OS.
 *
 * Two things a bare `electron .` gets wrong:
 *
 *   - ELECTRON_RUN_AS_NODE left over in the environment (some editors' own
 *     terminals set it) starts Electron as a plain Node process, so no window
 *     ever appears and nothing says why. It's dropped here.
 *   - On Linux the packaged client runs under X11 through its launcher (see
 *     after-pack.mjs), and a dev run should match that. Chromium only reads
 *     the display backend from the real command line, so it goes on here.
 *     Anything after `npm start --` is passed through and comes later, so
 *     `npm start -- --ozone-platform=wayland` still gets native Wayland.
 */

import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
// Outside Electron, the package's entry point is the path to the binary.
const electron = createRequire(import.meta.url)('electron');

const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;

const args = ['.'];
if (process.platform === 'linux' && env.DISPLAY) args.push('--ozone-platform=x11');
args.push(...process.argv.slice(2));

const child = spawn(electron, args, { cwd: ROOT, env, stdio: 'inherit' });
child.on('exit', (code, signal) => process.exit(signal === null ? (code ?? 0) : 1));
