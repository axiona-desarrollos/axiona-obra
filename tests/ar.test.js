import { describe, it, expect } from 'vitest';
import { CODIGOS, rotar, distancia, identificar, celdas, svgMarcador } from '../src/ar/vision/marcadores.js';
import { homografia, aplicarH, inversa3, intrinsecos, rodrigues, aRodrigues, poseMarcador, proyectar, esquinasMarcador, focalDeHomografia, FiltroEuro, mul3 } from '../src/ar/vision/pose.js';
import { detectar } from '../src/ar/vision/detector.js';

/* ---------- imágenes sintéticas: el marcador visto en perspectiva ---------- */

// generador pseudoaleatorio fijo para que la prueba siempre sea igual
const azar = (s => () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296)(7);

function fondo(w, h, tipo = 'ruido') {
  const g = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const base = tipo === 'gradiente' ? 90 + 120 * x / w : 140;
    g[y * w + x] = Math.max(0, Math.min(255, base + (azar() - 0.5) * 50 + 30 * Math.sin(x / 13) * Math.cos(y / 17)));
  }
  return g;
}

/** Dibuja el marcador id (lado en m) con pose R, t y cámara K sobre g; 3 × 3 submuestras por píxel. */
function dibujar(g, K, id, lado, R, t, { oscuro = 30, claro = 225, luz = 1 } = {}) {
  const M = celdas(id), k = lado / 6;
  const H = mul3([[K.fx, 0, K.cx], [0, K.fy, K.cy], [0, 0, 1]], [[R[0][0], R[0][1], t[0]], [R[1][0], R[1][1], t[1]], [R[2][0], R[2][1], t[2]]]);
  const Hi = inversa3(H);
  for (let y = 0; y < K.h; y++) for (let x = 0; x < K.w; x++) {
    let s = 0, n = 0, dentro = false;
    for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) {
      const [X, Y] = aplicarH(Hi, x - 1 / 3 + b / 3, y - 1 / 3 + a / 3);
      const c = Math.floor((X + lado / 2) / k + 1), r = Math.floor((lado / 2 - Y) / k + 1);   // con franja blanca de 1 celda
      if (c < 0 || r < 0 || c > 7 || r > 7) { s += g[y * K.w + x]; n++; continue; }
      dentro = true;
      const blanco = c === 0 || r === 0 || c === 7 || r === 7 || M[r - 1][c - 1];
      s += (blanco ? claro : oscuro) * luz; n++;
    }
    if (dentro) g[y * K.w + x] = Math.round(s / n);
  }
  return H;
}

const giro = (ejeX, ejeY, ejeZ) => {
  const rx = rodrigues([ejeX * Math.PI / 180, 0, 0]), ry = rodrigues([0, ejeY * Math.PI / 180, 0]), rz = rodrigues([0, 0, ejeZ * Math.PI / 180]);
  // de frente: el marcador mira a la cámara (su y hacia arriba es −y de la cámara)
  return mul3(mul3(mul3(rx, ry), rz), [[1, 0, 0], [0, -1, 0], [0, 0, -1]]);
};

const verdad = (K, R, t, lado) => esquinasMarcador(lado).map(P => proyectar(K, R, t, P));
const angulo = (A, B) => { const r = aRodrigues(mul3(A, [0, 1, 2].map(j => [B[0][j], B[1][j], B[2][j]]))); return Math.hypot(...r) * 180 / Math.PI; };

describe('Axiona AR · marcadores', () => {
  it('los 16 códigos se distinguen entre sí y de sus giros por al menos 5 celdas', () => {
    expect(CODIGOS.length).toBe(16);
    for (let i = 0; i < CODIGOS.length; i++) {
      let r = CODIGOS[i];
      for (let g = 1; g < 4; g++) { r = rotar(r); expect(distancia(CODIGOS[i], r)).toBeGreaterThanOrEqual(5); }
      for (let j = i + 1; j < CODIGOS.length; j++) {
        let o = CODIGOS[j];
        for (let g = 0; g < 4; g++) { expect(distancia(CODIGOS[i], o)).toBeGreaterThanOrEqual(5); o = rotar(o); }
      }
    }
    expect(rotar(rotar(rotar(rotar(CODIGOS[3]))))).toBe(CODIGOS[3]);
  });

  it('identifica girado y con una celda mal leída, y no inventa marcadores', () => {
    CODIGOS.forEach((c, id) => {
      let r = c;
      for (let g = 0; g < 4; g++) {
        expect(identificar(r)).toMatchObject({ id, errores: 0 });
        expect(identificar(r ^ (1 << (id % 16)))).toMatchObject({ id, errores: 1 });
        r = rotar(r);
      }
    });
    let falsos = 0;
    for (let k = 0; k < 2000; k++) if (identificar(Math.floor(azar() * 65536), 0)) falsos++;
    expect(falsos).toBeLessThan(5);
    expect(svgMarcador(0)).toMatch(/^<svg/);
    expect(celdas(0)[0].every(v => v === 0)).toBe(true);
  });
});

