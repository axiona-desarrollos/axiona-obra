/* ==========================================================================
   AXIONA OBRA · Interfaz
   --------------------------------------------------------------------------
   Aqui solo se cablea: cada pestaña se pinta con sus textos en el idioma
   del proyecto, las entradas escriben en el estado (con conversion de pies
   a metros en Canada) y cada cambio recalcula el modelo. El calculo vive en
   src/motor (sin DOM), los planos y laminas en src/ui, el 3D en src/vista3d,
   la AR en src/ar y los exportes en src/exportar.
   ========================================================================== */

import './estilos.css';
import {
  buildModel, normalizarEstado, clonar, DEFAULT_STATE, PLANTILLAS, SOILS, ZONAS, totales, precioDe, nombreCategoria, CATS, dms,
  PAISES, PAIS_IDS, PASOS, NORMAS, PAPELES, CUBIERTAS, FORMAS, PISOS, ESTILOS, MUEBLES, DOMOTICA, domoticaDePais, domoticaPorDefecto,
  datosDePais, pisoDe, tr, setIdioma, IDIOMAS, traducirEspacios, TIPOS_ESPACIO, nombreSistema, usaTm2, ENTIDADES, ZONAS_MX, fsr, FSR_BASE,
} from './motor/index.js';
import { $, $$, fm, money, esc, toast, app, fmtL, fmtLu, fmtA, uL, uA, aPantalla, aMetros, imperial, FT2, fases } from './ui/comun.js';
import { planSVG, vistas, instalarPanZoom, ajustarPlano } from './ui/planos.js';
import { juegoDeLaminas, indiceLaminas, laminasAPDF, proporcionPortada } from './ui/laminas.js';
import { enlaceDelProyecto, proyectoDelEnlace } from './ui/compartir.js';
import { ensure3D, buildScene, resize3D, applyPhase, conectarControles3D, capturar, tres } from './vista3d/escena.js';
import { iniciarRecorrido, salirRecorrido, enRecorrido } from './vista3d/recorrido.js';
import { mostrarCondominio, medidasLote, nombreEstado, condominioActivo } from './vista3d/condominio3d.js';
import { lotear } from './motor/condominio.js';
import { conectarAR, iniciarAR, revisarAR, verEnIPhone } from './ar/ar.js';
import { iniciarARAxiona, preferencias as preferenciasAR, guardarPreferencias as guardarPreferenciasAR } from './ar/axionaAR.js';
import { descargarMarcadores, mostrarMarcador } from './ar/marcadoresPDF.js';
import { descargar, toDXF, toCSV, generadoresCSV, exportarGLB, exportarUSDZ } from './exportar/exportar.js';
import { leerArchivo, propuestas, htmlPropuestas, aplicarPropuestas } from './ui/importar.js';
import { iniciarAxi, abrirAxi, actualizarIdiomaAxi, saludoPrimeraVisita } from './asistente/axi.js';

const KEY = 'axiona-obra-v3', KEY_V2 = 'axiona-obra-v2', KEY_IDIOMA = 'axiona-obra-idioma';
const TABS = ['proyecto', 'terreno', 'programa', 'planos', 'interiores', 'modelo', 'cantidades', 'ventas', 'ar'];
const NOMBRE_TAB = {
  proyecto: { es: 'Proyecto', en: 'Project' }, terreno: { es: 'Terreno', en: 'Site' }, programa: { es: 'Programa', en: 'Program' },
  planos: { es: 'Planos', en: 'Drawings' }, interiores: { es: 'Interiores', en: 'Interiors' }, modelo: { es: 'Modelo 3D', en: '3D model' },
  cantidades: { es: 'Presupuesto', en: 'Budget' }, ventas: { es: 'Ventas', en: 'Sales' }, ar: { es: 'AR y exportar', en: 'AR & export' },
};
const BANDERAS = {
  CO: '<svg viewBox="0 0 30 20" aria-hidden="true"><rect width="30" height="10" fill="#fcd116"/><rect y="10" width="30" height="5" fill="#003893"/><rect y="15" width="30" height="5" fill="#ce1126"/></svg>',
  ES: '<svg viewBox="0 0 30 20" aria-hidden="true"><rect width="30" height="20" fill="#aa151b"/><rect y="5" width="30" height="10" fill="#f1bf00"/></svg>',
  MX: '<svg viewBox="0 0 30 20" aria-hidden="true"><rect width="10" height="20" fill="#006847"/><rect x="10" width="10" height="20" fill="#fff"/><rect x="20" width="10" height="20" fill="#ce1126"/><circle cx="15" cy="9.6" r="2.4" fill="#8c6a3d"/><path d="M12.7 11.4q2.3 2.4 4.6 0" fill="none" stroke="#2e7d32" stroke-width=".8"/></svg>',
  CA: '<svg viewBox="0 0 30 20" aria-hidden="true"><rect width="30" height="20" fill="#fff"/><rect width="7.5" height="20" fill="#d52b1e"/><rect x="22.5" width="7.5" height="20" fill="#d52b1e"/><path d="M15 4.2l1.1 2.2 1.3-.6-.4 3.1 1.6-1.4.4 1 1.7-.3-.6 1.7.8.4-2.7 2.2.3 1-2.8-.3v2.4h-.6v-2.4l-2.8.3.3-1-2.7-2.2.8-.4-.6-1.7 1.7.3.4-1 1.6 1.4-.4-3.1 1.3.6z" fill="#d52b1e"/></svg>',
};
let avisoInstalar = null, tabActual = 'proyecto', laminaSel = 'p1', importado = null;

/* ---------------- guardado ---------------- */
function cargarGuardado() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) || localStorage.getItem(KEY_V2));
    return s ? normalizarEstado(s) : null;
  } catch { return null; }
}
function guardar() { try { localStorage.setItem(KEY, JSON.stringify(app.S)); } catch { /* modo privado */ } }

