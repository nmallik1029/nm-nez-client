import { KRUNKER_DOM_IDS } from '../../krunker/constants';
import { UI_IDS } from './ids';
import { SCAN_THUMB, SCAN_TIMING } from './tokens';

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
  font-weight:600;font-size:var(--nm-fs-2xs);line-height:var(--nm-lh-mono);
  font-family:var(--nm-font-mono);letter-spacing:var(--nm-track-xs);
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
.kc-has-sectnav{padding-left:190px !important}
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
#${UI_IDS.sectionNav}{float:left;width:172px;margin-left:-190px;
  overflow-y:auto;overscroll-behavior:contain;
  padding:2px 12px 2px 0;box-sizing:border-box;
  border-right:var(--nm-bw) solid var(--nm-kr-rule);
  font-family:var(--nm-font);font-size:var(--nm-fs-md);
  /* Above the rows, so a wide row can't paint over the index. */
  position:relative;z-index:var(--nm-z-raise)}
/* No scrollbar of its own: one panel should not show two. */
#${UI_IDS.sectionNav}::-webkit-scrollbar{width:0}
/*
 * Krunker's greys, not ours. This sits ON the game's settings panel, which is
 * a mid grey — reaching for --nm-surface here paints a near-black block on it.
 */
/* Wraps rather than clipping. "Crosshair (Third Person)" truncated to
   "Crosshair (Th..." beside a "Crosshair" above it is worse than useless —
   the two entries read as the same section. */
.kc-sectnav-item{padding:8px 12px;margin:0 0 1px;
  color:var(--nm-kr-text-dim);cursor:pointer;
  line-height:var(--nm-lh-tight);overflow-wrap:anywhere;
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
/* One node, three gradients, no hit-testing, painted below the whole menu. */
#${UI_IDS.menuScrim}{position:absolute;inset:0;pointer-events:none;
  z-index:var(--nm-menu-z-scrim);
  background-image:
    linear-gradient(180deg,var(--nm-menu-scrim),var(--nm-menu-scrim-0)),
    linear-gradient(90deg,var(--nm-menu-scrim),var(--nm-menu-scrim-soft) 46%,var(--nm-menu-scrim-0)),
    linear-gradient(0deg,var(--nm-menu-scrim) 38%,var(--nm-menu-scrim-mid) 70%,var(--nm-menu-scrim-0));
  background-repeat:no-repeat;
  background-size:100% 17%,21% 100%,100% 40%;
  background-position:top,left,bottom}

/* ---- top bar ---- */
#signupRewardsButton{display:none !important}
/* The scrim is the ground now; a flat black bar on top of it reads as a seam. */
#playerHeaderEl{background:none !important}
#signedOutHeaderBar [class*="ph-icon"]{display:none !important}
#signedOutHeaderBar [class*="ph-login-wrap"],#playerHeaderEl #${UI_IDS.altManagerButton}{
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
#playerHeaderEl #${UI_IDS.altManagerButton}:hover{border-color:var(--nm-menu-bone) !important;
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

/* ---- left rail ---- */
/* An inset shadow rather than a positioned pseudo-element: same 2px bar, but
   it needs no containing block, so nothing here has to touch position. */
/* Krunker nudges the row sideways on hover. Pinning both the transform and the
   left padding in BOTH states is what stops it; the row lights up instead. */
#menuItemContainer .menuItem{position:relative !important;transform:none !important;
  padding-left:16px !important;transition:background var(--nm-fast)}
#menuItemContainer .menuItem:hover{transform:none !important;padding-left:16px !important;
  background:var(--nm-menu-wash) !important}
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
  font-size:var(--nm-fs-xl) !important;letter-spacing:var(--nm-track-xl) !important;
  text-transform:uppercase !important;color:var(--nm-menu-ash) !important;
  text-shadow:none !important;transition:color var(--nm-fast)}
