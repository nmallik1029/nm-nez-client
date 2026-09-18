import { KRUNKER_HOST, KRUNKER_LOOK, KRUNKER_SETTINGS } from '../../krunker/constants';

/**
 * Krunker's own settings, read and written the way its settings window does.
 *
 * Two of them matter here: the game draws its own crosshair and its own
 * hitmarker, and ours are drawn over the top, so unless the game's are off
 * there are two of each on screen. The QoL editors offer a switch for that.
 *
 * An offer, not a decision. These are the player's own game settings, and a
 * client that quietly rewrites the settings you set inside the game is a
 * client you cannot trust with the others. Every write here is one somebody
 * pressed a button for.
 *
 * `setSetting` is the game's own function, the same one the tournament host
 * flow uses for the region. There is no getter to go with it, so values are
 * read back out of the localStorage key each one lands in.
 */

/** What the game has this setting at, or null if it has never been changed. */
export function gameSetting(key: string): string | null {
  try {
    return window.localStorage.getItem(`${KRUNKER_LOOK.settingKeyPrefix}${key}`);
  } catch {
    return null;
  }
}

/** Write one. Returns false when the game has no `setSetting` to call. */
export function setGameSetting(key: string, value: string | boolean): boolean {
  const write = (window as unknown as Record<string, unknown>)[KRUNKER_HOST.setSetting];
  if (typeof write !== 'function') return false;

  try {
    (write as (key: string, value: string | boolean) => void)(key, value);
    return true;
  } catch {
    return false;
  }
}

/** Every setting the game has stored, by id, prefix taken off. */
export function storedGameSettingIds(): string[] {
  const prefix = KRUNKER_LOOK.settingKeyPrefix;
  const ids: string[] = [];
  try {
    const storage = window.localStorage;
    for (let i = 0; i < storage.length; i++) {
      const key = storage.key(i);
      if (key?.startsWith(prefix)) ids.push(key.slice(prefix.length));
    }
  } catch {
    // Storage blocked; nothing is stored as far as anyone here can tell.
  }
  return ids;
}

/**
 * Write several at once, which is how a preset lands.
 *
 * Each write passes `keepPreset`, and the game's preset picker is moved to
 * Custom once at the end instead. Left to itself `setSetting` does that
 * switch on every write, and the switch rebuilds the settings window, which
 * is where the Presets tab is sitting. See KRUNKER_SETTINGS for the detail.
 *
 * Returns false when the game has no `setSetting` yet, or a write threw.
 */
export function setGameSettings(writes: readonly (readonly [string, string])[]): boolean {
  const page = window as unknown as Record<string, unknown>;
  const write = page[KRUNKER_HOST.setSetting];
  if (typeof write !== 'function') return false;
  if (writes.length === 0) return true;

  try {
    for (const [key, value] of writes) {
      (write as (key: string, value: string, keepPreset: boolean) => void)(key, value, true);
    }
  } catch {
    return false;
  }

  // Cosmetic if it fails: the settings are already written, only the game's
  // own picker is left naming a preset they no longer match.
  const pick = page[KRUNKER_SETTINGS.presetPicker];
  if (typeof pick === 'function') {
    try {
      (pick as (index: number, skipLoad: boolean, quiet: boolean) => void)(
        KRUNKER_SETTINGS.customPreset,
        true,
        true,
      );
    } catch {
      // See above.
    }
  }
  return true;
}

/** Is Krunker drawing its own crosshair? A missing key means the default. */
export function gameCrosshairIsOff(): boolean {
  return (
    (gameSetting(KRUNKER_LOOK.crosshairSetting) ?? KRUNKER_LOOK.crosshairDefault) ===
    KRUNKER_LOOK.crosshairOff
  );
}

export function setGameCrosshairOff(off: boolean): boolean {
  return setGameSetting(
    KRUNKER_LOOK.crosshairSetting,
    off ? KRUNKER_LOOK.crosshairOff : KRUNKER_LOOK.crosshairDefault,
  );
}

/** Is Krunker drawing its own hitmarker? This one is a plain on/off. */
export function gameHitmarkerIsOff(): boolean {
  return gameSetting(KRUNKER_LOOK.hitmarkerSetting) === 'false';
}

export function setGameHitmarkerOff(off: boolean): boolean {
  return setGameSetting(KRUNKER_LOOK.hitmarkerSetting, !off);
}
