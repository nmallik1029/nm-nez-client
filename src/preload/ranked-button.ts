import { ipcRenderer } from 'electron';
import { IPC } from '../shared/ipc';
import { SHEETS, STYLE_IDS, UI_IDS } from '../shared/ui';
import { toggleRankedPanel } from './ranked/panel';
import { defineStyle } from './style';
import { coalesced } from './schedule';

/**
 * Adds a launcher for the external queue into Krunker's own ranked panel.
 *
 * It sits in the footer row between the "All regions" checkbox and FIND MATCH,
 * which is where you look when you are about to queue anyway. Measured against
 * the live DOM:
 *
 *   .footer-controls
 *     ├─ .queue-all-regions-container   ("All regions")
 *     └─ FIND MATCH
 *
 * Selectors only match the stable part of each class. The markup is
 * Svelte-compiled and every class carries a build hash (svelte-mqcul7) that
 * moves whenever they rebuild, so matching the whole thing breaks on their
 * next deploy.
 */

const BUTTON_ID = UI_IDS.queueButton;
const FOOTER_SELECTOR = '[class*="footer-controls"]';
/** Krunker's own queue button, which ours stands in for. */
const START_SELECTOR = 'button[class*="start-button"]';
/**
 * The label their button wears when it is offering to start a search.
 *
 * That is the one state ours replaces. The button has at least one other, 
 * rejoining a ranked game already in progress, and there is no version of
 * that we could provide, since only the game knows which match to put you
 * back into. Matching on the label rather than on some state flag because
 * the label is the only thing about it that is stable and readable.
 */
const FIND_MATCH_LABEL = /find\s*match/i;
/**
 * Labels that are not a state, just the button between states.
 *
 * Krunker flashes LOADING... for a moment every time the ranked menu
 * opens. Treating that as "not FIND MATCH, therefore rejoin" put a yellow
 * REJOIN on screen for that moment, every single time. It means nothing is
 * known yet, so it is handled as the resting case.
 */
const TRANSIENT_LABEL = /loading|\u2026|\.\.\./i;

/** Set on their button while it is doing a job ours cannot. */
const REJOIN_ATTR = 'data-nm-rejoin';

/**
 * Our button, wearing Krunker's own.
 *
 * The class list is copied off their FIND MATCH rather than written out,
 * because it carries a per-build Svelte hash (`start-button svelte-mqcul7`)
 * that moves every time they deploy. Copying it means this keeps their size,
 * type and hover without us owning any of it.
 */
function buildButton(template: Element | null): HTMLElement {
  const button = document.createElement('button');
  button.id = BUTTON_ID;
  if (template) button.className = template.className;
  button.title = 'Ranked queue. Keeps queueing through a reload or a server change';
  button.textContent = 'QUEUE';
  button.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    // Shift opens the old separate window, which is still the right answer
    // for queueing with the game itself closed.
    if (event.shiftKey) ipcRenderer.send(IPC.rankedOpen);
    else toggleRankedPanel();
  });
  return button;
}

/**
 * Decide which of the two buttons the footer is showing.
 *
 * Ours while theirs says FIND MATCH, theirs otherwise. Run on every pass,
 * not just on insert, because the label changes underneath us: joining a
 * ranked game turns FIND MATCH into a rejoin without rebuilding the footer.
 */
function chooseButton(footer: Element, ours: HTMLElement): void {
  const theirs = footer.querySelector(`${START_SELECTOR}:not(#${BUTTON_ID})`);
  if (!theirs) return;

  const label = (theirs.textContent ?? '').trim();
  // Empty or mid-transition is not a state. Treating either as the rejoin
  // state flashes their button on screen on every update.
  const unknown = label === '' || TRANSIENT_LABEL.test(label);
  const offeringSearch = unknown || FIND_MATCH_LABEL.test(label);

  theirs.toggleAttribute(REJOIN_ATTR, !offeringSearch);

  // setProperty with important, because the rule the two buttons share sets
  // display:inline-flex !important to beat Krunker's own. A plain inline
  // display:none loses to that, which is how both ended up on screen at once.
  if (offeringSearch) ours.style.removeProperty('display');
  else ours.style.setProperty('display', 'none', 'important');
}

function place(): void {
  const footer = document.querySelector(FOOTER_SELECTOR);
  if (!footer) return;

  defineStyle(STYLE_IDS.queueButton, SHEETS.queueButton);

  let button = footer.querySelector<HTMLElement>(`#${BUTTON_ID}`);
  if (!button) {
    // Krunker's own button is hidden by the sheet rather than removed, so it
    // is still here to copy a class list from and still here for Svelte to
    // re-render.
    const start = footer.querySelector(`${START_SELECTOR}:not(#${BUTTON_ID})`);
    button = buildButton(start);
    // Exactly where theirs was, so the footer reads the same.
    if (start) start.insertAdjacentElement('beforebegin', button);
    else footer.appendChild(button);
  }

  chooseButton(footer, button);
}

/**
 * Watch for the ranked panel showing up.
 *
 * It's built and torn down as you navigate, and Svelte re-renders the footer
 * on state changes, so inserting once doesn't stick. The observer puts the
 * button back whenever it goes missing, and the early return in `place()`
 * keeps the common case down to one querySelector.
 */
export function installRankedLaunchButton(): void {
  place();

  const root = document.getElementById('uiBase') ?? document.body;
  if (!root) return;

  const observer = new MutationObserver(coalesced(place));
  observer.observe(root, { childList: true, subtree: true });
}
