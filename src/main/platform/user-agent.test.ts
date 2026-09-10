import { describe, expect, it } from 'vitest';
import { browserUserAgent } from './user-agent';

const CHROME =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) ' +
  'Chrome/152.0.7977.54 Safari/537.36';

/** Verbatim from Electron 44.0.0 on Windows. */
const ELECTRON_DEFAULT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) ' +
  'nmnez/0.1.0 Chrome/152.0.7977.54 Electron/44.0.0 Safari/537.36';

describe('browserUserAgent', () => {
  it('strips the app token and the Electron token', () => {
    expect(browserUserAgent(ELECTRON_DEFAULT)).toBe(CHROME);
  });

  it('leaves no trace of Electron or the product name', () => {
    const result = browserUserAgent(ELECTRON_DEFAULT);
    expect(result).not.toMatch(/electron/i);
    expect(result).not.toMatch(/nmnez/i);
  });

  it('keeps the real Chrome version, so the UA matches the engine', () => {
    expect(browserUserAgent(ELECTRON_DEFAULT)).toContain('Chrome/152.0.7977.54');
  });

  it('is idempotent, so an already-clean UA comes back unchanged', () => {
    expect(browserUserAgent(CHROME)).toBe(CHROME);
  });

  it('handles an app name containing a dash or dot', () => {
    const ua = ELECTRON_DEFAULT.replace('nmnez/0.1.0', 'nm-nez.client/2.10.3');
    expect(browserUserAgent(ua)).toBe(CHROME);
  });

  it('does not eat AppleWebKit/537.36, which also precedes a slashed token', () => {
    expect(browserUserAgent(ELECTRON_DEFAULT)).toContain('AppleWebKit/537.36 (KHTML, like Gecko)');
  });

  it('still strips Electron when there is no app token', () => {
    const ua = ELECTRON_DEFAULT.replace('nmnez/0.1.0 ', '');
    expect(browserUserAgent(ua)).toBe(CHROME);
  });

  it('leaves an unrecognised UA alone rather than mangling it', () => {
    expect(browserUserAgent('Mozilla/5.0 (X11; Linux x86_64)')).toBe(
      'Mozilla/5.0 (X11; Linux x86_64)',
    );
  });
});
