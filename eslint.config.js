const navegador = {
  window: 'readonly', document: 'readonly', navigator: 'readonly', location: 'readonly', history: 'readonly',
  localStorage: 'readonly', requestAnimationFrame: 'readonly', addEventListener: 'readonly', devicePixelRatio: 'readonly',
  setTimeout: 'readonly', clearTimeout: 'readonly', console: 'readonly', URL: 'readonly', Blob: 'readonly', Response: 'readonly',
  FileReader: 'readonly', ResizeObserver: 'readonly', CompressionStream: 'readonly', DecompressionStream: 'readonly',
  TextEncoder: 'readonly', TextDecoder: 'readonly', btoa: 'readonly', atob: 'readonly', prompt: 'readonly', performance: 'readonly',
  confirm: 'readonly', fetch: 'readonly', SpeechSynthesisUtterance: 'readonly', speechSynthesis: 'readonly', cancelAnimationFrame: 'readonly', removeEventListener: 'readonly',
  setInterval: 'readonly', clearInterval: 'readonly',
  crypto: 'readonly', matchMedia: 'readonly', EventSource: 'readonly', FormData: 'readonly', URLSearchParams: 'readonly', self: 'readonly', Worker: 'readonly',
};
export default [
  {
    files: ['src/**/*.js', 'tests/**/*.js', 'topo/src/**/*.js', 'topo/tests/**/*.js'],
    languageOptions: { ecmaVersion: 2023, sourceType: 'module', globals: navegador },
    rules: {
      'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      'no-undef': 'error',
      'prefer-const': 'warn',
      eqeqeq: ['warn', 'smart'],
    },
  },
];
