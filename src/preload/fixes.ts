import type { FixConfig } from '../shared/config';

/** Workarounds for Chromium and Krunker behaviour, all renderer-side. */

/** Stylesheets go on documentElement so they land before <head> exists. */
function attachStyle(style: HTMLStyleElement): void {
  const attach = (): void => {
    document.documentElement.appendChild(style);
  };
  if (document.documentElement) attach();
  else document.addEventListener('DOMContentLoaded', attach, { once: true });
}

/**
 * Stop a scroll gesture from collapsing the framerate.
 *
 * Chromium paces frame production to vsync for the length of a wheel gesture.
 * With the frame-rate limit off, an uncapped 1000 FPS drops to the display
 * refresh the moment the wheel moves. In-game the wheel is the weapon switch,
 * so that lands mid-fight.
 *
 * Menus still have to scroll, so the handler looks for a scrollable ancestor
 * first. That walk calls getComputedStyle, which forces style resolution, so
 * skip it while the pointer is locked: locked means we're in the game, where
 * nothing scrolls anyway.
 */
export function installScrollFramePacingFix(): void {
  window.addEventListener(
    'wheel',
    (event: WheelEvent) => {
      if (document.pointerLockElement) {
        event.preventDefault();
        return;
      }

      let el = event.target as HTMLElement | null;
      while (el && el !== document.body && el !== document.documentElement) {
        const style = getComputedStyle(el);
        const scrollsY =
          (style.overflowY === 'auto' || style.overflowY === 'scroll') &&
          el.scrollHeight > el.clientHeight;
        const scrollsX =
          (style.overflowX === 'auto' || style.overflowX === 'scroll') &&
          el.scrollWidth > el.clientWidth;
        if (scrollsY || scrollsX) return;
        el = el.parentElement;
      }

      event.preventDefault();
    },
    { capture: true, passive: false },
  );
}

/**
 * Krunker binds Escape to its own menu and swallows the event, so the cursor
 * stays captured and you can't leave the window with the keyboard. Capture
 * phase gets there before the game's listener.
 */
export function installEscapePointerLockFix(): void {
  document.addEventListener(
    'keydown',
    (event: KeyboardEvent) => {
      if (event.key === 'Escape' && document.pointerLockElement) {
        document.exitPointerLock();
      }
    },
    { capture: true },
  );
}

let rawInputEnabled = false;

/**
 * Ask pointer lock for raw, unaccelerated mouse deltas.
 *
 * This is the aim *flick*, which is not the same bug as the aim *freeze* the
 * patched Electron build fixes. Patching the binary does nothing for it.
 *
 * Pointer lock's movementX/movementY are OS-adjusted by default. On Windows
 * that bakes in pointer ballistics ("Enhance pointer precision"), a non-linear
 * curve that multiplies a fast movement much more than a slow one. Tracking a
 * walking target feels fine and then a flick sails past. unadjustedMovement
 * asks for the sensor deltas instead, so sensitivity is 1:1 at any speed.
 *
 * Has to wrap the method rather than request once, because Krunker takes the
 * lock itself on every respawn and every click back into the game. Assigning
 * to HTMLCanvasElement.prototype shadows the inherited Element method for
 * canvases only, which is all Krunker ever locks.
 */
export function installRawInputHook(enabled: boolean): void {
  rawInputEnabled = enabled;

  // unbound-method fires on detaching a prototype method from its object,
  // which is exactly what wrapping one involves. Every call below goes through
  // .call(this, ...), so the receiver is never lost.
  // eslint-disable-next-line @typescript-eslint/unbound-method
  const original = HTMLCanvasElement.prototype.requestPointerLock;

  HTMLCanvasElement.prototype.requestPointerLock = function (
    this: HTMLCanvasElement,
    options?: PointerLockOptions,
  ): Promise<void> {
    if (!rawInputEnabled) return original.call(this, options);

    // Chromium *rejects* when the platform can't supply unadjusted movement
    // instead of falling back on its own. Drop this catch and the lock never
    // engages at all.
    return original
      .call(this, { ...options, unadjustedMovement: true })
      .catch(() => original.call(this, options));
  };
}

/**
 * Takes effect on the next pointer-lock request (Escape, then click back in).
 * A lock that's already held keeps whatever mode it was granted with.
 */
