import { ipcRenderer } from 'electron';
import { KRUNKER_HOST, KRUNKER_URLS } from '../../krunker/constants';
import { IPC } from '../../shared/ipc';
import { parseProtocolUrl, type CompHostRequest } from '../../shared/protocol';
import { showToast } from '../toast';

/**
 * Hosting a competitive lobby from a `nmnez://` link.
 *
 * A tournament bot posts "Open in NM/NZ" in Discord, the browser hands the
 * link to Windows, Windows brings this client up, and the match lobby goes up
 * with the map, the team names, both rosters and the result webhook already
 * filled in. The captain does not alt-tab, read a settings list off a Discord
 * embed and type nine fields in under a countdown.
 *
 * None of the lobby setup is ours. Krunker's own host window has all of it,
 * including the webhook field it posts the final scoreboard to, so this fills
 * that form in and presses the button. See `KRUNKER_HOST` for the ids, and
 * expect this to be the thing that breaks when Krunker redesigns hosting.
 *
 * On consent: there is no prompt of ours before a lobby goes up, and there is
 * one already. A `nmnez://` link is a custom scheme, so the browser asks
 * "Open NM/NZ?" before the client ever hears about it. A second dialog from
 * us would sit between a captain and a match that forty people are waiting
 * on, to ask the same question again.
 */

/** How long to wait for a field the host window is supposed to have. */
const FIELD_TIMEOUT_MS = 6000;
/**
 * Where the request lives across the reload a region change costs.
 *
 * sessionStorage rather than config: it is true for the next few seconds
 * rather than for the install, and a client that crashed mid-switch should
 * come back up with no opinion about hosting anything.
 */
const PENDING_KEY = 'nm-pending-comp-host';
/**
 * Spectator slots to open when the link does not say.
 *
 * Four is what a comp lobby wants: two coaches, a caster and somebody's
 * spare. Raised to fit the list when the link names more than that.
 */
const DEFAULT_SPECTATOR_SLOTS = 4;

/** Krunker's own globals, as much of them as hosting needs. */
interface HostApi {
  openHostWindow: (advanced: boolean, tab: number) => void;
  createPrivateRoom: () => void;
  windows: { switchTab?: (tab: number) => void }[];
  setSetting?: (key: string, value: unknown) => void;
}

function hostApi(): HostApi | null {
  const page = window as unknown as Record<string, unknown>;
  const open = page[KRUNKER_HOST.openHostWindow];
  const create = page[KRUNKER_HOST.createPrivateRoom];
  const windows = page['windows'];

  if (typeof open !== 'function' || typeof create !== 'function' || !Array.isArray(windows)) {
    return null;
  }
  return page as unknown as HostApi;
}

/**
 * Wait for Krunker to have built the globals hosting goes through.
 *
 * A link can arrive at any moment, including at the click that started the
 * client, and the one after a region switch arrives on a page that is still
 * loading. Neither is an error, they are just early, so this waits rather
 * than reporting that the game is not ready.
 */
const API_POLL_MS = 250;
const API_TIMEOUT_MS = 30000;

function waitForHostApi(): Promise<HostApi | null> {
  const ready = hostApi();
  if (ready) return Promise.resolve(ready);

  return new Promise<HostApi | null>((resolve) => {
    const poll = setInterval(() => {
      const api = hostApi();
      if (!api) return;
      clearInterval(poll);
      clearTimeout(timer);
      resolve(api);
    }, API_POLL_MS);
    const timer = setTimeout(() => {
      clearInterval(poll);
      resolve(null);
    }, API_TIMEOUT_MS);
  });
}

/**
 * Wait for an element the host window builds as it opens.
 *
 * Resolves null on timeout rather than hanging. The version this was modelled
 * on waits forever, which on a Krunker update that renames one field is a
 * client sitting in front of a half-filled form with nothing to say about it.
 */
function waitFor<T extends Element>(selector: string): Promise<T | null> {
  const existing = document.querySelector<T>(selector);
  if (existing) return Promise.resolve(existing);

  return new Promise<T | null>((resolve) => {
    const observer = new MutationObserver(() => {
      const found = document.querySelector<T>(selector);
      if (!found) return;
      observer.disconnect();
      clearTimeout(timer);
      resolve(found);
    });
    const timer = setTimeout(() => {
      observer.disconnect();
      resolve(null);
    }, FIELD_TIMEOUT_MS);
    observer.observe(document.documentElement, { childList: true, subtree: true });
  });
}

