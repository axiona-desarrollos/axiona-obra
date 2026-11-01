/* ==========================================================================
   AXIONA OBRA · Plantas en L, en U y con patio central
   --------------------------------------------------------------------------
   Como se construyen de verdad (la casa de patio antioqueña): alas de
   espacios alrededor de un patio, con un corredor del lado del patio que
   reparte a todos los espacios, y un zaguán desde la calle con la escalera.
   - patio: cuatro alas y corredor alrededor de un patio cerrado.
   - u: tres alas; el patio se abre al fondo (jardín).
   - ele: dos alas (frente y un lado); el patio se abre al fondo y al lado.
   Los muros exteriores quedan en el contorno de la casa y el corredor se
   abre al patio con columnas (en los pisos de arriba, con baranda). Cada
   ala lleva su propia cubierta, que cubre también su corredor.
   Coordenadas del marco del frente: x a lo largo del frente, y hacia el fondo.
   ========================================================================== */

import { r2, snap, near, EPS, ivUnion, ivSubtract, shared } from './geometria.js';
import { tr } from './idioma.js';
import { isBath, anchoMinimo, squarify, variantes } from './distribucion.js';

export const COMPUESTAS = {
  ele: { es: 'En L, con patio de lado', en: 'L-shaped, with a side courtyard' },
  u: { es: 'En U, con patio al fondo', en: 'U-shaped, with a rear courtyard' },
  patio: { es: 'Con patio central y corredor', en: 'Central courtyard with a gallery' },
};
export const esCompuesta = t => !!COMPUESTAS[t];

/** Medidas de las alas: fondo de los espacios, del ala del frente, ancho del corredor y del zaguán. */
export function medidas(F) {
  return { bd: 4.2, bf: F > 1 ? 5.0 : 4.2, gw: 1.5, zw: F > 1 ? 2.8 : 2.0, patioMin: 5.0 };
}

const caja = (x0, x1, y0, y1) => {
  const r = { x0: r2(x0), x1: r2(x1), y0: r2(y0), y1: r2(y1) };
  r.w = r2(r.x1 - r.x0); r.h = r2(r.y1 - r.y0); r.area = r2(r.w * r.h);
  return r;
};

/**
 * Geometría de la planta compuesta en la caja B (igual en todos los pisos).
 * lado: en la L, el lado del ala; en la U y el patio, el lado de la escalera dentro del zaguán.
 */
