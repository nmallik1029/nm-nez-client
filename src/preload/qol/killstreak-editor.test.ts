import { beforeEach, describe, expect, it, vi } from 'vitest';
import { IPC } from '../../shared/ipc';
import type { KillStreakConfig } from '../../shared/visuals';

/**
 * The kill streak editor's Install and x, driven the way someone would press
 * them, against the real player and a stand-in for main.
 *
 * Every case here went wrong in review before 0.1.60 shipped. They share one
 * rule: the player downloads whatever pack the config names, so the editor
 * must never leave the config naming a pack that is not on disk and not on
 * its way, or a pack the user just removed comes back and plays. And the pick
 * an Install makes has to survive whatever the editor goes through while the
 * download runs.
 */

const invoke = vi.fn<(channel: string, ...args: unknown[]) => unknown>();
vi.mock('electron', () => ({
  ipcRenderer: { invoke: (channel: string, ...args: unknown[]) => invoke(channel, ...args) },
}));
const toasts: string[] = [];
vi.mock('../toast', () => ({ showToast: (message: string) => toasts.push(message) }));

/** Just enough DOM for the editor to build itself and be clicked. */
class FakeEl {
  children: FakeEl[] = [];
  parent: FakeEl | null = null;
  className = '';
  textContent = '';
  disabled = false;
  value = '';
  title = '';
  listeners = new Map<string, (() => void)[]>();
  style: Record<string, string> = {};
  dataset: Record<string, string> = {};
  [key: string]: unknown;
  constructor(public tagName: string) {}
  get classList(): { add: (...c: string[]) => void; remove: (...c: string[]) => void; toggle: (c: string, on?: boolean) => boolean; contains: (c: string) => boolean } {
    const list = (): string[] => this.className.split(/\s+/).filter(Boolean);
    return {
      add: (...c) => (this.className = [...new Set([...list(), ...c])].join(' ')),
      remove: (...c) => (this.className = list().filter((x) => !c.includes(x)).join(' ')),
      toggle: (c, on) => {
        const want = on ?? !list().includes(c);
        this.className = (want ? [...new Set([...list(), c])] : list().filter((x) => x !== c)).join(' ');
        return want;
      },
      contains: (c) => list().includes(c),
    };
  }
  append(...nodes: (FakeEl | string)[]): void {
    for (const node of nodes) {
      if (typeof node === 'string') continue;
      node.parent = this;
      this.children.push(node);
    }
  }
  appendChild(node: FakeEl): FakeEl {
    this.append(node);
    return node;
  }
  replaceChildren(...nodes: FakeEl[]): void {
    this.children = [];
    this.append(...nodes);
  }
  replaceWith(...nodes: FakeEl[]): void {
    if (!this.parent) return;
    const at = this.parent.children.indexOf(this);
    for (const node of nodes) node.parent = this.parent;
    this.parent.children.splice(at, 1, ...nodes);
  }
  hasChildNodes(): boolean {
    return this.children.length > 0;
  }
  addEventListener(type: string, listener: () => void): void {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener]);
  }
  removeEventListener(): void {}
  setAttribute(): void {}
  remove(): void {
    if (this.parent) this.parent.children = this.parent.children.filter((c) => c !== this);
  }
  get isConnected(): boolean {
    return true;
  }
  click(): void {
    if (this.disabled) return;
    for (const listener of this.listeners.get('click') ?? []) listener();
  }
  *walk(): Generator<FakeEl> {
    yield this;
    for (const child of this.children) yield* child.walk();
  }
}

const CATALOG: Record<string, string> = { default: 'Default', reaver: 'Reaver', ion: 'Ion' };

/** Main: what is on disk, what it was asked to fetch and delete, and what the page saved. */
let installed: Set<string>;
let installs: string[];
let answer: 'ok' | 'fail' | 'hold';
let held: Map<string, (ok: boolean) => void>;
let failRemove: boolean;
let holdRemove: boolean;
let heldRemove: Map<string, () => void>;
/** Every channel main was sent, in order, and the kill streak config it was last told to save. */
let calls: string[];
let saved: KillStreakConfig | null;

function listing(): unknown {
  const onDisk = [...installed].map((id) => ({ id, name: CATALOG[id] ?? id, sounds: 1, banners: 0 }));
  onDisk.sort((a, b) => a.name.localeCompare(b.name));
  return {
    installed: onDisk,
    removable: [...installed],
    available: Object.keys(CATALOG)
      .filter((id) => !installed.has(id))
      .map((id) => ({ id, name: CATALOG[id], sounds: 1, banners: 0, bytes: 1 })),
  };
}

