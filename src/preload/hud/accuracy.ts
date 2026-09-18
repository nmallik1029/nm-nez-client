import { KRUNKER_DOM_IDS, KRUNKER_TEAM_SCORES } from '../../krunker/constants';
import {
  accuracyLabel,
  EMPTY_TALLY,
  lifeShown,
  readAmmo,
  shotsBetween,
  tallyHit,
  tallyNewLife,
  tallyShots,
  type AccuracyTally,
  type AmmoReading,
} from '../../shared/accuracy';
import type { AccuracyPlacement } from '../../shared/config';
import { SHEETS, STYLE_IDS, UI_IDS } from '../../shared/ui';
import { HIT_SOUNDS, onGameSound } from '../look/game-sound';
import { watchCounter } from '../look/hud-counter';
import { defineStyle, removeStyle } from '../style';

/**
 * Live accuracy, top centre or bottom centre of the screen as set: the match
 * so far and the current life, side by side.
 *
 * The counting is in shared/accuracy.ts; this is the page end of it. Shots
 * are read off the ammo counter, hits off the game's hit sound, and the
 * readout is built from Krunker's own statIcon / greyInner classes so it
 * looks like one of the game's own stats.
 *
 * When you die, the finished life's figure stays on screen until your first
 * shot of the next one; the match figure carries straight on.
 */

const AMMO_VALUE_ID = 'ammoVal';
const AMMO_MAX_ID = 'ammoMax';
const REATTACH_MS = 2_000;

let tally: AccuracyTally = EMPTY_TALLY;
let lastAmmo: AmmoReading | null = null;
let placement: AccuracyPlacement = 'top';

let element: HTMLElement | null = null;
let matchLine: Line | null = null;
let lifeLine: Line | null = null;
let ammoParent: HTMLElement | null = null;
let ammoObserver: MutationObserver | null = null;
let timer: ReturnType<typeof setInterval> | null = null;
let unsubscribe: (() => void) | null = null;

export function setAccuracyCounter(on: boolean): void {
  if (!on) {
    teardown();
    return;
  }

  if (unsubscribe === null) {
    unsubscribe = onGameSound((name) => {
      if (!HIT_SOUNDS.has(name)) return;
      tally = tallyHit(tally, performance.now());
      render();
    });
  }

  tick();
  if (timer === null) timer = setInterval(tick, REATTACH_MS);
}

/** Top centre or bottom centre. A readout already on screen moves now. */
export function setAccuracyPlacement(next: AccuracyPlacement): void {
  placement = next;
  if (element) mount();
}

/** Put anything Krunker has rebuilt back. Does nothing when nothing moved. */
function tick(): void {
  mount();
  attachAmmo();
  for (const counter of counters) counter.attach();
}

function render(): void {
  if (matchLine) matchLine.value.textContent = accuracyLabel(tally.match);
  if (lifeLine) lifeLine.value.textContent = accuracyLabel(lifeShown(tally));
}

/** A new life: a fresh count, with the last figure left up for now. */
function newLife(): void {
  tally = tallyNewLife(tally);
}

/** A new match: nothing from the last one carries over, on screen or off. */
function newMatch(): void {
  tally = EMPTY_TALLY;
  lastAmmo = null;
  render();
}

const counters = [
  // The death counter is watched under both ids the page has used. The
  // headshot script verified #deathCount in a live match; Krunker's current
  // CSS styles #deathsVal. Whichever is live fires, and resetting twice for
  // one death is still one reset.
  watchCounter('deathCount', newLife, newMatch),
  watchCounter('deathsVal', newLife, newMatch),
  // Kills only say something here when they go backwards: a new match.
  watchCounter('killsVal', () => {}, newMatch),
];

/**
 * Watch the ammo counter.
 *
 * Observed through its parent rather than #ammoVal itself, so a counter that
 * Krunker replaces with a fresh element is still seen, and the magazine size
 * beside it is read in the same pass.
 */
function attachAmmo(): void {
  const parent = document.getElementById(AMMO_VALUE_ID)?.parentElement ?? null;
  if (!parent || parent === ammoParent) return;

  ammoObserver?.disconnect();
  ammoParent = parent;
  lastAmmo = null;
  ammoObserver = new MutationObserver(readAmmoNow);
  ammoObserver.observe(parent, { childList: true, characterData: true, subtree: true });
  readAmmoNow();
}

function readAmmoNow(): void {
  const next = readAmmo(
    document.getElementById(AMMO_VALUE_ID)?.textContent,
    document.getElementById(AMMO_MAX_ID)?.textContent,
  );
  const shots = shotsBetween(lastAmmo, next);
  lastAmmo = next;
  if (shots === 0) return;
  tally = tallyShots(tally, shots, performance.now());
  render();
}

/**
 * Build the readout into Krunker's HUD, top centre or bottom centre.
 *
 * Re-checked on the timer, because the HUD is Krunker's and parts of it get
 * rebuilt, and on a change of setting. A readout that is not where it should
 * be, dropped out of the page or left at the other end, is built again in
 * the right place.
 */
function mount(): void {
  const spot = placement === 'bottom' ? bottomCentre() : topCentre();
  if (!spot || element?.parentElement === spot.parent) return;

  defineStyle(STYLE_IDS.accuracyCounter, SHEETS.accuracyCounter);
  element?.remove();

  element = document.createElement('div');
  element.id = UI_IDS.accuracyCounter;
  element.className = KRUNKER_TEAM_SCORES.counterClass;
  element.dataset.place = placement;

  const inner = document.createElement('div');
  inner.className = KRUNKER_TEAM_SCORES.counterInnerClass;
  matchLine = line('Match');
  lifeLine = line('Life');
  inner.append(matchLine.row, lifeLine.row);

  element.append(inner);
  spot.parent.insertBefore(element, spot.before);
  render();
}

interface Spot {
  readonly parent: Element;
  /** The child the readout goes in front of, or null for the end. */
  readonly before: Element | null;
}

/**
 * First in Krunker's top-centre column, so the rounds score and the flag and
 * round messages it also holds stack underneath instead of being covered.
 */
function topCentre(): Spot | null {
  const column = document.getElementById(KRUNKER_DOM_IDS.hudTopCentre);
  return column ? { parent: column, before: column.firstElementChild } : null;
}

/**
 * Just ahead of the reload prompt, which shares the bottom centre. Neither
 * has a z-index, so markup order decides, and this way round the prompt
 * paints over the readout while the magazine is empty.
 */
function bottomCentre(): Spot | null {
  const reload = document.getElementById(KRUNKER_DOM_IDS.reloadPrompt);
  const parent = reload?.parentElement;
  return reload && parent ? { parent, before: reload } : null;
}

interface Line {
  readonly row: HTMLElement;
  readonly value: HTMLElement;
}

function line(name: string): Line {
  const row = document.createElement('div');
  row.className = 'line';
  const label = document.createElement('span');
  label.className = 'lbl';
  label.textContent = name;
  const value = document.createElement('span');
  value.className = 'val';
  row.append(label, value);
  return { row, value };
}

function teardown(): void {
  if (timer !== null) {
    clearInterval(timer);
    timer = null;
  }
  unsubscribe?.();
  unsubscribe = null;
  ammoObserver?.disconnect();
  ammoObserver = null;
  ammoParent = null;
  for (const counter of counters) counter.stop();
  element?.remove();
  element = null;
  matchLine = null;
  lifeLine = null;
  removeStyle(STYLE_IDS.accuracyCounter);
  tally = EMPTY_TALLY;
  lastAmmo = null;
}
