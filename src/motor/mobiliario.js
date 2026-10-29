/* ==========================================================================
   AXIONA OBRA · Amoblado automatico
   --------------------------------------------------------------------------
   Cada espacio se amobla segun su uso, que sale del nombre (sala, alcoba,
   cocina, baño...). Los muebles van contra los muros, sin tapar el barrido
   de las puertas ni poner nada alto delante de una ventana, y cada uno deja
   libre su frente de uso. Para cada mueble se prueban todas las posiciones
   a lo largo de cada muro y se queda la de mejor puntaje.

   GIRO (rot, en grados): hacia donde mira el frente del mueble.
     0 = hacia +y (espalda contra el muro sur), 180 = hacia −y,
     270 = hacia +x (espalda al oeste), 90 = hacia −x (espalda al este).
   Medidas: w a lo largo del muro, d de fondo.
   ========================================================================== */

import { near, r2 } from './geometria.js';
import { MUEBLES, tipoEspacio } from './catalogo.js';

const EPS = 1e-6;
const sobre = (A, B, tol = 0.004) => A.x0 < B.x1 - tol && A.x1 > B.x0 + tol && A.y0 < B.y1 - tol && A.y1 > B.y0 + tol;
const dentro = (A, I, tol = 0.012) => A.x0 >= I.x0 - tol && A.x1 <= I.x1 + tol && A.y0 >= I.y0 - tol && A.y1 <= I.y1 + tol;
const OPUESTO = { S: 'N', N: 'S', W: 'E', E: 'W' };
const slug = s => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 24);

function huella(L, t, w, d) {
  switch (L.lado) {
    case 'S': return { x0: t, x1: t + w, y0: L.c, y1: L.c + d, rot: 0 };
    case 'N': return { x0: t, x1: t + w, y0: L.c - d, y1: L.c, rot: 180 };
    case 'W': return { x0: L.c, x1: L.c + d, y0: t, y1: t + w, rot: 270 };
    default: return { x0: L.c - d, x1: L.c, y0: t, y1: t + w, rot: 90 };
  }
}
function franjaFrente(h, rot, c) {
  if (rot === 0) return { x0: h.x0, x1: h.x1, y0: h.y1, y1: h.y1 + c };
  if (rot === 180) return { x0: h.x0, x1: h.x1, y0: h.y0 - c, y1: h.y0 };
  if (rot === 270) return { x0: h.x1, x1: h.x1 + c, y0: h.y0, y1: h.y1 };
  return { x0: h.x0 - c, x1: h.x0, y0: h.y0, y1: h.y1 };
}
const centro = h => ({ x: (h.x0 + h.x1) / 2, y: (h.y0 + h.y1) / 2 });
const largo = L => L.b - L.a;
/** Posicion a lo largo del muro (coordenada t) de un punto. */
const tDe = (L, p) => (L.lado === 'S' || L.lado === 'N' ? p.x : p.y);

/** Interior util del espacio: descuenta medio muro (20 cm en fachada, 12 adentro). */
function interior(r, R) {
  const e = (ext) => (ext ? 0.1 : 0.06);
  return {
    x0: r.x0 + e(near(r.x0, R.x0)), x1: r.x1 - e(near(r.x1, R.x1)),
    y0: r.y0 + e(near(r.y0, R.y0)), y1: r.y1 - e(near(r.y1, R.y1)),
  };
}

/** Contexto de un espacio: interior, muros, zonas de puertas y ventanas. */
function contexto(r, fl, R) {
  const I = interior(r, R);
  const lados = [
    { lado: 'S', c: I.y0, a: I.x0, b: I.x1 }, { lado: 'N', c: I.y1, a: I.x0, b: I.x1 },
    { lado: 'W', c: I.x0, a: I.y0, b: I.y1 }, { lado: 'E', c: I.x1, a: I.y0, b: I.y1 },
  ];
  const puertas = [], ventanas = [];
  for (const o of fl.ops) {
    let lado = null;
    if (o.o === 'H' && o.b > r.x0 + EPS && o.a < r.x1 - EPS) lado = near(o.c, r.y0) ? 'S' : near(o.c, r.y1) ? 'N' : null;
    if (o.o === 'V' && o.b > r.y0 + EPS && o.a < r.y1 - EPS) lado = near(o.c, r.x0) ? 'W' : near(o.c, r.x1) ? 'E' : null;
    if (!lado) continue;
    if (o.kind === 'win') { ventanas.push({ lado, a: o.a, b: o.b, sill: o.sill }); continue; }
    // ¿El barrido de la hoja cae dentro de este espacio?
    const entra = (lado === 'S' || lado === 'W') ? o.dir === 1 : o.dir === -1;
    const fondo = o.kind === 'asc' ? 1.2 : entra ? o.w + 0.12 : 0.75;
    let z;
    if (lado === 'S') z = { x0: o.a - 0.1, x1: o.b + 0.1, y0: I.y0 - 0.2, y1: I.y0 + fondo };
    else if (lado === 'N') z = { x0: o.a - 0.1, x1: o.b + 0.1, y0: I.y1 - fondo, y1: I.y1 + 0.2 };
    else if (lado === 'W') z = { x0: I.x0 - 0.2, x1: I.x0 + fondo, y0: o.a - 0.1, y1: o.b + 0.1 };
    else z = { x0: I.x1 - fondo, x1: I.x1 + 0.2, y0: o.a - 0.1, y1: o.b + 0.1 };
    puertas.push({ lado, a: o.a, b: o.b, zona: z, kind: o.kind });
  }
  return { r, I, lados, puertas, ventanas, items: [], reservas: [] };
}

