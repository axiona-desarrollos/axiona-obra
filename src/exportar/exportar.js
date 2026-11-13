/* ==========================================================================
   AXIONA OBRA · Exportes
   --------------------------------------------------------------------------
   DXF por capas (plantas, cimentacion, fachadas, cortes y detalles, uno al
   lado del otro y en metros reales), SVG de la vista actual, GLB y USDZ del
   modelo, CSV del presupuesto y el proyecto en .json. El PDF del juego de
   planos sale de ui/laminas.js. Todo se arma en el navegador.
   ========================================================================== */

import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { totales, precioDe, preciosLugar, nombreCategoria, tr } from '../motor/index.js';
import { toast, app } from '../ui/comun.js';
import { ensure3D, buildScene, tres } from '../vista3d/escena.js';
import { usdzDeLaFase } from '../ar/ar.js';
export { toDXF } from './planosDXF.js';

export function descargar(nombre, datos, mime) {
  const blob = datos instanceof Blob ? datos : new Blob([datos], { type: mime });
  try {
    const u = URL.createObjectURL(blob), el = document.createElement('a');
    el.href = u; el.download = nombre;
    document.body.appendChild(el); el.click(); el.remove();
    setTimeout(() => URL.revokeObjectURL(u), 8000);
    toast(tr({ es: `Generado ${nombre}`, en: `Created ${nombre}` }));
  } catch {
    toast(tr({ es: 'Este navegador bloqueó la descarga.', en: 'This browser blocked the download.' }));
  }
}

export function toCSV(M, S) {
  const n = v => String(Math.round(v * 100) / 100).replace('.', ',');
  const rows = [[tr({ es: 'Categoría', en: 'Category' }), tr({ es: 'Capítulo', en: 'Chapter' }), tr({ es: 'Ítem', en: 'Item' }), tr({ es: 'Unidad', en: 'Unit' }), tr({ es: 'Cantidad', en: 'Quantity' }), tr({ es: 'Valor unitario', en: 'Unit price' }), 'Total']];
  M.quant.items.forEach(it => { const p = precioDe(it, preciosLugar(S)); rows.push([nombreCategoria(S.pais, it.cat), it.cap, it.item, it.und, n(it.q), p, Math.round(it.q * p)]); });
  const T = totales(M, preciosLugar(S), S.pais);
  rows.push(['', '', tr({ es: 'COSTO DIRECTO', en: 'DIRECT COST' }), '', '', '', Math.round(T.directo)]);
  T.lineas.forEach(l => rows.push(['', '', `${l.n} (${Math.round(l.pct * 1000) / 10} %)`, '', '', '', Math.round(l.v)]));
  rows.push(['', '', 'TOTAL', '', '', '', Math.round(T.total)]);
  return '﻿' + rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(';')).join('\r\n');
}

/**
 * Números generadores de México: por concepto, su clave, unidad, precio e
 * importe, y debajo cada renglón con ubicación y medidas. La cantidad del
 * concepto es la suma de sus renglones. Coma como separador y punto decimal,
 * como lo abre Excel en México.
 */
export function generadoresCSV(M, S) {
  const n = v => (v === null || v === undefined ? '' : String(Math.round(v * 1000) / 1000));
  const rows = [
    [`${tr({ es: 'Números generadores', en: 'Quantity take-off' })} · ${S.nombre}`],
    [tr({ es: 'Clave', en: 'Code' }), tr({ es: 'Concepto', en: 'Item' }), tr({ es: 'Unidad', en: 'Unit' }), tr({ es: 'Ubicación', en: 'Location' }), tr({ es: 'Largo', en: 'Length' }), tr({ es: 'Ancho', en: 'Width' }), tr({ es: 'Alto', en: 'Height' }), tr({ es: 'Piezas', en: 'Pieces' }), tr({ es: 'Se descuenta', en: 'Deduct' }), tr({ es: 'Cantidad', en: 'Quantity' }), tr({ es: 'P.U.', en: 'Unit price' }), tr({ es: 'Importe', en: 'Amount' })],
  ];
  (M.quant.gen || []).forEach(c => {
    const it = M.quant.items.find(x => x.clave === c.clave), pu = it ? precioDe(it, preciosLugar(S)) : 0;
    rows.push([c.clave, c.desc, c.und, '', '', '', '', '', '', n(c.q), n(pu), Math.round(c.q * pu)]);
    c.filas.forEach(f => rows.push(['', '', '', f.ubic, n(f.largo), n(f.ancho), n(f.alto), n(f.piezas), n(f.menos), n(f.cant), '', '']));
  });
  return '﻿' + rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\r\n');
}

export function exportarGLB() {
  if (!ensure3D()) return toast(tr({ es: 'El 3D no está disponible en este dispositivo.', en: '3D is not available on this device.' }));
  if (app.threeDirty) buildScene();
  new GLTFExporter().parse(
    tres.root,
    res => descargar(`axiona-obra_fase${app.phase + 1}.glb`, new Blob([res], { type: 'model/gltf-binary' })),
    err => toast('GLB: ' + (err?.message || err)),
    { binary: true, onlyVisible: true },
  );
}

export async function exportarUSDZ() {
  const blob = await usdzDeLaFase(1);
  if (!blob) return toast(tr({ es: 'El 3D no está disponible en este dispositivo.', en: '3D is not available on this device.' }));
  descargar(`axiona-obra_fase${app.phase + 1}.usdz`, blob);
}
