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

/**
 * Krunker's host window, which is what a `nmnez://` host link fills in.
 *
 * The whole competitive lobby setup is the game's own: team names, rosters,
 * per-class limits and, at the bottom, a webhook field Krunker itself POSTs
 * the final scoreboard to. So hosting from a link is not a thing we
 * implement, it is a form we fill in and a button we press. That is worth
 * knowing before anyone goes looking for our own lobby API: there isn't one,
 * and there shouldn't be.
 *
 * Three globals and a pile of ids, so all of it breaks together when Krunker
 * moves any of it. `preload/protocol/host.ts` checks each one is there before
 * it touches anything and says which is missing when it isn't.
 */
export const KRUNKER_HOST = {
  /**
   * `openHostWindow(advanced, tab)`. False is the simple view, 1 is the
   * custom-games tab, which is the one with a map list on it.
   */
  openHostWindow: 'openHostWindow',
  /** Index into the game's `windows[]` for that window. */
  windowIndex: 7,
  /** Its tab carrying the custom-game settings, via `switchTab`. */
  settingsTab: 2,
  /** Creates the room from whatever the form now says. */
  createPrivateRoom: 'createPrivateRoom',
  /**
   * Present once the game has finished loading, i.e. `KRUNKER_MENU_CLASS` on
   * `#uiBase`.
   *
   * Hosting has to wait for this, and nothing earlier will do. Measured on a
   * cold start: the globals below exist at 1.7s and the play buttons at the
   * same time, but the menu flag only appears at 7.4s. Open the host window
   * in that gap and it draws its tabs with an empty map list and never
   * fills it in, so the map never gets ticked and the lobby goes up on
   * whatever was already selected. Opened the instant this flag appears, the
   * cards are there a second later.
   */
  menuReady: '#uiBase.onMenu',
  /**
   * Krunker's loading backdrop, which fades to nothing about a second after
   * the flag above. In a match the menu flag is off, so this is the other
   * way to know the game is up rather than still loading.
   */
  loadingBackdropId: 'instructionsFadeBG',
  /** Present once the host window has drawn its first tab. */
  readyMarker: '.hostTb0',
  /** A map card's label. The checkbox is its sibling inside the card. */
  mapNameSelector: '.hostMap .hostMapName',
  ids: {
    team1Name: 'customSnameTeam1',
    team2Name: 'customSnameTeam2',
    /** A `<select>` of indices, not labels. Matched on option text. */
    teamSize: 'customStmSize',
    spectatorSlots: 'customSspecSlots',
    /** Who is allowed in on each side, comma separated. */
    team1Roster: 'compRosterT1',
    team2Roster: 'compRosterT2',
    spectatorRoster: 'compRosterSpecs',
    /** Krunker posts the match result here when the game ends. */
    webhook: 'customSwebhook',
    /** Suffixed with the index of a class in `classOrder` below. */
    classLimitPrefix: 'customSclassLim',
  },
  /**
   * The order the per-class limit inputs are numbered in, which is the only
   * thing that maps a weapon name onto `#customSclassLim7`. Positional, so an
   * update that inserts a class shifts every one after it.
   */
  classOrder: [
    'ak',
    'sniper',
    'smg',
    'lmg',
    'shotgun',
    'rev',
    'semi',
    'rpg',
    'uzi',
    'runner',
    'deagler',
    'crossbow',
    'famas',
    'blaster',
    'survivor',
    'infiltrator',
  ],
  /**
   * Writes one of the game's own settings.
   *
   * There is no matching getter on `window`; `getSetting` does not exist.
   * Krunker's own region dropdown carries
   * `onchange="window.setSetting('defaultRegion', this.value)"`, which is
   * where both of the next two values come from.
   */
  setSetting: 'setSetting',
  /** The setting naming the region a hosted game goes up in. */
  regionSetting: 'defaultRegion',
  /**
   * Where that setting lands, and so the only way to read it back.
   *
   * Confirmed by writing `defaultRegion` and watching this key change with
   * it. The digit on the end looks like a schema version, so treat a missing
   * key as "no idea" rather than as a region.
   */
  regionStorageKey: 'pingRegion7',
} as const;

/**
 * The crosshair, the hitmarker and the sky, which is everything the client
 * draws over the game's own art. All of it read off the running game on
 * 2026-09-12, most of it in a live match.
 *
 * THE CROSSHAIR IS NOT IN THE DOM, whatever the DOM suggests. There is an
 * `<img id="aimDot">` at the centre of the screen with a reticle in it, CSS
 * that centres it, and a `window.updateAimDot(index, customUrl)` to point it
 * at a numbered reticle or a URL. All of it is dead. In a live match it sits
 * at `opacity: 0` with the game's crosshair on Dynamic, on Image, after
 * updateAimDot(-2, url), and after updateAimDot(0). Nothing the game does
 * raises it. The four bars you actually see are drawn by the renderer, from
 * the settings below. So a client that wants its own crosshair draws its own
 * crosshair; see preload/look/crosshair.ts.
 *
 * THE HITMARKER IS A SOUND. There is an `<img id="hitmarker">` too, and it is
 * just as suspect: across a long spray in a live match nothing ever touched
 * it. It may still work; we never landed a shot while watching it, so this is
 * "unknown", not "dead". What is certain is `window.SOUND`, the game's own
 * audio manager, whose `soundCats` lists `hit_0`, `headshot_0` and
 * `instantkill_0`, and whose `play(name)` the built-in headshot script has
 * hooked for months. A shot landing plays `hit_0`. That is the signal the
 * client's hitmarker runs on: it fires on the frame the game decides you
 * connected, and it cannot drift from what you hear.
 */
