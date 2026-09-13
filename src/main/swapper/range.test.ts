import { describe, expect, it } from 'vitest';
import { mediaTypeFor, parseByteRange } from './range';

/**
 * The failure this guards is quiet: answer a range with the wrong bytes and
 * nothing errors, the sound just plays its opening again. So every form a
 * loader can send is pinned to the exact bytes it should get.
 */

describe('parseByteRange', () => {
  const SIZE = 152_685;

  it('serves the whole file when nothing was asked for', () => {
    expect(parseByteRange(null, SIZE)).toBeNull();
  });

  it('reads the open-ended form every media loader sends', () => {
    expect(parseByteRange('bytes=131072-', SIZE)).toEqual({ start: 131_072, end: SIZE - 1 });
  });

  it('reads the start of the file as a range too', () => {
    expect(parseByteRange('bytes=0-', SIZE)).toEqual({ start: 0, end: SIZE - 1 });
  });

  it('reads a closed range', () => {
    expect(parseByteRange('bytes=100-199', SIZE)).toEqual({ start: 100, end: 199 });
  });

  it('stops a closed range at the end of the file', () => {
    expect(parseByteRange('bytes=100-999999', SIZE)).toEqual({ start: 100, end: SIZE - 1 });
  });

  it('reads a suffix as the last bytes of the file', () => {
    expect(parseByteRange('bytes=-500', SIZE)).toEqual({ start: SIZE - 500, end: SIZE - 1 });
  });

  it('gives the whole file for a suffix longer than the file', () => {
    expect(parseByteRange('bytes=-999999', SIZE)).toEqual({ start: 0, end: SIZE - 1 });
  });

  it('refuses a start past the end, rather than sending the file from 0', () => {
    expect(parseByteRange(`bytes=${SIZE}-`, SIZE)).toBe('unsatisfiable');
  });

  it('refuses any range of an empty file', () => {
    expect(parseByteRange('bytes=0-', 0)).toBe('unsatisfiable');
  });

  it('ignores what it does not handle, and serves the whole file', () => {
    expect(parseByteRange('bytes=0-10,20-30', SIZE)).toBeNull();
    expect(parseByteRange('items=0-10', SIZE)).toBeNull();
    expect(parseByteRange('bytes=-', SIZE)).toBeNull();
    expect(parseByteRange('bytes=200-100', SIZE)).toBeNull();
  });

  it('tolerates spacing and case', () => {
    expect(parseByteRange(' Bytes = 10 - 20 ', SIZE)).toEqual({ start: 10, end: 20 });
  });
});

describe('mediaTypeFor', () => {
  it('names the audio a kill pack is made of', () => {
    expect(mediaTypeFor('C:\\swap\\sounds\\killstreak\\champs-2021\\champs-2021_1.mp3')).toBe('audio/mpeg');
  });

  it('ignores the case of the extension', () => {
    expect(mediaTypeFor('clip.WEBM')).toBe('video/webm');
  });

  it('falls back to something a loader can sniff past', () => {
    expect(mediaTypeFor('notes.txt')).toBe('application/octet-stream');
    expect(mediaTypeFor('no-extension')).toBe('application/octet-stream');
  });
});
