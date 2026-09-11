import { KRUNKER_CHAT, KRUNKER_DOM_IDS, KRUNKER_MENU_CLASS } from '../../krunker/constants';
import { UI_IDS } from './ids';
import { SCAN_THUMB, SCAN_TIMING } from './tokens';
import hudMinimal from './hud-minimal.css?raw';

/**
 * Every stylesheet the client installs, in one file.
 *
 * They used to live beside the component that mounted them — nine template
 * literals across nine modules — which meant restyling anything started with
 * finding out where its rules were. They are all here now, in one place, and
 * the components import what they need. `tokens.ts` holds the values; this
 * holds the rules that spend them.
 *
 * Two things carried over from when these were scattered, because both are
 * still true:
 *
 *  - The settings panel is built from Krunker's own class names (`setHed`,
 *    `setBodH`, `setting settName`, `switch`, `slider round`), so it inherits
 *    the game's fonts, spacing and hover states. What's here only covers what
 *    Krunker has no class for. The more we restyle, the further out of step we
 *    drift when they change their theme.
 *  - The comments explain *why* a rule is shaped the way it is, usually
 *    because of something Krunker's CSS does. Those are the expensive part.
 *    Deleting a rule that looks redundant is how the layout bugs come back.
 */

/**
 * Transient status messages.
 *
 * Krunker has its own notifications, but hooking those means depending on an
 * internal that moves around between updates. Our own element is a few lines
 * and can't break when the game changes.
 */
const toast = `
#${UI_IDS.toast}{position:fixed;left:50%;bottom:46px;transform:translateX(-50%) translateY(8px);
  z-index:var(--nm-z-toast);padding:8px 15px;border-radius:var(--nm-radius);
  background:var(--nm-toast-bg);border:var(--nm-bw) solid var(--nm-toast-border);
  color:var(--nm-text);
  font-family:var(--nm-font);font-size:var(--nm-fs-md);line-height:var(--nm-lh-tight);
  pointer-events:none;opacity:0;transition:opacity var(--nm-med),transform var(--nm-med)}
#${UI_IDS.toast}.kc-show{opacity:1;transform:translateX(-50%) translateY(0)}
`;

/**
 * The shared hover tooltip. One element, reused for every target.
 *
 * `--nm-font` is Krunker's own pixel face. It wants more line-height and no
 * letter-spacing compared to a normal UI font, and it has no real weight axis,
 * so font-weight buys nothing here and risks a synthesised bold.
 */
const tooltip = `
#${UI_IDS.tooltip}{position:fixed;z-index:var(--nm-z-tooltip);max-width:300px;padding:7px 10px;
  border-radius:var(--nm-radius-sm);background:var(--nm-popover-bg);
  border:var(--nm-bw) solid var(--nm-popover-border);color:var(--nm-popover-text);
  font-family:var(--nm-font);font-size:var(--nm-fs-md);line-height:var(--nm-lh-loose);
  white-space:pre-line;
  pointer-events:none;opacity:0;transition:opacity var(--nm-quick);
  box-shadow:0 6px 18px var(--nm-shadow-mid)}
#${UI_IDS.tooltip}.kc-tip-show{opacity:1}
.kc-tip-target{cursor:help}
`;

/**
 * Frame-time HUD.
 *
 * A stylesheet rather than the inline styles this used to set from JS. Inline
 * styles beat every rule a theme could write short of `!important`, so the HUD
 * was the one client surface no theme could touch. Corner and visibility are
 * classes for the same reason.
 */
const perfHud = `
#${UI_IDS.perfHud}{position:fixed;z-index:var(--nm-z-hud);display:none;padding:5px 8px;
  border-radius:var(--nm-radius-sm);background:var(--nm-hud-bg);color:var(--nm-text);
  /* Longhands, not the font shorthand: a raw line-height hidden in a shorthand
     is the one place the token guard cannot see it. */
  font-weight:600;font-size:var(--nm-fs-2xs);line-height:var(--nm-lh-hud);
  font-family:var(--nm-font);letter-spacing:var(--nm-track-xs);
  /* GameFont is not a monospace face, so ask for even digits explicitly.
     Without this the numbers change width as they count and the box, being
     pinned to a corner, twitches on its free edge every frame. */
  font-variant-numeric:tabular-nums;
  pointer-events:none;white-space:pre;
  /* Keep the HUD out of page layout entirely. It shouldn't be able to force a
     reflow of the game UI under it. */
  contain:layout style paint}
#${UI_IDS.perfHud}.kc-hud-on{display:block}
#${UI_IDS.perfHud}.kc-hud-top-left{top:8px;left:8px}
#${UI_IDS.perfHud}.kc-hud-top-right{top:8px;right:8px}
#${UI_IDS.perfHud}.kc-hud-bottom-left{bottom:8px;left:8px}
#${UI_IDS.perfHud}.kc-hud-bottom-right{bottom:8px;right:8px}
`;

/**
 * Client name and version in the in-game HUD, under the round timer.
 *
 * Both blocks match `#matchInfo`'s own rules. The current layout draws a hard
 * four-way outline because the text sits straight on the map; the older one,
 * which the game marks with a `topLeftOld` class, is bigger and goes without.
 * That class turns up after the page loads and can change again mid-session,
 * so this keys off it with `:has()` rather than reading it once on insert.
 */
const watermark = `
#${UI_IDS.watermark}{display:block;color:var(--nm-watermark-text);font-size:var(--nm-fs-xs);
  margin-bottom:5px;
  text-shadow:var(--nm-watermark-outline) -1px -1px 0,var(--nm-watermark-outline) 1px -1px 0,
    var(--nm-watermark-outline) -1px 1px 0,var(--nm-watermark-outline) 1px 1px 0}
#topLeftMatchData:has(> #matchInfo.topLeftOld) > #${UI_IDS.watermark}{
  font-size:var(--nm-fs-xl);margin-bottom:2px;text-shadow:unset}
`;

/** The queue launcher wedged into Krunker's own ranked footer, beside FIND MATCH. */
const queueButton = `
/*
 * Krunker's own ranked footer, with our button standing in for it.
 *
 * FIND MATCH is hidden rather than removed: it is Svelte's element, and
 * taking it out of the DOM invites the framework to put it back or to throw
 * on the next re-render. "All regions" goes with it, because regions are
 * picked in our panel now and two places to choose them is one too many.
 */
/*
 * The :not() is load-bearing. Our button copies their class list so it keeps
 * their size and hover, which means it matches this selector too — without
 * the exclusion this rule hides the replacement along with the original and
 * the footer ends up with no queue button at all.
 */
[class*="footer-controls"] > [class*="queue-all-regions-container"],
[class*="footer-controls"] > button[class*="start-button"]:not(#${UI_IDS.queueButton}){
  display:none !important}
#${UI_IDS.queueButton}{display:inline-flex;align-items:center;justify-content:center;
  width:38px;height:38px;margin:0 var(--nm-gap);border-radius:var(--nm-radius);cursor:pointer;
  background:var(--nm-queue-bg);border:var(--nm-bw-thick) solid var(--nm-queue-border);
  box-sizing:border-box;
  transition:background var(--nm-fast),transform var(--nm-fast)}
#${UI_IDS.queueButton}:hover{background:var(--nm-queue-bg-hover);transform:translateY(-1px)}
#${UI_IDS.queueButton} svg{width:19px;height:19px;fill:none;stroke:var(--nm-queue-icon);
  stroke-width:2.2;stroke-linecap:round;stroke-linejoin:round}
`;

/**
 * The Alt Manager window. Krunker's palette, so it reads as part of the game.
 */
/**
 * The scripts window.
 *
 * Deliberately the same shell as the alt manager: dark panel, thick border,
 * a header rule and a scrolling body. Two client windows that look like two
 * different programs is the thing this menu has been spending its time
 * getting away from.
 */
const scriptsModal = `
#${UI_IDS.scriptsModal}-backdrop{position:fixed;inset:0;z-index:var(--nm-z-modal);
  background:var(--nm-game-scrim);
  display:flex;align-items:center;justify-content:center}
#${UI_IDS.scriptsModal}{width:min(560px,92vw);max-height:82vh;display:flex;flex-direction:column;
  background:var(--nm-game-bg);border:var(--nm-bw-thick) solid var(--nm-game-border);
  color:var(--nm-game-text);font-family:var(--nm-font-display)}
#${UI_IDS.scriptsModal} .hd{display:flex;align-items:center;justify-content:space-between;
  padding:14px 18px;border-bottom:var(--nm-bw-thick) solid var(--nm-game-border);
  background:var(--nm-game-bg-head)}
#${UI_IDS.scriptsModal} .hd h2{margin:0;font-size:var(--nm-fs-4xl);
  letter-spacing:var(--nm-track-xl);font-weight:normal}
#${UI_IDS.scriptsModal} .bd{overflow-y:auto;padding:14px 18px 18px}
#${UI_IDS.scriptsModal} .empty{padding:22px 0;text-align:center;
  color:var(--nm-game-text-dim);font-size:var(--nm-fs-lg)}
#${UI_IDS.scriptsModal} .note{font-size:var(--nm-fs-xs);color:var(--nm-game-text-faint);
  line-height:var(--nm-lh);margin-top:12px;text-align:center}
/* One script. Icon, then the name over its description, then the switch. */
#${UI_IDS.scriptsModal} .row{display:flex;align-items:center;gap:12px;padding:11px 12px;
  margin-bottom:8px;
  background:var(--nm-game-row-bg);border:var(--nm-bw-thick) solid var(--nm-game-border)}
#${UI_IDS.scriptsModal} .row .ico{flex:0 0 auto;font-size:var(--nm-fs-7xl);
  color:var(--nm-game-text-dim)}
#${UI_IDS.scriptsModal} .row.live .ico{color:var(--nm-accent)}
#${UI_IDS.scriptsModal} .txt{flex:1;min-width:0}
#${UI_IDS.scriptsModal} .nm{font-size:var(--nm-fs-2xl)}
#${UI_IDS.scriptsModal} .sub{font-size:var(--nm-fs-xs);color:var(--nm-game-text-dim);
  line-height:var(--nm-lh);margin-top:2px}
#${UI_IDS.scriptsModal} button{flex:0 0 auto;font-family:inherit;cursor:pointer;
  min-width:58px;padding:7px 14px;font-size:var(--nm-fs-md);
  letter-spacing:var(--nm-track-md);
  border:var(--nm-bw-thick) solid var(--nm-game-btn-border);
  background:var(--nm-game-btn-bg);color:var(--nm-game-btn-text)}
#${UI_IDS.scriptsModal} button:hover{background:var(--nm-game-btn-bg-hover);
  color:var(--nm-game-text)}
#${UI_IDS.scriptsModal} button.on{border-color:var(--nm-ok-border);color:var(--nm-ok)}
#${UI_IDS.scriptsModal} button.on:hover{background:var(--nm-ok-bg-hover);
  color:var(--nm-ok-text-hi)}
`;

/**
 * The hardpoint enemy counter, in the top-right HUD strip.
 *
 * Krunker's own `statIcon` and `greyInner` classes do the box, so this only
 * sets what they leave: the label against the figure, and the accent on the
 * number so it reads at a glance mid-fight, which is the only time anyone
 * looks at it.
 */
const hardpointCounter = `
#${UI_IDS.hardpointCounter} .greyInner{display:flex;align-items:center;gap:6px}
#${UI_IDS.hardpointCounter} .lbl{color:var(--nm-text);font-size:var(--nm-fs-xs);
  letter-spacing:var(--nm-track-md);text-transform:uppercase}
#${UI_IDS.hardpointCounter} .val{color:var(--nm-hp-count);font-size:var(--nm-fs-5xl);
  font-weight:bold;min-width:14px;text-align:center;
  /* Tabular so 1 and 4 are the same width; the strip beside it must not
     shuffle every time the count changes. */
  font-variant-numeric:tabular-nums}
`;

