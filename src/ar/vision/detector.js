/* ==========================================================================
   AXIONA AR · Detector de marcadores
   --------------------------------------------------------------------------
   Visión por computador escrita aquí, sin librerías ni AR del celular:
   1. Gris y umbral adaptativo con imagen integral (aguanta sombras).
   2. Regiones oscuras conectadas y su contorno exterior (trazado de Moore).
   3. Polígono por Douglas-Peucker: se quedan los cuadriláteros convexos.
   4. Bordes refinados a subpíxel con el perfil de gris a lo largo de la
      normal; las esquinas salen de cruzar las cuatro rectas.
   5. Se leen las 6 × 6 celdas con una homografía, se exige el borde negro y
      se identifica el código en sus cuatro giros.
   Todo es puro (sin DOM): corre en un Web Worker y en las pruebas de Node.
   ========================================================================== */

import { CELDAS, BITS, identificar } from './marcadores.js';
import { homografia, aplicarH } from './pose.js';

/** Luma de 0 a 255 desde RGBA. */
export function gris(rgba, w, h, out = new Uint8Array(w * h)) {
  for (let i = 0, j = 0; i < w * h; i++, j += 4) out[i] = (rgba[j] * 77 + rgba[j + 1] * 150 + rgba[j + 2] * 29) >> 8;
  return out;
}

/** 1 donde el píxel es más oscuro que el promedio de su vecindad menos C. */
export function umbralAdaptativo(g, w, h, radio, C = 7, out = new Uint8Array(w * h)) {
  const W = w + 1, I = new Uint32Array(W * (h + 1));
  for (let y = 0; y < h; y++) {
    let fila = 0;
    for (let x = 0; x < w; x++) { fila += g[y * w + x]; I[(y + 1) * W + x + 1] = I[y * W + x + 1] + fila; }
  }
  for (let y = 0; y < h; y++) {
    const y0 = Math.max(0, y - radio), y1 = Math.min(h, y + radio + 1);
    for (let x = 0; x < w; x++) {
      const x0 = Math.max(0, x - radio), x1 = Math.min(w, x + radio + 1);
      const n = (x1 - x0) * (y1 - y0), s = I[y1 * W + x1] - I[y0 * W + x1] - I[y1 * W + x0] + I[y0 * W + x0];
      out[y * w + x] = g[y * w + x] * n < s - C * n ? 1 : 0;
    }
  }
  return out;
}

const DX = [-1, -1, 0, 1, 1, 1, 0, -1], DY = [0, -1, -1, -1, 0, 1, 1, 1];   // O, NO, N, NE, E, SE, S, SO (horario)
const DIR = (dx, dy) => DX.findIndex((v, i) => v === dx && DY[i] === dy);

/**
 * Contornos exteriores de las regiones oscuras (8-conexas) que no tocan el
 * borde de la imagen y cuyo recuadro mide entre minLado y maxLado píxeles.
 */
export function contornos(bin, w, h, { minLado = 10, maxLado = Infinity } = {}) {
  const et = new Int32Array(w * h), pila = new Int32Array(w * h), out = [];
  let n = 0;
  for (let i0 = 0; i0 < w * h; i0++) {
    if (!bin[i0] || et[i0]) continue;
    n++;
    let sp = 0, x0 = w, x1 = 0, y0 = h, y1 = 0, toca = false;
    pila[sp++] = i0; et[i0] = n;
    while (sp) {
      const i = pila[--sp], x = i % w, y = (i - x) / w;
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
      if (x === 0 || y === 0 || x === w - 1 || y === h - 1) toca = true;
      for (let d = 0; d < 8; d++) {
        const xx = x + DX[d], yy = y + DY[d];
        if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
        const j = yy * w + xx;
        if (bin[j] && !et[j]) { et[j] = n; pila[sp++] = j; }
      }
    }
    const lw = x1 - x0 + 1, lh = y1 - y0 + 1;
    if (toca || lw < minLado || lh < minLado || lw > maxLado || lh > maxLado) continue;
    out.push(trazar(et, w, h, i0, n));
  }
  return out;
}

