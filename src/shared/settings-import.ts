import { KRUNKER_IMPORT } from '../krunker/constants';

/**
 * Importing Krunker settings without losing the ones you meant to keep.
 *
 * Krunker's Import sets every setting it has to what the text says, and every
 * one the text leaves out back to its default (see KRUNKER_IMPORT). Paste a
 * friend's settings to try their graphics and you get their sensitivity,
 * their volumes and their keybinds too, with your own gone. So the client
 * offers to keep three groups through an import: sensitivity, sounds and
 * keybinds. They start kept, since that is nearly always what someone
 * importing wants.
 *
 * Keeping works on the text, before the game reads it, which makes it the
 * game's own import doing the work with every check it already has. A kept
 * setting gets its current value written in; keybinds are taken out, because
 * an import without them leaves them alone.
 *
 * The same text is what the settings library saves and applies, so these
 * rules cover both: applying a saved profile is an import.
 *
 * Pure, so the rules are testable without a game.
 */

export type KeepGroup = 'sensitivity' | 'sounds' | 'keybinds';

export interface ImportKeep {
  readonly sensitivity: boolean;
  readonly sounds: boolean;
  readonly keybinds: boolean;
}

export const DEFAULT_IMPORT_KEEP: ImportKeep = { sensitivity: true, sounds: true, keybinds: true };

export const KEEP_GROUPS: readonly { readonly id: KeepGroup; readonly label: string; readonly hint: string }[] = [
  {
    id: 'sensitivity',
    label: 'Sensitivity',
    hint: 'Hip fire and ADS sensitivity, per weapon too, and whether they are per weapon at all.',
  },
  {
    id: 'sounds',
    label: 'Sounds',
    hint: 'Everything in Krunker’s Audio settings: the master volume, every other volume, and the microphone and voice chat options.',
  },
  {
    id: 'keybinds',
    label: 'Keybinds',
    hint: 'Every key you have bound in Controls, and your chat messages.',
  },
];

/** Settings, as Krunker's Export writes them: setting id to value, plus `controls` and `customize`. */
export type SettingsPayload = Readonly<Record<string, unknown>>;

/** What the game has stored for a setting id, or null for nothing. */
export type ReadStored = (id: string) => string | null;

/** Whatever came out of config, as a full set of switches. Anything unclear stays kept. */
export function normaliseImportKeep(raw: unknown): ImportKeep {
  const value = isPlainObject(raw) ? raw : {};
  const pick = (key: KeepGroup): boolean =>
    typeof value[key] === 'boolean' ? value[key] : DEFAULT_IMPORT_KEEP[key];
  return { sensitivity: pick('sensitivity'), sounds: pick('sounds'), keybinds: pick('keybinds') };
}

/**
 * Which of the groups that are plain settings this id belongs to, or null.
 * Keybinds are not here: they are one nested `controls` entry, not ids.
 */
export function keepGroupOf(id: string): Exclude<KeepGroup, 'keybinds'> | null {
  if (KRUNKER_IMPORT.sensitivityPattern.test(id) || id === KRUNKER_IMPORT.sensitivityModeKey) {
    return 'sensitivity';
  }
  if ((KRUNKER_IMPORT.audio as readonly string[]).includes(id)) return 'sounds';
  return null;
}

