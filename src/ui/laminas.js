/* ==========================================================================
   AXIONA OBRA · Juego de planos en laminas
   --------------------------------------------------------------------------
   Arma el juego completo como en una oficina: portada con indice, plano de
   localizacion, una planta por piso, cubierta, fachadas, cortes,
   cimentacion, electricos, hidrosanitarios, cuadros, detalles y resumen de
   presupuesto. Cada lamina lleva rotulo con proyecto, profesionales (con
   espacio para firma y matricula), sello oficial, revisiones y su codigo
   segun la costumbre del pais. La escala se escoge sola: la mas grande de
   la serie normal que deje caber las vistas.
   ========================================================================== */

import { tr, PAPELES, NORMAS, pais as paisDe, totales, precioDe, nombreCategoria, CATS, pisoDe, PISOS } from '../motor/index.js';
import { cuadroAberturas, cuadroAcabados, cuadroAreas } from '../motor/cuadros.js';
import { detalles } from '../motor/alzados.js';
import { vistaPlano, vistasDePrimitivas } from './planos.js';
import { dibujar } from './dibujo.js';
import { esc, fmtL, fmtA, fm, money, imperial, fmtObj } from './comun.js';

const ESC_M = [20, 25, 50, 75, 100, 125, 150, 200, 250, 300, 400, 500, 750, 1000];
const ESC_I = [[12, '1" = 1\'-0"'], [24, '1/2" = 1\'-0"'], [48, '1/4" = 1\'-0"'], [64, '3/16" = 1\'-0"'], [96, '1/8" = 1\'-0"'], [192, '1/16" = 1\'-0"'], [384, '1/32" = 1\'-0"'], [480, '1" = 40\''], [960, '1" = 80\'']];
const escalas = () => (imperial() ? ESC_I.map(e => e[0]) : ESC_M);
export const textoEscala = N => (imperial() ? (ESC_I.find(e => e[0] === N)?.[1] || `1:${N}`) : `1:${N}`);

const F = 'font-family="Helvetica, Arial, sans-serif"';
const t = (x, y, s, txt, ex = '') => `<text x="${(+x).toFixed(2)}" y="${(+y).toFixed(2)}" font-size="${s}" ${F} fill="#111" ${ex}>${esc(txt)}</text>`;
const ln = (x1, y1, x2, y2, w = 0.25, c = '#111') => `<line x1="${(+x1).toFixed(2)}" y1="${(+y1).toFixed(2)}" x2="${(+x2).toFixed(2)}" y2="${(+y2).toFixed(2)}" stroke="${c}" stroke-width="${w}"/>`;
const rc = (x, y, w, h, sw = 0.25, fill = 'none', c = '#111') => `<rect x="${(+x).toFixed(2)}" y="${(+y).toFixed(2)}" width="${(+w).toFixed(2)}" height="${(+h).toFixed(2)}" fill="${fill}" stroke="${c}" stroke-width="${sw}"/>`;

/** Recorta un texto para que quepa en un ancho (aprox. 0.52·tamaño por caracter). */
const cabe = (txt, ancho, s) => { const n = Math.floor(ancho / (s * 0.52)); return txt.length > n ? txt.slice(0, Math.max(1, n - 1)) + '…' : txt; };

/** Tabla con encabezado. cols: [{t, w, al}] en mm. */
function tabla(x, y, cols, filas, { s = 2.0, rh = 4.4, titulo = null } = {}) {
  const out = [];
  let yy = y;
  const W = cols.reduce((a, c) => a + c.w, 0);
  if (titulo) { out.push(t(x, yy + s * 1.2, s * 1.25, titulo, 'font-weight="700"')); yy += s * 2.2; }
  out.push(rc(x, yy, W, rh, 0.3, '#ececec'));
  let xx = x;
  cols.forEach(c => { out.push(t(c.al === 'end' ? xx + c.w - 1 : xx + 1, yy + rh * 0.68, s * 0.92, cabe(c.t, c.w - 2, s * 0.92), `font-weight="700" text-anchor="${c.al === 'end' ? 'end' : 'start'}"`)); xx += c.w; });
  yy += rh;
  filas.forEach((f, i) => {
    if (f.sep) { out.push(rc(x, yy, W, rh, 0.2, '#f6f6f6')); out.push(t(x + 1, yy + rh * 0.68, s, cabe(f.sep, W - 2, s), 'font-weight="700"')); yy += rh; return; }
    if (i % 2) out.push(rc(x, yy, W, rh, 0, '#fafafa', 'none'));
    let cx = x;
    cols.forEach((c, k) => {
      const v = String(f[k] ?? '');
      out.push(t(c.al === 'end' ? cx + c.w - 1 : cx + 1, yy + rh * 0.68, s, cabe(v, c.w - 2, s), `text-anchor="${c.al === 'end' ? 'end' : 'start'}"${f.b ? ' font-weight="700"' : ''}`));
      cx += c.w;
    });
    out.push(ln(x, yy + rh, x + W, yy + rh, 0.1, '#bbb'));
    yy += rh;
  });
  out.push(rc(x, y + (titulo ? s * 2.2 : 0), W, yy - y - (titulo ? s * 2.2 : 0), 0.3));
  return { svg: out.join(''), h: yy - y, w: W };
}

/** Escoge la escala y la reticula para que todas las vistas quepan. */
function acomodar(medidas, area, opciones = escalas()) {
  const n = medidas.length;
  for (const N of opciones) {
    for (let cols = 1; cols <= n; cols++) {
      const rows = Math.ceil(n / cols), cw = area.w / cols, ch = area.h / rows - 11;
      if (medidas.every(m => m.w * 1000 / N <= cw - 3 && m.h * 1000 / N <= ch)) return { N, cols, rows, cw, ch: area.h / rows };
    }
  }
  const N = opciones[opciones.length - 1];
  return { N, cols: n, rows: 1, cw: area.w / n, ch: area.h };
}

/* ---------------------------------------------------------------- rotulo */