export function planta(tipo, B, lado, F) {
  const { bd, bf, gw, zw } = medidas(F);
  const { x0: X0, x1: X1, y0: Y0, y1: Y1 } = B;
  const yG = Y0 + bf, yP = yG + gw, izq = lado !== 'der';
  const bandas = [], galerias = [], alas = [];
  let patio, zx0;
  if (tipo === 'patio') {
    bandas.push(caja(X0, X1, Y1 - bd, Y1), caja(X0, X0 + bd, yG, Y1 - bd), caja(X1 - bd, X1, yG, Y1 - bd));
    galerias.push(caja(X0 + bd, X1 - bd, yG, yP), caja(X0 + bd, X1 - bd, Y1 - bd - gw, Y1 - bd), caja(X0 + bd, X0 + bd + gw, yP, Y1 - bd - gw), caja(X1 - bd - gw, X1 - bd, yP, Y1 - bd - gw));
    patio = caja(X0 + bd + gw, X1 - bd - gw, yP, Y1 - bd - gw);
    alas.push({ ...caja(X0, X1, Y0, yP), dir: 'x' }, { ...caja(X0, X1, Y1 - bd - gw, Y1), dir: 'x' }, { ...caja(X0, X0 + bd + gw, yP, Y1 - bd - gw), dir: 'y' }, { ...caja(X1 - bd - gw, X1, yP, Y1 - bd - gw), dir: 'y' });
    zx0 = snap((X0 + X1) / 2 - zw / 2);
  } else if (tipo === 'u') {
    bandas.push(caja(X0, X0 + bd, yG, Y1), caja(X1 - bd, X1, yG, Y1));
    galerias.push(caja(X0 + bd, X1 - bd, yG, yP), caja(X0 + bd, X0 + bd + gw, yP, Y1), caja(X1 - bd - gw, X1 - bd, yP, Y1));
    patio = caja(X0 + bd + gw, X1 - bd - gw, yP, Y1);
    alas.push({ ...caja(X0, X1, Y0, yP), dir: 'x' }, { ...caja(X0, X0 + bd + gw, yP, Y1), dir: 'y' }, { ...caja(X1 - bd - gw, X1, yP, Y1), dir: 'y' });
    zx0 = snap((X0 + X1) / 2 - zw / 2);
  } else {
    if (izq) {
      bandas.push(caja(X0, X0 + bd, yG, Y1));
      galerias.push(caja(X0 + bd, X1, yG, yP), caja(X0 + bd, X0 + bd + gw, yP, Y1));
      patio = caja(X0 + bd + gw, X1, yP, Y1);
      alas.push({ ...caja(X0, X1, Y0, yP), dir: 'x' }, { ...caja(X0, X0 + bd + gw, yP, Y1), dir: 'y' });
      zx0 = r2(X0 + bd);
    } else {
      bandas.push(caja(X1 - bd, X1, yG, Y1));
      galerias.push(caja(X0, X1 - bd, yG, yP), caja(X1 - bd - gw, X1 - bd, yP, Y1));
      patio = caja(X0, X1 - bd - gw, yP, Y1);
      alas.push({ ...caja(X0, X1, Y0, yP), dir: 'x' }, { ...caja(X1 - bd - gw, X1, yP, Y1), dir: 'y' });
      zx0 = r2(X1 - bd - zw);
    }
  }
  const zx1 = r2(zx0 + zw);
  // zaguán: hall de entrada y, si hay pisos, escalera de 1.2 m contra un costado y paso al corredor
  const circ = [], escIzq = tipo === 'ele' ? !izq : izq;
  let stair = null;
  if (F > 1) {
    const sx0 = escIzq ? zx0 : r2(zx1 - 1.2), sx1 = r2(sx0 + 1.2), sy0 = r2(yG - 4.2);
    stair = caja(sx0, sx1, sy0, yG);
    if (sy0 - Y0 > 0.3) circ.push({ ...caja(zx0, zx1, Y0, sy0), parte: 'hall' });
    circ.push({ ...caja(escIzq ? sx1 : zx0, escIzq ? zx1 : sx0, sy0 - Y0 > 0.3 ? sy0 : Y0, yG), parte: 'paso' });
  } else circ.push({ ...caja(zx0, zx1, Y0, yG), parte: 'hall' });
  // espacios: el ala del frente a cada lado del zaguán y las otras alas
  const zonas = [caja(X0, zx0, Y0, yG), caja(zx1, X1, Y0, yG), ...bandas].filter(z => z.w >= 1.6 && z.h >= 1.6);
  return { tipo, lado, B, bd, bf, gw, zw, zaguan: { x0: zx0, x1: zx1 }, stair, circ, galerias, zonas, patio, alas };
}

/** Área de los espacios (sin corredores, zaguán ni patio) de una planta compuesta de W × D. */
export function areaEspacios(tipo, W, D, F, lado = 'izq') {
  const P = planta(tipo, caja(0, W, 0, D), lado, F);
  return P.zonas.reduce((t, z) => t + z.area, 0);
}

/** Medidas mínimas de la caja para que el patio y las alas sirvan. */
export function minimos(tipo, F) {
  const { bd, bf, gw, zw, patioMin } = medidas(F);
  if (tipo === 'patio') return { W: 2 * bd + 2 * gw + patioMin, D: bf + bd + 2 * gw + patioMin };
  if (tipo === 'u') return { W: Math.max(2 * bd + 2 * gw + patioMin, 2 * bd + zw + 2), D: bf + gw + patioMin };
  return { W: bd + zw + 2 * 2.4, D: bf + gw + patioMin };
}

/** Reparte los espacios en las zonas en orden, según la capacidad de cada una. */
function repartir(items, zonas) {
  const cap = zonas.map(z => z.area), C = cap.reduce((t, a) => t + a, 0), tot = items.reduce((t, r) => t + r.req, 0) || 1;
  const grupos = zonas.map(() => []);
  let k = 0, acc = 0;
  for (const it of items) {
    const a = it.req / tot * C;
    while (k < zonas.length - 1 && grupos[k].length && acc + a / 2 > cap[k]) { k++; acc = 0; }
    grupos[k].push(it); acc += a;
  }
  return grupos;
}