/**
 * The inline ranked queue: a panel, and a pill for while it is shut.
 *
 * Same shell as the other client windows. The pill is the part that matters
 * for the feature — the queue survives the panel closing, so there has to be
 * something on screen saying so.
 */
const rankedPanel = `
#${UI_IDS.rankedPanel}-backdrop{position:fixed;inset:0;z-index:var(--nm-z-modal);
  background:var(--nm-game-scrim);
  display:flex;align-items:center;justify-content:center}
#${UI_IDS.rankedPanel}{width:min(460px,92vw);display:flex;flex-direction:column;
  background:var(--nm-game-bg);border:var(--nm-bw-thick) solid var(--nm-game-border);
  color:var(--nm-game-text);font-family:var(--nm-font-display)}
#${UI_IDS.rankedPanel} .hd{padding:14px 18px;
  border-bottom:var(--nm-bw-thick) solid var(--nm-game-border);
  background:var(--nm-game-bg-head)}
#${UI_IDS.rankedPanel} .hd h2{margin:0;font-size:var(--nm-fs-4xl);
  letter-spacing:var(--nm-track-xl);font-weight:normal}
#${UI_IDS.rankedPanel} .bd{padding:18px;display:flex;flex-direction:column;gap:14px}
#${UI_IDS.rankedPanel} .line{display:flex;align-items:center;gap:8px}
#${UI_IDS.rankedPanel} .dot{width:8px;height:8px;flex:0 0 auto;
  background:var(--nm-game-text-dim);transition:background var(--nm-fast)}
#${UI_IDS.rankedPanel} .dot.on{background:var(--nm-ok)}
#${UI_IDS.rankedPanel} .status{font-size:var(--nm-fs-md);
  letter-spacing:var(--nm-track-lg);text-transform:uppercase;color:var(--nm-game-text-dim)}
#${UI_IDS.rankedPanel} .timer{font-size:var(--nm-fs-display);line-height:var(--nm-lh-tight);
  font-variant-numeric:tabular-nums}
#${UI_IDS.rankedPanel} .regions{display:flex;gap:8px;flex-wrap:wrap}
#${UI_IDS.rankedPanel} .regions label{display:flex;align-items:center;gap:6px;
  padding:8px 12px;cursor:pointer;font-size:var(--nm-fs-md);
  background:var(--nm-game-row-bg);
  border:var(--nm-bw-thick) solid var(--nm-game-border)}
#${UI_IDS.rankedPanel} .go{font-family:inherit;cursor:pointer;padding:12px 18px;
  font-size:var(--nm-fs-lg);letter-spacing:var(--nm-track-md);
  text-transform:uppercase;
  border:var(--nm-bw-thick) solid var(--nm-game-btn-border);
  background:var(--nm-game-btn-bg);color:var(--nm-game-btn-text)}
#${UI_IDS.rankedPanel} .go:hover:not(:disabled){background:var(--nm-game-btn-bg-hover);
  color:var(--nm-game-text)}
#${UI_IDS.rankedPanel} .go.live{border-color:var(--nm-ok-border);color:var(--nm-ok)}
#${UI_IDS.rankedPanel} .go:disabled{opacity:.4;cursor:default}
#${UI_IDS.rankedPanel} .note{font-size:var(--nm-fs-xs);color:var(--nm-game-text-faint);
  line-height:var(--nm-lh)}
#${UI_IDS.rankedPanel} .note.bad{color:var(--nm-bad-text)}
/*
 * While searching, the whole panel steps between two greens.
 *
 * steps(1,end) is what makes it snap rather than fade, which is the same
 * call the external queue window made: there is no ambient light anywhere in
 * Krunker's UI, so a soft pulse reads as a web dashboard sitting on top of
 * the game and a hard blink reads as an indicator lamp.
 */
#${UI_IDS.rankedPanel}.live{animation:nmQueueEdge var(--nm-blink) steps(1,end) infinite}
@keyframes nmQueueEdge{
  0%,50%{border-color:var(--nm-rq-go);background:var(--nm-rq-panel-hi)}
  50.01%,100%{border-color:var(--nm-rq-go-dim);background:var(--nm-rq-panel)}
}
#${UI_IDS.rankedPanel}.live .hd{animation:nmQueueHead var(--nm-blink) steps(1,end) infinite}
@keyframes nmQueueHead{
  0%,50%{border-bottom-color:var(--nm-rq-go)}
  50.01%,100%{border-bottom-color:var(--nm-rq-go-dim)}
}
/* Fixed for the life of a queue, and it should look fixed. */
#${UI_IDS.rankedPanel} .regions.locked label{opacity:.5;cursor:default}

/*
 * The pill. Where it goes depends on which screen you are on, so the top and
 * the horizontal edge are set from JS, in preload/ranked/panel.ts:
 *
 *   in a match  under the leaderboard and the counters, on the right
 *   on the menu under CLICK TO PLAY, centred
 *
 * Neither can be a constant. The leaderboard grows with the player count,
 * and Krunker scales its whole UI, so both move.
 */
#${UI_IDS.rankedPill}{position:fixed;top:196px;
  z-index:var(--nm-z-toast);display:flex;align-items:center;gap:10px;
  padding:9px 12px;background:var(--nm-game-bg);
  border:var(--nm-bw-thick) solid var(--nm-game-border);
  color:var(--nm-game-text);font-family:var(--nm-font-display);
  font-size:var(--nm-fs-md)}
#${UI_IDS.rankedPill} i{width:8px;height:8px;flex:0 0 auto;background:var(--nm-ok)}
#${UI_IDS.rankedPill} .txt{font-variant-numeric:tabular-nums}
#${UI_IDS.rankedPill} button{font-family:inherit;cursor:pointer;padding:4px 10px;
  font-size:var(--nm-fs-xs);letter-spacing:var(--nm-track-md);text-transform:uppercase;
  border:var(--nm-bw) solid var(--nm-game-btn-border);
  background:var(--nm-game-btn-bg);color:var(--nm-game-btn-text)}
#${UI_IDS.rankedPill} button:hover{background:var(--nm-game-btn-bg-hover);
  color:var(--nm-game-text)}
#${UI_IDS.rankedPill} .stop{border-color:var(--nm-bad-border);color:var(--nm-bad-text)}
`;

const altModal = `
#${UI_IDS.altModal}-backdrop{position:fixed;inset:0;z-index:var(--nm-z-modal);
  background:var(--nm-game-scrim);
  display:flex;align-items:center;justify-content:center}
#${UI_IDS.altModal}{width:min(560px,92vw);max-height:82vh;display:flex;flex-direction:column;
  background:var(--nm-game-bg);border:var(--nm-bw-thick) solid var(--nm-game-border);
  color:var(--nm-game-text);font-family:var(--nm-font-display)}
#${UI_IDS.altModal} .hd{display:flex;align-items:center;justify-content:space-between;
  padding:14px 18px;border-bottom:var(--nm-bw-thick) solid var(--nm-game-border);
  background:var(--nm-game-bg-head)}
#${UI_IDS.altModal} .hd h2{margin:0;font-size:var(--nm-fs-4xl);letter-spacing:var(--nm-track-xl);
  font-weight:normal}
#${UI_IDS.altModal} .bd{overflow-y:auto;padding:14px 18px 18px}
/* Column so the button sits on its own line: inline after wrapped text, it
   never lines up with anything. */
#${UI_IDS.altModal} .warn{display:flex;flex-direction:column;align-items:flex-start;
  gap:var(--nm-gap);
  font-size:var(--nm-fs-md);line-height:var(--nm-lh);margin-bottom:14px;padding:10px 12px;
  background:var(--nm-caution-bg);border:var(--nm-bw-thick) solid var(--nm-bad-border);
  color:var(--nm-caution-text)}
#${UI_IDS.altModal} .row{display:flex;align-items:center;gap:12px;padding:11px 12px;
  margin-bottom:8px;
  background:var(--nm-game-row-bg);border:var(--nm-bw-thick) solid var(--nm-game-border)}
#${UI_IDS.altModal} .row.on{border-color:var(--nm-ok-border);background:var(--nm-ok-bg)}
#${UI_IDS.altModal} .who{flex:1;min-width:0}
#${UI_IDS.altModal} .nm{font-size:var(--nm-fs-2xl);overflow:hidden;text-overflow:ellipsis;
  white-space:nowrap}
#${UI_IDS.altModal} .sub{font-size:var(--nm-fs-xs);color:var(--nm-game-text-dim);margin-top:2px;
  overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
#${UI_IDS.altModal} button{font-family:inherit;cursor:pointer;
  border:var(--nm-bw-thick) solid var(--nm-game-btn-border);
  background:var(--nm-game-btn-bg);color:var(--nm-game-btn-text);padding:7px 14px;
  font-size:var(--nm-fs-md);letter-spacing:var(--nm-track-md)}
#${UI_IDS.altModal} button:hover{background:var(--nm-game-btn-bg-hover);
  color:var(--nm-game-text)}
#${UI_IDS.altModal} button.go{border-color:var(--nm-ok-border);color:var(--nm-ok)}
#${UI_IDS.altModal} button.go:hover{background:var(--nm-ok-bg-hover);color:var(--nm-ok-text-hi)}
#${UI_IDS.altModal} button.del{border-color:var(--nm-bad-border);color:var(--nm-bad-text);
  padding:7px 11px}
#${UI_IDS.altModal} button.del:hover{background:var(--nm-bad-bg);color:var(--nm-bad-text-hi)}
#${UI_IDS.altModal} button:disabled{opacity:.4;cursor:default}
/* Square, and centred on the title's optical middle rather than its box. The
   plus is drawn rather than typed: GameFont's own "+" is a heavy pixel glyph
   that reads as some other icon at this size. */
#${UI_IDS.altModal} button.add{display:flex;align-items:center;justify-content:center;
  width:30px;height:30px;padding:0;border-color:var(--nm-ok-border);color:var(--nm-ok)}
#${UI_IDS.altModal} button.add svg{width:14px;height:14px;fill:none;stroke:currentColor;
  stroke-width:2.4;stroke-linecap:round}
#${UI_IDS.altModal} .form{display:flex;flex-direction:column;gap:var(--nm-gap-sm);
  margin-top:14px;
  padding-top:14px;border-top:var(--nm-bw-thick) solid var(--nm-game-border)}
#${UI_IDS.altModal} .form input{font-family:inherit;font-size:var(--nm-fs-lg);padding:8px 10px;
  background:var(--nm-game-input-bg);border:var(--nm-bw-thick) solid var(--nm-game-border);
  color:var(--nm-game-text)}
#${UI_IDS.altModal} .form input:focus{outline:none;border-color:var(--nm-game-input-focus)}
#${UI_IDS.altModal} .form .actions{display:flex;gap:var(--nm-gap-sm);justify-content:flex-end}
#${UI_IDS.altModal} .empty{padding:22px 0;text-align:center;color:var(--nm-game-text-dim);
  font-size:var(--nm-fs-lg)}
#${UI_IDS.altModal} .note{font-size:var(--nm-fs-xs);color:var(--nm-game-text-faint);
  line-height:var(--nm-lh);margin-top:12px}
`;

