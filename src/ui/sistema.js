/* ==========================================================================
   AXIONA OBRA · «¿Tu empresa construye algo distinto?»
   --------------------------------------------------------------------------
   Muchos arquitectos y constructoras preguntan si la app también sirve para
   lo que ellos fabrican (glampings, cabañas, módulos, bodegas...). Este
   bloque lo responde: lo puntual de cada tipo de proyecto se va integrando
   a la app, y quien lo necesite ya tiene su propio sistema integrado a la
   medida (web, configurador 3D, planos, ficha y presupuesto).
   ========================================================================== */
import { tr } from '../motor/index.js';
import { enlaceWhatsApp } from '../asistente/contacto.js';

export const EJEMPLO_SISTEMA = 'https://glamping-axiona.netlify.app';
const CLAVE_OCULTA = 'axiona-sistema-oculto';
const DIAS_OCULTA = 14;

/** Enlace de WhatsApp con el mensaje ya escrito, según el país y el idioma. */
export function enlaceSistema(pais, idioma) {
  const texto = idioma === 'en'
    ? 'Hi Axiona, I found you through Axiona Obra. My company builds: ___. I would like my own integrated system.'
    : 'Hola Axiona, vengo de Axiona Obra. Mi empresa construye: ___. Quiero mi propio sistema integrado.';
  return enlaceWhatsApp(texto, pais);
}

function botonPrincipal(pais, idioma, clase = 'btn pri') {
  const wa = enlaceSistema(pais, idioma);
  const txt = tr({ es: 'Quiero mi sistema', en: 'I want my system' });
  return wa
    ? `<a class="${clase}" href="${wa}" target="_blank" rel="noopener" data-evento="sistema-whatsapp">${txt}</a>`
    : `<button class="${clase}" data-act="soporte" data-evento="sistema-formulario">${txt}</button>`;
}

/** Tarjeta completa (pestañas Proyecto y Ventas). */
export function htmlSistema(pais, idioma) {
  return `<div class="card sistema">
    <h2>${tr({ es: '¿Tu empresa construye algo distinto?', en: 'Does your company build something different?' })}</h2>
    <p>${tr({ es: 'Vamos integrando a Axiona Obra lo puntual de cada tipo de proyecto: glampings, cabañas, módulos, bodegas, locales…', en: 'We keep adding to Axiona Obra what each kind of project needs: glamping pods, cabins, modules, warehouses, shops…' })}</p>
    <p>${tr({ es: 'Y si necesitas asesoría o quieres tu propio sistema integrado ya —tu web, el configurador 3D de lo que tú construyes, sus planos, su ficha y su presupuesto—, lo desarrollamos a la medida de tu constructora, en cualquier país.', en: 'And if you need advice or want your own integrated system now —your website, a 3D configurator of what you build, its drawings, spec sheet and budget— we develop it for your company, in any country.' })}</p>
    <div class="row">${botonPrincipal(pais, idioma)}<a class="btn" href="${EJEMPLO_SISTEMA}" target="_blank" rel="noopener" data-evento="sistema-ejemplo">${tr({ es: 'Ver un ejemplo: Glamping Studio', en: 'See an example: Glamping Studio' })}</a></div>
    <p class="note">${tr({ es: 'Te responde el equipo de Axiona Desarrollos Inteligentes.', en: 'The Axiona Desarrollos Inteligentes team will reply.' })}</p>
  </div>`;
}

/** ¿La franja superior está cerrada (en los últimos 14 días)? */
export function franjaOculta() {
  try {
    const t = +localStorage.getItem(CLAVE_OCULTA) || 0;
    return Date.now() - t < DIAS_OCULTA * 864e5;
  } catch { return false; }
}

export function ocultarFranja() {
  try { localStorage.setItem(CLAVE_OCULTA, String(Date.now())); } catch { /* modo privado */ }
}

/** Franja compacta bajo las pestañas, en todas las vistas. */
export function htmlFranjaSistema(pais, idioma) {
  if (franjaOculta()) return '';
  return `<div class="sistema-franja" role="note">
    <span>${tr({ es: '¿Construyes algo distinto? <b>Lo integramos a la medida de tu empresa.</b>', en: 'Building something different? <b>We tailor it to your company.</b>' })}</span>
    ${botonPrincipal(pais, idioma, 'btn sm pri')}
    <button class="btn sm x" data-act="cerrarSistema" aria-label="${tr({ es: 'Cerrar', en: 'Close' })}">×</button>
  </div>`;
}
