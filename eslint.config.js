import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import eslintConfigPrettier from 'eslint-config-prettier';

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
    },
    rules: {
      // Reglas específicas o que no cubre Prettier
      'no-console': 'off',
      'no-empty-function': 'error',
      'no-lonely-if': 'error',
      'no-var': 'error',
      'prefer-const': 'error',
      yoda: 'error',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  },
  // eslint-config-prettier deshabilita todas las reglas de ESLint que entran en conflicto con Prettier
  eslintConfigPrettier,
);
