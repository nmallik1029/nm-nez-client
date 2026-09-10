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

/** DOM ids Krunker renders that we read or overwrite. */
export const KRUNKER_DOM_IDS = {
  hudPing: 'pingText',
  menuPing: 'menuPingText',
  chatList: 'chatList',
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

/** True when `url` is the game or one of its mirrors. */
export function isKrunkerOrigin(url: string): boolean {
  try {
    return (KRUNKER_ORIGINS as readonly string[]).includes(new URL(url).origin);
  } catch {
    return false;
  }
}
