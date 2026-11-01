/* ==========================================================================
   AXIONA AR · Trabajador de visión
   --------------------------------------------------------------------------
   Corre el detector fuera del hilo de la pantalla: recibe el cuadro de la
   cámara en RGBA (buffer transferido, sin copias) y devuelve los marcadores
   con lo que tardó, para que la app ajuste la resolución al celular.
   ========================================================================== */

import { gris, detectar } from './detector.js';

let g = null;
self.onmessage = e => {
  const { buf, w, h, n } = e.data;
  const t0 = performance.now();
  if (!g || g.length !== w * h) g = new Uint8Array(w * h);
  gris(new Uint8ClampedArray(buf), w, h, g);
  const marcadores = detectar(g, w, h);
  self.postMessage({ n, w, h, marcadores, ms: performance.now() - t0 });
};
