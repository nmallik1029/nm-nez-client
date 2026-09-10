import { ipcRenderer } from 'electron';
import type { MatchmakerFilter } from '../../shared/config';
import { IPC, type ScanResult } from '../../shared/ipc';
import {
  joinUrl,
  mapIconUrl,
  passesFilter,
  planScan,
  prettyMap,
  shortMode,
  sortLobbies,
  type Lobby,
} from '../../shared/matchmaker';

/**
 * The match search.
 *
 * One hotkey, no browsing. Set filters once in settings and this fetches the
 * live list, flicks through the candidates on screen and joins the best one.
 *
 * Every candidate shows the map's preview image, and two things follow from
 * that:
 *
 *  - The sweep is much slower than a text-only feed would need to be.
 *    Thumbnails going past at 90ms are just noise; around 170ms you can
 *    actually see which maps got rejected.
 *  - Images are preloaded before the sweep starts so lines don't pop in half
 *    drawn. Layout reserves the thumbnail box either way, so a slow or missing
 *    image never shifts the text.
 *
 * The result floods the screen green and the navigation happens underneath it,
 * so you never see the page swap as a flash.
 */

const OVERLAY_ID = 'kc-scan';
/** How long a rejected line takes to tumble off. Outlives the tick, so a few overlap. */
const FALL_MS = 780;
const LANDING_PAUSE_MS = 460;
/** Duration of the map-image expansion. */
const EXPAND_MS = 720;
/** Give preloading this long, then start anyway. Not worth stalling the sweep. */
const PRELOAD_BUDGET_MS = 450;

const THUMB_W = 52;
const THUMB_H = 34;

const CSS = `
#kc-scan{position:fixed;inset:0;z-index:2147483260;display:none;pointer-events:none;
  font-family:'GameFont',sans-serif;overflow:hidden}
#kc-scan.on{display:block}

/*
 * GameFont is a pixel face, so everything here gets positioned on whole pixels
 * from JS rather than with percentages or translateX(-50%). Centring by
 * transform lands the text on a fractional offset (590.27px, when I measured
 * it), and a pixel font antialiased across two columns looks doubled and
 * smeared.
 */
#kc-scan .sc-stage{position:absolute;left:0;right:0;height:0}
#kc-scan .sc-line{position:absolute;top:0;white-space:nowrap;font-size:28px;
  letter-spacing:.04em;color:#fff;display:flex;align-items:center;gap:14px;
  text-shadow:0 3px 10px rgba(0,0,0,.85),0 0 2px rgba(0,0,0,.9)}

/* Fixed box whether or not the image has loaded, so text never shifts. */
#kc-scan .sc-thumb{width:${THUMB_W}px;height:${THUMB_H}px;flex:none;border-radius:4px;
  object-fit:cover;background:rgba(0,0,0,.45);box-shadow:0 3px 10px rgba(0,0,0,.6)}

/* Rejected: drift left and down, redden, fade. */
@keyframes kc-fall{
  0%  {opacity:1;   transform:translate(0,0) rotate(0deg)}
  15% {opacity:.95; color:#e06060}
  100%{opacity:0;   transform:translate(-120%,120px) rotate(-10deg); color:#8c3030}
}
#kc-scan .sc-line.out{animation:kc-fall ${FALL_MS}ms cubic-bezier(.25,.6,.5,1) forwards}
#kc-scan .sc-line.out .sc-thumb{filter:grayscale(1) brightness(.6)}

/* Cut a tumble short once the outcome is known. */
#kc-scan .sc-line.out.clear{animation-play-state:paused;
  transition:opacity 130ms linear;opacity:0}

/* Accepted: colour and glow only. scale() would resample the pixel font. */
@keyframes kc-land{
  0%  {color:#fff;    text-shadow:0 3px 10px rgba(0,0,0,.85)}
  45% {color:#6ef29a; text-shadow:0 0 26px rgba(110,242,154,.75),0 3px 10px rgba(0,0,0,.8)}
  100%{color:#4ade80; text-shadow:0 0 20px rgba(74,222,128,.55),0 3px 10px rgba(0,0,0,.8)}
}
#kc-scan .sc-line.hit{animation:kc-land 420ms ease-out forwards}
#kc-scan .sc-line.hit .sc-thumb{box-shadow:0 0 22px rgba(74,222,128,.6)}
/* The line steps aside as its map image takes over. */
#kc-scan .sc-line.fading{transition:opacity 260ms ease-out;opacity:0}

/*
 * The reveal: green floods out from the matched line and covers the screen.
 *
 * This used to grow the map preview instead and it never really worked.
 * Krunker's previews are 200x80 with no larger variant anywhere, so filling
 * 1920px meant about a 10x upscale, and that looked like mush however I
 * layered it. Flat colour has no resolution to run out of.
 *
 * Transform only, so the compositor can do it without relayout every frame.
 */
#kc-scan .sc-flood{position:absolute;width:10px;height:10px;border-radius:50%;
  background:#3ddc7f;transform:translate(-50%,-50%) scale(0);opacity:.92}
@keyframes kc-flood{
  0%  {transform:translate(-50%,-50%) scale(0);   opacity:.55}
  100%{transform:translate(-50%,-50%) scale(560); opacity:1}
}
#kc-scan .sc-flood.go{animation:kc-flood ${EXPAND_MS}ms cubic-bezier(.4,0,.7,1) forwards}

#kc-scan .sc-note{position:absolute;white-space:nowrap;font-size:15px;
  color:rgba(255,255,255,.66);letter-spacing:.04em;
  text-shadow:0 2px 8px rgba(0,0,0,.85)}
#kc-scan .sc-note.bad{color:#e79a9a}

/*
 * Krunker puts its own prompts exactly where the scan text goes. At 1920x1009,
 * #spectButton sits at 428-453 and the note at 435-455. They get hidden for
 * the length of the scan rather than moving our text, since their position
 * moves with the viewport and we'd just collide somewhere else instead.
 *
 * Opacity, not only visibility. The spectate toggle's knob is
 * .sliderSml::before and it still measured as visible with its own element
 * hidden; a universal selector matches elements and never pseudo-elements, so
 * "#spectButton *" can't reach it. Opacity covers the whole subtree,
 * pseudo-elements included, and a descendant can't override an ancestor's
 * opacity the way it can override visibility.
 *
 * transition:none matters as well. visibility is transitionable and the toggle
 * carries a 0.4s transition that would otherwise hold up the hide.
 */
html.kc-scanning #spectButtonHolder,
html.kc-scanning #spectButtonHolder *,
html.kc-scanning #spectButton,
html.kc-scanning #spectButton *,
html.kc-scanning .sliderSml,
html.kc-scanning #instructionHider,
html.kc-scanning #instructionHider *,
html.kc-scanning #instructions{
  visibility:hidden !important;
  opacity:0 !important;
  transition:none !important;
  animation:none !important;
}
html.kc-scanning #spectButton::before,
html.kc-scanning #spectButton::after,
html.kc-scanning .switchsml::before,
html.kc-scanning .switchsml::after,
html.kc-scanning .sliderSml::before,
html.kc-scanning .sliderSml::after{
  visibility:hidden !important;
  opacity:0 !important;
  transition:none !important;
  animation:none !important;
}
`;

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

