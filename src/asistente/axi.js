/* ==========================================================================
   AXIONA OBRA · Axi, el asistente holográfico
   --------------------------------------------------------------------------
   Botón flotante que abre un panel con un holograma que escucha y habla
   (Web Speech API) en el idioma escogido, entiende órdenes con el cerebro local
   (cerebro.js) y, si el usuario lo activa, con un modelo de lenguaje que
   corre en su propio equipo (llm.js). Las acciones las ejecuta app.js por
   medio del adaptador; aquí solo hay interfaz.
   ========================================================================== */

import { interpretar, noEntendi, resumen } from './cerebro.js';
import { disponible, crearCerebro, separarOrdenes } from './llm.js';
import { enviarMensaje, enlaceWhatsApp, enlaceCorreo } from './contacto.js';
import { tr, idioma } from '../motor/idioma.js';
import { prepararImagen, resumenBoceto } from './boceto.js';
import { evento } from '../ui/analitica.js';

const T = (es, en) => tr({ es, en });
const CHIP_CEREBRO = { es: 'Activar cerebro avanzado', en: 'Turn on the advanced brain' };

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const $ = s => document.querySelector(s);

let A = null;                 // adaptador de app.js
let estado = 'quieto';        // quieto · escuchando · pensando · hablando
let cerebro = null, cargandoCerebro = false;
let rec = null, escuchando = false;
let anim = 0;

const ICONO_MIC = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 15a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3Zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21h2v-2.08A7 7 0 0 0 19 12h-2Z" fill="currentColor"/></svg>';
const ICONO_ADJ = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M16.5 6.5v10a4.5 4.5 0 0 1-9 0V5.5a3 3 0 0 1 6 0V15a1.5 1.5 0 0 1-3 0V6.5H9V15a3 3 0 0 0 6 0V5.5a4.5 4.5 0 0 0-9 0v11a6 6 0 0 0 12 0v-10h-1.5Z" fill="currentColor"/></svg>';
const ICONO_ENVIAR = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 20.5 21 12 3 3.5l.01 6.5L15 12l-11.99 2 .01 6.5Z" fill="currentColor"/></svg>';

export function iniciarAxi(adaptador) {
  A = adaptador;
  document.body.insertAdjacentHTML('beforeend', `
    <button id="axiBtn" class="axi-btn" aria-expanded="false"><span class="axi-orb"><i></i><i></i><i></i></span><b>Axi</b></button>
    <div id="axiBurbuja" class="axi-burbuja" hidden role="status"></div>
    <section id="axiPanel" class="axi-panel" hidden role="dialog">
      <header class="axi-cab">
        <canvas id="axiHolo" width="168" height="168" aria-hidden="true"></canvas>
        <div class="axi-tit"><b>Axi</b><small id="axiEstado"></small></div>
        <button class="axi-x" id="axiCerrar">×</button>
      </header>
      <div class="axi-msgs" id="axiMsgs" aria-live="polite"></div>
      <div class="axi-chips" id="axiChips"></div>
      <form class="axi-entrada" id="axiForm" autocomplete="off">
        <label class="axi-adj" id="axiAdj">${ICONO_ADJ}<input type="file" id="axiArchivo" accept="image/*,application/pdf,.pdf" hidden></label>
        <button type="button" class="axi-mic" id="axiMic" aria-pressed="false">${ICONO_MIC}</button>
        <input id="axiTxt" maxlength="400">
        <button class="axi-enviar" id="axiEnviar">${ICONO_ENVIAR}</button>
      </form>
      <div class="axi-pie">
        <label class="axi-voz"><input type="checkbox" id="axiVoz"> <span id="axiVozTxt"></span></label>
        <button type="button" class="axi-link" id="axiCerebro"></button>
        <button type="button" class="axi-link" id="axiHumano"></button>
      </div>
    </section>`);
  actualizarIdiomaAxi();

  $('#axiBtn').addEventListener('click', () => abrir(!$('#axiPanel').hidden ? false : true));
  $('#axiCerrar').addEventListener('click', () => abrir(false));
  $('#axiBurbuja').addEventListener('click', () => { $('#axiBurbuja').hidden = true; abrir(true); });
  $('#axiForm').addEventListener('submit', e => { e.preventDefault(); const t = $('#axiTxt').value.trim(); if (t) { $('#axiTxt').value = ''; procesar(t); } });
  $('#axiChips').addEventListener('click', e => {
    const c = e.target.closest('[data-chip]');
    if (!c) return;
    if (c.dataset.chip === CHIP_CEREBRO.es || c.dataset.chip === CHIP_CEREBRO.en) activarCerebro(); else procesar(c.dataset.chip);
  });
  $('#axiMic').addEventListener('click', alternarMicrofono);
  $('#axiArchivo').addEventListener('change', e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) leerBoceto(f); });
  // la lectura de bocetos con IA es exclusiva del equipo Axiona: al público le cuenta el servicio y cómo pedirlo
  claveDesdeEnlace();
  $('#axiAdj').addEventListener('click', e => { if (!claveEquipo()) { e.preventDefault(); servicioExclusivo(); } });
  $('#axiHumano').addEventListener('click', () => { abrir(true); mostrarContacto(); });
  $('#axiCerebro').addEventListener('click', activarCerebro);
  $('#axiMsgs').addEventListener('click', clicEnMensajes);
  $('#axiMsgs').addEventListener('submit', enviarFormulario);
  try { $('#axiVoz').checked = localStorage.getItem('axi-voz') === '1'; } catch { /* modo privado */ }
  $('#axiVoz').addEventListener('change', e => { try { localStorage.setItem('axi-voz', e.target.checked ? '1' : '0'); } catch { /* */ } if (!e.target.checked) speechSynthesis?.cancel(); });
  addEventListener('keydown', e => { if (e.key === 'Escape' && !$('#axiPanel').hidden) abrir(false); });
}

