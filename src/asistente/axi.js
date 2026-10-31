/* ==========================================================================
   AXIONA OBRA · Axi, el asistente holográfico
   --------------------------------------------------------------------------
   Botón flotante que abre un panel con un holograma que escucha y habla
   (Web Speech API), entiende órdenes en español con el cerebro local
   (cerebro.js) y, si el usuario lo activa, con un modelo de lenguaje que
   corre en su propio equipo (llm.js). Las acciones las ejecuta app.js por
   medio del adaptador; aquí solo hay interfaz.
   ========================================================================== */

import { interpretar, noEntendi, resumen } from './cerebro.js';
import { disponible, crearCerebro, separarOrdenes } from './llm.js';
import { enviarMensaje, enlaceWhatsApp, enlaceCorreo } from './contacto.js';

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
    <button id="axiBtn" class="axi-btn" aria-label="Hablar con Axi, el asistente" aria-expanded="false"><span class="axi-orb"><i></i><i></i><i></i></span><b>Axi</b></button>
    <div id="axiBurbuja" class="axi-burbuja" hidden role="status"></div>
    <section id="axiPanel" class="axi-panel" hidden role="dialog" aria-label="Axi, asistente de Axiona Obra">
      <header class="axi-cab">
        <canvas id="axiHolo" width="168" height="168" aria-hidden="true"></canvas>
        <div class="axi-tit"><b>Axi</b><small id="axiEstado">Tu arquitecto digital</small></div>
        <button class="axi-x" id="axiCerrar" aria-label="Cerrar">×</button>
      </header>
      <div class="axi-msgs" id="axiMsgs" aria-live="polite"></div>
      <div class="axi-chips" id="axiChips"></div>
      <form class="axi-entrada" id="axiForm" autocomplete="off">
        <button type="button" class="axi-mic" id="axiMic" aria-label="Hablarle a Axi" aria-pressed="false">${ICONO_MIC}</button>
        <input id="axiTxt" placeholder="Dime qué casa quieres…" aria-label="Escríbele a Axi" maxlength="400">
        <button class="axi-enviar" aria-label="Enviar">${ICONO_ENVIAR}</button>
      </form>
      <div class="axi-pie">
        <label class="axi-voz"><input type="checkbox" id="axiVoz"> Respuestas en voz alta</label>
        <button type="button" class="axi-link" id="axiCerebro">Cerebro avanzado</button>
        <button type="button" class="axi-link" id="axiHumano">Hablar con una persona</button>
      </div>
    </section>`);

  $('#axiBtn').addEventListener('click', () => abrir(!$('#axiPanel').hidden ? false : true));
  $('#axiCerrar').addEventListener('click', () => abrir(false));
  $('#axiBurbuja').addEventListener('click', () => { $('#axiBurbuja').hidden = true; abrir(true); });
  $('#axiForm').addEventListener('submit', e => { e.preventDefault(); const t = $('#axiTxt').value.trim(); if (t) { $('#axiTxt').value = ''; procesar(t); } });
  $('#axiChips').addEventListener('click', e => {
    const c = e.target.closest('[data-chip]');
    if (!c) return;
    if (c.dataset.chip === 'Activar cerebro avanzado') activarCerebro(); else procesar(c.dataset.chip);
  });
  $('#axiMic').addEventListener('click', alternarMicrofono);
  $('#axiHumano').addEventListener('click', () => { abrir(true); mostrarContacto(); });
  $('#axiCerebro').addEventListener('click', activarCerebro);
  $('#axiMsgs').addEventListener('click', clicEnMensajes);
  $('#axiMsgs').addEventListener('submit', enviarFormulario);
  try { $('#axiVoz').checked = localStorage.getItem('axi-voz') === '1'; } catch { /* modo privado */ }
  $('#axiVoz').addEventListener('change', e => { try { localStorage.setItem('axi-voz', e.target.checked ? '1' : '0'); } catch { /* */ } if (!e.target.checked) speechSynthesis?.cancel(); });
  addEventListener('keydown', e => { if (e.key === 'Escape' && !$('#axiPanel').hidden) abrir(false); });

  // Primera visita: Axi se presenta una vez, sin abrir el panel.
  let visto = false;
  try { visto = localStorage.getItem('axi-visto') === '1'; } catch { /* */ }
  if (!visto) {
    setTimeout(() => {
      if (!$('#axiPanel').hidden) return;
      const b = $('#axiBurbuja');
      b.innerHTML = '<b>Hola, soy Axi.</b> Dime cómo quieres tu casa y la cambio por ti: «agrega una alcoba», «pon 3 pisos», «porcelanato en toda la casa». Toca aquí.';
      b.hidden = false;
      setTimeout(() => { b.hidden = true; }, 12000);
      try { localStorage.setItem('axi-visto', '1'); } catch { /* */ }
    }, 3500);
  }
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
      decir('Hola, soy Axi, tu arquitecto digital. Puedo cambiar el proyecto por ti, mostrarte el 3D por fases, descargar los planos y resolver tus dudas. Háblame o escríbeme.', ['Empezar de cero', 'Agrega una alcoba de 12 m2', 'Muéstrame los ladrillos', 'Qué puedes hacer'], false);
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
  decir(n.dice, d ? [...n.chips, 'Activar cerebro avanzado'] : n.chips, voz);
}

/* ---------------- contacto, reseñas y propuestas ---------------- */

function mostrarContacto() {
  const asunto = 'Axiona Obra: quiero hablar con el equipo';
  const texto = `Hola, vengo de Axiona Obra. Mi proyecto: ${resumen(A.contexto())}`;
  const wa = enlaceWhatsApp(texto), co = enlaceCorreo(asunto, texto);
  mensaje('axi', `Escoge cómo quieres hablar con el equipo de Axiona:<div class="axi-acciones">
    ${wa ? `<a class="btn pri sm" href="${esc(wa)}" target="_blank" rel="noopener">WhatsApp</a>` : ''}
    ${co ? `<a class="btn sm" href="${esc(co)}">Correo</a>` : ''}
    <button type="button" class="btn sm ${wa ? '' : 'pri'}" data-form="soporte">Escribir aquí</button>
    <button type="button" class="btn sm" data-form="propuesta">Dejar una propuesta</button>
    <button type="button" class="btn sm" data-form="resena">Dejar una reseña</button></div>`);
}

const TITULOS = { soporte: 'Escríbele al equipo de Axiona', propuesta: 'Tu propuesta para mejorar Axiona Obra', resena: 'Tu reseña de Axiona Obra' };

function mostrarFormulario(clase = 'soporte') {
  mensaje('axi', `<form class="axi-formu" data-clase="${clase}">
    <b>${TITULOS[clase] || TITULOS.soporte}</b>
    ${clase === 'resena' ? `<div class="axi-estrellas" role="radiogroup" aria-label="Calificación">${[5, 4, 3, 2, 1].map(n => `<label title="${n}"><input type="radio" name="estrellas" value="${n}" ${n === 5 ? 'checked' : ''}><span>★</span></label>`).join('')}</div>` : ''}
    <input name="nombre" placeholder="Tu nombre" maxlength="80" required>
    <input name="contacto" placeholder="WhatsApp o correo para responderte" maxlength="120" ${clase === 'soporte' ? 'required' : ''}>
    <textarea name="mensaje" rows="3" maxlength="1500" placeholder="${clase === 'propuesta' ? '¿Qué le agregarías o cambiarías?' : clase === 'resena' ? '¿Qué te pareció?' : '¿En qué te ayudamos?'}" required></textarea>
    <label class="axi-voz"><input type="checkbox" name="publicar" value="si" ${clase === 'resena' ? 'checked' : ''}> Pueden publicar mi comentario</label>
    <button class="btn pri sm">Enviar</button></form>`);
  $('#axiMsgs').lastElementChild.querySelector('input[name="nombre"]').focus({ preventScroll: true });
}

async function enviarFormulario(e) {
  const f = e.target.closest('.axi-formu');
  if (!f) return;
  e.preventDefault();
  const d = Object.fromEntries(new FormData(f).entries());
  const btn = f.querySelector('button');
  btn.disabled = true; btn.textContent = 'Enviando…';
  const ok = await enviarMensaje({
    tipo: f.dataset.clase, nombre: d.nombre || '', contacto: d.contacto || '', mensaje: d.mensaje || '',
    estrellas: d.estrellas || '', publicar: d.publicar ? 'si' : 'no', proyecto: resumen(A.contexto()).slice(0, 900),
    pagina: location.href.slice(0, 200),
  });
  if (ok) {
    f.outerHTML = `<p class="axi-ok">✓ Recibido. ${f.dataset.clase === 'soporte' ? 'El equipo de Axiona te responde pronto.' : '¡Gracias! Lo lee el equipo de Axiona.'}</p>`;
  } else {
    btn.disabled = false; btn.textContent = 'Enviar';
    const wa = enlaceWhatsApp(d.mensaje || '');
    decir(`No pude enviarlo en este momento. ${wa ? 'Escríbenos por WhatsApp.' : 'Revisa tu conexión e inténtalo otra vez.'}`);
  }
}

function clicEnMensajes(e) {
  const b = e.target.closest('[data-form]');
  if (b) mostrarFormulario(b.dataset.form);
}

/* ---------------- voz ---------------- */

function vozEspanol() {
  const v = speechSynthesis.getVoices().filter(x => /^es\b|^es-/i.test(x.lang));
  return v.find(x => /CO|419|MX|US/.test(x.lang) && /natural|google|online/i.test(x.name)) || v.find(x => /CO|419|MX|US/.test(x.lang)) || v.find(x => /google|natural|online/i.test(x.name)) || v[0] || null;
}

function hablar(texto) {
  if (!('speechSynthesis' in window)) return;
  speechSynthesis.cancel();
  const limpio = texto.replace(/[•«»]/g, '').replace(/m²/g, ' metros cuadrados').replace(/\n+/g, '. ').slice(0, 600);
  const u = new SpeechSynthesisUtterance(limpio);
  const v = vozEspanol();
  if (v) u.voice = v;
  u.lang = v?.lang || 'es-CO';
  u.rate = 1.03;
  u.onstart = () => poner('hablando');
  u.onend = u.onerror = () => poner('quieto');
  speechSynthesis.speak(u);
}

function alternarMicrofono() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) { decir('Este navegador no deja usar el micrófono para dictar. Escríbeme, o abre la app en Chrome.'); return; }
  if (escuchando) { rec?.stop(); return; }
  speechSynthesis?.cancel();
  rec = new SR();
  rec.lang = 'es-CO';
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
    if (ev.error === 'not-allowed' || ev.error === 'service-not-allowed') decir('Necesito permiso para usar el micrófono. Actívalo en el candado de la barra de direcciones.');
    else if (ev.error === 'no-speech') decir('No te escuché. Toca el micrófono y habla cerca del celular.');
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
  if (cerebro) { decir(`El cerebro avanzado ya está activo (${cerebro.tipo === 'chrome' ? 'modelo de Chrome' : 'Qwen 2.5 en tu equipo'}). Pregúntame lo que quieras.`); return; }
  if (cargandoCerebro) return;
  const d = await disponible().catch(() => null);
  if (!d) {
    decir('Tu navegador no puede correr un modelo de lenguaje en el equipo: necesita Chrome o Edge recientes con aceleración gráfica (WebGPU). Sigo con mi cerebro local, que entiende las órdenes de la app.');
    return;
  }
  if (d.tipo === 'webllm' && !confirm('El cerebro avanzado corre en tu equipo, gratis y privado, pero se descarga una sola vez (cerca de 1 GB). Usa Wi-Fi. ¿Lo activo?')) return;
  cargandoCerebro = true;
  poner('pensando');
  const barra = mensaje('axi', '<span>Preparando el cerebro avanzado…</span><div class="axi-barra"><i style="width:0%"></i></div>');
  try {
    cerebro = await crearCerebro(d.tipo, (p, txt) => {
      const pct = Math.round(Math.max(0, Math.min(1, p)) * 100);
      barra.querySelector('i').style.width = pct + '%';
      barra.querySelector('span').textContent = `${txt.length > 70 ? 'Descargando el modelo…' : txt} ${pct} %`;
    });
    barra.remove();
    $('#axiCerebro').textContent = 'Cerebro avanzado ✓';
    decir('Listo: ahora entiendo preguntas abiertas. Todo corre en tu equipo, sin enviar tus datos a nadie.', ['¿Qué casa me recomiendas para una familia de cuatro?', '¿Qué es la obra gris?']);
  } catch (e) {
    console.error('[axi] cerebro', e);
    barra.remove();
    decir('No pude cargar el cerebro avanzado en este equipo. Sigo con mi cerebro local.');
  }
  cargandoCerebro = false;
  poner('quieto');
}

/* ---------------- holograma ---------------- */

function poner(e) {
  estado = e;
  const t = { quieto: 'Tu arquitecto digital', escuchando: 'Te escucho…', pensando: 'Pensando…', hablando: 'Hablando…' }[e];
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
