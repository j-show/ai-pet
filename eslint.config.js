import jshowConfig from 'eslint-config-jshow';

const prettierConfigs = await jshowConfig.prettier(process.cwd());

export default [
  ...jshowConfig.node,
  ...prettierConfigs,
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
      'no-restricted-globals': 'off',
      'no-use-before-define': 'off'
    }
  }
];
