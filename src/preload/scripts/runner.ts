import { BRANDING } from '../../shared/branding';
import { findScript, type ClientScript } from './registry';

/**
 * Starts and stops the built-in scripts.
 *
 * A script is a string of JavaScript run in the page. Each gets its own
 * function scope, so two of them declaring the same `const` do not take each
 * other down, and a script that throws on the way in is logged and skipped
 * rather than stopping the rest.
 *
 * Whatever a script returns, if it is a function, is kept as its teardown and
 * called when it is switched off. That is the whole contract; a script with
 * no teardown can be started and not stopped, which the registry doc warns
 * about.
 */

/** Teardown per running script id. Presence here means "currently on". */
const running = new Map<string, () => void>();

function log(...args: unknown[]): void {
  console.log(BRANDING.logPrefix, ...args);
}

function start(script: ClientScript): void {
  if (running.has(script.id)) return;

  try {
    // Running our own JavaScript in the page is the entire feature, so the
    // implied-eval warning has nothing to tell us. The source is in the repo
    // and ships with the build; it is not user input.
    // eslint-disable-next-line @typescript-eslint/no-implied-eval, @typescript-eslint/no-unsafe-call
    const teardown: unknown = new Function(script.source)();
    running.set(script.id, typeof teardown === 'function' ? (teardown as () => void) : () => {});
    log(`script on: ${script.id}`);
  } catch (err) {
    console.error(BRANDING.logPrefix, `script "${script.id}" threw on start:`, err);
  }
}

function stop(id: string): void {
  const teardown = running.get(id);
  if (!teardown) return;
  running.delete(id);

  try {
    teardown();
    log(`script off: ${id}`);
  } catch (err) {
    // Already forgotten above, so a teardown that throws cannot wedge the
    // script in a state where it can never be started again.
    console.error(BRANDING.logPrefix, `script "${id}" threw on stop:`, err);
  }
}

/** Is this script currently running? */
export function isScriptRunning(id: string): boolean {
  return running.has(id);
}

/** Turn one script on or off. Doing it twice the same way is a no-op. */
export function setScriptEnabled(id: string, on: boolean): void {
  const script = findScript(id);
  if (!script) return;
  if (on) start(script);
  else stop(id);
}

/**
 * Bring the running set in line with the saved list.
 *
 * Called once at startup and again whenever the list changes, so it has to
 * handle both directions rather than just starting things.
 */
export function syncScripts(enabled: readonly string[]): void {
  const wanted = new Set(enabled);

  for (const id of [...running.keys()]) {
    if (!wanted.has(id)) stop(id);
  }
  for (const id of wanted) {
    setScriptEnabled(id, true);
  }
}
