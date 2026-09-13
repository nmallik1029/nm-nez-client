import { SHEETS, STYLE_IDS, UI_IDS } from '../../shared/ui';
import type { HitmarkerConfig } from '../../shared/visuals';
import { defineStyle, removeStyle } from '../style';
import { HIT_SOUNDS, onGameSound } from './game-sound';
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

/**
 * How long it stays up.
 *
 * Krunker's own is around a fifth of a second with a fade on the end of it.
 * Long enough to register out of the corner of your eye, short enough that
 * two hits in quick succession read as two.
 */
const SHOW_MS = 240;

let img: HTMLImageElement | null = null;
let current: HitmarkerConfig | null = null;
let hideTimer: ReturnType<typeof setTimeout> | null = null;
/** Subscribed to the game's sounds; done once, the first time this is on. */
let listening = false;

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

  if (!listening) {
    listening = true;
    onGameSound((name) => {
      if (HIT_SOUNDS.has(name)) flash();
    });
  }
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