describe('Axiona AR · geometría', () => {
  it('la homografía lleva exactamente los 4 puntos', () => {
    const src = [[0, 0], [1, 0], [1, 1], [0, 1]], dst = [[10, 12], [90, 20], [80, 95], [5, 70]];
    const H = homografia(src, dst);
    src.forEach((p, i) => { const q = aplicarH(H, ...p); expect(q[0]).toBeCloseTo(dst[i][0], 9); expect(q[1]).toBeCloseTo(dst[i][1], 9); });
    const r = [0.3, -0.2, 0.9];
    expect(aRodrigues(rodrigues(r)).map(v => +v.toFixed(9))).toEqual(r);
  });

  it('recupera la pose exacta desde las esquinas y calibra el lente con un marcador inclinado', () => {
    const K = intrinsecos(640, 480, 62), lado = 0.16;
    for (const [ax, ay, az, t] of [[0, 0, 0, [0, 0, 0.6]], [40, 10, 25, [0.05, -0.03, 0.8]], [-55, 20, 170, [-0.1, 0.05, 1.2]]]) {
      const R = giro(ax, ay, az);
      const uv = verdad(K, R, t, lado);
      const p = poseMarcador(uv, lado, K);
      expect(angulo(p.R, R)).toBeLessThan(0.01);
      p.t.forEach((v, i) => expect(v).toBeCloseTo(t[i], 5));
      expect(p.error).toBeLessThan(1e-3);
    }
    const H = homografia(esquinasMarcador(lado).map(p => [p[0], p[1]]), verdad(K, giro(45, 15, 30), [0, 0, 0.7], lado));
    expect(focalDeHomografia(H, K.cx, K.cy)).toBeCloseTo(K.fx, 3);
    const Hf = homografia(esquinasMarcador(lado).map(p => [p[0], p[1]]), verdad(K, giro(0, 0, 20), [0, 0, 0.7], lado));
    expect(focalDeHomografia(Hf, K.cx, K.cy)).toBeNull();
  });

  it('el filtro 1€ suaviza el temblor y sigue el movimiento', () => {
    const f = new FiltroEuro();
    let y;
    for (let k = 0; k < 60; k++) y = f.filtrar([1 + (k % 2 ? 0.01 : -0.01)], k / 30);
    expect(Math.abs(y[0] - 1)).toBeLessThan(0.006);
    for (let k = 60; k < 120; k++) y = f.filtrar([2], k / 30);
    expect(y[0]).toBeCloseTo(2, 2);
  });
});