/** The changelog panel, opened from a row in Krunker's own left menu. */
const changelog = `
#${UI_IDS.changelogModal}-backdrop{position:fixed;inset:0;z-index:var(--nm-z-modal);
  background:var(--nm-game-scrim);
  display:flex;align-items:center;justify-content:center}
#${UI_IDS.changelogModal}{width:min(620px,92vw);max-height:80vh;display:flex;
  flex-direction:column;
  background:var(--nm-game-bg);border:var(--nm-bw-thick) solid var(--nm-game-border);
  color:var(--nm-game-text);font-family:var(--nm-font-display)}
#${UI_IDS.changelogModal} .hd{padding:14px 18px;
  border-bottom:var(--nm-bw-thick) solid var(--nm-game-border);
  background:var(--nm-game-bg-head)}
#${UI_IDS.changelogModal} .hd h2{margin:0;font-size:var(--nm-fs-4xl);
  letter-spacing:var(--nm-track-xl);font-weight:normal}
#${UI_IDS.changelogModal} .bd{overflow-y:auto;padding:6px 18px 18px}
/* One clickable row per version; the changes hang below it. */
#${UI_IDS.changelogModal} .ver{display:flex;align-items:baseline;gap:var(--nm-gap);
  cursor:pointer;
  margin-top:8px;padding:10px 2px;border-bottom:var(--nm-bw-thick) solid var(--nm-game-rule);
  transition:color var(--nm-fast)}
#${UI_IDS.changelogModal} .ver:hover{background:var(--nm-game-row-hover)}
#${UI_IDS.changelogModal} .ver .caret{flex:0 0 14px;font-size:var(--nm-fs-2xs);
  color:var(--nm-game-text-faint);transition:transform var(--nm-fast)}
#${UI_IDS.changelogModal} .ver.open .caret{transform:rotate(90deg)}
#${UI_IDS.changelogModal} .ver .v{font-size:var(--nm-fs-3xl);letter-spacing:var(--nm-track-lg)}
#${UI_IDS.changelogModal} .ver .d{font-size:var(--nm-fs-xs);color:var(--nm-game-text-faint)}
#${UI_IDS.changelogModal} .ver .n{margin-left:auto;font-size:var(--nm-fs-2xs);
  color:var(--nm-game-text-fainter)}
#${UI_IDS.changelogModal} ul{list-style:none;margin:0;padding:4px 0 10px}
#${UI_IDS.changelogModal} ul[hidden]{display:none}
#${UI_IDS.changelogModal} li{display:flex;gap:var(--nm-gap);padding:5px 0;
  font-size:var(--nm-fs-md);line-height:var(--nm-lh);color:var(--nm-game-text-body)}
/*
 * Uniform tag column. min-width:0 is the load-bearing part: a flex item
 * defaults to min-width:auto, so "CHANGED" refused to shrink into the basis
 * and shoved its own line's text further right than the shorter tags.
 * Centring makes the narrower words sit evenly in the same box.
 */
#${UI_IDS.changelogModal} .tag{flex:0 0 74px;min-width:0;text-align:center;
  font-size:var(--nm-fs-2xs);letter-spacing:var(--nm-track-md);padding-top:2px}
#${UI_IDS.changelogModal} .tag.added{color:var(--nm-ok)}
#${UI_IDS.changelogModal} .tag.fixed{color:var(--nm-tag-fixed)}
#${UI_IDS.changelogModal} .tag.changed{color:var(--nm-tag-changed)}
`;

/** Loadout and Customize side by side, with Alt Manager on the row below. */
const menuButtons = `
/* Block with an explicit width and auto left margin, reproducing the right
   alignment the game's text-align:right wrapper gave the stacked buttons. */
#${UI_IDS.classButtonRow}{display:flex;gap:var(--nm-gap-sm);margin:8px 0 0 auto}
#${UI_IDS.classButtonRow} > *{flex:1 1 0;width:auto !important;min-width:0;margin:0}
/* Krunker sizes these for a full-width button. At half the width the label
   plus its icon no longer fits, so both come down proportionally. */
#${UI_IDS.classButtonRow} .button{font-size:var(--nm-fs-6xl);padding-left:8px;padding-right:8px;
  justify-content:center;white-space:nowrap}
#${UI_IDS.classButtonRow} .material-icons{font-size:var(--nm-fs-7xl) !important;
  margin-left:4px !important}
/* No height here: the shared .button class already supplies the padding and
   line box that make the other two 44px tall, and an explicit height fights
   it. */
#${UI_IDS.altManagerButton}{margin:8px 0 0 auto;cursor:pointer;white-space:nowrap;
  justify-content:center}
`;

/**
 * The `[T]`/`[M]` prefixes on merged chat. A stylesheet rather than the inline
 * `cssText` this used to set per message, so the colours live with every other
 * colour and a theme can reach them.
 */
const chatTags = `
.kc-chat-tag{float:left;margin-right:4px;font-weight:bold}
.kc-chat-tag.kc-chat-team{color:var(--nm-chat-team)}
.kc-chat-tag.kc-chat-all{color:var(--nm-chat-all)}
`;

/** Krunker hides the inactive channel. Overriding display shows both. */
const chatMerge = `#${KRUNKER_DOM_IDS.chatList} > * { display: block !important; }`;

/**
 * Chat, lifted clear of the menu's own bottom row.
 *
 * Krunker pins chat to `bottom:20px` and then draws the map name, Invite,
 * Join and the five big buttons over the bottom 180px of the same screen, so
 * on the menu the last few messages are behind Quick Match. In a match that
 * corner is empty and the game's own position is right, which is why this is
 * scoped rather than global.
 *
 * `#uiBase.onMenu` is Krunker's own flag for which of the two it is. It is a
 * class on a static element, so it survives the menu rebuilding itself.
 *
 * The lift is a variable because the button block scales with the UI; see
 * `preload/chat-place.ts` for where the number comes from.
 */
const chatPlace = `
#${KRUNKER_DOM_IDS.uiBase}.${KRUNKER_MENU_CLASS} #${KRUNKER_DOM_IDS.chatHolder}{
  bottom:var(--nm-chat-lift) !important}
#${KRUNKER_DOM_IDS.uiBase}.${KRUNKER_MENU_CLASS} #${KRUNKER_DOM_IDS.chatList}{
  max-height:var(--nm-chat-menu-height) !important}
`;

/**
 * Client settings, rendered inside Krunker's own settings window.
 *
 * Only what Krunker has no class for. Everything structural is the game's own
 * CSS, and keeping this small matters: the more we restyle, the further out of
 * step we drift when they change their theme.
 */
const settings = `
/* Matches Krunker's own convention of flagging a setting with a red asterisk
   (Antialiasing, No Textures, Map Details). Red = needs a client restart,
   blue = needs a page reload; the tooltip on the row spells out which. */
.kc-tagline{display:inline-block;margin-left:6px;font-size:var(--nm-fs-2xl);line-height:0;
  vertical-align:-1px;font-weight:700}
.kc-tag-restart{color:var(--nm-restart)}
.kc-tag-reload{color:var(--nm-reload)}
/* Krunker's rows rely on their .setBodH parent for the card background, and
   its control is floated rather than laid out, so force label-left /
   buttons-right onto one line instead of letting them stack. */
/* Sits where a button would, when there is nothing to press. */
.kc-note{font-size:var(--nm-fs-xs);color:var(--nm-game-text-dim);padding-right:2px}
.kc-actionrow{display:flex;align-items:center;justify-content:space-between;
  gap:var(--nm-gap-lg);flex-wrap:wrap}
.kc-actionbtns{display:flex;flex-wrap:wrap;gap:var(--nm-gap-sm);align-items:center}
/* Krunker's own .setting-input-wrapper carries float rules that reorder its
   children and interact badly with anything we add, so the numeric row does
   not use it. The row lays itself out, the same way .kc-actionrow does,
   rather than leaning on the game's float behaviour. */
.kc-numrow{display:flex;align-items:center;justify-content:space-between;gap:var(--nm-gap-lg)}
.kc-chiprow{display:block}
.kc-chips{display:flex;flex-wrap:wrap;gap:var(--nm-gap-sm);margin-top:10px}
.kc-chip{padding:7px 14px;border-radius:var(--nm-radius-sm);
  border:var(--nm-bw) solid var(--nm-border);background:var(--nm-surface);
  color:var(--nm-text-dim);font-size:var(--nm-fs-lg);cursor:pointer;font-family:inherit;
  line-height:var(--nm-lh)}
.kc-chip:hover{border-color:var(--nm-border-hover);color:var(--nm-text-mid)}
.kc-chip.on{background:var(--nm-accent-bg);border-color:var(--nm-accent-border);
  color:var(--nm-text-hi)}

/* Map picker: a tile grid with Krunker's own hosted previews. */
.kc-maprow{display:block}
.kc-maphead{display:flex;align-items:center;justify-content:space-between;gap:var(--nm-gap)}
.kc-mapgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(158px,1fr));
  gap:var(--nm-gap-sm);margin-top:10px}
.kc-maptile{display:flex;align-items:center;gap:9px;padding:7px 10px;
  border-radius:var(--nm-radius);
  border:var(--nm-bw) solid var(--nm-border);background:var(--nm-surface);cursor:pointer;
  font-size:var(--nm-fs-lg);color:var(--nm-text-body)}
.kc-maptile:hover{border-color:var(--nm-border-hover);color:var(--nm-text-hi)}
.kc-maptile.on{background:var(--nm-accent-bg-soft);border-color:var(--nm-accent-border);
  color:var(--nm-text-hi)}
.kc-maptile img{width:38px;height:26px;object-fit:cover;border-radius:var(--nm-radius-2xs);
  flex:none;background:var(--nm-surface-sunken);image-rendering:auto}
.kc-maptile .kc-mapname{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.kc-maptile input[type=checkbox]{accent-color:var(--nm-accent);width:15px;height:15px;flex:none;
  pointer-events:none}
.kc-numrow .kc-numctl{display:flex;align-items:center;gap:var(--nm-gap);flex:none}
.kc-numrow .kc-numctl .sliderM{width:230px;margin:0;display:block}
.kc-numrow .kc-numctl .sliderVal{width:66px;text-align:center;margin:0}
/* Krunker sizes .settingsBtn for short labels like "Reset" and clips anything
   longer to an ellipsis. Let ours size to their text instead. */
.kc-actionbtns .settingsBtn{width:auto;min-width:0;max-width:none;padding:0 14px;
  overflow:visible;text-overflow:clip;white-space:nowrap;
  display:inline-flex;align-items:center;justify-content:center}
.kc-keywrap{display:flex;align-items:center;gap:var(--nm-gap-sm)}
.kc-keyicon{min-width:104px;text-align:center;cursor:pointer;user-select:none}
.kc-keyicon.kc-capturing{background:var(--nm-accent-bg);color:var(--nm-text-hi);
  border-color:var(--nm-accent)}
.kc-keyicon.kc-clash{border-color:var(--nm-danger-border);color:var(--nm-danger-soft)}
.kc-unbind{color:var(--nm-danger);cursor:pointer;font-size:var(--nm-fs-5xl)}
.kc-unbind:hover{color:var(--nm-danger-hover)}
.kc-reset{color:var(--nm-warn);cursor:pointer;font-size:var(--nm-fs-5xl)}
.kc-reset:hover{color:var(--nm-warn-hover)}
.kc-setbod-collapsed{display:none !important}
.kc-hidden{display:none !important}
`;

/**
 * The section index down the left of the settings window.
 *
 * Positioned rather than laid out: it is an absolute box against the scroll
 * container's parent, so it stays put while the content scrolls without a
 * single line of scroll-handling. The container gets padding on the left to
 * make room, which is the only thing this does to Krunker's own layout.
 *
 * Width is fixed rather than fit-to-content. Section names differ per tab, and
 * a nav that changes width as you move between them makes the whole panel
 * appear to shift.
 */
