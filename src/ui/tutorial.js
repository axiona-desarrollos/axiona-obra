/* ==========================================================================
   AXIONA OBRA · Tutorial en video dentro de la app
   --------------------------------------------------------------------------
   Un video de 3 minutos con los nueve pasos, en una ventana con capítulos.
   Se abre desde «▶ Tutorial» arriba o desde la tarjeta de Proyecto, y en la
   primera visita aparece una tarjeta pequeña abajo a la izquierda (no tapa
   a Axi ni el trabajo) que se cierra para siempre con la ×.
   El video se sirve desde jsDelivr (repositorio público, fijado a un commit):
   no consume el ancho de banda del sitio y solo se descarga al darle play.
   ========================================================================== */

import { tr } from '../motor/idioma.js';
import { evento } from './analitica.js';

export const VIDEO_TUTORIAL = 'https://cdn.jsdelivr.net/gh/axiona-desarrollos/axiona-obra@9933ad63ce3efd714cb53477705fff9eabcc1e50/medios/tutorial-obra-720p.mp4';
const POSTER = './tutorial/poster.jpg';
const CLAVE = 'axiona-obra-tutorial';

/** Capítulos del video (segundos). */
export const CAPITULOS = [
  [0, { es: 'Inicio', en: 'Intro' }],
  [16.4, { es: '1 Proyecto', en: '1 Project' }],
  [28.6, { es: '2 Terreno', en: '2 Site' }],
  [45.4, { es: '3 Programa', en: '3 Program' }],
  [60.3, { es: '4 Planos', en: '4 Drawings' }],
  [80.0, { es: '5 Interiores', en: '5 Interiors' }],
  [90.3, { es: '6 Modelo 3D', en: '6 3D model' }],
  [107.5, { es: '7 Presupuesto', en: '7 Budget' }],
  [118.8, { es: '8 Ventas', en: '8 Sales' }],
  [127.5, { es: '9 AR y recorrido', en: '9 AR and walkthrough' }],
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
  caja.querySelector('#tutoSub').textContent = tr({ es: '3 minutos · los 9 pasos con un proyecto real', en: '3 minutes · the 9 steps with a real project (video in Spanish)' });
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
    a.innerHTML = `<button class="tuto-aviso-ver" type="button"><img src="${POSTER}" alt="" width="112" height="63"><span><b>${tr({ es: '¿Primera vez aquí?', en: 'First time here?' })}</b><small>${tr({ es: 'Mira cómo se usa en 3 minutos', en: 'See how it works in 3 minutes' })}</small><em>▶ ${tr({ es: 'Ver el tutorial', en: 'Watch the tutorial' })}</em></span></button><button class="tuto-aviso-x" type="button" aria-label="${tr({ es: 'Ahora no', en: 'Not now' })}">×</button>`;
    a.querySelector('.tuto-aviso-ver').addEventListener('click', () => { evento('tutorial_aviso'); abrirTutorial(); });
    a.querySelector('.tuto-aviso-x').addEventListener('click', () => { marcar('cerrado'); quitarAviso(); });
    document.body.appendChild(a);
  }, espera);
}
