import { SHEETS, STYLE_IDS } from '../shared/ui';
import { toggleStyle } from './style';

/**
 * The minimal in-game HUD, as a stylesheet you can switch on.
 *
 * All of it is CSS, so this is one call either way and there is nothing to
 * put back — which is the difference between this and the menu skin, where a
 * few elements genuinely have to move. Turning it off restores Krunker's own
 * HUD by removing the sheet, not by undoing anything.
 *
 * The rules live in `shared/ui/hud-minimal.css` rather than in `sheets.ts`
 * because they are a user's own theme rather than part of this client's
 * design system.
 *
 * WHAT WAS TAKEN OUT OF THE ORIGINAL, and why. It broke the main menu while
 * being fine in a match, because roughly a third of it was aimed at the menu:
 *
 *  - `.menuItemTitle { display: none }`, twice. That is every label in the
 *    left menu, so the menu became a column of icons with no words.
 *  - `.button, .button:hover { border: 0 }`. Krunker draws the play buttons
 *    entirely as a 4px border, so this erased Quick Match, Ranked, Host, Find
 *    and Custom Games down to floating text.
 *  - `#gameNameHolder`, `#mapInfoHld`, `#infoHolder`, `#bubbleContainer`,
 *    `#tlInfHold`, `#headerRight` and friends out of the big display:none
 *    list: the logo, the map name, the rewards panel, the header.
 *  - The `::after` renames on `#menuBtnHost`, `#menuBtnBrowser`,
 *    `#inviteButton`, `#menuBtnJoin`, `#customizeButton` and
 *    `#signedOutHeaderBar`, each setting `font-size: 0` on the real label and
 *    drawing a replacement. They fight anything else that sizes those, and
 *    they hard-code English.
 *  - `#menuClassIcn`, `#menuClassName`, `#menuClassSubtext`,
 *    `#classPreviewCanvas`, `#menuClassNameTag` — the whole class card.
 *  - `#instructions` and its `::after`, which replaced CLICK TO PLAY.
 *  - `backdrop-filter: blur(3.3px)` on `.button, .menuItem`. Every menu
 *    button and row became a live blur layer, which on a client built around
 *    frame pacing is the one worth refusing outright rather than merely
 *    scoping.
 *
 * Three more went as already broken rather than as conflicts:
 *
 *  - `--gameInfoColor`, `--healthTextColor` and `--debugColor` were `#fffff`
 *    — five digits. Not a colour; the browser drops the declaration.
 *  - `#matchInfo::after` drew a variable nothing defines, so it rendered
 *    nothing while `#matchInfo` itself was set to font-size 0. That hid the
 *    match info rather than restyling it.
 *  - The avatar override pointed at a Discord CDN link with an expiry stamp
 *    in its query string. Those are signed URLs; it had already lapsed, and
 *    it is a network fetch on every load either way.
 */
export function setHudStyle(on: boolean): void {
  toggleStyle(STYLE_IDS.hudMinimal, SHEETS.hudMinimal, on);
}
