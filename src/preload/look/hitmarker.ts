import { SHEETS, STYLE_IDS, UI_IDS } from '../../shared/ui';
import type { HitmarkerConfig } from '../../shared/visuals';
import { defineStyle, removeStyle } from '../style';
import { paintMarker } from './paint';

/**
 * The hitmarker.
 *
 * The hard part of a hitmarker is not drawing it, it is knowing when. Krunker
 * has an `<img id="hitmarker">` sitting at the centre of the screen, and the
 * obvious client trick is to swap what it shows and let the game flip its
 * `display`. That element is not trustworthy: its neighbour `#aimDot` looks
 * exactly as alive and is completely dead (see KRUNKER_LOOK), and across a
 * long spray in a live match nothing ever touched it. It may well still work.
 * Nothing here needs to know.
 *
 * What the game definitely does is play a sound. `window.SOUND.play(name)` is
 * its own audio manager, `SOUND.soundCats` lists `hit_0`, `headshot_0` and
 * `instantkill_0` among the names, and the built-in headshot script has
 * relied on that same function for months. So the hit signal is the hit
 * sound: it fires on the frame the game decides you connected, it cannot
 * drift from what you hear, and it survives any amount of HUD rewriting.
 *
 * Everything after that is ours: our element, our size, our offset, and a
 * quarter of a second on screen.
 */

/** The sounds Krunker plays when a shot of yours lands. */
const HIT_SOUNDS: ReadonlySet<string> = new Set(['hit_0', 'headshot_0', 'instantkill_0']);

/**
 * How long it stays up.
 *
 * Krunker's own is around a fifth of a second with a fade on the end of it.
 * Long enough to register out of the corner of your eye, short enough that
 * two hits in quick succession read as two.
 */
const SHOW_MS = 240;

/** The sound manager only exists once the game has booted. */
const HOOK_RETRY_MS = 2000;
/**
 * How many times to look for it before giving up.
 *
 * Two minutes. The preload also runs on Krunker's other pages, and social.html
 * has no sound manager and never will, so something has to stop asking.
 */
const HOOK_ATTEMPTS = 60;

interface SoundManager {
  play: (name: string, ...rest: unknown[]) => unknown;
}

let img: HTMLImageElement | null = null;
let current: HitmarkerConfig | null = null;
let hideTimer: ReturnType<typeof setTimeout> | null = null;
let retryTimer: ReturnType<typeof setInterval> | null = null;
let hooked = false;
let attempts = 0;

export function setHitmarker(config: HitmarkerConfig): void {
  current = config;

  if (!config.on) {
    img?.remove();
    img = null;
    removeStyle(STYLE_IDS.hitmarker);
    return;
  }

  defineStyle(STYLE_IDS.hitmarker, SHEETS.hitmarker);
  if (!img) {
    img = document.createElement('img');
    img.id = UI_IDS.hitmarker;
    img.alt = '';
    document.body.appendChild(img);
  }

  if (config.image !== '') {
    img.src = config.image;
    img.style.width = `${config.imageSize}px`;
    img.style.height = 'auto';
  } else {
    const painted = paintMarker(config.marker);
    img.src = painted.url;
    img.style.width = `${painted.size}px`;
    img.style.height = `${painted.size}px`;
  }

  // Offsets go on the transform beside the centring, so the two cannot
  // disagree about where the middle of the screen is.
  img.style.transform = `translate(calc(-50% + ${config.offsetX}px), calc(-50% + ${config.offsetY}px))`;

  hookSound();
}

/** Put it on screen for a moment. Called for each hit. */
function flash(): void {
  if (!img || current?.on !== true) return;

  img.classList.add('on');
  if (hideTimer !== null) clearTimeout(hideTimer);
  hideTimer = setTimeout(() => {
    hideTimer = null;
    img?.classList.remove('on');
  }, SHOW_MS);
}

/**
 * Wrap the game's sound manager.
 *
 * Wrapped rather than replaced, and the original is always called: this hook
 * is on the path that makes the hit sound you hear, so anything it swallows
 * or throws is audible. The built-in headshot script wraps the same function,
 * and two wrappers compose without either one knowing about the other.
 */
function hookSound(): void {
  if (hooked) return;

  const sound = (window as unknown as { SOUND?: SoundManager }).SOUND;
  if (!sound || typeof sound.play !== 'function') {
    // The manager arrives with the game, a few seconds after the page.
    attempts += 1;
    if (attempts >= HOOK_ATTEMPTS) {
      stopRetrying();
      return;
    }
    if (retryTimer === null) retryTimer = setInterval(hookSound, HOOK_RETRY_MS);
    return;
  }

  const original = sound.play.bind(sound);
  sound.play = function patched(name: string, ...rest: unknown[]): unknown {
    if (HIT_SOUNDS.has(name)) flash();
    return original(name, ...rest);
  };

  hooked = true;
  stopRetrying();
}

function stopRetrying(): void {
  if (retryTimer === null) return;
  clearInterval(retryTimer);
  retryTimer = null;
}