function main(channel: string, ...args: unknown[]): unknown {
  calls.push(channel);
  const id = typeof args[0] === 'string' ? args[0] : '';
  if (channel === IPC.killPacksGet) return Promise.resolve(listing());
  if (channel === IPC.configPatch) {
    const patch = args[1] as { killStreak?: KillStreakConfig };
    if (args[0] === 'visuals' && patch.killStreak) saved = patch.killStreak;
    return Promise.resolve(true);
  }
  if (channel === IPC.killPacksRemove) {
    const go = (): boolean => !failRemove && installed.delete(id);
    if (!holdRemove) return Promise.resolve(go());
    return new Promise((resolve) => heldRemove.set(id, () => resolve(go())));
  }
  if (channel === IPC.killPacksInstall) {
    installs.push(id);
    if (answer === 'hold') {
      return new Promise((resolve) =>
        held.set(id, (ok) => {
          if (ok) installed.add(id);
          resolve(ok);
        }),
      );
    }
    if (answer === 'ok') installed.add(id);
    return Promise.resolve(answer === 'ok');
  }
  return Promise.reject(new Error(`unexpected ${channel}`));
}

async function settle(): Promise<void> {
  for (let i = 0; i < 8; i++) await new Promise((resolve) => setImmediate(resolve));
}

/** A fresh page: the player and the editor, open, over a config. */
async function open(start: Pick<KillStreakConfig, 'on' | 'pack'>) {
  vi.resetModules();
  const player = await import('../look/killstreak');
  const { killStreakEditor } = await import('./killstreak-editor');

  let killStreak: KillStreakConfig = { ...start, volume: 0.3, banners: true };
  const deps = {
    getFeatures: () => ({}),
    patchFeatures: () => {},
    getVisuals: () => ({ killStreak }),
    // Applied at once, as the preload does. Its save is 250 ms later and not
    // modelled: what these tests check is the save the removal sends itself.
    patchVisuals: (partial: { killStreak?: KillStreakConfig }) => {
      if (!partial.killStreak) return;
      killStreak = partial.killStreak;
      player.setKillStreak(killStreak);
    },
    reload: () => {},
  };
  player.setKillStreak(killStreak);
  await settle();

  const body = new FakeEl('div');
  let drawing = 0;
  const view = killStreakEditor();
  const paint = (): void => {
    body.replaceChildren();
    const mine = ++drawing;
    view.render(body as unknown as HTMLElement, {
      deps: deps as never,
      refresh: paint,
      live: () => mine === drawing,
      push: () => {},
    });
  };
  paint();
  await settle();

  const tile = (name: string): FakeEl => {
    const found = [...body.walk()].find(
      (el) =>
        el.className.split(' ').includes('pack') &&
        [...el.walk()].some((c) => c.className === 'nm' && c.textContent === name),
    );
    if (!found) throw new Error(`no ${name} tile`);
    return found;
  };
  const press = (name: string, button: 'get' | 'rm' | 'face'): void => {
    const found = [...tile(name).walk()].find(
      (el) => el.tagName === 'button' && el.className.split(' ').includes(button),
    );
    if (!found) throw new Error(`no ${button} on ${name}`);
    found.click();
  };
  const sw = (label: string): FakeEl | undefined => {
    const row = [...body.walk()].find(
      (el) => el.className.startsWith('row') && [...el.walk()].some((c) => c.textContent === label),
    );
    return [...(row?.walk() ?? [])].find((el) => el.className.startsWith('sw'));
  };
  const toggle = (label: string): void => sw(label)?.click();
  /** What the switch says, which has to be what the config is. */
  const shows = (): string | undefined => sw('Play kill streak sounds')?.textContent;

  return {
    press,
    toggle,
    shows,
    config: () => killStreak,
    plays: () => player.resolvePack(killStreak.pack)?.id ?? null,
  };
}

