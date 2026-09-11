import { ipcRenderer } from 'electron';
import { IPC } from '../shared/ipc';
import { SHEETS, STYLE_IDS, UI_IDS } from '../shared/ui';
import { toggleRankedPanel } from './ranked/panel';
import { defineStyle } from './style';

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
 * That is the one state ours replaces. The button has at least one other —
 * rejoining a ranked game already in progress — and there is no version of
 * that we could provide, since only the game knows which match to put you
 * back into. Matching on the label rather than on some state flag because
 * the label is the only thing about it that is stable and readable.
 */
const FIND_MATCH_LABEL = /find\s*match/i;
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
  // An empty label is a re-render in progress, not a state. Treating it as
  // the rejoin state would flash their button on every update.
  const offeringSearch = label === '' || FIND_MATCH_LABEL.test(label);

  theirs.toggleAttribute(REJOIN_ATTR, !offeringSearch);
  ours.style.display = offeringSearch ? '' : 'none';
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

  const observer = new MutationObserver(() => place());
  observer.observe(root, { childList: true, subtree: true });
}