/** Primera visita: Axi se presenta una vez, sin abrir el panel. app.js lo llama cuando ya hay idioma. */
export function saludoPrimeraVisita(ms = 3500) {
  let visto = false;
  try { visto = localStorage.getItem('axi-visto') === '1'; } catch { /* */ }
  if (visto) return;
  setTimeout(() => {
    if (!$('#axiPanel') || !$('#axiPanel').hidden) return;
    const b = $('#axiBurbuja');
    b.innerHTML = T('<b>Hola, soy Axi.</b> Dime cómo quieres tu casa y la cambio por ti: «agrega una alcoba», «pon una piscina de 8 por 4», «fachada en ladrillo», «muéstrala de noche». Toca aquí.',
      '<b>Hi, I’m Axi.</b> Tell me how you want your house and I’ll change it for you: «add a bedroom», «add an 8 by 4 pool», «brick facade», «show it at night». Tap here.');
    b.hidden = false;
    setTimeout(() => { b.hidden = true; }, 12000);
    try { localStorage.setItem('axi-visto', '1'); } catch { /* */ }
  }, ms);
}

const saludo = () => [
  T('Hola, soy Axi, tu arquitecto digital. Puedo cambiar el proyecto por ti, mostrarte el 3D por fases, descargar los planos y resolver tus dudas. Háblame o escríbeme.',
    'Hi, I’m Axi, your digital architect. I can change the project for you, show you the 3D by phases, download the drawings and answer your questions. Talk or write to me.'),
  [T('Empezar de cero', 'Start from scratch'), T('Agrega una alcoba de 12 m2', 'Add a 12 m2 bedroom'), T('Muéstrame los ladrillos', 'Show me the bricks'), T('Qué puedes hacer', 'What can you do')],
];

/** Pone en el idioma activo los textos fijos de Axi (botones, etiquetas, sugerencias). */
export function actualizarIdiomaAxi() {
  if (!$('#axiPanel')) return;
  const set = (sel, attr, v) => { const el = $(sel); if (el) el.setAttribute(attr, v); };
  set('#axiBtn', 'aria-label', T('Hablar con Axi, el asistente', 'Talk to Axi, the assistant'));
  set('#axiPanel', 'aria-label', T('Axi, asistente de Axiona Obra', 'Axi, the Axiona Obra assistant'));
  set('#axiCerrar', 'aria-label', T('Cerrar', 'Close'));
  set('#axiMic', 'aria-label', T('Hablarle a Axi', 'Speak to Axi'));
  set('#axiAdj', 'title', T('Adjuntar un boceto (foto, escaneo o PDF)', 'Attach a sketch (photo, scan or PDF)'));
  set('#axiAdj', 'aria-label', T('Adjuntar un boceto', 'Attach a sketch'));
  set('#axiTxt', 'placeholder', T('Dime qué casa quieres…', 'Tell me what house you want…'));
  set('#axiTxt', 'aria-label', T('Escríbele a Axi', 'Write to Axi'));
  set('#axiEnviar', 'aria-label', T('Enviar', 'Send'));
  $('#axiVozTxt').textContent = T('Respuestas en voz alta', 'Read answers aloud');
  $('#axiCerebro').textContent = T('Cerebro avanzado', 'Advanced brain') + (cerebro ? ' ✓' : '');
  $('#axiHumano').textContent = T('Hablar con una persona', 'Talk to a person');
  poner(estado);
  // la sugerencias en pantalla pasan al idioma nuevo
  if ($('#axiChips').children.length) {
    const [, chips] = saludo();
    $('#axiChips').innerHTML = chips.map(c => `<button type="button" class="axi-chip" data-chip="${esc(c)}">${esc(c)}</button>`).join('');
  }
  if (!$('#axiBurbuja').hidden) $('#axiBurbuja').hidden = true;
}

