/* ==========================================================================
   AXIONA OBRA · Fachadas, cortes, cubierta y detalles (primitivas)
   --------------------------------------------------------------------------
   Todo sale del modelo como primitivas de dibujo en metros: lineas (L),
   poligonos con relleno o rayado (P), textos (T), niveles (N), cotas (D) y
   llamadas (X). Las mismas primitivas se pintan en SVG para la pantalla y
   las laminas, y se escriben en DXF para AutoCAD. En fachadas y cortes x es
   la distancia horizontal y y la altura sobre N±0.00.
   ========================================================================== */

import { near, r2 } from './geometria.js';
import { tr } from './idioma.js';

const L = (p, w = 'f', x = {}) => ({ t: 'L', p, w, ...x });
const Pg = (p, fill, w = 'f', x = {}) => ({ t: 'P', p, fill, w, ...x });
const Rc = (x0, y0, x1, y1, fill, w = 'f', x = {}) => Pg([[x0, y0], [x1, y0], [x1, y1], [x0, y1]], fill, w, x);
const T = (x, y, txt, s = 2.2, x2 = {}) => ({ t: 'T', p: [x, y], txt, s, ...x2 });
const N = (x, y, v, x2 = {}) => ({ t: 'N', p: [x, y], v, ...x2 });
const D = (a, b, off, x = {}) => ({ t: 'D', a, b, off, ...x });
const X = (a, b, txt, x = {}) => ({ t: 'X', a, b, txt, s: 2, ...x });

function caja(prims) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  const ve = p => { x0 = Math.min(x0, p[0]); y0 = Math.min(y0, p[1]); x1 = Math.max(x1, p[0]); y1 = Math.max(y1, p[1]); };
  for (const q of prims) {
    if (q.p && Array.isArray(q.p[0])) q.p.forEach(ve);
    else if (q.p) ve(q.p);
    if (Array.isArray(q.a)) ve(q.a);
    if (Array.isArray(q.b)) ve(q.b);
  }
  return { x0, y0, x1, y1 };
}

/** Lados de la huella: como se ven desde afuera y que aberturas les tocan. */
function lados(M) {
  const R = M.R;
  return [
    { id: 'frente', o: 'H', c: R.y0, W: R.w, u: (x) => x - R.x0, d: [0, 1], n: [0, -1], borde: Rf => Rf.y0 },
    { id: 'derecha', o: 'V', c: R.x1, W: R.h, u: (_, y) => y - R.y0, d: [-1, 0], n: [1, 0], borde: Rf => Rf.x1 },
    { id: 'fondo', o: 'H', c: R.y1, W: R.w, u: (x) => R.x1 - x, d: [0, -1], n: [0, 1], borde: Rf => Rf.y1 },
    { id: 'izquierda', o: 'V', c: R.x0, W: R.h, u: (_, y) => R.y1 - y, d: [1, 0], n: [-1, 0], borde: Rf => Rf.x0 },
  ];
}

/** Franja de cada piso en una fachada: su propia linea de fachada y su ancho visto de frente. */
function franjas(M, s) {
  return M.floors.map(fl => {
    const Rf = fl.R || M.R, c = s.borde(Rf);
    const [a, b] = s.o === 'H' ? [Rf.x0, Rf.x1] : [Rf.y0, Rf.y1];
    const ua = s.o === 'H' ? s.u(a, c) : s.u(c, a), ub = s.o === 'H' ? s.u(b, c) : s.u(c, b);
    return { f: fl.f, c, u0: r2(Math.min(ua, ub)), u1: r2(Math.max(ua, ub)) };
  });
}

/** Quita puntos repetidos y los que quedan en medio de un tramo recto. */
function limpiar(pts) {
  const out = [];
  pts.forEach(p => { const q = out[out.length - 1]; if (!q || !near(q[0], p[0]) || !near(q[1], p[1])) out.push(p); });
  if (out.length > 1 && near(out[0][0], out[out.length - 1][0]) && near(out[0][1], out[out.length - 1][1])) out.pop();
  for (let k = out.length - 2; k > 0; k--) {
    const [a, b, c] = [out[k - 1], out[k], out[k + 1]];
    if (Math.abs((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])) < 1e-6) out.splice(k, 1);
  }
  return out;
}

/** Barandas de terrazas y balcones que se ven desde el lado s, en coordenadas de la fachada. */
function barandasVisibles(M, s) {
  const lista = [...(M.terrazas || []), ...(M.balcones || [])].flatMap(x => x.barandas.map(br => ({ ...br, f: x.f })));
  return lista.filter(br => {
    if (br.o !== s.o) return false;
    const Rf = M.floors[br.f].R || M.R, c = s.borde(Rf);
    return s.n[0] + s.n[1] > 0 ? br.c >= c - 0.01 : br.c <= c + 0.01;
  }).map(br => {
    const pa = s.o === 'H' ? [br.a, br.c] : [br.c, br.a], pb = s.o === 'H' ? [br.b, br.c] : [br.c, br.b];
    return { f: br.f, u0: r2(Math.min(s.u(...pa), s.u(...pb))), u1: r2(Math.max(s.u(...pa), s.u(...pb))) };
  });
}

function barandaEnAlzado(out, u0, u1, z) {
  out.push(Rc(u0, z, u1, z + 1.0, 'vidrio', 'f', { capa: 'BARANDAS' }));
  out.push(L([[u0, z + 1.0], [u1, z + 1.0]], 'm', { capa: 'BARANDAS' }));
  const n = Math.max(1, Math.round((u1 - u0) / 1.2));
  for (let k = 0; k <= n; k++) { const u = r2(u0 + (u1 - u0) * k / n); out.push(L([[u, z], [u, z + 1.0]], 'f', { capa: 'BARANDAS' })); }
}

/** Punto cardinal hacia el que mira una fachada (normal en el marco local). */
function orientacion(M, n) {
  const no = M.marco.norte;            // norte visto en el marco local
  const ang = (Math.atan2(n[0], n[1]) - Math.atan2(no.x, no.y)) * 180 / Math.PI;
  const a = ((ang % 360) + 360) % 360;
  const k = Math.round(a / 45) % 8;
  return tr([
    { es: 'norte', en: 'north' }, { es: 'nororiente', en: 'northeast' }, { es: 'oriente', en: 'east' }, { es: 'suroriente', en: 'southeast' },
    { es: 'sur', en: 'south' }, { es: 'suroccidente', en: 'southwest' }, { es: 'occidente', en: 'west' }, { es: 'noroccidente', en: 'northwest' },
  ][k]);
}

function ventana(out, u0, u1, z0, z1) {
  out.push(Rc(u0, z0, u1, z1, 'blanco', 'm', { capa: 'VENTANAS' }));
  out.push(Rc(u0 + 0.05, z0 + 0.05, u1 - 0.05, z1 - 0.05, 'vidrio', 'f', { capa: 'VENTANAS' }));
  const w = u1 - u0, n = w > 2.0 ? 3 : w > 1.1 ? 2 : 1;
  for (let k = 1; k < n; k++) out.push(L([[u0 + w * k / n, z0 + 0.05], [u0 + w * k / n, z1 - 0.05]], 'f', { capa: 'VENTANAS' }));
  out.push(L([[u0 - 0.05, z0 - 0.03], [u1 + 0.05, z0 - 0.03]], 'm', { capa: 'VENTANAS' }));
}

