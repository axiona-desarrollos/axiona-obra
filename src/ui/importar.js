/* ==========================================================================
   AXIONA OBRA · Adjuntar documentos del proyecto
   --------------------------------------------------------------------------
   Lee un PDF con texto (pdf.js, en el navegador), un DXF o un .txt, pasa el
   texto por el lector del motor y muestra cada dato con el fragmento de
   donde salio. La persona marca lo que sirve y lo aplica: el humano revisa
   y aprueba; la maquina llena las casillas. Nada se sube a un servidor.
   ========================================================================== */

import { leerTexto, leerDXF, programaTipico } from '../motor/lector.js';
import { tr, datosDePais, pais as paisDe } from '../motor/index.js';
import { esc, fmtLu, fmtA, fm, app } from './comun.js';

/** Texto de un archivo. PDF: hasta 60 paginas. */
export async function leerArchivo(file, progreso = () => {}) {
  const nombre = file.name.toLowerCase();
  if (nombre.endsWith('.pdf') || file.type === 'application/pdf') {
    const pdfjs = await import('pdfjs-dist');
    const w = await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
    pdfjs.GlobalWorkerOptions.workerSrc = w.default;
    const doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
    const n = Math.min(doc.numPages, 60);
    let texto = '';
    for (let i = 1; i <= n; i++) {
      const pg = await doc.getPage(i);
      const tc = await pg.getTextContent();
      let ultimaY = null;
      tc.items.forEach(it => {
        const y = it.transform?.[5];
        if (ultimaY !== null && Math.abs(y - ultimaY) > 4) texto += '\n';
        texto += it.str + (it.hasEOL ? '\n' : ' ');
        ultimaY = y;
      });
      texto += '\n';
      progreso(i, n);
    }
    return { texto, paginas: doc.numPages, tipo: 'pdf' };
  }
  if (nombre.endsWith('.dxf')) {
    const d = leerDXF(await file.text());
    return { texto: d.textos, dxf: d, tipo: 'dxf' };
  }
  if (/\.(txt|md|csv)$/.test(nombre) || file.type.startsWith('text/')) return { texto: await file.text(), tipo: 'txt' };
  return { texto: '', tipo: 'otro' };
}

const rect = (w, d) => [{ x: 0, y: 0, z: 0 }, { x: w, y: 0, z: 0 }, { x: w, y: d, z: 0 }, { x: 0, y: d, z: 0 }];
const presion = q => (app.S.pais === 'CO' ? `${fm(q, 1)} t/m²` : `${fm(q * 9.80665, 0)} kPa`);

