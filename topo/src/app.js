/* ==========================================================================
   AXIONA TOPO · La app
   --------------------------------------------------------------------------
   Cuatro pantallas: MEDIR (GPS, camara, cinta, nivel y mira, archivo),
   PLANO (lindero, curvas, corte y relleno, pendientes), 3D · RAYOS X
   (holograma, escaner, AR en la palma) y COMPARTIR (enlace, Axiona Obra y
   archivos). El levantamiento se guarda en el celular; nada sale del
   telefono salvo el enlace que el usuario decida mandar.
   ========================================================================== */

import { nuevoLevantamiento, normalizar, calcular, siguienteId } from './motor/levantamiento.js';
import { aLocal } from './motor/geo.js';
import { loteACinta, ajustarCinta, medidasDeCinta, rumbo } from './motor/poligono.js';
import { conDistancia, conMira, alturaObjeto, pendienteDe, calibracionPorInversion } from './motor/mira.js';
import { enlaceDe, deEnlace } from './motor/compartir.js';
import { aPNEZD, aDXF, aKML, aGeoJSON, enlaceObra } from './motor/exportar.js';
import { leerPuntos } from './motor/importar.js';
import { lotedeEjemplo } from './motor/ejemplo.js';
import { svgPlano, svgPerfil } from './vista/plano.js';
import { iniciarHolo, pintarHolo, holo, pausarHolo, reanudarHolo } from './vista/holo.js';
import { encenderGPS, apagarGPS, escucharGPS, fijarPunto, cancelarFijado, gpsDisponible, mensajeError } from './captura/gps.js';
import { pedirPermisoSensores, escucharSensores, guardarCalibracion, calibracion } from './captura/sensores.js';
import { arDisponible, iniciarAR, palmaEnIPhone, esIOS } from './captura/ar.js';
import { abrirPalmaCamara, cerrarPalmaCamara, rayosPalmaCamara, motivoSinAR, enlaceARCore } from './captura/palma.js';
import { nuevaSesion, enlaceSesion, sesionDelEnlace, conectarSesion, esComputador, gana } from './captura/envivo.js';
import { SUELOS } from './motor/volumen.js';
import { planoPDF } from './motor/planoPDF.js';
import { svgQR } from './vista/qr.js';

const $ = s => document.querySelector(s);
const CLAVE = 'axiona-topo';
const BASE = `${location.origin}${location.pathname}`;

const A = {
  L: nuevoLevantamiento(), D: null, vista: 'medir', compartido: false, panel: null, arOk: false,
  plano: { curvas: true, tierra: false, pendiente: false, cotas: true, medidas: true },
  holo: { rayos: false, escaner: false }, holoListo: false, encuadrar: true,
  gps: { quitar: null, fijando: false },
  cinta: { n: 4, lados: [], diagonales: [], control: '', cotas: [] },
  mira: { modo: 'cinta', hi: '1.50', ht: '1.50', D: '', L: '2.00', pie: null, punta: null, res: null, estacion: '', destino: '', quitar: null, stream: null, ultimo: null, cal: null },
  nivel: { quitar: null, cal: null, ultimo: null },
  vivo: { s: null, con: null, estado: '', equipos: new Set(), recibiendo: false },
  pc: esComputador(),
};

/* ---------- formato ---------- */
const f = (v, d = 2) => Number(v).toLocaleString('es-CO', { minimumFractionDigits: d, maximumFractionDigits: d });
const fz = v => `${v >= 0 ? '+' : '−'}${f(Math.abs(v))}`;
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const numero = t => { const v = parseFloat(String(t ?? '').replace(',', '.')); return Number.isFinite(v) ? v : null; };
const areaTxt = a => (a >= 10000 ? `${f(a / 10000, 2)} ha` : `${f(a, 1)} m²`);

let tToast;
function toast(t, ms = 3200) {
  const el = $('#toast');
  el.textContent = t;
  el.classList.add('ver');
  clearTimeout(tToast);
  tToast = setTimeout(() => el.classList.remove('ver'), ms);
}

/* ---------- estado ---------- */
function guardar() {
  if (A.compartido) return;
  try { localStorage.setItem(CLAVE, JSON.stringify(A.L)); } catch { /* sin almacenamiento */ }
}
function cargar() {
  try { const s = localStorage.getItem(CLAVE); return s ? normalizar(JSON.parse(s)) : null; } catch { return null; }
}
function recalcular() {
  if (!A.vivo.recibiendo) A.L.version = (A.L.version || 0) + 1;
  A.D = calcular(A.L);
  guardar();
  pintar();
  if (A.vivo.con && !A.vivo.recibiendo) enviarVivo();
}

/* ---------- celular y computador en vivo ---------- */
function enviarVivo() {
  if (!A.vivo.con || !A.L.puntos.length) return;
  A.vivo.con.enviar(A.L, A.L.version || 0).catch(e => toast(e.message, 5000));
}

function iniciarVivo(s) {
  A.vivo.con?.cerrar();
  A.vivo.s = s;
  A.vivo.equipos = new Set();
  A.vivo.con = conectarSesion(s, {
    alRecibir: (L, equipo, v, de) => {
      if (!gana(v, de, A.L.version || 0, A.vivo.con.yo)) return;
      L.version = v;
      A.L = L; A.compartido = false;
      A.vivo.recibiendo = true;
      A.encuadrar = true;
      recalcular();
      A.vivo.recibiendo = false;
      toast(`Actualizado desde el ${equipo}: ${A.D.puntos.length} puntos.`);
    },
    alEquipo: eq => { if (!A.vivo.equipos.has(eq)) { A.vivo.equipos.add(eq); toast(`Conectado con un ${eq}.`); } pintar(); },
    alEstado: e => { A.vivo.estado = e; if (e === 'en vivo') enviarVivo(); pintarKPIs(); if (A.vista === 'datos') pintarDatos(); },
    alPedido: () => enviarVivo(),
  });
}

