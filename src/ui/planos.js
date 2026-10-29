/* ==========================================================================
   AXIONA OBRA · Planos en SVG
   --------------------------------------------------------------------------
   Implantacion, plantas arquitectonicas (con muebles, codigos de puertas y
   ventanas, acabados, marcas de cortes y fachadas), cimentacion, cubierta,
   plantas electricas e hidrosanitarias, fachadas y cortes. Se dibujan en el
   marco del frente (el frente del lote abajo), con el norte girado a su
   direccion real. Todo tamaño de letra y grosor esta en milimetros de papel
   a la escala de la lamina (K = escala / 100), asi la misma planta sirve
   para la pantalla, para una lamina a 1:50 y para otra a 1:100.
   ========================================================================== */

import { contours, dms, tr } from '../motor/index.js';
import { near } from '../motor/geometria.js';
import { fachadas, cortes, plantaCubierta } from '../motor/alzados.js';
import { $, fm, esc, fmtL, fmtA, fmtN } from './comun.js';
import { dibujar, TEMAS as TEMAS_D } from './dibujo.js';

export const THEMES = {
  dark: { bg: '#0b131c', ink: '#d7e4f0', thin: '#5f7389', grid: '#132130', col: '#ffae2b', fnd: '#3fcfff', win: '#41e2a4', mut: '#7f90a3', lot: '#ffae2b', cont: '#24405a', contM: '#3c6a8c', door: '#9fb3c8', mueble: '#7d93a8', muebleF: 'rgba(125,147,168,.07)', zone: { social: 'rgba(63,207,255,.07)', privada: 'rgba(255,174,43,.11)', servicio: 'rgba(65,226,164,.07)', circ: 'rgba(255,255,255,.03)' } },
  print: { bg: '#ffffff', ink: '#111111', thin: '#666666', grid: '#eeeeee', col: '#111111', fnd: '#0077aa', win: '#0a8f5a', mut: '#555555', lot: '#c46a00', cont: '#c9d6e2', contM: '#8aa6bf', door: '#333333', mueble: '#555555', muebleF: '#ffffff', zone: { social: '#f2f8fb', privada: '#fbf6ee', servicio: '#f1f8f4', circ: '#fafafa' } },
};
const TEMA_D = { dark: 'pantalla', print: 'impresion' };

export function doorGeom(o) {
  return o.o === 'H'
    ? { h: { x: o.a, y: o.c }, u: { x: 1, y: 0 }, n: { x: 0, y: o.dir } }
    : { h: { x: o.c, y: o.a }, u: { x: 0, y: 1 }, n: { x: o.dir, y: 0 } };
}

/** Vistas disponibles, por grupos (para los botones de la pestaña Planos). */
export function vistas(M) {
  const P = M.floors.map(f => ['p' + (f.f + 1), tr({ es: `Planta piso ${f.f + 1}`, en: `Floor ${f.f + 1} plan` })]);
  return [
    { g: tr({ es: 'Arquitectónicos', en: 'Architectural' }), v: [['sitio', tr({ es: 'Implantación', en: 'Site plan' })], ...P, ['cub', tr({ es: 'Cubierta', en: 'Roof' })]] },
    { g: tr({ es: 'Fachadas y cortes', en: 'Elevations & sections' }), v: [['F-frente', tr({ es: 'Principal', en: 'Front' })], ['F-derecha', tr({ es: 'Derecha', en: 'Right' })], ['F-fondo', tr({ es: 'Posterior', en: 'Rear' })], ['F-izquierda', tr({ es: 'Izquierda', en: 'Left' })], ['C-A', tr({ es: 'Corte A-A', en: 'Section A-A' })], ['C-B', tr({ es: 'Corte B-B', en: 'Section B-B' })]] },
    { g: tr({ es: 'Estructura y redes', en: 'Structure & MEP' }), v: [['cim', tr({ es: 'Cimentación', en: 'Foundation' })], ...M.floors.map(f => ['e' + (f.f + 1), tr({ es: `Eléctrico ${f.f + 1}`, en: `Electrical ${f.f + 1}` })]), ...M.floors.map(f => ['h' + (f.f + 1), tr({ es: `Hidrosanitario ${f.f + 1}`, en: `Plumbing ${f.f + 1}` })])] },
  ];
}

/** Vistas de primitivas (fachadas, cortes, cubierta), en cache por modelo. */
export function vistasDePrimitivas(M) {
  if (!M._prims) {
    const fs = fachadas(M), cs = cortes(M), cub = plantaCubierta(M);
    M._prims = { cub, cortes: cs };
    fs.forEach(v => { M._prims[v.id] = v; });
    cs.forEach((v, i) => { M._prims[i ? 'C-B' : 'C-A'] = v; });
  }
  return M._prims;
}

/* ------------------------------------------------------------- muebles */