/** Propuestas de cambio a partir de lo leido. Cada una sabe aplicarse al estado. */
export function propuestas(leido) {
  const res = leerTexto(leido.texto);
  const D = Object.fromEntries(res.datos.filter(d => d.k !== 'profesional').map(d => [d.k, d]));
  const out = [];
  const add = (id, etiqueta, valor, d, aplicar, marcado = (d?.conf ?? 0.8) >= 0.75) => out.push({ id, etiqueta, valor, frag: d?.frag || '', conf: d?.conf ?? 0.8, aplicar, marcado });
  if (leido.dxf?.poly) {
    const p = leido.dxf.poly;
    out.push({ id: 'poli', etiqueta: tr({ es: 'Polígono del lote (DXF)', en: 'Lot polygon (DXF)' }), valor: `${p.length} ${tr({ es: 'vértices', en: 'corners' })} · ${fmtA(leido.dxf.area)}`, frag: '', conf: 0.9, marcado: true, aplicar: S => { S.lot = p; S.spots = []; S.frente = 0; } });
  }
  if (D.pais && D.pais.v !== app.S.pais) add('pais', tr({ es: 'País del documento', en: 'Document country' }), tr(paisDe(D.pais.v).nombre), D.pais, S => { const keep = { lot: S.lot, rooms: S.rooms, proyecto: S.proyecto, nombre: S.nombre, spots: S.spots, frente: S.frente }; Object.assign(S, datosDePais(D.pais.v), keep); }, false);
  let fr = D.frente?.v, fo = D.fondo?.v;
  if (D.areaLote && fr && !fo) fo = D.areaLote.v / fr;
  if (D.areaLote && fo && !fr) fr = D.areaLote.v / fo;
  if (fr && fo) add('lote', tr({ es: 'Lote rectangular', en: 'Rectangular lot' }), `${fmtLu(fr)} × ${fmtLu(fo)}`, D.frente || D.fondo, S => { if (!leido.dxf?.poly) { S.lot = rect(+fr.toFixed(2), +fo.toFixed(2)); S.spots = []; S.frente = 0; } });
  else if (D.areaLote) add('area', tr({ es: 'Área del lote (solo informa)', en: 'Lot area (info only)' }), fmtA(D.areaLote.v), D.areaLote, () => {}, false);
  if (D.pisos) add('pisos', tr({ es: 'Pisos', en: 'Storeys' }), String(D.pisos.v), D.pisos, S => { S.floors = D.pisos.v; });
  if (D.alcobas || D.banos) {
    const a = D.alcobas?.v || 2, b = D.banos?.v || 1;
    add('programa', tr({ es: 'Programa típico', en: 'Typical program' }), tr({ es: `${a} alcobas y ${b} baños`, en: `${a} bedrooms and ${b} bathrooms` }), D.alcobas || D.banos, S => { S.rooms = programaTipico(a, b, D.pisos?.v || S.floors, S.idioma); });
  }
  if (D.areaConstruida) add('construida', tr({ es: 'Área construida (solo informa)', en: 'Built area (info only)' }), fmtA(D.areaConstruida.v), D.areaConstruida, () => {}, false);
  if (D.qadm) add('qadm', tr({ es: 'Capacidad portante del estudio de suelos', en: 'Bearing capacity (geotechnical report)' }), presion(D.qadm.v), D.qadm, S => { S.qadm = +D.qadm.v.toFixed(2); });
  if (D.desp) add('desp', tr({ es: 'Profundidad de cimentación', en: 'Footing depth' }), fmtLu(D.desp.v), D.desp, S => { S.desp = +D.desp.v.toFixed(2); });
  if (D.freatico) add('freatico', tr({ es: 'Nivel freático', en: 'Water table' }), fmtLu(D.freatico.v), D.freatico, S => { S.freatico = +D.freatico.v.toFixed(2); });
  if (D.perfil) add('perfil', tr({ es: 'Perfil de suelo (solo informa)', en: 'Site class (info only)' }), D.perfil.v, D.perfil, () => {}, false);
  [['aa', 'Aa'], ['av', 'Av'], ['ab', 'ab (g)'], ['sa', 'Sa(0.2)']].forEach(([k, n]) => { if (D[k]) add(k, `${tr({ es: 'Sismo', en: 'Seismic' })} ${n}`, String(D[k].v), D[k], S => { S[k] = D[k].v; }); });
  if (D.nieve) add('nieve', tr({ es: 'Carga de nieve Ss', en: 'Snow load Ss' }), `${D.nieve.v} kPa`, D.nieve, S => { S.nieve = D.nieve.v; });
  if (D.helada) add('helada', tr({ es: 'Profundidad de helada', en: 'Frost depth' }), fmtLu(D.helada.v), D.helada, S => { S.helada = +D.helada.v.toFixed(2); });
  if (D.zona) add('zona', tr({ es: 'Zona climática CTE', en: 'CTE climate zone' }), D.zona.v, D.zona, S => { S.zona = D.zona.v; });
  if (D.retFrente) add('retF', tr({ es: 'Retiro frontal', en: 'Front setback' }), fmtLu(D.retFrente.v), D.retFrente, S => { S.ret.front = +D.retFrente.v.toFixed(2); });
  if (D.retFondo) add('retB', tr({ es: 'Retiro posterior', en: 'Rear setback' }), fmtLu(D.retFondo.v), D.retFondo, S => { S.ret.back = +D.retFondo.v.toFixed(2); });
  if (D.retLado) add('retL', tr({ es: 'Retiro lateral', en: 'Side setback' }), fmtLu(D.retLado.v), D.retLado, S => { S.ret.lat = +D.retLado.v.toFixed(2); });
  if (D.occ) add('occ', tr({ es: 'Índice de ocupación', en: 'Lot coverage' }), `${fm(D.occ.v * 100, 1)} %`, D.occ, S => { S.occ = D.occ.v; });
  if (D.ic) add('ic', tr({ es: 'Índice de construcción (solo informa)', en: 'Floor area ratio (info only)' }), String(D.ic.v), D.ic, () => {}, false);
  if (D.nombre) add('nombre', tr({ es: 'Nombre del proyecto', en: 'Project name' }), D.nombre.v, D.nombre, S => { S.nombre = D.nombre.v; }, false);
  if (D.direccion) add('direccion', tr({ es: 'Dirección', en: 'Address' }), D.direccion.v, D.direccion, S => { S.proyecto.direccion = D.direccion.v; });
  if (D.ciudad) add('ciudad', tr({ es: 'Ciudad o municipio', en: 'City' }), D.ciudad.v, D.ciudad, S => { S.proyecto.ciudad = D.ciudad.v; });
  if (D.propietario) add('propietario', tr({ es: 'Propietario', en: 'Owner' }), D.propietario.v, D.propietario, S => { S.proyecto.propietario = D.propietario.v; });
  if (D.predio) add('predio', tr({ es: 'Identificación del predio', en: 'Parcel ID' }), D.predio.v, D.predio, S => { S.proyecto.predio = D.predio.v; });
  res.datos.filter(d => d.k === 'profesional').forEach((d, i) => add('pro' + i, tr({ es: 'Profesional', en: 'Professional' }), `${d.v.nombre} · ${d.v.doc}`, d, S => {
    const libre = S.profesionales.find(p => p.rol === d.v.rol && !p.nombre) || S.profesionales.find(p => !p.nombre);
    if (libre) Object.assign(libre, { rol: d.v.rol, nombre: d.v.nombre, doc: d.v.doc }); else S.profesionales.push({ rol: d.v.rol, nombre: d.v.nombre, doc: d.v.doc });
  }, false));
  return { lista: out, pais: res.pais, letras: res.letras };
}