/* ---------------- ayudas de plantilla ---------------- */
function setP(o, p, v) { const ks = p.split('.'), last = ks.pop(); ks.reduce((a, k) => (a[k] ??= {}), o)[last] = v; }
const numIn = (p, v, { step = '0.01', u = '', aria = '', min = '', max = '' } = {}) => `<input type="number" inputmode="decimal" step="${step}" data-p="${p}"${u ? ` data-u="${u}"` : ''}${min !== '' ? ` min="${min}"` : ''}${max !== '' ? ` max="${max}"` : ''} value="${u ? aPantalla(+v || 0, u) : v}" aria-label="${esc(aria)}">`;
const txtIn = (p, v, aria = '') => `<input type="text" data-p="${p}" value="${esc(v ?? '')}" aria-label="${esc(aria)}">`;
const campo = (lbl, inner, extra = '') => `<label class="field" ${extra}><span class="lbl">${lbl}</span>${inner}</label>`;
const sel = (p, opciones, v, aria = '') => `<select data-p="${p}" aria-label="${esc(aria)}">${opciones.map(([k, n]) => `<option value="${esc(k)}" ${String(k) === String(v) ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select>`;
const stat = (l, v, u = '') => `<div class="stat"><span class="lbl">${l}</span><b>${v}${u ? ` <small>${u}</small>` : ''}</b></div>`;
const card = (titulo, cuerpo, sub = '', tag = '') => `<div class="card"><h2>${titulo}${tag ? ` <span class="tag">${tag}</span>` : ''}</h2>${sub ? `<p class="sub">${sub}</p>` : ''}${cuerpo}</div>`;
const P = () => PAISES[app.S.pais];
const enlace = ([t, u]) => `<a href="${esc(u)}" target="_blank" rel="noopener">${esc(t)}</a>`;

/* ---------------- barra superior ---------------- */
function renderShell() {
  const S = app.S;
  document.documentElement.lang = S.idioma;
  $('#nombreProyecto').textContent = S.nombre || tr({ es: 'Lote → planos → obra → presupuesto → AR', en: 'Lot → drawings → build → budget → AR' });
  $('#paisSeg').innerHTML = PAIS_IDS.map(id => `<button data-pais="${id}" aria-pressed="${id === S.pais}" title="${esc(tr(PAISES[id].nombre))}">${BANDERAS[id]}<span>${id}</span></button>`).join('');
  $('#idiomaSeg').innerHTML = IDIOMAS.map(l => `<button data-idioma="${l}" aria-pressed="${l === S.idioma}">${l.toUpperCase()}</button>`).join('');
  $('#unidSeg').innerHTML = [['m', 'm'], ['ft', 'ft']].map(([k, n]) => `<button data-unid="${k}" aria-pressed="${k === S.unidades}">${n}</button>`).join('');
  $('#bCompartir').textContent = tr({ es: 'Compartir', en: 'Share' });
  $('#bInstalar').textContent = tr({ es: 'Instalar app', en: 'Install app' });
  $('#tabs').innerHTML = TABS.map((t, i) => `<button class="tab" role="tab" data-tab="${t}" aria-selected="${t === tabActual}"><i>${i + 1}</i>${tr(NOMBRE_TAB[t])}</button>`).join('');
  // textos fijos del 3D
  $('#c3negra').textContent = nombreCategoria(S.pais, 'negra'); $('#c3gris').textContent = nombreCategoria(S.pais, 'gris');
  $('#c3blanca').textContent = nombreCategoria(S.pais, 'blanca'); $('#c3dot').textContent = tr({ es: 'Amoblada', en: 'Furnished' });
  $('#l3piso').textContent = tr({ es: 'Ver hasta', en: 'Show up to' });
  $('#techoBtn').textContent = tr({ es: 'Sin techo', en: 'Cut roof' });
  $('#spinBtn').textContent = tr({ es: 'Girar', en: 'Spin' });
  $('#b3foto').textContent = tr({ es: 'Foto', en: 'Snapshot' });
  $('#b3recorrido').textContent = tr({ es: 'Recorrer la casa', en: 'Walk through' });
  $('#foot').innerHTML = `${tr({ es: 'Predimensionamiento automático para anteproyecto y estimación. El diseño estructural, el estudio de suelos, las redes y la licencia o permiso los firman profesionales habilitados en cada país', en: 'Automatic pre-sizing for preliminary design and estimates. Structural design, geotechnical report, MEP and the permit must be sealed by licensed professionals in each country' })} (${P().norma}).<br>
    <a href="https://github.com/axiona-desarrollos/axiona-obra" target="_blank" rel="noopener">${tr({ es: 'Código abierto (licencia MIT)', en: 'Open source (MIT licence)' })}</a> · ${tr({ es: 'Hecho por', en: 'Made by' })} <a href="https://axionasoft.com" target="_blank" rel="noopener">Axiona Desarrollos Inteligentes</a> · Sabaneta, Colombia<br>
    <button class="fl" data-act="resenas">${tr({ es: 'Reseñas y propuestas', en: 'Reviews and proposals' })}</button> · <button class="fl" data-act="soporte">${tr({ es: 'Soporte', en: 'Support' })}</button>`;
}

function renderKPIs() {
  const M = app.M, T = totales(M, app.S.prices, app.S.pais);
  const m2 = imperial() ? `${money(T.total / (M.built * FT2))}/ft²` : `${money(T.total / M.built)}/m²`;
  $('#kpis').innerHTML = [[tr({ es: 'Lote', en: 'Lot' }), fmtA(M.lotArea)], [tr({ es: 'Construido', en: 'Built' }), fmtA(M.built)], [tr({ es: 'Total', en: 'Total' }), money(T.total)], [tr({ es: 'Costo', en: 'Cost' }), m2]]
    .map(([k, v]) => `<div class="kpi"><span>${k}</span><b>${v}</b></div>`).join('');
}

/* ---------------- 1 · proyecto ---------------- */
function pasosAplicables() {
  const M = app.M;
  return PASOS[app.S.pais].filter(p => !p.si || p.si({ area: M?.built || 0, entidad: app.S.mx?.entidad || 'cdmx', modalidad: M?.mx?.tramite.modalidad }));
}

function semaforo() {
  const S = app.S, M = app.M;
  if (!M || M.err) return '';
  const pasos = pasosAplicables(), hecho = pasos.reduce((t, p) => t + (S.tramites[p.id] || 0), 0) / (2 * pasos.length);
  const T = totales(M, S.prices, S.pais), ref = P().referencia;
  const m2 = T.sinDot * (1 + T.factorInd) / M.built;
  const enRango = m2 >= ref.min * 0.9 && m2 <= ref.max * 1.1;
  const pros = S.profesionales.filter(p => p.nombre && p.doc).length;
  const filas = [
    [hecho >= 0.99 ? 'ok' : hecho >= 0.4 ? 'medio' : 'mal', tr({ es: 'Trámites antes de construir', en: 'Pre-construction steps' }), `${Math.round(hecho * 100)} %`],
    [M.warn.length ? 'medio' : 'ok', tr({ es: 'Avisos del diseño', en: 'Design warnings' }), M.warn.length ? String(M.warn.length) : tr({ es: 'ninguno', en: 'none' })],
    [enRango ? 'ok' : 'medio', tr({ es: 'Costo por m² frente a la referencia', en: 'Cost per m² vs reference' }), `${money(m2)} · ${money(ref.min)}–${money(ref.max)}`],
    [pros ? 'ok' : 'mal', tr({ es: 'Profesionales con matrícula en el rótulo', en: 'Licensed professionals on the title block' }), String(pros)],
    [S.proyecto.aprobado && pros ? 'ok' : 'mal', tr({ es: 'Revisado y aprobado por el profesional', en: 'Reviewed and approved by the professional' }), S.proyecto.aprobado && pros ? tr({ es: 'sí', en: 'yes' }) : tr({ es: 'pendiente', en: 'pending' })],
  ];
  return `<div class="semaforo">${filas.map(([c, t, v]) => `<div class="sf ${c}"><i></i><span>${t}</span><b>${esc(v)}</b></div>`).join('')}</div>`;
}

function renderProyecto() {
  const S = app.S, Pp = P();
  const paises = PAIS_IDS.map(id => `<button class="pais ${id === S.pais ? 'on' : ''}" data-pais="${id}">${BANDERAS[id]}<b>${tr(PAISES[id].nombre)}</b><small>${PAISES[id].norma} · ${PAISES[id].moneda} · ${tr(nombreSistema(id, PAISES[id].sistema))}</small></button>`).join('');
  const roles = Pp.profesionales.map(r => [r.id, tr(r.rol)]);
  const pros = S.profesionales.map((p, i) => `<tr><td>${sel(`profesionales.${i}.rol`, roles, p.rol)}</td><td>${txtIn(`profesionales.${i}.nombre`, p.nombre, tr({ es: 'Nombre', en: 'Name' }))}</td><td>${txtIn(`profesionales.${i}.doc`, p.doc, tr(Pp.profesionales.find(r => r.id === p.rol)?.doc || Pp.profesionales[0].doc))}</td><td><button class="btn x" data-del="profesionales.${i}" aria-label="×">×</button></td></tr>`).join('');
  const pasos = pasosAplicables();
  const est = [tr({ es: 'Pendiente', en: 'To do' }), tr({ es: 'En curso', en: 'In progress' }), tr({ es: 'Listo', en: 'Done' })];
  const listaPasos = pasos.map((p, i) => {
    const v = S.tramites[p.id] || 0;
    return `<li class="paso e${v}"><button class="estado" data-paso="${p.id}" title="${est[(v + 1) % 3]}">${v === 2 ? '✓' : i + 1}</button><div><b>${esc(tr(p.t))}</b> <span class="mini e${v}">${est[v]}</span><p>${esc(tr(p.d))}</p>${p.axiona ? `<p class="ax">Axiona Obra: ${esc(tr(p.axiona))}</p>` : ''}${p.fuente ? `<p class="fu">${enlace(p.fuente)}</p>` : ''}</div></li>`;
  }).join('');
  $('#tab-proyecto').innerHTML = `<div class="col">
    <div class="card disena"><h2>${tr({ es: 'Diseña tu casa a tu gusto', en: 'Design your house your way' })}</h2><p class="sub">${tr({ es: 'El ejemplo es solo el punto de partida: cambia el lote, los espacios, los pisos, la cubierta y los acabados, y todo se recalcula. Puedes hacerlo hablándole a Axi, tocando los espacios en el plano o en la lista de Programa.', en: 'The example is just a starting point: change the lot, rooms, storeys, roof and finishes, and everything updates. Talk to Axi, tap rooms on the plan, or use the Program list.' })}</p><div class="row"><button class="btn pri" data-act="axi">${tr({ es: 'Háblale a Axi', en: 'Talk to Axi' })}</button><button class="btn amb" data-act="nuevo">${tr({ es: 'Empezar de cero', en: 'Start from scratch' })}</button><button class="btn" data-act="verPrograma">${tr({ es: 'Editar los espacios', en: 'Edit rooms' })}</button></div></div>
    ${card(tr({ es: 'País', en: 'Country' }), `<div class="paises">${paises}</div>
      <div class="grid3" style="margin-top:12px">
        ${campo(tr({ es: 'Sistema constructivo', en: 'Structural system' }), sel('sistema', Pp.sistemas.map(k => [k, tr(nombreSistema(S.pais, k))]), S.sistema))}
        ${campo(tr({ es: 'Cubierta', en: 'Roof' }), sel('cubierta.tipo', Object.entries(CUBIERTAS).map(([k, v]) => [k, tr(v)]), S.cubierta.tipo))}
        ${campo(tr({ es: 'Pendiente %', en: 'Slope %' }), numIn('cubierta.pend', S.cubierta.pend, { step: '1', min: 0, max: 120 }))}
        ${campo(tr({ es: 'Alero', en: 'Overhang' }) + ` (${uL()})`, numIn('cubierta.alero', S.cubierta.alero, { step: '0.05', u: 'L' }))}
        ${campo(tr({ es: 'Formato de láminas', en: 'Sheet size' }), sel('laminas.papel', Object.entries(PAPELES).map(([k, v]) => [k, tr(v.n)]), S.laminas.papel))}
        ${S.pais === 'CA' ? `<label class="chk" style="align-self:end"><input type="checkbox" data-p="sotano" ${S.sotano ? 'checked' : ''}> ${tr({ es: 'Sótano', en: 'Basement' })}</label>` : ''}
      </div>`, tr({ es: 'Cada país carga sus normas, trámites, moneda, unidades, sistema constructivo, techo típico, formato de láminas y precios. El lote y los espacios se conservan.', en: 'Each country loads its codes, permit steps, currency, units, structural system, typical roof, sheet size and prices. Lot and rooms are kept.' }))}
    ${card(tr({ es: 'Adjuntar documentos del proyecto', en: 'Attach project documents' }), `<label class="btn amb">${tr({ es: 'Adjuntar PDF, DXF o texto', en: 'Attach PDF, DXF or text' })}<input type="file" id="impDoc" accept=".pdf,.dxf,.txt,.md,application/pdf" hidden></label>
      <p class="note" id="impEstado" style="margin-top:10px">${tr({ es: 'Escrituras, norma urbanística, estudio de suelos, memoria o planos: la app lee medidas, linderos, capacidad portante, desplante, retiros, pisos, alcobas, dirección, propietario y profesionales. Tú revisas y apruebas cada dato.', en: 'Deeds, zoning letter, geotechnical report, memo or drawings: the app reads dimensions, boundaries, bearing capacity, footing depth, setbacks, storeys, bedrooms, address, owner and professionals. You review and approve each value.' })}</p>
      <div id="impBox"></div>`)}
    ${card(tr({ es: 'Datos del rótulo', en: 'Title block data' }), `<div class="grid2">
        ${campo(tr({ es: 'Nombre del proyecto', en: 'Project name' }), txtIn('nombre', S.nombre))}
        ${campo(tr({ es: 'Propietario o promotor', en: 'Owner' }), txtIn('proyecto.propietario', S.proyecto.propietario))}
        ${campo(tr({ es: 'Dirección', en: 'Address' }), txtIn('proyecto.direccion', S.proyecto.direccion))}
        ${campo(tr({ es: 'Ciudad', en: 'City' }), txtIn('proyecto.ciudad', S.proyecto.ciudad))}
        ${campo(tr({ es: 'Predio (matrícula, catastro o PIN)', en: 'Parcel ID' }), txtIn('proyecto.predio', S.proyecto.predio))}
        ${campo(tr({ es: 'Empresa', en: 'Firm' }), txtIn('proyecto.empresa', S.proyecto.empresa))}
      </div>
      <div class="tbl-wrap" style="margin-top:12px"><table><thead><tr><th>${tr({ es: 'Rol', en: 'Role' })}</th><th>${tr({ es: 'Nombre', en: 'Name' })}</th><th>${tr({ es: 'Matrícula o registro', en: 'Licence / registration' })}</th><th></th></tr></thead><tbody>${pros}</tbody></table></div>
      <div class="row" style="margin-top:10px"><button class="btn sm" data-act="addPro">${tr({ es: 'Añadir profesional', en: 'Add professional' })}</button></div>
      <label class="chk aprob"><input type="checkbox" data-p="proyecto.aprobado" ${S.proyecto.aprobado ? 'checked' : ''}> ${tr({ es: 'Revisado y aprobado por el profesional habilitado', en: 'Reviewed and approved by the licensed professional' })}</label>
      <p class="note">${tr({ es: 'Axiona Obra hace el trabajo de mesa; la persona habilitada lee, verifica y firma. Hasta que lo apruebe, cada lámina dice «Anteproyecto · para revisión».', en: 'Axiona Obra does the drafting; the licensed professional reads, verifies and seals. Until approved, every sheet says “Preliminary · for review”.' })}</p>`)}
  </div>
  <div class="col">
    ${card(tr({ es: '¿El proyecto va bien encaminado?', en: 'Is the project on track?' }), semaforo())}
    ${card(tr({ es: 'Antes de construir', en: 'Before construction' }), `<div class="bar prog"><div style="width:${Math.round(pasos.reduce((t, p) => t + (S.tramites[p.id] || 0), 0) / (2 * pasos.length) * 100)}%;background:var(--mint)"></div></div><ol class="pasos">${listaPasos}</ol>`, tr({ es: `Los pasos de ${tr(Pp.nombre)} en orden. Toca el número para marcar en curso o listo.`, en: `The steps for ${tr(Pp.nombre)} in order. Tap the number to mark in progress or done.` }))}
    ${card(tr({ es: 'Normas de referencia', en: 'Reference codes' }), `<ul class="normas">${NORMAS[S.pais].map(n => `<li>${enlace(n)}</li>`).join('')}</ul><p class="note">${tr({ es: 'Verificado en octubre de 2026. Las normas y ordenanzas cambian: confirma con la curaduría, el ayuntamiento o el municipio.', en: 'Checked October 2026. Codes change: confirm with the local authority.' })}</p>`)}
  </div>`;
  if (importado) $('#impBox').innerHTML = htmlPropuestas(importado) + (importado.lista.length ? `<div class="row" style="margin-top:10px"><button class="btn pri" data-act="aplicarImport">${tr({ es: 'Aplicar lo marcado', en: 'Apply selected' })}</button></div>` : '');
}

/* ---------------- 2 · terreno ---------------- */
function renderTerreno() {
  const S = app.S, u = uL();
  const plant = Object.entries(PLANTILLAS[S.pais] || {}).map(([k, p]) => [k, tr(p.titulo)]);
  const qU = usaTm2(S.pais) ? 't/m²' : 'kPa';
  const qVal = usaTm2(S.pais) ? S.qadm : +(S.qadm * 9.80665).toFixed(0);
  const sismo = S.pais === 'CO'
    ? campo('Aa', numIn('aa', S.aa, { step: '0.01' })) + campo('Av', numIn('av', S.av, { step: '0.01' }))
    : S.pais === 'MX'
      ? campo(tr({ es: 'Entidad', en: 'State' }), sel('mx.entidad', Object.entries(ENTIDADES), S.mx.entidad))
        + (S.mx.entidad === 'cdmx' ? campo(tr({ es: 'Zona geotécnica', en: 'Geotechnical zone' }), sel('mx.zona', [['', tr({ es: 'Sin definir', en: 'Not set' })], ...Object.entries(ZONAS_MX).map(([k, v]) => [k, tr(v)])], S.mx.zona)) : '')
        + campo(tr({ es: 'Días de reserva de agua', en: 'Days of water reserve' }), numIn('mx.reserva', S.mx.reserva, { step: '1', min: 1, max: 7 }))
        + campo(tr({ es: 'Dotación L/hab/día (0 = automática)', en: 'Water L/person/day (0 = auto)' }), numIn('mx.dotacion', S.mx.dotacion, { step: '10', min: 0 }))
        + `<label class="chk" style="align-self:end"><input type="checkbox" data-p="mx.riesgo" ${S.mx.riesgo ? 'checked' : ''}> ${tr({ es: 'Predio en zona de riesgo', en: 'Lot in a risk zone' })}</label>`
    : S.pais === 'ES'
      ? campo(tr({ es: 'ab (g) NCSE-02', en: 'ab (g) NCSE-02' }), numIn('ab', S.ab, { step: '0.01' })) + campo(tr({ es: 'Zona climática', en: 'Climate zone' }), txtIn('zona', S.zona))
      : campo(tr({ es: 'Nieve Ss (kPa)', en: 'Snow Ss (kPa)' }), numIn('nieve', S.nieve, { step: '0.1' })) + campo(tr({ es: 'Helada', en: 'Frost depth' }) + ` (${u})`, numIn('helada', S.helada, { step: '0.05', u: 'L' })) + campo('Sa(0.2)', numIn('sa', S.sa, { step: '0.01' }));
  $('#tab-terreno').innerHTML = `<div class="col">
    ${card(tr({ es: 'Vértices del lote', en: 'Lot corners' }), `<div class="grid2" style="margin-bottom:10px">
        ${campo(tr({ es: 'Plantilla', en: 'Template' }), `<select id="plantillaSel"><option value="">${tr({ es: 'Cargar un lote típico…', en: 'Load a typical lot…' })}</option>${plant.map(([k, n]) => `<option value="${k}">${esc(n)}</option>`).join('')}</select>`)}
        ${campo(tr({ es: 'Frente (calle)', en: 'Front (street)' }), '<select data-p="frente" id="frenteSel"></select>')}
      </div>
      <div class="tbl-wrap"><table><thead><tr><th>${tr({ es: 'Pto', en: 'Pt' })}</th><th>x (${u})</th><th>y (${u})</th><th>${tr({ es: 'Cota', en: 'Elev.' })} (${u})</th><th></th></tr></thead><tbody id="lotBody"></tbody></table></div>
      <div class="row" style="margin-top:10px"><button class="btn sm" data-act="addLot">${tr({ es: 'Añadir vértice', en: 'Add corner' })}</button><button class="btn sm" data-act="rectLot">${tr({ es: 'Lote rectangular…', en: 'Rectangular lot…' })}</button></div>
      <div id="rectForm" hidden style="margin-top:10px"><div class="grid3">
        ${campo(tr({ es: 'Frente', en: 'Width' }) + ` (${u})`, `<input id="rfW" type="number" step="0.1" value="${aPantalla(10, 'L')}">`)}
        ${campo(tr({ es: 'Fondo', en: 'Depth' }) + ` (${u})`, `<input id="rfD" type="number" step="0.1" value="${aPantalla(20, 'L')}">`)}
        ${campo(tr({ es: 'Desnivel al fondo', en: 'Rise to rear' }) + ` (${u})`, `<input id="rfZ" type="number" step="0.05" value="${aPantalla(1, 'L')}">`)}
      </div><div class="row" style="margin-top:8px"><button class="btn sm pri" data-act="applyRect">${tr({ es: 'Reemplazar lote', en: 'Replace lot' })}</button></div></div>`,
    tr({ es: `Coordenadas en ${u === 'ft' ? 'pies' : 'metros'} (x al oriente, y al norte) y cota relativa. P1 es la referencia del replanteo; el frente define hacia dónde mira la casa.`, en: `Coordinates in ${u === 'ft' ? 'feet' : 'metres'} (x east, y north) and relative elevation. P1 is the setting-out reference; the front sets where the house faces.` }))}
    ${card(tr({ es: 'Cotas interiores', en: 'Spot levels' }), `<div class="tbl-wrap"><table><thead><tr><th>#</th><th>x</th><th>y</th><th>${tr({ es: 'Cota', en: 'Elev.' })}</th><th></th></tr></thead><tbody id="spotBody"></tbody></table></div><div class="row" style="margin-top:10px"><button class="btn sm" data-act="addSpot">${tr({ es: 'Añadir cota', en: 'Add spot level' })}</button></div>`)}
    ${card(tr({ es: 'Norma, suelo, sismo y clima', en: 'Zoning, soil, seismic and climate' }), `<div class="grid3">
        ${campo(tr({ es: 'Retiro frontal', en: 'Front setback' }) + ` (${u})`, numIn('ret.front', S.ret.front, { step: '0.1', u: 'L' }))}
        ${campo(tr({ es: 'Retiro posterior', en: 'Rear setback' }) + ` (${u})`, numIn('ret.back', S.ret.back, { step: '0.1', u: 'L' }))}
        ${campo(tr({ es: 'Retiro lateral', en: 'Side setback' }) + ` (${u})`, numIn('ret.lat', S.ret.lat, { step: '0.1', u: 'L' }))}
        ${campo(tr({ es: 'Índ. ocupación', en: 'Lot coverage' }), numIn('occ', S.occ, { step: '0.05', min: 0.2, max: 1 }))}
        ${campo(tr({ es: 'Desplante', en: 'Footing depth' }) + ` (${u})`, numIn('desp', S.desp, { step: '0.1', u: 'L' }))}
        ${campo('N±0.00' + ` (${u})`, numIn('dl', S.dl, { step: '0.05', u: 'L' }).replace('<input', `<input id="dlInput" ${S.dlAuto ? 'disabled' : ''}`))}
        ${campo(tr({ es: 'Capacidad portante del estudio', en: 'Bearing capacity (report)' }) + ` (${qU})`, `<input type="number" step="${usaTm2(S.pais) ? '0.5' : '5'}" data-q="1" value="${qVal || ''}" placeholder="${tr({ es: 'sin estudio', en: 'no report' })}">`)}
        ${campo(tr({ es: 'Nivel freático', en: 'Water table' }) + ` (${u})`, numIn('freatico', S.freatico, { step: '0.1', u: 'L' }))}
        ${sismo}
      </div>
      ${campo(tr({ es: 'Tipo de suelo si no hay estudio', en: 'Soil type if no report' }), sel('soil', Object.entries(SOILS).map(([k, v]) => [k, `${tr(v.n)} · ${usaTm2(S.pais) ? v.q + ' t/m²' : Math.round(v.q * 9.80665) + ' kPa'}`]), S.soil), 'style="margin-top:10px"')}
      <label class="chk" style="margin-top:10px"><input type="checkbox" data-p="dlAuto" ${S.dlAuto ? 'checked' : ''}> ${tr({ es: 'Nivel de proyecto compensado (corte = relleno)', en: 'Balanced platform level (cut = fill)' })}</label>`)}
  </div>
  <div class="col">
    <div class="card"><h2>${tr({ es: 'Lectura del terreno', en: 'Site reading' })}</h2><div class="stats" id="lotStats"></div></div>
    <div class="card canvas-card"><div class="cv-bar"><span class="lbl">${tr({ es: 'Implantación · curvas cada 0.25 m', en: 'Site plan · 0.25 m contours' })}</span></div><div class="svgbox" id="siteBox"></div></div>
    <div class="card"><h2>${tr({ es: 'Geometría de linderos', en: 'Boundary geometry' })}</h2><div class="tbl-wrap"><table><thead><tr><th>${tr({ es: 'Lado', en: 'Side' })}</th><th class="n">${tr({ es: 'Long.', en: 'Length' })}</th><th class="n">${tr({ es: 'Azimut', en: 'Bearing' })}</th><th class="n">${tr({ es: 'Pend.', en: 'Slope' })}</th><th class="n">${tr({ es: 'Áng. int.', en: 'Int. angle' })}</th></tr></thead><tbody id="sideBody"></tbody></table></div><p class="note" id="angCheck" style="margin-top:10px"></p></div>
  </div>`;
  renderLot();
}

function renderLot() {
  const S = app.S;
  $('#lotBody').innerHTML = S.lot.map((p, i) => `<tr><td class="mono" style="color:var(--amber)">P${i + 1}</td><td>${numIn(`lot.${i}.x`, p.x, { u: 'L' })}</td><td>${numIn(`lot.${i}.y`, p.y, { u: 'L' })}</td><td>${numIn(`lot.${i}.z`, p.z, { u: 'L' })}</td><td><button class="btn x" data-del="lot.${i}" aria-label="×">×</button></td></tr>`).join('');
  $('#spotBody').innerHTML = S.spots.length
    ? S.spots.map((p, i) => `<tr><td class="mono">C${i + 1}</td><td>${numIn(`spots.${i}.x`, p.x, { u: 'L' })}</td><td>${numIn(`spots.${i}.y`, p.y, { u: 'L' })}</td><td>${numIn(`spots.${i}.z`, p.z, { u: 'L' })}</td><td><button class="btn x" data-del="spots.${i}" aria-label="×">×</button></td></tr>`).join('')
    : `<tr><td colspan="5" style="color:var(--mut);font-size:12.5px;padding:8px 4px">${tr({ es: 'Sin cotas interiores. El terreno se interpola desde los vértices.', en: 'No spot levels. The ground is interpolated from the corners.' })}</td></tr>`;
  const n = S.lot.length;
  if (S.frente >= n) S.frente = 0;
  $('#frenteSel').innerHTML = S.lot.map((p, i) => { const q = S.lot[(i + 1) % n]; return `<option value="${i}" ${i === S.frente ? 'selected' : ''}>P${i + 1}–P${(i + 1) % n + 1} · ${fmtLu(Math.hypot(q.x - p.x, q.y - p.y))}</option>`; }).join('');
}

/* ---------------- 3 · programa ---------------- */
function renderPrograma() {
  const S = app.S;
  $('#tab-programa').innerHTML = `<div class="col">
    ${card(tr({ es: 'Edificación', en: 'Building' }), `<div class="grid3">
        ${campo(tr({ es: 'Pisos', en: 'Storeys' }), numIn('floors', S.floors, { step: '1', min: 1, max: 8 }))}
        ${campo(tr({ es: 'Altura de piso', en: 'Floor height' }) + ` (${uL()})`, numIn('fh', S.fh, { step: '0.05', u: 'L' }))}
        ${campo(tr({ es: 'Losa eq.', en: 'Slab eq.' }) + ` (${uL()})`, numIn('slab', S.slab, { step: '0.01', u: 'L' }))}
      </div>
      <label class="chk" style="margin-top:10px"><input type="checkbox" data-p="ascensor" ${S.ascensor ? 'checked' : ''}> ${tr({ es: 'Ascensor', en: 'Elevator' })}</label>
      <label class="chk" style="margin-top:6px"><input type="checkbox" data-p="ascensorVoz" ${S.ascensorVoz ? 'checked' : ''}> ${tr({ es: 'Mando por voz además de los botones («piso tres»)', en: 'Voice control plus buttons (“floor three”)' })}</label>`)}
    ${card(tr({ es: 'Forma del edificio', en: 'Building form' }), `<div class="grid2">
        ${campo(tr({ es: 'Forma', en: 'Form' }), sel('forma.tipo', Object.entries(FORMAS).map(([k, v]) => [k, tr(v)]), S.forma.tipo, tr({ es: 'Forma del edificio', en: 'Building form' })))}
        ${campo(tr({ es: 'Retroceso por piso', en: 'Setback per floor' }) + ` (${uL()})`, numIn('forma.paso', S.forma.paso, { step: '0.5', min: 1, max: 6, u: 'L' }), ['terrazas', 'lateral', 'escalonada'].includes(S.forma.tipo) ? '' : 'hidden')}
      </div>
      <label class="chk" style="margin-top:10px"><input type="checkbox" data-p="forma.balcones" ${S.forma.balcones ? 'checked' : ''}> ${tr({ es: 'Balcones al frente en los pisos de arriba (la ventana pasa a puerta-ventana)', en: 'Front balconies on upper floors (the window becomes a French door)' })}</label>
      <label class="chk" style="margin-top:6px"><input type="checkbox" data-p="forma.curvas" ${S.forma.curvas ? 'checked' : ''}> ${tr({ es: 'Curvas: mirador de vidrio en media vuelta en la sala y balcones redondeados', en: 'Curves: half-round glass bay in the living room and rounded balconies' })}</label>`,
    tr({ es: 'Escalonada: cada piso de arriba retrocede y deja una terraza con baranda. En L, en U o con patio central: alas de espacios alrededor de un patio, con corredor y zaguán, como la casa de patio. El 3D, los planos, las fachadas y el presupuesto salen con la forma.', en: 'Stepped: each upper floor steps back and leaves a terrace with a railing. L, U or central courtyard: wings of rooms around a courtyard, with a gallery and an entry hall. The 3D, drawings, elevations and budget follow the form.' }))}
    ${card(tr({ es: 'Programa arquitectónico', en: 'Space program' }), `<div class="tbl-wrap"><table><thead><tr><th>${tr({ es: 'Espacio', en: 'Room' })}</th><th>${uA()}</th><th>${tr({ es: 'Piso', en: 'Floor' })}</th><th>${tr({ es: 'Zona', en: 'Zone' })}</th><th></th></tr></thead><tbody id="roomBody"></tbody></table></div><div class="row" style="margin-top:10px"><button class="btn sm" data-act="addRoom">${tr({ es: 'Añadir espacio', en: 'Add room' })}</button></div>`,
    tr({ es: 'Escribe los espacios y su área. El motor los distribuye, amobla, saca muros, puertas, ventanas, escalera, ascensor y redes.', en: 'Enter rooms and areas. The engine lays them out and furnishes them, with walls, doors, windows, stair, elevator and MEP.' }))}
  </div>
  <div class="col">
    <div class="card"><h2>${tr({ es: 'Resultado de la distribución', en: 'Layout result' })}</h2><div class="stats" id="progStats"></div></div>
    <div class="card"><h2>${tr({ es: 'Revisión automática', en: 'Automatic review' })}</h2><div class="warns" id="warns"></div></div>
    <div class="card" id="tituloE"></div>
    <div class="card" id="mxCard" hidden></div>
    <div class="card"><h2>${tr({ es: 'Cuadro de áreas', en: 'Area schedule' })}</h2><div class="tbl-wrap"><table><thead><tr><th>${tr({ es: 'Piso', en: 'Floor' })}</th><th>${tr({ es: 'Espacio', en: 'Room' })}</th><th class="n">${tr({ es: 'Pedido', en: 'Asked' })}</th><th class="n">${tr({ es: 'Asignado', en: 'Given' })}</th><th class="n">${tr({ es: 'Medidas', en: 'Size' })}</th><th>${tr({ es: 'Acceso por', en: 'Entered from' })}</th></tr></thead><tbody id="areaBody"></tbody></table></div></div>
  </div>`;
  renderRooms();
}

function renderRooms() {
  const zonas = ZONAS.map(z => [z, tr({ social: { es: 'social', en: 'social' }, privada: { es: 'privada', en: 'private' }, servicio: { es: 'servicio', en: 'service' } }[z])]);
  $('#roomBody').innerHTML = app.S.rooms.map((r, i) => `<tr>
    <td style="min-width:130px">${txtIn(`rooms.${i}.name`, r.name, tr({ es: 'Nombre del espacio', en: 'Room name' }))}</td>
    <td style="width:80px">${numIn(`rooms.${i}.area`, r.area, { step: '0.5', u: 'A' })}</td>
    <td style="width:60px">${numIn(`rooms.${i}.floor`, r.floor, { step: '1' })}</td>
    <td style="width:110px">${sel(`rooms.${i}.zone`, zonas, r.zone)}</td>
    <td><button class="btn x" data-del="rooms.${i}" aria-label="×">×</button></td></tr>`).join('');
}

/* ---------------- 4 · planos ---------------- */
function renderPlanViews() {
  const grupos = vistas(app.M);
  const ids = grupos.flatMap(g => g.v.map(v => v[0]));
  if (!ids.includes(app.planView)) app.planView = 'p1';
  $('#planViews').innerHTML = grupos.map(g => `<span class="grp"><span class="lbl">${g.g}</span>${g.v.map(([k, l]) => `<button class="chip" data-view="${k}" aria-pressed="${k === app.planView}">${esc(l)}</button>`).join('')}</span>`).join('');
}
function renderPlan() {
  const box = $('#planBox'), old = box.querySelector('svg');
  if (old) old.remove();
  box.insertAdjacentHTML('afterbegin', planSVG(app.M, app.planView, 'dark', { fmt: { L: v => fmtL(v), A: v => fmtA(v), N: undefined } }));
  ajustarPlano(box);
  const v = app.planView;
  $('#planLegend').innerHTML = /^e\d/.test(v)
    ? `<span><i style="border:1.5px solid #ffd36b;border-radius:50%"></i>${tr({ es: 'Luz', en: 'Light' })}</span><span><i style="border:1.5px solid #ffd36b;border-radius:50%"></i>S ${tr({ es: 'interruptor', en: 'switch' })}</span><span><i style="background:#ffd36b"></i>${tr({ es: 'Tablero', en: 'Panel' })}</span><span><i style="border:1.5px solid #d29bff"></i>${tr({ es: 'Domótica', en: 'Smart home' })}</span><span class="mono">${app.M.redes.puntos.elec} ${tr({ es: 'puntos', en: 'points' })}</span>`
    : /^h\d/.test(v)
      ? `<span><i style="background:#4fa3ff"></i>${tr({ es: 'Fría', en: 'Cold' })}</span><span><i style="background:#ff6b6b"></i>${tr({ es: 'Caliente', en: 'Hot' })}</span><span><i style="background:#c9a27e"></i>${tr({ es: 'Desagüe', en: 'Drain' })}</span><span><i style="background:#3fcfff"></i>${tr({ es: 'Lluvias', en: 'Storm' })}</span><span class="mono">${app.M.redes.puntos.aparatos} ${tr({ es: 'aparatos', en: 'fixtures' })}</span>`
      : `<span class="pista-plano">${tr({ es: 'Toca un espacio para editarlo', en: 'Tap a room to edit it' })}</span><span><i style="background:var(--ink)"></i>${tr({ es: 'Muro', en: 'Wall' })}</span><span><i style="background:var(--amber)"></i>${tr({ es: 'Columna', en: 'Column' })}</span><span><i style="background:var(--mint)"></i>${tr({ es: 'Ventana', en: 'Window' })} V</span><span><i style="border:1.5px solid #9fb3c8;border-radius:50%"></i>${tr({ es: 'Puerta', en: 'Door' })} P</span><span class="mono">${tr({ es: 'Cotas', en: 'Dimensions' })} ${imperial() ? 'ft-in' : 'm'}</span>`;
}

function renderLaminas() {
  const S = app.S, M = app.M;
  const ind = indiceLaminas(M, S);
  if (!ind.some(d => d.id === laminaSel)) laminaSel = ind[2]?.id || 'portada';
  $('#v-laminas').innerHTML = `<h2>${tr({ es: 'Juego de planos', en: 'Drawing set' })} <span class="tag">PDF</span></h2>
    <p class="sub">${tr({ es: `${ind.filter(d => !d.oculta).length} láminas en ${tr(PAPELES[S.laminas.papel].n)}, con rótulo, firmas, sello, índice y cuadros. La escala se escoge sola.`, en: `${ind.filter(d => !d.oculta).length} sheets on ${tr(PAPELES[S.laminas.papel].n)}, with title block, signatures, stamp, index and schedules. Scale is picked automatically.` })}</p>
    <div class="row" style="margin-bottom:10px"><button class="btn pri" data-act="expPDF">${tr({ es: 'Descargar el juego en PDF', en: 'Download the set (PDF)' })}</button><button class="btn" data-act="expDXF">DXF</button><button class="btn" data-act="expLaminaSVG">${tr({ es: 'Lámina SVG', en: 'Sheet SVG' })}</button></div>
    <p class="note" id="pdfEstado"></p>
    <ul class="hojas">${ind.map(d => `<li class="${d.id === laminaSel ? 'on' : ''} ${d.oculta ? 'off' : ''}"><button class="hoja" data-lam="${d.id}"><b>${esc(d.cod)}</b><span>${esc(d.titulo)}</span></button>${d.id !== 'portada' ? `<label class="chk" title="${tr({ es: 'Incluir en el juego', en: 'Include in the set' })}"><input type="checkbox" data-lamtoggle="${d.id}" ${d.oculta ? '' : 'checked'}></label>` : ''}</li>`).join('')}</ul>`;
  const d = ind.find(x => x.id === laminaSel);
  $('#laminaBar').innerHTML = `<span class="lbl">${tr({ es: 'Vista previa', en: 'Preview' })}</span> <b class="mono">${esc(d?.cod || '')}</b> <span>${esc(d?.titulo || '')}</span>`;
  renderLaminaPrevia();
}

let tmrLam = null;
function renderLaminaPrevia() {
  clearTimeout(tmrLam);
  tmrLam = setTimeout(() => {
    const box = $('#laminaBox');
    if (!box || $('#tab-planos').hidden) return;
    try {
      const [l] = juegoDeLaminas(app.M, app.S, { solo: laminaSel });
      if (!l) return;
      box.querySelector('svg')?.remove();
      box.insertAdjacentHTML('afterbegin', l.svg.replace('<svg ', `<svg data-w="${l.w}" data-h="${l.h}" preserveAspectRatio="xMidYMid meet" `).replace(/ width="[\d.]+mm" height="[\d.]+mm"/, ''));
      ajustarPlano(box);
    } catch (e) { console.error(e); }
  }, 60);
}

function renderReplanteo() {
  const M = app.M;
  const st = M.stake.map(s => `<tr><td class="mono" style="color:var(--amber)">${s.id}</td><td class="n">${fmtL(s.x)}</td><td class="n">${fmtL(s.y)}</td><td class="n">${fmtL(s.d)}</td><td class="n">${dms(s.az)}</td><td class="n">${fmtL(s.cut)}</td></tr>`).join('');
  const tp = M.types.map((B, i) => { const cs = M.cols.filter(c => c.B === B); return `<tr><td class="mono" style="color:var(--cyan)">Z${i + 1}</td><td class="n">${fmtL(B)} × ${fmtL(B)}</td><td class="n">${fmtL(cs[0].h)}</td><td class="n">${cs.length}</td><td class="n">${fm(Math.max(...cs.map(c => c.P)), 1)} t</td></tr>`; }).join('');
  $('#v-replanteo').innerHTML = card(tr({ es: 'Replanteo desde P1', en: 'Setting out from P1' }), `<div class="tbl-wrap"><table><thead><tr><th>${tr({ es: 'Punto', en: 'Point' })}</th><th class="n">x</th><th class="n">y</th><th class="n">${tr({ es: 'Dist. P1', en: 'Dist. P1' })}</th><th class="n">${tr({ es: 'Azimut', en: 'Bearing' })}</th><th class="n">${tr({ es: 'Excav.', en: 'Excav.' })}</th></tr></thead><tbody>${st}</tbody></table></div>`, tr({ es: 'Distancia y azimut desde P1 para ubicar cada eje o columneta en campo.', en: 'Distance and bearing from P1 to locate each grid point on site.' }))
    + (tp ? card(tr({ es: 'Cuadro de zapatas', en: 'Footing schedule' }), `<div class="tbl-wrap"><table><thead><tr><th>${tr({ es: 'Tipo', en: 'Type' })}</th><th class="n">B×B</th><th class="n">h</th><th class="n">${tr({ es: 'Cant.', en: 'Qty' })}</th><th class="n">${tr({ es: 'Carga máx.', en: 'Max load' })}</th></tr></thead><tbody>${tp}</tbody></table></div>`, tr({ es: `Capacidad portante ${M.q} t/m² · desplante ${fmtLu(M.desp)} · área de zapata = 1.15·P / q.`, en: `Bearing ${M.q} t/m² · footing depth ${fmtLu(M.desp)} · footing area = 1.15·P / q.` })) : card(tr({ es: 'Cimentación', en: 'Foundation' }), `<p class="note">${M.sistema === 'confinada' && M.mx?.cim ? tr({ es: `Mampostería confinada: zapata corrida de concreto armado de ${fmtLu(M.mx.cim.B)} bajo todos los muros, con muro de enrase y dala de desplante; castillos a cada ${fmtLu(M.mx.sep)} como máximo.`, en: `Confined masonry: ${fmtLu(M.mx.cim.B)} reinforced strip footing under all walls, with stem wall and grade beam; tie columns every ${fmtLu(M.mx.sep)} max.` }) : M.sistema === 'confinada' ? tr({ es: 'Mampostería confinada: cimiento corrido bajo todos los muros, sin zapatas aisladas.', en: 'Confined masonry: strip footings under all walls.' }) : tr({ es: 'Entramado de madera: zapata corrida perimetral y muros de cimentación.', en: 'Wood frame: perimeter strip footing and foundation walls.' })}</p>`));
}

/* ---------------- 5 · interiores ---------------- */
function renderInteriores() {
  const S = app.S, M = app.M, pid = S.pais;
  const estilos = Object.entries(ESTILOS).map(([k, E]) => `<button class="estilo ${k === S.acabados.estilo ? 'on' : ''}" data-estilo="${k}"><span class="sw">${[E.paredes, E.acento, E.tela, E.metal, E.fachada].map(c => `<i style="background:${c}"></i>`).join('')}</span><b>${tr(E.n)}</b><small>${tr(PISOS[E.pisos.social].n)}</small></button>`).join('');
  const pisosOpt = Object.entries(PISOS).map(([k, p]) => [k, `${p.cod} · ${tr(p.n)}`]);
  const filasPiso = M.floors.flatMap(fl => fl.rects.filter(r => !r.stair && !r.asc).map(r => {
    const key = `${fl.f + 1}:${r.name}`, propio = S.acabados.pisos[key];
    return `<tr><td class="mono">${fl.f + 1}</td><td>${esc(r.name)}</td><td><select data-piso="${esc(key)}"><option value="">${tr({ es: 'Del estilo', en: 'From style' })}: ${esc(PISOS[pisoDe({ ...r }, fl.f, { ...S, acabados: { ...S.acabados, pisos: {} } })]?.cod || '')}</option>${pisosOpt.map(([k, n]) => `<option value="${k}" ${k === propio ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select></td></tr>`;
  })).join('');
  const quitados = new Set(S.muebles.quitar);
  const porEspacio = {};
  buildModel({ ...S, muebles: { quitar: [] } }).muebles?.forEach(m => { (porEspacio[`${m.f + 1} · ${m.room}`] ||= []).push(m); });
  const muebles = Object.entries(porEspacio).map(([k, ms]) => `<div class="esp"><b>${esc(k)}</b><div class="row">${ms.filter(m => m.tipo !== 'cuadro').map(m => `<button class="mu ${quitados.has(m.id) ? 'off' : ''}" data-quitar="${esc(m.id)}" title="${quitados.has(m.id) ? tr({ es: 'Volver a poner', en: 'Put back' }) : tr({ es: 'Quitar', en: 'Remove' })}">${esc(tr(MUEBLES[m.tipo]?.n || m.tipo))}${m.var && MUEBLES.cama.var[m.var] ? ' ' + m.var : ''}</button>`).join('')}</div></div>`).join('');
  const domo = domoticaDePais(pid).map(id => {
    const d = DOMOTICA[id], on = S.domotica.includes(id), q = M.domotica.find(x => x.id === id);
    return `<li class="${on ? 'on' : ''}"><label class="chk"><input type="checkbox" data-domo="${id}" ${on ? 'checked' : ''}> <b>${esc(tr(d.n))}</b></label><span class="mono">${on && q ? `${q.n} ${d.unidad || (pid === 'CA' ? 'ea' : pid === 'MX' ? 'pza' : 'und')} · ${money(q.n * q.precio)}` : money(d.precio[pid] || 0)}</span><p>${esc(tr(d.por))}${d.fuente ? ` ${enlace(d.fuente)}` : ''}</p></li>`;
  }).join('');
  $('#tab-interiores').innerHTML = `<div class="col">
    ${card(tr({ es: 'Estilo de la casa', en: 'House style' }), `<div class="estilos">${estilos}</div><label class="chk" style="margin-top:12px"><input type="checkbox" data-p="amoblar" ${S.amoblar ? 'checked' : ''}> ${tr({ es: 'Amoblar y decorar la casa (muebles, cortinas, cuadros, plantas, jardín)', en: 'Furnish and decorate (furniture, curtains, art, plants, garden)' })}</label>`, tr({ es: 'El estilo escoge pisos, enchapes, maderas, telas y colores. Los muebles se ven en los planos, el 3D, el recorrido y la realidad aumentada.', en: 'The style picks floors, tiles, woods, fabrics and colours. Furniture shows in plans, 3D, walkthrough and AR.' }))}
    ${card(tr({ es: 'Piso de cada espacio', en: 'Floor finish per room' }), `<div class="tbl-wrap"><table><thead><tr><th>${tr({ es: 'Piso', en: 'Lvl' })}</th><th>${tr({ es: 'Espacio', en: 'Room' })}</th><th>${tr({ es: 'Acabado', en: 'Finish' })}</th></tr></thead><tbody>${filasPiso}</tbody></table></div>`)}
  </div>
  <div class="col">
    ${card(tr({ es: 'Muebles por espacio', en: 'Furniture by room' }), `<div class="muebles">${muebles}</div><div class="row" style="margin-top:10px"><button class="btn sm" data-act="restaurarMuebles">${tr({ es: 'Volver a poner todos', en: 'Restore all' })}</button><span class="note">${tr({ es: 'Toca un mueble para quitarlo o volverlo a poner.', en: 'Tap a piece to remove or restore it.' })}</span></div>`)}
    ${card(tr({ es: 'Tecnología y domótica', en: 'Technology and smart home' }), `<ul class="domo">${domo}</ul>`, pid === 'CA' ? tr({ es: 'Para el frío de Canadá: tuberías que se congelan, hielo en los aleros, cortes de luz que apagan la calefacción y radón. Cada opción sale en el plano eléctrico y en el presupuesto.', en: 'For Canada’s cold: frozen pipes, ice dams, outages that stop heating, and radon. Each option shows on the electrical plan and in the budget.' }) : pid === 'MX' ? tr({ es: 'Para México: agua por tandeo, sismos y seguridad. Cada opción sale en el plano eléctrico y en el presupuesto.', en: 'For Mexico: rationed water, earthquakes and security. Each option shows on the electrical plan and in the budget.' }) : tr({ es: 'Cada opción sale en el plano eléctrico y en el presupuesto.', en: 'Each option shows on the electrical plan and in the budget.' }))}
  </div>`;
}

