import {
  FORTNITE_PACK_ID,
  FORTNITE_SOUNDS,
  HEADSHOT_OPTIONS,
  HIT_OPTIONS,
  KRUNKER_GUNS,
  MAX_VOLUME,
  type FortniteConfig,
} from '../../shared/soundpacks';
import {
  installSoundpack,
  listSoundpacks,
  previewFortniteSound,
  reloadPickedSounds,
  removeSoundpack,
  type SoundpackStatus,
} from '../look/soundpacks';
import { showToast } from '../toast';
import type { PanelView, QolDeps, TabContext } from './context';
import { actions, chooser, heading, hint, picker, slider } from './controls';
import { renderKillStreak } from './killstreak-editor';
import { empty, featureRow, note } from './row';

/**
 * Soundpacks: sounds from other games, one tab each.
 *
 * Valorant's tab is the kill streak editor as it was. Fortnite's installs the
 * Fortnite sounds, then picks one Fortnite gun for each Krunker gun, and the
 * hit marker and headshot. Everything applies as it is touched, the game's
 * own sounds included: see look/soundpacks.ts for how.
 *
 * The switch at the top is the Soundpacks row's, and each game has its own
 * underneath, so Valorant kill streaks and Fortnite guns can be on together
 * or one at a time.
 */

type Game = 'valorant' | 'fortnite';

const GAMES: readonly { readonly id: Game; readonly label: string }[] = [
  { id: 'valorant', label: 'Valorant' },
  { id: 'fortnite', label: 'Fortnite' },
];

/** The tab last open, so coming back to the editor lands where you left it. */
let game: Game = 'valorant';

/**
 * Wide, so Fortnite's 24 picks sit three to a row and the whole tab fits on
 * one screen. At the usual width they were one long column, and changing the
 * headshot meant scrolling past every gun to reach it.
 */
export function soundpacksEditor(): PanelView {
  return { title: 'SOUNDPACKS', wide: true, render };
}

/**
 * The Soundpacks switch, for the row and the editor alike.
 *
 * Switched on with neither game on, it turns on Valorant's kill streaks too,
 * which is what the row did when it was only kill streaks: switching it on
 * and hearing nothing would look broken.
 */
export function toggleSoundpacks(deps: QolDeps): void {
  const v = deps.getVisuals();
  const on = !v.soundpacks.on;
  if (on && !v.killStreak.on && !v.fortnite.on) {
    deps.patchVisuals({ soundpacks: { on }, killStreak: { ...v.killStreak, on: true } });
  } else {
    deps.patchVisuals({ soundpacks: { on } });
  }
}

function render(body: HTMLElement, ctx: TabContext): void {
  body.append(
    featureRow({
      icon: 'library_music',
      name: 'Play soundpacks',
      sub: 'Everything in both tabs. Each game has its own switch as well.',
      on: ctx.deps.getVisuals().soundpacks.on,
      onToggle: () => {
        toggleSoundpacks(ctx.deps);
        ctx.refresh();
      },
    }),
    chooser<Game>({
      label: 'Game',
      options: GAMES,
      value: game,
      onPick: (id) => {
        game = id;
        ctx.refresh();
      },
    }),
  );
  if (game === 'valorant') renderKillStreak(body, ctx);
  else renderFortnite(body, ctx);
}

function renderFortnite(body: HTMLElement, ctx: TabContext): void {
  const slot = document.createElement('div');
  slot.append(hint('Looking for the Fortnite sounds...'));
  body.append(slot);

  void listSoundpacks().then((packs) => {
    // A round trip to main; the panel may be showing something else by now.
    if (!ctx.live()) return;
    slot.replaceChildren();
    const pack = packs.find((entry) => entry.id === FORTNITE_PACK_ID);
    if (!pack) slot.append(empty('No Fortnite sounds in this build'));
    else if (!pack.installed) renderInstall(slot, pack, ctx);
    else renderPicks(slot, ctx);
  });
}

