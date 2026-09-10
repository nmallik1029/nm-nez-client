import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadThemes, watchThemes } from './themes';

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'themes-'));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

const write = (name: string, body: string) => writeFileSync(join(dir, name), body);

describe('loadThemes', () => {
  it('returns an empty list for a missing folder', () => {
    expect(loadThemes(join(dir, 'nope'))).toEqual([]);
  });

  it('reads css files with their contents', () => {
    write('dark.css', 'body{color:red}');
    expect(loadThemes(dir)).toEqual([{ name: 'dark.css', css: 'body{color:red}' }]);
  });

  it('ignores non-css files', () => {
    write('notes.txt', 'hello');
    write('script.js', 'alert(1)');
    write('real.css', 'a{}');
    expect(loadThemes(dir).map((t) => t.name)).toEqual(['real.css']);
  });

  it('matches the extension case-insensitively', () => {
    write('Loud.CSS', 'a{}');
    expect(loadThemes(dir).map((t) => t.name)).toEqual(['Loud.CSS']);
  });

  it('sorts by name so cascade order is stable across machines', () => {
    write('b.css', 'b{}');
    write('a.css', 'a{}');
    write('c.css', 'c{}');
    // Later files win in the CSS cascade, so unstable ordering would mean a
    // theme silently changing behaviour between machines.
    expect(loadThemes(dir).map((t) => t.name)).toEqual(['a.css', 'b.css', 'c.css']);
  });

  it('skips a file over the size cap', () => {
    write('huge.css', 'x'.repeat(3 * 1024 * 1024));
    write('fine.css', 'a{}');
    expect(loadThemes(dir).map((t) => t.name)).toEqual(['fine.css']);
  });

  it('skips a directory that looks like a css file', () => {
    mkdirSync(join(dir, 'folder.css'));
    write('real.css', 'a{}');
    expect(loadThemes(dir).map((t) => t.name)).toEqual(['real.css']);
  });
});

describe('watchThemes', () => {
  it('returns a no-op disposer for a missing folder', () => {
    const dispose = watchThemes(join(dir, 'nope'), () => {});
    expect(() => dispose()).not.toThrow();
  });

  it('coalesces a burst of edits into one callback', async () => {
    const onChange = vi.fn();
    const dispose = watchThemes(dir, onChange, 40);

    // Editors emit several events per save (truncate, write, rename); firing
    // once per event would re-inject the stylesheet several times per keystroke.
    write('a.css', 'a{}');
    write('a.css', 'a{color:red}');
    write('a.css', 'a{color:blue}');

    await new Promise((r) => setTimeout(r, 200));
    dispose();

    expect(onChange.mock.calls.length).toBeLessThanOrEqual(2);
    expect(onChange).toHaveBeenCalled();
  });

  it('stops firing after dispose', async () => {
    const onChange = vi.fn();
    const dispose = watchThemes(dir, onChange, 20);
    dispose();

    write('b.css', 'b{}');
    await new Promise((r) => setTimeout(r, 120));

    expect(onChange).not.toHaveBeenCalled();
  });
});
