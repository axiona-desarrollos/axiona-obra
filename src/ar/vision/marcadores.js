/* ==========================================================================
   AXIONA AR · Marcadores
   --------------------------------------------------------------------------
   Cada marcador es una cuadrícula de 6 × 6 celdas: un borde negro de una
   celda y adentro 4 × 4 bits (1 = celda blanca). Alrededor va una franja
   blanca de una celda para que el borde se distinga del fondo.
   Los 16 códigos se escogieron por computador: entre dos marcadores, y entre
   un marcador y sus propias rotaciones, hay al menos 5 celdas distintas
   (tests/ar.test.js lo comprueba). Así una o dos celdas mal leídas nunca
   cambian un marcador por otro ni confunden su orientación.
   ========================================================================== */

export const BITS = 4;           // bits por lado
export const CELDAS = BITS + 2;  // con el borde negro

export const CODIGOS = [
  0x3f04, 0x57b2, 0x620b, 0x072d, 0xe304, 0x6072, 0xc8b2, 0x0b99,
  0x8a25, 0xa2b6, 0x406d, 0x40db, 0xc8c1, 0xa2a9, 0x8ad7, 0x89e6,
];

/** Bit de la fila r y la columna c (0 arriba a la izquierda). */
export const bit = (codigo, r, c) => (codigo >> (r * BITS + c)) & 1;

/** Gira el código 90° en el sentido del reloj. */
export function rotar(codigo) {
  let o = 0;
  for (let r = 0; r < BITS; r++) for (let c = 0; c < BITS; c++) o |= bit(codigo, BITS - 1 - c, r) << (r * BITS + c);
  return o;
}

export function distancia(a, b) {
  let x = a ^ b, n = 0;
  while (x) { n += x & 1; x >>>= 1; }
  return n;
}

/**
 * Busca el código leído en el diccionario, en sus cuatro giros.
 * Devuelve { id, giros, errores } o null. giros = cuántas veces hay que girar
 * lo leído 90° en el sentido del reloj para que quede derecho.
 */
export function identificar(leido, maxErrores = 1) {
  let mejor = null, c = leido;
  for (let g = 0; g < 4; g++) {
    for (let id = 0; id < CODIGOS.length; id++) {
      const e = distancia(c, CODIGOS[id]);
      if (e <= maxErrores && (!mejor || e < mejor.errores)) mejor = { id, giros: g, errores: e };
    }
    c = rotar(c);
  }
  return mejor;
}

/** Matriz 6 × 6 de celdas (1 = blanca) del marcador id, para dibujarlo o imprimirlo. */
export function celdas(id) {
  const cod = CODIGOS[id];
  return [...Array(CELDAS)].map((_, r) => [...Array(CELDAS)].map((_, c) => {
    if (r === 0 || c === 0 || r === CELDAS - 1 || c === CELDAS - 1) return 0;
    return bit(cod, r - 1, c - 1);
  }));
}

/** SVG del marcador con su franja blanca; lado en las unidades que se pidan. */
export function svgMarcador(id, lado = 100, { etiqueta = true } = {}) {
  const m = celdas(id), k = lado / (CELDAS + 2), negros = [];
  m.forEach((fila, r) => fila.forEach((v, c) => { if (!v) negros.push(`M${(c + 1) * k} ${(r + 1) * k}h${k}v${k}h${-k}z`); }));
  const txt = etiqueta ? `<text x="${lado / 2}" y="${lado - k * 0.3}" font-size="${k * 0.45}" text-anchor="middle" font-family="sans-serif" fill="#555">Axiona AR · ${id}</text>` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${lado} ${lado}" width="${lado}" height="${lado}"><rect width="${lado}" height="${lado}" fill="#fff"/><path d="${negros.join('')}" fill="#000"/>${txt}</svg>`;
}