function cerrarVivo() {
  A.vivo.con?.cerrar();
  A.vivo = { s: null, con: null, estado: '', equipos: new Set(), recibiendo: false };
  if (/^#v=/.test(location.hash)) history.replaceState(null, '', location.pathname);
  pintar();
}

function tarjetaVivo() {
  const v = A.vivo;
  if (!v.s) {
    return `<div class="card vivo-card"><h2>Celular y computador en vivo <span class="tag">NUEVO</span></h2>
      <p class="sub">Uno mide en el lote y el otro ve el plano y el 3D al instante: el computador de la oficina, la tableta del ingeniero u otro celular. Va cifrado de punta a punta.</p>
      <button class="btn pri" data-act="vivoCrear">Conectar otro equipo</button></div>`;
  }
  const url = enlaceSesion(v.s, BASE);
  const eq = [...v.equipos];
  return `<div class="card vivo-card"><h2>En vivo <span class="tag">${esc(v.estado || 'conectando')}</span></h2>
    <div class="vivo-qr">${svgQR(url)}<div>
      <p class="sub" style="margin:0 0 8px">Escanee este código con la cámara del otro equipo (o mándele el enlace). Todo lo que se mida o cambie en uno aparece en el otro.</p>
      <p class="nota" style="margin:0 0 10px">${eq.length ? `Conectado con: <b>${eq.map(esc).join(', ')}</b>.` : 'Esperando al otro equipo…'} Va cifrado: el servidor de paso (ntfy.sh) no puede leerlo.</p>
      <div class="fila"><button class="btn sm" data-act="vivoCopiar">Copiar enlace</button><button class="btn sm peligro" data-act="vivoCerrar">Terminar</button></div>
    </div></div></div>`;
}

async function planoEnPDF(hoja) {
  if (!A.D.puntos.length) return;
  toast('Armando el plano en PDF…');
  try {
    const { jsPDF } = await import('jspdf');
    const { doc, escala } = planoPDF(A.D, A.L, jsPDF, { hoja });
    descargar(`${nombreArchivo()}-plano-${hoja}.pdf`, doc.output('blob'), 'application/pdf');
    toast(`Plano en PDF ${hoja === 'A3' ? 'A3' : 'carta'} a escala 1:${escala}.`);
  } catch (e) { toast('No se pudo armar el PDF: ' + e.message, 5000); }
}

const METODO = { gps: 'el GPS', camara: 'la cámara', cinta: 'la cinta', archivo: 'un archivo', manual: 'puntos a mano', ejemplo: 'el ejemplo', mira: 'la mira' };

/** Cambiar de metodo borra lo medido con otro: los sistemas de coordenadas no casan. */
function prepararMetodo(m) {
  const otros = A.L.puntos.length && A.L.metodo && A.L.metodo !== m;
  if (otros && !confirm(`Lo que hay viene de ${METODO[A.L.metodo] || A.L.metodo}. ¿Empezar de nuevo con ${METODO[m] || m}? Se borran los puntos actuales.`)) return false;
  if (otros || !A.L.puntos.length) {
    const nombre = A.L.metodo === 'ejemplo' ? '' : A.L.nombre;
    A.L = nuevoLevantamiento(nombre);
    A.compartido = false;
  }
  A.L.metodo = m;
  return true;
}

/* ---------- pintura general ---------- */
function pintar() {
  pintarKPIs();
  pintarBanner();
  if (A.vista === 'medir') pintarMedir();
  if (A.vista === 'plano') pintarPlano();
  if (A.vista === 'holo') pintarHoloVista();
  if (A.vista === 'datos') pintarDatos();
}

function pintarKPIs() {
  const D = A.D;
  $('#kpis').innerHTML = D && D.puntos.length ? [
    D.area ? `<div class="kpi"><b>${areaTxt(D.area)}</b><span>área</span></div>` : '',
    `<div class="kpi"><b>${D.puntos.length}</b><span>puntos</span></div>`,
    !D.sinNiveles ? `<div class="kpi"><b>${f(D.desnivel)} m</b><span>desnivel</span></div>` : '',
  ].join('') : '';
  if (A.vivo.s) $('#kpis').insertAdjacentHTML('afterbegin', `<button class="kpi vivo-kpi${A.vivo.estado === 'en vivo' ? ' on' : ''}" data-vista-ir="datos"><b>● ${esc(A.vivo.estado || 'conectando')}</b><span>${A.vivo.equipos.size ? esc([...A.vivo.equipos].join(', ')) : 'en vivo'}</span></button>`);
}

function pintarBanner() {
  const b = $('#banner');
  b.hidden = !A.compartido;
  if (A.compartido) b.innerHTML = `<span>Está viendo un levantamiento compartido: <b>${esc(A.L.nombre || 'sin nombre')}</b>.</span><button class="btn sm pri" data-act="guardarCompartido">Guardar en este celular</button>`;
}

function irA(v) {
  if (A.vista === 'holo' && v !== 'holo') pausarHolo();
  A.vista = v;
  for (const id of ['medir', 'plano', 'holo', 'datos']) $(`#v-${id}`).hidden = id !== v;
  document.querySelectorAll('.dock button').forEach(b => (b.dataset.vista === v ? b.setAttribute('aria-current', 'page') : b.removeAttribute('aria-current')));
  if (v === 'holo') { reanudarHolo(); A.encuadrar = true; }
  pintar();
  window.scrollTo({ top: 0 });
}

/* ---------- MEDIR ---------- */
const ICON = {
  gps: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3.2" fill="currentColor"/><circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M12 1v4M12 19v4M1 12h4M19 12h4" stroke="currentColor" stroke-width="1.6"/></svg>',
  camara: '<svg viewBox="0 0 24 24"><path d="M4 8h3l2-3h6l2 3h3v11H4z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><circle cx="12" cy="13" r="3.5" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M2 21 8 17M22 21l-6-4" stroke="currentColor" stroke-width="1.2" opacity=".6"/></svg>',
  cinta: '<svg viewBox="0 0 24 24"><circle cx="9" cy="12" r="6.5" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="9" cy="12" r="2" fill="currentColor"/><path d="M9 18.5h13v-3h-2M14 18.5v-1.5M17 18.5v-1.5" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>',
  mira: '<svg viewBox="0 0 24 24"><path d="M3 20h18M7 20l3-14h4l3 14M10 6V3h4v3" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M5 11h14" stroke="currentColor" stroke-width="1.2" stroke-dasharray="2 2"/></svg>',
};

function intro() {
  return `<div class="card intro">
    <h1>El topógrafo, <em>en tu celular y tu computador</em></h1>
    <p>Sin estación total, sin trípode y sin libreta. El celular mide en el lote; el computador ve el plano y el 3D al instante y saca el plano en PDF listo para firmar. Área, niveles, curvas, tierra a mover y el terreno con rayos X.</p>
    <ul>
      <li>Linderos y área: con GPS en fincas, con la cámara o con cinta.</li>
      <li>Cotas a distancia con la mira, como un teodolito.</li>
      <li>Curvas de nivel, pendiente y hacia dónde corre el agua.</li>
      <li>Corte, relleno y viajes de volqueta para la plataforma.</li>
      <li>Replanteo: estacas virtuales donde va la obra, con lo que hay que cortar.</li>
      <li>Holograma en la palma de la mano, para mostrarlo a todo el equipo.</li>
      <li>Celular y computador conectados en vivo, cifrado.</li>
    </ul>
    <div class="fila"><button class="btn pri" data-act="ejemplo">Ver un ejemplo</button><a class="btn" href="#metodos">Empezar a medir</a></div>
  </div>`;
}

function tarjetaMetodo(m, titulo, txt, tag) {
  return `<button class="metodo${A.panel === m ? ' activo' : ''}" data-act="metodo" data-m="${m}">${ICON[m]}<i>${tag}</i><b>${titulo}</b><span>${txt}</span></button>`;
}

function panelGPS() {
  const n = A.L.puntos.filter(p => p.tipo === 'esquina').length;
  return `<div class="card" id="panelGPS">
    <h2>GPS <span class="tag">EN VIVO</span></h2>
    <div class="vivo"><div class="radar"><b></b></div><div><div class="prec" id="gpsPrec">Buscando…</div><div class="sub" id="gpsInfo">Salga a cielo abierto, lejos de muros y árboles.</div></div></div>
    <div class="barra" id="gpsBarra" hidden><i></i></div>
    <p class="nota">Empiece por una esquina del <b>frente</b> y siga en orden por el borde del lote. Párese encima de cada esquina con el celular quieto a la altura del pecho; el celular promedia unos 12 segundos.</p>
    <div class="fila" style="margin-top:10px">
      <button class="btn pri" data-act="gpsFijar" data-tipo="esquina" ${A.gps.fijando ? 'disabled' : ''}>Fijar esquina ${esc(siguienteId(A.L, 'esquina'))}</button>
      <button class="btn" data-act="gpsFijar" data-tipo="nivel" ${A.gps.fijando ? 'disabled' : ''}>Punto interior</button>
      ${A.gps.fijando ? '<button class="btn peligro" data-act="gpsCancelar">Cancelar</button>' : ''}
      <button class="btn" data-act="gpsTerminar">${n >= 3 ? 'Listo' : 'Cerrar'}</button>
    </div>
    <p class="aviso">La altura del GPS del celular falla por varios metros: las cotas se toman después con la <b>mira</b> (Nivel y mira) o con la cámara. Con una <b>antena RTK</b> conectada al celular, los puntos salen al centímetro y la cota sale sola.</p>
  </div>`;
}

function diagramaCinta(n) {
  const P = [];
  for (let k = 0; k < n; k++) { const a = (225 + k * 360 / n) * Math.PI / 180; P.push([150 + 115 * Math.cos(a), 110 - 85 * Math.sin(a)]); }
  const diag = [];
  for (let k = 2; k <= n - 2; k++) diag.push(`<path d="M${P[0][0]} ${P[0][1]}L${P[k][0]} ${P[k][1]}" stroke="#ffae2b" stroke-width="2" stroke-dasharray="6 5"/>`);
  return `<svg class="diagrama" viewBox="0 0 300 220" aria-label="Orden de las esquinas">
    <path d="M${P.map(p => p.join(' ')).join('L')}Z" fill="#3fcfff14" stroke="#3fcfff" stroke-width="2.5"/>${diag.join('')}
    ${P.map((p, i) => `<circle cx="${p[0]}" cy="${p[1]}" r="12" fill="#04131c" stroke="#3fcfff" stroke-width="2"/><text x="${p[0]}" y="${p[1] + 4.5}" text-anchor="middle">${i + 1}</text>`).join('')}
    <text x="150" y="214" text-anchor="middle" fill="#8695a8" style="font-size:11px">CALLE · frente: 1 → 2</text></svg>`;
}

function panelCinta() {
  const c = A.cinta, n = c.n;
  const campo = (k, i, label, val) => `<div class="campo"><label>${label}</label><input inputmode="decimal" data-cinta="${k}" data-i="${i}" value="${esc(val ?? '')}" placeholder="m"></div>`;
  const lados = Array.from({ length: n }, (_, i) => campo('lados', i, `Lado ${i + 1}→${(i + 1) % n + 1}${i === 0 ? ' · frente' : ''}`, c.lados[i])).join('');
  const diags = Array.from({ length: Math.max(0, n - 3) }, (_, k) => campo('diagonales', k, `Diagonal 1→${k + 3}`, c.diagonales[k])).join('');
  const cotas = Array.from({ length: n }, (_, i) => campo('cotas', i, `Cota esquina ${i + 1}`, c.cotas[i])).join('');
  return `<div class="card" id="panelCinta">
    <h2>Lote a cinta</h2>
    <p class="sub">Numere las esquinas mirando el lote desde la calle: la <b>1</b> es la del frente a la izquierda y se sigue por el frente. Mida cada lado y las diagonales que salen de la esquina 1 (las punteadas).</p>
    <div class="campo" style="max-width:200px"><label>Esquinas</label><select data-act-cambio="cintaN">${[3, 4, 5, 6, 7, 8, 9, 10].map(k => `<option ${k === n ? 'selected' : ''}>${k}</option>`).join('')}</select></div>
    ${diagramaCinta(n)}
    <div class="campos">${lados}${diags}${n >= 4 ? campo('control', 0, 'Comprobación 2→4 (opcional)', c.control) : ''}</div>
    <details style="margin-top:12px"><summary class="lbl" style="cursor:pointer">Cotas de las esquinas (opcional, con manguera o nivel)</summary><div class="campos" style="margin-top:10px">${cotas}</div></details>
    <div class="fila" style="margin-top:12px"><button class="btn pri" data-act="cintaDibujar">Dibujar el lote</button><button class="btn" data-act="cerrarPanel">Cerrar</button></div>
    <div id="cintaRes"></div>
  </div>`;
}

function panelCamara() {
  const motivo = motivoSinAR();
  const texto = motivo || (esIOS()
    ? 'En iPhone, Safari todavía no permite medir con la cámara. Mida con GPS o cinta y tome las cotas con la mira.'
    : 'Medir con la cámara funciona en celulares Android con Chrome y la app «Servicios de Google Play para RA».');
  return `<div class="card"><h2>Con la cámara</h2>
    <p class="sub">${esc(texto)}</p>
    <div class="fila">${motivo && /Servicios de Google Play/.test(motivo) ? `<a class="btn pri" href="${enlaceARCore}" target="_blank" rel="noopener">Instalar Servicios de Google Play para RA</a>` : ''}<button class="btn" data-act="cerrarPanel">Entendido</button></div></div>`;
}

function panelHerramientas() {
  return `<div class="card"><h2>Nivel y mira</h2>
    <p class="sub">Los sensores de inclinación del celular, como un nivel y un teodolito de bolsillo.</p>
    <div class="acciones">
      <button class="btn" data-act="abrirNivel">Nivel de burbuja y pendiente</button>
      <button class="btn pri" data-act="abrirMira">Mira: cota a distancia</button>
    </div>
    <p class="nota">Con la mira se apunta con la cámara a un palo marcado (o a una persona) sobre cada punto y el celular calcula cuánto más alto o más bajo está. Así se le pone la cota a las esquinas medidas con GPS o con cinta.</p>
    <button class="btn" data-act="cerrarPanel" style="margin-top:10px">Cerrar</button></div>`;
}

function tablaPuntos() {
  const D = A.D;
  const filas = D.puntos.map(p => `<tr>
      <td><b>${esc(p.id)}</b></td>
      <td><button class="pill ${p.tipo === 'esquina' ? 'esq' : 'niv'}" data-act="tipo" data-id="${esc(p.id)}">${p.tipo === 'esquina' ? 'esquina' : 'nivel'}</button></td>
      <td class="n">${f(p.x)}</td><td class="n">${f(p.y)}</td>
      <td class="n"><input inputmode="decimal" data-cota="${esc(p.id)}" value="${p.estimada ? '' : f(p.z).replace(/\./g, '')}" placeholder="${p.estimada ? '~' + f(p.z) : ''}" aria-label="Cota de ${esc(p.id)}"></td>
      <td class="n" style="color:var(--mut)">${esc(p.fuente)}${p.prec ? ` ±${p.prec < 0.1 ? f(p.prec * 100, 0) + ' cm' : f(p.prec, 1) + ' m'}` : ''}</td>
      <td><button class="x" data-act="borrar" data-id="${esc(p.id)}" aria-label="Borrar ${esc(p.id)}">×</button></td>
    </tr>`).join('');
  return `<div class="card"><h2>Puntos <span class="tag">${D.puntos.length}</span></h2>
    <p class="sub">X al este y Y al norte${A.L.origen ? '' : ' (o sobre el frente del lote)'}, en metros desde ${esc(D.puntos[0]?.id || 'el primero')}. La cota se puede escribir a mano.</p>
    <div class="tabla-caja"><table class="tabla"><thead><tr><th>Punto</th><th>Tipo</th><th>X</th><th>Y</th><th>Cota</th><th>Origen</th><th></th></tr></thead><tbody>${filas}</tbody></table></div>
    ${D.estimadas && !D.sinNiveles ? `<p class="aviso">${D.estimadas} punto(s) sin cota: se estimó por cercanía (en gris). Mídalos con la mira para que el terreno quede fiel.</p>` : ''}
    <details style="margin-top:12px"><summary class="lbl" style="cursor:pointer">Agregar un punto a mano</summary>
      <div class="campos" style="margin-top:10px">
        <div class="campo"><label>X (m)</label><input inputmode="decimal" id="manoX"></div>
        <div class="campo"><label>Y (m)</label><input inputmode="decimal" id="manoY"></div>
        <div class="campo"><label>Cota (m)</label><input inputmode="decimal" id="manoZ"></div>
      </div>
      <div class="fila" style="margin-top:8px"><button class="btn sm" data-act="mano" data-tipo="esquina">Agregar esquina</button><button class="btn sm" data-act="mano" data-tipo="nivel">Agregar nivel</button></div>
    </details></div>`;
}

function resumen() {
  const D = A.D;
  if (!D.puntos.length) return '';
  const v = D.volumen;
  return `<div class="res">
    <div class="dato m"><b>${D.area ? areaTxt(D.area) : '—'}</b><span>área</span></div>
    <div class="dato"><b>${D.perimetro ? f(D.perimetro) + ' m' : '—'}</b><span>perímetro</span></div>
    <div class="dato"><b>${D.sinNiveles ? '—' : f(D.pendiente.general, 1) + ' %'}</b><span>pendiente</span></div>
    <div class="dato"><b>${D.sinNiveles || !v ? '—' : f(v.corte, 1) + ' m³'}</b><span>tierra a mover</span></div>
  </div>`;
}

function pintarMedir() {
  const D = A.D, hay = D.puntos.length > 0;
  $('#v-medir').innerHTML = '<div class="col-a">' + [
    hay ? '' : intro(),
    A.pc ? `<div class="card pc-card"><h2>En el computador</h2><p class="sub">Aquí se recibe lo que se mide con el celular, se revisa y sale el plano. Conecte el celular en vivo con un código QR, o importe los puntos de una estación total.</p><div class="fila"><button class="btn pri" data-act="vivoCrear">Recibir del celular en vivo</button></div></div>` : '',
    `<div class="card"><div class="campo"><label for="nombre">Nombre del lote</label><input id="nombre" data-campo="nombre" value="${esc(A.L.nombre)}" placeholder="Ej.: Finca de Walter, lote 3"></div>${hay ? `<div style="margin-top:12px">${resumen()}</div>` : ''}</div>`,
    `<div class="metodos" id="metodos">
      ${tarjetaMetodo('gps', 'Caminando con GPS', 'Fincas y lotes grandes. Se para en cada esquina unos segundos.', '±2–5 m')}
      ${tarjetaMetodo('camara', 'Con la cámara', 'Android con AR. Esquinas, niveles y profundidad al centímetro.', '±2–5 cm')}
      ${tarjetaMetodo('cinta', 'Con cinta métrica', 'Lados y diagonales. El celular dibuja el lote exacto.', 'exacto')}
      ${tarjetaMetodo('mira', 'Nivel y mira', 'Pendientes y cotas a distancia con los sensores.', '±5–15 cm')}
    </div>
    <div class="fila"><label class="btn sm" style="cursor:pointer">Importar puntos de estación total (.csv, .txt)<input type="file" accept=".csv,.txt,text/csv,text/plain" data-archivo="puntos" hidden></label></div>`,
    A.panel === 'gps' ? panelGPS() : '',
    A.panel === 'cinta' ? panelCinta() : '',
    A.panel === 'camara' ? panelCamara() : '',
    A.panel === 'mira' ? panelHerramientas() : '',
  ].join('') + '</div><div class="col-b">' + (hay ? tablaPuntos() : '') + '</div>';
}

/* ---------- GPS ---------- */
function abrirGPS() {
  if (!gpsDisponible()) return toast('Este navegador no tiene GPS.');
  A.panel = 'gps';
  encenderGPS();
  A.gps.quitar?.();
  A.gps.quitar = escucharGPS((l, e) => {
    const p = $('#gpsPrec'), i = $('#gpsInfo');
    if (!p) return;
    if (e) { p.textContent = 'Sin señal'; p.className = 'prec mal'; i.textContent = mensajeError(e); return; }
    const rtk = l.acc <= 0.1, corregido = l.acc < 0.5;
    p.textContent = corregido ? `±${f(l.acc * 100, 1)} cm${rtk ? ' · RTK fijo' : ' · RTK flotante'}` : `±${f(l.acc, 1)} m`;
    p.className = `prec ${l.acc <= 5 ? 'bien' : l.acc <= 12 ? 'regular' : 'mal'}`;
    i.textContent = rtk ? 'Antena RTK con solución fija: puntos y cotas al centímetro.'
      : corregido ? 'Antena con corrección, todavía flotante: espere el «fijo» para centímetros.'
        : l.acc <= 5 ? 'Buena señal: puede fijar puntos.' : l.acc <= 12 ? 'Señal regular: espere unos segundos o aléjese de muros y árboles.' : 'Señal débil: el punto saldría corrido varios metros.';
  });
  pintar();
}

function cerrarGPS() {
  A.gps.quitar?.(); A.gps.quitar = null;
  cancelarFijado();
  apagarGPS();
  A.panel = null;
  const n = A.L.puntos.filter(p => p.tipo === 'esquina').length;
  pintar();
  if (n >= 3) toast(`Lote con ${n} esquinas: ${areaTxt(A.D.area)}. Ponga las cotas con la mira.`);
}

async function fijarGPS(tipo) {
  if (!A.L.puntos.length || A.L.metodo !== 'gps') { if (!prepararMetodo('gps')) return; }
  A.gps.fijando = true;
  pintar();
  const barra = $('#gpsBarra');
  if (barra) barra.hidden = false;
  try {
    const r = await fijarPunto(12, a => {
      const b = $('#gpsBarra i'), i = $('#gpsInfo');
      if (b) b.style.width = `${Math.min(100, (a.s / a.total) * 100)}%`;
      if (i) i.textContent = a.extendido ? `Señal débil: sigo promediando para bajar el error… ${a.n} lecturas` : `Quieto… ${Math.max(0, Math.ceil(a.total - a.s))} s · ${a.n} lecturas`;
    });
    // Con RTK la altura del GPS es buena (±2-3 cm) y da la cota sin mira
    const altBuena = r.alt !== null && r.altPrec !== null && r.altPrec <= 0.1;
    if (!A.L.origen) A.L.origen = { lat: r.lat, lon: r.lon, alt: altBuena ? r.alt : null };
    else if (A.L.origen.alt == null && altBuena) A.L.origen.alt = r.alt;
    const q = aLocal(r.lat, r.lon, { lat: A.L.origen.lat, lon: A.L.origen.lon });
    const id = siguienteId(A.L, tipo);
    const z = altBuena && A.L.origen.alt != null ? +(r.alt - A.L.origen.alt).toFixed(3) : null;
    A.L.puntos.push({ id, tipo, x: +q.x.toFixed(3), y: +q.y.toFixed(3), z, fuente: 'gps', prec: +r.prec.toFixed(r.prec < 0.1 ? 3 : 1), nota: '' });
    A.L.metodo = 'gps';
    toast(`${id} fijado con ${r.n} lecturas (±${r.prec < 0.5 ? f(r.prec * 100, 1) + ' cm' : f(r.prec, 1) + ' m'}${r.rtk ? ', RTK' : ''}${z !== null ? `, cota ${fz(z)}` : ''}).`);
  } catch (e) {
    if (e.message !== 'cancelado') toast(e.message, 5000);
  }
  A.gps.fijando = false;
  recalcular();
}

/* ---------- CINTA ---------- */
function dibujarCinta() {
  const c = A.cinta, n = c.n;
  const lados = Array.from({ length: n }, (_, i) => numero(c.lados[i]));
  const diagonales = Array.from({ length: Math.max(0, n - 3) }, (_, k) => numero(c.diagonales[k]));
  const ctl = numero(c.control);
  const control = n >= 4 && ctl ? { i: 1, j: 3, medida: ctl } : null;
  const r = loteACinta({ lados, diagonales, control });
  const caja = $('#cintaRes');
  if (r.error) { caja.innerHTML = `<p class="error">${esc(r.error)}</p>`; return; }
  // Con la comprobacion hay una medida de mas: el cierre se reparte entre todas
  const ajuste = control ? ajustarCinta(medidasDeCinta({ lados, diagonales, control }), r.puntos) : null;
  if (ajuste) r.puntos = ajuste.puntos;
  const seguir = A.L.metodo === 'cinta';
  if (!seguir && !prepararMetodo('cinta')) return;
  const niveles = seguir ? A.L.puntos.filter(p => p.tipo === 'nivel') : [];
  A.L.origen = null;
  A.L.puntos = [...r.puntos.map((p, i) => ({ id: `P${i + 1}`, tipo: 'esquina', x: p.x, y: p.y, z: numero(c.cotas[i]), fuente: 'cinta', prec: null, nota: '' })), ...niveles];
  A.L.metodo = 'cinta';
  recalcular();
  let msg = `Lote dibujado: ${areaTxt(A.D.area)}.`;
  if (r.cierre) {
    const cm = Math.abs(r.cierre.diferencia) * 100, N = r.cierre.relativa > 0 ? Math.round(1 / r.cierre.relativa) : Infinity;
    const juicio = N >= 1000 ? 'muy bien medido' : N >= 300 ? 'aceptable para anteproyecto' : 'revise las medidas: algo quedó mal';
    msg += ` Comprobación 2→4: ${f(cm, 1)} cm de diferencia (precisión ${Number.isFinite(N) ? `1:${N.toLocaleString('es-CO')}` : 'exacta'}), ${juicio}.`;
    if (ajuste) {
      // Con una sola medida de mas no se puede saber cual estaba mala: se dice cuanto se movio, no cual
      const mayor = Math.max(...ajuste.residuos.map(o => Math.abs(o.residuo)));
      msg += ` El error se repartió entre todas las medidas por mínimos cuadrados; ninguna se movió más de ${f(mayor * 100, 1)} cm.`;
    }
  }
  toast(msg, 5000);
}

/* ---------- PLANO ---------- */
function pintarPlano() {
  const D = A.D, v = $('#v-plano');
  if (!D.puntos.length) { v.innerHTML = `<div class="card"><h2>Plano</h2><p class="sub">Todavía no hay puntos. Mida el lote o vea el ejemplo.</p><button class="btn pri" data-act="ejemplo">Ver un ejemplo</button></div>`; return; }
  const o = A.plano;
  const chip = (k, t) => `<button class="btn sm${o[k] ? ' activo' : ''}" data-act="planoOp" data-k="${k}">${t}</button>`;
  const ley = o.tierra ? '<div class="leyenda"><span><i style="background:#ff5f78"></i>corte (sacar tierra)</span><span><i style="background:#3fcfff"></i>relleno (poner tierra)</span></div>'
    : o.pendiente ? '<div class="leyenda"><span><i style="background:#41e2a4"></i>&lt;3 %</span><span><i style="background:#d7e05a"></i>7–12 %</span><span><i style="background:#ffae2b"></i>12–25 %</span><span><i style="background:#ff5f78"></i>&gt;50 %</span></div>' : '';
  const filas = D.lados.map((l, i) => `<tr><td>${esc(D.esquinas[l.i].id)}→${esc(D.esquinas[l.j].id)}</td><td class="n">${f(l.largo)} m</td><td class="n">${esc(l.rumbo)}</td><td class="n">${D.sinNiveles ? '—' : fz(l.dz)}</td><td class="n">${f(D.angulos[i], 1)}°</td></tr>`).join('');
  const pe = D.pendiente;
  const h = A.L.huella;
  v.innerHTML = `<div class="chips">${chip('curvas', 'Curvas de nivel')}${chip('tierra', 'Corte y relleno')}${chip('pendiente', 'Pendientes')}${chip('cotas', 'Cotas')}${chip('medidas', 'Medidas')}
      ${D.lindero.length >= 3 && !D.sinNiveles ? `<button class="btn sm${h.activa ? ' activo' : ''}" data-act="huella">Obra ${f(h.ancho, 1)} × ${f(h.fondo, 1)} m</button>` : ''}</div>
    <div class="col-a"><div class="plano-caja${h.activa ? ' mover' : ''}" id="planoCaja">${svgPlano(D, { ...o, norte: !!A.L.origen })}</div>${ley}
    ${h.activa ? `<p class="nota">La línea punteada es la obra (casa o cabaña). Toque el plano para moverla; el corte y el relleno se calculan solo ahí. ${D.volumen ? `Plataforma ${fz(D.plataforma.z)}: corte ${f(D.volumen.corte, 1)} m³, relleno ${f(D.volumen.relleno, 1)} m³.` : ''}</p>` : ''}
    <div class="fila"><button class="btn sm amb" data-act="pdf" data-k="A3">Plano en PDF (A3)</button><button class="btn sm" data-act="pdf" data-k="carta">PDF carta</button></div></div><div class="col-b">
    <div class="card"><h2>Resumen del terreno</h2>${resumen()}
      ${D.sinNiveles ? '<p class="aviso">Sin cotas no hay curvas ni movimiento de tierra. Póngalas con la mira o mida con la cámara.</p>'
    : `<p class="nota">Desnivel <b>${f(D.desnivel)} m</b> · curvas cada <b>${f(D.intervalo, 2)} m</b> · pendiente general <b>${f(pe.general, 1)} % (${f(pe.gradosGeneral, 1)}°)</b>, ${esc(pe.clase.toLowerCase())}${pe.baja !== null ? ` · el agua corre hacia <b>${esc(rumbo(pe.baja))}</b>` : ''}. El 95 % del lote tiene menos de ${f(pe.fuerte, 1)} %.</p>`}
    </div>
    ${D.lados.length ? `<div class="card"><h2>Linderos</h2><div class="tabla-caja"><table class="tabla"><thead><tr><th>Lado</th><th>Medida</th><th>Rumbo</th><th>Δ cota</th><th>Ángulo</th></tr></thead><tbody>${filas}</tbody></table></div>
      <p class="nota">Área ${areaTxt(D.area)} · perímetro ${f(D.perimetro)} m.${A.L.origen ? ' Rumbos referidos al norte verdadero (GPS).' : ' Rumbos referidos al frente del lote (P1→P2 al este), no al norte.'}</p></div>` : ''}</div>`;
}

/* ---------- HOLOGRAMA ---------- */
function pintarHoloVista() {
  const D = A.D;
  if (!A.holoListo) {
    A.holoListo = iniciarHolo($('#holoCaja'));
    if (!A.holoListo) { $('#holoArriba').innerHTML = '<div class="vidrio">Este celular no pudo abrir el 3D (WebGL).</div>'; return; }
  }
  const sinModelo = !D.T.triangulos.length;
  holo.alPerfil = sinModelo ? null : ({ perfil: pr, Z0 }) => { const el = $('#perfil'); if (el) el.innerHTML = svgPerfil(pr, Z0); };
  pintarHolo(D, { exag: A.L.exageracion, rayos: A.holo.rayos, escaner: A.holo.escaner, encuadrar: A.encuadrar });
  A.encuadrar = false;
  if (sinModelo) {
    $('#holoArriba').innerHTML = '';
    $('#holoAbajo').innerHTML = `<div class="vidrio">Hacen falta al menos 3 puntos para armar el terreno. <button class="btn sm pri" data-act="ejemplo">Ver un ejemplo</button></div>`;
    return;
  }
  const ex = A.L.exageracion;
  $('#holoArriba').innerHTML = `<div class="chips">
      <button class="btn sm${A.holo.rayos ? ' activo' : ''}" data-act="rayos">Rayos X</button>
      <button class="btn sm${A.holo.escaner ? ' activo' : ''}" data-act="escaner">Escáner</button>
      ${[1, 2, 5].map(k => `<button class="btn sm${ex === k ? ' activo' : ''}" data-act="exag" data-k="${k}">×${k}</button>`).join('')}
    </div>`;
  const v = D.volumen, p = D.plataforma;
  const paso = Math.max(0.01, (D.zmax - D.zmin) / 200);
  $('#holoAbajo').innerHTML = `<div class="vidrio">
      ${D.sinNiveles ? '<p class="nota" style="margin:0">Sin cotas el terreno sale plano. Póngalas con la mira o mida con la cámara.</p>' : `
      <div class="lecturas">
        <div class="c"><b>${f(v.corte, 1)} m³</b><span>corte</span></div>
        <div class="r"><b>${f(v.relleno, 1)} m³</b><span>relleno</span></div>
        <div class="m"><b>${v.viajes6}</b><span>viajes de 6 m³</span></div>
      </div>
      <div class="deslizador" style="margin-top:8px"><span>Suelo</span>
        <select class="mini-sel" data-act-cambio="suelo" aria-label="Tipo de suelo">${Object.entries(SUELOS).map(([k, s]) => `<option value="${k}" ${A.L.suelo === k ? 'selected' : ''}>${s.nombre} (+${Math.round(s.abundamiento * 100)} %)</option>`).join('')}</select>
        <span>${f(v.suelto, 1)} m³ sueltos</span></div>
      <div class="deslizador" style="margin-top:8px"><span>Plataforma <b class="mono" id="platTxt">${fz(p.z)}</b></span>
        <input type="range" min="${D.zmin.toFixed(2)}" max="${D.zmax.toFixed(2)}" step="${paso.toFixed(3)}" value="${p.z.toFixed(3)}" data-act-cambio="plataforma" aria-label="Cota de la plataforma">
        <button class="btn sm${p.modo === 'equilibrio' ? ' activo' : ''}" data-act="equilibrio">Equilibrio</button></div>`}
      ${D.sinNiveles ? '' : huellaControles()}
      ${A.holo.escaner ? '<div id="perfil" style="margin-top:6px"></div>' : ''}
      <div class="fila" style="margin-top:8px"><button class="btn sm pri" data-act="palma">En la palma (AR)</button>${A.holo.rayos ? '<span class="nota" style="margin:0">Rojo: tierra que se saca. Azul: tierra que se pone. Rayas: cada metro de profundidad.</span>' : ''}</div>
    </div>`;
}

function huellaControles() {
  const h = A.L.huella;
  return `<div class="deslizador" style="margin-top:8px;flex-wrap:wrap">
    <button class="btn sm${h.activa ? ' activo' : ''}" data-act="huella">${h.activa ? 'Solo la obra' : 'Todo el lote'}</button>
    ${h.activa ? `<input class="mini" inputmode="decimal" data-huella="ancho" value="${f(h.ancho, 1)}" aria-label="Ancho de la obra"> × <input class="mini" inputmode="decimal" data-huella="fondo" value="${f(h.fondo, 1)}" aria-label="Fondo de la obra"> m
      <span>muévala tocando el plano</span>` : '<span>Toque para calcular solo la plataforma de la casa o la cabaña</span>'}
  </div>${A.D.huellaFuera ? '<p class="aviso">La obra quedó fuera del terreno medido: muévala tocando el plano.</p>' : ''}`;
}

/**
 * El holograma en la palma, de la mejor forma que permita el navegador:
 *   1. realidad aumentada anclada a la mesa o la mano (Android con Chrome y ARCore);
 *   2. AR Quick Look (iPhone y iPad);
 *   3. si no hay ninguna, el holograma sobre la camara, que sirve en
 *      cualquier celular, y se le dice al usuario que falta para la 1.
 */
async function palma() {
  const D = A.D;
  if (!D.T.triangulos.length) return toast('Faltan puntos para el holograma.');
  const opc = { exag: A.L.exageracion, rayos: A.holo.rayos };
  if (!A.arOk) A.arOk = await arDisponible();
  try {
    if (A.arOk) {
      await iniciarAR('palma', { overlay: $('#arOverlay'), msg: $('#arMsg'), botones: $('#arBtns'), D, opc });
      return;
    }
    if (esIOS()) {
      toast('Preparando el holograma para iPhone…');
      await palmaEnIPhone(D, opc);
      return;
    }
  } catch (e) {
    toast(`${e.message} Abro el holograma sobre la cámara.`, 5000);
  }
  await palmaSobreCamara(D, opc);
}

async function palmaSobreCamara(D, opc) {
  A.palma = { ...opc };
  const motivo = motivoSinAR(), aviso = $('#palmaMotivo');
  aviso.hidden = !motivo;
  if (motivo) aviso.innerHTML = `${esc(motivo)}${/Servicios de Google Play/.test(motivo) ? ` <a href="${enlaceARCore}" target="_blank" rel="noopener">Instalar</a>` : ''}`;
  try {
    const { conCamara } = await abrirPalmaCamara(D, opc, { pantalla: $('#palmaCam'), video: $('#palmaVideo'), lienzo: $('#palmaLienzo') });
    if (!conCamara) $('#palmaEstado').textContent = 'Sin permiso de cámara: el holograma se ve sobre fondo oscuro. Actívelo en el navegador para verlo sobre la mano.';
  } catch (e) { toast(e.message, 5000); }
}

/* ---------- AR para medir ---------- */
async function medirConCamara() {
  if (!A.arOk) A.arOk = await arDisponible();
  if (!A.arOk) { A.panel = 'camara'; pintar(); return; }
  if (!A.holoListo) A.holoListo = iniciarHolo($('#holoCaja'));
  try {
    await iniciarAR('medir', {
      overlay: $('#arOverlay'), msg: $('#arMsg'), botones: $('#arBtns'), huella: A.L.huella,
      alTerminar: (pts, medidas) => {
        if (!pts.length) return;
        if (!prepararMetodo('camara')) return;
        A.L.origen = null;
        A.L.puntos = pts.map(p => ({ ...p, nota: '' }));
        A.L.metodo = 'camara';
        recalcular();
        const prof = medidas.length ? ` Profundidades: ${medidas.map(m => f(m.prof) + ' m').join(', ')}.` : '';
        toast(`Medido con la cámara: ${A.D.esquinas.length} esquinas${A.D.area ? `, ${areaTxt(A.D.area)}` : ''}.${prof}`, 6000);
      },
    });
  } catch (e) { toast(e.message, 5000); }
}

/* ---------- NIVEL DE BURBUJA ---------- */
async function abrirNivel() {
  if (!(await pedirPermisoSensores())) return toast('El celular no dio permiso para los sensores de movimiento.');
  const caja = $('#burbuja');
  caja.hidden = false;
  A.nivel.cal = null;
  pintarBotonesNivel();
  A.nivel.quitar = escucharSensores(d => {
    A.nivel.ultimo = d;
    const k = 9, R = 120;
    let x = -d.gamma * k, y = -d.beta * k;
    const r = Math.hypot(x, y);
    if (r > R) { x *= R / r; y *= R / r; }
    const g = $('#gota');
    g.style.transform = `translate(${x.toFixed(1)}px,${y.toFixed(1)}px)`;
    g.classList.toggle('ok', Math.abs(d.beta) < 0.15 && Math.abs(d.gamma) < 0.15);
    const L = pendienteDe(d.beta), T = pendienteDe(d.gamma);
    const plano = Math.abs(d.betaCruda) < 45 && Math.abs(d.gammaCruda) < 45;
    $('#nivelDatos').innerHTML = plano
      ? `<div class="dato"><b>${f(L.grados, 1)}°</b><span>a lo largo · ${f(Math.abs(L.pct), 1)} % · ${f(Math.abs(L.mmPorM), 0)} mm/m</span></div><div class="dato"><b>${f(T.grados, 1)}°</b><span>a lo ancho · ${f(Math.abs(T.pct), 1)} % · ${f(Math.abs(T.mmPorM), 0)} mm/m</span></div>`
      : '<div class="dato" style="grid-column:1/-1"><b>Acueste el celular</b><span>sobre la superficie o sobre una regla apoyada en el terreno</span></div>';
  });
}
function pintarBotonesNivel() {
  const c = A.nivel.cal;
  $('#nivelBtns').innerHTML = `<button class="btn" data-act="calibrar">${c ? 'Gire el celular 180° en el mismo sitio y toque (2/2)' : 'Calibrar (1/2)'}</button><button class="btn pri" data-act="cerrarNivel">Cerrar</button>`;
}
function calibrar() {
  const d = A.nivel.ultimo;
  if (!d) return;
  if (!A.nivel.cal) { A.nivel.cal = { b: d.betaCruda, g: d.gammaCruda }; pintarBotonesNivel(); return; }
  const b = calibracionPorInversion(A.nivel.cal.b, d.betaCruda), g = calibracionPorInversion(A.nivel.cal.g, d.gammaCruda);
  guardarCalibracion({ b: b.cero, g: g.cero });
  A.nivel.cal = null;
  pintarBotonesNivel();
  toast(`Calibrado. La superficie tenía ${f(b.inclinacion, 2)}° y ${f(g.inclinacion, 2)}° de inclinación.`);
}
function cerrarNivel() {
  A.nivel.quitar?.(); A.nivel.quitar = null;
  $('#burbuja').hidden = true;
}

/* ---------- MIRA ---------- */
async function abrirMira() {
  if (!A.L.puntos.length) toast('Puede medir ya; para guardar la cota necesita puntos (esquinas o niveles).', 4500);
  if (!(await pedirPermisoSensores())) return toast('El celular no dio permiso para los sensores de movimiento.');
  $('#camara').hidden = false;
  const m = A.mira;
  m.pie = m.punta = m.res = null;
  if (!m.estacion) m.estacion = A.L.puntos[0]?.id || '';
  try {
    m.stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
    $('#video').srcObject = m.stream;
  } catch {
    toast('Sin cámara: la mira funciona igual, apuntando por el borde del celular.', 5000);
  }
  m.quitar = escucharSensores(d => {
    m.ultimo = d;
    $('#anguloVivo').textContent = `${d.elev >= 0 ? '+' : '−'}${f(Math.abs(d.elev), 2)}°`;
    const e = $('#estadoPulso');
    e.textContent = d.estable ? 'Firme: puede leer' : 'Sostenga el celular quieto…';
    e.className = `estado${d.estable ? ' firme' : ''}`;
  });
  pintarMira();
}

function pintarMira() {
  const m = A.mira;
  const e = calibracion().e;
  const chip = (k, t) => `<button class="btn sm${m.modo === k ? ' activo' : ''}" data-act="miraModo" data-k="${k}">${t}</button>`;
  const campo = (k, t) => `<div class="campo"><label>${t}</label><input inputmode="decimal" data-mira="${k}" value="${esc(m[k])}"></div>`;
  const ayuda = {
    cinta: 'Mida con cinta la distancia horizontal al punto. Ponga ahí un palo con una marca a la altura de su celular y apunte la cruz a la marca.',
    mira: 'Ponga una mira o un palo de largo conocido parado sobre el punto. Apunte la cruz al pie y después a la punta. No necesita cinta.',
    objeto: 'Mida la distancia al poste, árbol o muro. Apunte la cruz al pie y después a la punta.',
  }[m.modo];
  const campos = m.modo === 'cinta' ? campo('D', 'Distancia (m)') + campo('hi', 'Altura del celular (m)') + campo('ht', 'Altura de la marca (m)')
    : m.modo === 'mira' ? campo('L', 'Largo de la mira (m)') + campo('hi', 'Altura del celular (m)') : campo('D', 'Distancia (m)');
  const leer = m.modo === 'cinta' ? 'Leer ángulo' : m.pie === null ? 'Leer el pie' : 'Leer la punta';
  const pts = A.L.puntos.map(p => `<option value="${esc(p.id)}">${esc(p.id)}${Number.isFinite(p.z) ? ` (${fz(p.z)})` : ''}</option>`).join('');
  const r = m.res;
  let res = '';
  if (r?.h !== undefined) res = `<p class="ok">Altura del objeto: <b>${f(r.h)} m</b> (±${f(r.error * 100, 0)} cm)</p>`;
  else if (r) {
    res = `<p class="ok">El punto está <b>${fz(r.dH)} m</b> respecto al piso donde usted está (±${f(r.error * 100, 0)} cm)${m.modo === 'mira' ? ` · distancia ${f(r.D)} m` : ''}.</p>`;
    if (pts) res += `<div class="campos"><div class="campo"><label>Estoy parado en</label><select data-mira="estacion">${pts}</select></div><div class="campo"><label>El punto medido es</label><select data-mira="destino"><option value="">—</option>${pts}</select></div></div>
      <button class="btn amb" data-act="miraAsignar">Poner la cota</button>`;
  }
  $('#miraPanel').innerHTML = `<div class="chips">${chip('cinta', 'Con cinta')}${chip('mira', 'Con mira de largo conocido')}${chip('objeto', 'Altura de un objeto')}</div>
    <p class="nota" style="margin:0">${ayuda}</p>
    <div class="campos">${campos}</div>
    <div class="fila"><button class="btn pri" data-act="miraLeer">${leer}</button>${m.pie !== null && m.modo !== 'cinta' ? `<span class="mono">pie ${f(m.pie, 2)}°</span>` : ''}<button class="btn" data-act="cerrarMira">Cerrar</button></div>
    ${res}
    <div class="fila"><button class="btn sm" data-act="miraCal">${m.cal === null ? 'Calibrar la mira (1/2)' : 'Lectura del otro lado (2/2)'}</button>
      <span class="nota" style="margin:0">${m.cal === null ? `Error de índice ${e ? `corregido: ${f(e, 2)}°` : 'sin calibrar'}. Para calibrar: recueste el celular derecho contra un libro parado, con la espalda del celular contra el libro, y toque.` : 'Ahora páselo al otro lado del libro, también con la espalda contra el libro, y toque.'}</span></div>`;
  const est = $('[data-mira="estacion"]'), des = $('[data-mira="destino"]');
  if (est) est.value = m.estacion;
  if (des) des.value = m.destino;
}

/** Espera hasta 3 s a que el pulso quede quieto y devuelve el angulo
    promediado del ultimo segundo (o el crudo, sin descontar el error). */
function leerAngulo(cual = 'elev') {
  return new Promise(ok => {
    const t0 = performance.now();
    const mirar = () => {
      const d = A.mira.ultimo;
      const corr = cual === 'elevCruda' && d ? d.elevCruda - d.elev : 0;
      if (d?.estable || performance.now() - t0 > 3000) return ok(d ? { a: (d.estable ? d.elevMedia : d.elev) + corr, firme: !!d.estable } : null);
      requestAnimationFrame(mirar);
    };
    mirar();
  });
}

async function miraLeer() {
  const m = A.mira;
  const l = await leerAngulo();
  if (!l) return toast('No llegan datos de los sensores de inclinación.');
  if (!l.firme) toast('El pulso no estaba firme: la lectura puede fallar más de lo indicado.', 4000);
  const hi = numero(m.hi) ?? 1.5;
  if (m.modo === 'cinta') {
    m.res = conDistancia({ D: numero(m.D), alfa: l.a, hi, ht: numero(m.ht) ?? hi });
    if (!m.res) toast('Escriba la distancia en metros.');
  } else if (m.pie === null) {
    m.pie = l.a; m.res = null;
  } else {
    m.punta = l.a;
    m.res = m.modo === 'mira' ? conMira({ L: numero(m.L), alfaPie: m.pie, alfaPunta: m.punta, hi }) : alturaObjeto({ D: numero(m.D), alfaPie: m.pie, alfaPunta: m.punta });
    if (!m.res) toast(m.modo === 'mira' ? 'Revise el largo de la mira: la punta debe quedar más arriba que el pie.' : 'Escriba la distancia en metros.');
    m.pie = null;
  }
  pintarMira();
}

function miraAsignar() {
  const m = A.mira;
  const est = A.L.puntos.find(p => p.id === m.estacion), des = A.L.puntos.find(p => p.id === m.destino);
  if (!est || !des || est === des) return toast('Elija dónde está parado y cuál punto midió.');
  if (!Number.isFinite(est.z)) est.z = 0;
  des.z = +(est.z + m.res.dH).toFixed(3);
  des.fuente = 'mira';
  des.prec = +m.res.error.toFixed(2);
  toast(`${des.id}: cota ${fz(des.z)} m.`);
  m.res = null;
  recalcular();
  pintarMira();
}

/** Error de indice por inversion: dos lecturas con el celular recostado
    derecho contra un libro parado, la segunda del otro lado del libro (la
    camara mira al lado contrario). Lo que tienen en comun es el error del
    celular; lo que cambia de signo es la inclinacion del libro. */
async function miraCalibrar() {
  const m = A.mira;
  toast('Quieto…', 1500);
  const l = await leerAngulo('elevCruda');
  if (!l) return toast('No llegan datos de los sensores de inclinación.');
  if (!l.firme) return toast('No quedó quieto: vuelva a intentarlo con el celular bien apoyado.');
  if (m.cal === null) { m.cal = l.a; pintarMira(); return; }
  const c = calibracionPorInversion(m.cal, l.a);
  m.cal = null;
  if (Math.abs(c.cero) > 5) { toast('Las dos lecturas no cuadran: ¿lo pasó al otro lado del mismo libro, con la espalda contra el libro?', 5000); pintarMira(); return; }
  guardarCalibracion({ e: c.cero });
  toast(`Mira calibrada: el celular tenía ${f(c.cero, 2)}° de error, ya se descuenta.`, 4500);
  pintarMira();
}

function cerrarMira() {
  const m = A.mira;
  m.quitar?.(); m.quitar = null;
  m.stream?.getTracks().forEach(t => t.stop()); m.stream = null;
  $('#camara').hidden = true;
}

/* ---------- COMPARTIR Y ARCHIVOS ---------- */
function pintarDatos() {
  const D = A.D, hay = D.puntos.length > 0, geo = !!A.L.origen;
  $('#v-datos').innerHTML = `${tarjetaVivo()}
    <div class="card"><h2>Compartir</h2>
      <p class="sub">El levantamiento va dentro del enlace. Quien lo abra ve el plano y el holograma 3D en su celular, sin instalar nada.</p>
      <div class="acciones">
        <button class="btn pri" data-act="compartir" ${hay ? '' : 'disabled'}>Compartir enlace</button>
        <button class="btn" data-act="whatsapp" ${hay ? '' : 'disabled'}>Por WhatsApp</button>
        <button class="btn" data-act="copiar" ${hay ? '' : 'disabled'}>Copiar enlace</button>
      </div></div>
    <div class="card"><h2>Diseñar la casa</h2>
      <p class="sub">Abre este lote en Axiona Obra con sus medidas y cotas, para sacar el juego de planos, el 3D y el presupuesto.</p>
      <button class="btn amb" data-act="obra" ${D.lindero.length >= 3 ? '' : 'disabled'}>Abrir en Axiona Obra</button></div>
    <div class="card"><h2>Archivos</h2>
      <p class="sub">Coordenadas locales: E 1000, N 1000 y cota 100 en el primer punto.</p>
      <div class="acciones">
        <button class="btn amb" data-act="pdf" data-k="A3" ${hay ? '' : 'disabled'}>Plano topográfico PDF (A3)</button>
        <button class="btn" data-act="pdf" data-k="carta" ${hay ? '' : 'disabled'}>Plano PDF (carta)</button>
        <button class="btn" data-act="exp" data-k="pnezd" ${hay ? '' : 'disabled'}>Puntos PNEZD (.csv)</button>
        <button class="btn" data-act="exp" data-k="dxf" ${hay ? '' : 'disabled'}>AutoCAD (.dxf)</button>
        <button class="btn" data-act="exp" data-k="kml" ${geo ? '' : 'disabled'}>Google Earth (.kml)</button>
        <button class="btn" data-act="exp" data-k="geojson" ${geo ? '' : 'disabled'}>SIG (.geojson)</button>
        <button class="btn" data-act="exp" data-k="json" ${hay ? '' : 'disabled'}>Respaldo (.json)</button>
        <label class="btn" style="cursor:pointer">Abrir respaldo<input type="file" accept=".json,application/json" data-archivo="respaldo" hidden></label>
      </div>
      ${geo ? '' : '<p class="nota">Google Earth y SIG necesitan el lote medido con GPS: es lo único que lo amarra al mapa.</p>'}</div>
    <div class="card"><h2>¿Qué tan preciso es?</h2>
      <div class="tabla-caja"><table class="tabla precision"><thead><tr><th>Método</th><th>Precisión</th><th>Sirve para</th></tr></thead><tbody>
        <tr><td>GPS del celular</td><td class="n">±2 a 5 m</td><td>Fincas y lotes grandes; área aproximada</td></tr>
        <tr><td>GPS con antena RTK</td><td class="n">±1 a 3 cm</td><td>Linderos y cotas al centímetro, con correcciones NTRIP</td></tr>
        <tr><td>Cámara (AR)</td><td class="n">±2 a 5 cm hasta 10 m</td><td>Lotes urbanos, niveles, profundidades</td></tr>
        <tr><td>Cinta</td><td class="n">la de su cinta</td><td>Lotes pequeños, con la comprobación 2→4</td></tr>
        <tr><td>Mira</td><td class="n">±3 a 15 cm de cota</td><td>Cotas a 5–30 m, según el pulso</td></tr>
      </tbody></table></div>
      <p class="aviso"><b>Levantamiento preliminar.</b> Sirve para el anteproyecto, la cotización y para decidir. El plano topográfico oficial para la licencia lo firma un topógrafo con licencia profesional.</p>
      <p class="aviso"><b>Rayos X</b> muestra el modelo: la tierra que se corta o se rellena y la profundidad hasta la plataforma. El celular no ve lo que hay enterrado; para eso se usa un georradar o el estudio de suelos.</p></div>
    <div class="card"><h2>Nuevo levantamiento</h2><p class="sub">Borra lo que hay en este celular. Si lo quiere conservar, guarde antes el respaldo o el enlace.</p>
      <button class="btn peligro" data-act="nuevo" ${hay ? '' : 'disabled'}>Empezar de cero</button></div>
    <p class="nota" style="text-align:center">Axiona Desarrollos Inteligentes · Sabaneta, Antioquia · <a href="https://github.com/axiona-desarrollos/axiona-obra/tree/main/topo" target="_blank" rel="noopener">código abierto (MIT)</a> · <a href="https://obra.axionasoft.com" target="_blank" rel="noopener">Axiona Obra</a></p>`;
}

function descargar(nombre, contenido, tipo) {
  const blob = contenido instanceof Blob ? contenido : new Blob([contenido], { type: tipo });
  const u = URL.createObjectURL(blob), a = document.createElement('a');
  a.href = u; a.download = nombre;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(u), 8000);
  toast(`Descargado ${nombre}`);
}

