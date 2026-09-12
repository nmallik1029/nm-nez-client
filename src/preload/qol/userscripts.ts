import { ipcRenderer } from 'electron';
import { IPC, type UserscriptInfo, type UserscriptSaveResult } from '../../shared/ipc';
import { showToast } from '../toast';
import type { TabContext } from './context';
import { empty, featureRow, note } from './row';

/**
 * The Userscripts tab: your own `.js` files.
 *
 * They have always run from a folder in %APPDATA%, switched on by one setting
 * and otherwise invisible: to add one you had to know the folder existed,
 * find it, and take the client's word for what it had loaded. This is that
 * folder, on screen, with somewhere to drop a file onto.
 *
 * Nothing here runs a script there and then. A userscript runs once when the
 * page loads, and one that has already run cannot be un-run, so adding,
 * removing or switching one lands on the next reload. That is what the strip
 * at the bottom is for; pretending otherwise would be worse than a reload
 * button.
 */

/** Something has changed that only a page load can apply. */
let pending = false;

export function renderUserscripts(body: HTMLElement, ctx: TabContext): void {
  void fill(body, ctx);
}

async function fill(body: HTMLElement, ctx: TabContext): Promise<void> {
  let scripts: readonly UserscriptInfo[];
  try {
    scripts = (await ipcRenderer.invoke(IPC.userscriptsList)) as UserscriptInfo[];
  } catch {
    scripts = [];
  }
  // The panel can be closed, or another tab opened, while that was in flight.
  if (!ctx.live()) return;

  const features = ctx.deps.getFeatures();
  const off = new Set(features.disabledUserscripts);

  body.replaceChildren();

  body.append(
    featureRow({
      icon: 'play_circle',
      name: 'Run userscripts',
      sub: 'Off means nothing in this list runs, whatever its own switch says.',
      on: features.userscripts,
      onToggle: () => {
        ctx.deps.patchFeatures({ userscripts: !features.userscripts });
        pending = true;
        ctx.refresh();
      },
    }),
    dropZone(ctx),
  );

  if (scripts.length === 0) {
    body.append(empty('No userscripts yet. Drop a .js file on the box above.'));
  } else {
    for (const script of scripts) body.append(scriptRow(script, !off.has(script.name), ctx));
  }

  body.append(actions());
  if (pending) body.append(reloadStrip(ctx));
  body.append(
    note('A userscript can do anything this page can. Only run files you wrote or trust.'),
  );
}

/** One file: what it calls itself, what it is called on disk, and a switch. */
function scriptRow(script: UserscriptInfo, on: boolean, ctx: TabContext): HTMLElement {
  const row = featureRow({
    icon: 'description',
    name: script.title,
    sub: `${script.name} · ${kilobytes(script.bytes)}`,
    on,
    onToggle: () => {
      const off = new Set(ctx.deps.getFeatures().disabledUserscripts);
      if (on) off.add(script.name);
      else off.delete(script.name);
      ctx.deps.patchFeatures({ disabledUserscripts: [...off] });
      pending = true;
      ctx.refresh();
    },
  });

  /*
   * Two clicks to delete, because this one takes the file with it. Every
   * other switch in this panel is a setting you can put back; there is no
   * putting a file back, and the control sits an inch from the one you press
   * to try a script out.
   */
  const remove = document.createElement('button');
  remove.className = 'del';
  remove.textContent = '✕';
  remove.title = `Delete ${script.name}`;
  let armed = false;
  remove.addEventListener('click', () => {
    if (!armed) {
      armed = true;
      remove.textContent = 'Delete?';
      remove.classList.add('armed');
      return;
    }
    void ipcRenderer
      .invoke(IPC.userscriptsRemove, script.name)
      .then(() => {
        showToast(`Deleted "${script.name}"`);
        pending = true;
        ctx.refresh();
      })
      .catch(() => showToast(`Could not delete "${script.name}"`));
  });

  row.appendChild(remove);
  return row;
}

/**
 * The drop target, which is also a file picker.
 *
 * Both, rather than one or the other: dragging is the thing worth having,
 * and a click is what someone does when the drag does not work or when the
 * file is behind a maximised window.
 */