function rotulo(ctx, x, y, w, h, hoja) {
  const { S, P } = ctx;
  const o = [];
  const pad = 2.5, s = Math.max(1.8, Math.min(2.6, w / 30));
  o.push(rc(x, y, w, h, 0.5));
  let yy = y + pad;
  // firma o empresa
  o.push(`<rect x="${(x + pad).toFixed(2)}" y="${yy.toFixed(2)}" width="${(s * 3).toFixed(2)}" height="${(s * 3).toFixed(2)}" rx="${(s * 0.6).toFixed(2)}" fill="#0b5c78"/>`);
  o.push(`<path d="M${(x + pad + s * 0.7).toFixed(2)} ${(yy + s * 2.3).toFixed(2)} L${(x + pad + s * 1.5).toFixed(2)} ${(yy + s * 0.7).toFixed(2)} L${(x + pad + s * 2.3).toFixed(2)} ${(yy + s * 2.3).toFixed(2)}" fill="none" stroke="#00f0c0" stroke-width="${(s * 0.35).toFixed(2)}"/>`);
  o.push(t(x + pad + s * 3.6, yy + s * 1.3, s * 1.05, cabe(S.proyecto.empresa || 'Axiona', w - s * 5, s * 1.05), 'font-weight="700"'));
  o.push(t(x + pad + s * 3.6, yy + s * 2.6, s * 0.8, tr({ es: 'Generado con Axiona Obra', en: 'Generated with Axiona Obra' }), 'fill="#555"'));
  yy += s * 4.2;
  o.push(ln(x, yy, x + w, yy, 0.3));
  // proyecto
  yy += pad + s;
  o.push(t(x + pad, yy, s * 0.8, tr({ es: 'PROYECTO', en: 'PROJECT' }), 'fill="#555"'));
  yy += s * 1.6;
  o.push(t(x + pad, yy, s * 1.25, cabe(S.nombre || tr({ es: 'Proyecto', en: 'Project' }), w - 2 * pad, s * 1.25), 'font-weight="700"'));
  [S.proyecto.direccion, S.proyecto.ciudad, S.proyecto.predio && `${tr({ es: 'Predio', en: 'Parcel' })}: ${S.proyecto.predio}`, S.proyecto.propietario && `${tr({ es: 'Propietario', en: 'Owner' })}: ${S.proyecto.propietario}`].filter(Boolean).forEach(v => { yy += s * 1.35; o.push(t(x + pad, yy, s * 0.9, cabe(v, w - 2 * pad, s * 0.9))); });
  yy += s;
  o.push(ln(x, yy, x + w, yy, 0.3));
  // profesionales con espacio para firma
  yy += pad + s * 0.6;
  const pros = (S.profesionales || []).filter(p => p.nombre || p.doc);
  const roles = P.profesionales;
  const lista = pros.length ? pros : roles.slice(0, 2).map(r => ({ rol: r.id, nombre: '', doc: '' }));
  lista.slice(0, 4).forEach(p => {
    const rol = roles.find(r => r.id === p.rol) || roles[0];
    o.push(t(x + pad, yy, s * 0.78, tr(rol.rol).toUpperCase(), 'fill="#555"'));
    yy += s * 1.4;
    o.push(t(x + pad, yy, s * 0.95, cabe(p.nombre || '________________________', w - 2 * pad, s * 0.95), p.nombre ? 'font-weight="700"' : ''));
    yy += s * 1.3;
    o.push(t(x + pad, yy, s * 0.82, `${tr(rol.doc)}: ${p.doc || '__________'}`));
    o.push(ln(x + w * 0.52, yy + 0.3, x + w - pad, yy + 0.3, 0.2));
    o.push(t(x + w - pad, yy + s * 1.0, s * 0.62, tr({ es: 'Firma', en: 'Signature' }), 'text-anchor="end" fill="#777"'));
    yy += s * 1.9;
  });
  o.push(ln(x, yy, x + w, yy, 0.3));
  // sello oficial
  const hs = Math.min(w * 0.55, 30);
  yy += pad;
  o.push(rc(x + pad, yy, w - 2 * pad, hs, 0.2, 'none', '#999'));
  o.push(t(x + w / 2, yy + hs / 2, s * 0.8, tr(P.sello).toUpperCase(), 'text-anchor="middle" fill="#aaa"'));
  yy += hs + pad;
  // estado de revision: el 2 % humano
  const ok = !!S.proyecto.aprobado && pros.length;
  o.push(rc(x + pad, yy, w - 2 * pad, s * 3.2, 0.3, ok ? '#e8f6ee' : '#fff4e5', ok ? '#1b7a43' : '#b26a00'));
  o.push(t(x + w / 2, yy + s * 1.35, s * 0.85, ok ? tr({ es: 'REVISADO Y APROBADO', en: 'REVIEWED AND APPROVED' }) : tr({ es: 'ANTEPROYECTO · PARA REVISIÓN', en: 'PRELIMINARY · FOR REVIEW' }), `text-anchor="middle" font-weight="700" fill="${ok ? '#1b7a43' : '#b26a00'}"`));
  o.push(t(x + w / 2, yy + s * 2.55, s * 0.62, ok ? cabe(`${tr({ es: 'por', en: 'by' })} ${pros[0].nombre} · ${pros[0].doc}`, w - 2 * pad, s * 0.62) : tr({ es: 'Requiere revisión y firma de profesional habilitado', en: 'Requires review and seal by a licensed professional' }), `text-anchor="middle" fill="${ok ? '#1b7a43' : '#b26a00'}"`));
  yy += s * 3.2 + pad;
  // revisiones
  o.push(t(x + pad, yy + s, s * 0.78, tr({ es: 'REVISIONES', en: 'REVISIONS' }), 'fill="#555"'));
  yy += s * 1.9;
  o.push(t(x + pad, yy, s * 0.82, `${S.proyecto.revision || '0'}  ·  ${ctx.fecha}  ·  ${tr({ es: 'Emisión', en: 'Issued' })}`));
  yy += s * 0.9;
  o.push(ln(x, yy, x + w, yy, 0.3));
  // contenido, escala, fecha y codigo
  const yb = y + h - pad;
  o.push(t(x + w - pad, yb, s * 3.4, hoja.cod, 'text-anchor="end" font-weight="700"'));
  o.push(t(x + pad, yb - s * 0.4, s * 0.82, `${tr({ es: 'Lámina', en: 'Sheet' })} ${hoja.n} / ${ctx.total}`, 'fill="#555"'));
  o.push(t(x + pad, yb - s * 4.4, s * 0.82, `${tr({ es: 'Escala', en: 'Scale' })}: ${hoja.escalaTxt || tr({ es: 'indicada', en: 'as noted' })}`));
  o.push(t(x + pad, yb - s * 3.1, s * 0.82, `${tr({ es: 'Fecha', en: 'Date' })}: ${ctx.fecha}`));
  const lineas = partir(hoja.titulo.toUpperCase(), Math.floor((w - 2 * pad) / (s * 1.05 * 0.6)));
  lineas.slice(0, 3).forEach((l, i) => o.push(t(x + pad, yb - s * 6.2 - (lineas.length - 1 - i) * s * 1.35, s * 1.05, l, 'font-weight="700"')));
  o.push(ln(x, yb - s * 6.2 - lineas.length * s * 1.35 - s * 0.4, x + w, yb - s * 6.2 - lineas.length * s * 1.35 - s * 0.4, 0.3));
  return o.join('');
}

