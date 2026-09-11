import { describe, expect, it } from 'vitest';
import {
  DEFAULT_FILTER,
  formatRemaining,
  GAMEMODES,
  joinUrl,
  MAP_FILTER_CHOICES,
  mapIconUrl,
  normalizeMapId,
  parseLobby,
  passesFilter,
  prettyMap,
  REGIONS,
  REGION_NAMES,
  SERVER_REGION_KEYS,
  shortMode,
  sortLobbies,
  type Lobby,
  type MatchmakerFilter,
} from './matchmaker';

const raw = (over: Partial<Record<number, unknown>> = {}): unknown[] => {
  const base: unknown[] = ['FRA:abc123', 'x', 5, 10, { i: 'sand_storm', g: 1 }, 300];
  for (const [k, v] of Object.entries(over)) base[Number(k)] = v;
  return base;
};

const lobby = (over: Partial<Lobby> = {}): Lobby => ({
  gameID: 'FRA:abc123',
  region: 'FRA',
  map: 'sand_storm',
  gamemode: 'Team Deathmatch',
  playerCount: 5,
  playerLimit: 10,
  remainingTime: 300,
  ...over,
});

const filter = (over: Partial<MatchmakerFilter> = {}): MatchmakerFilter => ({
  ...DEFAULT_FILTER,
  ...over,
});

describe('parseLobby', () => {
  it('reads a well-formed entry', () => {
    expect(parseLobby(raw())).toEqual({
      gameID: 'FRA:abc123',
      region: 'FRA',
      map: 'sand_storm',
      gamemode: 'Team Deathmatch',
      playerCount: 5,
      playerLimit: 10,
      remainingTime: 300,
    });
  });

  it('derives the region from the game id prefix', () => {
    expect(parseLobby(raw({ 0: 'TOK:zzz' }))?.region).toBe('TOK');
  });

  it('rejects entries that are not arrays', () => {
    expect(parseLobby(null)).toBeNull();
    expect(parseLobby({ gameID: 'x' })).toBeNull();
    expect(parseLobby('FRA:abc')).toBeNull();
  });

  it('rejects entries with missing or wrongly typed fields', () => {
    // A shape change upstream should drop the entry, not yield a lobby full
    // of undefined that renders as "undefined players on undefined".
    expect(parseLobby(raw({ 0: 42 }))).toBeNull();
    expect(parseLobby(raw({ 0: '' }))).toBeNull();
    expect(parseLobby(raw({ 2: 'five' }))).toBeNull();
    expect(parseLobby(raw({ 3: null }))).toBeNull();
    expect(parseLobby(raw({ 4: null }))).toBeNull();
  });

  it('names an unlisted gamemode by its id rather than lumping it in as Unknown', () => {
    // Mode 35 is live on Krunker right now and absent from every published
    // table. Collapsing all unknown modes into one label would make them
    // indistinguishable in the filter.
    expect(parseLobby(raw({ 4: { i: 'Facility', g: 35 } }))?.gamemode).toBe('Mode 35');
    expect(parseLobby(raw({ 4: { i: 'burg', g: 9999 } }))?.gamemode).toBe('Mode 9999');
  });

  it('falls back to Unknown when the mode is absent entirely', () => {
    expect(parseLobby(raw({ 4: { i: 'burg' } }))?.gamemode).toBe('Unknown');
  });

  it('accepts the SSS region', () => {
    // Real and in service, but missing from the reference clients' lists.
    expect(parseLobby(raw({ 0: 'SSS:811u1' }))?.region).toBe('SSS');
  });

  it('defaults a missing map name', () => {
    expect(parseLobby(raw({ 4: { g: 0 } }))?.map).toBe('Unknown');
  });

  it('treats a missing timer as untimed', () => {
    expect(parseLobby(raw({ 5: undefined }))?.remainingTime).toBe(0);
  });
});