/* ---------------- 7 · presupuesto ---------------- */
function renderPresupuesto() {
  const S = app.S, M = app.M, T = totales(M, S.prices, S.pais), ref = P().referencia;
  const m2 = T.sinDot * (1 + T.factorInd) / M.built;
  const pos = Math.max(0, Math.min(100, (m2 - ref.min * 0.6) / (ref.max * 1.3 - ref.min * 0.6) * 100));
  const a0 = (ref.min - ref.min * 0.6) / (ref.max * 1.3 - ref.min * 0.6) * 100, a1 = (ref.max - ref.min * 0.6) / (ref.max * 1.3 - ref.min * 0.6) * 100;
  let html = '', cap = '';
  const enteras = ['und', 'ud', 'ea', 'ls', 'pza', 'salida', 'tramo', 'L'];
  const generador = it => {
    const g = it.clave && M.quant.gen?.find(c => c.clave === it.clave);
    if (!g) return esc(it.item);
    const v = x => (x === null || x === undefined ? '' : fm(x, 2));
    return `<details class="gen"><summary>${esc(it.item)}</summary><div class="tbl-wrap"><table><thead><tr><th>${tr({ es: 'Ubicación', en: 'Location' })}</th><th class="n">${tr({ es: 'Largo', en: 'L' })}</th><th class="n">${tr({ es: 'Ancho', en: 'W' })}</th><th class="n">${tr({ es: 'Alto', en: 'H' })}</th><th class="n">${tr({ es: 'Pzas', en: 'Pcs' })}</th><th class="n">${tr({ es: 'Menos', en: 'Less' })}</th><th class="n">${tr({ es: 'Cant.', en: 'Qty' })}</th></tr></thead><tbody>${g.filas.map(f => `<tr><td>${esc(f.ubic)}</td><td class="n">${v(f.largo)}</td><td class="n">${v(f.ancho)}</td><td class="n">${v(f.alto)}</td><td class="n">${f.piezas ?? ''}</td><td class="n">${v(f.menos)}</td><td class="n">${fm(f.cant, enteras.includes(g.und) ? 0 : 2)}</td></tr>`).join('')}<tr class="cap"><td colspan="6">${tr({ es: 'Suma del generador', en: 'Take-off total' })}</td><td class="n">${fm(g.q, enteras.includes(g.und) ? 0 : 2)}</td></tr></tbody></table></div></details>`;
  };
  M.quant.items.forEach(it => {
    const c = `${it.cat}|${it.cap}`;
    if (c !== cap) { cap = c; html += `<tr class="cap"><td colspan="5"><span class="c-${it.cat}">●</span> ${esc(nombreCategoria(S.pais, it.cat))} · ${esc(it.cap)}</td></tr>`; }
    html += `<tr><td>${generador(it)}</td><td class="mono" style="color:var(--mut)">${it.und}</td><td class="n">${fm(it.q, enteras.includes(it.und) ? 0 : 2)}</td><td><input type="number" inputmode="decimal" step="any" data-p="prices.${esc(it.k)}" value="${precioDe(it, S.prices)}" style="text-align:right" aria-label="${esc(it.item)}"></td><td class="n" id="t_${it.id}"></td></tr>`;
  });
  const m = M.quant.mat;
  const mx = n => n.toLocaleString('es-MX');
  const mats = S.pais === 'MX'
    ? [stat(tr({ es: 'Concreto', en: 'Concrete' }), fm(m.concreto, 1), 'm³'), stat(tr({ es: 'Block 15×20×40', en: 'Block 15×20×40' }), mx(m.block), 'pzas'), stat(tr({ es: 'Cemento', en: 'Cement' }), mx(m.cemento), tr({ es: 'bultos de 50 kg', en: '50 kg bags' })), stat(tr({ es: 'Arena', en: 'Sand' }), fm(m.arena, 1), 'm³'), stat(tr({ es: 'Grava', en: 'Gravel' }), fm(m.grava, 1), 'm³'), stat('Armex', mx(m.armex), tr({ es: 'piezas de 6 m', en: '6 m pieces' })), ...(m.vigueta ? [stat(tr({ es: 'Vigueta', en: 'Joists' }), mx(m.vigueta), 'pzas'), stat(tr({ es: 'Bovedilla', en: 'Blocks' }), mx(m.bovedilla), 'pzas')] : [])]
    : S.pais === 'CA'
    ? [stat(tr({ es: 'Concreto', en: 'Concrete' }), fm(m.concreto, 1), 'm³'), stat('2×6', m.studs6, 'pcs'), stat('2×4', m.studs4, 'pcs'), stat('OSB 4×8', m.osb, tr({ es: 'láminas', en: 'sheets' })), stat(tr({ es: 'Paneles de yeso', en: 'Drywall 4×8' }), m.drywall, tr({ es: 'láminas', en: 'sheets' })), stat(tr({ es: 'Tejas asfálticas', en: 'Shingles' }), m.shingles, tr({ es: 'paquetes', en: 'bundles' }))]
    : S.pais === 'ES'
      ? [stat(tr({ es: 'Hormigón', en: 'Concrete' }), fm(m.concreto, 1), 'm³'), stat(tr({ es: 'Acero', en: 'Rebar' }), m.acero.toLocaleString(P().locale), 'kg'), stat(tr({ es: 'Ladrillos', en: 'Bricks' }), m.ladrillos.toLocaleString(P().locale), 'ud'), stat(tr({ es: 'Forjado', en: 'Slabs' }), fm(m.forjado, 0), 'm²')]
      : [stat(tr({ es: 'Concreto', en: 'Concrete' }), fm(m.concreto, 1), 'm³'), stat(tr({ es: 'Acero', en: 'Rebar' }), m.acero.toLocaleString('es-CO'), 'kg'), stat(tr({ es: 'Bloques', en: 'Blocks' }), m.bloques.toLocaleString('es-CO'), 'und'), stat(tr({ es: 'Cemento', en: 'Cement' }), m.cemento.toLocaleString('es-CO'), tr({ es: 'bultos', en: 'bags' })), stat(tr({ es: 'Arena', en: 'Sand' }), fm(m.arena, 1), 'm³'), stat(tr({ es: 'Grava', en: 'Gravel' }), fm(m.grava, 1), 'm³')];
  const G = M.gantt, tot = G.total;
  const color = c => ({ negra: 'amber', gris: 'gris', blanca: 'cyan', inst: 'violeta', dot: 'mint' }[c] || 'gris');
  $('#tab-cantidades').innerHTML = `<div class="col">
    <div class="card"><h2>${tr({ es: 'Resumen', en: 'Summary' })}</h2><div class="stats" id="budStats" style="grid-template-columns:repeat(auto-fit,minmax(165px,1fr))"></div><div class="bar" id="budBar" style="margin-top:12px"></div>
      <div class="legend" style="padding:8px 0 0;border:0">${CATS.map(c => `<span><i style="background:var(--${color(c)})"></i>${esc(nombreCategoria(S.pais, c))}</span>`).join('')}</div>
      <div class="tbl-wrap" style="margin-top:10px"><table id="indTabla"></table></div></div>
    <div class="card"><h2>${tr({ es: '¿El costo está en el rango del mercado?', en: 'Is the cost within the market range?' })}</h2>
      <div class="rango"><div class="banda" style="left:${a0}%;width:${a1 - a0}%"></div><div class="punto" style="left:${pos}%"></div></div>
      <p class="sub" style="margin-top:8px">${tr({ es: 'Construcción sin muebles, con gastos y utilidad, sin impuestos', en: 'Construction without furniture, with overhead and profit, before tax' })}: <b class="mono">${money(m2)}/m²</b> · ${tr({ es: 'referencia', en: 'reference' })} ${money(ref.min)} – ${money(ref.max)}/m²</p>
      <p class="note">${esc(tr(ref.nota))} ${ref.fuentes.map(enlace).join(' · ')}</p></div>
    <div class="card"><h2>${tr({ es: S.pais === 'MX' ? 'Explosión de insumos' : 'Materiales principales', en: 'Main materials' })}</h2><div class="stats">${mats.join('')}</div></div>
    ${S.pais === 'MX' ? `<div class="card" id="fsrCard"></div>` : ''}
    <div class="card"><h2>${tr({ es: 'Cronograma estimado', en: 'Estimated schedule' })}</h2><p class="sub">${tr({ es: `${tot} días hábiles ≈ ${Math.ceil(tot / 6)} semanas con una cuadrilla.`, en: `${tot} working days ≈ ${Math.ceil(tot / 5)} weeks with one crew.` })}</p><div class="gantt">${G.tasks.map(t => `<div class="g-row"><span>${esc(t.name)}</span><div class="g-track"><div style="left:${t.s / tot * 100}%;width:${Math.max(t.d / tot * 100, 1)}%;background:var(--${color(t.cat)})"></div></div><span class="mono" style="color:var(--mut);text-align:right">${t.d} d</span></div>`).join('')}</div></div>
  </div>
  <div class="col"><div class="card"><h2>${tr({ es: S.pais === 'MX' ? 'Catálogo de conceptos' : 'Presupuesto de obra', en: 'Construction budget' })} <span class="tag">${tr({ es: 'editable', en: 'editable' })}</span></h2><p class="sub">${S.pais === 'MX' ? tr({ es: 'Precios unitarios de referencia en MXN para la CDMX: cámbialos por tus cotizaciones. Toca un concepto para ver sus números generadores, renglón por renglón; la cantidad es su suma.', en: 'Reference unit prices in MXN for Mexico City: replace them with your quotes. Tap an item to see its quantity take-off; the quantity is its sum.' }) : tr({ es: `Precios de referencia en ${P().moneda}. Cámbialos por tus cotizaciones y el total se recalcula. Cantidades en sistema métrico.`, en: `Reference prices in ${P().moneda}. Replace them with your quotes; totals update instantly. Quantities in metric.` })}</p>
    ${S.pais === 'MX' ? `<div class="row" style="margin-bottom:10px"><button class="btn sm amb" data-act="expGen">${tr({ es: 'Números generadores .CSV', en: 'Quantity take-off .CSV' })}</button><button class="btn sm" data-act="expCSV">${tr({ es: 'Presupuesto .CSV', en: 'Budget .CSV' })}</button></div>` : ''}
    <div class="tbl-wrap"><table><thead><tr><th>${tr({ es: 'Ítem', en: 'Item' })}</th><th>${tr({ es: 'Und', en: 'Unit' })}</th><th class="n">${tr({ es: 'Cant.', en: 'Qty' })}</th><th class="n" style="min-width:110px">${tr({ es: 'V. unitario', en: 'Unit price' })}</th><th class="n">Total</th></tr></thead><tbody>${html}<tr class="cap"><td colspan="4">${tr({ es: 'Costo directo', en: 'Direct cost' })}</td><td class="n" id="t_all" style="color:var(--fg);font-size:14px"></td></tr></tbody></table></div></div></div>`;
  actualizarPresupuesto();
  pintarFSR();
}