function valido(C, h, L, { alto = false, frente = null } = {}) {
  if (!dentro(h, C.I)) return false;
  if (C.items.some(it => sobre(h, it.h))) return false;
  if (C.reservas.some(z => sobre(h, z))) return false;
  if (C.puertas.some(p => sobre(h, p.zona))) return false;
  if (alto && L) {
    const a = L.lado === 'S' || L.lado === 'N' ? h.x0 : h.y0, b = L.lado === 'S' || L.lado === 'N' ? h.x1 : h.y1;
    if (C.ventanas.some(v => v.lado === L.lado && v.a < b - 0.02 && v.b > a + 0.02)) return false;
  }
  if (frente && C.items.some(it => sobre(frente, it.h))) return false;
  return true;
}

/** Mejor posicion contra un muro. puntaje(L, h) da el costo (menor es mejor). */
function enMuro(C, w, d, { lados = C.lados, alto = false, libre = 0.6, puntaje = () => 0 } = {}) {
  let mejor = null;
  for (const L of lados) {
    if (largo(L) < w - EPS) continue;
    const ts = [];
    for (let t = L.a; t <= L.b - w + EPS; t += 0.05) ts.push(t);
    ts.push(L.b - w);
    for (const t of ts) {
      const h = huella(L, t, w, d);
      const fr = libre > 0 ? franjaFrente(h, h.rot, libre) : null;
      if (fr && !dentro(fr, C.I, 0.05)) continue;
      if (!valido(C, h, L, { alto, frente: fr })) continue;
      const s = puntaje(L, h);
      if (!mejor || s < mejor.s - EPS) mejor = { L, h, s, fr };
    }
  }
  return mejor;
}

function poner(C, out, base, tipo, h, extra = {}) {
  const def = MUEBLES[tipo] || {};
  const rot = h.rot ?? 0;
  const ancho = rot === 0 || rot === 180 ? h.x1 - h.x0 : h.y1 - h.y0;
  const fondo = rot === 0 || rot === 180 ? h.y1 - h.y0 : h.x1 - h.x0;
  const k = out.filter(o => o.id.startsWith(`${base}-${tipo}`)).length;
  const it = {
    id: `${base}-${tipo}${k ? '-' + k : ''}`, tipo, x: r2((h.x0 + h.x1) / 2), y: r2((h.y0 + h.y1) / 2),
    w: r2(ancho), d: r2(fondo), h: extra.alto ?? def.h ?? 0.8, rot, ...extra,
  };
  delete it.alto;
  out.push(it);
  if (!extra.suelo) C.items.push({ h: { x0: h.x0, x1: h.x1, y0: h.y0, y1: h.y1 }, tipo });
  return it;
}

const distCentroMuro = (L, h) => Math.abs((tDe(L, centro(h))) - (L.a + L.b) / 2);
const muroConPuerta = (C, L) => C.puertas.some(p => p.lado === L.lado);
const muroConVentana = (C, L) => C.ventanas.some(v => v.lado === L.lado);

/* ---------------------------------------------------------------- espacios */