function dropZone(ctx: TabContext): HTMLElement {
  const zone = document.createElement('div');
  zone.className = 'drop';

  const big = document.createElement('span');
  big.className = 'big';
  big.textContent = 'Drop .js files here';
  const small = document.createElement('span');
  small.className = 'small';
  small.textContent = 'or click to pick them';

  const picker = document.createElement('input');
  picker.type = 'file';
  picker.accept = '.js,text/javascript';
  picker.multiple = true;
  picker.hidden = true;
  picker.addEventListener('change', () => {
    // Copy the list out BEFORE clearing the input.
    //
    // `picker.files` is a live FileList, and setting `value = ''` empties it
    // per spec -- so holding the reference and clearing first handed `install`
    // an empty list, which it reported as "Userscripts have to be .js files".
    // The file was never looked at. Clearing is still needed, because picking
    // the same file twice in a row fires no change event otherwise and the
    // second attempt looks like it did nothing; it just has to happen second.
    const chosen = [...(picker.files ?? [])];
    picker.value = '';
    void install(chosen, ctx);
  });

  zone.append(big, small, picker);
  zone.addEventListener('click', () => picker.click());

  const over = (event: DragEvent): void => {
    if (!event.dataTransfer?.types.includes('Files')) return;
    // Without this the drop never arrives: the default for dragover is to
    // refuse the drag, and refusing it here hands the file to Chromium,
    // which navigates the page to it.
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
    zone.classList.add('over');
  };
  zone.addEventListener('dragenter', over);
  zone.addEventListener('dragover', over);
  zone.addEventListener('dragleave', (event) => {
    // Moving onto a child fires dragleave on the zone. Only a pointer that
    // has actually left it counts.
    const to = event.relatedTarget;
    if (to instanceof Node && zone.contains(to)) return;
    zone.classList.remove('over');
  });
  zone.addEventListener('drop', (event) => {
    event.preventDefault();
    zone.classList.remove('over');
    void install([...(event.dataTransfer?.files ?? [])], ctx);
  });

  return zone;
}

/**
 * Write dropped files into the scripts folder.
 *
 * The text is read here and handed over, rather than the path: a sandboxed
 * page has no business reading the filesystem, and this way there is nothing
 * to get wrong about where the file came from. Main checks the name and the
 * size before it writes anything.
 */
async function install(files: readonly File[], ctx: TabContext): Promise<void> {
  const chosen = files.filter((file) => file.name.toLowerCase().endsWith('.js'));
  if (chosen.length === 0) {
    showToast('Userscripts have to be .js files');
    return;
  }

  const saved: string[] = [];
  for (const file of chosen) {
    let source: string;
    try {
      source = await file.text();
    } catch {
      showToast(`Could not read "${file.name}"`);
      continue;
    }

    try {
      const result = (await ipcRenderer.invoke(
        IPC.userscriptsAdd,
        file.name,
        source,
      )) as UserscriptSaveResult;
      if (result.ok) saved.push(file.name);
      else showToast(result.problem, 3400);
    } catch {
      showToast(`Could not save "${file.name}"`);
    }
  }

  const first = saved[0];
  if (first !== undefined) {
    pending = true;
    showToast(saved.length === 1 ? `Added "${first}"` : `Added ${saved.length} userscripts`);
  }
  ctx.refresh();
}

/** Where the files actually are, for anyone who wants to edit one. */
function actions(): HTMLElement {
  const wrap = document.createElement('div');
  wrap.className = 'actions';

  const folder = document.createElement('button');
  folder.textContent = 'Open scripts folder';
  folder.addEventListener('click', () => {
    void ipcRenderer.invoke(IPC.openFolder, 'scripts');
  });

  wrap.appendChild(folder);
  return wrap;
}

function reloadStrip(ctx: TabContext): HTMLElement {
  const strip = document.createElement('div');
  strip.className = 'pend';

  const text = document.createElement('div');
  text.className = 'txt';
  text.textContent = 'Scripts load with the page, so this takes a reload.';

  const go = document.createElement('button');
  go.textContent = 'Reload now';
  go.addEventListener('click', () => {
    pending = false;
    ctx.deps.reload();
  });

  strip.append(text, go);
  return strip;
}

function kilobytes(bytes: number): string {
  // Rounded up, so a 40-byte script does not read as "0 KB" and look empty.
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}
