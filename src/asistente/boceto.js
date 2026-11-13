/* ==========================================================================
   AXIONA OBRA · Del boceto al proyecto
   --------------------------------------------------------------------------
   Axi manda la foto del boceto a /api/boceto (Claude de Anthropic, visión) y
   recibe el programa: lote, pisos, espacios con área y zona, estilo, forma,
   cubierta, acabados, piscina y extras. Aquí se convierte en un proyecto de
   Axiona Obra; el motor arma el modelo 3D, los planos y el presupuesto, y el
   usuario lo sigue editando por módulos como quiera.
   ========================================================================== */
import { ESTILOS, FACHADAS, TEJAS, PISOS } from '../motor/catalogo.js';
import { FORMAS } from '../motor/distribucion.js';
import { areaEspacioPiscina } from '../motor/exterior.js';

const lim = (v, a, b, d) => { const n = +v; return Number.isFinite(n) ? Math.min(b, Math.max(a, n)) : d; };
const r1 = v => Math.round(v * 10) / 10;

/**
 * Proyecto de Axiona Obra a partir de lo que Axi leyó del boceto.
 * @param {object} d     respuesta de /api/boceto
 * @param {object} base  proyecto en blanco del país e idioma actuales (proyectoEnBlanco de app.js)
 */
export function estadoDesdeBoceto(d, base) {
  const S = JSON.parse(JSON.stringify(base));
  const pisos = Math.round(lim(d.pisos, 1, 6, 1));
  const espacios = (Array.isArray(d.espacios) ? d.espacios : [])
    .filter(e => e && String(e.nombre || '').trim() && !/escalera|pasillo|circulaci|hall de escalera|stair|corridor/i.test(e.nombre))
    .slice(0, 40)
    .map(e => ({
      name: String(e.nombre).trim().slice(0, 40),
      area: r1(lim(e.area, 2, 400, 10)),
      floor: Math.round(lim(e.piso, 1, pisos, 1)),
      zone: ['social', 'privada', 'servicio'].includes(e.zona) ? e.zona : 'social',
    }));
  // nombres repetidos: «Alcoba», «Alcoba 2»…
  const vistos = {};
  espacios.forEach(e => { const k = e.name.toLowerCase(); vistos[k] = (vistos[k] || 0) + 1; if (vistos[k] > 1) e.name = `${e.name} ${vistos[k]}`; });
  if (espacios.length) S.rooms = espacios;
  S.floors = pisos;
  if (d.nombre_proyecto) S.nombre = String(d.nombre_proyecto).slice(0, 80);

  // piscina (interior: con su espacio en el primer piso)
  const P = d.piscina || {};
  if (P.tiene) {
    const largo = r1(lim(P.largo, 3, 25, 8)), ancho = r1(lim(P.ancho, 2, 12, 4)), prof = r1(lim(P.profundidad, 0.8, 3, 1.5));
    S.piscina = { on: true, interior: !!P.interior, largo: Math.max(largo, ancho), ancho: Math.min(largo, ancho), prof, x: null, y: null };
    if (P.interior && !S.rooms.some(r => /piscina|pool/i.test(r.name))) {
      S.rooms.push({ name: S.idioma === 'en' ? 'Indoor pool' : 'Piscina interior', area: Math.round(areaEspacioPiscina(S.piscina.largo, S.piscina.ancho) * 1.4), floor: 1, zone: 'social' });
    }
  } else S.piscina = { ...(S.piscina || {}), on: false, interior: false };

  // lote: el del boceto; si no trae cotas, uno que alcance para el primer piso con retiros
  const area1 = S.rooms.filter(r => r.floor === 1).reduce((a, r) => a + r.area, 0) * 1.25;
  let frente = +d.lote?.frente || 0, fondo = +d.lote?.fondo || 0;
  if (!(frente >= 5 && fondo >= 5)) { frente = Math.max(10, Math.ceil(Math.sqrt(area1 / 0.4 * 0.75))); fondo = Math.max(18, Math.ceil(area1 / 0.4 / frente)); }
  S.lot = [{ x: 0, y: 0, z: 0 }, { x: frente, y: 0, z: 0 }, { x: frente, y: fondo, z: 0 }, { x: 0, y: fondo, z: 0 }];
  S.spots = []; S.frente = 0;

  // forma, cubierta, estilo y acabados
  S.forma = { tipo: FORMAS[d.forma] ? d.forma : 'recta', paso: 2.5, balcones: !!d.balcones, curvas: !!d.curvas, ventanales: true };
  const cub = ['plana', 'dos', 'cuatro'].includes(d.cubierta) ? d.cubierta : 'cuatro';
  S.cubierta = { ...(S.cubierta || {}), tipo: cub, pend: cub === 'plana' ? 0 : 30, alero: cub === 'plana' ? 0 : 1.0 };
  const A = S.acabados = { ...(S.acabados || {}) };
  A.estilo = ESTILOS[d.estilo] ? d.estilo : 'moderno';
  if (FACHADAS[d.fachada]) A.fachada = d.fachada;
  if (FACHADAS[d.fachada_primer_piso]) A.fachadaBase = d.fachada_primer_piso; else delete A.fachadaBase;
  if (cub !== 'plana' && TEJAS[d.teja]) A.teja = d.teja;
  if (d.cielo === 'listones') A.cielo = 'listones';
  const pisoDe = r => /baño|bano|bath|toilet/i.test(r.name) ? d.piso_banos : /piscina|pool/i.test(r.name) ? 'piedraGris' : r.zone === 'privada' ? d.piso_alcobas : d.piso_social;
  A.pisos = Object.fromEntries(S.rooms.map(r => [`${r.floor}:${r.name}`, pisoDe(r)]).filter(([, k]) => PISOS[k]));

  // extras
  S.parqueo = { on: (+d.parqueaderos || 0) > 0, n: Math.round(lim(d.parqueaderos, 1, 6, 2)) };
  S.chimenea = !!d.chimenea; S.pergola = !!d.pergola; S.ascensor = !!d.ascensor || pisos >= 4;
  S.amoblar = true;
  return S;
}

