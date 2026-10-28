/* ==========================================================================
   AXIONA OBRA · Modelo
   --------------------------------------------------------------------------
   Terreno → marco del frente → huella → distribucion → ejes y cimentacion
   → cantidades → cronograma. Funcion pura: el mismo estado da siempre el
   mismo modelo, sin tocar el DOM; por eso se prueba en Node.

   COORDENADAS
   El usuario escribe el lote en coordenadas del mundo (x oriente, y norte).
   Todo el diseño se hace en el MARCO DEL FRENTE (ver geometria.js): x a lo
   largo del frente, y hacia el fondo. Lo que se mide en campo (azimuts de
   linderos, replanteo de columnas desde P1) se devuelve en el mundo.
   ========================================================================== */

import {
  r2, snap, clamp, deg, polyArea, pip, azimuth, makeZ, fitPlane, marcoDelFrente, EPS,
} from './geometria.js';
import { distribuir } from './distribucion.js';
import { SOILS } from './estado.js';
import { quantities } from './cantidades.js';
import { gantt } from './cronograma.js';

/** Ejes estructurales: aprovecha los muros y no deja luces de mas de `max` m. */
export function pickAxes(cands, a, b, max = 4.5) {
  const cs = [...new Set(cands.map(c => r2(c)))].filter(c => c >= a - EPS && c <= b + EPS).sort((p, q) => p - q);
  if (!cs.includes(r2(b))) cs.push(r2(b));
  const ax = [r2(a)];
  let cur = a, guard = 0;
  while (b - cur > 0.05 && guard++ < 50) {
    const reach = cs.filter(c => c > cur + 1.2 && c <= cur + max + EPS);
    let nx = reach.length ? Math.max(...reach) : Math.min(cur + max, b);
    if (b - nx < 1.2 && nx < b - EPS) nx = b;
    ax.push(r2(nx));
    cur = nx;
  }
  return ax;
}

/** Lado de columna segun el numero de pisos (predimensionamiento). */
export const ladoColumna = F => (F <= 2 ? 0.30 : F === 3 ? 0.35 : 0.40);