describe('passesFilter', () => {
  it('accepts a lobby matching the defaults', () => {
    expect(passesFilter(lobby(), filter())).toBe(true);
  });

  it('rejects a full server', () => {
    expect(passesFilter(lobby({ playerCount: 10, playerLimit: 10 }), filter())).toBe(false);
  });

  it('rejects the lobby we are already in', () => {
    expect(passesFilter(lobby(), filter(), 'FRA:abc123')).toBe(false);
    expect(passesFilter(lobby(), filter(), 'FRA:other')).toBe(true);
  });

  it('filters by region and gamemode, with empty meaning any', () => {
    expect(passesFilter(lobby(), filter({ regions: ['TOK'] }))).toBe(false);
    expect(passesFilter(lobby(), filter({ regions: ['FRA', 'TOK'] }))).toBe(true);
    expect(passesFilter(lobby(), filter({ regions: [] }))).toBe(true);

    expect(passesFilter(lobby(), filter({ gamemodes: ['Hardpoint'] }))).toBe(false);
    expect(passesFilter(lobby(), filter({ gamemodes: ['Team Deathmatch'] }))).toBe(true);
  });

  it('matches selected maps across naming conventions', () => {
    // The server says `slide_moonlight`; the picker says `Slide Moonlight`.
    const live = lobby({ map: 'slide_moonlight' });
    expect(passesFilter(live, filter({ maps: ['Slide Moonlight'] }))).toBe(true);
    expect(passesFilter(live, filter({ maps: ['Burg'] }))).toBe(false);
    expect(passesFilter(live, filter({ maps: [] }))).toBe(true);
  });

  it('accepts any of several selected maps', () => {
    expect(passesFilter(lobby({ map: 'Subzero' }), filter({ maps: ['Burg', 'Subzero'] }))).toBe(true);
  });

  it('honours player count bounds', () => {
    expect(passesFilter(lobby({ playerCount: 1 }), filter({ minPlayers: 2 }))).toBe(false);
    expect(passesFilter(lobby({ playerCount: 9 }), filter({ maxPlayers: 8 }))).toBe(false);
  });

  it('rejects a round about to end', () => {
    expect(passesFilter(lobby({ remainingTime: 20 }), filter({ minRemainingTime: 60 }))).toBe(false);
    expect(passesFilter(lobby({ remainingTime: 90 }), filter({ minRemainingTime: 60 }))).toBe(true);
  });

  it('treats zero remaining as untimed, not as expired', () => {
    // This is the trap: 0 means "no round timer" (parkour, hosted customs).
    // Reading it as "0 seconds left" hides every untimed lobby.
    expect(passesFilter(lobby({ remainingTime: 0 }), filter({ allowUntimed: false }))).toBe(false);
    expect(passesFilter(lobby({ remainingTime: 0 }), filter({ allowUntimed: true }))).toBe(true);
    // ...and an untimed lobby must not be judged against minRemainingTime.
    expect(
      passesFilter(lobby({ remainingTime: 0 }), filter({ allowUntimed: true, minRemainingTime: 600 })),
    ).toBe(true);
  });
});

describe('sortLobbies', () => {
  const fra = lobby({ gameID: 'a', region: 'FRA', playerCount: 4 });
  const tok = lobby({ gameID: 'b', region: 'TOK', playerCount: 8 });
  const syd = lobby({ gameID: 'c', region: 'SYD', playerCount: 6 });
  const pings = { FRA: 20, TOK: 200, SYD: 90 };

  it('ranks by ping, then by player count', () => {
    expect(sortLobbies([tok, syd, fra], filter({ sortBy: 'ping' }), pings).map((l) => l.gameID))
      .toEqual(['a', 'c', 'b']);
  });

  it('ranks by players when asked, using ping to break ties', () => {
    expect(sortLobbies([fra, tok, syd], filter({ sortBy: 'players' }), pings).map((l) => l.gameID))
      .toEqual(['b', 'c', 'a']);
  });

  it('sorts unknown and failed regions last', () => {
    const mystery = lobby({ gameID: 'd', region: 'ZZZ', playerCount: 9 });
    const failed = lobby({ gameID: 'e', region: 'BRZ', playerCount: 9 });
    const ranked = sortLobbies([mystery, failed, fra], filter({ sortBy: 'ping' }), {
      ...pings,
      BRZ: -1,
    });
    expect(ranked[0]?.gameID).toBe('a');
    expect(ranked.map((l) => l.gameID).slice(1).sort()).toEqual(['d', 'e']);
  });

  it('does not mutate the input array', () => {
    const input = [tok, fra];
    sortLobbies(input, filter(), pings);
    expect(input.map((l) => l.gameID)).toEqual(['b', 'a']);
  });

  it('is stable enough to handle an empty ping map', () => {
    expect(sortLobbies([fra, tok], filter(), {}).map((l) => l.gameID)).toEqual(['b', 'a']);
  });
});

