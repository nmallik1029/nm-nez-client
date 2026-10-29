import { ipcRenderer } from 'electron';
import {
  EMPTY_CLIENT_CONTENT,
  normaliseClientContent,
  type ClientContent,
} from '../shared/client-content';
import { IPC } from '../shared/ipc';

/**
 * The team's content file, as the page sees it: asked of main once a page
 * load, and shared by everything that reads it, the badges and the settings
 * library. See main/client-content.ts for where it comes from.
 *
 * Normalised again on arrival, the way config is, rather than trusting the
 * shape main sent: it is cheap, and it means nothing in the page ever holds
 * a value that skipped the checks.
 */

let pending: Promise<ClientContent> | null = null;
/** What arrived, once it has. Null while the first ask is still out. */
let settled: ClientContent | null = null;

export function clientContent(): Promise<ClientContent> {
  pending ??= ipcRenderer
    .invoke(IPC.clientContent)
    .then((raw: unknown) => normaliseClientContent(raw) ?? EMPTY_CLIENT_CONTENT)
    // An older main, or one that could not answer: nothing from the team,
    // which is what a client with no content file has always had.
    .catch(() => EMPTY_CLIENT_CONTENT)
    .then((content) => {
      settled = content;
      return content;
    });
  return pending;
}

/** The content if it has arrived, for something drawing now; null while it is on its way. */
export function clientContentNow(): ClientContent | null {
  return settled;
}

/** Screenshots already asked for, by file name, so a pick opened twice asks once. */
const images = new Map<string, Promise<string | null>>();

/**
 * A settings library pick's screenshot, as a data URL, or null when there is
 * none to be had. Main fetches it the first time and keeps it on disk; a
 * miss is not remembered here either, so opening the pick again retries.
 */
export function contentImage(name: string): Promise<string | null> {
  let job = images.get(name);
  if (!job) {
    job = ipcRenderer
      .invoke(IPC.contentImage, name)
      .then((url: unknown) => (typeof url === 'string' && url.startsWith('data:image/') ? url : null))
      .catch(() => null);
    images.set(name, job);
    void job.then((url) => {
      if (url === null) images.delete(name);
    });
  }
  return job;
}
