import { ipcRenderer } from 'electron';
import { IPC } from '../shared/ipc';

/**
 * The page's half of taking Escape in the main process.
 *
 * Main decides whether to take an Escape press, but only the page knows the
 * two things that decision rests on: whether the mouse is locked, and whether
 * something is being typed into. So the page reports the answer whenever
 * either changes -- on pointerlockchange and on focus moving -- and main keeps
 * the last one. Event-driven, so it costs nothing between those events.
 *
 * Typing counts as not locked on purpose. Escape in the chat box should close
 * the chat box, which it only can if the key reaches the page.
 *
 * When main does take a press, it sends a release back and this lets go of the
 * lock from code: the same kind of release Alt-Tab produces, which is the one
 * that clicks straight back in. The keydown listener in fixes.ts stays as the
 * fallback for a press that lands before the first report has arrived.
 */

let reported: boolean | null = null;

function typing(): boolean {
  const el = document.activeElement;
  return (
    el instanceof HTMLInputElement ||
    el instanceof HTMLTextAreaElement ||
    (el instanceof HTMLElement && el.isContentEditable)
  );
}

function report(): void {
  const takeEscape = document.pointerLockElement !== null && !typing();
  if (takeEscape === reported) return;
  reported = takeEscape;
  ipcRenderer.send(IPC.escapeReleasesLock, takeEscape);
}

export function installEscapeLockRelease(): void {
  document.addEventListener('pointerlockchange', report);
  document.addEventListener('focusin', report, true);
  // During focusout nothing has been focused yet, so read it once focus lands.
  document.addEventListener('focusout', () => setTimeout(report, 0), true);

  ipcRenderer.on(IPC.releasePointerLock, () => {
    if (document.pointerLockElement) document.exitPointerLock();
  });
}
