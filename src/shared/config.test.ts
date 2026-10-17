import { describe, expect, it } from 'vitest';
import { rawInputRefusalIsFinal } from './config';

describe('rawInputRefusalIsFinal', () => {
  it('gives up on raw input after one refusal only on Linux, where Chromium never has it', () => {
    expect(rawInputRefusalIsFinal('linux')).toBe(true);
  });

  it('keeps asking on every lock everywhere else, where a refusal can pass', () => {
    // A stuck "no" on Windows is the accelerated cursor for the whole session.
    expect(rawInputRefusalIsFinal('win32')).toBe(false);
    expect(rawInputRefusalIsFinal('darwin')).toBe(false);
    // An older main process that never said reads as Windows.
    expect(rawInputRefusalIsFinal('')).toBe(false);
  });
});
