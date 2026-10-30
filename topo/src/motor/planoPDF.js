/* ==========================================================================
   AXIONA TOPO · Plano topografico en PDF
   --------------------------------------------------------------------------
   La hoja que antes salia de dibujar en AutoCAD lo medido con la estacion:
   lote, curvas de nivel, puntos con cota, medidas y rumbos, cuadricula con
   coordenadas, norte, escala normalizada (1:100, 1:200, 1:500...) y, a la
   derecha, cuadro de coordenadas, cuadro de linderos, datos del terreno y
   rotulo con espacio para la firma del topografo que lo revise.
   Se dibuja con primitivas de jsPDF (lineas y texto vectorial), asi el PDF
   pesa poco y se imprime nitido en cualquier tamaño.
   ========================================================================== */

import { E0, N0, Z0 } from './exportar.js';

export const ESCALAS = [50, 75, 100, 125, 150, 200, 250, 300, 400, 500, 750, 1000, 1250, 1500, 2000, 2500, 3000, 4000, 5000, 7500, 10000];
export const HOJAS = { A3: { mm: [420, 297], formato: 'a3', columna: 118 }, carta: { mm: [279.4, 215.9], formato: 'letter', columna: 92 } };

/** La escala normalizada mas grande con la que el lote cabe en el area de dibujo. */
export function escalaPara(anchoM, altoM, anchoMm, altoMm) {
  for (const s of ESCALAS) if ((anchoM * 1000) / s <= anchoMm && (altoM * 1000) / s <= altoMm) return s;
  return ESCALAS[ESCALAS.length - 1];
}

/** Separacion de la cuadricula: un numero redondo de metros que quede a 25-60 mm en el papel. */
export function pasoCuadricula(escala) {
  for (const g of [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000]) if ((g * 1000) / escala >= 25) return g;
  return 1000;
}

/** Las fuentes estandar del PDF solo traen Latin-1: se cambian los signos que no estan. */
export const textoPDF = t => String(t ?? '').replace(/′/g, "'").replace(/″/g, '"').replace(/→/g, '-').replace(/[−–—]/g, '-').replace(/[^\x20-\x7e\xa0-\xff]/g, '');

const f = (v, d = 2) => (Number.isFinite(v) ? v.toFixed(d) : '-');

/**
 * Arma el PDF. D = calcular(L); jsPDF = la clase de la libreria.
 * opc: { hoja: 'A3' | 'carta', fecha, metodo }
 */