/** Abre Axi desde otra parte de la app, opcionalmente con una pregunta o un formulario. */
export function abrirAxi(opc = {}) {
  abrir(true);
  if (opc.formulario) mostrarFormulario(opc.formulario);
  else if (opc.contacto) mostrarContacto();
  else if (opc.texto) procesar(opc.texto);
}

function abrir(si) {
  const p = $('#axiPanel');
  p.hidden = !si;
  $('#axiBtn').setAttribute('aria-expanded', String(si));
  $('#axiBtn').classList.toggle('on', si);
  $('#axiBurbuja').hidden = true;
  if (si) {
    if (!$('#axiMsgs').children.length) {
      const [txt, chips] = saludo();
      decir(txt, chips, false);
    }
    if (!anim) anim = requestAnimationFrame(holo);
    setTimeout(() => $('#axiTxt').focus({ preventScroll: true }), 50);
  } else {
    cancelAnimationFrame(anim); anim = 0;
    if (escuchando) rec?.stop();
    speechSynthesis?.cancel();
  }
}

/* ---------------- conversación ---------------- */

function mensaje(quien, html) {
  const m = $('#axiMsgs');
  m.insertAdjacentHTML('beforeend', `<div class="axi-m ${quien}">${html}</div>`);
  m.scrollTop = m.scrollHeight;
  return m.lastElementChild;
}

function decir(texto, chips = [], voz = false) {
  mensaje('axi', esc(texto).replace(/\n/g, '<br>'));
  $('#axiChips').innerHTML = chips.map(c => `<button type="button" class="axi-chip" data-chip="${esc(c)}">${esc(c)}</button>`).join('');
  if (voz || $('#axiVoz').checked) hablar(texto);
}

const espera = ms => new Promise(r => setTimeout(r, ms));

async function ejecutar(hacer) {
  for (const h of hacer) {
    if (h.tipo === 'contacto') { mostrarContacto(); continue; }
    if (h.tipo === 'formulario') { mostrarFormulario(h.clase); continue; }
    if (h.espera) await espera(h.espera);
    try { await A.ejecutar(h); } catch (e) { console.error('[axi]', e); }
  }
}

async function procesar(texto, { voz = false } = {}) {
  mensaje('yo', esc(texto));
  $('#axiChips').innerHTML = '';
  const r = interpretar(texto, A.contexto());
  if (r) {
    await ejecutar(r.hacer);
    decir(r.dice, r.chips, voz);
    return;
  }
  if (cerebro) {
    poner('pensando');
    const pensando = mensaje('axi pensando', '<i></i><i></i><i></i>');
    try {
      const resp = await cerebro.preguntar(texto, resumen(A.contexto()));
      pensando.remove();
      const { dice, ordenes } = separarOrdenes(resp);
      const hechos = [];
      for (const o of ordenes) {
        const r2 = interpretar(o, A.contexto());
        if (r2) { await ejecutar(r2.hacer); hechos.push(r2.dice); }
      }
      decir(dice || hechos.join(' ') || noEntendi().dice, [], voz);
    } catch (e) {
      pensando.remove();
      console.error('[axi] modelo', e);
      const n = noEntendi();
      decir(n.dice, n.chips, voz);
    }
    poner('quieto');
    return;
  }
  const n = noEntendi();
  const d = await disponible().catch(() => null);
  decir(n.dice, d ? [...n.chips, tr(CHIP_CEREBRO)] : n.chips, voz);
}

/* ---------------- contacto, reseñas y propuestas ---------------- */

function mostrarContacto() {
  const asunto = T('Axiona Obra: quiero hablar con el equipo', 'Axiona Obra: I want to talk to the team');
  const texto = T(`Hola, vengo de Axiona Obra. Mi proyecto: ${resumen(A.contexto())}`, `Hi, I’m coming from Axiona Obra. My project: ${resumen(A.contexto())}`);
  const wa = enlaceWhatsApp(texto), co = enlaceCorreo(asunto, texto);
  mensaje('axi', `${T('Escoge cómo quieres hablar con el equipo de Axiona:', 'Choose how you want to talk to the Axiona team:')}<div class="axi-acciones">
    ${wa ? `<a class="btn pri sm" href="${esc(wa)}" target="_blank" rel="noopener">WhatsApp</a>` : ''}
    ${co ? `<a class="btn sm" href="${esc(co)}">${T('Correo', 'Email')}</a>` : ''}
    <button type="button" class="btn sm ${wa ? '' : 'pri'}" data-form="soporte">${T('Escribir aquí', 'Write here')}</button>
    <button type="button" class="btn sm" data-form="propuesta">${T('Dejar una propuesta', 'Leave a proposal')}</button>
    <button type="button" class="btn sm" data-form="resena">${T('Dejar una reseña', 'Leave a review')}</button></div>`);
}

