import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

// Anclado a esta carpeta: Axiona Topo se compila y se publica aparte de Axiona Obra.
const AQUI = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  root: AQUI,
  base: './',
  server: { port: 8161, open: false },
  build: {
    target: 'es2022',
    outDir: 'dist',
    rollupOptions: { output: { manualChunks: { three: ['three'] } } },
  },
  test: { include: ['tests/**/*.test.js'] },
});
