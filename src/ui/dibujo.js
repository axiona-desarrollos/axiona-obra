/* ==========================================================================
   AXIONA OBRA · Dibujo de primitivas en SVG
   --------------------------------------------------------------------------
   Pinta las primitivas del motor (fachadas, cortes, cubierta, detalles) a
   una escala dada: grosores y textos se fijan en milimetros de papel y se
   convierten a metros del modelo, asi una fachada a 1:100 y un detalle a
   1:20 salen con la misma letra. Los rayados se calculan como lineas
   recortadas al poligono, para que pasen igual al PDF y al DXF.
   ========================================================================== */

import { esc } from './comun.js';

export const TEMAS = {
  impresion: {
    bg: '#ffffff', ink: '#111111', fino: '#3a3a3a', mut: '#5b5b5b', corte: '#dcdcdc', vidrio: '#e4f0f6', fachada: '#ffffff',
    cubierta: '#f2ece5', cubiertaPlana: '#f5f5f3', puerta: '#f7f3ee', tierra: '#f3efe6', blanco: '#ffffff', negro: '#111111', acento: '#0b5c78',
    fria: '#1565c0', caliente: '#c62828', desague: '#5d4037', lluvia: '#00838f', elec: '#111111', circuito: '#555555', domo: '#6a1b9a',
  },
  pantalla: {
    bg: '#0b131c', ink: '#d7e4f0', fino: '#8aa0b5', mut: '#7f90a3', corte: '#1c2a38', vidrio: 'rgba(65,226,164,.16)', fachada: 'rgba(255,255,255,.035)',
    cubierta: 'rgba(255,174,43,.10)', cubiertaPlana: 'rgba(255,255,255,.03)', puerta: 'rgba(255,255,255,.05)', tierra: 'rgba(135,116,76,.10)', blanco: '#0f1a25', negro: '#d7e4f0', acento: '#3fcfff',
    fria: '#4fa3ff', caliente: '#ff6b6b', desague: '#c9a27e', lluvia: '#3fcfff', elec: '#ffd36b', circuito: '#9fb3c8', domo: '#d29bff',
  },
};

export const PESOS = { g: 0.5, m: 0.3, f: 0.18, mf: 0.1, nada: 0 };
const RAYADOS = {
  concreto: { ang: 45, sep: 1.6 }, ladrillo: { ang: 45, sep: 0.9 }, tierra: { ang: 45, sep: 2.6 }, aislamiento: { ang: 60, sep: 1.3, cruz: 120 },
  madera: { ang: 15, sep: 1.1 }, ciclopeo: { ang: 45, sep: 2.2, cruz: 135 }, cubierta: { ang: 30, sep: 1.8 }, tejas: { ang: 0, real: 0.32 },
};

/** Lineas paralelas recortadas a un poligono (cualquiera, par-impar). */
export function rayar(pts, ang, sep) {
  const a = ang * Math.PI / 180, c = Math.cos(a), s = Math.sin(a);
  const rot = pts.map(([x, y]) => [x * c + y * s, -x * s + y * c]);
  let y0 = Infinity, y1 = -Infinity;
  rot.forEach(p => { y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); });
  const segs = [];
  for (let y = y0 + sep / 2; y < y1; y += sep) {
    const xs = [];
    for (let i = 0; i < rot.length; i++) {
      const p = rot[i], q = rot[(i + 1) % rot.length];
      if ((p[1] > y) !== (q[1] > y)) xs.push(p[0] + (y - p[1]) / (q[1] - p[1]) * (q[0] - p[0]));
    }
    xs.sort((m, n) => m - n);
    for (let k = 0; k + 1 < xs.length; k += 2) segs.push([[xs[k], y], [xs[k + 1], y]]);
  }
  return segs.map(sg => sg.map(([x, y]) => [x * c - y * s, x * s + y * c]));
}

/**
 * Pinta una vista. Devuelve el cuerpo SVG en metros con origen arriba a la
 * izquierda, y su ancho y alto.
 */
