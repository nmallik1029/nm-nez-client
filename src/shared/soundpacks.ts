/**
 * Soundpacks: sounds from other games, played in Krunker.
 *
 * Two kinds so far, each a tab in the QoL editor. Valorant's are kill streak
 * announcers, which play on top of the game (see killstreak.ts). Fortnite's
 * replace Krunker's own sounds: each gun's shot, the hit marker and the
 * headshot, one Fortnite gun picked per Krunker gun.
 *
 * HOW A FORTNITE SOUND REPLACES KRUNKER'S. Krunker loads every sound from
 * `https://assets.krunker.io/sound/<key>.mp3` and keeps it, and main answers
 * that request with the picked Fortnite file instead, the same way the
 * resource swapper answers a swapped texture. So the game plays it exactly
 * where it would have played its own: your shots, everyone else's shots
 * placed in 3D, at Krunker's own volume settings. Guns are keyed by the
 * number in their sound, `weapon_2` for the Assault Rifle, and a weapon
 * skin's own sound is `weapon_2_<n>`, which counts as the same gun: the pick
 * is for the gun, whatever skin is on it. The names are Krunker's own
 * `sound_list` and `SOUND.getSound` in its game.js.
 *
 * The Fortnite files come from the Fortnite wiki's ripped game audio, one
 * close-range shot per gun, trimmed and levelled to sit beside Krunker's own;
 * assets/README.md has how. They install as one pack, like a kill streak
 * pack, and nothing here plays until it is installed.
 */

/** A soundpack a tab can install: its folder under the soundpack folders, and the catalog's id. */
export const FORTNITE_PACK_ID = 'fortnite';

/** Where the editor asks for a soundpack file to preview it. Main answers it from disk. */
export const SOUNDPACK_BASE = 'https://assets.krunker.io/sounds/soundpacks/';

/** Krunker's own sounds, which a Fortnite pick replaces. */
export const KRUNKER_SOUND_BASE = 'https://assets.krunker.io/sound/';

/** A Krunker gun and the Fortnite guns that fit it, the best fit first. */
export interface KrunkerGun {
  /** The number in its sound key: `weapon_2` is 2. */
  readonly weapon: number;
  readonly name: string;
  readonly options: readonly string[];
}

