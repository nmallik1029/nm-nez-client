import { ipcRenderer } from 'electron';
import type { MatchmakerFilter } from '../../shared/config';
import { IPC, type ScanResult } from '../../shared/ipc';
import { joinUrl, passesFilter, sortLobbies } from '../../shared/matchmaker';
import { SCAN_TIMING, SHEETS, STYLE_IDS, UI_IDS } from '../../shared/ui';
import { defineStyle } from '../style';

/**
 * The match search.
 *
 * One hotkey, no browsing: set your filters once in Settings, and this fetches
 * the live lobby list, picks the best one and joins it.
 *
 * A title and a bar, and nothing else.
 *
 * It used to flick every rejected lobby past on screen, map preview and all,
 * for about three and a half seconds of which three were theatre. The feedback
 * was that it looked like it was doing something complicated, and that is fair:
 * the only thing anyone can act on while it runs is Escape, so everything past
 * "it is working" and "here is what went wrong" was noise. The sweep, the
 * thumbnails, the burn and the green flood are all gone, along with the image
 * preloading that existed to keep the sweep from popping.
 *
 * The bar is honest about the one real wait, which is the lobby list. It creeps
 * most of the way while that request is in flight and completes when there is
 * an answer, rather than pretending to know how long a fetch will take.
 */

const OVERLAY_ID = UI_IDS.scan;
const { searchMs, crawlMs, completeMs, holdMs, errorMs } = SCAN_TIMING;

/**
 * Where the bar gets to on each leg while waiting on the lobby list.
 *
 * Neither reaches the end, on purpose. A bar that fills and then sits there
 * has lied about being finished; one that stops short says "still going"
 * without claiming to know when it will be done.
 *
 * Two legs rather than one because the fetch has no reliable duration. The
 * first covers the common case at a believable speed; the crawl is what
 * stops a slow one from looking hung.
 */
const SEARCH_PROGRESS = 0.7;
const CRAWL_PROGRESS = 0.95;

export interface MatchSearchDeps {
  readonly getFilter: () => MatchmakerFilter;
  readonly onToast: (message: string) => void;
}

export interface MatchSearch {
  run(): Promise<void>;
  cancel(): void;
  readonly running: boolean;
}

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

export function createMatchSearch(deps: MatchSearchDeps): MatchSearch {
  let overlay: HTMLElement | null = null;
  let fill: HTMLElement | null = null;
  let note: HTMLElement | null = null;

  /**
   * Bumped on every run and cancel. A search in flight re-checks it after each
   * await and bails if it moved, so a cancelled scan can't carry on and drop
   * you into a game you didn't ask for.
   */
  let generation = 0;
  let active = false;
  /** Cleared when the bar is sent to full, so the crawl cannot walk it back. */
  let crawlTimer: ReturnType<typeof setTimeout> | null = null;

  function build(): HTMLElement {
    defineStyle(STYLE_IDS.scan, SHEETS.scan);

    const root = document.createElement('div');
    root.id = OVERLAY_ID;

    const box = document.createElement('div');
    box.className = 'sc-box';

    const title = document.createElement('div');
    title.className = 'sc-title';
    title.textContent = 'Finding match';

    const track = document.createElement('div');
    track.className = 'sc-track';
    fill = document.createElement('div');
    fill.className = 'sc-fill';
    track.appendChild(fill);

    note = document.createElement('div');
    note.className = 'sc-note';

    box.append(title, track, note);
    root.append(box);
    document.documentElement.append(root);
    return root;
  }

  /**
   * Move the bar. `durationMs` of 0 jumps, which is how it gets back to empty
   * between runs without animating backwards.
   */
  function setProgress(fraction: number, durationMs: number): void {
    if (!fill) return;
    fill.style.transitionDuration = `${durationMs}ms`;
    fill.style.width = `${Math.round(fraction * 100)}%`;
  }

  function show(): void {
    overlay ??= build();
    stopCrawl();
    setProgress(0, 0);
    fill?.classList.remove('bad');
    if (note) {
      note.textContent = '';
      note.classList.remove('bad');
    }
    overlay.classList.add('on');
    document.documentElement.classList.add('kc-scanning');
    if (document.pointerLockElement) document.exitPointerLock();
    document.addEventListener('keydown', onKey, true);
  }

  function hide(): void {
    overlay?.classList.remove('on');
    document.documentElement.classList.remove('kc-scanning');
    document.removeEventListener('keydown', onKey, true);
  }

  function onKey(event: KeyboardEvent): void {
    if (event.key !== 'Escape') return;
    event.preventDefault();
    event.stopImmediatePropagation();
    cancel();
  }

  function setNote(text: string, bad = false): void {
    if (!note) return;
    note.textContent = text;
    note.classList.toggle('bad', bad);
  }

  /** Stop the crawl. Anything that finishes the bar has to call this first. */
  function stopCrawl(): void {
    if (crawlTimer === null) return;
    clearTimeout(crawlTimer);
    crawlTimer = null;
  }

  /** Nothing to join. Run the bar out in red so it reads as finished, badly. */
  function fail(message: string): void {
    stopCrawl();
    setNote(message, true);
    fill?.classList.add('bad');
    setProgress(1, completeMs);
  }

  function cancel(): void {
    if (!active) return;
    stopCrawl();
    generation += 1;
    active = false;
    hide();
  }

  function currentGameID(): string {
    return new URLSearchParams(window.location.search).get('game') ?? '';
  }

  async function run(): Promise<void> {
    generation += 1;
    const runId = generation;
    active = true;

    show();
    setNote('Searching for lobbies');
    // Next frame. Setting width in the same frame it was zeroed in gives the
    // transition nothing to animate from, and the bar jumps instead of filling.
    requestAnimationFrame(() => {
      if (generation !== runId) return;
      setProgress(SEARCH_PROGRESS, searchMs);
      // Hand over to the crawl if the list has not landed by then.
      crawlTimer = setTimeout(() => {
        crawlTimer = null;
        if (generation === runId) setProgress(CRAWL_PROGRESS, crawlMs);
      }, searchMs);
    });

    let result: ScanResult;
    try {
      result = (await ipcRenderer.invoke(IPC.matchmakerScan)) as ScanResult;
    } catch {
      if (generation !== runId) return;
      fail('Matchmaker unreachable');
      await sleep(errorMs);
      if (generation === runId) finish(runId);
      return;
    }
    if (generation !== runId) return;

    const filter = deps.getFilter();
    const best = sortLobbies(
      result.lobbies.filter((lobby) => passesFilter(lobby, filter, currentGameID())),
      filter,
      result.pings,
    )[0];

    if (!best) {
      fail('No lobby matches your filters. Check Settings › Client › Matchmaker');
      await sleep(errorMs);
      if (generation === runId) finish(runId);
      return;
    }

    const ping = result.pings[best.region];
    setNote(
      ping !== undefined && ping >= 0
        ? `${best.region} · ${ping}ms · joining`
        : `${best.region} · joining`,
    );
    stopCrawl();
    setProgress(1, completeMs);

    // Long enough to read where you are going, and no longer.
    await sleep(completeMs + holdMs);
    if (generation !== runId) return;

    active = false;
    window.location.href = joinUrl(best.gameID);
  }

  function finish(runId: number): void {
    if (generation !== runId) return;
    active = false;
    hide();
  }

  return {
    run,
    cancel,
    get running() {
      return active;
    },
  };
}
