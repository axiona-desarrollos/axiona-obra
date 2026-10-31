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
    b.innerHTML = T('<b>Hola, soy Axi.</b> Dime cómo quieres tu casa y la cambio por ti: «agrega una alcoba», «pon 3 pisos», «porcelanato en toda la casa». Toca aquí.',
      '<b>Hi, I’m Axi.</b> Tell me how you want your house and I’ll change it for you: «add a bedroom», «set 3 floors», «porcelain tile in the whole house». Tap here.');
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
