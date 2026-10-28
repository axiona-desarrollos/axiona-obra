/* ==========================================================================
   AXIONA OBRA · Distribucion de espacios
   --------------------------------------------------------------------------
   Cada piso se arma con un treemap "squarified" sobre la huella: rapido y
   sin huecos. La primera version armaba UNA distribucion y la dejaba aunque
   saliera mal: en una casa de un piso la sala y el comedor quedaban sin
   puerta, y en el ejemplo el patio de ropas quedaba encerrado sin ventana.

   AHORA SE PRUEBAN VARIANTES Y SE PUNTUA CADA UNA
   Para cada piso se arman decenas de variantes (orden de los espacios por
   zona, reparto en un sentido o en el otro) y para la casa entera las dos
   posiciones de la escalera (a la izquierda o a la derecha). Cada variante
   suma castigos: espacio sin puerta, espacio habitable sin fachada, espacio
   angosto o muy alargado, sala lejos de la entrada, alcobas hacia la calle.
   Gana la de menos castigos. Con semilla fija: la misma entrada da siempre
   la misma casa.
   ========================================================================== */

import { r2, snap, near, EPS, ivUnion, ivSubtract, shared, azarConSemilla } from './geometria.js';

const ZONE_ORDER = { social: 0, servicio: 1, privada: 2 };
export const isBath = n => /ba[ñn]o|wc|aseo|sanitario/i.test(n || '');

/** Ancho minimo util de un espacio segun su uso, en metros. */
export function anchoMinimo(r) {
  if (r.bath) return 1.2;
  return r.zone === 'servicio' ? 1.8 : 2.4;
}

/* ---------- treemap squarified ---------- */
export function squarify(items, rect) {
  const out = [];
  let { x, y, w, h } = rect;
  let row = [];
  const rest = items.slice();
  const worst = (rw, len) => {
    const s = rw.reduce((t, r) => t + r.a, 0);
    let mx = 0, mn = Infinity;
    for (const r of rw) { mx = Math.max(mx, r.a); mn = Math.min(mn, r.a); }
    return Math.max(len * len * mx / (s * s), s * s / (len * len * mn));
  };
  const layout = () => {
    if (!row.length) return;
    const s = row.reduce((t, r) => t + r.a, 0);
    if (w >= h) {
      const cw = s / h; let cy = y;
      for (const r of row) { const rh = r.a / cw; out.push({ ...r, x0: x, y0: cy, x1: x + cw, y1: cy + rh }); cy += rh; }
      x += cw; w -= cw;
    } else {
      const rh = s / w; let cx = x;
      for (const r of row) { const rw = r.a / rh; out.push({ ...r, x0: cx, y0: y, x1: cx + rw, y1: y + rh }); cx += rw; }
      y += rh; h -= rh;
    }
    row = [];
  };
  while (rest.length) {
    const len = Math.min(w, h), it = rest[0];
    if (!row.length || worst(row.concat([it]), len) <= worst(row, len)) { row.push(it); rest.shift(); } else layout();
  }
  layout();
  return out;
}

/**
 * Arma un piso: espacios, muros, puertas y ventanas, mas su puntaje.
 * @param items  [{name, req, zone}] en el orden en que se reparten
 * @param R      huella {x0,x1,y0,y1}
 * @param franja columna de circulacion {x0,x1} (hall y escalera)
 * @param stair  hueco de escalera o null
 * @param transponer reparte en el otro sentido
 */