/** Arma un piso de la planta compuesta: espacios, muros, puertas, ventanas, corredor abierto y puntaje. */
export function armarCompuesto(items, P, f, F, girar = false) {
  const avisos = [];
  let pen = 0;
  // si las alas dan mucho más que el programa, lo que sobra queda como espacios libres
  // (taller, estudio, local) en vez de inflar cada espacio
  const C = P.zonas.reduce((t, z) => t + z.area, 0), pedido = items.reduce((t, r) => t + r.req, 0);
  if (C > pedido * 1.3) {
    const sobra = C - pedido * 1.12, n = Math.max(1, Math.round(sobra / 20));
    items = [...items, ...Array.from({ length: n }, (_, k) => ({ name: n > 1 ? `${tr({ es: 'Espacio libre', en: 'Open space' })} ${k + 1}` : tr({ es: 'Espacio libre', en: 'Open space' }), req: sobra / n, zone: 'social', libre: true }))];
  }
  const grupos = repartir(items, P.zonas);
  const rects = [];
  P.zonas.forEach((z, k) => {
    let its = grupos[k];
    if (!its.length) its = [{ name: tr({ es: 'Espacio libre', en: 'Open space' }), req: z.area, zone: 'social' }];
    const sum = its.reduce((t, r) => t + r.req, 0) || 1, esc = z.area / sum;
    // espacios que crecen o se encogen mucho para llenar su ala
    pen += Math.abs(Math.log(esc)) * 6 * its.length;
    const a = its.map(it => ({ ...it, a: it.req * esc }));
    // en un ala larga, los espacios van uno tras otro a lo largo del ala
    const largo = z.w >= z.h;
    const sq = (girar ? !largo : largo)
      ? squarify(a, { x: z.x0, y: z.y0, w: z.w, h: z.h })
      : squarify(a, { x: z.y0, y: z.x0, w: z.h, h: z.w }).map(r => ({ ...r, x0: r.y0, x1: r.y1, y0: r.x0, y1: r.x1 }));
    sq.forEach(r => rects.push({ name: r.name, req: r.req, zone: r.zone, x0: snap(r.x0), x1: snap(r.x1), y0: snap(r.y0), y1: snap(r.y1) }));
  });
  const nHall = f === 0 ? tr({ es: 'Zaguán · acceso', en: 'Entry hall' }) : tr({ es: 'Hall', en: 'Hall' });
  P.circ.forEach(c => rects.push({ name: c.parte === 'paso' ? tr({ es: 'Paso', en: 'Passage' }) : nHall, zone: 'circ', circ: true, hall: true, x0: c.x0, x1: c.x1, y0: c.y0, y1: c.y1 }));
  if (P.stair) rects.push({ name: f < F - 1 ? tr({ es: 'Escalera', en: 'Stair' }) : tr({ es: 'Llegada escalera', en: 'Stair landing' }), zone: 'circ', circ: true, stair: true, x0: P.stair.x0, x1: P.stair.x1, y0: P.stair.y0, y1: P.stair.y1 });
  P.galerias.forEach(g => rects.push({ name: tr({ es: 'Corredor', en: 'Gallery' }), zone: 'circ', circ: true, hall: true, galeria: true, x0: g.x0, x1: g.x1, y0: g.y0, y1: g.y1 }));
  rects.forEach(r => { r.w = r2(r.x1 - r.x0); r.h = r2(r.y1 - r.y0); r.area = r2(r.w * r.h); r.bath = isBath(r.name); });

  // proporciones; en el primer piso lo social hacia la calle
  const B = P.B;
  for (const r of rects) {
    if (r.circ) continue;
    const mn = Math.min(r.w, r.h), mx = Math.max(r.w, r.h), lim = anchoMinimo(r);
    if (mn < lim) { pen += (lim - mn) * 150; avisos.push(tr({ es: 'Piso {f}: «{n}» queda angosto ({a} m; mínimo {l} m). Ajusta el área o reordena.', en: 'Floor {f}: “{n}” is narrow ({a} m; minimum {l} m). Adjust its area or reorder.' }, { f: f + 1, n: r.name, a: r2(mn), l: lim })); }
    if (mn > 0 && mx / mn > 2.6) pen += (mx / mn - 2.6) * 12;
    const fondo = ((r.y0 + r.y1) / 2 - B.y0) / Math.max(B.y1 - B.y0, 1);
    if (f === 0 && r.zone === 'social') pen += fondo * 4;
    if (r.zone === 'privada') pen += (1 - fondo) * 2;
  }

  // muros: lo compartido es muro interior (salvo entre circulaciones); lo que no toca nada es
  // fachada, y en el corredor es el lado abierto al patio
  const H = new Map(), V = new Map(), eH = new Map(), eV = new Map(), abiertos = [];
  const add = (m, k, a, b) => { const key = (+k).toFixed(2); if (!m.has(key)) m.set(key, []); m.get(key).push([a, b]); };
  for (let i = 0; i < rects.length; i++) for (let j = i + 1; j < rects.length; j++) {
    const s = shared(rects[i], rects[j]);
    if (!s || (rects[i].circ && rects[j].circ)) continue;
    add(s.o === 'H' ? H : V, s.c, s.a, s.b);
  }
  const sueltos = rects.map(() => []);
  rects.forEach((r, i) => {
    const bordes = [{ o: 'H', c: r.y0, a: r.x0, b: r.x1 }, { o: 'H', c: r.y1, a: r.x0, b: r.x1 }, { o: 'V', c: r.x0, a: r.y0, b: r.y1 }, { o: 'V', c: r.x1, a: r.y0, b: r.y1 }];
    bordes.forEach(e => {
      const tapa = [];
      rects.forEach((q, j) => { if (j === i) return; const s = shared(r, q); if (s && s.o === e.o && near(s.c, e.c)) tapa.push([s.a, s.b]); });
      ivSubtract([[e.a, e.b]], ivUnion(tapa)).filter(([a, b]) => b - a > 0.05).forEach(([a, b]) => {
        const seg = { o: e.o, c: e.c, a: r2(a), b: r2(b) };
        // s: hacia dónde queda el corredor visto desde el borde abierto
        if (r.galeria) abiertos.push({ ...seg, f, s: near(e.c, e.o === 'H' ? r.y0 : r.x0) ? 1 : -1 });
        else { add(e.o === 'H' ? eH : eV, e.c, a, b); sueltos[i].push(seg); }
      });
    });
  });
  const lines = [];
  for (const [m, ext, o] of [[H, false, 'H'], [V, false, 'V'], [eH, true, 'H'], [eV, true, 'V']]) {
    for (const [k, l] of m) for (const [a, b] of ivUnion(l)) lines.push({ o, c: +k, a: r2(a), b: r2(b), ext });
  }

  // puertas: árbol de acceso desde el zaguán y el corredor (Dijkstra), sin atravesar baños ni escalera
  const ops = [];
  const adj = rects.map(() => []);
  for (let i = 0; i < rects.length; i++) for (let j = i + 1; j < rects.length; j++) {
    const s = shared(rects[i], rects[j]);
    if (!s || s.b - s.a < 1.15) continue;
    adj[i].push({ j, s }); adj[j].push({ j: i, s });
  }
  const cost = rects.map(r => (r.hall ? 0 : Infinity)), par = rects.map(() => null), done = rects.map(() => false);
  for (let it = 0; it < rects.length; it++) {
    let u = -1;
    for (let k = 0; k < rects.length; k++) if (!done[k] && cost[k] < Infinity && (u < 0 || cost[k] < cost[u])) u = k;
    if (u < 0) break;
    done[u] = true;
    const ru = rects[u];
    if (ru.bath || ru.stair) continue;
    const step = ru.hall ? 0 : ru.zone === 'social' ? 1 : ru.zone === 'servicio' ? 2 : 3;
    for (const { j, s } of adj[u]) {
      if (rects[j].circ) continue;
      const c = cost[u] + 1 + step;
      if (c < cost[j]) { cost[j] = c; par[j] = { u, s }; }
    }
  }
  const ctr = r => ({ x: (r.x0 + r.x1) / 2, y: (r.y0 + r.y1) / 2 });
  rects.forEach((r, i) => {
    if (r.circ) return;
    if (!par[i]) { pen += 1000; avisos.push(tr({ es: 'Piso {f}: «{n}» queda sin acceso; reordena el programa.', en: 'Floor {f}: “{n}” has no access; reorder the program.' }, { f: f + 1, n: r.name })); return; }
    const via = rects[par[i].u];
    if (r.zone === 'privada' && via.zone === 'privada') pen += 25;
    pen += cost[i] * 0.5;
    const s = par[i].s, w = r.bath ? 0.75 : 0.9, a = r2(s.a + 0.15), m = ctr(r);
    const dir = s.o === 'H' ? (m.y > s.c ? 1 : -1) : (m.x > s.c ? 1 : -1);
    r.via = via.name;
    ops.push({ kind: 'door', o: s.o, c: s.c, a, b: r2(a + w), w, dir, room: r.name, h: 2.1 });
  });
  if (f === 0) {
    const entrada = rects.filter(r => r.hall && !r.galeria && near(r.y0, B.y0)).sort((p, q) => q.w - p.w)[0];
    const paso = rects.find(r => r.hall && !r.galeria && r.name === tr({ es: 'Paso', en: 'Passage' }));
    const ref = paso && near(paso.y0, B.y0) ? paso : entrada;
    const w = Math.min(1.0, ref.w - 0.2), cx = paso ? (paso.x0 + paso.x1) / 2 : (ref.x0 + ref.x1) / 2;
    const a = r2(Math.max(ref.x0 + 0.1, Math.min(ref.x1 - 0.1 - w, cx - w / 2)));
    ops.push({ kind: 'main', o: 'H', c: B.y0, a, b: r2(a + w), w, dir: 1, room: ref.name, h: 2.2 });
  }

  // ventanas: a la fachada más larga; si el espacio no tiene fachada, al corredor
  rects.forEach((r, i) => {
    if (r.circ) return;
    let ex = sueltos[i].slice().sort((p, q) => (q.b - q.a) - (p.b - p.a));
    let alCorredor = false;
    if (!ex.length) {
      ex = rects.filter(q => q.galeria).map(q => shared(r, q)).filter(Boolean).sort((p, q) => (q.b - q.a) - (p.b - p.a));
      alCorredor = ex.length > 0;
    }
    if (!ex.length) {
      if (r.bath) { pen += 6; return; }
      pen += r.zone === 'servicio' ? 60 : 140;
      avisos.push(tr({ es: 'Piso {f}: «{n}» no tiene fachada ni corredor; requiere ventilación cenital.', en: 'Floor {f}: “{n}” has no facade or gallery; it needs a skylight.' }, { f: f + 1, n: r.name }));
      return;
    }
    const e = ex[0], L = e.b - e.a;
    // la ventana no se monta sobre la puerta que da al mismo corredor
    const pu = ops.find(o => o.kind === 'door' && o.room === r.name && o.o === e.o && near(o.c, e.c));
    let w = r.bath ? 0.6 : r2(Math.min(Math.max(1.2, L * 0.5), 2.4, L - 0.6));
    let a = r2((e.a + e.b) / 2 - w / 2);
    if (pu && a < pu.b + 0.2 && a + w > pu.a - 0.2) { a = r2(pu.b + 0.3); w = r2(Math.min(w, e.b - 0.2 - a)); }
    if (w < 0.5) return;
    if (alCorredor) pen += 1;
    ops.push({ kind: 'win', o: e.o, c: e.c, a, b: r2(a + w), w, h: r.bath ? 0.6 : 1.2, sill: r.bath ? 1.6 : 1.0, room: r.name, corredor: alCorredor || undefined });
  });

  lines.forEach(l => {
    const cuts = ops.filter(o => o.o === l.o && near(o.c, l.c) && o.b > l.a && o.a < l.b).map(o => [o.a, o.b]);
    l.pieces = ivSubtract([[l.a, l.b]], cuts);
    l.len = l.b - l.a;
  });
  const area = rects.reduce((t, r) => t + r.area, 0);
  return { f, rects, lines, ops, area, pen, avisos, abiertos, patios: P.patio ? [P.patio] : [], alas: P.alas };
}

