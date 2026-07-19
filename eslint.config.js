import eslint from '@eslint/js';
import stylistic from '@stylistic/eslint-plugin';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';

const codeStyle = stylistic.configs.customize({
  arrowParens: true,
  braceStyle: '1tbs',
  indent: 2,
  jsx: true,
  quotes: 'single',
  semi: true,
});

export default tseslint.config(
  {
    ignores: ['coverage/**', 'dist/**'],
  },
  {
    linterOptions: {
      reportUnusedDisableDirectives: 'error',
    },
  },
  {
    extends: [eslint.configs.recommended, codeStyle],
    files: ['**/*.{js,mjs,cjs}'],
    languageOptions: {
      ecmaVersion: 'latest',
      globals: globals.node,
    },
  },
  {
    extends: [
      eslint.configs.recommended,
      ...tseslint.configs.strictTypeChecked,
      ...tseslint.configs.stylisticTypeChecked,
      codeStyle,
    ],
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 'latest',
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    files: ['vite.config.ts'],
    languageOptions: {
      globals: globals.node,
    },
  },
  {
    extends: [reactHooks.configs.flat['recommended-latest']],
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: {
      globals: globals.browser,
    },
  },
  {
    extends: [jsxA11y.flatConfigs.recommended, reactRefresh.configs.vite],
    files: ['src/**/*.tsx'],
    languageOptions: {
      globals: globals.browser,
    },
  },
);