function figuraMueble(m, T, K, X, Y) {
  const th = m.rot * Math.PI / 180, ux = Math.cos(th), uy = Math.sin(th), vx = -uy, vy = ux;
  const P = (u, v) => [X(m.x + u * ux + v * vx), Y(m.y + u * uy + v * vy)];
  const w = m.w, d = m.d, hw = w / 2, hd = d / 2;
  const sw = (0.13 * K).toFixed(4), sf = (0.08 * K).toFixed(4);
  const pol = (pts, extra = '') => `<polygon points="${pts.map(p => p.join(',')).join(' ')}" fill="${T.muebleF}" stroke="${T.mueble}" stroke-width="${sw}" ${extra}/>`;
  const rect = (u0, v0, u1, v1, extra) => pol([P(u0, v0), P(u1, v0), P(u1, v1), P(u0, v1)], extra);
  const lin = (u0, v0, u1, v1, extra = '') => `<line x1="${P(u0, v0)[0]}" y1="${P(u0, v0)[1]}" x2="${P(u1, v1)[0]}" y2="${P(u1, v1)[1]}" stroke="${T.mueble}" stroke-width="${sf}" ${extra}/>`;
  const circ = (u, v, r, extra = '') => `<circle cx="${P(u, v)[0]}" cy="${P(u, v)[1]}" r="${r}" fill="${T.muebleF}" stroke="${T.mueble}" stroke-width="${sf}" ${extra}/>`;
  const elip = (u, v, ru, rv) => {
    const pts = [];
    for (let k = 0; k < 20; k++) { const a = k / 20 * Math.PI * 2; pts.push(P(u + Math.cos(a) * ru, v + Math.sin(a) * rv)); }
    return pol(pts);
  };
  const s = [];
  switch (m.tipo) {
    case 'cama':
      s.push(rect(-hw, -hd, hw, hd));
      s.push(rect(-hw, -hd, hw, -hd + 0.06));
      if (w > 1.2) { s.push(rect(-hw + 0.08, -hd + 0.1, -0.04, -hd + 0.38)); s.push(rect(0.04, -hd + 0.1, hw - 0.08, -hd + 0.38)); } else s.push(rect(-hw + 0.1, -hd + 0.1, hw - 0.1, -hd + 0.38));
      s.push(lin(-hw, -hd + 0.62, hw, -hd + 0.62));
      s.push(lin(hw - 0.35, -hd + 0.62, hw, -hd + 0.97));
      break;
    case 'mesaNoche': s.push(rect(-hw, -hd, hw, hd)); s.push(circ(0, 0, 0.09)); break;
    case 'closet':
      s.push(rect(-hw, -hd, hw, hd)); s.push(lin(-hw, 0, hw, 0));
      for (let u = -hw + 0.12; u < hw - 0.05; u += 0.16) s.push(lin(u, -0.12, u + 0.04, 0.12));
      break;
    case 'comoda': s.push(rect(-hw, -hd, hw, hd)); s.push(lin(-hw, hd - 0.06, hw, hd - 0.06)); break;
    case 'escritorio': s.push(rect(-hw, -hd, hw, hd)); s.push(rect(-0.25, -hd + 0.05, 0.25, -hd + 0.12)); break;
    case 'sillaEsc': s.push(circ(0, 0, 0.24)); s.push(lin(-0.2, -0.18, 0.2, -0.18)); break;
    case 'biblioteca': s.push(rect(-hw, -hd, hw, hd)); for (let u = -hw + w / 4; u < hw - 0.01; u += w / 4) s.push(lin(u, -hd, u, hd)); break;
    case 'sofa': case 'poltrona': {
      s.push(rect(-hw, -hd, hw, hd));
      s.push(rect(-hw, -hd, hw, -hd + 0.2));
      s.push(rect(-hw, -hd + 0.2, -hw + 0.18, hd)); s.push(rect(hw - 0.18, -hd + 0.2, hw, hd));
      const n = m.tipo === 'sofa' ? 3 : 1, a0 = -hw + 0.18, ancho = (w - 0.36) / n;
      for (let k = 1; k < n; k++) s.push(lin(a0 + ancho * k, -hd + 0.2, a0 + ancho * k, hd));
      break;
    }
    case 'mesaCentro': s.push(rect(-hw, -hd, hw, hd)); s.push(rect(-hw + 0.06, -hd + 0.06, hw - 0.06, hd - 0.06)); break;
    case 'muebleTV': s.push(rect(-hw, -hd, hw, hd)); if (m.var !== 'aparador') s.push(rect(-Math.min(0.7, hw - 0.1), -hd + 0.03, Math.min(0.7, hw - 0.1), -hd + 0.08)); break;
    case 'tapete': s.push(rect(-hw, -hd, hw, hd, `stroke-dasharray="${(0.6 * K).toFixed(3)} ${(0.4 * K).toFixed(3)}" fill="none"`)); break;
    case 'lampara': s.push(circ(0, 0, 0.18)); s.push(lin(-0.12, -0.12, 0.12, 0.12)); s.push(lin(-0.12, 0.12, 0.12, -0.12)); break;
    case 'comedor': {
      s.push(rect(-hw, -hd, hw, hd));
      const n = m.var === 'c8' ? 3 : m.var === 'c6' ? 2 : 2, cab = m.var !== 'c4';
      for (let k = 0; k < n; k++) {
        const u = -hw + w * (k + 0.5) / n;
        s.push(rect(u - 0.2, hd + 0.06, u + 0.2, hd + 0.45)); s.push(rect(u - 0.2, -hd - 0.45, u + 0.2, -hd - 0.06));
      }
      if (cab) { s.push(rect(hw + 0.06, -0.2, hw + 0.45, 0.2)); s.push(rect(-hw - 0.45, -0.2, -hw - 0.06, 0.2)); }
      break;
    }
    case 'cocinaBase': case 'isla': {
      s.push(rect(-hw, -hd, hw, hd));
      s.push(lin(-hw, hd - 0.04, hw, hd - 0.04));
      if (m.lav !== undefined) { const u = -hw + m.lav; s.push(rect(u - 0.38, -hd + 0.1, u - 0.02, hd - 0.12)); s.push(rect(u + 0.02, -hd + 0.1, u + 0.38, hd - 0.12)); }
      if (m.est !== undefined) { const u = -hw + m.est; [[-0.15, -0.12], [0.15, -0.12], [-0.15, 0.14], [0.15, 0.14]].forEach(([du, dv]) => s.push(circ(u + du, dv, 0.085))); }
      break;
    }
    case 'nevera': s.push(rect(-hw, -hd, hw, hd)); s.push(lin(-hw, hd - 0.08, hw, hd - 0.08)); s.push(lin(-hw, -hd, hw, hd - 0.08)); break;
    case 'inodoro': s.push(rect(-0.2, -hd, 0.2, -hd + 0.18)); s.push(elip(0, -hd + 0.43, 0.18, 0.25)); break;
    case 'lavamanos': s.push(rect(-hw, -hd, hw, hd)); (w >= 1.15 ? [-w / 4, w / 4] : [0]).forEach(u => s.push(elip(u, 0, 0.2, 0.15))); break;
    case 'ducha': s.push(rect(-hw, -hd, hw, hd)); s.push(lin(-hw, -hd, hw, hd)); s.push(lin(-hw, hd, hw, -hd)); s.push(circ(0, 0, 0.04)); break;
    case 'tina': s.push(rect(-hw, -hd, hw, hd)); s.push(elip(0, 0, hw - 0.1, hd - 0.08)); break;
    case 'lavadora': case 'secadora': s.push(rect(-hw, -hd, hw, hd)); s.push(circ(0, 0.03, 0.2)); break;
    case 'lavadero': s.push(rect(-hw, -hd, hw, hd)); s.push(rect(-hw + 0.06, -hd + 0.08, hw - 0.06, hd - 0.06)); break;
    case 'mostrador': s.push(rect(-hw, -hd, hw, hd)); s.push(lin(-hw, -hd + 0.1, hw, -hd + 0.1)); break;
    case 'estante': s.push(rect(-hw, -hd, hw, hd)); s.push(lin(-hw, 0, hw, 0)); break;
    case 'planta': s.push(circ(0, 0, 0.22)); [[0.08, 0.05], [-0.07, 0.07], [0, -0.09]].forEach(([u, v]) => s.push(circ(u, v, 0.09))); break;
    default: break;
  }
  return s.join('');
}

/* ------------------------------------------------------------- simbolos de redes */