const sectionNav = `
/* The holder reserves a left column and the index is positioned into it.
   Padding rather than a flex or grid rewrite, because the rows inside are
   Krunker's and rearranging their container is how this breaks on their next
   update. */
/* The holder is the index's containing block. Said with an ID because
   Krunker's own #settHolder rule outranks a bare class, which is what beat an
   earlier attempt at exactly this. */
#settHolder.kc-has-sectnav{position:relative !important;padding-left:190px !important}
/*
 * The window stays centred, and stays as tall as whatever section is on it.
 *
 * Two earlier attempts at the same problem, both worse: a floor under the
 * height stopped it moving by leaving a screenful of dead space under a short
 * section, and anchoring the top stopped that but left the window sitting
 * high on the screen. Centred and content-sized is what was wanted; the index
 * is placed against the window and re-placed whenever it resizes, so it
 * follows rather than drifting.
 */
#menuWindow:has(#settHolder.kc-has-sectnav){max-height:86vh !important}
/*
 * Held in place by a transform, set from script each frame.
 *
 * Two earlier attempts both failed on something an ancestor did:
 *
 *  - position:sticky stops working the moment anything between the element
 *    and the scrolling box has overflow:hidden, because that ancestor becomes
 *    the sticky context. The settings window has one.
 *  - position:absolute needs the holder to be the containing block, and the
 *    rule saying so lost to Krunker's own #settHolder rule on specificity, so
 *    the index positioned against the window instead and setting top from the
 *    scroll offset pushed it DOWN as you scrolled.
 *
 * A transform is measured from the element's own layout position. There is no
 * containing block to lose and no ancestor property that can switch it off.
 * The float keeps it out of the rows' flow; the holder's padding reserves the
 * column it sits in.
 *
 * The transform value itself is not computed from scroll offsets either — a
 * third attempt did that and drifted, because scroll events arrive less often
 * than frames during an animated jump. pin() reads where the index actually is
 * and corrects it, every frame, for as long as a scroll is playing.
 */
/* Fixed, and neither floated nor absolute. Two separate reasons:
   As a float it stayed in flow, and Krunker gives every settings row
   clear:both for its float-right switches — so the first row of the first
   section cleared the whole index and left a gap exactly as tall as it.
   Absolute fixed that, but an absolutely positioned child of a scroller still
   scrolls with it, so holding it still meant correcting it every frame, which
   is a frame behind by construction. Fixed does not move at all. Its top and
   left are written from script, because a transformed ancestor becomes the
   containing block and Krunker has one. */
#${UI_IDS.sectionNav}{position:absolute;top:0;left:0;width:172px;
  /* Everything above this is pointer-events:none — #uiBase sets it and each
     window holder keeps it, with Krunker re-enabling it only inside its own
     panels. The index sits outside those now, so it has to say so itself or
     the clicks fall straight through to the settings behind it. */
  pointer-events:auto;
  overflow-y:auto;overscroll-behavior:contain;
  padding:2px 12px 2px 0;box-sizing:border-box;
  border-right:var(--nm-bw) solid var(--nm-kr-rule);
  font-family:var(--nm-font);font-size:var(--nm-fs-md);
  /* Above the rows, so a wide row can't paint over the index. */
  z-index:var(--nm-z-raise)}
/* No scrollbar of its own: one panel should not show two. */
#${UI_IDS.sectionNav}::-webkit-scrollbar{width:0}
/*
 * Krunker's greys, not ours. This sits ON the game's settings panel, which is
 * a mid grey — reaching for --nm-surface here paints a near-black block on it.
 */
/* Wraps rather than clipping. "Crosshair (Third Person)" truncated to
   "Crosshair (Th..." beside a "Crosshair" above it is worse than useless —
   the two entries read as the same section. */
/* --nm-lh, not --nm-lh-tight: these labels wrap to two and three lines, and
   at 1.2 the wrapped lines of a tall face collide with each other. */
.kc-sectnav-item{padding:8px 12px;margin:0 0 1px;
  color:var(--nm-kr-text-dim);cursor:pointer;
  line-height:var(--nm-lh);overflow-wrap:anywhere;
  border-left:var(--nm-bw-thick) solid transparent;
  transition:color var(--nm-fast),background var(--nm-fast)}
.kc-sectnav-item:hover{color:var(--nm-kr-text);background:var(--nm-kr-fill)}
/* The marker is a left rule rather than a filled pill: the rows to the right
   are already busy, and a solid block here would compete with them. */
.kc-sectnav-item.kc-sectnav-on{color:var(--nm-kr-text);background:var(--nm-kr-fill);
  border-left-color:var(--nm-kr-accent)}

/*
 * Quieter settings rows.
 *
 * Krunker draws every category as a raised card with a heavy header bar and
 * boxes every control, which at this density reads as noise — the screenshot
 * that prompted this had eleven outlined boxes stacked down one column. Cards
 * flatten to a heading and a rule, and rows are separated by a hairline
 * instead of by an outline each.
 *
 * Structure is untouched: same elements, same class names, same behaviour, so
 * the game's own controls keep working.
 */
.kc-has-sectnav .setHed{background:none !important;border:0 !important;
  box-shadow:none !important;
  padding:22px 2px 9px !important;margin:0 !important;
  font-size:var(--nm-fs-lg) !important;
  letter-spacing:var(--nm-track-2xl) !important;
  text-transform:uppercase !important;
  color:var(--nm-kr-text-faint) !important;
  border-bottom:var(--nm-bw-thick) solid var(--nm-kr-rule) !important}
/*
 * The collapse chevron is a material-icons ligature, and its text content is
 * the ligature NAME. Uppercasing it stops the ligature resolving and the row
 * renders the words "keyboard_arrow_down" instead of an arrow, so the
 * transform has to be taken back off the icon.
 */
.kc-has-sectnav .setHed .material-icons{text-transform:none !important;
  letter-spacing:normal !important}
.kc-has-sectnav .setBodH{background:none !important;border:0 !important;
  box-shadow:none !important;padding:0 !important;margin:0 !important}
/* A hairline per row. Stripes were the first attempt and they were wrong
   twice over: a second pattern competing with the rules, in a tone taken from
   our own palette rather than the panel they were painted on. */
/*
 * Rows are .settName on Krunker's own tabs and "setting settName" on ours, so
 * both are named. Targeting only .setting — which is what this did — meant none
 * of the flattening applied to the game's own tabs at all, which is why they
 * still looked untouched.
 */
.kc-has-sectnav .setting,
.kc-has-sectnav .settName{border:0 !important;background:none !important;
  padding:11px 2px !important;
  border-bottom:var(--nm-bw) solid var(--nm-kr-rule-soft) !important}
.kc-has-sectnav .setBodH > .setting:last-child,
.kc-has-sectnav .setBodH > .settName:last-child{border-bottom:0 !important}
/*
 * A step down from Krunker's own row size.
 *
 * Theirs is set for a panel where every row is boxed and the type has to carry
 * across the gap between boxes. With the boxes gone the rules do that work, and
 * the labels can come down a notch and fit more on screen. !important because
 * Krunker sizes these by id, which outranks any class selector of ours.
 */
.kc-has-sectnav .setting,
.kc-has-sectnav .settName,
.kc-has-sectnav .setting .setting-title,
.kc-has-sectnav .settName .setting-title{font-size:var(--nm-fs-3xl) !important}

/*
 * Krunker's preset tiles: Default / Pro / Performance / Custom.
 *
 * They sit at the top of every tab and overwrite every setting in one click,
 * directly above the thing you opened the window for. The same four names are
 * still in the #settingsPreset dropdown in the header, so nothing is lost —
 * only the four large boxes in the way of the settings.
 *
 * A class, in the end. An earlier attempt went looking for them by their
 * labels and found the dropdown's option elements instead, because a tile's
 * text is its name AND its description ("DefaultKrunkers default Settings")
 * and so never matches a bare preset name.
 */
.setSugBox2{display:none !important}
`;

/**
 * The match-scan overlay.
 *
 * GameFont is a pixel face, so everything here gets positioned on whole pixels
 * from JS rather than with percentages or translateX(-50%). Centring by
 * transform lands the text on a fractional offset (590.27px, when I measured
 * it), and a pixel font antialiased across two columns looks doubled and
 * smeared.
 */
const scan = `
#${UI_IDS.scan}{position:fixed;inset:0;z-index:var(--nm-z-scan);display:none;
  pointer-events:none;font-family:var(--nm-font);overflow:hidden}
#${UI_IDS.scan}.on{display:block}

#${UI_IDS.scan} .sc-stage{position:absolute;left:0;right:0;height:0}
#${UI_IDS.scan} .sc-line{position:absolute;top:0;white-space:nowrap;font-size:var(--nm-fs-8xl);
  letter-spacing:var(--nm-track-sm);color:var(--nm-scan-text);display:flex;align-items:center;
  gap:var(--nm-gap-lg);
  text-shadow:0 3px 10px var(--nm-shadow),0 0 2px var(--nm-shadow-strong)}

/* Fixed box whether or not the image has loaded, so text never shifts. */
#${UI_IDS.scan} .sc-thumb{width:${SCAN_THUMB.width}px;height:${SCAN_THUMB.height}px;flex:none;
  border-radius:var(--nm-radius-xs);
  object-fit:cover;background:var(--nm-scan-thumb-bg);
  box-shadow:0 3px 10px var(--nm-shadow-softer)}

/* Rejected: drift left and down, redden, fade. */
@keyframes kc-fall{
  0%  {opacity:1;   transform:translate(0,0) rotate(0deg)}
  15% {opacity:.95; color:var(--nm-scan-reject)}
  100%{opacity:0;   transform:translate(-120%,120px) rotate(-10deg);
       color:var(--nm-scan-reject-end)}
}
#${UI_IDS.scan} .sc-line.out{
  animation:kc-fall ${SCAN_TIMING.fallMs}ms cubic-bezier(.25,.6,.5,1) forwards}
#${UI_IDS.scan} .sc-line.out .sc-thumb{filter:grayscale(1) brightness(.6)}

/* Cut a tumble short once the outcome is known. */
#${UI_IDS.scan} .sc-line.out.clear{animation-play-state:paused;
  transition:opacity var(--nm-scan-cut) linear;opacity:0}

/* Accepted: colour and glow only. scale() would resample the pixel font. */
@keyframes kc-land{
  0%  {color:var(--nm-scan-text);
       text-shadow:0 3px 10px var(--nm-shadow)}
  45% {color:var(--nm-scan-accept-peak);
       text-shadow:0 0 26px var(--nm-scan-glow-peak),0 3px 10px var(--nm-shadow-soft)}
  100%{color:var(--nm-scan-accept);
       text-shadow:0 0 20px var(--nm-scan-glow),0 3px 10px var(--nm-shadow-soft)}
}
#${UI_IDS.scan} .sc-line.hit{animation:kc-land var(--nm-scan-land) ease-out forwards}
#${UI_IDS.scan} .sc-line.hit .sc-thumb{box-shadow:0 0 22px var(--nm-scan-glow-thumb)}
/* The line steps aside as its map image takes over. */
#${UI_IDS.scan} .sc-line.fading{transition:opacity var(--nm-scan-fade) ease-out;opacity:0}

/*
 * The reveal: green floods out from the matched line and covers the screen.
 *
 * This used to grow the map preview instead and it never really worked.
 * Krunker's previews are 200x80 with no larger variant anywhere, so filling
 * 1920px meant about a 10x upscale, and that looked like mush however I
 * layered it. Flat colour has no resolution to run out of.
 *
 * Transform only, so the compositor can do it without relayout every frame.
 */
#${UI_IDS.scan} .sc-flood{position:absolute;width:10px;height:10px;border-radius:50%;
  background:var(--nm-scan-flood);transform:translate(-50%,-50%) scale(0);opacity:.92}
@keyframes kc-flood{
  0%  {transform:translate(-50%,-50%) scale(0);   opacity:.55}
  100%{transform:translate(-50%,-50%) scale(560); opacity:1}
}
#${UI_IDS.scan} .sc-flood.go{
  animation:kc-flood ${SCAN_TIMING.expandMs}ms cubic-bezier(.4,0,.7,1) forwards}

#${UI_IDS.scan} .sc-note{position:absolute;white-space:nowrap;font-size:var(--nm-fs-xl);
  color:var(--nm-scan-note);letter-spacing:var(--nm-track-sm);
  text-shadow:0 2px 8px var(--nm-shadow)}
#${UI_IDS.scan} .sc-note.bad{color:var(--nm-danger-soft)}

/*
 * Krunker puts its own prompts exactly where the scan text goes. At 1920x1009,
 * #spectButton sits at 428-453 and the note at 435-455. They get hidden for
 * the length of the scan rather than moving our text, since their position
 * moves with the viewport and we'd just collide somewhere else instead.
 *
 * Opacity, not only visibility. The spectate toggle's knob is
 * .sliderSml::before and it still measured as visible with its own element
 * hidden; a universal selector matches elements and never pseudo-elements, so
 * "#spectButton *" can't reach it. Opacity covers the whole subtree,
 * pseudo-elements included, and a descendant can't override an ancestor's
 * opacity the way it can override visibility.
 *
 * transition:none matters as well. visibility is transitionable and the toggle
 * carries a 0.4s transition that would otherwise hold up the hide.
 */
html.kc-scanning #spectButtonHolder,
html.kc-scanning #spectButtonHolder *,
html.kc-scanning #spectButton,
html.kc-scanning #spectButton *,
html.kc-scanning .sliderSml,
html.kc-scanning #instructionHider,
html.kc-scanning #instructionHider *,
html.kc-scanning #instructions{
  visibility:hidden !important;
  opacity:0 !important;
  transition:none !important;
  animation:none !important;
}
html.kc-scanning #spectButton::before,
html.kc-scanning #spectButton::after,
html.kc-scanning .switchsml::before,
html.kc-scanning .switchsml::after,
html.kc-scanning .sliderSml::before,
html.kc-scanning .sliderSml::after{
  visibility:hidden !important;
  opacity:0 !important;
  transition:none !important;
  animation:none !important;
}
`;

