/* ==========================================================================
   AXIONA TOPO · Modelo del terreno (TIN)
   --------------------------------------------------------------------------
   Con los puntos medidos (x, y, cota) se arma una red de triangulos de
   Delaunay: ningun punto cae dentro del circulo de un triangulo ajeno, asi
   los triangulos salen lo mas "gordos" posible y el terreno no inventa
   crestas. Sobre esa red:
     - la cota de cualquier punto (interpolacion lineal en su triangulo),
     - las curvas de nivel (cada triangulo corta un nivel en un segmento),
     - la pendiente y hacia donde escurre el agua (gradiente del plano),
     - el perfil por cualquier linea.
   Es el mismo metodo de los programas de topografia.
   ========================================================================== */

import Delaunator from 'delaunator';
import { dentro, azimut, grados } from './poligono.js';

/** Triangulos de Delaunay de [{x, y}]: indices [a, b, c] en sentido antihorario.
    Lo hace Delaunator (el de d3), que usa predicados geometricos exactos:
    no pierde triangulos delgados junto al borde ni se enreda con puntos
    alineados, cosa que una version casera si hace. */
export function delaunay(puntos) {
  if (puntos.length < 3) return [];
  let d;
  try { d = Delaunator.from(puntos, p => p.x, p => p.y); } catch { return []; }
  const out = [];
  for (let i = 0; i < d.triangles.length; i += 3) {
    const a = d.triangles[i];
    let b = d.triangles[i + 1], c = d.triangles[i + 2];
    const A = puntos[a], B = puntos[b], C = puntos[c];
    const o = (B.x - A.x) * (C.y - A.y) - (B.y - A.y) * (C.x - A.x);
    if (Math.abs(o) <= 1e-9) continue;
    if (o < 0) [b, c] = [c, b];
    out.push([a, b, c]);
  }
  return out;
}

/** Puntos repetidos (a menos de 1 mm) se quedan con el primero. */
function sinRepetidos(puntos) {
  const vistos = new Set(), out = [];
  for (const p of puntos) {
    const k = `${Math.round(p.x * 1000)},${Math.round(p.y * 1000)}`;
    if (!vistos.has(k)) { vistos.add(k); out.push(p); }
  }
  return out;
}

/**
 * Red de triangulos del terreno. puntos: [{x, y, z}]. Si se da el lindero,
 * se quitan los triangulos cuyo centro cae fuera (lotes con entrantes).
 */
export function armarTIN(puntos, lindero = null) {
  const P = sinRepetidos(puntos.filter(p => Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(p.z)));
  let T = delaunay(P);
  if (lindero && lindero.length >= 3) {
    T = T.filter(([a, b, c]) => dentro((P[a].x + P[b].x + P[c].x) / 3, (P[a].y + P[b].y + P[c].y) / 3, lindero));
  }
  return { puntos: P, triangulos: T };
}

/** Cota en (x, y) por interpolacion lineal en su triangulo; null si cae fuera. */
export function cotaEn(T, x, y) {
  const P = T.puntos;
  for (const [a, b, c] of T.triangulos) {
    const A = P[a], B = P[b], C = P[c];
    const den = (B.y - C.y) * (A.x - C.x) + (C.x - B.x) * (A.y - C.y);
    if (Math.abs(den) < 1e-12) continue;
    const l1 = ((B.y - C.y) * (x - C.x) + (C.x - B.x) * (y - C.y)) / den;
    const l2 = ((C.y - A.y) * (x - C.x) + (A.x - C.x) * (y - C.y)) / den;
    const l3 = 1 - l1 - l2;
    if (l1 >= -1e-9 && l2 >= -1e-9 && l3 >= -1e-9) return l1 * A.z + l2 * B.z + l3 * C.z;
  }
  return null;
}

/** Une segmentos sueltos en polilineas (por extremos a menos de 1 mm). */
export function unirSegmentos(segs) {
  const k = p => `${Math.round(p.x * 1000)},${Math.round(p.y * 1000)}`;
  const porPunto = new Map();
  segs.forEach((s, i) => s.forEach((p, e) => {
    const c = k(p);
    if (!porPunto.has(c)) porPunto.set(c, []);
    porPunto.get(c).push([i, e]);
  }));
  const usado = new Array(segs.length).fill(false), lineas = [];
  const seguir = (linea, alFinal) => {
    for (;;) {
      const extremo = alFinal ? linea[linea.length - 1] : linea[0];
      const sig = (porPunto.get(k(extremo)) || []).find(([i]) => !usado[i]);
      if (!sig) return;
      const [i, e] = sig;
      usado[i] = true;
      const otro = segs[i][1 - e];
      if (alFinal) linea.push(otro); else linea.unshift(otro);
    }
  };
  segs.forEach((s, i) => {
    if (usado[i]) return;
    usado[i] = true;
    const linea = [s[0], s[1]];
    seguir(linea, true);
    seguir(linea, false);
    lineas.push(linea);
  });
  return lineas;
}

