import {
  capturePreset,
  planPreset,
  PRESET_LIMIT,
  PRESET_NAME_MAX,
  PRESET_SCOPES,
  presetName,
  summarisePreset,
  type PresetScope,
  type SettingPreset,
} from '../../shared/presets';
import { gameSetting, setGameSettings, storedGameSettingIds } from '../look/game-settings';
import { showToast } from '../toast';
import { attachTooltip } from './tooltip';

/**
 * The Presets tab: save the game's own sensitivity or FOV under a name, and
 * switch back to it with one click.
 *
 * One category per scope. That is how the tab grows (a scope added in
 * shared/presets.ts turns up here as its own category), and it is also what
 * the section index needs: a panel with fewer than two categories sits hidden
 * while the index waits to see whether it can build, which on every visit to
 * this tab would be a blank panel for a third of a second.
 *
 * Everything is read from the game at render time rather than remembered,
 * because the game's own settings tabs can change any of it between two
 * visits here. That is also how "In use" stays honest: it is worked out
 * afresh on every draw, from what the game has now.
 */

/** Row builders from the settings tab, so this draws like the rest of it. */
export interface PresetsTabKit {
  category(title: string, rows: HTMLElement[]): HTMLElement[];
  actionRow(label: string, controls: HTMLElement[]): HTMLElement;
  gameButton(label: string, onClick: () => void): HTMLElement;
  staticNote(text: string): HTMLElement;
}

export interface PresetsTabDeps {
  getPresets(): readonly SettingPreset[];
  savePresets(next: readonly SettingPreset[]): void;
  /** Draw the tab again, after a change. */
  refresh(): void;
}

/** How long Overwrite and Delete wait for the second click. */
const CONFIRM_MS = 3000;

export function buildPresetBlocks(kit: PresetsTabKit, deps: PresetsTabDeps): HTMLElement[] {
  const stored = storedGameSettingIds();
  return PRESET_SCOPES.flatMap((scope) => kit.category(scope.label, scopeRows(kit, deps, scope, stored)));
}

function scopeRows(
  kit: PresetsTabKit,
  deps: PresetsTabDeps,
  scope: PresetScope,
  stored: readonly string[],
): HTMLElement[] {
  const now = kit.actionRow('In game now', [
    kit.staticNote(summarisePreset(scope, capturePreset(scope, gameSetting, stored))),
  ]);
  tip(now, scope.hint);

  const presets = deps.getPresets().filter((p) => p.scope === scope.id);
  const rows = presets.map((preset) => presetRow(kit, deps, scope, preset, stored));
  if (rows.length === 0) {
    rows.push(
      kit.actionRow('No presets yet', [
        kit.staticNote(`Set your ${scope.label.toLowerCase()} in the game, then save it above`),
      ]),
    );
  }

  return [now, saveRow(kit, deps, scope), ...rows];
}

function saveRow(kit: PresetsTabKit, deps: PresetsTabDeps, scope: PresetScope): HTMLElement {
  const input = document.createElement('input');
  input.type = 'text';
  // Krunker's own text field class, the one its custom-crosshair name uses.
  input.className = 'inputGrey2 kc-preset-name';
  input.placeholder = 'Preset name';
  input.maxLength = PRESET_NAME_MAX;
  input.spellcheck = false;

  const save = (): void => {
    const all = deps.getPresets();
    const mine = all.filter((p) => p.scope === scope.id);
    if (mine.length >= PRESET_LIMIT) {
      showToast(`That is ${PRESET_LIMIT} ${scope.label} presets, delete one first`, 3000);
      return;
    }

    const name = presetName(input.value) || unusedName(scope, mine);
    if (mine.some((p) => p.name.toLowerCase() === name.toLowerCase())) {
      showToast(`There is already a ${scope.label} preset called "${name}"`, 3000);
      return;
    }

    const preset: SettingPreset = {
      id: crypto.randomUUID(),
      name,
      scope: scope.id,
      values: capturePreset(scope, gameSetting, storedGameSettingIds()),
    };
    deps.savePresets([...all, preset]);
    showToast(`Saved "${name}"`);
    deps.refresh();
  };

  // Krunker listens for keys across the whole page, and typing a name is not
  // a keybind. Escape still goes through, so it closes the window as ever.
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') return;
    e.stopPropagation();
    if (e.key === 'Enter') save();
  });
  input.addEventListener('click', (e) => e.stopPropagation());

  const row = kit.actionRow('Save current as', [input, kit.gameButton('Save', save)]);
  tip(row, `Saves the ${scope.label.toLowerCase()} the game has right now. Leave the name empty for a numbered one.`);
  return row;
}