/** The text in Krunker's import box, as an object, or null when it is not one. */
export function parseSettingsText(text: string): Record<string, unknown> | null {
  try {
    const parsed: unknown = JSON.parse(text);
    return isPlainObject(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * The text an import should be given, so the kept groups come out as they are.
 *
 * A kept setting gets the value the game has stored for it written in. With
 * nothing stored the game has it at its default, which is also what an import
 * does with a setting it is not given, so that one is taken out instead. Ids
 * are taken from the text and from storage both: a kept setting the text does
 * not mention would otherwise be reset to its default.
 *
 * Returns a copy; the payload handed in is not touched.
 */
export function keepCurrent(
  payload: SettingsPayload,
  keep: ImportKeep,
  read: ReadStored,
  storedIds: Iterable<string>,
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...payload };
  if (keep.keybinds) delete out[KRUNKER_IMPORT.controlsKey];
  if (!keep.sensitivity && !keep.sounds) return out;

  for (const id of new Set([...Object.keys(out), ...storedIds])) {
    const group = keepGroupOf(id);
    if (group === null || !keep[group]) continue;
    const current = read(id);
    // The game reads the literal 'undefined' as missing too.
    if (current === null || current === 'undefined') delete out[id];
    else out[id] = current;
  }
  return out;
}

/** Longest a single value can be. Custom crosshair and scope settings hold image URLs. */
const MAX_VALUE_CHARS = 2048;
/** Every setting the game has with every per-weapon copy is a few hundred; this is room to spare. */
const MAX_SETTINGS = 2000;
/** A full set of keybinds and chat messages is a few KB. */
const MAX_CONTROLS_CHARS = 64_000;
/**
 * A setting id as the game writes them. Starts with a letter, which also keeps
 * `__proto__` from ever being assigned as a key.
 */
const SETTING_ID = /^[A-Za-z][A-Za-z0-9_]{0,63}$/;

/**
 * Settings text fit to save in the library and hand back to the game.
 *
 * Where it comes from decides nothing: Export, a paste, the client's online
 * library or a hand-edited config. All of it ends up in the game's import, so
 * every value has to be a plain one of the kinds the game stores.
 *
 * `customize` is always dropped. It is loadouts, custom reticles and images,
 * and favourites, which are not settings: applying someone's settings should
 * never swap out your loadouts. `controls` is kept when it is a plain object
 * of a sensible size; the game checks every bind in it itself.
 *
 * Null when there is nothing usable, so an empty object never becomes a
 * profile that resets everything.
 */
export function normaliseSettingsPayload(raw: unknown): Record<string, unknown> | null {
  if (!isPlainObject(raw)) return null;

  const out: Record<string, unknown> = {};
  let settings = 0;
  for (const [key, value] of Object.entries(raw)) {
    if (key === KRUNKER_IMPORT.customizeKey) continue;
    if (key === KRUNKER_IMPORT.controlsKey) {
      if (isPlainObject(value) && jsonLength(value) <= MAX_CONTROLS_CHARS) out[key] = value;
      continue;
    }
    if (!SETTING_ID.test(key) || settings >= MAX_SETTINGS) continue;
    if (
      typeof value === 'boolean' ||
      (typeof value === 'number' && Number.isFinite(value)) ||
      (typeof value === 'string' && value.length <= MAX_VALUE_CHARS)
    ) {
      out[key] = value;
      settings += 1;
    }
  }
  return Object.keys(out).length > 0 ? out : null;
}

/**
 * Would importing `a` leave the game where `b` already has it?
 *
 * What "In use" is worked out from, comparing a saved profile against the
 * game's own Export of what it has now. The kept groups are left out of it,
 * because an import would not change them either; so is `customize`, which
 * the library never applies.
 *
 * Values are compared as the game would see them: `true` and `'true'`, `1`
 * and `'1.0'`, are the same setting.
 */
export function sameSettings(a: SettingsPayload, b: SettingsPayload, keep: ImportKeep): boolean {
  for (const id of new Set([...Object.keys(a), ...Object.keys(b)])) {
    if (id === KRUNKER_IMPORT.customizeKey) continue;
    if (id === KRUNKER_IMPORT.controlsKey) {
      if (!keep.keybinds && jsonText(a[id]) !== jsonText(b[id])) return false;
      continue;
    }
    const group = keepGroupOf(id);
    if (group !== null && keep[group]) continue;
    if (!sameValue(a[id], b[id])) return false;
  }
  return true;
}

/** One line saying what a payload holds, e.g. "84 settings · keybinds". */
export function describeSettings(payload: SettingsPayload): string {
  const count = Object.keys(payload).filter(
    (id) => id !== KRUNKER_IMPORT.controlsKey && id !== KRUNKER_IMPORT.customizeKey,
  ).length;
  const parts = [count === 1 ? '1 setting' : `${count} settings`];
  if (isPlainObject(payload[KRUNKER_IMPORT.controlsKey])) parts.push('keybinds');
  return parts.join(' · ');
}

function sameValue(a: unknown, b: unknown): boolean {
  if (a === undefined || b === undefined) return a === b;
  const x = plainText(a);
  const y = plainText(b);
  // Not a plain value on one side or the other: the same only if identical.
  if (x === null || y === null) return jsonText(a) === jsonText(b);
  if (x === y) return true;
  if (x.trim() === '' || y.trim() === '') return false;
  const nx = Number(x);
  const ny = Number(y);
  return Number.isFinite(nx) && Number.isFinite(ny) && nx === ny;
}

/** A plain value as the game stores it, a string, or null for anything else. */
function plainText(value: unknown): string | null {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return null;
}

function jsonText(value: unknown): string {
  try {
    return JSON.stringify(value) ?? '';
  } catch {
    return '';
  }
}

function jsonLength(value: unknown): number {
  const text = jsonText(value);
  return text === '' ? Number.POSITIVE_INFINITY : text.length;
}

export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
