import {
  LIBRARY_REGIONS,
  PRO_BADGE,
  sortLibrary,
  type LibraryEntry,
  type LibraryRegion,
  type Placement,
} from '../../shared/client-content';
import { describeSettings, sameSettings, type ImportKeep, type SettingsPayload } from '../../shared/settings-import';
import { badgeImage } from '../badges';
import { clientContent, clientContentNow, contentImage } from '../client-content';
import { exportedSettings } from '../settings/import-keep';
import type { TabContext } from './context';
import { empty } from './row';

/**
 * The Pro picks tab: settings the team picks, most of them posted after a
 * tournament, and there are a lot of them.
 *
 * So each one starts rolled up: the name, its marks (the pro badge, the
 * server icon of the scene it placed in) and a background in the colour of
 * where it placed, gold, silver or bronze. Resting the pointer on one slides
 * the rest of it open: an in-game screenshot of the settings in effect, when
 * and where they placed, and Apply. Focus does the same, for the keyboard.
 *
 * The opening waits a moment, so sweeping the pointer down the list to reach
 * one near the bottom does not open every pick on the way past.
 *
 * Screenshots are fetched the first time a pick is opened, not before: a
 * list this long would otherwise pull in megabytes nobody looks at. See
 * main/client-content.ts.
 */

/** What the library hands this tab: the pieces both tabs share. */
export interface PicksKit {
  keepRow(): HTMLElement;
  applyButton(settings: SettingsPayload, name: string, inUse: boolean): HTMLButtonElement;
  saveButton(entry: LibraryEntry): HTMLButtonElement;
  getKeep(): ImportKeep;
}

/** The filters, kept for the session so a redraw after Apply does not lose them. */
let search = '';
let regionFilter: LibraryRegion | 'all' = 'all';

export function renderPicks(body: HTMLElement, ctx: TabContext, kit: PicksKit): void {
  body.append(kit.keepRow());

  const content = clientContentNow();
  if (content === null) {
    body.append(empty('Loading the library…'));
    // The panel may be shut, or on the other tab, by the time it lands.
    void clientContent().then(() => {
      if (ctx.live()) ctx.refresh();
    });
    return;
  }

  const picks = sortLibrary(content.settings);
  if (picks.length === 0) {
    body.append(empty('Nothing here yet. Settings the NM/NZ team picks will show up here.'));
    return;
  }

  const list = document.createElement('div');
  list.className = 'pp-list';
  const nothing = empty('Nothing matches that.');
  const now = exportedSettings();
  const keep = kit.getKeep();
  const cards = picks.map((entry) => ({ entry, card: pickCard(entry, now, keep, kit) }));

  /**
   * Show the picks the filters allow, by hiding the rest rather than drawing
   * the list again: typing in the search box keeps its focus that way, and a
   * screenshot already opened stays loaded.
   */
  const filter = (): void => {
    const wanted = search.trim().toLowerCase();
    let shown = 0;
    for (const { entry, card } of cards) {
      const visible =
        (regionFilter === 'all' || entry.region === regionFilter) &&
        (wanted === '' || searchText(entry).includes(wanted));
      card.hidden = !visible;
      if (visible) shown += 1;
    }
    nothing.hidden = shown > 0;
  };

  list.append(...cards.map(({ card }) => card), nothing);
  body.append(filterRow(picks, filter), list);
  filter();
}

/** Find by name or event, and narrow to one region's scene when the list has more than one. */
function filterRow(picks: readonly LibraryEntry[], filter: () => void): HTMLElement {
  const row = document.createElement('div');
  row.className = 'ctl';
  const label = document.createElement('span');
  label.className = 'lbl';
  label.textContent = 'Find';

  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'line';
  input.placeholder = 'A player or an event';
  input.value = search;
  input.spellcheck = false;
  input.autocomplete = 'off';
  // The game listens for its binds across the whole page.
  for (const type of ['keydown', 'keyup', 'keypress'] as const) {
    input.addEventListener(type, (event) => event.stopPropagation());
  }
  input.addEventListener('input', () => {
    search = input.value;
    filter();
  });
  row.append(label, input);

  const present = (Object.keys(LIBRARY_REGIONS) as LibraryRegion[]).filter((code) =>
    picks.some((entry) => entry.region === code),
  );
  if (present.length > 0) {
    const group = document.createElement('div');
    group.className = 'seg';
    const choices: (LibraryRegion | 'all')[] = ['all', ...present];
    const buttons = choices.map((choice) => {
      const chip = document.createElement('button');
      chip.textContent = choice === 'all' ? 'All' : LIBRARY_REGIONS[choice].tag;
      if (choice !== 'all') chip.title = LIBRARY_REGIONS[choice].label;
      chip.addEventListener('click', () => {
        regionFilter = choice;
        for (const [i, other] of buttons.entries()) other.classList.toggle('on', choices[i] === choice);
        filter();
      });
      return chip;
    });
    // A region that is no longer in the list is not a filter worth keeping.
    if (regionFilter !== 'all' && !present.includes(regionFilter)) regionFilter = 'all';
    for (const [i, chip] of buttons.entries()) chip.classList.toggle('on', choices[i] === regionFilter);
    group.append(...buttons);
    row.append(group);
  }
  return row;
}

