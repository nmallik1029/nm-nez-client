import { describe, expect, it } from 'vitest';
import {
  highlightFor,
  parsePlayerName,
  type ClanHighlight,
  type FriendHighlight,
} from './highlights';

const FRIENDS: readonly FriendHighlight[] = [
  { name: 'illegal', color: '#48eaff' },
  { name: 'uggie333', color: '#9eeb56' },
];

const CLANS: readonly ClanHighlight[] = [
  { tag: 'Fame', color: '#e4552e', bold: true },
  { tag: 'YBG', color: '#c76bd6', bold: false },
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
  it('colours a friend', () => {
    expect(highlightFor('illegal', FRIENDS, CLANS)).toEqual({ color: '#48eaff', bold: false });
  });

  it('colours a clan member who is not a friend', () => {
    expect(highlightFor('someone [Fame]', FRIENDS, CLANS)).toEqual({
      color: '#e4552e',
      bold: true,
    });
  });

  it('lets a friend keep their own colour over their clan', () => {
    // Naming someone individually is the more specific choice of the two.
    expect(highlightFor('illegal [Fame]', FRIENDS, CLANS)).toEqual({
      color: '#48eaff',
      bold: true,
    });
  });

  it('carries the clan weight onto a friend, so a bold clan stays bold', () => {
    expect(highlightFor('illegal [YBG]', FRIENDS, CLANS)?.bold).toBe(false);
    expect(highlightFor('illegal [Fame]', FRIENDS, CLANS)?.bold).toBe(true);
  });

  it('ignores case on both names and tags', () => {
    expect(highlightFor('ILLEGAL', FRIENDS, CLANS)?.color).toBe('#48eaff');
    expect(highlightFor('someone [FAME]', FRIENDS, CLANS)?.color).toBe('#e4552e');
  });

  it('leaves everyone else alone', () => {
    expect(highlightFor('a stranger', FRIENDS, CLANS)).toBeNull();
    expect(highlightFor('a stranger [NotOurs]', FRIENDS, CLANS)).toBeNull();
  });

  it('matches the whole name, not part of it', () => {
    // "illegal" must not light up "illegally" or "notillegal".
    expect(highlightFor('illegally', FRIENDS, CLANS)).toBeNull();
    expect(highlightFor('notillegal', FRIENDS, CLANS)).toBeNull();
  });
});
