import { BRANDING } from '../../shared/branding';
import { ANGLE_BACKENDS, type AppConfig, type HotkeyConfig, type HudCorner } from '../../shared/config';
import type { Capabilities, OpenableFolder, ThemeFile } from '../../shared/ipc';
import {
  MAP_FILTER_CHOICES,
  mapIconUrl,
  MODE_FILTER_CHOICES,
  prettyMap,
  REGIONS,
} from '../../shared/matchmaker';
import { SHEETS, STYLE_IDS } from '../../shared/ui';
import { defineStyle } from '../style';
import { createKeybindRows, type KeybindRows } from './keybind-rows';
import { attachTooltip, hideTooltip } from './tooltip';

/**
 * Client settings, rendered inside Krunker's own settings window under a
 * "Client" tab.
 *
 * That tab is ours. The game used to add one itself when OffCliV was set, but
 * the settings redesign builds the tab strip from
 * windows[0].tabs.{basic,advanced} and ignores the flag entirely, so we have
 * to inject into #settingsTabLayout and track the selected state ourselves.
 * OffCliV is still set elsewhere; other parts of the game read it.
 *
 * Everything is built from Krunker's own class names (setHed/setBodH for
 * collapsible categories, setting settName + setting-title for rows,
 * switch/slider round for toggles, keyIcon for keybinds), so the panel picks
 * up the game's fonts, spacing and hover states rather than approximating
 * them. The CSS below only covers what Krunker has no class for.
 *
 * The game rebuilds #settHolder whenever the tab changes or you type in the
 * search box, so our content gets re-injected instead of appended once. Three
 * of its functions are wrapped to find out when that's happened:
 *
 *   showWindow(1)  - settings window opened
 *   changeTab(...) - a tab was clicked
 *   searchList(..) - search box changed
 *
 * Each wrap runs the original first and only reacts to what comes back. If any
 * of them gets renamed the wrap is skipped, client settings don't show up, and
 * nothing else breaks.
 */

interface KrunkerSettingsWindow {
  tabIndex: number;
  settingType: string;
  tabs: Record<string, unknown[]>;
  changeTab: (...args: unknown[]) => unknown;
  searchList: (...args: unknown[]) => unknown;
}

interface KrunkerGlobals {
  windows?: KrunkerSettingsWindow[];
  showWindow?: (...args: unknown[]) => unknown;
}

export interface SettingsTabDeps {
  readonly config: AppConfig;
  /** What the running binary supports, so tags can tell the truth. */
  readonly capabilities: Capabilities;
  readonly onChange: (section: keyof AppConfig, key: string, value: unknown) => void;
  readonly onHotkeysChange: (hotkeys: HotkeyConfig) => void;
  readonly setCaptureLock: (locked: boolean) => void;
  readonly openFolder: (folder: OpenableFolder) => void;
  readonly relaunch: () => void;
  /** Ask main to look for a new release right now. */
  readonly checkForUpdates: () => void;
  readonly reloadPage: () => void;
  /** Re-read the swap folder; resolves with the new file count. */
  readonly rescanSwap: () => Promise<number>;
  /** Themes currently on disk. */
  readonly getThemes: () => readonly ThemeFile[];
  readonly getActiveTheme: () => string;
  /** Filename, or '' for none. */
  readonly onThemeSelect: (name: string) => void;
}

interface ToggleSpec {
  readonly section: keyof AppConfig;
  readonly key: string;
  readonly label: string;
  readonly hint?: string;
  /** Chromium reads this at process start; needs a full restart. */
  readonly restart?: boolean;
  /** Takes effect on the next asset load; needs a page reload. */
  readonly reload?: boolean;
}

