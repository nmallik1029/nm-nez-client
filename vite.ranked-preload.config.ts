import { builtinModules } from 'node:module';
import { resolve } from 'node:path';
import { defineConfig } from 'vite';

const nodeBuiltins = builtinModules.flatMap((m) => [m, `node:${m}`]);

/**
 * Preload for the standalone ranked queue window.
 *
 * Its own config rather than a second entry in vite.preload.config.ts. Give
 * Rollup two entries and it hoists shared imports (shared/ipc.ts) into a
 * common chunk that each preload then `require`s by relative path, and a
 * sandboxed preload can't do that: Electron only polyfills `require` for a
 * short allowlist there, so the split breaks both preloads at runtime without
 * a word. Building them separately keeps each bundle self-contained.
 *
 * `emptyOutDir` is off so this doesn't wipe the sibling preload built first.
 */
export default defineConfig(({ mode }) => {
  const isProd = mode !== 'development';
  return {
    build: {
      lib: {
        entry: resolve(__dirname, 'src/preload/ranked-queue.ts'),
        formats: ['cjs'],
        fileName: () => 'ranked-queue.js',
      },
      outDir: 'dist/preload',
      emptyOutDir: false,
      rollupOptions: { external: ['electron', ...nodeBuiltins] },
      target: 'node22',
      minify: isProd,
      sourcemap: !isProd,
    },
  };
});