/** Factor de salario real con el jornal que escriba el usuario (no cambia el modelo). */
function pintarFSR() {
  const box = $('#fsrCard');
  if (!box) return;
  const sal = +app.S.mx?.salario > 0 ? +app.S.mx.salario : FSR_BASE.salario;
  box.innerHTML = `<h2>${tr({ es: 'Factor de salario real (FSR)', en: 'Real wage factor' })}</h2>
    <p class="sub">${tr({ es: 'Para tus análisis de precios unitarios: cuánto cuesta de verdad un día trabajado.', en: 'For unit price analysis: the real cost of a worked day.' })}</p>
    <div class="grid2">${campo(tr({ es: 'Salario base diario (MXN)', en: 'Base daily wage (MXN)' }), `<input type="number" inputmode="decimal" step="0.01" min="0" data-p="mx.salario" value="${sal}">`)}</div>
    <div id="fsrRes"></div>`;
  pintarFSRRes();
}

function pintarFSRRes() {
  const box = $('#fsrRes');
  if (!box) return;
  const f = fsr({ salario: +app.S.mx?.salario > 0 ? +app.S.mx.salario : FSR_BASE.salario });
  box.innerHTML = `<div class="stats" style="margin-top:10px">${stat(tr({ es: 'Días pagados', en: 'Paid days' }), fm(f.Tp, 2))}${stat(tr({ es: 'Días trabajados', en: 'Worked days' }), f.Tl)}${stat('FSR', fm(f.factor, 3))}${stat(tr({ es: 'Salario real', en: 'Real wage' }), money(f.salarioReal), tr({ es: '/día', en: '/day' }))}</div>
    <p class="note" style="margin-top:8px">${tr({ es: `Pagados: 365 + aguinaldo de ${f.aguinaldo} días + prima vacacional de ${f.vacaciones} × ${f.primaVac * 100} %. Trabajados: 365 menos ${f.domingos} domingos, ${f.vacaciones} de vacaciones, ${f.festivos} festivos y ${f.clima} por lluvia. Cuotas patronales supuestas: ${Math.round(f.cargas * 100)} %. Salario mínimo general 2026: $${FSR_BASE.salario} diarios.`, en: `Paid: 365 + ${f.aguinaldo}-day bonus + ${f.primaVac * 100} % vacation premium on ${f.vacaciones} days. Worked: 365 less ${f.domingos} Sundays, ${f.vacaciones} vacation, ${f.festivos} holidays and ${f.clima} lost to weather. Assumed employer charges: ${Math.round(f.cargas * 100)} %. 2026 general minimum wage: MXN ${FSR_BASE.salario} a day.` })}</p>`;
}

