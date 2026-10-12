// Reglas de estilo y calidad del código. Se ejecutan con `npm run lint` (y en el CI).
// La idea: que cualquier persona pueda leer el código sin ayuda. Por eso hay límites de
// tamaño y de complejidad, y nombres que se explican solos.
import js from '@eslint/js';
import globals from 'globals';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import prettier from 'eslint-config-prettier';

/** Reglas de legibilidad que valen para TODO el código. */
const readabilityRules = {
  // Nombres: nada de una sola letra (salvo `_` para lo que no se usa).
  'id-length': ['error', { min: 2, exceptions: ['_'], properties: 'never' }],
  camelcase: ['error', { properties: 'never' }],

  // Funciones pequeñas y simples. Si una función supera estos límites, hay que dividirla.
  complexity: ['error', 12],
  'max-depth': ['error', 4],
  'max-params': ['error', 4],
  'max-nested-callbacks': ['error', 3],
  'max-lines-per-function': ['error', { max: 70, skipBlankLines: true, skipComments: true }],
  'max-lines': ['error', { max: 300, skipBlankLines: true, skipComments: true }],

  // Menos trampas.
  eqeqeq: ['error', 'always'],
  'no-var': 'error',
  'prefer-const': 'error',
  'no-shadow': 'error',
  'no-nested-ternary': 'error',
  'no-param-reassign': ['error', { props: false }],
  'no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', ignoreRestSiblings: true }],
  'no-console': ['error', { allow: ['warn', 'error', 'log'] }],
};

export default [
  { ignores: ['**/dist/**', '**/node_modules/**', 'tests/fixtures/**', '.tmp_old/**'] },
  js.configs.recommended,

  // La app del teléfono (navegador + React).
  {
    files: ['web/src/**/*.{js,jsx}', 'shared/**/*.js'],
    languageOptions: { globals: { ...globals.browser }, parserOptions: { ecmaFeatures: { jsx: true } } },
    plugins: { react, 'react-hooks': reactHooks },
    settings: { react: { version: '18' } },
    rules: {
      ...react.configs.recommended.rules,
      ...react.configs['jsx-runtime'].rules,
      ...reactHooks.configs.recommended.rules,
      'react/prop-types': 'off', // los componentes se documentan con JSDoc, no con PropTypes
      'react/no-danger': 'off', // solo se usa para dibujar los íconos SVG propios (ver Icon.jsx)
    },
  },

  // El service worker.
  { files: ['web/public/sw.js'], languageOptions: { globals: { ...globals.serviceworker } } },

  // El servidor, las pruebas y los scripts (Node).
  {
    files: ['server/**/*.js', 'tests/**/*.{js,jsx}', 'scripts/**/*.mjs', 'vite.config.js', 'eslint.config.js'],
    languageOptions: { globals: { ...globals.node } },
  },
  // Las pruebas de la interfaz también usan el navegador simulado.
  {
    files: ['tests/presentation/**/*.{js,jsx}', 'tests/infrastructure/**/*.js'],
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    plugins: { react },
    rules: { 'react/jsx-uses-vars': 'error' }, // para que usar <App /> cuente como usar App
  },

  {
    files: ['web/src/**/*.{js,jsx}', 'server/src/**/*.js', 'shared/**/*.js', 'scripts/**/*.mjs'],
    rules: readabilityRules,
  },

  // Las pruebas pueden ser más largas: cada una cuenta una historia completa.
  {
    files: ['tests/**/*.{js,jsx}'],
    rules: {
      'id-length': ['error', { min: 2, exceptions: ['_'], properties: 'never' }],
      'no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'no-shadow': 'error',
      eqeqeq: ['error', 'always'],
    },
  },

  prettier, // al final: desactiva las reglas de estilo que ya cubre Prettier
];
