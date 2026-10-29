/* ==========================================================================
   AXIONA OBRA · Lector de documentos del proyecto
   --------------------------------------------------------------------------
   Del texto de un PDF (estudio de suelos, norma urbanistica, escrituras,
   memoria, planos) y de un DXF saca los datos que llenan las casillas:
   medidas y area del lote, linderos, pisos, alcobas y baños, capacidad
   portante, desplante, nivel freatico, sismo, nieve, helada, retiros,
   indices, direccion, propietario, predio y profesionales. Cada dato trae
   el fragmento de donde salio para que una persona lo lea y lo apruebe
   antes de aplicarlo. Funciona en español, ingles y frances.
   ========================================================================== */

import { r2 } from './geometria.js';

const NUM = '(-?\\d{1,3}(?:[.\\s]\\d{3})*(?:[.,]\\d+)?|-?\\d+(?:[.,]\\d+)?)';

/** Numero escrito en es/en: 1.234,56 · 1,234.56 · 12,5 · 12.5 */
export function numero(s, ingles = false) {
  let t = String(s).replace(/\s/g, '');
  const p = t.lastIndexOf('.'), c = t.lastIndexOf(',');
  if (p >= 0 && c >= 0) t = p > c ? t.replace(/,/g, '') : t.replace(/\./g, '').replace(',', '.');
  else if (c >= 0) { const dec = t.length - c - 1; t = dec === 3 && ingles ? t.replace(/,/g, '') : t.replace(/\./g, '').replace(',', '.'); }
  else if (p >= 0) { const dec = t.length - p - 1; const partes = t.split('.'); if (partes.length > 2 || (dec === 3 && !ingles && partes[0].length <= 3 && +partes[0] > 0)) t = t.replace(/\./g, ''); }
  const v = parseFloat(t);
  return Number.isFinite(v) ? v : null;
}

const LARGO = { m: 1, mts: 1, metros: 1, metro: 1, ml: 1, mm: 0.001, cm: 0.01, ft: 0.3048, feet: 0.3048, pies: 0.3048, pie: 0.3048, "'": 0.3048, '’': 0.3048, in: 0.0254, pulgadas: 0.0254 };
const AREA = { 'm²': 1, m2: 1, mts2: 1, 'metros cuadrados': 1, ha: 10000, 'hectáreas': 10000, hectareas: 10000, 'ft²': 0.092903, ft2: 0.092903, 'sq ft': 0.092903, 'sq. ft.': 0.092903, sf: 0.092903, 'pies cuadrados': 0.092903, acres: 4046.86, acre: 4046.86 };
const PRESION = { 't/m²': 1, 't/m2': 1, 'ton/m²': 1, 'ton/m2': 1, 'kn/m²': 1 / 9.80665, 'kn/m2': 1 / 9.80665, kpa: 1 / 9.80665, 'kg/cm²': 10, 'kg/cm2': 10, psf: 0.0048824, mpa: 101.97 };
const uLargo = '(m(?:ts)?\\b|metros?\\b|ml\\b|mm\\b|cm\\b|ft\\b|feet\\b|pies?\\b|in\\b|pulgadas\\b|[\'’])';
const uArea = '(m²|m2|mts2|metros cuadrados|ha\\b|hect[aá]reas|ft²|ft2|sq\\.? ?ft\\.?|sf\\b|pies cuadrados|acres?)';
const uPres = '(t\\/m²|t\\/m2|ton\\/m²|ton\\/m2|kn\\/m²|kn\\/m2|kpa|kg\\/cm²|kg\\/cm2|psf|mpa)';

function fragmento(txt, i, n = 70) {
  return txt.slice(Math.max(0, i - n / 2), Math.min(txt.length, i + n)).replace(/\s+/g, ' ').trim();
}