const TITULOS = {
  soporte: { es: 'Escríbele al equipo de Axiona', en: 'Write to the Axiona team' },
  propuesta: { es: 'Tu propuesta para mejorar Axiona Obra', en: 'Your idea to improve Axiona Obra' },
  resena: { es: 'Tu reseña de Axiona Obra', en: 'Your review of Axiona Obra' },
};

function mostrarFormulario(clase = 'soporte') {
  const ph = clase === 'propuesta' ? T('¿Qué le agregarías o cambiarías?', 'What would you add or change?') : clase === 'resena' ? T('¿Qué te pareció?', 'What did you think?') : T('¿En qué te ayudamos?', 'How can we help you?');
  mensaje('axi', `<form class="axi-formu" data-clase="${clase}">
    <b>${tr(TITULOS[clase] || TITULOS.soporte)}</b>
    ${clase === 'resena' ? `<div class="axi-estrellas" role="radiogroup" aria-label="${T('Calificación', 'Rating')}">${[5, 4, 3, 2, 1].map(n => `<label title="${n}"><input type="radio" name="estrellas" value="${n}" ${n === 5 ? 'checked' : ''}><span>★</span></label>`).join('')}</div>` : ''}
    <input name="nombre" placeholder="${T('Tu nombre', 'Your name')}" maxlength="80" required>
    <input name="contacto" placeholder="${T('WhatsApp o correo para responderte', 'WhatsApp or email so we can reply')}" maxlength="120" ${clase === 'soporte' ? 'required' : ''}>
    <textarea name="mensaje" rows="3" maxlength="1500" placeholder="${ph}" required></textarea>
    <label class="axi-voz"><input type="checkbox" name="publicar" value="si" ${clase === 'resena' ? 'checked' : ''}> ${T('Pueden publicar mi comentario', 'You may publish my comment')}</label>
    <button class="btn pri sm">${T('Enviar', 'Send')}</button></form>`);
  $('#axiMsgs').lastElementChild.querySelector('input[name="nombre"]').focus({ preventScroll: true });
}

async function enviarFormulario(e) {
  const f = e.target.closest('.axi-formu');
  if (!f) return;
  e.preventDefault();
  const d = Object.fromEntries(new FormData(f).entries());
  const btn = f.querySelector('button');
  btn.disabled = true; btn.textContent = T('Enviando…', 'Sending…');
  const ok = await enviarMensaje({
    tipo: f.dataset.clase, nombre: d.nombre || '', contacto: d.contacto || '', mensaje: d.mensaje || '',
    estrellas: d.estrellas || '', publicar: d.publicar ? 'si' : 'no', proyecto: resumen(A.contexto()).slice(0, 900),
    pagina: location.href.slice(0, 200), idioma: idioma(),
  });
  if (ok) {
    f.outerHTML = `<p class="axi-ok">✓ ${T('Recibido.', 'Received.')} ${f.dataset.clase === 'soporte' ? T('El equipo de Axiona te responde pronto.', 'The Axiona team will reply soon.') : T('¡Gracias! Lo lee el equipo de Axiona.', 'Thank you! The Axiona team will read it.')}</p>`;
  } else {
    btn.disabled = false; btn.textContent = T('Enviar', 'Send');
    const wa = enlaceWhatsApp(d.mensaje || '');
    decir(`${T('No pude enviarlo en este momento.', 'I couldn’t send it right now.')} ${wa ? T('Escríbenos por WhatsApp.', 'Write to us on WhatsApp.') : T('Revisa tu conexión e inténtalo otra vez.', 'Check your connection and try again.')}`);
  }
}

function clicEnMensajes(e) {
  const b = e.target.closest('[data-form]');
  if (b) mostrarFormulario(b.dataset.form);
  const k = e.target.closest('[data-boceto]');
  if (k) usarBoceto(k.dataset.boceto, k);
  const x = e.target.closest('[data-exclusivo]');
  if (x) {
    evento('boceto-exclusivo-' + x.dataset.exclusivo);
    if (x.dataset.exclusivo === 'formulario') A.ejecutar({ tipo: 'act', a: 'pedirSistema' });
    if (x.dataset.exclusivo === 'equipo') entrarEquipo();
  }
}

/* ---------------- lectura de bocetos: servicio exclusivo del equipo Axiona ---------------- */

const CLAVE_EQUIPO = 'axiona-equipo-boceto';
const claveEquipo = () => { try { return localStorage.getItem(CLAVE_EQUIPO) || ''; } catch { return ''; } };
const guardarClave = c => { try { if (c) localStorage.setItem(CLAVE_EQUIPO, c); else localStorage.removeItem(CLAVE_EQUIPO); } catch { /* modo privado */ } };
/** El equipo también entra con un enlace ?equipo=CLAVE: se guarda en este equipo y se quita de la barra. */
function claveDesdeEnlace() {
  try {
    const u = new URL(location.href), c = u.searchParams.get('equipo');
    if (!c) return;
    guardarClave(c.trim()); u.searchParams.delete('equipo');
    history.replaceState(null, '', u.pathname + u.search + u.hash);
  } catch { /* sin URL */ }
}