export function planoPDF(D, L, jsPDF, { hoja = 'A3', fecha = new Date() } = {}) {
  const H = HOJAS[hoja] || HOJAS.A3;
  const [W, Hh] = H.mm;
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: H.formato });
  const m = 8, cw = H.columna, xc = W - m - cw;
  const T = (t, x, y, o = {}) => doc.text(textoPDF(t), x, y, o);
  const gris = v => doc.setDrawColor(v, v, v);

  // Marco y columna de datos
  doc.setLineWidth(0.6); gris(20); doc.rect(m, m, W - 2 * m, Hh - 2 * m);
  doc.setLineWidth(0.35); doc.line(xc, m, xc, Hh - m);

  // ----- Dibujo -----
  const P = D.puntos;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const p of P) { x0 = Math.min(x0, p.x); y0 = Math.min(y0, p.y); x1 = Math.max(x1, p.x); y1 = Math.max(y1, p.y); }
  if (!P.length) { x0 = y0 = 0; x1 = y1 = 10; }
  const area = { x: m + 14, y: m + 14, w: xc - m - 28, h: Hh - 2 * m - 34 };
  const esc = escalaPara(Math.max(x1 - x0, 1), Math.max(y1 - y0, 1), area.w, area.h);
  const k = 1000 / esc;
  const cxm = (x0 + x1) / 2, cym = (y0 + y1) / 2, cxp = area.x + area.w / 2, cyp = area.y + area.h / 2;
  const X = x => cxp + (x - cxm) * k, Y = y => cyp - (y - cym) * k;
  const dentro = (px, py) => px >= area.x - 0.01 && px <= area.x + area.w + 0.01 && py >= area.y - 0.01 && py <= area.y + area.h + 0.01;

  // Cuadricula con coordenadas locales
  const g = pasoCuadricula(esc);
  doc.setLineWidth(0.1); gris(205); doc.setFontSize(6); doc.setTextColor(120);
  const xmin = cxm - area.w / 2 / k, xmax = cxm + area.w / 2 / k, ymin = cym - area.h / 2 / k, ymax = cym + area.h / 2 / k;
  for (let e = Math.ceil((E0 + xmin) / g) * g; e <= E0 + xmax; e += g) {
    const px = X(e - E0);
    doc.line(px, area.y, px, area.y + area.h);
    T(`E ${e}`, px, area.y + area.h + 3.2, { align: 'center' });
  }
  for (let n = Math.ceil((N0 + ymin) / g) * g; n <= N0 + ymax; n += g) {
    const py = Y(n - N0);
    doc.line(area.x, py, area.x + area.w, py);
    T(`N ${n}`, area.x - 1.5, py + 1, { align: 'right' });
  }

  // Curvas de nivel
  for (const c of D.curvas) {
    doc.setLineWidth(c.mayor ? 0.3 : 0.12);
    doc.setDrawColor(c.mayor ? 140 : 190, c.mayor ? 95 : 140, c.mayor ? 50 : 100);
    for (const ln of c.lineas) for (let i = 1; i < ln.length; i++) doc.line(X(ln[i - 1].x), Y(ln[i - 1].y), X(ln[i].x), Y(ln[i].y));
    if (c.mayor) {
      const ln = c.lineas.reduce((a, b) => (b.length > a.length ? b : a), c.lineas[0]), q = ln[Math.floor(ln.length / 2)];
      doc.setFontSize(6); doc.setTextColor(140, 95, 50);
      T(f(Z0 + c.z, 2), X(q.x), Y(q.y) - 0.8, { align: 'center' });
    }
  }

  // Huella de la obra
  if (D.huella) {
    doc.setLineWidth(0.35); gris(60); doc.setLineDashPattern([2, 1.2], 0);
    D.huella.forEach((p, i) => { const q = D.huella[(i + 1) % 4]; doc.line(X(p.x), Y(p.y), X(q.x), Y(q.y)); });
    doc.setLineDashPattern([], 0);
    const c = D.huella.reduce((s, p) => ({ x: s.x + p.x / 4, y: s.y + p.y / 4 }), { x: 0, y: 0 });
    doc.setFontSize(7); doc.setTextColor(60); T('OBRA', X(c.x), Y(c.y), { align: 'center' });
  }

  // Lindero con medidas
  const Lp = D.lindero;
  if (Lp.length >= 3) {
    doc.setLineWidth(0.6); gris(10);
    Lp.forEach((p, i) => { const q = Lp[(i + 1) % Lp.length]; doc.line(X(p.x), Y(p.y), X(q.x), Y(q.y)); });
    const sg = Math.sign(Lp.reduce((s, p, i) => { const q = Lp[(i + 1) % Lp.length]; return s + p.x * q.y - q.x * p.y; }, 0)) || 1;
    doc.setFontSize(7); doc.setTextColor(20);
    D.lados.forEach(l => {
      const a = Lp[l.i], b = Lp[l.j], dx = b.x - a.x, dy = b.y - a.y, n = Math.hypot(dx, dy) || 1;
      let ang = Math.atan2(dy, dx) * 180 / Math.PI;
      if (ang > 90) ang -= 180; else if (ang < -90) ang += 180;
      const px = X((a.x + b.x) / 2 + sg * (dy / n) * (2.2 / k)), py = Y((a.y + b.y) / 2 - sg * (dx / n) * (2.2 / k));
      T(`${f(l.largo)} m`, px, py, { align: 'center', angle: ang });
    });
  }

  // Puntos con cota
  const muchos = P.filter(p => p.tipo !== 'esquina').length > 30;
  for (const p of P) {
    const px = X(p.x), py = Y(p.y);
    if (!dentro(px, py)) continue;
    if (p.tipo === 'esquina') {
      doc.setLineWidth(0.3); gris(10); doc.setFillColor(255, 255, 255); doc.circle(px, py, 0.9, 'FD');
      doc.setFontSize(7.5); doc.setTextColor(10); T(p.id, px + 1.6, py - 1.2);
    } else {
      doc.setLineWidth(0.2); doc.setDrawColor(200, 120, 0);
      doc.line(px - 0.8, py, px + 0.8, py); doc.line(px, py - 0.8, px, py + 0.8);
      if (!muchos) { doc.setFontSize(5.5); doc.setTextColor(150, 90, 0); T(p.id, px + 1.1, py - 0.8); }
    }
    if (!D.sinNiveles) { doc.setFontSize(5.5); doc.setTextColor(p.estimada ? 150 : 70); T(f(Z0 + p.z, 2), px + 1.1, py + 2.2); }
  }

  // Norte (o eje del frente) y escala grafica
  const nx = xc - 14, ny = m + 18;
  doc.setTextColor(20); doc.setFontSize(9);
  if (L.origen) {
    doc.setFillColor(20, 20, 20); doc.triangle(nx, ny - 9, nx - 3, ny + 2, nx + 3, ny + 2, 'F');
    T('N', nx, ny + 6, { align: 'center' });
  } else {
    doc.setFontSize(6.5); doc.setTextColor(90);
    T('Sin norte geografico: el eje E', xc - 4, m + 6, { align: 'right' }); T('va por el frente (P1 a P2)', xc - 4, m + 9, { align: 'right' });
    doc.setTextColor(20);
  }
  const largoBarra = pasoCuadricula(esc), bx = m + 14, by = Hh - m - 8, bl = largoBarra * k;
  doc.setLineWidth(0.4); gris(20);
  doc.line(bx, by, bx + bl, by); doc.line(bx, by - 1.2, bx, by + 1.2); doc.line(bx + bl, by - 1.2, bx + bl, by + 1.2);
  doc.setFillColor(20, 20, 20); doc.rect(bx, by - 0.6, bl / 2, 1.2, 'F');
  doc.setFontSize(7); T(`0`, bx, by - 2, { align: 'center' }); T(`${largoBarra} m`, bx + bl, by - 2, { align: 'center' });
  doc.setFontSize(9); T(`ESCALA 1:${esc}`, bx + bl + 8, by + 1);

  // ----- Columna de datos -----
  let y = m + 7;
  const xa = xc + 4, ancho = cw - 8;
  doc.setTextColor(10); doc.setFontSize(11); doc.setFont('helvetica', 'bold');
  T('PLANO TOPOGRAFICO PRELIMINAR', xa, y); y += 5.5;
  doc.setFontSize(9.5); T(L.nombre || 'Lote sin nombre', xa, y, { maxWidth: ancho }); y += 6;
  doc.setFont('helvetica', 'normal');

  const tabla = (titulo, cab, filas, anchos, maxFilas) => {
    doc.setFont('helvetica', 'bold'); doc.setFontSize(8); T(titulo, xa, y); y += 3.6;
    doc.setFontSize(6.6);
    let x = xa; cab.forEach((c, i) => { T(c, x + (i ? anchos[i] - 1 : 0), y, { align: i ? 'right' : 'left' }); x += anchos[i]; });
    doc.setFont('helvetica', 'normal'); y += 1.2; gris(150); doc.setLineWidth(0.15); doc.line(xa, y, xa + ancho, y); y += 3;
    const vis = filas.slice(0, maxFilas);
    for (const fl of vis) { x = xa; fl.forEach((c, i) => { T(c, x + (i ? anchos[i] - 1 : 0), y, { align: i ? 'right' : 'left' }); x += anchos[i]; }); y += 3.1; }
    if (filas.length > vis.length) { doc.setTextColor(110); T(`... y ${filas.length - vis.length} mas en el archivo PNEZD`, xa, y); doc.setTextColor(10); y += 3.1; }
    y += 2;
  };
  const esq = D.esquinas;
  const sobra = Math.max(4, Math.floor((Hh - 2 * m - 150) / 3.1 / 2));
  tabla('CUADRO DE COORDENADAS', ['Punto', 'Norte', 'Este', 'Cota'], esq.map(p => [p.id, f(N0 + p.y, 3), f(E0 + p.x, 3), D.sinNiveles ? '-' : f(Z0 + p.z, 2)]), [ancho * 0.16, ancho * 0.3, ancho * 0.3, ancho * 0.24], sobra);
  tabla('CUADRO DE LINDEROS', ['Lado', 'Distancia', 'Rumbo'], D.lados.map(l => [`${esq[l.i].id}-${esq[l.j].id}`, `${f(l.largo)} m`, l.rumbo]), [ancho * 0.22, ancho * 0.33, ancho * 0.45], sobra);

  doc.setFont('helvetica', 'bold'); doc.setFontSize(8); T('DATOS DEL TERRENO', xa, y); y += 4;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(7);
  const datos = [
    ['Area', D.area ? `${f(D.area, 2)} m2${D.area >= 10000 ? ` (${f(D.area / 10000, 4)} ha)` : ''}` : '-'],
    ['Perimetro', D.perimetro ? `${f(D.perimetro)} m` : '-'],
    ['Desnivel', D.sinNiveles ? 'sin cotas' : `${f(D.desnivel)} m`],
    ['Pendiente general', D.sinNiveles ? '-' : `${f(D.pendiente.general, 1)} % (${D.pendiente.clase.toLowerCase()})`],
    ['Curvas de nivel', D.curvas.length ? `cada ${f(D.intervalo, 2)} m, mayores cada ${f(D.intervalo * 5, 2)} m` : '-'],
  ];
  if (D.volumen && !D.sinNiveles) {
    datos.push([D.huella ? 'Plataforma de la obra' : 'Plataforma', `${f(Z0 + D.plataforma.z, 2)}`]);
    datos.push(['Corte / relleno', `${f(D.volumen.corte, 1)} / ${f(D.volumen.relleno, 1)} m3`]);
  }
  for (const [a, b] of datos) { T(a, xa, y); T(b, xa + ancho, y, { align: 'right' }); y += 3.4; }
  y += 1.5;
  doc.setFontSize(6.2); doc.setTextColor(70);
  const metodo = { gps: 'GPS del celular (precision tipica 2 a 5 m)', camara: 'camara con realidad aumentada (2 a 5 cm cerca)', cinta: 'cinta: lados y diagonales', archivo: 'puntos importados de otro equipo', manual: 'puntos escritos a mano', ejemplo: 'lote de ejemplo' }[L.metodo] || L.metodo || '-';
  const notas = [
    `Levantado con ${metodo}.`,
    `Coordenadas locales: E ${E0}, N ${N0} y cota ${Z0} en el primer punto.`,
    'Levantamiento preliminar para anteproyecto y cotizacion. Para la licencia lo revisa y firma un topografo con licencia profesional.',
  ];
  for (const n of notas) { const lineas = doc.splitTextToSize(textoPDF(n), ancho); doc.text(lineas, xa, y); y += lineas.length * 2.6 + 0.6; }

  // Rotulo
  const ry = Hh - m - 34;
  doc.setTextColor(10); gris(20); doc.setLineWidth(0.35); doc.line(xc, ry, W - m, ry);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(10); T('AXIONA TOPO', xa, ry + 6);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(6.5);
  T('Axiona Desarrollos Inteligentes - Sabaneta, Antioquia', xa, ry + 9.5);
  T(`Fecha: ${fecha.toISOString().slice(0, 10)}`, xa, ry + 13.5);
  T(`Escala 1:${esc} - Hoja ${hoja === 'A3' ? 'A3' : 'carta'}`, xa + ancho, ry + 13.5, { align: 'right' });
  doc.setLineWidth(0.15); gris(120);
  doc.line(xa, ry + 24, xa + ancho * 0.46, ry + 24); doc.line(xa + ancho * 0.54, ry + 24, xa + ancho, ry + 24);
  T('Elaboro', xa, ry + 27); T('Reviso: topografo, matricula', xa + ancho * 0.54, ry + 27);
  return { doc, escala: esc };
}
