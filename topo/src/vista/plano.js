/* ==========================================================================
   AXIONA TOPO · Plano topografico (SVG)
   --------------------------------------------------------------------------
   Dibuja el lote visto desde arriba: lindero con medidas, puntos con cota,
   curvas de nivel (las mayores con su cota), y debajo, si se pide, el
   terreno pintado por corte y relleno o por pendiente. Es una funcion pura:
   recibe los datos calculados y devuelve el SVG como texto.
   ========================================================================== */

import { dentro } from '../motor/poligono.js';

const fx = (v, d = 2) => Number(v).toLocaleString('es-CO', { minimumFractionDigits: d, maximumFractionDigits: d });
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function escalaBonita(m) {
  for (const v of [0.5, 1, 2, 5, 10, 20, 25, 50, 100, 200, 500, 1000]) if (v >= m) return v;
  return 1000;
}

/**
 * opc: { curvas, tierra, pendiente, cotas, medidas, norte }
 *   tierra    -> triangulos rojos (corte) y azules (relleno) contra la plataforma
 *   pendiente -> triangulos por clase de pendiente
 *   norte     -> el eje y es el norte verdadero (levantamiento con GPS)
 */
export function svgPlano(D, opc = {}) {
  const o = { curvas: true, tierra: false, pendiente: false, cotas: true, medidas: true, norte: false, ...opc };
  const P = D.puntos;
  if (!P.length) return '';
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const p of P) { x0 = Math.min(x0, p.x); y0 = Math.min(y0, p.y); x1 = Math.max(x1, p.x); y1 = Math.max(y1, p.y); }
  const w = Math.max(x1 - x0, 1), h = Math.max(y1 - y0, 1);
  const W = 1000, pad = 90, k = (W - 2 * pad) / Math.max(w, h * 0.75);
  const H = Math.round(h * k + 2 * pad);
  const X = x => pad + (x - x0) * k + ((W - 2 * pad) - w * k) / 2;
  const Y = y => H - pad - (y - y0) * k;
  const out = [];
  const tr = { x0, y0, k, pad, off: ((W - 2 * pad) - w * k) / 2, H, W };
  out.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" class="plano-svg" role="img" aria-label="Plano del lote" data-t='${JSON.stringify(tr)}'>`);
  out.push('<defs><filter id="brillo" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>'
    + '<pattern id="reja" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M40 0H0V40" fill="none" stroke="#16212d" stroke-width="1"/></pattern></defs>');
  out.push(`<rect width="${W}" height="${H}" fill="#070b10"/><rect width="${W}" height="${H}" fill="url(#reja)"/>`);

  // Terreno pintado
  const T = D.T;
  if ((o.tierra && D.plataforma) || o.pendiente) {
    const Z0 = D.plataforma?.z ?? 0;
    let hmax = 1e-6;
    if (o.tierra) for (const [a, b, c] of T.triangulos) hmax = Math.max(hmax, Math.abs((T.puntos[a].z + T.puntos[b].z + T.puntos[c].z) / 3 - Z0));
    T.triangulos.forEach(([a, b, c], i) => {
      const A = T.puntos[a], B = T.puntos[b], C = T.puntos[c];
      let col, al;
      if (o.pendiente) {
        const s = D.pendiente.porTriangulo[i]?.pct ?? 0;
        col = s < 3 ? '#41e2a4' : s < 7 ? '#8fe36b' : s < 12 ? '#d7e05a' : s < 25 ? '#ffae2b' : s < 50 ? '#ff7a45' : '#ff5f78';
        al = 0.32;
      } else {
        if (D.huella && !dentro((A.x + B.x + C.x) / 3, (A.y + B.y + C.y) / 3, D.huella)) return;
        const hm = (A.z + B.z + C.z) / 3 - Z0;
        col = hm > 0 ? '#ff5f78' : '#3fcfff';
        al = 0.1 + 0.5 * Math.min(1, Math.abs(hm) / hmax);
      }
      out.push(`<polygon points="${X(A.x)},${Y(A.y)} ${X(B.x)},${Y(B.y)} ${X(C.x)},${Y(C.y)}" fill="${col}" fill-opacity="${al.toFixed(2)}" stroke="${col}" stroke-opacity="0.18" stroke-width="0.6"/>`);
    });
  }

  // Curvas de nivel
  if (o.curvas) {
    for (const c of D.curvas) {
      for (const ln of c.lineas) {
        const d = ln.map((p, i) => `${i ? 'L' : 'M'}${X(p.x).toFixed(1)} ${Y(p.y).toFixed(1)}`).join('');
        out.push(`<path d="${d}" fill="none" stroke="${c.mayor ? '#41e2a4' : '#2b6f63'}" stroke-width="${c.mayor ? 2 : 1}" stroke-opacity="${c.mayor ? 0.95 : 0.8}"/>`);
      }
      if (c.mayor) {
        const ln = c.lineas.reduce((a, b) => (b.length > a.length ? b : a), c.lineas[0]);
        const m = ln[Math.floor(ln.length / 2)];
        out.push(`<text x="${X(m.x).toFixed(1)}" y="${Y(m.y).toFixed(1)}" class="t-curva" text-anchor="middle" dy="4">${fx(c.z, 2)}</text>`);
      }
    }
  }

  // Lindero
  const L = D.lindero;
  if (L.length >= 3) {
    const pts = L.map(p => `${X(p.x).toFixed(1)},${Y(p.y).toFixed(1)}`).join(' ');
    out.push(`<polygon points="${pts}" fill="#3fcfff" fill-opacity="0.04" stroke="#3fcfff" stroke-width="3" stroke-linejoin="round" filter="url(#brillo)"/>`);
    if (o.medidas) {
      const sg = Math.sign(L.reduce((s, p, i) => { const q = L[(i + 1) % L.length]; return s + p.x * q.y - q.x * p.y; }, 0)) || 1;
      D.lados.forEach(l => {
        const a = L[l.i], b = L[l.j];
        const mx = (X(a.x) + X(b.x)) / 2, my = (Y(a.y) + Y(b.y)) / 2;
        const dx = X(b.x) - X(a.x), dy = Y(b.y) - Y(a.y), n = Math.hypot(dx, dy) || 1;
        // Normal hacia afuera del lote (en pantalla el eje y va al reves)
        const nx = sg * dy / n, ny = -sg * dx / n;
        let ang = Math.atan2(dy, dx) * 180 / Math.PI;
        if (ang > 90) ang -= 180; else if (ang < -90) ang += 180;
        const tx = mx + nx * 22, ty = my + ny * 22;
        out.push(`<g transform="translate(${tx.toFixed(1)} ${ty.toFixed(1)}) rotate(${ang.toFixed(1)})"><text class="t-lado" text-anchor="middle" dy="5">${fx(l.largo)} m</text></g>`);
      });
    }
  }

  // Huella de la obra
  if (D.huella) {
    const pts = D.huella.map(p => `${X(p.x).toFixed(1)},${Y(p.y).toFixed(1)}`).join(' ');
    const c = D.huella.reduce((s, p) => ({ x: s.x + p.x / 4, y: s.y + p.y / 4 }), { x: 0, y: 0 });
    out.push(`<polygon points="${pts}" fill="#e9fdff" fill-opacity="0.06" stroke="#e9fdff" stroke-width="2.5" stroke-dasharray="10 7"/>`);
    out.push(`<text x="${X(c.x).toFixed(1)}" y="${Y(c.y).toFixed(1)}" class="t-huella" text-anchor="middle" dy="5">OBRA</text>`);
  }

  // Puntos (con muchos niveles solo se escribe la cota, sin el nombre)
  const muchos = P.filter(p => p.tipo !== 'esquina').length > 15;
  for (const p of P) {
    const esq = p.tipo === 'esquina';
    const cx = X(p.x).toFixed(1), cy = Y(p.y).toFixed(1);
    if (esq) out.push(`<circle cx="${cx}" cy="${cy}" r="7" fill="#04131c" stroke="#3fcfff" stroke-width="2.5"/><circle cx="${cx}" cy="${cy}" r="2.5" fill="#3fcfff"/>`);
    else out.push(`<path d="M${+cx - 6} ${cy}h12M${cx} ${+cy - 6}v12" stroke="#ffae2b" stroke-width="2.2"/>`);
    if (esq || !muchos) out.push(`<text x="${+cx + 11}" y="${+cy - 9}" class="${esq ? 't-esq' : 't-niv'}">${esc(p.id)}</text>`);
    if (o.cotas && !D.sinNiveles) out.push(`<text x="${+cx + 11}" y="${+cy + 9}" class="t-cota${p.estimada ? ' est' : ''}">${p.z >= 0 ? '+' : ''}${fx(p.z)}</text>`);
  }

  // Norte o eje del frente, y escala grafica
  const ex = W - 60, ey = 70;
  if (o.norte) out.push(`<g transform="translate(${ex} ${ey})"><path d="M0 -34 L11 8 L0 0 L-11 8Z" fill="#3fcfff"/><text y="30" text-anchor="middle" class="t-norte">N</text></g>`);
  else if (L.length >= 2) out.push(`<g transform="translate(${ex - 30} ${ey - 20})"><text class="t-eje" text-anchor="end">Frente: ${esc(L.length ? D.esquinas[0].id : '')} → ${esc(D.esquinas[1]?.id || '')}</text></g>`);
  const m = escalaBonita(Math.max(w, h) * 0.2), bx = 60, by = H - 36;
  out.push(`<g class="escala"><path d="M${bx} ${by}h${(m * k).toFixed(1)}" stroke="#e3eaf2" stroke-width="3"/><path d="M${bx} ${by - 7}v14M${(bx + m * k).toFixed(1)} ${by - 7}v14" stroke="#e3eaf2" stroke-width="2"/><text x="${bx}" y="${by - 12}" class="t-escala">${fx(m, m < 1 ? 1 : 0)} m</text></g>`);
  out.push('</svg>');
  return out.join('');
}

