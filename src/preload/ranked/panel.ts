import { ipcRenderer } from 'electron';
import { IPC } from '../../shared/ipc';
import { RANKED_REGIONS } from '../../shared/ranked';
import { SHEETS, STYLE_IDS, UI_IDS } from '../../shared/ui';
import { defineStyle } from '../style';

/**
 * The ranked queue, in the page instead of a window of its own.
 *
 * The queue itself is unchanged and still lives in the main process, which is
 * the whole reason this can be thrown away and rebuilt freely: closing the
 * panel, reloading the page, or jumping to another server does not touch the
 * socket. Main keeps queueing and this reconnects to the state when it comes
 * back, by asking for it on load rather than waiting for the next push.
 *
 * A userscript doing the same job has to keep the socket in the page, so it
 * needs localStorage and a reconnect on every navigation. None of that is
 * needed here; the state simply outlives the page.
 *
 * Two pieces: the panel, which you open and close, and a pill that shows
 * while the panel is shut and the queue is running, so closing it never means
 * losing track of it.
 */

const PANEL_ID = UI_IDS.rankedPanel;
const PILL_ID = UI_IDS.rankedPill;

/** Shape main sends, already decorated with labels. */
interface RankedView {
  readonly status: 'idle' | 'connecting' | 'queued' | 'matched' | 'cooldown' | 'error';
  readonly since?: number;
  readonly until?: number;
  readonly regions?: readonly string[];
  readonly mapLabel?: string;
  readonly regionLabel?: string;
  readonly message?: string;
}

let view: RankedView = { status: 'idle' };
let ticker: ReturnType<typeof setInterval> | null = null;

/** `hh:mm:ss`, because a queue can genuinely run for an hour. */
function clock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const pad = (n: number): string => String(n).padStart(2, '0');
  return `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
}

function elapsed(): string {
  if (view.status !== 'queued' || typeof view.since !== 'number') return '00:00:00';
  return clock((Date.now() - view.since) / 1000);
}

function cooldownLeft(): string {
  if (typeof view.until !== 'number') return '00:00:00';
  return clock((view.until - Date.now()) / 1000);
}

/** Is the queue doing something worth keeping on screen? */
function isLive(): boolean {
  if (view.status === 'queued' || view.status === 'connecting') return true;
  return view.status === 'cooldown' && typeof view.until === 'number' && Date.now() < view.until;
}

// ── pill ─────────────────────────────────────────────────────────────────

function syncPill(): void {
  const existing = document.getElementById(PILL_ID);
  const wanted = isLive() && document.getElementById(PANEL_ID) === null;

  if (!wanted) {
    existing?.remove();
    return;
  }

  const pill = existing ?? document.createElement('div');
  if (!existing) {
    pill.id = PILL_ID;
    const dot = document.createElement('i');
    const text = document.createElement('span');
    text.className = 'txt';
    const open = document.createElement('button');
    open.className = 'open';
    open.textContent = 'Open';
    open.addEventListener('click', () => openPanel());
    const stop = document.createElement('button');
    stop.className = 'stop';
    stop.textContent = 'Stop';
    stop.addEventListener('click', () => ipcRenderer.send(IPC.rankedStop));
    pill.append(dot, text, open, stop);
    document.body.appendChild(pill);
  }

  const text = pill.querySelector('.txt');
  if (text) {
    text.textContent =
      view.status === 'cooldown'
        ? `Cooldown ${cooldownLeft()}`
        : view.status === 'connecting'
          ? 'Connecting'
          : `Searching ${elapsed()}`;
  }
}

// ── panel ────────────────────────────────────────────────────────────────

/** Repaint the live parts. Rebuilding the whole panel would fight the boxes. */
function paintPanel(): void {
  const panel = document.getElementById(PANEL_ID);
  if (!panel) return;

  const status = panel.querySelector('.status');
  const dot = panel.querySelector('.dot');
  const timer = panel.querySelector('.timer');
  const button = panel.querySelector<HTMLButtonElement>('.go');
  const note = panel.querySelector('.note');

  const queued = view.status === 'queued';
  const cooling = view.status === 'cooldown' && typeof view.until === 'number' && Date.now() < view.until;

  if (status) {
    status.textContent =
      view.status === 'matched'
        ? 'Match found'
        : queued
          ? 'In queue'
          : view.status === 'connecting'
            ? 'Connecting'
            : cooling
              ? `Cooldown ${cooldownLeft()}`
              : view.status === 'error'
                ? 'Error'
                : 'Ready';
  }
  dot?.classList.toggle('on', queued || view.status === 'matched');
  if (timer) timer.textContent = cooling ? cooldownLeft() : elapsed();

  if (button) {
    button.textContent = queued || view.status === 'connecting' ? 'Leave Queue' : 'Start Queue';
    button.classList.toggle('live', queued);
    button.disabled = cooling;
  }

  if (note) {
    note.textContent =
      view.status === 'matched'
        ? `${view.mapLabel ?? 'Match'} in ${view.regionLabel ?? 'your region'} — rejoin from Krunker's ranked menu.`
        : view.status === 'error'
          ? (view.message ?? 'Queue error')
          : 'Keeps queueing if you close this, reload, or switch servers.';
    note.classList.toggle('bad', view.status === 'error');
  }
}

