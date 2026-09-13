import { describe, expect, it } from 'vitest';
import { stepEscape, type EscapeKeyInput } from './escape-lock';

/**
 * The two things that must never happen: taking Escape away from the page
 * when the mouse is not locked, which would stop it closing chat and menus,
 * and letting part of a press that was taken reach the page, which hands
 * Krunker a keyUp or a repeat to act on the menu that just opened.
 */

const key = (over: Partial<EscapeKeyInput> = {}): EscapeKeyInput => ({
  type: 'keyDown',
  key: 'Escape',
  control: false,
  alt: false,
  shift: false,
  meta: false,
  ...over,
});

describe('stepEscape', () => {
  it('takes Escape and releases the lock while the mouse is locked', () => {
    expect(stepEscape(key(), true, false)).toEqual({ action: 'release', holding: true });
  });

  it('leaves Escape alone when the mouse is not locked', () => {
    // Closing chat, a menu, a window: all of that still needs the key.
    expect(stepEscape(key(), false, false)).toEqual({ action: 'pass', holding: false });
  });

  it('leaves every other key alone, locked or not', () => {
    expect(stepEscape(key({ key: 'w' }), true, false).action).toBe('pass');
    expect(stepEscape(key({ key: 'Enter' }), true, false).action).toBe('pass');
  });

  it('leaves a modified Escape alone', () => {
    for (const mod of ['control', 'alt', 'shift', 'meta'] as const) {
      expect(stepEscape(key({ [mod]: true }), true, false).action).toBe('pass');
    }
  });

  it('does not start a press on a keyUp', () => {
    expect(stepEscape(key({ type: 'keyUp' }), true, false).action).toBe('pass');
  });

  it('takes the repeats of a held Escape, though the lock is already gone', () => {
    const first = stepEscape(key(), true, false);
    // The page has reported the lock released by the time the repeat arrives.
    const repeat = stepEscape(key(), false, first.holding);
    expect(repeat).toEqual({ action: 'swallow', holding: true });
  });

  it('takes the keyUp of a press it took, and that ends the press', () => {
    const up = stepEscape(key({ type: 'keyUp' }), false, true);
    expect(up).toEqual({ action: 'swallow', holding: false });
  });

  it('a whole press, down, repeat, up, then Escape works normally again', () => {
    let holding = false;
    const actions: string[] = [];
    for (const [input, locked] of [
      [key(), true],
      [key(), false],
      [key(), false],
      [key({ type: 'keyUp' }), false],
      [key(), false],
    ] as const) {
      const step = stepEscape(input, locked, holding);
      holding = step.holding;
      actions.push(step.action);
    }
    expect(actions).toEqual(['release', 'swallow', 'swallow', 'swallow', 'pass']);
  });

  it('does not disturb the holding state for other keys mid-press', () => {
    expect(stepEscape(key({ key: 'w' }), false, true)).toEqual({ action: 'pass', holding: true });
  });
});