function puerta(out, u0, u1, z0, z1, principal) {
  out.push(Rc(u0, z0, u1, z1, 'puerta', 'm', { capa: 'PUERTAS' }));
  const w = u1 - u0;
  if (principal && w >= 1.15) {
    out.push(L([[u0 + w / 2, z0], [u0 + w / 2, z1 - 0.04]], 'f', { capa: 'PUERTAS' }));
  }
  out.push(Rc(u0 + 0.1, z0 + 0.25, u0 + w - 0.1, z1 - 0.25, 'nada', 'mf', { capa: 'PUERTAS' }));
  out.push({ t: 'C', p: [u1 - 0.12, z0 + 1.0], r: 0.03, fill: 'negro', w: 'mf', capa: 'PUERTAS' });
}

/** Proyecta las caras del techo que miran al observador. */
function techoEnFachada(out, M, s) {
  const T0 = M.techo, dl = M.dl;
  if (T0.tipo === 'plana') return;
  for (const cara of T0.caras) {
    const dot = cara.n[0] * s.d[0] + cara.n[1] * s.d[1];
    const pts = cara.pts.map(([x, y, z]) => [r2(s.u(x, y)), r2(z - dl)]);
    if (dot < -1e-6) {
      out.push(Pg(pts, 'cubierta', 'm', { capa: 'CUBIERTA', rayado: 'tejas' }));
    } else if (Math.abs(dot) < 1e-6) {
      // cara de canto: se ve como la linea del faldon con su espesor
      const ord = pts.slice().sort((a, b) => a[0] - b[0]);
      const a = ord[0], b = ord[ord.length - 1];
      out.push(L([a, b], 'g', { capa: 'CUBIERTA' }));
      out.push(L([[a[0], a[1] - 0.18], [b[0], b[1] - 0.18]], 'f', { capa: 'CUBIERTA' }));
    }
  }
}

/** Las cuatro fachadas. */
export function fachadas(M) {
  const { F, fh, dl, R } = M, T0 = M.techo;
  const top = F * fh;
  const vistas = [];
  for (const s of lados(M)) {
    const out = [];
    const W = s.W;
    // terreno natural (punteado) y terreno terminado
    const nat = [];
    for (let k = -6; k <= 26; k++) {
      const t = k / 20;
      const x = s.o === 'H' ? R.x0 + (R.x1 - R.x0) * t : s.c + s.n[0] * 1.5;
      const y = s.o === 'H' ? s.c + s.n[1] * 1.5 : R.y0 + (R.y1 - R.y0) * t;
      nat.push([r2(s.u(x, y)), r2(M.zf(x, y) - dl)]);
    }
    nat.sort((a, b) => a[0] - b[0]);
    out.push(L(nat, 'f', { trazo: 'oculto', capa: 'TERRENO' }));
    out.push(L([[-1.6, 0], [W + 1.6, 0]], 'g', { capa: 'TERRENO' }));
    out.push(Rc(-1.6, -0.35, W + 1.6, 0, 'tierra', 'nada', { capa: 'TERRENO', rayado: 'tierra' }));
    // cimentacion oculta
    if (M.sotano) out.push(Rc(0, -2.6, W, 0, 'nada', 'f', { trazo: 'oculto', capa: 'CIMENTACION' }));
    else out.push(L([[0, -M.desp], [W, -M.desp]], 'f', { trazo: 'oculto', capa: 'CIMENTACION' }));
    // muro escalonado: cada piso con su ancho, y timpano o antepecho sobre el ultimo
    const fr = franjas(M, s), ft = fr[F - 1];
    const timp = T0.timpanos.find(tp => (s.o === 'V' && tp.x !== undefined && near(tp.x, ft.c)) || (s.o === 'H' && tp.y !== undefined && near(tp.y, ft.c)));
    const plana = T0.tipo === 'plana', ap = plana ? T0.antepecho : 0;
    const der = fr.flatMap((b, f) => [[b.u1, f * fh], [b.u1, f === F - 1 ? top + ap : (f + 1) * fh]]);
    const izq = fr.flatMap((b, f) => [[b.u0, f * fh], [b.u0, f === F - 1 ? top + ap : (f + 1) * fh]]).reverse();
    const pico = [];
    if (timp && !plana) {
      const pk = timp.pts.map(([x, y, z]) => [r2(s.u(x, y)), r2(z - dl)]).sort((a, b) => a[0] - b[0]);
      pico.push([pk[1][0], pk[1][1] - 0.18]);
    }
    out.push(Pg(limpiar([[fr[0].u0, 0], ...der, ...pico, ...izq]), 'fachada', 'g', { capa: 'MUROS' }));
    if (plana) out.push(L([[ft.u0 - 0.03, top + ap], [ft.u1 + 0.03, top + ap]], 'm', { capa: 'MUROS' }));
    // entrepisos: la losa sobre cada piso tiene el ancho de ese piso
    for (let f = 1; f < F; f++) {
      const b = fr[f - 1];
      out.push(L([[b.u0, f * fh], [b.u1, f * fh]], 'mf', { capa: 'MUROS' }));
      out.push(L([[b.u0, f * fh - M.slab], [b.u1, f * fh - M.slab]], 'mf', { capa: 'MUROS' }));
    }
    out.push(L([[ft.u0, top - M.slab], [ft.u1, top - M.slab]], 'mf', { capa: 'MUROS' }));
    // balcones de frente y barandas de terrazas y balcones
    if (s.id === 'frente') (M.balcones || []).forEach(b => out.push(Rc(r2(s.u(b.x0, b.y0)), b.f * fh - M.slab, r2(s.u(b.x1, b.y0)), b.f * fh, 'fachada', 'm', { capa: 'MUROS' })));
    // aberturas
    M.floors.forEach(fl => fl.ops.forEach(o => {
      if (o.o !== s.o || !near(o.c, fr[fl.f].c) || o.kind === 'asc') return;
      const pa = s.o === 'H' ? [o.a, s.c] : [s.c, o.a], pb = s.o === 'H' ? [o.b, s.c] : [s.c, o.b];
      const u0 = r2(Math.min(s.u(...pa), s.u(...pb))), u1 = r2(Math.max(s.u(...pa), s.u(...pb)));
      const base = fl.f * fh;
      if (o.kind === 'win') ventana(out, u0, u1, base + o.sill, base + o.sill + o.h);
      else puerta(out, u0, u1, base, base + o.h, o.kind === 'main');
    }));
    // las barandas van delante de los muros y ventanas que quedan detrás de la terraza
    barandasVisibles(M, s).forEach(br => barandaEnAlzado(out, br.u0, br.u1, br.f * fh));
    techoEnFachada(out, M, s);
    // niveles a la derecha
    const xn = W + 0.9;
    for (let f = 0; f < F; f++) out.push(N(xn, f * fh, f * fh, { txt: f === 0 ? 'N±0.00' : null, et: tr({ es: `Piso ${f + 1}`, en: `Floor ${f + 1}` }) }));
    out.push(N(xn, top, top, { et: tr({ es: 'Enrase', en: 'Top of wall' }) }));
    if (T0.tipo !== 'plana') out.push(N(xn, r2(T0.zR - dl), r2(T0.zR - dl), { et: tr({ es: 'Cumbrera', en: 'Ridge' }) }));
    else out.push(N(xn, top + T0.antepecho, top + T0.antepecho, { et: tr({ es: 'Antepecho', en: 'Parapet' }) }));
    // cotas
    out.push(D([0, -0.9], [W, -0.9], 0));
    const hs = [0];
    for (let f = 1; f <= F; f++) hs.push(f * fh);
    for (let k = 1; k < hs.length; k++) out.push(D([-0.9, hs[k - 1]], [-0.9, hs[k]], 0, { vert: true }));
    const zMax = T0.tipo === 'plana' ? top + T0.antepecho : r2(T0.zR - dl);
    out.push(D([-1.7, 0], [-1.7, zMax], 0, { vert: true }));
    const nombre = { frente: { es: 'Fachada principal', en: 'Front elevation' }, derecha: { es: 'Fachada lateral derecha', en: 'Right side elevation' }, fondo: { es: 'Fachada posterior', en: 'Rear elevation' }, izquierda: { es: 'Fachada lateral izquierda', en: 'Left side elevation' } }[s.id];
    vistas.push({ id: 'F-' + s.id, titulo: `${tr(nombre)} (${orientacion(M, s.n)})`, prims: out, caja: caja(out), tipo: 'fachada' });
  }
  return vistas;
}

