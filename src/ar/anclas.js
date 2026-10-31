/* ==========================================================================
   AXIONA AR · Anclas en el lote
   --------------------------------------------------------------------------
   Dónde queda la casa respecto a cada marcador puesto en una esquina del
   lote. El marcador k va con su centro en Pk y su borde de arriba (la
   flecha) hacia Pk+1, plano en el suelo.
   Coordenadas del modelo para llevar: x del frente, y arriba (0 = nivel del
   piso terminado), z hacia el frente, con el origen en el centro de la huella.
   Coordenadas del marcador: x a la derecha de la flecha, y en la flecha,
   z arriba, origen en su centro.
   ========================================================================== */

import * as THREE from 'three';

/** Matriz que lleva un punto del modelo al plano del marcador k (1 = P1). */
export function modeloAMarcadorLote(M, k) {
  const L = M.lot, n = L.length;
  const O = L[k - 1], S = L[k % n];
  let dx = S.x - O.x, dy = S.y - O.y;
  const l = Math.hypot(dx, dy) || 1; dx /= l; dy /= l;
  const cx = (M.R.x0 + M.R.x1) / 2, cy = (M.R.y0 + M.R.y1) / 2;
  const aLote = new THREE.Matrix4().set(1, 0, 0, cx, 0, 0, -1, cy, 0, 1, 0, M.dl, 0, 0, 0, 1);
  const aMarcador = new THREE.Matrix4().set(dy, -dx, 0, -(dy * O.x - dx * O.y), dx, dy, 0, -(dx * O.x + dy * O.y), 0, 0, 1, -(O.z || 0), 0, 0, 0, 1);
  return aMarcador.multiply(aLote);
}

/** Punto del lote (x, y del marco del frente, cota z) en coordenadas del modelo. */
export function loteAModelo(M, p) {
  const cx = (M.R.x0 + M.R.x1) / 2, cy = (M.R.y0 + M.R.y1) / 2;
  return new THREE.Vector3(p.x - cx, (p.z || 0) - M.dl, -(p.y - cy));
}
