import { ipcRenderer } from 'electron';
import { IPC } from '../../shared/ipc';
import { packFileUrl, tierFor, type KillPack } from '../../shared/killstreak';
import { SHEETS, STYLE_IDS, UI_IDS } from '../../shared/ui';
import type { KillStreakConfig } from '../../shared/visuals';
import { defineStyle } from '../style';

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
 * The rules for both counters: going up is an event, going down is a new
 * match, and the first reading after attaching is only a baseline. Joining a
 * match already on twelve kills is not twelve kills just now, and nor is
 * Krunker rebuilding its HUD mid-round.
 *
 * Re-attached on a timer rather than once, because Krunker replaces chunks of
 * its HUD and an observer left on a detached node goes quiet without ever
 * erroring. The timer only runs while this is switched on.
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
let active: KillPack | null = null;
let sounds: HTMLAudioElement[] = [];
let streak = 0;

let reattachTimer: ReturnType<typeof setInterval> | null = null;
let resetTimer: ReturnType<typeof setTimeout> | undefined;
let hideTimer: ReturnType<typeof setTimeout> | undefined;
let popTimer: ReturnType<typeof setTimeout> | undefined;

/**
 * The packs on disk, asked for again.
 *
 * `rescan` tells the swapper to look at its folder too. A pack dropped in
 * after launch is listed either way, but it cannot be played until the
 * swapper knows its files exist, and nothing else would tell it.
 */
export async function listKillPacks(rescan = false): Promise<readonly KillPack[]> {
  if (rescan) {
    try {
      await ipcRenderer.invoke(IPC.swapperRescan);
    } catch {
      // The list is still worth having. The new pack just waits for a restart.
    }
  }
  try {
    packs = (await ipcRenderer.invoke(IPC.killPacksGet)) as KillPack[];
  } catch {
    packs = [];
  }
  // A config that arrived before the list could not resolve its pack yet.
  if (config) apply(config);
  return packs;
}

/**
 * The pack a config means: the one it names if it is still there, otherwise
 * the first one there is. So switching this on with nothing picked yet still
 * plays something, and deleting the chosen folder does not leave it silent.
 */
export function resolvePack(id: string, list: readonly KillPack[] = packs): KillPack | null {
  return list.find((pack) => pack.id === id) ?? list[0] ?? null;
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
  start();
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

interface Counter {
  attach(): void;
  stop(): void;
}

function counter(id: string, onUp: (gained: number) => void, onDown: () => void): Counter {
  let el: HTMLElement | null = null;
  let last: number | null = null;
  let observer: MutationObserver | null = null;

  const read = (): void => {
    if (!el) return;
    const value = Number.parseInt(el.textContent ?? '', 10);
    if (Number.isNaN(value)) return;
    const previous = last;
    last = value;
    if (previous === null) return;
    if (value < previous) onDown();
    else if (value > previous) onUp(value - previous);
  };

  return {
    attach(): void {
      const now = document.getElementById(id);
      if (!now || now === el) return;
      observer?.disconnect();
      el = now;
      last = null;
      observer = new MutationObserver(read);
      observer.observe(now, { childList: true, characterData: true, subtree: true });
      // The baseline, so the first real change is a change.
      read();
    },
    stop(): void {
      observer?.disconnect();
      observer = null;
      el = null;
      last = null;
    },
  };
}

const kills = counter(KILLS_ID, onKills, reset);
// Dying ends a streak, and so does the death counter going back to zero.
const deaths = counter(DEATHS_ID, reset, reset);