const byId = <T extends Element>(id: string): Promise<T | null> => waitFor<T>(`#${id}`);

/**
 * Set an input's value, if the input is there. Says whether it was.
 *
 * The text fields carry no handlers at all, so an assignment is the whole
 * job: Krunker reads them off the DOM when the room is created. The sliders
 * do carry one, `oninput="updateSliderLabel(...)"`, and it only draws the
 * number beside the track. Without the event the room is created correctly
 * and the host stares at a slider whose label disagrees with it.
 */
async function fill(id: string, value: string): Promise<boolean> {
  if (value === '') return true;
  const input = await byId<HTMLInputElement>(id);
  if (!input) return false;

  input.value = value;
  if (input.type === 'range') input.dispatchEvent(new Event('input', { bubbles: true }));
  return true;
}

/**
 * A slider's own ceiling.
 *
 * Spectator slots stop at 4 and the class limits at 20, and the browser
 * clamps a range to its max anyway. Reading it means the number we report
 * having set is the number that is set.
 */
function clampToInput(input: HTMLInputElement | null, value: number): number {
  const max = Number.parseFloat(input?.max ?? '');
  return Number.isFinite(max) ? Math.min(value, max) : value;
}

/**
 * Tick the map.
 *
 * By id first, because that is what the bot sends when it has one, then by
 * the label on the card, because what it sends otherwise is the map's name.
 */
async function selectMap(mapId: string): Promise<boolean> {
  if (mapId === '') return true;
  // The marker says the tab is up, which is not quite the same as the map
  // list having been built into it.
  if (!(await waitFor(KRUNKER_HOST.mapNameSelector))) return false;

  let checkbox = document.getElementById(mapId) as HTMLInputElement | null;
  if (!checkbox) {
    const wanted = mapId.toLowerCase();
    for (const label of document.querySelectorAll<HTMLElement>(KRUNKER_HOST.mapNameSelector)) {
      if ((label.textContent ?? '').trim().toLowerCase() !== wanted) continue;
      checkbox = label.parentElement?.querySelector<HTMLInputElement>('input[type="checkbox"]') ?? null;
      break;
    }
  }

  if (!checkbox) return false;
  // Their handler runs off the click, so click it rather than setting checked.
  if (!checkbox.checked) checkbox.click();
  return true;
}

/**
 * Pick the team size.
 *
 * The select holds indices, and the bot sends "3v3", so match the option's
 * own text first and fall back to treating the value as an index. Matching
 * the text means Krunker can add 5v5 without this needing a new table.
 */
async function selectTeamSize(teamSize: string): Promise<boolean> {
  if (teamSize === '') return true;
  const select = await byId<HTMLSelectElement>(KRUNKER_HOST.ids.teamSize);
  if (!select) return false;

  const wanted = teamSize.toLowerCase();
  const option = [...select.options].find(
    (entry) => (entry.textContent ?? '').trim().toLowerCase() === wanted,
  );
  select.value = option ? option.value : teamSize;
  select.dispatchEvent(new Event('change', { bubbles: true }));
  return true;
}

/** How many spectator slots to open, given who the link says is watching. */
async function openSpectatorSlots(spectators: string): Promise<void> {
  const named = spectators.split(',').filter((name) => name.trim() !== '').length;
  const slider = await byId<HTMLInputElement>(KRUNKER_HOST.ids.spectatorSlots);
  if (!slider) return;

  const wanted = clampToInput(slider, Math.max(named, DEFAULT_SPECTATOR_SLOTS));
  await fill(KRUNKER_HOST.ids.spectatorSlots, String(wanted));
}

/**
 * Fill Krunker's host form in and create the room.
 *
 * Every field is optional as far as this is concerned: a link that names no
 * spectators leaves the spectator list alone rather than blanking it. What is
 * not optional is the window itself, so a missing field is reported and the
 * room still goes up, while a missing form stops the whole thing.
 */
