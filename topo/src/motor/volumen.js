/* ==========================================================================
   AXIONA TOPO · Movimiento de tierra
   --------------------------------------------------------------------------
   Volumen entre el terreno (la red de triangulos) y una plataforma
   horizontal a la cota Z0. En cada triangulo la altura h = z - Z0 varia en
   linea recta, asi que la integral es exacta:
     - si los tres vertices quedan del mismo lado: V = A·(h1+h2+h3)/3;
     - si uno queda solo de su lado (h1), su cuna vale A·h1³/(3·(h1-h2)·(h1-h3))
       y el resto sale por diferencia.
   Lo que queda por encima de la plataforma es CORTE (tierra que se saca) y
   lo que queda por debajo es RELLENO (tierra que se pone).
   La plataforma que no saca ni pone tierra es la cota media del terreno
   (volumen bajo el terreno / area): ahi corte = relleno.
   ========================================================================== */

/** Corte y relleno de un triangulo de area A con alturas h sobre la plataforma. */
export function corteRelleno(A, h) {
  const total = A * (h[0] + h[1] + h[2]) / 3;
  const arriba = h.filter(v => v > 0).length;
  if (arriba === 3) return { corte: total, relleno: 0 };
  if (arriba === 0) return { corte: 0, relleno: -total };
  if (arriba === 1) {
    const i = h.findIndex(v => v > 0), hp = h[i], [ha, hb] = h.filter((_, j) => j !== i);
    const c = A * hp ** 3 / (3 * (hp - ha) * (hp - hb));
    return { corte: c, relleno: c - total };
  }
  const i = h.findIndex(v => v <= 0), hn = h[i], [ha, hb] = h.filter((_, j) => j !== i);
  const r = hn === 0 ? 0 : -A * hn ** 3 / (3 * (hn - ha) * (hn - hb));
  return { corte: total + r, relleno: r };
}

const area2 = (a, b, c) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);

/** Recorta un poligono (con cota) contra un poligono convexo; la cota se
    interpola en linea recta sobre cada borde (Sutherland-Hodgman). */
export function recortar(poli, convexo) {
  let C = convexo;
  let s = 0;
  for (let i = 0; i < C.length; i++) { const p = C[i], q = C[(i + 1) % C.length]; s += p.x * q.y - q.x * p.y; }
  if (s < 0) C = [...C].reverse();
  let out = poli;
  for (let i = 0; i < C.length && out.length; i++) {
    const A = C[i], B = C[(i + 1) % C.length], entra = out;
    out = [];
    const lado = p => area2(A, B, p);
    for (let k = 0; k < entra.length; k++) {
      const p = entra[k], q = entra[(k + 1) % entra.length], sp = lado(p), sq = lado(q);
      if (sp >= 0) out.push(p);
      if ((sp >= 0) !== (sq >= 0)) {
        const t = sp / (sp - sq);
        out.push({ x: p.x + t * (q.x - p.x), y: p.y + t * (q.y - p.y), z: p.z + t * (q.z - p.z) });
      }
    }
  }
  return out;
}

/**
 * Corte y relleno contra la plataforma Z0, en todo el modelo o solo dentro
 * de `zona` (poligono convexo, por ejemplo la huella de la casa).
 * Devuelve m³ y m², y la cota media del terreno en esa zona.
 */
export function volumenes(T, Z0, zona = null) {
  const P = T.puntos;
  let corte = 0, relleno = 0, area = 0, bajo = 0;
  for (const [a, b, c] of T.triangulos) {
    const poli = zona ? recortar([P[a], P[b], P[c]], zona) : [P[a], P[b], P[c]];
    for (let k = 1; k < poli.length - 1; k++) {
      const t = [poli[0], poli[k], poli[k + 1]], A = Math.abs(area2(t[0], t[1], t[2])) / 2;
      if (A < 1e-12) continue;
      const r = corteRelleno(A, t.map(p => p.z - Z0));
      corte += r.corte; relleno += r.relleno; area += A;
      bajo += A * (t[0].z + t[1].z + t[2].z) / 3;
    }
  }
  return { corte, relleno, neto: corte - relleno, area, cotaMedia: area ? bajo / area : null };
}

/** Cota de la plataforma que deja corte = relleno. */
export const nivelDeEquilibrio = (T, zona = null) => volumenes(T, 0, zona).cotaMedia;

/**
 * Viajes de volqueta. La tierra que se saca se esponja: un metro cubico en
 * el sitio ocupa 1,25 m³ suelto en la volqueta (abundamiento del 25 %,
 * tierra comun; la arcilla llega al 30-40 %).
 */
export function viajes(m3, { abundamiento = 0.25, capacidad = 6 } = {}) {
  if (!(m3 > 0)) return 0;
  return Math.ceil(m3 * (1 + abundamiento) / capacidad - 1e-9);
}