/**
 * Corte por una linea. eje 'y': corte longitudinal (x = valor, se mira hacia
 * −x, el frente a la izquierda). eje 'x': transversal (y = valor, se mira
 * desde el frente).
 */
export function corte(M, eje, valor, nombre) {
  const { R, F, fh, slab, dl, floors, stair } = M, T0 = M.techo;
  const out = [];
  const enY = eje === 'y';
  const a0 = enY ? R.y0 : R.x0, a1 = enY ? R.y1 : R.x1;
  const U = t => r2(t - a0);
  const W = a1 - a0, top = F * fh;
  // terreno
  const nat = [];
  for (let k = -8; k <= 28; k++) {
    const t = a0 + (a1 - a0) * k / 20;
    nat.push([U(t), r2((enY ? M.zf(valor, t) : M.zf(t, valor)) - dl)]);
  }
  out.push(L(nat, 'f', { trazo: 'oculto', capa: 'TERRENO' }));
  out.push(L([[-2, 0], [W + 2, 0]], 'm', { capa: 'TERRENO' }));
  out.push(Rc(-2, -1.0, W + 2, -0.08, 'tierra', 'nada', { capa: 'TERRENO', rayado: 'tierra' }));
  // contrapiso o losa de sotano
  if (M.sotano) {
    out.push(Rc(0, -2.75, W, -2.6, 'corte', 'm', { rayado: 'concreto', capa: 'ESTRUCTURA' }));
    out.push(Rc(-0.2, -2.75, 0, 0.3, 'corte', 'm', { rayado: 'concreto', capa: 'ESTRUCTURA' }));
    out.push(Rc(W, -2.75, W + 0.2, 0.3, 'corte', 'm', { rayado: 'concreto', capa: 'ESTRUCTURA' }));
    out.push(Rc(-0.4, -3.0, 0.4, -2.75, 'corte', 'm', { rayado: 'concreto', capa: 'CIMENTACION' }));
    out.push(Rc(W - 0.4, -3.0, W + 0.4, -2.75, 'corte', 'm', { rayado: 'concreto', capa: 'CIMENTACION' }));
    out.push(T(W / 2, -1.4, tr({ es: 'SÓTANO SIN TERMINAR', en: 'UNFINISHED BASEMENT' }), 2.2, { bold: true }));
  } else {
    out.push(Rc(0, -0.08, W, 0, 'corte', 'm', { rayado: 'concreto', capa: 'ESTRUCTURA' }));
  }
  // vigas de cimentacion y zapatas donde cruzan los ejes
  const ejes = enY ? M.axY : M.axX;
  if (M.sistema !== 'madera') {
    if (M.sistema === 'confinada') {
      floors[0].lines.filter(l => l.o === (enY ? 'H' : 'V') && valor > l.a - 0.01 && valor < l.b + 0.01).forEach(l => {
        if (M.mx?.cim) {
          // México: zapata corrida al desplante, muro de enrase de block y dala de desplante 15×20
          const { B, hz } = M.mx.cim, d = M.desp;
          out.push(Rc(U(l.c) - B / 2, -d, U(l.c) + B / 2, -d + hz, 'corte', 'm', { rayado: 'concreto', capa: 'CIMENTACION' }));
          out.push(Rc(U(l.c) - 0.075, -d + hz, U(l.c) + 0.075, -0.28, 'corte', 'm', { rayado: 'ladrillo', capa: 'CIMENTACION' }));
          out.push(Rc(U(l.c) - 0.075, -0.28, U(l.c) + 0.075, -0.08, 'corte', 'm', { rayado: 'concreto', capa: 'CIMENTACION' }));
          return;
        }
        out.push(Rc(U(l.c) - 0.2, -0.9, U(l.c) + 0.2, -0.4, 'corte', 'm', { rayado: 'ciclopeo', capa: 'CIMENTACION' }));
        out.push(Rc(U(l.c) - 0.125, -0.4, U(l.c) + 0.125, -0.08, 'corte', 'm', { rayado: 'concreto', capa: 'CIMENTACION' }));
      });
    } else {
      ejes.forEach(c => {
        out.push(Rc(U(c) - 0.15, -0.48, U(c) + 0.15, -0.08, 'corte', 'm', { rayado: 'concreto', capa: 'CIMENTACION' }));
        const col = M.cols.find(k => near(enY ? k.y : k.x, c));
        if (col) {
          out.push(Rc(U(c) - col.B / 2, -M.desp, U(c) + col.B / 2, -M.desp + col.h, 'nada', 'f', { trazo: 'oculto', capa: 'CIMENTACION' }));
          out.push(Rc(U(c) - M.colB / 2, -M.desp + col.h, U(c) + M.colB / 2, -0.48, 'nada', 'f', { trazo: 'oculto', capa: 'CIMENTACION' }));
        }
      });
    }
  }
  // losas, vigas y muros cortados por piso
  const enEscalera = stair && (enY ? valor > stair.x0 && valor < stair.x1 : valor > stair.y0 && valor < stair.y1);
  for (let f = 0; f < F; f++) {
    const z0 = f * fh, z1 = (f + 1) * fh;
    // la losa de arriba cubre la huella de este piso (con el hueco de la escalera)
    const Rf = floors[f].R || R;
    const cortado = enY ? valor > Rf.x0 - 0.01 && valor < Rf.x1 + 0.01 : valor > Rf.y0 - 0.01 && valor < Rf.y1 + 0.01;
    const p0 = U(enY ? Rf.y0 : Rf.x0), p1 = U(enY ? Rf.y1 : Rf.x1);
    const hueco = f < F - 1 && enEscalera ? [U(enY ? stair.y0 : stair.x0), U(enY ? stair.y1 : stair.x1)] : null;
    const tramos = !cortado ? [] : hueco ? [[p0, hueco[0]], [hueco[1], p1]] : [[p0, p1]];
    const esTecho = f === F - 1;
    if (!(esTecho && T0.tipo !== 'plana' && M.sistema === 'madera')) {
      tramos.forEach(([p, q]) => { if (q - p > 0.05) out.push(Rc(p, z1 - slab, q, z1, 'corte', 'm', { rayado: M.sistema === 'madera' ? 'madera' : 'concreto', capa: 'ESTRUCTURA' })); });
    } else if (cortado) out.push(L([[p0, z1 - 0.02], [p1, z1 - 0.02]], 'm', { capa: 'ESTRUCTURA' }));
    if (M.sistema !== 'madera' && M.sistema !== 'confinada' && cortado) {
      ejes.forEach(c => { if (U(c) > p0 - 0.01 && U(c) < p1 + 0.01 && (!hueco || U(c) < hueco[0] || U(c) > hueco[1])) out.push(Rc(U(c) - 0.15, z1 - slab - 0.25, U(c) + 0.15, z1 - slab, 'corte', 'm', { rayado: 'concreto', capa: 'ESTRUCTURA' })); });
    }
    // muros perpendiculares al corte
    const fl = floors[f];
    fl.lines.filter(l => l.o === (enY ? 'H' : 'V') && valor > l.a + 0.02 && valor < l.b - 0.02).forEach(l => {
      const t = l.ext ? 0.2 : 0.12, u = U(l.c);
      const op = fl.ops.find(o => o.o === l.o && near(o.c, l.c) && valor > o.a && valor < o.b);
      const muro = (za, zb) => out.push(Rc(u - t / 2, za, u + t / 2, zb, 'corte', 'm', { rayado: M.sistema === 'madera' ? 'aislamiento' : 'ladrillo', capa: 'MUROS' }));
      const zTop = z1 - slab;
      if (!op) muro(z0, zTop);
      else if (op.kind === 'win') {
        muro(z0, z0 + op.sill);
        if (z0 + op.sill + op.h < zTop - 0.02) muro(z0 + op.sill + op.h, zTop);
        out.push(Rc(u - 0.03, z0 + op.sill, u + 0.03, z0 + op.sill + op.h, 'vidrio', 'f', { capa: 'VENTANAS' }));
      } else if (z0 + op.h < zTop - 0.02) muro(z0 + op.h, zTop);
    });
    // espacios cortados: nombre y nivel
    fl.rects.filter(r => (enY ? valor > r.x0 && valor < r.x1 : valor > r.y0 && valor < r.y1) && !r.stair && !r.asc).forEach(r => {
      const p = U(enY ? r.y0 : r.x0), q = U(enY ? r.y1 : r.x1);
      if (q - p > 1.0) out.push(T((p + q) / 2, z0 + Math.min(1.25, fh * 0.45), r.name.toUpperCase(), 1.9, { bold: true }));
    });
    out.push(N(W + 1.0, z0, z0, { et: tr({ es: `Piso ${f + 1}`, en: `Floor ${f + 1}` }) }));
    // escalera
    if (enEscalera && f < F - 1) {
      const n = Math.round(fh / 0.18), rz = fh / n, tr0 = (stair.y1 - stair.y0 - 0.2) / n;
      if (enY) {
        const pts = [[U(stair.y0), z0]];
        for (let k = 0; k < n; k++) { pts.push([U(stair.y0 + k * tr0), z0 + (k + 1) * rz]); pts.push([U(stair.y0 + (k + 1) * tr0), z0 + (k + 1) * rz]); }
        pts.push([U(stair.y0 + n * tr0), z0 + fh - 0.18 - 0.12]);
        pts.push([U(stair.y0) + 0.25, z0]);
        out.push(Pg(pts, 'corte', 'm', { rayado: 'concreto', capa: 'ESTRUCTURA' }));
      } else {
        out.push(Rc(U(stair.x0) + 0.1, z0, U(stair.x1) - 0.1, z0 + fh * 0.5, 'nada', 'f', { capa: 'ESTRUCTURA' }));
      }
    }
  }
  // barandas de terrazas y balcones que cruza el corte
  [...(M.terrazas || []), ...(M.balcones || [])].forEach(x => x.barandas.forEach(br => {
    if (br.o !== (enY ? 'H' : 'V') || !(valor > br.a + 0.01 && valor < br.b - 0.01)) return;
    const u = U(br.c), z = x.f * fh;
    out.push(Rc(u - 0.03, z, u + 0.03, z + 1.0, 'vidrio', 'f', { capa: 'BARANDAS' }));
    out.push(L([[u - 0.05, z + 1.0], [u + 0.05, z + 1.0]], 'm', { capa: 'BARANDAS' }));
  }));
  (M.balcones || []).forEach(b => {
    if (enY && valor > b.x0 && valor < b.x1) out.push(Rc(U(b.y0), b.f * fh - slab, U(b.y1), b.f * fh, 'corte', 'm', { rayado: 'concreto', capa: 'ESTRUCTURA' }));
  });
  // cubierta
  if (T0.tipo === 'plana') {
    const ap = T0.antepecho, Rt = M.Rtop || R;
    const qa = U(enY ? Rt.y0 : Rt.x0), qb = U(enY ? Rt.y1 : Rt.x1);
    out.push(Rc(qa - 0.1, top, qa + 0.05, top + ap, 'corte', 'm', { rayado: 'ladrillo', capa: 'MUROS' }));
    out.push(Rc(qb - 0.05, top, qb + 0.1, top + ap, 'corte', 'm', { rayado: 'ladrillo', capa: 'MUROS' }));
    out.push(L([[qa + 0.05, top + 0.04], [qb - 0.05, top + 0.04]], 'm', { capa: 'CUBIERTA' }));
    out.push(N(W + 1.0, top, top, { et: tr({ es: 'Cubierta', en: 'Roof' }) }));
  } else {
    const prof = [];
    const E0 = enY ? T0.E.y0 : T0.E.x0, E1 = enY ? T0.E.y1 : T0.E.x1;
    for (let k = 0; k <= 40; k++) {
      const t = E0 + (E1 - E0) * k / 40;
      prof.push([U(t), r2((enY ? T0.altura(valor, t) : T0.altura(t, valor)) - dl)]);
    }
    const bajo = prof.map(([u, z]) => [u, z - 0.2]).reverse();
    out.push(Pg([...prof, ...bajo], 'corte', 'm', { rayado: M.sistema === 'madera' ? 'madera' : 'cubierta', capa: 'CUBIERTA' }));
    const zr = Math.max(...prof.map(p => p[1]));
    out.push(N(W + 1.0, top, top, { et: tr({ es: 'Enrase', en: 'Top of wall' }) }));
    out.push(N(W + 1.0, r2(zr), r2(zr), { et: tr({ es: 'Cumbrera', en: 'Ridge' }) }));
    if (M.sistema === 'madera') out.push(T(W / 2, top + 0.45, tr({ es: 'ÁTICO VENTILADO · AISLAMIENTO R-50', en: 'VENTED ATTIC · R-50 INSULATION' }), 1.8));
  }
  // cotas verticales
  for (let f = 0; f < F; f++) out.push(D([-1.2, f * fh], [-1.2, (f + 1) * fh], 0, { vert: true }));
  out.push(D([0, M.sotano ? -3.4 : -1.4], [W, M.sotano ? -3.4 : -1.4], 0));
  return { id: 'C-' + nombre, titulo: tr({ es: 'Corte {n}', en: 'Section {n}' }, { n: `${nombre}-${nombre}` }), prims: out, caja: caja(out), tipo: 'corte', eje, valor };
}