/** Busca la primera cifra con unidad despues de una etiqueta. */
function tras(txt, etiqueta, unidad, tabla, ingles, max = 60) {
  const re = new RegExp(`(?:${etiqueta})[^\\n\\d-]{0,${max}}${NUM}\\s*${unidad}`, 'giu');
  const out = [];
  for (const m of txt.matchAll(re)) {
    const v = numero(m[m.length - 2], ingles), u = m[m.length - 1].toLowerCase().replace(/\s+/g, ' ');
    const f = tabla[u] ?? tabla[u.replace(/\./g, '')] ?? null;
    if (v === null || f === null) continue;
    out.push({ v: v * f, crudo: `${m[m.length - 2]} ${m[m.length - 1]}`, i: m.index });
  }
  return out;
}

const PALABRAS = {
  CO: /NSR-10|curadur[ií]a|ley 400|\bPOT\b|medell[ií]n|bogot[aá]|antioquia|matr[ií]cula inmobiliaria|COPNIA|estrato|sabaneta|envigado|colombia/gi,
  ES: /\bCTE\b|ayuntamiento|c[oó]digo t[eé]cnico|visado|colegiad|NCSE|referencia catastral|PGOU|\bLOE\b|espa[ñn]a|comunidad de madrid|\bDB[ -]SE/gi,
  CA: /\bNBC\b|ontario|building code|by-?law|\bBCIN\b|part 9|toronto|vancouver|calgary|qu[eé]bec|canada|municipality|building permit/gi,
};

/**
 * Lee un texto y devuelve los datos encontrados.
 * @returns {{pais, datos:[{k, v, txt, frag, conf}]}}
 */
