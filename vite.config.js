import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import { configDefaults } from 'vitest/config';

// Anclado a esta carpeta: asi da igual desde donde se lance el servidor.
const AQUI = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  root: AQUI,
  base: './',
  server: { port: 8160, open: false },
  build: {
    target: 'es2022',
    outDir: 'dist',
    rollupOptions: { output: { manualChunks: { three: ['three'] } } },
  },
  // Axiona Topo (topo/) se prueba con sus propias dependencias: cd topo && npm test
  test: { exclude: [...configDefaults.exclude, 'topo/**'] },
});
