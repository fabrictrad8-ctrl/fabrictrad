import path from 'node:path';
import { fileURLToPath } from 'node:url';
import js from '@eslint/js';
import { FlatCompat } from '@eslint/eslintrc';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const compat = new FlatCompat({
  baseDirectory: __dirname,
  recommendedConfig: js.configs.recommended,
});

const config = [
  {
    ignores: [
      '.next/**',
      '.open-next/**',
      'out/**',
      'build/**',
      'coverage/**',
      'public/**',
      'next-env.d.ts',
    ],
  },
  ...compat.extends('next/core-web-vitals', 'plugin:@typescript-eslint/recommended'),
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/no-require-imports': 'off',
      'no-console': ['warn', { allow: ['warn', 'error', 'info'] }],
      'react/no-unescaped-entities': 'off',
    },
  },
];

export default config;
