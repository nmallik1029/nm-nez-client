import { ipcRenderer } from 'electron';
import { BRANDING } from '../../shared/branding';
import { IPC } from '../../shared/ipc';
import { SHEETS, STYLE_IDS, UI_IDS } from '../../shared/ui';
import { CLIENT_SCRIPTS } from '../scripts/registry';
import { isScriptRunning, setScriptEnabled } from '../scripts/runner';
import { defineStyle } from '../style';
import { activeTheme, knownThemes, setActiveTheme } from '../themes';
import { setMenuSkin } from '../menu-skin';

/**
 * The first-run walkthrough.
 *
 * Three questions, asked once, on the first launch after an install: which
 * look, which of the built-in scripts, and whether to load a stylesheet of
 * your own. Every one is a setting that already exists and is already
 * reachable from Settings: asking up front is the difference between a
 * client that restyles the game *to* you and one that does it *for* you.
 *
 * In the page, not a window of its own. It was a separate BrowserWindow
 * first, which is tidier in the abstract: no Krunker DOM to fight, and it
 * can open before the game has finished loading. In practice it was a second
 * thing in the taskbar, a second preload, a fourth Vite config and three IPC
 * channels, all to ask three questions. Here it is one panel over the menu,
 * the same as the alt manager and the scripts window, and every answer
 * applies live because the functions that apply them are already in this
 * process:
 *
 *   - `setMenuSkin` is a stylesheet plus a few reversible element moves.
 *   - `setScriptEnabled` starts and stops a script there and then.
 *   - `setActiveTheme` is one `textContent` assignment.
 *
 * So there is no reload at the end, which the window version needed because
 * it wrote config the page had already read.
 *
 * Config is written alongside each change so the choice survives a restart,
 * the same split the scripts window uses: the runner is what is *true*, the
 * config is what is *remembered*.
 */

const ID = UI_IDS.setupWizard;
const LAST_STEP = 2;

/** Open when non-null; calling it takes the panel down. */
let close: (() => void) | null = null;

interface Draft {
  menuSkin: boolean;
  scripts: string[];
  theme: string;
}

export function isSetupOpen(): boolean {
  return close !== null;
}

/**
 * Show the walkthrough.
 *
 * `firstRun` only changes two words and what closing means: on a fresh
 * install, dismissing it still counts as answered, or it comes back on every
 * launch forever. Re-opened from Settings, dismissing changes nothing.
 */
export function openSetup(firstRun: boolean): void {
  if (close) return;
  defineStyle(STYLE_IDS.setupWizard, SHEETS.setupWizard);

  const draft: Draft = {
    menuSkin: currentMenuSkin(),
    scripts: CLIENT_SCRIPTS.filter((s) => isScriptRunning(s.id)).map((s) => s.id),
    theme: activeTheme(),
  };
  let step = 0;

  const backdrop = document.createElement('div');
  backdrop.id = `${ID}-backdrop`;
  const panel = document.createElement('div');
  panel.id = ID;
  backdrop.appendChild(panel);

  // Ahead of Krunker's own handler, which otherwise eats Escape and opens the
  // game menu behind us.
  const onKey = (event: KeyboardEvent): void => {
    if (event.key !== 'Escape') return;
    event.stopPropagation();
    event.preventDefault();
    dismiss();
  };

  close = () => {
    document.removeEventListener('keydown', onKey, true);
    backdrop.remove();
    close = null;
  };
  document.addEventListener('keydown', onKey, true);

  function dismiss(): void {
    // Asked and not answered still counts as asked, on a fresh install.
    if (firstRun) markDone();
    close?.();
  }

  // ── head ──
  const head = document.createElement('div');
  head.className = 'hd';
  const mark = document.createElement('div');
  mark.className = 'mark';
  const [before, after] = BRANDING.productName.split('/');
  mark.append(before ?? BRANDING.productName);
  if (after !== undefined) {
    const slash = document.createElement('i');
    slash.textContent = '/';
    mark.append(slash, after);
  }
  const stepLabel = document.createElement('div');
  stepLabel.className = 'step';
  head.append(mark, stepLabel);

  // ── body ──
  const body = document.createElement('div');
  body.className = 'bd';
  const look = buildLook(draft, () => paint());
  const scripts = buildScripts(draft);
  const css = buildCss(draft);
  body.append(look.el, scripts.el, css.el);

  // ── foot ──
  const foot = document.createElement('div');
  foot.className = 'ft';
  const skip = document.createElement('button');
  skip.textContent = firstRun ? 'Skip' : 'Cancel';
  skip.addEventListener('click', dismiss);
  const gap = document.createElement('span');
  gap.className = 'gap';
  const back = document.createElement('button');
  back.textContent = 'Back';
  back.addEventListener('click', () => {
    if (step === 0) return;
    step -= 1;
    paint();
  });
  const next = document.createElement('button');
  next.className = 'go';
  next.addEventListener('click', () => {
    if (step < LAST_STEP) {
      step += 1;
      paint();
      return;
    }
    markDone();
    close?.();
  });
  foot.append(skip, gap, back, next);

  function paint(): void {
    look.el.hidden = step !== 0;
    scripts.el.hidden = step !== 1;
    css.el.hidden = step !== 2;
    stepLabel.textContent = `Step ${step + 1} of ${LAST_STEP + 1}`;
    back.disabled = step === 0;
    next.textContent = step === LAST_STEP ? 'Finish' : 'Next';
    // Screen three depends on screen one, and you can go back and change it.
    if (step === LAST_STEP) css.refresh();
  }

  panel.append(head, body, foot);
  paint();
  document.body.appendChild(backdrop);
}