const nombreArchivo = () => (A.L.nombre || 'lote').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w-]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase() || 'lote';

function exportar(k) {
  const D = A.D, n = nombreArchivo();
  if (k === 'pnezd') descargar(`${n}-PNEZD.csv`, aPNEZD(D), 'text/csv');
  if (k === 'dxf') descargar(`${n}.dxf`, aDXF(D, A.L.nombre || 'LOTE'), 'application/dxf');
  if (k === 'kml') descargar(`${n}.kml`, aKML(D, A.L.origen, A.L.nombre || 'Lote'), 'application/vnd.google-earth.kml+xml');
  if (k === 'geojson') descargar(`${n}.geojson`, aGeoJSON(D, A.L.origen, A.L.nombre || 'Lote'), 'application/geo+json');
  if (k === 'json') descargar(`${n}-axiona-topo.json`, JSON.stringify(A.L, null, 1), 'application/json');
}

async function enlace() { return enlaceDe(A.L, BASE); }

async function compartir() {
  const url = await enlace(), titulo = `Levantamiento · ${A.L.nombre || 'lote'}`;
  const texto = `${titulo}: ${A.D.area ? areaTxt(A.D.area) + ', ' : ''}plano y terreno en 3D con Axiona Topo.`;
  if (navigator.share) {
    try { await navigator.share({ title: titulo, text: texto, url }); return; } catch (e) { if (e.name === 'AbortError') return; }
  }
  await copiar(url);
}
async function copiar(url) {
  url = url || await enlace();
  try { await navigator.clipboard.writeText(url); toast('Enlace copiado.'); } catch { prompt('Copie el enlace:', url); }
}
async function porWhatsApp() {
  const url = await enlace();
  const txt = `Levantamiento «${A.L.nombre || 'lote'}»${A.D.area ? ` · ${areaTxt(A.D.area)}` : ''}: plano y terreno en 3D → ${url}`;
  window.open(`https://wa.me/?text=${encodeURIComponent(txt)}`, '_blank', 'noopener');
}
async function abrirObra() {
  const url = await enlaceObra(A.D, A.L.nombre);
  if (url) window.open(url, '_blank', 'noopener');
}