/** Elige la mejor distribución de la casa compuesta (lado del ala o de la escalera y orden de los espacios). */
export function distribuirCompuesta(programa, B, F, tipo) {
  let mejor = null;
  for (const lado of ['izq', 'der']) {
    const P = planta(tipo, B, lado, F);
    const pisos = [];
    let castigo = 0;
    for (let f = 0; f < F; f++) {
      let items = programa[f];
      if (!items.length) items = [{ name: f === 0 ? tr({ es: 'Local / libre', en: 'Open space' }) : tr({ es: 'Espacio libre', en: 'Open space' }), req: 10, zone: 'social' }];
      let elegido = null;
      for (const orden of variantes(items, 7919 * (f + 1))) {
        for (const g of [false, true]) {
          const p = armarCompuesto(orden, P, f, F, g);
          if (!elegido || p.pen < elegido.pen - EPS) elegido = p;
        }
      }
      elegido.R = { ...B, area: r2(elegido.area) };
      pisos.push(elegido);
      castigo += elegido.pen;
    }
    if (!mejor || castigo < mejor.castigo - EPS) mejor = { lado, franja: P.zaguan, stair: P.stair, asc: null, pisos, castigo, planta: P };
  }
  return mejor;
}

/**
 * Caja de la casa compuesta: crece desde la mínima, con la proporción del
 * lote, hasta que los espacios caben con su programa (o hasta el lote y la
 * ocupación). Devuelve null si ni la mínima cabe.
 */
