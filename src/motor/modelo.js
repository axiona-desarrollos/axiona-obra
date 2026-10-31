/* ==========================================================================
   AXIONA OBRA · Modelo
   --------------------------------------------------------------------------
   Terreno → marco del frente → huella → distribucion → estructura segun el
   sistema del pais → cubierta → amoblado → redes → domotica → cantidades →
   cronograma. Funcion pura: el mismo estado da siempre el mismo modelo, sin
   tocar el DOM; por eso se prueba en Node.

   COORDENADAS
   El usuario escribe el lote en coordenadas del mundo (x oriente, y norte).
   Todo el diseño se hace en el MARCO DEL FRENTE (ver geometria.js): x a lo
   largo del frente, y hacia el fondo. Lo que se mide en campo (azimuts de
   linderos, replanteo desde P1) se devuelve en el mundo.
   ========================================================================== */

import {
  r2, snap, clamp, deg, polyArea, pip, azimuth, makeZ, fitPlane, marcoDelFrente, EPS, ivUnion, ivSubtract, rectMinus, near,
} from './geometria.js';
import { distribuir, FORMAS } from './distribucion.js';
import { SOILS } from './estado.js';
import { quantities } from './cantidades.js';
import { gantt } from './cronograma.js';
import { setIdioma, tr } from './idioma.js';
import { cubierta } from './cubierta.js';
import { amoblar } from './mobiliario.js';
import { redes } from './redes.js';
import { domotica } from './domotica.js';
import { tipoEspacio } from './catalogo.js';
import { analizarMexico, sepCastillos } from './mexico.js';

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

/** Columnetas de confinamiento: extremos e intersecciones de muros y cada `max` m como maximo. */
function columnetas(fl, max = 4) {
  const pts = new Map();
  const add = (x, y) => { const k = `${r2(x)}|${r2(y)}`; if (!pts.has(k)) pts.set(k, { x: r2(x), y: r2(y) }); };
  const H = fl.lines.filter(l => l.o === 'H'), V = fl.lines.filter(l => l.o === 'V');
  fl.lines.forEach(l => {
    const p0 = l.o === 'H' ? [l.a, l.c] : [l.c, l.a], p1 = l.o === 'H' ? [l.b, l.c] : [l.c, l.b];
    add(...p0); add(...p1);
    const n = Math.ceil((l.b - l.a) / max - 1e-9);
    for (let k = 1; k < n; k++) { const t = l.a + (l.b - l.a) * k / n; if (l.o === 'H') add(t, l.c); else add(l.c, t); }
  });
  H.forEach(h => V.forEach(v => { if (v.c > h.a - EPS && v.c < h.b + EPS && h.c > v.a - EPS && h.c < v.b + EPS) add(v.c, h.c); }));
  return [...pts.values()];
}