beforeEach(() => {
  installed = new Set();
  installs = [];
  answer = 'ok';
  held = new Map();
  failRemove = false;
  holdRemove = false;
  heldRemove = new Map();
  calls = [];
  saved = null;
  toasts.length = 0;
  invoke.mockReset();
  invoke.mockImplementation((channel, ...args) => main(channel, ...args));
  vi.stubGlobal('document', {
    createElement: (tag: string) => new FakeEl(tag),
    getElementById: () => null,
    head: new FakeEl('head'),
    body: new FakeEl('body'),
    documentElement: new FakeEl('html'),
    addEventListener: () => {},
  });
  vi.stubGlobal(
    'Audio',
    class {
      volume = 1;
      preload = '';
      currentTime = 0;
      play(): Promise<void> {
        return Promise.resolve();
      }
    },
  );
  vi.stubGlobal('Image', class {});
  vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
});

describe('Install', () => {
  it('keeps its pick through the switch being flipped mid-download, and fetches nothing beside it', async () => {
    installed.add('default');
    const editor = await open({ on: false, pack: '' });
    answer = 'hold';
    editor.press('Reaver', 'get');
    editor.toggle('Play kill streak sounds');
    await settle();
    held.get('reaver')?.(true);
    await settle();
    expect(installs).toEqual(['reaver']);
    expect(editor.config()).toMatchObject({ on: true, pack: 'reaver' });
    expect(editor.plays()).toBe('reaver');
  });

  it('keeps its pick when the only other pack is removed while it downloads', async () => {
    // Installing another pack and removing the stock one is the natural swap.
    installed.add('default');
    const editor = await open({ on: true, pack: '' });
    answer = 'hold';
    editor.press('Reaver', 'get');
    editor.press('Default', 'rm');
    await settle();
    expect(editor.config()).toMatchObject({ on: true, pack: 'reaver' });
    held.get('reaver')?.(true);
    await settle();
    expect(installs).toEqual(['reaver']);
    expect(editor.plays()).toBe('reaver');

    // And the next launch plays it without fetching Default back.
    installs = [];
    const next = await open(editor.config());
    expect(installs).toEqual([]);
    expect(next.plays()).toBe('reaver');
  });

  it('that fails does not put the pick back on a pack removed while it ran', async () => {
    installed.add('default');
    installed.add('reaver');
    const editor = await open({ on: true, pack: 'reaver' });
    answer = 'hold';
    editor.press('Ion', 'get');
    editor.press('Reaver', 'rm');
    await settle();
    held.get('ion')?.(false);
    await settle();
    expect(installs).toEqual(['ion']);
    expect(editor.config().pack).toBe('default');
    expect(toasts).toHaveLength(1);
  });

  it('that fails goes back to the old pick when it is still there', async () => {
    installed.add('default');
    installed.add('reaver');
    const editor = await open({ on: true, pack: 'reaver' });
    answer = 'fail';
    editor.press('Ion', 'get');
    await settle();
    expect(editor.config()).toMatchObject({ on: true, pack: 'reaver' });
  });

  it('that fails goes back to an earlier Install that is still downloading', async () => {
    installed.add('default');
    const editor = await open({ on: true, pack: '' });
    answer = 'hold';
    editor.press('Reaver', 'get');
    editor.press('Ion', 'get');
    held.get('ion')?.(false);
    await settle();
    expect(editor.config().pack).toBe('reaver');
    held.get('reaver')?.(true);
    await settle();
    expect(editor.plays()).toBe('reaver');
    expect(installs).toEqual(['reaver', 'ion']);
  });

  it('that fails with nothing to fall back on switches off, and the switch says so', async () => {
    // Updating from 0.1.59 with kill streaks on and nothing on disk, offline.
    answer = 'fail';
    const editor = await open({ on: true, pack: 'reaver' });
    expect(installs).toEqual(['reaver']);
    editor.press('Reaver', 'get');
    await settle();
    expect(editor.config()).toMatchObject({ on: false, pack: '' });
    expect(editor.shows()).toBe('OFF');
    // Then it lands on a second try: picked, and still off, as the switch says.
    answer = 'ok';
    editor.press('Reaver', 'get');
    await settle();
    expect(editor.config()).toMatchObject({ on: false, pack: 'reaver' });
    expect(editor.shows()).toBe('OFF');
  });

  it('that fails twice in a row lands on a pack that is there', async () => {
    installed.add('default');
    const editor = await open({ on: true, pack: '' });
    answer = 'hold';
    editor.press('Reaver', 'get');
    editor.press('Ion', 'get');
    held.get('reaver')?.(false);
    await settle();
    held.get('ion')?.(false);
    await settle();
    expect(editor.plays()).toBe('default');
    installs = [];
    await open(editor.config());
    expect(installs).toEqual([]);
  });
});

