import { ipcRenderer } from 'electron';
import { IPC } from '../shared/ipc';

/**
 * Swaps Krunker's ping readout for the measured one, in place.
 *
 * It should look like nothing happened: same element, same font, same spot,
 * same colour, just a real TCP round-trip instead of the game's estimate.
 *
 * Krunker rewrites these elements on its own schedule through `textContent`,
 * so assigning to them just loses the race. Instead the element's own
 * `textContent` setter gets shadowed with a no-op and we write through
 * `innerText`, a different setter the game doesn't touch. Its updates quietly
 * do nothing and ours land.
 *
 * Shadowing waits for the first real sample. If main never sends one (no match
 * joined, feature off) Krunker's own value comes through untouched rather than
 * the HUD sitting frozen on nothing.
 */

/** Elements Krunker renders its ping into. */
const PING_ELEMENT_IDS = ['pingText', 'menuPingText'] as const;

let installed = false;

export function installRealPing(): void {
  if (installed) return;
  installed = true;

  // Per element, since Krunker replaces these nodes on a HUD re-render and a
  // fresh node needs shadowing again. WeakSet so the old ones can be collected.
  const shadowed = new WeakSet<HTMLElement>();

  ipcRenderer.on(IPC.serverPing, (_event, ms: unknown) => {
    if (typeof ms !== 'number' || !Number.isFinite(ms) || ms < 0) return;
    const text = String(Math.round(ms));

    for (const id of PING_ELEMENT_IDS) {
      const element = document.getElementById(id);
      if (!element) continue;

      if (!shadowed.has(element)) {
        Object.defineProperty(element, 'textContent', {
          set: () => {},
          get: () => text,
          configurable: true,
        });
        shadowed.add(element);
      }

      element.innerText = text;
    }
  });
}
