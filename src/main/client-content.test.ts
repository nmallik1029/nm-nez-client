import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createClientContent, type FetchBytes } from './client-content';

/**
 * Where the content comes from, in order, with the network faked.
 *
 * What matters is that a client always ends up with the best copy it can get
 * and never with nothing worse than empty: fresh from either host, then the
 * last copy it fetched, then the one its release shipped with. And for a
 * screenshot, that only a real picture is ever kept or shown.
 */

const FRESH = JSON.stringify({ badges: { players: [{ name: 'Fresh', badges: ['creator'] }] } });
const CACHED = JSON.stringify({ badges: { players: [{ name: 'Cached', badges: ['creator'] }] } });
const BUNDLED = JSON.stringify({ badges: { players: [{ name: 'Bundled', badges: ['creator'] }] } });

/** The first bytes of a PNG, which is all the check looks at. */
const PNG = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);
const PNG_URL = `data:image/png;base64,${Buffer.from(PNG).toString('base64')}`;

let dir: string;
let bundledPath: string;
let cachePath: string;
let screenshotsDir: string;
let imageCacheDir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'content-'));
  bundledPath = join(dir, 'bundled.json');
  cachePath = join(dir, 'data', 'client-content.json');
  screenshotsDir = join(dir, 'repo-screenshots');
  imageCacheDir = join(dir, 'data', 'content-images');
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

/** A fetch that answers each address from the table, and fails for any other. */
function network(answers: Record<string, string | Uint8Array>): { fetchBytes: FetchBytes; asked: string[] } {
  const asked: string[] = [];
  return {
    asked,
    fetchBytes: (url) => {
      asked.push(url);
      const answer = answers[url];
      if (answer === undefined) return Promise.reject(new Error('unreachable'));
      return Promise.resolve(typeof answer === 'string' ? new TextEncoder().encode(answer) : answer);
    },
  };
}

function source(fetchBytes: FetchBytes) {
  return createClientContent({
    bundledPath,
    cachePath,
    screenshotsDir,
    imageCacheDir,
    log: () => {},
    fetchBytes,
    sources: ['https://github/x', 'https://mirror/x'],
    imageSources: (name) => [`https://github/shots/${name}`, `https://mirror/shots/${name}`],
  });
}

const firstName = async (content: Promise<{ players: readonly { name: string }[] }>): Promise<string | undefined> =>
  (await content).players[0]?.name;

describe('createClientContent', () => {
  it('takes GitHub when it answers, and keeps what came for next time', async () => {
    const { fetchBytes, asked } = network({ 'https://github/x': FRESH });
    expect(await firstName(source(fetchBytes).get())).toBe('Fresh');
    expect(asked).toEqual(['https://github/x']);
    expect(readFileSync(cachePath, 'utf8')).toBe(FRESH);
  });

  it('goes to the mirror when GitHub cannot be reached', async () => {
    const { fetchBytes } = network({ 'https://mirror/x': FRESH });
    expect(await firstName(source(fetchBytes).get())).toBe('Fresh');
  });

  it('goes past an answer that is not a content file', async () => {
    const { fetchBytes } = network({ 'https://github/x': '<html>blocked</html>', 'https://mirror/x': FRESH });
    expect(await firstName(source(fetchBytes).get())).toBe('Fresh');
  });

  it('uses the last copy fetched when neither host answers', async () => {
    writeFileSync(bundledPath, BUNDLED);
    // A copy already cached by an earlier launch.
    await source(network({ 'https://github/x': CACHED }).fetchBytes).get();
    expect(await firstName(source(network({}).fetchBytes).get())).toBe('Cached');
  });

  it('uses the copy the release shipped with when there is no other', async () => {
    writeFileSync(bundledPath, BUNDLED);
    expect(await firstName(source(network({}).fetchBytes).get())).toBe('Bundled');
  });

  it('ends with nothing worse than empty', async () => {
    expect(await source(network({}).fetchBytes).get()).toEqual({ players: [], clans: [], settings: [] });
  });

  it('uses the repo’s own copy first in a dev run, so an edit shows before it is pushed', async () => {
    writeFileSync(bundledPath, BUNDLED);
    const { fetchBytes, asked } = network({ 'https://github/x': FRESH });
    const dev = createClientContent({
      bundledPath,
      cachePath,
      screenshotsDir,
      imageCacheDir,
      log: () => {},
      fetchBytes,
      preferBundled: true,
      sources: ['https://github/x'],
    });
    expect(await firstName(dev.get())).toBe('Bundled');
    expect(asked).toEqual([]);
  });

  it('fetches once a launch, however many times it is asked', async () => {
    const { fetchBytes, asked } = network({ 'https://github/x': FRESH });
    const content = source(fetchBytes);
    content.start();
    await Promise.all([content.get(), content.get()]);
    expect(asked).toHaveLength(1);
  });
});

describe('screenshots', () => {
  it('fetches one the first time, keeps it, and reads it off disk after', async () => {
    const { fetchBytes, asked } = network({ 'https://github/shots/a.png': PNG });
    expect(await source(fetchBytes).image('a.png')).toBe(PNG_URL);
    expect(readFileSync(join(imageCacheDir, 'a.png'))).toEqual(Buffer.from(PNG));

    // A new launch: nothing is fetched, the kept copy is used.
    const offline = network({});
    expect(await source(offline.fetchBytes).image('a.png')).toBe(PNG_URL);
    expect(offline.asked).toEqual([]);
    expect(asked).toHaveLength(1);
  });

  it('uses the repo’s own copy first, so one can be checked before it is pushed', async () => {
    mkdirSync(screenshotsDir, { recursive: true });
    writeFileSync(join(screenshotsDir, 'local.png'), PNG);
    const { fetchBytes, asked } = network({});
    expect(await source(fetchBytes).image('local.png')).toBe(PNG_URL);
    expect(asked).toEqual([]);
  });

  it('never keeps or shows something that is not the picture its name says', async () => {
    const { fetchBytes } = network({
      'https://github/shots/b.png': '<html>blocked by your school</html>',
      'https://mirror/shots/b.png': PNG,
    });
    expect(await source(fetchBytes).image('b.png')).toBe(PNG_URL);
    // A JPEG name with PNG bytes is not a JPEG.
    expect(await source(network({ 'https://github/shots/c.jpg': PNG }).fetchBytes).image('c.jpg')).toBeNull();
  });

  it('refuses a name that is not a screenshot’s, before it becomes a path or an address', async () => {
    const { fetchBytes, asked } = network({});
    for (const name of ['../config.json', 'a/b.png', 'shot.gif', '', '.png']) {
      expect(await source(fetchBytes).image(name), name).toBeNull();
    }
    expect(asked).toEqual([]);
  });

  it('tries again after a miss, since the network may have come back', async () => {
    const answers: Record<string, Uint8Array> = {};
    const { fetchBytes } = network(answers);
    const content = source(fetchBytes);
    expect(await content.image('d.png')).toBeNull();
    answers['https://github/shots/d.png'] = PNG;
    expect(await content.image('d.png')).toBe(PNG_URL);
  });
});
