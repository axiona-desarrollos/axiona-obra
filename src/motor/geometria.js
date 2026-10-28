/* ==========================================================================
   AXIONA OBRA · Geometria basica
   --------------------------------------------------------------------------
   Poligonos, interpolacion del terreno, intervalos sobre una linea y el
   MARCO DEL FRENTE: todo el motor trabaja en un sistema local donde el
   frente del lote es el eje x y el lote queda hacia y positivo. Asi la casa
   se alinea con la calle aunque el lote venga girado (medido en AR, por
   ejemplo), en vez de quedar en diagonal y achicarse.
   ========================================================================== */

export const EPS = 1e-6;
export const r2 = v => Math.round(v * 100) / 100;
export const snap = (v, s = 0.05) => Math.round(Math.round(v / s) * s * 100) / 100;
export const near = (a, b, e = 0.011) => Math.abs(a - b) < e;
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const deg = r => r * 180 / Math.PI;

export function polyArea(p) {
  let a = 0;
  for (let i = 0; i < p.length; i++) { const q = p[i], w = p[(i + 1) % p.length]; a += q.x * w.y - w.x * q.y; }
  return a / 2;
}

/** ¿Esta (x, y) dentro del poligono? (rayo par-impar) */
export function pip(x, y, p) {
  let c = false;
  for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
    const a = p[i], b = p[j];
    if (((a.y > y) !== (b.y > y)) && (x < (b.x - a.x) * (y - a.y) / (b.y - a.y) + a.x)) c = !c;
  }
  return c;
}

/** Azimut en grados desde el norte (+y), en sentido horario. */
export const azimuth = (dx, dy) => (deg(Math.atan2(dx, dy)) + 360) % 360;

export function dms(a) {
  const d = Math.floor(a), m = Math.round((a - d) * 60);
  return m === 60 ? `${d + 1}°00'` : `${d}°${String(m).padStart(2, '0')}'`;
}

/** Cota del terreno por distancia inversa al cuadrado (IDW). */
export function makeZ(pts) {
  return (x, y) => {
    let sw = 0, sz = 0;
    for (const p of pts) {
      const d2 = (x - p.x) ** 2 + (y - p.y) ** 2;
      if (d2 < 1e-6) return p.z;
      const w = 1 / d2; sw += w; sz += w * p.z;
    }
    return sz / sw;
  };
}

function solve3(A, b) {
  const m = A.map((r, i) => [...r, b[i]]);
  for (let c = 0; c < 3; c++) {
    let p = c;
    for (let r = c + 1; r < 3; r++) if (Math.abs(m[r][c]) > Math.abs(m[p][c])) p = r;
    [m[c], m[p]] = [m[p], m[c]];
    if (Math.abs(m[c][c]) < 1e-12) return null;
    for (let r = 0; r < 3; r++) if (r !== c) { const f = m[r][c] / m[c][c]; for (let k = c; k < 4; k++) m[r][k] -= f * m[c][k]; }
  }
  return [m[0][3] / m[0][0], m[1][3] / m[1][1], m[2][3] / m[2][2]];
}

/** Plano z = a x + b y + c por minimos cuadrados. */
export function fitPlane(pts) {
  let sxx = 0, sxy = 0, syy = 0, sx = 0, sy = 0, sxz = 0, syz = 0, sz = 0;
  const n = pts.length;
  for (const p of pts) { sxx += p.x * p.x; sxy += p.x * p.y; syy += p.y * p.y; sx += p.x; sy += p.y; sxz += p.x * p.z; syz += p.y * p.z; sz += p.z; }
  const s = solve3([[sxx, sxy, sx], [sxy, syy, sy], [sx, sy, n]], [sxz, syz, sz]);
  return s ? { a: s[0], b: s[1], c: s[2] } : { a: 0, b: 0, c: sz / n };
}

