import { SHEETS, STYLE_IDS, UI_IDS } from '../../shared/ui';
import { installMenuItem } from '../menu-item';
import { defineStyle } from '../style';
import { renderBuiltIn } from './built-in';
import type { QolDeps, TabContext } from './context';
import { renderUserscripts } from './userscripts';

/**
 * QoL Features: a row at the bottom of Krunker's left menu, and the panel it
 * opens.
 *
 * Two tabs. Userscripts is your own `.js` files, which you drop straight onto
 * the panel rather than going and finding a folder. Built-in is ours, the
 * things the client can do that Krunker cannot.
 *
 * One panel rather than a window per feature, which is the whole point of
 * collecting them: every one of these is a switch somebody flips once and
 * forgets, and a menu with five entries that each open one switch is a menu
 * nobody reads.
 *
 * Same shell as the alt manager and the changelog, and closed the same two
 * ways: click the backdrop or press Escape.
 */

const PANEL_ID = UI_IDS.qolPanel;

type TabId = 'userscripts' | 'builtin';

interface Tab {
  readonly id: TabId;
  readonly label: string;
  readonly render: (body: HTMLElement, ctx: TabContext) => void;
}

const TABS: readonly Tab[] = [
  { id: 'userscripts', label: 'Userscripts', render: renderUserscripts },
  { id: 'builtin', label: 'Built-in', render: renderBuiltIn },
];

let deps: QolDeps | null = null;
let close: (() => void) | null = null;
/** Kept across a close, so re-opening lands on the tab you were last on. */
let current: TabId = 'userscripts';

/** Open the panel, or close it if it is already open. */
export function toggleQol(): void {
  if (close) {
    close();
    return;
  }
  open();
}

function open(): void {
  const active = deps;
  if (!active) return;

  defineStyle(STYLE_IDS.qolPanel, SHEETS.qolPanel);

  const backdrop = document.createElement('div');
  backdrop.id = `${PANEL_ID}-backdrop`;
  const panel = document.createElement('div');
  panel.id = PANEL_ID;
  backdrop.appendChild(panel);

  // Captured ahead of Krunker's own handler, which otherwise eats Escape and
  // opens the game menu behind us.
  const onKey = (event: KeyboardEvent): void => {
    if (event.key !== 'Escape') return;
    event.stopPropagation();
    event.preventDefault();
    close?.();
  };
  backdrop.addEventListener('click', (event) => {
    if (event.target === backdrop) close?.();
  });

  close = () => {
    document.removeEventListener('keydown', onKey, true);
    backdrop.remove();
    close = null;
  };
  document.addEventListener('keydown', onKey, true);
  document.body.appendChild(backdrop);

  render(panel, active);
}

function render(panel: HTMLElement, active: QolDeps): void {
  panel.replaceChildren();

  const head = document.createElement('div');
  head.className = 'hd';
  const title = document.createElement('h2');
  title.textContent = 'QOL FEATURES';
  head.appendChild(title);

  const strip = document.createElement('div');
  strip.className = 'tabs';
  const body = document.createElement('div');
  body.className = 'bd';

  const buttons = new Map<TabId, HTMLButtonElement>();
  /** Bumped on every draw, so an async tab can tell whether it is stale. */
  let drawing = 0;

  function paint(): void {
    for (const [id, button] of buttons) button.classList.toggle('on', id === current);
    body.replaceChildren();
    drawing += 1;
    const mine = drawing;
    const tab = TABS.find((entry) => entry.id === current);
    tab?.render(body, {
      deps: active,
      refresh: paint,
      live: () => mine === drawing && body.isConnected,
    });
  }

  for (const tab of TABS) {
    const button = document.createElement('button');
    button.className = 'tab';
    button.textContent = tab.label;
    button.addEventListener('click', () => {
      if (current === tab.id) return;
      current = tab.id;
      // The body scroll belongs to the tab that was in it, and a new tab
      // opening halfway down reads as a panel that has lost its place.
      body.scrollTop = 0;
      paint();
    });
    buttons.set(tab.id, button);
    strip.appendChild(button);
  }

  panel.append(head, strip, body);
  paint();
}

/**
 * Stop a dropped file from taking the game with it.
 *
 * Chromium's default for a file dropped on a page is to navigate to it, and
 * in a client that is the whole session: the page becomes a text file and
 * you are back through the loading screen. The drop zone in the userscripts
 * tab makes this a thing people will actually do, and missing it by an inch
 * must not cost anything.
 *
 * Capture phase on the window, and anything inside the panel is left alone
 * so the zone can handle its own drops. `dropEffect` is what makes the
 * cursor say so before the mouse button comes up.
 */
function installDropGuard(): void {
  const guard = (event: DragEvent): void => {
    const data = event.dataTransfer;
    if (!data || !data.types.includes('Files')) return;
    const target = event.target;
    if (target instanceof Element && target.closest(`#${PANEL_ID}`)) return;
    event.preventDefault();
    if (event.type === 'dragover') data.dropEffect = 'none';
  };

  window.addEventListener('dragover', guard, true);
  window.addEventListener('drop', guard, true);
}

/** Add the menu row. The panel itself is built the first time it is opened. */
export function installQol(qolDeps: QolDeps): void {
  deps = qolDeps;

  installMenuItem({
    id: UI_IDS.qolItem,
    // Sliders. The game's own rows use this set, and this is the one glyph in
    // it that reads as "things you can adjust" rather than as one feature.
    icon: 'tune',
    label: 'QoL Features',
    position: 'bottom',
    onClick: toggleQol,
  });

  installDropGuard();
}
