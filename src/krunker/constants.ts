/**
 * Everything we're coupled to inside Krunker, in one file.
 *
 * These are the values that break when the game ships an update: DOM ids, the
 * index of a window object, asset ids for props we block. The clients we
 * cribbed from scatter these across a dozen modules, so every game update
 * turns into a repo-wide search. Keeping them together means a break is one
 * file to go through.
 *
 * The rule: if a literal only makes sense because of how Krunker is built, it
 * goes here and not at the place that uses it.
 *
 * At the bottom of this file, under "Restyling Krunker", is the same idea for
 * behaviour rather than values: what the game's own CSS and menu code do to a
 * rule you write against them. Read it before restyling anything of theirs.
 */

/** Origins we treat as the game itself. Anything else is untrusted. */
export const KRUNKER_ORIGINS = ['https://krunker.io', 'https://browserfps.com'] as const;

export const KRUNKER_URLS = {
  game: 'https://krunker.io/',
  social: 'https://krunker.io/social.html',
} as const;

/**
 * Index into Krunker's global `windows[]` for the in-game player list, whose
 * `genList()` returns an HTML string. Checked against the game on 2026-09-01.
 * Worth re-checking any time an update moves the player list.
 */
export const PLAYER_LIST_WINDOW_INDEX = 22;

/**
 * Where player names are drawn, for the two surfaces worth colouring.
 *
 * Both put the clan tag in a nested span rather than in the name text, so
 * the two can be styled apart without parsing anything. Read off the running
 * game in a live match; the shapes were:
 *
 *   <div class="leaderItem">
 *     <div class="leaderCounter">2.</div>
 *     <div class="leaderName">Player_3<span style="color:#fff"> [X]</span></div>
 *     <div class="leaderScore">0</div>
 *
 *   <td class="pListName">
 *     <span class="pListPing material-icons" ...>signal_cellular_alt</span>
 *     <a onclick='openPlayerProfile("Player_3")'>Player_3<span> [X]</span></a>
 *
 * `leaderNameM` is your own row; the player list gives your own name as bare
 * text in the cell with no anchor around it, which is why that selector takes
 * the cell and the anchor both.
 */
export const KRUNKER_NAMES = {
  leaderContainerId: 'leaderContainer',
  leaderNameSelector: '.leaderName, .leaderNameM',
  playerListNameSelector: '.pListName > a, .pListName',
} as const;

/** DOM ids Krunker renders that we read or overwrite. */
export const KRUNKER_DOM_IDS = {
  hudPing: 'pingText',
  menuPing: 'menuPingText',
  chatList: 'chatList',
  /** The positioned wrapper around chat; `chatList` inside it is not placed. */
  chatHolder: 'chatHolder',
  /** The bar under the messages: channel globe, the input, the mic toggle. */
  chatInputHolder: 'chatInputHolder',
  /** The team score strip. Its mutations are the hardpoint counter's clock. */
  teamScores: 'teamScores',
  /** Krunker's left menu list. Chat has to stop before it reaches this. */
  menuNav: 'menuItemContainer',
  /** Wraps the whole UI and carries the menu/match flag below. */
  uiBase: 'uiBase',
  /**
   * The menu's bottom block: map name, Invite, Join and the five big buttons.
   * Measured to work out how far chat has to lift to clear it.
   */
  menuBottomBlock: 'subLogoButtons',
} as const;

/**
 * The class Krunker puts on `#uiBase` while the menu is up, and takes off
 * once you are in a match.
 *
 * Worth knowing about generally: it is the only flag I have found that is a
 * class on a static element rather than something that gets rebuilt, so it is
 * the one thing a stylesheet can key "only on the menu" off.
 */
export const KRUNKER_MENU_CLASS = 'onMenu';

/**
 * Markup the hardpoint counter reads.
 *
 * The two team headers sit beside their score, which is the next element
 * along rather than a child of either. Your own team carries `you`, which is
 * the only way to tell which score is the enemy's.
 */
