/**
 * Escape, taken in the main process while the game holds the mouse.
 *
 * WHY. Pressing Escape to leave a match made clicking back in take about two
 * seconds, however fast you clicked. Alt-Tab releases the same lock and clicks
 * straight back in, so the lock itself is fine: the delay is the Escape key
 * reaching the page. Something on that path -- Chromium treating it as you
 * leaving the lock, or Krunker's own Escape handling -- holds the next request
 * up.
 *
 * So the key never gets there. Main takes the press before Chromium or the
 * page sees it and asks the page to release the lock from code, which is the
 * same kind of release Alt-Tab produces. Krunker shows click-to-play on losing
 * the lock however it was lost, so what you see does not change.
 *
 * Only while the mouse is locked and nothing is being typed into, which the
 * page reports. Everywhere else Escape reaches the page untouched: it still
 * closes chat, menus, windows and the client's own dialogs.
 *
 * Pure, because the awkward part is the rest of the press. Taking a keyDown
 * and letting its keyUp through would hand the page half a keystroke, and a
 * held Escape repeats: after the first repeat the lock is already gone, so a
 * repeat judged on its own would reach Krunker and act on the menu that just
 * opened. Once a press is taken, the whole press is taken.
 */

/** The fields of Electron's `before-input-event` input that matter here. */
export interface EscapeKeyInput {
  readonly type: string;
  readonly key: string;
  readonly control: boolean;
  readonly alt: boolean;
  readonly shift: boolean;
  readonly meta: boolean;
}

export interface EscapeStep {
  /** `release` means take the key and have the page release the lock. */
  readonly action: 'pass' | 'release' | 'swallow';
  /** Whether a press is being taken, carried to the next event. */
  readonly holding: boolean;
}

export function stepEscape(
  input: EscapeKeyInput,
  pageLocked: boolean,
  holding: boolean,
): EscapeStep {
  if (input.key !== 'Escape') return { action: 'pass', holding };

  // The repeats and the keyUp of a press already taken go with it. The keyUp
  // is the end of that press.
  if (holding) return { action: 'swallow', holding: input.type !== 'keyUp' };

  // A modified Escape is somebody's shortcut, not leaving the game.
  const plain = !input.control && !input.alt && !input.shift && !input.meta;
  if (input.type !== 'keyDown' || !plain || !pageLocked) return { action: 'pass', holding: false };

  return { action: 'release', holding: true };
}
