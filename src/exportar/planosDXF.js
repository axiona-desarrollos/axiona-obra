/* ==========================================================================
   AXIONA OBRA · Planos en DXF (AutoCAD 2000)
   --------------------------------------------------------------------------
   Plantas por piso, cimentación, fachadas, cortes, cubierta y detalles, uno
   al lado del otro y en metros reales, con capas por uso. Módulo puro (sin
   DOM): se usa en el navegador y en las pruebas.
   ========================================================================== */
import { fachadas, cortes, plantaCubierta, detalles } from '../motor/alzados.js';
import { doorGeom } from '../ui/planos.js';
import { DXF } from './dxf.js';

/**
 * Juego de planos en DXF AutoCAD 2000 (ver dxf.js): plantas por piso, cimentación, fachadas, cortes,
 * cubierta y detalles, en metros reales y por capas con color. Lo abren AutoCAD, BricsCAD y Revit.
 */
export function toDXF(M) {
  const d = new DXF();
  const Ln = (ly, x1, y1, x2, y2, ox = 0, oy = 0) => d.linea(ly, x1 + ox, y1 + oy, x2 + ox, y2 + oy);
  const Tx = (ly, x, y, h, t, ox = 0, oy = 0) => d.texto(ly, x + ox, y + oy, h, t);
  const Rect = (ly, x0, y0, x1, y1, ox, oy = 0) => d.rect(ly, x0 + ox, y0 + oy, x1 + ox, y1 + oy);
  const step = M.bbox.w + 10, R = M.R, cb = M.colB / 2;
  const sheets = [...M.floors.map(f => ({ t: `PLANTA PISO ${f.f + 1}`, fl: f })), { t: 'CIMENTACION', fl: null }];
  sheets.forEach((sh, si) => {
    const ox = si * step;
    M.lot.forEach((p, i) => { const q = M.lot[(i + 1) % M.lot.length]; Ln('LOTE', p.x, p.y, q.x, q.y, ox); });
    M.axX.forEach((x, i) => { Ln('EJES', x, R.y0 - 2, x, R.y1 + 1, ox); Tx('EJES', x - 0.12, R.y0 - 2.5, 0.3, String.fromCharCode(65 + i), ox); });
    M.axY.forEach((y, j) => { Ln('EJES', R.x0 - 2, y, R.x1 + 1, y, ox); Tx('EJES', R.x0 - 2.6, y - 0.12, 0.3, String(j + 1), ox); });
    if (M.sistema === 'porticos' || M.sistema === 'hormigon') M.cols.filter(c => !sh.fl || sh.fl.f < (c.n ?? M.F)).forEach(c => Rect('COLUMNAS', c.x - cb, c.y - cb, c.x + cb, c.y + cb, ox));
    Tx('TEXTO', R.x0, M.bbox.miny - 2, 0.4, `AXIONA OBRA - ${sh.t} - N+-0.00=${M.dl}`, ox);
    if (!sh.fl) {
      M.cols.forEach(c => { Rect('ZAPATAS', c.x - c.B / 2, c.y - c.B / 2, c.x + c.B / 2, c.y + c.B / 2, ox); Tx('TEXTO', c.x - c.B / 2, c.y - c.B / 2 - 0.3, 0.18, `${c.type} ${c.B}x${c.B}`, ox); });
      M.beams.forEach(b => {
        if (b.o === 'H') { Ln('VIGAS_CIM', b.a, b.c - 0.15, b.b, b.c - 0.15, ox); Ln('VIGAS_CIM', b.a, b.c + 0.15, b.b, b.c + 0.15, ox); }
        else { Ln('VIGAS_CIM', b.c - 0.15, b.a, b.c - 0.15, b.b, ox); Ln('VIGAS_CIM', b.c + 0.15, b.a, b.c + 0.15, b.b, ox); }
      });
      if (M.mx) M.columnetas?.forEach(c => Rect('CASTILLOS', c.x - 0.075, c.y - 0.075, c.x + 0.075, c.y + 0.075, ox));
      else M.columnetas?.forEach(c => Rect('COLUMNETAS', c.x - 0.1, c.y - 0.075, c.x + 0.1, c.y + 0.075, ox));
      return;
    }
    const fl = sh.fl;
    // terrazas y balcones de este piso, con su baranda
    (M.terrazas || []).filter(t => t.f === fl.f).forEach(t => t.zonas.forEach(z => { Rect('TERRAZAS', z.x0, z.y0, z.x1, z.y1, ox); Tx('TEXTO', z.x0 + 0.25, (z.y0 + z.y1) / 2, 0.2, `TERRAZA ${z.area} m2`, ox); }));
    (M.balcones || []).filter(b => b.f === fl.f).forEach(b => { Rect('TERRAZAS', b.x0, b.y0, b.x1, b.y1, ox); Tx('TEXTO', b.x0 + 0.15, b.y0 + 0.5, 0.15, 'BALCON', ox); });
    [...(M.terrazas || []), ...(M.balcones || [])].filter(x => x.f === fl.f).forEach(x => x.barandas.forEach(br => (br.o === 'H' ? Ln('BARANDAS', br.a, br.c, br.b, br.c, ox) : Ln('BARANDAS', br.c, br.a, br.c, br.b, ox))));
    fl.lines.forEach(l => {
      const t = l.ext ? 0.2 : 0.12;
      l.pieces.forEach(([a, b]) => {
        const a2 = Math.abs(a - l.a) < 0.02 ? a - t / 2 : a, b2 = Math.abs(b - l.b) < 0.02 ? b + t / 2 : b;
        if (l.o === 'H') Rect('MUROS', a2, l.c - t / 2, b2, l.c + t / 2, ox); else Rect('MUROS', l.c - t / 2, a2, l.c + t / 2, b2, ox);
      });
    });
    fl.ops.forEach(op => {
      if (op.kind === 'win') {
        if (op.o === 'H') { Ln('VENTANAS', op.a, op.c, op.b, op.c, ox); Rect('VENTANAS', op.a, op.c - 0.1, op.b, op.c + 0.1, ox); }
        else { Ln('VENTANAS', op.c, op.a, op.c, op.b, ox); Rect('VENTANAS', op.c - 0.1, op.a, op.c + 0.1, op.b, ox); }
        if (op.tag) Tx('CODIGOS', (op.o === 'H' ? (op.a + op.b) / 2 : op.c + 0.3), (op.o === 'H' ? op.c + 0.3 : (op.a + op.b) / 2), 0.15, op.tag, ox);
        return;
      }
      if (op.kind === 'asc') { Ln('ASCENSOR', op.a, op.c, op.b, op.c, ox); return; }
      const g = doorGeom(op);
      Ln('PUERTAS', g.h.x, g.h.y, g.h.x + g.n.x * op.w, g.h.y + g.n.y * op.w, ox);
      const au = Math.atan2(g.u.y, g.u.x) * 180 / Math.PI, an = Math.atan2(g.n.y, g.n.x) * 180 / Math.PI, cr = g.u.x * g.n.y - g.u.y * g.n.x;
      const [s1, s2] = cr > 0 ? [au, an] : [an, au];
      d.arco('PUERTAS', g.h.x + ox, g.h.y, op.w, (s1 + 360) % 360, (s2 + 360) % 360);
    });
    const P = M.exterior?.piscina;
    if (P && fl.f === 0) { Rect('PISCINA', P.x0, P.y0, P.x1, P.y1, ox); Rect('PISCINA', P.x0 - 0.3, P.y0 - 0.3, P.x1 + 0.3, P.y1 + 0.3, ox); Tx('TEXTO', P.x0 + 0.3, (P.y0 + P.y1) / 2, 0.2, `PISCINA ${P.w} x ${P.h} x ${P.prof} m`, ox); }
    fl.rects.forEach(r => {
      if (!r.stair) { Tx('TEXTO', r.x0 + 0.25, (r.y0 + r.y1) / 2 + 0.1, 0.2, r.name.toUpperCase(), ox); Tx('TEXTO', r.x0 + 0.25, (r.y0 + r.y1) / 2 - 0.25, 0.15, `${r.area} m2`, ox); }
      else for (let y = r.y0 + 0.28; y < r.y1; y += 0.28) Ln('ESCALERA', r.x0 + 0.1, y, r.x1 - 0.1, y, ox);
    });
    M.muebles.filter(m => m.f === fl.f && m.tipo !== 'cuadro').forEach(m => {
      const giro = m.rot === 90 || m.rot === 270, w = giro ? m.d : m.w, d = giro ? m.w : m.d;
      Rect('MOBILIARIO', m.x - w / 2, m.y - d / 2, m.x + w / 2, m.y + d / 2, ox);
    });
    const red = M.redes.pisos[fl.f];
    red.sim.forEach(s => Tx(['luz', 'int', 'toma', 'tomaGFCI', 'especial', 'tablero', 'humo'].includes(s.k) ? 'ELECTRICO' : 'HIDRO', s.x, s.y, 0.12, s.k.toUpperCase(), ox));
    red.lin.forEach(l => { const pts = l.pts; for (let i = 1; i < pts.length; i++) Ln(l.k === 'circuito' ? 'ELECTRICO' : 'HIDRO_' + l.k.toUpperCase(), pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1], ox); });
  });
  // fachadas, cortes, cubierta y detalles: debajo de las plantas
  let ox = 0;
  const oy = M.bbox.miny - 30;
  const prims = (v, capa) => {
    const c = v.caja, dx = ox - c.x0, dy = oy - c.y1;
    v.prims.forEach(q => {
      if (q.t === 'L' || q.t === 'P') { const p = q.p, cerrar = q.t === 'P'; for (let i = 1; i < p.length + (cerrar ? 1 : 0); i++) { const a = p[i - 1], b = p[i % p.length]; Ln(q.capa || capa, a[0], a[1], b[0], b[1], dx, dy); } }
      else if (q.t === 'T') Tx(q.capa || 'TEXTO', q.p[0], q.p[1], (q.s || 2.2) * 0.1, q.txt, dx, dy);
      else if (q.t === 'N') { Ln('NIVELES', q.p[0], q.p[1], q.p[0] + 1, q.p[1], dx, dy); Tx('NIVELES', q.p[0] + 0.1, q.p[1] + 0.08, 0.15, q.txt || `${q.v >= 0 ? '+' : ''}${q.v.toFixed(2)}`, dx, dy); }
      else if (q.t === 'D') { Ln('COTAS', q.a[0], q.a[1], q.b[0], q.b[1], dx, dy); Tx('COTAS', (q.a[0] + q.b[0]) / 2, (q.a[1] + q.b[1]) / 2 + 0.08, 0.15, Math.hypot(q.b[0] - q.a[0], q.b[1] - q.a[1]).toFixed(2), dx, dy); }
      else if (q.t === 'X') { Ln('NOTAS', q.a[0], q.a[1], q.b[0], q.b[1], dx, dy); Tx('NOTAS', q.b[0] + 0.05, q.b[1], 0.1, q.txt, dx, dy); }
      else if (q.t === 'F') { Ln('CUBIERTA', q.a[0], q.a[1], q.b[0], q.b[1], dx, dy); if (q.txt) Tx('CUBIERTA', (q.a[0] + q.b[0]) / 2, (q.a[1] + q.b[1]) / 2 + 0.1, 0.15, q.txt, dx, dy); }
      else if (q.t === 'C') d.circulo(q.capa || capa, q.p[0] + dx, q.p[1] + dy, q.r);
    });
    Tx('TITULOS', c.x0, c.y0 - 1, 0.35, v.titulo.toUpperCase(), dx, dy);
    ox += c.x1 - c.x0 + 6;
  };
  [...fachadas(M), ...cortes(M), plantaCubierta(M), ...detalles(M)].forEach(v => prims(v, v.tipo === 'detalle' ? 'DETALLES' : v.tipo === 'corte' ? 'CORTES' : 'FACHADAS'));
  return d.toString();
}

