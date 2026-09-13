/**
 * Byte ranges for swapped files, and why a swap cannot do without them.
 *
 * Audio and video elements load a file in pieces, each asked for with
 * `Range: bytes=<position>-`. Over http Chromium checks the answer: a 206 with
 * a matching Content-Range is the piece it asked for, and a plain 200 is the
 * whole file, so it throws away the bytes before the position. Over any other
 * scheme it checks nothing. Its media loader says as much -- "we make a strong
 * assumption that ... the request was successful (in particular range
 * request)" -- and takes whatever arrives to start at the position it asked
 * for.
 *
 * Swapped files arrive over `swap://`, and the handler used to answer every
 * request with the whole file from byte 0. So the second piece of any sound
 * big enough to need one was the file's opening again, and it played. That is
 * the kill sound that repeated a few seconds in: the pack's first-kill mp3 is
 * the one bigger than the loader's first piece, and the smaller ones never
 * asked twice.
 *
 * Pure, so the edge cases are tested without a protocol handler.
 */

export interface ByteRange {
  /** First byte, inclusive. */
  readonly start: number;
  /** Last byte, inclusive, as HTTP writes it. */
  readonly end: number;
}

/**
 * The single range a Range header asks for, within a file of `size` bytes.
 *
 * Null means serve the whole file: no header, or one this does not handle,
 * such as several ranges at once, which no media loader sends. A range that
 * starts past the end is `unsatisfiable`, the 416 case, rather than null,
 * because answering that with the whole file is the exact bug this exists for.
 */
export function parseByteRange(
  header: string | null,
  size: number,
): ByteRange | 'unsatisfiable' | null {
  if (header === null) return null;
  const match = /^\s*bytes\s*=\s*(\d*)\s*-\s*(\d*)\s*$/i.exec(header);
  if (!match) return null;
  const first = match[1] ?? '';
  const last = match[2] ?? '';
  if (first === '' && last === '') return null;
  if (size <= 0) return 'unsatisfiable';

  // `bytes=-500` is the last 500 bytes.
  if (first === '') {
    const length = Number(last);
    if (length === 0) return 'unsatisfiable';
    return { start: Math.max(0, size - length), end: size - 1 };
  }

  const start = Number(first);
  if (start >= size) return 'unsatisfiable';
  const end = last === '' ? size - 1 : Math.min(Number(last), size - 1);
  // A backwards range is malformed, and HTTP says to ignore the header.
  if (end < start) return null;
  return { start, end };
}

const MEDIA_TYPES: Readonly<Record<string, string>> = {
  mp3: 'audio/mpeg',
  ogg: 'audio/ogg',
  oga: 'audio/ogg',
  opus: 'audio/ogg',
  wav: 'audio/wav',
  m4a: 'audio/mp4',
  aac: 'audio/aac',
  flac: 'audio/flac',
  mp4: 'video/mp4',
  m4v: 'video/mp4',
  webm: 'video/webm',
  ogv: 'video/ogg',
  mov: 'video/quicktime',
};

/**
 * The Content-Type for a piece of a file, by extension.
 *
 * Only media asks for ranges, so only media is listed. Anything else still
 * gets a type the loader can sniff past.
 */
export function mediaTypeFor(filePath: string): string {
  const dot = filePath.lastIndexOf('.');
  const ext = dot === -1 ? '' : filePath.slice(dot + 1).toLowerCase();
  return MEDIA_TYPES[ext] ?? 'application/octet-stream';
}