export const KRUNKER_TEAM_SCORES = {
  /** Both team headers. The enemy is whichever one is not yours. */
  headers: '#tScoreC1, #tScoreC2',
  /** On your own team's header. */
  ownTeamClass: 'you',
  /** Where the HUD's small readouts live, top right. */
  counterStrip: '.topRightCounters',
  /** Krunker's own class for one of those readouts, and its inner box. */
  counterClass: 'statIcon',
  counterInnerClass: 'greyInner',
  /** Present in competitive matches; the fallback for detecting hardpoint. */
  competitiveHeader: '.cmpTmHed',
} as const;

/** Krunker markup the chat features depend on. */
export const KRUNKER_CHAT = {
  /** Each message element's id begins with this. */
  messageIdPrefix: 'chatMsg_',
  /** The text body inside a message; the sender name sits outside it. */
  messageBodyClass: 'chatMsg',
  /** Wrapper carrying the sender name and the message. */
  itemClass: 'chatItem',
  /**
   * Krunker wraps sender names in LEFT-TO-RIGHT MARKs, so a real player
   * message always has "‎:" in it and a system message never does. As far as
   * I can tell that's the only reliable way to tell them apart.
   */
  senderMarker: '‎:',
  /** `data-tab` value that marks a message as team chat rather than all-chat. */
  teamTabValue: '1',
  /** The globe button beside the chat input; controls the OUTGOING channel. */
  switchId: 'chatSwitch',
  switchHolderId: 'chatSwitchHolder',
  inputId: 'chatInput',
  /**
   * `#chatSwitch`'s `data-tab` cycles between these two. They are not the
   * same values a message's own `data-tab` uses ('1' / '0'), which is worth
   * knowing before you assume otherwise. Read off the live game.
   */
  switchTeamValue: 'groups',
  switchAllValue: 'public',
} as const;

/**
 * Gamemodes with teams, where team and all chat are actually different things.
 * In a free-for-all every message is all-chat, so tagging every line [M] would
 * just be noise.
 */
export const TEAM_MODES: ReadonlySet<string> = new Set([
  'Team Deathmatch',
  'Hardpoint',
  'Capture the Flag',
  'Hide & Seek',
  'Infected',
  'Last Man Standing',
  'Simon Says',
  'Prop Hunt',
  'Kill Confirmed',
  'Domination',
  'Blitz',
  'Raid',
  'Turf War',
  'Gun Game Team',
  'Team Defender',
]);

/**
 * `user-assets.krunker.io` ids for decorative props that cost frame time.
 * Blocking `model.obj` drops the whole prop. A bare id blocks the entire
 * asset folder.
 */
export const BLOCKABLE_ASSETS = {
  /** Bunny NPCs. 60585 is a whole-folder block; the rest are model-only. */
  bunnies: {
    folders: [60585],
    models: [61806, 61814, 61815, 61818, 61820, 61821, 61822, 61823, 61824],
  },
  /** Turf Wars clan banners (EnvRankBanner prop variants). */
  turfBanners: {
    folders: [] as number[],
    models: [64295, 64300, 64301, 64303],
  },
} as const;

