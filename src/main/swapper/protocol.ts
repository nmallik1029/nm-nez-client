import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { Readable } from 'node:stream';
import { pathToFileURL } from 'node:url';
import { net, protocol } from 'electron';
import { mediaTypeFor, parseByteRange } from './range';

export const SWAP_SCHEME = 'swap';

/**
 * A reserved id answered with an empty 200, for assets we want gone.
 *
 * Blocking used to redirect to `data:,`. Chromium refuses that from a web
 * origin -- the request fails with ERR_UNSAFE_REDIRECT rather than loading
 * nothing, so the asset was not actually being blocked and the console filled
 * with errors. Redirecting to this scheme works because it is registered as
 * standard and secure, which is the same path every swapped file already
 * takes.
 */
export const EMPTY_ID = 'empty';
export const EMPTY_SWAP_URL = `${SWAP_SCHEME}://f/${EMPTY_ID}`;

/**
 * Serves swapped files over a `swap://` scheme.
 *
 * URLs carry an opaque id rather than a path, and that's the whole point. Put
 * the path in the URL and any script on the page can fetch
 * `swap://f/C:%5CUsers%5C...%5Cid_rsa` and read whatever it likes through a
 * handler we installed. Ids only exist for files the scan actually found, so
 * the reachable set is the swap folder and nothing else, and traversal has
 * nowhere to go.
 *
 * Registering the scheme as privileged also means CORS can be granted to just
 * this scheme instead of slapping access-control-allow-origin: * on every
 * response in the session, which is what the clients we cribbed from do.
 */
export function registerSwapScheme(): void {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: SWAP_SCHEME,
      privileges: {
        standard: true,
        secure: true,
        supportFetchAPI: true,
        corsEnabled: true,
        stream: true,
        bypassCSP: true,
      },
    },
  ]);
}

export class SwapServer {
  private readonly byId = new Map<string, string>();
  private readonly byPath = new Map<string, string>();
  private nextId = 1;

  /** Mint (or reuse) a URL for an absolute path. */
  urlFor(absolutePath: string): string {
    const existing = this.byPath.get(absolutePath);
    if (existing !== undefined) return `${SWAP_SCHEME}://f/${existing}`;

    const id = String(this.nextId);
    this.nextId += 1;
    this.byId.set(id, absolutePath);
    this.byPath.set(absolutePath, id);
    return `${SWAP_SCHEME}://f/${id}`;
  }

  /** Resolve an id back to a path, or null if it was never minted. */
  resolve(id: string): string | null {
    return this.byId.get(id) ?? null;
  }

  /** Drop every mapping. Called on rescan. */
  clear(): void {
    this.byId.clear();
    this.byPath.clear();
  }

  get size(): number {
    return this.byId.size;
  }
}

/** Install the protocol handler. Call after `app.whenReady()`. */
export function handleSwapProtocol(server: SwapServer): void {
  protocol.handle(SWAP_SCHEME, async (request) => {
    // swap://f/<id>
    const id = new URL(request.url).pathname.replace(/^\/+/, '');
    // Nothing on disk backs this one; it is the "load nothing" target.
    if (id === EMPTY_ID) return new Response('', { status: 200 });
    const filePath = server.resolve(id);
    if (filePath === null) return new Response('Not found', { status: 404 });

    const fileUrl = pathToFileURL(filePath).toString();
    // Everything but audio and video asks for the whole file.
    const header = request.headers.get('range');
    if (header === null) return net.fetch(fileUrl);
    return servePiece(filePath, fileUrl, header);
  });
}

/**
 * Answer a Range request with exactly the bytes it asked for.
 *
 * This is not optional over a custom scheme: Chromium's media loader takes
 * whatever comes back to begin at the position it asked for. See range.ts.
 */
async function servePiece(filePath: string, fileUrl: string, header: string): Promise<Response> {
  let size: number;
  try {
    size = (await stat(filePath)).size;
  } catch {
    return new Response('Not found', { status: 404 });
  }

  const range = parseByteRange(header, size);
  if (range === null) return net.fetch(fileUrl);
  if (range === 'unsatisfiable') {
    return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${size}` } });
  }

  const piece = Readable.toWeb(createReadStream(filePath, { start: range.start, end: range.end }));
  return new Response(piece as ReadableStream<Uint8Array>, {
    status: 206,
    headers: {
      'Content-Type': mediaTypeFor(filePath),
      'Content-Length': String(range.end - range.start + 1),
      'Content-Range': `bytes ${range.start}-${range.end}/${size}`,
      'Accept-Ranges': 'bytes',
    },
  });
}