/** Corte longitudinal por la escalera y transversal por el primer espacio social. */
export function cortes(M) {
  const { R, stair } = M;
  const xA = stair ? r2((stair.x0 + stair.x1) / 2) : r2((R.x0 + R.x1) / 2);
  const social = M.floors[0].rects.filter(r => !r.circ).sort((a, b) => a.y0 - b.y0)[0];
  const yB = social ? r2((social.y0 + social.y1) / 2) : r2((R.y0 + R.y1) / 2);
  return [corte(M, 'y', xA, 'A'), corte(M, 'x', yB, 'B')];
}

/** Planta de cubierta con pendientes, cumbreras, limas y bajantes (en el marco del frente). */
export function plantaCubierta(M) {
  const T0 = M.techo, R = M.Rtop || M.R, out = [];
  const E = T0.E;
  // terrazas de los pisos de abajo, con su baranda y la huella de la base punteada
  if (M.terrazas?.length || M.balcones?.length) {
    out.push(Rc(M.R.x0, M.R.y0, M.R.x1, M.R.y1, 'nada', 'f', { trazo: 'oculto', capa: 'MUROS' }));
    [...(M.terrazas || []).flatMap(t => t.zonas.map(z => ({ ...z, f: t.f, n: { es: 'TERRAZA', en: 'TERRACE' } }))), ...(M.balcones || []).map(b => ({ ...b, n: { es: 'BALCÓN', en: 'BALCONY' } }))].forEach(z => {
      out.push(Rc(z.x0, z.y0, z.x1, z.y1, 'cubiertaPlana', 'm', { capa: 'TERRAZAS' }));
      if (Math.min(z.x1 - z.x0, z.y1 - z.y0) > 0.9) out.push(T((z.x0 + z.x1) / 2, (z.y0 + z.y1) / 2, `${tr(z.n)} ${tr({ es: 'PISO', en: 'FLOOR' })} ${z.f + 1}`, 1.6, { bold: true }));
    });
    [...(M.terrazas || []), ...(M.balcones || [])].forEach(x => x.barandas.forEach(br => out.push(L(br.o === 'H' ? [[br.a, br.c], [br.b, br.c]] : [[br.c, br.a], [br.c, br.b]], 'g', { capa: 'BARANDAS' }))));
  }
  if (T0.tipo === 'plana') {
    out.push(Rc(R.x0, R.y0, R.x1, R.y1, 'cubiertaPlana', 'g', { capa: 'CUBIERTA' }));
    out.push(Rc(R.x0 + 0.15, R.y0 + 0.15, R.x1 - 0.15, R.y1 - 0.15, 'nada', 'm', { capa: 'CUBIERTA' }));
    const cx = (R.x0 + R.x1) / 2;
    T0.bajantes.forEach(([x, y]) => {
      out.push({ t: 'C', p: [x, y], r: 0.12, fill: 'nada', w: 'm', capa: 'CUBIERTA' });
      out.push({ t: 'F', a: [cx + (x - cx) * 0.3, R.y0 + 1.2], b: [x, y - 0.25], txt: '2 %', capa: 'CUBIERTA' });
    });
    out.push(T(cx, (R.y0 + R.y1) / 2, tr({ es: 'CUBIERTA PLANA IMPERMEABILIZADA', en: 'WATERPROOFED FLAT ROOF' }), 2.2, { bold: true }));
  } else {
    out.push(Rc(R.x0, R.y0, R.x1, R.y1, 'nada', 'f', { trazo: 'oculto', capa: 'MUROS' }));
    out.push(Rc(E.x0, E.y0, E.x1, E.y1, 'cubierta', 'g', { capa: 'CUBIERTA' }));
    T0.cumbreras.forEach(([a, b]) => out.push(L([[a[0], a[1]], [b[0], b[1]]], 'g', { capa: 'CUBIERTA' })));
    T0.limas.forEach(([a, b]) => out.push(L([[a[0], a[1]], [b[0], b[1]]], 'm', { capa: 'CUBIERTA' })));
    for (const cara of T0.caras) {
      const n = cara.pts.length, cx = cara.pts.reduce((t, p) => t + p[0], 0) / n, cy = cara.pts.reduce((t, p) => t + p[1], 0) / n;
      out.push({ t: 'F', a: [cx - cara.n[0] * 0.8, cy - cara.n[1] * 0.8], b: [cx + cara.n[0] * 0.8, cy + cara.n[1] * 0.8], txt: `${T0.pend} %`, capa: 'CUBIERTA' });
    }
    T0.bajantes.forEach(([x, y]) => out.push({ t: 'C', p: [x, y], r: 0.1, fill: 'nada', w: 'm', capa: 'CUBIERTA' }));
  }
  if (M.terrazas?.length || M.balcones?.length) {
    // con terrazas: medidas de la base afuera y las de la cubierta por detrás, sin pisar las terrazas
    const B = M.R, y0 = Math.min(B.y0, ...(M.balcones || []).map(b => b.y0));
    out.push(D([B.x0, y0 - 1.0], [B.x1, y0 - 1.0], 0));
    out.push(D([B.x0 - 1.0, y0], [B.x0 - 1.0, B.y1], 0, { vert: true }));
    out.push(D([E.x0, E.y1 + 1.0], [E.x1, E.y1 + 1.0], 0));
    out.push(D([E.x0 - 2.0, E.y0], [E.x0 - 2.0, E.y1], 0, { vert: true }));
  } else {
    out.push(D([E.x0, E.y0 - 1.0], [E.x1, E.y0 - 1.0], 0));
    out.push(D([E.x0 - 1.0, E.y0], [E.x0 - 1.0, E.y1], 0, { vert: true }));
  }
  return { id: 'cubierta', titulo: tr({ es: 'Planta de cubierta', en: 'Roof plan' }), prims: out, caja: caja(out), tipo: 'planta', yArriba: true };
}

