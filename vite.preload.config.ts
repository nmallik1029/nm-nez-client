import { builtinModules } from 'node:module';
import { resolve } from 'node:path';
import { defineConfig } from 'vite';

const nodeBuiltins = builtinModules.flatMap((m) => [m, `node:${m}`]);

export default defineConfig(({ mode }) => {
  const isProd = mode !== 'development';
  return {
    build: {
      lib: {
        entry: resolve(__dirname, 'src/preload/index.ts'),
        formats: ['cjs'],
        fileName: () => 'index.js',
      },
      outDir: 'dist/preload',
      emptyOutDir: true,
      rollupOptions: { external: ['electron', ...nodeBuiltins] },
      target: 'node22',
      minify: isProd,
      sourcemap: !isProd,
    },
  };
});