function actualizarPresupuesto() {
  const M = app.M, S = app.S;
  if (!M || M.err || !$('#budStats')) return;
  M.quant.items.forEach(it => { const c = $('#t_' + it.id); if (c) c.textContent = money(it.q * precioDe(it, S.prices)); });
  const T = totales(M, S.prices, S.pais);
  const a = $('#t_all');
  if (a) a.textContent = money(T.directo);
  $('#budStats').innerHTML = [stat('Total', money(T.total)), stat(tr({ es: 'Por m² construido', en: 'Per m² built' }), money(T.total / M.built)), ...CATS.filter(c => T[c] > 0).map(c => stat(nombreCategoria(S.pais, c), money(T[c])))].join('');
  const color = k => ({ negra: 'amber', gris: 'gris', blanca: 'cyan', inst: 'violeta', dot: 'mint' }[k]);
  $('#budBar').innerHTML = CATS.map(k => `<div style="width:${T[k] / T.directo * 100}%;background:var(--${color(k)})" title="${esc(nombreCategoria(S.pais, k))}"></div>`).join('');
  $('#indTabla').innerHTML = `<tbody><tr><td>${tr({ es: 'Costo directo', en: 'Direct cost' })}</td><td class="n">${money(T.directo)}</td></tr>${T.lineas.map(l => `<tr><td>${esc(l.n)} · ${fm(l.pct * 100, 1)} %</td><td class="n">${money(l.v)}</td></tr>`).join('')}<tr class="cap"><td>Total</td><td class="n" style="color:var(--fg)">${money(T.total)}</td></tr></tbody>`;
  renderKPIs();
}

/* ---------------- 8 · ventas (condominio) ---------------- */
function renderVentas() {
  const S = app.S, M = app.M, C = S.condominio, u = uL();
  const mac = C.macro, w = Math.max(...mac.map(p => p.x)) - Math.min(...mac.map(p => p.x)), d = Math.max(...mac.map(p => p.y)) - Math.min(...mac.map(p => p.y));
  const ml = medidasLote(S, M);
  const L = lotear(C.macro, { via: C.via, frente: ml.frente, fondo: ml.fondo });
  const T = totales(M, S.prices, S.pais);
  const casa = T.total;
  const estados = ['libre', 'reservado', 'vendido'];
  const cuenta = Object.fromEntries(estados.map(e => [e, L.lotes.filter(l => (C.estados[l.id] || 'libre') === e).length]));
  const filas = L.lotes.map(l => {
    const e = C.estados[l.id] || 'libre', precio = l.area * (C.precioM2 || 0) + casa;
    return `<tr><td class="mono"><b>${l.id}</b></td><td class="n">${fmtA(l.area)}</td><td><select data-p="condominio.estados.${l.id}" class="est ${e}">${estados.map(x => `<option value="${x}" ${x === e ? 'selected' : ''}>${nombreEstado(x)}</option>`).join('')}</select></td><td class="n">${money(precio)}</td><td><button class="btn sm" data-act="entrarLote" data-lote="${l.id}">${tr({ es: 'Entrar', en: 'Enter' })}</button></td></tr>`;
  }).join('');
  $('#tab-ventas').innerHTML = `<div class="col">
    ${card(tr({ es: 'Condominio para la sala de ventas', en: 'Development for the sales office' }), `<div class="grid3">
        ${campo(tr({ es: 'Terreno: ancho', en: 'Site width' }) + ` (${u})`, `<input type="number" step="1" id="macW" value="${aPantalla(+w.toFixed(1), 'L')}">`)}
        ${campo(tr({ es: 'Terreno: fondo', en: 'Site depth' }) + ` (${u})`, `<input type="number" step="1" id="macD" value="${aPantalla(+d.toFixed(1), 'L')}">`)}
        ${campo(tr({ es: 'Vía interna', en: 'Internal road' }) + ` (${u})`, numIn('condominio.via', C.via, { step: '0.5', u: 'L' }))}
        ${campo(tr({ es: 'Lote tipo: frente', en: 'Lot width' }) + ` (${u})`, numIn('condominio.lote', ml.frente, { step: '0.5', u: 'L' }))}
        ${campo(tr({ es: 'Lote tipo: fondo', en: 'Lot depth' }) + ` (${u})`, numIn('condominio.fondo', ml.fondo, { step: '0.5', u: 'L' }))}
        ${campo(tr({ es: `Precio del m² de lote (${P().moneda})`, en: `Lot price per m² (${P().moneda})` }), numIn('condominio.precioM2', C.precioM2, { step: '1000' }))}
      </div>
      <div class="row" style="margin-top:10px"><button class="btn sm" data-act="macroRect">${tr({ es: 'Usar estas medidas de terreno', en: 'Use these site dimensions' })}</button></div>
      <div class="stats" style="margin-top:12px">${stat(tr({ es: 'Lotes', en: 'Lots' }), L.lotes.length)}${stat(nombreEstado('libre'), cuenta.libre)}${stat(nombreEstado('reservado'), cuenta.reservado)}${stat(nombreEstado('vendido'), cuenta.vendido)}${stat(tr({ es: 'Casa (costo)', en: 'House (cost)' }), money(casa))}</div>
      <div class="row" style="margin-top:12px"><button class="btn pri" data-act="condo3D">${tr({ es: 'Ver el condominio en 3D', en: 'View the development in 3D' })}</button><button class="btn amb" data-act="recorridoCasa">${tr({ es: 'Recorrer la casa', en: 'Walk through the house' })}</button><button class="btn" data-act="arCondo">${tr({ es: 'Maqueta en AR', en: 'AR model' })}</button><button class="btn" data-act="compartir">${tr({ es: 'Enviar al cliente', en: 'Send to client' })}</button></div>`,
      tr({ es: 'En vez de mostrar fotos en una revista, el cliente ve el condominio en 3D o como maqueta sobre la mesa en realidad aumentada, escoge su lote y entra caminando a su casa amoblada.', en: 'Instead of magazine photos, the client sees the development in 3D or as an AR table model, picks a lot and walks into the furnished house.' }))}
  </div>
  <div class="col">${card(tr({ es: 'Lotes', en: 'Lots' }), L.lotes.length ? `<div class="tbl-wrap"><table><thead><tr><th>${tr({ es: 'Lote', en: 'Lot' })}</th><th class="n">${tr({ es: 'Área', en: 'Area' })}</th><th>${tr({ es: 'Estado', en: 'Status' })}</th><th class="n">${tr({ es: 'Lote + casa', en: 'Lot + house' })}</th><th></th></tr></thead><tbody>${filas}</tbody></table></div>` : `<p class="note">${tr({ es: 'No caben lotes con estas medidas: agranda el terreno o achica el lote tipo.', en: 'No lots fit: enlarge the site or reduce the lot size.' })}</p>`)}</div>`;
}

/* ---------------- 9 · AR y exportar ---------------- */
function renderAR() {
  const ladoAR = preferenciasAR().lado;
  $('#tab-ar').innerHTML = `<div class="card">
    <h2>${tr({ es: 'AR Axiona · en cualquier celular con cámara', en: 'Axiona AR · on any phone with a camera' })}</h2>
    <p class="sub">${tr({ es: 'Realidad aumentada propia: no necesita que el celular traiga AR. La visión la hace la app con la cámara y un marcador impreso (o mostrado en otra pantalla).', en: 'Our own AR: the phone does not need built-in AR. The app does the vision with the camera and a printed marker (or one shown on another screen).' })}</p>
    <div class="ar-hero">
      <div class="ar-opt"><h3 style="color:var(--cyan)">${tr({ es: 'Maqueta sobre la mesa', en: 'Model on the table' })}</h3><p>${tr({ es: 'Imprime el marcador 0 o muéstralo en el computador y apúntale con el celular: la casa se para encima, por fases, y se gira y se agranda con los dedos.', en: 'Print marker 0 or show it on a computer and point your phone at it: the house stands on it, by phase; rotate and resize with your fingers.' })}</p><div class="row"><button class="btn pri" data-act="arAxMaqueta">${tr({ es: 'Abrir la maqueta', en: 'Open the model' })}</button><button class="btn" data-act="arAxMostrar">${tr({ es: 'Mostrar el marcador aquí', en: 'Show the marker here' })}</button></div></div>
      <div class="ar-opt"><h3 style="color:var(--amber)">${tr({ es: 'La casa a escala real en el lote', en: 'The house at full scale on the lot' })}</h3><p>${tr({ es: 'Pon los marcadores 1, 2, 3… en las esquinas del lote, con la flecha hacia la esquina siguiente. La casa aparece donde va, a su tamaño real.', en: 'Place markers 1, 2, 3… on the lot corners, arrow toward the next corner. The house appears where it goes, at full size.' })}</p><div class="row"><button class="btn amb" data-act="arAxLote">${tr({ es: 'Ver en el lote', en: 'View on the lot' })}</button></div></div>
      <div class="ar-opt"><h3 style="color:var(--mint)">${tr({ es: 'Sin marcador', en: 'No marker' })}</h3><p>${tr({ es: 'Con el giroscopio: tocas el piso y la casa queda ahí mientras giras el celular. Para mostrarla rápido, sin imprimir nada.', en: 'With the gyroscope: tap the floor and the house stays there while you turn the phone. A quick show, nothing to print.' })}</p><div class="row"><button class="btn" data-act="arAxGiro">${tr({ es: 'Abrir sin marcador', en: 'Open without marker' })}</button>${condominioActivo() ? `<button class="btn" data-act="arAxCondo">${tr({ es: 'Condominio en la mesa', en: 'Development on the table' })}</button>` : ''}</div></div>
    </div>
    <div class="row" style="margin-top:12px;align-items:flex-end">
      ${campo(tr({ es: 'Lado del marcador impreso (cm)', en: 'Printed marker size (cm)' }), `<input type="number" id="arLado" inputmode="decimal" step="0.1" min="3" max="200" value="${ladoAR}">`)}
      <button class="btn" data-act="arAxPDF">${tr({ es: 'Descargar marcadores (PDF)', en: 'Download markers (PDF)' })}</button>
    </div>
    <p class="note" style="margin-top:10px">${tr({ es: 'Funciona en Chrome, Safari y Firefox de Android, iPhone y computador. La lente se calibra sola cuando el marcador se ve inclinado. Más grande el marcador, desde más lejos se ve: para el lote, imprímelo en pliego y escribe su lado.', en: 'Works in Chrome, Safari and Firefox on Android, iPhone and desktop. The lens calibrates itself when the marker is seen at an angle. Bigger markers are seen from farther away: for the lot, print large and enter the size.' })}</p>
  </div>
  <div class="card">
    <h2>${tr({ es: 'AR nativa del celular (si la trae)', en: 'Phone’s built-in AR (if available)' })}</h2>
    <p class="sub" id="arStatus">…</p>
    <div class="ar-hero">
      <div class="ar-opt"><h3 style="color:var(--amber)">${tr({ es: 'Medir el lote en sitio', en: 'Measure the lot on site' })}</h3><p>${tr({ es: 'Camina el terreno con el celular y toca cada esquina. Al cerrar, el polígono reemplaza el lote y todo se recalcula.', en: 'Walk the site with your phone and tap each corner. When you close it, the polygon replaces the lot and everything updates.' })}</p><div class="row"><button class="btn amb" data-act="arMeasure">${tr({ es: 'Medir en AR', en: 'Measure in AR' })}</button></div></div>
      <div class="ar-opt"><h3 style="color:var(--cyan)">${tr({ es: 'La casa sobre el lote', en: 'The house on the lot' })}</h3><p>${tr({ es: 'A escala real te paras en el lote y entras caminando a la casa amoblada; como maqueta, sobre una mesa.', en: 'At full scale you stand on the lot and walk into the furnished house; or as a table model.' })}</p><div class="row"><select id="arScale" class="chip" style="padding-right:8px"><option value="1">${tr({ es: 'Escala real 1:1', en: 'Full scale 1:1' })}</option><option value="0.05">${tr({ es: 'Maqueta', en: 'Model' })} 1:20</option><option value="0.02" selected>${tr({ es: 'Maqueta', en: 'Model' })} 1:50</option></select><button class="btn pri" data-act="arPlace">${tr({ es: 'Ver en AR (Android)', en: 'View in AR (Android)' })}</button><button class="btn" data-act="arIOS">${tr({ es: 'Ver en iPhone', en: 'View on iPhone' })}</button></div></div>
      <div class="ar-opt"><h3 style="color:var(--mint)">${tr({ es: 'El condominio en la mesa', en: 'The development on a table' })}</h3><p>${tr({ es: 'Para la sala de ventas: el conjunto completo con sus lotes como maqueta.', en: 'For the sales office: the full development as a table model.' })}</p><div class="row"><select id="arScaleC" class="chip" style="padding-right:8px"><option value="0.005">1:200</option><option value="0.0025">1:400</option><option value="0.01">1:100</option></select><button class="btn" data-act="arCondo">${tr({ es: 'Condominio en AR', en: 'Development in AR' })}</button><button class="btn" data-act="arCondoIOS">iPhone</button></div></div>
    </div>
    <p class="note" style="margin-top:12px">${tr({ es: 'Android: Chrome con Servicios de Google Play para AR. iPhone y iPad: AR Quick Look de Safari con el modelo de la fase actual.', en: 'Android: Chrome with Google Play Services for AR. iPhone/iPad: Safari AR Quick Look with the current phase.' })}</p>
  </div>
  <div class="card">
    <h2>${tr({ es: 'Exportar', en: 'Export' })}</h2>
    <p class="sub">${tr({ es: 'El juego de planos en PDF, planos para AutoCAD, el modelo 3D para Blender, SketchUp o visores AR, el presupuesto y el proyecto.', en: 'Drawing set PDF, CAD drawings, 3D model for Blender/SketchUp/AR viewers, budget and project file.' })}</p>
    <div class="row">
      <button class="btn pri" data-act="expPDF">${tr({ es: 'Juego de planos .PDF', en: 'Drawing set .PDF' })}</button>
      <button class="btn" data-act="expDXF">${tr({ es: 'Planos .DXF', en: 'Drawings .DXF' })}</button>
      <button class="btn" data-act="expSVG">${tr({ es: 'Vista actual .SVG', en: 'Current view .SVG' })}</button>
      <button class="btn" data-act="expGLB">${tr({ es: 'Modelo 3D .GLB', en: '3D model .GLB' })}</button>
      <button class="btn" data-act="expUSDZ">${tr({ es: 'Modelo iPhone .USDZ', en: 'iPhone model .USDZ' })}</button>
      <button class="btn" data-act="expCSV">${tr({ es: 'Presupuesto .CSV', en: 'Budget .CSV' })}</button>
      ${app.S.pais === 'MX' ? `<button class="btn" data-act="expGen">${tr({ es: 'Números generadores .CSV', en: 'Quantity take-off .CSV' })}</button>` : ''}
      <button class="btn" data-act="expJSON">${tr({ es: 'Proyecto .JSON', en: 'Project .JSON' })}</button>
      <label class="btn">${tr({ es: 'Abrir proyecto .JSON', en: 'Open project .JSON' })}<input type="file" id="impJSON" accept=".json,application/json" hidden></label>
      <button class="btn" data-act="reset">${tr({ es: 'Restaurar ejemplo', en: 'Reset example' })}</button>
    </div>
    <p class="note" style="margin-top:12px">${tr({ es: 'Todo se calcula en tu teléfono o computador: el proyecto no se sube a ningún servidor. «Compartir» mete el proyecto entero dentro del enlace.', en: 'Everything runs on your device: nothing is uploaded. “Share” packs the whole project into the link.' })}</p>
  </div>`;
  revisarAR();
}