/* ---------------------------------------------------------------- detalles */

/** Detalles constructivos tipicos del sistema, dibujados a 1:20. */
export function detalles(M) {
  const sis = M.sistema;
  const out = [];
  if (sis === 'madera') {
    out.push(detalleMadera(M));
    out.push(detalleCimientoMadera(M));
    out.push(detalleAlero(M, true));
  } else {
    out.push(detalleCimiento(M));
    out.push(detalleMuro(M));
    out.push(M.techo.tipo === 'plana' ? detalleAntepecho(M) : detalleAlero(M, false));
  }
  return out;
}

/** Cimiento de la mampostería confinada en México: zapata corrida, enrase y dala de desplante. */
function detalleCimientoMX(M) {
  const o = [];
  const { B, hz } = M.mx.cim, dz = -M.desp;
  o.push(Rc(-1.2, dz - 0.15, 1.2, 0.0, 'tierra', 'nada', { rayado: 'tierra' }));
  o.push(Rc(-B / 2 - 0.05, dz - 0.05, B / 2 + 0.05, dz, 'corte', 'f', { rayado: 'concreto' }));
  o.push(Rc(-B / 2, dz, B / 2, dz + hz, 'corte', 'g', { rayado: 'concreto' }));
  o.push(Rc(-0.075, dz + hz, 0.075, -0.28, 'corte', 'g', { rayado: 'ladrillo' }));
  o.push(Rc(-0.075, -0.28, 0.075, -0.08, 'corte', 'g', { rayado: 'concreto' }));
  o.push(Rc(0.075, -0.08, 1.2, 0, 'corte', 'm', { rayado: 'concreto' }));
  o.push(Rc(0.075, 0, 1.2, 0.03, 'corte', 'f', { rayado: 'nada' }));
  o.push(Rc(-0.075, 0, 0.075, 0.6, 'corte', 'm', { rayado: 'ladrillo' }));
  for (let k = 0; k < 5; k++) o.push({ t: 'C', p: [-B / 2 + 0.06 + k * (B - 0.12) / 4, dz + 0.05], r: 0.008, fill: 'negro', w: 'mf' });
  [[-0.04, -0.24], [0.04, -0.24], [-0.04, -0.12], [0.04, -0.12]].forEach(p => o.push({ t: 'C', p, r: 0.007, fill: 'negro', w: 'mf' }));
  o.push(X([B / 2 - 0.08, dz + hz / 2], [1.5, dz + hz / 2], tr({ es: `Zapata corrida de concreto armado f'c = 200 kg/cm², B = ${B.toFixed(2)} m, h = ${hz.toFixed(2)} m`, en: `Reinforced strip footing B = ${B.toFixed(2)} m, h = ${hz.toFixed(2)} m` })));
  o.push(X([0, dz - 0.03], [1.5, dz - 0.25], tr({ es: 'Plantilla de concreto pobre de 5 cm', en: '5 cm blinding' })));
  o.push(X([0.05, (dz + hz - 0.28) / 2], [1.5, (dz + hz - 0.28) / 2], tr({ es: 'Muro de enrase de block relleno de concreto', en: 'Concrete-filled block stem wall' })));
  o.push(X([0.05, -0.18], [1.5, -0.4], tr({ es: 'Dala de desplante 15×20, 4 varillas de 3/8" y estribos', en: 'Grade beam 15×20, 4 #3 bars and ties' })));
  o.push(X([0.7, -0.04], [1.5, 0.15], tr({ es: 'Firme de 8 cm con malla 6-6/10-10 sobre relleno compactado', en: '8 cm slab on grade with mesh over compacted fill' })));
  o.push(X([0.7, 0.015], [1.5, 0.45], tr({ es: 'Piso de acabado', en: 'Floor finish' })));
  o.push(X([0, 0.4], [-1.6, 0.6], tr({ es: 'Muro de block de 15 cm', en: '15 cm block wall' }), { al: 'end' }));
  o.push(D([-B / 2, dz - 0.35], [B / 2, dz - 0.35], 0));
  o.push(D([-1.4, dz], [-1.4, 0], 0, { vert: true }));
  o.push(N(1.3, 0, 0, { txt: 'NPT ±0.00' }));
  return { id: 'det-cim', titulo: tr({ es: 'Detalle de cimentación', en: 'Foundation detail' }), prims: o, caja: caja(o), tipo: 'detalle', escala: 20 };
}

