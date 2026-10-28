/* ==========================================================================
   AXIONA OBRA · Exportes
   --------------------------------------------------------------------------
   DXF (AutoCAD/BricsCAD) por capas, SVG del plano actual, GLB y USDZ del
   modelo, CSV del presupuesto y el proyecto en .json. Todo se arma en el
   navegador: nada sale del dispositivo.
   ========================================================================== */

import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { CATEGORIAS, totales } from '../motor/index.js';
import { toast, app } from '../ui/comun.js';
import { doorGeom } from '../ui/planos.js';
import { ensure3D, buildScene, tres } from '../vista3d/escena.js';
import { usdzDeLaFase } from '../ar/ar.js';

export function descargar(nombre, datos, mime) {
  const blob = datos instanceof Blob ? datos : new Blob([datos], { type: mime });
  try {
    const u = URL.createObjectURL(blob), el = document.createElement('a');
    el.href = u; el.download = nombre;
    document.body.appendChild(el); el.click(); el.remove();
    setTimeout(() => URL.revokeObjectURL(u), 4000);
    toast(`Generado ${nombre}`);
  } catch {
    toast('Este navegador bloqueó la descarga.');
  }
}

export function toDXF(M) {
  const o = ['0', 'SECTION', '2', 'ENTITIES'];
  const f6 = v => (+v).toFixed(4);
  const Ln = (ly, x1, y1, x2, y2, ox = 0) => o.push('0', 'LINE', '8', ly, '10', f6(x1 + ox), '20', f6(y1), '30', '0', '11', f6(x2 + ox), '21', f6(y2), '31', '0');
  const Tx = (ly, x, y, h, t, ox = 0) => o.push('0', 'TEXT', '8', ly, '10', f6(x + ox), '20', f6(y), '30', '0', '40', f6(h), '1', t);
  const Rect = (ly, x0, y0, x1, y1, ox) => { Ln(ly, x0, y0, x1, y0, ox); Ln(ly, x1, y0, x1, y1, ox); Ln(ly, x1, y1, x0, y1, ox); Ln(ly, x0, y1, x0, y0, ox); };
  const step = M.bbox.w + 10, R = M.R, cb = M.colB / 2;
  const sheets = [...M.floors.map(f => ({ t: `PLANTA PISO ${f.f + 1}`, fl: f })), { t: 'CIMENTACION', fl: null }];
  sheets.forEach((sh, si) => {
    const ox = si * step;
    M.lot.forEach((p, i) => { const q = M.lot[(i + 1) % M.lot.length]; Ln('LOTE', p.x, p.y, q.x, q.y, ox); });
    M.axX.forEach((x, i) => { Ln('EJES', x, R.y0 - 2, x, R.y1 + 1, ox); Tx('EJES', x - 0.12, R.y0 - 2.5, 0.3, String.fromCharCode(65 + i), ox); });
    M.axY.forEach((y, j) => { Ln('EJES', R.x0 - 2, y, R.x1 + 1, y, ox); Tx('EJES', R.x0 - 2.6, y - 0.12, 0.3, String(j + 1), ox); });
    M.cols.forEach(c => Rect('COLUMNAS', c.x - cb, c.y - cb, c.x + cb, c.y + cb, ox));
    Tx('TEXTO', R.x0, M.bbox.miny - 2, 0.4, `AXIONA OBRA - ${sh.t} - N+-0.00=${M.dl}`, ox);
    if (!sh.fl) {
      M.cols.forEach(c => { Rect('ZAPATAS', c.x - c.B / 2, c.y - c.B / 2, c.x + c.B / 2, c.y + c.B / 2, ox); Tx('TEXTO', c.x - c.B / 2, c.y - c.B / 2 - 0.3, 0.18, `${c.type} ${c.B}x${c.B}`, ox); });
      M.beams.forEach(b => {
        if (b.o === 'H') { Ln('VIGAS_CIM', b.a, b.c - 0.15, b.b, b.c - 0.15, ox); Ln('VIGAS_CIM', b.a, b.c + 0.15, b.b, b.c + 0.15, ox); }
        else { Ln('VIGAS_CIM', b.c - 0.15, b.a, b.c - 0.15, b.b, ox); Ln('VIGAS_CIM', b.c + 0.15, b.a, b.c + 0.15, b.b, ox); }
      });
      return;
    }
    const fl = sh.fl;
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
        return;
      }
      const g = doorGeom(op);
      Ln('PUERTAS', g.h.x, g.h.y, g.h.x + g.n.x * op.w, g.h.y + g.n.y * op.w, ox);
      const au = Math.atan2(g.u.y, g.u.x) * 180 / Math.PI, an = Math.atan2(g.n.y, g.n.x) * 180 / Math.PI, cr = g.u.x * g.n.y - g.u.y * g.n.x;
      const [s1, s2] = cr > 0 ? [au, an] : [an, au];
      o.push('0', 'ARC', '8', 'PUERTAS', '10', f6(g.h.x + ox), '20', f6(g.h.y), '30', '0', '40', f6(op.w), '50', f6((s1 + 360) % 360), '51', f6((s2 + 360) % 360));
    });
    fl.rects.forEach(r => {
      if (!r.stair) { Tx('TEXTO', r.x0 + 0.25, (r.y0 + r.y1) / 2 + 0.1, 0.2, r.name.toUpperCase(), ox); Tx('TEXTO', r.x0 + 0.25, (r.y0 + r.y1) / 2 - 0.25, 0.15, `${r.area} m2`, ox); }
      else for (let y = r.y0 + 0.28; y < r.y1; y += 0.28) Ln('ESCALERA', r.x0 + 0.1, y, r.x1 - 0.1, y, ox);
    });
  });
  o.push('0', 'ENDSEC', '0', 'EOF');
  return o.join('\r\n');
}

export function toCSV(M, S) {
  const n = v => String(Math.round(v * 100) / 100).replace('.', ',');
  const rows = [['Categoría', 'Capítulo', 'Ítem', 'Unidad', 'Cantidad', 'Valor unitario', 'Total']];
  M.quant.items.forEach(it => rows.push([CATEGORIAS[it.cat], it.cap, it.item, it.und, n(it.q), S.prices[it.k], Math.round(it.q * S.prices[it.k])]));
  rows.push(['', '', 'TOTAL COSTO DIRECTO', '', '', '', Math.round(totales(M, S.prices).all)]);
  return '﻿' + rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(';')).join('\r\n');
}

export function exportarGLB() {
  if (!ensure3D()) return toast('El 3D no está disponible en este dispositivo.');
  if (app.threeDirty) buildScene();
  new GLTFExporter().parse(
    tres.root,
    res => descargar(`axiona-obra_fase${app.phase + 1}.glb`, new Blob([res], { type: 'model/gltf-binary' })),
    err => toast('No se pudo exportar el GLB: ' + (err?.message || err)),
    { binary: true, onlyVisible: true },
  );
}

export async function exportarUSDZ() {
  const blob = await usdzDeLaFase(1);
  if (!blob) return toast('El 3D no está disponible en este dispositivo.');
  descargar(`axiona-obra_fase${app.phase + 1}.usdz`, blob);
}