async function leerArchivo(input) {
  const file = input.files?.[0];
  if (!file) return;
  const texto = await file.text();
  input.value = '';
  if (input.dataset.archivo === 'respaldo') {
    try {
      const L = normalizar(JSON.parse(texto));
      if (!L.puntos.length) throw new Error();
      A.L = L; A.compartido = false;
      recalcular();
      toast(`Respaldo abierto: ${L.puntos.length} puntos.`);
    } catch { toast('Ese archivo no es un respaldo de Axiona Topo.'); }
    return;
  }
  const r = leerPuntos(texto);
  if (!r.puntos.length) return toast(r.aviso || 'No encontré puntos.');
  if (!prepararMetodo('archivo')) return;
  A.L.origen = null;
  A.L.puntos = r.puntos;
  A.L.metodo = 'archivo';
  if (!A.L.nombre) A.L.nombre = file.name.replace(/\.[^.]+$/, '');
  recalcular();
  toast(`${r.puntos.length} puntos importados. ${r.aviso}`, 6000);
}

function moverHuella(sv, e) {
  const t = JSON.parse(sv.dataset.t), r = sv.getBoundingClientRect();
  const X = (e.clientX - r.left) * (t.W / r.width), Y = (e.clientY - r.top) * (t.H / r.height);
  A.L.huella.x = +((X - t.pad - t.off) / t.k + t.x0).toFixed(2);
  A.L.huella.y = +((t.H - t.pad - Y) / t.k + t.y0).toFixed(2);
  A.L.plataforma = { modo: 'equilibrio', z: 0 };
  recalcular();
}