function detalleCimiento(M) {
  if (M.mx?.cim && M.sistema === 'confinada') return detalleCimientoMX(M);
  const o = [];
  const conf = M.sistema === 'confinada', es = M.pais === 'ES';
  const B = conf ? 0.4 : (M.cols[0]?.B || 1.0), h = conf ? 0.5 : (M.cols[0]?.h || 0.4), dz = conf ? -0.9 : -M.desp;
  o.push(Rc(-1.2, dz - 0.15, 1.2, 0.0, 'tierra', 'nada', { rayado: 'tierra' }));
  if (!conf) o.push(Rc(-B / 2 - 0.05, dz - 0.05, B / 2 + 0.05, dz, 'corte', 'f', { rayado: 'concreto' }));
  o.push(Rc(-B / 2, dz, B / 2, dz + h, 'corte', 'g', { rayado: conf ? 'ciclopeo' : 'concreto' }));
  if (!conf) o.push(Rc(-M.colB / 2, dz + h, M.colB / 2, -0.4, 'corte', 'g', { rayado: 'concreto' }));
  o.push(Rc(-0.15, -0.4, 0.15, 0, 'corte', 'g', { rayado: 'concreto' }));
  o.push(Rc(0.15, -0.08, 1.2, 0, 'corte', 'm', { rayado: 'concreto' }));
  o.push(Rc(0.15, 0, 1.2, 0.03, 'corte', 'f', { rayado: 'nada' }));
  o.push(Rc(-0.075, 0, 0.075, 0.6, 'corte', 'm', { rayado: 'ladrillo' }));
  for (let k = 0; k < 5; k++) o.push({ t: 'C', p: [-B / 2 + 0.08 + k * (B - 0.16) / 4, dz + 0.08], r: 0.008, fill: 'negro', w: 'mf' });
  o.push(X([B / 2 - 0.1, dz + h / 2], [1.5, dz + h / 2], conf ? tr({ es: 'Cimiento corrido en concreto ciclópeo 40×50', en: 'Cyclopean strip footing 40×50' }) : tr({ es: `Zapata ${B.toFixed(2)}×${B.toFixed(2)} e=${h.toFixed(2)}, ${es ? 'HA-25' : 'concreto 21 MPa'}`, en: `Footing ${B.toFixed(2)}×${B.toFixed(2)}, ${h.toFixed(2)} thick` })));
  if (!conf) o.push(X([0, dz - 0.03], [1.5, dz - 0.25], tr({ es: es ? 'Hormigón de limpieza HL-150, 10 cm' : 'Solado de limpieza e=5 cm', en: 'Blinding' })));
  o.push(X([0.1, -0.2], [1.5, -0.45], tr({ es: es ? 'Viga de atado 30×40' : 'Viga de cimentación 30×40', en: 'Grade beam 30×40' })));
  o.push(X([0.7, -0.04], [1.5, 0.15], tr({ es: es ? 'Solera de hormigón 10 cm sobre encachado' : 'Contrapiso e=8 cm sobre relleno compactado', en: 'Slab on grade over compacted fill' })));
  o.push(X([0.7, 0.015], [1.5, 0.45], tr({ es: 'Piso de acabado', en: 'Floor finish' })));
  o.push(X([0, 0.4], [-1.6, 0.6], tr({ es: es ? 'Fábrica de ladrillo' : 'Muro de bloque', en: 'Block wall' }), { al: 'end' }));
  o.push(D([-B / 2, dz - 0.35], [B / 2, dz - 0.35], 0));
  o.push(D([-1.4, dz], [-1.4, 0], 0, { vert: true }));
  o.push(N(1.3, 0, 0, { txt: 'N±0.00' }));
  return { id: 'det-cim', titulo: tr({ es: 'Detalle de cimentación', en: 'Foundation detail' }), prims: o, caja: caja(o), tipo: 'detalle', escala: 20 };
}

