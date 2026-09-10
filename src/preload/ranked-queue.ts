import { ipcRenderer } from 'electron';
import { IPC } from '../shared/ipc';
import type { QueueState } from '../main/ranked/queue';

/**
 * Preload for the queue window.
 *
 * Not much to it. That window renders our own markup from a data URL and
 * talks to nothing else, so the bridge is three functions. Separate from the
 * game preload because there's no Krunker page here to hook, and giving it
 * all that surface area for nothing would be daft.
 */
const api = {
  start: (): void => {
    ipcRenderer.send(IPC.rankedStart);
  },
  stop: (): void => {
    ipcRenderer.send(IPC.rankedStop);
  },
  setRegions: (regions: string[]): void => {
    ipcRenderer.send(IPC.rankedSetRegions, regions);
  },
  onState: (handler: (state: QueueState) => void): void => {
    ipcRenderer.on(IPC.rankedState, (_event, state: QueueState) => handler(state));
  },
};

(window as unknown as { rankedQueue: typeof api }).rankedQueue = api;
