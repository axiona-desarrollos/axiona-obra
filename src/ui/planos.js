/* ==========================================================================
   AXIONA OBRA · Planos en SVG
   --------------------------------------------------------------------------
   Implantacion, plantas por piso y cimentacion. Se dibujan en el marco del
   frente (el frente del lote abajo), con el norte girado a su direccion
   real. Dos temas: oscuro para la pantalla e impresion para exportar.
   ========================================================================== */

import { contours, dms } from '../motor/index.js';
import { near } from '../motor/geometria.js';
import { $, fm, esc } from './comun.js';

export const THEMES = {
  dark: { bg: '#0b131c', ink: '#d7e4f0', thin: '#5f7389', grid: '#132130', col: '#ffae2b', fnd: '#3fcfff', win: '#41e2a4', mut: '#7f90a3', lot: '#ffae2b', cont: '#24405a', contM: '#3c6a8c', door: '#9fb3c8', zone: { social: 'rgba(63,207,255,.07)', privada: 'rgba(255,174,43,.11)', servicio: 'rgba(65,226,164,.07)', circ: 'rgba(255,255,255,.03)' } },
  print: { bg: '#ffffff', ink: '#111111', thin: '#666666', grid: '#eeeeee', col: '#111111', fnd: '#0077aa', win: '#0a8f5a', mut: '#555555', lot: '#c46a00', cont: '#c9d6e2', contM: '#8aa6bf', door: '#333333', zone: { social: '#f2f8fb', privada: '#fbf6ee', servicio: '#f1f8f4', circ: '#fafafa' } },
};

export function doorGeom(o) {
  return o.o === 'H'
    ? { h: { x: o.a, y: o.c }, u: { x: 1, y: 0 }, n: { x: 0, y: o.dir } }
    : { h: { x: o.c, y: o.a }, u: { x: 0, y: 1 }, n: { x: o.dir, y: 0 } };
}

/** Vistas disponibles para el modelo actual. */
export function vistas(M) {
  return [['sitio', 'Implantación'], ...M.floors.map(f => ['p' + (f.f + 1), 'Planta piso ' + (f.f + 1)]), ['cim', 'Cimentación y ejes']];
}

