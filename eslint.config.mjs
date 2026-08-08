import js from '@eslint/js';
import jsdoc from 'eslint-plugin-jsdoc';
import lit from 'eslint-plugin-lit';
import wc from 'eslint-plugin-wc';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      'rollup.config.mjs',
      'eslint.config.mjs',
      'src/lib/schema.generated.ts',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  lit.configs['flat/recommended'],
  wc.configs['flat/recommended'],
  {
    files: ['src/**/*.ts'],
    plugins: { jsdoc },
    languageOptions: {
      globals: {
        ...globals.browser,
      },
      parserOptions: {
        project: './tsconfig.json',
        tsconfigRootDir: import.meta.dirname,
      },
    },
    settings: {
      jsdoc: { mode: 'typescript' },
    },
    rules: {
      // Home Assistant's `hass` object is untyped in many places; allow `any`
      // deliberately rather than littering the code with casts.
      '@typescript-eslint/no-explicit-any': 'off',

      // Require a JSDoc block before every function, method, and class, on
      // every type/interface/enum, and on every interface property. The
      // property rule is scoped to interface bodies so it does not fire on
      // inline object types (which cannot carry doc comments). Class-field
      // arrow handlers are covered explicitly.
      'jsdoc/require-jsdoc': [
        'error',
        {
          require: {
            FunctionDeclaration: true,
            MethodDefinition: true,
            ClassDeclaration: true,
          },
          contexts: [
            'TSInterfaceDeclaration',
            'TSTypeAliasDeclaration',
            'TSEnumDeclaration',
            'TSInterfaceBody > TSPropertySignature',
            'PropertyDefinition > ArrowFunctionExpression',
          ],
          enableFixer: false,
        },
      ],
      // Every JSDoc block must carry an actual description, not just tags.
      'jsdoc/require-description': ['error', { contexts: ['any'] }],
      // Reject empty /** */ blocks that would satisfy require-jsdoc trivially.
      'jsdoc/no-blank-blocks': 'error',
    },
  },
  {
    // Browser render tests run under Mocha (web-test-runner) and use chai's
    // property-style assertions (`expect(x).to.exist`), which read as unused
    // expressions.
    files: ['src/**/*.browser.test.ts'],
    languageOptions: {
      globals: {
        ...globals.mocha,
      },
    },
    rules: {
      'no-unused-expressions': 'off',
      '@typescript-eslint/no-unused-expressions': 'off',
    },
  },
);