/** Perfil del escaner como SVG pequeño: terreno, plataforma, corte y relleno. */
export function svgPerfil(pr, Z0, { ancho = 600, alto = 150 } = {}) {
  const v = pr.filter(p => p.z !== null);
  if (v.length < 2) return '';
  const L = pr[pr.length - 1].d || 1;
  let z0 = Math.min(...v.map(p => p.z), Z0), z1 = Math.max(...v.map(p => p.z), Z0);
  if (z1 - z0 < 0.5) { const m = (z0 + z1) / 2; z0 = m - 0.25; z1 = m + 0.25; }
  const pd = 14, X = d => pd + (d / L) * (ancho - 2 * pd), Y = z => alto - pd - ((z - z0) / (z1 - z0)) * (alto - 2 * pd);
  const tramo = v.map((p, i) => `${i ? 'L' : 'M'}${X(p.d).toFixed(1)} ${Y(p.z).toFixed(1)}`).join('');
  const area = `${tramo}L${X(v[v.length - 1].d).toFixed(1)} ${Y(Z0).toFixed(1)}L${X(v[0].d).toFixed(1)} ${Y(Z0).toFixed(1)}Z`;
  return `<svg viewBox="0 0 ${ancho} ${alto}" class="perfil-svg" aria-label="Perfil del terreno">`
    + '<defs><clipPath id="arriba"><rect x="0" y="0" width="' + ancho + '" height="' + Y(Z0).toFixed(1) + '"/></clipPath>'
    + '<clipPath id="abajo"><rect x="0" y="' + Y(Z0).toFixed(1) + '" width="' + ancho + '" height="' + alto + '"/></clipPath></defs>'
    + `<path d="${area}" fill="#ff5f78" fill-opacity="0.35" clip-path="url(#arriba)"/>`
    + `<path d="${area}" fill="#3fcfff" fill-opacity="0.35" clip-path="url(#abajo)"/>`
    + `<path d="M${pd} ${Y(Z0).toFixed(1)}H${ancho - pd}" stroke="#e3eaf2" stroke-dasharray="6 5" stroke-width="1.5"/>`
    + `<path d="${tramo}" fill="none" stroke="#41e2a4" stroke-width="2.5"/>`
    + `<text x="${ancho - pd}" y="${(Y(Z0) - 6).toFixed(1)}" text-anchor="end" class="t-perfil">plataforma ${fx(Z0)}</text>`
    + '</svg>';
}