/** Keyed by the surface that installs it. */

/**
 * The update prompt. Bottom-right corner rather than centre screen, because
 * an update is never urgent enough to interrupt a round.
 */
const update = `
/*
 * Backdrop as well as a scrim: the menu behind is busy and high-contrast, and
 * dimming alone still left the panel competing with it. The blur is what
 * actually pushes the page back. backdrop-filter is composited, so it costs
 * nothing while the panel is closed and it is only ever up for a few seconds.
 */
#${UI_IDS.updatePanel}-backdrop{position:fixed;inset:0;z-index:var(--nm-z-update);
  background:var(--nm-game-scrim);backdrop-filter:blur(3px);
  display:flex;align-items:center;justify-content:center;
  opacity:0;transition:opacity var(--nm-med)}
#${UI_IDS.updatePanel}-backdrop.kc-in{opacity:1}

#${UI_IDS.updatePanel}{width:min(460px,92vw);background:var(--nm-game-bg);
  border:var(--nm-bw-thick) solid var(--nm-game-border);
  font-family:var(--nm-font-display);color:var(--nm-game-text);
  box-shadow:0 10px 40px var(--nm-shadow-mid);
  transform:scale(.96);transition:transform var(--nm-med)}
#${UI_IDS.updatePanel}-backdrop.kc-in #${UI_IDS.updatePanel}{transform:scale(1)}

#${UI_IDS.updatePanel} .hd{padding:15px 20px;background:var(--nm-game-bg-head);
  border-bottom:var(--nm-bw-thick) solid var(--nm-game-border);
  font-size:var(--nm-fs-4xl);letter-spacing:var(--nm-track-xl)}
#${UI_IDS.updatePanel} .bd{padding:20px}
#${UI_IDS.updatePanel} .msg{font-size:var(--nm-fs-xl);line-height:var(--nm-lh-loose);
  color:var(--nm-game-text-body)}
#${UI_IDS.updatePanel} .ver{color:var(--nm-ok)}
#${UI_IDS.updatePanel} .row{display:flex;gap:11px;margin-top:20px}
#${UI_IDS.updatePanel} button{flex:1;padding:12px 14px;cursor:pointer;font:inherit;
  font-size:var(--nm-fs-lg);letter-spacing:var(--nm-track-md);

  color:var(--nm-game-text);background:var(--nm-upd-btn-bg);
  border:var(--nm-bw-thick) solid var(--nm-upd-btn-border);
  transition:background var(--nm-fast)}
#${UI_IDS.updatePanel} button:hover{background:var(--nm-upd-btn-bg-hover)}
#${UI_IDS.updatePanel} button.go{background:var(--nm-upd-go-bg);
  border-color:var(--nm-upd-go-border)}
#${UI_IDS.updatePanel} button.go:hover{background:var(--nm-upd-go-bg-hover)}
/* Track is always drawn so the panel doesn't resize when the bar appears. */
#${UI_IDS.updatePanel} .bar{height:8px;background:var(--nm-upd-btn-bg);
  border:var(--nm-bw) solid var(--nm-upd-btn-border);margin-top:16px}
#${UI_IDS.updatePanel} .bar i{display:block;height:100%;width:0;
  background:var(--nm-upd-go-border);transition:width var(--nm-slow)}
`;

/**
 * The main-menu skin.
 *
 * Mostly paint, and where it does move a box it says why.
 *
 * The one lesson worth carrying: an earlier cut set left/right on
 * `#subLogoButtons` to make the play row span the frame, and the row vanished.
 * Not because moving it is forbidden — because Krunker centres it with
 * `left:50%` AND `transform:translate(-50%,0)`, so a full-width element got
 * shifted half its new width off the side of the screen. The transform has to
 * be cleared in the same rule. Read what the game already sets before
 * overriding half of it.
 *
 * Hiding a leaf (the ping icon) is fine. Reversing the two lines inside the
 * class card is fine too: that element is already a flex column, so the order
 * flips without the box changing.
 *
 * Specificity: Krunker styles its menu by ID and marks the button colours
 * `!important`, so a bare class rule here silently never applies. Anything
 * that has to win says so, and leans on an ID selector to outrank the game's
 * own `!important` rather than hoping cascade order is enough.
 *
 * Selectors were read off the running client, not guessed. The menu's newer
 * parts are Svelte-compiled and their classes carry a per-build hash
 * (`menuItem svelte-fgmdj8`), so nothing here matches a hash — only ids and
 * the stable half of a class name.
 *
 * Before editing any of this, read "Restyling Krunker" at the bottom of
 * `krunker/constants.ts`. It is the list of things the game's CSS does to a
 * rule you write against it, and every entry on it is a bug that shipped.
 */