#menuItemContainer .menuItem:hover .menuItemTitle{color:var(--nm-menu-bone) !important}
#menuItemContainer .menuItemIcon{text-transform:none !important;
  color:var(--nm-menu-ash) !important;text-shadow:none !important}
#menuItemContainer .sidebarDivider{background:var(--nm-menu-line) !important;opacity:1 !important;
  height:1px !important;margin:10px 0 !important}
/* An empty promo row sat between two of the entries and read as a dead gap. */
#updateAd{display:none !important}

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
#menuRegionLabel{font-family:var(--nm-menu-font) !important;font-size:var(--nm-fs-xs) !important;
  letter-spacing:var(--nm-track-3xl) !important;text-transform:uppercase !important;
  color:var(--nm-menu-ash) !important;text-shadow:none !important}
#matchInfoHolder .match-action-btn{font-family:var(--nm-menu-font) !important;
  font-size:var(--nm-fs-2xs) !important;letter-spacing:var(--nm-track-3xl) !important;
  text-transform:uppercase !important;color:var(--nm-menu-ash) !important;
  text-shadow:none !important;transition:color var(--nm-fast)}
#matchInfoHolder .match-action-btn:hover{color:var(--nm-menu-bone) !important}
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
/* The match info spans the whole bar; the five buttons take a column each. */
#matchInfoHolder{grid-column:1/-1;
  border-bottom:var(--nm-bw) solid var(--nm-menu-line) !important;
  padding-bottom:14px !important;margin-bottom:0 !important;gap:14px !important}
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
  color:var(--nm-menu-ember) !important;background:var(--nm-menu-ember-wash) !important}
#subLogoButtons > #menuBtnRanked.button:hover{background:var(--nm-menu-ember) !important;
  border-color:var(--nm-menu-ember) !important;color:var(--nm-menu-ink) !important}
#menuBtnRanked .menuItemRankedLabel{background:var(--nm-menu-ember) !important;
  color:var(--nm-menu-ink) !important;border-radius:0 !important;transform:none !important;
  animation:none !important;font-family:var(--nm-menu-font) !important;
  font-size:var(--nm-fs-2xs) !important;letter-spacing:var(--nm-track-lg) !important;
  font-weight:400 !important;text-shadow:none !important}

/* ---- class card ---- */
/* The weapon is the headline and the class is its subtitle, so the class goes
   under it. Already a flex column, so reversing changes order and nothing else. */
#menuClassContainerInfo{flex-direction:column-reverse !important}
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

/* ---- alt manager, once it has moved to the left end of the header ---- */
/* menu-buttons.ts copies Krunker's 449px button rule onto this element as an
   inline style so it matches the class card. In the header that is absurd, and
   an inline width only loses to !important. */
#playerHeaderEl #${UI_IDS.altManagerButton}{width:auto !important;
  margin-left:var(--nm-gap-lg) !important;color:var(--nm-menu-ash) !important;
  text-shadow:none !important;transform:none !important}
#playerHeaderEl #${UI_IDS.altManagerButton}:hover{color:var(--nm-menu-bone) !important;
  transform:none !important;filter:none !important}

/* Krunker's own Changelog link, relocated out of the footer to sit beside
   More Krunker. Matched to the nav labels it now stands with. */
.headerBarRight .kc-menu-headerlink{font-family:var(--nm-menu-font) !important;
  font-size:var(--nm-fs-xs) !important;letter-spacing:var(--nm-track-xl) !important;
  text-transform:uppercase !important;color:var(--nm-menu-ash) !important;
  text-decoration:none !important;text-shadow:none !important;
  margin-left:var(--nm-gap-lg);transition:color var(--nm-fast)}
.headerBarRight .kc-menu-headerlink:hover{color:var(--nm-menu-bone) !important}
`;

export const SHEETS = {
  toast,
  tooltip,
  perfHud,
  watermark,
  queueButton,
  altModal,
  changelog,
  menuButtons,
  chatTags,
  chatMerge,
  settings,
  sectionNav,
  scan,
  update,
  menuSkin,
} as const;
