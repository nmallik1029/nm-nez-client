import { builtinModules } from 'node:module';
import { resolve } from 'node:path';
import { defineConfig } from 'vite';

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
      rollupOptions: { external: ['electron', ...nodeBuiltins] },
      target: 'node22',
      minify: isProd,
      sourcemap: !isProd,
    },
    resolve: {
      // Node build, so don't swap builtins for browser shims.
      conditions: ['node'],
      mainFields: ['module', 'main'],
    },
  };
});
