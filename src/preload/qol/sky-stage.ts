import { ipcRenderer } from 'electron';
import { IPC } from '../../shared/ipc';

/**
 * The sky preview: a real map with its sky cut out, and your colour behind it.
 *
 * The scenes are screenshots of the game shipped in `assets/`, transparent
 * where the sky was and part-transparent where the map's own fog had already
 * blended the distance into it. So the colour goes *behind* the picture and
 * the browser does the compositing: the horizon tints the way it does in
 * game, and changing the colour is one style write rather than a pass over
 * every pixel.
 *
 * Falls back to a plain block of colour when no scenes are bundled, which is
 * exactly what this editor showed before there were any.
 *
 * Which scene you are looking at is remembered for as long as the client is
 * open but never written to config: it is a way of looking at the thing you
 * are editing, not a setting.
 */

interface Scene {
  readonly name: string;
  readonly image: string;
}

let chosen = 0;
/** Fetched once per session; the editor is opened far more often than that. */
let cached: Scene[] | null = null;

export interface SkyStage {
  readonly root: HTMLElement;
  /** The flat colour behind the scene. */
  setColor(color: string): void;
}

export function skyStage(initial: string): SkyStage {
  const root = document.createElement('div');
  root.className = 'stage sky-stage';
  root.style.background = initial;

  const scene = document.createElement('img');
  scene.className = 'scene';
  scene.alt = '';
  /*
   * Inline, not the `hidden` attribute.
   *
   * `hidden` is only a UA stylesheet rule, and the panel's own sheet sets
   * `display` on both of these by id and class, which outranks it. Setting
   * `hidden` therefore did nothing at all and the first build of this showed
   * an empty nav bar with two arrows and no picture between them.
   */
  scene.style.display = 'none';

  const nav = document.createElement('div');
  nav.className = 'stage-nav';
  nav.style.display = 'none';
  const back = document.createElement('button');
  back.className = 'material-icons';
  back.textContent = 'chevron_left';
  back.title = 'Previous map';
  const name = document.createElement('span');
  const next = document.createElement('button');
  next.className = 'material-icons';
  next.textContent = 'chevron_right';
  next.title = 'Next map';
  nav.append(back, name, next);

  root.append(scene, nav);

  function paint(scenes: readonly Scene[]): void {
    const current = scenes[chosen % scenes.length];
    if (!current) return;
    scene.src = current.image;
    scene.style.display = 'block';
    name.textContent = current.name;
    // One scene is a picture, not a choice.
    nav.style.display = scenes.length < 2 ? 'none' : 'flex';
  }

  function step(by: number, scenes: readonly Scene[]): void {
    chosen = (chosen + by + scenes.length) % scenes.length;
    paint(scenes);
  }

  void (async () => {
    if (cached === null) {
      try {
        cached = (await ipcRenderer.invoke(IPC.skyScenes)) as Scene[];
      } catch {
        cached = [];
      }
    }
    const scenes = cached;
    if (scenes.length === 0 || !root.isConnected) return;

    back.addEventListener('click', () => step(-1, scenes));
    next.addEventListener('click', () => step(1, scenes));
    paint(scenes);
  })();

  return {
    root,
    setColor: (color) => {
      root.style.background = color;
    },
  };
}