/** Tabla para revisar y aprobar. */
export function htmlPropuestas(P) {
  if (!P.lista.length) return `<p class="note">${tr({ es: 'No encontré datos de lote, suelo, norma ni programa en el texto. Si es un escaneo (una foto dentro del PDF), no tiene texto para leer.', en: 'No lot, soil, zoning or program data found. Scanned PDFs (images) have no text to read.' })}</p>`;
  return `<div class="tbl-wrap"><table class="imp"><thead><tr><th></th><th>${tr({ es: 'Dato', en: 'Field' })}</th><th>${tr({ es: 'Valor', en: 'Value' })}</th><th>${tr({ es: 'De dónde salió', en: 'Source text' })}</th></tr></thead><tbody>${P.lista.map((p, i) => `<tr><td><input type="checkbox" data-imp="${i}" ${p.marcado ? 'checked' : ''} aria-label="${esc(p.etiqueta)}"></td><td>${esc(p.etiqueta)}</td><td class="mono">${esc(p.valor)}</td><td class="frag">${p.frag ? `«${esc(p.frag)}»` : '—'}</td></tr>`).join('')}</tbody></table></div>`;
}

export function aplicarPropuestas(P, marcados) {
  let n = 0;
  P.lista.forEach((p, i) => { if (marcados.includes(i)) { p.aplicar(app.S); n++; } });
  return n;
}
