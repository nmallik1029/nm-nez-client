import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  isScriptFileName,
  listUserscripts,
  loadUserscripts,
  removeUserscript,
  saveUserscript,
} from './assets';

/**
 * The scripts folder, which the QoL panel now writes to on behalf of the
 * page.
 *
 * The name check is the part worth testing hardest. Everything else here is
 * a folder listing; that one decides whether a string arriving from the
 * renderer can name a file outside the folder it is supposed to land in.
 */

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'scripts-'));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

const write = (name: string, body: string): void => writeFileSync(join(dir, name), body);

describe('isScriptFileName', () => {
  it('takes a plain .js filename', () => {
    expect(isScriptFileName('aim.js')).toBe(true);
    expect(isScriptFileName('My Script 2.js')).toBe(true);
  });

  it('matches the extension case-insensitively', () => {
    expect(isScriptFileName('LOUD.JS')).toBe(true);
  });

  it('refuses anything that is not a .js', () => {
    expect(isScriptFileName('theme.css')).toBe(false);
    expect(isScriptFileName('script')).toBe(false);
    expect(isScriptFileName('script.js.txt')).toBe(false);
  });

  it('refuses a name that could walk out of the folder', () => {
    for (const name of [
      '../evil.js',
      '..\\evil.js',
      'sub/evil.js',
      'sub\\evil.js',
      '/etc/evil.js',
      'C:/Windows/evil.js',
      'C:evil.js',
    ]) {
      expect(isScriptFileName(name), name).toBe(false);
    }
  });

  it('refuses hidden files, wildcards and the Windows device names', () => {
    expect(isScriptFileName('.hidden.js')).toBe(false);
    expect(isScriptFileName('*.js')).toBe(false);
    expect(isScriptFileName('con.js')).toBe(false);
    expect(isScriptFileName('NUL.js')).toBe(false);
    // Not reserved: the reserved set is the whole stem, not a prefix of it.
    expect(isScriptFileName('console.js')).toBe(true);
  });

  it('refuses an empty or absurdly long name', () => {
    expect(isScriptFileName('')).toBe(false);
    expect(isScriptFileName(`${'a'.repeat(200)}.js`)).toBe(false);
  });
});

describe('saveUserscript', () => {
  it('writes the file and reports ok', () => {
    expect(saveUserscript(dir, 'hello.js', 'alert(1)')).toBe('ok');
    expect(readFileSync(join(dir, 'hello.js'), 'utf8')).toBe('alert(1)');
  });

  it('creates the folder if it is not there yet', () => {
    const fresh = join(dir, 'deeper');
    expect(saveUserscript(fresh, 'hello.js', 'x')).toBe('ok');
    expect(existsSync(join(fresh, 'hello.js'))).toBe(true);
  });

  it('replaces a file of the same name, because that is what a newer copy is', () => {
    saveUserscript(dir, 'hello.js', 'old');
    expect(saveUserscript(dir, 'hello.js', 'new')).toBe('ok');
    expect(readFileSync(join(dir, 'hello.js'), 'utf8')).toBe('new');
  });

  it('refuses a bad name without writing anything', () => {
    expect(saveUserscript(dir, '../escape.js', 'x')).toBe('name');
    expect(existsSync(join(dir, '..', 'escape.js'))).toBe(false);
  });

  it('refuses a file past the size cap', () => {
    expect(saveUserscript(dir, 'huge.js', 'a'.repeat(3 * 1024 * 1024))).toBe('size');
    expect(existsSync(join(dir, 'huge.js'))).toBe(false);
  });
});

describe('listUserscripts', () => {
  it('is empty for a missing folder', () => {
    expect(listUserscripts(join(dir, 'nope'))).toEqual([]);
  });

  it('reports the name, the size and the title from the metadata block', () => {
    const body = '// @name  Auto Reload\nconsole.log(1)';
    write('named.js', body);
    expect(listUserscripts(dir)).toEqual([
      { name: 'named.js', title: 'Auto Reload', bytes: body.length },
    ]);
  });

  it('falls back to the filename when there is no @name', () => {
    write('plain.js', 'console.log(1)');
    expect(listUserscripts(dir)[0]?.title).toBe('plain.js');
  });

  it('lists only .js, sorted', () => {
    write('b.js', '');
    write('a.js', '');
    write('notes.txt', 'hello');
    expect(listUserscripts(dir).map((s) => s.name)).toEqual(['a.js', 'b.js']);
  });

  it('agrees with the loader about what is there', () => {
    write('one.js', '// @name One\n');
    write('two.js', '');
    expect(listUserscripts(dir).map((s) => s.name)).toEqual(
      loadUserscripts(dir).map((s) => s.name),
    );
  });
});

describe('removeUserscript', () => {
  it('deletes the file', () => {
    write('gone.js', 'x');
    expect(removeUserscript(dir, 'gone.js')).toBe(true);
    expect(existsSync(join(dir, 'gone.js'))).toBe(false);
  });

  it('is false rather than throwing for a file that is not there', () => {
    expect(removeUserscript(dir, 'ghost.js')).toBe(false);
  });

  it('refuses a name that could reach outside the folder', () => {
    // The folder it is allowed to touch is one level down, so "../" in the
    // name would land on a file it has no business deleting.
    const scripts = join(dir, 'scripts');
    mkdirSync(scripts);
    const outside = join(dir, 'outside.js');
    writeFileSync(outside, 'x');

    expect(removeUserscript(scripts, '../outside.js')).toBe(false);
    expect(existsSync(outside)).toBe(true);
  });
});
