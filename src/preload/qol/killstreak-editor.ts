import {
  packFileUrl,
  type AvailablePack,
  type KillPack,
  type KillPackListing,
} from '../../shared/killstreak';
import { SHEETS, STYLE_IDS } from '../../shared/ui';
import type { KillStreakConfig } from '../../shared/visuals';
import {
  installKillPack,
  isInstalling,
  listKillPacks,
  onKillPacksChanged,
  previewKillPack,
  removeKillPack,
  resolvePack,
} from '../look/killstreak';
import { showToast } from '../toast';
import { defineStyle } from '../style';
import type { PanelView, TabContext } from './context';
import { heading, hint, slider } from './controls';
import { empty, featureRow, note } from './row';

/**
 * The kill streak editor: on or off, how loud, and which pack.
 *
 * Picking a pack plays its first sound, because the name of a pack tells you
 * nothing about what it sounds like, and a list you have to pick blind from
 * and then go and get a kill to hear is a list nobody finishes.
 *
 * Every pack is in the one grid, by name, whether it is on disk or not. One
 * that is not has an Install button under it and nothing else: pressing it
 * downloads that pack, then picks it and plays it, so the press is answered
 * with the thing you pressed it for. Nothing asks first or needs a restart,
 * and a tile keeps its place in the grid when it goes from one to the other.
 *
 * Everything applies as you touch it. Unlike the sky, nothing here waits on a
 * map load: the next kill uses whatever is set.
 */

export function killStreakEditor(): PanelView {
  return { title: 'KILL STREAK', render };
}

function render(body: HTMLElement, ctx: TabContext): void {
  defineStyle(STYLE_IDS.killStreak, SHEETS.killStreak);

  // Read fresh on every write. The slider and the pack grid both commit
  // without redrawing, so a copy taken when this was drawn would let a volume
  // change put back the pack you picked a moment before, or the other way.
  const current = (): KillStreakConfig => ctx.deps.getVisuals().killStreak;
  const commit = (change: Partial<KillStreakConfig>, redraw: boolean): void => {
    ctx.deps.patchVisuals({ killStreak: { ...current(), ...change } });
    if (redraw) ctx.refresh();
  };

  const start = current();
  body.append(
    featureRow({
      icon: 'military_tech',
      name: 'Play kill streak sounds',
      sub: 'A sound and a banner for each kill in a row. Dying, a new match or ten seconds without a kill starts it over.',
      on: start.on,
      onToggle: () => commit({ on: !current().on }, true),
    }),
    featureRow({
      icon: 'image',
      name: 'Show banners',
      sub: 'The picture at the bottom of the screen for each kill. Off keeps the sounds.',
      on: start.banners,
      onToggle: () => commit({ banners: !current().banners }, true),
    }),
    slider({
      label: 'Volume',
      min: 0,
      max: 100,
      step: 5,
      value: Math.round(start.volume * 100),
      format: (value) => `${value}%`,
      onChange: (value) => commit({ volume: value / 100 }, false),
    }),
    heading('Pack'),
  );

  const find = document.createElement('input');
  find.className = 'find';
  find.placeholder = 'Filter packs';
  find.spellcheck = false;

  const grid = document.createElement('div');
  grid.className = 'packs';
  grid.append(hint('Looking for packs...'));
  body.append(find, grid);

  let listing: KillPackListing | null = null;

  const pick = (pack: KillPack): void => {
    previewKillPack(pack, current().volume);
    commit({ pack: pack.id }, false);
    draw();
  };

  const install = (pack: AvailablePack): void => {
    void installKillPack(pack.id).then((ok) => {
      if (!ok) {
        showToast(`Could not download ${pack.name}. Check your connection and try again.`, 3600);
        return;
      }
      if (!ctx.live()) return;
      const got = listing?.installed.find((entry) => entry.id === pack.id);
      if (got) pick(got);
    });
  };

  const remove = (pack: KillPack): void => {
    // Nothing left to play is off, and says so on the switch above. Left on,
    // it would fetch a pack straight back to have something to play (see
    // fetchWanted), which is the opposite of what removing it asked for.
    // Before the removal, so the player never sees on-with-nothing at all.
    const last = listing !== null && listing.installed.length <= 1;
    if (last && current().on) commit({ on: false }, false);
    void removeKillPack(pack.id).then((ok) => {
      if (!ok) showToast(`Could not remove ${pack.name}. It may be in use; try again.`, 3600);
      if (last && ctx.live()) ctx.refresh();
    });
  };

  const draw = (): void => {
    if (listing === null) return;
    const filter = find.value.trim().toLowerCase();
    const chosen = resolvePack(current().pack, listing.installed)?.id ?? '';
    const removable = new Set(listing.removable);

    const tiles = [
      ...listing.installed.map((pack) => ({
        name: pack.name,
        make: () =>
          installedTile(pack, {
            on: pack.id === chosen,
            pick: () => pick(pack),
            remove: removable.has(pack.id) ? () => remove(pack) : null,
          }),
      })),
      ...listing.available.map((pack) => ({
        name: pack.name,
        make: () => availableTile(pack, isInstalling(pack.id), () => install(pack)),
      })),
    ].sort((a, b) => a.name.localeCompare(b.name));

    grid.replaceChildren();
    for (const tile of tiles) {
      if (filter === '' || tile.name.toLowerCase().includes(filter)) grid.append(tile.make());
    }
    if (tiles.length === 0) {
      grid.append(empty('No packs yet'));
    } else if (!grid.hasChildNodes()) {
      grid.append(empty(`Nothing called "${find.value.trim()}"`));
    }
  };

  const show = (next: KillPackListing): void => {
    // A round trip to main and a walk of two folders. By the time it answers
    // the panel may be showing something else entirely.
    if (!ctx.live()) return;
    listing = next;
    draw();
  };

  // A download finishing, including one started from somewhere else: this
  // editor opened while the pack you had switched on was still coming down.
  // A drawing that is no longer on screen lets go of it at the next change.
  const unsubscribe = onKillPacksChanged((next) => {
    if (!ctx.live()) {
      unsubscribe();
      return;
    }
    show(next);
  });

  find.addEventListener('input', draw);
  body.append(
    note(
      'Install downloads a pack from GitHub, about a megabyte, and the x on one takes it off your PC again. To add your own, put a folder in swap/sounds/killstreak holding name_1.mp3, name_2.mp3 and so on, one per kill, with an optional name_1.png banner beside each.',
    ),
  );
  void listKillPacks().then(show);
}