function servicioExclusivo() {
  abrir(true);
  const pais = A.contexto().S.pais;
  const texto = T('Hola Axiona, vengo de Axiona Obra. Tengo un boceto de mi proyecto y quiero que lo conviertan en el modelo 3D con planos y presupuesto.', 'Hi Axiona, I found you through Axiona Obra. I have a sketch of my project and I would like it turned into the 3D model with drawings and a budget.');
  const wa = enlaceWhatsApp(texto, pais), co = enlaceCorreo(T('Quiero convertir mi boceto en modelo 3D (Axiona Obra)', 'Turn my sketch into a 3D model (Axiona Obra)'), texto);
  evento('boceto-exclusivo');
  mensaje('axi', `<b>${T('Lectura de bocetos: servicio exclusivo de Axiona', 'Sketch reading: an Axiona-exclusive service')}</b><br>${T('Convertir tu boceto en papel en el modelo 3D, los planos y el presupuesto con inteligencia artificial lo hace el equipo de Axiona Desarrollos Inteligentes. Déjanos tus datos o escríbenos y lo hacemos por ti:', 'Turning your paper sketch into the 3D model, drawings and budget with AI is done by the Axiona Desarrollos Inteligentes team. Leave your details or write to us and we’ll do it for you:')}
    <div class="axi-acciones"><button type="button" class="btn pri sm" data-exclusivo="formulario">${T('Dejar mis datos', 'Leave my details')}</button>
    ${wa ? `<a class="btn sm" href="${esc(wa)}" target="_blank" rel="noopener" data-exclusivo="whatsapp">WhatsApp</a>` : ''}
    ${co ? `<a class="btn sm" href="${esc(co)}" data-exclusivo="correo">${T('Correo', 'Email')}</a>` : ''}</div>
    <button type="button" class="axi-equipo" data-exclusivo="equipo">${T('Soy del equipo Axiona', 'I’m on the Axiona team')}</button>`);
}

