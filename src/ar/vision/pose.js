/* ==========================================================================
   AXIONA AR · Geometría de la cámara
   --------------------------------------------------------------------------
   Convención de la cámara (la de visión por computador): x a la derecha,
   y hacia abajo, z hacia adelante. Un punto P del mundo se ve en
   u = fx·X/Z + cx, v = fy·Y/Z + cy, con (X, Y, Z) = R·P + t.
   El marcador vive en su propio plano: x a la derecha, y hacia arriba
   (hacia su borde de arriba), z saliendo del papel; su centro es el origen.

   1. Homografía de 4 puntos (DLT exacta, sistema de 8 × 8).
   2. Pose inicial desde la homografía: K⁻¹H = λ[r1 r2 t].
   3. Refinamiento de Gauss-Newton (Levenberg-Marquardt) sobre el error de
      reproyección de las 4 esquinas, con la rotación como vector de Rodrigues.
   4. Distancia focal desde la homografía (restricciones de ortogonalidad de
      Zhang con el punto principal en el centro): calibra el lente solo.
   ========================================================================== */

/** Resuelve A·x = b (A n×n en filas) por eliminación con pivoteo parcial. */
export function resolver(A, b) {
  const n = b.length, M = A.map((f, i) => [...f, b[i]]);
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    if (Math.abs(M[p][c]) < 1e-12) return null;
    [M[c], M[p]] = [M[p], M[c]];
    for (let r = c + 1; r < n; r++) {
      const k = M[r][c] / M[c][c];
      for (let j = c; j <= n; j++) M[r][j] -= k * M[c][j];
    }
  }
  const x = new Array(n).fill(0);
  for (let r = n - 1; r >= 0; r--) {
    let s = M[r][n];
    for (let j = r + 1; j < n; j++) s -= M[r][j] * x[j];
    x[r] = s / M[r][r];
  }
  return x;
}

/** Homografía H (3×3 en filas) que lleva cada src[i] = [x, y] a dst[i] = [u, v]. */
export function homografia(src, dst) {
  const A = [], b = [];
  for (let i = 0; i < 4; i++) {
    const [x, y] = src[i], [u, v] = dst[i];
    A.push([x, y, 1, 0, 0, 0, -u * x, -u * y]); b.push(u);
    A.push([0, 0, 0, x, y, 1, -v * x, -v * y]); b.push(v);
  }
  const h = resolver(A, b);
  return h ? [[h[0], h[1], h[2]], [h[3], h[4], h[5]], [h[6], h[7], 1]] : null;
}

export function aplicarH(H, x, y) {
  const w = H[2][0] * x + H[2][1] * y + H[2][2];
  return [(H[0][0] * x + H[0][1] * y + H[0][2]) / w, (H[1][0] * x + H[1][1] * y + H[1][2]) / w];
}

export function inversa3(m) {
  const [a, b, c] = m[0], [d, e, f] = m[1], [g, h, i] = m[2];
  const A = e * i - f * h, B = -(d * i - f * g), C = d * h - e * g;
  const det = a * A + b * B + c * C;
  if (Math.abs(det) < 1e-15) return null;
  return [
    [A / det, -(b * i - c * h) / det, (b * f - c * e) / det],
    [B / det, (a * i - c * g) / det, -(a * f - c * d) / det],
    [C / det, -(a * h - b * g) / det, (a * e - b * d) / det],
  ];
}

export const mul3 = (A, B) => A.map(f => [0, 1, 2].map(j => f[0] * B[0][j] + f[1] * B[1][j] + f[2] * B[2][j]));
const cruz = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norma = a => Math.hypot(a[0], a[1], a[2]);
const trasp = m => [0, 1, 2].map(j => [m[0][j], m[1][j], m[2][j]]);

/** Intrínsecos para un cuadro de w × h con campo de visión horizontal fovH (grados). */
export function intrinsecos(w, h, fovH = 65, f = null) {
  const fx = f || (w / 2) / Math.tan(fovH * Math.PI / 360);
  return { fx, fy: fx, cx: w / 2, cy: h / 2, w, h };
}

/** Rotación (3×3) desde un vector de Rodrigues. */
export function rodrigues(r) {
  const th = norma(r);
  if (th < 1e-12) return [[1, -r[2], r[1]], [r[2], 1, -r[0]], [-r[1], r[0], 1]];
  const [x, y, z] = r.map(v => v / th), c = Math.cos(th), s = Math.sin(th), C = 1 - c;
  return [
    [c + x * x * C, x * y * C - z * s, x * z * C + y * s],
    [y * x * C + z * s, c + y * y * C, y * z * C - x * s],
    [z * x * C - y * s, z * y * C + x * s, c + z * z * C],
  ];
}

