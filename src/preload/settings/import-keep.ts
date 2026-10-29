import { KRUNKER_IMPORT, KRUNKER_SETTINGS } from '../../krunker/constants';
import { BRANDING } from '../../shared/branding';
import { SHEETS, STYLE_IDS } from '../../shared/ui';
import {
  KEEP_GROUPS,
  keepCurrent,
  parseSettingsText,
  type ImportKeep,
  type SettingsPayload,
} from '../../shared/settings-import';
import { gameSetting, storedGameSettingIds } from '../look/game-settings';
import { defineStyle } from '../style';
import { attachTooltip } from './tooltip';

/**
 * Krunker's own Import, with the kept groups left as they are.
 *
 * Two of the game's globals are wrapped. `importSettingsPopup` gets a row of
 * switches under its text box, Sensitivity, Sounds and Keybinds, each saying
 * whether to keep yours; `importSettings` rewrites the text in that box just
 * before the game reads it, so the game's own import does the rest. What
 * rewriting means is shared/settings-import.ts.
 *
 * The rewrite is synchronous and in place. The game reads the box itself, by
 * id, and closes the popup as soon as it has, so anything deferred would land
 * on an import that has already happened.
 *
 * The settings library applies a profile through the same wrapped import, so
 * the switches cover it too: see `importSettingsPayload`.
 *
 * Both originals always run. A text that is not JSON is left exactly as typed,
 * for the game to report the way it always has.
 *
 * The approach, wrapping these two and rewriting the box in place, is Krunker
 * Civilian Client's (`src/preload/native-import.ts`, GPL-3.0, bigjakk). What
 * is kept, and how, was worked out again from the game's own import here.
 */

export interface ImportKeepDeps {
  getKeep(): ImportKeep;
  setKeep(next: ImportKeep): void;
}

type PageFunction = (...args: unknown[]) => unknown;

/** Set on our wrappers, so a second install never stacks two. */
const WRAPPED = '__nmImportKeep';

let deps: ImportKeepDeps | null = null;

function page(): Record<string, unknown> {
  return window as unknown as Record<string, unknown>;
}

/**
 * Wrap the game's import once it exists. It is built by the game's own
 * script, after the preload, so this polls for it and gives up after a
 * minute: the preload also runs on Krunker pages that have no settings.
 */
export function installImportKeep(next: ImportKeepDeps): void {
  deps = next;
  if (wrap()) return;
  let attempts = 0;
  const timer = setInterval(() => {
    attempts += 1;
    if (wrap() || attempts >= 120) {
      clearInterval(timer);
      if (attempts >= 120) {
        console.warn(BRANDING.logPrefix, 'Krunker import not found; settings import keeps nothing');
      }
    }
  }, 500);
}

function wrap(): boolean {
  const globals = page();
  const popup = globals[KRUNKER_IMPORT.popup] as (PageFunction & { [WRAPPED]?: true }) | undefined;
  const apply = globals[KRUNKER_IMPORT.apply] as (PageFunction & { [WRAPPED]?: true }) | undefined;
  if (typeof popup !== 'function' || typeof apply !== 'function') return false;
  if (popup[WRAPPED] === true && apply[WRAPPED] === true) return true;

  defineStyle(STYLE_IDS.importKeep, SHEETS.importKeep);

  if (popup[WRAPPED] !== true) {
    const wrappedPopup = function (this: unknown, ...args: unknown[]): unknown {
      const result = popup.apply(this, args);
      try {
        addSwitches();
      } catch {
        // The popup still works without them; it just keeps nothing.
      }
      return result;
    } as PageFunction & { [WRAPPED]?: true };
    wrappedPopup[WRAPPED] = true;
    globals[KRUNKER_IMPORT.popup] = wrappedPopup;
  }

  if (apply[WRAPPED] !== true) {
    const wrappedApply = function (this: unknown, ...args: unknown[]): unknown {
      try {
        keepInField();
      } catch (err) {
        console.warn(BRANDING.logPrefix, 'could not keep settings through the import:', err);
      }
      return apply.apply(this, args);
    } as PageFunction & { [WRAPPED]?: true };
    wrappedApply[WRAPPED] = true;
    globals[KRUNKER_IMPORT.apply] = wrappedApply;
  }
  return true;
}

