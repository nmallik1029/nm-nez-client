/**
 * The publishing half of updating without the installer.
 *
 * Run after electron-builder, from the repo root. Reads the packaged app out
 * of out/win-unpacked/resources and writes out/lite/:
 *
 *   lite.json                what the client reads first
 *   NM-NZ-<v>.asar           resources/app.asar, as shipped in the installer
 *   NM-NZ-<v>-extra.asar     every folder beside it, packed into one archive
 *                            the client reads through Electron's own asar
 *                            support. None ship since the kill streak packs
 *                            stopped, so for now there is no such file and the
 *                            manifest says `extra: null`.
 *
 * The release workflow uploads the three next to the installer. Why any of
 * this exists, and what the client does with it, is in
 * src/shared/lite-update.ts; the manifest's shape and every rule it has to
 * pass live there too.
 *
 * Exits non-zero on anything missing rather than publishing a manifest that
 * would send every client back to the installer.
 */
import { createHash } from 'node:crypto';
import { cpSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
// Arrives with electron-builder, which packs app.asar with the same library.
import { createPackage } from '@electron/asar';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const RESOURCES = join(ROOT, 'out', 'win-unpacked', 'resources');
const OUT = join(ROOT, 'out', 'lite');
const STAGE = join(ROOT, 'out', 'lite-stage');
/** productName in electron-builder.yml, which the installer's own name starts with. */
const PRODUCT = 'NM-NZ';

function fail(message) {
  console.error(`lite-release: ${message}`);
  process.exit(1);
}

const sha512 = (data) => createHash('sha512').update(data).digest('base64');

function describe(path, name) {
  const data = readFileSync(path);
  return { name, size: data.length, sha512: sha512(data) };
}

/** Every file under `dir`, relative to resources, with forward slashes. */
function walk(dir, into) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walk(full, into);
    else into.push(relative(RESOURCES, full).split(sep).join('/'));
  }
  return into;
}

const { version } = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));

// The pin the client compares against its own. Written by
// scripts/fetch-electron.mjs, and read by vite.main.config.ts from the same
// file, so the app and its manifest cannot disagree about the build.
let runtime;
try {
  runtime = JSON.parse(readFileSync(join(ROOT, 'node_modules', 'electron', '.patched-build.json'), 'utf8')).sha256;
} catch {
  // Handled just below.
}
if (typeof runtime !== 'string' || runtime === '') {
  fail('no patched Electron stamp; clients would all fall back to the installer');
}

rmSync(OUT, { recursive: true, force: true });
rmSync(STAGE, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

let appAsar;
try {
  appAsar = readFileSync(join(RESOURCES, 'app.asar'));
} catch {
  fail(`no app.asar in ${RESOURCES}; run electron-builder first`);
}
const asarName = `${PRODUCT}-${version}.asar`;
writeFileSync(join(OUT, asarName), appAsar);
const asar = { name: asarName, size: appAsar.length, sha512: sha512(appAsar) };

// Folders only. The files at the top of resources are app.asar and the
// installer's own (app-update.yml, elevate.exe), none of which are this
// archive's to replace.
const folders = readdirSync(RESOURCES, { withFileTypes: true })
  .filter((e) => e.isDirectory())
  .map((e) => e.name)
  .sort();

let extra = null;
if (folders.length > 0) {
  const paths = folders.flatMap((f) => walk(join(RESOURCES, f), [])).sort();
  const files = paths.map((path) => {
    const data = readFileSync(join(RESOURCES, ...path.split('/')));
    return { path, size: data.length, sha512: sha512(data) };
  });

  for (const folder of folders) cpSync(join(RESOURCES, folder), join(STAGE, folder), { recursive: true });
  const extraName = `${PRODUCT}-${version}-extra.asar`;
  await createPackage(STAGE, join(OUT, extraName));
  rmSync(STAGE, { recursive: true, force: true });

  extra = { ...describe(join(OUT, extraName), extraName), files };
}

const manifest = { version, runtime, asar, extra };
writeFileSync(join(OUT, 'lite.json'), `${JSON.stringify(manifest, null, 1)}\n`);

const mb = (n) => `${(n / 1024 / 1024).toFixed(1)}MB`;
console.log(`lite-release: ${version} on runtime ${runtime.slice(0, 12)}`);
console.log(`  ${asar.name}  ${mb(asar.size)}`);
if (extra) console.log(`  ${extra.name}  ${mb(extra.size)}, ${extra.files.length} files in ${folders.join(', ')}`);
