/* ==========================================================================
   AXIONA TOPO · Codigo QR
   --------------------------------------------------------------------------
   Modulos oscuros sobre fondo blanco (asi lo leen todas las camaras), con
   el margen de 4 modulos que pide la norma del QR.
   ========================================================================== */

import qrcode from 'qrcode-generator';

export function svgQR(texto, { margen = 4 } = {}) {
  const q = qrcode(0, 'M');
  q.addData(texto);
  q.make();
  const n = q.getModuleCount(), t = n + 2 * margen;
  let d = '';
  for (let f = 0; f < n; f++) for (let c = 0; c < n; c++) if (q.isDark(f, c)) d += `M${c + margen} ${f + margen}h1v1h-1z`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${t} ${t}" shape-rendering="crispEdges" class="qr" role="img" aria-label="Código QR"><rect width="${t}" height="${t}" fill="#fff"/><path d="${d}" fill="#000"/></svg>`;
}
