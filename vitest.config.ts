import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      // The real electron package resolves to the path of electron.exe and
      // throws when the binary is absent, so importing any module that imports
      // electron would fail a whole test file on a runner with no binary. See
      // src/test/electron.ts.
      electron: fileURLToPath(new URL('./src/test/electron.ts', import.meta.url)),
      // Electron's untouched fs only exists inside Electron. Outside it, plain
      // fs is exactly what original-fs is.
      'original-fs': 'node:fs',
    },
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