function simboloRed(sm, T, K, X, Y) {
  const x = X(sm.x), y = Y(sm.y), r = 0.14 * K, sw = (0.12 * K).toFixed(4), c = T.elec || T.ink;
  const t = (txt, s = 1.4) => `<text x="${x}" y="${y}" font-size="${(s * K * 0.1).toFixed(4)}" fill="${c}" text-anchor="middle" dominant-baseline="central" font-weight="700">${txt}</text>`;
  switch (sm.k) {
    case 'luz': return `<circle cx="${x}" cy="${y}" r="${r}" fill="none" stroke="${c}" stroke-width="${sw}"/><path d="M${x - r * 0.7} ${y - r * 0.7}L${x + r * 0.7} ${y + r * 0.7}M${x - r * 0.7} ${y + r * 0.7}L${x + r * 0.7} ${y - r * 0.7}" stroke="${c}" stroke-width="${sw}"/>`;
    case 'int': return `<circle cx="${x}" cy="${y}" r="${r * 0.8}" fill="${T.bg}" stroke="${c}" stroke-width="${sw}"/>${t(sm.n > 1 ? 'S2' : 'S', 1.2)}`;
    case 'toma': case 'tomaGFCI': return `<circle cx="${x}" cy="${y}" r="${r * 0.75}" fill="${T.bg}" stroke="${c}" stroke-width="${sw}"/><path d="M${x - r * 0.35} ${y - r * 0.4}v${r * 0.8}M${x + r * 0.35} ${y - r * 0.4}v${r * 0.8}" stroke="${c}" stroke-width="${sw}"/>${sm.k === 'tomaGFCI' ? `<text x="${x}" y="${y - r * 1.3}" font-size="${(0.1 * K).toFixed(4)}" fill="${c}" text-anchor="middle">GFCI</text>` : ''}`;
    case 'especial': return `<path d="M${x} ${y - r}L${x + r} ${y + r * 0.7}L${x - r} ${y + r * 0.7}Z" fill="${T.bg}" stroke="${c}" stroke-width="${sw}"/>`;
    case 'tablero': return `<rect x="${x - r * 2}" y="${y - r}" width="${r * 4}" height="${r * 2}" fill="${c}"/>`;
    case 'humo': return `<circle cx="${x}" cy="${y}" r="${r}" fill="${T.bg}" stroke="${c}" stroke-width="${sw}"/>${t(tr({ es: 'DH', en: 'SD' }), 1.1)}`;
    case 'bajante': return `<circle cx="${x}" cy="${y}" r="${r}" fill="${T.bg}" stroke="${T.desague}" stroke-width="${sw}"/><text x="${x}" y="${y}" font-size="${(0.12 * K).toFixed(4)}" fill="${T.desague}" text-anchor="middle" dominant-baseline="central">B</text>`;
    case 'medidor': return `<rect x="${x - r * 1.3}" y="${y - r}" width="${r * 2.6}" height="${r * 2}" fill="${T.bg}" stroke="${T.fria}" stroke-width="${sw}"/><text x="${x}" y="${y}" font-size="${(0.12 * K).toFixed(4)}" fill="${T.fria}" text-anchor="middle" dominant-baseline="central">M</text>`;
    case 'columna': return `<circle cx="${x}" cy="${y}" r="${r}" fill="${T.bg}" stroke="${T.fria}" stroke-width="${sw}"/>`;
    case 'caja': return `<rect x="${x - r * 1.6}" y="${y - r * 1.6}" width="${r * 3.2}" height="${r * 3.2}" fill="${T.bg}" stroke="${T.desague}" stroke-width="${sw}"/><path d="M${x - r * 1.6} ${y - r * 1.6}L${x + r * 1.6} ${y + r * 1.6}" stroke="${T.desague}" stroke-width="${sw}"/>`;
    case 'lluvia': return `<circle cx="${x}" cy="${y}" r="${r * 0.8}" fill="${T.bg}" stroke="${T.lluvia}" stroke-width="${sw}"/>`;
    case 'aparato': return `<circle cx="${x}" cy="${y}" r="${r * 0.45}" fill="${T.fria}"/>`;
    default: return '';
  }
}

/* ------------------------------------------------------------- planta */

/**
 * Cuerpo SVG de una vista de planta, en metros con origen arriba a la
 * izquierda. opts: tema, escala, muebles, tags, acabados, marcas, fmt.
 */
