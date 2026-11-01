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

/** Registra un evento si Umami está cargado; si no, no hace nada. */
export function evento(nombre, datos) {
  try {
    const u = typeof window !== 'undefined' ? window.umami : null;
    if (u && typeof u.track === 'function') u.track(String(nombre).slice(0, 50), datos);
  } catch { /* el contador nunca rompe la app */ }
}