/*
 * ---------------------------------------------------------------------------
 * Restyling Krunker: what its CSS does, and what that costs you
 * ---------------------------------------------------------------------------
 *
 * Read before writing a rule against the game's own markup. Every item here
 * was paid for: each one is a bug that shipped, or nearly did. All verified
 * against the running client on 2026-09-10.
 *
 * 1. THE GAME STYLES BY ID, AND MARKS COLOUR !IMPORTANT.
 *    `.buttonP { border: 4px solid ... !important }`, `#customizeButton
 *    { width: 449px; font-size: 27px !important }`. A bare class rule of ours
 *    silently never applies. Anything that has to win needs `!important` AND
 *    an ID selector to outrank theirs. Cascade order is not enough. When a
 *    rule "does nothing", check the computed style before rewriting it.
 *
 * 2. THINGS ARE CENTRED WITH left:50% PLUS A TRANSFORM.
 *    `#subLogoButtons { left: 50%; transform: translate(-50%,0) scale(.95) }`.
 *    Override left/right without clearing the transform and the element is
 *    shifted half its NEW width off the side of the screen. It looks deleted;
 *    it is off-canvas. Clear the transform in the same rule.
 *
 * 3. #menuClassContainer IS scale(0.7), transform-origin bottom right.
 *    getBoundingClientRect() therefore reports 0.7x the CSS size: feeding a
 *    measured width back into a style shrinks it every pass. Read the number
 *    off the `#customizeButton` rule instead (see accounts/menu-buttons.ts).
 *    Because the origin is the bottom right, `bottom` alone moves it.
 *
 * 4. THE NEWER MENU IS SVELTE, AND ITS CSS IS NOT IN ANY STYLESHEET.
 *    Classes carry a per-build hash: `menuItem svelte-fgmdj8`. Match the
 *    stable fragment with [class*="..."], never the hash. And the rules
 *    themselves are injected from the JS bundle at runtime: none of the menu
 *    component classes appear in main.css or bundledStyles.css, so you cannot
 *    read them from the downloaded CSS. Read them off the live DOM.
 *
 * 5. main.css IS THE WHOLE GAME, NOT THE MENU.
 *    ~2081 rules, of which roughly 38 touch the home menu. It also covers the
 *    HUD, scoreboard, chat, shop and end screen. There is no "menu
 *    stylesheet" to swap.
 *
 * 6. DO NOT REMOVE AN ELEMENT THE GAME LOOKS UP BY ID.
 *    Taking `#gameNameHolder` out of the document made Krunker's menu setup
 *    call getElementById on an id that no longer resolved; it threw partway
 *    through, so the loading backdrop never faded and no play button was ever
 *    wired up. Black screen, dead clicks, and CI green throughout. Prefer
 *    `display:none`, it is not laid out, painted or hit-tested either, so
 *    removal buys nothing and bets on their internals.
 *
 * 7. MATERIAL ICONS CARRY THE LIGATURE NAME AS TEXT.
 *    `text-transform: uppercase` on an ancestor renders the words
 *    "keyboard_arrow_down" instead of an arrow. Scope case changes to the
 *    label element, and set `text-transform:none` on the icon anyway.
 *
 * 8. SOME LABELS ARE BARE TEXT NODES WITH NO ELEMENT.
 *    "Now Playing:" in #mapInfoHld, " FPS" in #menuFPSDisplay. To restyle or
 *    drop only that half: `font-size:0` on the parent, real size back on the
 *    child element.
 *
 * 9. THE GAME SETS INLINE STYLES FROM ITS OWN JS.
 *    #menuFPS gets its colour written inline as the number changes. A
 *    stylesheet loses to that unless it says !important, which is sometimes
 *    what you want, since that particular colour is a real threshold.
 *
 * 10. .bigShadowT AND .button:hover FIGHT BACK.
 *     The first sets a twelve-layer text-shadow !important; the second forces
 *     a white border !important and `transform: scale(0.95)`. Overriding the
 *     look of a button means overriding all three.
 *
 * 11. THE MENU REBUILDS AS YOU NAVIGATE.
 *     Anything injected has to be re-applied by a MutationObserver, not once
 *     on load, or it is gone the first time a submenu opens and closes.
 *
 * 12. STACKING: #uiBase (z:1) holds #gameUI (z:1) and #fullMenHider (auto),
 *     and #menuHolder (z:10) sits inside the latter, so the menu paints above
 *     #instructionHolder. A backdrop added inside #menuHolder needs
 *     `z-index:-1`, not 0, a positioned child at 0 paints above its in-flow
 *     siblings and would cover the nav instead of sitting behind it.
 *
 * 13. A SOLID DARK SCREEN MEANS MENU INIT THREW.
 *     #instructionsFadeBG is a solid #222 that fades out when the menu is
 *     ready. If it never fades, something earlier in their setup died: look
 *     for a null from an element we moved or removed, not for a CSS bug.
 *
 * 14. NONE OF THIS IS REACHABLE FROM THE TEST SUITE.
 *     typecheck, lint and the unit tests cannot see whether the menu loads.
 *     Item 6 shipped through a fully green CI run. A change to the game's own
 *     markup is verified by launching the client and looking at it, or it is
 *     not verified.
 */

/** True when `url` is the game or one of its mirrors. */
export function isKrunkerOrigin(url: string): boolean {
  try {
    return (KRUNKER_ORIGINS as readonly string[]).includes(new URL(url).origin);
  } catch {
    return false;
  }
}