export function vistaPlano(M, view, opts = {}) {
  const theme = opts.tema || 'print';
  const T = { ...THEMES[theme], ...TEMAS_D[TEMA_D[theme]] };
  const K = (opts.escala || 100) / 100;
  const L0 = opts.fmt?.L || (v => fm(v));
  const R = M.R, out = [], cb = M.colB / 2;
  if (view === 'cub' || view.startsWith('F-') || view.startsWith('C-')) {
    const pv = vistasDePrimitivas(M);
    const v = view === 'cub' ? pv.cub : pv[view];
    const d = dibujar(v, { escala: opts.escala || 100, tema: TEMA_D[theme], fmt: opts.fmt });
    return { cuerpo: d.cuerpo, w: d.w, h: d.h, titulo: v.titulo };
  }
  const piso = /^[peh]\d+$/.test(view) ? +view.slice(1) - 1 : null;
  const capa = view[0] === 'e' ? 'elec' : view[0] === 'h' ? 'hidro' : 'arq';
  let ex0, ex1, ey0, ey1;
  if (view === 'sitio') { ex0 = M.bbox.minx - 4; ex1 = M.bbox.maxx + 4; ey0 = M.bbox.miny - 4; ey1 = M.bbox.maxy + 4; }
  else { ex0 = R.x0 - 4.4; ex1 = R.x1 + 3.2; ey0 = R.y0 - 5.6; ey1 = R.y1 + 2.8; }
  const W = ex1 - ex0, H = ey1 - ey0, X = x => +(x - ex0).toFixed(3), Y = y => +(ey1 - y).toFixed(3);
  const s = v => (v * K).toFixed(4);
  const Ln = (x1, y1, x2, y2, c, w, ex = '') => out.push(`<line x1="${X(x1)}" y1="${Y(y1)}" x2="${X(x2)}" y2="${Y(y2)}" stroke="${c}" stroke-width="${s(w)}" ${ex}/>`);
  const Rc = (x0, y0, x1, y1, fill, stroke = 'none', sw = 0, ex = '') => out.push(`<rect x="${X(Math.min(x0, x1))}" y="${Y(Math.max(y0, y1))}" width="${Math.abs(x1 - x0).toFixed(3)}" height="${Math.abs(y1 - y0).toFixed(3)}" fill="${fill}" stroke="${stroke}" stroke-width="${s(sw)}" ${ex}/>`);
  const Tx = (x, y, sz, t, c, ex = '') => out.push(`<text x="${X(x)}" y="${Y(y)}" font-size="${s(sz)}" fill="${c}" text-anchor="middle" dominant-baseline="middle" ${ex}>${esc(t)}</text>`);
  const poly = (pts, fill, stroke, sw, ex = '') => out.push(`<polygon points="${pts.map(p => X(p.x) + ',' + Y(p.y)).join(' ')}" fill="${fill}" stroke="${stroke}" stroke-width="${s(sw)}" ${ex}/>`);
  const pl = (pts, c, w, ex = '') => out.push(`<polyline points="${pts.map(p => X(p.x) + ',' + Y(p.y)).join(' ')}" fill="none" stroke="${c}" stroke-width="${s(w)}" ${ex}/>`);
  const B = 'font-weight="700"';
  const gris = capa !== 'arq';

  if (opts.cuadricula !== false && theme === 'dark') {
    for (let x = Math.ceil(ex0); x <= ex1; x++) Ln(x, ey0, x, ey1, T.grid, 0.012 / K);
    for (let y = Math.ceil(ey0); y <= ey1; y++) Ln(ex0, y, ex1, y, T.grid, 0.012 / K);
  }
  const dimH = (xs, y) => {
    Ln(xs[0], y, xs[xs.length - 1], y, T.thin, 0.018);
    xs.forEach(x => { Ln(x - 0.09 * K, y - 0.09 * K, x + 0.09 * K, y + 0.09 * K, T.ink, 0.03); Ln(x, y - 0.25, x, y + 0.1, T.thin, 0.012); });
    for (let i = 1; i < xs.length; i++) Tx((xs[i - 1] + xs[i]) / 2, y + 0.2 * K, 0.19, L0(xs[i] - xs[i - 1]), T.ink);
  };
  const dimV = (ys, x) => {
    Ln(x, ys[0], x, ys[ys.length - 1], T.thin, 0.018);
    ys.forEach(y => { Ln(x - 0.09 * K, y - 0.09 * K, x + 0.09 * K, y + 0.09 * K, T.ink, 0.03); Ln(x - 0.1, y, x + 0.25, y, T.thin, 0.012); });
    for (let i = 1; i < ys.length; i++) {
      const my = (ys[i - 1] + ys[i]) / 2, xx = x - 0.2 * K;
      out.push(`<text x="${X(xx)}" y="${Y(my)}" font-size="${s(0.19)}" fill="${T.ink}" text-anchor="middle" dominant-baseline="middle" transform="rotate(-90 ${X(xx)} ${Y(my)})">${esc(L0(ys[i] - ys[i - 1]))}</text>`);
    }
  };
  const axes = () => {
    M.axX.forEach((x, i) => {
      Ln(x, R.y0 - 2.9, x, R.y1 + 0.9, T.thin, 0.014, `stroke-dasharray="${s(0.35)} ${s(0.12)} ${s(0.06)} ${s(0.12)}"`);
      out.push(`<circle cx="${X(x)}" cy="${Y(R.y0 - 3.25)}" r="${s(0.3)}" fill="${T.bg}" stroke="${T.ink}" stroke-width="${s(0.025)}"/>`);
      Tx(x, R.y0 - 3.25, 0.28, String.fromCharCode(65 + i), T.ink, B);
    });
    M.axY.forEach((y, j) => {
      Ln(R.x0 - 2.9, y, R.x1 + 0.9, y, T.thin, 0.014, `stroke-dasharray="${s(0.35)} ${s(0.12)} ${s(0.06)} ${s(0.12)}"`);
      out.push(`<circle cx="${X(R.x0 - 3.25)}" cy="${Y(y)}" r="${s(0.3)}" fill="${T.bg}" stroke="${T.ink}" stroke-width="${s(0.025)}"/>`);
      Tx(R.x0 - 3.25, y, 0.28, String(j + 1), T.ink, B);
    });
    dimH(M.axX, R.y0 - 1.6); dimH([R.x0, R.x1], R.y0 - 2.3); dimV(M.axY, R.x0 - 1.6); dimV([R.y0, R.y1], R.x0 - 2.3);
  };
  const giroNorte = Math.atan2(M.marco.norte.x, M.marco.norte.y) * 180 / Math.PI;
  const north = (x, y) => out.push(`<g transform="translate(${X(x)} ${Y(y)}) rotate(${giroNorte.toFixed(2)}) scale(${K})"><circle r="0.55" fill="none" stroke="${T.thin}" stroke-width="0.02"/><path d="M0 -0.5 L0.2 0.3 L0 0.15 L-0.2 0.3 Z" fill="${T.ink}"/><text y="-0.75" font-size="0.3" fill="${T.ink}" text-anchor="middle" font-weight="700">N</text></g>`);

  if (view === 'sitio') {
    const cid = 'lotclip' + theme + Math.round(Math.random() * 1e6);
    out.push(`<clipPath id="${cid}"><polygon points="${M.lot.map(p => X(p.x) + ',' + Y(p.y)).join(' ')}"/></clipPath>`);
    out.push(`<g clip-path="url(#${cid})">`);
    contours(M.grid, 0.25).forEach(c => c.segs.forEach(sg => Ln(sg[0][0], sg[0][1], sg[1][0], sg[1][1], c.major ? T.contM : T.cont, c.major ? 0.035 : 0.018)));
    out.push('</g>');
    poly(M.lot, theme === 'dark' ? 'rgba(255,174,43,.04)' : 'none', T.lot, 0.06);
    Rc(M.P.x0, M.P.y0, M.P.x1, M.P.y1, 'none', T.thin, 0.02, `stroke-dasharray="${s(0.2)} ${s(0.15)}"`);
    // proyeccion de la cubierta y huella
    const E = M.techo.E;
    if (M.techo.tipo !== 'plana') Rc(E.x0, E.y0, E.x1, E.y1, 'none', T.thin, 0.02, `stroke-dasharray="${s(0.12)} ${s(0.08)}"`);
    Rc(R.x0, R.y0, R.x1, R.y1, theme === 'dark' ? 'rgba(63,207,255,.12)' : '#e6f4fa', T.fnd, 0.05);
    Tx((R.x0 + R.x1) / 2, (R.y0 + R.y1) / 2 + 0.25 * K, 0.4, tr({ es: 'HUELLA', en: 'FOOTPRINT' }), T.fnd, `${B} letter-spacing="0.06"`);
    Tx((R.x0 + R.x1) / 2, (R.y0 + R.y1) / 2 - 0.3 * K, 0.24, `${L0(R.w)} × ${L0(R.h)} · ${M.F} ${tr(M.F > 1 ? { es: 'pisos', en: 'storeys' } : { es: 'piso', en: 'storey' })}`, T.ink);
    // retiros acotados
    const cx0 = (R.x0 + R.x1) / 2;
    const yLot0 = Math.min(...M.lot.filter(p => Math.abs(p.x - cx0) < M.bbox.w).map(p => p.y));
    if (R.y0 - yLot0 > 0.3) { Ln(cx0 + 1.2, yLot0, cx0 + 1.2, R.y0, T.fnd, 0.02); Tx(cx0 + 1.6 + 0.4 * K, (yLot0 + R.y0) / 2, 0.2, L0(R.y0 - yLot0), T.fnd); }
    const cx = M.lot.reduce((t, p) => t + p.x, 0) / M.lot.length, cy = M.lot.reduce((t, p) => t + p.y, 0) / M.lot.length;
    M.sides.forEach(sd => {
      const a = M.lot[sd.from - 1], b = M.lot[sd.to - 1], mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      let nx = -(b.y - a.y), ny = b.x - a.x;
      const nl = Math.hypot(nx, ny) || 1; nx /= nl; ny /= nl;
      if ((mx - cx) * nx + (my - cy) * ny < 0) { nx = -nx; ny = -ny; }
      let ang = Math.atan2(-(b.y - a.y), b.x - a.x) * 180 / Math.PI;
      if (ang > 90) ang -= 180;
      if (ang < -90) ang += 180;
      const frente = sd.i === M.frente, px = mx + nx * 0.55 * K, py = my + ny * 0.55 * K;
      out.push(`<text x="${X(px)}" y="${Y(py)}" font-size="${s(0.32)}" fill="${T.lot}" text-anchor="middle" dominant-baseline="middle" transform="rotate(${ang.toFixed(2)} ${X(px)} ${Y(py)})">${frente ? tr({ es: 'FRENTE · ', en: 'FRONT · ' }) : ''}${esc(L0(sd.L))} · ${dms(sd.az)}</text>`);
    });
    M.lot.forEach((p, i) => {
      let dx = cx - p.x, dy = cy - p.y;
      const dd = Math.hypot(dx, dy) || 1; dx /= dd; dy /= dd;
      out.push(`<circle cx="${X(p.x)}" cy="${Y(p.y)}" r="${s(0.15)}" fill="${T.lot}"/>`);
      Tx(p.x - dx * 0.75 * K, p.y - dy * 0.75 * K, 0.32, `P${i + 1}`, T.ink, B);
      Tx(p.x - dx * 0.75 * K, p.y - dy * 0.75 * K - 0.42 * K, 0.22, `+${L0(p.z)}`, T.mut);
      Tx(p.x + dx * 1.15 * K, p.y + dy * 1.15 * K, 0.24, `${fm(M.angles[i], 1)}°`, T.fnd);
    });
    M.spots.forEach((p, i) => {
      out.push(`<path d="M${X(p.x) - 0.15 * K} ${Y(p.y)} h${s(0.3)} M${X(p.x)} ${Y(p.y) - 0.15 * K} v${s(0.3)}" stroke="${T.ink}" stroke-width="${s(0.03)}"/>`);
      Tx(p.x + 0.55 * K, p.y + 0.2 * K, 0.22, `C${i + 1} +${L0(p.z)}`, T.mut);
    });
    const az = M.slopeDir * Math.PI / 180, wx = Math.sin(az), wy = Math.cos(az);
    const ux = wx * M.marco.u.x + wy * M.marco.u.y, uy = wx * M.marco.v.x + wy * M.marco.v.y;
    const sx = cx - ux * 1.5, sy = (R.y1 + M.bbox.maxy) / 2 - uy * 1.5;
    if (M.slope > 0.5) {
      Ln(sx, sy, sx + ux * 3, sy + uy * 3, T.win, 0.05);
      out.push(`<circle cx="${X(sx + ux * 3)}" cy="${Y(sy + uy * 3)}" r="${s(0.12)}" fill="${T.win}"/>`);
      Tx(sx + ux * 1.5, sy + uy * 1.5 - 0.45 * K, 0.24, `${tr({ es: 'pend.', en: 'slope' })} ${fm(M.slope, 1)} %`, T.win);
    }
    north(ex1 - 1.2 * K, ey1 - 1.4 * K);
  } else if (view === 'cim') {
    axes();
    if (M.sistema === 'confinada') {
      M.floors[0].lines.forEach(l => {
        const t = 0.4;
        if (l.o === 'H') Rc(l.a - t / 2, l.c - t / 2, l.b + t / 2, l.c + t / 2, theme === 'dark' ? 'rgba(63,207,255,.07)' : '#eef8fc', T.fnd, 0.02, `stroke-dasharray="${s(0.12)} ${s(0.08)}"`);
        else Rc(l.c - t / 2, l.a - t / 2, l.c + t / 2, l.b + t / 2, theme === 'dark' ? 'rgba(63,207,255,.07)' : '#eef8fc', T.fnd, 0.02, `stroke-dasharray="${s(0.12)} ${s(0.08)}"`);
      });
      M.columnetas.forEach(c => Rc(c.x - 0.1, c.y - 0.075, c.x + 0.1, c.y + 0.075, T.col));
      Tx((R.x0 + R.x1) / 2, R.y1 + 1.6, 0.24, tr({ es: `Cimiento corrido ciclópeo 40×50 bajo todos los muros · ${M.columnetas.length} columnetas 15×20`, en: `Cyclopean strip footing 40×50 under all walls · ${M.columnetas.length} tie columns` }), T.mut);
    } else if (M.sistema === 'madera') {
      const t = 0.6;
      Rc(R.x0 - t / 2, R.y0 - t / 2, R.x1 + t / 2, R.y1 + t / 2, 'none', T.fnd, 0.03, `stroke-dasharray="${s(0.12)} ${s(0.08)}"`);
      Rc(R.x0 + 0.1, R.y0 + 0.1, R.x1 - 0.1, R.y1 - 0.1, 'none', T.fnd, 0.03, `stroke-dasharray="${s(0.12)} ${s(0.08)}"`);
      Rc(R.x0, R.y0, R.x1, R.y1, 'none', T.ink, 0.06);
      Rc(R.x0 + 0.2, R.y0 + 0.2, R.x1 - 0.2, R.y1 - 0.2, 'none', T.ink, 0.04);
      M.beams.forEach(b => Ln(b.a, b.c, b.b, b.c, T.ink, 0.05, `stroke-dasharray="${s(0.3)} ${s(0.1)}"`));
      M.cols.forEach(c => { Rc(c.x - c.B / 2, c.y - c.B / 2, c.x + c.B / 2, c.y + c.B / 2, 'none', T.fnd, 0.03, `stroke-dasharray="${s(0.12)} ${s(0.08)}"`); Rc(c.x - 0.06, c.y - 0.06, c.x + 0.06, c.y + 0.06, T.col); });
      Tx((R.x0 + R.x1) / 2, R.y1 + 1.6, 0.24, tr({ es: M.sotano ? 'Muros de sótano 200 mm sobre zapata corrida 600×250 · viga central de acero sobre postes' : 'Muros de cimentación bajo la helada sobre zapata corrida', en: M.sotano ? '200 mm basement walls on 600×250 strip footing · steel beam on posts' : 'Frost walls on strip footing' }), T.mut);
    } else {
      M.beams.forEach(b => {
        if (b.o === 'H') { Ln(b.a, b.c - 0.15, b.b, b.c - 0.15, T.ink, 0.02); Ln(b.a, b.c + 0.15, b.b, b.c + 0.15, T.ink, 0.02); }
        else { Ln(b.c - 0.15, b.a, b.c - 0.15, b.b, T.ink, 0.02); Ln(b.c + 0.15, b.a, b.c + 0.15, b.b, T.ink, 0.02); }
      });
      M.cols.forEach(c => {
        Rc(c.x - c.B / 2, c.y - c.B / 2, c.x + c.B / 2, c.y + c.B / 2, theme === 'dark' ? 'rgba(63,207,255,.08)' : '#eef8fc', T.fnd, 0.03, `stroke-dasharray="${s(0.12)} ${s(0.08)}"`);
        Rc(c.x - cb, c.y - cb, c.x + cb, c.y + cb, T.col);
        Tx(c.x, c.y - c.B / 2 - 0.22 * K, 0.19, `${c.type} ${L0(c.B)}`, T.fnd);
      });
      Tx((R.x0 + R.x1) / 2, R.y1 + 1.6, 0.24, tr({ es: `Vigas de cimentación 30×40 · desplante −${L0(M.desp)} · ${M.cols.length} zapatas · columnas ${Math.round(M.colB * 100)}×${Math.round(M.colB * 100)}`, en: `Grade beams 30×40 · footing depth −${L0(M.desp)} · ${M.cols.length} footings · columns ${Math.round(M.colB * 100)}×${Math.round(M.colB * 100)}` }), T.mut);
    }
    north(ex1 - 1.0 * K, ey1 - 1.1 * K);
  } else {
    const fl = M.floors[piso];
    if (!fl) return { cuerpo: '', w: W, h: H };
    if (capa === 'arq') axes();
    else { dimH([R.x0, R.x1], R.y0 - 1.6); dimV([R.y0, R.y1], R.x0 - 1.6); }
    if (!gris) fl.rects.forEach(r => Rc(r.x0, r.y0, r.x1, r.y1, T.zone[r.zone] || T.zone.circ));
    const st = fl.rects.find(r => r.stair);
    if (st) {
      for (let y = st.y0 + 0.28; y < st.y1 - 0.05; y += 0.28) Ln(st.x0 + 0.1, y, st.x1 - 0.1, y, T.thin, 0.015);
      const mx = (st.x0 + st.x1) / 2;
      Ln(mx, st.y0 + 0.3, mx, st.y1 - 0.4, T.ink, 0.025);
      out.push(`<path d="M${X(mx - 0.15)} ${Y(st.y1 - 0.65)} L${X(mx)} ${Y(st.y1 - 0.35)} L${X(mx + 0.15)} ${Y(st.y1 - 0.65)}" fill="none" stroke="${T.ink}" stroke-width="${s(0.025)}"/>`);
    }
    const asc = fl.rects.find(r => r.asc);
    if (asc) {
      Rc(asc.x0 + 0.15, asc.y0 + 0.2, asc.x1 - 0.15, asc.y1 - 0.15, 'none', T.ink, 0.02);
      Ln(asc.x0 + 0.15, asc.y0 + 0.2, asc.x1 - 0.15, asc.y1 - 0.15, T.thin, 0.015);
      Ln(asc.x0 + 0.15, asc.y1 - 0.15, asc.x1 - 0.15, asc.y0 + 0.2, T.thin, 0.015);
      Tx((asc.x0 + asc.x1) / 2, (asc.y0 + asc.y1) / 2, 0.17, tr({ es: 'ASCENSOR', en: 'ELEVATOR' }), T.mut, B);
    }
    const tinta = gris ? T.thin : T.ink;
    fl.lines.forEach(l => {
      const t = l.ext ? 0.2 : 0.12;
      l.pieces.forEach(([a, b]) => {
        const a2 = Math.abs(a - l.a) < 0.02 ? a - t / 2 : a, b2 = Math.abs(b - l.b) < 0.02 ? b + t / 2 : b;
        if (l.o === 'H') Rc(a2, l.c - t / 2, b2, l.c + t / 2, tinta); else Rc(l.c - t / 2, a2, l.c + t / 2, b2, tinta);
      });
    });
    fl.ops.forEach(o => {
      const ext = o.o === 'H' ? near(o.c, R.y0) || near(o.c, R.y1) : near(o.c, R.x0) || near(o.c, R.x1);
      const t = ext ? 0.2 : 0.12;
      if (o.kind === 'win') {
        if (o.o === 'H') { Rc(o.a, o.c - t / 2, o.b, o.c + t / 2, 'none', T.win, 0.02); Ln(o.a, o.c, o.b, o.c, T.win, 0.03); }
        else { Rc(o.c - t / 2, o.a, o.c + t / 2, o.b, 'none', T.win, 0.02); Ln(o.c, o.a, o.c, o.b, T.win, 0.03); }
        if (opts.tags && o.tag && !gris) {
          const sg = o.o === 'H' ? (near(o.c, R.y0) ? -1 : 1) : (near(o.c, R.x0) ? -1 : 1);
          const px = o.o === 'H' ? (o.a + o.b) / 2 : o.c + sg * 0.55 * K, py = o.o === 'H' ? o.c + sg * 0.55 * K : (o.a + o.b) / 2;
          out.push(`<rect x="${X(px) - 0.22 * K}" y="${Y(py) - 0.14 * K}" width="${s(0.44)}" height="${s(0.28)}" fill="${T.bg}" stroke="${T.win}" stroke-width="${s(0.015)}"/>`);
          Tx(px, py, 0.16, o.tag, T.win, B);
        }
      } else if (o.kind === 'asc') {
        if (o.o === 'H') Ln(o.a, o.c, o.b, o.c, T.ink, 0.04, `stroke-dasharray="${s(0.06)} ${s(0.04)}"`);
      } else {
        const g = doorGeom(o), pts = [];
        for (let k = 0; k <= 12; k++) {
          const th = k / 12 * Math.PI / 2;
          pts.push({ x: g.h.x + o.w * (Math.cos(th) * g.u.x + Math.sin(th) * g.n.x), y: g.h.y + o.w * (Math.cos(th) * g.u.y + Math.sin(th) * g.n.y) });
        }
        pl(pts, T.door, 0.015, `stroke-dasharray="${s(0.08)} ${s(0.05)}"`);
        Ln(g.h.x, g.h.y, g.h.x + g.n.x * o.w, g.h.y + g.n.y * o.w, tinta, o.kind === 'main' ? 0.05 : 0.035);
        if (opts.tags && o.tag && !gris) {
          const cx = g.h.x + g.u.x * o.w / 2 + g.n.x * o.w * 0.45, cy = g.h.y + g.u.y * o.w / 2 + g.n.y * o.w * 0.45;
          out.push(`<circle cx="${X(cx)}" cy="${Y(cy)}" r="${s(0.17)}" fill="${T.bg}" stroke="${T.door}" stroke-width="${s(0.015)}"/>`);
          Tx(cx, cy, 0.14, o.tag, T.ink, B);
        }
      }
    });
    if (M.sistema === 'confinada' && piso === 0) M.columnetas.forEach(c => Rc(c.x - 0.1, c.y - 0.075, c.x + 0.1, c.y + 0.075, gris ? T.thin : T.col));
    else if (M.sistema !== 'madera' && M.sistema !== 'confinada') M.cols.forEach(c => Rc(c.x - cb, c.y - cb, c.x + cb, c.y + cb, gris ? T.thin : T.col));
    // muebles (los de obra siempre; la dotacion si se amobla)
    if (opts.muebles !== false && capa !== 'elec') {
      const g = [];
      M.muebles.filter(m => m.f === piso && m.tipo !== 'cuadro').forEach(m => {
        if (!M.dotacionVisible && !['cocinaBase', 'isla', 'inodoro', 'lavamanos', 'ducha', 'tina', 'lavadero', 'closet'].includes(m.tipo)) return;
        g.push(figuraMueble(m, T, K, X, Y));
      });
      out.push(`<g opacity="${capa === 'hidro' ? 0.55 : 0.95}">${g.join('')}</g>`);
    }
    // nombres de los espacios
    fl.rects.forEach(r => {
      if (r.stair) {
        Tx((r.x0 + r.x1) / 2 + 0.55, (r.y0 + r.y1) / 2, 0.19, piso < M.F - 1 ? tr({ es: 'SUBE', en: 'UP' }) : tr({ es: 'LLEGA', en: 'DN' }), T.mut, `transform="rotate(-90 ${X((r.x0 + r.x1) / 2 + 0.55)} ${Y((r.y0 + r.y1) / 2)})"`);
        return;
      }
      if (r.asc) return;
      const fs = Math.max(0.15, Math.min(0.26, Math.min(r.w, r.h) * 0.09)), cx = (r.x0 + r.x1) / 2, cy = (r.y0 + r.y1) / 2;
      const yN = opts.muebles !== false && capa === 'arq' ? (r.y1 - Math.min(0.55, r.h * 0.22)) : cy + fs * 0.75 * K;
      Tx(cx, yN, fs, r.name.toUpperCase(), gris ? T.mut : T.ink, `${B} letter-spacing="0.02"`);
      if (!gris) Tx(cx, yN - fs * 1.25 * K, fs * 0.78, `${opts.fmt?.A ? opts.fmt.A(r.area) : fm(r.area, 1) + ' m²'}${opts.acabados && opts.codPiso ? ' · ' + opts.codPiso(r, piso) : ''}`, T.mut);
    });
    // redes
    if (capa === 'elec' || capa === 'hidro') {
      const red = M.redes.pisos[piso];
      const lineas = [];
      red.lin.forEach(l => {
        const ok = capa === 'elec' ? l.k === 'circuito' : l.k !== 'circuito';
        if (!ok) return;
        const c = T[l.k] || T.ink, w = l.k === 'desague' ? (l.colector ? 0.05 : 0.035) : 0.022;
        const da = l.k === 'caliente' ? `stroke-dasharray="${s(0.12)} ${s(0.06)}"` : l.k === 'desague' ? `stroke-dasharray="${s(0.25)} ${s(0.07)} ${s(0.04)} ${s(0.07)}"` : l.k === 'lluvia' ? `stroke-dasharray="${s(0.05)} ${s(0.07)}"` : l.k === 'circuito' ? `stroke-dasharray="${s(0.08)} ${s(0.06)}"` : '';
        if (l.curva) {
          const [a, b] = l.p ? l.p : l.pts;
          const mx = (a[0] + b[0]) / 2 + (b[1] - a[1]) * 0.18, my = (a[1] + b[1]) / 2 - (b[0] - a[0]) * 0.18;
          lineas.push(`<path d="M${X(a[0])} ${Y(a[1])} Q${X(mx)} ${Y(my)} ${X(b[0])} ${Y(b[1])}" fill="none" stroke="${c}" stroke-width="${s(w)}" ${da}/>`);
        } else lineas.push(`<polyline points="${l.pts.map(p => X(p[0]) + ',' + Y(p[1])).join(' ')}" fill="none" stroke="${c}" stroke-width="${s(w)}" ${da}/>`);
      });
      out.push(lineas.join(''));
      const sims = red.sim.filter(sm => (capa === 'elec') === ['luz', 'int', 'toma', 'tomaGFCI', 'especial', 'tablero', 'humo'].includes(sm.k));
      out.push(sims.map(sm => simboloRed(sm, T, K, X, Y)).join(''));
      if (capa === 'elec') {
        (M.domotica || []).forEach(d => d.pts.filter(p => p.f === piso).forEach(p => {
          out.push(`<rect x="${X(p.x) - 0.2 * K}" y="${Y(p.y) - 0.14 * K}" width="${s(0.4)}" height="${s(0.28)}" fill="${T.bg}" stroke="${T.domo}" stroke-width="${s(0.018)}"/>`);
          Tx(p.x, p.y, 0.14, d.sim, T.domo, B);
        }));
      }
    }
    // marcas de cortes y de fachadas
    if (opts.marcas && capa === 'arq') {
      const pv = vistasDePrimitivas(M);
      pv.cortes.forEach((c, i) => {
        const n = i ? 'B' : 'A';
        const [p, q] = c.eje === 'y' ? [[c.valor, R.y0 - 1.3], [c.valor, R.y1 + 1.0]] : [[R.x0 - 1.3, c.valor], [R.x1 + 1.0, c.valor]];
        Ln(p[0], p[1], q[0], q[1], T.ink, 0.025, `stroke-dasharray="${s(0.5)} ${s(0.1)} ${s(0.06)} ${s(0.1)}"`);
        const dir = c.eje === 'y' ? [-1, 0] : [0, 1];
        [p, q].forEach(e => {
          out.push(`<circle cx="${X(e[0])}" cy="${Y(e[1])}" r="${s(0.26)}" fill="${T.bg}" stroke="${T.ink}" stroke-width="${s(0.025)}"/>`);
          Tx(e[0], e[1], 0.24, n, T.ink, B);
          out.push(`<path d="M${X(e[0] + dir[0] * 0.3 * K)} ${Y(e[1] + dir[1] * 0.3 * K)} L${X(e[0] + dir[0] * 0.62 * K + dir[1] * 0.14 * K)} ${Y(e[1] + dir[1] * 0.62 * K + dir[0] * 0.14 * K)} L${X(e[0] + dir[0] * 0.62 * K - dir[1] * 0.14 * K)} ${Y(e[1] + dir[1] * 0.62 * K - dir[0] * 0.14 * K)} Z" fill="${T.ink}"/>`);
        });
      });
      [['frente', (R.x0 + R.x1) / 2, R.y0 - 4.3, 0, 1, 1], ['derecha', R.x1 + 2.2, (R.y0 + R.y1) / 2, -1, 0, 2], ['fondo', (R.x0 + R.x1) / 2, R.y1 + 2.1, 0, -1, 3], ['izquierda', R.x0 - 3.9, (R.y0 + R.y1) / 2, 1, 0, 4]].forEach(([, x, y, dx, dy, n]) => {
        out.push(`<path d="M${X(x + dx * 0.45 * K)} ${Y(y + dy * 0.45 * K)} L${X(x - dy * 0.3 * K)} ${Y(y + dx * 0.3 * K)} L${X(x + dy * 0.3 * K)} ${Y(y - dx * 0.3 * K)} Z" fill="${T.ink}"/>`);
        out.push(`<circle cx="${X(x - dx * 0.05)}" cy="${Y(y - dy * 0.05)}" r="${s(0.2)}" fill="${T.bg}" stroke="${T.ink}" stroke-width="${s(0.02)}"/>`);
        Tx(x - dx * 0.05, y - dy * 0.05, 0.17, String(n), T.ink, B);
      });
    }
    const lvl = M.dl + piso * M.fh;
    Tx(R.x0 + 1.4 * K, R.y1 + 0.9, 0.2, `${tr({ es: 'NPT', en: 'FFL' })} +${L0(piso * M.fh)} (${tr({ es: 'cota', en: 'elev.' })} ${L0(lvl)})`, T.mut);
    if (piso === 0) Tx((R.x0 + R.x1) / 2, R.y0 - 4.35, 0.22, tr({ es: '↓ FRENTE · ACCESO', en: '↓ FRONT · ENTRY' }), T.lot, 'font-weight="500"');
    north(ex1 - 1.0 * K, ey1 - 1.1 * K);
  }
  return { cuerpo: out.join(''), w: W, h: H };
}

