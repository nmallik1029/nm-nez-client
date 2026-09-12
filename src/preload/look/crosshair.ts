import { KRUNKER_DOM_IDS, KRUNKER_LOOK, KRUNKER_MENU_CLASS } from '../../krunker/constants';
import { SHEETS, STYLE_IDS, UI_IDS } from '../../shared/ui';
import type { CrosshairConfig } from '../../shared/visuals';
import { defineStyle, removeStyle } from '../style';
import { paintMarker } from './paint';

/**
 * The crosshair.
 *
 * Ours, drawn into an element of ours, because Krunker's is drawn into the
 * canvas. That is worth writing down, because the DOM looks like it offers an
 * easier way and it does not: `#aimDot` is an `<img>` sitting at the centre of
 * the screen with a reticle in it and `window.updateAimDot` to point it
 * somewhere, and all of it is dead. In a live match, with the game's crosshair
 * on Dynamic, on Image, after calling updateAimDot with a URL or with a
 * built-in index, that element stays at `opacity: 0` throughout. Measured, not
 * assumed. Whatever draws the four bars you actually see is in the renderer.
 *
 * Which is also the bug this feature exists for. Krunker's Image crosshair
 * (Settings, Game, Crosshair, Type: Image) fetches a URL, and a URL from
 * Discord stops resolving when the CDN expires it, so people lose their
 * crosshair mid-match with nothing to explain it. What this draws is either
 * painted here or read off your disk once. There is nothing left to fetch.
 *
 * Since the element is ours, when it is on screen is ours to decide too:
 *
 *   on the menu          no       `.onMenu` is on `#uiBase`
 *   pointer not locked   no       a window is open, or the game menu is up
 *   scoped               no       the game's own scope has its own crosshair
 *   otherwise            yes
 *
 * All three are cheap signals: one event, and two attribute observers on one
 * element each. Nothing here runs per frame.
 */

let img: HTMLImageElement | null = null;
let current: CrosshairConfig | null = null;
let watching = false;

export function setCrosshair(config: CrosshairConfig): void {
  current = config;

  if (!config.on) {
    img?.remove();
    img = null;
    removeStyle(STYLE_IDS.crosshair);
    return;
  }

  defineStyle(STYLE_IDS.crosshair, SHEETS.crosshair);
  if (!img) {
    img = document.createElement('img');
    img.id = UI_IDS.crosshair;
    img.alt = '';
    document.body.appendChild(img);
  }

  if (config.image !== '') {
    img.src = config.image;
    img.style.width = `${config.imageSize}px`;
    // Height follows the aspect, so a crosshair that is not square is not
    // squashed into a square by the width you picked.
    img.style.height = 'auto';
  } else {
    const painted = paintMarker(config.marker);
    img.src = painted.url;
    img.style.width = `${painted.size}px`;
    img.style.height = `${painted.size}px`;
  }

  watch();
  sync();
}

/** Should it be on screen right now? */
function visible(): boolean {
  const ui = document.getElementById(KRUNKER_DOM_IDS.uiBase);
  if (ui?.classList.contains(KRUNKER_MENU_CLASS) === true) return false;
  if (document.pointerLockElement === null) return false;

  // The scope overlay, which the game fades in when you aim a sniper. It has
  // its own crosshair in the middle of it, and two of them is one too many.
  const scope = document.getElementById(KRUNKER_LOOK.scopeId);
  if (scope && Number.parseFloat(getComputedStyle(scope).opacity) > 0) return false;

  return true;
}

function sync(): void {
  if (!img) return;
  img.classList.toggle('on', current?.on === true && visible());
}

/**
 * Watch the three things that decide it, once.
 *
 * Attribute observers rather than a poll, and one element each rather than a
 * subtree, so the cost is a callback on the frames where the game actually
 * changes one of them: entering a match, opening a window, raising a scope.
 */
function watch(): void {
  if (watching) return;

  const ui = document.getElementById(KRUNKER_DOM_IDS.uiBase);
  // Both are static markup, so on the game page they are here already. If
  // they are not, this is some other page of Krunker's and trying again on
  // the next change of settings is better than latching a half-installed
  // watcher and never looking at the menu flag again.
  if (!ui) return;
  watching = true;

  document.addEventListener('pointerlockchange', sync);
  new MutationObserver(sync).observe(ui, { attributes: true, attributeFilter: ['class'] });

  const scope = document.getElementById(KRUNKER_LOOK.scopeId);
  if (scope) {
    new MutationObserver(sync).observe(scope, { attributes: true, attributeFilter: ['style'] });
  }
}