/** Every Fortnite sound in the pack, by id. The id is the file name. */
export const FORTNITE_SOUNDS: Readonly<Record<string, string>> = {
  'assault-rifle-scar': 'SCAR',
  'assault-rifle': 'Assault Rifle',
  'heavy-assault-rifle': 'Heavy AR',
  'tactical-assault-rifle': 'Tactical AR',
  'mk-seven-assault-rifle': 'MK-Seven AR',
  'striker-ar': 'Striker AR',
  'red-eye-assault-rifle': 'Red-Eye AR',
  'nemesis-ar': 'Nemesis AR',
  'enforcer-ar': 'Enforcer AR',
  'infantry-rifle': 'Infantry Rifle',
  'havoc-suppressed-assault-rifle': 'Havoc Suppressed AR',
  'suppressed-assault-rifle': 'Suppressed AR',
  'scoped-assault-rifle': 'Scoped AR',
  'burst-assault-rifle': 'Burst AR',
  'striker-burst-rifle': 'Striker Burst Rifle',
  'bolt-action-sniper-rifle': 'Bolt-Action Sniper',
  'heavy-sniper-rifle': 'Heavy Sniper',
  'hunting-rifle': 'Hunting Rifle',
  'suppressed-sniper-rifle': 'Suppressed Sniper',
  'reaper-sniper-rifle': 'Reaper Sniper',
  'lever-action-rifle': 'Lever Action Rifle',
  'automatic-sniper-rifle': 'Automatic Sniper',
  'huntress-dmr': 'Huntress DMR',
  'rail-gun': 'Rail Gun',
  'submachine-gun': 'SMG',
  'compact-smg': 'Compact SMG',
  'suppressed-submachine-gun': 'Suppressed SMG',
  'rapid-fire-smg': 'Rapid Fire SMG',
  'stinger-smg': 'Stinger SMG',
  'twin-mag-smg': 'Twin Mag SMG',
  'hyper-smg': 'Hyper SMG',
  'harbinger-smg': 'Harbinger SMG',
  'burst-smg': 'Burst SMG',
  'thunder-burst-smg': 'Thunder Burst SMG',
  'dual-micro-smgs': 'Dual Micro SMGs',
  'light-machine-gun': 'LMG',
  minigun: 'Minigun',
  'drum-gun': 'Drum Gun',
  'legacy-drum-gun': 'Drum Gun (OG)',
  'pump-shotgun': 'Pump Shotgun',
  'tactical-shotgun': 'Tactical Shotgun',
  'heavy-shotgun': 'Heavy Shotgun',
  'combat-shotgun': 'Combat Shotgun',
  'hammer-pump-shotgun': 'Hammer Pump',
  'sovereign-shotgun': 'Sovereign Shotgun',
  'frenzy-auto-shotgun': 'Frenzy Auto Shotgun',
  'gatekeeper-shotgun': 'Gatekeeper Shotgun',
  'thunder-shotgun': 'Thunder Shotgun',
  'havoc-pump-shotgun': 'Havoc Pump',
  'ranger-shotgun': 'Ranger Shotgun',
  'drum-shotgun': 'Drum Shotgun',
  'prime-shotgun': 'Prime Shotgun',
  'sentinel-pump-shotgun': 'Sentinel Pump',
  revolver: 'Revolver',
  'scoped-revolver': 'Scoped Revolver',
  'wrecker-revolver': 'Wrecker Revolver',
  'makeshift-revolver': 'Makeshift Revolver',
  'hand-cannon': 'Hand Cannon',
  'legacy-hand-cannon': 'Hand Cannon (OG)',
  'mammoth-pistol': 'Mammoth Pistol',
  pistol: 'Pistol',
  'tactical-pistol': 'Tactical Pistol',
  'sidearm-pistol': 'Sidearm Pistol',
  'ranger-pistol': 'Ranger Pistol',
  'monarch-pistol': 'Monarch Pistol',
  'dual-pistols': 'Dual Pistols',
  'hop-rock-dualies': 'Hop Rock Dualies',
  'rocket-launcher': 'Rocket Launcher',
  'proximity-grenade-launcher': 'Proximity Launcher',
  'boom-bolt': 'Boom Bolt',
  'mechanical-bow': 'Mechanical Bow',
  'primal-bow': 'Primal Bow',
  grappler: 'Grappler',
  'pulse-rifle': 'Pulse Rifle',
  'blade-blaster': 'Blade Blaster',
  'kymera-ray-gun': 'Kymera Ray Gun',
  'stark-industries-energy-rifle': 'Stark Energy Rifle',
  'hit-body': 'Hit',
  'hit-body-2': 'Hit 2',
  'hit-body-3': 'Hit 3',
  'hit-shield': 'Shield hit',
  'hit-shield-2': 'Shield hit 2',
  'hit-shield-3': 'Shield hit 3',
  'hit-shield-4': 'Shield hit 4',
  'hit-critical': 'Headshot',
  'hit-crit-elimination': 'Headshot kill',
};

/**
 * Krunker's guns, in the order the editor lists them: the class guns, then
 * the secondaries. Guns with no Fortnite gun that fits (the Blaster, Zapper,
 * Slimer, War Machine and the rest) are left out and keep Krunker's sound.
 */
