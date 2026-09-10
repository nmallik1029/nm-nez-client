import { clipboard, ClipboardItem } from 'electron';

/**
 * Electron 44 swapped the synchronous clipboard module for a W3C-shaped async
 * one: writeImage/readImage/writeBookmark are gone, readText() returns a
 * promise, and images go through write([new ClipboardItem(...)]).
 *
 * Both clients this project cribs from are still on Electron 43 and call the
 * old API everywhere, so anything ported over has to come through here.
 */

export async function writeText(text: string): Promise<void> {
  await clipboard.writeText(text);
}

export async function readText(): Promise<string> {
  try {
    return (await clipboard.readText()).trim();
  } catch {
    // Empty or non-text clipboard should read as "nothing", not throw.
    return '';
  }
}

export async function writePng(png: Uint8Array): Promise<void> {
  const blob = new Blob([png], { type: 'image/png' });
  await clipboard.write([new ClipboardItem({ 'image/png': blob })]);
}