/* ---------- eventos ---------- */
document.addEventListener('click', async e => {
  const vb = e.target.closest('.dock [data-vista], [data-vista-ir]');
  if (vb) return irA(vb.dataset.vista || vb.dataset.vistaIr);
  const sv = e.target.closest('#planoCaja.mover svg');
  if (sv) return moverHuella(sv, e);
  const b = e.target.closest('[data-act]');
  if (!b || b.disabled) return;
  const act = b.dataset.act;
  switch (act) {
    case 'ejemplo': A.L = lotedeEjemplo(); A.compartido = false; A.panel = null; A.encuadrar = true; recalcular(); toast('Ejemplo: lote campestre en ladera. Mire el plano y el 3D con rayos X.', 4500); break;
    case 'metodo': {
      const m = b.dataset.m;
      if (m === 'gps') abrirGPS();
      else if (m === 'camara') medirConCamara();
      else { A.panel = A.panel === m ? null : m; pintar(); }
      break;
    }
    case 'cerrarPanel': A.panel = null; pintar(); break;
    case 'gpsFijar': fijarGPS(b.dataset.tipo); break;
    case 'gpsCancelar': cancelarFijado(); break;
    case 'gpsTerminar': cerrarGPS(); break;
    case 'cintaDibujar': dibujarCinta(); break;
    case 'tipo': { const p = A.L.puntos.find(q => q.id === b.dataset.id); if (p) { p.tipo = p.tipo === 'esquina' ? 'nivel' : 'esquina'; recalcular(); } break; }
    case 'borrar': A.L.puntos = A.L.puntos.filter(q => q.id !== b.dataset.id); if (!A.L.puntos.length) A.L.origen = null; recalcular(); break;
    case 'mano': {
      const x = numero($('#manoX').value), y = numero($('#manoY').value), z = numero($('#manoZ').value);
      if (x === null || y === null) return toast('Escriba X y Y en metros.');
      if (!A.L.metodo) A.L.metodo = 'manual';
      A.L.puntos.push({ id: siguienteId(A.L, b.dataset.tipo), tipo: b.dataset.tipo, x, y, z, fuente: 'manual', prec: null, nota: '' });
      recalcular();
      break;
    }
    case 'abrirNivel': abrirNivel(); break;
    case 'cerrarNivel': cerrarNivel(); break;
    case 'calibrar': calibrar(); break;
    case 'abrirMira': abrirMira(); break;
    case 'cerrarMira': cerrarMira(); break;
    case 'miraModo': A.mira.modo = b.dataset.k; A.mira.pie = A.mira.res = null; pintarMira(); break;
    case 'miraLeer': miraLeer(); break;
    case 'miraAsignar': miraAsignar(); break;
    case 'miraCal': miraCalibrar(); break;
    case 'planoOp': {
      const k = b.dataset.k;
      A.plano[k] = !A.plano[k];
      if (k === 'tierra' && A.plano.tierra) A.plano.pendiente = false;
      if (k === 'pendiente' && A.plano.pendiente) A.plano.tierra = false;
      pintar();
      break;
    }
    case 'rayos': A.holo.rayos = !A.holo.rayos; pintar(); break;
    case 'escaner': A.holo.escaner = !A.holo.escaner; pintar(); break;
    case 'exag': A.L.exageracion = +b.dataset.k; A.encuadrar = true; guardar(); pintar(); break;
    case 'equilibrio': A.L.plataforma = { modo: 'equilibrio', z: 0 }; recalcular(); break;
    case 'palma': palma(); break;
    case 'palmaRayos': if (A.palma) { A.palma.rayos = !A.palma.rayos; rayosPalmaCamara(A.D, A.palma); b.classList.toggle('activo', A.palma.rayos); } break;
    case 'palmaCerrar': cerrarPalmaCamara({ pantalla: $('#palmaCam'), video: $('#palmaVideo') }); A.palma = null; break;
    case 'pdf': planoEnPDF(b.dataset.k); break;
    case 'vivoCrear': iniciarVivo(nuevaSesion()); irA('datos'); break;
    case 'vivoCopiar': copiar(enlaceSesion(A.vivo.s, BASE)); break;
    case 'vivoCerrar': if (confirm('¿Terminar la sesión en vivo? Lo medido se queda en este equipo.')) cerrarVivo(); break;
    case 'huella': A.L.huella.activa = !A.L.huella.activa; if (A.L.huella.activa) A.plano.tierra = true; A.L.plataforma = { modo: 'equilibrio', z: 0 }; recalcular(); break;
    case 'compartir': compartir(); break;
    case 'copiar': copiar(); break;
    case 'whatsapp': porWhatsApp(); break;
    case 'obra': abrirObra(); break;
    case 'exp': exportar(b.dataset.k); break;
    case 'nuevo': if (confirm('¿Borrar el levantamiento de este celular?')) { A.L = nuevoLevantamiento(); A.compartido = false; A.panel = null; recalcular(); irA('medir'); } break;
    case 'guardarCompartido': A.compartido = false; history.replaceState(null, '', location.pathname); guardar(); pintar(); toast('Guardado en este celular.'); break;
    default:
  }
});

