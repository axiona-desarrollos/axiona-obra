/* ==========================================================================
   AXIONA OBRA · Cubierta
   --------------------------------------------------------------------------
   Plana con antepecho, a dos aguas o a cuatro aguas sobre la huella. La
   cumbrera va paralela al lado largo. Los planos del techo pasan por el
   enrase de los muros (zb) y bajan hasta el borde del alero. De aqui salen
   el 3D, la planta de cubierta, las fachadas, los cortes y las cantidades.
   ========================================================================== */

import { r2 } from './geometria.js';

/**
 * @param R   huella {x0,x1,y0,y1}
 * @param zb  cota del enrase de muros (cara superior de la ultima losa o viga)
 * @param opt {tipo:'plana'|'dos'|'cuatro', pend: %, alero: m}
 */
export function cubierta(R, zb, opt = {}) {
  const tipo = ['plana', 'dos', 'cuatro'].includes(opt.tipo) ? opt.tipo : 'plana';
  const p = tipo === 'plana' ? 0 : Math.max(5, +opt.pend || 30) / 100;
  const a = tipo === 'plana' ? 0 : Math.max(0, +opt.alero || 0);
  const E = { x0: R.x0 - a, x1: R.x1 + a, y0: R.y0 - a, y1: R.y1 + a };
  const W = E.x1 - E.x0, D = E.y1 - E.y0;
  const dir = W >= D ? 'x' : 'y';
  const zA = zb - a * p;
  const xm = (E.x0 + E.x1) / 2, ym = (E.y0 + E.y1) / 2;
  const caras = [], cumbreras = [], limas = [], timpanos = [];

  /** Cota de la cara superior del techo en (x, y). */
  const altura = (x, y) => {
    if (tipo === 'plana') return zb;
    const dx = Math.min(x - E.x0, E.x1 - x), dy = Math.min(y - E.y0, E.y1 - y);
    if (tipo === 'dos') return zA + p * Math.max(0, dir === 'x' ? dy : dx);
    return zA + p * Math.max(0, Math.min(dx, dy));
  };

  let zR = zb;
  if (tipo === 'dos') {
    if (dir === 'x') {
      zR = zA + p * D / 2;
      caras.push({ pts: [[E.x0, E.y0, zA], [E.x1, E.y0, zA], [E.x1, ym, zR], [E.x0, ym, zR]], n: [0, -1] });
      caras.push({ pts: [[E.x1, E.y1, zA], [E.x0, E.y1, zA], [E.x0, ym, zR], [E.x1, ym, zR]], n: [0, 1] });
      cumbreras.push([[E.x0, ym, zR], [E.x1, ym, zR]]);
      const zt = zb + p * (R.y1 - R.y0) / 2;
      timpanos.push({ x: R.x0, pts: [[R.x0, R.y0, zb], [R.x0, R.y1, zb], [R.x0, ym, zt]] }, { x: R.x1, pts: [[R.x1, R.y1, zb], [R.x1, R.y0, zb], [R.x1, ym, zt]] });
    } else {
      zR = zA + p * W / 2;
      caras.push({ pts: [[E.x0, E.y1, zA], [E.x0, E.y0, zA], [xm, E.y0, zR], [xm, E.y1, zR]], n: [-1, 0] });
      caras.push({ pts: [[E.x1, E.y0, zA], [E.x1, E.y1, zA], [xm, E.y1, zR], [xm, E.y0, zR]], n: [1, 0] });
      cumbreras.push([[xm, E.y0, zR], [xm, E.y1, zR]]);
      const zt = zb + p * (R.x1 - R.x0) / 2;
      timpanos.push({ y: R.y0, pts: [[R.x0, R.y0, zb], [R.x1, R.y0, zb], [xm, R.y0, zt]] }, { y: R.y1, pts: [[R.x1, R.y1, zb], [R.x0, R.y1, zb], [xm, R.y1, zt]] });
    }
  } else if (tipo === 'cuatro') {
    const half = Math.min(W, D) / 2;
    zR = zA + p * half;
    if (dir === 'x') {
      const r0 = [E.x0 + half, ym, zR], r1 = [E.x1 - half, ym, zR];
      caras.push({ pts: [[E.x0, E.y0, zA], [E.x1, E.y0, zA], r1, r0], n: [0, -1] });
      caras.push({ pts: [[E.x1, E.y1, zA], [E.x0, E.y1, zA], r0, r1], n: [0, 1] });
      caras.push({ pts: [[E.x0, E.y1, zA], [E.x0, E.y0, zA], r0], n: [-1, 0] });
      caras.push({ pts: [[E.x1, E.y0, zA], [E.x1, E.y1, zA], r1], n: [1, 0] });
      if (r1[0] - r0[0] > 0.01) cumbreras.push([r0, r1]);
      limas.push([[E.x0, E.y0, zA], r0], [[E.x0, E.y1, zA], r0], [[E.x1, E.y0, zA], r1], [[E.x1, E.y1, zA], r1]);
    } else {
      const r0 = [xm, E.y0 + half, zR], r1 = [xm, E.y1 - half, zR];
      caras.push({ pts: [[E.x0, E.y1, zA], [E.x0, E.y0, zA], r0, r1], n: [-1, 0] });
      caras.push({ pts: [[E.x1, E.y0, zA], [E.x1, E.y1, zA], r1, r0], n: [1, 0] });
      caras.push({ pts: [[E.x0, E.y0, zA], [E.x1, E.y0, zA], r0], n: [0, -1] });
      caras.push({ pts: [[E.x1, E.y1, zA], [E.x0, E.y1, zA], r1], n: [0, 1] });
      if (r1[1] - r0[1] > 0.01) cumbreras.push([r0, r1]);
      limas.push([[E.x0, E.y0, zA], r0], [[E.x1, E.y0, zA], r0], [[E.x0, E.y1, zA], r1], [[E.x1, E.y1, zA], r1]);
    }
  }

  const areaPlanta = W * D;
  const area = tipo === 'plana' ? (R.x1 - R.x0) * (R.y1 - R.y0) : areaPlanta * Math.sqrt(1 + p * p);
  // Canales en los bordes bajos; bajantes en las esquinas (o sifones en la plana).
  const canal = tipo === 'plana' ? 0 : tipo === 'dos' ? 2 * (dir === 'x' ? W : D) : 2 * (W + D);
  const bajantes = tipo === 'plana'
    ? [[R.x0 + 0.35, R.y1 - 0.35], [R.x1 - 0.35, R.y1 - 0.35]]
    : tipo === 'dos'
      ? (dir === 'x' ? [[E.x0, E.y0], [E.x1, E.y0], [E.x0, E.y1], [E.x1, E.y1]] : [[E.x0, E.y0], [E.x0, E.y1], [E.x1, E.y0], [E.x1, E.y1]])
      : [[E.x0, E.y0], [E.x1, E.y0], [E.x0, E.y1], [E.x1, E.y1]];

  return {
    tipo, p, pend: r2(p * 100), alero: a, E, W, D, dir, zb, zA, zR: tipo === 'plana' ? zb + 0.9 : zR,
    antepecho: tipo === 'plana' ? 0.9 : 0, caras, cumbreras, limas, timpanos, altura,
    area: r2(area), areaPlanta: r2(areaPlanta), canal: r2(canal), bajantes,
  };
}