export function cajaCompuesta(tipo, F, areaPiso, Wd, Dd, ocupacion) {
  const m = minimos(tipo, F);
  if (m.W > Wd + EPS || m.D > Dd + EPS) return null;
  let W = m.W, D = m.D;
  const prop = Math.min(2.2, Math.max(0.6, Dd / Wd));
  for (let k = 0; k < 400; k++) {
    const A = areaEspacios(tipo, W, D, F);
    if (A >= areaPiso * 1.05) break;
    const puedeW = W + 0.25 <= Wd + EPS, puedeD = D + 0.25 <= Dd + EPS;
    if (!puedeW && !puedeD) break;
    const huella = (W + 0.25) * (D + 0.25);
    if (huella > ocupacion) break;
    if (puedeW && (!puedeD || W * prop <= D)) W += 0.25; else D += 0.25;
  }
  return { W: r2(W), D: r2(D) };
}

/** ¿El punto (x, y) cae dentro de lo construido (alguno de los espacios del piso)? */
export const enRects = (x, y, rects, e = 0.02) => rects.some(r => x > r.x0 - e && x < r.x1 + e && y > r.y0 - e && y < r.y1 + e);

/** Parte una viga en los tramos que quedan sobre lo construido (no cruza el patio). */
export function recortarARects(b, rects) {
  const iv = [];
  rects.forEach(r => {
    const [c0, c1, a0, a1] = b.o === 'H' ? [r.y0, r.y1, r.x0, r.x1] : [r.x0, r.x1, r.y0, r.y1];
    if (b.c < c0 - 0.02 || b.c > c1 + 0.02) return;
    const a = Math.max(a0, b.a), c = Math.min(a1, b.b);
    if (c - a > 0.05) iv.push([a, c]);
  });
  return ivUnion(iv).filter(([a, c]) => c - a > 0.3).map(([a, c]) => ({ ...b, a: r2(a), b: r2(c) }));
}

/** Columnas del corredor (25 × 25) a lo largo de su borde abierto: en los extremos y cada 3 m como máximo. */
export function pilaresCorredor(abiertos, sep = 3, lado = 0.25) {
  const pts = new Map();
  abiertos.forEach(e => {
    const n = Math.max(1, Math.ceil((e.b - e.a) / sep - 1e-9)), off = e.s * lado / 2;
    for (let k = 0; k <= n; k++) {
      const t = r2(e.a + (e.b - e.a) * k / n), u = Math.min(e.b - lado / 2, Math.max(e.a + lado / 2, t));
      const p = e.o === 'H' ? { x: r2(u), y: r2(e.c + off) } : { x: r2(e.c + off), y: r2(u) };
      const key = `${Math.round(p.x * 4)}|${Math.round(p.y * 4)}`;
      if (!pts.has(key)) pts.set(key, { ...p, lado });
    }
  });
  return [...pts.values()];
}
