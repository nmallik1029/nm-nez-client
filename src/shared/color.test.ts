import { describe, expect, it } from 'vitest';
import { hexToHsv, hsvToHex, hsvToRgb, parseHex, wheelPick, wheelPoint } from './color';

describe('parseHex', () => {
  it('takes six digits with or without the #, and lower-cases them', () => {
    expect(parseHex('#FFD84A')).toBe('#ffd84a');
    expect(parseHex('  48eaff ')).toBe('#48eaff');
  });

  it('turns down anything else', () => {
    for (const junk of ['', '#fff', '#12345', '#1234567', 'red', '#ggggggg', '#gggggg']) {
      expect(parseHex(junk)).toBeNull();
    }
  });
});

describe('hsv and hex', () => {
  it('lands the primaries where they belong', () => {
    expect(hsvToHex({ h: 0, s: 1, v: 1 })).toBe('#ff0000');
    expect(hsvToHex({ h: 120, s: 1, v: 1 })).toBe('#00ff00');
    expect(hsvToHex({ h: 240, s: 1, v: 1 })).toBe('#0000ff');
    expect(hsvToHex({ h: 360, s: 1, v: 1 })).toBe('#ff0000');
  });

  it('is white in the middle at full brightness and black at none', () => {
    expect(hsvToHex({ h: 200, s: 0, v: 1 })).toBe('#ffffff');
    expect(hsvToHex({ h: 200, s: 1, v: 0 })).toBe('#000000');
  });

  it('round-trips any colour', () => {
    for (const hex of ['#ffd84a', '#48eaff', '#4ade80', '#fa50ae', '#123456', '#808080', '#000000']) {
      const hsv = hexToHsv(hex);
      expect(hsv).not.toBeNull();
      if (hsv) expect(hsvToHex(hsv)).toBe(hex);
    }
  });

  it('keeps every channel inside 0-255', () => {
    for (let h = 0; h < 360; h += 7) {
      for (const c of hsvToRgb({ h, s: 1, v: 1 })) {
        expect(c).toBeGreaterThanOrEqual(0);
        expect(c).toBeLessThanOrEqual(255);
      }
    }
  });

  it('is null for something that is not a colour', () => {
    expect(hexToHsv('nope')).toBeNull();
  });
});

describe('wheelPick and wheelPoint', () => {
  it('is grey in the middle and full colour at the rim', () => {
    expect(wheelPick(0, 0, 80).s).toBe(0);
    expect(wheelPick(80, 0, 80)).toEqual({ h: 0, s: 1 });
  });

  it('holds a drag past the edge on the rim', () => {
    expect(wheelPick(0, 500, 80)).toEqual({ h: 90, s: 1 });
  });

  it('puts the marker back where the pick came from', () => {
    const { h, s } = wheelPick(-30, 20, 80);
    const { dx, dy } = wheelPoint(h, s, 80);
    expect(dx).toBeCloseTo(-30);
    expect(dy).toBeCloseTo(20);
  });
});
