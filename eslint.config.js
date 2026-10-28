const navegador = {
  window: 'readonly', document: 'readonly', navigator: 'readonly', location: 'readonly', history: 'readonly',
  localStorage: 'readonly', requestAnimationFrame: 'readonly', addEventListener: 'readonly', devicePixelRatio: 'readonly',
  setTimeout: 'readonly', clearTimeout: 'readonly', console: 'readonly', URL: 'readonly', Blob: 'readonly', Response: 'readonly',
  FileReader: 'readonly', ResizeObserver: 'readonly', CompressionStream: 'readonly', DecompressionStream: 'readonly',
  TextEncoder: 'readonly', TextDecoder: 'readonly', btoa: 'readonly', atob: 'readonly', prompt: 'readonly', performance: 'readonly',
};
export default [
  {
    files: ['src/**/*.js', 'tests/**/*.js'],
    languageOptions: { ecmaVersion: 2023, sourceType: 'module', globals: navegador },
    rules: {
      'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      'no-undef': 'error',
      'prefer-const': 'warn',
      eqeqeq: ['warn', 'smart'],
    },
  },
];
