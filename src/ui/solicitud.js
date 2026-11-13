/* ==========================================================================
   AXIONA OBRA · Solicitud «Quiero mi sistema»
   --------------------------------------------------------------------------
   Antes, el botón abría WhatsApp directamente. En un computador sin WhatsApp
   (o si la persona no tocaba «Enviar») la solicitud se perdía. Ahora el botón
   abre esta ventana con cuatro caminos, y ninguno depende del otro:
     1. Dejar los datos aquí (llegan al formulario de Netlify y por correo).
     2. WhatsApp (en el celular abre el chat; en el PC, además, un QR para
        escanearlo con el teléfono).
     3. Correo a axionadesarrollos@gmail.com.
     4. Copiar el número.
   El Radar distingue «abrió la solicitud», «dejó sus datos», «fue a
   WhatsApp» y «fue al correo».
   ========================================================================== */
import qrcode from 'qrcode-generator';
import { tr } from '../motor/index.js';
import { CONTACTO, enlaceWhatsApp, enlaceCorreo, enviarMensaje } from '../asistente/contacto.js';
import { evento } from './analitica.js';

const T = (es, en) => tr({ es, en });
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const CLAVE_ENVIADA = 'axiona-solicitud-enviada';

export const esCelular = () => /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent || '') || (navigator.maxTouchPoints > 1 && window.innerWidth < 900);

export function textoWhatsApp(idioma, empresa = '') {
  const que = empresa.trim() || '___';
  return idioma === 'en'
    ? `Hi Axiona, I found you through Axiona Obra. My company builds: ${que}. I would like my own integrated system.`
    : `Hola Axiona, vengo de Axiona Obra. Mi empresa construye: ${que}. Quiero mi propio sistema integrado.`;
}

function qrSvg(texto) {
  const q = qrcode(0, 'M');
  q.addData(texto);
  q.make();
  return q.createSvgTag({ cellSize: 4, margin: 2, scalable: true });
}

const numeroVisible = () => `+${CONTACTO.whatsapp.slice(0, 2)} ${CONTACTO.whatsapp.slice(2, 5)} ${CONTACTO.whatsapp.slice(5, 8)} ${CONTACTO.whatsapp.slice(8)}`;

export function solicitudEnviada() {
  try { return !!localStorage.getItem(CLAVE_ENVIADA); } catch { return false; }
}

export function cerrarSolicitud() {
  document.getElementById('solicitud')?.remove();
}