function alcoba(C, out, base, principal) {
  const I = C.I, wI = I.x1 - I.x0, dI = I.y1 - I.y0, corto = Math.min(wI, dI), A = wI * dI;
  const orden = principal ? ['king', 'queen', 'doble'] : (corto >= 2.9 && A >= 10 ? ['doble', 'sencilla'] : ['sencilla']);
  let cama = null;
  for (const v of orden) {
    const [w, d] = MUEBLES.cama.var[v];
    const puertaOpuesta = L => C.puertas.some(p => p.lado === OPUESTO[L.lado]);
    const m = enMuro(C, w + 2 * 0.47, d, {
      libre: 0.65,
      puntaje: (L, h) => (muroConPuerta(C, L) ? 9 : 0) + (muroConVentana(C, L) ? 3 : 0) - (puertaOpuesta(L) ? 2 : 0) + distCentroMuro(L, h) * 1.4,
    }) || enMuro(C, w, d, { libre: 0.6, puntaje: (L, h) => (muroConPuerta(C, L) ? 9 : 0) + distCentroMuro(L, h) });
    if (!m) continue;
    // la cama queda centrada en la franja; las mesas de noche a los lados
    const conMesas = (m.h.rot === 0 || m.h.rot === 180 ? m.h.x1 - m.h.x0 : m.h.y1 - m.h.y0) > w + 0.5;
    const c = centro(m.h);
    const hb = m.h.rot === 0 || m.h.rot === 180
      ? { x0: c.x - w / 2, x1: c.x + w / 2, y0: m.h.y0, y1: m.h.y1, rot: m.h.rot }
      : { x0: m.h.x0, x1: m.h.x1, y0: c.y - w / 2, y1: c.y + w / 2, rot: m.h.rot };
    cama = poner(C, out, base, 'cama', hb, { var: v });
    C.reservas.push(m.fr);
    if (conMesas) {
      const [mw, md] = [0.45, 0.4];
      const lados = m.h.rot === 0 || m.h.rot === 180
        ? [{ x0: hb.x0 - mw - 0.02, x1: hb.x0 - 0.02 }, { x0: hb.x1 + 0.02, x1: hb.x1 + mw + 0.02 }].map(s => ({ ...s, y0: m.h.rot === 0 ? hb.y0 : hb.y1 - md, y1: m.h.rot === 0 ? hb.y0 + md : hb.y1, rot: m.h.rot }))
        : [{ y0: hb.y0 - mw - 0.02, y1: hb.y0 - 0.02 }, { y0: hb.y1 + 0.02, y1: hb.y1 + mw + 0.02 }].map(s => ({ ...s, x0: m.h.rot === 270 ? hb.x0 : hb.x1 - md, x1: m.h.rot === 270 ? hb.x0 + md : hb.x1, rot: m.h.rot }));
      lados.forEach(hm => { if (dentro(hm, I) && !C.puertas.some(p => sobre(hm, p.zona))) poner(C, out, base, 'mesaNoche', hm); });
    }
    break;
  }
  // closet: en un muro sin ventana, mejor en una esquina
  const lc = Math.min(principal ? 2.4 : 1.8, Math.max(1.2, Math.max(wI, dI) * 0.55));
  for (const w of [lc, 1.6, 1.2]) {
    const m = enMuro(C, w, 0.6, {
      alto: true, libre: 0.7,
      puntaje: (L, h) => {
        const t0 = tDe(L, { x: h.x0, y: h.y0 }), t1 = tDe(L, { x: h.x1, y: h.y1 });
        return Math.min(Math.abs(t0 - L.a), Math.abs(L.b - t1)) + (muroConPuerta(C, L) ? -0.3 : 0);
      },
    });
    if (m) { poner(C, out, base, 'closet', m.h); C.reservas.push(m.fr); break; }
  }
  if (!principal && A >= 9.5) {
    const m = enMuro(C, 1.2, 0.6, { libre: 0.75, puntaje: (L, h) => (muroConVentana(C, L) ? -1 : 0) + distCentroMuro(L, h) * 0.3 });
    if (m) {
      poner(C, out, base, 'escritorio', m.h);
      const fr = franjaFrente(m.h, m.h.rot, 0.55), cc = centro(fr);
      poner(C, out, base, 'sillaEsc', { x0: cc.x - 0.25, x1: cc.x + 0.25, y0: cc.y - 0.25, y1: cc.y + 0.25, rot: (m.h.rot + 180) % 360 }, { suelo: true });
    }
  }
  if (principal && A >= 15) {
    const m = enMuro(C, 1.2, 0.5, { libre: 0.7, puntaje: (L, h) => distCentroMuro(L, h) * 0.2 });
    if (m) poner(C, out, base, 'comoda', m.h);
  }
  esquinaPlanta(C, out, base);
  if (cama) cuadroSobre(C, out, base, cama);
}