const GROUPS: { title: string; items: ToggleSpec[] }[] = [
  {
    title: 'Performance',
    items: [
      {
        section: 'performance',
        key: 'fpsUnlocked',
        label: 'Unlock frame rate',
        hint: 'Lets the game render as fast as your GPU can manage instead of stopping at your refresh rate. Needs the patched build, or your aim will stutter in fights.',
        restart: true,
      },
      {
        section: 'performance',
        key: 'higherMaxFps',
        label: 'Deeper frame queue',
        hint: 'Lets a second frame queue up while one is still being drawn, which nudges peak FPS higher. Ignored if you have set an FPS cap.',
        restart: true,
      },
      {
        section: 'advanced',
        key: 'perfTweaks',
        label: 'Aggressive GPU switches',
        hint: 'Pushes the GPU harder by skipping the safety workarounds Chromium normally applies. Turn it back off if the game starts looking wrong.',
        restart: true,
      },
      {
        section: 'advanced',
        key: 'removeUselessFeatures',
        label: 'Strip unused Chromium subsystems',
        hint: 'Switches off parts of Chromium the game never touches, like crash reporting and media casting. A little less running in the background.',
        restart: true,
      },
      {
        section: 'fixes',
        key: 'scrollFramePacing',
        label: 'Scroll frame-pacing fix',
        hint: 'Scrolling normally pins your FPS to the monitor refresh rate until you stop. The wheel is your weapon switch, so that lands mid fight. This stops it.',
        // Installed by the preload, which re-runs on a page reload.
        reload: true,
      },
      {
        section: 'fixes',
        key: 'disableBackgroundThrottle',
        label: 'Full frame rate when unfocused',
        hint: 'Keeps the game running at full speed while you are alt tabbed, so there is no lurch when you come back to it.',
      },
      {
        section: 'fixes',
        key: 'rawInput',
        label: 'Raw mouse input',
        hint: 'Takes movement straight from the mouse instead of letting Windows curve it. Without this a fast flick travels further than a slow one over the same distance. Applies next time you click into the game.',
      },
    ],
  },
  {
    title: 'Content',
    items: [
      {
        section: 'features',
        key: 'blockAds',
        label: 'Block ads and trackers',
        hint: 'Drops ad, tracker and telemetry requests before they ever leave your machine.',
        reload: true,
      },
      {
        section: 'ui',
        key: 'hideAdContainers',
        label: 'Hide leftover ad slots',
        hint: 'Blocking an ad still leaves the empty box it sat in. This clears those out so the menu has no gaps.',
      },
      {
        section: 'features',
        key: 'hideMenuPromos',
        label: 'Hide menu promos',
        hint: 'Clears the battle pass, daily spin, Twitch drops panel and the corner ad boxes out of the main menu. This is the game advertising itself, not third party ads.',
      },
      {
        section: 'features',
        key: 'hideBunnies',
        label: 'Hide bunny NPCs',
        hint: 'Stops the bunny NPCs loading at all. Any already on screen stay until you reload.',
        reload: true,
      },
      {
        section: 'features',
        key: 'hideTurfBanners',
        label: 'Hide clan banners',
        hint: 'Hides the clan banners cluttering Turf Wars maps. Any already loaded stay until you reload.',
        reload: true,
      },
    ],
  },
  {
    title: 'Matchmaker',
    items: [],
  },
  {
    title: 'Chat',
    items: [
      {
        section: 'features',
        key: 'betterChat',
        label: 'Merge team and all chat',
        hint: 'Puts team and match chat in one list so you stop missing half of it. Team lines get a green [T], match lines a red [M], and nothing is tagged in modes without teams.',
      },
    ],
  },
  {
    title: 'Customisation',
    items: [
      {
        section: 'features',
        key: 'resourceSwapper',
        label: 'Resource swapper',
        hint: 'Replaces textures, sounds and models with your own files from the swap folder. Turning it on rescans the folder; anything already loaded needs a reload.',
        reload: true,
      },
      {
        section: 'features',
        key: 'userscripts',
        label: 'Userscripts',
        hint: 'Runs your own JavaScript from the scripts folder. A script here can do anything the page can, so only use ones you wrote or trust.',
        reload: true,
      },
    ],
  },
  {
    title: 'Interface',
    items: [
      {
        section: 'ui',
        key: 'realPing',
        label: 'Real ping',
        hint: 'Krunker shows an estimate. This shows the real round trip to the server you are actually on, in the same place on the HUD.',
        reload: true,
      },
      {
        section: 'ui',
        key: 'perfHud',
        label: 'Frame-time HUD',
        hint: 'FPS, frame time, and your worst 1% and 0.1% of frames. The lows are the number worth watching: 300 FPS with regular hitches feels worse than a steady 200. F10 toggles it.',
      },
      {
        section: 'fixes',
        key: 'escapePointerLock',
        label: 'Escape releases the cursor',
        hint: 'Krunker keeps Escape for its own menu, which leaves your cursor trapped in the window. This hands it back.',
        // Installed by the preload, which re-runs on a page reload.
        reload: true,
      },
    ],
  },
];

/** Krunker's settings tab strip, and the class it marks the active tab with. */
const TAB_BAR_ID = 'settingsTabLayout';
const ACTIVE_TAB_CLASS = 'tabANew';
const CLIENT_TAB_ID = 'kc-client-tab';

const FOLDERS: { id: OpenableFolder; label: string }[] = [
  { id: 'swap', label: 'Swap' },
  { id: 'themes', label: 'Themes' },
  { id: 'scripts', label: 'Scripts' },
  { id: 'screenshots', label: 'Screenshots' },
];


