import { readFileSync, statSync } from 'node:fs';
import { mkdir, rename, writeFile } from 'node:fs/promises';
import { dirname, extname, join } from 'node:path';
import { net } from 'electron';
import {
  contentSources,
  EMPTY_CLIENT_CONTENT,
  MAX_CONTENT_BYTES,
  MAX_SCREENSHOT_BYTES,
  normaliseClientContent,
  repoSources,
  SCREENSHOT_NAME,
  SCREENSHOTS_PATH,
  type ClientContent,
} from '../shared/client-content';

/**
 * The team's content file, fetched once a launch: who wears which badge, and
 * the settings library. What is in it is shared/client-content.ts.
 *
 * Read from the repo's main branch, GitHub first and jsDelivr second, so an
 * edit there reaches every client at its next start. The last copy that
 * arrived is kept on disk and is what a client that cannot reach either host
 * uses, falling back to the copy the release was built with. So a client
 * offline today still shows yesterday's badges, and a fresh install offline
 * shows whatever shipped. It never ends with nothing worse than empty.
 *
 * Started once the window is up and off the startup path: nothing waits on
 * it but the badges and the library, and both draw themselves when it lands.
 *
 * The picks' screenshots come from the same place, the folder beside the
 * file, but only when one is asked for: the library has a lot of picks, and
 * most launches nobody opens it. Each is kept on disk once it has arrived,
 * so it is fetched once per PC rather than once per launch. They do not ship
 * in a release (electron-builder.yml leaves the folder out); under `npm
 * start` the repo's own copy is used first, which is what lets a screenshot
 * be checked before it is pushed.
 */

/** Fetch one address, at most `max` bytes of it. Injected so tests never reach the network. */
export type FetchBytes = (url: string, max: number) => Promise<Uint8Array>;

export interface ClientContentDeps {
  /** The copy the release was built with, `assets/content/client.json`. */
  readonly bundledPath: string;
  /** The last copy fetched, in the user's data folder. */
  readonly cachePath: string;
  /** The repo's screenshot folder. Only there under `npm start`. */
  readonly screenshotsDir: string;
  /** Where screenshots that have arrived are kept, in the user's data folder. */
  readonly imageCacheDir: string;
  readonly log: (...args: unknown[]) => void;
  /**
   * Use the copy beside the app before the network: true under `npm start`,
   * where that copy is the repo's own file, so an edit can be seen before
   * it is pushed. A release always asks main first.
   */
  readonly preferBundled?: boolean;
  readonly fetchBytes?: FetchBytes;
  readonly sources?: readonly string[];
  readonly imageSources?: (name: string) => readonly string[];
}

export interface ClientContentSource {
  /** Begin fetching, if that has not started already. */
  start(): void;
  /** The best content there is, once the fetch has settled. Never rejects. */
  get(): Promise<ClientContent>;
  /**
   * A pick's screenshot as a data URL, or null when it cannot be had: a name
   * that is not a screenshot's, or neither host answering with a picture.
   * Never rejects.
   */
  image(name: string): Promise<string | null>;
}

/** Per address. Long enough for a slow line; a file this small that has not come in that time is not coming. */
const FETCH_TIMEOUT_MS = 8000;

const fetchWithNet: FetchBytes = async (url, max) => {
  const abort = new AbortController();
  const timer = setTimeout(
    () => abort.abort(new Error(`no answer in ${FETCH_TIMEOUT_MS / 1000}s`)),
    FETCH_TIMEOUT_MS,
  );
  try {
    const res = await net.fetch(url, { signal: abort.signal });
    if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);
    // Read with a cap rather than all at once, so a wrong answer cannot be huge.
    const reader = res.body.getReader();
    const chunks: Uint8Array[] = [];
    let got = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      got += value.length;
      if (got > max) {
        void reader.cancel();
        throw new Error('bigger than it can be');
      }
      chunks.push(value);
    }
    return Buffer.concat(chunks);
  } finally {
    clearTimeout(timer);
  }
};

/** What a screenshot's extension says it is. */
const IMAGE_TYPES: Readonly<Record<string, string>> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
};

/**
 * Do the bytes start the way that kind of picture starts?
 *
 * An error page, a block page a school network puts up, or a 200 with
 * nothing in it all arrive as successes. Keeping one of those as a
 * screenshot would show a broken picture on that pick for good.
 */
function looksLike(type: string, bytes: Uint8Array): boolean {
  const text = (from: number, to: number): string => String.fromCharCode(...bytes.subarray(from, to));
  if (type === 'image/png') return bytes[0] === 0x89 && text(1, 4) === 'PNG';
  if (type === 'image/jpeg') return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (type === 'image/webp') return text(0, 4) === 'RIFF' && text(8, 12) === 'WEBP';
  return false;
}