function salaEn(C, out, base, Z, conTV = true) {
  // Z: subzona del espacio (todo el espacio o la mitad de un sala-comedor)
  const C2 = { ...C, I: Z, lados: ladosDe(Z) };
  const dZ = Math.min(Z.x1 - Z.x0, Z.y1 - Z.y0);
  const wS = Math.max(Z.x1 - Z.x0, Z.y1 - Z.y0) >= 3.4 ? 2.2 : 1.8;
  const m = enMuro(C2, wS, 0.92, {
    libre: Math.min(1.9, Math.max(1.2, dZ - 1.4)),
    puntaje: (L, h) => (muroConPuerta(C, L) ? 6 : 0) + distCentroMuro(L, h) * 1.2 - largo(L) * 0.15,
  });
  if (!m) { esquinaPlanta(C2, out, base); return; }
  const sofa = poner(C, out, base, 'sofa', m.h);
  C.items.push(...[]);
  // mesa de centro y tapete delante del sofa
  const fr = franjaFrente(m.h, m.h.rot, 1.05), cc = centro(fr);
  const horiz = m.h.rot === 0 || m.h.rot === 180;
  const hm = horiz ? { x0: cc.x - 0.55, x1: cc.x + 0.55, y0: cc.y - 0.3 + (m.h.rot === 0 ? 0.1 : -0.1), y1: cc.y + 0.3 + (m.h.rot === 0 ? 0.1 : -0.1), rot: m.h.rot }
    : { x0: cc.x - 0.3 + (m.h.rot === 270 ? 0.1 : -0.1), x1: cc.x + 0.3 + (m.h.rot === 270 ? 0.1 : -0.1), y0: cc.y - 0.55, y1: cc.y + 0.55, rot: m.h.rot };
  const ct = centro(m.h);
  const tw = Math.min(2.6, Math.max(Z.x1 - Z.x0, Z.y1 - Z.y0) - 0.4), td = Math.min(1.9, dZ - 0.5);
  const ht = horiz
    ? { x0: ct.x - tw / 2, x1: ct.x + tw / 2, y0: m.h.rot === 0 ? m.h.y1 - 0.25 : m.h.y0 + 0.25 - td, y1: m.h.rot === 0 ? m.h.y1 - 0.25 + td : m.h.y0 + 0.25, rot: m.h.rot }
    : { y0: ct.y - tw / 2, y1: ct.y + tw / 2, x0: m.h.rot === 270 ? m.h.x1 - 0.25 : m.h.x0 + 0.25 - td, x1: m.h.rot === 270 ? m.h.x1 - 0.25 + td : m.h.x0 + 0.25, rot: m.h.rot };
  if (dentro(ht, Z, 0.05)) poner(C, out, base, 'tapete', ht, { suelo: true, alto: 0.01 });
  if (dentro(hm, Z) && !C.items.some(it => sobre(hm, it.h)) && !C.puertas.some(p => sobre(hm, p.zona))) poner(C, out, base, 'mesaCentro', hm);
  // televisor en el muro de enfrente, a la altura del sofa
  if (conTV) {
    const Lop = C2.lados.find(L => L.lado === OPUESTO[m.L.lado]);
    const t = tDe(Lop, ct);
    const tv = enMuro(C2, 1.8, 0.45, { lados: [Lop], libre: 0.5, puntaje: (L, h) => Math.abs(tDe(L, centro(h)) - t) * 2 })
      || enMuro(C2, 1.2, 0.4, { lados: [Lop], libre: 0.4, puntaje: (L, h) => Math.abs(tDe(L, centro(h)) - t) * 2 });
    if (tv) poner(C, out, base, 'muebleTV', tv.h, { var: tv.h.x1 - tv.h.x0 > 1.5 || tv.h.y1 - tv.h.y0 > 1.5 ? 'grande' : 'pequeno' });
  }
  // poltrona al lado de la mesa, mirando hacia ella
  const lp = horiz
    ? [{ x0: hm.x1 + 0.35, x1: hm.x1 + 0.35 + 0.82, y0: cc.y - 0.41, y1: cc.y + 0.41, rot: 90 }, { x0: hm.x0 - 0.35 - 0.82, x1: hm.x0 - 0.35, y0: cc.y - 0.41, y1: cc.y + 0.41, rot: 270 }]
    : [{ y0: hm.y1 + 0.35, y1: hm.y1 + 0.35 + 0.82, x0: cc.x - 0.41, x1: cc.x + 0.41, rot: 180 }, { y0: hm.y0 - 0.35 - 0.82, y1: hm.y0 - 0.35, x0: cc.x - 0.41, x1: cc.x + 0.41, rot: 0 }];
  for (const hp of lp) {
    if (dentro(hp, Z) && !C.items.some(it => sobre(hp, it.h)) && !C.puertas.some(p => sobre(hp, p.zona)) && !C.reservas.some(z => sobre(hp, z))) { poner(C, out, base, 'poltrona', hp); break; }
  }
  // lampara junto al sofa
  const ls = horiz
    ? [{ x0: m.h.x1 + 0.05, x1: m.h.x1 + 0.45 }, { x0: m.h.x0 - 0.45, x1: m.h.x0 - 0.05 }].map(s => ({ ...s, y0: m.h.rot === 0 ? m.h.y0 : m.h.y1 - 0.4, y1: m.h.rot === 0 ? m.h.y0 + 0.4 : m.h.y1, rot: m.h.rot }))
    : [{ y0: m.h.y1 + 0.05, y1: m.h.y1 + 0.45 }, { y0: m.h.y0 - 0.45, y1: m.h.y0 - 0.05 }].map(s => ({ ...s, x0: m.h.rot === 270 ? m.h.x0 : m.h.x1 - 0.4, x1: m.h.rot === 270 ? m.h.x0 + 0.4 : m.h.x1, rot: m.h.rot }));
  for (const hl of ls) if (valido(C, hl, null)) { poner(C, out, base, 'lampara', hl); break; }
  esquinaPlanta(C2, out, base);
  cuadroSobre(C, out, base, sofa);
}

