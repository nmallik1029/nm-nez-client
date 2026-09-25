import {
  fortniteSoundFor,
  fortniteVolume,
  KRUNKER_SOUND_BASE,
  type FortniteConfig,
} from '../../shared/soundpacks';

/**
 * The two things the Fortnite pack cannot do over the network alone: beat a
 * mod to a sound, and be louder or quieter than Krunker's own.
 *
 * MODS. A mod is a zip, and for each `sound/<key>.mp3` in it the game reads
 * the file out, makes a `blob:` URL and calls `SOUND.updateSound(key, url)`,
 * which rebuilds that sound's three Howls (`key`, `key3d`, `key3dv`) from it.
 * A blob URL is made in the page and never goes near the network, so
 * `onBeforeRequest` cannot see it and the swap main does for Krunker's own
 * sounds has nothing to answer. Whichever of the two ran last wins, and the
 * mod loads after the sounds do, so the mod won.
 *
 * `updateSound` is also the way back in. A sound the pack owns is sent
 * through it at Krunker's own address instead of the mod's blob, which puts
 * the question back to main's request filter, the one place that already
 * knows whether the pack is on and installed. So the pack wins over the mod
 * while it is on, the mod keeps every sound the pack does not replace, and
 * with the pack off or gone the worst case is Krunker's own sound rather than
 * a URL that 404s into silence.
 *
 * Going through `updateSound` rather than playing the sound ourselves is what
 * keeps it a Krunker sound: the 3D Howls are built with it, so everyone
 * else's shots stay placed in the world and fall off with distance. Playing
 * it on top, the way the kill streak announcer does, would put every gun in
 * the match flat in your ears.
 *
 * VOLUME. `play(name, volume, ...)` works out `(volume || 1) * getVolume(name)`,
 * so the second argument is a multiplier over the game's own category volume.
 * Scaling it leaves the category volume, the 3D placement and the falloff
 * alone, which a volume set on the Howl would not.
 *
 * Both wrappers call the original every time and neither is ever removed:
 * this is the path that makes the sounds you hear. See `game-sound.ts`, which
 * wraps `play` to listen rather than to change it.
 */

/** The sound manager only exists once the game has booted. See `game-sound.ts`. */
const HOOK_RETRY_MS = 2000;
const HOOK_ATTEMPTS = 60;

interface SoundManager {
  play: (name: string, ...rest: unknown[]) => unknown;
  updateSound?: (key: string, url: string) => unknown;
}

type Patched<T> = T & { __nmFortnite?: boolean };

let read: (() => FortniteConfig) | null = null;
let hooked = false;
let attempts = 0;
let retryTimer: ReturnType<typeof setInterval> | null = null;

/** Where Krunker would have loaded one of its own sounds from. */
function krunkerSoundUrl(key: string): string {
  return `${KRUNKER_SOUND_BASE}${key}.mp3`;
}

/**
 * Take over the sound manager. `config` is read per call, so switching the
 * pack on or off, or moving the volume, takes effect on the next sound
 * without anything being rehooked.
 */
export function installFortniteSound(config: () => FortniteConfig): void {
  read = config;
  hook();
}

function hook(): void {
  if (hooked) return;

  const sound = (window as unknown as { SOUND?: SoundManager }).SOUND;
  if (!sound || typeof sound.play !== 'function') {
    attempts += 1;
    if (attempts >= HOOK_ATTEMPTS) {
      stopRetrying();
      return;
    }
    if (retryTimer === null) retryTimer = setInterval(hook, HOOK_RETRY_MS);
    return;
  }

  wrapUpdateSound(sound);
  wrapPlay(sound);
  hooked = true;
  stopRetrying();
}

/** A mod's sound for a key the pack owns, pointed back at Krunker's own address. */
function wrapUpdateSound(sound: SoundManager): void {
  const original: Patched<NonNullable<SoundManager['updateSound']>> | undefined = sound.updateSound;
  // Older builds without it: the pack still wins everywhere a mod is not
  // involved, which is what it did before this file existed.
  if (typeof original !== 'function' || original.__nmFortnite === true) return;

  const wrapped: Patched<NonNullable<SoundManager['updateSound']>> = function (
    this: unknown,
    key: string,
    url: string,
  ): unknown {
    let next = url;
    try {
      const config = read?.();
      if (config && fortniteSoundFor(key, config) !== null) next = krunkerSoundUrl(key);
    } catch {
      // A sound the mod asked for is better than no sound at all.
    }
    return original.call(this, key, next);
  };
  wrapped.__nmFortnite = true;
  sound.updateSound = wrapped;
}

/** The pack's own sounds, scaled against Krunker's. */
function wrapPlay(sound: SoundManager): void {
  const original: Patched<SoundManager['play']> = sound.play;
  if (original.__nmFortnite === true) return;

  const wrapped: Patched<SoundManager['play']> = function (
    this: unknown,
    name: string,
    ...rest: unknown[]
  ): unknown {
    try {
      const config = read?.();
      if (config) {
        const volume = fortniteVolume(name, config, rest[0]);
        if (volume !== null) return original.call(this, name, volume, ...rest.slice(1));
      }
    } catch {
      // Never cost someone a sound over how loud it was going to be.
    }
    return original.call(this, name, ...rest);
  };
  wrapped.__nmFortnite = true;
  sound.play = wrapped;
}

function stopRetrying(): void {
  if (retryTimer === null) return;
  clearInterval(retryTimer);
  retryTimer = null;
}