/** MODE MAPNAME (n/m) */
function lineText(lobby: Lobby): string {
  return `${shortMode(lobby.gamemode)} ${prettyMap(lobby.map).toUpperCase()} (${lobby.playerCount}/${lobby.playerLimit})`;
}

/**
 * Warm the browser cache for a set of images. Resolves when they're all in or
 * when the budget runs out, whichever comes first: a slow CDN should cost the
 * sweep a fraction of a second, not hold the whole feature up.
 */
function preloadImages(urls: readonly string[], budgetMs: number): Promise<void> {
  if (urls.length === 0) return Promise.resolve();
  return new Promise((resolve) => {
    let remaining = urls.length;
    const done = (): void => {
      remaining -= 1;
      if (remaining <= 0) resolve();
    };
    for (const url of urls) {
      const img = new Image();
      img.addEventListener('load', done, { once: true });
      img.addEventListener('error', done, { once: true });
      img.src = url;
    }
    setTimeout(resolve, budgetMs);
  });
}

export function createMatchSearch(deps: MatchSearchDeps): MatchSearch {
  let overlay: HTMLElement | null = null;
  let stage: HTMLElement | null = null;
  let note: HTMLElement | null = null;
  let current: HTMLElement | null = null;

  /**
   * Bumped on every run and cancel. A search in flight re-checks it after each
   * await and bails if it moved, so a cancelled scan can't carry on and drop
   * you into a game you didn't ask for.
   */
  let generation = 0;
  let active = false;

  function build(): HTMLElement {
    const style = document.createElement('style');
    style.textContent = CSS;

    const root = document.createElement('div');
    root.id = OVERLAY_ID;

    stage = document.createElement('div');
    stage.className = 'sc-stage';

    note = document.createElement('div');
    note.className = 'sc-note';

    root.append(stage, note);
    document.documentElement.append(style, root);
    return root;
  }

  function anchorTop(): number {
    return Math.round(window.innerHeight * 0.38);
  }

  /**
   * Centre an element on integer coordinates. Has to be in the DOM with its
   * content already set, since the width gets measured rather than guessed.
   */
  function snapCentre(el: HTMLElement, top: number): void {
    el.style.left = '0px';
    const width = el.getBoundingClientRect().width;
    el.style.left = `${Math.round((window.innerWidth - width) / 2)}px`;
    el.style.top = `${Math.round(top)}px`;
  }

  function show(): void {
    overlay ??= build();
    if (stage) stage.textContent = '';
    if (note) {
      note.textContent = '';
      note.classList.remove('bad');
    }
    overlay.querySelectorAll('.sc-flood').forEach((el) => el.remove());
    current = null;
    if (stage) stage.style.top = `${anchorTop()}px`;
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
    snapCentre(note, anchorTop() + 54);
  }

  function pushLine(lobby: Lobby): HTMLElement | null {
    if (!stage) return null;

    const outgoing = current;
    if (outgoing) {
      outgoing.classList.add('out');
      setTimeout(() => outgoing.remove(), FALL_MS);
    }

    const line = document.createElement('div');
    line.className = 'sc-line';

    const icon = mapIconUrl(lobby.map);
    if (icon !== null) {
      const img = document.createElement('img');
      img.className = 'sc-thumb';
      img.src = icon;
      img.alt = '';
      line.appendChild(img);
    } else {
      // Community map. Keep the box anyway so the text still lines up with
      // its neighbours instead of jumping left.
      const blank = document.createElement('span');
      blank.className = 'sc-thumb';
      line.appendChild(blank);
    }

    const label = document.createElement('span');
    label.textContent = lineText(lobby);
    line.appendChild(label);

    stage.appendChild(line);
    snapCentre(line, 0);
    current = line;
    return line;
  }

  function clearFalling(): void {
    if (!stage) return;
    for (const el of stage.querySelectorAll('.sc-line.out')) {
      el.classList.add('clear');
      setTimeout(() => el.remove(), 150);
    }
  }

  /**
   * Flood the screen green from wherever the winning line sits.
   *
   * A 10px dot scaled up hard rather than a box that grows. Scale is the one
   * property the compositor animates without touching layout, so it stays
   * smooth at any size, and starting from the matched line means the colour
   * comes out of the result instead of arriving from nowhere.
   */
  function floodGreen(): void {
    if (!overlay) return;
    const flood = document.createElement('div');
    flood.className = 'sc-flood';
    flood.style.left = `${Math.round(window.innerWidth / 2)}px`;
    flood.style.top = `${anchorTop()}px`;
    overlay.appendChild(flood);
    void flood.offsetWidth;
    flood.classList.add('go');
  }

  function cancel(): void {
    if (!active) return;
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
    setNote('Finding a match...');

    let result: ScanResult;
    try {
      result = (await ipcRenderer.invoke(IPC.matchmakerScan)) as ScanResult;
    } catch {
      if (generation !== runId) return;
      setNote('Matchmaker unreachable', true);
      await sleep(1600);
      if (generation === runId) finish(runId);
      return;
    }
    if (generation !== runId) return;

    const filter = deps.getFilter();
    const lobbies = result.lobbies;

    const passing = sortLobbies(
      lobbies.filter((lobby) => passesFilter(lobby, filter, currentGameID())),
      filter,
      result.pings,
    );
    const best = passing[0];
    const passingIds = new Set(passing.map((l) => l.gameID));

    // Rejects first, so the sweep ends on the winner instead of flashing the
    // answer partway through.
    const rejects = lobbies.filter((l) => !passingIds.has(l.gameID));
    // Slower than a text feed. Thumbnails need time on screen to register.
    const plan = planScan(rejects.length, { budgetMs: 2600, baseTickMs: 170, minTickMs: 130 });

    // Only the images actually about to be shown, plus the winner's.
    const needed = new Set<string>();
    for (const index of plan.indices) {
      const lobby = rejects[index];
      if (!lobby) continue;
      const icon = mapIconUrl(lobby.map);
      if (icon !== null) needed.add(icon);
    }

    await preloadImages([...needed], PRELOAD_BUDGET_MS);
    if (generation !== runId) return;

    for (const index of plan.indices) {
      if (generation !== runId) return;
      const lobby = rejects[index];
      if (lobby) pushLine(lobby);
      await sleep(plan.tickMs);
    }
    if (generation !== runId) return;

    if (!best) {
      current?.classList.add('out');
      current = null;
      clearFalling();
      setNote('No lobby matches your filters. Check Settings › Client › Matchmaker', true);
      await sleep(2800);
      if (generation === runId) finish(runId);
      return;
    }

    const landed = pushLine(best);
    clearFalling();
    landed?.classList.add('hit');
    const ping = result.pings[best.region];
    setNote(
      ping !== undefined && ping >= 0
        ? `${best.region} · ${ping}ms · joining`
        : `${best.region} · joining`,
    );

    await sleep(LANDING_PAUSE_MS);
    if (generation !== runId) return;

    floodGreen();

    await sleep(EXPAND_MS);
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