/** Abre la ventana de solicitud. */
export function abrirSolicitud(pais, idioma) {
  cerrarSolicitud();
  evento('solicitud-abierta', { pais, equipo: esCelular() ? 'celular' : 'pc' });
  const cel = esCelular();
  const wa = enlaceWhatsApp(textoWhatsApp(idioma), pais);
  const correo = enlaceCorreo(T('Quiero mi sistema integrado (Axiona Obra)', 'I want my integrated system (Axiona Obra)'), textoWhatsApp(idioma));
  const ya = solicitudEnviada();
  document.body.insertAdjacentHTML('beforeend', `<div class="sol-fondo" id="solicitud" role="dialog" aria-modal="true" aria-labelledby="solTit">
  <div class="sol-caja">
    <button class="sol-x" data-sol="cerrar" aria-label="${T('Cerrar', 'Close')}">×</button>
    <h2 id="solTit">${T('Quiero mi sistema integrado', 'I want my integrated system')}</h2>
    <p class="sub">${T('Déjanos tus datos y el equipo de Axiona te escribe. Si prefieres, escríbenos tú por WhatsApp o por correo.', 'Leave your details and the Axiona team will contact you. Or write to us on WhatsApp or by email.')}</p>
    ${ya ? `<p class="sol-ok">✓ ${T('Ya recibimos una solicitud tuya desde este equipo. Si quieres agregar algo, envíala de nuevo.', 'We already received a request from this device. Send it again to add anything.')}</p>` : ''}
    <div class="sol-grid">
      <form class="sol-form" id="solForm">
        <b>1 · ${T('Déjanos tus datos', 'Leave your details')}</b>
        <input name="nombre" placeholder="${T('Tu nombre', 'Your name')}" maxlength="80" required autocomplete="name">
        <input name="empresa" placeholder="${T('Empresa (opcional)', 'Company (optional)')}" maxlength="100" autocomplete="organization">
        <input name="contacto" placeholder="${T('WhatsApp con indicativo o correo', 'WhatsApp with country code or email')}" maxlength="120" required>
        <textarea name="mensaje" rows="3" maxlength="1500" placeholder="${T('¿Qué construye tu empresa? (casas, glampings, bodegas…)', 'What does your company build? (homes, glamping pods, warehouses…)')}" required></textarea>
        <button class="btn pri">${T('Enviar solicitud', 'Send request')}</button>
        <p class="note" id="solEstado" aria-live="polite"></p>
      </form>
      <div class="sol-otros">
        <b>2 · WhatsApp</b>
        ${cel ? '' : `<div class="sol-qr" aria-label="${T('Código QR de WhatsApp', 'WhatsApp QR code')}">${qrSvg(wa)}</div><p class="note">${T('Escanéalo con la cámara de tu celular.', 'Scan it with your phone camera.')}</p>`}
        <a class="btn ${cel ? 'pri' : ''}" href="${esc(wa)}" target="_blank" rel="noopener" data-sol="wa">${cel ? T('Abrir WhatsApp', 'Open WhatsApp') : T('Abrir WhatsApp Web', 'Open WhatsApp Web')}</a>
        <p class="note">${T('Recuerda tocar «Enviar» en WhatsApp.', 'Remember to tap “Send” in WhatsApp.')}</p>
        <div class="sol-num"><span>${numeroVisible()}</span><button type="button" class="btn sm" data-sol="copiar">${T('Copiar', 'Copy')}</button></div>
        <b>3 · ${T('Correo', 'Email')}</b>
        <a class="sol-correo" href="${esc(correo)}" data-sol="correo">${CONTACTO.correo}</a>
      </div>
    </div>
  </div></div>`);
  const caja = document.getElementById('solicitud');
  caja.querySelector('input[name="nombre"]').focus({ preventScroll: true });
  caja.addEventListener('click', e => {
    const a = e.target.closest('[data-sol]');
    if (e.target === caja || a?.dataset.sol === 'cerrar') return cerrarSolicitud();
    if (!a) return;
    if (a.dataset.sol === 'wa') evento('solicitud-whatsapp', { pais });
    if (a.dataset.sol === 'correo') evento('solicitud-correo', { pais });
    if (a.dataset.sol === 'copiar') {
      evento('solicitud-copiar-numero', { pais });
      navigator.clipboard?.writeText('+' + CONTACTO.whatsapp).then(() => { a.textContent = T('Copiado ✓', 'Copied ✓'); }, () => {});
    }
  });
  caja.addEventListener('keydown', e => { if (e.key === 'Escape') cerrarSolicitud(); });
  caja.querySelector('#solForm').addEventListener('submit', async e => {
    e.preventDefault();
    const f = e.target, d = Object.fromEntries(new FormData(f).entries());
    const btn = f.querySelector('button'), est = f.querySelector('#solEstado');
    btn.disabled = true; btn.textContent = T('Enviando…', 'Sending…');
    const ok = await enviarMensaje({
      tipo: 'solicitud-sistema', nombre: d.nombre || '', empresa: d.empresa || '', contacto: d.contacto || '',
      mensaje: d.mensaje || '', pais: pais || '', pagina: location.href.slice(0, 200), idioma: idioma || '',
    });
    if (ok) {
      try { localStorage.setItem(CLAVE_ENVIADA, String(Date.now())); } catch { /* modo privado */ }
      evento('solicitud-enviada', { pais });
      f.outerHTML = `<div class="sol-form"><p class="sol-ok">✓ ${T('¡Recibido! El equipo de Axiona te escribe pronto.', 'Received! The Axiona team will contact you soon.')}</p>
        <p class="note">${T('Si quieres adelantar la conversación, escríbenos también por WhatsApp.', 'To speed things up, you can also message us on WhatsApp.')}</p>
        <a class="btn pri" href="${esc(enlaceWhatsApp(textoWhatsApp(idioma, d.mensaje || ''), pais))}" target="_blank" rel="noopener" data-sol="wa">WhatsApp</a></div>`;
    } else {
      btn.disabled = false; btn.textContent = T('Enviar solicitud', 'Send request');
      evento('solicitud-error', { pais });
      est.innerHTML = T(`No pude enviarla en este momento. Escríbenos a <a href="${esc(correo)}">${CONTACTO.correo}</a> o por WhatsApp.`, `I couldn’t send it right now. Email us at <a href="${esc(correo)}">${CONTACTO.correo}</a> or use WhatsApp.`);
    }
  });
}