/** Trazado de Moore del borde exterior de la región `e`, desde su primer píxel (arriba a la izquierda). */
function trazar(et, w, h, i0, e) {
  const sx = i0 % w, sy = (i0 - sx) / w, pts = [[sx, sy]];
  const es = (x, y) => x >= 0 && y >= 0 && x < w && y < h && et[y * w + x] === e;
  let x = sx, y = sy, atras = 0, primera = -1;
  for (let paso = 0; paso < 4 * w * h; paso++) {
    let d = -1;
    for (let k = 1; k <= 8; k++) { const dd = (atras + k) % 8; if (es(x + DX[dd], y + DY[dd])) { d = dd; break; } }
    if (d < 0) break;                                   // píxel suelto
    if (x === sx && y === sy) { if (primera === d) break; if (primera < 0) primera = d; }
    const bx = x + DX[(d + 7) % 8], by = y + DY[(d + 7) % 8];   // último vecino vacío revisado
    x += DX[d]; y += DY[d];
    atras = DIR(bx - x, by - y);
    if (atras < 0) atras = (d + 4) % 8;
    if (!(x === sx && y === sy)) pts.push([x, y]);
  }
  return pts;
}

function distSeg(p, a, b) {
  const vx = b[0] - a[0], vy = b[1] - a[1], L = vx * vx + vy * vy;
  if (!L) return Math.hypot(p[0] - a[0], p[1] - a[1]);
  return Math.abs(vx * (a[1] - p[1]) - vy * (a[0] - p[0])) / Math.sqrt(L);
}

function dp(pts, i0, i1, eps, marcas) {
  let m = -1, dmax = eps;
  for (let i = i0 + 1; i < i1; i++) { const d = distSeg(pts[i], pts[i0], pts[i1]); if (d > dmax) { dmax = d; m = i; } }
  if (m < 0) return;
  marcas.push(m); dp(pts, i0, m, eps, marcas); dp(pts, m, i1, eps, marcas);
}

/** Douglas-Peucker de un contorno cerrado: índices de los vértices en orden. */
export function aproximar(pts, eps) {
  const n = pts.length;
  if (n < 4) return [];
  let a = 0, b = 0, dmax = -1;
  for (let i = 0; i < n; i++) { const d = (pts[i][0] - pts[0][0]) ** 2 + (pts[i][1] - pts[0][1]) ** 2; if (d > dmax) { dmax = d; b = i; } }
  dmax = -1;
  for (let i = 0; i < n; i++) { const d = (pts[i][0] - pts[b][0]) ** 2 + (pts[i][1] - pts[b][1]) ** 2; if (d > dmax) { dmax = d; a = i; } }
  if (a > b) [a, b] = [b, a];
  const m = [a, b];
  dp(pts, a, b, eps, m);
  // el otro lado del contorno, dando la vuelta
  const vuelta = [...pts.slice(b), ...pts.slice(0, a + 1)], mv = [];
  dp(vuelta, 0, vuelta.length - 1, eps, mv);
  mv.forEach(i => m.push((b + i) % n));
  return [...new Set(m)].sort((p, q) => p - q);
}

const areaFirmada = q => q.reduce((s, p, i) => { const r = q[(i + 1) % q.length]; return s + p[0] * r[1] - r[0] * p[1]; }, 0) / 2;

/**
 * Si el polígono tiene 5 o 6 vértices porque una esquina salió mocha, quita
 * el vértice que menos área se lleva, mientras sea poca (menos del 3 %).
 */
function reducirA4(q) {
  if (q.length < 4 || q.length > 6) return null;
  const total = Math.abs(areaFirmada(q));
  while (q.length > 4) {
    let mejor = -1, menor = Infinity;
    q.forEach((p, i) => {
      const a = q[(i + q.length - 1) % q.length], b = q[(i + 1) % q.length];
      const tri = Math.abs((p[0] - a[0]) * (b[1] - a[1]) - (p[1] - a[1]) * (b[0] - a[0])) / 2;
      if (tri < menor) { menor = tri; mejor = i; }
    });
    if (menor > total * 0.03) return null;
    q = q.filter((_, i) => i !== mejor);
  }
  return q;
}

function convexo(q) {
  let signo = 0;
  for (let i = 0; i < 4; i++) {
    const a = q[i], b = q[(i + 1) % 4], c = q[(i + 2) % 4];
    const z = (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]);
    if (Math.abs(z) < 1e-9) return false;
    if (!signo) signo = Math.sign(z); else if (Math.sign(z) !== signo) return false;
  }
  return true;
}

