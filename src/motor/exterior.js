/* ==========================================================================
   AXIONA OBRA · Exteriores: piscina, parqueadero y la vía del frente
   --------------------------------------------------------------------------
   Todo en el marco del frente (el lindero del frente es y = 0 y el lote
   queda hacia y positivo). La piscina va en el patio de atrás, centrada en
   la casa, o donde el arquitecto la arrastre; el parqueadero en el
   antejardín si el retiro alcanza, si no atrás o a un lado. Si algo no cabe
   se dice por qué y qué cambiar. La vía, el andén y los postes solo se
   dibujan (son espacio público, no van al presupuesto).
   ========================================================================== */

import { r2, clamp, pip } from './geometria.js';
import { tr } from './idioma.js';

const MARGEN = 0.8;   // del borde de la piscina o del parqueadero al lindero
const PLAYA = 1.0;    // playa (deck) alrededor de la piscina
const CAJON = { w: 2.5, d: 5.0 };

export const PISCINA_DEF = { on: false, largo: 8, ancho: 4, prof: 1.5, x: null, y: null };
export const PARQUEO_DEF = { on: false, n: 2 };

const dentroDelLote = (lot, r, m = MARGEN) => [[r.x0 - m, r.y0 - m], [r.x1 + m, r.y0 - m], [r.x1 + m, r.y1 + m], [r.x0 - m, r.y1 + m]].every(([x, y]) => pip(x, y, lot));
const choca = (a, b, m = 0) => a.x0 < b.x1 + m && a.x1 > b.x0 - m && a.y0 < b.y1 + m && a.y1 > b.y0 - m;
const rect = (cx, cy, w, h) => ({ x0: r2(cx - w / 2), x1: r2(cx + w / 2), y0: r2(cy - h / 2), y1: r2(cy + h / 2), w: r2(w), h: r2(h) });

/** Huellas que la piscina y el parqueadero no pueden pisar: todos los pisos (voladizos incluidos), terrazas de primer piso y patios. */
function ocupado(M) {
  const out = M.floors.map(fl => fl.R || M.R);
  (M.compuesta?.patios || []).forEach(p => out.push(p));
  return out;
}

/** Normaliza lo que viene del estado. */
export function piscinaDe(S) {
  const p = S.piscina || {};
  return {
    on: !!p.on,
    largo: clamp(+p.largo || PISCINA_DEF.largo, 2, 25), ancho: clamp(+p.ancho || PISCINA_DEF.ancho, 1.5, 12),
    prof: clamp(+p.prof || PISCINA_DEF.prof, 0.6, 3), x: Number.isFinite(+p.x) && p.x !== null && p.x !== '' ? +p.x : null, y: Number.isFinite(+p.y) && p.y !== null && p.y !== '' ? +p.y : null,
  };
}
export function parqueoDe(S) {
  const p = S.parqueo || {};
  return { on: !!p.on, n: clamp(Math.round(+p.n || PARQUEO_DEF.n), 1, 6) };
}

/** Ubica la piscina: donde la dejó el arquitecto si cabe; si no, atrás de la casa (o girada, o corrida a un lado). */
function ubicarPiscina(M, P, libres) {
  const R = M.R, cx = (R.x0 + R.x1) / 2, fondo = Math.max(...M.lot.map(p => p.y));
  const sirve = r => dentroDelLote(M.lot, r, PLAYA) && libres.every(o => !choca(r, o, PLAYA));
  if (P.x !== null && P.y !== null) {
    const r = rect(P.x, P.y, P.largo, P.ancho);
    if (sirve(r)) return { ...r, manual: true };
  }
  const xs = [cx, cx - 1.5, cx + 1.5, cx - 3, cx + 3];
  for (const [l, a] of [[P.largo, P.ancho], [P.ancho, P.largo]]) {
    for (const y of [R.y1 + PLAYA + a / 2 + 0.3, (R.y1 + fondo) / 2]) for (const x of xs) {
      const r = rect(x, y, l, a);
      if (sirve(r)) return { ...r, girada: l !== P.largo };
    }
  }
  return null;
}

