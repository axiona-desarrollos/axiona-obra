/* ==========================================================================
   AXIONA OBRA · Contador de uso (Umami)
   --------------------------------------------------------------------------
   Apagado mientras no exista VITE_UMAMI_ID (variable de entorno del build en
   Netlify). Con el código del sitio, carga Umami: sin cookies, sin datos
   personales. Solo cuenta visitas, país y qué funciones se usan (abrir el
   3D, descargar el PDF, la AR...). Los datos del proyecto nunca salen del
   navegador.
   ========================================================================== */
const ID = (import.meta.env?.VITE_UMAMI_ID || '').trim();
const HOST = (import.meta.env?.VITE_UMAMI_HOST || 'https://cloud.umami.is').replace(/\/$/, '');

export const analiticaActiva = () => Boolean(ID) && Boolean(import.meta.env?.PROD);

export function iniciarAnalitica() {
  if (!analiticaActiva() || typeof document === 'undefined') return;
  const s = document.createElement('script');
  s.defer = true;
  s.src = `${HOST}/script.js`;
  s.dataset.websiteId = ID;
  document.head.appendChild(s);
}

const enviadosRadar = new Set();

/** Registra un evento en Axiona Radar y, si está cargado, en Umami. Si no hay contador, no hace nada. */
export function evento(nombre, datos) {
  try {
    if (typeof window === 'undefined') return;
    const n = String(nombre).slice(0, 50);
    const u = window.umami;
    if (u && typeof u.track === 'function') u.track(n, datos);
    // Radar: cada acción distinta se cuenta una vez por visita, para ver qué funciones usan sin inundar el informe.
    const clave = n + (datos ? JSON.stringify(datos) : '');
    if (typeof window.radar === 'function' && !enviadosRadar.has(clave)) {
      enviadosRadar.add(clave);
      window.radar(n, datos);
    }
  } catch { /* el contador nunca rompe la app */ }
}