const menuSkin = `
/* ---- top bar ---- */
#signupRewardsButton{display:none !important}
#signedOutHeaderBar [class*="ph-icon"]{display:none !important}
#signedOutHeaderBar [class*="ph-login-wrap"],#playerHeaderEl #${UI_IDS.scriptsButton}{
  display:inline-flex !important;align-items:center !important;justify-content:center !important;
  box-sizing:border-box !important;height:34px !important;min-height:34px !important;
  max-height:34px !important;padding:0 16px !important;margin:0 !important;
  font-family:var(--nm-menu-font) !important;font-size:var(--nm-fs-xs) !important;
  letter-spacing:var(--nm-track-xl) !important;text-transform:uppercase !important;
  line-height:1 !important;white-space:nowrap !important;
  border:var(--nm-bw) solid var(--nm-menu-line-hi) !important;border-radius:0 !important;
  background:var(--nm-menu-fill) !important;
  transition:border-color var(--nm-fast),background var(--nm-fast)}
#signedOutHeaderBar [class*="ph-login-wrap"]:hover,
#playerHeaderEl #${UI_IDS.scriptsButton}:hover{border-color:var(--nm-menu-bone) !important;
  background:var(--nm-menu-wash) !important}
#playerHeaderEl .ph-label,#playerHeaderEl .nav-label{font-family:var(--nm-menu-font) !important;
  font-size:var(--nm-fs-xs) !important;letter-spacing:var(--nm-track-xl) !important;
  text-transform:uppercase !important;color:var(--nm-menu-ash) !important;
  text-shadow:none !important;transition:color var(--nm-fast)}
#playerHeaderEl .ph-item:hover .ph-label,#playerHeaderEl .nav-item:hover .nav-label{
  color:var(--nm-menu-bone) !important}
/* Icon text is the ligature name, so uppercase must never reach it. */
#playerHeaderEl .ph-icon,#playerHeaderEl .nav-mat-icon{text-transform:none !important;
  color:var(--nm-menu-ash) !important;text-shadow:none !important}
#playerHeaderEl .verticalSeparator{background:var(--nm-menu-line-hi) !important;opacity:1 !important}
/* Notifications, and the separators that only existed to fence it off. */
#playerHeaderEl .headerBarRight [class*="nav-notif-section"],
#playerHeaderEl .headerBarRight .verticalSeparator{display:none !important}
/* Settings and More Krunker are labels now, so their icons go with them. One
   rule rather than matching ligature text per item. */
#playerHeaderEl .headerBarRight [class*="nav-mat-icon"]{display:none !important}
/* Krunker draws a box behind a hovered nav item. The label is the affordance;
   the box makes these read as buttons next to the plain Changelog link. */
#playerHeaderEl .headerBarRight [class*="nav-item"]{background:none !important}
#playerHeaderEl .headerBarRight [class*="nav-item"]:hover{background:none !important;
  box-shadow:none !important;transform:none !important}
/* The gap either side of the divider has to be the divider's own, or the two
   buttons sit at different distances from it. */
#signedOutHeaderBar [class*="verticalSeparator"]{margin:0 14px !important}

/* ---- left rail ---- */
/* An inset shadow rather than a positioned pseudo-element: same 2px bar, but
   it needs no containing block, so nothing here has to touch position. */
/* Krunker nudges the row sideways on hover. Pinning both the transform and the
   left padding in BOTH states is what stops it; the row lights up instead. */
#menuItemContainer .menuItem{position:relative !important;transform:none !important;
  padding:9px 12px 9px 16px !important;margin:0 !important;
  transition:background var(--nm-fast)}
#menuItemContainer .menuItem:hover{transform:none !important;
  padding:9px 12px 9px 16px !important;background:var(--nm-menu-wash) !important}
/* The marker starts as a bare vertical stroke and turns into a chevron: same
   element throughout, so it reads as one mark moving rather than two states
   swapping. Borders rather than a filled box, because a chevron is two edges
   of a square rotated 45 degrees. */
#menuItemContainer .menuItem::before{content:'';position:absolute;left:3px;top:50%;
  box-sizing:border-box;width:0;height:14px;margin-top:-7px;opacity:0;
  border-right:var(--nm-bw-thick) solid var(--nm-menu-ember);
  border-top-width:0;border-top-style:solid;border-top-color:var(--nm-menu-ember);
  transform-origin:center}
#menuItemContainer .menuItem:hover::before{
  animation:kc-menu-arrow var(--nm-menu-arrow) ease forwards}
@keyframes kc-menu-arrow{
  0%{opacity:0;width:0;height:14px;margin-top:-7px;border-top-width:0;transform:rotate(0deg)}
  45%{opacity:1;width:0;height:14px;margin-top:-7px;border-top-width:0;transform:rotate(0deg)}
  100%{opacity:1;width:7px;height:7px;margin-top:-4px;
    border-top-width:var(--nm-bw-thick);transform:rotate(45deg)}}
#menuItemContainer .menuItemTitle{font-family:var(--nm-menu-font) !important;
  font-size:var(--nm-fs-xl) !important;letter-spacing:var(--nm-track-sm) !important;
  text-transform:uppercase !important;color:var(--nm-menu-ash) !important;
  text-shadow:none !important;transition:color var(--nm-fast)}
#menuItemContainer .menuItem:hover .menuItemTitle{color:var(--nm-menu-bone) !important}
#menuItemContainer .menuItemIcon{text-transform:none !important;
  color:var(--nm-menu-ash) !important;text-shadow:none !important}
/* Krunker groups the list with rules, which is what made the gaps uneven.
   Every row now sits on the same rhythm and the grouping goes. */
#menuItemContainer .sidebarDivider{display:none !important}
/* An empty promo row sat between two of the entries and read as a dead gap. */
#updateAd{display:none !important}
/* The "spin available" pill hanging off Store. Matched as "any element inside
   the label" and "anything in the row that is not the icon or the label", so
   it does not depend on the pill's own Svelte-hashed class. */
#menuBtnShop > *{display:none !important}
#menuItemShop > :not([class*="menuItemIcon"]):not([class*="menuItemTitle"]){display:none !important}

/* ---- client wordmark, above Krunker's menu list ---- */
#${UI_IDS.menuMark}{display:flex;align-items:baseline;gap:9px;
  padding:0 0 16px 14px;margin:0 20px 12px 0;
  border-bottom:var(--nm-bw) solid var(--nm-menu-line)}
#${UI_IDS.menuMark} b{font-family:var(--nm-font-display);font-size:var(--nm-fs-7xl);
  font-weight:400;letter-spacing:var(--nm-track-xs);color:var(--nm-menu-bone)}
#${UI_IDS.menuMark} b i{font-style:normal;color:var(--nm-menu-ember)}
#${UI_IDS.menuMark} span{margin-left:auto;font-family:var(--nm-menu-font);
  font-size:var(--nm-fs-2xs);letter-spacing:var(--nm-track-xl);
  color:var(--nm-menu-ash);font-variant-numeric:tabular-nums}

/* ---- click to play ---- */
/* Krunker pulses this on scale() at 36px. Wide tracking and an opacity
   breathe say the same thing without being the loudest object on screen. */
#instructions{font-family:var(--nm-menu-font) !important;font-size:var(--nm-fs-xl) !important;
  letter-spacing:var(--nm-menu-track-cta) !important;text-indent:var(--nm-menu-track-cta) !important;
  text-transform:uppercase !important;color:var(--nm-menu-bone) !important;
  text-shadow:0 2px 18px var(--nm-menu-cta-shadow) !important;
  animation:kc-menu-breathe var(--nm-menu-breathe) ease-in-out infinite !important}
@keyframes kc-menu-breathe{0%,100%{opacity:.8}50%{opacity:1}}

/* ---- match info ---- */
/* "Now Playing:" is a bare text node with no element of its own, so zeroing
   the parent and restoring the child is the only way to drop just that half. */
#mapInfoHld{font-size:0 !important}
#mapInfoHld #mapInfo{font-family:var(--nm-font-display) !important;
  font-size:var(--nm-fs-7xl) !important;color:var(--nm-menu-bone) !important;
  text-shadow:none !important;letter-spacing:var(--nm-track-xs) !important}
/* The map name and the two actions beside it, on one baseline. */
.kc-menu-matchline{display:flex !important;align-items:baseline !important;
  gap:20px !important}
.kc-menu-matchline [class*="match-info-actions"]{margin:0 !important;
  display:flex !important;align-items:baseline !important;gap:12px !important}
#menuRegionLabel{font-family:var(--nm-menu-font) !important;font-size:var(--nm-fs-xs) !important;
  letter-spacing:var(--nm-track-3xl) !important;text-transform:uppercase !important;
  color:var(--nm-menu-ash) !important;text-shadow:none !important}
/* Bone at rest, not ash.
   These read as greyed out after you use one, and the reason is the size of
   the step back: hovering lit them from ash to bone, so letting go dropped
   them two thirds of the way to the background — right at the moment you had
   just clicked, which makes it look like a response to the click. Krunker
   changes nothing on click; measured with our own stylesheet stood down, the
   colour and opacity are constant through the whole cycle. So the fix is to
   stop resting so dim. Full strength at rest, white on hover. */
#matchInfoHolder .match-action-btn{font-family:var(--nm-menu-font) !important;
  font-size:var(--nm-fs-md) !important;letter-spacing:var(--nm-track-3xl) !important;
  text-transform:uppercase !important;color:var(--nm-menu-bone) !important;
  text-shadow:none !important;transition:color var(--nm-fast)}
#matchInfoHolder .match-action-btn:hover{color:var(--nm-menu-bone-hi) !important}
#matchInfoHolder .match-action-sep{opacity:1 !important;
  font-size:var(--nm-fs-md) !important}
/*
 * The width floor belongs to Invite alone — its label becomes "Copied URL"
 * and back, and without a floor the separator and Join move each way.
 *
 * Right-aligned, not left. The slack has to go somewhere, and on the right it
 * sat between Invite and the separator while Join sat hard against it, so the
 * pair read as lopsided. On the left it falls into the gap that was already
 * there after the map name, and both words end up the separator's own
 * distance from it.
 *
 * In LAYOUT pixels: the label measures about 85 on screen at this size, and
 * the whole UI is scaled 0.869, so it needs ~98 of these.
 */
/* justify-content, not text-align. Krunker makes this button a flex
   container, and in one of those the label is an anonymous flex item that
   text-align cannot move — it is applied and simply does nothing. Measured
   with the alignment "set": the glyphs sat 39.6px short of the box's right
   edge, so the gap to the divider was 50px against Join's 10.4. */
#inviteButton{min-width:104px !important;
  justify-content:flex-end !important;text-align:right !important}
/* Clicking Invite swaps its label to "Copied URL" and back a moment later,
   and the row twitched each way.
   Measured on the running client rather than guessed at, twice: the font
   size, the height and the transform are all UNCHANGED through the whole
   thing. It is the label. "Invite" is 43px wide and "Copied URL" is 72, so
   the control resizes to its own text and everything beside it reflows.
   A floor wide enough for the longer word is the fix; the transform and type
   below are only insurance. Left-aligned so the word does not jump either. */
#inviteButton,#menuBtnJoin,#inviteButton *,#menuBtnJoin *,
#inviteButton:hover,#menuBtnJoin:hover,#inviteButton:active,#menuBtnJoin:active,
#matchInfoHolder .match-action-btn,#matchInfoHolder .match-action-btn:hover,
#matchInfoHolder .match-action-btn:active{
  /* Krunker rests these at opacity .7, which on top of the skin's mid grey
     reads as a control that has been switched off. Full strength; the colour
     already carries how quiet they are meant to be. */
  opacity:1 !important;
  transform:none !important;animation:none !important;
  font-family:var(--nm-menu-font) !important;font-size:var(--nm-fs-md) !important;
  line-height:1 !important;letter-spacing:var(--nm-track-3xl) !important;
  text-transform:uppercase !important;white-space:nowrap !important}
#matchInfoHolder .match-action-sep{color:var(--nm-menu-line-hi) !important;text-shadow:none !important}

/* ---- telemetry ---- */
/* Same trick as the map name: the unit is a text node beside the numeral, so
   the small size goes on the parent and the numeral takes its own back.
   #menuFPS keeps the colour Krunker sets inline on it, deliberately — that is
   already a green-to-red threshold and it is the one status colour on this
   screen worth reading. */
#menuFPSDisplay,#menuPingDisplay{font-family:var(--nm-menu-font) !important;
  font-size:var(--nm-fs-2xs) !important;letter-spacing:var(--nm-track-3xl) !important;
  text-transform:uppercase !important;color:var(--nm-menu-ash-dim) !important;
  text-shadow:none !important}
#menuFPS,#menuPingText{font-family:var(--nm-menu-font) !important;
  font-size:var(--nm-fs-7xl) !important;letter-spacing:var(--nm-track-xs) !important;
  font-variant-numeric:tabular-nums;text-shadow:none !important}
#menuPingText{color:var(--nm-menu-bone) !important}
#menuPingText::after{content:' MS';font-size:var(--nm-fs-2xs);
  letter-spacing:var(--nm-track-3xl);color:var(--nm-menu-ash-dim)}
#menuPingIcon{display:none !important}

/* ---- the command bar ---- */
/* Krunker centres this with left:50% plus translate(-50%). Clearing left/right
   without clearing the transform is what shifted it off screen. */
#subLogoButtons{left:0 !important;right:0 !important;bottom:24px !important;
  transform:none !important;
  display:grid !important;grid-template-columns:repeat(5,1fr);
  gap:var(--nm-gap);padding:0 26px;box-sizing:border-box}
/*
 * The match info spans the whole bar; the five buttons take a column each.
 *
 * The two paddings do different jobs and neither is decoration.
 *
 * padding-bottom is the gap down to the play row, and dropping it from 14
 * to 4 is what moves the map name and Invite/Join down: this block is pinned
 * by its bottom edge, so space removed below the line is the only thing that
 * lowers it. Space added above would grow the block upwards and leave the
 * line exactly where it was.
 *
 * Everything here is space, and space is the only lever, because this block
 * is pinned by its bottom edge. Shrink it anywhere and the whole thing slides
 * down: the map name, the FPS row, and chat with them, since chat is placed
 * off the top of this block in preload/chat-place.ts.
 *
 * padding-top is the exception. It sits above the first row, so it moves the
 * block's top edge and nothing else, which makes it the one control over how
 * far up chat sits. It is also the entire gap between the chat input and the
 * map name, so it cannot go to zero: at 30 chat covered Community & Events at
 * the foot of the nav, at 0 it sat on the map name again. 16 clears both.
 *
 * Do not reach for a transform on the line itself. Measured: translating
 * .kc-menu-matchline down 40px moved #subLogoButtons from 916 to -129 and
 * took the play row off the top of the screen.
 */
#matchInfoHolder{grid-column:1/-1;
  border-bottom:var(--nm-bw) solid var(--nm-menu-line) !important;
  padding-top:16px !important;
  padding-bottom:0 !important;margin-bottom:0 !important;gap:4px !important}
/* Krunker's own margins would show up as gaps between grid cells. */
#subLogoButtons > .button{margin:0 !important;width:auto !important}
/* The class card would otherwise sit under the bar now that it reaches the
   right edge. Its transform-origin is bottom right, so raising bottom moves it
   straight up. */
#menuClassContainer{bottom:210px !important}

/* ---- play row: one primary, one accent, three quiet ---- */
/* Krunker ships five buttons in five hues, two of them the same red for
   different actions, and nothing marking the one you press every time. */
#subLogoButtons > .button{border:var(--nm-bw) solid var(--nm-menu-line-hi) !important;
  border-radius:0 !important;background:var(--nm-menu-fill) !important;
  color:var(--nm-menu-ash) !important;text-shadow:none !important;
  transition:color var(--nm-fast),border-color var(--nm-fast),background var(--nm-fast)}
#subLogoButtons > .button:hover{transform:none !important;color:var(--nm-menu-bone) !important;
  border-color:var(--nm-menu-bone) !important;background:var(--nm-menu-wash) !important}
#subLogoButtons > .button:active{transform:none !important}
#subLogoButtons > #menuBtnQuickMatch.button{background:var(--nm-menu-bone) !important;
  border-color:var(--nm-menu-bone) !important;color:var(--nm-menu-ink) !important}
#subLogoButtons > #menuBtnQuickMatch.button:hover{background:var(--nm-menu-bone-hi) !important;
  border-color:var(--nm-menu-bone-hi) !important;color:var(--nm-menu-ink) !important}
#subLogoButtons > #menuBtnRanked.button{border-color:var(--nm-menu-ember) !important;
  color:var(--nm-menu-ash) !important;background:var(--nm-menu-fill) !important}
#subLogoButtons > #menuBtnRanked.button:hover{background:var(--nm-menu-ember) !important;
  border-color:var(--nm-menu-ember) !important;color:var(--nm-menu-ink) !important}
#menuBtnRanked .menuItemRankedLabel{background:var(--nm-menu-ember) !important;
  color:var(--nm-menu-ash) !important;border-radius:0 !important;transform:none !important;
  animation:none !important;font-family:var(--nm-menu-font) !important;
  font-size:var(--nm-fs-2xs) !important;letter-spacing:var(--nm-track-lg) !important;
  font-weight:400 !important;text-shadow:none !important}

/* ---- class card ---- */
/* The weapon is the headline and the class is its subtitle, so the class goes
   under it. Already a flex column, so reversing changes order and nothing else. */
#menuClassContainerInfo{flex-direction:column-reverse !important}
/*
 * Slide the character render right, off the middle of its own card.
 *
 * Krunker parks it with #classPreviewCanvas{margin-right:-113px}. The canvas
 * sits on its own line above #menuClassContainerInner — that is what the
 * -100px margin-bottom is for, pulling the card back up under it — so this
 * margin moves the render and nothing else. In a text-align:right container
 * a negative right margin hangs the box past the right edge, so a bigger
 * negative number is further right.
 *
 * It reads as left-heavy because the weapon points left: the body is already
 * near the card's centre, and the barrel is the part that runs off the side.
 * Moving the whole render right balances that. 87px here is 53px on screen —
 * #menuClassContainer is scale(0.7) inside #uiBase's 0.869, so lengths in this
 * subtree land at ~0.61x. The render still clears the right edge of the
 * viewport with room to spare; the overhang was already clipped there before.
 */
#classPreviewCanvas{margin-right:-200px !important}
#menuClassName{font-family:var(--nm-menu-font) !important;font-size:var(--nm-fs-xs) !important;
  letter-spacing:var(--nm-track-3xl) !important;text-transform:uppercase !important;
  color:var(--nm-menu-ash) !important;text-shadow:none !important}
#menuClassSubtext{color:var(--nm-menu-bone) !important;text-shadow:none !important}
#menuClassContainer .button{font-family:var(--nm-menu-font) !important;
  font-size:var(--nm-fs-2xl) !important;letter-spacing:var(--nm-track-xl) !important;
  text-transform:uppercase !important;border:var(--nm-bw) solid var(--nm-menu-line-hi) !important;
  border-radius:0 !important;background:var(--nm-menu-fill) !important;
  color:var(--nm-menu-ash) !important;text-shadow:none !important;
  transition:color var(--nm-fast),border-color var(--nm-fast),background var(--nm-fast)}
#menuClassContainer .button:hover{color:var(--nm-menu-bone) !important;
  border-color:var(--nm-menu-bone) !important;background:var(--nm-menu-wash) !important;
  filter:none !important;transform:none !important}
#menuClassContainer .button .material-icons{text-transform:none !important;
  color:var(--nm-menu-ash) !important;text-shadow:none !important}

/* ---- scripts button, at the front of Krunker's own nav ---- */
#playerHeaderEl #${UI_IDS.scriptsButton}{width:auto !important;
  /* A child of .headerBarRight, which is a flex row that stretches its items.
     Without this the 34px height loses to the 61px bar. */
  align-self:center !important;flex:0 0 auto !important;
  margin:0 !important;cursor:pointer !important;color:var(--nm-menu-ash) !important;
  text-shadow:none !important;transform:none !important}
#playerHeaderEl #${UI_IDS.scriptsButton}:hover{color:var(--nm-menu-bone) !important;
  transform:none !important;filter:none !important}
/* Krunker's own separators in this bar are hidden further up, so ours is a
   separate element rather than one of theirs turned back on. */
#playerHeaderEl #${UI_IDS.headerSeparator}{align-self:center !important;flex:0 0 auto !important;
  width:var(--nm-bw) !important;height:30px !important;margin:0 16px !important;
  background:var(--nm-menu-line-hi) !important}

/* Krunker's own Changelog link, relocated out of the footer to sit beside
   More Krunker. Matched to the nav labels it now stands with. */
.headerBarRight .kc-menu-headerlink{font-family:var(--nm-menu-font) !important;
  font-size:var(--nm-fs-xs) !important;letter-spacing:var(--nm-track-xl) !important;
  text-transform:uppercase !important;color:var(--nm-menu-ash) !important;
  text-decoration:none !important;text-shadow:none !important;
  margin-left:var(--nm-gap-lg);transition:color var(--nm-fast)}
.headerBarRight .kc-menu-headerlink:hover{color:var(--nm-menu-bone) !important}

/* ---- chat ---- */
/*
 * Krunker draws chat as two rounded translucent boxes with grey pills inside
 * the input bar. Against this menu that reads as a leftover from a different
 * screen, so it gets the same treatment as everything else here: one flat
 * panel, hairline border, square corners.
 *
 * Menu only, and deliberately. In a match the chat sits over live gameplay
 * where Krunker's translucency is doing a job, and a solid panel there would
 * be worse, not better. The onMenu class on #uiBase is the game's own flag
 * for which of the two you are looking at.
 *
 * Message text is left alone. Krunker colours names by team and channel, and
 * a blanket colour here would flatten all of that into one grey.
 */
#${KRUNKER_DOM_IDS.uiBase}.${KRUNKER_MENU_CLASS} #${KRUNKER_DOM_IDS.chatList}{
  background:var(--nm-menu-panel) !important;
  border:var(--nm-bw) solid var(--nm-menu-line) !important;
  /* No bottom edge: the input bar below supplies it, so the two read as one
     panel with a divider rather than two boxes that happen to touch. */
  border-bottom:none !important;border-radius:0 !important;
  padding:10px 12px !important;box-sizing:border-box !important}
#${KRUNKER_DOM_IDS.uiBase}.${KRUNKER_MENU_CLASS} #${KRUNKER_DOM_IDS.chatInputHolder}{
  background:var(--nm-menu-panel) !important;
  border:var(--nm-bw) solid var(--nm-menu-line) !important;
  border-radius:0 !important;overflow:hidden !important}
/* The three grey pills inside the bar. Krunker fills each one; here the panel
   is the fill and a single rule between them is enough to group them. */
#${KRUNKER_DOM_IDS.uiBase}.${KRUNKER_MENU_CLASS} #${KRUNKER_DOM_IDS.chatInputHolder} .greyInlineInner,
#${KRUNKER_DOM_IDS.uiBase}.${KRUNKER_MENU_CLASS} #${KRUNKER_DOM_IDS.chatInputHolder} .greyInlineInnerMid{
  background:transparent !important;border-radius:0 !important;
  color:var(--nm-menu-ash) !important;text-shadow:none !important}
#${KRUNKER_DOM_IDS.uiBase}.${KRUNKER_MENU_CLASS} #${KRUNKER_DOM_IDS.chatInputHolder} .greyInlineInnerMid{
  border-left:var(--nm-bw) solid var(--nm-menu-line) !important;
  border-right:var(--nm-bw) solid var(--nm-menu-line) !important}
#${KRUNKER_DOM_IDS.uiBase}.${KRUNKER_MENU_CLASS} #${KRUNKER_CHAT.inputId}{
  background:transparent !important;border:none !important;border-radius:0 !important;
  color:var(--nm-menu-bone) !important;text-shadow:none !important;
  font-family:var(--nm-menu-font) !important}
#${KRUNKER_DOM_IDS.uiBase}.${KRUNKER_MENU_CLASS} #${KRUNKER_CHAT.inputId}::placeholder{
  color:var(--nm-menu-ash-dim) !important;text-transform:uppercase !important;
  letter-spacing:var(--nm-track-md) !important}
/* Krunker's scrollbar is a light grey slab; this one is meant to be found and
   otherwise ignored. */
#${KRUNKER_DOM_IDS.uiBase}.${KRUNKER_MENU_CLASS} #${KRUNKER_DOM_IDS.chatList}::-webkit-scrollbar{
  width:6px}
#${KRUNKER_DOM_IDS.uiBase}.${KRUNKER_MENU_CLASS} #${KRUNKER_DOM_IDS.chatList}::-webkit-scrollbar-track{
  background:transparent}
#${KRUNKER_DOM_IDS.uiBase}.${KRUNKER_MENU_CLASS} #${KRUNKER_DOM_IDS.chatList}::-webkit-scrollbar-thumb{
  background:var(--nm-menu-line-hi);border-radius:0}
`;