/* ---------------- resultados (despues de recalcular) ---------------- */
function renderTerrenoRes() {
  const M = app.M, g = M.grid;
  if (!$('#lotStats')) return;
  $('#lotStats').innerHTML = [
    stat(tr({ es: 'Área', en: 'Area' }), fmtA(M.lotArea)), stat(tr({ es: 'Perímetro', en: 'Perimeter' }), fmtLu(M.per)), stat(tr({ es: 'Pendiente media', en: 'Average slope' }), fm(M.slope, 1), '%'),
    stat(tr({ es: 'Baja hacia', en: 'Falls toward' }), dms(M.slopeDir), 'az'), stat(tr({ es: 'Desnivel', en: 'Relief' }), fmtLu(g.zmax - g.zmin)), stat('N±0.00', fmtLu(M.dl)),
    stat(tr({ es: 'Corte', en: 'Cut' }), fm(M.cut, 1), 'm³'), stat(tr({ es: 'Relleno', en: 'Fill' }), fm(M.fill, 1), 'm³'), stat(tr({ es: 'Suelo q adm', en: 'Bearing q' }), usaTm2(app.S.pais) ? `${M.q} t/m²` : `${Math.round(M.q * 9.80665)} kPa`),
  ].join('');
  $('#sideBody').innerHTML = M.sides.map(s => `<tr${s.i === M.frente ? ' style="color:var(--amber)"' : ''}><td class="mono">P${s.from}–P${s.to}${s.i === M.frente ? ` · ${tr({ es: 'frente', en: 'front' })}` : ''}</td><td class="n">${fmtL(s.L)}</td><td class="n">${dms(s.az)}</td><td class="n">${fm(s.pend, 1)} %</td><td class="n">${fm(M.angles[s.from - 1], 2)}°</td></tr>`).join('');
  const exp = (M.lotW.length - 2) * 180;
  $('#angCheck').textContent = tr({ es: `Suma de ángulos internos ${fm(M.angSum, 2)}° · teórica ${exp}° para ${M.lotW.length} lados${Math.abs(M.angSum - exp) > 0.5 ? ' · el polígono se cruza: revisa el orden de los vértices' : ' · cierre correcto'}.`, en: `Interior angle sum ${fm(M.angSum, 2)}° · expected ${exp}° for ${M.lotW.length} sides${Math.abs(M.angSum - exp) > 0.5 ? ' · the polygon crosses itself: check the corner order' : ' · closes correctly'}.` });
  $('#siteBox').innerHTML = planSVG(M, 'sitio', 'dark', { fmt: { L: v => fmtL(v), A: v => fmtA(v) } });
}

function renderProgramaRes() {
  const M = app.M, st = M.stair;
  if (!$('#progStats')) return;
  $('#progStats').innerHTML = [
    stat(tr({ es: 'Huella', en: 'Footprint' }), `${fmtL(M.R.w)} × ${fmtL(M.R.h)}`, uL()), stat(tr({ es: 'Área huella', en: 'Footprint area' }), fmtA(M.R.area)), stat(tr({ es: 'Ocupación', en: 'Coverage' }), fm(M.R.area / M.lotArea * 100, 1), '%'),
    stat(tr({ es: 'Construido', en: 'Built' }), fmtA(M.built)), stat(tr({ es: 'Ejes', en: 'Grid' }), `${M.axX.length} × ${M.axY.length}`),
    stat(tr({ es: 'Escalera', en: 'Stair' }), st ? `${fmtL(st.x1 - st.x0)} × ${fmtL(st.y1 - st.y0)}` : '—'), stat(tr({ es: 'Muebles', en: 'Furniture' }), M.muebles.length), stat(tr({ es: 'Ascensor', en: 'Elevator' }), M.asc ? tr({ es: 'sí', en: 'yes' }) : '—'),
    ...(M.quant.Q.terrazaA > 0 ? [stat(tr({ es: 'Terrazas y balcones', en: 'Terraces and balconies' }), fmtA(M.quant.Q.terrazaA)), stat(tr({ es: 'Baranda', en: 'Railing' }), fmtL(M.quant.Q.barandaL), uL())] : []),
  ].join('');
  $('#warns').innerHTML = M.warn.length
    ? M.warn.map(w => `<div class="warn">${esc(w)}</div>`).join('')
    : `<div class="warn ok">${tr({ es: 'Todos los espacios tienen puerta, ventana y proporción aceptable.', en: 'Every room has a door, a window and a sound proportion.' })}</div>`;
  const rev = M.tituloE || M.mx?.revision;
  $('#tituloE').hidden = !rev;
  if (rev) $('#tituloE').innerHTML = `<h2>${M.tituloE ? tr({ es: 'Revisión sísmica · NSR-10 Título E', en: 'Seismic check · NSR-10 Title E' }) : tr({ es: 'Revisión estructural · NTC de mampostería y sismo', en: 'Structural check · masonry and seismic NTC' })}</h2><p class="sub">${M.tituloE ? tr({ es: 'Casas de 1 y 2 pisos en mampostería confinada. Ayuda al ingeniero; no reemplaza su diseño.', en: 'For 1–2 storey confined masonry houses. Helps the engineer; does not replace the design.' }) : tr({ es: 'Predimensionamiento para el DRO y el corresponsable: ayuda a revisar, no reemplaza su diseño.', en: 'Pre-sizing for the DRO and co-responsible: helps the review, does not replace the design.' })}</p><div class="warns">${rev.map(c => `<div class="warn ${c.ok ? 'ok' : ''} ${c.info ? 'info' : ''}">${esc(c.t)}</div>`).join('')}</div>`;
  renderMexico();
  $('#areaBody').innerHTML = M.floors.map(fl => fl.rects.map(r => `<tr><td class="mono">${fl.f + 1}</td><td>${esc(r.name)}</td><td class="n">${r.req ? fmtA(r.req) : '—'}</td><td class="n">${fmtA(r.area)}</td><td class="n">${fmtL(r.w)}×${fmtL(r.h)}</td><td style="color:var(--mut)">${esc(r.via || '')}</td></tr>`).join('')).join('');
}

/** Trámite, estructura y agua de México, con el porqué de cada resultado. */
function renderMexico() {
  const M = app.M, box = $('#mxCard');
  if (!box) return;
  box.hidden = !M.mx;
  if (!M.mx) return;
  const { tramite: t, losa, sep, cim, agua: a } = M.mx;
  const si = tr({ es: 'sí', en: 'yes' }), no = tr({ es: 'no', en: 'no' });
  const pz = p => (p.n > 1 ? `${p.n} × ${p.cap.toLocaleString('es-MX')} L` : `${p.cap.toLocaleString('es-MX')} L`);
  const tramite = t.modalidad === 'licencia' ? tr({ es: 'Licencia', en: 'Permit' }) : tr({ es: `Tipo ${t.modalidad}`, en: `Type ${t.modalidad}` });
  const por = t.modalidad === 'A'
    ? `<div class="warn ok">${tr({ es: 'Cumple el tipo A: una vivienda de hasta 120 m², dos niveles, 5.5 m de altura y claros de hasta 4 m, con frente de 6 m o más.', en: 'Meets type A: one dwelling up to 120 m², two storeys, 5.5 m high, spans up to 4 m and 6 m frontage.' })}</div>`
    : t.cdmx ? `<div class="warn info">${tr({ es: 'No es tipo A por', en: 'Not type A because of' })}: ${esc(t.motivos.join('; '))}.</div>` : `<div class="warn info">${tr({ es: 'Fuera de la CDMX el permiso es la licencia de construcción del municipio; los requisitos cambian por municipio.', en: 'Outside Mexico City the permit is the municipal building licence; requirements vary.' })}</div>`;
  box.innerHTML = `<h2>${tr({ es: 'México · trámite, estructura y agua', en: 'Mexico · permit, structure and water' })}</h2>
    <p class="sub">${tr({ es: 'Sale del programa y del lote: si cambias espacios o niveles, se recalcula.', en: 'Derived from the program and lot: it updates as you edit.' })}</p>
    <div class="stats">
      ${stat(t.modalidad === 'licencia' ? tr({ es: 'Trámite', en: 'Permit' }) : tr({ es: 'Manifestación', en: 'Building notice' }), tramite)}
      ${stat('DRO', t.dro ? si : no)}
      ${stat(tr({ es: 'Corresponsable estructural', en: 'Structural co-responsible' }), t.cse ? si : no)}
      ${stat(tr({ es: 'Altura', en: 'Height' }), fm(t.altura, 2), 'm')}
      ${stat(losa.ok ? tr({ es: 'Vigueta y bovedilla', en: 'Joist and block' }) : tr({ es: 'Losa', en: 'Slab' }), losa.ok ? losa.tipo : tr({ es: 'maciza', en: 'solid' }))}
      ${stat(tr({ es: 'Claro mayor', en: 'Largest span' }), fm(losa.claro, 2), 'm')}
      ${M.sistema === 'confinada' ? stat(tr({ es: 'Castillos', en: 'Tie columns' }), (M.castillos || []).reduce((n, c) => n + c.length, 0)) + stat(tr({ es: 'Separación máx.', en: 'Max spacing' }), fm(sep, 2), 'm') : ''}
      ${cim ? stat(tr({ es: 'Zapata corrida', en: 'Strip footing' }), fm(cim.B, 2), 'm') : ''}
      ${stat(tr({ es: 'Ocupantes', en: 'Occupants' }), a.ocupantes)}
      ${stat(tr({ es: 'Dotación', en: 'Allocation' }), a.dotacion, 'L/hab/día')}
      ${stat(tr({ es: 'Cisterna', en: 'Cistern' }), pz(a.cisternaPzas))}
      ${stat(tr({ es: 'Reserva', en: 'Reserve' }), a.dias, tr({ es: 'días', en: 'days' }))}
      ${stat(tr({ es: 'Tinaco', en: 'Roof tank' }), pz(a.tinacoPzas))}
      ${stat(tr({ es: 'Bomba', en: 'Pump' }), a.bomba, 'HP')}
    </div>
    <div class="warns" style="margin-top:10px">${por}${t.cse ? `<div class="warn">${tr({ es: 'Por altura o superficie lleva Corresponsable en Seguridad Estructural.', en: 'Requires a structural co-responsible.' })}</div>` : ''}</div>
    <p class="note" style="margin-top:8px">${tr({ es: 'Ocupantes: 2 por recámara y 1 por vivienda. Dotación de referencia 150 L (viviendas de hasta 100 m²) o 200 L por habitante al día; cámbiala en Terreno si el organismo de agua pide otra. Cisterna común y un tinaco por vivienda, en capacidades comerciales.', en: 'Occupants: 2 per bedroom plus 1 per dwelling. Reference allocation 150 L (dwellings up to 100 m²) or 200 L per person per day; change it in Site if the water utility requires another. Shared cistern and one roof tank per dwelling, in stock sizes.' })}</p>`;
}

/* ---------------- recalculo ---------------- */
function recompute() {
  setIdioma(app.S.idioma);
  const M = app.M = buildModel(app.S);
  $('#errbox').innerHTML = M.err ? `<div class="warn" style="margin-bottom:14px">${esc(M.err)}</div>` : '';
  if (M.err) return;
  if (app.S.dlAuto && $('#dlInput')) $('#dlInput').value = aPantalla(M.dl, 'L');
  renderKPIs();
  if (tabActual === 'terreno') renderTerrenoRes();
  if (tabActual === 'programa') renderProgramaRes();
  if (tabActual === 'planos') { renderPlanViews(); renderPlan(); renderLaminas(); renderReplanteo(); }
  if (tabActual === 'cantidades') renderPresupuesto();
  if (tabActual === 'proyecto') { const s = $('.semaforo'); if (s) s.outerHTML = semaforo(); }
  app.threeDirty = true;
  if (tabActual === 'modelo' && !condominioActivo()) buildScene();
}

/** Pinta la pestaña completa (al entrar o al cambiar idioma, pais o estructura). */
function pintarTab(t) {
  if (!app.M || app.M.err) { if (t !== 'proyecto' && t !== 'terreno') return; }
  if (t === 'proyecto') renderProyecto();
  if (t === 'terreno') { renderTerreno(); if (app.M && !app.M.err) renderTerrenoRes(); }
  if (t === 'programa') { renderPrograma(); renderProgramaRes(); }
  if (t === 'planos') { renderPlanViews(); renderPlan(); renderLaminas(); renderReplanteo(); }
  if (t === 'interiores') renderInteriores();
  if (t === 'cantidades') renderPresupuesto();
  if (t === 'ventas') renderVentas();
  if (t === 'ar') renderAR();
}

function showTab(t) {
  if (enRecorrido() && t !== 'modelo') salirRecorrido();
  tabActual = t;
  $$('.tab').forEach(b => b.setAttribute('aria-selected', b.dataset.tab === t));
  $$('main > section').forEach(s => { s.hidden = s.id !== 'tab-' + t; });
  pintarTab(t);
  if (t === 'modelo' && ensure3D()) { if (app.threeDirty && !condominioActivo()) buildScene(); resize3D(); applyPhase(); }
  try { history.replaceState(null, '', '#' + t); } catch { /* file:// */ }
}

function cargarProyecto(S, aviso) {
  if (condominioActivo()) mostrarCondominio(false);
  app.S = normalizarEstado(S);
  setIdioma(app.S.idioma);
  traducirEspacios(app.S, app.S.idioma);
  app.threeDirty = true;
  guardar(); renderShell(); recompute(); pintarTab(tabActual);
  if (aviso) toast(aviso);
}

/** Cambia el idioma de toda la app: textos, nombres de los espacios, planos, 3D y Axi. */
function cambiarIdioma(l, { recordar = true } = {}) {
  if (!IDIOMAS.includes(l)) return;
  if (recordar) { try { localStorage.setItem(KEY_IDIOMA, l); } catch { /* modo privado */ } }
  if (l === app.S.idioma && !traducirEspacios(app.S, l)) { actualizarIdiomaAxi(); return; }
  app.S.idioma = l;
  setIdioma(l);
  traducirEspacios(app.S, l);
  app.threeDirty = true;
  guardar(); renderShell(); recompute(); pintarTab(tabActual);
  if (!$('#tab-modelo').hidden) applyPhase();
  actualizarIdiomaAxi();
}

/** Idioma escogido antes (o el del enlace ?lang=), o null si es la primera visita. */
function idiomaEscogido() {
  try {
    const q = new URLSearchParams(location.search).get('lang');
    if (q && IDIOMAS.includes(q.slice(0, 2).toLowerCase())) return q.slice(0, 2).toLowerCase();
    const g = localStorage.getItem(KEY_IDIOMA);
    return IDIOMAS.includes(g) ? g : null;
  } catch { return null; }
}

