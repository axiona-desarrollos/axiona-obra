/* ==========================================================================
   AXIONA OBRA · Foto realista con trazado de rayos
   --------------------------------------------------------------------------
   Toma la escena del 3D tal como está (fase, estilo, casa abierta) y la
   revela con three-gpu-pathtracer (MIT): luz que rebota, sombras suaves,
   reflejos y la luz de las lámparas. Corre en el propio navegador, en un
   lienzo aparte, y se carga solo cuando se pide la foto. Pensado para
   computadores; en el celular la foto sale con el render normal.
   ========================================================================== */

import * as THREE from 'three';
import { WebGLPathTracer, GradientEquirectTexture } from 'three-gpu-pathtracer';

/**
 * @param {{scene: THREE.Scene, cam: THREE.Camera, w: number, h: number, muestras?: number, maxMs?: number, alAvanzar?: (p: number) => void}} o
 * @returns {Promise<string>} la foto en JPEG (data URL)
 */
export async function fotoReal({ scene, cam, w, h, muestras = 160, maxMs = 60000, alAvanzar = () => {} }) {
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  const r = new THREE.WebGLRenderer({ canvas: cv, antialias: false, preserveDrawingBuffer: true });
  r.setPixelRatio(1);
  r.setSize(w, h, false);
  r.toneMapping = THREE.ACESFilmicToneMapping;
  r.toneMappingExposure = 1.05;
  // cielo de día: azul arriba, claro hacia el horizonte (sin descargar ningún HDRI)
  const cielo = new GradientEquirectTexture(256);
  cielo.topColor.set(0xa9c9e8);
  cielo.bottomColor.set(0xf3efe6);
  cielo.exponent = 1.3;
  cielo.update();
  const antes = { env: scene.environment, fondo: scene.background, niebla: scene.fog, intensidad: scene.environmentIntensity };
  scene.environment = cielo; scene.background = cielo; scene.fog = null; scene.environmentIntensity = 1;
  const pt = new WebGLPathTracer(r);
  pt.renderDelay = 0; pt.fadeDuration = 0; pt.minSamples = 0; pt.dynamicLowRes = false;
  pt.bounces = 5; pt.filterGlossyFactor = 0.5; pt.tiles.set(2, 2);
  try {
    // deja pintar el aviso antes de armar la escena (es síncrono: menos de un par de segundos en una casa)
    await new Promise(ok => requestAnimationFrame(() => setTimeout(ok, 0)));
    pt.setScene(scene, cam);
    const t0 = performance.now();
    while (pt.samples < muestras && performance.now() - t0 < maxMs) {
      pt.renderSample();
      alAvanzar(Math.min(1, pt.samples / muestras));
      await new Promise(ok => requestAnimationFrame(ok));
    }
    return cv.toDataURL('image/jpeg', 0.92);
  } finally {
    try { pt.dispose(); } catch { /* la librería puede fallar al cerrar si no alcanzó a armar la escena */ }
    cielo.dispose();
    Object.assign(scene, { environment: antes.env, background: antes.fondo, fog: antes.niebla, environmentIntensity: antes.intensidad });
    r.dispose();
    r.forceContextLoss();
  }
}