function comedorEn(C, out, base, Z) {
  const wZ = Z.x1 - Z.x0, dZ = Z.y1 - Z.y0, cx = (Z.x0 + Z.x1) / 2, cy = (Z.y0 + Z.y1) / 2;
  for (const v of ['c8', 'c6', 'c4']) {
    const [tw, td] = MUEBLES.comedor.var[v];
    for (const giro of [wZ >= dZ ? 0 : 90, wZ >= dZ ? 90 : 0]) {
      const fw = (giro === 0 ? tw : td) + 1.15, fd = (giro === 0 ? td : tw) + 1.15;
      if (fw > wZ + EPS || fd > dZ + EPS) continue;
      const h = { x0: cx - fw / 2, x1: cx + fw / 2, y0: cy - fd / 2, y1: cy + fd / 2, rot: giro };
      if (C.items.some(it => sobre(h, it.h)) || C.puertas.some(p => sobre(h, p.zona))) continue;
      poner(C, out, base, 'comedor', h, { var: v, w: tw, d: td });
      out[out.length - 1].w = tw; out[out.length - 1].d = td;
      const ZL = { ...C, I: Z, lados: ladosDe(Z) };
      const ap = enMuro(ZL, 1.6, 0.45, { libre: 0.4, puntaje: (L, hh) => distCentroMuro(L, hh) * 0.5 + (muroConPuerta(C, L) ? 3 : 0) });
      if (ap) poner(C, out, base, 'muebleTV', ap.h, { var: 'aparador' });
      esquinaPlanta(ZL, out, base);
      return;
    }
  }
}

function cocina(C, out, base) {
  const I = C.I, wI = I.x1 - I.x0, dI = I.y1 - I.y0;
  // tramo principal: el muro con mas largo libre de puertas
  const libres = C.lados.map(L => ({ L, seg: segmentosLibres(C, L, 0.62) })).map(o => ({ ...o, mejor: o.seg.sort((a, b) => (b[1] - b[0]) - (a[1] - a[0]))[0] }))
    .filter(o => o.mejor && o.mejor[1] - o.mejor[0] >= 1.4)
    .sort((a, b) => (b.mejor[1] - b.mejor[0]) - (a.mejor[1] - a.mejor[0]));
  if (!libres.length) return;
  const A = libres[0], [ta, tb] = A.mejor;
  const fondoLibre = (A.L.lado === 'S' || A.L.lado === 'N' ? dI : wI) - 0.62;
  if (fondoLibre < 0.85) return;
  // nevera en el extremo que da a la esquina
  const extremoA = Math.abs(ta - A.L.a) < 0.05 ? 'a' : Math.abs(tb - A.L.b) < 0.05 ? 'b' : 'a';
  let r0 = ta, r1 = tb;
  if (tb - ta >= 2.3) {
    const hn = extremoA === 'a' ? huella(A.L, ta, 0.78, 0.72) : huella(A.L, tb - 0.78, 0.78, 0.72);
    if (valido(C, hn, A.L, { alto: true })) {
      poner(C, out, base, 'nevera', hn);
      if (extremoA === 'a') r0 = ta + 0.8; else r1 = tb - 0.8;
    }
  }
  const tramo = huella(A.L, r0, r1 - r0, 0.62);
  const run = poner(C, out, base, 'cocinaBase', tramo, { tramo: true });
  C.reservas.push(franjaFrente(tramo, tramo.rot, 0.95));
  // lavaplatos frente a la ventana si la hay; estufa separada
  const v = C.ventanas.find(x => x.lado === A.L.lado && x.b > r0 && x.a < r1);
  const L = r1 - r0;
  let tLav = v ? Math.min(Math.max((v.a + v.b) / 2, r0 + 0.5), r1 - 0.5) : r0 + L * 0.35;
  let tEst = r0 + L * 0.78;
  if (Math.abs(tEst - tLav) < 0.9) tEst = tLav + 0.9 <= r1 - 0.4 ? tLav + 0.9 : Math.max(r0 + 0.4, tLav - 0.9);
  run.lav = r2(tLav - r0); run.est = r2(tEst - r0);
  // tramo en L sobre el muro contiguo, desde la esquina libre
  const dirs = { S: ['W', 'E'], N: ['W', 'E'], W: ['S', 'N'], E: ['S', 'N'] }[A.L.lado];
  for (const lado of dirs) {
    const L2 = C.lados.find(x => x.lado === lado);
    const fondoOtro = (L2.lado === 'S' || L2.lado === 'N' ? dI : wI);
    if (fondoOtro < 2.2) continue;
    const seg = segmentosLibres(C, L2, 0.62).find(s => (A.L.lado === 'S' ? Math.abs(s[0] - L2.a) < 0.05 : A.L.lado === 'N' ? Math.abs(s[1] - L2.b) < 0.05 : A.L.lado === 'W' ? Math.abs(s[0] - L2.a) < 0.05 : Math.abs(s[1] - L2.b) < 0.05));
    if (!seg) continue;
    const lng = Math.min(2.4, seg[1] - seg[0] - 0.62);
    if (lng < 1.0) continue;
    const t0 = (A.L.lado === 'S' || A.L.lado === 'W') ? L2.a + 0.62 : L2.b - 0.62 - lng;
    const h2 = huella(L2, t0, lng, 0.62);
    if (!valido(C, h2, L2)) continue;
    poner(C, out, base, 'cocinaBase', h2, { tramo: true });
    C.reservas.push(franjaFrente(h2, h2.rot, 0.95));
    break;
  }
  // isla si sobra espacio
  if (wI * dI >= 13 && Math.min(wI, dI) >= 3.5) {
    const cx = (I.x0 + I.x1) / 2, cy = (I.y0 + I.y1) / 2, horiz = A.L.lado === 'S' || A.L.lado === 'N';
    const off = A.L.lado === 'S' ? 0.35 : A.L.lado === 'N' ? -0.35 : 0, offx = A.L.lado === 'W' ? 0.35 : A.L.lado === 'E' ? -0.35 : 0;
    const hi = horiz ? { x0: cx - 0.9, x1: cx + 0.9, y0: cy - 0.45 + off, y1: cy + 0.45 + off, rot: A.L.lado === 'S' ? 180 : 0 }
      : { x0: cx - 0.45 + offx, x1: cx + 0.45 + offx, y0: cy - 0.9, y1: cy + 0.9, rot: A.L.lado === 'W' ? 90 : 270 };
    const conHolgura = { x0: hi.x0 - 0.95, x1: hi.x1 + 0.95, y0: hi.y0 - 0.95, y1: hi.y1 + 0.95 };
    if (dentro(conHolgura, I, 0.02) && !C.items.some(it => sobre(conHolgura, it.h))) poner(C, out, base, 'isla', hi);
  }
}

