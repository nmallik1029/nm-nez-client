import { describe, expect, it } from 'vitest';
import {
  highlightFor,
  parsePlayerName,
  type ClanHighlight,
  type FriendHighlight,
} from './highlights';

const FRIENDS: readonly FriendHighlight[] = [
  { name: 'illegal', color: '#48eaff', isBolded: false },
  { name: 'bolded_pal', color: '#9eeb56', isBolded: true },
];

const CLANS: readonly ClanHighlight[] = [
  { tag: 'Fame', color: '#e4552e', isBolded: true },
  { tag: 'YBG', color: '#c76bd6', isBolded: false },
];

describe('parsePlayerName', () => {
  it('splits a clan off the end', () => {
    expect(parsePlayerName('YBG_Wallace [Fame]')).toEqual({ name: 'YBG_Wallace', clan: 'Fame' });
  });

  it('reads a bare name as having no clan', () => {
    expect(parsePlayerName('illegal')).toEqual({ name: 'illegal', clan: null });
  });

  it('does not mind the spacing', () => {
    expect(parsePlayerName('illegal[Fame]')).toEqual({ name: 'illegal', clan: 'Fame' });
    expect(parsePlayerName('  illegal   [ Fame ]  ')).toEqual({ name: 'illegal', clan: 'Fame' });
  });

  it('only takes a bracket group at the end', () => {
    // Krunker puts the clan last, so brackets earlier belong to the name.
    expect(parsePlayerName('[x]_sniper [Fame]')).toEqual({ name: '[x]_sniper', clan: 'Fame' });
    expect(parsePlayerName('[x]_sniper')).toEqual({ name: '[x]_sniper', clan: null });
  });
});

describe('highlightFor', () => {
  const of = (name: string, clan: string | null = null) =>
    highlightFor(name, clan, FRIENDS, CLANS);

  it('colours a friend', () => {
    expect(of('illegal')).toEqual({ nameColor: '#48eaff', clanColor: null, bold: false });
  });

  it('colours a clan member who is not a friend, name and tag alike', () => {
    expect(of('someone', 'Fame')).toEqual({
      nameColor: '#e4552e',
      clanColor: '#e4552e',
      bold: true,
    });
  });

  it(`lets a friend keep their own colour while the tag keeps the clan's`, () => {
    expect(of('illegal', 'Fame')).toEqual({
      nameColor: '#48eaff',
      clanColor: '#e4552e',
      bold: true,
    });
  });

  it('bolds a friend marked bold whatever their clan says', () => {
    // The clan is explicitly not bold; the person is.
    expect(of('bolded_pal', 'YBG')?.bold).toBe(true);
    expect(of('bolded_pal')?.bold).toBe(true);
  });

  it('bolds a member of a bolded clan who is not marked bold themselves', () => {
    expect(of('illegal', 'Fame')?.bold).toBe(true);
    expect(of('illegal', 'YBG')?.bold).toBe(false);
  });

  it('ignores case on both names and tags', () => {
    expect(of('ILLEGAL')?.nameColor).toBe('#48eaff');
    expect(of('someone', 'FAME')?.nameColor).toBe('#e4552e');
  });

  it('leaves everyone else alone', () => {
    expect(of('a stranger')).toBeNull();
    expect(of('a stranger', 'NotOurs')).toBeNull();
  });

  it('matches the whole name, not part of it', () => {
    // "illegal" must not light up "illegally" or "notillegal".
    expect(of('illegally')).toBeNull();
    expect(of('notillegal')).toBeNull();
  });
});
