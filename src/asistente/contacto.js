/* ==========================================================================
   AXIONA OBRA · Contacto con el equipo
   --------------------------------------------------------------------------
   WhatsApp y correo de soporte (los mismos de axionasoft.com). Si se dejan
   vacíos, sus botones no salen y el usuario escribe por el formulario, que
   llega al panel de Netlify (formulario «axiona-mensajes»).
   ========================================================================== */

export const CONTACTO = {
  whatsapp: '573103922935',  // solo dígitos con indicativo (línea comercial Colombia)
  correo: 'axionadesarrollos@gmail.com',
  // línea por país cuando la hay; los demás países usan la de Colombia
  porPais: { ES: '34637393045' },
};

/** Número de WhatsApp para quien usa la app en ese país. */
export function numeroWhatsApp(pais) {
  return (pais && CONTACTO.porPais[pais]) || CONTACTO.whatsapp;
}

export const FORMULARIO = 'axiona-mensajes';

/** Envía el mensaje al formulario de Netlify. Devuelve true si llegó. */
export async function enviarMensaje(datos) {
  const cuerpo = new URLSearchParams({ 'form-name': FORMULARIO, ...datos });
  try {
    const r = await fetch('/', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: cuerpo.toString() });
    return r.ok;
  } catch {
    return false;
  }
}

export function enlaceWhatsApp(texto, pais) {
  const n = numeroWhatsApp(pais);
  return n ? `https://wa.me/${n}?text=${encodeURIComponent(texto)}` : '';
}

export function enlaceCorreo(asunto, texto) {
  return CONTACTO.correo ? `mailto:${CONTACTO.correo}?subject=${encodeURIComponent(asunto)}&body=${encodeURIComponent(texto)}` : '';
}
