/* ==========================================================================
   AXIONA OBRA · Condominio (loteo para ventas)
   --------------------------------------------------------------------------
   Parte un terreno grande en lotes iguales a lado y lado de una via
   interna, con la casa del proyecto en cada uno. Sirve para la sala de
   ventas: el cliente ve el condominio en 3D o en AR, escoge su lote y entra
   a su casa. La via va paralela al lado mas largo del terreno.
   ========================================================================== */

import { r2, polyArea, pip, marcoDelFrente } from './geometria.js';

/**
 * @param macro  poligono del terreno [{x,y,z}] en el mundo
 * @param opt    { via, frente, fondo }: ancho de via y medidas del lote tipo
 * @returns {via, lotes:[{id, poly (local), area, lado}], marco, ancho, largo}
 */
export function lotear(macro, opt = {}) {
  const n = macro.length;
  if (n < 3 || Math.abs(polyArea(macro)) < 200) return { err: 'terreno', lotes: [] };
  // el lado mas largo manda la direccion de la via
  let iMax = 0, lMax = 0;
  for (let i = 0; i < n; i++) { const a = macro[i], b = macro[(i + 1) % n], L = Math.hypot(b.x - a.x, b.y - a.y); if (L > lMax) { lMax = L; iMax = i; } }
  const marco = marcoDelFrente(macro, iMax);
  const loc = macro.map(marco.aLocal);
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  loc.forEach(p => { x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); y0 = Math.min(y0, p.y); y1 = Math.max(y1, p.y); });
  const via = Math.max(4, +opt.via || 8), fr = Math.max(5, +opt.frente || 10), fo = Math.max(8, +opt.fondo || 18);
  const prof = y1 - y0;
  const dosFilas = prof >= 2 * fo + via + 0.5;
  const yv0 = dosFilas ? r2((y0 + y1) / 2 - via / 2) : r2(y0);
  const yv1 = r2(yv0 + via);
  const filas = dosFilas ? [{ ya: yv1, yb: yv1 + fo, lado: 'N' }, { ya: yv0 - fo, yb: yv0, lado: 'S' }] : [{ ya: yv1, yb: yv1 + fo, lado: 'N' }];
  const lotes = [];
  const dentro = (x, y) => pip(x, y, loc);
  filas.forEach(fi => {
    for (let x = x0 + 0.5; x + fr <= x1 - 0.5 + 1e-6; x += fr) {
      const poly = [[x, fi.ya], [x + fr, fi.ya], [x + fr, fi.yb], [x, fi.yb]];
      if (!poly.every(([px, py]) => dentro(px, py))) continue;
      lotes.push({ poly: poly.map(([px, py]) => ({ x: r2(px), y: r2(py) })), area: r2(fr * fo), lado: fi.lado, x: r2(x), ya: r2(fi.ya), yb: r2(fi.yb) });
    }
  });
  lotes.forEach((l, i) => { l.id = `L-${String(i + 1).padStart(2, '0')}`; });
  const viaPoly = [{ x: x0, y: yv0 }, { x: x1, y: yv0 }, { x: x1, y: yv1 }, { x: x0, y: yv1 }];
  return { marco, loc, via: viaPoly, lotes, ancho: r2(x1 - x0), largo: r2(prof), dosFilas, frente: fr, fondo: fo, viaAncho: via, areaTotal: r2(Math.abs(polyArea(macro))) };
}