export const KRUNKER_LOOK = {
  /**
   * The game's own audio manager, on `window`.
   *
   * `SOUND.play(name, volume, ...)`, and `SOUND.soundCats` is where the names
   * come from. Only the hit family is used here; see preload/look/hitmarker.ts.
   */
  soundManager: 'SOUND',
  /**
   * The sniper scope overlay: a full-screen holder that fades in when you
   * raise a scope, with the scope image and four blackout panels in it.
   *
   * Only used as a signal. It is the one thing on screen that says "the game
   * is drawing its own aiming furniture right now", which is when a crosshair
   * of ours should get out of the way.
   */
  scopeId: 'aimRecticle',
  /**
   * Map data, which is where the sky colour is decided.
   *
   * `https://gapi.svc.krunker.io/maps/14` answers `{"data":{...}}` with
   * `sky:"#dce8ed"`, `skyDome:true`, `skyDomeCol0..2`, `fog`, `fogD`,
   * `ambient` and `light`. Matching on the path alone also catches the map
   * *list* endpoints, which have no `sky` in them, so the rewrite checks for
   * the field rather than trusting the URL.
   */
  mapDataPath: '/maps/',
  /**
   * The flat sky colour, and the textured dome that covers it.
   *
   * Setting the colour alone does nothing on most maps: the dome is painted
   * over the top of it. Both have to move together, which is why turning the
   * sky on turns the dome off.
   *
   * The colour comes back either way round, and both have been seen on the
   * live game on the same day: map 14 answers `sky:"#dce8ed"` and map 2, the
   * one the menu itself is built on, answers `sky:14477549`, which is that
   * same colour packed into an integer. Read the type before writing one.
   */
  skyKey: 'sky',
  skyDomeKey: 'skyDome',
  /**
   * Krunker's own crosshair, as one setting.
   *
   *   0 Off, 1 Dynamic, 2 Shapes, 3 Layered, 4 Image, 5 Precision
   *
   * Read off its own dropdown in Settings, Game, Crosshair, which carries
   * `onchange="window.setSetting('crosshairSho', this.value)"`. 1 is the
   * default. 4 is the mode that takes a URL, i.e. the one that leaves people
   * with no crosshair when the URL dies.
   *
   * The client offers to switch this off, because ours is drawn on top of it
   * and two crosshairs is one too many. Offers, rather than does it: this is
   * the player's own game setting, and a client that quietly rewrites those
   * is a client you cannot trust with the rest of them.
   */
  crosshairSetting: 'crosshairSho',
  crosshairOff: '0',
  /** What "on" goes back to, which is what a fresh Krunker account has. */
  crosshairDefault: '1',
  /**
   * The game's own hitmarker, which is a plain on/off rather than a list.
   *
   * Its checkbox carries `onclick="window.setSetting('hitm', this.checked)"`,
   * so it stores the string 'true' or 'false'. Same reason as the crosshair:
   * ours is drawn over the top of it.
   */
  hitmarkerSetting: 'hitm',
  /**
   * Where `setSetting` puts a value: one localStorage key per setting, named
   * with this prefix. There is no `getSetting`, so this is the only way to
   * read one back.
   *
   * Confirmed by writing `crosshairSho` and watching `kro_setngss_crosshairSho`
   * appear holding the value. A missing key means the setting has never been
   * changed, i.e. it is still at the game's default.
   */
  settingKeyPrefix: 'kro_setngss_',
  /**
   * Wall textures for the crosshair preview, so it is judged against what it
   * will actually sit on rather than against a grey box.
   *
   * The game's own, and already downloaded: every one of these is fetched
   * during the menu's own load, so the preview costs nothing and cannot look
   * like some other game's wall. Tiny tiles (100 to 5000 bytes) meant to be
   * repeated, hence the pixelated rendering in the sheet. Dropping the
   * `?build=` token still resolves, checked with a bare request.
   */
  previewTextures: [
    { name: 'Wall', url: 'https://assets.krunker.io/textures/wall_0.png' },
    { name: 'Brick', url: 'https://assets.krunker.io/textures/brick_0.png' },
    { name: 'Sand', url: 'https://assets.krunker.io/textures/sand_0.png' },
    { name: 'Grass', url: 'https://assets.krunker.io/textures/grass_0.png' },
  ],
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
