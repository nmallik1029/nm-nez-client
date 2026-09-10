/**
 * Set while the rebind dialog is capturing a key, so hotkeys stay quiet while
 * you pick one. Without it, pressing F11 to rebind "toggle fullscreen" also
 * toggles fullscreen, and F12 opens DevTools over the dialog.
 *
 * Module state because the writer (an IPC handler) and the reader (the
 * before-input-event listener) sit on opposite ends of the app.
 */
let locked = false;

export const hotkeyLock = {
  get locked(): boolean {
    return locked;
  },
  set(value: boolean): void {
    locked = value;
  },
};