function bano(C, out, base, tipo) {
  const I = C.I, wI = I.x1 - I.x0, dI = I.y1 - I.y0;
  const largoX = wI >= dI;
  const pd = C.puertas[0];
  // la ducha va al fondo, lejos de la puerta
  if (tipo !== 'banoS') {
    const corto = Math.min(wI, dI);
    const lejos = pd ? OPUESTO[pd.lado] : (largoX ? 'E' : 'N');
    const lejosEje = (lejos === 'E' || lejos === 'W') === largoX ? lejos : (largoX ? 'E' : 'N');
    const dd = tipo === 'banoP' ? 1.2 : 0.95;
    let hd;
    if (corto <= 1.75) {
      // ducha de lado a lado en el extremo
      hd = lejosEje === 'E' ? { x0: I.x1 - dd, x1: I.x1, y0: I.y0, y1: I.y1 } : lejosEje === 'W' ? { x0: I.x0, x1: I.x0 + dd, y0: I.y0, y1: I.y1 }
        : lejosEje === 'N' ? { x0: I.x0, x1: I.x1, y0: I.y1 - dd, y1: I.y1 } : { x0: I.x0, x1: I.x1, y0: I.y0, y1: I.y0 + dd };
    } else {
      const s = 0.95;
      const cands = [
        { x0: I.x1 - (tipo === 'banoP' ? 1.2 : s), x1: I.x1, y0: I.y1 - s, y1: I.y1 }, { x0: I.x0, x1: I.x0 + (tipo === 'banoP' ? 1.2 : s), y0: I.y1 - s, y1: I.y1 },
        { x0: I.x1 - s, x1: I.x1, y0: I.y0, y1: I.y0 + s }, { x0: I.x0, x1: I.x0 + s, y0: I.y0, y1: I.y0 + s },
      ];
      const pc = pd ? centro(pd.zona) : { x: I.x0, y: I.y0 };
      hd = cands.filter(h => !C.puertas.some(p => sobre(h, p.zona))).sort((a, b) => Math.hypot(centro(b).x - pc.x, centro(b).y - pc.y) - Math.hypot(centro(a).x - pc.x, centro(a).y - pc.y))[0];
    }
    if (hd && !C.puertas.some(p => sobre(hd, p.zona))) poner(C, out, base, 'ducha', { ...hd, rot: 0 }, { alto: 2.1 });
  }
  // sanitario y lavamanos contra los muros, sanitario lejos de la puerta
  const pc = pd ? centro(pd.zona) : { x: I.x0, y: I.y0 };
  const s = enMuro(C, 0.5, 0.7, { libre: 0.45, puntaje: (L, h) => -Math.hypot(centro(h).x - pc.x, centro(h).y - pc.y) * 0.8 + (C.ventanas.some(v => v.lado === L.lado) ? 0.2 : 0) });
  if (s) { const c = centro(s.h); poner(C, out, base, 'inodoro', s.h.rot === 0 || s.h.rot === 180 ? { ...s.h, x0: c.x - 0.21, x1: c.x + 0.21 } : { ...s.h, y0: c.y - 0.21, y1: c.y + 0.21 }); }
  const wl = tipo === 'banoP' && Math.max(wI, dI) >= 2.6 ? 1.2 : tipo === 'banoS' ? 0.5 : 0.7;
  const l = enMuro(C, wl, 0.5, { libre: 0.55, puntaje: (L, h) => Math.hypot(centro(h).x - pc.x, centro(h).y - pc.y) * 0.4 })
    || enMuro(C, 0.5, 0.42, { libre: 0.45, puntaje: () => 0 });
  if (l) poner(C, out, base, 'lavamanos', l.h);
}

