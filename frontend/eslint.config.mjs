import js from '@eslint/js';
import solid from 'eslint-plugin-solid';
import prettier from 'eslint-plugin-prettier';
import prettierConfig from 'eslint-config-prettier';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import globals from 'globals';

export default [
  js.configs.recommended,
  prettierConfig,
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaFeatures: { jsx: true },
        ecmaVersion: 'latest',
        sourceType: 'module',
      },
      globals: {
        ...globals.browser,
        echarts: 'readonly',
        ec: 'readonly',
      },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
      solid,
      prettier,
    },
    rules: {
      ...tsPlugin.configs.recommended.rules,
      ...solid.configs.recommended.rules,
      ...prettier.configs.recommended.rules,
      'prettier/prettier': ['error', { singleQuote: true, semi: true, printWidth: 100 }],
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' }],
      '@typescript-eslint/ban-ts-comment': 'warn',
      'no-empty': 'warn',
      '@typescript-eslint/no-unused-expressions': 'warn',
      'solid/prefer-for': 'warn',
      '@typescript-eslint/no-explicit-any': 'warn',
      'solid/reactivity': 'warn',
      'solid/no-unknown-events': 'off',
    },
  },
  {
    ignores: ['dist/**', 'node_modules/**', 'test-results/**', '*.js'],
  },
];