export function planSVG(M, view, theme) {
  const T = THEMES[theme], R = M.R, out = [], cb = M.colB / 2;
  let ex0, ex1, ey0, ey1;
  if (view === 'sitio') { ex0 = M.bbox.minx - 4; ex1 = M.bbox.maxx + 4; ey0 = M.bbox.miny - 4; ey1 = M.bbox.maxy + 4; }
  else { ex0 = R.x0 - 4.2; ex1 = R.x1 + 2.6; ey0 = R.y0 - 5.6; ey1 = R.y1 + 2.4; }
  const W = ex1 - ex0, H = ey1 - ey0, X = x => +(x - ex0).toFixed(3), Y = y => +(ey1 - y).toFixed(3);
  const L = (x1, y1, x2, y2, c, w, ex = '') => out.push(`<line x1="${X(x1)}" y1="${Y(y1)}" x2="${X(x2)}" y2="${Y(y2)}" stroke="${c}" stroke-width="${w}" ${ex}/>`);
  const Rc = (x0, y0, x1, y1, fill, stroke = 'none', sw = 0, ex = '') => out.push(`<rect x="${X(Math.min(x0, x1))}" y="${Y(Math.max(y0, y1))}" width="${Math.abs(x1 - x0).toFixed(3)}" height="${Math.abs(y1 - y0).toFixed(3)}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" ${ex}/>`);
  const Tx = (x, y, s, t, c, ex = '') => out.push(`<text x="${X(x)}" y="${Y(y)}" font-size="${s}" fill="${c}" text-anchor="middle" dominant-baseline="middle" ${ex}>${esc(t)}</text>`);
  const poly = (pts, fill, stroke, sw, ex = '') => out.push(`<polygon points="${pts.map(p => X(p.x) + ',' + Y(p.y)).join(' ')}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" ${ex}/>`);
  const pl = (pts, c, w, ex = '') => out.push(`<polyline points="${pts.map(p => X(p.x) + ',' + Y(p.y)).join(' ')}" fill="none" stroke="${c}" stroke-width="${w}" ${ex}/>`);
  const MONO = 'font-family="IBM Plex Mono,monospace"', DISP = 'font-family="Chakra Petch,sans-serif"';

  for (let x = Math.ceil(ex0); x <= ex1; x++) L(x, ey0, x, ey1, T.grid, 0.012);
  for (let y = Math.ceil(ey0); y <= ey1; y++) L(ex0, y, ex1, y, T.grid, 0.012);

  const dimH = (xs, y) => {
    L(xs[0], y, xs[xs.length - 1], y, T.thin, 0.018);
    xs.forEach(x => { L(x - 0.09, y - 0.09, x + 0.09, y + 0.09, T.ink, 0.03); L(x, y - 0.25, x, y + 0.1, T.thin, 0.012); });
    for (let i = 1; i < xs.length; i++) Tx((xs[i - 1] + xs[i]) / 2, y + 0.2, 0.2, fm(xs[i] - xs[i - 1]), T.ink, MONO);
  };
  const dimV = (ys, x) => {
    L(x, ys[0], x, ys[ys.length - 1], T.thin, 0.018);
    ys.forEach(y => { L(x - 0.09, y - 0.09, x + 0.09, y + 0.09, T.ink, 0.03); L(x - 0.1, y, x + 0.25, y, T.thin, 0.012); });
    for (let i = 1; i < ys.length; i++) {
      const my = (ys[i - 1] + ys[i]) / 2;
      out.push(`<text x="${X(x - 0.2)}" y="${Y(my)}" font-size="0.2" fill="${T.ink}" text-anchor="middle" dominant-baseline="middle" ${MONO} transform="rotate(-90 ${X(x - 0.2)} ${Y(my)})">${fm(ys[i] - ys[i - 1])}</text>`);
    }
  };
  const axes = () => {
    M.axX.forEach((x, i) => {
      L(x, R.y0 - 2.9, x, R.y1 + 0.9, T.thin, 0.014, 'stroke-dasharray="0.35 0.12 0.06 0.12"');
      out.push(`<circle cx="${X(x)}" cy="${Y(R.y0 - 3.25)}" r="0.32" fill="${T.bg}" stroke="${T.ink}" stroke-width="0.025"/>`);
      Tx(x, R.y0 - 3.25, 0.3, String.fromCharCode(65 + i), T.ink, `font-weight="600" ${DISP}`);
    });
    M.axY.forEach((y, j) => {
      L(R.x0 - 2.9, y, R.x1 + 0.9, y, T.thin, 0.014, 'stroke-dasharray="0.35 0.12 0.06 0.12"');
      out.push(`<circle cx="${X(R.x0 - 3.25)}" cy="${Y(y)}" r="0.32" fill="${T.bg}" stroke="${T.ink}" stroke-width="0.025"/>`);
      Tx(R.x0 - 3.25, y, 0.3, String(j + 1), T.ink, `font-weight="600" ${DISP}`);
    });
    dimH(M.axX, R.y0 - 1.6); dimH([R.x0, R.x1], R.y0 - 2.3); dimV(M.axY, R.x0 - 1.6); dimV([R.y0, R.y1], R.x0 - 2.3);
  };
  // Norte girado a su direccion real en el marco del frente.
  const giroNorte = Math.atan2(M.marco.norte.x, M.marco.norte.y) * 180 / Math.PI;
  const north = (x, y) => out.push(`<g transform="translate(${X(x)} ${Y(y)}) rotate(${giroNorte.toFixed(2)})"><circle r="0.55" fill="none" stroke="${T.thin}" stroke-width="0.02"/><path d="M0 -0.5 L0.2 0.3 L0 0.15 L-0.2 0.3 Z" fill="${T.ink}"/><text y="-0.75" font-size="0.3" fill="${T.ink}" text-anchor="middle" ${DISP} font-weight="600">N</text></g>`);
  const block = (title) => {
    const bx = ex1 - 5.6, by = ey0 + 0.35;
    Rc(bx, by, bx + 5.3, by + 1.2, T.bg, T.thin, 0.02);
    out.push(`<text x="${X(bx + 0.2)}" y="${Y(by + 0.82)}" font-size="0.3" fill="${T.ink}" ${DISP} font-weight="600">AXIONA OBRA · ${esc(title)}</text>`);
    out.push(`<text x="${X(bx + 0.2)}" y="${Y(by + 0.35)}" font-size="0.19" fill="${T.mut}" ${MONO}>ESC 1:100 · COTAS EN m · N±0.00 = ${fm(M.dl)} m</text>`);
  };

  if (view === 'sitio') {
    const cid = 'lotclip' + theme;
    out.push(`<clipPath id="${cid}"><polygon points="${M.lot.map(p => X(p.x) + ',' + Y(p.y)).join(' ')}"/></clipPath>`);
    out.push(`<g clip-path="url(#${cid})">`);
    contours(M.grid, 0.25).forEach(c => c.segs.forEach(s => L(s[0][0], s[0][1], s[1][0], s[1][1], c.major ? T.contM : T.cont, c.major ? 0.035 : 0.018)));
    out.push('</g>');
    poly(M.lot, theme === 'dark' ? 'rgba(255,174,43,.04)' : 'none', T.lot, 0.06);
    Rc(M.P.x0, M.P.y0, M.P.x1, M.P.y1, 'none', T.thin, 0.02, 'stroke-dasharray="0.2 0.15"');
    Rc(R.x0, R.y0, R.x1, R.y1, theme === 'dark' ? 'rgba(63,207,255,.12)' : '#e6f4fa', T.fnd, 0.05);
    Tx((R.x0 + R.x1) / 2, (R.y0 + R.y1) / 2 + 0.25, 0.42, 'HUELLA', T.fnd, `${DISP} font-weight="600" letter-spacing="0.06"`);
    Tx((R.x0 + R.x1) / 2, (R.y0 + R.y1) / 2 - 0.3, 0.26, `${fm(R.w)} × ${fm(R.h)} m · ${M.F} piso${M.F > 1 ? 's' : ''}`, T.ink, MONO);
    const cx = M.lot.reduce((t, p) => t + p.x, 0) / M.lot.length, cy = M.lot.reduce((t, p) => t + p.y, 0) / M.lot.length;
    M.sides.forEach(s => {
      const a = M.lot[s.from - 1], b = M.lot[s.to - 1], mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      let nx = -(b.y - a.y), ny = b.x - a.x;
      const nl = Math.hypot(nx, ny) || 1; nx /= nl; ny /= nl;
      if ((mx - cx) * nx + (my - cy) * ny < 0) { nx = -nx; ny = -ny; }
      let ang = Math.atan2(-(b.y - a.y), b.x - a.x) * 180 / Math.PI;
      if (ang > 90) ang -= 180;
      if (ang < -90) ang += 180;
      const frente = s.i === M.frente;
      out.push(`<text x="${X(mx + nx * 0.55)}" y="${Y(my + ny * 0.55)}" font-size="0.36" fill="${T.lot}" text-anchor="middle" dominant-baseline="middle" ${MONO} transform="rotate(${ang.toFixed(2)} ${X(mx + nx * 0.55)} ${Y(my + ny * 0.55)})">${frente ? 'FRENTE · ' : ''}${fm(s.L)} m · ${dms(s.az)}</text>`);
    });
    M.lot.forEach((p, i) => {
      let dx = cx - p.x, dy = cy - p.y;
      const dl = Math.hypot(dx, dy) || 1; dx /= dl; dy /= dl;
      out.push(`<circle cx="${X(p.x)}" cy="${Y(p.y)}" r="0.16" fill="${T.lot}"/>`);
      Tx(p.x - dx * 0.75, p.y - dy * 0.75, 0.34, `P${i + 1}`, T.ink, `font-weight="600" ${DISP}`);
      Tx(p.x - dx * 0.75, p.y - dy * 0.75 - 0.42, 0.24, `+${fm(p.z)}`, T.mut, MONO);
      Tx(p.x + dx * 1.15, p.y + dy * 1.15, 0.26, `${fm(M.angles[i], 1)}°`, T.fnd, MONO);
    });
    M.spots.forEach((p, i) => {
      out.push(`<path d="M${X(p.x) - 0.15} ${Y(p.y)} h0.3 M${X(p.x)} ${Y(p.y) - 0.15} v0.3" stroke="${T.ink}" stroke-width="0.03"/>`);
      Tx(p.x + 0.55, p.y + 0.2, 0.22, `C${i + 1} +${fm(p.z)}`, T.mut, MONO);
    });
    // flecha de pendiente: el azimut es del mundo, se pasa al marco del frente
    const az = M.slopeDir * Math.PI / 180, wx = Math.sin(az), wy = Math.cos(az);
    const ux = wx * M.marco.u.x + wy * M.marco.u.y, uy = wx * M.marco.v.x + wy * M.marco.v.y;
    const sx = cx - ux * 1.5, sy = (R.y1 + M.bbox.maxy) / 2 - uy * 1.5;
    if (M.slope > 0.5) {
      L(sx, sy, sx + ux * 3, sy + uy * 3, T.win, 0.05);
      out.push(`<circle cx="${X(sx + ux * 3)}" cy="${Y(sy + uy * 3)}" r="0.12" fill="${T.win}"/>`);
      Tx(sx + ux * 1.5, sy + uy * 1.5 - 0.45, 0.26, `pend. ${fm(M.slope, 1)} %`, T.win, MONO);
    }
    north(ex1 - 1.2, ey1 - 1.4);
    const sb = ex0 + 0.8, sy0 = ey0 + 0.8;
    for (let i = 0; i < 5; i++) Rc(sb + i, sy0, sb + i + 1, sy0 + 0.14, i % 2 ? T.bg : T.ink, T.ink, 0.015);
    Tx(sb + 2.5, sy0 + 0.42, 0.22, '0 · 5 m', T.mut, MONO);
  } else if (view === 'cim') {
    axes();
    M.beams.forEach(b => {
      if (b.o === 'H') { L(b.a, b.c - 0.15, b.b, b.c - 0.15, T.ink, 0.02); L(b.a, b.c + 0.15, b.b, b.c + 0.15, T.ink, 0.02); }
      else { L(b.c - 0.15, b.a, b.c - 0.15, b.b, T.ink, 0.02); L(b.c + 0.15, b.a, b.c + 0.15, b.b, T.ink, 0.02); }
    });
    M.cols.forEach(c => {
      Rc(c.x - c.B / 2, c.y - c.B / 2, c.x + c.B / 2, c.y + c.B / 2, theme === 'dark' ? 'rgba(63,207,255,.08)' : '#eef8fc', T.fnd, 0.03, 'stroke-dasharray="0.12 0.08"');
      Rc(c.x - cb, c.y - cb, c.x + cb, c.y + cb, T.col);
      Tx(c.x, c.y - c.B / 2 - 0.22, 0.2, `${c.type} ${fm(c.B)}`, T.fnd, MONO);
    });
    Tx((R.x0 + R.x1) / 2, R.y1 + 1.6, 0.26, `Vigas de cimentación 30×40 · desplante −${fm(M.desp)} m · ${M.cols.length} zapatas · columnas ${Math.round(M.colB * 100)}×${Math.round(M.colB * 100)}`, T.mut, MONO);
    block('CIMENTACIÓN Y EJES');
    north(ex1 - 1.0, ey1 - 1.1);
  } else {
    const fl = M.floors[+view.slice(1) - 1];
    if (!fl) return '';
    axes();
    fl.rects.forEach(r => Rc(r.x0, r.y0, r.x1, r.y1, T.zone[r.zone] || T.zone.circ));
    const st = fl.rects.find(r => r.stair);
    if (st) {
      for (let y = st.y0 + 0.28; y < st.y1 - 0.05; y += 0.28) L(st.x0 + 0.1, y, st.x1 - 0.1, y, T.thin, 0.015);
      const mx = (st.x0 + st.x1) / 2;
      L(mx, st.y0 + 0.3, mx, st.y1 - 0.4, T.ink, 0.025);
      out.push(`<path d="M${X(mx - 0.15)} ${Y(st.y1 - 0.65)} L${X(mx)} ${Y(st.y1 - 0.35)} L${X(mx + 0.15)} ${Y(st.y1 - 0.65)}" fill="none" stroke="${T.ink}" stroke-width="0.025"/>`);
    }
    fl.lines.forEach(l => {
      const t = l.ext ? 0.2 : 0.12;
      l.pieces.forEach(([a, b]) => {
        const a2 = Math.abs(a - l.a) < 0.02 ? a - t / 2 : a, b2 = Math.abs(b - l.b) < 0.02 ? b + t / 2 : b;
        if (l.o === 'H') Rc(a2, l.c - t / 2, b2, l.c + t / 2, T.ink); else Rc(l.c - t / 2, a2, l.c + t / 2, b2, T.ink);
      });
    });
    fl.ops.forEach(o => {
      const t = (o.o === 'H' ? near(o.c, R.y0) || near(o.c, R.y1) : near(o.c, R.x0) || near(o.c, R.x1)) ? 0.2 : 0.12;
      if (o.kind === 'win') {
        if (o.o === 'H') { Rc(o.a, o.c - t / 2, o.b, o.c + t / 2, 'none', T.win, 0.02); L(o.a, o.c, o.b, o.c, T.win, 0.03); }
        else { Rc(o.c - t / 2, o.a, o.c + t / 2, o.b, 'none', T.win, 0.02); L(o.c, o.a, o.c, o.b, T.win, 0.03); }
      } else {
        const g = doorGeom(o), pts = [];
        for (let k = 0; k <= 12; k++) {
          const th = k / 12 * Math.PI / 2;
          pts.push({ x: g.h.x + o.w * (Math.cos(th) * g.u.x + Math.sin(th) * g.n.x), y: g.h.y + o.w * (Math.cos(th) * g.u.y + Math.sin(th) * g.n.y) });
        }
        pl(pts, T.door, 0.015, 'stroke-dasharray="0.08 0.05"');
        L(g.h.x, g.h.y, g.h.x + g.n.x * o.w, g.h.y + g.n.y * o.w, T.ink, o.kind === 'main' ? 0.05 : 0.035);
      }
    });
    M.cols.forEach(c => Rc(c.x - cb, c.y - cb, c.x + cb, c.y + cb, T.col));
    fl.rects.forEach(r => {
      if (r.stair) {
        Tx((r.x0 + r.x1) / 2 + 0.55, (r.y0 + r.y1) / 2, 0.2, fl.f < M.F - 1 ? 'SUBE' : 'LLEGA', T.mut, `${MONO} transform="rotate(-90 ${X((r.x0 + r.x1) / 2 + 0.55)} ${Y((r.y0 + r.y1) / 2)})"`);
        return;
      }
      const fs = Math.max(0.17, Math.min(0.3, Math.min(r.w, r.h) * 0.1)), cx = (r.x0 + r.x1) / 2, cy = (r.y0 + r.y1) / 2;
      Tx(cx, cy + fs * 0.75, fs, r.name.toUpperCase(), T.ink, `${DISP} font-weight="600" letter-spacing="0.02"`);
      Tx(cx, cy - fs * 0.55, fs * 0.78, `${fm(r.area, 1)} m² · ${fm(r.w)}×${fm(r.h)}`, T.mut, MONO);
    });
    const lvl = M.dl + fl.f * M.fh;
    Tx(R.x0 + 1.1, R.y1 + 0.9, 0.22, `NPT +${fm(fl.f * M.fh)} (cota ${fm(lvl)})`, T.mut, MONO);
    Tx((R.x0 + R.x1) / 2, R.y0 - 4.35, 0.24, '↓ FRENTE · ACCESO', T.lot, `${MONO} font-weight="500"`);
    block(`PLANTA PISO ${fl.f + 1}`);
    north(ex1 - 1.0, ey1 - 1.1);
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W.toFixed(2)} ${H.toFixed(2)}" data-w="${W}" data-h="${H}" preserveAspectRatio="xMidYMid meet" style="background:${T.bg}" font-family="IBM Plex Sans,sans-serif">${out.join('')}</svg>`;
}