/** Rewrite the import box so the kept groups come out as they are. */
function keepInField(): void {
  const keep = deps?.getKeep();
  if (!keep || (!keep.sensitivity && !keep.sounds && !keep.keybinds)) return;
  const field = document.getElementById(KRUNKER_IMPORT.field);
  if (!(field instanceof HTMLTextAreaElement)) return;
  const payload = parseSettingsText(field.value);
  if (!payload) return;
  field.value = JSON.stringify(keepCurrent(payload, keep, gameSetting, storedGameSettingIds()));
}

/**
 * The switches, under the popup's text box.
 *
 * Built fresh every time, because the game builds the popup fresh every time
 * and throws the last one away. Each one is saved the moment it is pressed,
 * so the choice is the same the next time, and the same for the library.
 */
function addSwitches(): void {
  const field = document.getElementById(KRUNKER_IMPORT.field);
  if (!field || field.parentElement?.querySelector('.kc-import-keep')) return;

  const row = document.createElement('div');
  row.className = 'kc-import-keep';

  const label = document.createElement('span');
  label.className = 'kc-import-keep-label';
  label.textContent = 'Keep my';
  row.append(label);

  for (const group of KEEP_GROUPS) {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.textContent = group.label;
    const paint = (): void => {
      chip.className = deps?.getKeep()[group.id] === true ? 'kc-chip on' : 'kc-chip';
    };
    paint();
    attachTooltip(chip, `${group.hint} On: yours stay as they are. Off: they come from what you paste.`);
    chip.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const keep = deps?.getKeep();
      if (!keep || !deps) return;
      deps.setKeep({ ...keep, [group.id]: !keep[group.id] });
      paint();
    });
    row.append(chip);
  }

  field.insertAdjacentElement('afterend', row);
}

/** The game's settings, the way its Export would save them, or null when it is not up. */
export function exportedSettings(): Record<string, unknown> | null {
  const exportSettings = page()[KRUNKER_IMPORT.exportSettings];
  if (typeof exportSettings !== 'function') return null;
  try {
    const text: unknown = (exportSettings as (asText: boolean) => unknown)(true);
    return typeof text === 'string' ? parseSettingsText(text) : null;
  } catch {
    return null;
  }
}

/**
 * Hand settings to the game's own import, keeping what the switches say.
 *
 * Through the wrapped `importSettings`, so this is exactly what pressing
 * Import with the text pasted does: the same keeping, the same checks, the
 * popup closed after. The game reads the text out of its box by id, so the
 * text goes into a box with that id: the popup's own if one is somehow still
 * in the page, or a hidden one of ours for the length of the call.
 *
 * The preset picker goes to Custom first, quietly. The import's own switch
 * to Custom would otherwise rebuild the settings window, which is where the
 * library is drawn, and drop you off the tab you pressed Apply on.
 *
 * False when the game's import is not there to call, or it threw.
 */
export function importSettingsPayload(payload: SettingsPayload): boolean {
  // Before the poll has got there, so an Apply pressed in the first moments
  // of a page still keeps what it should rather than importing raw.
  if (deps !== null) wrap();
  const globals = page();
  const apply = globals[KRUNKER_IMPORT.apply];
  if (typeof apply !== 'function') return false;

  const pick = globals[KRUNKER_SETTINGS.presetPicker];
  if (typeof pick === 'function') {
    try {
      (pick as (index: number, skipLoad: boolean, quiet: boolean) => void)(
        KRUNKER_SETTINGS.customPreset,
        true,
        true,
      );
    } catch {
      // Worst case the window redraws; the import still lands.
    }
  }

  const existing = document.getElementById(KRUNKER_IMPORT.field);
  const field = existing instanceof HTMLTextAreaElement ? existing : document.createElement('textarea');
  if (!existing) {
    field.id = KRUNKER_IMPORT.field;
    field.style.display = 'none';
    document.body.append(field);
  }
  field.value = JSON.stringify(payload);
  try {
    (apply as () => unknown)();
    return true;
  } catch {
    return false;
  } finally {
    if (!existing) field.remove();
  }
}
