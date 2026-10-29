import {
  describeSettings,
  KEEP_GROUPS,
  normaliseSettingsPayload,
  parseSettingsText,
  sameSettings,
  type ImportKeep,
  type SettingsPayload,
} from '../../shared/settings-import';
import {
  PROFILE_LIMIT,
  profileName,
  renameProfile,
  unusedProfileName,
  type SettingsProfile,
} from '../../shared/settings-profiles';
import { UI_IDS } from '../../shared/ui';
import { installMenuItem } from '../menu-item';
import { exportedSettings, importSettingsPayload } from '../settings/import-keep';
import { showToast } from '../toast';
import type { TabContext } from './context';
import { openPanel, togglePanel, type PanelSpec } from './panel';
import { renderPicks } from './pro-picks';
import { empty } from './row';

/**
 * The settings library: whole sets of Krunker settings to switch between,
 * from a row of its own in Krunker's left menu.
 *
 * Two tabs. Your settings are the ones saved on this PC: save what you have
 * now, or paste what someone sent you, and switch with one press. The
 * library is the team's picks, from the content file every client reads at
 * startup (shared/client-content.ts), so it grows without a release.
 *
 * Applying anything here is an import through the game's own Import, so it
 * keeps what the switches at the top say, the same switches Krunker's Import
 * popup shows. See preload/settings/import-keep.ts.
 *
 * In the QoL panel's shell rather than a window of its own, for the reason
 * that shell is shared at all: panels of ours that look alike read as one
 * client. "In use" is worked out afresh on every draw, from the game's own
 * Export, so a change made in Krunker's settings since shows up straight away.
 */

export interface LibraryDeps {
  getProfiles(): readonly SettingsProfile[];
  saveProfiles(next: readonly SettingsProfile[]): void;
  getKeep(): ImportKeep;
  setKeep(next: ImportKeep): void;
}

let deps: LibraryDeps | null = null;

const LIBRARY: PanelSpec = {
  title: 'SETTINGS LIBRARY',
  large: true,
  tabs: [
    { id: 'mine', label: 'Your settings', render: (body, ctx) => renderMine(body, ctx) },
    { id: 'team', label: 'Pro picks', render: (body, ctx) => renderTeam(body, ctx) },
  ],
};

/** Open the library, or close it if it is open. */
export function toggleSettingsLibrary(): void {
  togglePanel(LIBRARY);
}

/** Open the library, from somewhere that is not its own row: the Presets tab's pointer to it. */
export function openSettingsLibrary(): void {
  openPanel(LIBRARY);
}

/** The menu row. Registered before QoL Features, so it sits just above it. */
export function installSettingsLibrary(next: LibraryDeps): void {
  deps = next;
  installMenuItem({
    id: UI_IDS.libraryItem,
    icon: 'library_books',
    label: 'Settings Library',
    position: 'bottom',
    onClick: toggleSettingsLibrary,
  });
}

// ── Your settings ─────────────────────────────────────────────────────────

function renderMine(body: HTMLElement, ctx: TabContext): void {
  const active = deps;
  if (!active) return;
  const now = exportedSettings();

  body.append(
    keepRow(active, ctx),
    saveRow(active, ctx),
    pasteRow(active, ctx),
    uploadZone(active, ctx),
    section('Saved'),
  );

  const profiles = active.getProfiles();
  if (profiles.length === 0) {
    body.append(empty('No settings saved.'));
  } else {
    for (const profile of profiles) body.append(profileRow(active, ctx, profile, now));
  }
}

function saveRow(active: LibraryDeps, ctx: TabContext): HTMLElement {
  const name = line('Name it, or leave it for “Settings 1”', 32, () => save());
  const save = (): void => {
    const settings = normaliseSettingsPayload(exportedSettings());
    if (!settings) {
      showToast('Every setting is at its default, so there is nothing to save', 3000);
      return;
    }
    if (add(active, name.value, settings)) ctx.refresh();
  };
  return control('Save', [name, button('Save current', save)]);
}