/** Curvas de nivel cada `intervalo` metros; una de cada `mayorCada` es curva mayor. */
export function curvasDeNivel(T, intervalo, { mayorCada = 5, maxCurvas = 400 } = {}) {
  const P = T.puntos;
  if (!(intervalo > 0) || !T.triangulos.length) return [];
  let zmin = Infinity, zmax = -Infinity;
  for (const p of P) { zmin = Math.min(zmin, p.z); zmax = Math.max(zmax, p.z); }
  const k0 = Math.ceil(zmin / intervalo - 1e-9), k1 = Math.floor(zmax / intervalo + 1e-9);
  if (k1 - k0 + 1 > maxCurvas) return [];
  const out = [];
  for (let k = k0; k <= k1; k++) {
    const L = k * intervalo, segs = [];
    for (const [a, b, c] of T.triangulos) {
      const corte = [];
      for (const [p, q] of [[P[a], P[b]], [P[b], P[c]], [P[c], P[a]]]) {
        const zp = p.z - L, zq = q.z - L;
        if ((zp >= 0) !== (zq >= 0)) { const t = zp / (zp - zq); corte.push({ x: p.x + t * (q.x - p.x), y: p.y + t * (q.y - p.y) }); }
      }
      if (corte.length === 2 && Math.hypot(corte[1].x - corte[0].x, corte[1].y - corte[0].y) > 1e-6) segs.push(corte);
    }
    if (segs.length) out.push({ z: +L.toFixed(6), mayor: k % mayorCada === 0, lineas: unirSegmentos(segs) });
  }
  return out;
}

/** Plano z = a·x + b·y + c que pasa por un triangulo. */
export function planoDe(A, B, C) {
  const ux = B.x - A.x, uy = B.y - A.y, uz = B.z - A.z, vx = C.x - A.x, vy = C.y - A.y, vz = C.z - A.z;
  const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
  if (Math.abs(nz) < 1e-12) return null;
  const a = -nx / nz, b = -ny / nz;
  return { a, b, c: A.z - a * A.x - b * A.y };
}

/** Clase de pendiente del terreno, en porcentaje. */
export function clasePendiente(pct) {
  if (pct < 3) return 'Plana';
  if (pct < 7) return 'Ligeramente inclinada';
  if (pct < 12) return 'Moderadamente inclinada';
  if (pct < 25) return 'Fuertemente inclinada';
  if (pct < 50) return 'Ligeramente escarpada';
  if (pct < 75) return 'Moderadamente escarpada';
  return 'Fuertemente escarpada';
}

/**
 * Pendientes por triangulo y del lote: media ponderada por area, la fuerte
 * (el 95 % del area esta por debajo; asi un triangulo delgado del borde no
 * la dispara) y hacia donde baja el agua (azimut). La del lote es la del
 * plano promedio de todos los triangulos.
 */
export function pendientes(T) {
  const P = T.puntos, porTriangulo = [];
  let sa = 0, sp = 0, max = 0, sgx = 0, sgy = 0;
  for (const [a, b, c] of T.triangulos) {
    const pl = planoDe(P[a], P[b], P[c]);
    const A = Math.abs((P[b].x - P[a].x) * (P[c].y - P[a].y) - (P[b].y - P[a].y) * (P[c].x - P[a].x)) / 2;
    if (!pl || A < 1e-9) { porTriangulo.push(null); continue; }
    const g = Math.hypot(pl.a, pl.b), pct = 100 * g;
    porTriangulo.push({ pct, grados: grados(Math.atan(g)), baja: g > 1e-9 ? azimut(-pl.a, -pl.b) : null, area: A });
    sa += A; sp += A * pct; max = Math.max(max, pct); sgx += A * pl.a; sgy += A * pl.b;
  }
  const orden = porTriangulo.filter(Boolean).sort((p, q) => p.pct - q.pct);
  let acum = 0, fuerte = 0;
  for (const t of orden) { acum += t.area; fuerte = t.pct; if (acum >= 0.95 * sa) break; }
  const gx = sa ? sgx / sa : 0, gy = sa ? sgy / sa : 0, g = Math.hypot(gx, gy);
  const general = 100 * g;
  return {
    media: sa ? sp / sa : 0,
    maxima: max,
    fuerte,
    general,
    gradosGeneral: grados(Math.atan(g)),
    baja: g > 1e-9 ? azimut(-gx, -gy) : null,
    clase: clasePendiente(general),
    porTriangulo,
  };
}

/** Perfil del terreno de A a B: [{ d, z }] con z = null fuera del modelo. */
export function perfil(T, A, B, n = 120) {
  const L = Math.hypot(B.x - A.x, B.y - A.y), out = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    out.push({ d: t * L, z: cotaEn(T, A.x + t * (B.x - A.x), A.y + t * (B.y - A.y)) });
  }
  return out;
}
