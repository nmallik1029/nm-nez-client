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

function place(): void {
  const footer = document.querySelector(FOOTER_SELECTOR);
  if (!footer) return;
  if (footer.querySelector(`#${BUTTON_ID}`)) return;

  defineStyle(STYLE_IDS.queueButton, SHEETS.queueButton);

  // Krunker's own button is hidden by the sheet, not removed, so it is still
  // here to copy a class list from and still here for Svelte to re-render.
  const start = footer.querySelector(START_SELECTOR);
  const button = buildButton(start);

  // Exactly where theirs was, so the footer reads the same.
  if (start) start.insertAdjacentElement('beforebegin', button);
  else footer.appendChild(button);
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