function partir(txt, n) {
  const out = []; let cur = '';
  for (const w of txt.split(' ')) { if ((cur + ' ' + w).trim().length > n && cur) { out.push(cur); cur = w; } else cur = (cur + ' ' + w).trim(); }
  if (cur) out.push(cur);
  return out;
}

/* ---------------------------------------------------------------- vistas en la lamina */

function bloqueVistas(ctx, area, vistas) {
  const medidas = vistas.map(v => v.medir());
  const lay = acomodar(medidas, area, vistas[0].escalas || escalas());
  const out = [];
  vistas.forEach((v, i) => {
    const col = i % lay.cols, row = Math.floor(i / lay.cols);
    const cx = area.x + col * lay.cw, cy = area.y + row * lay.ch;
    const d = v.dibujar(lay.N);
    const ww = d.w * 1000 / lay.N, hh = d.h * 1000 / lay.N;
    const px = cx + (lay.cw - ww) / 2, py = cy + Math.max(0, (lay.ch - 11 - hh) / 2);
    out.push(`<g transform="translate(${px.toFixed(2)} ${py.toFixed(2)}) scale(${(1000 / lay.N).toFixed(5)})">${d.cuerpo}</g>`);
    // titulo de la vista
    const ty = py + hh + 5;
    const r = 2.6;
    out.push(`<circle cx="${(px + r + 1).toFixed(2)}" cy="${(ty).toFixed(2)}" r="${r}" fill="none" stroke="#111" stroke-width="0.3"/>`);
    out.push(t(px + r + 1, ty + 0.9, 2.4, String(ctx.numVista++), 'text-anchor="middle" font-weight="700"'));
    out.push(t(px + 2 * r + 3, ty - 0.2, 2.8, v.titulo.toUpperCase(), 'font-weight="700"'));
    out.push(ln(px + 2 * r + 3, ty + 1.2, px + Math.max(ww, 60), ty + 1.2, 0.3));
    out.push(t(px + 2 * r + 3, ty + 4.0, 2.0, `${tr({ es: 'ESCALA', en: 'SCALE' })} ${textoEscala(v.escalaFija || lay.N)}`, 'fill="#444"'));
  });
  return { svg: out.join(''), N: lay.N };
}

/* ---------------------------------------------------------------- hojas */

function nuevaHoja(ctx, def) {
  const { W, H } = ctx;
  const m = W > 600 ? 10 : 7, tw = Math.max(44, Math.min(82, W * 0.14));
  const area = { x: m + 5, y: m + 5, w: W - 2 * m - tw - 10, h: H - 2 * m - 10 };
  return { ...def, m, tw, area };
}

function cerrarHoja(ctx, h, cuerpo) {
  const { W, H } = ctx;
  const marco = rc(h.m, h.m, W - 2 * h.m, H - 2 * h.m, 0.6) + ln(W - h.m - h.tw, h.m, W - h.m - h.tw, H - h.m, 0.6);
  const rot = rotulo(ctx, W - h.m - h.tw, h.m, h.tw, H - 2 * h.m, h);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}mm" height="${H}mm" viewBox="0 0 ${W} ${H}" ${F}><rect width="${W}" height="${H}" fill="#fff"/>${marco}${cuerpo}${rot}</svg>`;
  return { id: h.id, cod: h.cod, titulo: h.titulo, svg, w: W, h: H };
}

function codigos(pid, defs, F) {
  if (pid === 'CA') {
    const m = { portada: 'A0.0', sitio: 'A1.0', cim: 'A1.1', cub: `A2.${F + 1}`, fachadas: 'A3.0', cortes: 'A4.0', detalles: 'A5.0', cuadros: 'A6.0', presupuesto: 'C1.0' };
    defs.forEach(d => { d.cod = m[d.id] || (d.id[0] === 'p' ? `A2.${d.id.slice(1)}` : d.id[0] === 'e' ? `E1.${d.id.slice(1)}` : d.id[0] === 'h' ? `P1.${d.id.slice(1)}` : d.id); });
  } else if (pid === 'ES') {
    defs.forEach((d, i) => { d.cod = `PL-${String(i + 1).padStart(2, '0')}`; });
  } else {
    let a = 0, el = 0, hs = 0;
    defs.forEach(d => {
      if (d.id === 'cim') d.cod = 'E-01';
      else if (d.id[0] === 'e' && /^e\d/.test(d.id)) d.cod = `EL-${String(++el).padStart(2, '0')}`;
      else if (d.id[0] === 'h' && /^h\d/.test(d.id)) d.cod = `HS-${String(++hs).padStart(2, '0')}`;
      else if (d.id === 'presupuesto') d.cod = 'P-01';
      else d.cod = `A-${String(a++).padStart(2, '0')}`;
    });
  }
}