async function fillAndHost(host: CompHostRequest): Promise<void> {
  const api = await waitForHostApi();
  if (!api) {
    showToast('Krunker never finished loading, so the lobby was not created', 5000);
    return;
  }

  api.openHostWindow(false, 1);
  if (!(await waitFor(KRUNKER_HOST.readyMarker))) {
    showToast('Could not open the host window', 3600);
    return;
  }

  const missing: string[] = [];
  if (!(await selectMap(host.mapId))) missing.push(`map "${host.mapId}"`);

  api.windows[KRUNKER_HOST.windowIndex]?.switchTab?.(KRUNKER_HOST.settingsTab);

  const { ids } = KRUNKER_HOST;
  if (!(await fill(ids.team1Name, host.team1Name))) missing.push('team 1 name');
  if (!(await fill(ids.team2Name, host.team2Name))) missing.push('team 2 name');
  if (!(await fill(ids.team1Roster, host.team1Players))) missing.push('team 1 roster');
  if (!(await fill(ids.team2Roster, host.team2Players))) missing.push('team 2 roster');
  if (!(await fill(ids.spectatorRoster, host.spectators))) missing.push('spectators');
  if (!(await fill(ids.webhook, host.webhook))) missing.push('result webhook');
  if (!(await selectTeamSize(host.teamSize))) missing.push('team size');

  await openSpectatorSlots(host.spectators);

  for (const [name, limit] of Object.entries(host.classLimits)) {
    const index = KRUNKER_HOST.classOrder.indexOf(name as (typeof KRUNKER_HOST.classOrder)[number]);
    if (index < 0) continue;
    if (!(await fill(`${ids.classLimitPrefix}${index}`, String(limit)))) {
      missing.push(`${name} limit`);
    }
  }

  api.createPrivateRoom();

  const teams =
    host.team1Name !== '' && host.team2Name !== ''
      ? `${host.team1Name} vs ${host.team2Name}`
      : 'the match';
  showToast(`Hosting ${teams}${host.mapId === '' ? '' : ` on ${host.mapId}`}`, 3600);

  // After the room, not instead of it. A roster that did not go in is worth
  // knowing about, and it is fixable in the window that is now open.
  if (missing.length > 0) {
    showToast(`Could not set: ${missing.join(', ')}`, 5000);
  }
}

/**
 * Put the lobby in the region the match is meant to be played in.
 *
 * Krunker hosts where its own region setting points, and changing that only
 * takes effect on a fresh page, so this is a setting write and a reload with
 * the request parked in sessionStorage. False when the game gives us no way
 * to set it, in which case hosting carries on in whatever region is already
 * selected rather than not at all.
 */
function switchRegion(region: string): boolean {
  const api = hostApi();
  if (typeof api?.setSetting !== 'function') return false;
  api.setSetting(KRUNKER_HOST.regionSetting, region);
  return true;
}

/**
 * The region Krunker would host in right now, or empty if we cannot tell.
 *
 * Read out of storage because the game has no getter: `setSetting` exists,
 * `getSetting` does not. Empty means the reload below happens when it might
 * not have needed to, which is the right way round to be wrong.
 */
function currentRegion(): string {
  try {
    return window.localStorage.getItem(KRUNKER_HOST.regionStorageKey) ?? '';
  } catch {
    return '';
  }
}

function stash(host: CompHostRequest): void {
  try {
    window.sessionStorage.setItem(PENDING_KEY, JSON.stringify(host));
  } catch {
    // Storage disabled. The reload below then loses the request, which the
    // caller has already reported as a region switch.
  }
}

function takeStashed(): CompHostRequest | null {
  let raw: string | null = null;
  try {
    raw = window.sessionStorage.getItem(PENDING_KEY);
    if (raw !== null) window.sessionStorage.removeItem(PENDING_KEY);
  } catch {
    return null;
  }
  if (raw === null) return null;

  try {
    return JSON.parse(raw) as CompHostRequest;
  } catch {
    return null;
  }
}

/** Act on one link. */
async function run(host: CompHostRequest): Promise<void> {
  if (host.region !== '' && host.region !== currentRegion()) {
    stash(host);
    if (switchRegion(host.region)) {
      showToast(`Switching to ${host.region} to host`, 3000);
      window.location.href = KRUNKER_URLS.game;
      return;
    }
    // No way to set it, so carry on where we are rather than stalling. The
    // stash is dropped so the next load does not host a second lobby.
    takeStashed();
    showToast('Could not switch region, hosting here instead', 3600);
  }

  await fillAndHost(host);
}

/**
 * Listen for links, and pick up one left over from a region switch.
 *
 * The resume is only attempted on Krunker's own menu: after the reload the
 * page can land anywhere, and a host window opened over a match is not what
 * anyone asked for.
 */
export function installProtocolHost(): void {
  ipcRenderer.on(IPC.protocolUrl, (_event, url: unknown) => {
    if (typeof url !== 'string') return;
    const request = parseProtocolUrl(url);
    if (!request) return;
    void run(request.host);
  });

  const pending = takeStashed();
  if (pending && window.location.pathname === '/') {
    void fillAndHost(pending);
  }
}