/** Pantalla de idioma al abrir el enlace. Resuelve cuando el usuario escoge. */
function pedirIdioma() {
  const caja = $('#idiomaInicio');
  if (!caja) return Promise.resolve(app.S.idioma);
  caja.hidden = false;
  document.documentElement.style.overflow = 'hidden';
  const pref = (navigator.language || 'es').slice(0, 2).toLowerCase();
  const botones = [...caja.querySelectorAll('[data-idioma-inicio]')];
  (botones.find(b => b.dataset.idiomaInicio === pref) || botones[0])?.focus({ preventScroll: true });
  return new Promise(res => {
    caja.addEventListener('click', e => {
      const b = e.target.closest('[data-idioma-inicio]');
      if (!b) return;
      caja.hidden = true;
      document.documentElement.style.overflow = '';
      res(b.dataset.idiomaInicio);
    });
    caja.addEventListener('keydown', e => {
      if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp' && e.key !== 'Tab') return;
      e.preventDefault();
      const i = botones.indexOf(document.activeElement);
      botones[(i + (e.key === 'ArrowUp' || e.shiftKey ? botones.length - 1 : 1)) % botones.length].focus();
    });
  });
}

function cambiarPais(pid) {
  const S = app.S;
  if (pid === S.pais) return;
  const Pn = PAISES[pid];
  if (!confirm(tr({ es: `Cargar las funciones de ${tr(Pn.nombre)}: normas, trámites, moneda (${Pn.moneda}), unidades, sistema constructivo, cubierta, formato de láminas y precios. El lote, los espacios y los datos del proyecto se conservan.`, en: `Load ${tr(Pn.nombre)}: codes, permit steps, currency (${Pn.moneda}), units, structural system, roof, sheet size and prices. Lot, rooms and project data are kept.` }))) return;
  const idioma = S.idioma;
  Object.assign(S, datosDePais(pid), { idioma, domotica: domoticaPorDefecto(pid), tramites: {} });
  S.profesionales = PAISES[pid].profesionales.map(p => ({ rol: p.id, nombre: '', doc: '' }));
  cargarProyecto(S, tr({ es: `Funciones de ${tr(Pn.nombre)} cargadas.`, en: `${tr(Pn.nombre)} loaded.` }));
}

/* ---------------- acciones ---------------- */
const slug = s => String(s || 'proyecto').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'proyecto';
const ACT = {
  addLot() { const S = app.S, l = S.lot[S.lot.length - 1], f = S.lot[0]; S.lot.push({ x: +((l.x + f.x) / 2).toFixed(2), y: +((l.y + f.y) / 2).toFixed(2), z: +((l.z + f.z) / 2).toFixed(2) }); guardar(); renderLot(); recompute(); },
  addSpot() { const b = app.M?.lotW, cx = b ? b.reduce((t, p) => t + p.x, 0) / b.length : 5, cy = b ? b.reduce((t, p) => t + p.y, 0) / b.length : 5; app.S.spots.push({ x: +cx.toFixed(1), y: +cy.toFixed(1), z: 0 }); guardar(); renderLot(); recompute(); },
  addRoom() { app.S.rooms.push({ name: tr({ es: 'Nuevo espacio', en: 'New room' }), area: 8, floor: 1, zone: 'social' }); guardar(); renderRooms(); recompute(); },
  addPro() { app.S.profesionales.push({ rol: P().profesionales[0].id, nombre: '', doc: '' }); guardar(); renderProyecto(); },
  rectLot() { $('#rectForm').hidden = !$('#rectForm').hidden; },
  applyRect() {
    const w = aMetros(+$('#rfW').value, 'L'), d = aMetros(+$('#rfD').value, 'L'), z = aMetros(+$('#rfZ').value, 'L');
    if (!(w > 3 && d > 3)) return toast(tr({ es: 'Frente y fondo deben ser mayores a 3 m.', en: 'Width and depth must exceed 3 m.' }));
    Object.assign(app.S, { lot: [{ x: 0, y: 0, z: 0 }, { x: +w.toFixed(2), y: 0, z: 0 }, { x: +w.toFixed(2), y: +d.toFixed(2), z: +z.toFixed(2) }, { x: 0, y: +d.toFixed(2), z: +z.toFixed(2) }], spots: [], frente: 0 });
    guardar(); renderLot(); recompute(); $('#rectForm').hidden = true;
  },
  macroRect() {
    const w = aMetros(+$('#macW').value, 'L'), d = aMetros(+$('#macD').value, 'L');
    if (!(w > 20 && d > 20)) return toast(tr({ es: 'El terreno debe medir más de 20 m por lado.', en: 'The site must exceed 20 m per side.' }));
    const z = app.S.condominio.macro[2]?.z || 0;
    app.S.condominio.macro = [{ x: 0, y: 0, z: 0 }, { x: +w.toFixed(1), y: 0, z: 0 }, { x: +w.toFixed(1), y: +d.toFixed(1), z }, { x: 0, y: +d.toFixed(1), z }];
    guardar(); renderVentas();
    if (condominioActivo()) mostrarCondominio(true, eligeLote);
  },
  reset() { cargarProyecto(clonar(DEFAULT_STATE), tr({ es: 'Proyecto de ejemplo restaurado.', en: 'Example project restored.' })); },
  restaurarMuebles() { app.S.muebles.quitar = []; guardar(); recompute(); renderInteriores(); },
  expDXF() { if (!app.M?.err) descargar(`${slug(app.S.nombre)}_planos.dxf`, toDXF(app.M), 'application/dxf'); },
  expSVG() { if (!app.M?.err) descargar(`${slug(app.S.nombre)}_${app.planView}.svg`, planSVG(app.M, app.planView, 'print', { fmt: { L: v => fmtL(v), A: v => fmtA(v) } }), 'image/svg+xml'); },
  expLaminaSVG() { const [l] = juegoDeLaminas(app.M, app.S, { solo: laminaSel }); if (l) descargar(`${slug(app.S.nombre)}_${l.cod}.svg`, l.svg, 'image/svg+xml'); },
  async expPDF() {
    if (app.M?.err) return;
    const est = $('#pdfEstado');
    const aviso = t => { if (est) est.textContent = t; };
    aviso(tr({ es: 'Preparando la imagen 3D de la portada…', en: 'Rendering the cover image…' }));
    toast(tr({ es: 'Generando el juego de planos en PDF…', en: 'Building the drawing set PDF…' }));
    let render = null;
    try { const k = proporcionPortada(app.S); render = capturar({ w: 1500, h: Math.round(1500 / k) }); } catch { /* sin 3D: la portada usa la fachada */ }
    await new Promise(r => setTimeout(r, 30));
    const L = juegoDeLaminas(app.M, app.S, { render });
    try {
      const blob = await laminasAPDF(L, { titulo: app.S.nombre, autor: app.S.proyecto.empresa, asunto: tr({ es: 'Juego de planos de anteproyecto', en: 'Preliminary drawing set' }), progreso: (i, n) => aviso(tr({ es: `Lámina ${i} de ${n}…`, en: `Sheet ${i} of ${n}…` })) });
      descargar(`${slug(app.S.nombre)}_juego-de-planos.pdf`, blob);
      aviso(tr({ es: `Listo: ${L.length} láminas.`, en: `Done: ${L.length} sheets.` }));
    } catch (e) { console.error(e); aviso('PDF: ' + e.message); }
  },
  expGLB() { exportarGLB(); },
  expUSDZ() { exportarUSDZ(); },
  expCSV() { if (!app.M?.err) descargar(`${slug(app.S.nombre)}_presupuesto.csv`, toCSV(app.M, app.S), 'text/csv;charset=utf-8'); },
  expGen() { if (!app.M?.err && app.M.quant.gen) descargar(`${slug(app.S.nombre)}_generadores.csv`, generadoresCSV(app.M, app.S), 'text/csv;charset=utf-8'); },
  expJSON() { descargar(`${slug(app.S.nombre)}.json`, JSON.stringify(app.S, null, 2), 'application/json'); },
  arAxMaqueta() { if (condominioActivo()) mostrarCondominio(false); iniciarARAxiona({ modo: 'maqueta' }); },
  arAxLote() { if (condominioActivo()) mostrarCondominio(false); iniciarARAxiona({ modo: 'lote' }); },
  arAxGiro() { if (condominioActivo()) mostrarCondominio(false); iniciarARAxiona({ modo: 'giro' }); },
  arAxCondo() { if (!ensure3D()) return; mostrarCondominio(true, eligeLote); iniciarARAxiona({ modo: 'maqueta', contenido: 'condo' }); },
  arAxPDF() { descargarMarcadores({ ladoCm: preferenciasAR().lado }); },
  arAxMostrar() { mostrarMarcador(0); },
  arMeasure() { iniciarAR('measure'); },
  arPlace() { if (condominioActivo()) mostrarCondominio(false); iniciarAR('place'); },
  arIOS() { verEnIPhone(false); },
  arCondo() { if (!ensure3D()) return; mostrarCondominio(true, eligeLote); iniciarAR('condo'); },
  arCondoIOS() { if (!ensure3D()) return; mostrarCondominio(true, eligeLote); verEnIPhone(true); },
  foto() {
    const url = capturar({ w: 1920, h: 1200, vista: $('#techoBtn').getAttribute('aria-pressed') === 'true' ? 'interior' : 'exterior' });
    if (url) fetch(url).then(r => r.blob()).then(b => descargar(`${slug(app.S.nombre)}_3d.jpg`, b));
  },
  recorrido() { if (condominioActivo()) mostrarCondominio(false); if (ensure3D()) { if (app.threeDirty) buildScene(); iniciarRecorrido({ adentro: false }); } },
  recorridoCasa() { showTab('modelo'); ACT.recorrido(); },
  condo3D() { showTab('modelo'); if (ensure3D()) { const r = mostrarCondominio(true, eligeLote); if (!r?.grupo) toast(tr({ es: 'No caben lotes con estas medidas.', en: 'No lots fit with these dimensions.' })); } },
  entrarLote(b) { toast(tr({ es: `Lote ${b.dataset.lote}: entrando a la casa…`, en: `Lot ${b.dataset.lote}: entering the house…` })); ACT.recorridoCasa(); },
  aplicarImport() {
    if (!importado) return;
    const marcados = $$('[data-imp]').filter(c => c.checked).map(c => +c.dataset.imp);
    const n = aplicarPropuestas(importado, marcados);
    importado = null;
    cargarProyecto(app.S, tr({ es: `${n} datos aplicados al proyecto.`, en: `${n} values applied.` }));
  },
  async compartir() {
    const url = await enlaceDelProyecto(app.S);
    const texto = tr({ es: `Mira este proyecto en Axiona Obra: planos, 3D amoblado y presupuesto de «${app.S.nombre || 'mi casa'}».`, en: `See this project in Axiona Obra: drawings, furnished 3D and budget for “${app.S.nombre || 'my house'}”.` });
    try {
      if (navigator.share) { await navigator.share({ title: 'Axiona Obra', text: texto, url }); return; }
      await navigator.clipboard.writeText(url);
      toast(tr({ es: 'Enlace copiado: pégalo en WhatsApp o donde quieras.', en: 'Link copied: paste it anywhere.' }));
    } catch (e) {
      if (e?.name !== 'AbortError') prompt(tr({ es: 'Copia este enlace:', en: 'Copy this link:' }), url);
    }
  },
  nuevo() {
    if (!confirm(tr({ es: 'Empezar un proyecto en blanco: lote de 10 × 20 m y una casa básica de un piso. El proyecto actual se reemplaza (descárgalo antes si lo quieres guardar).', en: 'Start a blank project: 10 × 20 m lot and a basic one-storey house. The current project is replaced (download it first to keep it).' }))) return;
    cargarProyecto(proyectoEnBlanco(), tr({ es: 'Proyecto en blanco: ahora agrega tus espacios.', en: 'Blank project: now add your rooms.' }));
    showTab('programa');
  },
  axi() { abrirAxi(); },
  soporte() { abrirAxi({ contacto: true }); },
  resenas() { abrirAxi({ formulario: 'resena' }); },
  verPrograma() { showTab('programa'); },
  instalar() {
    if (!avisoInstalar) return;
    avisoInstalar.prompt();
    avisoInstalar.userChoice.finally(() => { avisoInstalar = null; $('#bInstalar').hidden = true; });
  },
};

function eligeLote(id) {
  const S = app.S, est = S.condominio.estados[id] || 'libre';
  toast(tr({ es: `Lote ${id} · ${nombreEstado(est)}. Para entrar a la casa usa «Recorrer la casa».`, en: `Lot ${id} · ${nombreEstado(est)}. Use “Walk through” to go inside.` }));
}

/* ---------------- Axi y edición sobre el plano ---------------- */
function proyectoEnBlanco() {
  const pid = app.S.pais, S = clonar(DEFAULT_STATE);
  Object.assign(S, datosDePais(pid), { idioma: app.S.idioma, domotica: domoticaPorDefecto(pid), tramites: {} });
  S.profesionales = PAISES[pid].profesionales.map(p => ({ rol: p.id, nombre: '', doc: '' }));
  const en = app.S.idioma === 'en';
  Object.assign(S, {
    nombre: en ? 'My house' : 'Mi casa', floors: 1, spots: [], frente: 0,
    lot: [{ x: 0, y: 0, z: 0 }, { x: 10, y: 0, z: 0 }, { x: 10, y: 20, z: 0 }, { x: 0, y: 20, z: 0 }],
    rooms: [
      { name: en ? 'Living-dining' : 'Sala-comedor', area: 22, floor: 1, zone: 'social' },
      { name: en ? 'Kitchen' : 'Cocina', area: 9, floor: 1, zone: 'servicio' },
      { name: en ? 'Main bedroom' : 'Alcoba principal', area: 12, floor: 1, zone: 'privada' },
      { name: en ? 'Bathroom' : 'Baño', area: 4, floor: 1, zone: 'servicio' },
      { name: en ? 'Laundry' : 'Patio de ropas', area: 4, floor: 1, zone: 'servicio' },
    ],
  });
  return S;
}

function contextoAxi() {
  const S = app.S, M = app.M, ok = M && !M.err, T = ok ? totales(M, S.prices, S.pais) : { total: 0 };
  return {
    S, M, total: T.total, m2: ok ? T.total / M.built : 0, money, fmtA, paisNombre: tr(P().nombre),
    estilos: Object.fromEntries(Object.entries(ESTILOS).map(([k, E]) => [k, tr(E.n)])),
    plantillas: Object.fromEntries(Object.entries(PLANTILLAS[S.pais] || {}).map(([k, p]) => [k, tr(p.titulo)])),
    sistemas: P().sistemas.map(k => [k, tr(nombreSistema(S.pais, k))]),
  };
}

function aplicarCambio(fn) { fn(app.S); guardar(); renderShell(); recompute(); pintarTab(tabActual); }

async function ejecutarAxi(h) {
  switch (h.tipo) {
    case 'tab': showTab(h.tab); break;
    case 'vista': app.planView = h.v; if (tabActual !== 'planos') showTab('planos'); else { renderPlanViews(); renderPlan(); } break;
    case 'set': aplicarCambio(S => setP(S, h.p, h.v)); break;
    case 'room+': aplicarCambio(S => { S.rooms.push({ ...h.room }); }); break;
    case 'room-': aplicarCambio(S => { S.rooms.splice(h.i, 1); }); break;
    case 'room=': aplicarCambio(S => { Object.assign(S.rooms[h.i], h.cambios); }); break;
    case 'estilo': aplicarCambio(S => { S.acabados.estilo = h.k; }); break;
    case 'piso': aplicarCambio(S => {
      if (h.key !== '*') { S.acabados.pisos[h.key] = h.k; return; }
      app.M?.floors?.forEach(fl => fl.rects.filter(r => !r.stair && !r.asc).forEach(r => { S.acabados.pisos[`${fl.f + 1}:${r.name}`] = h.k; }));
    }); break;
    case 'lote': aplicarCambio(S => Object.assign(S, { lot: [{ x: 0, y: 0, z: 0 }, { x: h.w, y: 0, z: 0 }, { x: h.w, y: h.d, z: 0 }, { x: 0, y: h.d, z: 0 }], spots: [], frente: 0 })); break;
    case 'pais': cambiarPais(h.id); break;
    case 'idioma': cambiarIdioma(h.l); break;
    case 'plantilla': { const pl = PLANTILLAS[app.S.pais]?.[h.k]; if (pl) cargarProyecto({ ...pl.estado(), idioma: app.S.idioma }, tr({ es: `Cargado: ${tr(pl.titulo)}.`, en: `Loaded: ${tr(pl.titulo)}.` })); break; }
    case 'nuevo': cargarProyecto(proyectoEnBlanco(), tr({ es: 'Proyecto en blanco.', en: 'Blank project.' })); break;
    case 'fase': if (tabActual !== 'modelo') showTab('modelo'); document.querySelector(`[data-cat="${h.cat}"]`)?.click(); break;
    case 'act': await ACT[h.a]?.(); break;
    case 'abrir': window.open(h.url, '_blank', 'noopener'); break;
  }
}