/** Re-open from Settings. */
export function toggleSetup(): void {
  if (close) {
    close();
    return;
  }
  openSetup(false);
}

/**
 * Run it once, on the first launch after an install.
 *
 * Called with the flag off the config the preload has already loaded, so
 * there is nothing to ask main for.
 */
export function installSetup(setupDone: boolean): void {
  if (setupDone) return;
  openSetup(true);
}

function markDone(): void {
  void ipcRenderer.invoke(IPC.configPatch, 'ui', { setupDone: true });
}

function currentMenuSkin(): boolean {
  return document.getElementById(STYLE_IDS.menuSkin) !== null;
}

// ── screen one ────────────────────────────────────────────────────────────

interface Screen {
  readonly el: HTMLElement;
}

function section(title: string): { el: HTMLElement; body: HTMLElement } {
  const el = document.createElement('section');
  const h = document.createElement('h2');
  h.textContent = title;
  el.appendChild(h);
  return { el, body: el };
}

/** Show a preview, if there is one. Absent is normal, not an error. */
function fill(picture: HTMLImageElement | null, dataUrl: string | null): void {
  if (!picture || dataUrl === null) return;
  picture.src = dataUrl;
  picture.hidden = false;
}

function lede(text: string): HTMLElement {
  const p = document.createElement('p');
  p.className = 'lede';
  p.textContent = text;
  return p;
}

/**
 * One answer.
 *
 * `pic` is optional and only the look cards use it. When present the card
 * becomes a row, picture then text, and the image element is handed back
 * so the caller can fill it in when main answers with the data URL.
 */
function card(
  title: string,
  description: string,
  withPicture = false,
): { button: HTMLButtonElement; picture: HTMLImageElement | null } {
  const button = document.createElement('button');
  button.className = 'choice';

  let picture: HTMLImageElement | null = null;
  let host: HTMLElement = button;
  if (withPicture) {
    button.classList.add('shot');
    picture = document.createElement('img');
    picture.className = 'pic';
    // Decorative: the title beside it already says which one this is.
    picture.alt = '';
    // Nothing to show until main answers, and an empty img draws a broken
    // icon in the meantime.
    picture.hidden = true;
    host = document.createElement('span');
    host.className = 'col';
    button.append(picture, host);
  }

  const t = document.createElement('span');
  t.className = 't';
  t.textContent = title;
  host.appendChild(t);
  if (description !== '') {
    const d = document.createElement('span');
    d.className = 'd';
    d.textContent = description;
    host.appendChild(d);
  }
  return { button, picture };
}