export function dibujar(vista, { escala = 100, tema = 'impresion', fmt, margen = 0.6 } = {}) {
  const T = TEMAS[tema] || TEMAS.impresion, k = escala / 1000;
  const c = vista.caja;
  const X = x => +(x - c.x0 + margen).toFixed(4), Y = y => +(c.y1 - y + margen).toFixed(4);
  const w = c.x1 - c.x0 + 2 * margen, h = c.y1 - c.y0 + 2 * margen;
  const sw = p => (PESOS[p] ?? 0.18) * k;
  const out = [];
  const color = f => (f === 'nada' || !f ? 'none' : T[f] || f);
  const dash = t => (t === 'oculto' ? ` stroke-dasharray="${(1.6 * k).toFixed(4)} ${(0.9 * k).toFixed(4)}"` : t === 'eje' ? ` stroke-dasharray="${(5 * k).toFixed(4)} ${(1 * k).toFixed(4)} ${(0.6 * k).toFixed(4)} ${(1 * k).toFixed(4)}"` : '');
  const txt = (x, y, s, t, ex = '') => out.push(`<text x="${X(x)}" y="${Y(y)}" font-size="${(s * k).toFixed(4)}" fill="${T.ink}" ${ex}>${esc(t)}</text>`);
  for (const q of vista.prims) {
    if (q.t === 'L') {
      out.push(`<polyline points="${q.p.map(p => X(p[0]) + ',' + Y(p[1])).join(' ')}" fill="none" stroke="${q.c ? T[q.c] || q.c : T.ink}" stroke-width="${sw(q.w).toFixed(4)}"${dash(q.trazo)} stroke-linejoin="round"/>`);
    } else if (q.t === 'P') {
      const f = color(q.fill);
      out.push(`<polygon points="${q.p.map(p => X(p[0]) + ',' + Y(p[1])).join(' ')}" fill="${f}" stroke="${q.w === 'nada' ? 'none' : T.ink}" stroke-width="${sw(q.w).toFixed(4)}"${dash(q.trazo)} stroke-linejoin="round"/>`);
      const R = RAYADOS[q.rayado];
      if (R) {
        const sep = R.real ?? R.sep * k;
        const segs = rayar(q.p, R.ang, sep).concat(R.cruz ? rayar(q.p, R.cruz, sep) : []);
        if (segs.length) out.push(`<path d="${segs.map(([a, b]) => `M${X(a[0])} ${Y(a[1])}L${X(b[0])} ${Y(b[1])}`).join('')}" stroke="${T.fino}" stroke-width="${(0.08 * k).toFixed(4)}" fill="none"/>`);
      }
    } else if (q.t === 'C') {
      out.push(`<circle cx="${X(q.p[0])}" cy="${Y(q.p[1])}" r="${q.r}" fill="${color(q.fill)}" stroke="${T.ink}" stroke-width="${sw(q.w).toFixed(4)}"/>`);
    } else if (q.t === 'T') {
      const an = q.a || 'middle';
      txt(q.p[0], q.p[1], q.s || 2.2, q.txt, `text-anchor="${an}" dominant-baseline="middle"${q.b ? ' font-weight="700"' : ''}`);
    } else if (q.t === 'N') {
      const x = q.p[0], y = q.p[1], m = 1.6 * k;
      out.push(`<path d="M${X(x)} ${Y(y)} l${(-m).toFixed(4)} ${(-m * 1.4).toFixed(4)} h${(2 * m).toFixed(4)} Z" fill="${T.ink}"/>`);
      out.push(`<line x1="${X(x) - 2 * m}" y1="${Y(y)}" x2="${X(x) + 9 * k}" y2="${Y(y)}" stroke="${T.ink}" stroke-width="${sw('f')}"/>`);
      const v = q.txt || (fmt?.N ? fmt.N(q.v) : (q.v >= 0 ? '+' : '') + q.v.toFixed(2));
      out.push(`<text x="${X(x) + 1.4 * m}" y="${Y(y) - 0.9 * k}" font-size="${(2 * k).toFixed(4)}" fill="${T.ink}" font-weight="700">${esc(v)}</text>`);
      if (q.et) out.push(`<text x="${X(x) + 1.4 * m}" y="${Y(y) + 2.4 * k}" font-size="${(1.7 * k).toFixed(4)}" fill="${T.mut}">${esc(q.et)}</text>`);
    } else if (q.t === 'D') {
      const [ax, ay] = q.a, [bx, by] = q.b;
      const L = Math.hypot(bx - ax, by - ay);
      if (L < 0.01) continue;
      out.push(`<line x1="${X(ax)}" y1="${Y(ay)}" x2="${X(bx)}" y2="${Y(by)}" stroke="${T.fino}" stroke-width="${sw('mf')}"/>`);
      const t = 1.1 * k;
      for (const [px, py] of [[ax, ay], [bx, by]]) out.push(`<line x1="${X(px) - t}" y1="${Y(py) + t}" x2="${X(px) + t}" y2="${Y(py) - t}" stroke="${T.ink}" stroke-width="${sw('m')}"/>`);
      const val = q.txt ?? (fmt?.L ? fmt.L(L) : L.toFixed(2));
      if (q.vert) {
        const mx = X(ax) - 1.0 * k, my = (Y(ay) + Y(by)) / 2;
        out.push(`<text x="${mx}" y="${my}" font-size="${(1.9 * k).toFixed(4)}" fill="${T.ink}" text-anchor="middle" transform="rotate(-90 ${mx} ${my})">${esc(val)}</text>`);
      } else out.push(`<text x="${(X(ax) + X(bx)) / 2}" y="${Y(ay) - 0.9 * k}" font-size="${(1.9 * k).toFixed(4)}" fill="${T.ink}" text-anchor="middle">${esc(val)}</text>`);
    } else if (q.t === 'X') {
      const [ax, ay] = q.a, [bx, by] = q.b, fin = q.al || 'start';
      const hombro = (fin === 'end' ? -2.5 : 2.5) * k;
      out.push(`<circle cx="${X(ax)}" cy="${Y(ay)}" r="${(0.45 * k).toFixed(4)}" fill="${T.ink}"/>`);
      out.push(`<polyline points="${X(ax)},${Y(ay)} ${X(bx)},${Y(by)} ${X(bx) + hombro},${Y(by)}" fill="none" stroke="${T.ink}" stroke-width="${sw('mf')}"/>`);
      out.push(`<text x="${X(bx) + hombro + (fin === 'end' ? -0.8 : 0.8) * k}" y="${Y(by)}" font-size="${((q.s || 2) * k).toFixed(4)}" fill="${T.ink}" text-anchor="${fin}" dominant-baseline="middle">${esc(q.txt)}</text>`);
    } else if (q.t === 'F') {
      const [ax, ay] = q.a, [bx, by] = q.b, ang = Math.atan2(Y(by) - Y(ay), X(bx) - X(ax)), m = 1.6 * k;
      out.push(`<line x1="${X(ax)}" y1="${Y(ay)}" x2="${X(bx)}" y2="${Y(by)}" stroke="${T.ink}" stroke-width="${sw('f')}"/>`);
      const p1 = [X(bx) - m * Math.cos(ang - 0.4), Y(by) - m * Math.sin(ang - 0.4)], p2 = [X(bx) - m * Math.cos(ang + 0.4), Y(by) - m * Math.sin(ang + 0.4)];
      out.push(`<path d="M${X(bx)} ${Y(by)} L${p1[0].toFixed(4)} ${p1[1].toFixed(4)} L${p2[0].toFixed(4)} ${p2[1].toFixed(4)} Z" fill="${T.ink}"/>`);
      if (q.txt) out.push(`<text x="${(X(ax) + X(bx)) / 2 + 1.2 * k}" y="${(Y(ay) + Y(by)) / 2 - 1.2 * k}" font-size="${(1.9 * k).toFixed(4)}" fill="${T.ink}">${esc(q.txt)}</text>`);
    }
  }
  return { cuerpo: out.join(''), w, h };
}

/** SVG suelto de una vista (pantalla o descarga). */
export function svgDeVista(vista, opts) {
  const d = dibujar(vista, opts);
  const T = TEMAS[opts?.tema] || TEMAS.impresion;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${d.w.toFixed(3)} ${d.h.toFixed(3)}" data-w="${d.w}" data-h="${d.h}" preserveAspectRatio="xMidYMid meet" style="background:${T.bg}" font-family="Helvetica, Arial, sans-serif">${d.cuerpo}</svg>`;
}