/** Tocar un espacio en el plano abre su editor (nombre, área, piso y zona). */
function conectarEdicionPlano() {
  const box = $('#planBox');
  let toque = null;
  box.addEventListener('pointerdown', e => {
    const el = document.elementsFromPoint(e.clientX, e.clientY).find(x => x.dataset?.room !== undefined);
    toque = el ? { x: e.clientX, y: e.clientY, name: el.dataset.room, f: +el.dataset.f } : null;
  }, true);
  box.addEventListener('pointerup', e => {
    if (!toque || Math.hypot(e.clientX - toque.x, e.clientY - toque.y) > 6) { toque = null; return; }
    const t = toque; toque = null;
    abrirEditorEspacio(t.name, t.f, e.clientX, e.clientY);
  });
  document.addEventListener('pointerdown', e => {
    const ed = $('#edEsp');
    if (ed && !ed.contains(e.target) && !e.target.closest('#planBox')) ed.remove();
  });
}

function abrirEditorEspacio(nombre, f, x, y) {
  const S = app.S;
  let i = S.rooms.findIndex(r => r.name === nombre && +r.floor === f + 1);
  if (i < 0) i = S.rooms.findIndex(r => r.name === nombre);
  if (i < 0) return;
  $('#edEsp')?.remove();
  const r = S.rooms[i];
  const zonas = ZONAS.map(z => [z, tr({ social: { es: 'social', en: 'social' }, privada: { es: 'privada', en: 'private' }, servicio: { es: 'servicio', en: 'service' } }[z])]);
  document.body.insertAdjacentHTML('beforeend', `<div class="ed-esp" id="edEsp" role="dialog" aria-label="${esc(r.name)}">
    <h3><span>${tr({ es: 'Editar espacio', en: 'Edit room' })}</span><button class="btn x" data-ed="cerrar" aria-label="×">×</button></h3>
    <label class="fila"><span>${tr({ es: 'Nombre', en: 'Name' })}</span><input data-ed="name" value="${esc(r.name)}" maxlength="40"></label>
    <div class="fila"><span>${tr({ es: 'Área', en: 'Area' })} (${uA()})</span><div class="area"><button data-ed="menos" aria-label="−">−</button><input type="number" inputmode="decimal" step="0.5" data-ed="area" value="${aPantalla(r.area, 'A')}"><button data-ed="mas" aria-label="+">+</button></div></div>
    <label class="fila"><span>${tr({ es: 'Piso', en: 'Floor' })}</span><select data-ed="floor">${Array.from({ length: S.floors }, (_, k) => `<option value="${k + 1}" ${k + 1 === +r.floor ? 'selected' : ''}>${k + 1}</option>`).join('')}</select></label>
    <label class="fila"><span>${tr({ es: 'Zona', en: 'Zone' })}</span><select data-ed="zone">${zonas.map(([k, n]) => `<option value="${k}" ${k === r.zone ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
    <div class="acc"><button class="btn sm" data-ed="duplicar">${tr({ es: 'Duplicar', en: 'Duplicate' })}</button><button class="btn sm" data-ed="eliminar">${tr({ es: 'Eliminar', en: 'Delete' })}</button><button class="btn sm pri" data-ed="cerrar">${tr({ es: 'Listo', en: 'Done' })}</button></div>
  </div>`);
  const ed = $('#edEsp'), w = ed.offsetWidth, h = ed.offsetHeight;
  ed.style.left = Math.max(12, Math.min(window.innerWidth - w - 12, x - w / 2)) + 'px';
  ed.style.top = Math.max(12, Math.min(window.innerHeight - h - 12, y + 14)) + 'px';
  let tm = null;
  const room = () => S.rooms[i];
  const aplicar = (inmediato = false) => {
    guardar();
    clearTimeout(tm);
    const go = () => { recompute(); if ($('#roomBody')) renderRooms(); };
    if (inmediato) go(); else tm = setTimeout(go, 300);
  };
  ed.addEventListener('input', e => {
    const k = e.target.dataset.ed;
    if (k === 'name') { const v = e.target.value.trim(); if (v) { room().name = v; aplicar(); } }
    if (k === 'area') { const v = parseFloat(e.target.value); if (Number.isFinite(v) && v > 0) { room().area = +aMetros(v, 'A').toFixed(2); aplicar(); } }
  });
  ed.addEventListener('change', e => {
    const k = e.target.dataset.ed;
    if (k === 'floor') { room().floor = +e.target.value; aplicar(true); }
    if (k === 'zone') { room().zone = e.target.value; aplicar(true); }
  });
  ed.addEventListener('click', e => {
    const k = e.target.closest('[data-ed]')?.dataset.ed;
    if (k === 'cerrar') ed.remove();
    if (k === 'mas' || k === 'menos') {
      const nv = Math.max(1.5, +(room().area + (k === 'mas' ? 1 : -1)).toFixed(2));
      room().area = nv; ed.querySelector('[data-ed="area"]').value = aPantalla(nv, 'A'); aplicar();
    }
    if (k === 'duplicar') {
      const base = room().name.replace(/ \d+$/, '');
      let n = 2; while (S.rooms.some(x => x.name === `${base} ${n}`)) n++;
      S.rooms.push({ ...room(), name: `${base} ${n}` });
      ed.remove(); aplicar(true);
      toast(tr({ es: `Agregado: ${base} ${n}.`, en: `Added: ${base} ${n}.` }));
    }
    if (k === 'eliminar') {
      const nom = room().name;
      S.rooms.splice(i, 1); ed.remove(); aplicar(true);
      toast(tr({ es: `Eliminado: ${nom}. El piso se redistribuye.`, en: `Deleted: ${nom}. The floor is re-laid out.` }));
    }
  });
}

/* ---------------- entradas ---------------- */
let tmr = null;
const REPINTAR = new Set(['sistema', 'cubierta.tipo', 'laminas.papel', 'sotano', 'amoblar', 'ascensor', 'mx.entidad', 'forma.tipo']);
function conectarEntradas() {
  document.addEventListener('input', e => {
    const el = e.target;
    if (el.id === 'arLado') { const v = parseFloat(el.value); if (v >= 3) guardarPreferenciasAR({ lado: v }); return; }
    if (el.dataset.q) {
      const v = parseFloat(el.value);
      app.S.qadm = Number.isFinite(v) && v > 0 ? (usaTm2(app.S.pais) ? v : v / 9.80665) : 0;
      guardar(); clearTimeout(tmr); tmr = setTimeout(recompute, 220);
      return;
    }
    const p = el.dataset.p;
    if (!p) return;
    let v = el.type === 'checkbox' ? el.checked : el.type === 'number' ? parseFloat(el.value) : el.value;
    if (el.type === 'number' && !Number.isFinite(v)) return;
    if (el.dataset.u) v = +aMetros(v, el.dataset.u).toFixed(4);
    if (p === 'frente') v = +v;
    setP(app.S, p, v);
    guardar();
    if (p.startsWith('prices.')) { actualizarPresupuesto(); return; }
    if (p === 'mx.salario') { clearTimeout(tmr); tmr = setTimeout(pintarFSRRes, 200); return; }
    if (p.startsWith('condominio.')) { clearTimeout(tmr); tmr = setTimeout(() => { renderVentas(); if (condominioActivo()) mostrarCondominio(true, eligeLote); }, 260); return; }
    if (p.startsWith('proyecto.') || p === 'nombre' || p.startsWith('profesionales.')) { renderShell(); if (tabActual === 'planos') renderLaminaPrevia(); if (p === 'proyecto.aprobado') { const s = $('.semaforo'); if (s) s.outerHTML = semaforo(); } return; }
    if (p === 'dlAuto' && $('#dlInput')) $('#dlInput').disabled = !!v;
    clearTimeout(tmr);
    tmr = setTimeout(() => { recompute(); if (REPINTAR.has(p)) pintarTab(tabActual); }, 220);
  });
  document.addEventListener('change', e => {
    const el = e.target;
    if (el.dataset.p === 'frente') recompute();
    if (el.id === 'plantillaSel') {
      const pl = PLANTILLAS[app.S.pais]?.[el.value];
      el.value = '';
      if (pl) cargarProyecto({ ...pl.estado(), idioma: app.S.idioma }, tr({ es: `Cargado: ${tr(pl.titulo)}.`, en: `Loaded: ${tr(pl.titulo)}.` }));
    }
    if (el.dataset.piso !== undefined) { if (el.value) app.S.acabados.pisos[el.dataset.piso] = el.value; else delete app.S.acabados.pisos[el.dataset.piso]; guardar(); recompute(); }
    if (el.dataset.domo) { const s = new Set(app.S.domotica); if (el.checked) s.add(el.dataset.domo); else s.delete(el.dataset.domo); app.S.domotica = [...s]; guardar(); recompute(); renderInteriores(); }
    if (el.dataset.lamtoggle) { const s = new Set(app.S.laminas.ocultas); if (el.checked) s.delete(el.dataset.lamtoggle); else s.add(el.dataset.lamtoggle); app.S.laminas.ocultas = [...s]; guardar(); renderLaminas(); }
    if (el.id === 'impJSON') {
      const f = el.files[0];
      if (!f) return;
      const rd = new FileReader();
      rd.onload = () => {
        try { const s = JSON.parse(rd.result); if (!s.lot || !s.rooms) throw new Error('x'); cargarProyecto(s, tr({ es: 'Proyecto cargado.', en: 'Project loaded.' })); }
        catch { toast(tr({ es: 'El archivo no es un proyecto de Axiona Obra.', en: 'Not an Axiona Obra project file.' })); }
      };
      rd.readAsText(f);
      el.value = '';
    }
    if (el.id === 'impDoc') {
      const f = el.files[0];
      el.value = '';
      if (!f) return;
      const est = $('#impEstado');
      est.textContent = tr({ es: `Leyendo ${f.name}…`, en: `Reading ${f.name}…` });
      leerArchivo(f, (i, n) => { est.textContent = tr({ es: `Leyendo página ${i} de ${n}…`, en: `Reading page ${i} of ${n}…` }); })
        .then(leido => {
          importado = propuestas(leido);
          est.textContent = tr({ es: `${f.name}: ${importado.lista.length} datos encontrados en ${importado.letras.toLocaleString()} caracteres. Revisa y marca lo que quieres aplicar.`, en: `${f.name}: ${importado.lista.length} values found in ${importado.letras.toLocaleString()} characters. Review and tick what to apply.` });
          $('#impBox').innerHTML = htmlPropuestas(importado) + (importado.lista.length ? `<div class="row" style="margin-top:10px"><button class="btn pri" data-act="aplicarImport">${tr({ es: 'Aplicar lo marcado', en: 'Apply selected' })}</button></div>` : '');
        })
        .catch(err => { console.error(err); est.textContent = tr({ es: 'No pude leer el archivo: ', en: 'Could not read the file: ' }) + err.message; });
    }
  });
  document.addEventListener('click', e => {
    const t = e.target;
    const pais = t.closest('[data-pais]'); if (pais) return cambiarPais(pais.dataset.pais);
    const idi = t.closest('[data-idioma]');
    if (idi) { cambiarIdioma(idi.dataset.idioma); return; }
    const un = t.closest('[data-unid]');
    if (un) { app.S.unidades = un.dataset.unid; guardar(); renderShell(); recompute(); pintarTab(tabActual); return; }
    const tab = t.closest('.tab'); if (tab) return showTab(tab.dataset.tab);
    const d = t.closest('[data-del]');
    if (d) {
      const [arr, i] = d.dataset.del.split('.');
      if (arr === 'lot' && app.S.lot.length <= 3) { toast(tr({ es: 'El lote necesita al menos 3 vértices.', en: 'The lot needs at least 3 corners.' })); return; }
      app.S[arr].splice(+i, 1);
      guardar();
      if (arr === 'rooms') renderRooms(); else if (arr === 'profesionales') renderProyecto(); else renderLot();
      recompute();
      return;
    }
    const paso = t.closest('[data-paso]');
    if (paso) { const id = paso.dataset.paso; app.S.tramites[id] = ((app.S.tramites[id] || 0) + 1) % 3; guardar(); renderProyecto(); return; }
    const v = t.closest('[data-view]'); if (v) { app.planView = v.dataset.view; renderPlanViews(); renderPlan(); return; }
    const lam = t.closest('[data-lam]'); if (lam) { laminaSel = lam.dataset.lam; renderLaminas(); return; }
    const est = t.closest('[data-estilo]'); if (est) { app.S.acabados.estilo = est.dataset.estilo; guardar(); recompute(); renderInteriores(); return; }
    const q = t.closest('[data-quitar]');
    if (q) { const s = new Set(app.S.muebles.quitar); if (s.has(q.dataset.quitar)) s.delete(q.dataset.quitar); else s.add(q.dataset.quitar); app.S.muebles.quitar = [...s]; guardar(); recompute(); renderInteriores(); return; }
    const a = t.closest('[data-act]');
    if (a) ACT[a.dataset.act]?.(a);
  });
}

/* ---------------- app instalable ---------------- */
function conectarInstalacion() {
  if (import.meta.env.PROD && 'serviceWorker' in navigator) {
    addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(e => console.warn('[sw]', e)));
  }
  addEventListener('beforeinstallprompt', e => { e.preventDefault(); avisoInstalar = e; $('#bInstalar').hidden = false; });
  addEventListener('appinstalled', () => { avisoInstalar = null; $('#bInstalar').hidden = true; });
}

/* ---------------- arranque ---------------- */
async function iniciar() {
  const compartido = await proyectoDelEnlace();
  app.S = compartido ? normalizarEstado(compartido) : (cargarGuardado() || clonar(DEFAULT_STATE));
  // el idioma lo escoge quien abre el enlace, aunque el proyecto compartido venga en otro
  const escogido = idiomaEscogido();
  if (escogido) app.S.idioma = escogido;
  else if (!cargarGuardado() && /^en/i.test(navigator.language || '')) app.S.idioma = 'en';
  setIdioma(app.S.idioma);
  traducirEspacios(app.S, app.S.idioma);
  if (compartido || escogido) guardar();
  conectarEntradas();
  conectarControles3D();
  conectarAR(lot => {
    Object.assign(app.S, { lot, spots: [], frente: 0 });
    guardar(); recompute(); showTab('terreno');
    toast(tr({ es: `Lote medido en AR: ${lot.length} vértices, ${fm(app.M.lotArea || 0, 1)} m².`, en: `Lot measured in AR: ${lot.length} corners, ${fm(app.M.lotArea || 0, 1)} m².` }));
  });
  instalarPanZoom($('#planBox'));
  conectarEdicionPlano();
  instalarPanZoom($('#laminaBox'));
  conectarInstalacion();
  iniciarAxi({ contexto: contextoAxi, ejecutar: ejecutarAxi });
  renderShell();
  recompute();
  const h0 = (location.hash || '').slice(1);
  showTab(TABS.includes(h0) ? h0 : 'proyecto');
  // primera visita: lo primero es escoger el idioma; después Axi se presenta en ese idioma
  if (!escogido) cambiarIdioma(await pedirIdioma());
  else { try { localStorage.setItem(KEY_IDIOMA, app.S.idioma); } catch { /* modo privado */ } $('#idiomaInicio')?.setAttribute('hidden', ''); }
  saludoPrimeraVisita();
  if (compartido) toast(tr({ es: `Abriste un proyecto compartido: ${app.S.nombre || 'sin nombre'}.`, en: `Opened a shared project: ${app.S.nombre || 'untitled'}.` }));
  // Acceso para pruebas en desarrollo; no sale en la version publicada.
  if (import.meta.env.DEV) window.__obra = { app, recompute, showTab, ACT, juegoDeLaminas, capturar, iniciarRecorrido, mostrarCondominio, tres };
}

iniciar();

export { TIPOS_ESPACIO, MUEBLES, fases };
