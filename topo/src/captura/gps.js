/* ==========================================================================
   AXIONA TOPO · GPS del celular
   --------------------------------------------------------------------------
   Se deja el GPS encendido mientras se recorre el lote (asi se "asienta" y
   mejora). En cada esquina se juntan lecturas unos segundos con el celular
   quieto y se promedian (ver promediarGPS). Precision tipica a cielo
   abierto: 2 a 5 m; bajo arboles o junto a muros, peor.
   ========================================================================== */

import { promediarGPS } from '../motor/geo.js';

const G = { id: null, ultima: null, error: null, oyentes: new Set(), cancelar: false };

export const gpsDisponible = () => typeof navigator !== 'undefined' && 'geolocation' in navigator;
export const ultimaLectura = () => G.ultima;

export function encenderGPS() {
  if (G.id !== null || !gpsDisponible()) return;
  G.id = navigator.geolocation.watchPosition(pos => {
    const c = pos.coords;
    G.ultima = { lat: c.latitude, lon: c.longitude, acc: c.accuracy, alt: c.altitude, altAcc: c.altitudeAccuracy, t: pos.timestamp || Date.now() };
    G.error = null;
    for (const f of G.oyentes) f(G.ultima, null);
  }, e => {
    G.error = e;
    for (const f of G.oyentes) f(null, e);
  }, { enableHighAccuracy: true, maximumAge: 0, timeout: 30000 });
}

export function apagarGPS() {
  if (G.id !== null) navigator.geolocation.clearWatch(G.id);
  G.id = null; G.ultima = null;
}

export function escucharGPS(f) {
  G.oyentes.add(f);
  return () => G.oyentes.delete(f);
}

export const cancelarFijado = () => { G.cancelar = true; };

export const mensajeError = e => (e?.code === 1
  ? 'El celular no dio permiso de ubicación. Actívelo para este sitio en el navegador.'
  : e?.code === 3 ? 'El GPS no respondió a tiempo. Salga a cielo abierto y espere unos segundos.'
    : 'No hay señal de GPS. Salga a cielo abierto, lejos de muros y techos.');

/**
 * Junta lecturas durante `segundos` (minimo 5 lecturas) y devuelve el
 * promedio robusto. Si la señal es mala (precision peor que 5 m) sigue
 * promediando hasta 30 s, porque mas lecturas si bajan el error; el tope
 * es 45 s. alAvance recibe { s, total, n, acc, extendido }.
 */
export function fijarPunto(segundos = 12, alAvance = () => {}) {
  G.cancelar = false;
  return new Promise((ok, falla) => {
    const lect = [], t0 = Date.now();
    const quitar = escucharGPS(l => { if (l) lect.push(l); });
    if (G.ultima && Date.now() - G.ultima.t < 1500) lect.push(G.ultima);
    const mediana = a => { const o = [...a].sort((p, q) => p - q); return o.length ? o[o.length >> 1] : Infinity; };
    const tic = setInterval(() => {
      const s = (Date.now() - t0) / 1000, acc = mediana(lect.map(l => l.acc));
      const extendido = s >= segundos && acc > 5 && s < 30;
      alAvance({ s, total: extendido ? 30 : segundos, n: lect.length, acc: G.ultima?.acc ?? null, extendido });
      const listo = (s >= segundos && lect.length >= 5 && (acc <= 5 || s >= 30)) || s >= 45;
      if (!G.cancelar && !listo) return;
      clearInterval(tic); quitar();
      if (G.cancelar) return falla(new Error('cancelado'));
      const r = promediarGPS(lect);
      if (r) ok(r); else falla(new Error(mensajeError(G.error)));
    }, 250);
  });
}