export function armarPiso(items, R, franja, stair, f, F, transponer = false) {
  const avisos = [];
  let pen = 0;
  const m0 = near(franja.x1, R.x1) ? R.x0 : franja.x1;
  const m1 = near(franja.x1, R.x1) ? franja.x0 : R.x1;
  const MA = r2(m1 - m0) * (R.y1 - R.y0);
  const tot = items.reduce((t, r) => t + r.req, 0) || 1;
  const its = items.map(it => ({ ...it, a: it.req / tot * MA }));

  let rects;
  if (transponer) {
    rects = squarify(its, { x: R.y0, y: m0, w: R.y1 - R.y0, h: m1 - m0 })
      .map(r => ({ ...r, x0: r.y0, x1: r.y1, y0: r.x0, y1: r.x1 }));
  } else {
    rects = squarify(its, { x: m0, y: R.y0, w: m1 - m0, h: R.y1 - R.y0 });
  }
  rects = rects.map(r => ({ name: r.name, req: r.req, zone: r.zone, x0: snap(r.x0), x1: snap(r.x1), y0: snap(r.y0), y1: snap(r.y1) }));
  if (stair) {
    rects.push({ name: f === 0 ? 'Hall · acceso' : 'Hall', zone: 'circ', circ: true, hall: true, x0: franja.x0, x1: franja.x1, y0: R.y0, y1: stair.y0 });
    rects.push({ name: f < F - 1 ? 'Escalera' : 'Llegada escalera', zone: 'circ', circ: true, stair: true, x0: stair.x0, x1: stair.x1, y0: stair.y0, y1: stair.y1 });
  } else {
    rects.push({ name: 'Circulación', zone: 'circ', circ: true, hall: true, x0: franja.x0, x1: franja.x1, y0: R.y0, y1: R.y1 });
  }
  rects.forEach(r => { r.w = r2(r.x1 - r.x0); r.h = r2(r.y1 - r.y0); r.area = r2(r.w * r.h); r.bath = isBath(r.name); });

  // proporciones
  for (const r of rects) {
    if (r.circ) continue;
    const mn = Math.min(r.w, r.h), mx = Math.max(r.w, r.h), lim = anchoMinimo(r);
    if (mn < lim) { pen += (lim - mn) * 150; avisos.push(`Piso ${f + 1}: "${r.name}" queda angosto (${r2(mn)} m; mínimo ${lim} m). Ajusta el área o reordena.`); }
    if (mn > 0 && mx / mn > 2.6) pen += (mx / mn - 2.6) * 12;
    // sala y comedor hacia la entrada en el primer piso; alcobas hacia atras
    const fondo = ((r.y0 + r.y1) / 2 - R.y0) / Math.max(R.y1 - R.y0, 1);
    if (f === 0 && r.zone === 'social') pen += fondo * 4;
    if (r.zone === 'privada') pen += (1 - fondo) * 2;
  }

  // lineas de muro
  const H = new Map(), V = new Map(), exH = new Map(), exV = new Map();
  const add = (m, k, a, b) => { const key = k.toFixed(2); if (!m.has(key)) m.set(key, []); m.get(key).push([a, b]); };
  rects.forEach(r => { add(H, r.y0, r.x0, r.x1); add(H, r.y1, r.x0, r.x1); add(V, r.x0, r.y0, r.y1); add(V, r.x1, r.y0, r.y1); });
  for (let i = 0; i < rects.length; i++) for (let j = i + 1; j < rects.length; j++) {
    if (!(rects[i].circ && rects[j].circ)) continue;
    const s = shared(rects[i], rects[j]);
    if (s) add(s.o === 'H' ? exH : exV, s.c, s.a, s.b);
  }
  const lines = [];
  const isExt = (o, c) => o === 'H' ? (near(c, R.y0) || near(c, R.y1)) : (near(c, R.x0) || near(c, R.x1));
  for (const [k, l] of H) for (const [a, b] of ivSubtract(ivUnion(l), exH.get(k) || [])) lines.push({ o: 'H', c: +k, a, b, ext: isExt('H', +k) });
  for (const [k, l] of V) for (const [a, b] of ivSubtract(ivUnion(l), exV.get(k) || [])) lines.push({ o: 'V', c: +k, a, b, ext: isExt('V', +k) });

  // puertas: arbol de acceso mas corto desde el hall (Dijkstra). Los banos y
  // la escalera no se atraviesan.
  const ops = [];
  const ctr = r => ({ x: (r.x0 + r.x1) / 2, y: (r.y0 + r.y1) / 2 });
  const adj = rects.map(() => []);
  for (let i = 0; i < rects.length; i++) for (let j = i + 1; j < rects.length; j++) {
    const s = shared(rects[i], rects[j]);
    if (!s || s.b - s.a < 1.15) continue;
    adj[i].push({ j, s }); adj[j].push({ j: i, s });
  }
  const hallI = rects.findIndex(r => r.hall);
  const cost = rects.map(() => Infinity), par = rects.map(() => null), done = rects.map(() => false);
  cost[hallI] = 0;
  for (let it = 0; it < rects.length; it++) {
    let u = -1;
    for (let k = 0; k < rects.length; k++) if (!done[k] && cost[k] < Infinity && (u < 0 || cost[k] < cost[u])) u = k;
    if (u < 0) break;
    done[u] = true;
    const ru = rects[u];
    if (ru.bath || (ru.stair && u !== hallI)) continue;
    const step = ru.hall ? 0 : ru.zone === 'social' ? 1 : ru.zone === 'servicio' ? 2 : 3;
    for (const { j, s } of adj[u]) {
      if (rects[j].circ) continue;
      const c = cost[u] + 1 + step;
      if (c < cost[j]) { cost[j] = c; par[j] = { u, s }; }
    }
  }
  rects.forEach((r, i) => {
    if (r.circ) return;
    if (!par[i]) { pen += 1000; avisos.push(`Piso ${f + 1}: "${r.name}" queda sin acceso; reordena el programa.`); return; }
    // entrar a una alcoba atravesando otra alcoba es mala distribucion
    const via = rects[par[i].u];
    if (r.zone === 'privada' && via.zone === 'privada') pen += 25;
    pen += cost[i] * 0.5;
    const s = par[i].s, w = r.bath ? 0.75 : 0.9;
    const a = r2(s.a + 0.15), m = ctr(r);
    const dir = s.o === 'H' ? (m.y > s.c ? 1 : -1) : (m.x > s.c ? 1 : -1);
    r.via = via.name;
    ops.push({ kind: 'door', o: s.o, c: s.c, a, b: r2(a + w), w, dir, room: r.name, h: 2.1 });
  });
  if (f === 0) {
    const hall = rects.find(r => r.hall);
    const w = Math.min(1.0, hall.w - 0.2), a = r2((hall.x0 + hall.x1) / 2 - w / 2);
    ops.push({ kind: 'main', o: 'H', c: R.y0, a, b: r2(a + w), w, dir: 1, room: hall.name, h: 2.2 });
  }

  // ventanas: en la fachada mas larga de cada espacio
  rects.forEach(r => {
    if (r.circ) return;
    const ex = [];
    if (near(r.y0, R.y0)) ex.push({ o: 'H', c: R.y0, a: r.x0, b: r.x1 });
    if (near(r.y1, R.y1)) ex.push({ o: 'H', c: R.y1, a: r.x0, b: r.x1 });
    if (near(r.x0, R.x0)) ex.push({ o: 'V', c: R.x0, a: r.y0, b: r.y1 });
    if (near(r.x1, R.x1)) ex.push({ o: 'V', c: R.x1, a: r.y0, b: r.y1 });
    if (!ex.length) {
      if (r.bath) { pen += 6; return; }
      pen += r.zone === 'servicio' ? 60 : 140;
      avisos.push(`Piso ${f + 1}: "${r.name}" no tiene fachada; requiere patio o ventilación cenital.`);
      return;
    }
    ex.sort((p, q) => (q.b - q.a) - (p.b - p.a));
    const e = ex[0], L = e.b - e.a;
    const w = r.bath ? 0.6 : r2(Math.min(Math.max(1.2, L * 0.5), 2.4, L - 0.6));
    if (w < 0.5) return;
    const a = r2((e.a + e.b) / 2 - w / 2);
    ops.push({ kind: 'win', o: e.o, c: e.c, a, b: r2(a + w), w, h: r.bath ? 0.6 : 1.2, sill: r.bath ? 1.6 : 1.0, room: r.name });
  });

  lines.forEach(l => {
    const cuts = ops.filter(o => o.o === l.o && near(o.c, l.c) && o.b > l.a && o.a < l.b).map(o => [o.a, o.b]);
    l.pieces = ivSubtract([[l.a, l.b]], cuts);
    l.len = l.b - l.a;
  });
  return { f, rects, lines, ops, area: rects.reduce((t, r) => t + r.area, 0), pen, avisos };
}