function estudio(C, out, base) {
  const m = enMuro(C, 1.4, 0.7, { libre: 0.8, puntaje: (L, h) => (muroConVentana(C, L) ? -2 : 0) + distCentroMuro(L, h) * 0.3 + (muroConPuerta(C, L) ? 4 : 0) });
  if (m) {
    poner(C, out, base, 'escritorio', m.h);
    const fr = franjaFrente(m.h, m.h.rot, 0.55), cc = centro(fr);
    poner(C, out, base, 'sillaEsc', { x0: cc.x - 0.28, x1: cc.x + 0.28, y0: cc.y - 0.28, y1: cc.y + 0.28, rot: (m.h.rot + 180) % 360 }, { suelo: true });
    C.reservas.push(fr);
  }
  for (let k = 0; k < 2; k++) {
    const b = enMuro(C, 1.0, 0.35, { alto: true, libre: 0.6, puntaje: (L, h) => distCentroMuro(L, h) * 0.2 });
    if (b) poner(C, out, base, 'biblioteca', b.h);
  }
  esquinaPlanta(C, out, base);
}

function ropas(C, out, base) {
  for (const tipo of ['lavadora', 'secadora', 'lavadero']) {
    const def = MUEBLES[tipo];
    const m = enMuro(C, def.w, def.d, { libre: 0.6, puntaje: (L, h) => {
      const prev = out.filter(o => o.id.startsWith(base) && (o.tipo === 'lavadora' || o.tipo === 'secadora'));
      return prev.length ? Math.min(...prev.map(p => Math.hypot(p.x - centro(h).x, p.y - centro(h).y))) : distCentroMuro(L, h) * 0.1;
    } });
    if (m) poner(C, out, base, tipo, m.h);
  }
}

function local(C, out, base) {
  const m = enMuro(C, Math.min(3, Math.max(1.6, (C.I.x1 - C.I.x0) * 0.4)), 0.6, { libre: 1.0, puntaje: (L, h) => (L.lado === 'N' ? -3 : 0) + distCentroMuro(L, h) * 0.3 + (muroConPuerta(C, L) ? 6 : 0) });
  if (m) poner(C, out, base, 'mostrador', m.h);
  for (let k = 0; k < 6; k++) {
    const e = enMuro(C, 1.0, 0.45, { alto: true, libre: 0.9, puntaje: (L, h) => (L.lado === 'W' || L.lado === 'E' ? -1 : 0) + Math.abs(tDe(L, centro(h)) - L.a) * 0.05 });
    if (!e) break;
    poner(C, out, base, 'estante', e.h);
  }
}

function bodega(C, out, base) {
  for (let k = 0; k < 4; k++) {
    const e = enMuro(C, 1.0, 0.45, { alto: true, libre: 0.8, puntaje: (L, h) => Math.abs(tDe(L, centro(h)) - L.a) * 0.05 });
    if (!e) break;
    poner(C, out, base, 'estante', e.h);
  }
}

/* ---------------------------------------------------------------- ayudas */

function ladosDe(I) {
  return [
    { lado: 'S', c: I.y0, a: I.x0, b: I.x1 }, { lado: 'N', c: I.y1, a: I.x0, b: I.x1 },
    { lado: 'W', c: I.x0, a: I.y0, b: I.y1 }, { lado: 'E', c: I.x1, a: I.y0, b: I.y1 },
  ];
}

/** Tramos de un muro sin puertas ni muebles, para un fondo dado. */
function segmentosLibres(C, L, d) {
  const cortes = [];
  const franja = huella(L, L.a, L.b - L.a, d);
  for (const p of C.puertas) if (sobre(franja, p.zona)) {
    const z = p.zona;
    cortes.push(L.lado === 'S' || L.lado === 'N' ? [z.x0, z.x1] : [z.y0, z.y1]);
  }
  for (const it of C.items) if (sobre(franja, it.h)) cortes.push(L.lado === 'S' || L.lado === 'N' ? [it.h.x0, it.h.x1] : [it.h.y0, it.h.y1]);
  cortes.sort((a, b) => a[0] - b[0]);
  const out = [];
  let cur = L.a;
  for (const [a, b] of cortes) { if (a > cur + 0.05) out.push([cur, Math.min(a, L.b)]); cur = Math.max(cur, b); }
  if (L.b > cur + 0.05) out.push([cur, L.b]);
  return out;
}

