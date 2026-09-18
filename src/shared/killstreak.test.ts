import { describe, expect, it } from 'vitest';
import { isPackId, nameFromId, packFileUrl, pickPack, tierFor, variantFor, type KillPack } from './killstreak';

/**
 * The pack id is the part worth being strict about. It is written to config
 * by the page, becomes a folder name in main and a URL path in the renderer,
 * so anything that could walk out of `swap/sounds/killstreak` or needs encoding on
 * the way into a URL is refused rather than cleaned up.
 */
describe('isPackId', () => {
  it('takes lowercase words joined by hyphens', () => {
    for (const id of ['vct-2025', 'reaver', 'ex-o', 'gaia-s-vengeance', '1']) {
      expect(isPackId(id)).toBe(true);
    }
  });

  it('refuses anything that could leave the folder or needs encoding', () => {
    for (const id of ['', '..', '../x', 'a/b', 'a\\b', 'a.b', 'A', 'has space', '-lead', 'x'.repeat(65)]) {
      expect(isPackId(id)).toBe(false);
    }
  });

  it('refuses things that are not strings', () => {
    for (const value of [null, undefined, 3, {}, ['vct-2025']]) {
      expect(isPackId(value)).toBe(false);
    }
  });
});

describe('tierFor', () => {
  it('plays the tier matching the streak', () => {
    expect(tierFor(1, 6)).toBe(1);
    expect(tierFor(4, 6)).toBe(4);
    expect(tierFor(6, 6)).toBe(6);
  });

  it('holds on the last tier once the streak runs past it', () => {
    // A five-sound pack on a seven-kill streak.
    expect(tierFor(6, 5)).toBe(5);
    expect(tierFor(7, 5)).toBe(5);
  });

  it('plays nothing without a streak or without anything to play', () => {
    expect(tierFor(0, 6)).toBe(0);
    expect(tierFor(3, 0)).toBe(0);
    expect(tierFor(-1, 6)).toBe(0);
  });
});

describe('pickPack', () => {
  const p = (id: string): KillPack => ({ id, name: id, sounds: 1, banners: 0, variants: 1 });
  // Sorted by name, as main sends them, so the stock pack is not first.
  const list = [p('aemondir'), p('default'), p('prime')];

  it('plays the pack that was picked', () => {
    expect(pickPack('prime', list)?.id).toBe('prime');
  });

  it('plays the stock pack when none is picked, or the picked one is gone', () => {
    // Not whichever sorts first: that is a skin somebody might never have chosen.
    expect(pickPack('', list)?.id).toBe('default');
    expect(pickPack('deleted', list)?.id).toBe('default');
  });

  it('plays something rather than nothing when the stock pack is gone too', () => {
    expect(pickPack('', [p('aemondir'), p('prime')])?.id).toBe('aemondir');
    expect(pickPack('', [])).toBeNull();
  });
});

describe('packFileUrl', () => {
  it('points at a krunker.io path main will answer from disk', () => {
    expect(packFileUrl('vct-2025', 3, 'sound')).toBe(
      'https://assets.krunker.io/sounds/killstreak/vct-2025/vct-2025_3.mp3',
    );
    expect(packFileUrl('vct-2025', 1, 'banner')).toBe(
      'https://assets.krunker.io/sounds/killstreak/vct-2025/vct-2025_1.png',
    );
  });

  it("names a banner's other colours, and never a sound's", () => {
    expect(packFileUrl('aeris', 4, 'banner', 3)).toBe('https://assets.krunker.io/sounds/killstreak/aeris/aeris_v3_4.png');
    // The first colour is the plain file, so a pack without colours is untouched.
    expect(packFileUrl('aeris', 4, 'banner', 1)).toBe(packFileUrl('aeris', 4, 'banner'));
    expect(packFileUrl('aeris', 4, 'sound', 3)).toBe('https://assets.krunker.io/sounds/killstreak/aeris/aeris_4.mp3');
  });
});

describe('variantFor', () => {
  const pack = { id: 'aeris', variants: 4 };

  it('shows the colour picked for that pack', () => {
    expect(variantFor(pack, { aeris: 3 })).toBe(3);
    expect(variantFor(pack, { aeris: 4, bolt: 2 })).toBe(4);
  });

  it('shows the first colour when there is no pick, or one the pack does not have', () => {
    // A pick made on an installed pack, now replaced by the user's own copy
    // with fewer colours, falls back rather than asking for a missing file.
    expect(variantFor(pack, {})).toBe(1);
    expect(variantFor(pack, { bolt: 3 })).toBe(1);
    expect(variantFor(pack, { aeris: 5 })).toBe(1);
    expect(variantFor({ id: 'aeris', variants: 1 }, { aeris: 2 })).toBe(1);
    expect(variantFor(pack, { aeris: 2.5 })).toBe(1);
    expect(variantFor(pack, { aeris: 0 })).toBe(1);
  });
});

describe('nameFromId', () => {
  it('turns a folder id into something to show', () => {
    expect(nameFromId('prelude-to-chaos')).toBe('Prelude To Chaos');
    expect(nameFromId('reaver')).toBe('Reaver');
  });

  it('does not leave gaps for doubled hyphens', () => {
    expect(nameFromId('a--b')).toBe('A B');
  });
});