/** Lista de laminas del juego (sin dibujar), en orden. */
export function indiceLaminas(M, S) {
  const pid = S.pais;
  const defs = [
    { id: 'portada', titulo: tr({ es: 'Portada e índice', en: 'Cover and sheet index' }) },
    { id: 'sitio', titulo: tr({ es: 'Localización, implantación y cuadro de áreas', en: 'Site plan and area schedule' }) },
    ...M.floors.map(f => ({ id: 'p' + (f.f + 1), titulo: tr({ es: `Planta arquitectónica piso ${f.f + 1}`, en: `Floor ${f.f + 1} plan` }) })),
    { id: 'cub', titulo: tr({ es: 'Planta de cubierta', en: 'Roof plan' }) },
    { id: 'fachadas', titulo: tr({ es: 'Fachadas', en: 'Elevations' }) },
    { id: 'cortes', titulo: tr({ es: 'Cortes', en: 'Building sections' }) },
    { id: 'cim', titulo: M.sistema === 'madera' ? tr({ es: 'Cimentación y sótano', en: 'Foundation and basement plan' }) : tr({ es: 'Cimentación y ejes (predimensionamiento)', en: 'Foundation and grid (pre-sizing)' }) },
    ...M.floors.map(f => ({ id: 'e' + (f.f + 1), titulo: tr({ es: `Instalaciones eléctricas piso ${f.f + 1}`, en: `Electrical plan floor ${f.f + 1}` }) })),
    ...M.floors.map(f => ({ id: 'h' + (f.f + 1), titulo: tr({ es: `Instalaciones hidrosanitarias piso ${f.f + 1}`, en: `Plumbing plan floor ${f.f + 1}` }) })),
    { id: 'cuadros', titulo: tr({ es: 'Cuadros de puertas, ventanas y acabados', en: 'Door, window and finish schedules' }) },
    { id: 'detalles', titulo: tr({ es: 'Detalles constructivos típicos', en: 'Typical construction details' }) },
    { id: 'presupuesto', titulo: tr({ es: 'Resumen de presupuesto y cronograma', en: 'Cost summary and schedule' }) },
  ];
  codigos(pid, defs, M.F);
  const ocultas = new Set(S.laminas?.ocultas || []);
  return defs.map(d => ({ ...d, oculta: ocultas.has(d.id) && d.id !== 'portada' }));
}

/**
 * Dibuja el juego. opts.render: imagen (dataURL) del 3D para la portada.
 * opts.solo: id de una sola lamina (vista previa).
 */
