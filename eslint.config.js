import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import jshowConfig from 'eslint-config-jshow';

const prettierConfigs = await jshowConfig.prettier(
  dirname(fileURLToPath(import.meta.url))
);

export default [
  ...jshowConfig.vue,
  ...prettierConfigs,
  {
    languageOptions: {
      globals: {
        ...jshowConfig.globals.node,
        ...jshowConfig.globals.vue
      }
    }
  },
  {
    ignores: [
      '**/dist/**',
      '**/dist-ssr/**',
      '**/node_modules/**',
      '**/build/**',
      '**/coverage/**',
      '**/target/**',
      '**/*.d.ts'
    ]
  },
  {
    files: ['**/*.{mjs,js,cjs}'],
    rules: {
      'no-console': 'off',
      'no-use-before-define': 'off'
    }
  }
];