/** Write beside and rename over, so a crash mid-write leaves the last good copy rather than half of one. */
async function writeAtomic(path: string, data: string | Uint8Array): Promise<void> {
  const tmp = `${path}.tmp`;
  await mkdir(dirname(path), { recursive: true });
  await writeFile(tmp, data);
  await rename(tmp, path);
}

export function createClientContent(deps: ClientContentDeps): ClientContentSource {
  const fetchBytes = deps.fetchBytes ?? fetchWithNet;
  const sources = deps.sources ?? contentSources();
  const imageSources = deps.imageSources ?? ((name: string) => repoSources(`${SCREENSHOTS_PATH}/${name}`));
  let pending: Promise<ClientContent> | null = null;
  /** One fetch per screenshot at a time, however many hovers ask for it. */
  const images = new Map<string, Promise<string | null>>();

  /** A copy on disk, or null when it is missing or not a content file. */
  function readLocal(path: string): ClientContent | null {
    try {
      return normaliseClientContent(JSON.parse(readFileSync(path, 'utf8').replace(/^\uFEFF/, '')));
    } catch {
      return null;
    }
  }

  async function load(): Promise<ClientContent> {
    if (deps.preferBundled === true) {
      const local = readLocal(deps.bundledPath);
      if (local) {
        deps.log('client content: using the repo’s own copy (dev run)');
        return local;
      }
    }
    for (const url of sources) {
      try {
        // Kept as the text that arrived rather than as what this client made
        // of it, so a client updated while offline reads anything it has
        // learned to use since.
        const text = Buffer.from(await fetchBytes(url, MAX_CONTENT_BYTES)).toString('utf8');
        const content = normaliseClientContent(JSON.parse(text));
        if (!content) throw new Error('not a content file');
        try {
          await writeAtomic(deps.cachePath, text);
        } catch (err) {
          // Still good for this launch. The next one fetches again anyway.
          deps.log(`client content: not cached: ${(err as Error).message}`);
        }
        deps.log(
          `client content: ${content.players.length} player badge(s), ${content.clans.length} clan badge(s), ` +
            `${content.settings.length} library entr${content.settings.length === 1 ? 'y' : 'ies'}`,
        );
        return content;
      } catch (err) {
        deps.log(`client content: ${url}: ${(err as Error).message}`);
      }
    }
    const cached = readLocal(deps.cachePath);
    if (cached) {
      deps.log('client content: using the last copy fetched');
      return cached;
    }
    deps.log('client content: using the copy this release shipped with');
    return readLocal(deps.bundledPath) ?? EMPTY_CLIENT_CONTENT;
  }

  /** A picture on disk as a data URL, or null when it is not there or not that picture. */
  function readImage(path: string, type: string): string | null {
    try {
      if (statSync(path).size > MAX_SCREENSHOT_BYTES) return null;
      const bytes = readFileSync(path);
      return looksLike(type, bytes) ? `data:${type};base64,${bytes.toString('base64')}` : null;
    } catch {
      return null;
    }
  }

  async function loadImage(name: string): Promise<string | null> {
    const type = IMAGE_TYPES[extname(name).toLowerCase()];
    if (!SCREENSHOT_NAME.test(name) || type === undefined) return null;

    // The repo's own copy first, then the one kept from an earlier fetch.
    const kept = join(deps.imageCacheDir, name);
    const local = readImage(join(deps.screenshotsDir, name), type) ?? readImage(kept, type);
    if (local !== null) return local;

    for (const url of imageSources(name)) {
      try {
        const bytes = await fetchBytes(url, MAX_SCREENSHOT_BYTES);
        if (!looksLike(type, bytes)) throw new Error('not the picture its name says');
        try {
          await writeAtomic(kept, bytes);
        } catch (err) {
          deps.log(`screenshot ${name}: not kept: ${(err as Error).message}`);
        }
        return `data:${type};base64,${Buffer.from(bytes).toString('base64')}`;
      } catch (err) {
        deps.log(`screenshot ${name}: ${url}: ${(err as Error).message}`);
      }
    }
    return null;
  }

  return {
    start() {
      pending ??= load();
    },
    get() {
      pending ??= load();
      return pending;
    },
    image(name) {
      let job = images.get(name);
      if (!job) {
        job = loadImage(name).catch(() => null);
        images.set(name, job);
        // A miss is not remembered, so a hover after the network comes back
        // tries again. A hit is: the picture behind a name does not change.
        void job.then((url) => {
          if (url === null) images.delete(name);
        });
      }
      return job;
    },
  };
}