function detalleMuro(M) {
  const o = [], es = M.pais === 'ES', conf = M.sistema === 'confinada';
  const fh = M.fh, sl = M.slab;
  const t = es ? 0.115 : 0.15, sate = es ? 0.08 : 0;
  // muro con aislamiento exterior (España) o pañetado (Colombia)
  o.push(Rc(0, 0, t, fh - sl - 0.25, 'corte', 'g', { rayado: 'ladrillo' }));
  if (sate) o.push(Rc(-sate, 0, 0, fh - sl, 'corte', 'm', { rayado: 'aislamiento' }));
  o.push(Rc(-sate - 0.015, 0, -sate, fh - sl, 'corte', 'f', { rayado: 'nada' }));
  o.push(Rc(t, 0, t + 0.015, fh - sl - 0.25, 'corte', 'f', { rayado: 'nada' }));
  o.push(Rc(conf ? 0 : -0.05, fh - sl - 0.25, conf ? t : 0.25, fh - sl, 'corte', 'g', { rayado: 'concreto' }));
  o.push(Rc(conf ? 0 : -0.05, fh - sl, 1.4, fh, 'corte', 'g', { rayado: 'concreto' }));
  o.push(Rc(t, fh, 1.4, fh + 0.03, 'corte', 'f', { rayado: 'nada' }));
  o.push(Rc(t, fh - sl - 0.012, 1.4, fh - sl, 'corte', 'f', { rayado: 'nada' }));
  o.push(Rc(-0.08, 0.95, t + 0.02, 1.0, 'corte', 'm', { rayado: 'nada' }));
  o.push(Rc(-0.02, 1.0, t, 1.15, 'vidrio', 'm'));
  const mx = M.mx;
  o.push(X([t / 2, 0.5], [1.0, 0.4], mx ? (conf ? tr({ es: `Muro de block de 15 cm con castillos a cada ${mx.sep} m como máximo`, en: `15 cm block wall, tie columns every ${mx.sep} m max` }) : tr({ es: 'Muro de block de 15 cm aplanado', en: '15 cm block wall, plastered' })) : conf ? tr({ es: 'Muro portante de bloque confinado e=15', en: 'Confined load-bearing block wall' }) : es ? tr({ es: 'Fábrica de ladrillo perforado 11,5 cm', en: 'Perforated brick 11.5 cm' }) : tr({ es: 'Bloque N°5 e=15 pañetado', en: 'Block wall, plastered' })));
  if (sate) o.push(X([-sate / 2, 1.6], [-1.0, 1.6], tr({ es: 'SATE: aislamiento 8 cm + mortero armado', en: 'External insulation 8 cm' }), { al: 'end' }));
  o.push(X([0.2, fh - sl - 0.12], [1.0, fh - 0.55], mx ? (conf ? tr({ es: 'Dala de cerramiento 15×20', en: 'Bond beam 15×20' }) : tr({ es: 'Trabe de concreto armado', en: 'Reinforced concrete beam' })) : conf ? tr({ es: 'Viga de amarre 15×20', en: 'Bond beam 15×20' }) : tr({ es: 'Viga 30×25 descolgada', en: 'Beam 30×25' })));
  o.push(X([0.8, fh - sl / 2], [1.6, fh + 0.35], mx ? (mx.losa.ok ? tr({ es: `Losa de vigueta y bovedilla ${mx.losa.tipo}`, en: `Joist-and-block slab ${mx.losa.tipo}` }) : tr({ es: `Losa maciza e=${sl.toFixed(2)}`, en: `Solid slab ${sl.toFixed(2)}` })) : es ? tr({ es: 'Forjado unidireccional 25+5', en: 'One-way slab 25+5' }) : tr({ es: `Losa e=${sl.toFixed(2)}`, en: `Slab ${sl.toFixed(2)}` })));
  o.push(X([t / 2, 0.97], [-1.0, 0.85], tr({ es: 'Alféizar con goterón', en: 'Sill with drip' }), { al: 'end' }));
  o.push(D([1.6, 0], [1.6, fh], 0, { vert: true }));
  o.push(N(-1.2, 0, 0, { txt: 'NPT' }));
  return { id: 'det-muro', titulo: tr({ es: 'Detalle de muro de fachada', en: 'Exterior wall detail' }), prims: o, caja: caja(o), tipo: 'detalle', escala: 20 };
}

function detalleAntepecho() {
  const o = [];
  o.push(Rc(0, 0, 3, 0.12, 'corte', 'g', { rayado: 'concreto' }));
  o.push(Rc(0, 0.12, 3, 0.17, 'corte', 'f', { rayado: 'nada' }));
  o.push(Rc(2.85, 0.12, 3.0, 1.02, 'corte', 'g', { rayado: 'ladrillo' }));
  o.push(Rc(2.8, 1.02, 3.08, 1.06, 'corte', 'm', { rayado: 'nada' }));
  o.push(L([[0, 0.175], [2.85, 0.175], [2.85, 0.45]], 'm'));
  o.push(X([1.0, 0.06], [0.6, -0.4], tr({ es: 'Losa de cubierta', en: 'Roof slab' })));
  o.push(X([1.4, 0.15], [1.2, 0.6], tr({ es: 'Mortero de pendiente 2 % + impermeabilización', en: '2 % screed + waterproofing' })));
  o.push(X([2.85, 0.35], [2.0, 0.9], tr({ es: 'Media caña y remonte 30 cm', en: 'Upturn 30 cm' }), { al: 'end' }));
  o.push(X([2.95, 1.04], [3.6, 1.3], tr({ es: 'Flanche o remate con goterón', en: 'Coping with drip' })));
  o.push(D([3.4, 0.12], [3.4, 1.02], 0, { vert: true }));
  return { id: 'det-cub', titulo: tr({ es: 'Detalle de antepecho', en: 'Parapet detail' }), prims: o, caja: caja(o), tipo: 'detalle', escala: 20 };
}

