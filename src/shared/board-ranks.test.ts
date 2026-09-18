import { describe, expect, it } from 'vitest';
import { nextRankIcons, rankIconFor, rankKey, type RankIcons } from './board-ranks';

const GOLD = 'https://assets.krunker.io/img/ranked/ranks/rank_gold.svg';
const MASTER = 'https://assets.krunker.io/img/ranked/ranks/rank_master.svg';

const empty: RankIcons = new Map();

describe('rankKey', () => {
  it('files a name the same however the board happened to write it', () => {
    expect(rankKey('Bonitto')).toBe('bonitto');
    expect(rankKey('  BONITTO ')).toBe('bonitto');
    expect(rankKey('\u200eBonitto\u200e')).toBe('bonitto');
  });
});

describe('nextRankIcons', () => {
  it('learns each player on the centre board', () => {
    const icons = nextRankIcons(empty, [
      { name: 'Bonitto', icon: GOLD },
      { name: 'Wallace', icon: MASTER },
    ]);
    expect(rankIconFor(icons, 'Bonitto')).toBe(GOLD);
    expect(rankIconFor(icons, 'Wallace')).toBe(MASTER);
  });

  it('matches the corner board regardless of case', () => {
    const icons = nextRankIcons(empty, [{ name: 'Bonitto', icon: GOLD }]);
    expect(rankIconFor(icons, 'bonitto')).toBe(GOLD);
  });

  it('gives nobody an icon the centre board did not draw', () => {
    const icons = nextRankIcons(empty, [
      { name: 'Bonitto', icon: GOLD },
      { name: 'Unranked', icon: null },
    ]);
    expect(rankIconFor(icons, 'Unranked')).toBeNull();
    expect(rankIconFor(icons, 'Stranger')).toBeNull();
  });

  it('keeps what it had when the board is empty, so letting go of Tab strips nothing', () => {
    const before = nextRankIcons(empty, [{ name: 'Bonitto', icon: GOLD }]);
    expect(nextRankIcons(before, [])).toBe(before);
    // Rows with no readable name are an empty board as well.
    expect(nextRankIcons(before, [{ name: '  ', icon: MASTER }])).toBe(before);
  });

  it('drops a player who is no longer on the board', () => {
    const ranked = nextRankIcons(empty, [
      { name: 'Bonitto', icon: GOLD },
      { name: 'Wallace', icon: MASTER },
    ]);
    const pub = nextRankIcons(ranked, [{ name: 'Wallace', icon: null }]);
    expect(rankIconFor(pub, 'Bonitto')).toBeNull();
    expect(rankIconFor(pub, 'Wallace')).toBeNull();
  });

  it('follows a rank that changed', () => {
    const before = nextRankIcons(empty, [{ name: 'Bonitto', icon: GOLD }]);
    const after = nextRankIcons(before, [{ name: 'Bonitto', icon: MASTER }]);
    expect(rankIconFor(after, 'Bonitto')).toBe(MASTER);
  });

  it('hands back the same table when nothing moved, so a score tick costs no redraw', () => {
    const rows = [
      { name: 'Bonitto', icon: GOLD },
      { name: 'Unranked', icon: null },
    ];
    const before = nextRankIcons(empty, rows);
    expect(nextRankIcons(before, rows)).toBe(before);
    expect(nextRankIcons(before, [...rows].reverse())).toBe(before);
  });

  it('prefers the sighting with an icon if a name turns up twice', () => {
    const icons = nextRankIcons(empty, [
      { name: 'Bonitto', icon: GOLD },
      { name: 'bonitto', icon: null },
    ]);
    expect(rankIconFor(icons, 'Bonitto')).toBe(GOLD);
  });
});
