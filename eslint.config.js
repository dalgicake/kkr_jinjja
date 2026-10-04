import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';

// relative paths only, so packages like 'react-dom/server' stay allowed
const SERVER_PATH = '^(\\.{1,2}/)+(server|api)(/|$)';
const SERVER_MESSAGE =
  'src/ and shared/ must not import server/ or api/ (server keys stay on the server).';

const SERVER_ONLY = { patterns: [{ regex: SERVER_PATH, message: SERVER_MESSAGE }] };

// no-restricted-imports only sees static import/export-from, so also block `import('../server/x')`.
const NO_DYNAMIC_SERVER_IMPORT = [
  {
    selector: `ImportExpression[source.value=/${SERVER_PATH.replaceAll('/', '\\/')}/]`,
    message: SERVER_MESSAGE,
  },
  {
    // template literals like import(`../server/${name}`)
    selector: `ImportExpression > TemplateLiteral.source > TemplateElement:first-child[value.raw=/${SERVER_PATH.replaceAll('/', '\\/')}/]`,
    message: SERVER_MESSAGE,
  },
];

const NO_PROCESS_ENV = [
  {
    selector: "MemberExpression[object.name='process'][property.name='env']",
    message: 'process.env is server-only. Use import.meta.env.VITE_* in src/.',
  },
];

export default tseslint.config(
  { ignores: ['dist', 'node_modules', 'reference', 'coverage'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['src/**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks },
    languageOptions: { globals: globals.browser },
    rules: { ...reactHooks.configs.recommended.rules },
  },
  {
    files: ['src/**/*.{ts,tsx}', 'shared/**/*.ts'],
    rules: {
      'no-restricted-imports': ['error', SERVER_ONLY],
      'no-restricted-syntax': ['error', ...NO_PROCESS_ENV, ...NO_DYNAMIC_SERVER_IMPORT],
      'no-restricted-globals': ['error', { name: 'process', message: 'process is server-only.' }],
    },
  },
  {
    files: [
      'api/**/*.ts',
      'server/**/*.ts',
      'scripts/**/*.{js,mjs,ts}',
      'tests/**/*.ts',
      '*.config.{js,ts}',
    ],
    languageOptions: { globals: globals.node },
  },
);