describe('formatting', () => {
  it('formats remaining time', () => {
    expect(formatRemaining(185)).toBe('3:05');
    expect(formatRemaining(60)).toBe('1:00');
    expect(formatRemaining(9)).toBe('0:09');
  });

  it('shows untimed rounds as a dash', () => {
    expect(formatRemaining(0)).toBe('--');
    expect(formatRemaining(-5)).toBe('--');
  });

  it('prettifies map ids', () => {
    expect(prettyMap('sand_storm')).toBe('Sand Storm');
    expect(prettyMap('burg')).toBe('Burg');
    expect(prettyMap('slide-moonlight')).toBe('Slide Moonlight');
  });

  it('builds a join URL with the id escaped', () => {
    expect(joinUrl('FRA:abc')).toBe('https://krunker.io/?game=FRA%3Aabc');
  });
});

describe('map helpers', () => {
  it('normalises away casing and separators', () => {
    expect(normalizeMapId('Slide Moonlight')).toBe(normalizeMapId('slide_moonlight'));
    expect(normalizeMapId('Old_Burg')).toBe(normalizeMapId('old burg'));
  });

  it('resolves preview icons by index position', () => {
    // A map's position in MAP_ICON_INDICES IS its image number.
    expect(mapIconUrl('Burg')).toBe('https://assets.krunker.io/img/maps/map_0.png');
    expect(mapIconUrl('slide_moonlight')).toBe('https://assets.krunker.io/img/maps/map_38.png');
  });

  it('has no icon for a community map', () => {
    expect(mapIconUrl('AIM_Room_Xyz')).toBeNull();
  });

  it('offers only maps that have icons in the picker', () => {
    // A picker entry with no thumbnail renders as a broken tile.
    const withIcons = MAP_FILTER_CHOICES.filter((m) => mapIconUrl(m) !== null);
    // Eterno Jump is knowingly iconless; everything else should resolve.
    expect(MAP_FILTER_CHOICES.length - withIcons.length).toBeLessThanOrEqual(1);
  });
});

describe('shortMode', () => {
  it('abbreviates the common modes for the scan feed', () => {
    expect(shortMode('Free for All')).toBe('FFA');
    expect(shortMode('Team Deathmatch')).toBe('TDM');
    expect(shortMode('Capture the Flag')).toBe('CTF');
  });

  it('falls back to an uppercased name', () => {
    expect(shortMode('Mode 35')).toBe('MODE 35');
    expect(shortMode('Raid')).toBe('RAID');
  });
});

describe('static tables', () => {
  it('keeps gamemode indices aligned with the server ids', () => {
    // game[4].g indexes into this array, so a reorder silently mislabels
    // every lobby in the list.
    expect(GAMEMODES[0]).toBe('Free for All');
    expect(GAMEMODES[1]).toBe('Team Deathmatch');
    expect(GAMEMODES[2]).toBe('Hardpoint');
    expect(GAMEMODES[3]).toBe('Capture the Flag');
  });

  it('names every region it lists', () => {
    for (const region of REGIONS) expect(REGION_NAMES[region]).toBeTruthy();
  });

  it('maps every ping-endpoint server key to a known region', () => {
    for (const region of Object.values(SERVER_REGION_KEYS)) {
      expect(REGIONS).toContain(region);
    }
  });

  it('covers every region the live service actually serves', () => {
    // Captured from matchmaker.krunker.io/game-list. A region missing here is
    // silently unfilterable and gets no ping reading.
    const observed = ['FRA', 'SIN', 'SV', 'NY', 'MBI', 'BRZ', 'TOK', 'BHN', 'SYD', 'DAL', 'SSS'];
    for (const region of observed) expect(REGIONS).toContain(region);
  });

  it('has a ping-list key for every region', () => {
    const mapped = new Set(Object.values(SERVER_REGION_KEYS));
    for (const region of REGIONS) expect(mapped).toContain(region);
  });
});
