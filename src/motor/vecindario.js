/* ==========================================================================
   AXIONA OBRA · Vecindario
   --------------------------------------------------------------------------
   Lo que rodea al lote en el 3D para que la casa se lea en su cuadra y no en
   un potrero: los vecinos de los lados, la fila de atras y la de enfrente.

   Son volumenes de contexto, no un levantamiento: sus medidas salen del lote
   y del pais (frente parecido, uno a tres pisos, techo tipico). Entre
   medianeras los vecinos quedan pegados al lindero; con retiro lateral quedan
   aislados; en vereda o en lotes grandes no hay vecinos, solo paisaje.
   Todo es determinista: el mismo lote da siempre la misma cuadra.
   ========================================================================== */

import { pais as paisDe } from './paises.js';

const PALETAS = {
  CO: [0xe9e2d3, 0xd9c2a3, 0xc98f6b, 0xf2efe8, 0xb9c4c9, 0xe3d08f, 0xa9b89a],
  MX: [0xe8dcc4, 0xd98e5f, 0xf0ebe0, 0xc9a66b, 0xb7c2c7, 0xe6c35c, 0xcf7f73],
  ES: [0xf3efe6, 0xe8dcc0, 0xd9c9a8, 0xf7f4ee, 0xe2cfa9, 0xcdb894],
  CA: [0xd8dcdf, 0x8f9aa3, 0xb7a58e, 0x6f7f8a, 0xe6e1d6, 0x9c8f7d, 0x556270],
};

/** Aleatorio determinista (mulberry32) sembrado con la geometria del lote. */
function azar(semilla) {
  let a = semilla >>> 0;
  return () => {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

/** Alcance de la cuadra a cada lado del lote, en metros. */
export const ALCANCE = 38;

/**
 * @returns {{ tipo: 'medianera'|'aislada'|'campestre', via: {x0:number,x1:number}, casas: object[], postes: number[], yEnfrente: number }}
 */
export function vecindario(M, S) {
  const V = M.exterior?.via;
  const vacio = { tipo: 'campestre', via: V ? { x0: V.x0, x1: V.x1 } : null, casas: [], postes: [], yEnfrente: 0 };
  if (!V) return vacio;
  const lx0 = V.lote.x0, lx1 = V.lote.x1, w = Math.max(5, lx1 - lx0);
  // postes: en el anden del lote, nunca delante de la fachada ni en la linea de la camara inicial
  const postes = [];
  for (let x = lx0 - 6; x > V.x0 + 1; x -= 16) postes.push(+x.toFixed(2));
  for (let x = lx1 + 14; x < V.x1 - 1; x += 16) postes.push(+x.toFixed(2));
  const zona = S.proyecto?.zona;
  if (zona === 'rural' || zona === 'remota' || M.lotArea >= 1000 || w > 40) return { ...vacio, postes };

  const lat = +S.ret?.lat || 0, medianera = lat < 0.5;
  const fondo = Math.max(...M.lot.map(p => p.y)), R = M.R, F = M.F || 1, fh = M.fh || 2.8;
  const P = paisDe(S.pais), techo = P.cubierta.tipo === 'plana' ? 'plana' : 'dos';
  const paleta = PALETAS[S.pais] || PALETAS.CO;
  const rnd = azar(Math.round(w * 131 + fondo * 977 + F * 31 + M.lot.length * 7) + S.pais.charCodeAt(0) * 53);
  const entre = (a, b) => a + (b - a) * rnd();
  const pisos = () => Math.max(1, Math.min(4, F + Math.round(entre(-1.2, 1.2))));
  const via = { x0: lx0 - ALCANCE, x1: lx1 + ALCANCE };
  const casas = [];
  const casa = (fila, x0, x1, y0, y1) => {
    if (x1 - x0 < 3.5 || y1 - y0 < 4) return;
    const n = pisos();
    casas.push({ fila, x0: +x0.toFixed(2), x1: +x1.toFixed(2), y0: +y0.toFixed(2), y1: +y1.toFixed(2), pisos: n, alto: +(n * fh + 0.35).toFixed(2), techo, color: paleta[Math.floor(rnd() * paleta.length)] });
  };
  /** Reparte lotes a lo largo de x entre a y b y llama a f con cada tramo. */
  const repartir = (a, b, f, haciaIzq = false) => {
    let x = haciaIzq ? b : a;
    while (haciaIzq ? x > a + 4 : x < b - 4) {
      const ancho = Math.min(haciaIzq ? x - a : b - x, w * entre(0.85, 1.2));
      if (haciaIzq) { f(x - ancho, x); x -= ancho; } else { f(x, x + ancho); x += ancho; }
    }
  };
  const sep = medianera ? 0.02 : Math.max(1, lat);
  const frenteCasa = R ? R.y0 : (+S.ret?.front || 2), fondoCasa = R ? R.y1 : fondo - 3;

  // vecinos de los lados: misma linea de fachada, con un poco de variacion
  const lado = (x0, x1) => casa('lado', x0 + sep, x1 - sep, Math.max(0.5, frenteCasa + (medianera ? entre(-0.3, 0.6) : entre(-1, 1.5))), Math.min(fondo - 1.5, fondoCasa + entre(-1.5, 1.5)));
  repartir(lx1, via.x1, lado);
  repartir(via.x0, lx0, lado, true);
  // fila de atras: da a la calle paralela, con su patio contra nuestro fondo
  const prof = Math.min(14, Math.max(8, fondoCasa - frenteCasa));
  repartir(via.x0, via.x1, (x0, x1) => casa('atras', x0 + sep, x1 - sep, fondo + entre(2.5, 4), fondo + entre(2.5, 4) + prof));
  // fila de enfrente: al otro lado de la via
  const yO = -(V.anden * 2 + V.calzada), yEnfrente = yO - (medianera ? 0.3 : 2.5);
  repartir(via.x0, via.x1, (x0, x1) => casa('enfrente', x0 + sep, x1 - sep, yEnfrente - prof, yEnfrente - entre(0, 0.8)));
  return { tipo: medianera ? 'medianera' : 'aislada', via, casas, postes: postes.concat(postesLejos(lx0, lx1, via)), yEnfrente };
}

/** Postes de la cuadra extendida, mas alla de la via original. */
function postesLejos(lx0, lx1, via) {
  const out = [];
  for (let x = lx0 - 6 - 16; x > via.x0 + 1; x -= 16) if (x < lx0 - 14) out.push(+x.toFixed(2));
  for (let x = lx1 + 14 + 16; x < via.x1 - 1; x += 16) if (x > lx1 + 14) out.push(+x.toFixed(2));
  return out;
}