/**
 * Which look. Applied on click rather than on Finish, so the menu behind the
 * panel changes as you choose and the two cards stop being an abstract
 * question.
 */
function buildLook(draft: Draft, onChange: () => void): Screen {
  const { el, body } = section('Pick a look');
  body.appendChild(
    lede(
      "The client can restyle Krunker's menu, the windows it opens and the in-game HUD, " +
        'or leave every pixel of it alone. Changeable later in Settings, under Themes.',
    ),
  );

  const choices = document.createElement('div');
  choices.className = 'choices';

  const ours = card(
    `${BRANDING.productName} style`,
    "Krunker's own colour coding on a darker, flatter menu. The panels behind the " +
      'in-game HUD are stripped out to match.',
    true,
  );
  const stock = card(
    'Krunker (original)',
    'The game exactly as it ships. Everything else the client does, frame pacing, ' +
      'the queue, the swapper, works just the same.',
    true,
  );

  /*
   * The screenshots, once main has read them off disk.
   *
   * Asked for here rather than passed in, so the panel is on screen
   * immediately and the pictures arrive into it. They are a couple of
   * hundred KB each as base64; waiting on that before drawing anything
   * would be a visible stall for something the text already covers.
   */
  void (async () => {
    try {
      const shots = (await ipcRenderer.invoke(IPC.setupPreviews)) as {
        nmnz: string | null;
        krunker: string | null;
      };
      fill(ours.picture, shots.nmnz);
      fill(stock.picture, shots.krunker);
    } catch {
      // No pictures. The cards read fine on their text alone.
    }
  })();

  const paint = (): void => {
    ours.button.classList.toggle('on', draft.menuSkin);
    stock.button.classList.toggle('on', !draft.menuSkin);
  };
  const pick = (on: boolean) => () => {
    draft.menuSkin = on;
    setMenuSkin(on);
    void ipcRenderer.invoke(IPC.configPatch, 'features', { menuSkin: on });
    paint();
    onChange();
  };
  ours.button.addEventListener('click', pick(true));
  stock.button.addEventListener('click', pick(false));

  choices.append(ours.button, stock.button);
  body.appendChild(choices);
  paint();
  return { el };
}

// ── screen two ────────────────────────────────────────────────────────────

/** Written whole each time, same as the scripts window does it. */
function saveScripts(draft: Draft): void {
  void ipcRenderer.invoke(IPC.configPatch, 'features', {
    enabledScripts: draft.scripts,
    // Nothing runs unless the master switch is on, so answering this screen
    // has to turn it on or the answer does nothing.
    userscripts: draft.scripts.length > 0,
  });
}

function buildScripts(draft: Draft): Screen {
  const { el, body } = section('Scripts');
  body.appendChild(
    lede(
      'Small extras that ship with the client, off unless you say otherwise. Each one ' +
        'can be switched off again from the Scripts button in the top bar.',
    ),
  );

  if (CLIENT_SCRIPTS.length === 0) {
    const note = document.createElement('div');
    note.className = 'note';
    note.textContent =
      'No built-in scripts in this version. Your own .js files still go in the scripts ' +
      'folder and are switched on under Settings.';
    body.appendChild(note);
    el.hidden = true;
    return { el };
  }

  const rows = document.createElement('div');
  rows.className = 'rows';

  for (const script of CLIENT_SCRIPTS) {
    const row = document.createElement('div');
    row.className = 'row';

    const glyph = document.createElement('span');
    // Krunker already loads Material Icons, so the ligature is enough. This
    // is the advantage of being in the page rather than in a window of our
    // own, where the font would have had to be shipped or the icon dropped.
    glyph.className = 'material-icons ico';
    glyph.textContent = script.icon;

    const text = document.createElement('div');
    text.className = 'txt';
    const name = document.createElement('div');
    name.className = 'nm';
    name.textContent = script.name;
    const sub = document.createElement('div');
    sub.className = 'sub';
    sub.textContent = script.description;
    text.append(name, sub);

    const toggle = document.createElement('button');
    toggle.className = 'sw';
    const paint = (): void => {
      const on = draft.scripts.includes(script.id);
      toggle.textContent = on ? 'ON' : 'OFF';
      toggle.classList.toggle('on', on);
      row.classList.toggle('live', on);
    };
    toggle.addEventListener('click', () => {
      const at = draft.scripts.indexOf(script.id);
      if (at === -1) draft.scripts.push(script.id);
      else draft.scripts.splice(at, 1);
      // Live, so switching one on here is the same act as switching it on in
      // the scripts window, including throwing on the way in, which the
      // runner reports and which this then reflects.
      setScriptEnabled(script.id, at === -1);
      draft.scripts = CLIENT_SCRIPTS.filter((s) => isScriptRunning(s.id)).map((s) => s.id);
      saveScripts(draft);
      paint();
    });
    paint();

    row.append(glyph, text, toggle);
    rows.appendChild(row);
  }

  body.appendChild(rows);
  el.hidden = true;
  return { el };
}