/** Ordenes de reparto a probar para un piso. */
function variantes(items, semilla, porOrden = 3) {
  const azar = azarConSemilla(semilla);
  const ordenes = [
    ['social', 'servicio', 'privada'], ['social', 'privada', 'servicio'], ['servicio', 'social', 'privada'],
    ['privada', 'social', 'servicio'], ['servicio', 'privada', 'social'], ['privada', 'servicio', 'social'],
  ];
  const out = [];
  for (const orden of ordenes) {
    const rango = z => { const i = orden.indexOf(z); return i < 0 ? 9 : i; };
    const base = items.slice().sort((a, b) => rango(a.zone) - rango(b.zone) || b.req - a.req);
    out.push(base);
    for (let k = 1; k < porOrden; k++) {
      const mezcla = items.map(it => ({ it, r: azar() })).sort((a, b) => rango(a.it.zone) - rango(b.it.zone) || a.r - b.r).map(o => o.it);
      out.push(mezcla);
    }
  }
  return out;
}

/**
 * Elige la mejor distribucion de la casa entera.
 * @returns {{lado:'der'|'izq', franja, stair, pisos, castigo}}
 */
export function distribuir(programa, R, F, stripW, stairLen = 4.2) {
  let mejor = null;
  for (const lado of ['der', 'izq']) {
    const franja = lado === 'der' ? { x0: r2(R.x1 - stripW), x1: R.x1 } : { x0: R.x0, x1: r2(R.x0 + stripW) };
    const stair = F > 1 ? { x0: franja.x0, x1: franja.x1, y0: r2(R.y1 - stairLen), y1: R.y1 } : null;
    const pisos = [];
    let castigo = 0;
    for (let f = 0; f < F; f++) {
      let items = programa[f];
      if (!items.length) items = [{ name: f === 0 ? 'Local / libre' : 'Espacio libre', req: 10, zone: 'social' }];
      let elegido = null;
      for (const orden of variantes(items, 7919 * (f + 1))) {
        for (const tr of [false, true]) {
          const p = armarPiso(orden, R, franja, stair, f, F, tr);
          if (!elegido || p.pen < elegido.pen - EPS) elegido = p;
        }
      }
      pisos.push(elegido);
      castigo += elegido.pen;
    }
    if (!mejor || castigo < mejor.castigo - EPS) mejor = { lado, franja, stair, pisos, castigo };
  }
  return mejor;
}

export { ZONE_ORDER };
