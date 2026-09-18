import { readdirSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  extraRoots,
  extraUpToDate,
  isSafeResourcePath,
  liteVerdict,
  parseLiteManifest,
  releaseAssetUrl,
  type LiteFile,
} from './lite-update';

/**
 * A manifest decides which files the client overwrites in its own install
 * folder, so what these check hardest is refusal: every way a manifest could
 * point a write somewhere else, or claim a file it cannot vouch for.
 */

const HASH = `${'A'.repeat(86)}==`;
const OTHER = `${'B'.repeat(86)}==`;

const good = () => ({
  version: '0.1.55',
  runtime: '02ec5c8b',
  asar: { name: 'NM-NZ-0.1.55.asar', size: 1_474_088, sha512: HASH },
  extra: {
    name: 'NM-NZ-0.1.55-extra.asar',
    size: 37_000_000,
    sha512: HASH,
    files: [
      { path: 'killstreak/champs-2021/champs-2021_1.mp3', size: 152_685, sha512: HASH },
      { path: 'killstreak/champs-2021/pack.json', size: 23, sha512: OTHER },
    ],
  },
});

describe('parseLiteManifest', () => {
  it('reads what a release publishes', () => {
    const m = parseLiteManifest(good());
    expect(m?.version).toBe('0.1.55');
    expect(m?.extra?.files).toHaveLength(2);
  });

  it('takes a release with nothing beside app.asar', () => {
    expect(parseLiteManifest({ ...good(), extra: null })?.extra).toBeNull();
  });

  it('refuses anything that is not a manifest', () => {
    for (const v of [null, 'x', 1, [], {}]) expect(parseLiteManifest(v)).toBeNull();
  });

  it('refuses a version that is not a plain release number', () => {
    expect(parseLiteManifest({ ...good(), version: '0.1.55-beta' })).toBeNull();
  });

  it('refuses a missing runtime pin', () => {
    expect(parseLiteManifest({ ...good(), runtime: '' })).toBeNull();
  });

  it('refuses a hash that is not a SHA-512', () => {
    expect(parseLiteManifest({ ...good(), asar: { ...good().asar, sha512: 'abc' } })).toBeNull();
  });

  it('refuses an asset name that could be a path', () => {
    for (const name of ['../app.asar', 'a/b.asar', 'a\\b.asar', '']) {
      expect(parseLiteManifest({ ...good(), asar: { ...good().asar, name } })).toBeNull();
    }
  });

  it('refuses a negative or fractional size', () => {
    expect(parseLiteManifest({ ...good(), asar: { ...good().asar, size: -1 } })).toBeNull();
    expect(parseLiteManifest({ ...good(), asar: { ...good().asar, size: 1.5 } })).toBeNull();
  });

  it('refuses the whole manifest over one bad file', () => {
    const m = good();
    m.extra.files.push({ path: '../../evil.dll', size: 1, sha512: HASH });
    expect(parseLiteManifest(m)).toBeNull();
  });

  it('refuses the same file listed twice, whatever its case', () => {
    const m = good();
    m.extra.files.push({ path: 'KILLSTREAK/champs-2021/pack.json', size: 23, sha512: OTHER });
    expect(parseLiteManifest(m)).toBeNull();
  });
});

describe('isSafeResourcePath', () => {
  it('takes a file inside a folder under resources', () => {
    expect(isSafeResourcePath('killstreak/champs-2021/champs-2021_1.mp3')).toBe(true);
    expect(isSafeResourcePath('killstreak/arcane-collector-s-set/pack.json')).toBe(true);
  });

  it('never takes a top level file: app.asar and the installer’s own live there', () => {
    expect(isSafeResourcePath('app.asar')).toBe(false);
    expect(isSafeResourcePath('elevate.exe')).toBe(false);
  });

  it('never climbs out', () => {
    for (const p of ['../x/y', 'killstreak/../../x', 'killstreak/./x', 'a/../b']) {
      expect(isSafeResourcePath(p)).toBe(false);
    }
  });

  it('never takes an absolute path, a drive, or a backslash', () => {
    for (const p of ['/etc/x', 'C:/Windows/x', 'C:\\x\\y', 'killstreak\\a\\b', '//server/share']) {
      expect(isSafeResourcePath(p)).toBe(false);
    }
  });

  it('never takes a name Windows would quietly trim', () => {
    expect(isSafeResourcePath('killstreak/pack./x')).toBe(false);
  });
});