function installedTile(
  pack: KillPack,
  spec: { on: boolean; pick: () => void; remove: (() => void) | null },
): HTMLElement {
  const tile = document.createElement('div');
  tile.className = spec.on ? 'pack on' : 'pack';

  const face = document.createElement('button');
  face.className = 'face';
  face.title = `${pack.name}: plays its first sound`;
  face.append(
    art(pack.banners > 0 ? packFileUrl(pack.id, 1, 'banner') : null),
    text('nm', pack.name),
    text('meta', pack.banners > 0 ? `${pack.sounds} kills` : `${pack.sounds} kills, no banner`),
  );
  face.addEventListener('click', spec.pick);
  tile.append(face);

  if (spec.remove) {
    const drop = document.createElement('button');
    drop.className = 'drop material-icons';
    drop.textContent = 'close';
    drop.title = `Remove ${pack.name} from this PC`;
    drop.addEventListener('click', spec.remove);
    tile.append(drop);
  }
  return tile;
}

function availableTile(pack: AvailablePack, busy: boolean, install: () => void): HTMLElement {
  const tile = document.createElement('div');
  tile.className = 'pack out';

  // Not a button: there is nothing on disk to play yet. The one thing to do
  // with it is the button underneath.
  const face = document.createElement('div');
  face.className = 'face';
  face.append(art(null), text('nm', pack.name), text('meta', `${pack.sounds} kills, ${size(pack.bytes)}`));

  const get = document.createElement('button');
  get.className = 'get';
  get.textContent = busy ? 'Installing...' : 'Install';
  get.disabled = busy;
  get.addEventListener('click', () => {
    get.textContent = 'Installing...';
    get.disabled = true;
    install();
  });

  tile.append(face, get);
  return tile;
}

/** The banner, or a note glyph in its place for a pack with none, or none yet. */
function art(src: string | null): HTMLElement {
  if (src !== null) {
    const image = document.createElement('img');
    image.src = src;
    image.alt = '';
    image.loading = 'lazy';
    return image;
  }
  const glyph = document.createElement('span');
  glyph.className = 'material-icons';
  glyph.textContent = 'music_note';
  return glyph;
}

function text(className: string, value: string): HTMLElement {
  const el = document.createElement('span');
  el.className = className;
  el.textContent = value;
  return el;
}

function size(bytes: number): string {
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