function presetRow(
  kit: PresetsTabKit,
  deps: PresetsTabDeps,
  scope: PresetScope,
  preset: SettingPreset,
  stored: readonly string[],
): HTMLElement {
  const inUse = planPreset(scope, preset.values, gameSetting, stored).length === 0;

  const apply = (): void => {
    // Planned again rather than reusing the one above: the game's own tabs
    // may have changed something since this row was drawn.
    const writes = planPreset(scope, preset.values, gameSetting, storedGameSettingIds());
    if (!setGameSettings(writes)) {
      showToast('Krunker’s settings are not loaded yet', 3000);
      return;
    }
    showToast(`${scope.label}: ${preset.name}`);
    deps.refresh();
  };

  const overwrite = (): void => {
    const values = capturePreset(scope, gameSetting, storedGameSettingIds());
    deps.savePresets(deps.getPresets().map((p) => (p.id === preset.id ? { ...p, values } : p)));
    showToast(`Updated "${preset.name}"`);
    deps.refresh();
  };

  const remove = (): void => {
    deps.savePresets(deps.getPresets().filter((p) => p.id !== preset.id));
    showToast(`Deleted "${preset.name}"`);
    deps.refresh();
  };

  const status = inUse ? kit.staticNote('In use') : kit.gameButton('Apply', apply);
  if (inUse) status.classList.add('kc-preset-inuse');

  const update = twoStep(kit, 'Update', 'Overwrite?', overwrite);
  attachTooltip(update, `Replace this preset with the ${scope.label.toLowerCase()} the game has now.`);

  const row = kit.actionRow(preset.name, [
    kit.staticNote(summarisePreset(scope, preset.values)),
    status,
    update,
    twoStep(kit, 'Delete', 'Delete?', remove),
  ]);
  if (inUse) row.classList.add('kc-preset-on');
  return row;
}

/**
 * A button that asks once before doing something that cannot be undone.
 *
 * In place rather than a dialog: the first click turns it into the question
 * and a second click inside a few seconds answers it. A native confirm()
 * would do, but it is a window of its own over the game for a one-word
 * answer.
 */
function twoStep(kit: PresetsTabKit, label: string, question: string, onConfirm: () => void): HTMLElement {
  let armed: ReturnType<typeof setTimeout> | null = null;
  const button = kit.gameButton(label, () => {
    if (armed === null) {
      button.textContent = question;
      button.classList.add('kc-armed');
      armed = setTimeout(() => {
        armed = null;
        button.textContent = label;
        button.classList.remove('kc-armed');
      }, CONFIRM_MS);
      return;
    }
    clearTimeout(armed);
    armed = null;
    onConfirm();
  });
  return button;
}

/** "Sensitivity 1", or the first number along that is free. */
function unusedName(scope: PresetScope, mine: readonly SettingPreset[]): string {
  const taken = new Set(mine.map((p) => p.name.toLowerCase()));
  let n = mine.length + 1;
  while (taken.has(`${scope.label} ${n}`.toLowerCase())) n += 1;
  return `${scope.label} ${n}`;
}

/** Hang a hint off a row's title, the way every other row here carries one. */
function tip(row: HTMLElement, text: string): void {
  const title = row.querySelector<HTMLElement>('.setting-title');
  if (title) attachTooltip(title, text);
}