export function juegoDeLaminas(M, S, opts = {}) {
  const P = paisDe(S.pais);
  const papel = PAPELES[S.laminas?.papel] || PAPELES[P.papel];
  const W = papel.w, H = papel.h;
  const fmt = fmtObj();
  const ab = cuadroAberturas(M, S);
  const indice = indiceLaminas(M, S).filter(d => !d.oculta);
  const fecha = new Date().toLocaleDateString(P.locale, { year: 'numeric', month: 'short', day: '2-digit' });
  const ctx = { M, S, P, W, H, fecha, total: indice.length, numVista: 1 };
  const codPiso = (r, f) => (PISOS[pisoDe(r, f, S)] || PISOS.porc).cod;
  const plano = (id, extra = {}) => ({
    titulo: extra.titulo,
    medir: () => { const v = vistaPlano(M, id, { tema: 'print', escala: 100 }); return { w: v.w, h: v.h }; },
    dibujar: N => vistaPlano(M, id, { tema: 'print', escala: N, tags: true, marcas: true, muebles: true, acabados: true, codPiso, fmt, ...extra.op }),
  });
  const prim = (v, escalasPropias) => ({
    titulo: v.titulo, escalas: escalasPropias,
    medir: () => { const d = dibujar(v, { escala: 100 }); return { w: d.w, h: d.h }; },
    dibujar: N => dibujar(v, { escala: N, tema: 'impresion', fmt }),
  });
  const out = [];
  indice.forEach((def, i) => {
    if (opts.solo && def.id !== opts.solo) return;
    ctx.numVista = 1;
    const h = nuevaHoja(ctx, { ...def, n: i + 1 });
    const A = h.area;
    let cuerpo = '';
    const notas = (xs, x, y, w) => {
      let yy = y, o = '';
      xs.forEach(n => partir(n, Math.floor(w / (2.0 * 0.52))).forEach((l, k) => { o += t(x, yy, 2.0, (k ? '   ' : '• ') + l); yy += 3.0; }));
      return { svg: o, h: yy - y };
    };
    if (def.id === 'portada') {
      cuerpo += t(A.x, A.y + 12, 11, S.nombre || 'Axiona Obra', 'font-weight="700"');
      cuerpo += t(A.x, A.y + 20, 4, [S.proyecto.direccion, S.proyecto.ciudad].filter(Boolean).join(' · ') || tr(P.nombre));
      cuerpo += t(A.x, A.y + 26, 3, `${tr({ es: 'Juego de planos de anteproyecto', en: 'Preliminary drawing set' })} · ${tr(P.nombre)} · ${P.norma}`, 'fill="#555"');
      const iw = A.w * 0.6, ih = A.h - 40;
      if (opts.render) cuerpo += `<image href="${opts.render}" x="${A.x}" y="${A.y + 32}" width="${iw}" height="${ih}" preserveAspectRatio="xMidYMid slice"/>` + rc(A.x, A.y + 32, iw, ih, 0.3);
      else {
        const v = vistasDePrimitivas(M)['F-frente'];
        const N = acomodar([{ ...dibujar(v, { escala: 100 }) }], { w: iw, h: ih }).N;
        const d = dibujar(v, { escala: N, tema: 'impresion', fmt });
        cuerpo += `<g transform="translate(${(A.x + (iw - d.w * 1000 / N) / 2).toFixed(2)} ${(A.y + 32 + (ih - d.h * 1000 / N) / 2).toFixed(2)}) scale(${(1000 / N).toFixed(5)})">${d.cuerpo}</g>`;
      }
      const xi = A.x + iw + 8, wi = A.w - iw - 8;
      const ti = tabla(xi, A.y + 32, [{ t: tr({ es: 'Lámina', en: 'Sheet' }), w: wi * 0.22 }, { t: tr({ es: 'Contenido', en: 'Title' }), w: wi * 0.78 }], indice.map(d => [d.cod, d.titulo]), { s: Math.min(2.2, wi / 42), titulo: tr({ es: 'ÍNDICE DE LÁMINAS', en: 'SHEET INDEX' }) });
      cuerpo += ti.svg;
      const ar = cuadroAreas(M);
      const ta = tabla(xi, A.y + 40 + ti.h, [{ t: tr({ es: 'Dato', en: 'Item' }), w: wi * 0.6 }, { t: '', w: wi * 0.4, al: 'end' }], [
        [tr({ es: 'Área del lote', en: 'Lot area' }), fmtA(ar.lote)], [tr({ es: 'Área construida', en: 'Gross floor area' }), fmtA(ar.construida)],
        [tr({ es: 'Pisos', en: 'Storeys' }), String(M.F)], [tr({ es: 'Índice de ocupación', en: 'Lot coverage' }), fm(ar.io * 100, 1) + ' %'],
        [tr({ es: 'Índice de construcción', en: 'Floor area ratio' }), fm(ar.ic, 2)], [tr({ es: 'Sistema constructivo', en: 'Structural system' }), tr({ porticos: { es: 'Pórticos de concreto', en: 'Concrete frame' }, confinada: { es: 'Mampostería confinada', en: 'Confined masonry' }, hormigon: { es: 'Hormigón y ladrillo', en: 'Concrete and brick' }, madera: { es: 'Entramado de madera', en: 'Wood frame' } }[M.sistema])],
      ], { s: Math.min(2.2, wi / 42), titulo: tr({ es: 'DATOS DEL PROYECTO', en: 'PROJECT DATA' }) });
      cuerpo += ta.svg;
      const nn = notas([tr({ es: 'Normas de referencia:', en: 'Reference codes:' }), ...NORMAS[S.pais].map(n => n[0])], xi, A.y + 48 + ti.h + ta.h, wi);
      cuerpo += nn.svg;
      h.escalaTxt = tr({ es: 'sin escala', en: 'NTS' });
    } else if (def.id === 'sitio') {
      const b = bloqueVistas(ctx, { ...A, w: A.w * 0.68 }, [plano('sitio', { titulo: tr({ es: 'Localización e implantación', en: 'Site plan' }) })]);
      cuerpo += b.svg; h.escalaTxt = textoEscala(b.N);
      const ar = cuadroAreas(M), xi = A.x + A.w * 0.7, wi = A.w * 0.3;
      const ta = tabla(xi, A.y, [{ t: tr({ es: 'Concepto', en: 'Item' }), w: wi * 0.6 }, { t: tr({ es: 'Valor', en: 'Value' }), w: wi * 0.4, al: 'end' }], [
        [tr({ es: 'Área del lote', en: 'Lot area' }), fmtA(ar.lote)], [tr({ es: 'Huella', en: 'Footprint' }), fmtA(ar.huella)],
        ...ar.pisos.map(p => [tr({ es: `Piso ${p.piso}`, en: `Floor ${p.piso}` }), fmtA(p.area)]),
        ...(ar.sotano ? [[tr({ es: 'Sótano', en: 'Basement' }), fmtA(ar.sotano)]] : []),
        [tr({ es: 'Total construido', en: 'Total built' }), fmtA(ar.construida)], [tr({ es: 'Área libre', en: 'Open area' }), fmtA(ar.libre)],
        [tr({ es: 'Índice de ocupación', en: 'Lot coverage' }), fm(ar.io * 100, 1) + ' %'], [tr({ es: 'Índice de construcción', en: 'Floor area ratio' }), fm(ar.ic, 2)],
        [tr({ es: 'Retiro frontal', en: 'Front setback' }), fmtL(S.ret.front)], [tr({ es: 'Retiro posterior', en: 'Rear setback' }), fmtL(S.ret.back)], [tr({ es: 'Retiro lateral', en: 'Side setback' }), fmtL(S.ret.lat)],
      ], { titulo: tr({ es: 'CUADRO DE ÁREAS', en: 'AREA SCHEDULE' }) });
      cuerpo += ta.svg;
      cuerpo += notas(notasGenerales(M, S), xi, A.y + ta.h + 10, wi).svg;
    } else if (/^p\d+$/.test(def.id)) {
      const b = bloqueVistas(ctx, A, [plano(def.id, { titulo: def.titulo })]);
      cuerpo += b.svg; h.escalaTxt = textoEscala(b.N);
    } else if (def.id === 'cub') {
      const b = bloqueVistas(ctx, { ...A, w: A.w * 0.72 }, [prim(vistasDePrimitivas(M).cub)]);
      cuerpo += b.svg; h.escalaTxt = textoEscala(b.N);
      const T0 = M.techo;
      cuerpo += notas([
        tr({ es: `Cubierta: ${T0.tipo === 'plana' ? 'plana con antepecho de 0,90 m e impermeabilización' : `${T0.tipo === 'dos' ? 'a dos aguas' : 'a cuatro aguas'}, pendiente ${T0.pend} %, alero ${fm(T0.alero, 2)} m`}.`, en: `Roof: ${T0.tipo === 'plana' ? 'flat with 0.90 m parapet and waterproofing' : `${T0.tipo === 'dos' ? 'gable' : 'hip'}, ${T0.pend} % slope, ${fm(T0.alero, 2)} m overhang`}.` }),
        tr({ es: `Área de cubierta: ${fmtA(T0.area)}. Canales: ${fmtL(T0.canal)}. Bajantes: ${T0.bajantes.length}.`, en: `Roof area: ${fmtA(T0.area)}. Gutters: ${fmtL(T0.canal)}. Downspouts: ${T0.bajantes.length}.` }),
      ], A.x + A.w * 0.74, A.y + 6, A.w * 0.26).svg;
    } else if (def.id === 'fachadas') {
      const pv = vistasDePrimitivas(M);
      const b = bloqueVistas(ctx, A, ['F-frente', 'F-derecha', 'F-fondo', 'F-izquierda'].map(k => prim(pv[k])));
      cuerpo += b.svg; h.escalaTxt = textoEscala(b.N);
    } else if (def.id === 'cortes') {
      const pv = vistasDePrimitivas(M);
      const b = bloqueVistas(ctx, A, [prim(pv['C-A']), prim(pv['C-B'])]);
      cuerpo += b.svg; h.escalaTxt = textoEscala(b.N);
    } else if (def.id === 'cim') {
      const b = bloqueVistas(ctx, { ...A, w: A.w * 0.66 }, [plano('cim', { titulo: def.titulo })]);
      cuerpo += b.svg; h.escalaTxt = textoEscala(b.N);
      const xi = A.x + A.w * 0.68, wi = A.w * 0.32;
      let y = A.y;
      if (M.cols.length && M.sistema !== 'madera') {
        const tp = M.types.map((Bz, i) => { const cs = M.cols.filter(c => c.B === Bz); return ['Z' + (i + 1), `${fmtL(Bz)} × ${fmtL(Bz)}`, fmtL(cs[0].h), String(cs.length)]; });
        const tz = tabla(xi, y, [{ t: tr({ es: 'Tipo', en: 'Type' }), w: wi * 0.18 }, { t: 'B × B', w: wi * 0.42 }, { t: 'h', w: wi * 0.2, al: 'end' }, { t: tr({ es: 'Cant.', en: 'Qty' }), w: wi * 0.2, al: 'end' }], tp, { titulo: tr({ es: 'CUADRO DE ZAPATAS', en: 'FOOTING SCHEDULE' }) });
        cuerpo += tz.svg; y += tz.h + 8;
      }
      const st = M.stake.slice(0, 18).map(s => [s.id, fmtL(s.x), fmtL(s.y), fmtL(s.d), `${s.az.toFixed(1)}°`]);
      const tz2 = tabla(xi, y, [{ t: tr({ es: 'Punto', en: 'Point' }), w: wi * 0.16 }, { t: 'x', w: wi * 0.21, al: 'end' }, { t: 'y', w: wi * 0.21, al: 'end' }, { t: tr({ es: 'Dist. P1', en: 'Dist. P1' }), w: wi * 0.21, al: 'end' }, { t: 'Az', w: wi * 0.21, al: 'end' }], st, { titulo: tr({ es: 'REPLANTEO DESDE P1', en: 'SETTING OUT FROM P1' }) });
      cuerpo += tz2.svg; y += tz2.h + 8;
      cuerpo += notas(notasEstructura(M, S), xi, y, wi).svg;
    } else if (/^[eh]\d+$/.test(def.id)) {
      const b = bloqueVistas(ctx, { ...A, w: A.w * 0.74 }, [plano(def.id, { titulo: def.titulo, op: { muebles: def.id[0] === 'h' } })]);
      cuerpo += b.svg; h.escalaTxt = textoEscala(b.N);
      cuerpo += leyenda(def.id[0] === 'e' ? 'elec' : 'hidro', M, A.x + A.w * 0.76, A.y, A.w * 0.24);
    } else if (def.id === 'cuadros') {
      const s0 = Math.min(2.1, A.w / 140);
      const filasAb = ab.map(a => [a.cod, a.kind === 'main' ? tr({ es: 'Puerta principal', en: 'Entry door' }) : a.clase === 'P' ? tr({ es: 'Puerta', en: 'Door' }) : tr({ es: 'Ventana', en: 'Window' }), `${fmtL(a.w)} × ${fmtL(a.h)}`, a.clase === 'V' ? fmtL(a.sill) : '—', String(a.n), a.pisos, a.mat]);
      const w1 = A.w * 0.52;
      const ta = tabla(A.x, A.y, [{ t: tr({ es: 'Cód.', en: 'Code' }), w: w1 * 0.08 }, { t: tr({ es: 'Tipo', en: 'Type' }), w: w1 * 0.17 }, { t: tr({ es: 'Ancho × alto', en: 'W × H' }), w: w1 * 0.17 }, { t: tr({ es: 'Antepecho', en: 'Sill' }), w: w1 * 0.1, al: 'end' }, { t: tr({ es: 'Cant.', en: 'Qty' }), w: w1 * 0.07, al: 'end' }, { t: tr({ es: 'Pisos', en: 'Floors' }), w: w1 * 0.08 }, { t: tr({ es: 'Material', en: 'Material' }), w: w1 * 0.33 }], filasAb, { s: s0, titulo: tr({ es: 'CUADRO DE PUERTAS Y VENTANAS', en: 'DOOR AND WINDOW SCHEDULE' }) });
      cuerpo += ta.svg;
      // alzados de cada tipo a 1:50
      let xx = A.x, yy = A.y + ta.h + 12;
      const k = 1000 / 50;
      ab.forEach(a => {
        const ww = a.w * k, hh = a.h * k;
        if (xx + ww + 10 > A.x + w1) { xx = A.x; yy += 2.6 * k + 14; }
        const y0 = yy + 2.4 * k - hh - (a.clase === 'V' ? a.sill * k * 0.35 : 0);
        cuerpo += rc(xx, y0, ww, hh, 0.35, a.clase === 'V' ? '#e4f0f6' : '#f7f3ee');
        if (a.clase === 'V' && a.w > 1.1) cuerpo += ln(xx + ww / 2, y0, xx + ww / 2, y0 + hh, 0.2);
        else if (a.clase === 'P') cuerpo += `<circle cx="${(xx + ww - 2.4).toFixed(2)}" cy="${(y0 + hh * 0.52).toFixed(2)}" r="0.7" fill="#111"/>`;
        cuerpo += t(xx + ww / 2, yy + 2.4 * k + 5, 2.2, a.cod, 'text-anchor="middle" font-weight="700"');
        xx += ww + 12;
      });
      const fa = cuadroAcabados(M, S).map(f => [String(f.piso), f.nombre, fmtA(f.area), f.codPiso, f.pisoN, f.muro, f.cielo]);
      const x2 = A.x + w1 + 8, w2 = A.w - w1 - 8;
      cuerpo += tabla(x2, A.y, [{ t: tr({ es: 'Piso', en: 'Lvl' }), w: w2 * 0.06 }, { t: tr({ es: 'Espacio', en: 'Room' }), w: w2 * 0.2 }, { t: tr({ es: 'Área', en: 'Area' }), w: w2 * 0.1, al: 'end' }, { t: tr({ es: 'Cód.', en: 'Code' }), w: w2 * 0.07 }, { t: tr({ es: 'Piso', en: 'Floor' }), w: w2 * 0.21 }, { t: tr({ es: 'Muros', en: 'Walls' }), w: w2 * 0.2 }, { t: tr({ es: 'Cielo', en: 'Ceiling' }), w: w2 * 0.16 }], fa, { s: Math.min(1.9, w2 / 120), titulo: tr({ es: 'CUADRO DE ACABADOS', en: 'ROOM FINISH SCHEDULE' }) }).svg;
      h.escalaTxt = tr({ es: 'alzados 1:50', en: 'elevations 1:50' });
    } else if (def.id === 'detalles') {
      const ds = detalles(M);
      const b = bloqueVistas(ctx, A, ds.map(d => prim(d, imperial() ? [12, 24] : [20, 25, 50])));
      cuerpo += b.svg; h.escalaTxt = textoEscala(b.N);
    } else if (def.id === 'presupuesto') {
      cuerpo += resumenPresupuesto(M, S, A);
      h.escalaTxt = tr({ es: 'sin escala', en: 'NTS' });
    }
    out.push(cerrarHoja(ctx, h, cuerpo));
  });
  return out;
}