document.addEventListener('input', e => {
  const t = e.target;
  if (t.dataset.campo === 'nombre') { A.L.nombre = t.value.slice(0, 80); guardar(); }
  if (t.dataset.cinta) { const k = t.dataset.cinta; if (k === 'control') A.cinta.control = t.value; else A.cinta[k][+t.dataset.i] = t.value; }
  if (t.dataset.mira) {
    A.mira[t.dataset.mira] = t.value;
    if (t.dataset.mira === 'hi') try { localStorage.setItem(`${CLAVE}-hi`, t.value); } catch { /* sin almacenamiento */ }
  }
  if (t.dataset.actCambio === 'plataforma') {
    A.L.plataforma = { modo: 'fija', z: +t.value };
    const tx = $('#platTxt');
    if (tx) tx.textContent = fz(+t.value);
  }
});

document.addEventListener('change', e => {
  const t = e.target;
  if (t.dataset.cota) {
    const p = A.L.puntos.find(q => q.id === t.dataset.cota);
    if (p) { p.z = numero(t.value); recalcular(); }
  }
  if (t.dataset.actCambio === 'cintaN') { A.cinta.n = +t.value; pintar(); }
  if (t.dataset.huella) { const v = numero(t.value); if (v > 0) { A.L.huella[t.dataset.huella] = Math.min(300, v); A.L.plataforma = { modo: 'equilibrio', z: 0 }; recalcular(); } }
  if (t.dataset.actCambio === 'plataforma') recalcular();
  if (t.dataset.actCambio === 'suelo') { A.L.suelo = t.value; recalcular(); }
  if (t.dataset.archivo) leerArchivo(t);
  if (t.dataset.mira) A.mira[t.dataset.mira] = t.value;
});

/* ---------- arranque ---------- */
async function iniciar() {
  try { const hi = localStorage.getItem(`${CLAVE}-hi`); if (hi) A.mira.hi = hi; } catch { /* sin almacenamiento */ }
  const sesion = sesionDelEnlace(location.hash);
  const compartido = sesion ? null : await deEnlace(location.hash);
  if (compartido) { A.L = compartido; A.compartido = true; }
  else A.L = cargar() || nuevoLevantamiento();
  A.D = calcular(A.L);
  irA('medir');
  if (compartido) { toast(`Abrió un levantamiento compartido: ${A.L.nombre || 'sin nombre'}.`, 4500); irA('holo'); }
  if (sesion) {
    try { if (A.L.puntos.length) localStorage.setItem(`${CLAVE}-respaldo`, JSON.stringify(A.L)); } catch { /* sin almacenamiento */ }
    iniciarVivo(sesion);
    toast('Conectando en vivo con el otro equipo…');
  }
  A.arOk = await arDisponible();
  if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('./sw.js').catch(() => {});
  if (import.meta.env.DEV) window.__topo = { A, recalcular, irA };
}

iniciar();