/** Gris interpolado (bilineal) en (x, y). */
export function muestra(g, w, h, x, y) {
  if (x < 0 || y < 0 || x > w - 1 || y > h - 1) return -1;
  const x0 = Math.floor(x), y0 = Math.floor(y), x1 = Math.min(w - 1, x0 + 1), y1 = Math.min(h - 1, y0 + 1), fx = x - x0, fy = y - y0;
  const a = g[y0 * w + x0], b = g[y0 * w + x1], c = g[y1 * w + x0], d = g[y1 * w + x1];
  return a * (1 - fx) * (1 - fy) + b * fx * (1 - fy) + c * (1 - fx) * fy + d * fx * fy;
}

/** Recta por mínimos cuadrados totales: { p: centroide, d: dirección unitaria }. */
function ajustarRecta(pts) {
  const n = pts.length;
  const mx = pts.reduce((s, p) => s + p[0], 0) / n, my = pts.reduce((s, p) => s + p[1], 0) / n;
  let sxx = 0, syy = 0, sxy = 0;
  pts.forEach(([x, y]) => { sxx += (x - mx) ** 2; syy += (y - my) ** 2; sxy += (x - mx) * (y - my); });
  const ang = 0.5 * Math.atan2(2 * sxy, sxx - syy);
  return { p: [mx, my], d: [Math.cos(ang), Math.sin(ang)] };
}

function cruzar(r1, r2) {
  const det = r1.d[0] * r2.d[1] - r1.d[1] * r2.d[0];
  if (Math.abs(det) < 1e-9) return null;
  const dx = r2.p[0] - r1.p[0], dy = r2.p[1] - r1.p[1];
  const t = (dx * r2.d[1] - dy * r2.d[0]) / det;
  return [r1.p[0] + t * r1.d[0], r1.p[1] + t * r1.d[1]];
}

/**
 * Lleva cada lado del cuadrilátero al borde real (donde el gris cruza la
 * mitad entre el negro del marcador y el blanco de afuera) y recalcula las
 * esquinas cruzando las rectas.
 */
export function refinarEsquinas(g, w, h, q) {
  const cx = q.reduce((s, p) => s + p[0], 0) / 4, cy = q.reduce((s, p) => s + p[1], 0) / 4;
  const rectas = [];
  for (let i = 0; i < 4; i++) {
    const A = q[i], B = q[(i + 1) % 4], L = Math.hypot(B[0] - A[0], B[1] - A[1]);
    let nx = -(B[1] - A[1]) / L, ny = (B[0] - A[0]) / L;
    const mx = (A[0] + B[0]) / 2, my = (A[1] + B[1]) / 2;
    if ((mx - cx) * nx + (my - cy) * ny < 0) { nx = -nx; ny = -ny; }    // normal hacia afuera
    const alcance = Math.max(2, Math.min(4, L / 12)), pts = [];
    const nm = Math.max(6, Math.min(24, Math.round(L / 4)));
    for (let k = 0; k < nm; k++) {
      const t = 0.15 + 0.7 * (k + 0.5) / nm, px = A[0] + (B[0] - A[0]) * t, py = A[1] + (B[1] - A[1]) * t;
      const perfil = [];
      for (let s = -alcance; s <= alcance + 1e-9; s += 0.5) perfil.push([s, muestra(g, w, h, px + nx * s, py + ny * s)]);
      if (perfil.some(([, v]) => v < 0)) continue;
      const oscuro = Math.min(...perfil.slice(0, 3).map(p => p[1])), claro = Math.max(...perfil.slice(-3).map(p => p[1]));
      if (claro - oscuro < 20) continue;
      const mitad = (oscuro + claro) / 2;
      for (let j = 1; j < perfil.length; j++) {
        const [s0, v0] = perfil[j - 1], [s1, v1] = perfil[j];
        if (v0 <= mitad && v1 > mitad) { const s = s0 + (mitad - v0) / (v1 - v0) * (s1 - s0); pts.push([px + nx * s, py + ny * s]); break; }
      }
    }
    rectas.push(pts.length >= 3 ? ajustarRecta(pts) : { p: [(A[0] + B[0]) / 2, (A[1] + B[1]) / 2], d: [(B[0] - A[0]) / L, (B[1] - A[1]) / L] });
  }
  const r = [0, 1, 2, 3].map(i => cruzar(rectas[(i + 3) % 4], rectas[i]));
  if (r.some(p => !p)) return q;
  // si el refinamiento movió mucho una esquina, algo salió mal: se queda la original
  return r.every((p, i) => Math.hypot(p[0] - q[i][0], p[1] - q[i][1]) < 6) ? r : q;
}

