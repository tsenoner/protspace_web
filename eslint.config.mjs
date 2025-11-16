import tsParser from '@typescript-eslint/parser';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import prettier from 'eslint-config-prettier';

export default [
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**',
      '**/*.d.ts',
      '**/.turbo/**',
      '**/.storybook/**',
    ],
  },
  {
    files: ['packages/**/*.{ts,tsx}', 'examples/**/*.{ts,tsx}', 'docs/**/*.{ts,tsx}', '*.mjs'],
    languageOptions: {
      parser: tsParser,
      ecmaVersion: 'latest',
      sourceType: 'module',
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
    },
    rules: {
      semi: ['error', 'always'],
      quotes: ['error', 'single', { avoidEscape: true }],
      'object-curly-spacing': ['error', 'always'],
      'array-bracket-spacing': ['error', 'never'],
      'comma-dangle': ['error', 'always-multiline'],
      'no-multiple-empty-lines': ['error', { max: 1, maxEOF: 1 }],
      'eol-last': ['error', 'always'],
      'arrow-parens': ['error', 'always'],
      'space-before-function-paren': ['error', 'never'],
      'no-trailing-spaces': ['error'],
      'key-spacing': ['error', { beforeColon: false, afterColon: true }],
      'keyword-spacing': ['error', { before: true, after: true }],

      '@typescript-eslint/consistent-type-imports': ['error'],
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    },
  },
  prettier,
];
