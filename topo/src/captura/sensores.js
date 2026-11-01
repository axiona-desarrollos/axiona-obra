/* ==========================================================================
   AXIONA TOPO · Sensores de inclinacion
   --------------------------------------------------------------------------
   El evento deviceorientation trae beta (inclinacion adelante-atras) y
   gamma (de lado), ya fusionados por el celular con el giroscopio. Se
   suavizan y se mira si el pulso esta quieto: una lectura solo vale cuando
   la desviacion del ultimo segundo baja de 0,15°.
   Cada celular trae un pequeño error de fabrica en la inclinacion (error de
   indice): la calibracion por inversion lo mide y se descuenta siempre.
   En iPhone hay que pedir permiso con un toque del usuario.
   ========================================================================== */

import { elevacionCamara } from '../motor/mira.js';

const S = { on: false, b: null, g: null, hist: [], oyentes: new Set(), cal: { b: 0, g: 0, e: 0 } };
const CLAVE = 'axiona-topo-calibracion';

try {
  const c = JSON.parse(localStorage.getItem(CLAVE) || 'null');
  if (c && Number.isFinite(c.b) && Number.isFinite(c.g)) S.cal = { b: c.b, g: c.g, e: Number.isFinite(c.e) ? c.e : 0 };
} catch { /* sin almacenamiento */ }

export async function pedirPermisoSensores() {
  const DOE = typeof window !== 'undefined' ? window.DeviceOrientationEvent : null;
  if (!DOE) return false;
  if (typeof DOE.requestPermission === 'function') {
    try { return (await DOE.requestPermission()) === 'granted'; } catch { return false; }
  }
  return true;
}

function alGirar(e) {
  if (e.beta == null || e.gamma == null) return;
  const a = 0.25;
  S.b = S.b === null ? e.beta : S.b + a * (e.beta - S.b);
  S.g = S.g === null ? e.gamma : S.g + a * (e.gamma - S.g);
  const t = performance.now(), cruda = elevacionCamara(S.b, S.g), elev = cruda - S.cal.e;
  S.hist.push({ t, elev, b: S.b, g: S.g });
  while (S.hist.length && t - S.hist[0].t > 1000) S.hist.shift();
  const n = S.hist.length, m = S.hist.reduce((s, h) => s + h.elev, 0) / n;
  const sd = Math.sqrt(S.hist.reduce((s, h) => s + (h.elev - m) ** 2, 0) / Math.max(1, n - 1));
  const dato = { beta: S.b - S.cal.b, gamma: S.g - S.cal.g, betaCruda: S.b, gammaCruda: S.g, elev, elevCruda: cruda, elevMedia: m, sd, estable: n >= 6 && sd < 0.15 };
  for (const f of S.oyentes) f(dato);
}

export function escucharSensores(f) {
  S.oyentes.add(f);
  if (!S.on) { window.addEventListener('deviceorientation', alGirar); S.on = true; }
  return () => {
    S.oyentes.delete(f);
    if (!S.oyentes.size && S.on) { window.removeEventListener('deviceorientation', alGirar); S.on = false; S.b = S.g = null; S.hist = []; }
  };
}

/** Ceros del nivel (b, g) y error de indice de la mira (e), en grados. */
export function guardarCalibracion({ b = S.cal.b, g = S.cal.g, e = S.cal.e } = {}) {
  S.cal = { b, g, e };
  try { localStorage.setItem(CLAVE, JSON.stringify(S.cal)); } catch { /* sin almacenamiento */ }
}
export const calibracion = () => S.cal;