/** Arrastrar, pellizcar y rueda para mover y acercar el plano. */
export function instalarPanZoom(box) {
  const ptrs = new Map();
  let last = null, pinch = null;
  const svg = () => box.querySelector('svg');
  const vb = () => svg().viewBox.baseVal;
  const zoomAt = (f, cx, cy) => {
    const s = svg();
    if (!s) return;
    const r = s.getBoundingClientRect(), v = vb(), k = Math.max(v.width / r.width, v.height / r.height);
    const px = v.x + (cx - r.left - (r.width - v.width / k) / 2) * k, py = v.y + (cy - r.top - (r.height - v.height / k) / 2) * k;
    const nw = v.width * f, nh = v.height * f;
    if (nw < 2 || nw > 400) return;
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
  box.querySelector('.zoom').addEventListener('click', e => {
    const b = e.target.closest('[data-zoom]');
    if (!b) return;
    const r = box.getBoundingClientRect();
    if (b.dataset.zoom === 'fit') ajustarPlano(); else zoomAt(b.dataset.zoom === 'in' ? 0.8 : 1.25, r.left + r.width / 2, r.top + r.height / 2);
  });
}

export function ajustarPlano() {
  const s = $('#planBox svg');
  if (!s) return;
  const v = s.viewBox.baseVal;
  v.x = 0; v.y = 0; v.width = +s.dataset.w; v.height = +s.dataset.h;
}
