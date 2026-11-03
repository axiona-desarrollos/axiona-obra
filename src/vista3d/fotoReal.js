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
import { texturasListas } from './materiales.js';

/**
 * three-gpu-pathtracer numera los materiales de a uno por malla: una malla con varios materiales
 * (los muros: cara interior y fachada) corre la numeración y los colores salen cruzados.
 * Por eso, solo para la foto, cada malla de varios materiales se parte en una malla por grupo.
 * Devuelve cómo deshacerlo.
 */
function separarMateriales(scene) {
  const lista = [];
  scene.traverseVisible(o => { if (o.isMesh && Array.isArray(o.material)) lista.push(o); });
  const extra = new THREE.Group();
  scene.updateMatrixWorld(true);
  for (const o of lista) {
    const g = o.geometry;
    const total = g.index ? g.index.count : g.attributes.position.count;
    const grupos = g.groups.length ? g.groups : [{ start: 0, count: total, materialIndex: 0 }];
    for (const gr of grupos) {
      const m = o.material[gr.materialIndex];
      if (!m || m.visible === false) continue;
      const fin = Math.min(gr.start + gr.count, total);
      const idx = new Uint32Array(Math.max(0, fin - gr.start));
      for (let i = gr.start; i < fin; i++) idx[i - gr.start] = g.index ? g.index.getX(i) : i;
      const sub = new THREE.BufferGeometry();
      for (const [k, a] of Object.entries(g.attributes)) sub.setAttribute(k, a);
      sub.setIndex(new THREE.BufferAttribute(idx, 1));
      const parte = new THREE.Mesh(sub, m);
      parte.matrixAutoUpdate = false;
      parte.matrix.copy(o.matrixWorld);
      extra.add(parte);
    }
    o.visible = false;
  }
  scene.add(extra);
  scene.updateMatrixWorld(true);
  return () => { scene.remove(extra); lista.forEach(o => { o.visible = true; }); };
}

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
  // de noche: cielo casi negro y las luces de la casa, los postes y la piscina hacen el trabajo
  const noche = !!scene.userData.noche;
  const cielo = new GradientEquirectTexture(256);
  cielo.topColor.set(noche ? 0x070d1f : 0xa9c9e8);
  cielo.bottomColor.set(noche ? 0x1a1d2a : 0xf3efe6);
  cielo.exponent = 1.3;
  cielo.update();
  if (noche) r.toneMappingExposure = 1.5;
  await texturasListas(8000);
  const antes = { env: scene.environment, fondo: scene.background, niebla: scene.fog, intensidad: scene.environmentIntensity };
  // de día, el cielo de verdad (HDR): da la luz del sol, las nubes y los reflejos; el sol de la escena se apaga para no duplicarlo
  const hdr = !noche && scene.userData.hdrDia;
  scene.environment = hdr || cielo; scene.background = hdr || cielo; scene.fog = null; scene.environmentIntensity = noche ? 0.25 : 1;
  const soles = [];
  if (hdr) scene.traverse(o => { if (o.isDirectionalLight) { soles.push([o, o.intensity]); o.intensity = 0; } });
  const juntar = separarMateriales(scene);
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
    juntar();
    cielo.dispose();
    Object.assign(scene, { environment: antes.env, background: antes.fondo, fog: antes.niebla, environmentIntensity: antes.intensidad });
    soles.forEach(([o, i]) => { o.intensity = i; });
    r.dispose();
    r.forceContextLoss();
  }
}