/** Vector de Rodrigues desde una rotación. */
export function aRodrigues(R) {
  const tr = R[0][0] + R[1][1] + R[2][2], c = Math.max(-1, Math.min(1, (tr - 1) / 2)), th = Math.acos(c);
  if (th < 1e-9) return [0, 0, 0];
  if (Math.PI - th < 1e-6) {
    // giro de 180°: eje desde la diagonal
    const x = Math.sqrt(Math.max(0, (R[0][0] + 1) / 2)), y = Math.sqrt(Math.max(0, (R[1][1] + 1) / 2)) * Math.sign(R[0][1] || 1), z = Math.sqrt(Math.max(0, (R[2][2] + 1) / 2)) * Math.sign(R[0][2] || 1);
    return [x * th, y * th, z * th];
  }
  const k = th / (2 * Math.sin(th));
  return [(R[2][1] - R[1][2]) * k, (R[0][2] - R[2][0]) * k, (R[1][0] - R[0][1]) * k];
}

/** Ortonormaliza una matriz casi de rotación (descomposición polar iterativa). */
export function ortonormal(R) {
  let X = R;
  for (let k = 0; k < 8; k++) {
    const inv = inversa3(X);
    if (!inv) break;
    const it = trasp(inv);
    X = X.map((f, i) => f.map((v, j) => (v + it[i][j]) / 2));
  }
  return X;
}

export function proyectar(K, R, t, P) {
  const X = R[0][0] * P[0] + R[0][1] * P[1] + R[0][2] * P[2] + t[0];
  const Y = R[1][0] * P[0] + R[1][1] * P[1] + R[1][2] * P[2] + t[1];
  const Z = R[2][0] * P[0] + R[2][1] * P[1] + R[2][2] * P[2] + t[2];
  return [K.fx * X / Z + K.cx, K.fy * Y / Z + K.cy];
}

/** Esquinas del marcador en su plano (metros), en el orden de la imagen: arriba-izq, arriba-der, abajo-der, abajo-izq. */
export const esquinasMarcador = lado => [[-lado / 2, lado / 2, 0], [lado / 2, lado / 2, 0], [lado / 2, -lado / 2, 0], [-lado / 2, -lado / 2, 0]];

function errorRepro(K, R, t, P, uv) {
  let e = 0;
  for (let i = 0; i < P.length; i++) { const [u, v] = proyectar(K, R, t, P[i]); e += (u - uv[i][0]) ** 2 + (v - uv[i][1]) ** 2; }
  return Math.sqrt(e / P.length);
}

/** Pose inicial desde la homografía del plano del marcador. */
export function poseDeHomografia(H, K) {
  const Ki = [[1 / K.fx, 0, -K.cx / K.fx], [0, 1 / K.fy, -K.cy / K.fy], [0, 0, 1]];
  const A = mul3(Ki, H);
  let h1 = [A[0][0], A[1][0], A[2][0]], h2 = [A[0][1], A[1][1], A[2][1]], h3 = [A[0][2], A[1][2], A[2][2]];
  let l = 2 / (norma(h1) + norma(h2));
  if (h3[2] * l < 0) l = -l;            // el marcador queda delante de la cámara
  h1 = h1.map(v => v * l); h2 = h2.map(v => v * l); h3 = h3.map(v => v * l);
  const r3 = cruz(h1, h2);
  const R = ortonormal([[h1[0], h2[0], r3[0]], [h1[1], h2[1], r3[1]], [h1[2], h2[2], r3[2]]]);
  return { R, t: h3 };
}

