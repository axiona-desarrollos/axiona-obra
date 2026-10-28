/* ==========================================================================
   AXIONA OBRA · Cronograma y curvas de nivel
   ========================================================================== */

import { EPS } from './geometria.js';

/** Cronograma con una cuadrilla (oficial + 2 ayudantes), en dias habiles. */
export function gantt(M) {
  const Q = M.quant, F = M.F, t = [];
  let s = 0;
  const push = (name, d, cat, start) => {
    d = Math.max(1, Math.ceil(d));
    const st = start ?? s;
    t.push({ name, d, s: st, cat });
    s = Math.max(s, st + d);
    return st;
  };
  push('Localización y replanteo', 2, 'negra');
  push('Movimiento de tierras', (M.cut + M.fill) / 8, 'negra');
  push('Excavación de cimentación', Q.excF / 5, 'negra');
  push('Cimentación y contrapiso', Q.concFund / 2.5 + 4, 'negra');
  const per = Q.concStr / F;
  let st2 = null;
  for (let f = 1; f <= F; f++) { const st = push(`Estructura piso ${f}`, per / 1.8 + 6, 'negra'); if (f === 2) st2 = st; }
  push('Mampostería', Q.mamp / 14, 'negra', st2 ?? undefined);
  push('Cubierta e impermeabilización', M.R.area / 40 + 2, 'negra');
  push('Pañetes (obra gris)', Q.pan / 22, 'gris');
  push('Estuco y pintura', (Q.est + Q.cielo) / 35, 'blanca');
  push('Pisos y enchapes', (Q.Apiso + Q.Aench) / 12, 'blanca');
  push('Carpintería y ventanería', Q.nDoor / 2 + Q.Awin / 6, 'blanca');
  return { tasks: t, total: s };
}

/** Curvas de nivel por marching squares sobre la malla del terreno. */
export function contours(G, step) {
  const { nx, ny, x0, y0, res, Z } = G;
  const out = [];
  const lo = Math.ceil(G.zmin / step) * step;
  for (let lv = lo; lv <= G.zmax + EPS; lv += step) {
    const segs = [];
    for (let j = 0; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) {
      const z = [Z[j * nx + i], Z[j * nx + i + 1], Z[(j + 1) * nx + i + 1], Z[(j + 1) * nx + i]];
      const P = [[x0 + i * res, y0 + j * res], [x0 + (i + 1) * res, y0 + j * res], [x0 + (i + 1) * res, y0 + (j + 1) * res], [x0 + i * res, y0 + (j + 1) * res]];
      const pts = [];
      for (let e = 0; e < 4; e++) {
        const a = e, b = (e + 1) % 4, za = z[a] - lv, zb = z[b] - lv;
        if ((za < 0) !== (zb < 0)) { const t = za / (za - zb); pts.push([P[a][0] + t * (P[b][0] - P[a][0]), P[a][1] + t * (P[b][1] - P[a][1])]); }
      }
      if (pts.length >= 2) segs.push([pts[0], pts[1]]);
      if (pts.length === 4) segs.push([pts[2], pts[3]]);
    }
    out.push({ lv: Math.round(lv * 100) / 100, major: Math.abs(lv - Math.round(lv)) < 0.01, segs });
  }
  return out;
}