export function buildModel(S) {
  const warn = [];
  const lotW = (S.lot || []).filter(p => Number.isFinite(+p.x) && Number.isFinite(+p.y)).map(p => ({ x: +p.x, y: +p.y, z: +p.z || 0 }));
  if (lotW.length < 3) return { err: 'El lote necesita al menos 3 vértices.' };
  const As = polyArea(lotW), lotArea = Math.abs(As), ccw = As > 0;
  if (lotArea < 20) return { err: 'El área del lote es muy pequeña (< 20 m²). Revisa las coordenadas.' };
  const n = lotW.length;

  // linderos en el mundo: longitudes, azimuts, pendientes y angulos internos
  const sides = [];
  let per = 0;
  for (let i = 0; i < n; i++) {
    const a = lotW[i], b = lotW[(i + 1) % n], dx = b.x - a.x, dy = b.y - a.y, L = Math.hypot(dx, dy);
    per += L;
    sides.push({ i, from: i + 1, to: (i + 1) % n + 1, L, az: azimuth(dx, dy), dz: b.z - a.z, pend: L > 0 ? (b.z - a.z) / L * 100 : 0 });
  }
  const angles = [];
  for (let i = 0; i < n; i++) {
    const p = lotW[(i - 1 + n) % n], c = lotW[i], q = lotW[(i + 1) % n];
    const v1 = { x: p.x - c.x, y: p.y - c.y }, v2 = { x: q.x - c.x, y: q.y - c.y };
    const ang = deg(Math.acos(clamp((v1.x * v2.x + v1.y * v2.y) / (Math.hypot(v1.x, v1.y) * Math.hypot(v2.x, v2.y) || 1), -1, 1)));
    const cross = (c.x - p.x) * (q.y - c.y) - (c.y - p.y) * (q.x - c.x);
    angles.push((ccw ? cross > 0 : cross < 0) ? ang : 360 - ang);
  }

  // marco del frente
  const frente = ((Math.round(+S.frente || 0) % n) + n) % n;
  const marco = marcoDelFrente(lotW, frente);
  const lot = lotW.map(marco.aLocal);
  const spotsW = (S.spots || []).filter(p => [p.x, p.y, p.z].every(v => Number.isFinite(+v))).map(p => ({ x: +p.x, y: +p.y, z: +p.z }));
  const spots = spotsW.map(marco.aLocal);

  // topografia (en el marco local; la pendiente se lee en el mundo)
  const tpts = lot.concat(spots);
  const zf = makeZ(tpts);
  const planeW = fitPlane(lotW.concat(spotsW));
  const slope = Math.hypot(planeW.a, planeW.b) * 100;
  const slopeDir = azimuth(-planeW.a, -planeW.b);
  if (slope > 30) warn.push(`Pendiente media ${slope.toFixed(1)} %: evalúa muros de contención y terrazas.`);

  let minx = Infinity, maxx = -Infinity, miny = Infinity, maxy = -Infinity;
  for (const p of lot) { minx = Math.min(minx, p.x); maxx = Math.max(maxx, p.x); miny = Math.min(miny, p.y); maxy = Math.max(maxy, p.y); }
  const bbox = { minx, maxx, miny, maxy, w: maxx - minx, h: maxy - miny };

  const res = Math.max(0.5, Math.max(bbox.w, bbox.h) / 90);
  const gx0 = minx - 2, gy0 = miny - 2;
  const nx = Math.ceil((bbox.w + 4) / res) + 1, ny = Math.ceil((bbox.h + 4) / res) + 1;
  const Z = new Float32Array(nx * ny), IN = new Uint8Array(nx * ny);
  let zmin = Infinity, zmax = -Infinity;
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const x = gx0 + i * res, y = gy0 + j * res, k = j * nx + i;
    Z[k] = zf(x, y); IN[k] = pip(x, y, lot) ? 1 : 0;
    zmin = Math.min(zmin, Z[k]); zmax = Math.max(zmax, Z[k]);
  }
  const grid = { nx, ny, x0: gx0, y0: gy0, res, Z, IN, zmin, zmax };

  // programa por piso, con avisos de lo que no se puede usar
  const F = clamp(Math.round(+S.floors) || 1, 1, 6);
  const programa = Array.from({ length: F }, () => []);
  for (const r of S.rooms || []) {
    const area = +r.area, piso = Math.round(+r.floor) || 1;
    if (!(area > 0)) { warn.push(`"${r.name || 'Espacio'}" no tiene un área válida: no se distribuye.`); continue; }
    if (piso > F) { warn.push(`"${r.name || 'Espacio'}" está en el piso ${piso}, pero la casa tiene ${F}: súbele los pisos o cámbialo de piso.`); continue; }
    programa[piso - 1].push({ name: r.name || 'Espacio', req: area, zone: r.zone || 'social' });
  }
  if (F >= 4) warn.push(`Con ${F} pisos el predimensionamiento es solo orientativo: la estructura exige diseño completo según la NSR-10.`);

  // huella: retiros, ajuste dentro del lote y proporcion
  const ret = S.ret || {};
  let x0 = minx + (+ret.lat || 0), x1 = maxx - (+ret.lat || 0), y0 = miny + (+ret.front || 0), y1 = maxy - (+ret.back || 0);
  for (let k = 0; k < 600; k++) {
    const c = [[x0, y0], [x1, y0], [x1, y1], [x0, y1]], out = c.map(([x, y]) => !pip(x, y, lot));
    if (!out.some(Boolean) || x1 - x0 < 3 || y1 - y0 < 3) break;
    if (out[0]) { x0 += 0.05; y0 += 0.05; }
    if (out[1]) { x1 -= 0.05; y0 += 0.05; }
    if (out[2]) { x1 -= 0.05; y1 -= 0.05; }
    if (out[3]) { x0 += 0.05; y1 -= 0.05; }
  }
  x0 = snap(x0); x1 = snap(x1); y0 = snap(y0); y1 = snap(y1);
  const stripW = F > 1 ? 2.6 : 1.2;
  const Wd = x1 - x0, Dd = y1 - y0;
  const anchoMin = r2(stripW + 2.4);
  if (Wd < anchoMin || Dd < 5) return { err: `Con estos retiros no cabe una vivienda: el frente útil da ${r2(Wd)} m (mínimo ${anchoMin} m) y el fondo ${r2(Dd)} m (mínimo 5 m).` };

  const perFloor = programa.map(p => p.reduce((t, r) => t + r.req, 0));
  const reqMax = Math.max(...perFloor, 12);
  const Amain = reqMax * 1.10;
  const dMin = F > 1 ? 6.5 : 4.5;
  // En lotes anchos la primera version estiraba la casa a todo el frente:
  // en 30 × 40 salia de 28 m por 6.5. Ahora el bloque principal busca un
  // fondo de 0.85 veces su ancho y la casa se centra en el lote. Con muchos
  // espacios por piso una casa tan compacta deja espacios en el centro sin
  // ventana: por eso tambien se prueban formas mas alargadas y se queda la
  // de menos castigos (con un pequeno costo por metro de fachada, que es
  // muro mas caro).
  const fondo = mw => Math.min(Dd, Math.max(Amain / mw, dMin), (+S.occ || 0.7) * lotArea / (mw + stripW));
  const huella = factor => {
    let mainW = Math.min(Wd - stripW, Math.max(Math.sqrt(Amain / 0.85) * factor, 2.4));
    let D = fondo(mainW), corta = false;
    if (D * mainW < Amain - 0.5 && mainW < Wd - stripW - EPS) {
      mainW = Math.min(Wd - stripW, Amain / D);
      D = fondo(mainW);
    }
    if (D < dMin) { D = Math.min(Dd, dMin); corta = true; }
    D = Math.floor(D / 0.05) * 0.05;
    const W = r2(mainW + stripW), xc = snap(x0 + (Wd - W) / 2);
    const R = { x0: xc, x1: r2(xc + W), y0, y1: r2(y0 + D) };
    R.w = r2(R.x1 - R.x0); R.h = r2(R.y1 - R.y0); R.area = R.w * R.h;
    return { R, mainW, D, corta };
  };
  let elegida = null;
  for (const factor of [1, 1.3, 1.65]) {
    const h = huella(factor);
    if (elegida && Math.abs(h.R.w - elegida.R.w) < 0.3) continue;   // misma forma, no se repite
    const dist = distribuir(programa, h.R, F, stripW);
    const nota = dist.castigo + 2 * (h.R.w + h.R.h);
    if (!elegida || nota < elegida.nota - EPS) elegida = { ...h, dist, nota };
  }
  const { R, mainW, D, dist } = elegida;
  if (elegida.corta) warn.push('El índice de ocupación limita la huella por debajo del mínimo funcional.');
  if (Amain > mainW * D + 0.5) warn.push(`El programa pide ${r2(reqMax)} m² por piso y la huella útil da ${r2(mainW * D / 1.10)} m²: los espacios se reducen proporcionalmente.`);

  const floors = dist.pisos;
  floors.forEach(fl => warn.push(...fl.avisos));
  const stair = dist.stair;

  // plataforma y movimiento de tierras
  const PM = 1.0, P = { x0: R.x0 - PM, x1: R.x1 + PM, y0: R.y0 - PM, y1: R.y1 + PM };
  let sumZ = 0, cntZ = 0;
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const x = gx0 + i * res, y = gy0 + j * res;
    if (x >= P.x0 && x <= P.x1 && y >= P.y0 && y <= P.y1) { sumZ += Z[j * nx + i]; cntZ++; }
  }
  const dlBal = cntZ ? sumZ / cntZ : lot.reduce((t, p) => t + p.z, 0) / n;
  const dl = S.dlAuto ? r2(dlBal) : +S.dl || 0;
  let cut = 0, fill = 0;
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const x = gx0 + i * res, y = gy0 + j * res;
    if (x >= P.x0 && x <= P.x1 && y >= P.y0 && y <= P.y1) { const d = Z[j * nx + i] - dl; if (d > 0) cut += d * res * res; else fill -= d * res * res; }
  }

  // ejes estructurales y cimentacion
  const xs = [], ys = [];
  floors.forEach(fl => fl.lines.forEach(l => (l.o === 'V' ? xs : ys).push(l.c)));
  const axX = pickAxes(xs, R.x0, R.x1), axY = pickAxes(ys, R.y0, R.y1);
  const q = (SOILS[S.soil] || SOILS.medio).q, desp = clamp(+S.desp || 1.2, 0.6, 4);
  const colB = ladoColumna(F);
  const cols = [];
  axY.forEach((y, j) => axX.forEach((x, i) => {
    const tx = ((i > 0 ? x - axX[i - 1] : 0) + (i < axX.length - 1 ? axX[i + 1] - x : 0)) / 2;
    const ty = ((j > 0 ? y - axY[j - 1] : 0) + (j < axY.length - 1 ? axY[j + 1] - y : 0)) / 2;
    const At = tx * ty, Pc = At * F * 1.0;
    const B = Math.max(0.8, r2(Math.ceil(Math.sqrt(1.15 * Pc / q) / 0.2 - 1e-9) * 0.2));
    const h = B <= 1.4 ? 0.4 : 0.5;
    cols.push({ x, y, i, j, id: `${String.fromCharCode(65 + i)}-${j + 1}`, At: r2(At), P: r2(Pc), B: r2(B), h });
  }));
  const types = [...new Set(cols.map(c => c.B))].sort((a, b) => a - b);
  cols.forEach(c => { c.type = 'Z' + (types.indexOf(c.B) + 1); });
  const beams = [];
  axX.forEach(x => beams.push({ o: 'V', c: x, a: R.y0, b: R.y1 }));
  axY.forEach(y => beams.push({ o: 'H', c: y, a: R.x0, b: R.x1 }));
  const beamLen = beams.reduce((t, b) => t + (b.b - b.a), 0);

  // replanteo desde P1, en el mundo
  const p1 = lotW[0];
  const stake = cols.map(c => {
    const w = marco.aMundo({ x: c.x, y: c.y }), dx = w.x - p1.x, dy = w.y - p1.y;
    return { id: c.id, x: r2(w.x), y: r2(w.y), d: r2(Math.hypot(dx, dy)), az: azimuth(dx, dy), zt: r2(zf(c.x, c.y)), cut: r2(zf(c.x, c.y) - dl + desp) };
  });

  const M = {
    lot, lotW, lotArea, per, sides, angles, angSum: angles.reduce((t, a) => t + a, 0), ccw, spots, zf, slope, slopeDir, bbox, grid,
    marco, frente, R, P, stair, franja: dist.franja, ladoEscalera: dist.lado, stripW, dl, dlBal: r2(dlBal), cut, fill, floors,
    axX, axY, cols, colB, types, beams, beamLen, q, desp, stake, F,
    fh: +S.fh || 2.7, slab: +S.slab || 0.12, warn: [...new Set(warn)],
  };
  M.built = R.area * F;
  M.quant = quantities(M);
  M.gantt = gantt(M);
  return M;
}
