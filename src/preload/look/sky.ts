import { KRUNKER_LOOK } from '../../krunker/constants';
import { BRANDING } from '../../shared/branding';
import { colorToInt, type SkyConfig } from '../../shared/visuals';

/**
 * The sky.
 *
 * A map's colours arrive as JSON, `{"data":{... "sky":"#dce8ed",
 * "skyDome":true ...}}`, and the game builds the scene from whatever that
 * says. So the sky is not something to repaint after the fact: it is one
 * field, answered before the game ever reads it.
 *
 * Which means the hook has to be in place before the first map is fetched,
 * and a preload runs at document-start, so that part is free. The awkward
 * part is that the client's own config arrives over IPC a moment later, and
 * the menu's map is requested in that gap. Rather than race it, a map
 * response waits for the config to land before it is answered. It is a
 * handful of milliseconds on one request, once, and the alternative is a sky
 * that is the right colour on every map except the one you are looking at
 * when the client opens.
 *
 * The dome goes off with the colour on. Most maps paint a textured dome over
 * the flat sky colour, so setting the colour alone changes nothing visible
 * and reads as a broken feature.
 */

let current: SkyConfig | null = null;

let settle: () => void = () => {};
const settled = new Promise<void>((resolve) => {
  settle = resolve;
});

/**
 * How long a map request will wait for the config before giving up on it.
 *
 * If the config IPC never answers, the client is already in trouble, and a
 * map that loads with the game's own sky is a much better outcome than a
 * loading screen that never ends.
 */
const CONFIG_WAIT_MS = 2000;

function log(...args: unknown[]): void {
  console.log(BRANDING.logPrefix, ...args);
}

/** Called once the config has been read, and again on every change. */
export function setSky(config: SkyConfig): void {
  current = config;
  settle();
}

function urlOf(input: unknown): string {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.href;
  if (input instanceof Request) return input.url;
  return '';
}

async function waitForConfig(): Promise<void> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  await Promise.race([
    settled,
    new Promise<void>((resolve) => {
      timer = setTimeout(resolve, CONFIG_WAIT_MS);
    }),
  ]);
  if (timer !== undefined) clearTimeout(timer);
}

/**
 * Rewrite one map response, or hand back exactly what arrived.
 *
 * Everything here is a reason to do nothing: the config says off, the body is
 * not JSON, the JSON is a list of maps rather than a map. The rewrite only
 * happens for a body that actually has a sky in it, which is also what keeps
 * the map-list endpoints on the same path from being touched.
 */
async function repaint(response: Response): Promise<Response> {
  try {
    await waitForConfig();
    const sky = current;
    if (!sky?.on) return response;

    // A clone, so a body we decide not to touch is still unread and the game
    // gets the real response rather than one we have already drained.
    const json: unknown = await response.clone().json();
    const data = (json as { data?: Record<string, unknown> } | null)?.data;
    if (!data) return response;

    /*
     * Both spellings of a colour, and the map's own is the one it gets back.
     *
     * `sky` arrives as "#dce8ed" on one map and as 14477549 on another,
     * which is that same colour as an integer. Checking for a string alone
     * is what made this look like it did nothing: the menu's own map is one
     * of the numeric ones, so the only sky anybody saw first was the one
     * that was never rewritten.
     */
    const existing = data[KRUNKER_LOOK.skyKey];
    if (typeof existing !== 'string' && typeof existing !== 'number') return response;

    data[KRUNKER_LOOK.skyKey] =
      typeof existing === 'number' ? colorToInt(sky.color) : sky.color;
    data[KRUNKER_LOOK.skyDomeKey] = false;

    // The length is wrong now and the encoding no longer applies, and neither
    // header means anything on a response that never came off a socket.
    const headers = new Headers(response.headers);
    headers.delete('content-length');
    headers.delete('content-encoding');

    const name = typeof data.name === 'string' ? data.name : 'map';
    log(`sky: ${name} painted ${sky.color}`);
    return new Response(JSON.stringify(json), {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  } catch {
    // Anything at all: the game gets its own response and its own sky.
    return response;
  }
}

/**
 * Put the hook in. Call this at document-start, before the config is read.
 *
 * Non-map requests are handed straight back, same promise, so the hook costs
 * one `includes()` on a string for everything else the page fetches.
 */
export function installSkyHook(): void {
  if (typeof window.fetch !== 'function') return;
  // Bound here rather than called as `original.call(window, ...)` later: the
  // page's own `fetch` is a method, and one taken off `window` and stored
  // loses its receiver.
  const original = window.fetch.bind(window);

  window.fetch = (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const response = original(input, init);
    if (!urlOf(input).includes(KRUNKER_LOOK.mapDataPath)) return response;
    return response.then(repaint);
  };
}