/** Lee las 6 × 6 celdas del cuadrilátero q (horario) y devuelve sus grises promedio. */
export function leerCeldas(g, w, h, q) {
  const H = homografia([[0, 0], [1, 0], [1, 1], [0, 1]], q);
  if (!H) return null;
  const v = [];
  for (let r = 0; r < CELDAS; r++) for (let c = 0; c < CELDAS; c++) {
    let s = 0, n = 0;
    for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) {
      const [x, y] = aplicarH(H, (c + 0.3 + 0.2 * b) / CELDAS, (r + 0.3 + 0.2 * a) / CELDAS);
      const m = muestra(g, w, h, x, y);
      if (m >= 0) { s += m; n++; }
    }
    if (!n) return null;
    v.push(s / n);
  }
  return v;
}

/** Decodifica las celdas: { id, giros, errores } si el borde es negro y el código existe. */
export function decodificar(v) {
  const min = Math.min(...v), max = Math.max(...v);
  if (max - min < 25) return null;
  const um = (min + max) / 2;
  let fallasBorde = 0, cod = 0;
  for (let r = 0; r < CELDAS; r++) for (let c = 0; c < CELDAS; c++) {
    const blanco = v[r * CELDAS + c] > um;
    if (r === 0 || c === 0 || r === CELDAS - 1 || c === CELDAS - 1) { if (blanco) fallasBorde++; } else if (blanco) cod |= 1 << ((r - 1) * BITS + (c - 1));
  }
  if (fallasBorde > 1) return null;
  return identificar(cod, 1);
}

/**
 * Detecta los marcadores en una imagen gris.
 * @returns {{id:number, esquinas:number[][], errores:number}[]} esquinas en
 *   el orden del marcador: arriba-izquierda, arriba-derecha, abajo-derecha,
 *   abajo-izquierda (píxeles).
 */
export function detectar(g, w, h, { minLado = 10, radio = null, C = 7 } = {}) {
  const bin = umbralAdaptativo(g, w, h, radio ?? Math.max(5, Math.round(Math.min(w, h) / 40)), C);
  const cs = contornos(bin, w, h, { minLado, maxLado: Math.max(w, h) * 0.98 });
  const out = [];
  for (const pts of cs) {
    if (pts.length < 4 * minLado * 0.8) continue;
    // en perspectiva fuerte la esquina más aguda sale mocha: se prueba con más tolerancia
    // (las esquinas finales salen de cruzar los bordes refinados, así que no se pierde precisión)
    let idx = [];
    for (const f of [0.02, 0.03, 0.045]) { idx = aproximar(pts, Math.max(1.5, pts.length * f)); if (idx.length <= 4) break; }
    let q = reducirA4(idx.map(i => [pts[i][0], pts[i][1]]));
    if (!q) continue;
    if (areaFirmada(q) < 0) q.reverse();                    // horario en la imagen (y hacia abajo)
    if (!convexo(q)) continue;
    const lados = q.map((p, i) => Math.hypot(q[(i + 1) % 4][0] - p[0], q[(i + 1) % 4][1] - p[1]));
    if (Math.min(...lados) < minLado || Math.max(...lados) / Math.min(...lados) > 6) continue;
    q = refinarEsquinas(g, w, h, q);
    const v = leerCeldas(g, w, h, q);
    const dec = v && decodificar(v);
    if (!dec) continue;
    const ini = (4 - dec.giros) % 4;
    out.push({ id: dec.id, errores: dec.errores, esquinas: [0, 1, 2, 3].map(k => q[(ini + k) % 4]), lado: lados.reduce((s, l) => s + l, 0) / 4 });
  }
  // si dos detecciones del mismo id se solapan, gana la más grande
  return out.filter((d, i) => !out.some((o, j) => j !== i && o.id === d.id && o.lado > d.lado && Math.hypot(o.esquinas[0][0] - d.esquinas[0][0], o.esquinas[0][1] - d.esquinas[0][1]) < o.lado));
}