export function setRawInput(enabled: boolean): void {
  rawInputEnabled = enabled;
}

let adStyle: HTMLStyleElement | null = null;

/** Hide the ad slots the network blocker leaves behind. CSS only, so it toggles live. */
export function setAdContainerHiding(enabled: boolean): void {
  if (!enabled) {
    adStyle?.remove();
    adStyle = null;
    return;
  }
  if (adStyle?.isConnected) return;

  const style = document.createElement('style');
  adStyle = style;
  style.id = 'kc-hide-ads';
  style.textContent = [
    '#aHolder, #adCon, #endAHolder, #menuAdHolder,',
    '#tmpAdHolder, #adNoticeMain, #onetrust-consent-sdk,',
    '.adHolder, .endAHolder, .promoDisp { display: none !important; }',
    // Reclaim the space too, or the menu keeps a hole where the ad was.
    '#menuItemContainer { margin-top: 0 !important; }',
  ].join('\n');
  attachStyle(style);
}

let layoutStyle: HTMLStyleElement | null = null;

/**
 * Keep the five play buttons on one row.
 *
 * #subLogoButtons is display:block with inline-block children, so they wrap
 * like words once their combined width beats the container, and "Custom Games"
 * ends up alone on a second line at most window sizes. nowrap stops the break;
 * the match info above goes back to normal because it's prose and should wrap.
 * Padding comes down a touch so the row still fits once it can't break.
 */
export function installPlayRowFix(): void {
  if (layoutStyle?.isConnected) return;
  const style = document.createElement('style');
  layoutStyle = style;
  style.id = 'kc-play-row';
  style.textContent = [
    '#subLogoButtons { white-space: nowrap !important; }',
    '#matchInfoHolder { white-space: normal !important; }',
    '#menuBtnQuickMatch, #menuBtnRanked, #menuBtnHost,',
    '#menuBtnBrowser, #menuBtnCustomGames {',
    '  padding-left: 14px !important; padding-right: 14px !important;',
    '  vertical-align: top !important;',
    '}',
  ].join('\n');
  attachStyle(style);
}

let promoStyle: HTMLStyleElement | null = null;

/**
 * Hide the game promoting itself: battle pass and daily spin rows, the Twitch
 * drops overlay, the two top-corner slots things rotate into. None of this is
 * a third-party ad, so the network blocker never sees it.
 *
 * Selectors match the stable fragment of each class, not the whole thing.
 * Krunker's menu is Svelte-compiled and every class carries a build hash
 * ("bpItem svelte-159x57l"), so matching the hash breaks on their next deploy.
 * Ids have no hash and are matched exactly.
 *
 * !important everywhere because these carry inline and component styles a
 * plain rule loses to.
 */
export function setMenuPromoHiding(enabled: boolean): void {
  if (!enabled) {
    promoStyle?.remove();
    promoStyle = null;
    return;
  }
  if (promoStyle?.isConnected) return;

  const style = document.createElement('style');
  promoStyle = style;
  style.id = 'kc-hide-promos';
  style.textContent = [
    // Battle pass and daily spin, above the left menu list.
    '[class*="bpItem"], [class*="dsItem"],',
    // "Live Streams / DROPS AVAILABLE", top right.
    '[class*="streams-overlay"],',
    // Despite the name, topLeftAdHolder renders on the right in the current
    // layout. Both are hidden so it doesn't matter which is which.
    '#topLeftAdHolder, #topRightAdHolder { display: none !important; }',
  ].join('\n');
  attachStyle(style);
}

/**
 * The two event hooks can't be uninstalled once they're on, since they wrap
 * page events ahead of Krunker's own handlers, so config decides at install
 * time. Anything that's only CSS stays toggleable afterwards.
 */
export function installFixes(
  fixes: FixConfig,
  hideAdContainers: boolean,
  hideMenuPromos: boolean,
): void {
  if (fixes.scrollFramePacing) installScrollFramePacingFix();
  if (fixes.escapePointerLock) installEscapePointerLockFix();
  // Always installed so the toggle works without a reload. While it's off the
  // wrapper is a straight passthrough.
  installRawInputHook(fixes.rawInput);
  setAdContainerHiding(hideAdContainers);
  setMenuPromoHiding(hideMenuPromos);
  installPlayRowFix();
}
