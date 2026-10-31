/* ==========================================================================
   AXIONA OBRA · Contacto con el equipo
   --------------------------------------------------------------------------
   WhatsApp y correo de soporte. Mientras estén vacíos, sus botones no
   salen y el usuario escribe por el formulario, que llega al panel de
   Netlify (formulario «axiona-mensajes»).
   ========================================================================== */

export const CONTACTO = {
  whatsapp: '',  // solo dígitos con indicativo, por ejemplo 573001234567
  correo: '',
};

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

export function enlaceWhatsApp(texto) {
  return CONTACTO.whatsapp ? `https://wa.me/${CONTACTO.whatsapp}?text=${encodeURIComponent(texto)}` : '';
}

export function enlaceCorreo(asunto, texto) {
  return CONTACTO.correo ? `mailto:${CONTACTO.correo}?subject=${encodeURIComponent(asunto)}&body=${encodeURIComponent(texto)}` : '';
}
