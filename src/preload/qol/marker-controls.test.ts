import { describe, expect, it } from 'vitest';
import { DEFAULT_VISUALS, type MarkerSpec } from '../../shared/visuals';
import { markerEditor } from './marker-controls';

/**
 * The bug this exists to stop coming back.
 *
 * Sliders do not redraw the rows they sit in, on purpose: a row rebuilt
 * mid-drag takes the mouse with it. So a control that holds the marker it was
 * drawn with is holding a snapshot from before every change since, and
 * spreading it writes all of those back. On screen that reads as the sliders
 * resetting each other, and it is worse than it sounds, because the labels
 * keep reporting the values you chose while the marker underneath has none of
 * them.
 *
 * The DOM half cannot be tested here; the environment is node and this repo
 * does not pretend otherwise. What can be pinned is the part that was
 * actually wrong: whether an edit is applied to the marker as it is now.
 */

function store(initial: MarkerSpec): { value: MarkerSpec; read: () => MarkerSpec } {
  const state = { value: initial, read: (): MarkerSpec => state.value };
  return state;
}

const START = DEFAULT_VISUALS.crosshair.marker;

describe('markerEditor', () => {
  it('keeps earlier changes when a later control is used', () => {
    const state = store(START);
    const edit = markerEditor(state.read, (next) => {
      state.value = next;
    });

    // What the user did: length to 14, then gap to 1.
    edit({ length: 14 });
    edit({ gap: 1 });

    expect(state.value.length).toBe(14);
    expect(state.value.gap).toBe(1);
  });

  it('survives a long run of edits across every control', () => {
    const state = store(START);
    const edit = markerEditor(state.read, (next) => {
      state.value = next;
    });

    edit({ length: 20 });
    edit({ thickness: 4 });
    edit({ gap: 7 });
    edit({ dot: 3 });
    edit({ outline: 2 });
    edit({ opacity: 0.5 });
    edit({ color: '#ff00e5' });
    edit({ shape: 'x' }, true);

    expect(state.value).toEqual({
      shape: 'x',
      length: 20,
      thickness: 4,
      gap: 7,
      dot: 3,
      outline: 2,
      opacity: 0.5,
      color: '#ff00e5',
    });
  });

  it('passes the structural flag through, defaulting to false', () => {
    const seen: boolean[] = [];
    const state = store(START);
    const edit = markerEditor(state.read, (next, structural) => {
      state.value = next;
      seen.push(structural);
    });

    edit({ gap: 2 });
    edit({ shape: 'dot' }, true);

    // False means "repaint the picture", true means "draw the rows again".
    // A slider that asked for a redraw would take the mouse with it.
    expect(seen).toEqual([false, true]);
  });

  it('reads through the function every time rather than once', () => {
    // The failure mode in one line: something else changed the marker, and
    // the next edit has to build on that rather than on what was there when
    // the control was made.
    const state = store(START);
    const edit = markerEditor(state.read, (next) => {
      state.value = next;
    });

    state.value = { ...state.value, length: 31 };
    edit({ gap: 6 });

    expect(state.value.length).toBe(31);
  });
});
