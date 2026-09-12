import { KRUNKER_LOOK } from '../../krunker/constants';

/**
 * The preview box an editor draws its marker in.
 *
 * It is backed by one of Krunker's own wall textures, and that is the whole
 * point of it. A crosshair judged against a flat panel colour is a crosshair
 * you find out about in a match: thin dark lines disappear on brick, a white
 * one disappears on sand, and the outline that fixes both is invisible until
 * there is something behind it. The game's own settings do the same thing,
 * for the same reason.
 *
 * The textures are already in the page's cache, since the menu loads them
 * itself. Which one you are looking at is remembered for as long as the
 * client is open but is not written to the config: it is a way of looking at
 * the thing you are editing, not a setting.
 */

let chosen = 0;

export interface Stage {
  readonly root: HTMLElement;
  /**
   * The box around the image, centred in the stage.
   *
   * Everything that moves or resizes the marker moves this, not the image:
   * the hitmarker editor hangs its drag handle off the corner of it, and a
   * handle that has to track a separately positioned image is a handle that
   * is always half a frame behind it.
   */
  readonly grab: HTMLElement;
  /** The marker itself. The editor sets its `src` and size. */
  readonly art: HTMLImageElement;
}

export function previewStage(): Stage {
  const root = document.createElement('div');
  root.className = 'stage';

  const grab = document.createElement('div');
  grab.className = 'grab';

  const art = document.createElement('img');
  art.className = 'art';
  art.alt = '';
  grab.appendChild(art);

  const nav = document.createElement('div');
  nav.className = 'stage-nav';
  // Material Icons rather than the chevron characters: GameFont has no glyph
  // for those and draws an empty box in their place.
  const back = document.createElement('button');
  back.className = 'material-icons';
  back.textContent = 'chevron_left';
  back.title = 'Previous background';
  const name = document.createElement('span');
  const next = document.createElement('button');
  next.className = 'material-icons';
  next.textContent = 'chevron_right';
  next.title = 'Next background';

  const textures = KRUNKER_LOOK.previewTextures;
  function paint(): void {
    const texture = textures[chosen] ?? textures[0];
    if (!texture) return;
    root.style.backgroundImage = `url("${texture.url}")`;
    name.textContent = texture.name;
  }
  function step(by: number): void {
    chosen = (chosen + by + textures.length) % textures.length;
    paint();
  }

  back.addEventListener('click', () => step(-1));
  next.addEventListener('click', () => step(1));
  paint();

  nav.append(back, name, next);
  root.append(grab, nav);
  return { root, grab, art };
}
