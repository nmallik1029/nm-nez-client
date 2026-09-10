import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['dist/', 'out/', 'node_modules/', 'coverage/'],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // `any` quietly switches off the type checking we're paying for. If a
      // value really is unknown, say `unknown` and narrow it.
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      // Floating promises in the main process turn into silent no-ops.
      '@typescript-eslint/no-floating-promises': 'error',
      eqeqeq: ['error', 'always', { null: 'ignore' }],
      'no-console': 'off',
    },
  },
  {
    // Plain-JS tooling that runs under Node before the app exists: config
    // files and build scripts. None of it is in a tsconfig project, so
    // type-aware rules have no program to work from and the parser errors out
    // instead of linting.
    files: ['*.config.ts', '*.config.mjs', 'scripts/**/*.mjs'],
    ...tseslint.configs.disableTypeChecked,
    languageOptions: {
      // Spread, don't replace. disableTypeChecked puts the parser options that
      // turn off the type-aware program in here, and losing those brings back
      // the "not found by the project service" parse error.
      ...tseslint.configs.disableTypeChecked.languageOptions,
      // Written out by hand rather than pulling in the `globals` package,
      // which is only here as a transitive dep of eslint anyway. Six names
      // aren't worth a direct dependency in a project that has none.
      globals: {
        Buffer: 'readonly',
        TransformStream: 'readonly',
        URL: 'readonly',
        console: 'readonly',
        fetch: 'readonly',
        process: 'readonly',
      },
    },
  },
  {
    // The built-in userscripts. These are imported for their text and run in
    // the page through `new Function`, so they are not modules and not in a
    // tsconfig project — the type-aware parser has no program for them and
    // errors out instead of linting.
    //
    // Still linted, just without types: they are the one place in the repo
    // where a typo survives the build, since nothing compiles them.
    files: ['src/preload/scripts/**/*.js'],
    ...tseslint.configs.disableTypeChecked,
    languageOptions: {
      ...tseslint.configs.disableTypeChecked.languageOptions,
      // A function body, not a module: `new Function` is what wraps it, and
      // that is also why a top-level `return` is legal here.
      sourceType: 'script',
      // Merged, not replaced. Writing parserOptions out wholesale drops the
      // ones disableTypeChecked sets and the project-service parse error
      // comes straight back.
      parserOptions: {
        ...tseslint.configs.disableTypeChecked.languageOptions?.parserOptions,
        projectService: false,
        project: false,
        ecmaFeatures: { globalReturn: true },
      },
      globals: {
        MutationObserver: 'readonly',
        clearInterval: 'readonly',
        document: 'readonly',
        setInterval: 'readonly',
        window: 'readonly',
      },
    },
  },
);