function notasGenerales(M, S) {
  const unid = imperial() ? tr({ es: 'Cotas en pies y pulgadas.', en: 'Dimensions in feet and inches.' }) : tr({ es: 'Cotas y niveles en metros.', en: 'Dimensions and levels in metres.' });
  const comun = [
    unid,
    tr({ es: 'Verificar todas las medidas en obra antes de construir.', en: 'Verify all dimensions on site before construction.' }),
    tr({ es: `N±0.00 = cota ${M.dl.toFixed(2)} del levantamiento.`, en: `±0.00 = survey elevation ${M.dl.toFixed(2)}.` }),
  ];
  if (S.pais === 'ES') return [...comun, tr({ es: 'Proyecto según el Código Técnico de la Edificación (CTE) y el Código Estructural.', en: 'Designed to the CTE and the Structural Code.' }), tr({ es: 'Acero B 500 S. Hormigón HA-25.', en: 'Rebar B 500 S. Concrete HA-25.' })];
  if (S.pais === 'CA') return [...comun, tr({ es: 'Diseño según la Parte 9 del código vigente en la provincia.', en: 'Design to Part 9 of the building code in force in the province.' }), tr({ es: 'Madera S-P-F No. 2 o mejor; concreto 25 MPa en cimentación.', en: 'S-P-F No. 2 or better; 25 MPa foundation concrete.' })];
  return [...comun, tr({ es: 'Diseño según la NSR-10. Concreto 21 MPa (3000 psi), acero fy 420 MPa.', en: 'Design to NSR-10. Concrete 21 MPa, rebar fy 420 MPa.' })];
}

