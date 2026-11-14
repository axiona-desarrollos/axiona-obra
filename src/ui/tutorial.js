/* ==========================================================================
   AXIONA OBRA · Tutorial en video dentro de la app
   --------------------------------------------------------------------------
   Un video de 2 minutos y medio (un arquitecto arma con Axi la mansión con piscina
   interior desde su boceto), en una ventana con capítulos.
   Se abre desde «▶ Tutorial» arriba o desde la tarjeta de Proyecto, y en la
   primera visita aparece una tarjeta pequeña abajo a la izquierda (no tapa
   a Axi ni el trabajo) que se cierra para siempre con la ×.
   El video se sirve desde jsDelivr (repositorio público, fijado a un commit):
   no consume el ancho de banda del sitio y solo se descarga al darle play.
   ========================================================================== */

import { tr } from '../motor/idioma.js';
import { evento } from './analitica.js';

export const VIDEO_TUTORIAL = 'https://cdn.jsdelivr.net/gh/axiona-desarrollos/axiona-obra@f42471cf47d2cd8bc0afcbd0ea1160368c4ec372/medios/tutorial-obra-720p.mp4';
const POSTER = './tutorial/poster.jpg';
const CLAVE = 'axiona-obra-tutorial-v2'; // v2: el aviso vuelve a salir una vez para el tutorial nuevo

/** Capítulos del video (segundos). */
export const CAPITULOS = [
  [0, { es: 'Inicio', en: 'Intro' }],
  [18.7, { es: '1 Boceto a Axi', en: '1 Sketch to Axi' }],
  [28.5, { es: '2 Claude lee el boceto', en: '2 Claude reads the sketch' }],
  [47.3, { es: '3 Modelo 3D', en: '3 3D model' }],
  [68.7, { es: '4 Casa abierta', en: '4 Open house' }],
  [79.1, { es: '5 Cambios con Axi', en: '5 Changes with Axi' }],
  [92.4, { es: '6 Render WebGPU', en: '6 WebGPU render' }],
  [110.7, { es: '7 DWG e IFC', en: '7 DWG and IFC' }],
  [122.4, { es: '8 Presupuesto', en: '8 Budget' }],
];

const leer = () => { try { return localStorage.getItem(CLAVE); } catch { return 'sin-almacenamiento'; } };
const marcar = v => { try { localStorage.setItem(CLAVE, v); } catch { /* modo privado */ } };

let caja = null, video = null, volverA = null;

function armar() {
  caja = document.createElement('div');
  caja.className = 'tuto';
  caja.hidden = true;
  caja.setAttribute('role', 'dialog');
  caja.setAttribute('aria-modal', 'true');
  caja.setAttribute('aria-labelledby', 'tutoTit');
  caja.innerHTML = `<div class="tuto-caja">
    <div class="tuto-cab"><div><b id="tutoTit"></b><small id="tutoSub"></small></div><button class="tuto-x" type="button" aria-label="×">×</button></div>
    <video class="tuto-video" controls playsinline preload="none" poster="${POSTER}"></video>
    <div class="tuto-caps" role="group"></div>
    <p class="tuto-pie" id="tutoPie"></p>
  </div>`;
  document.body.appendChild(caja);
  video = caja.querySelector('video');
  caja.addEventListener('click', e => {
    if (e.target === caja || e.target.closest('.tuto-x')) { cerrarTutorial(); return; }
    const c = e.target.closest('[data-cap]');
    if (c) { if (!video.src) video.src = VIDEO_TUTORIAL; video.currentTime = +c.dataset.cap; video.play().catch(() => {}); }
  });
  caja.addEventListener('keydown', e => { if (e.key === 'Escape') cerrarTutorial(); });
  video.addEventListener('timeupdate', () => {
    const t = video.currentTime;
    let k = 0; CAPITULOS.forEach(([s], i) => { if (t >= s - 0.2) k = i; });
    caja.querySelectorAll('[data-cap]').forEach((b, i) => b.setAttribute('aria-pressed', i === k));
  });
  video.addEventListener('error', () => { caja.querySelector('#tutoPie').textContent = tr({ es: 'No se pudo cargar el video. Revisa tu conexión e inténtalo otra vez.', en: 'The video could not load. Check your connection and try again.' }); });
}

function textos() {
  caja.querySelector('#tutoTit').textContent = tr({ es: 'Cómo se usa Axiona Obra', en: 'How to use Axiona Obra' });
  caja.querySelector('#tutoSub').textContent = tr({ es: '2 minutos · del boceto a la mansión con piscina interior', en: '2 minutes · from a paper sketch to a mansion with an indoor pool (video in Spanish)' });
  caja.querySelector('.tuto-caps').innerHTML = CAPITULOS.map(([s, n]) => `<button class="chip" type="button" data-cap="${s}" aria-pressed="false">${tr(n)}</button>`).join('');
  caja.querySelector('#tutoPie').textContent = tr({ es: '¿Necesitas una integración a la medida? WhatsApp 310 392 2935.', en: 'Need a custom integration? WhatsApp +57 310 392 2935.' });
  caja.querySelector('.tuto-x').setAttribute('aria-label', tr({ es: 'Cerrar', en: 'Close' }));
}

/** Abre el tutorial (opcionalmente en un segundo dado). */
export function abrirTutorial(desde = 0) {
  if (!caja) armar();
  textos();
  quitarAviso();
  marcar('visto');
  volverA = document.activeElement;
  caja.hidden = false;
  document.documentElement.classList.add('tuto-abierto');
  if (!video.src) video.src = VIDEO_TUTORIAL;
  if (desde) video.currentTime = desde;
  video.play().catch(() => { /* sin reproducción automática: el usuario le da play */ });
  caja.querySelector('.tuto-x').focus();
}

export function cerrarTutorial() {
  if (!caja || caja.hidden) return;
  video.pause();
  caja.hidden = true;
  document.documentElement.classList.remove('tuto-abierto');
  volverA?.focus?.();
}

function quitarAviso() { document.querySelector('.tuto-aviso')?.remove(); }

/** Tarjeta pequeña de primera visita, abajo a la izquierda. No sale si ya vio el tutorial o la cerró. */
export function avisoTutorial({ espera = 2500 } = {}) {
  const estado = leer();
  if (estado === 'visto' || estado === 'cerrado' || estado === 'sin-almacenamiento') return;
  setTimeout(() => {
    if (document.querySelector('.tuto-aviso') || (caja && !caja.hidden)) return;
    if (!document.getElementById('idiomaInicio')?.hidden) return; // todavía está escogiendo el idioma
    const a = document.createElement('aside');
    a.className = 'tuto-aviso';
    a.setAttribute('aria-label', tr({ es: 'Tutorial', en: 'Tutorial' }));
    a.innerHTML = `<button class="tuto-aviso-ver" type="button"><img src="${POSTER}" alt="" width="112" height="63"><span><b>${tr({ es: '¿Primera vez aquí?', en: 'First time here?' })}</b><small>${tr({ es: 'Mira cómo se usa en 2 minutos', en: 'See how it works in 2 minutes' })}</small><em>▶ ${tr({ es: 'Ver el tutorial', en: 'Watch the tutorial' })}</em></span></button><button class="tuto-aviso-x" type="button" aria-label="${tr({ es: 'Ahora no', en: 'Not now' })}">×</button>`;
    a.querySelector('.tuto-aviso-ver').addEventListener('click', () => { evento('tutorial_aviso'); abrirTutorial(); });
    a.querySelector('.tuto-aviso-x').addEventListener('click', () => { marcar('cerrado'); quitarAviso(); });
    document.body.appendChild(a);
  }, espera);
}
