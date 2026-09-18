import { readFileSync } from 'node:fs';
import { builtinModules } from 'node:module';
import { resolve } from 'node:path';
import { defineConfig } from 'vite';

/**
 * The patched Electron build this app is being built against, from the stamp
 * scripts/fetch-electron.mjs leaves beside it. Baked into main so the updater
 * can tell an update it can swap in without the installer from one that
 * brings a new runtime. See src/shared/lite-update.ts.
 */
function runtimePin(): string {
  try {
    const stamp = JSON.parse(
      readFileSync(resolve(__dirname, 'node_modules/electron/.patched-build.json'), 'utf8'),
    ) as { sha256?: unknown };
    return typeof stamp.sha256 === 'string' ? stamp.sha256 : 'unknown';
  } catch {
    return 'unknown';
  }
}

// Both bare and `node:`-prefixed forms have to be externalised.
const nodeBuiltins = builtinModules.flatMap((m) => [m, `node:${m}`]);

export default defineConfig(({ mode }) => {
  const isProd = mode !== 'development';
  return {
    build: {
      lib: {
        entry: resolve(__dirname, 'src/main/index.ts'),
        formats: ['cjs'],
        fileName: () => 'index.js',
      },
      outDir: 'dist/main',
      emptyOutDir: true,
      // original-fs is Electron's untouched fs, which only exists at runtime.
      rollupOptions: { external: ['electron', 'original-fs', ...nodeBuiltins] },
      target: 'node22',
      minify: isProd,
      sourcemap: !isProd,
    },
    define: { __NM_RUNTIME__: JSON.stringify(runtimePin()) },
    resolve: {
      // Node build, so don't swap builtins for browser shims.
      conditions: ['node'],
      mainFields: ['module', 'main'],
    },
  };
});