function notasEstructura(M, S) {
  const q = S.pais === 'CA' ? `${(M.q * 9.81).toFixed(0)} kPa` : S.pais === 'ES' ? `${(M.q * 9.81).toFixed(0)} kN/m²` : `${M.q} t/m²`;
  const base = [
    tr({ es: `Capacidad portante supuesta: ${q}. Desplante ${M.desp.toFixed(2)} m.`, en: `Assumed bearing capacity: ${q}. Footing depth ${M.desp.toFixed(2)} m.` }),
    tr({ es: 'Predimensionamiento con cargas supuestas de 1,0 t/m² por nivel: no reemplaza el diseño estructural firmado.', en: 'Pre-sizing with assumed loads of 1.0 t/m² per level: not a substitute for the sealed structural design.' }),
  ];
  if (S.pais === 'CO') base.push(tr({ es: 'El estudio de suelos (NSR-10 Título H) define la cimentación definitiva.', en: 'The geotechnical study (NSR-10 Title H) governs the final foundation.' }));
  if (S.pais === 'CA') base.push(tr({ es: `Zapatas por debajo de la profundidad de helada${S.helada ? ` (${S.helada} m)` : ''}.`, en: `Footings below frost depth${S.helada ? ` (${S.helada} m)` : ''}.` }));
  return base;
}

function leyenda(capa, M, x, y, w) {
  const items = capa === 'elec'
    ? [['luz', tr({ es: 'Salida de luz en techo', en: 'Ceiling light' })], ['int', tr({ es: 'Interruptor', en: 'Switch' })], ['toma', tr({ es: 'Tomacorriente doble', en: 'Duplex receptacle' })], ['tomaGFCI', tr({ es: 'Toma con protección de falla a tierra', en: 'GFCI receptacle' })], ['especial', tr({ es: 'Salida especial (aparatos)', en: 'Dedicated outlet' })], ['tablero', tr({ es: 'Tablero de circuitos', en: 'Electrical panel' })], ['humo', tr({ es: 'Detector de humo', en: 'Smoke alarm' })]]
    : [['fria', tr({ es: 'Agua fría', en: 'Cold water' })], ['caliente', tr({ es: 'Agua caliente', en: 'Hot water' })], ['desague', tr({ es: 'Desagüe sanitario', en: 'Sanitary drain' })], ['lluvia', tr({ es: 'Aguas lluvias', en: 'Storm water' })], ['bajante', tr({ es: 'Bajante', en: 'Stack' })], ['medidor', tr({ es: 'Medidor / acometida', en: 'Water meter' })], ['caja', tr({ es: 'Caja de inspección', en: 'Cleanout / inspection box' })]];
  const C = { fria: '#1565c0', caliente: '#c62828', desague: '#5d4037', lluvia: '#00838f' };
  let o = t(x, y + 3, 2.6, tr({ es: 'CONVENCIONES', en: 'LEGEND' }), 'font-weight="700"'), yy = y + 9;
  items.forEach(([k, txt]) => {
    if (C[k]) o += `<line x1="${x}" y1="${yy - 0.8}" x2="${x + 8}" y2="${yy - 0.8}" stroke="${C[k]}" stroke-width="${k === 'desague' ? 0.5 : 0.3}" ${k === 'caliente' ? 'stroke-dasharray="1.2 0.6"' : k === 'desague' ? 'stroke-dasharray="2.5 0.7 0.4 0.7"' : k === 'lluvia' ? 'stroke-dasharray="0.5 0.7"' : ''}/>`;
    else o += `<circle cx="${x + 4}" cy="${yy - 0.8}" r="1.4" fill="none" stroke="#111" stroke-width="0.25"/>${k === 'luz' ? `<path d="M${x + 3} ${yy - 1.8}L${x + 5} ${yy + 0.2}M${x + 3} ${yy + 0.2}L${x + 5} ${yy - 1.8}" stroke="#111" stroke-width="0.25"/>` : `<text x="${x + 4}" y="${yy - 0.1}" font-size="1.4" ${F} text-anchor="middle">${{ int: 'S', toma: '||', tomaGFCI: 'G', especial: '▲', tablero: 'T', humo: 'H', bajante: 'B', medidor: 'M', caja: 'C' }[k] || ''}</text>`}`;
    o += t(x + 11, yy, 2.1, cabe(txt, w - 12, 2.1));
    yy += 5;
  });
  if (capa === 'elec' && (M.domotica || []).length) {
    yy += 3; o += t(x, yy, 2.4, tr({ es: 'TECNOLOGÍA Y DOMÓTICA', en: 'SMART HOME' }), 'font-weight="700"'); yy += 5;
    M.domotica.forEach(d => { o += `<rect x="${x}" y="${yy - 2.6}" width="7" height="3.6" fill="none" stroke="#6a1b9a" stroke-width="0.25"/>` + t(x + 3.5, yy - 0.1, 1.7, d.sim, 'text-anchor="middle" fill="#6a1b9a" font-weight="700"') + t(x + 11, yy, 2.0, cabe(`${tr(d.nombre)} (${d.n})`, w - 12, 2.0)); yy += 5; });
  }
  if (capa === 'elec') { yy += 3; o += t(x, yy, 2.1, `${tr({ es: 'Puntos', en: 'Points' })}: ${M.redes.puntos.elec}`, 'font-weight="700"'); }
  else { yy += 3; o += t(x, yy, 2.1, `${tr({ es: 'Aparatos', en: 'Fixtures' })}: ${M.redes.puntos.aparatos}`, 'font-weight="700"'); }
  yy += 6;
  o += t(x, yy, 1.8, cabe(tr({ es: 'Esquema para anteproyecto: lo diseña y firma el ingeniero de redes.', en: 'Schematic for preliminary design: to be designed and sealed by the MEP engineer.' }), w, 1.8), 'fill="#555"');
  return o;
}

