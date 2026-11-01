/* ==========================================================================
   AXIONA OBRA · Cronograma y curvas de nivel
   ========================================================================== */

import { EPS } from './geometria.js';
import { tr } from './idioma.js';

/** Cronograma con una cuadrilla (oficial + 2 ayudantes), en dias habiles. */
export function gantt(M) {
  const Q = M.quant, F = M.F, t = [];
  let s = 0;
  const push = (name, d, cat, start) => {
    d = Math.max(1, Math.ceil(d));
    const st = start ?? s;
    t.push({ name: tr(name, { f: name.f }), d, s: st, cat });
    s = Math.max(s, st + d);
    return st;
  };
  push({ es: 'Localización y replanteo', en: 'Layout and staking' }, 2, 'negra');
  push({ es: 'Movimiento de tierras', en: 'Earthworks' }, (M.cut + M.fill) / 8, 'negra');
  push({ es: 'Excavación de cimentación', en: 'Foundation excavation' }, (Q.excF || 10) / 5, 'negra');
  if (M.sistema === 'madera') {
    push({ es: M.sotano ? 'Zapatas, muros de sótano y losa' : 'Zapatas y muros de cimentación', en: M.sotano ? 'Footings, basement walls and slab' : 'Footings and frost walls' }, Q.concFund / 3 + 6, 'negra');
    for (let f = 1; f <= F; f++) push({ es: `Estructura de madera piso ${f}`, en: `Framing floor ${f}` }, M.R.area / 9 + 3, 'negra');
    push({ es: 'Cubierta', en: 'Roofing' }, (M.techo?.area || M.R.area) / 30 + 2, 'negra');
    push({ es: 'Ventanas y revestimiento exterior', en: 'Windows and cladding' }, Q.Awin / 6 + (Q.Q?.AextN || 0) / 25, 'gris');
    push({ es: 'Redes eléctricas, hidráulicas y ductos', en: 'Rough-in: electrical, plumbing, HVAC' }, M.built / 18 + 4, 'inst');
    push({ es: 'Aislamiento y paneles de yeso', en: 'Insulation and drywall' }, Q.est / 30, 'gris');
  } else {
    push({ es: 'Cimentación y contrapiso', en: 'Foundation and slab on grade' }, Q.concFund / 2.5 + 4, 'negra');
    const per = Q.concStr / F;
    let st2 = null;
    for (let f = 1; f <= F; f++) { const st = push({ es: `Estructura piso ${f}`, en: `Structure floor ${f}` }, per / 1.8 + 6, 'negra'); if (f === 2) st2 = st; }
    push({ es: M.pais === 'ES' ? 'Fábricas y tabiquería' : M.pais === 'MX' ? 'Muros de block y castillos' : 'Mampostería', en: 'Masonry' }, Q.mamp / 14, 'negra', st2 ?? undefined);
    push({ es: 'Cubierta e impermeabilización', en: 'Roof and waterproofing' }, (M.techo?.area || M.R.area) / 40 + 2, 'negra');
    push({ es: 'Redes eléctricas e hidrosanitarias', en: 'Electrical and plumbing rough-in' }, M.built / 25 + 3, 'inst');
    push({ es: M.pais === 'ES' ? 'Enfoscados y enlucidos' : M.pais === 'MX' ? 'Aplanados (obra gris)' : 'Pañetes (obra gris)', en: 'Plastering' }, Q.pan / 22, 'gris');
  }
  push({ es: M.pais === 'MX' ? 'Pintura' : 'Estuco y pintura', en: 'Paint' }, (Q.est + Q.cielo) / 35, 'blanca');
  push({ es: M.pais === 'MX' ? 'Pisos, zoclos y lambrines' : 'Pisos y enchapes', en: 'Flooring and tiling' }, (Q.Apiso + Q.Aench) / 12, 'blanca');
  push({ es: 'Carpintería, cocina y aparatos', en: 'Doors, kitchen and fixtures' }, Q.nDoor / 2 + Q.Awin / 6 + 3, 'blanca');
  if (M.asc) push({ es: 'Ascensor', en: 'Elevator' }, 10 + F * 2, 'inst');
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
