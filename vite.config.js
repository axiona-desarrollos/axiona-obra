import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import { configDefaults } from 'vitest/config';

// Anclado a esta carpeta: asi da igual desde donde se lance el servidor.
const AQUI = fileURLToPath(new URL('.', import.meta.url));

/**
 * Mundo del render WebGPU: el visor usa three 0.170 y el render con trazado de rayos usa three 0.186
 * (three-r186 + three-gpu-pathtracer-r27 + three-mesh-bvh-r9). Todo lo que se importa desde ese mundo
 * resuelve «three», «three-mesh-bvh» y «three-gpu-pathtracer» a sus versiones nuevas; el resto de la app
 * no se toca. El modelo pasa de un mundo al otro como GLB.
 */
const MUNDO_RENDER = /node_modules[\\/](three-r186|three-gpu-pathtracer-r27|three-mesh-bvh-r9)[\\/]|src[\\/]vista3d[\\/]renderWebGPU\.js/;
function mundoRender() {
  const cambios = [['three-gpu-pathtracer', 'three-gpu-pathtracer-r27'], ['three-mesh-bvh', 'three-mesh-bvh-r9'], ['three', 'three-r186']];
  return {
    name: 'axiona-mundo-render',
    enforce: 'pre',
    async resolveId(fuente, importador, opciones) {
      if (!importador || !MUNDO_RENDER.test(importador)) return null;
      for (const [viejo, nuevo] of cambios) {
        if (fuente === viejo || fuente.startsWith(viejo + '/')) return this.resolve(nuevo + fuente.slice(viejo.length), importador, { ...opciones, skipSelf: true });
      }
      return null;
    },
    // el filtro de ruido (OIDN) entrega la imagen con alfa 0 y el resultado limpio salía transparente:
    // se fija alfa 1 al copiar su salida (three-gpu-pathtracer 0.0.27, versión fijada)
    transform(code, id) {
      if (!/three-gpu-pathtracer-r27[\\/]src[\\/]webgpu[\\/]denoise[\\/]OIDNDenoiser\.js/.test(id)) return null;
      const viejo = 'textureStore( dst, gid.xy, src[ gid.y * dims.x + gid.x ] );';
      if (!code.includes(viejo)) { this.warn('OIDNDenoiser: no se encontró la copia de salida para fijar el alfa'); return null; }
      return { code: code.replace(viejo, 'textureStore( dst, gid.xy, vec4f( src[ gid.y * dims.x + gid.x ].rgb, 1.0 ) );'), map: null };
    },
  };
}

export default defineConfig({
  root: AQUI,
  base: './',
  server: { port: 8160, open: false },
  plugins: [mundoRender()],
  // el BVH del respaldo WebGL 2 se arma en un Web Worker que también vive en el mundo del render
  worker: { format: 'es', plugins: () => [mundoRender()] },
  optimizeDeps: { exclude: ['three-r186', 'three-gpu-pathtracer-r27', 'three-mesh-bvh-r9'] },
  build: {
    target: 'es2022',
    outDir: 'dist',
    rollupOptions: { output: { manualChunks: { three: ['three'] } } },
  },
  // Axiona Topo (topo/) se prueba con sus propias dependencias: cd topo && npm test
  test: { exclude: [...configDefaults.exclude, 'topo/**'] },
});