export interface SettingsTab {
  /** Open Krunker's settings window on the Client tab. */
  open(): void;
  /** Rebuild the panel if it is currently showing. */
  refresh(): void;
  /** True once the game's settings window was found and hooks were installed. */
  readonly hooked: boolean;
}

export function hookKrunkerSettings(deps: SettingsTabDeps): SettingsTab {
  defineStyle(STYLE_IDS.settings, SHEETS.settings);

  let hooked = false;
  let restartNeeded = false;
  let reloadNeeded = false;
  const collapsed = new Set<string>();

  const keybindRows: KeybindRows = createKeybindRows({
    getHotkeys: () => deps.config.hotkeys,
    onSave: deps.onHotkeysChange,
    setCaptureLock: deps.setCaptureLock,
  });

  const globals = window as unknown as KrunkerGlobals;

  /** True while our tab is the one showing. Owned by us; see isClientTab. */
  let clientTabActive = false;

  /**
   * Whether our tab is the one showing.
   *
   * We track it rather than reading it off Krunker, because the tab is ours.
   * This used to be `tabIndex === tabs.length - 1` back when the game appended
   * its own "Client" tab for OffCliV. The redesign builds the bar from
   * windows[0].tabs.{basic,advanced} and ignores the flag, so there's no
   * game-owned tab left to detect.
   */
  function isClientTab(): boolean {
    return clientTabActive;
  }

  /**
   * Put our tab button in Krunker's tab bar and keep it there.
   *
   * The bar gets rebuilt when the window opens, when a tab changes and when
   * the basic/advanced toggle flips, so this runs on every render and bails
   * straight away if the button is already up.
   */
  function ensureClientTab(): void {
    const bar = document.getElementById(TAB_BAR_ID);
    if (!bar) return;
    if (bar.querySelector(`#${CLIENT_TAB_ID}`)) {
      syncTabHighlight();
      return;
    }

    const tab = document.createElement('div');
    tab.id = CLIENT_TAB_ID;
    // Krunker's own tab classes, so we get the game's type and hover free.
    tab.className = 'settingTab';
    tab.textContent = 'Client';
    tab.addEventListener('mouseenter', () => {
      const tick = (window as unknown as { playTick?: () => void }).playTick;
      if (typeof tick === 'function') tick();
    });
    tab.addEventListener('click', () => {
      const select = (window as unknown as { playSelect?: (v: number) => void }).playSelect;
      if (typeof select === 'function') select(0.1);
      clientTabActive = true;
      render();
    });

    bar.appendChild(tab);
    syncTabHighlight();
  }

  /**
   * Mark our tab selected, or unmark it.
   *
   * Only ever touches our tab. Krunker sets and clears the class on its own
   * as part of rendering the strip, and racing it there just left a bar with
   * nothing highlighted at all.
   */
  function syncTabHighlight(): void {
    const tab = document.getElementById(CLIENT_TAB_ID);
    if (!tab) return;
    tab.classList.toggle(ACTIVE_TAB_CLASS, clientTabActive);
    if (!clientTabActive) return;
    // Ours is up, so no game tab should still look selected.
    const bar = document.getElementById(TAB_BAR_ID);
    for (const el of bar?.querySelectorAll('.settingTab') ?? []) {
      if (el.id !== CLIENT_TAB_ID) el.classList.remove(ACTIVE_TAB_CLASS);
    }
  }

  function currentSearch(): string {
    const input = document.getElementById('settSearch');
    return input instanceof HTMLInputElement ? input.value.trim().toLowerCase() : '';
  }

  function render(): void {
    const holder = document.getElementById('settHolder');
    if (!holder) return;

    // The bar is rebuilt on every tab change, so re-add the button before
    // anything else goes looking for it.
    ensureClientTab();

    keybindRows.cancel();
    // The tooltip points at a row that's about to go. Leaving it up strands
    // it over unrelated content.
    hideTooltip();
    holder.querySelectorAll('.kc-block').forEach((el) => el.remove());

    const filter = currentSearch();
    // While searching, show client settings from any tab. Krunker's search is
    // global and hiding ours behind a tab switch makes them unfindable.
    if (!isClientTab() && filter === '') return;

    // Ours isn't one of Krunker's tabs, so the game leaves the previous tab's
    // rows sitting there. Safe to clear them; changeTab rebuilds the holder
    // from scratch whenever you go back to a real tab.
    if (isClientTab() && filter === '') {
      holder.querySelectorAll(':scope > *:not(.kc-block)').forEach((el) => el.remove());
    }

    const built = build(filter);
    if (built.length === 0) return;

    // Krunker puts up a "No settings found" placeholder for a tab with no
    // native settings, which ours never has. Drop it once we've got something
    // real to show.
    holder.querySelectorAll('.setHed').forEach((el) => {
      if (el.textContent?.trim() === 'No settings found') el.remove();
    });

    holder.append(...built);
  }

  function build(filter: string): HTMLElement[] {
    const blocks: HTMLElement[] = [];

    if (filter === '') blocks.push(...buildActionRows());

    for (const group of GROUPS) {
      const rows = [...group.items.map(buildToggle), ...extraRows(group.title)];
      const visible = rows.filter((row) => matches(row, filter));
      if (visible.length === 0) continue;
      blocks.push(...category(group.title, visible));
    }

    const themeRows = buildThemeRows().filter((row) => matches(row, filter));
    if (themeRows.length > 0) blocks.push(...category('Themes', themeRows));

    // Shortcuts always render whole. Filtering individual keybind rows leaves
    // a category that looks broken rather than useful.
    if (filter === '' || 'shortcuts keybinds hotkeys'.includes(filter)) {
      const body = document.createElement('div');
      keybindRows.render(body);
      blocks.push(...category('Shortcuts', [...body.children] as HTMLElement[]));
    }

    return blocks;
  }

  function matches(row: HTMLElement, filter: string): boolean {
    return filter === '' || (row.textContent ?? '').toLowerCase().includes(filter);
  }

  /** A Krunker-style collapsible category: a `setHed` bar plus a `setBodH` body. */
  function category(title: string, rows: HTMLElement[]): HTMLElement[] {
    const head = document.createElement('div');
    head.className = 'setHed kc-block';

    const chevron = document.createElement('span');
    chevron.className = 'material-icons plusOrMinus';
    chevron.textContent = collapsed.has(title) ? 'keyboard_arrow_right' : 'keyboard_arrow_down';
    head.append(chevron, document.createTextNode(` ${title}`));

    const body = document.createElement('div');
    body.className = 'setBodH kc-block';
    if (collapsed.has(title)) body.classList.add('kc-setbod-collapsed');
    body.append(...rows);

    head.addEventListener('click', () => {
      const nowCollapsed = !collapsed.has(title);
      if (nowCollapsed) collapsed.add(title);
      else collapsed.delete(title);
      body.classList.toggle('kc-setbod-collapsed', nowCollapsed);
      chevron.textContent = nowCollapsed ? 'keyboard_arrow_right' : 'keyboard_arrow_down';
    });

    return [head, body];
  }

  /**
   * Laid out as Krunker's own `setting settName` rows, label left and controls
   * right, rather than a bare strip of buttons, so the block reads as part of
   * the settings list.
   */
  function buildActionRows(): HTMLElement[] {
    // Wrapped in a setBodH so it draws as a card like every other block here.
    // Bare rows sit on the window background and look orphaned.
    const body = document.createElement('div');
    body.className = 'setBodH kc-block';

    body.appendChild(
      actionRow(
        'Open folder',
        FOLDERS.map((f) => gameButton(f.label, () => deps.openFolder(f.id))),
      ),
    );

    // Only offered where it can work. The portable exe and `npm start` have
    // no install to replace, so the row says why rather than showing a button
    // that only ever produces an error.
    body.appendChild(
      actionRow(
        `Version ${deps.capabilities.version || '?'}`,
        deps.capabilities.canUpdate
          ? [gameButton('Check for updates', deps.checkForUpdates)]
          : [staticNote('Portable build, update by downloading again')],
      ),
    );

    // Only there when something is actually pending, so the tab isn't sitting
    // with a permanent Restart button inviting a pointless one.
    const pending: HTMLElement[] = [];
    if (reloadNeeded) pending.push(gameButton('Reload page', deps.reloadPage));
    if (restartNeeded) pending.push(gameButton('Restart client', deps.relaunch));
    if (pending.length > 0) body.appendChild(actionRow('Apply changes', pending));

    return [body];
  }

  /** Where a button would go, when there is nothing to press. */
  function staticNote(text: string): HTMLElement {
    const el = document.createElement('span');
    el.className = 'kc-note';
    el.textContent = text;
    return el;
  }

  function actionRow(label: string, buttons: HTMLElement[]): HTMLElement {
    const row = document.createElement('div');
    row.className = 'setting settName kc-actionrow';

    const title = document.createElement('span');
    title.className = 'setting-title';
    title.textContent = label;

    const group = document.createElement('span');
    group.className = 'kc-actionbtns';
    group.append(...buttons);

    row.append(title, group);
    return row;
  }

  /** Uses Krunker's own button class so it picks up the game's styling. */
  function gameButton(label: string, onClick: () => void): HTMLElement {
    const el = document.createElement('div');
    el.className = 'settingsBtn';
    el.textContent = label;
    el.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      onClick();
    });
    return el;
  }

  function sectionValue(section: keyof AppConfig, key: string): unknown {
    return (deps.config[section] as unknown as Record<string, unknown>)[key];
  }

  function buildToggle(spec: ToggleSpec): HTMLElement {
    const row = document.createElement('div');
    row.className = 'setting settName';

    const kind = spec.restart === true ? 'restart' : spec.reload === true ? 'reload' : undefined;

    const title = document.createElement('span');
    title.className = 'setting-title';
    title.textContent = spec.label;
    if (kind === 'restart') title.appendChild(tag('kc-tag-restart'));
    else if (kind === 'reload') title.appendChild(tag('kc-tag-reload'));

    // Hints are a hover tooltip rather than a second line. A description under
    // every row roughly doubles the height of the tab.
    attachTooltip(title, rowTooltip(spec.hint, kind));

    // Krunker's native toggle: a .switch label around a checkbox and a
    // .slider round div, which its CSS turns into the pill.
    const label = document.createElement('label');
    label.className = 'switch';

    const box = document.createElement('input');
    box.type = 'checkbox';
    box.checked = sectionValue(spec.section, spec.key) === true;

    const slider = document.createElement('div');
    slider.className = 'slider round';
    label.append(box, slider);

    box.addEventListener('change', () => {
      deps.onChange(spec.section, spec.key, box.checked);
      // markDirty only re-renders when the action row gains a button, so an
      // ordinary toggle doesn't rebuild the tab out from under your scroll.
      markDirty(spec.restart === true ? 'restart' : spec.reload === true ? 'reload' : undefined);
    });

    row.append(title, label);
    return row;
  }

  /** Non-toggle rows, appended to the group they belong to. */
  function extraRows(groupTitle: string): HTMLElement[] {
    if (groupTitle === 'Performance') {
      return [
        numberRow({
          label: 'FPS cap',
          value: deps.config.performance.frameCap,
          min: 0,
          max: 1000,
          step: 10,
          // The patched build has a runtime setter, so there it costs nothing.
          // Spread rather than tagKind: undefined, which
          // exactOptionalPropertyTypes rejects: an absent tag and a tag set to
          // undefined are different things here.
          ...(deps.capabilities.liveFrameCap ? {} : { tagKind: 'restart' as const }),
          hint: deps.capabilities.liveFrameCap
            ? 'Holds the frame rate at an exact number. 0 means no cap, and anything under 30 is raised to 30. Applies the moment you change it.'
            : 'Holds the frame rate at an exact number. 0 means no cap, and anything under 30 is raised to 30. On the patched build this applies without a restart.',
          onChange: (v) => deps.onChange('performance', 'frameCap', v),
        }),
        selectRow({
          label: 'Graphics backend',
          value: deps.config.advanced.angleBackend,
          options: ANGLE_BACKENDS.map((b) => [b, b === 'default' ? 'Default (D3D11)' : b]),
          tagKind: 'restart',
          hint: 'Which graphics API Chromium uses to reach your GPU. Only worth touching if you are getting visual glitches or the game will not start.',
          onChange: (v) => deps.onChange('advanced', 'angleBackend', v),
        }),
      ];
    }

    if (groupTitle === 'Matchmaker') {
      const mm = deps.config.matchmaker;
      // No re-render here. Every control in this group updates its
      // own appearance, and rebuilding would throw away the scroll position on
      // every click.
      const patch = (change: Partial<typeof mm>): void => {
        for (const [key, value] of Object.entries(change)) {
          deps.onChange('matchmaker', key, value);
        }
      };
      const toggleIn = (list: readonly string[], value: string, on: boolean): string[] =>
        on ? [...list, value] : list.filter((v) => v !== value);

      return [
        chipsRow({
          label: 'Regions',
          hint: 'Pick the regions you will actually play in. Leave them all off to search everywhere. Ping to each one is measured while the search runs.',
          choices: REGIONS.map((r) => [r, r] as const),
          selected: mm.regions,
          onToggle: (value, on) => patch({ regions: toggleIn(mm.regions, value, on) }),
        }),
        chipsRow({
          label: 'Modes',
          hint: 'Pick the modes you want. Leave them all off to take whatever comes up.',
          choices: MODE_FILTER_CHOICES.map((m) => [m, m] as const),
          selected: mm.gamemodes,
          onToggle: (value, on) => patch({ gamemodes: toggleIn(mm.gamemodes, value, on) }),
        }),
        mapGridRow({
          label: 'Maps (none selected = all)',
          choices: MAP_FILTER_CHOICES,
          selected: mm.maps,
          onToggle: (value, on) => patch({ maps: toggleIn(deps.config.matchmaker.maps, value, on) }),
          onClear: () => patch({ maps: [] }),
        }),
        numberRow({
          label: 'Min players',
          value: mm.minPlayers,
          min: 0,
          max: 20,
          step: 1,
          onChange: (v) => patch({ minPlayers: v }),
        }),
        numberRow({
          label: 'Max players',
          value: mm.maxPlayers,
          min: 1,
          max: 20,
          step: 1,
          onChange: (v) => patch({ maxPlayers: v }),
        }),
        numberRow({
          label: 'Min time left',
          value: mm.minRemainingTime,
          min: 0,
          max: 600,
          step: 15,
          hint: 'Skips lobbies with less time left than this, so you do not drop into a round that ends thirty seconds later.',
          onChange: (v) => patch({ minRemainingTime: v }),
        }),
        selectRow({
          label: 'Sort by',
          value: mm.sortBy,
          options: [
            ['ping', 'Lowest ping'],
            ['players', 'Most players'],
          ],
          onChange: (v) => patch({ sortBy: v === 'players' ? 'players' : 'ping' }),
        }),
      ];
    }

    if (groupTitle === 'Chat') {
      return [
        numberRow({
          label: 'History limit',
          value: deps.config.features.chatHistoryLimit,
          min: 0,
          max: 1000,
          step: 50,
          hint: 'How many chat messages to hold on to. Krunker throws old ones away sooner than you would like. Set 0 to leave its own behaviour alone.',
          onChange: (v) => deps.onChange('features', 'chatHistoryLimit', v),
        }),
      ];
    }

    if (groupTitle === 'Interface') {
      const corners: HudCorner[] = ['top-left', 'top-right', 'bottom-left', 'bottom-right'];
      return [
        selectRow({
          label: 'HUD position',
          value: deps.config.ui.perfHudCorner,
          options: corners.map((c) => [c, c.replace('-', ' ')]),
          onChange: (v) => deps.onChange('ui', 'perfHudCorner', v),
        }),
        selectRow({
          label: 'HUD detail',
          value: deps.config.ui.perfHudDetail,
          options: [
            ['fps', 'FPS only'],
            ['full', 'FPS, frame time and lows'],
          ],
          onChange: (v) => deps.onChange('ui', 'perfHudDetail', v),
        }),
      ];
    }

    return [];
  }

  interface RowBase {
    readonly label: string;
    readonly hint?: string;
    readonly tagKind?: 'restart' | 'reload';
  }

  function rowShell(spec: RowBase): { row: HTMLElement; title: HTMLElement } {
    const row = document.createElement('div');
    row.className = 'setting settName';

    const title = document.createElement('span');
    title.className = 'setting-title';
    title.textContent = spec.label;
    if (spec.tagKind === 'restart') title.appendChild(tag('kc-tag-restart'));
    else if (spec.tagKind === 'reload') title.appendChild(tag('kc-tag-reload'));
    attachTooltip(title, rowTooltip(spec.hint, spec.tagKind));

    row.appendChild(title);
    return { row, title };
  }

  function selectRow(
    spec: RowBase & {
      readonly value: string;
      readonly options: readonly (readonly [string, string])[];
      readonly onChange: (value: string) => void;
    },
  ): HTMLElement {
    const { row } = rowShell(spec);

    const select = document.createElement('select');
    select.className = 'inputGrey2';
    for (const [value, label] of spec.options) {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = label;
      if (spec.value === value) option.selected = true;
      select.appendChild(option);
    }
    select.addEventListener('change', () => {
      spec.onChange(select.value);
      markDirty(spec.tagKind);
    });
    select.addEventListener('click', (e) => e.stopPropagation());

    row.appendChild(select);
    return row;
  }

  /** Krunker's paired range + number input, so both stay in step. */
  function numberRow(
    spec: RowBase & {
      readonly value: number;
      readonly min: number;
      readonly max: number;
      readonly step: number;
      readonly onChange: (value: number) => void;
    },
  ): HTMLElement {
    const { row } = rowShell(spec);
    row.classList.add('kc-numrow');

    const wrapper = document.createElement('span');
    wrapper.className = 'kc-numctl';

    const range = document.createElement('input');
    range.type = 'range';
    range.className = 'sliderM';
    const number = document.createElement('input');
    number.type = 'number';
    number.className = 'rb-input sliderVal';

    for (const input of [range, number]) {
      input.min = String(spec.min);
      input.max = String(spec.max);
      input.step = String(spec.step);
      input.value = String(spec.value);
    }

    // Committed on 'change', not 'input', or dragging the slider fires an IPC
    // write per pixel of travel.
    const commit = (raw: string, mirror: HTMLInputElement): void => {
      const parsed = Number(raw);
      if (!Number.isFinite(parsed)) return;
      const clamped = Math.min(spec.max, Math.max(spec.min, Math.round(parsed)));
      mirror.value = String(clamped);
      spec.onChange(clamped);
      markDirty(spec.tagKind);
    };

    range.addEventListener('input', () => {
      number.value = range.value;
    });
    range.addEventListener('change', () => commit(range.value, number));
    number.addEventListener('change', () => commit(number.value, range));
    for (const input of [range, number]) {
      input.addEventListener('click', (e) => e.stopPropagation());
    }

    wrapper.append(range, number);
    row.appendChild(wrapper);
    return row;
  }

  /**
   * Multi-select chips. Nothing selected means "any", which is why there's no
   * "All" chip: an empty selection already says that.
   */
  function chipsRow(
    spec: RowBase & {
      readonly choices: readonly (readonly [string, string])[];
      readonly selected: readonly string[];
      readonly onToggle: (value: string, selected: boolean) => void;
    },
  ): HTMLElement {
    const { row } = rowShell(spec);
    row.classList.add('kc-chiprow');

    const chips = document.createElement('div');
    chips.className = 'kc-chips';

    for (const [value, label] of spec.choices) {
      const on = spec.selected.includes(value);
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = on ? 'kc-chip on' : 'kc-chip';
      chip.textContent = label;
      chip.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        // Toggle in place rather than re-render. A full rebuild resets the
        // scroll, which is maddening halfway down a list of chips.
        const nowOn = !chip.classList.contains('on');
        chip.classList.toggle('on', nowOn);
        spec.onToggle(value, nowOn);
      });
      chips.appendChild(chip);
    }

    row.appendChild(chips);
    return row;
  }

  /**
   * Map picker: a tile grid off Krunker's own hosted previews.
   *
   * Selection happens per tile, in place, same reason as the chips. A
   * re-render every click fights the scroll position, and this grid is tall
   * enough that it'd be unusable.
   */
  function mapGridRow(
    spec: RowBase & {
      readonly choices: readonly string[];
      readonly selected: readonly string[];
      readonly onToggle: (value: string, selected: boolean) => void;
      readonly onClear: () => void;
    },
  ): HTMLElement {
    const { row, title } = rowShell(spec);
    row.classList.add('kc-maprow');

    const head = document.createElement('div');
    head.className = 'kc-maphead';
    // rowShell already appended the title, so move it into the header for the
    // Clear button to sit opposite.
    head.appendChild(title);

    const clear = document.createElement('div');
    clear.className = 'settingsBtn';
    clear.textContent = 'Clear';
    head.appendChild(clear);
    row.appendChild(head);

    const grid = document.createElement('div');
    grid.className = 'kc-mapgrid';

    const boxes: HTMLInputElement[] = [];
    const tiles: HTMLElement[] = [];

    for (const map of spec.choices) {
      const on = spec.selected.includes(map);

      const tile = document.createElement('div');
      tile.className = on ? 'kc-maptile on' : 'kc-maptile';

      const icon = mapIconUrl(map);
      if (icon !== null) {
        const img = document.createElement('img');
        img.src = icon;
        img.alt = '';
        img.loading = 'lazy';
        // A community map or a renamed asset should leave a gap rather than a
        // broken image icon.
        img.addEventListener('error', () => img.remove());
        tile.appendChild(img);
      }

      const name = document.createElement('span');
      name.className = 'kc-mapname';
      name.textContent = prettyMap(map);
      name.title = prettyMap(map);

      const box = document.createElement('input');
      box.type = 'checkbox';
      box.checked = on;

      tile.append(name, box);
      tile.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const nowOn = !box.checked;
        box.checked = nowOn;
        tile.classList.toggle('on', nowOn);
        spec.onToggle(map, nowOn);
      });

      boxes.push(box);
      tiles.push(tile);
      grid.appendChild(tile);
    }

    clear.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      for (const box of boxes) box.checked = false;
      for (const tile of tiles) tile.classList.remove('on');
      spec.onClear();
    });

    row.appendChild(grid);
    return row;
  }

  function markDirty(kind: 'restart' | 'reload' | undefined): void {
    if (kind === 'restart' && !restartNeeded) {
      restartNeeded = true;
      render();
    } else if (kind === 'reload' && !reloadNeeded) {
      reloadNeeded = true;
      render();
    }
  }

  /**
   * A dropdown of every .css in the themes folder.
   *
   * No asterisk. Theme text is cached from startup, so picking one is a single
   * assignment on one <style> element, and editing the file on disk applies on
   * save as well since the folder is watched.
   */
  function buildThemeRows(): HTMLElement[] {
    const themes = deps.getThemes();

    if (themes.length === 0) {
      const row = document.createElement('div');
      row.className = 'setting settName';
      const title = document.createElement('span');
      title.className = 'setting-title';
      title.textContent = 'No themes found';
      attachTooltip(
        title,
        'Drop a .css file into the themes folder, via the Themes button above. It turns up here straight away.',
      );
      row.appendChild(title);
      return [row];
    }

    return [
      selectRow({
        label: 'Theme',
        value: deps.getActiveTheme(),
        options: [
          ['', 'None'],
          ...themes.map((t) => [t.name, t.name.replace(/\.css$/i, '')] as const),
        ],
        hint: 'Switches straight away, no reload. Editing the file in a text editor also updates the game the moment you save it.',
        onChange: (name) => deps.onThemeSelect(name),
      }),
    ];
  }

  function tag(className: string): HTMLElement {
    const el = document.createElement('span');
    el.className = `kc-tagline ${className}`;
    el.textContent = '*';
    return el;
  }

  /**
   * Build a row's tooltip, folding any restart or reload requirement into the
   * same bubble as the hint.
   *
   * The asterisk gets no tooltip of its own. It sits inside the title,
   * and a second tooltip target nested in the first makes the bubble swap and
   * then not come back when the pointer moves onto the text again.
   */
  function rowTooltip(hint: string | undefined, kind: 'restart' | 'reload' | undefined): string {
    const parts: string[] = [];
    if (hint !== undefined) parts.push(hint);
    if (kind === 'restart') parts.push('* Applies after restarting the client.');
    else if (kind === 'reload') parts.push('* Applies after reloading the page.');
    return parts.join('\n');
  }

  // ── Hook installation ──

  function install(): void {
    const win = globals.windows?.[0];
    if (!win || typeof globals.showWindow !== 'function') return;

    const originalShowWindow = globals.showWindow.bind(window);
    globals.showWindow = (...args: unknown[]) => {
      const result = originalShowWindow(...args);
      if (args[0] === 1) {
        // Opening lands on whichever tab Krunker picks, not a stale selection
        // of ours. open() re-selects ours right after if that's what was
        // actually asked for.
        clientTabActive = false;
        queueMicrotask(render);
      }
      return result;
    };

    if (typeof win.changeTab === 'function') {
      const originalChangeTab = win.changeTab.bind(win);
      win.changeTab = (...args: unknown[]) => {
        // One of Krunker's tabs got picked, so ours isn't showing any more.
        clientTabActive = false;
        const result = originalChangeTab(...args);
        queueMicrotask(render);
        return result;
      };
    }

    if (typeof win.searchList === 'function') {
      const originalSearchList = win.searchList.bind(win);
      win.searchList = (...args: unknown[]) => {
        const result = originalSearchList(...args);
        queueMicrotask(render);
        return result;
      };
    }

    hooked = true;
  }

  /**
   * Krunker's globals don't exist at preload time, so poll for them briefly.
   * Capped rather than open-ended: if `windows` never turns up, an unbounded
   * interval keeps waking the renderer forever.
   */
  function waitForGame(): void {
    let attempts = 0;
    const timer = setInterval(() => {
      attempts += 1;
      if (globals.windows?.[0] !== undefined) {
        clearInterval(timer);
        install();
      } else if (attempts > 150) {
        clearInterval(timer);
        console.warn(BRANDING.logPrefix, 'Krunker settings window not found; client tab unavailable');
      }
    }, 200);
  }

  waitForGame();

  return {
    get hooked() {
      return hooked;
    },

    refresh: render,

    open() {
      if (typeof globals.showWindow !== 'function') return;
      globals.showWindow(1);

      queueMicrotask(() => {
        // On a cold open the bar might not exist yet. render() creates our tab
        // as a side effect, so run it once and then click.
        ensureClientTab();
        const tab = document.getElementById(CLIENT_TAB_ID);
        if (tab instanceof HTMLElement) tab.click();
        else render();
      });
    },
  };
}