export const KRUNKER_GUNS: readonly KrunkerGun[] = [
  {
    weapon: 2,
    name: 'Assault Rifle',
    options: [
      'assault-rifle-scar', 'assault-rifle', 'heavy-assault-rifle', 'tactical-assault-rifle', 'mk-seven-assault-rifle',
      'striker-ar', 'red-eye-assault-rifle', 'nemesis-ar', 'enforcer-ar', 'infantry-rifle', 'havoc-suppressed-assault-rifle',
      'suppressed-assault-rifle', 'scoped-assault-rifle', 'burst-assault-rifle',
    ],
  },
  {
    weapon: 1,
    name: 'Sniper Rifle',
    options: [
      'bolt-action-sniper-rifle', 'heavy-sniper-rifle', 'hunting-rifle', 'suppressed-sniper-rifle', 'reaper-sniper-rifle',
      'lever-action-rifle', 'rail-gun',
    ],
  },
  {
    weapon: 4,
    name: 'Submachine Gun',
    options: [
      'submachine-gun', 'compact-smg', 'suppressed-submachine-gun', 'rapid-fire-smg', 'stinger-smg', 'twin-mag-smg',
      'hyper-smg', 'harbinger-smg', 'burst-smg', 'thunder-burst-smg',
    ],
  },
  { weapon: 7, name: 'Machine Gun', options: ['light-machine-gun', 'minigun', 'drum-gun', 'legacy-drum-gun'] },
  {
    weapon: 6,
    name: 'Shotgun',
    options: [
      'pump-shotgun', 'tactical-shotgun', 'heavy-shotgun', 'combat-shotgun', 'hammer-pump-shotgun', 'sovereign-shotgun',
      'frenzy-auto-shotgun', 'gatekeeper-shotgun', 'thunder-shotgun', 'havoc-pump-shotgun', 'ranger-shotgun',
      'drum-shotgun', 'prime-shotgun', 'sentinel-pump-shotgun',
    ],
  },
  { weapon: 5, name: 'Revolver', options: ['revolver', 'scoped-revolver', 'wrecker-revolver', 'makeshift-revolver', 'hand-cannon'] },
  {
    weapon: 8,
    name: 'Semi Auto',
    options: ['huntress-dmr', 'automatic-sniper-rifle', 'hunting-rifle', 'lever-action-rifle', 'scoped-assault-rifle'],
  },
  { weapon: 9, name: 'Rocket Launcher', options: ['rocket-launcher', 'proximity-grenade-launcher'] },
  { weapon: 10, name: 'Akimbo Uzi', options: ['dual-micro-smgs', 'dual-pistols', 'compact-smg'] },
  { weapon: 11, name: 'Desert Eagle', options: ['hand-cannon', 'legacy-hand-cannon', 'mammoth-pistol', 'revolver'] },
  { weapon: 14, name: 'Crossbow', options: ['boom-bolt', 'mechanical-bow', 'primal-bow'] },
  { weapon: 15, name: 'Famas', options: ['burst-assault-rifle', 'striker-burst-rifle', 'burst-smg', 'thunder-burst-smg'] },
  { weapon: 26, name: 'Minigun', options: ['minigun', 'light-machine-gun', 'drum-gun'] },
  { weapon: 29, name: 'Charge Rifle', options: ['rail-gun', 'pulse-rifle'] },
  { weapon: 3, name: 'Pistol', options: ['pistol', 'tactical-pistol', 'sidearm-pistol', 'ranger-pistol', 'monarch-pistol'] },
  { weapon: 17, name: 'Auto Pistol', options: ['tactical-pistol', 'rapid-fire-smg', 'pistol'] },
  { weapon: 28, name: 'Akimbo Pistol', options: ['dual-pistols', 'hop-rock-dualies'] },
  { weapon: 16, name: 'Sawed Off', options: ['heavy-shotgun', 'pump-shotgun', 'tactical-shotgun', 'drum-shotgun', 'combat-shotgun'] },
  { weapon: 22, name: 'Tehchy-9', options: ['burst-smg', 'tactical-pistol', 'thunder-burst-smg'] },
  { weapon: 23, name: 'Noob Tube', options: ['proximity-grenade-launcher', 'rocket-launcher'] },
  {
    weapon: 12,
    name: 'Alien Blaster',
    options: ['pulse-rifle', 'kymera-ray-gun', 'blade-blaster', 'stark-industries-energy-rifle'],
  },
  { weapon: 21, name: 'Grappler', options: ['grappler'] },
];

/** The hit marker: Krunker plays `hit_0` when a shot of yours lands anywhere but the head. */
export const HIT_OPTIONS: readonly string[] = [
  'hit-body', 'hit-body-2', 'hit-body-3', 'hit-shield', 'hit-shield-2', 'hit-shield-3', 'hit-shield-4',
];
/**
 * The headshot. Krunker has two sounds for it and this answers both. A shot
 * that lands on the head plays `crit_0` in place of `hit_0` (the same file
 * under another name, so in Krunker a headshot sounds like any hit), and a
 * kill with one plays `headshot_0`, which the built-in headshot script also
 * plays on every kill. Fortnite's headshot is the sound of the hit, so
 * answering only `headshot_0` would leave every headshot that does not kill
 * on Krunker's own.
 */
export const HEADSHOT_OPTIONS: readonly string[] = ['hit-critical', 'hit-crit-elimination'];

/** Krunker's sounds the headshot pick answers. See HEADSHOT_OPTIONS. */
const HEADSHOT_SOUNDS: ReadonlySet<string> = new Set(['crit_0', 'headshot_0']);

