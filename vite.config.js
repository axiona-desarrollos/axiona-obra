import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

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
});