/**
 * Krunker's own windows: settings, login, loadout, customize, and the popups.
 *
 * WHY ALMOST NOTHING HERE NAMES A CONTAINER, which is the lesson that cost a
 * release: the first version of this sheet scoped every rule to `#menuWindow`
 * and friends — container ids read out of Krunker's stylesheet and assumed to
 * cover the rest. The settings window happened to be one of them. The login
 * modal was not, so it came through completely unstyled.
 *
 * The scoping was never needed. Krunker's primitives are global classes —
 * `.button`, `.settName`, `.slider`, `.inputGrey` — and the menu skin's own
 * rules for the few of them it reuses are all ID-scoped
 * (`#subLogoButtons > .button`, `#menuClassContainer .button`). An ID beats a
 * class, so a bare `.button` rule here cannot reach the play row however hard
 * it tries. Specificity does the scoping, and it does it for every window at
 * once, including the ones nobody has enumerated.
 *
 * The panel itself still needs a handle, because a modal's outer box has no
 * shared class at all. `menu-skin.ts` tags those by shape rather than by name
 * — positioned, visible, horizontally centred, big enough to be a window —
 * and this styles `.kc-menu-modal`.
 *
 * Before editing, read "Restyling Krunker" at the bottom of
 * `krunker/constants.ts`.
 */