export function leerTexto(texto) {
  const txt = String(texto || '').replace(/ /g, ' ').replace(/[ \t]+/g, ' ');
  const puntos = Object.fromEntries(Object.entries(PALABRAS).map(([k, re]) => [k, (txt.match(re) || []).length]));
  const pais = Object.entries(puntos).sort((a, b) => b[1] - a[1])[0];
  const pid = pais[1] >= 2 ? pais[0] : null;
  const ingles = pid === 'CA' || (/\b(the|and|of|lot|floor)\b/gi.test(txt) && !/\b(el|la|de|del|los)\b/gi.test(txt.slice(0, 2000)));
  const datos = [];
  const add = (k, v, crudo, i, conf = 0.8) => { if (v === null || v === undefined || Number.isNaN(v)) return; if (!datos.some(d => d.k === k)) datos.push({ k, v, txt: crudo, frag: fragmento(txt, i), conf }); };
  const primero = (k, lista, conf, valida = () => true) => { const m = lista.find(x => valida(x.v)); if (m) add(k, r2(m.v * 100) / 100 === m.v ? m.v : +m.v.toFixed(3), m.crudo, m.i, conf); };

  // lote
  primero('areaLote', tras(txt, '(?:[aá]rea|superficie)\\s+(?:del\\s+|de\\s+la\\s+)?(?:lote|predio|terreno|solar|parcela)|lot area|site area|lot size|superficie du terrain', uArea, AREA, ingles), 0.85, v => v > 20 && v < 1e6);
  primero('frente', tras(txt, '\\bfrente\\b|frontage|lot width|ancho del (?:lote|predio)|fachada a la v[ií]a', uLargo, LARGO, ingles), 0.8, v => v > 3 && v < 500);
  primero('fondo', tras(txt, '\\bfondo\\b|profundidad del (?:lote|predio)|lot depth|depth of (?:the )?lot|profondeur', uLargo, LARGO, ingles), 0.8, v => v > 3 && v < 1000);
  // linderos: norte/sur/oriente/occidente
  const lind = {};
  for (const m of txt.matchAll(new RegExp(`\\b(norte|sur|oriente|occidente|este|oeste|north|south|east|west)\\b[^\\n\\d]{0,50}?${NUM}\\s*${uLargo}`, 'giu'))) {
    const lado = m[1].toLowerCase(), v = numero(m[2], ingles), f = LARGO[m[3].toLowerCase()];
    const k = { norte: 'N', north: 'N', sur: 'S', south: 'S', oriente: 'E', este: 'E', east: 'E', occidente: 'W', oeste: 'W', west: 'W' }[lado];
    if (v && f && !lind[k] && v * f > 2 && v * f < 1000) lind[k] = { v: v * f, i: m.index, crudo: m[0].slice(0, 60) };
  }
  if (lind.N && lind.S && lind.E && lind.W && !datos.some(d => d.k === 'frente')) {
    add('frente', r2((lind.N.v + lind.S.v) / 2), `${tr2(lind.N.v)} / ${tr2(lind.S.v)}`, lind.N.i, 0.7);
    add('fondo', r2((lind.E.v + lind.W.v) / 2), `${tr2(lind.E.v)} / ${tr2(lind.W.v)}`, lind.E.i, 0.7);
  }
  // edificacion
  primero('areaConstruida', tras(txt, '(?:[aá]rea|superficie)\\s+construida|gross floor area|\\bGFA\\b|built area|floor area|surface de plancher', uArea, AREA, ingles), 0.75, v => v > 20);
  for (const m of txt.matchAll(/(\d{1,2})\s*(pisos|niveles|plantas|storeys|stories|floors|[ée]tages)\b/gi)) { const v = +m[1]; if (v >= 1 && v <= 12) { add('pisos', v, m[0], m.index, 0.75); break; } }
  for (const m of txt.matchAll(/(?:n[uú]mero de pisos|pisos|storeys|stories|floors)\s*[:=]\s*(\d{1,2})/gi)) { add('pisos', +m[1], m[0], m.index, 0.85); break; }
  for (const m of txt.matchAll(/(\d{1,2})\s*(alcobas|habitaciones|dormitorios|rec[aá]maras|bedrooms?|chambres)/gi)) { add('alcobas', +m[1], m[0], m.index, 0.75); break; }
  for (const m of txt.matchAll(/(\d{1,2}(?:[.,]5)?)\s*(ba[ñn]os|bathrooms?|baths|salles de bain)/gi)) { add('banos', numero(m[1]), m[0], m.index, 0.75); break; }
  // suelos
  primero('qadm', tras(txt, 'capacidad\\s+portante|capacidad\\s+(?:de\\s+carga\\s+)?admisible|q\\s*adm|qadm|presi[oó]n\\s+admisible|tensi[oó]n\\s+admisible|bearing capacity|allowable bearing(?: pressure)?|allowable soil pressure|capacit[ée] portante', uPres, PRESION, ingles, 80), 0.85, v => v > 2 && v < 200);
  primero('desp', tras(txt, 'profundidad\\s+de\\s+(?:desplante|cimentaci[oó]n|fundaci[oó]n)|nivel\\s+de\\s+(?:desplante|cimentaci[oó]n)|cota\\s+de\\s+cimentaci[oó]n|footing depth|depth of (?:footings?|foundations?)|founding depth', uLargo, LARGO, ingles, 80), 0.8, v => v > 0.3 && v < 8);
  primero('freatico', tras(txt, 'nivel\\s+fre[aá]tico|fre[aá]tico|water table|groundwater(?: level)?|nappe', uLargo, LARGO, ingles, 80), 0.7, v => v > 0 && v < 50);
  for (const m of txt.matchAll(/perfil\s+(?:de\s+suelo\s+)?(?:tipo\s+)?([A-F])\b|site class\s+([A-F])\b/gi)) { add('perfil', (m[1] || m[2]).toUpperCase(), m[0], m.index, 0.8); break; }
  // sismo y clima
  for (const m of txt.matchAll(new RegExp(`\\bAa\\s*[=:]\\s*${NUM}`, 'g'))) { const v = numero(m[1]); if (v > 0 && v < 1) { add('aa', v, m[0], m.index, 0.9); break; } }
  for (const m of txt.matchAll(new RegExp(`\\bAv\\s*[=:]\\s*${NUM}`, 'g'))) { const v = numero(m[1]); if (v > 0 && v < 1) { add('av', v, m[0], m.index, 0.9); break; } }
  for (const m of txt.matchAll(new RegExp(`(?:\\bab\\b|aceleraci[oó]n s[ií]smica b[aá]sica)[^\\d]{0,25}${NUM}\\s*g\\b`, 'gi'))) { const v = numero(m[1]); if (v > 0 && v < 1) { add('ab', v, m[0], m.index, 0.85); break; } }
  for (const m of txt.matchAll(new RegExp(`(?:\\bSs\\b|ground snow load|carga de nieve)[^\\d]{0,20}${NUM}\\s*kPa`, 'gi'))) { const v = numero(m[1], true); if (v > 0 && v < 15) { add('nieve', v, m[0], m.index, 0.85); break; } }
  for (const m of txt.matchAll(new RegExp(`Sa\\s*\\(0[.,]2\\)\\s*[=:]\\s*${NUM}`, 'gi'))) { add('sa', numero(m[1], true), m[0], m.index, 0.85); break; }
  primero('helada', tras(txt, 'frost depth|frost penetration|profundidad\\s+de\\s+(?:helada|congelamiento)|profondeur de gel', uLargo, LARGO, ingles), 0.8, v => v > 0.3 && v < 4);
  for (const m of txt.matchAll(/zona\s+clim[aá]tica\s*[:=]?\s*([A-E]\s?[1-4])\b/gi)) { add('zona', m[1].replace(/\s/g, '').toUpperCase(), m[0], m.index, 0.85); break; }
  // norma urbanistica
  primero('retFrente', tras(txt, 'retiro\\s+(?:frontal|anterior|delantero|a la v[ií]a)|antejard[ií]n|retranqueo\\s+(?:a\\s+(?:la\\s+)?)?(?:fachada|alineaci[oó]n|v[ií]a)|front (?:yard|setback)|marge avant', uLargo, LARGO, ingles), 0.8, v => v >= 0 && v < 30);
  primero('retFondo', tras(txt, 'retiro\\s+(?:posterior|de fondo|trasero)|retranqueo\\s+(?:posterior|a fondo)|rear (?:yard|setback)|marge arri[eè]re', uLargo, LARGO, ingles), 0.8, v => v >= 0 && v < 30);
  primero('retLado', tras(txt, 'retiro\\s+lateral|retranqueo\\s+(?:lateral|a linderos)|side (?:yard|setback)|interior side yard|marge lat[ée]rale', uLargo, LARGO, ingles), 0.8, v => v >= 0 && v < 20);
  for (const m of txt.matchAll(new RegExp(`(?:[ií]ndice de ocupaci[oó]n|\\bI\\.?O\\.?\\b|lot coverage|coeficiente de ocupaci[oó]n|ocupaci[oó]n m[aá]xima)[^\\d]{0,25}${NUM}\\s*(%)?`, 'gi'))) {
    let v = numero(m[1], ingles); if (m[2] || v > 1) v /= 100;
    if (v > 0.05 && v <= 1) { add('occ', +v.toFixed(3), m[0], m.index, 0.8); break; }
  }
  for (const m of txt.matchAll(new RegExp(`(?:[ií]ndice de construcci[oó]n|\\bI\\.?C\\.?\\b|floor area ratio|\\bFAR\\b|\\bFSI\\b|edificabilidad)[^\\d]{0,25}${NUM}`, 'gi'))) { const v = numero(m[1], ingles); if (v > 0 && v < 20) { add('ic', v, m[0], m.index, 0.75); break; } }
  // identificacion
  const linea = (re, k, conf = 0.75, limpia = s => s) => { const m = txt.match(re); if (m) add(k, limpia(m[m.length - 1].trim()).slice(0, 80), m[0].slice(0, 80), m.index, conf); };
  linea(/(?:^|\n|\s)(?:nombre del proyecto|proyecto|project(?: name)?)\s*[:\-]\s*([^\n]{3,70})/i, 'nombre', 0.7);
  linea(/(?:direcci[oó]n|address|ubicaci[oó]n|situaci[oó]n|emplazamiento|adresse)\s*[:\-]\s*([^\n]{5,80})/i, 'direccion', 0.75);
  linea(/(?:municipio|ciudad|city|municipality|localidad|poblaci[oó]n|ville)\s*[:\-]\s*([^\n,;]{3,40})/i, 'ciudad', 0.75);
  linea(/(?:propietari[oa]|promotor|owner|cliente|solicitante|propri[ée]taire)\s*[:\-]\s*([^\n]{3,60})/i, 'propietario', 0.75);
  const pr = txt.match(/(?:matr[ií]cula\s+inmobiliaria|folio de matr[ií]cula)\s*(?:n[oº°.]*)?\s*[:\-]?\s*(\d{2,4}\s*-\s*\d{3,8})/i)
    || txt.match(/referencia\s+catastral\s*[:\-]?\s*([0-9A-Z]{14,20})/i)
    || txt.match(/(?:\bPIN\b|\bPID\b|roll number|assessment roll)\s*(?:no\.?)?\s*[:#]?\s*([\d][\d\- ]{5,22})/i);
  if (pr) add('predio', pr[1].replace(/\s+/g, ''), pr[0].slice(0, 70), pr.index, 0.85);
  // profesionales
  for (const m of txt.matchAll(/([Aa]rquitect[oa]|[Aa]rchitect|[Ii]ngenier[oa]\s+(?:civil|estructural)|[Ss]tructural [Ee]ngineer|[Dd]esigner|[Dd]ise[ñn]ador)\s*[:\-]?\s*([A-ZÁÉÍÓÚÑ][A-Za-zÁÉÍÓÚÑáéíóúñ.]+(?:\s+[A-ZÁÉÍÓÚÑ][A-Za-zÁÉÍÓÚÑáéíóúñ.]+){1,4})[^\n]{0,30}?(?:M\.?\s?P\.?|matr[ií]cula|mat\.|colegiad[oa]|BCIN|P\.?\s?Eng\.?|licen[cs]e|n[ºo°.])\s*(?:n[ºo°.]*)?\s*[:#]?\s*([A-Z0-9][A-Z0-9\-]{2,20})/g)) {
    const rol = /arquitect|architect/i.test(m[1]) ? 'arq' : /designer|dise/i.test(m[1]) ? 'des' : 'est';
    datos.push({ k: 'profesional', v: { rol, nombre: m[2].trim(), doc: m[3] }, txt: m[0].slice(0, 70), frag: fragmento(txt, m.index), conf: 0.7 });
    if (datos.filter(d => d.k === 'profesional').length >= 4) break;
  }
  // coordenadas
  const dec = txt.match(/(-?\d{1,2}\.\d{4,})\s*[,;]\s*(-?\d{1,3}\.\d{4,})/);
  if (dec && Math.abs(+dec[1]) <= 90 && Math.abs(+dec[2]) <= 180) add('coords', { lat: +dec[1], lon: +dec[2] }, dec[0], dec.index, 0.7);
  if (pid) datos.push({ k: 'pais', v: pid, txt: `${pais[1]}`, frag: '', conf: Math.min(0.95, 0.5 + pais[1] * 0.05) });
  return { pais: pid, datos, letras: txt.length };
}
const tr2 = v => (Math.round(v * 100) / 100).toString();

/** Programa tipico a partir de alcobas y baños. */
export function programaTipico(alcobas, banos, pisos, idioma = 'es') {
  const en = idioma === 'en';
  const E = (name, area, floor, zone) => ({ name, area, floor, zone });
  const altos = pisos >= 2 ? 2 : 1;
  const out = [
    E(en ? 'Living room' : 'Sala', 20 + alcobas * 2, 1, 'social'), E(en ? 'Dining room' : 'Comedor', 12, 1, 'social'),
    E(en ? 'Kitchen' : 'Cocina', 10, 1, 'servicio'), E(en ? 'Laundry' : 'Patio de ropas', 5, 1, 'servicio'),
  ];
  const nB = Math.max(1, Math.round(banos || 1));
  if (pisos >= 2 && nB >= 2) out.push(E(en ? 'Powder room' : 'Baño social', 3, 1, 'servicio'));
  for (let k = 0; k < Math.max(1, alcobas); k++) out.push(E(k ? (en ? `Bedroom ${k + 1}` : `Alcoba ${k + 1}`) : (en ? 'Primary bedroom' : 'Alcoba principal'), k ? 11 : 15, altos, 'privada'));
  const enAlcobas = pisos >= 2 && nB >= 2 ? nB - 1 : nB;
  for (let k = 0; k < enAlcobas; k++) out.push(E(k ? (en ? `Bathroom ${k + 1}` : `Baño ${k + 1}`) : (en ? 'Primary bath' : 'Baño principal'), k ? 4 : 5, altos, 'servicio'));
  return out;
}

/** DXF: poligono cerrado mas grande (el lote) y todos los textos. */
export function leerDXF(contenido) {
  const l = String(contenido).split(/\r?\n/).map(s => s.trim());
  let unidades = 6;
  const iu = l.findIndex((v, i) => v === '$INSUNITS' && l[i + 1] === '70');
  if (iu >= 0) unidades = +l[iu + 2] || 6;
  const f = { 1: 0.0254, 2: 0.3048, 4: 0.001, 5: 0.01, 6: 1 }[unidades] || 1;
  const polis = [], textos = [];
  for (let i = 0; i < l.length - 1; i++) {
    if (l[i] !== '0') continue;
    const tipo = l[i + 1];
    if (tipo === 'LWPOLYLINE') {
      const pts = []; let cerrada = false; let x = null;
      for (let j = i + 2; j < l.length - 1; j += 2) {
        if (l[j] === '0') break;
        if (l[j] === '70') cerrada = (+l[j + 1] & 1) === 1;
        if (l[j] === '10') x = +l[j + 1];
        if (l[j] === '20' && x !== null) { pts.push({ x: x * f, y: +l[j + 1] * f }); x = null; }
      }
      if (pts.length >= 3) polis.push({ pts, cerrada });
    } else if (tipo === 'TEXT' || tipo === 'MTEXT') {
      for (let j = i + 2; j < l.length - 1; j += 2) { if (l[j] === '0') break; if (l[j] === '1' || l[j] === '3') textos.push(l[j + 1].replace(/\\P/g, ' ').replace(/\\[A-Za-z][^;]*;/g, '')); }
    }
  }
  const area = p => { let a = 0; for (let k = 0; k < p.length; k++) { const q = p[(k + 1) % p.length]; a += p[k].x * q.y - q.x * p[k].y; } return Math.abs(a / 2); };
  const lote = polis.filter(p => p.cerrada || (Math.hypot(p.pts[0].x - p.pts.at(-1).x, p.pts[0].y - p.pts.at(-1).y) < 0.05)).sort((a, b) => area(b.pts) - area(a.pts))[0];
  let poly = null;
  if (lote) {
    const x0 = Math.min(...lote.pts.map(p => p.x)), y0 = Math.min(...lote.pts.map(p => p.y));
    poly = lote.pts.map(p => ({ x: r2(p.x - x0), y: r2(p.y - y0), z: 0 }));
  }
  return { poly, area: lote ? r2(area(lote.pts)) : 0, textos: textos.join('\n'), unidades };
}
