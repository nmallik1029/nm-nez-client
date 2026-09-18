import { ipcRenderer } from 'electron';
import { BRANDING } from '../../shared/branding';
import { IPC } from '../../shared/ipc';
import {
  DEFAULT_PACK_ID,
  packFileUrl,
  pickPack,
  tierFor,
  type KillPack,
  type KillPackListing,
} from '../../shared/killstreak';
import { SHEETS, STYLE_IDS, UI_IDS } from '../../shared/ui';
import type { KillStreakConfig } from '../../shared/visuals';
import { defineStyle } from '../style';
import { showToast } from '../toast';
import { watchCounter } from './hud-counter';

/**
 * Kill streak sounds: a sound and a banner for each kill in a row.
 *
 * KILLS ARE READ OFF THE HUD COUNTER, NOT THE KILLFEED. The scripts these
 * packs came from watched #chatList for "You" kill lines, and Krunker only
 * writes those with Old Scoreboard on -- off by default, so on most profiles
 * they never played a sound. #killsVal keeps counting whatever the HUD is
 * showing, even hidden, which is the same thing the built-in headshot sound
 * found out in a live match. #deathCount does the same job for dying.
 *
 * Both counters are read the way hud-counter.ts describes, re-attached on a
 * timer that only runs while this is switched on.
 */

const KILLS_ID = 'killsVal';
const DEATHS_ID = 'deathCount';

/** Ten quiet seconds ends a streak. What the original scripts did. */
const STREAK_RESET_MS = 10_000;
const BANNER_HIDE_MS = 3_000;
/** How long the banner holds its pop before settling. */
const POP_MS = 250;
const REATTACH_MS = 2_000;

let config: KillStreakConfig | null = null;
let packs: readonly KillPack[] = [];
/** The last full answer from main, or null until the first one arrives. */
let listing: KillPackListing | null = null;
let active: KillPack | null = null;

/** Downloads under way, so a tile drawn mid-download says so. */
const installing = new Set<string>();
/** Removals under way, so an x cannot be pressed twice and the last pack is counted right. */
const removing = new Set<string>();
/**
 * Packs this session has already tried to download, by hand or on its own.
 * None is fetched again unasked, so a download that failed is not retried on
 * every volume nudge: see `fetchWanted`. Pressing Install always tries.
 */
const tried = new Set<string>();
const listeners = new Set<(listing: KillPackListing) => void>();
let sounds: HTMLAudioElement[] = [];
let streak = 0;

let reattachTimer: ReturnType<typeof setInterval> | null = null;
let resetTimer: ReturnType<typeof setTimeout> | undefined;
let hideTimer: ReturnType<typeof setTimeout> | undefined;
let popTimer: ReturnType<typeof setTimeout> | undefined;

/**
 * Every pack, asked for again: the installed ones and the user's own, and
 * the rest of the catalog. A pack dropped in or installed after launch is in
 * the list and playable the moment this answers, because main looks its
 * files up as they are asked for.
 */
export async function listKillPacks(): Promise<KillPackListing> {
  try {
    listing = (await ipcRenderer.invoke(IPC.killPacksGet)) as KillPackListing;
  } catch {
    listing = { installed: [], removable: [], available: [] };
  }
  packs = listing.installed;
  // A config that arrived before the list could not resolve its pack yet.
  if (config) apply(config);
  return listing;
}

export function isInstalling(id: string): boolean {
  return installing.has(id);
}

export function isRemoving(id: string): boolean {
  return removing.has(id);
}

/** The packs on disk, less any on their way off it. What a pick can safely land on. */
export function staying(): readonly KillPack[] {
  return packs.filter((pack) => !removing.has(pack.id));
}

/**
 * Called with the new listing whenever a pack is installed or removed, or a
 * download starts. The editor redraws from it; returns the unsubscribe.
 */