function resumenPresupuesto(M, S, A) {
  const Tt = totales(M, S.prices, S.pais);
  const filas = [];
  CATS.forEach(c => {
    const its = M.quant.items.filter(i => i.cat === c);
    if (!its.length) return;
    filas.push({ sep: nombreCategoria(S.pais, c) });
    const caps = {};
    its.forEach(i => { caps[i.cap] = (caps[i.cap] || 0) + i.q * precioDe(i, S.prices); });
    Object.entries(caps).forEach(([cap, v]) => filas.push([cap, money(v), `${fm(v / Tt.directo * 100, 1)} %`]));
  });
  filas.push({ ...[tr({ es: 'Costo directo', en: 'Direct cost' }), money(Tt.directo), '100 %'], b: true });
  Tt.lineas.forEach(l => filas.push([`${l.n} (${fm(l.pct * 100, 1)} %)`, money(l.v), '']));
  filas.push({ ...[tr({ es: 'TOTAL', en: 'TOTAL' }), money(Tt.total), ''], b: true });
  const w1 = A.w * 0.5;
  let o = tabla(A.x, A.y, [{ t: tr({ es: 'Capítulo', en: 'Chapter' }), w: w1 * 0.6 }, { t: tr({ es: 'Valor', en: 'Amount' }), w: w1 * 0.28, al: 'end' }, { t: '%', w: w1 * 0.12, al: 'end' }], filas, { titulo: tr({ es: 'RESUMEN DE PRESUPUESTO', en: 'COST SUMMARY' }) }).svg;
  // cronograma
  const G = M.gantt, x2 = A.x + w1 + 10, w2 = A.w - w1 - 10, bw = w2 * 0.6;
  o += t(x2, A.y + 3, 2.6, tr({ es: `CRONOGRAMA · ${G.total} días hábiles`, en: `SCHEDULE · ${G.total} working days` }), 'font-weight="700"');
  G.tasks.forEach((tk, i) => {
    const y = A.y + 9 + i * 5.2;
    o += t(x2, y + 2.6, 1.9, cabe(tk.name, w2 - bw - 4, 1.9));
    o += rc(x2 + w2 - bw, y, bw, 3.4, 0.1, '#f3f3f3', '#ddd');
    o += rc(x2 + w2 - bw + tk.s / G.total * bw, y, Math.max(0.8, tk.d / G.total * bw), 3.4, 0, { negra: '#b26a00', gris: '#888', blanca: '#0b5c78', inst: '#6a1b9a', dot: '#1b7a43' }[tk.cat] || '#555', 'none');
  });
  o += t(A.x, A.y + A.h - 4, 2.0, tr({ es: 'Precios de referencia: reemplazar por cotizaciones del constructor antes de contratar.', en: 'Reference prices: replace with contractor quotes before contracting.' }), 'fill="#555"');
  return o;
}

/* ---------------------------------------------------------------- exportar */

/** PDF con todas las laminas (vectorial). */
export async function laminasAPDF(laminas, meta = {}) {
  const [{ jsPDF }, { svg2pdf }] = await Promise.all([import('jspdf'), import('svg2pdf.js')]);
  const l0 = laminas[0];
  const doc = new jsPDF({ orientation: l0.w >= l0.h ? 'landscape' : 'portrait', unit: 'mm', format: [l0.w, l0.h], compress: true });
  const caja = document.createElement('div');
  caja.style.cssText = 'position:fixed;left:-99999px;top:0;width:10px;height:10px;overflow:hidden';
  document.body.appendChild(caja);
  try {
    for (let i = 0; i < laminas.length; i++) {
      const l = laminas[i];
      if (i) doc.addPage([l.w, l.h], l.w >= l.h ? 'landscape' : 'portrait');
      caja.innerHTML = l.svg;
      const el = caja.firstElementChild;
      await svg2pdf(el, doc, { x: 0, y: 0, width: l.w, height: l.h });
      meta.progreso?.(i + 1, laminas.length);
    }
  } finally { caja.remove(); }
  doc.setProperties({ title: meta.titulo || 'Axiona Obra', author: meta.autor || 'Axiona Obra', creator: 'Axiona Obra · obra.axionasoft.com', subject: meta.asunto || '' });
  return doc.output('blob');
}