/** SVG completo de una vista para la pantalla o la descarga. */
export function planSVG(M, view, theme, opts = {}) {
  const T = THEMES[theme];
  const v = vistaPlano(M, view, { tema: theme, escala: 100, tags: true, marcas: true, muebles: true, acabados: false, ...opts });
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${v.w.toFixed(2)} ${v.h.toFixed(2)}" data-w="${v.w}" data-h="${v.h}" preserveAspectRatio="xMidYMid meet" style="background:${T.bg}" font-family="IBM Plex Sans, Helvetica, Arial, sans-serif">${v.cuerpo}</svg>`;
}

/** Arrastrar, pellizcar y rueda para mover y acercar el plano. */
export function instalarPanZoom(box) {
  const ptrs = new Map();
  let last = null, pinch = null;
  const svg = () => box.querySelector('svg');
  const vb = () => svg().viewBox.baseVal;
  const zoomAt = (f, cx, cy) => {
    const sv = svg();
    if (!sv) return;
    const r = sv.getBoundingClientRect(), v = vb(), k = Math.max(v.width / r.width, v.height / r.height);
    const px = v.x + (cx - r.left - (r.width - v.width / k) / 2) * k, py = v.y + (cy - r.top - (r.height - v.height / k) / 2) * k;
    const nw = v.width * f, nh = v.height * f;
    if (nw < 1 || nw > 2000) return;
    v.x = px - (px - v.x) * f; v.y = py - (py - v.y) * f; v.width = nw; v.height = nh;
  };
  box.addEventListener('wheel', e => { e.preventDefault(); zoomAt(e.deltaY > 0 ? 1.15 : 1 / 1.15, e.clientX, e.clientY); }, { passive: false });
  box.addEventListener('pointerdown', e => {
    if (e.target.closest('.zoom')) return;
    box.setPointerCapture(e.pointerId);
    ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
    last = { x: e.clientX, y: e.clientY };
  });
  box.addEventListener('pointermove', e => {
    if (!ptrs.has(e.pointerId) || !svg()) return;
    ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (ptrs.size === 2) {
      const [a, b] = [...ptrs.values()], d = Math.hypot(a.x - b.x, a.y - b.y);
      if (pinch) zoomAt(pinch / d, (a.x + b.x) / 2, (a.y + b.y) / 2);
      pinch = d;
      return;
    }
    const r = svg().getBoundingClientRect(), v = vb(), k = Math.max(v.width / r.width, v.height / r.height);
    v.x -= (e.clientX - last.x) * k; v.y -= (e.clientY - last.y) * k;
    last = { x: e.clientX, y: e.clientY };
  });
  const up = e => { ptrs.delete(e.pointerId); if (ptrs.size < 2) pinch = null; const p = [...ptrs.values()][0]; if (p) last = { ...p }; };
  box.addEventListener('pointerup', up);
  box.addEventListener('pointercancel', up);
  box.querySelector('.zoom')?.addEventListener('click', e => {
    const b = e.target.closest('[data-zoom]');
    if (!b) return;
    const r = box.getBoundingClientRect();
    if (b.dataset.zoom === 'fit') ajustarPlano(box); else zoomAt(b.dataset.zoom === 'in' ? 0.8 : 1.25, r.left + r.width / 2, r.top + r.height / 2);
  });
}

export function ajustarPlano(box = $('#planBox')) {
  const sv = box?.querySelector('svg');
  if (!sv) return;
  const v = sv.viewBox.baseVal;
  v.x = 0; v.y = 0; v.width = +sv.dataset.w; v.height = +sv.dataset.h;
}

export { fmtL, fmtA, fmtN };