function renderInstall(slot: HTMLElement, pack: SoundpackStatus, ctx: TabContext): void {
  const row = actions([
    {
      label: `Install Fortnite sounds (${(pack.bytes / 1024 / 1024).toFixed(1)} MB)`,
      onClick: () => {
        const button = row.querySelector('button');
        if (button) {
          button.textContent = 'Installing...';
          button.disabled = true;
        }
        void installSoundpack(pack.id).then((ok) => {
          if (!ok) showToast('Could not download the Fortnite sounds. Check your connection and try again.', 3600);
          // Every picked sound goes from Krunker's own to Fortnite's.
          else reloadPickedSounds(ctx.deps.getVisuals());
          if (ctx.live()) ctx.refresh();
        });
      },
    },
  ]);
  slot.append(
    note(
      "Fortnite's gun sounds, one Fortnite gun for each Krunker gun, and its hit marker and headshot. Pick them once it is installed; it downloads from GitHub and nothing plays until you switch it on.",
    ),
    row,
  );
}

function renderPicks(slot: HTMLElement, ctx: TabContext): void {
  // Read fresh on every write, as the kill streak editor does: nothing here
  // redraws on a pick, so a copy from when it was drawn would undo the last.
  const current = (): FortniteConfig => ctx.deps.getVisuals().fortnite;
  const commit = (change: Partial<FortniteConfig>, redraw: boolean): void => {
    ctx.deps.patchVisuals({ fortnite: { ...current(), ...change } });
    if (redraw) ctx.refresh();
  };
  const own = { id: '', label: "Krunker's own" };
  const listed = (ids: readonly string[]): { id: string; label: string }[] => [
    own,
    ...ids.map((id) => ({ id, label: FORTNITE_SOUNDS[id] ?? id })),
  ];
  const play = (id: string): void => {
    if (id !== '') previewFortniteSound(id);
  };
  const start = current();
  // Three to a row across the wide panel, fewer on a narrow screen.
  const grid = (): HTMLElement => {
    const el = document.createElement('div');
    el.className = 'sp-grid';
    return el;
  };

  const guns = grid();
  for (const gun of KRUNKER_GUNS) {
    const key = String(gun.weapon);
    guns.append(
      picker({
        label: gun.name,
        options: listed(gun.options),
        value: start.guns[key] ?? '',
        onPick: (id) => {
          commit({ guns: { ...current().guns, [key]: id } }, false);
          play(id);
        },
        onPreview: play,
      }),
    );
  }

  const hits = grid();
  hits.append(
    picker({
      label: 'Hit marker',
      options: listed(HIT_OPTIONS),
      value: start.hit,
      onPick: (id) => {
        commit({ hit: id }, false);
        play(id);
      },
      onPreview: play,
    }),
    picker({
      label: 'Headshot',
      options: listed(HEADSHOT_OPTIONS),
      value: start.headshot,
      onPick: (id) => {
        commit({ headshot: id }, false);
        play(id);
      },
      onPreview: play,
    }),
  );

  const remove = actions([
    {
      label: 'Remove Fortnite sounds',
      danger: true,
      onClick: () => {
        void removeSoundpack(FORTNITE_PACK_ID).then((ok) => {
          if (!ok) showToast('Could not remove the Fortnite sounds. They may be in use; try again.', 3600);
          // Every picked sound goes back to Krunker's own.
          reloadPickedSounds(ctx.deps.getVisuals());
          if (ctx.live()) ctx.refresh();
        });
      },
    },
  ]);

  // The note beside Remove rather than over it: one line fewer, on a tab
  // whose whole point now is fitting on the screen.
  const foot = document.createElement('div');
  foot.className = 'sp-foot';
  foot.append(
    note(
      "From the Fortnite wiki's ripped game audio: one close shot of each gun, levelled to sit beside Krunker's own. Krunker's own keeps the game's sound for that one. The hit marker and headshot are Fortnite's older set, from before Chapter 7.",
    ),
    remove,
  );

  slot.append(
    featureRow({
      icon: 'sports_esports',
      name: 'Play Fortnite sounds',
      sub: "Each gun fires with the Fortnite gun picked for it, yours and everyone else's, and hits and headshots sound like Fortnite's.",
      on: start.on,
      onToggle: () => commit({ on: !current().on }, true),
    }),
    slider({
      label: 'Volume',
      min: 0,
      max: MAX_VOLUME * 100,
      step: 5,
      value: Math.round(start.volume * 100),
      // 100% is Krunker's own level, and it reads as the default it is.
      format: (value) => (value === 100 ? "100% (Krunker's)" : `${value}%`),
      onChange: (value) => commit({ volume: value / 100 }, false),
    }),
    // Hits first: two picks people change, above twenty-two they mostly set once.
    heading('Hits'),
    hits,
    heading('Guns'),
    guns,
    foot,
  );
}