/** Resumen para el chat de Axi. */
export function resumenBoceto(d, T) {
  const esp = (d.espacios || []).length, pisos = d.pisos || 1;
  const porPiso = [...Array(pisos)].map((_, i) => Math.round((d.espacios || []).filter(e => (e.piso || 1) === i + 1).reduce((a, e) => a + (+e.area || 0), 0)));
  const partes = [
    d.lote?.frente > 0 && d.lote?.fondo > 0 ? T(`lote de ${d.lote.frente} × ${d.lote.fondo} m`, `${d.lote.frente} × ${d.lote.fondo} m lot`) : T('lote estimado', 'estimated lot'),
    T(`${pisos} ${pisos === 1 ? 'piso' : 'pisos'}`, `${pisos} ${pisos === 1 ? 'floor' : 'floors'}`),
    T(`${esp} espacios (${porPiso.map((a, i) => `${a} m² en el piso ${i + 1}`).join(', ')})`, `${esp} rooms (${porPiso.map((a, i) => `${a} m² on floor ${i + 1}`).join(', ')})`),
    T(`estilo ${d.estilo}`, `${d.estilo} style`),
  ];
  if (d.piscina?.tiene) partes.push(T(`piscina ${d.piscina.interior ? 'interior ' : ''}de ${d.piscina.largo} × ${d.piscina.ancho} m`, `${d.piscina.interior ? 'indoor ' : ''}pool ${d.piscina.largo} × ${d.piscina.ancho} m`));
  return partes.join(' · ');
}

/** Foto del boceto lista para enviar: JPEG, lado mayor ≤ 1600 px. Los PDF se convierten desde su primera página. */
export async function prepararImagen(archivo) {
  let fuente;
  if (archivo.type === 'application/pdf' || /\.pdf$/i.test(archivo.name)) {
    const pdfjs = await import('pdfjs-dist');
    const w = await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
    pdfjs.GlobalWorkerOptions.workerSrc = w.default;
    const doc = await pdfjs.getDocument({ data: new Uint8Array(await archivo.arrayBuffer()) }).promise;
    const pag = await doc.getPage(1);
    const v0 = pag.getViewport({ scale: 1 }), k = Math.min(3, 1800 / Math.max(v0.width, v0.height));
    const v = pag.getViewport({ scale: k });
    fuente = document.createElement('canvas'); fuente.width = v.width; fuente.height = v.height;
    const cx = fuente.getContext('2d'); cx.fillStyle = '#fff'; cx.fillRect(0, 0, v.width, v.height);
    await pag.render({ canvasContext: cx, viewport: v }).promise;
  } else {
    const url = URL.createObjectURL(archivo);
    try { fuente = await new Promise((ok, mal) => { const i = new window.Image(); i.onload = () => ok(i); i.onerror = () => mal(new Error('imagen')); i.src = url; }); }
    finally { setTimeout(() => URL.revokeObjectURL(url), 1000); }
  }
  const w = fuente.width || fuente.naturalWidth, h = fuente.height || fuente.naturalHeight;
  const k = Math.min(1, 1600 / Math.max(w, h));
  const c = document.createElement('canvas'); c.width = Math.round(w * k); c.height = Math.round(h * k);
  const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.drawImage(fuente, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', 0.85);
}