// ── screen three ──────────────────────────────────────────────────────────

interface CssScreen extends Screen {
  /** Re-decide which of the three faces to show. */
  refresh(): void;
}

/**
 * Custom CSS, or the reason there isn't any.
 *
 * Three faces, and which one shows depends on screen one, so it is decided
 * when the screen is reached rather than when it is built.
 */
function buildCss(draft: Draft): CssScreen {
  const { el, body } = section('Custom CSS');

  const pick = document.createElement('div');
  pick.appendChild(
    lede(
      'Any .css in your themes folder can be loaded over the top. Pick one now or leave ' +
        'it at none: the folder is watched, so anything you add later turns up in ' +
        'Settings straight away.',
    ),
  );
  const choices = document.createElement('div');
  choices.className = 'choices';
  pick.appendChild(choices);

  const locked = document.createElement('div');
  locked.className = 'note';
  const lockedA = document.createElement('p');
  const lockedB = document.createElement('p');
  locked.append(lockedA, lockedB);

  const empty = document.createElement('div');
  empty.className = 'note';
  empty.textContent =
    'No .css files found. Drop one into the themes folder, reachable from Settings ' +
    'under Themes, and it turns up there without a restart.';

  body.append(pick, locked, empty);
  el.hidden = true;

  function paintCards(): void {
    for (const el2 of choices.querySelectorAll<HTMLElement>('.choice')) {
      el2.classList.toggle('on', (el2.dataset.theme ?? '') === draft.theme);
    }
  }

  function buildCards(): void {
    choices.replaceChildren();
    const names = ['', ...knownThemes().map((t) => t.name)];
    for (const name of names) {
      const { button: b } = card(
        name === '' ? 'None' : name.replace(/\.css$/i, ''),
        name === '' ? 'Leave the game unstyled by anything of your own.' : '',
      );
      b.dataset.theme = name;
      b.addEventListener('click', () => {
        draft.theme = name;
        setActiveTheme(name);
        void ipcRenderer.invoke(IPC.configPatch, 'features', { activeTheme: name });
        paintCards();
      });
      choices.appendChild(b);
    }
    paintCards();
  }

  return {
    el,
    refresh() {
      const isLocked = draft.menuSkin;
      const none = knownThemes().length === 0;

      locked.hidden = !isLocked;
      empty.hidden = isLocked || !none;
      pick.hidden = isLocked || none;

      lockedA.textContent =
        `Not available alongside the ${BRANDING.productName} style you picked. That ` +
        'already styles the menu, the windows it opens and the in-game HUD, and a theme ' +
        'loads after all of it, so the two would fight over anything they both touch.';
      lockedB.textContent =
        'To use your own CSS, set Menu style to Krunker (original), on the previous ' +
        'screen, or in Settings under Themes, and the picker switches back on.';

      if (isLocked) {
        // Picking our style with a theme already loaded has to put the theme
        // down, or the setting says one thing and the screen shows another.
        if (draft.theme !== '') {
          draft.theme = '';
          setActiveTheme('');
          void ipcRenderer.invoke(IPC.configPatch, 'features', { activeTheme: '' });
        }
        return;
      }
      // Rebuilt rather than built once: the folder is watched, so the list can
      // have changed since the panel opened.
      buildCards();
    },
  };
}