function esquinaPlanta(C, out, base) {
  const I = C.I, s = 0.45;
  const esquinas = [
    { x0: I.x0, x1: I.x0 + s, y0: I.y0, y1: I.y0 + s }, { x0: I.x1 - s, x1: I.x1, y0: I.y0, y1: I.y0 + s },
    { x0: I.x0, x1: I.x0 + s, y0: I.y1 - s, y1: I.y1 }, { x0: I.x1 - s, x1: I.x1, y0: I.y1 - s, y1: I.y1 },
  ];
  const puestas = out.filter(o => o.id.startsWith(base) && o.tipo === 'planta').length;
  if (puestas >= 2) return;
  for (const h of esquinas) {
    if (valido(C, h, null)) { poner(C, out, base, 'planta', { ...h, rot: 0 }); return; }
  }
}

/** Cuadro colgado en el muro detras de un mueble (cama, sofa). */
function cuadroSobre(C, out, base, it) {
  const w = Math.min(1.2, it.w * 0.6);
  const off = 0.02;
  let h;
  if (it.rot === 0) h = { x0: it.x - w / 2, x1: it.x + w / 2, y0: it.y - it.d / 2 - off, y1: it.y - it.d / 2 + 0.03, rot: 0 };
  else if (it.rot === 180) h = { x0: it.x - w / 2, x1: it.x + w / 2, y0: it.y + it.d / 2 - 0.03, y1: it.y + it.d / 2 + off, rot: 180 };
  else if (it.rot === 270) h = { x0: it.x - it.d / 2 - off, x1: it.x - it.d / 2 + 0.03, y0: it.y - w / 2, y1: it.y + w / 2, rot: 270 };
  else h = { x0: it.x + it.d / 2 - 0.03, x1: it.x + it.d / 2 + off, y0: it.y - w / 2, y1: it.y + w / 2, rot: 90 };
  poner(C, out, base, 'cuadro', h, { suelo: true, colgado: it.tipo === 'cama' ? 1.35 : 1.45, alto: 0.6 });
}

/**
 * Amobla todos los espacios de la casa.
 * @returns {Array} muebles con piso (f), espacio, tipo, centro, medidas y giro
 */
export function amoblar(M, quitar = []) {
  const out = [];
  const fuera = new Set(quitar);
  M.floors.forEach(fl => {
    fl.rects.forEach(r => {
      if (r.circ) return;
      const tipo = tipoEspacio(r.name, r.zone);
      r.tipo = tipo;
      const C = contexto(r, fl, M.R);
      const base = `${fl.f + 1}-${slug(r.name)}`;
      const ini = out.length;
      if (C.I.x1 - C.I.x0 < 0.9 || C.I.y1 - C.I.y0 < 0.9) return;
      const conComedor = /comedor|dining|manger/i.test(r.name);
      if (tipo === 'alcobaP' || tipo === 'alcoba') alcoba(C, out, base, tipo === 'alcobaP');
      else if (tipo === 'sala' && conComedor) {
        // sala-comedor: la sala hacia el frente y el comedor al fondo
        const I = C.I, horiz = (I.x1 - I.x0) >= (I.y1 - I.y0);
        const Za = horiz ? { ...I, x1: (I.x0 + I.x1) / 2 + 0.2 } : { ...I, y1: (I.y0 + I.y1) / 2 + 0.2 };
        const Zb = horiz ? { ...I, x0: (I.x0 + I.x1) / 2 + 0.2 } : { ...I, y0: (I.y0 + I.y1) / 2 + 0.2 };
        salaEn(C, out, base, Za);
        comedorEn(C, out, base, Zb);
      } else if (tipo === 'sala' || tipo === 'estar') salaEn(C, out, base, C.I, true);
      else if (tipo === 'comedor') comedorEn(C, out, base, C.I);
      else if (tipo === 'cocina') cocina(C, out, base);
      else if (tipo === 'bano' || tipo === 'banoP' || tipo === 'banoS') bano(C, out, base, tipo);
      else if (tipo === 'estudio') estudio(C, out, base);
      else if (tipo === 'ropas') ropas(C, out, base);
      else if (tipo === 'local') local(C, out, base);
      else if (tipo === 'bodega') bodega(C, out, base);
      else esquinaPlanta(C, out, base);
      for (let i = ini; i < out.length; i++) { out[i].f = fl.f; out[i].room = r.name; out[i].rt = tipo; }
    });
  });
  return out.filter(o => !fuera.has(o.id));
}
