import { KRUNKER_DOM_IDS, KRUNKER_TEAM_SCORES } from '../../krunker/constants';
import { SHEETS, STYLE_IDS, UI_IDS } from '../../shared/ui';
import { defineStyle } from '../style';

/**
 * How many enemies are standing on the hardpoint.
 *
 * Nothing in the page says this, so it is inferred from the scoreboard.
 * Hardpoint pays a team 10 points a second for each of its players on the
 * point, so the enemy score climbing by 30 in a tick means three of them are
 * on it. Watch the score, divide the jump by ten.
 *
 * The idea is Glorp's (`hpEnemyCounter.js`); KCC carries a hardened version
 * of the same thing. What is here follows their arithmetic and their DOM
 * reading, with the guards KCC added and one of its own:
 *
 *  - a baseline per team, not one shared number, so two enemy scores cannot
 *    overwrite each other's previous value while spectating,
 *  - the first reading only establishes the baseline; a first tick of "the
 *    enemy has 400 points" is not 40 people on the point,
 *  - a score going down is a round reset, not negative players,
 *  - a jump too large to be people is ignored: capture bonuses land in the
 *    same counter, and a stale baseline produces a huge delta.
 *
 * It is an estimate and worth treating as one. It reads high the moment a
 * capture bonus pays out and reads zero for a beat after everyone steps off.
 */

const ID = UI_IDS.hardpointCounter;

/** Points per second, per enemy standing on the point. Krunker's rule. */
const POINTS_PER_ENEMY = 10;
export const HARDPOINT_POINTS_PER_ENEMY = POINTS_PER_ENEMY;
/**
 * Above this the jump is not people.
 *
 * Krunker's competitive teams cap out well below this, so anything larger is
 * a capture bonus or a baseline that went stale while the tab was hidden.
 */
const MAX_PLAUSIBLE_ENEMIES = 8;
export const HARDPOINT_MAX_ENEMIES = MAX_PLAUSIBLE_ENEMIES;
/**
 * How long a reading stands before it drops back to zero.
 *
 * The score only ticks while someone is on the point, so "no update" is how
 * the page says the point is empty. Long enough to outlast one tick and the
 * jitter around it.
 */
const STALE_MS = 1600;
/** Krunker does not announce a mode change, so the mode is re-checked. */
const MODE_POLL_MS = 2000;

/**
 * How many enemies one tick's score movement accounts for.
 *
 * Null when the jump says nothing usable: no movement, a figure that is not
 * a whole number of players, or one too large to be people rather than a
 * capture bonus or a stale baseline. Separated out because it is the whole
 * idea, and the only part testable without being in a live hardpoint match.
 */
export function enemiesFromScoreJump(jump: number): number | null {
  if (!Number.isFinite(jump) || jump <= 0) return null;
  const count = jump / POINTS_PER_ENEMY;
  if (!Number.isInteger(count) || count > MAX_PLAUSIBLE_ENEMIES) return null;
  return count;
}

/** Last score seen per team header id, so a delta means something. */
const lastScores = new Map<string, number>();
let element: HTMLElement | null = null;
let readout: HTMLElement | null = null;
let observer: MutationObserver | null = null;
let staleTimer: ReturnType<typeof setTimeout> | null = null;
let modeTimer: ReturnType<typeof setInterval> | null = null;
let haveBaseline = false;
let enabled = false;

/**
 * Is this a hardpoint match?
 *
 * `getGameActivity` is the game's own answer, so when it names a mode that
 * settles it either way. Both clients this came from fall through to the
 * competitive header whenever the mode is not Hardpoint, which shows the
 * counter in every other ranked mode as well: that header is on any
 * competitive match, not a hardpoint one. The fallback is only right when
 * the game has not told us yet, which it has not on the menu or mid-load.
 */
function isHardpoint(): boolean {
  let mode: unknown;
  try {
    mode = (
      window as unknown as { getGameActivity?: () => { mode?: unknown } }
    ).getGameActivity?.()?.mode;
  } catch {
    // Not on this build, or threw mid-load. Treated as "not told yet".
  }

  if (typeof mode === 'string' && mode !== '') return mode === 'Hardpoint';
  return document.querySelector(KRUNKER_TEAM_SCORES.competitiveHeader) !== null;
}

