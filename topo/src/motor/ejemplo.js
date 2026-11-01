/* ==========================================================================
   AXIONA TOPO · Lote de ejemplo
   --------------------------------------------------------------------------
   Un lote campestre en ladera (unos 2.000 m², 7 m de desnivel), como los de
   cabañas y glamping del oriente antioqueño: cinco esquinas y una reja de
   puntos de nivel por dentro. Sirve para ver todo sin salir a medir.
   ========================================================================== */

import { normalizar } from './levantamiento.js';
import { dentro } from './poligono.js';

const r2 = v => Math.round(v * 100) / 100;
const terreno = (x, y) => 0.115 * y + 1.3 * Math.sin(x / 8.5) + 0.7 * Math.cos(y / 6.5) + 0.018 * x - 0.35 * Math.sin((x + y) / 5);

export function lotedeEjemplo() {
  const esq = [[0, 0], [43, -2.5], [48, 24], [39, 51], [3, 47]];
  const z0 = terreno(0, 0);
  const puntos = esq.map(([x, y], i) => ({ id: `P${i + 1}`, tipo: 'esquina', x, y, z: r2(terreno(x, y) - z0), fuente: 'camara', prec: 0.03 }));
  const poli = esq.map(([x, y]) => ({ x, y }));
  let n = 0;
  for (let x = 5; x <= 45; x += 7.5) {
    for (let y = 4; y <= 48; y += 7) {
      const xx = x + ((y * 7) % 3) - 1, yy = y + ((x * 3) % 2);
      if (!dentro(xx, yy, poli)) continue;
      puntos.push({ id: `N${++n}`, tipo: 'nivel', x: r2(xx), y: r2(yy), z: r2(terreno(xx, yy) - z0), fuente: 'mira', prec: 0.06 });
    }
  }
  return normalizar({ nombre: 'Ejemplo · lote campestre en ladera', metodo: 'ejemplo', puntos });
}