function detalleAlero(M, madera) {
  const o = [], p = M.techo.p, a = M.techo.alero;
  const run = 2.0;
  const z = x => x * p;
  // muro, enrase y faldon con alero
  o.push(Rc(-0.2, -1.0, 0, 0, 'corte', 'g', { rayado: madera ? 'aislamiento' : 'ladrillo' }));
  const ls = [[-a, z(-a)], [run, z(run)]];
  o.push(Pg([[-a, z(-a)], [run, z(run)], [run, z(run) - 0.2], [-a, z(-a) - 0.2]], 'corte', 'g', { rayado: 'madera' }));
  o.push(L(ls.map(([x, y]) => [x, y + 0.03]), 'm'));
  o.push(Rc(-a - 0.04, z(-a) - 0.25, -a, z(-a) + 0.02, 'corte', 'm', { rayado: 'madera' }));
  o.push(Pg([[-a - 0.14, z(-a) - 0.05], [-a - 0.04, z(-a) - 0.05], [-a - 0.04, z(-a) - 0.17], [-a - 0.14, z(-a) - 0.17]], 'nada', 'm'));
  if (madera) {
    const xc = Math.min(run, (0.35 + 0.22) / p);
    o.push(Pg([[0, 0], [run, 0], [run, 0.35], [xc, 0.35]], 'corte', 'f', { rayado: 'aislamiento' }));
    o.push(L([[-a, z(-a) - 0.2], [0, z(-a) - 0.2]], 'f'));
    o.push(X([-a / 2, z(-a) - 0.2], [-a - 0.6, -0.8], tr({ es: 'Sofito ventilado', en: 'Vented soffit' }), { al: 'end' }));
    o.push(X([1.0, 0.2], [1.6, -0.5], tr({ es: 'Aislamiento de ático R-50', en: 'R-50 attic insulation' })));
    o.push(X([-a / 2, z(-a / 2) + 0.03], [-a - 0.4, z(1.2) + 0.6], tr({ es: 'Tejas asfálticas + membrana contra hielo en el alero', en: 'Shingles + ice & water shield at eave' }), { al: 'end' }));
    o.push(X([1.0, z(1.0) - 0.1], [1.9, z(1.0) + 0.6], tr({ es: 'Cercha de madera y tablero OSB', en: 'Wood truss and OSB sheathing' })));
  } else {
    o.push(X([1.0, z(1.0) - 0.1], [1.9, z(1.0) + 0.5], M.pais === 'ES' ? tr({ es: 'Teja cerámica sobre tablero y tabiquillos', en: 'Clay tile over deck' }) : tr({ es: 'Teja sobre estructura metálica o de madera', en: 'Roof tile over purlins' })));
    o.push(X([-a / 2, z(-a / 2) + 0.03], [-a - 0.4, z(1.2) + 0.4], tr({ es: 'Alero', en: 'Eave' }), { al: 'end' }));
  }
  o.push(X([-a - 0.09, z(-a) - 0.11], [-a - 0.5, -0.3], tr({ es: 'Canal', en: 'Gutter' }), { al: 'end' }));
  o.push(T(run / 2, z(run / 2) + 0.35, `${M.techo.pend} %`, 2));
  o.push(D([-a, -1.2], [0, -1.2], 0));
  return { id: 'det-cub', titulo: tr({ es: 'Detalle de alero', en: 'Eave detail' }), prims: o, caja: caja(o), tipo: 'detalle', escala: 20 };
}

function detalleMadera(M) {
  const o = [], fh = M.fh;
  const capas = [
    [-0.02, -0.0, 'nada', { es: 'Revestimiento exterior', en: 'Exterior cladding' }],
    [0, 0.011, 'madera', { es: 'Tablero OSB 11 mm', en: '11 mm OSB sheathing' }],
    [0.011, 0.151, 'aislamiento', { es: 'Montantes 2×6 @ 406 mm con aislamiento', en: '2×6 studs @ 16" with batt insulation' }],
    [0.151, 0.152, 'nada', { es: 'Barrera de vapor', en: 'Vapour barrier' }],
    [0.152, 0.165, 'nada', { es: 'Panel de yeso 13 mm', en: '1/2" drywall' }],
  ];
  capas.forEach(([a, b, ray, txt], k) => {
    o.push(Rc(a, 0, b, fh - 0.3, 'corte', b - a > 0.05 ? 'g' : 'f', { rayado: ray }));
    o.push(X([(a + b) / 2, 0.4 + k * 0.38], [k % 2 ? 0.9 : -0.8, 0.3 + k * 0.42], tr(txt), { al: k % 2 ? 'start' : 'end' }));
  });
  o.push(Rc(-0.02, fh - 0.3, 1.2, fh, 'corte', 'g', { rayado: 'madera' }));
  o.push(X([0.6, fh - 0.15], [1.4, fh + 0.3], tr({ es: 'Viguetas 2×10 y contrapiso 19 mm', en: '2×10 joists and 3/4" subfloor' })));
  o.push(D([1.5, 0], [1.5, fh], 0, { vert: true }));
  return { id: 'det-muro', titulo: tr({ es: 'Detalle de muro de entramado', en: 'Wood-frame wall section' }), prims: o, caja: caja(o), tipo: 'detalle', escala: 20 };
}

function detalleCimientoMadera(M) {
  const o = [], h = M.sotano ? 2.6 : Math.max(M.desp, 1.2) + 0.3;
  o.push(Rc(-1.2, -h - 0.3, 0, 0, 'tierra', 'nada', { rayado: 'tierra' }));
  o.push(Rc(-0.3, -h - 0.25, 0.5, -h, 'corte', 'g', { rayado: 'concreto' }));
  o.push(Rc(0, -h, 0.2, 0.3, 'corte', 'g', { rayado: 'concreto' }));
  o.push(Rc(-0.012, -h, 0, -0.05, 'corte', 'f', { rayado: 'nada' }));
  o.push({ t: 'C', p: [-0.15, -h - 0.1], r: 0.05, fill: 'nada', w: 'm' });
  if (M.sotano) o.push(Rc(0.2, -h, 1.4, -h + 0.1, 'corte', 'm', { rayado: 'concreto' }));
  o.push(Rc(0, 0.3, 0.14, 0.34, 'corte', 'm', { rayado: 'madera' }));
  o.push(X([0.1, -h - 0.12], [0.9, -h - 0.5], tr({ es: 'Zapata corrida bajo la helada', en: 'Strip footing below frost line' })));
  o.push(X([0.1, -h / 2], [0.9, -h / 2], tr({ es: M.sotano ? 'Muro de sótano 200 mm' : 'Muro de cimentación 200 mm', en: M.sotano ? '200 mm basement wall' : '200 mm foundation wall' })));
  o.push(X([-0.006, -h / 2 - 0.4], [-0.9, -h / 2 - 0.6], tr({ es: 'Impermeabilización', en: 'Damp-proofing' }), { al: 'end' }));
  o.push(X([-0.15, -h - 0.1], [-0.9, -h + 0.4], tr({ es: 'Drenaje perimetral en grava', en: 'Weeping tile in gravel' }), { al: 'end' }));
  if (M.sotano) o.push(X([0.9, -h + 0.05], [1.5, -h + 0.5], tr({ es: 'Losa 100 mm + polietileno + grava', en: '4" slab + poly + gravel' })));
  o.push(X([0.07, 0.32], [0.8, 0.7], tr({ es: 'Solera de anclaje', en: 'Sill plate with anchor bolts' })));
  o.push(D([-1.4, -h], [-1.4, 0], 0, { vert: true }));
  o.push(N(0.8, 0, 0, { txt: tr({ es: 'Rasante', en: 'Grade' }) }));
  return { id: 'det-cim', titulo: tr({ es: M.sotano ? 'Detalle de muro de sótano' : 'Detalle de cimentación', en: M.sotano ? 'Basement wall detail' : 'Foundation detail' }), prims: o, caja: caja(o), tipo: 'detalle', escala: 20 };
}