const krunkerWindows = `
/* ---- the panel, and what it sits on ---- */
#windowHolder.popupWin,#popupBack,#guidePopupH{background:var(--nm-menu-scrim) !important}
/* Krunker pads the window 20px all round. On the right that left the row
   hairlines stopping short of the edge with the scrollbar just past them,
   which reads as a black bar rather than as margin. Zero, so the rows run to
   the scrollbar and there is no strip left to notice. */
#menuWindow{padding-right:0 !important}
#menuWindow,#menuWindow.dark,#popupContent,#policePopC,#guidePopup,.kc-menu-modal{
  background:var(--nm-menu-panel) !important;
  border:var(--nm-bw) solid var(--nm-menu-line) !important;border-radius:0 !important;
  box-shadow:none !important;color:var(--nm-menu-bone) !important}
#menuWindow.dark div{color:inherit}
/* A modal's own title bar and banner rows carry their own fills. */
.kc-menu-modal [style*="background"]{border-radius:0 !important}

/* ---- tab strip ---- */
#settingsTabLayout{background:none !important;border-radius:0 !important;
  border-bottom:var(--nm-bw) solid var(--nm-menu-line) !important}
.settingTab{background:none !important;border-radius:0 !important;
  font-family:var(--nm-menu-font) !important;font-size:var(--nm-fs-md) !important;
  letter-spacing:var(--nm-track-lg) !important;text-transform:uppercase !important;
  color:var(--nm-menu-ash) !important;text-shadow:none !important;
  border-bottom:var(--nm-bw-thick) solid var(--nm-menu-scrim-0) !important;
  transition:color var(--nm-fast),border-color var(--nm-fast)}
.settingTab:hover{color:var(--nm-menu-bone) !important;
  border-bottom-color:var(--nm-menu-line-hi) !important}
.settingTab.tabA{background:none !important;color:var(--nm-menu-bone) !important;
  border-bottom-color:var(--nm-menu-ember) !important}

/* ---- section headings ---- */
/* Krunker draws these as a raised grey box with a four-pixel border. A label
   over a rule reads as structure rather than as one more control. */
.setHed,.setHedS{background:none !important;border:0 !important;
  border-bottom:var(--nm-bw) solid var(--nm-menu-line) !important;border-radius:0 !important;
  font-family:var(--nm-menu-font) !important;font-size:var(--nm-fs-md) !important;
  letter-spacing:var(--nm-track-3xl) !important;text-transform:uppercase !important;
  color:var(--nm-menu-ash-dim) !important;text-shadow:none !important;
  padding:0 0 8px !important;margin:26px 0 12px !important}
.setHed:hover,.setHedS:hover{background:none !important;color:var(--nm-menu-ash) !important}
.setHed .material-icons,.setHedS .material-icons{text-transform:none !important}
.setBodH{background:none !important;border-radius:0 !important;
  margin-left:0 !important;padding-left:0 !important;padding-right:0 !important;
  width:100% !important}

/* ---- rows ---- */
.settName,.settNameSmall{font-family:var(--nm-menu-font) !important;
  font-size:var(--nm-fs-lg) !important;letter-spacing:var(--nm-track-xs) !important;
  color:var(--nm-menu-ash) !important;text-shadow:none !important;
  border-bottom:var(--nm-bw) solid var(--nm-menu-line) !important}
.settNameIn:hover{background:var(--nm-menu-wash) !important;
  color:var(--nm-menu-bone) !important;border-radius:0 !important}

/* ---- toggles ---- */
/* Krunker's blue is the last saturated colour in these windows once the greys
   are ours, and marking state is the accent's job. */
.slider,.sliderSml,.sliderCent{background:var(--nm-menu-line-hi) !important;
  border-radius:0 !important}
.slider:before,.sliderSml:before,.sliderCent:before{
  background:var(--nm-menu-bone) !important;border-radius:0 !important}
input:checked + .slider,input:checked + .sliderSml,input:checked + .sliderCent{
  background:var(--nm-menu-ember) !important}
input:checked + .slider:before,input:checked + .sliderSml:before,
input:checked + .sliderCent:before{background:var(--nm-menu-ink) !important}

/* ---- ranges and their value boxes ---- */
.sliderM{background:var(--nm-menu-line-hi) !important;border-radius:0 !important;
  height:4px !important}
.sliderM::-webkit-slider-thumb{background:var(--nm-menu-bone) !important;
  border-radius:0 !important;width:5px !important;height:18px !important}
.sliderM::-moz-range-thumb{background:var(--nm-menu-bone) !important;
  border-radius:0 !important;width:5px !important;height:18px !important;border:0 !important}
.sliderVal{border:var(--nm-bw) solid var(--nm-menu-line-hi) !important;
  border-style:solid !important;border-radius:0 !important;
  background:var(--nm-menu-fill) !important;color:var(--nm-menu-bone) !important;
  font-family:var(--nm-menu-font) !important;font-size:var(--nm-fs-md) !important;
  text-shadow:none !important}

/* ---- inputs ---- */
/* These ship light grey, which is a white box sitting in a dark window. Fields
   stay window-scoped: the game's chat box is an input too. */
.inputGrey,.inputGrey2,
#menuWindow input[type="text"],#menuWindow input[type="password"],
#menuWindow input[type="email"],#menuWindow select,
#popupContent input,#popupContent select,
.kc-menu-modal input[type="text"],.kc-menu-modal input[type="password"],
.kc-menu-modal input[type="email"],.kc-menu-modal select{
  background:var(--nm-menu-fill) !important;color:var(--nm-menu-bone) !important;
  border:var(--nm-bw) solid var(--nm-menu-line-hi) !important;border-radius:0 !important;
  font-family:var(--nm-menu-font) !important;font-size:var(--nm-fs-md) !important;
  text-shadow:none !important}
#menuWindow input::placeholder,#popupContent input::placeholder,
.kc-menu-modal input::placeholder{color:var(--nm-menu-ash-dim) !important}
#menuWindow input:focus,#popupContent input:focus,.kc-menu-modal input:focus{
  border-color:var(--nm-menu-bone) !important;outline:none !important}

/* ---- the small coloured action buttons ---- */
/* Import / Export / Reset ship in three different hues. */
.settingsBtn{background:var(--nm-menu-fill) !important;
  border:var(--nm-bw) solid var(--nm-menu-line-hi) !important;border-radius:0 !important;
  color:var(--nm-menu-ash) !important;font-family:var(--nm-menu-font) !important;
  font-size:var(--nm-fs-xs) !important;letter-spacing:var(--nm-track-lg) !important;
  text-transform:uppercase !important;text-shadow:none !important;
  transition:color var(--nm-fast),border-color var(--nm-fast),background var(--nm-fast)}
.settingsBtn:hover{color:var(--nm-menu-bone) !important;
  border-color:var(--nm-menu-bone) !important;background:var(--nm-menu-wash) !important}
/* Hidden header controls, marked by menu-skin.ts.
   A class rather than an inline style, because the sizing rule below sets
   display:inline-flex !important and an inline display:none loses to it —
   which is exactly why Manage Ads kept coming back. Two classes beat one. */
#menuWindow .settingsBtn.kc-menu-hidden,#menuWindow .kc-menu-hidden{display:none !important}
/* One height across the header strip, taken from the preset dropdown. */
#menuWindow .settingsBtn,#menuWindow select{
  height:30px !important;min-height:30px !important;box-sizing:border-box !important;
  display:inline-flex !important;align-items:center !important;justify-content:center !important;
  padding:0 12px !important;width:auto !important;min-width:78px !important;
  vertical-align:middle !important;margin:0 3px !important}
/*
 * The Advanced switch.
 *
 * Its whole visible self is one empty div. The track is .advancedSlider, the
 * knob is its ::before, and the word "Advanced" is its ::after — a content
 * string, not a text node. That is why three attempts at finding it by its
 * label came back with nothing: there is no element in the document that says
 * "Advanced" anywhere.
 *
 * Same language as every other toggle in here: track and knob swap on state,
 * and the accent marks on.
 */
#menuWindow .advancedSlider{background:var(--nm-menu-line-hi) !important;
  border-radius:0 !important;transition:background var(--nm-fast)}
#menuWindow .advancedSlider::before{background:var(--nm-menu-bone) !important;
  border-radius:0 !important}
#menuWindow .advancedSlider::after{font-family:var(--nm-menu-font) !important;
  font-size:var(--nm-fs-xs) !important;letter-spacing:var(--nm-track-lg) !important;
  text-transform:uppercase !important;color:var(--nm-menu-bone) !important;
  text-shadow:none !important}
#menuWindow input:checked + .advancedSlider{background:var(--nm-menu-ember) !important}
#menuWindow input:checked + .advancedSlider::before{background:var(--nm-menu-ink) !important}
#menuWindow input:checked + .advancedSlider::after{color:var(--nm-menu-ink) !important}


/* ---- buttons ---- */
/* Global on purpose. The menu skin's own button rules are all ID-scoped, so
   they outrank this and the play row is untouched — see the note at the top. */
.button{border:var(--nm-bw) solid var(--nm-menu-line-hi) !important;
  border-radius:0 !important;background:var(--nm-menu-fill) !important;
  color:var(--nm-menu-ash) !important;text-shadow:none !important;
  transition:color var(--nm-fast),border-color var(--nm-fast),background var(--nm-fast)}
.button:hover{transform:none !important;color:var(--nm-menu-bone) !important;
  border-color:var(--nm-menu-bone) !important;background:var(--nm-menu-wash) !important}
.button:active{transform:none !important}
/* Krunker marks the action it wants you to take with a saturated fill — the
   green Login, Register here, Equip. Same rank, the skin's own accent. */
.button.buttonG,.button.buttonGreen,.termsBtn{
  border-color:var(--nm-menu-ember) !important;color:var(--nm-menu-ember) !important;
  background:var(--nm-menu-ember-wash) !important}
.button.buttonG:hover,.button.buttonGreen:hover,.termsBtn:hover{
  background:var(--nm-menu-ember) !important;color:var(--nm-menu-ink) !important;
  opacity:1 !important}

/* ---- window furniture ---- */
table.twoFATable td{background:var(--nm-menu-fill) !important;
  border-radius:0 !important;color:var(--nm-menu-bone) !important}
table.twoFATable td:hover{background:var(--nm-menu-wash) !important}
.instructionsTabs{background:none !important;
  border-bottom:var(--nm-bw) solid var(--nm-menu-line) !important}
.instructionsTab{color:var(--nm-menu-ash) !important;text-shadow:none !important;
  font-family:var(--nm-menu-font) !important;font-size:var(--nm-fs-md) !important;
  letter-spacing:var(--nm-track-lg) !important;text-transform:uppercase !important}
.instructionsTab:hover{color:var(--nm-menu-bone) !important}

/* The scrollbar, which otherwise reads as a black bar down the right edge of
   an otherwise flat panel. */
#menuWindow::-webkit-scrollbar{width:8px}
#menuWindow::-webkit-scrollbar-track{background:none}
#menuWindow::-webkit-scrollbar-thumb{background:var(--nm-menu-line-hi);border-radius:0}
#menuWindow::-webkit-scrollbar-thumb:hover{background:var(--nm-menu-ash-dim)}

/* ---- the section index, once the skin is on ---- */
/* Drawn in Krunker's greys by its own sheet, which is right without the skin
   because it sits on the game's grey panel. With the skin that panel is ours. */
#menuWindow #${UI_IDS.sectionNav}{border-right-color:var(--nm-menu-line) !important;
  font-family:var(--nm-menu-font) !important}
#menuWindow .kc-sectnav-item{font-size:var(--nm-fs-md) !important;
  letter-spacing:var(--nm-track-sm) !important;text-transform:uppercase !important;
  color:var(--nm-menu-ash-dim) !important;background:none !important;
  border-left-color:var(--nm-menu-scrim-0) !important}
#menuWindow .kc-sectnav-item:hover{color:var(--nm-menu-bone) !important;
  background:var(--nm-menu-wash) !important}
#menuWindow .kc-sectnav-item.kc-sectnav-on{color:var(--nm-menu-bone) !important;
  background:var(--nm-menu-wash) !important;
  border-left-color:var(--nm-menu-ember) !important}
`;

export const SHEETS = {
  toast,
  tooltip,
  perfHud,
  watermark,
  queueButton,
  altModal,
  rankedPanel,
  hardpointCounter,
  scriptsModal,
  changelog,
  menuButtons,
  chatTags,
  chatMerge,
  chatPlace,
  settings,
  sectionNav,
  scan,
  update,
  menuSkin,
  krunkerWindows,
  hudMinimal,
} as const;