/** Revision del Titulo E de la NSR-10 (casas de 1 y 2 pisos en mamposteria confinada). */
function revisarTituloE(M) {
  const { F, R, floors } = M;
  const out = [];
  const largo = Math.max(R.w, R.h), ancho = Math.min(R.w, R.h);
  const comercial = floors.some(fl => fl.rects.some(r => r.tipo === 'local' || /bodega|warehouse|comercial|store/i.test(r.name)));
  out.push({ ok: F <= 2, t: tr({ es: 'Hasta 2 pisos (alcance del Título E): la casa tiene {F}.', en: 'Up to 2 storeys (Title E scope): the house has {F}.' }, { F }) });
  out.push({ ok: !comercial, t: comercial ? tr({ es: 'Tiene local o bodega: el Título E no cubre esos usos.', en: 'Has a store or warehouse: Title E does not cover those uses.' }) : tr({ es: 'Solo vivienda.', en: 'Housing only.' }) });
  out.push({ ok: largo <= 3 * ancho + EPS, t: tr({ es: 'Planta de {l} × {a} m: el largo no pasa de 3 veces el ancho.', en: 'Plan {l} × {a} m: length within 3 × width.' }, { l: r2(largo), a: r2(ancho) }) });
  floors.forEach(fl => {
    let Lx = 0, Ly = 0, mx = 0, my = 0, Lt = 0;
    fl.lines.forEach(l => {
      const len = l.b - l.a, cx = l.o === 'H' ? (l.a + l.b) / 2 : l.c, cy = l.o === 'H' ? l.c : (l.a + l.b) / 2;
      if (l.o === 'H') Lx += len; else Ly += len;
      mx += cx * len; my += cy * len; Lt += len;
    });
    const ex = Math.abs(mx / Lt - (R.x0 + R.x1) / 2) / R.w, ey = Math.abs(my / Lt - (R.y0 + R.y1) / 2) / R.h;
    out.push({ ok: Lx > 0 && Ly > 0, info: true, t: tr({ es: 'Piso {f}: {lx} m de muro en x y {ly} m en y ({dx} y {dy} m por m² de planta). Comparar con la longitud mínima del capítulo E.3.', en: 'Floor {f}: {lx} m of wall in x and {ly} m in y ({dx} and {dy} m per m²). Check against E.3 minimum length.' }, { f: fl.f + 1, lx: r2(Lx), ly: r2(Ly), dx: r2(Lx / R.area), dy: r2(Ly / R.area) }) });
    out.push({ ok: ex <= 0.1 && ey <= 0.1, t: tr({ es: 'Piso {f}: el centro de los muros queda a {ex} % y {ey} % del centro de la planta (se busca simetría; criterio de Axiona: menos de 10 %).', en: 'Floor {f}: wall centroid at {ex} % and {ey} % from the plan centre (aim for symmetry; Axiona criterion: under 10 %).' }, { f: fl.f + 1, ex: Math.round(ex * 100), ey: Math.round(ey * 100) }) });
  });
  if (F === 2) {
    const abajo = { H: {}, V: {} };
    floors[0].lines.forEach(l => { (abajo[l.o][l.c.toFixed(2)] ||= []).push([l.a, l.b]); });
    let total = 0, apoyado = 0;
    floors[1].lines.forEach(l => {
      total += l.b - l.a;
      const base = ivUnion(abajo[l.o][l.c.toFixed(2)] || []);
      base.forEach(([a, b]) => { apoyado += Math.max(0, Math.min(b, l.b) - Math.max(a, l.a)); });
    });
    const pct = total ? Math.round(apoyado / total * 100) : 100;
    out.push({ ok: pct >= 90, t: tr({ es: 'El {p} % de los muros del piso 2 cae sobre muros del piso 1 (en mampostería confinada los muros van uno sobre otro).', en: '{p} % of floor 2 walls sit on floor 1 walls (confined masonry walls must stack).' }, { p: pct }) });
  }
  return out;
}

