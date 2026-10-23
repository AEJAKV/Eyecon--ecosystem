// npm run lint: catches real bugs, not style. It runs on every push and pull request (.github/workflows/checks.yml).
// no-undef is the rule that matters most here: a name used but never imported (like giftSerial once in lib/server.js)
// passes the build and only fails when that code runs on the live site.
import globals from 'globals';

export default [
  { ignores: ['.next/**', 'node_modules/**', 'coverage/**', 'screenshots/**', 'design-assets/**'] },
  {
    files: ['**/*.{js,mjs}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      parserOptions: { ecmaFeatures: { jsx: true } },
      globals: { ...globals.browser, ...globals.node }
    },
    rules: {
      'no-undef': 'error',
      'no-dupe-keys': 'error',
      'no-dupe-args': 'error',
      'no-duplicate-case': 'error',
      'no-unreachable': 'error',
      'no-func-assign': 'error',
      'no-import-assign': 'error',
      'no-self-assign': 'error',
      'valid-typeof': 'error'
    }
  }
];
