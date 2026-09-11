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
/** Watches #uiBase for the menu/match class flip. */
let screenWatcher: MutationObserver | null = null;
/** Data URL for the match sound, or null if there is no file. */
let matchSound: string | null = null;
/** So a repeated 'matched' push does not fire the sound twice. */
let announced = false;

/**
 * Play the match sound, if the user has dropped one in.
 *
 * Deliberately quiet about failure: autoplay can be refused, the file can be
 * a renamed .wav, and neither is worth taking the match popup down over.
 */
function playMatchSound(): void {
  if (matchSound === null) return;
  try {
    void new Audio(matchSound).play().catch(() => {});
  } catch {
    // No Audio, or a file the decoder will not take.
  }
}

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

/** Regions are fixed for the life of a queue. */
function box_locked(v: RankedView): boolean {
  return v.status === 'queued' || v.status === 'connecting';
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
    // The pill can be the first thing on screen, after a reload it appears
    // without the panel ever having been opened, so it cannot rely on
    // openPanel() having installed the sheet.
    defineStyle(STYLE_IDS.rankedPanel, SHEETS.rankedPanel);
    pill.id = PILL_ID;
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
    pill.append(text, open, stop);
    document.body.appendChild(pill);
  }

  positionPill(pill);

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

/** Breathing room between the pill and whatever it is sitting under. */
const PILL_GAP_PX = 12;

/**
 * Put the pill under whatever is above it on this screen.
 *
 * Two different anchors, because the two screens have different furniture:
 *
 *   in a match  the leaderboard and the counters share the top right, and
 *               the leaderboard grows a row per player, so a constant top
 *               lands on it in a full lobby. Measured off the counters,
 *               which sit below the board.
 *   on the menu that corner is empty but the middle is not, and CLICK TO
 *               PLAY is the thing you are looking at, so it goes under that.
 *
 * Falls back to the stylesheet's own value when neither anchor is there,
 * which is what happens for the moment between loading and the HUD existing.
 */
function positionPill(pill: HTMLElement): void {
  const onMenu = document.getElementById('uiBase')?.classList.contains('onMenu') === true;

  // In a match the pointer is locked, so Open and Stop cannot be reached.
  // Hiding them leaves the one thing that is still useful: the clock.
  pill.classList.toggle('bare', !onMenu);

  if (onMenu) {
    const instructions = document.getElementById('instructions');
    const rect = instructions?.getBoundingClientRect();
    if (rect && rect.height > 0) {
      pill.style.top = `${Math.round(rect.bottom + PILL_GAP_PX)}px`;
      pill.style.left = '50%';
      pill.style.right = 'auto';
      pill.style.transform = 'translateX(-50%)';
      return;
    }
  }

  const counters = document.querySelector('.topRightCounters');
  const rect = counters?.getBoundingClientRect();
  pill.style.left = 'auto';
  pill.style.transform = 'none';
  pill.style.right = '24px';
  if (rect && rect.height > 0) {
    pill.style.top = `${Math.round(rect.bottom + PILL_GAP_PX)}px`;
  } else {
    pill.style.removeProperty('top');
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

  // The whole panel steps between two greens while searching, the way the
  // old external window did. Same beat, same idea: an indicator lamp rather
  // than a glow.
  panel.classList.toggle('live', queued);

  // You queue into the regions you started with, so they cannot be changed
  // mid-queue. Disabled rather than hidden, so it still reads as a choice
  // you have already made.
  for (const box of panel.querySelectorAll<HTMLInputElement>('.regions input')) {
    box.disabled = queued || view.status === 'connecting';
  }
  panel.querySelector('.regions')?.classList.toggle('locked', box_locked(view));

  if (button) {
    button.textContent = queued || view.status === 'connecting' ? 'Leave Queue' : 'Start Queue';
    button.classList.toggle('live', queued);
    button.disabled = cooling;
  }

  if (note) {
    note.textContent =
      view.status === 'matched'
        ? `${view.mapLabel ?? 'Match'} in ${view.regionLabel ?? 'your region'}, rejoin from Krunker's ranked menu.`
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
  const wasMatched = view.status === 'matched';
  view = next;

  if (next.status === 'matched' && !wasMatched && !announced) {
    announced = true;
    playMatchSound();
  }
  if (next.status !== 'matched') announced = false;

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

  // Fetched once up front, so a match does not wait on file IO to make a
  // noise. Null when the user has not put a file in swap/sounds.
  void ipcRenderer
    .invoke(IPC.rankedSound)
    .then((url: unknown) => {
      matchSound = typeof url === 'string' ? url : null;
    })
    .catch(() => {
      matchSound = null;
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

  // Dying, spawning and backing out to the menu all move what the pill has
  // to sit under, and all of them are a class change on #uiBase. Watching
  // for it puts the pill in the right place on the same frame; on the ticker
  // alone it spent up to a second in the old spot, which is the lag you see
  // going in and out of a match.
  const uiBase = document.getElementById('uiBase');
  if (uiBase && screenWatcher === null) {
    screenWatcher = new MutationObserver(() => syncPill());
    screenWatcher.observe(uiBase, { attributes: true, attributeFilter: ['class'] });
  }
  // The HUD also settles over a few frames as it is built, so the anchor can
  // move once more after the class lands.
  window.addEventListener('resize', () => syncPill());
}
