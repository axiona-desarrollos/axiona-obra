/* ==========================================================================
   AXIONA OBRA · Idioma
   --------------------------------------------------------------------------
   Los textos van junto al codigo que los usa, como objetos {es, en}. tr()
   escoge el del idioma activo. El motor tambien escribe avisos y nombres de
   partidas, por eso esto vive aqui y no en la interfaz: buildModel fija el
   idioma del proyecto antes de calcular.
   ========================================================================== */

export const IDIOMAS = ['es', 'en'];
let actual = 'es';

export function setIdioma(l) { actual = IDIOMAS.includes(l) ? l : 'es'; }
export const idioma = () => actual;

/** Texto en el idioma activo. Acepta {es, en} o un string; {clave} se reemplaza con vars. */
export function tr(o, vars) {
  let s = o == null ? '' : typeof o === 'string' ? o : (o[actual] ?? o.es ?? o.en ?? '');
  if (vars) s = s.replace(/\{(\w+)\}/g, (_, k) => (vars[k] ?? ''));
  return s;
}
