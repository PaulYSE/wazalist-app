import js from '@eslint/js';
import globals from 'globals';
import { importX } from 'eslint-plugin-import-x';
import tsdoc from 'eslint-plugin-tsdoc';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';

export default [
  // ── 0. Global ignores ───────────────────────────────────────
  {
    ignores: [
      'node_modules/**',
      'dist/**',
      'docs/**',
      '.wrangler/**',
      '**/*.min.js',
      'worker-configuration.d.ts',
    ],
  },

  // ── 1. Base JS recommended ─────────────────────────────────
  js.configs.recommended,

  // ── 2. import-x recommended ────────────────────────────────
  importX.flatConfigs.recommended,

  // ── 3. Frontend: public/js (plain JS) ──────────────────────
  {
    files: ['public/js/**/*.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ExcelJS: 'readonly',
        XLSX: 'readonly',
      },
    },
    rules: {
      // FIX 2: TS unused-vars rule must NOT fire on JS files
      '@typescript-eslint/no-unused-vars': 'off',
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    },
  },

  // ── 4. Node config files (vite.config.js, etc.) ────────────
  {
    files: ['vite.config.js', '*.config.js', '*.config.ts'],
    languageOptions: {
      globals: { ...globals.node },
    },
  },

  // ── 5. TS recommended rules, scoped to .ts only ────────────
  ...tseslint.configs.recommended.map((c) => ({
    ...c,
    files: ['**/*.ts'],
  })),

  // ── 6. Backend TS specifics ────────────────────────────────
  {
    files: ['src/**/*.ts'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: { ...globals.worker },
    },
    settings: {
      // FIX 1: this is what makes import-x/no-unresolved work
      'import-x/resolver': {
        typescript: {
          project: './tsconfig.json',
          alwaysTryTypes: true,
        },
      },
    },
    plugins: {
      // Plugin registration only — rule config below
      tsdoc,
    },
    rules: {
      // FIX 5: disable TSDoc syntax check while migrating comments
      'tsdoc/syntax': 'warn',
      // FIX 6: underscore-prefixed vars allowed (args + assigned vars)
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
    },
  },

  // ── 7. Prettier must be LAST ───────────────────────────────
  prettier,
];