function pasteRow(active: LibraryDeps, ctx: TabContext): HTMLElement {
  const name = line('Name', 32, () => addPasted());
  const text = line('Paste settings text', 100_000, () => addPasted());
  const addPasted = (): void => {
    const settings = normaliseSettingsPayload(parseSettingsText(text.value.trim()));
    if (!settings) {
      showToast('That is not Krunker settings text. It is what Export in Krunker’s settings gives you', 3600);
      return;
    }
    if (add(active, name.value, settings)) ctx.refresh();
  };
  return control('Paste', [name, text, button('Add', addPasted)]);
}

/**
 * A settings file, dropped or picked: what Krunker's Export saves, which is
 * `settings.txt`, or the same text in a `.json`.
 *
 * Both ways in one box, like the userscript drop: dragging is the thing worth
 * having, and a click is for when the file is behind a maximised window.
 * Several at once is fine, each one its own saved settings, named after its
 * file.
 */
function uploadZone(active: LibraryDeps, ctx: TabContext): HTMLElement {
  const zone = document.createElement('div');
  zone.className = 'drop';

  const big = document.createElement('span');
  big.className = 'big';
  big.textContent = 'Drop a settings file here';
  const small = document.createElement('span');
  small.className = 'small';
  small.textContent = 'or click to upload one';

  const picker = document.createElement('input');
  picker.type = 'file';
  picker.accept = '.txt,.json,text/plain,application/json';
  picker.multiple = true;
  picker.hidden = true;
  picker.addEventListener('change', () => {
    // Copied out before clearing: the FileList is live, and clearing empties
    // it. Cleared at all so that picking the same file again still fires.
    const chosen = [...(picker.files ?? [])];
    picker.value = '';
    void upload(chosen, active, ctx);
  });

  zone.append(big, small, picker);
  zone.addEventListener('click', () => picker.click());

  const over = (event: DragEvent): void => {
    if (!event.dataTransfer?.types.includes('Files')) return;
    // Refusing the drag here would hand the file to Chromium, which navigates
    // the page to it.
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
    zone.classList.add('over');
  };
  zone.addEventListener('dragenter', over);
  zone.addEventListener('dragover', over);
  zone.addEventListener('dragleave', (event) => {
    // Onto one of its own lines of text is not leaving it.
    const to = event.relatedTarget;
    if (to instanceof Node && zone.contains(to)) return;
    zone.classList.remove('over');
  });
  zone.addEventListener('drop', (event) => {
    event.preventDefault();
    zone.classList.remove('over');
    void upload([...(event.dataTransfer?.files ?? [])], active, ctx);
  });

  return zone;
}

/**
 * Far past a real settings file, which is a few KB. A cap so that dropping
 * the wrong file, a video say, is a message rather than the page reading it.
 */
const FILE_MAX_BYTES = 1024 * 1024;

/** Each file its own saved settings, named after it; anything that is not settings is said so. */
async function upload(files: readonly File[], active: LibraryDeps, ctx: TabContext): Promise<void> {
  if (files.length === 0) return;
  const added: string[] = [];

  for (const file of files) {
    if (file.size > FILE_MAX_BYTES) {
      showToast(`"${file.name}" is too big to be a settings file`, 3000);
      continue;
    }
    let text: string;
    try {
      text = await file.text();
    } catch {
      showToast(`Could not read "${file.name}"`, 3000);
      continue;
    }
    // Some Windows editors save with a byte order mark, which JSON will not take.
    if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);

    const settings = normaliseSettingsPayload(parseSettingsText(text.trim()));
    if (!settings) {
      showToast(`"${file.name}" is not Krunker settings. Use the file Export in Krunker’s settings saves`, 3600);
      continue;
    }

    const profiles = active.getProfiles();
    if (profiles.length >= PROFILE_LIMIT) {
      showToast(`That is ${PROFILE_LIMIT} saved settings, delete one first`, 3000);
      break;
    }
    const name = freeName(file.name.replace(/\.[^.]+$/, ''), profiles);
    active.saveProfiles([...profiles, { id: crypto.randomUUID(), name, settings, savedAt: Date.now() }]);
    added.push(name);
  }

  const first = added[0];
  if (first !== undefined) {
    showToast(added.length === 1 ? `Saved "${first}"` : `Saved ${added.length} settings files`);
  }
  // The panel may have been shut, or moved to the other tab, while files read.
  if (ctx.live()) ctx.refresh();
}

