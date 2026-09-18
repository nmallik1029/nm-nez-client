import { KRUNKER_TEAM_SCORES } from '../../krunker/constants';
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
 * Live accuracy, in the HUD beside kills and deaths: one line for the match
 * so far and one for the current life, the match line above or below as set.
 *
 * The counting is in shared/accuracy.ts; this is the page end of it. Shots
 * are read off the ammo counter, hits off the game's hit sound, and the
 * readout is built from Krunker's own statIcon / greyInner classes so it sits
 * in the top-right strip looking like one of the game's own stats.
 *
 * When you die, the finished life's figure stays on screen until your first
 * shot of the next one; the match line carries straight on.
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

/** Put the match line above the life line, or below it. Applies on screen now. */
export function setAccuracyPlacement(next: AccuracyPlacement): void {
  placement = next;
  arrange();
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
 * Build the readout into Krunker's HUD strip.
 *
 * Re-checked on the timer, because the strip is Krunker's and it rebuilds it;
 * a readout that has been dropped out of the page is put back.
 */
function mount(): void {
  const strip = document.querySelector(KRUNKER_TEAM_SCORES.counterStrip);
  if (!strip || element?.parentElement === strip) return;

  defineStyle(STYLE_IDS.accuracyCounter, SHEETS.accuracyCounter);
  element?.remove();

  element = document.createElement('div');
  element.id = UI_IDS.accuracyCounter;
  element.className = KRUNKER_TEAM_SCORES.counterClass;

  const inner = document.createElement('div');
  inner.className = KRUNKER_TEAM_SCORES.counterInnerClass;
  matchLine = line('Match');
  lifeLine = line('Life');

  element.append(inner);
  arrange();
  strip.append(element);
  render();
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

/**
 * Put the two lines in the configured order. Appending a node that is
 * already there moves it, so this is also how a change of setting reorders
 * a readout that is on screen.
 */
function arrange(): void {
  const inner = element?.firstElementChild;
  if (!inner || !matchLine || !lifeLine) return;
  if (placement === 'bottom') inner.append(lifeLine.row, matchLine.row);
  else inner.append(matchLine.row, lifeLine.row);
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
