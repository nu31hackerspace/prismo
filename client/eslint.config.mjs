import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist/**'] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended, reactHooks.configs['recommended-latest'], reactRefresh.configs.vite],
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.browser,
    },
    rules: {
      // Some TC39 accessor-decorator signatures (src/store/models/relations.ts)
      // must declare params TS's decorator-arity check requires but the body
      // never reads — `_`-prefixed is the standard way to mark that on purpose.
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
);