describe('liteVerdict', () => {
  const m = parseLiteManifest(good())!;

  it('takes the update on the same runtime', () => {
    expect(liteVerdict(m, { version: '0.1.55', runtime: '02ec5c8b' })).toEqual({ lite: true });
  });

  it('sends a new runtime to the installer', () => {
    expect(liteVerdict(m, { version: '0.1.55', runtime: 'ffff' }).lite).toBe(false);
  });

  it('sends a build that cannot read its own pin to the installer', () => {
    expect(liteVerdict({ ...m, runtime: 'unknown' }, { version: '0.1.55', runtime: 'unknown' }).lite).toBe(false);
  });

  it('refuses a manifest for some other version', () => {
    expect(liteVerdict(m, { version: '0.1.56', runtime: '02ec5c8b' }).lite).toBe(false);
  });
});

describe('extraRoots', () => {
  it('names each folder once', () => {
    const files: LiteFile[] = [
      { path: 'killstreak/a/1.mp3', size: 1, sha512: HASH },
      { path: 'killstreak/b/1.mp3', size: 1, sha512: HASH },
      { path: 'badges/x.png', size: 1, sha512: HASH },
    ];
    expect(extraRoots(files)).toEqual(['badges', 'killstreak']);
  });
});

describe('extraUpToDate', () => {
  const files = parseLiteManifest(good())!.extra!.files;
  const exact = new Map(files.map((f) => [f.path, f.sha512]));

  it('is up to date when every file matches and nothing else is there', () => {
    expect(extraUpToDate(files, exact)).toBe(true);
  });

  it('is not when a file differs', () => {
    const changed = new Map(exact);
    changed.set(files[0]!.path, OTHER);
    expect(extraUpToDate(files, changed)).toBe(false);
  });

  it('is not when a file could not be read', () => {
    const unread = new Map<string, string | null>(exact);
    unread.set(files[0]!.path, null);
    expect(extraUpToDate(files, unread)).toBe(false);
  });

  it('is not when one is missing', () => {
    expect(extraUpToDate(files, new Map([[files[0]!.path, files[0]!.sha512]]))).toBe(false);
  });

  it('is not when there is a file the release does not ship', () => {
    const extra = new Map(exact);
    extra.set('killstreak/old-pack/old_1.mp3', HASH);
    expect(extraUpToDate(files, extra)).toBe(false);
  });
});

describe('releaseAssetUrl', () => {
  it('points at the tag’s download', () => {
    expect(releaseAssetUrl({ owner: 'o', repo: 'r' }, '0.1.55', 'lite.json')).toBe(
      'https://github.com/o/r/releases/download/v0.1.55/lite.json',
    );
  });
});

describe('what the release actually ships', () => {
  // resources/<folder> in the install is assets/<folder> in the repo, per
  // extraResources in electron-builder.yml.
  const assets = join(import.meta.dirname, '..', '..', 'assets');

  function files(dir: string): string[] {
    return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
      e.isDirectory() ? files(join(dir, e.name)) : [relative(assets, join(dir, e.name)).split(sep).join('/')],
    );
  }

  it('has a path a manifest can carry for every kill streak file', () => {
    // One file that fails this makes the client refuse the whole manifest,
    // which quietly sends every update back to the installer.
    const shipped = files(join(assets, 'killstreak'));
    expect(shipped.length).toBeGreaterThan(0);
    expect(shipped.filter((p) => !isSafeResourcePath(p))).toEqual([]);
  });
});