/**
 * A name for an uploaded file: its own, or with a number on the end when that
 * is taken. Every file Krunker's Export saves is called settings.txt, so a
 * second one is expected rather than refused the way a typed name is.
 */
function freeName(stem: string, profiles: readonly SettingsProfile[]): string {
  const base = profileName(stem);
  if (base === '') return unusedProfileName(profiles);
  const taken = (name: string): boolean => profiles.some((p) => p.name.toLowerCase() === name.toLowerCase());
  if (!taken(base)) return base;
  for (let n = 2; ; n++) {
    const suffix = ` ${n}`;
    const name = profileName(`${base.slice(0, 32 - suffix.length)}${suffix}`);
    if (!taken(name)) return name;
  }
}

function profileRow(
  active: LibraryDeps,
  ctx: TabContext,
  profile: SettingsProfile,
  now: SettingsPayload | null,
): HTMLElement {
  const inUse = now !== null && sameSettings(profile.settings, now, active.getKeep());
  const saved = profile.savedAt > 0 ? ` · saved ${new Date(profile.savedAt).toLocaleDateString()}` : '';

  const update = twoStep('Update', 'Overwrite?', false, () => {
    const settings = normaliseSettingsPayload(exportedSettings());
    if (!settings) {
      showToast('Every setting is at its default, so there is nothing to save', 3000);
      return;
    }
    active.saveProfiles(
      active.getProfiles().map((p) => (p.id === profile.id ? { ...p, settings, savedAt: Date.now() } : p)),
    );
    showToast(`Updated "${profile.name}"`);
    ctx.refresh();
  });
  update.title = 'Replace these with the settings you have now';

  const remove = twoStep('✕', 'Delete?', true, () => {
    active.saveProfiles(active.getProfiles().filter((p) => p.id !== profile.id));
    showToast(`Deleted "${profile.name}"`);
    ctx.refresh();
  });
  remove.title = `Delete "${profile.name}"`;

  const copyButton = button('Copy', () => copy(profile.settings));
  copyButton.title = 'Copy as settings text, for Krunker’s Import or to send to someone';

  return row({
    icon: 'bookmark',
    name: profile.name,
    sub: `${describeSettings(profile.settings)}${saved}`,
    live: inUse,
    buttons: [applyButton(ctx, profile.settings, profile.name, inUse), copyButton, update, remove],
    rename: (next, leaving) => {
      const result = renameProfile(active.getProfiles(), profile.id, next);
      if (!result.ok) {
        if (result.reason === 'taken') {
          showToast(`There are already saved settings called "${profileName(next)}"`, 3000);
          // Pressing Enter on it keeps the box open for another go. Clicking
          // away is leaving, so the old name comes back.
          if (!leaving) return false;
        }
        // Empty means "never mind", and missing means it was deleted
        // meanwhile: either way the name goes back to what it was.
        ctx.refresh();
        return true;
      }
      if (result.name !== profile.name) {
        active.saveProfiles(result.profiles);
        showToast(`Renamed to "${result.name}"`);
      }
      ctx.refresh();
      return true;
    },
  });
}

// ── The team's picks ──────────────────────────────────────────────────────

/** The team's picks, drawn by pro-picks.ts out of the pieces the two tabs share. */
function renderTeam(body: HTMLElement, ctx: TabContext): void {
  const active = deps;
  if (!active) return;
  renderPicks(body, ctx, {
    keepRow: () => keepRow(active, ctx),
    applyButton: (settings, name, inUse) => applyButton(ctx, settings, name, inUse),
    saveButton: (entry) => {
      const save = button('Save to mine', () => {
        if (add(active, entry.name, entry.settings)) ctx.refresh();
      });
      save.title = 'Copy into Your settings, to keep even if the library changes';
      return save;
    },
    getKeep: () => active.getKeep(),
  });
}

