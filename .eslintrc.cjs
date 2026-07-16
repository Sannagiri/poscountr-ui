/**
 * ESLint configuration.
 * Enforces the naming, import-order, and React-hooks rules required by
 * docs/coding-standards.md. `npm run lint` must pass with zero warnings
 * before any change is considered done (see coding-standards.md §23).
 */
module.exports = {
  root: true,
  env: { browser: true, es2022: true, node: true },
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
    ecmaFeatures: { jsx: true },
    project: ['./tsconfig.app.json', './tsconfig.node.json'],
  },
  settings: {
    react: { version: 'detect' },
  },
  plugins: [
    '@typescript-eslint',
    'react',
    'react-hooks',
    'react-refresh',
    'jsx-a11y',
    'simple-import-sort',
  ],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react/recommended',
    'plugin:react-hooks/recommended',
    'plugin:jsx-a11y/recommended',
    'prettier',
  ],
  ignorePatterns: ['dist', 'node_modules', '*.config.js', '*.config.ts', '*.config.cjs'],
  rules: {
    'react/react-in-jsx-scope': 'off',
    'react/prop-types': 'off',
    'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    '@typescript-eslint/no-explicit-any': 'error',
    '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports' }],
    'simple-import-sort/imports': [
      'error',
      {
        groups: [
          ['^react', '^\\w'],
          ['^@/components', '^@/hooks', '^@/utils', '^@/services', '^@/styles', '^@/config'],
          ['^@/modules'],
          ['^\\.'],
        ],
      },
    ],
    'simple-import-sort/exports': 'error',
    'no-console': ['warn', { allow: ['warn', 'error'] }],
  },
};
