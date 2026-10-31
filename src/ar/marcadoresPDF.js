/* ==========================================================================
   AXIONA AR · Marcadores para imprimir o mostrar en pantalla
   --------------------------------------------------------------------------
   PDF tamaño carta o A4 con una hoja por marcador: el 0 para la maqueta y
   uno por cada esquina del lote (P1, P2…), con la flecha que indica hacia
   dónde va. Se imprime al 100 % y se mide el lado negro para escribirlo en
   la app; con esa medida la casa sale a la escala correcta.
   ========================================================================== */

import { celdas, svgMarcador, CELDAS } from './vision/marcadores.js';
import { app, tr, toast } from '../ui/comun.js';
import { preferencias } from './axionaAR.js';

/** Descarga el PDF de marcadores. ladoCm = lado del cuadro negro. */
export async function descargarMarcadores({ ladoCm = preferencias().lado, papel = 'a4' } = {}) {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'mm', format: papel, orientation: 'portrait' });
  const W = doc.internal.pageSize.getWidth(), Hp = doc.internal.pageSize.getHeight();
  const lado = Math.min(ladoCm * 10, W - 40), k = lado / CELDAS;
  const n = Math.min(15, app.M?.lot?.length || 4);
  const ids = [0, ...Array.from({ length: n }, (_, i) => i + 1)];
  ids.forEach((id, pag) => {
    if (pag) doc.addPage();
    const x0 = (W - lado) / 2, y0 = 52;
    doc.setFont('helvetica', 'bold'); doc.setFontSize(18);
    doc.text(id === 0 ? tr({ es: 'Axiona AR · Marcador 0 · Maqueta', en: 'Axiona AR · Marker 0 · Table model' }) : tr({ es: `Axiona AR · Marcador ${id} · Esquina P${id} del lote`, en: `Axiona AR · Marker ${id} · Lot corner P${id}` }), W / 2, 18, { align: 'center' });
    doc.setFont('helvetica', 'normal'); doc.setFontSize(10.5);
    const sig = id === n ? 1 : id + 1;
    const como = id === 0
      ? tr({ es: 'Ponlo plano sobre una mesa o el piso. La flecha apunta hacia el fondo de la casa.', en: 'Lay it flat on a table or the floor. The arrow points to the back of the house.' })
      : tr({ es: `Ponlo plano en el suelo con el centro (la cruz) sobre la estaca de P${id} y la flecha hacia P${sig}.`, en: `Lay it flat on the ground, centre (cross) on the P${id} stake and the arrow toward P${sig}.` });
    doc.text(doc.splitTextToSize(como, W - 30), W / 2, 26, { align: 'center' });
    // flecha hacia el borde de arriba del marcador
    doc.setFillColor(20, 20, 20);
    doc.triangle(W / 2, 34, W / 2 - 6, 44, W / 2 + 6, 44, 'F');
    doc.rect(W / 2 - 1.5, 44, 3, 4, 'F');
    // celdas
    celdas(id).forEach((fila, r) => fila.forEach((v, c) => { if (!v) doc.rect(x0 + c * k, y0 + r * k, k + 0.05, k + 0.05, 'F'); }));
    // cruz del centro (solo se ve sobre lo blanco del código)
    doc.setDrawColor(200, 40, 40); doc.setLineWidth(0.4);
    doc.line(W / 2 - 4, y0 + lado / 2, W / 2 + 4, y0 + lado / 2); doc.line(W / 2, y0 + lado / 2 - 4, W / 2, y0 + lado / 2 + 4);
    doc.setTextColor(30, 30, 30); doc.setFontSize(10);
    const pie = tr({
      es: `Imprime al 100 % (tamaño real, sin «ajustar a la página»). Mide el lado del cuadro negro: debe dar ${(lado / 10).toFixed(1).replace('.', ',')} cm. Si da otra medida, escríbela en la app (Realidad aumentada › lado del marcador). Más grande se ve desde más lejos: para el lote sirve imprimirlo en pliego.`,
      en: `Print at 100 % (actual size, no “fit to page”). Measure the black square: it should be ${(lado / 10).toFixed(1)} cm. If not, enter the measured size in the app (AR › marker size). Bigger markers are seen from farther away: for the lot, print it large.`,
    });
    doc.text(doc.splitTextToSize(pie, W - 30), W / 2, y0 + lado + 14, { align: 'center' });
    doc.setFontSize(8.5); doc.setTextColor(120, 120, 120);
    doc.text(`Axiona Obra · obra.axionasoft.com · ${app.S?.nombre || ''}`, W / 2, Hp - 10, { align: 'center' });
  });
  doc.save('axiona-marcadores-AR.pdf');
  toast(tr({ es: `Marcadores listos: el 0 para la maqueta y ${n} para las esquinas del lote.`, en: `Markers ready: 0 for the table model and ${n} for the lot corners.` }));
}

/** Muestra el marcador en esta pantalla (por ejemplo el computador) para apuntarle con el celular. */
export function mostrarMarcador(id = 0) {
  let d = document.getElementById('axMarcador');
  if (!d) {
    d = document.createElement('div');
    d.id = 'axMarcador';
    d.addEventListener('click', () => { d.hidden = true; });
    document.body.appendChild(d);
  }
  d.innerHTML = `${svgMarcador(id, 1000, { etiqueta: false })}<p>${tr({ es: 'Apunta la cámara del celular a esta pantalla con «AR Axiona › Maqueta». Toca para cerrar.', en: 'Point your phone camera at this screen with “Axiona AR › Table model”. Tap to close.' })}</p>`;
  d.hidden = false;
}