/** Refina R, t minimizando el error de reproyección (LM con jacobiano numérico). */
export function refinarPose(K, R0, t0, P, uv, iter = 10) {
  let p = [...aRodrigues(R0), ...t0], lam = 1e-3;
  const res = q => {
    const R = rodrigues(q.slice(0, 3)), t = q.slice(3);
    const r = [];
    for (let i = 0; i < P.length; i++) { const [u, v] = proyectar(K, R, t, P[i]); r.push(u - uv[i][0], v - uv[i][1]); }
    return r;
  };
  let r = res(p), e = r.reduce((s, v) => s + v * v, 0);
  for (let k = 0; k < iter; k++) {
    const J = r.map(() => new Array(6).fill(0));
    for (let j = 0; j < 6; j++) {
      const d = j < 3 ? 1e-6 : 1e-6 * Math.max(1, Math.abs(p[5]));
      const q = [...p]; q[j] += d;
      const rq = res(q);
      for (let i = 0; i < r.length; i++) J[i][j] = (rq[i] - r[i]) / d;
    }
    const JtJ = [...Array(6)].map((_, a) => [...Array(6)].map((_, b) => J.reduce((s, f) => s + f[a] * f[b], 0)));
    const Jtr = [...Array(6)].map((_, a) => J.reduce((s, f, i) => s + f[a] * r[i], 0));
    let mejoro = false;
    for (let intento = 0; intento < 6 && !mejoro; intento++) {
      const Ad = JtJ.map((f, a) => f.map((v, b) => (a === b ? v * (1 + lam) + 1e-12 : v)));
      const dp = resolver(Ad, Jtr.map(v => -v));
      if (!dp) { lam *= 10; continue; }
      const q = p.map((v, i) => v + dp[i]), rq = res(q), eq = rq.reduce((s, v) => s + v * v, 0);
      if (eq < e) { p = q; r = rq; e = eq; lam = Math.max(1e-7, lam / 10); mejoro = true; } else lam *= 10;
    }
    if (!mejoro || e < 1e-10) break;
  }
  return { R: rodrigues(p.slice(0, 3)), t: p.slice(3), error: Math.sqrt(e / P.length) };
}

/**
 * Pose del marcador de lado `lado` (m) vista en las esquinas uv (px).
 * Devuelve { R, t, error } con R, t de marcador a cámara, o null.
 */
export function poseMarcador(uv, lado, K) {
  const P = esquinasMarcador(lado);
  const H = homografia(P.map(p => [p[0], p[1]]), uv);
  if (!H) return null;
  const ini = poseDeHomografia(H, K);
  if (!ini.R.every(f => f.every(Number.isFinite))) return null;
  const fin = refinarPose(K, ini.R, ini.t, P, uv);
  return fin.t[2] > 0 && fin.error < errorRepro(K, ini.R, ini.t, P, uv) + 1e-9 ? fin : { ...ini, error: errorRepro(K, ini.R, ini.t, P, uv) };
}

/**
 * Distancia focal (px) que explica la homografía de un cuadrado visto en perspectiva,
 * con el punto principal en (cx, cy). null si el marcador está casi de frente.
 */
export function focalDeHomografia(H, cx, cy) {
  // trasladar para que el punto principal quede en el origen
  const T = [[1, 0, -cx], [0, 1, -cy], [0, 0, 1]];
  const G = mul3(T, H);
  const [h11, h12] = [G[0][0], G[0][1]], [h21, h22] = [G[1][0], G[1][1]], [h31, h32] = [G[2][0], G[2][1]];
  const a1 = h11 * h12 + h21 * h22, b1 = h31 * h32;
  const a2 = h11 * h11 + h21 * h21 - h12 * h12 - h22 * h22, b2 = h31 * h31 - h32 * h32;
  const den = a1 * a1 + a2 * a2;
  if (den < 1e-18) return null;
  const x = -(a1 * b1 + a2 * b2) / den;   // x = 1 / f²
  if (!(x > 0)) return null;
  // la perspectiva tiene que ser fuerte para que el resultado sirva
  const escala = Math.hypot(h11, h21, h12, h22);
  if (Math.hypot(h31, h32) * Math.sqrt(1 / x) / escala < 0.12) return null;
  return 1 / Math.sqrt(x);
}

/** Filtro 1€ (Casiez et al. 2012): suave cuando el valor está quieto, ágil cuando se mueve. */
export class FiltroEuro {
  constructor({ minCorte = 1.2, beta = 0.02, corteD = 1 } = {}) { Object.assign(this, { minCorte, beta, corteD, x: null, dx: null, t: null }); }
  static alfa(corte, dt) { const tau = 1 / (2 * Math.PI * corte); return 1 / (1 + tau / dt); }
  filtrar(v, t) {
    if (this.x === null) { this.x = [...v]; this.dx = v.map(() => 0); this.t = t; return [...v]; }
    const dt = Math.max(1e-3, t - this.t); this.t = t;
    const ad = FiltroEuro.alfa(this.corteD, dt);
    this.dx = v.map((x, i) => ad * ((x - this.x[i]) / dt) + (1 - ad) * this.dx[i]);
    const vel = Math.hypot(...this.dx);
    const a = FiltroEuro.alfa(this.minCorte + this.beta * vel, dt);
    this.x = v.map((x, i) => a * x + (1 - a) * this.x[i]);
    return [...this.x];
  }
  reiniciar() { this.x = null; }
}