function searchText(entry: LibraryEntry): string {
  const region = entry.region === null ? '' : LIBRARY_REGIONS[entry.region].tag;
  return [entry.name, entry.event, entry.author, entry.description, region].join(' ').toLowerCase();
}

/** One pick: rolled up to its name and marks, opening on hover to the rest. */
function pickCard(entry: LibraryEntry, now: SettingsPayload | null, keep: ImportKeep, kit: PicksKit): HTMLElement {
  const card = document.createElement('div');
  card.className = 'pp-card';
  // Focusable, so the keyboard can open one the way a pointer does.
  card.tabIndex = 0;
  if (entry.placement !== null) card.dataset['place'] = String(entry.placement);

  const head = document.createElement('div');
  head.className = 'pp-head';
  const name = document.createElement('span');
  name.className = 'pp-name';
  name.textContent = entry.name;
  name.title = entry.name;
  head.append(name, marks(entry));

  const inUse = now !== null && sameSettings(entry.settings, now, keep);
  const shot = document.createElement('div');
  shot.className = 'pp-shot';
  shot.textContent = entry.screenshot === '' ? 'No screenshot' : 'Loading screenshot…';

  const info = document.createElement('div');
  info.className = 'pp-info';
  info.append(text('pp-line', facts(entry)));
  if (entry.event !== '') info.append(text('pp-event', entry.event));
  if (entry.description !== '') info.append(text('pp-desc', entry.description));
  const by = entry.author === '' ? '' : ` · posted by ${entry.author}`;
  info.append(text('pp-count', `${describeSettings(entry.settings)}${by}`));
  const actions = document.createElement('div');
  actions.className = 'pp-actions';
  actions.append(kit.applyButton(entry.settings, entry.name, inUse), kit.saveButton(entry));
  info.append(actions);

  const bodyRow = document.createElement('div');
  bodyRow.className = 'pp-body';
  bodyRow.append(shot, info);
  const inner = document.createElement('div');
  inner.className = 'pp-inner';
  inner.append(bodyRow);
  const more = document.createElement('div');
  more.className = 'pp-more';
  more.append(inner);
  card.append(head, more);

  // The screenshot, the first time this pick is opened.
  let asked = false;
  const load = (): void => {
    if (asked || entry.screenshot === '') return;
    asked = true;
    void contentImage(entry.screenshot).then((url) => {
      if (url === null) {
        shot.textContent = 'Screenshot unavailable';
        // A miss is not final: the next time it is opened, try again.
        asked = false;
        return;
      }
      const img = document.createElement('img');
      img.alt = `${entry.name}'s settings in game`;
      img.src = url;
      shot.replaceChildren(img);
    });
  };
  card.addEventListener('mouseenter', load);
  card.addEventListener('focusin', load);

  return card;
}

/**
 * The pro badge and the scene's server icon, as the pictures the scoreboard
 * badges use. A picture that has not shipped yet stands in as its tag, so a
 * pick is never left with a blank where its marks should be.
 */
function marks(entry: LibraryEntry): HTMLElement {
  const holder = document.createElement('span');
  holder.className = 'pp-marks';
  if (entry.pro) holder.append(mark(PRO_BADGE, 'PRO', 'Pro settings'));
  if (entry.region !== null) {
    const region = LIBRARY_REGIONS[entry.region];
    holder.append(mark(region.badge, region.tag, `${region.tag}, ${region.label}`));
  }
  return holder;
}

function mark(badge: string, tag: string, title: string): HTMLElement {
  const picture = badgeImage(badge);
  if (picture !== null) {
    const img = document.createElement('img');
    img.className = 'pp-mark';
    img.src = picture;
    img.alt = tag;
    img.title = title;
    return img;
  }
  const el = document.createElement('span');
  el.className = 'pp-tag';
  el.textContent = tag;
  el.title = title;
  return el;
}

/** "1st place · NACK · 25 Oct 2026", or as much of it as the pick has. */
function facts(entry: LibraryEntry): string {
  const parts: string[] = [];
  if (entry.placement !== null) parts.push(`${ordinal(entry.placement)} place`);
  else if (entry.pro) parts.push('Pro settings');
  if (entry.region !== null) parts.push(LIBRARY_REGIONS[entry.region].tag);
  parts.push(formatDate(entry.date));
  return parts.join(' · ');
}

function ordinal(placement: Placement): string {
  return placement === 1 ? '1st' : placement === 2 ? '2nd' : '3rd';
}

/**
 * A pick's date as the reader writes dates. Read as UTC and shown as UTC, so
 * a pick dated the 25th does not show as the 24th west of Greenwich.
 */
function formatDate(date: string): string {
  const [year, month, day] = date.split('-').map(Number);
  if (year === undefined || month === undefined || day === undefined) return date;
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

function text(className: string, value: string): HTMLElement {
  const el = document.createElement('div');
  el.className = className;
  el.textContent = value;
  return el;
}