// ── Shared by both tabs ───────────────────────────────────────────────────

/**
 * The Keep switches, at the top of both tabs because they decide what every
 * Apply below them does. The same setting as the switches in Krunker's own
 * Import popup.
 */
function keepRow(active: LibraryDeps, ctx: TabContext): HTMLElement {
  const keep = active.getKeep();
  const group = document.createElement('div');
  group.className = 'seg';
  for (const choice of KEEP_GROUPS) {
    const chip = button(choice.label, () => {
      const current = active.getKeep();
      active.setKeep({ ...current, [choice.id]: !current[choice.id] });
      ctx.refresh();
    });
    if (keep[choice.id]) chip.classList.add('on');
    chip.title = `${choice.hint} On: yours stay as they are. Off: they come from what you apply.`;
    group.append(chip);
  }
  const keepLine = control('Keep my', [group]);
  keepLine.title = 'What stays yours when you apply settings, here and in Krunker’s own Import.';
  return keepLine;
}

/** Apply, or IN USE in its place when applying would change nothing. */
function applyButton(ctx: TabContext, settings: SettingsPayload, name: string, inUse: boolean): HTMLButtonElement {
  if (inUse) {
    const shown = button('In use', () => {});
    shown.className = 'sw on';
    shown.disabled = true;
    return shown;
  }
  return button('Apply', () => {
    if (!importSettingsPayload(settings)) {
      showToast('Krunker’s settings are not loaded yet', 3000);
      return;
    }
    showToast(`Settings: ${name}`);
    ctx.refresh();
  });
}

/** Save `settings` as a new profile, under `rawName` or the next free "Settings N". True if it was. */
function add(active: LibraryDeps, rawName: string, settings: SettingsPayload): boolean {
  const profiles = active.getProfiles();
  if (profiles.length >= PROFILE_LIMIT) {
    showToast(`That is ${PROFILE_LIMIT} saved settings, delete one first`, 3000);
    return false;
  }
  const name = profileName(rawName) || unusedProfileName(profiles);
  if (profiles.some((p) => p.name.toLowerCase() === name.toLowerCase())) {
    showToast(`There are already saved settings called "${name}"`, 3000);
    return false;
  }
  active.saveProfiles([...profiles, { id: crypto.randomUUID(), name, settings, savedAt: Date.now() }]);
  showToast(`Saved "${name}"`);
  return true;
}

/** Onto the clipboard as the text Krunker's Import takes. */
function copy(settings: SettingsPayload): void {
  void navigator.clipboard
    .writeText(JSON.stringify(settings))
    .then(() => showToast('Copied. Paste it into Import in Krunker’s settings'))
    .catch(() => showToast('Could not copy to the clipboard', 3000));
}

// ── Pieces, in the panel's own classes ────────────────────────────────────

/** A row in the QoL panel's style: icon, name over a line, then buttons. */
function row(spec: {
  icon: string;
  name: string;
  sub: string;
  /** Lights the icon, the way a switched-on feature's is lit. */
  live: boolean;
  buttons: HTMLElement[];
  /**
   * Makes the name editable in place. Handed the name as typed, and whether
   * the box is being left (clicked away from) rather than submitted. True
   * when it is done with, false to keep the box open for another go.
   */
  rename?: (next: string, leaving: boolean) => boolean;
}): HTMLElement {
  const el = document.createElement('div');
  el.className = spec.live ? 'row live' : 'row';
  const glyph = document.createElement('span');
  glyph.className = 'material-icons ico';
  glyph.textContent = spec.icon;
  const text = document.createElement('div');
  text.className = 'txt';
  const name = document.createElement('div');
  name.className = 'nm';
  name.textContent = spec.name;
  name.title = spec.name;
  const sub = document.createElement('div');
  sub.className = 'sub';
  sub.textContent = spec.sub;

  const rename = spec.rename;
  if (rename) {
    const head = document.createElement('div');
    head.className = 'nm-line';
    const pencil = document.createElement('button');
    pencil.className = 'rename-btn material-icons';
    pencil.textContent = 'edit';
    pencil.title = 'Rename';
    const edit = (): void => startRename(head, spec.name, rename);
    pencil.addEventListener('click', edit);
    name.title = `${spec.name} (click to rename)`;
    name.classList.add('renamable');
    name.addEventListener('click', edit);
    head.append(name, pencil);
    text.append(head, sub);
  } else {
    text.append(name, sub);
  }

  el.append(glyph, text, ...spec.buttons);
  return el;
}

