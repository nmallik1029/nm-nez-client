import { describe, expect, it } from 'vitest';
import { badgesFor, type ClanBadges, MAX_BADGES, type PlayerBadges } from './badges';

const players: readonly PlayerBadges[] = [
  { name: 'Bonitto', badges: ['owner', 'dev'] },
  { name: 'lowercase', badges: ['Founder'] },
  { name: 'greedy', badges: ['one', 'two', 'three', 'four'] },
  { name: 'blank', badges: ['', '  ', 'real'] },
];

const clans: readonly ClanBadges[] = [
  { tag: 'Bnto', badges: ['clan'] },
  { tag: 'dev', badges: ['dev'] },
];

describe('badgesFor', () => {
  it('gives a named player their badges', () => {
    expect(badgesFor('Bonitto', null, players, clans)).toEqual(['owner', 'dev']);
  });

  it('gives nobody anything by default', () => {
    expect(badgesFor('Stranger', null, players, clans)).toEqual([]);
    expect(badgesFor('Stranger', 'NONE', players, clans)).toEqual([]);
  });

  it('gives a clan badge to everyone in the clan', () => {
    expect(badgesFor('Stranger', 'Bnto', players, clans)).toEqual(['clan']);
  });

  it('puts a player badge before their clan badge', () => {
    expect(badgesFor('Bonitto', 'Bnto', players, clans)).toEqual(['owner', 'dev', 'clan']);
  });

  it('ignores case on names, tags and ids alike', () => {
    expect(badgesFor('BONITTO', null, players, clans)).toEqual(['owner', 'dev']);
    expect(badgesFor('Stranger', 'bnto', players, clans)).toEqual(['clan']);
    expect(badgesFor('lowercase', null, players, clans)).toEqual(['founder']);
  });

  it('does not draw the same badge twice', () => {
    // 'dev' is theirs and their clan's.
    expect(badgesFor('Bonitto', 'dev', players, clans)).toEqual(['owner', 'dev']);
  });

  it('stops at the limit', () => {
    expect(badgesFor('greedy', null, players, clans)).toHaveLength(MAX_BADGES);
    expect(badgesFor('greedy', null, players, clans)).toEqual(['one', 'two', 'three']);
  });

  it('throws away empty ids rather than asking for a file called nothing', () => {
    expect(badgesFor('blank', null, players, clans)).toEqual(['real']);
  });
});