/* ---------- intervalos sobre una linea ---------- */
export function ivUnion(list) {
  const s = list.map(v => [Math.min(v[0], v[1]), Math.max(v[0], v[1])]).sort((a, b) => a[0] - b[0]);
  const out = [];
  for (const iv of s) { const l = out[out.length - 1]; if (l && iv[0] <= l[1] + 0.011) l[1] = Math.max(l[1], iv[1]); else out.push([...iv]); }
  return out;
}

export function ivSubtract(ivs, cuts) {
  let cur = ivs.map(v => [...v]);
  for (const [ca, cb] of cuts) {
    const nx = [];
    for (const [a, b] of cur) {
      if (cb <= a + EPS || ca >= b - EPS) { nx.push([a, b]); continue; }
      if (ca > a + 0.011) nx.push([a, ca]);
      if (cb < b - 0.011) nx.push([cb, b]);
    }
    cur = nx;
  }
  return cur.filter(v => v[1] - v[0] > 0.011);
}

/** Rectangulo R menos el vacio V (para la losa con el hueco de la escalera). */
export function rectMinus(R, V) {
  if (!V) return [R];
  const out = [];
  if (V.x0 > R.x0 + EPS) out.push({ x0: R.x0, x1: V.x0, y0: R.y0, y1: R.y1 });
  if (V.x1 < R.x1 - EPS) out.push({ x0: V.x1, x1: R.x1, y0: R.y0, y1: R.y1 });
  if (V.y0 > R.y0 + EPS) out.push({ x0: V.x0, x1: V.x1, y0: R.y0, y1: V.y0 });
  if (V.y1 < R.y1 - EPS) out.push({ x0: V.x0, x1: V.x1, y0: V.y1, y1: R.y1 });
  return out;
}

/** Tramo de muro que comparten dos rectangulos, o null. */
export function shared(a, b) {
  const ov = (p0, p1, q0, q1) => [Math.max(p0, q0), Math.min(p1, q1)];
  if (near(a.x1, b.x0) || near(a.x0, b.x1)) {
    const [s, e] = ov(a.y0, a.y1, b.y0, b.y1);
    if (e - s > 0.05) return { o: 'V', c: near(a.x1, b.x0) ? a.x1 : a.x0, a: s, b: e };
  } else if (near(a.y1, b.y0) || near(a.y0, b.y1)) {
    const [s, e] = ov(a.x0, a.x1, b.x0, b.x1);
    if (e - s > 0.05) return { o: 'H', c: near(a.y1, b.y0) ? a.y1 : a.y0, a: s, b: e };
  }
  return null;
}

/**
 * Marco del frente: el lado `frente` del lote (de Pi a Pi+1) pasa a ser el
 * eje x local, con el lote hacia y positivo. Siempre es un giro, nunca un
 * espejo: si los vertices vienen en sentido horario se recorre el frente al
 * reves, para que los rotulos de los planos no salgan invertidos.
 */
export function marcoDelFrente(lot, frente = 0) {
  const n = lot.length;
  const i = ((frente % n) + n) % n;
  let a = lot[i], b = lot[(i + 1) % n];
  if (polyArea(lot) < 0) [a, b] = [b, a];
  const L = Math.hypot(b.x - a.x, b.y - a.y) || 1;
  const ux = (b.x - a.x) / L, uy = (b.y - a.y) / L;
  const vx = -uy, vy = ux;                       // a la izquierda del frente: hacia el lote
  return {
    origen: { x: a.x, y: a.y }, u: { x: ux, y: uy }, v: { x: vx, y: vy },
    aLocal: p => ({ ...p, x: (p.x - a.x) * ux + (p.y - a.y) * uy, y: (p.x - a.x) * vx + (p.y - a.y) * vy }),
    aMundo: p => ({ ...p, x: a.x + p.x * ux + p.y * vx, y: a.y + p.x * uy + p.y * vy }),
    /** El norte (+y del mundo) visto en el marco local. */
    norte: { x: uy, y: vy },
  };
}

/** Generador pseudoaleatorio con semilla: la misma entrada da la misma casa. */
export function azarConSemilla(semilla) {
  let s = semilla >>> 0;
  return () => {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