/**
 * Swap a row's name for a box to type a new one in.
 *
 * Enter or clicking away saves it, which is what renaming a file does
 * everywhere else. Escape is the panel's: it closes the panel before the box
 * hears it, and the name stays as it was. Keys are kept from the game, which
 * listens for its binds across the whole page.
 */
function startRename(
  head: HTMLElement,
  current: string,
  rename: (next: string, leaving: boolean) => boolean,
): void {
  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'rename';
  input.value = current;
  input.maxLength = 32;
  input.spellcheck = false;
  input.autocomplete = 'off';
  for (const type of ['keydown', 'keyup', 'keypress'] as const) {
    input.addEventListener(type, (event) => event.stopPropagation());
  }

  let done = false;
  const commit = (leaving: boolean): void => {
    if (done) return;
    // Before the rename rather than after: renaming redraws the row, and the
    // box going with it can fire its blur, which would rename a second time.
    done = true;
    if (rename(input.value, leaving)) return;
    // Kept open for another go, with what was typed still there.
    done = false;
    input.select();
  };
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') commit(false);
  });
  input.addEventListener('blur', () => commit(true));

  head.replaceChildren(input);
  input.focus();
  input.select();
}

/** A labelled line of controls, the editors' `.ctl`. */
function control(label: string, children: HTMLElement[]): HTMLElement {
  const el = document.createElement('div');
  el.className = 'ctl';
  const lbl = document.createElement('span');
  lbl.className = 'lbl';
  lbl.textContent = label;
  el.append(lbl, ...children);
  return el;
}

function section(text: string): HTMLElement {
  const el = document.createElement('div');
  el.className = 'sect';
  el.textContent = text;
  return el;
}

function button(label: string, onClick: () => void): HTMLButtonElement {
  const el = document.createElement('button');
  el.textContent = label;
  el.addEventListener('click', onClick);
  return el;
}

/**
 * A text box the game's key listeners leave alone, since Krunker listens for
 * its binds across the whole page. Escape still closes the panel: the panel
 * catches it on the way down, before it reaches here.
 */
function line(placeholder: string, maxLength: number, onEnter: () => void): HTMLInputElement {
  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'line';
  input.placeholder = placeholder;
  input.maxLength = maxLength;
  input.spellcheck = false;
  input.autocomplete = 'off';
  for (const type of ['keydown', 'keyup', 'keypress'] as const) {
    input.addEventListener(type, (event) => event.stopPropagation());
  }
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') onEnter();
  });
  return input;
}

/** How long Update and Delete wait for the second click. */
const CONFIRM_MS = 3000;

/**
 * A button that asks once before it does something that cannot be undone,
 * the same way the userscript delete does: the first click turns it into the
 * question, a second click inside a few seconds answers it.
 */
function twoStep(label: string, question: string, danger: boolean, onConfirm: () => void): HTMLButtonElement {
  let armed: ReturnType<typeof setTimeout> | null = null;
  const el = button(label, () => {
    if (armed === null) {
      el.textContent = question;
      el.classList.add('armed');
      armed = setTimeout(() => {
        armed = null;
        el.textContent = label;
        el.classList.remove('armed');
      }, CONFIRM_MS);
      return;
    }
    clearTimeout(armed);
    armed = null;
    onConfirm();
  });
  if (danger) el.className = 'del';
  return el;
}