describe('Axiona AR · detector en imágenes sintéticas', () => {
  const K = intrinsecos(480, 360, 62), lado = 0.16;
  const casos = [
    ['de frente', 0, giro(0, 0, 0), [0, 0, 0.45], 'ruido'],
    ['inclinado 45° y girado 30°', 3, giro(45, 0, 30), [0.02, 0.01, 0.5], 'gradiente'],
    ['girado 90°', 7, giro(10, 20, 90), [-0.03, 0.02, 0.55], 'ruido'],
    ['de cabeza', 11, giro(-30, 15, 180), [0, -0.02, 0.6], 'ruido'],
    ['girado 270° y lejos', 15, giro(25, -25, 270), [0.05, 0.03, 1.3], 'gradiente'],
  ];
  for (const [nombre, id, R, t, tipo] of casos) {
    it(`encuentra el marcador ${id} ${nombre} con esquinas a menos de 0,5 px y la pose a menos de 2°`, () => {
      const g = fondo(K.w, K.h, tipo);
      dibujar(g, K, id, lado, R, t);
      const d = detectar(g, K.w, K.h);
      expect(d.map(x => x.id)).toEqual([id]);
      const v = verdad(K, R, t, lado);
      d[0].esquinas.forEach((p, i) => expect(Math.hypot(p[0] - v[i][0], p[1] - v[i][1])).toBeLessThan(0.5));
      const p = poseMarcador(d[0].esquinas, lado, K);
      expect(angulo(p.R, R)).toBeLessThan(2);
      expect(Math.hypot(p.t[0] - t[0], p.t[1] - t[1], p.t[2] - t[2]) / t[2]).toBeLessThan(0.02);
    });
  }

  it('ve dos marcadores a la vez y aguanta media sombra', () => {
    const g = fondo(K.w, K.h);
    dibujar(g, K, 1, 0.1, giro(20, 0, 0), [-0.09, 0, 0.5]);
    dibujar(g, K, 2, 0.1, giro(-20, 10, 45), [0.09, 0.02, 0.5], { luz: 0.55 });
    expect(detectar(g, K.w, K.h).map(x => x.id).sort()).toEqual([1, 2]);
  });

  it('aguanta una cámara borrosa, con poco contraste y grano', () => {
    const g = fondo(K.w, K.h, 'gradiente');
    const R = giro(35, -15, 60), t = [0.01, 0, 0.7];
    dibujar(g, K, 9, lado, R, t, { oscuro: 70, claro: 170 });
    // desenfoque 5 × 5 y ruido
    const b = new Uint8Array(g.length);
    for (let y = 0; y < K.h; y++) for (let x = 0; x < K.w; x++) {
      let s = 0, n = 0;
      for (let a = -2; a <= 2; a++) for (let c = -2; c <= 2; c++) { const yy = y + a, xx = x + c; if (yy >= 0 && xx >= 0 && yy < K.h && xx < K.w) { s += g[yy * K.w + xx]; n++; } }
      b[y * K.w + x] = Math.max(0, Math.min(255, s / n + (azar() - 0.5) * 16));
    }
    const d = detectar(b, K.w, K.h);
    expect(d.map(x => x.id)).toEqual([9]);
    const v = verdad(K, R, t, lado);
    d[0].esquinas.forEach((p, i) => expect(Math.hypot(p[0] - v[i][0], p[1] - v[i][1])).toBeLessThan(1));
  });

  it('no inventa marcadores en ruido, cuadros ni un ajedrez', () => {
    const g = fondo(K.w, K.h);
    for (let y = 40; y < 200; y++) for (let x = 40; x < 200; x++) g[y * K.w + x] = ((x >> 4) + (y >> 4)) % 2 ? 230 : 20;
    for (let y = 220; y < 320; y++) for (let x = 260; x < 360; x++) g[y * K.w + x] = (x < 270 || x > 350 || y < 230 || y > 310) ? 20 : 230;
    expect(detectar(g, K.w, K.h)).toEqual([]);
  });
});

describe('Axiona AR · la casa en el lote', async () => {
  const { buildModel, DEFAULT_STATE, clonar, normalizarEstado } = await import('../src/motor/index.js');
  const { modeloAMarcadorLote, loteAModelo } = await import('../src/ar/anclas.js');
  it('cada esquina Pk cae en el centro del marcador k y la siguiente queda sobre su flecha', () => {
    const S = normalizarEstado(clonar(DEFAULT_STATE));
    S.lot = S.lot.map((p, i) => ({ ...p, z: [0, 0.4, 1.1, 0.6][i] ?? 0 }));
    const M = buildModel(S);
    const n = M.lot.length;
    for (let k = 1; k <= n; k++) {
      const T = modeloAMarcadorLote(M, k), P = M.lot[k - 1], Q = M.lot[k % n];
      const o = loteAModelo(M, P).applyMatrix4(T);
      expect(o.length()).toBeLessThan(1e-9);
      const q = loteAModelo(M, Q).applyMatrix4(T);
      expect(q.x).toBeCloseTo(0, 9);
      expect(q.y).toBeCloseTo(Math.hypot(Q.x - P.x, Q.y - P.y), 9);
      expect(q.z).toBeCloseTo((Q.z || 0) - (P.z || 0), 9);
      // la casa (centro de la huella) queda adentro del lote: a la derecha de la flecha si el lote se recorre en el sentido del reloj
      const c = loteAModelo(M, { x: (M.R.x0 + M.R.x1) / 2, y: (M.R.y0 + M.R.y1) / 2, z: M.dl }).applyMatrix4(T);
      expect(Math.sign(c.x)).toBe(M.ccw ? -1 : 1);
      // la escala es real: un metro del modelo mide un metro en el marcador
      const a = loteAModelo(M, { x: 0, y: 0, z: 0 }).applyMatrix4(T), b = loteAModelo(M, { x: 1, y: 0, z: 0 }).applyMatrix4(T);
      expect(a.distanceTo(b)).toBeCloseTo(1, 9);
    }
  });
});
