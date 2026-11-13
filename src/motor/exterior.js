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

import { r2, clamp, pip, near, ivSubtract } from './geometria.js';
import { tipoEspacio } from './catalogo.js';
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
    on: !!p.on, interior: !!p.interior,
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
    // lo más cerca posible de la casa (y de la terraza), avanzando de medio en medio metro hacia el fondo
    const ys = [];
    for (let y = R.y1 + PLAYA + a / 2 + 0.3; y < fondo; y += 0.5) ys.push(y);
    for (const y of ys) for (const x of xs) {
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

/** Pérgola sobre la terraza de atrás, a lo ancho de la casa (máx. 12 m) y 4 m de fondo. */
function ubicarPergola(M, chim) {
  const R = M.R, d = 4;
  if (M.compuesta) return null;
  let x0 = R.x0 + 0.6, x1 = R.x1 - 0.6;
  // si la chimenea sale por atrás, la pérgola va al lado más ancho de ella
  if (chim?.lado === 'N') { if (chim.x0 - x0 >= x1 - chim.x1) x1 = chim.x0 - 0.3; else x0 = chim.x1 + 0.3; }
  if (x1 - x0 > 12) { const c = chim?.lado === 'N' ? (chim.x0 > (R.x0 + R.x1) / 2 ? x1 - 6 : x0 + 6) : (R.x0 + R.x1) / 2; x0 = c - 6; x1 = c + 6; }
  const w = x1 - x0;
  if (w < 3) return null;
  const r = rect((x0 + x1) / 2, R.y1 + d / 2, w, d);
  return dentroDelLote(M.lot, r, 0.5) ? { ...r, area: r2(w * d) } : null;
}

/** Chimenea en un muro exterior de la sala del primer piso, donde no haya ventana ni puerta. */
function ubicarChimenea(M) {
  const R = M.R, fl = M.floors[0], ancho = 1.6, fondo = 0.8;
  const tipo = r => r.tipo || tipoEspacio(r.name, r.zone);
  // primero la sala, después el estar
  const candidatas = fl.rects.filter(r => !r.stair && ['sala', 'estar'].includes(tipo(r))).sort((a, b) => (tipo(a) === 'sala' ? 0 : 1) - (tipo(b) === 'sala' ? 0 : 1));
  for (const sala of candidatas) {
    const lados = [
      near(sala.x0, R.x0) && { lado: 'W', o: 'V', c: R.x0, a: sala.y0, b: sala.y1 },
      near(sala.x1, R.x1) && { lado: 'E', o: 'V', c: R.x1, a: sala.y0, b: sala.y1 },
      near(sala.y1, R.y1) && { lado: 'N', o: 'H', c: R.y1, a: sala.x0, b: sala.x1 },
    ].filter(Boolean);
    for (const L of lados) {
      const ops = fl.ops.filter(o => o.o === L.o && near(o.c, L.c));
      const m = (L.a + L.b) / 2;
      for (const d of [0, -1.2, 1.2, -2.4, 2.4, -3.6, 3.6]) {
        const t0 = m + d - ancho / 2, t1 = m + d + ancho / 2;
        if (t0 < L.a + 0.3 || t1 > L.b - 0.3 || ops.some(o => o.a < t1 + 0.15 && o.b > t0 - 0.15)) continue;
        const r = L.o === 'V'
          ? { x0: L.lado === 'W' ? L.c - fondo : L.c, x1: L.lado === 'W' ? L.c : L.c + fondo, y0: t0, y1: t1 }
          : { x0: t0, x1: t1, y0: L.c, y1: L.c + fondo };
        return { ...r, lado: L.lado, o: L.o, c: L.c, t0, t1, room: sala.name };
      }
    }
  }
  // con ventanales no queda muro libre: el ventanal de la sala se corre para dejarle sitio a la chimenea
  for (const sala of candidatas) {
    const v = fl.ops.find(o => o.kind === 'win' && o.ventanal && o.room === sala.name);
    if (!v) continue;
    const lo = v.o === 'H' ? sala.x0 : sala.y0, hi = v.o === 'H' ? sala.x1 : sala.y1;
    const der = hi - v.b >= v.a - lo; // se corre hacia el lado donde ya sobra más muro
    const t0 = der ? hi - 0.3 - ancho : lo + 0.3, t1 = t0 + ancho;
    const a = der ? v.a : t1 + 0.3, b = der ? t0 - 0.3 : v.b;
    if (b - a < 1.6) continue;
    Object.assign(v, { a: r2(a), b: r2(b), w: r2(b - a) });
    fl.lines.filter(l => l.o === v.o && near(l.c, v.c)).forEach(l => { l.pieces = ivSubtract([[l.a, l.b]], fl.ops.filter(o => o.o === l.o && near(o.c, l.c) && o.b > l.a && o.a < l.b).map(o => [o.a, o.b])); });
    const lado = v.o === 'V' ? (near(v.c, R.x0) ? 'W' : 'E') : (near(v.c, R.y0) ? 'S' : 'N');
    if (lado === 'S') continue;
    const r = v.o === 'V'
      ? { x0: lado === 'W' ? v.c - fondo : v.c, x1: lado === 'W' ? v.c : v.c + fondo, y0: t0, y1: t1 }
      : { x0: t0, x1: t1, y0: v.c, y1: v.c + fondo };
    return { ...r, lado, o: v.o, c: v.c, t0, t1, room: sala.name };
  }
  return null;
}

/** Nombre del espacio que aloja la piscina interior. */
export const ESPACIO_PISCINA = { es: 'Piscina interior', en: 'Indoor pool' };
export const esEspacioPiscina = nombre => /piscina|indoor pool/i.test(String(nombre || ''));
const PLAYA_INT = 1.2; // playa mínima alrededor del vaso dentro de la casa

/** Área del espacio para una piscina de largo × ancho con 1.5 m de playa a cada lado. */
export const areaEspacioPiscina = (largo, ancho) => Math.round((largo + 3) * (ancho + 3));

/** Ubica el vaso dentro del espacio «Piscina interior» del primer piso: centrado, a lo largo del lado mayor. */
function piscinaInterior(M, P) {
  const r = (M.floors?.[0]?.rects || []).find(x => !x.stair && esEspacioPiscina(x.name));
  if (!r) return { aviso: tr({ es: 'La piscina interior necesita el espacio «Piscina interior» en el primer piso.', en: 'The indoor pool needs the “Indoor pool” room on the ground floor.' }) };
  const W = r.x1 - r.x0, H = r.y1 - r.y0, largoX = W >= H;
  const lMax = (largoX ? W : H) - 2 * PLAYA_INT, aMax = (largoX ? H : W) - 2 * PLAYA_INT;
  const L = Math.min(P.largo, lMax), A = Math.min(P.ancho, aMax);
  if (L < 2 || A < 1.5) return { aviso: tr({ es: 'El espacio «Piscina interior» es muy pequeño para el vaso: agrándalo.', en: 'The “Indoor pool” room is too small for the pool: make it larger.' }) };
  const w = largoX ? L : A, h = largoX ? A : L, cx = (r.x0 + r.x1) / 2, cy = (r.y0 + r.y1) / 2;
  const aviso = (L < P.largo - 0.01 || A < P.ancho - 0.01) ? tr({ es: 'La piscina interior se ajustó a {l} × {a} m para dejar 1.2 m de playa dentro del espacio.', en: 'The indoor pool was adjusted to {l} × {a} m to keep a 1.2 m deck inside the room.' }, { l: r2(L), a: r2(A) }) : null;
  return { r: { x0: r2(cx - w / 2), x1: r2(cx + w / 2), y0: r2(cy - h / 2), y1: r2(cy + h / 2), w: r2(w), h: r2(h) }, sala: r, aviso };
}

/** Piscina, parqueadero y vía de la casa, con avisos si algo no cabe. */
export function exterior(M, S) {
  const out = { piscina: null, parqueo: null, pergola: null, chimenea: null, via: viaDelFrente(M), avisos: [] };
  const libres = ocupado(M);
  if (S.chimenea) {
    out.chimenea = ubicarChimenea(M);
    if (out.chimenea) libres.push(out.chimenea);
    else out.avisos.push(tr({ es: 'La chimenea necesita una sala en el primer piso con un muro exterior libre de ventanas.', en: 'The fireplace needs a ground-floor living room with an exterior wall free of windows.' }));
  }
  if (S.pergola) {
    out.pergola = ubicarPergola(M, out.chimenea);
    if (out.pergola) libres.push(out.pergola);
    else out.avisos.push(tr({ es: 'No cabe la pérgola de atrás: necesita 4 m de patio detrás de la casa.', en: 'The rear pergola does not fit: it needs 4 m of yard behind the house.' }));
  }
  const P = piscinaDe(S);
  if (P.on && P.interior) {
    const pi = piscinaInterior(M, P);
    if (pi.aviso) out.avisos.push(pi.aviso);
    if (pi.r) {
      const r = pi.r, espejo = r.w * r.h, per = 2 * (r.w + r.h), s = pi.sala;
      const sw = s.x1 - s.x0, sh = s.y1 - s.y0, alto = M.fh || 2.6;
      out.piscina = {
        ...r, prof: P.prof, z: M.dl, interior: true, sala: { x0: s.x0, x1: s.x1, y0: s.y0, y1: s.y1 },
        espejo: r2(espejo), vaso: r2(espejo + per * P.prof), exc: r2((r.w + 0.6) * (r.h + 0.6) * (P.prof + 0.3)),
        playa: 0, playaInt: r2(sw * sh - espejo), litros: Math.round(espejo * P.prof * 1000),
        // muros y cielo del recinto: impermeabilización y barrera de vapor
        envolvente: r2(2 * (sw + sh) * alto + sw * sh),
      };
    }
  } else if (P.on) {
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