async function entrarEquipo() {
  const c = (window.prompt(T('Clave del equipo Axiona', 'Axiona team key')) || '').trim();
  if (!c) return;
  let ok = false;
  try { const r = await fetch('/api/boceto', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-axiona-equipo': c }, body: JSON.stringify({ verificar: true }) }); ok = r.ok; } catch { ok = false; }
  if (ok) { guardarClave(c); decir(T('Listo: este equipo quedó habilitado para leer bocetos. Toca el clip y adjunta la foto o el PDF.', 'Done: this device can now read sketches. Tap the clip and attach the photo or PDF.')); }
  else decir(T('Esa clave no es válida. Si eres del equipo, pídesela a Santiago.', 'That key is not valid. If you’re on the team, ask Santiago for it.'));
}

/* ---------------- bocetos: foto → Claude (visión) → proyecto ---------------- */

let ultimoBoceto = null;
async function leerBoceto(archivo) {
  abrir(true);
  const instrucciones = $('#axiTxt').value.trim();
  $('#axiTxt').value = '';
  if (archivo.size > 25e6) return decir(T('El archivo es muy pesado: envía una foto o un PDF de menos de 25 MB.', 'The file is too large: send a photo or PDF under 25 MB.'));
  poner('pensando');
  let imagen;
  try { imagen = await prepararImagen(archivo); }
  catch { poner('quieto'); return decir(T('No pude abrir ese archivo. Envíame una foto (JPG o PNG) o un PDF del boceto.', 'I couldn’t open that file. Send a photo (JPG or PNG) or a PDF of the sketch.')); }
  mensaje('yo', `<img class="axi-adj-img" src="${imagen}" alt="${esc(T('Boceto', 'Sketch'))}">${instrucciones ? `<span>${esc(instrucciones)}</span>` : ''}`);
  const espera = mensaje('axi', `<span class="axi-leyendo">${T('Estoy leyendo tu boceto con Claude, de Anthropic: cotas, espacios, pisos y notas…', 'I’m reading your sketch with Claude, by Anthropic: dimensions, rooms, floors and notes…')}</span>`);
  if (!navigator.onLine) { espera.remove(); poner('quieto'); return decir(T('Para leer bocetos necesito internet. Mientras tanto, dime los espacios y los armo.', 'I need internet to read sketches. Meanwhile, tell me the rooms and I’ll build them.')); }
  let d;
  try {
    const ctx = A.contexto();
    const cuerpo = JSON.stringify({ imagen, instrucciones, pais: ctx.S.pais, idioma: idioma() });
    // un tropiezo pasajero del servicio (502/503/red) se reintenta una vez; el cupo del día (429) no
    for (let intento = 0; ; intento++) {
      let res = null;
      try { res = await fetch('/api/boceto', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-axiona-equipo': claveEquipo() }, body: cuerpo }); } catch { res = null; }
      d = res ? await res.json().catch(() => ({})) : {};
      if (res?.ok) break;
      if (res?.status === 403 && d.error === 'exclusivo') { guardarClave(''); throw Object.assign(new Error('exclusivo'), { exclusivo: true }); }
      if (intento === 0 && (!res || res.status >= 500)) { await new Promise(ok => setTimeout(ok, 1500)); continue; }
      throw new Error(d.mensaje || T('el servicio no respondió', 'the service did not respond'));
    }
  } catch (er) {
    espera.remove(); poner('quieto');
    if (er.exclusivo) return servicioExclusivo();
    return decir(T(`No pude leer el boceto: ${er.message}`, `I couldn’t read the sketch: ${er.message}`), [T('Qué puedes hacer', 'What can you do')]);
  }
  espera.remove(); poner('quieto');
  ultimoBoceto = d;
  const lista = (d.espacios || []).map(x => `<li>${esc(x.nombre)} · ${Math.round(+x.area || 0)} m² · ${T('piso', 'floor')} ${x.piso || 1}</li>`).join('');
  mensaje('axi', `<b>${T('Leí tu boceto', 'I read your sketch')}</b> <small>(${T('confianza', 'confidence')} ${esc(d.confianza || '')})</small><br>${esc(d.lectura || '')}
    <p class="axi-resumen">${esc(resumenBoceto(d, T))}</p>
    <details><summary>${T('Espacios', 'Rooms')} (${(d.espacios || []).length})</summary><ul class="axi-lista">${lista}</ul></details>
    ${d.supuestos?.length ? `<details><summary>${T('Lo que supuse', 'What I assumed')}</summary><ul class="axi-lista">${d.supuestos.map(x => `<li>${esc(x)}</li>`).join('')}</ul></details>` : ''}
    ${d.dudas?.length ? `<p class="axi-dudas">${T('Por confirmar', 'To confirm')}: ${esc(d.dudas.join(' · '))}</p>` : ''}
    <div class="axi-acciones"><button type="button" class="btn pri sm" data-boceto="crear">${T('Crear el modelo 3D', 'Create the 3D model')}</button><button type="button" class="btn sm" data-boceto="cancelar">${T('Cancelar', 'Cancel')}</button></div>`);
  if ($('#axiVoz').checked) hablar(`${T('Leí tu boceto.', 'I read your sketch.')} ${d.lectura || ''}`);
}

async function usarBoceto(accion, boton) {
  boton.closest('.axi-acciones')?.querySelectorAll('button').forEach(b => { b.disabled = true; });
  if (accion !== 'crear' || !ultimoBoceto) return decir(T('Listo, no cambié nada.', 'Done, I didn’t change anything.'));
  // A.ejecutar recibe una sola acción (la lista la recorre ejecutar())
  try { await A.ejecutar({ tipo: 'boceto', datos: ultimoBoceto }); }
  catch (e) { console.error('[axi]', e); return decir(T('No pude armar el modelo con ese boceto. Prueba con una foto más nítida o dime los espacios y los armo.', 'I couldn’t build the model from that sketch. Try a sharper photo or tell me the rooms and I’ll build them.')); }
  decir(T('Listo: armé el modelo 3D con los planos y el presupuesto. Ahora edítalo como quieras: por módulos (Programa, Interiores, Terreno, Presupuesto) o pidiéndomelo, por ejemplo «mármol negro en la sala», «estilo campestre» o «render WebGPU».', 'Done: I built the 3D model with the drawings and the budget. Now edit it as you like: by module (Program, Interiors, Site, Budget) or by asking me, for example «black marble in the living room», «country style» or «WebGPU render».'),
    [T('Render WebGPU', 'WebGPU render'), T('Muéstrame los planos', 'Show me the drawings'), T('Cuánto cuesta', 'How much does it cost'), T('Planos en DWG', 'Drawings in DWG')]);
}

/* ---------------- voz ---------------- */

const VOZ = {
  es: { prefijo: /^es\b|^es-/i, region: /CO|419|MX|US/, lang: 'es-CO', m2: ' metros cuadrados' },
  en: { prefijo: /^en\b|^en-/i, region: /US|CA|GB/, lang: 'en-US', m2: ' square meters' },
};
const vozActual = () => VOZ[idioma()] || VOZ.es;

function vozDelIdioma() {
  const c = vozActual();
  const v = speechSynthesis.getVoices().filter(x => c.prefijo.test(x.lang));
  return v.find(x => c.region.test(x.lang) && /natural|google|online/i.test(x.name)) || v.find(x => c.region.test(x.lang)) || v.find(x => /google|natural|online/i.test(x.name)) || v[0] || null;
}

function hablar(texto) {
  if (!('speechSynthesis' in window)) return;
  speechSynthesis.cancel();
  const c = vozActual();
  const limpio = texto.replace(/[•«»“”]/g, '').replace(/m²|\bm2\b/g, c.m2).replace(/\n+/g, '. ').slice(0, 600);
  const u = new SpeechSynthesisUtterance(limpio);
  const v = vozDelIdioma();
  if (v) u.voice = v;
  u.lang = v?.lang || c.lang;
  u.rate = 1.03;
  u.onstart = () => poner('hablando');
  u.onend = u.onerror = () => poner('quieto');
  speechSynthesis.speak(u);
}

function alternarMicrofono() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) { decir(T('Este navegador no deja usar el micrófono para dictar. Escríbeme, o abre la app en Chrome.', 'This browser doesn’t allow dictation with the microphone. Write to me, or open the app in Chrome.')); return; }
  if (escuchando) { rec?.stop(); return; }
  speechSynthesis?.cancel();
  rec = new SR();
  rec.lang = vozActual().lang;
  rec.interimResults = true;
  rec.maxAlternatives = 1;
  let final = '';
  rec.onstart = () => { escuchando = true; poner('escuchando'); $('#axiMic').setAttribute('aria-pressed', 'true'); };
  rec.onresult = ev => {
    let parcial = '';
    for (let i = ev.resultIndex; i < ev.results.length; i++) {
      if (ev.results[i].isFinal) final += ev.results[i][0].transcript; else parcial += ev.results[i][0].transcript;
    }
    $('#axiTxt').value = (final + parcial).trim();
  };
  rec.onerror = ev => {
    if (ev.error === 'not-allowed' || ev.error === 'service-not-allowed') decir(T('Necesito permiso para usar el micrófono. Actívalo en el candado de la barra de direcciones.', 'I need permission to use the microphone. Turn it on from the lock icon in the address bar.'));
    else if (ev.error === 'no-speech') decir(T('No te escuché. Toca el micrófono y habla cerca del celular.', 'I didn’t hear you. Tap the microphone and speak close to the phone.'));
  };
  rec.onend = () => {
    escuchando = false; poner('quieto'); $('#axiMic').setAttribute('aria-pressed', 'false');
    const t = final.trim();
    if (t) { $('#axiTxt').value = ''; procesar(t, { voz: true }); }
  };
  try { rec.start(); } catch { /* ya estaba escuchando */ }
}

/* ---------------- cerebro avanzado ---------------- */

async function activarCerebro() {
  abrir(true);
  if (cerebro) { decir(T(`El cerebro avanzado ya está activo (${cerebro.tipo === 'chrome' ? 'modelo de Chrome' : 'Qwen 2.5 en tu equipo'}). Pregúntame lo que quieras.`, `The advanced brain is already on (${cerebro.tipo === 'chrome' ? 'Chrome’s model' : 'Qwen 2.5 on your device'}). Ask me anything.`)); return; }
  if (cargandoCerebro) return;
  const d = await disponible().catch(() => null);
  if (!d) {
    decir(T('Tu navegador no puede correr un modelo de lenguaje en el equipo: necesita Chrome o Edge recientes con aceleración gráfica (WebGPU). Sigo con mi cerebro local, que entiende las órdenes de la app.', 'Your browser can’t run a language model on this device: it needs a recent Chrome or Edge with graphics acceleration (WebGPU). I’ll keep using my local brain, which understands the app’s commands.'));
    return;
  }
  if (d.tipo === 'webllm' && !confirm(T('El cerebro avanzado corre en tu equipo, gratis y privado, pero se descarga una sola vez (cerca de 1 GB). Usa Wi-Fi. ¿Lo activo?', 'The advanced brain runs on your device, free and private, but it downloads once (about 1 GB). Use Wi-Fi. Turn it on?'))) return;
  cargandoCerebro = true;
  poner('pensando');
  const barra = mensaje('axi', `<span>${T('Preparando el cerebro avanzado…', 'Preparing the advanced brain…')}</span><div class="axi-barra"><i style="width:0%"></i></div>`);
  try {
    cerebro = await crearCerebro(d.tipo, (p, txt) => {
      const pct = Math.round(Math.max(0, Math.min(1, p)) * 100);
      barra.querySelector('i').style.width = pct + '%';
      barra.querySelector('span').textContent = `${txt.length > 70 ? T('Descargando el modelo…', 'Downloading the model…') : txt} ${pct} %`;
    });
    barra.remove();
    $('#axiCerebro').textContent = T('Cerebro avanzado', 'Advanced brain') + ' ✓';
    decir(T('Listo: ahora entiendo preguntas abiertas. Todo corre en tu equipo, sin enviar tus datos a nadie.', 'Done: now I understand open questions. Everything runs on your device, without sending your data to anyone.'),
      [T('¿Qué casa me recomiendas para una familia de cuatro?', 'What house do you recommend for a family of four?'), T('¿Qué es la obra gris?', 'What is the plastered phase?')]);
  } catch (e) {
    console.error('[axi] cerebro', e);
    barra.remove();
    decir(T('No pude cargar el cerebro avanzado en este equipo. Sigo con mi cerebro local.', 'I couldn’t load the advanced brain on this device. I’ll keep using my local brain.'));
  }
  cargandoCerebro = false;
  poner('quieto');
}

/* ---------------- holograma ---------------- */

function poner(e) {
  estado = e;
  const t = tr({
    quieto: { es: 'Tu arquitecto digital', en: 'Your digital architect' },
    escuchando: { es: 'Te escucho…', en: 'Listening…' },
    pensando: { es: 'Pensando…', en: 'Thinking…' },
    hablando: { es: 'Hablando…', en: 'Speaking…' },
  }[e]);
  const el = $('#axiEstado'); if (el) el.textContent = t;
  $('#axiPanel')?.setAttribute('data-estado', e);
}

function holo(ms) {
  const cv = $('#axiHolo');
  if (!cv) return;
  const g = cv.getContext('2d'), W = cv.width, H = cv.height, cx = W / 2, cy = H / 2, R = W * 0.3, t = ms / 1000;
  g.clearRect(0, 0, W, H);
  g.save();
  g.globalCompositeOperation = 'lighter';
  const cian = (a) => `rgba(63,207,255,${a})`;
  // halo
  const grad = g.createRadialGradient(cx, cy, R * 0.2, cx, cy, R * 1.6);
  grad.addColorStop(0, cian(0.18)); grad.addColorStop(1, cian(0));
  g.fillStyle = grad; g.fillRect(0, 0, W, H);
  // esfera de alambre que gira
  g.lineWidth = 1;
  const giro = t * 0.6;
  for (let k = 0; k < 7; k++) {
    const lat = -Math.PI / 2 + (k + 1) * Math.PI / 8, y = cy + R * Math.sin(lat), rx = R * Math.cos(lat);
    g.strokeStyle = cian(0.22); g.beginPath(); g.ellipse(cx, y, rx, rx * 0.18, 0, 0, Math.PI * 2); g.stroke();
  }
  for (let k = 0; k < 8; k++) {
    const a = giro + k * Math.PI / 8, rx = Math.abs(R * Math.cos(a));
    g.strokeStyle = cian(0.1 + 0.25 * Math.abs(Math.sin(a))); g.beginPath(); g.ellipse(cx, cy, rx, R, 0, 0, Math.PI * 2); g.stroke();
  }
  // anillos
  const anillos = estado === 'pensando' ? 3 : 2;
  for (let k = 0; k < anillos; k++) {
    const r = R * (1.28 + k * 0.14), v = (k % 2 ? -1 : 1) * (estado === 'pensando' ? 2.4 : 0.7);
    g.strokeStyle = cian(0.65); g.lineWidth = 2;
    g.beginPath(); g.arc(cx, cy, r, t * v, t * v + Math.PI * (0.55 + 0.2 * k)); g.stroke();
    g.beginPath(); g.arc(cx, cy, r, t * v + Math.PI, t * v + Math.PI * (1.35 + 0.1 * k)); g.stroke();
  }
  // escuchando: pulso
  if (estado === 'escuchando') {
    const p = (t * 1.4) % 1;
    g.strokeStyle = `rgba(65,226,164,${1 - p})`; g.lineWidth = 3;
    g.beginPath(); g.arc(cx, cy, R * (1.1 + p * 0.7), 0, Math.PI * 2); g.stroke();
  }
  // cara: ojos que parpadean y boca que se mueve al hablar
  const parpadeo = (t % 4.2) < 0.12 ? 0.15 : 1;
  g.shadowColor = cian(1); g.shadowBlur = 12; g.fillStyle = cian(0.95);
  for (const s of [-1, 1]) {
    g.beginPath(); g.ellipse(cx + s * R * 0.36, cy - R * 0.12, R * 0.12, R * 0.12 * parpadeo, 0, 0, Math.PI * 2); g.fill();
  }
  const n = 9, ancho = R * 0.9;
  for (let i = 0; i < n; i++) {
    const x = cx - ancho / 2 + (i + 0.5) * ancho / n;
    const h = estado === 'hablando' ? R * (0.05 + 0.22 * Math.abs(Math.sin(t * 13 + i * 1.7)) * Math.abs(Math.sin(t * 5.3 + i))) : R * 0.03;
    g.fillRect(x - 1.6, cy + R * 0.42 - h, 3.2, h * 2);
  }
  // líneas de barrido
  g.shadowBlur = 0;
  g.globalAlpha = 0.18; g.fillStyle = cian(1);
  for (let y = (t * 40) % 6; y < H; y += 6) g.fillRect(cx - R * 1.6, y, R * 3.2, 1);
  g.restore();
  anim = requestAnimationFrame(holo);
}