export function onKillPacksChanged(listener: (listing: KillPackListing) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function changed(): void {
  if (listing === null) return;
  for (const listener of listeners) listener(listing);
}

/**
 * Download one pack from the catalog. Resolves true once it is on disk,
 * checked and in the list, false if anything stopped it; main logs why.
 */
export async function installKillPack(id: string): Promise<boolean> {
  if (installing.has(id)) return false;
  installing.add(id);
  tried.add(id);
  changed();
  let ok = false;
  try {
    ok = (await ipcRenderer.invoke(IPC.killPacksInstall, id)) === true;
  } catch {
    // The channel itself failing is the same answer: not installed.
  }
  installing.delete(id);
  await listKillPacks();
  changed();
  return ok;
}

/**
 * Take a downloaded pack off the disk. The user's own are never touched.
 *
 * `keep` is the kill streak config with the pick already moved off this pack
 * (the editor works out where to), or `fetchWanted` would fetch it straight
 * back. It is saved before main deletes anything, not on the usual short
 * delay: closing the client inside that delay would otherwise leave a config
 * naming a pack that is gone, and the next launch would download it again.
 */
export async function removeKillPack(id: string, keep: KillStreakConfig): Promise<boolean> {
  if (removing.has(id)) return false;
  removing.add(id);
  changed();
  let ok = false;
  try {
    await ipcRenderer.invoke(IPC.configPatch, 'visuals', { killStreak: keep });
    ok = (await ipcRenderer.invoke(IPC.killPacksRemove, id)) === true;
  } catch {
    // Reported as not removed.
  }
  removing.delete(id);
  // Gone by hand, so switching on with it named is asking for it again, and
  // gets it. Only the config naming it can bring it back, never a retry.
  if (ok) tried.delete(id);
  await listKillPacks();
  changed();
  return ok;
}

/** The pack a config means, out of the last list main sent. See `pickPack`. */
export function resolvePack(id: string, list: readonly KillPack[] = packs): KillPack | null {
  return pickPack(id, list);
}

/** One sound, straight away, for the editor. Not part of any streak. */
export function previewKillPack(pack: KillPack, volume: number): void {
  const audio = new Audio(packFileUrl(pack.id, 1, 'sound'));
  audio.volume = volume;
  void audio.play().catch(() => {});
}

export function setKillStreak(next: KillStreakConfig): void {
  const first = config === null;
  config = next;
  // The list comes over IPC, so the first call applies what it can now and
  // again once the packs arrive.
  if (first) void listKillPacks();
  apply(next);
}

function apply(next: KillStreakConfig): void {
  if (!next.on) {
    stop();
    return;
  }
  // Switched off mid-streak: take down the one already on screen too.
  if (!next.banners) hideBanner();
  const pack = resolvePack(next.pack);
  // Every volume nudge comes through here; only a different pack reloads.
  if (pack?.id !== active?.id) load(pack);
  fetchWanted(next.pack, pack === null);
  start();
}

/**
 * Switched on, and the pack the config names is in the catalog but not on
 * disk: download it without being asked. Whatever is on disk plays in the
 * meantime (see `pickPack`), and the listing that follows the download
 * switches to it.
 *
 * The pack named is the one picked, or Default for nothing picked, which is
 * what an empty pick has always played. With nothing on disk at all and a
 * pick that is not in the catalog, a pack of the user's own since deleted,
 * Default too, so there is something to hear.
 *
 * That covers someone switching this on for the first time, who expects to
 * hear something rather than be sent to an editor. And anyone updating from
 * 0.1.53 to 0.1.59, which shipped every pack: the update takes them away, and
 * this puts back the one they were using, including when a pack of their own
 * would otherwise have stepped in and played instead without a word.
 *
 * It follows the config, so a pack being removed has to have the config moved
 * off it first, or this fetches it straight back; the editor does that. Never
 * while any download is running, because that one ends in a new listing and
 * brings this round again with whatever the config says by then: pressing
 * Install on one pack and then the switch must not fetch Default beside it.
 * And once a session per pack, see `tried`.
 */
function fetchWanted(picked: string, nothingToPlay: boolean): void {
  if (listing === null || installing.size > 0) return;
  const named = picked === '' ? DEFAULT_PACK_ID : picked;
  const want =
    listing.available.find((pack) => pack.id === named) ??
    (nothingToPlay ? listing.available.find((pack) => pack.id === DEFAULT_PACK_ID) : undefined);
  if (!want || tried.has(want.id)) return;
  console.log(BRANDING.logPrefix, `kill streak: ${want.name} is not installed, fetching it`);
  void installKillPack(want.id).then((ok) => {
    // The editor says so when its own Install fails. This one nobody pressed,
    // so without a word it is just a switch that is on and silent.
    if (!ok) showToast(`Could not download the ${want.name} kill streak pack. Press Edit on Kill streak sounds to try again.`, 4000);
  });
}

function load(pack: KillPack | null): void {
  active = pack;
  sounds = [];
  if (!pack) return;
  for (let tier = 1; tier <= pack.sounds; tier++) {
    const audio = new Audio(packFileUrl(pack.id, tier, 'sound'));
    audio.preload = 'auto';
    sounds.push(audio);
  }
  // Warm the banners, so the first one of a streak is not a blank frame.
  for (let tier = 1; tier <= pack.banners; tier++) {
    const image = new Image();
    image.src = packFileUrl(pack.id, tier, 'banner');
  }
}

function start(): void {
  if (reattachTimer !== null) return;
  attach();
  reattachTimer = setInterval(attach, REATTACH_MS);
}

function stop(): void {
  if (reattachTimer !== null) {
    clearInterval(reattachTimer);
    reattachTimer = null;
  }
  kills.stop();
  deaths.stop();
  reset();
  active = null;
  sounds = [];
}

function attach(): void {
  kills.attach();
  deaths.attach();
}

function onKills(gained: number): void {
  if (!active || !config) return;
  // A counter that moved by two in one update was two kills.
  streak += gained;

  const soundTier = tierFor(streak, active.sounds);
  const audio = sounds[soundTier - 1];
  if (audio) {
    audio.volume = config.volume;
    audio.currentTime = 0;
    void audio.play().catch(() => {});
  }

  const bannerTier = config.banners ? tierFor(streak, active.banners) : 0;
  if (bannerTier > 0) showBanner(packFileUrl(active.id, bannerTier, 'banner'));

  clearTimeout(resetTimer);
  resetTimer = setTimeout(reset, STREAK_RESET_MS);
}

function reset(): void {
  streak = 0;
  clearTimeout(resetTimer);
  hideBanner();
}

function hideBanner(): void {
  document.getElementById(UI_IDS.killStreakBanner)?.classList.remove('in', 'pop');
}

function showBanner(src: string): void {
  const image = banner();
  if (!image) return;
  image.src = src;
  image.classList.add('in', 'pop');
  clearTimeout(popTimer);
  popTimer = setTimeout(() => image.classList.remove('pop'), POP_MS);
  clearTimeout(hideTimer);
  hideTimer = setTimeout(() => image.classList.remove('in'), BANNER_HIDE_MS);
}

function banner(): HTMLImageElement | null {
  const existing = document.getElementById(UI_IDS.killStreakBanner);
  if (existing instanceof HTMLImageElement) return existing;
  if (!document.body) return null;
  defineStyle(STYLE_IDS.killStreak, SHEETS.killStreak);
  const image = document.createElement('img');
  image.id = UI_IDS.killStreakBanner;
  image.alt = '';
  document.body.appendChild(image);
  return image;
}

const kills = watchCounter(KILLS_ID, onKills, reset);
// Dying ends a streak, and so does the death counter going back to zero.
const deaths = watchCounter(DEATHS_ID, reset, reset);
