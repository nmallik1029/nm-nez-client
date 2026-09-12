import { SHEETS, STYLE_IDS, UI_IDS } from '../../shared/ui';
import { installMenuItem } from '../menu-item';
import { defineStyle } from '../style';
import { renderBuiltIn } from './built-in';
import type { PanelView, QolDeps, TabContext } from './context';
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
 * The crosshair, hitmarker and sky needed more than a switch, so a row can
 * open an editor: that replaces the tab strip with a back arrow and takes
 * over the body. Still one panel, still one Escape to leave.
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

  /**
   * The editor on top of the tab, if one is open.
   *
   * Per panel rather than per session: an editor is somewhere you went, and
   * re-opening the panel should land you back at the list.
   */
  let view: PanelView | null = null;

  const head = document.createElement('div');
  head.className = 'hd';
  const back = document.createElement('button');
  // A Material Icons ligature, not a "‹": GameFont has no glyph for that
  // character and draws the missing-glyph box instead, which is what the
  // first build of this actually shipped on screen.
  back.className = 'back material-icons';
  back.textContent = 'chevron_left';
  back.title = 'Back';
  const title = document.createElement('h2');
  head.append(back, title);

  const strip = document.createElement('div');
  strip.className = 'tabs';
  const body = document.createElement('div');
  body.className = 'bd';

  const buttons = new Map<TabId, HTMLButtonElement>();
  /** Bumped on every draw, so an async tab can tell whether it is stale. */
  let drawing = 0;

  /**
   * Draw again, keeping the scroll position.
   *
   * A row redrawing itself after a switch was flipped must not throw the
   * list back to the top; going somewhere else must. So the two have
   * separate doors, and only `navigate` resets it.
   */
  function paint(): void {
    for (const [id, button] of buttons) button.classList.toggle('on', id === current);
    const scroll = body.scrollTop;
    body.replaceChildren();
    drawing += 1;
    const mine = drawing;

    const editor = view;
    title.textContent = editor ? editor.title : 'QOL FEATURES';
    back.classList.toggle('on', editor !== null);
    strip.classList.toggle('gone', editor !== null);

    const ctx: TabContext = {
      deps: active,
      refresh: paint,
      live: () => mine === drawing && body.isConnected,
      push: (next) => navigate(next),
    };

    if (editor) editor.render(body, ctx);
    else TABS.find((entry) => entry.id === current)?.render(body, ctx);

    body.scrollTop = scroll;
  }

  /** Open an editor, go back from one, or change tab. All reset the scroll. */
  function navigate(next: PanelView | null): void {
    view = next;
    body.scrollTop = 0;
    paint();
  }

  back.addEventListener('click', () => navigate(null));

  for (const tab of TABS) {
    const button = document.createElement('button');
    button.className = 'tab';
    button.textContent = tab.label;
    button.addEventListener('click', () => {
      if (current === tab.id && view === null) return;
      current = tab.id;
      navigate(null);
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
 * you are back through the loading screen. The drop zones in this panel make
 * this a thing people will actually do, and missing one by an inch must not
 * cost anything.
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