describe('the x', () => {
  it('moves the pick to a pack that is there when it removes the picked one', async () => {
    installed.add('default');
    installed.add('reaver');
    const editor = await open({ on: true, pack: 'reaver' });
    editor.press('Reaver', 'rm');
    await settle();
    expect(installed.has('reaver')).toBe(false);
    expect(editor.config()).toMatchObject({ on: true, pack: 'default' });
    installs = [];
    await open(editor.config());
    expect(installs).toEqual([]);
  });

  it('never leaves an empty pick behind when Default goes, since that would fetch it back', async () => {
    installed.add('default');
    installed.add('ion');
    const editor = await open({ on: true, pack: '' });
    editor.press('Default', 'rm');
    await settle();
    expect(editor.config().pack).toBe('ion');
    installs = [];
    await open(editor.config());
    expect(installs).toEqual([]);
  });

  it('on the last pack switches off, shows it at once, and saves it before the pack is gone', async () => {
    installed.add('reaver');
    const editor = await open({ on: true, pack: 'reaver' });
    holdRemove = true;
    editor.press('Reaver', 'rm');
    // Before main has answered: a switch still reading ON here is one that,
    // pressed to turn off, would turn on and fetch Default.
    expect(editor.shows()).toBe('OFF');
    await settle();
    expect(saved).toMatchObject({ on: false, pack: '' });
    expect(calls.lastIndexOf(IPC.configPatch)).toBeLessThan(calls.indexOf(IPC.killPacksRemove));
    heldRemove.get('reaver')?.();
    await settle();
    expect(editor.config()).toMatchObject({ on: false, pack: '' });
    installs = [];
    await open(editor.config());
    expect(installs).toEqual([]);
  });

  it('pressed on two packs quickly leaves the pick on neither', async () => {
    installed.add('default');
    installed.add('ion');
    installed.add('reaver');
    const editor = await open({ on: true, pack: '' });
    holdRemove = true;
    editor.press('Default', 'rm');
    await settle();
    editor.press('Ion', 'rm');
    await settle();
    expect(editor.config().pack).toBe('reaver');
    heldRemove.get('default')?.();
    heldRemove.get('ion')?.();
    await settle();
    installs = [];
    const next = await open(editor.config());
    expect(installs).toEqual([]);
    expect(next.plays()).toBe('reaver');
  });

  it('on the picked pack, with another downloading, moves the pick to the one coming', async () => {
    installed.add('reaver');
    const editor = await open({ on: true, pack: 'reaver' });
    answer = 'hold';
    editor.press('Ion', 'get');
    // Changed their mind back to the pack on disk, then removed it.
    editor.press('Reaver', 'face');
    editor.press('Reaver', 'rm');
    await settle();
    expect(editor.config()).toMatchObject({ on: true, pack: 'ion' });
    held.get('ion')?.(true);
    await settle();
    expect(installs).toEqual(['ion']);
    expect(editor.plays()).toBe('ion');
  });

  it('cannot pick a pack whose removal is still running', async () => {
    installed.add('default');
    installed.add('reaver');
    const editor = await open({ on: true, pack: 'reaver' });
    holdRemove = true;
    editor.press('Reaver', 'rm');
    await settle();
    editor.press('Reaver', 'face');
    expect(editor.config().pack).toBe('default');
    heldRemove.get('reaver')?.();
    await settle();
    expect(installs).toEqual([]);
  });

  it('on a pack already deleted by hand leaves the pick off it, and says nothing', async () => {
    installed.add('default');
    installed.add('reaver');
    const editor = await open({ on: true, pack: 'reaver' });
    installed.delete('reaver');
    editor.press('Reaver', 'rm');
    await settle();
    expect(editor.config().pack).toBe('default');
    expect(toasts).toEqual([]);
    expect(installs).toEqual([]);
  });

  it('that fails puts back what was set', async () => {
    installed.add('default');
    installed.add('reaver');
    const editor = await open({ on: true, pack: 'reaver' });
    failRemove = true;
    editor.press('Reaver', 'rm');
    await settle();
    expect(installed.has('reaver')).toBe(true);
    expect(editor.config()).toMatchObject({ on: true, pack: 'reaver' });
    expect(toasts).toHaveLength(1);
  });
});
