import { packFileUrl, type KillPack } from '../../shared/killstreak';
import { SHEETS, STYLE_IDS } from '../../shared/ui';
import type { KillStreakConfig } from '../../shared/visuals';
import { listKillPacks, previewKillPack, resolvePack } from '../look/killstreak';
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

  void listKillPacks().then((packs) => {
    // The list is a round trip to main and a walk of two folders. By the
    // time it answers the panel may be showing something else entirely.
    if (!ctx.live()) return;

    if (packs.length === 0) {
      find.remove();
      grid.replaceWith(
        empty('No packs yet'),
        note(
          'A pack is a folder in swap/sounds/killstreak holding name_1.mp3, name_2.mp3 and so on, one per kill, with an optional name_1.png banner beside each. Add one and open this again.',
        ),
      );
      return;
    }

    let chosen = resolvePack(current().pack, packs)?.id ?? '';

    const draw = (): void => {
      const filter = find.value.trim().toLowerCase();
      grid.replaceChildren();
      for (const pack of packs) {
        if (filter !== '' && !pack.name.toLowerCase().includes(filter)) continue;
        grid.append(
          tile(pack, pack.id === chosen, () => {
            chosen = pack.id;
            previewKillPack(pack, current().volume);
            commit({ pack: pack.id }, false);
            for (const el of grid.querySelectorAll<HTMLElement>('.pack')) {
              el.classList.toggle('on', el.dataset.id === pack.id);
            }
          }),
        );
      }
      if (!grid.hasChildNodes()) grid.append(empty(`Nothing called "${find.value.trim()}"`));
    };

    find.addEventListener('input', draw);
    draw();
  });
}

function tile(pack: KillPack, on: boolean, pick: () => void): HTMLElement {
  const button = document.createElement('button');
  button.className = on ? 'pack on' : 'pack';
  button.dataset.id = pack.id;
  button.title = `${pack.name}: plays its first sound`;

  if (pack.banners > 0) {
    const image = document.createElement('img');
    image.src = packFileUrl(pack.id, 1, 'banner');
    image.alt = '';
    image.loading = 'lazy';
    button.append(image);
  } else {
    const glyph = document.createElement('span');
    glyph.className = 'material-icons';
    glyph.textContent = 'music_note';
    button.append(glyph);
  }

  const name = document.createElement('span');
  name.className = 'nm';
  name.textContent = pack.name;

  const meta = document.createElement('span');
  meta.className = 'meta';
  meta.textContent = pack.banners > 0 ? `${pack.sounds} kills` : `${pack.sounds} kills, no banner`;

  button.append(name, meta);
  button.addEventListener('click', pick);
  return button;
}