function showCount(count: number): void {
  if (readout) readout.textContent = String(count);
}

function resetBaseline(): void {
  lastScores.clear();
  haveBaseline = false;
  showCount(0);
  if (staleTimer !== null) {
    clearTimeout(staleTimer);
    staleTimer = null;
  }
}

/**
 * Turn this tick's score movement into a count.
 *
 * Takes the largest jump across enemy teams rather than summing them: in a
 * two-team match only one is the enemy, and while spectating the interesting
 * number is how contested the point is, not the total of both sides.
 */
function processScores(): void {
  let largestJump = 0;

  for (const header of document.querySelectorAll(KRUNKER_TEAM_SCORES.headers)) {
    // Your own team's score says nothing about who is on the point.
    if (header.className.includes(KRUNKER_TEAM_SCORES.ownTeamClass)) continue;

    // Krunker puts the score beside the header, not inside it.
    const score = Number.parseInt(header.nextElementSibling?.textContent ?? '', 10);
    if (!Number.isFinite(score)) continue;

    const previous = lastScores.get(header.id);
    lastScores.set(header.id, score);

    // Nothing to compare against yet, or the round reset and the score went
    // backwards. Either way this tick only updates the baseline.
    if (previous === undefined || score < previous) continue;

    const jump = score - previous;
    if (jump > largestJump) largestJump = jump;
  }

  // The first pass exists to fill lastScores. Reading a count off it would
  // mean treating the enemy's whole score as one tick's worth.
  if (!haveBaseline) {
    haveBaseline = true;
    return;
  }

  const count = enemiesFromScoreJump(largestJump);
  if (count === null) return;

  showCount(count);
  if (staleTimer !== null) clearTimeout(staleTimer);
  staleTimer = setTimeout(() => {
    showCount(0);
    staleTimer = null;
  }, STALE_MS);
}

/**
 * Put the counter in the HUD, beside Krunker's own.
 *
 * Built from the game's own `statIcon` / `greyInner` classes so it sits in
 * the strip at the same size and spacing as what is already there; the sheet
 * only adds what those two do not cover.
 */
function mount(): void {
  const strip = document.querySelector(KRUNKER_TEAM_SCORES.counterStrip);
  if (!strip || element) return;

  defineStyle(STYLE_IDS.hardpointCounter, SHEETS.hardpointCounter);

  element = document.createElement('div');
  element.id = ID;
  element.className = KRUNKER_TEAM_SCORES.counterClass;

  const inner = document.createElement('div');
  inner.className = KRUNKER_TEAM_SCORES.counterInnerClass;
  const label = document.createElement('span');
  label.className = 'lbl';
  label.textContent = 'ON';
  readout = document.createElement('span');
  readout.className = 'val';
  readout.textContent = '0';
  inner.append(label, readout);
  element.appendChild(inner);
  strip.appendChild(element);

  const scores = document.getElementById(KRUNKER_DOM_IDS.teamScores);
  if (scores) {
    observer = new MutationObserver(processScores);
    observer.observe(scores, { childList: true, subtree: true });
  }
}

function unmount(): void {
  observer?.disconnect();
  observer = null;
  element?.remove();
  element = null;
  readout = null;
  resetBaseline();
}

/** Show it in hardpoint, hide it everywhere else. */
function checkMode(): void {
  if (!enabled) return;

  if (!isHardpoint()) {
    if (element) unmount();
    return;
  }

  const wasAbsent = element === null;
  mount();
  // Entering a fresh match: whatever the last one ended on is not a baseline.
  if (wasAbsent) resetBaseline();
}

/**
 * Turn the counter on or off. Safe to call repeatedly; the poll is only ever
 * set up once, and turning it off takes the element with it.
 */
export function setHardpointCounter(on: boolean): void {
  enabled = on;

  if (!on) {
    if (modeTimer !== null) {
      clearInterval(modeTimer);
      modeTimer = null;
    }
    unmount();
    return;
  }

  checkMode();
  if (modeTimer === null) modeTimer = setInterval(checkMode, MODE_POLL_MS);
}