/** Cajones de parqueo: antejardín (de frente o en paralelo), atrás o a un lado. */
function ubicarParqueo(M, n, libres) {
  const R = M.R, main = M.floors[0].ops.find(o => o.kind === 'main');
  const puerta = main ? { x0: main.a - 0.6, x1: main.b + 0.6, y0: 0, y1: R.y0 } : null;
  const xs = M.lot.map(p => p.x), lx0 = Math.min(...xs), lx1 = Math.max(...xs);
  const intentos = [];
  // de frente a la calle (5 m de fondo) o en paralelo (2.5 m) en el antejardín
  if (R.y0 >= CAJON.d + 0.3) intentos.push({ w: CAJON.w, d: CAJON.d, y: R.y0 - 0.2 - CAJON.d / 2, donde: 'frente' });
  if (R.y0 >= CAJON.w + 0.3) intentos.push({ w: CAJON.d, d: CAJON.w, y: R.y0 - 0.2 - CAJON.w / 2, donde: 'paralelo' });
  const fondo = Math.max(...M.lot.map(p => p.y));
  if (fondo - R.y1 >= CAJON.d + 1) intentos.push({ w: CAJON.w, d: CAJON.d, y: fondo - 0.9 - CAJON.d / 2, donde: 'atras' });
  for (const t of intentos) {
    // de izquierda a derecha y de derecha a izquierda; se queda con la fila donde caben más
    for (const dir of [1, -1]) {
      const fila = [];
      let x = dir > 0 ? lx0 + MARGEN + t.w / 2 : lx1 - MARGEN - t.w / 2;
      for (let k = 0; k < 40 && fila.length < n; k++, x += dir * 0.25) {
        const r = rect(x, t.y, t.w, t.d);
        const ok = dentroDelLote(M.lot, r, 0.3) && libres.every(o => !choca(r, o, 0.2)) && fila.every(o => !choca(r, o, -0.01)) && !(puerta && choca(r, puerta));
        if (ok) { fila.push(r); x += dir * (t.w - 0.25); }
      }
      if (fila.length === n) return { cajones: fila, donde: t.donde };
    }
  }
  return null;
}

/** Vía, andén y bordillo frente al lindero del frente (solo para el 3D). */
function viaDelFrente(M) {
  const n = M.lot.length, a = M.lot[M.frente || 0], b = M.lot[((M.frente || 0) + 1) % n];
  const x0 = Math.min(a.x, b.x), x1 = Math.max(a.x, b.x), z = Math.min(a.z ?? 0, b.z ?? 0);
  return { x0: r2(x0 - 14), x1: r2(x1 + 14), anden: 2.0, calzada: 7.0, z: r2(z - 0.15), lote: { x0: r2(x0), x1: r2(x1) } };
}

/** Piscina, parqueadero y vía de la casa, con avisos si algo no cabe. */
export function exterior(M, S) {
  const out = { piscina: null, parqueo: null, via: viaDelFrente(M), avisos: [] };
  const libres = ocupado(M);
  const P = piscinaDe(S);
  if (P.on) {
    const r = ubicarPiscina(M, P, libres);
    if (r) {
      const espejo = r.w * r.h, per = 2 * (r.w + r.h);
      out.piscina = {
        ...r, prof: P.prof, z: M.dl,
        espejo: r2(espejo), vaso: r2(espejo + per * P.prof), exc: r2((r.w + 0.6) * (r.h + 0.6) * (P.prof + 0.3)),
        playa: r2((r.w + 2 * PLAYA) * (r.h + 2 * PLAYA) - espejo), litros: Math.round(espejo * P.prof * 1000),
      };
      libres.push({ x0: r.x0 - PLAYA, x1: r.x1 + PLAYA, y0: r.y0 - PLAYA, y1: r.y1 + PLAYA });
    } else out.avisos.push(tr({ es: 'No cabe una piscina de {l} × {a} m en el patio con 1 m de playa: reduce la medida, el retiro de atrás o el área construida.', en: 'A {l} × {a} m pool with a 1 m deck does not fit in the yard: reduce its size, the rear setback or the built area.' }, { l: P.largo, a: P.ancho }));
  }
  const Q = parqueoDe(S);
  if (Q.on) {
    const r = ubicarParqueo(M, Q.n, libres);
    if (r) out.parqueo = { ...r, area: r2(r.cajones.length * CAJON.w * CAJON.d * 1.15) };
    else out.avisos.push(tr({ es: 'No caben {n} cajones de parqueo de 2.5 × 5 m: amplía el retiro de frente a 5.3 m o usa menos cajones.', en: '{n} parking stalls of 2.5 × 5 m do not fit: increase the front setback to 5.3 m or use fewer stalls.' }, { n: Q.n }));
  }
  return out;
}

export { PLAYA };