export interface FortniteConfig {
  readonly on: boolean;
  /**
   * The Fortnite sound for each Krunker gun, by weapon number. An empty
   * string keeps Krunker's own; a gun with no entry gets its first option.
   */
  readonly guns: Readonly<Record<string, string>>;
  /** Empty keeps Krunker's own, as for a gun. */
  readonly hit: string;
  readonly headshot: string;
}

/** Every gun on its best fit, and Fortnite's own hit and headshot. */
export const DEFAULT_FORTNITE: FortniteConfig = {
  on: false,
  guns: Object.fromEntries(KRUNKER_GUNS.map((gun) => [String(gun.weapon), gun.options[0] ?? ''])),
  hit: 'hit-body',
  headshot: 'hit-critical',
};

/**
 * Whatever came in, as a config the resolver can trust.
 *
 * A pick has to be one of that gun's options or empty, because it becomes a
 * file name main reads. A gun the saved config has never heard of, one added
 * in a later release, gets its default rather than Krunker's own, so an
 * update that adds a gun gives it a Fortnite sound like the rest.
 */
export function normaliseFortnite(value: unknown): FortniteConfig {
  const raw = (value ?? {}) as Partial<FortniteConfig>;
  const saved = raw.guns !== null && typeof raw.guns === 'object' ? raw.guns : {};
  const guns: Record<string, string> = {};
  for (const gun of KRUNKER_GUNS) {
    const key = String(gun.weapon);
    const pick = (saved as Record<string, unknown>)[key];
    guns[key] = typeof pick === 'string' && (pick === '' || gun.options.includes(pick)) ? pick : (gun.options[0] ?? '');
  }
  const one = (pick: unknown, options: readonly string[], fallback: string): string =>
    typeof pick === 'string' && (pick === '' || options.includes(pick)) ? pick : fallback;
  return {
    on: raw.on === true,
    guns,
    hit: one(raw.hit, HIT_OPTIONS, DEFAULT_FORTNITE.hit),
    headshot: one(raw.headshot, HEADSHOT_OPTIONS, DEFAULT_FORTNITE.headshot),
  };
}

/**
 * The Krunker sound key a URL asks for: `weapon_2_5` out of
 * `https://assets.krunker.io/sound/weapon_2_5.mp3?build=...`. Null for
 * anything that is not one of Krunker's sounds.
 */
export function soundKeyFromUrl(url: string): string | null {
  if (!url.startsWith(KRUNKER_SOUND_BASE)) return null;
  const m = /^([a-z0-9_]+)\.mp3(?:[?#].*)?$/.exec(url.slice(KRUNKER_SOUND_BASE.length));
  return m ? (m[1] ?? null) : null;
}

/**
 * The Fortnite sound that replaces a Krunker sound, or null to leave it.
 *
 * `config` is what is in effect: switched off, by its own switch or the
 * Soundpacks one (see `effectiveFortnite`), nothing is replaced.
 * `weapon_<n>`, every skin's `weapon_<n>_<m>` (m is the skin's model
 * number) and the Charge Rifle's charged shot `weapon_29_blast` are gun n.
 * Guns missing from KRUNKER_GUNS, and every other sound (reloads, which end
 * `_r_<n>`, footsteps), are left.
 */
export function fortniteSoundFor(key: string, config: FortniteConfig): string | null {
  if (!config.on) return null;
  if (key === 'hit_0') return config.hit || null;
  if (HEADSHOT_SOUNDS.has(key)) return config.headshot || null;
  const m = /^weapon_(\d+)(?:_\d+|_blast)?$/.exec(key);
  if (!m) return null;
  const gun = KRUNKER_GUNS.find((entry) => String(entry.weapon) === m[1]);
  if (!gun) return null;
  const pick = config.guns[String(gun.weapon)] ?? '';
  return pick !== '' && gun.options.includes(pick) ? pick : null;
}

/**
 * The Krunker sounds whose answer differs between two configs: what the page
 * has to make the game load again after a change. A gun is every name the
 * game has cached for it, so this returns a test, not a list.
 */
export function changedSounds(before: FortniteConfig | null, after: FortniteConfig): (key: string) => boolean {
  return (key) => {
    const was = before === null ? null : fortniteSoundFor(key, before);
    return was !== fortniteSoundFor(key, after);
  };
}

/** The Fortnite config as it applies: on only while the Soundpacks switch is on too. */
export function effectiveFortnite(soundpacksOn: boolean, config: FortniteConfig): FortniteConfig {
  return soundpacksOn && config.on ? config : { ...config, on: false };
}