function buildPanel(): HTMLElement {
  const backdrop = document.createElement('div');
  backdrop.id = `${PANEL_ID}-backdrop`;
  const panel = document.createElement('div');
  panel.id = PANEL_ID;
  backdrop.appendChild(panel);

  const head = document.createElement('div');
  head.className = 'hd';
  const title = document.createElement('h2');
  title.textContent = 'RANKED QUEUE';
  head.appendChild(title);

  const body = document.createElement('div');
  body.className = 'bd';

  const line = document.createElement('div');
  line.className = 'line';
  const dot = document.createElement('i');
  dot.className = 'dot';
  const status = document.createElement('span');
  status.className = 'status';
  line.append(dot, status);

  const timer = document.createElement('div');
  timer.className = 'timer';

  const regions = document.createElement('div');
  regions.className = 'regions';
  for (const region of RANKED_REGIONS) {
    const label = document.createElement('label');
    const box = document.createElement('input');
    box.type = 'checkbox';
    box.value = region.id;
    box.checked = (view.regions ?? []).includes(region.id);
    box.addEventListener('change', () => {
      const chosen = [...regions.querySelectorAll<HTMLInputElement>('input:checked')].map(
        (input) => input.value,
      );
      ipcRenderer.send(IPC.rankedSetRegions, chosen);
    });
    const text = document.createElement('span');
    text.textContent = region.label;
    label.append(box, text);
    regions.appendChild(label);
  }

  const go = document.createElement('button');
  go.className = 'go';
  go.addEventListener('click', () => {
    if (view.status === 'queued' || view.status === 'connecting') {
      ipcRenderer.send(IPC.rankedStop);
    } else {
      ipcRenderer.send(IPC.rankedStart);
    }
  });

  const note = document.createElement('div');
  note.className = 'note';

  body.append(line, timer, regions, go, note);
  panel.append(head, body);

  // Closing is closing, not stopping. The queue is main's, not this panel's.
  backdrop.addEventListener('click', (event) => {
    if (event.target === backdrop) closePanel();
  });
  return backdrop;
}

function onKey(event: KeyboardEvent): void {
  if (event.key !== 'Escape') return;
  if (!document.getElementById(PANEL_ID)) return;
  event.stopPropagation();
  event.preventDefault();
  closePanel();
}

export function closePanel(): void {
  document.getElementById(`${PANEL_ID}-backdrop`)?.remove();
  document.removeEventListener('keydown', onKey, true);
  syncPill();
}

export function openPanel(): void {
  if (document.getElementById(PANEL_ID)) return;
  defineStyle(STYLE_IDS.rankedPanel, SHEETS.rankedPanel);
  document.body.appendChild(buildPanel());
  document.addEventListener('keydown', onKey, true);
  syncPill();
  paintPanel();
}

/** Open it, or shut it if it is already up. */
export function toggleRankedPanel(): void {
  if (document.getElementById(PANEL_ID)) closePanel();
  else openPanel();
}

// ── wiring ───────────────────────────────────────────────────────────────

function apply(next: RankedView): void {
  view = next;
  paintPanel();
  syncPill();
}

/**
 * Listen for pushes, and ask once for what has already happened.
 *
 * The ask is the part that makes a reload seamless: main has been queueing
 * the whole time and will not push again until something changes, so without
 * it a page that reloads mid-queue shows "Ready".
 */
export function installRankedPanel(): void {
  ipcRenderer.on(IPC.rankedState, (_event, state: RankedView) => apply(state));

  void ipcRenderer
    .invoke(IPC.rankedCurrent)
    .then((state: unknown) => apply(state as RankedView))
    .catch(() => {
      // Older main process. The next push will catch us up.
    });

  // The timer and the cooldown are clocks, so they tick on their own rather
  // than waiting for a state change that is not coming.
  if (ticker === null) {
    ticker = setInterval(() => {
      if (!isLive() && document.getElementById(PANEL_ID) === null) return;
      paintPanel();
      syncPill();
    }, 1000);
  }
}