export function buildModel(S) {
  setIdioma(S.idioma || 'es');
  const pid = S.pais || 'CO';
  const sistema = S.sistema || 'porticos';
  const warn = [];
  const lotW = (S.lot || []).filter(p => Number.isFinite(+p.x) && Number.isFinite(+p.y)).map(p => ({ x: +p.x, y: +p.y, z: +p.z || 0 }));
  if (lotW.length < 3) return { err: tr({ es: 'El lote necesita al menos 3 vértices.', en: 'The lot needs at least 3 corners.' }) };
  const As = polyArea(lotW), lotArea = Math.abs(As), ccw = As > 0;
  if (lotArea < 20) return { err: tr({ es: 'El área del lote es muy pequeña (< 20 m²). Revisa las coordenadas.', en: 'The lot area is too small (< 20 m²). Check the coordinates.' }) };
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

  const frente = ((Math.round(+S.frente || 0) % n) + n) % n;
  const marco = marcoDelFrente(lotW, frente);
  const lot = lotW.map(marco.aLocal);
  const spotsW = (S.spots || []).filter(p => [p.x, p.y, p.z].every(v => Number.isFinite(+v))).map(p => ({ x: +p.x, y: +p.y, z: +p.z }));
  const spots = spotsW.map(marco.aLocal);

  const tpts = lot.concat(spots);
  const zf = makeZ(tpts);
  const planeW = fitPlane(lotW.concat(spotsW));
  const slope = Math.hypot(planeW.a, planeW.b) * 100;
  const slopeDir = azimuth(-planeW.a, -planeW.b);
  if (slope > 30) warn.push(tr({ es: 'Pendiente media {p} %: evalúa muros de contención y terrazas.', en: 'Average slope {p} %: consider retaining walls and terraces.' }, { p: slope.toFixed(1) }));

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
  const F = clamp(Math.round(+S.floors) || 1, 1, 8);
  const programa = Array.from({ length: F }, () => []);
  for (const r of S.rooms || []) {
    const area = +r.area, piso = Math.round(+r.floor) || 1;
    if (!(area > 0)) { warn.push(tr({ es: '«{n}» no tiene un área válida: no se distribuye.', en: '“{n}” has no valid area: it is left out.' }, { n: r.name || 'Espacio' })); continue; }
    if (piso > F) { warn.push(tr({ es: '«{n}» está en el piso {p}, pero la casa tiene {F}: súbele los pisos o cámbialo de piso.', en: '“{n}” is on floor {p} but the building has {F}: add floors or move it.' }, { n: r.name || 'Espacio', p: piso, F })); continue; }
    programa[piso - 1].push({ name: r.name || 'Espacio', req: area, zone: r.zone || 'social' });
  }
  if (pid === 'CO' && F >= 4) warn.push(tr({ es: 'Con {F} pisos el predimensionamiento es solo orientativo: la estructura exige diseño completo según la NSR-10.', en: 'With {F} storeys pre-sizing is only indicative: the structure needs a full NSR-10 design.' }, { F }));
  if (pid === 'CA' && F > 3) warn.push(tr({ es: 'Más de 3 pisos: sale de la Parte 9 (casas) y pasa a la Parte 3, con arquitecto e ingeniero.', en: 'More than 3 storeys: outside Part 9, Part 3 applies with architect and engineer.' }));
  if (pid === 'CO' && sistema === 'confinada' && F > 2) warn.push(tr({ es: 'La mampostería confinada del Título E es para 1 y 2 pisos: con {F} pisos cambia a pórticos.', en: 'Title E confined masonry is for 1–2 storeys: with {F} storeys switch to a concrete frame.' }, { F }));

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
  if (Wd < anchoMin || Dd < 5) return { err: tr({ es: 'Con estos retiros no cabe una vivienda: el frente útil da {w} m (mínimo {m} m) y el fondo {d} m (mínimo 5 m).', en: 'With these setbacks no house fits: usable frontage {w} m (minimum {m} m) and depth {d} m (minimum 5 m).' }, { w: r2(Wd), m: anchoMin, d: r2(Dd) }) };

  const perFloor = programa.map(p => p.reduce((t, r) => t + r.req, 0));
  const reqMax = Math.max(...perFloor, 12);
  const Amain = reqMax * 1.10;
  const dMin = F > 1 ? 6.5 : 4.5;
  const conAsc = !!S.ascensor && F > 1;
  // En lotes anchos el bloque principal busca un fondo de 0.85 veces su
  // ancho y la casa se centra; tambien se prueban formas mas alargadas y se
  // queda la de menos castigos (con un pequeño costo por metro de fachada).
  const fondo = mw => Math.min(Dd, Math.max(Amain / mw, dMin), (+S.occ || 0.7) * lotArea / (mw + stripW));
  // forma escalonada: la base crece para que cada piso, ya retrocedido, quepa con su programa
  const tipoF = FORMAS[S.forma?.tipo] ? S.forma.tipo : 'recta', pasoF = Math.min(6, Math.max(1, +S.forma?.paso || 2.5));
  const alFrente = F > 1 && (tipoF === 'terrazas' || tipoF === 'escalonada'), deLado = F > 1 && (tipoF === 'lateral' || tipoF === 'escalonada');
  const huella = factor => {
    let mainW = Math.min(Wd - stripW, Math.max(Math.sqrt(Amain / 0.85) * factor, 2.4));
    let D = fondo(mainW), corta = false;
    if (D * mainW < Amain - 0.5 && mainW < Wd - stripW - EPS) {
      mainW = Math.min(Wd - stripW, Amain / D);
      D = fondo(mainW);
    }
    const ocup = (+S.occ || 0.7) * lotArea;
    if (deLado) mainW = Math.min(Wd - stripW, ocup / D - stripW, Math.max(mainW, 3 + pasoF * (F - 1), ...perFloor.map((p, f) => p * 1.1 / D + pasoF * f)));
    if (alFrente) D = Math.min(Dd, ocup / (mainW + stripW), Math.max(D, 6.6 + pasoF * (F - 1), ...perFloor.map((p, f) => p * 1.1 / mainW + pasoF * f)));
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
    if (elegida && Math.abs(h.R.w - elegida.R.w) < 0.3) continue;
    const dist = distribuir(programa, h.R, F, stripW, 4.2, conAsc, S.forma);
    const nota = dist.castigo + 2 * (h.R.w + h.R.h);
    if (!elegida || nota < elegida.nota - EPS) elegida = { ...h, dist, nota };
  }
  const { R, mainW, D, dist } = elegida;
  if (elegida.corta) warn.push(tr({ es: 'El índice de ocupación limita la huella por debajo del mínimo funcional.', en: 'The lot coverage ratio limits the footprint below the functional minimum.' }));
  if (Amain > mainW * D + 0.5) warn.push(tr({ es: 'El programa pide {a} m² por piso y la huella útil da {b} m²: los espacios se reducen proporcionalmente.', en: 'The program asks for {a} m² per floor and the footprint gives {b} m²: rooms are scaled down.' }, { a: r2(reqMax), b: r2(mainW * D / 1.10) }));
  if (S.ascensor && !dist.asc) warn.push(tr({ es: 'No cabe el ascensor: necesita 2 pisos o más y un hall de al menos 3.4 m de fondo.', en: 'The elevator does not fit: it needs 2+ storeys and a 3.4 m deep hall.' }));

  const floors = dist.pisos;
  floors.forEach(fl => warn.push(...fl.avisos));
  floors.forEach(fl => fl.rects.forEach(r => { if (!r.circ) r.tipo = tipoEspacio(r.name, r.zone); }));
  const stair = dist.stair;

  // forma: pisos que retroceden dejan terrazas con baranda; balcones al frente
  const forma = { tipo: FORMAS[S.forma?.tipo] ? S.forma.tipo : 'recta', paso: +S.forma?.paso || 2.5, balcones: !!S.forma?.balcones };
  floors.forEach((fl, f) => {
    const util = (fl.R.w - stripW) * fl.R.h, pide = perFloor[f];
    if (f && fl.R.area < R.area - EPS && pide > util * 1.02) warn.push(tr({ es: 'Piso {f}: con la forma escalonada quedan {u} m² útiles y el programa pide {p} m²; los espacios se reducen. Quita espacios de ese piso o baja el retroceso.', en: 'Floor {f}: the stepped form leaves {u} m² usable and the program asks for {p} m²; rooms shrink. Remove rooms from that floor or reduce the setback.' }, { f: f + 1, u: r2(util), p: r2(pide) }));
  });
  const terrazas = [];
  for (let f = 1; f < F; f++) {
    const A = floors[f - 1].R, B = floors[f].R;
    const zonas = rectMinus(A, B).filter(z => (z.x1 - z.x0) > 0.3 && (z.y1 - z.y0) > 0.3).map(z => ({ ...z, area: r2((z.x1 - z.x0) * (z.y1 - z.y0)) }));
    if (!zonas.length) continue;
    // baranda en cada borde del piso de abajo que no queda contra un muro del piso de arriba
    const bordes = [
      { o: 'H', c: A.y0, a: A.x0, b: A.x1, tapa: near(B.y0, A.y0) ? [[B.x0, B.x1]] : [] },
      { o: 'H', c: A.y1, a: A.x0, b: A.x1, tapa: near(B.y1, A.y1) ? [[B.x0, B.x1]] : [] },
      { o: 'V', c: A.x0, a: A.y0, b: A.y1, tapa: near(B.x0, A.x0) ? [[B.y0, B.y1]] : [] },
      { o: 'V', c: A.x1, a: A.y0, b: A.y1, tapa: near(B.x1, A.x1) ? [[B.y0, B.y1]] : [] },
    ];
    const barandas = bordes.flatMap(e => ivSubtract([[e.a, e.b]], e.tapa).filter(([a, b]) => b - a > 0.2).map(([a, b]) => ({ o: e.o, c: e.c, a: r2(a), b: r2(b) })));
    terrazas.push({ f, zonas, area: r2(zonas.reduce((t, z) => t + z.area, 0)), barandas, L: r2(barandas.reduce((t, b) => t + b.b - b.a, 0)) });
  }
  const balcones = [];
  if (forma.balcones) {
    for (let f = 1; f < F; f++) {
      const fl = floors[f];
      if (fl.R.y0 > floors[f - 1].R.y0 + EPS) continue;        // ese frente ya tiene terraza
      fl.rects.filter(r => !r.circ && !r.bath && (r.zone === 'social' || r.zone === 'privada') && near(r.y0, fl.R.y0) && r.w >= 2.2).forEach(r => {
        const x0 = r2(r.x0 + 0.3), x1 = r2(r.x1 - 0.3), y1 = fl.R.y0, y0 = r2(y1 - 1.2);
        const v = fl.ops.find(o => o.kind === 'win' && o.o === 'H' && near(o.c, fl.R.y0) && o.room === r.name);
        if (v) Object.assign(v, { h: 2.1, sill: 0, balcon: true });
        balcones.push({ f, room: r.name, x0, x1, y0, y1, area: r2((x1 - x0) * 1.2), barandas: [{ o: 'H', c: y0, a: x0, b: x1 }, { o: 'V', c: x0, a: y0, b: y1 }, { o: 'V', c: x1, a: y0, b: y1 }], L: r2((x1 - x0) + 2.4) });
      });
    }
  }

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

  // suelo y desplante: el estudio de suelos manda si se escribio su capacidad
  const q = +S.qadm > 0 ? +S.qadm : (SOILS[S.soil] || SOILS.medio).q;
  let desp = clamp(+S.desp || 1.2, 0.6, 4);
  if (pid === 'CA' && +S.helada > desp) { desp = r2(+S.helada); warn.push(tr({ es: 'El desplante se baja a {d} m por la profundidad de helada.', en: 'Footing depth lowered to {d} m for frost depth.' }, { d: desp })); }
  const sotano = pid === 'CA' && !!S.sotano;
  if (sotano) desp = Math.max(desp, 2.75);

  // ejes estructurales y cimentacion
  const xs = [], ys = [];
  floors.forEach(fl => fl.lines.forEach(l => (l.o === 'V' ? xs : ys).push(l.c)));
  // donde un piso retrocede, su fachada nueva queda sobre un eje (viga y columnas debajo)
  const obligar = (ax, vals, a, b) => {
    vals.forEach(v => {
      if (ax.some(e => near(e, v))) return;
      const k = ax.findIndex(e => Math.abs(e - v) < 1.2 && !near(e, a) && !near(e, b));
      if (k >= 0) ax[k] = r2(v); else ax.push(r2(v));
    });
    return ax.sort((p, q2) => p - q2);
  };
  const axX = obligar(pickAxes(xs, R.x0, R.x1), floors.flatMap(fl => [fl.R.x0, fl.R.x1]), R.x0, R.x1);
  const axY = obligar(pickAxes(ys, R.y0, R.y1), floors.map(fl => fl.R.y0), R.y0, R.y1);
  const colB = sistema === 'madera' ? 0.1 : ladoColumna(F);
  const cols = [];
  // pisos que carga cada columna: sube hasta el piso cuya huella ya no la cubre
  const dentro = (x, y, Rf) => x > Rf.x0 - EPS && x < Rf.x1 + EPS && y > Rf.y0 - EPS && y < Rf.y1 + EPS;
  const pisosSobre = (x, y) => { let n = 0; while (n < F && dentro(x, y, floors[n].R)) n++; return Math.max(1, n); };
  const mkCol = (x, y, i, j, At) => {
    const n = pisosSobre(x, y), Pc = At * n * 1.0;
    const B = Math.max(0.8, r2(Math.ceil(Math.sqrt(1.15 * Pc / q) / 0.2 - 1e-9) * 0.2));
    return { x, y, i, j, n, id: `${String.fromCharCode(65 + i)}-${j + 1}`, At: r2(At), P: r2(Pc), B: r2(B), h: B <= 1.4 ? 0.4 : 0.5 };
  };
  if (sistema === 'porticos' || sistema === 'hormigon') {
    axY.forEach((y, j) => axX.forEach((x, i) => {
      const tx = ((i > 0 ? x - axX[i - 1] : 0) + (i < axX.length - 1 ? axX[i + 1] - x : 0)) / 2;
      const ty = ((j > 0 ? y - axY[j - 1] : 0) + (j < axY.length - 1 ? axY[j + 1] - y : 0)) / 2;
      cols.push(mkCol(x, y, i, j, tx * ty));
    }));
  } else if (sistema === 'madera') {
    // viga central de acero con postes cada 2.4 m sobre zapatas aisladas (sotano)
    const yc = r2((R.y0 + R.y1) / 2), nP = Math.max(1, Math.round(R.w / 2.4) - 1);
    for (let k = 1; k <= nP; k++) cols.push(mkCol(r2(R.x0 + k * R.w / (nP + 1)), yc, k, 0, (R.w / (nP + 1)) * (R.h / 2)));
    cols.forEach(c => { c.B = Math.max(0.6, Math.min(c.B, 1.0)); c.h = 0.3; });
  }
  const types = [...new Set(cols.map(c => c.B))].sort((a, b) => a - b);
  cols.forEach(c => { c.type = 'Z' + (types.indexOf(c.B) + 1); });
  const beams = [];
  if (sistema === 'madera') beams.push({ o: 'H', c: r2((R.y0 + R.y1) / 2), a: R.x0, b: R.x1 });
  else if (sistema !== 'confinada') {
    axX.forEach(x => beams.push({ o: 'V', c: x, a: R.y0, b: R.y1 }));
    axY.forEach(y => beams.push({ o: 'H', c: y, a: R.x0, b: R.x1 }));
  }
  const beamLen = beams.reduce((t, b) => t + (b.b - b.a), 0);
  // vigas sobre cada piso, recortadas a su huella (cargan la losa de ese piso)
  const recortar = (b, Rf) => {
    const [c0, c1, a0, a1] = b.o === 'H' ? [Rf.y0, Rf.y1, Rf.x0, Rf.x1] : [Rf.x0, Rf.x1, Rf.y0, Rf.y1];
    if (b.c < c0 - EPS || b.c > c1 + EPS) return null;
    const a = Math.max(b.a, a0), bb = Math.min(b.b, a1);
    return bb - a > 0.3 ? { ...b, a: r2(a), b: r2(bb) } : null;
  };
  const vigas = sistema === 'madera' ? floors.map(() => []) : floors.map(fl => beams.map(b => recortar(b, fl.R)).filter(Boolean));
  // En México los castillos van a no más del menor de 4 m y 1,5 H (NTC de mampostería), en cada nivel.
  const sepConf = pid === 'MX' ? sepCastillos(+S.fh || 2.7, +S.slab || 0.12) : 4;
  const colsConf = sistema === 'confinada' ? columnetas(floors[0], sepConf) : [];
  const castillos = pid === 'MX' && sistema === 'confinada' ? floors.map((fl, f) => (f ? columnetas(fl, sepConf) : colsConf)) : null;
  // si un piso retrocede, sus columnetas siguen sus propios muros
  const columnetasPiso = sistema === 'confinada' ? floors.map((fl, f) => (castillos ? castillos[f] : f && fl.R.area < R.area - EPS ? columnetas(fl, sepConf) : colsConf)) : null;

  // replanteo desde P1, en el mundo
  const p1 = lotW[0];
  const stakeSrc = sistema === 'confinada' ? colsConf.map((c, k) => ({ ...c, id: `C${k + 1}` })) : cols;
  const stake = stakeSrc.map(c => {
    const w = marco.aMundo({ x: c.x, y: c.y }), dx = w.x - p1.x, dy = w.y - p1.y;
    return { id: c.id, x: r2(w.x), y: r2(w.y), d: r2(Math.hypot(dx, dy)), az: azimuth(dx, dy), zt: r2(zf(c.x, c.y)), cut: r2(zf(c.x, c.y) - dl + desp) };
  });

  const fh = +S.fh || 2.7, slab = +S.slab || 0.12;
  const M = {
    pais: pid, sistema, sotano, idioma: S.idioma || 'es',
    lot, lotW, lotArea, per, sides, angles, angSum: angles.reduce((t, a) => t + a, 0), ccw, spots, zf, slope, slopeDir, bbox, grid,
    marco, frente, R, P, stair, asc: dist.asc || null, franja: dist.franja, ladoEscalera: dist.lado, stripW, dl, dlBal: r2(dlBal), cut, fill, floors,
    axX, axY, cols, colB, types, beams, beamLen, vigas, q, desp, stake, F, columnetas: colsConf, castillos, columnetasPiso,
    fh, slab, warn: [],
  };
  M.Rtop = floors[F - 1].R;
  M.forma = forma; M.terrazas = terrazas; M.balcones = balcones;
  M.techo = cubierta(M.Rtop, dl + F * fh, S.cubierta || {});
  M.built = r2(floors.reduce((t, fl) => t + fl.R.area, 0));
  M.muebles = amoblar(M, S.muebles?.quitar || []);
  M.dotacionVisible = S.amoblar !== false;
  M.redes = redes(M, M.muebles, { pais: pid });
  M.domotica = domotica(M, S.domotica || [], pid);
  M.tituloE = pid === 'CO' ? revisarTituloE(M) : null;
  M.mx = pid === 'MX' ? analizarMexico(M, S) : null;
  if (M.mx) {
    if (sistema === 'confinada' && F > 3) warn.push(tr({ es: 'Con {F} niveles la mampostería confinada pide diseño estructural detallado: compara con marcos de concreto.', en: 'With {F} storeys confined masonry needs a detailed structural design: compare with a concrete frame.' }, { F }));
    if (!M.mx.losa.ok) warn.push(tr({ es: 'Hay un claro de {c} m: la vigueta y bovedilla usual llega a 6 m. Agrega un muro o una trabe, o diseña losa maciza.', en: 'There is a {c} m span: usual joist-and-block reaches 6 m. Add a wall or beam, or design a solid slab.' }, { c: M.mx.losa.claro }));
    if (M.mx.tramite.cse) warn.push(tr({ es: 'Por altura o superficie lleva Corresponsable en Seguridad Estructural además del DRO.', en: 'Height or area requires a structural co-responsible besides the DRO.' }));
  }
  if (pid === 'CO' && M.built > 2000) warn.push(tr({ es: 'Más de 2.000 m² construidos: aplica la revisión independiente y la supervisión técnica de la Ley 1796 de 2016.', en: 'Over 2,000 m² built: independent review and supervision apply (Law 1796 of 2016).' }));
  if (pid === 'ES' && +S.ab >= 0.04) warn.push(tr({ es: 'Aceleración básica {a} g: se aplica la NCSE-02.', en: 'Basic acceleration {a} g: NCSE-02 applies.' }, { a: S.ab }));
  if (pid === 'CA' && R.area > 600) warn.push(tr({ es: 'Más de 600 m² de huella: sale de la Parte 9.', en: 'Over 600 m² building area: outside Part 9.' }));
  if (F >= 4 && !S.ascensor) warn.push(tr({ es: 'Con {F} pisos conviene un ascensor: actívalo en Programa.', en: 'With {F} storeys consider an elevator: enable it in Program.' }, { F }));
  M.warn = [...new Set(warn)];
  M.quant = quantities(M, S);
  M.gantt = gantt(M);
  return M;
}
