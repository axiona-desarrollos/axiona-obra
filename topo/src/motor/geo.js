/* ==========================================================================
   AXIONA TOPO · Coordenadas
   --------------------------------------------------------------------------
   El GPS entrega latitud y longitud sobre el elipsoide WGS84. Para medir en
   metros todo pasa a un plano local ENU (este, norte, arriba) con origen en
   el primer punto: geodesicas -> ECEF -> giro al plano tangente del origen.
   A la escala de un lote (menos de 2 km) esa conversion se equivoca en
   milimetros; el error que manda es el del GPS del celular (2 a 5 m).
   ========================================================================== */

const A = 6378137;
const F = 1 / 298.257223563;
const E2 = F * (2 - F);
const rad = d => d * Math.PI / 180;
const grad = r => r * 180 / Math.PI;

/** Geodesicas -> coordenadas cartesianas centradas en la Tierra (ECEF). */
export function aECEF(lat, lon, h = 0) {
  const p = rad(lat), l = rad(lon), s = Math.sin(p);
  const N = A / Math.sqrt(1 - E2 * s * s);
  return [(N + h) * Math.cos(p) * Math.cos(l), (N + h) * Math.cos(p) * Math.sin(l), (N * (1 - E2) + h) * s];
}

/** Lat/lon -> metros al este (x), al norte (y) y arriba (u) del origen. */
export function aLocal(lat, lon, origen, h = 0) {
  const [x0, y0, z0] = aECEF(origen.lat, origen.lon, origen.h || 0);
  const [x, y, z] = aECEF(lat, lon, h);
  const dx = x - x0, dy = y - y0, dz = z - z0;
  const p = rad(origen.lat), l = rad(origen.lon);
  const sp = Math.sin(p), cp = Math.cos(p), sl = Math.sin(l), cl = Math.cos(l);
  return {
    x: -sl * dx + cl * dy,
    y: -sp * cl * dx - sp * sl * dy + cp * dz,
    u: cp * cl * dx + cp * sl * dy + sp * dz,
  };
}

/** Metros locales -> lat/lon. Arranca con los radios de curvatura y corrige
    dos veces contra aLocal, asi ida y vuelta cuadran al milimetro. */
export function aGeo(x, y, origen) {
  const p = rad(origen.lat), s = Math.sin(p), w = 1 - E2 * s * s;
  const RM = A * (1 - E2) / Math.pow(w, 1.5), RN = A / Math.sqrt(w);
  let lat = origen.lat + grad(y / RM), lon = origen.lon + grad(x / (RN * Math.cos(p)));
  for (let k = 0; k < 2; k++) {
    const q = aLocal(lat, lon, origen);
    lat += grad((y - q.y) / RM);
    lon += grad((x - q.x) / (RN * Math.cos(p)));
  }
  return { lat, lon };
}

const mediana = a => {
  const s = [...a].sort((p, q) => p - q), m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

/**
 * Promedio robusto de las lecturas del GPS tomadas quieto sobre un punto.
 * lecturas: [{ lat, lon, acc, alt?, altAcc?, t }] (acc y altAcc en metros, t en ms).
 *   1. Se descartan las de precision peor que maxAcc, si queda alguna buena.
 *   2. Se quitan los saltos: lecturas a mas de 3 desviaciones robustas de la
 *      mediana (con un piso del tamaño de la precision, asi tambien se
 *      limpian los saltos de una antena RTK, que son de centimetros).
 *   3. Media ponderada por 1/acc².
 * La precision que se informa es honesta: lecturas seguidas del GPS no son
 * independientes (el error cambia despacio), asi que solo cuenta una lectura
 * nueva cada 15 s, ademas de la dispersion que se vio. Con el GPS del
 * celular nunca baja de 0,5 m; con una antena RTK (precision reportada de
 * 10 cm o menos) baja hasta 1 cm, y entonces la altura tambien sirve.
 */
export function promediarGPS(lecturas, { maxAcc = 30 } = {}) {
  let L = (lecturas || []).filter(r => Number.isFinite(r.lat) && Number.isFinite(r.lon) && Number.isFinite(r.acc) && r.acc > 0);
  if (!L.length) return null;
  const buenas = L.filter(r => r.acc <= maxAcc);
  if (buenas.length) L = buenas;
  const o = { lat: L[0].lat, lon: L[0].lon };
  const P = L.map(r => ({ ...r, ...aLocal(r.lat, r.lon, o) }));
  const mx = mediana(P.map(p => p.x)), my = mediana(P.map(p => p.y));
  const d = P.map(p => Math.hypot(p.x - mx, p.y - my));
  const pisoSalto = Math.min(1, Math.max(0.03, mediana(P.map(p => p.acc))));
  const lim = Math.max(3 * 1.4826 * mediana(d), pisoSalto);
  const Q = P.filter((_, i) => d[i] <= lim);
  let sw = 0, sx = 0, sy = 0, swa = 0, sa = 0;
  for (const p of Q) {
    const w = 1 / (p.acc * p.acc);
    sw += w; sx += w * p.x; sy += w * p.y;
    if (Number.isFinite(p.alt)) { const wa = 1 / Math.max(0.01, Number.isFinite(p.altAcc) && p.altAcc > 0 ? p.altAcc : 10) ** 2; swa += wa; sa += wa * p.alt; }
  }
  const x = sx / sw, y = sy / sw;
  const g = aGeo(x, y, o);
  const T = Math.max(0, ((Q[Q.length - 1].t ?? 0) - (Q[0].t ?? 0)) / 1000);
  const accQ = mediana(Q.map(p => p.acc));
  const rtk = accQ <= 0.1;
  const piso = rtk ? 0.01 : accQ < 0.5 ? 0.05 : 0.5;
  const disp = Math.sqrt(Q.reduce((s, p) => s + (p.x - x) ** 2 + (p.y - y) ** 2, 0) / Math.max(1, Q.length - 1));
  const prec = Math.max(piso, accQ / Math.sqrt(1 + T / 15), disp / Math.sqrt(Q.length));
  const conAlt = Q.filter(p => Number.isFinite(p.alt) && Number.isFinite(p.altAcc) && p.altAcc > 0);
  const altPrec = conAlt.length ? Math.max(rtk ? 0.01 : 0.5, mediana(conAlt.map(p => p.altAcc)) / Math.sqrt(1 + T / 15)) : null;
  return { lat: g.lat, lon: g.lon, alt: swa ? sa / swa : null, altPrec, prec, rtk, n: Q.length, descartadas: lecturas.length - Q.length, segundos: T };
}
