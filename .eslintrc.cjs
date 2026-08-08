module.exports = {
  root: true,
  env: { browser: true, es2020: true },
  extends: [
    'eslint:recommended',
    'plugin:react/recommended',
    'plugin:react/jsx-runtime',
    'plugin:react-hooks/recommended',
  ],
  // NOTE: `server` is intentionally NOT ignored any more. It used to be, which
  // is exactly why an incomplete refactor could leave 28 undefined references
  // (getAuthUser, callLLM, getGroqClient, …) shipping to production: ESLint
  // never looked at the backend. `eslint:recommended` enables `no-undef`, so
  // linting the server now fails CI on any use-before-import.
  ignorePatterns: ['dist', '.eslintrc.cjs'],
  parserOptions: { ecmaVersion: 'latest', sourceType: 'module' },
  settings: { react: { version: '18.2' } },
  plugins: ['react-refresh'],
  rules: {
    // Advisory HMR-only hint; not a correctness issue. Off so CI (--max-warnings 0) stays green.
    'react-refresh/only-export-components': 'off',
    'react/prop-types': 'off',
    // Cosmetic in JSX text (apostrophes/quotes render fine in React). Disabling
    // avoids noisy escaping like &apos; throughout user-facing copy.
    'react/no-unescaped-entities': 'off',
    // Allow intentionally-empty catch blocks (used for best-effort operations).
    'no-empty': ['error', { allowEmptyCatch: true }],
    // Unused function args are fine if prefixed with _ (e.g. event handlers).
    'no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
  },
  overrides: [
    {
      // Backend runs on Node (not the browser): give it Node globals so
      // no-undef validates imports without flagging process/Buffer/fetch/etc.
      files: ['server/**/*.js'],
      env: { node: true, browser: false, es2022: true },
      parserOptions: { ecmaVersion: 2022, sourceType: 'module' },
      // React plugins don't apply to backend files.
      extends: ['eslint:recommended'],
      rules: {
        'no-empty': ['error', { allowEmptyCatch: true }],
        'no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      },
    },
  ],
}
