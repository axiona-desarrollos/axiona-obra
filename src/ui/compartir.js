/* ==========================================================================
   AXIONA OBRA · Compartir por enlace
   --------------------------------------------------------------------------
   El proyecto entero (lote, programa, precios) viaja comprimido dentro del
   enlace, despues del #: no hay servidor ni cuentas, y quien lo abre ve la
   misma casa. Se manda por WhatsApp como cualquier enlace.
   ========================================================================== */

const aB64 = bytes => {
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
const deB64 = txt => {
  const s = atob(txt.replace(/-/g, '+').replace(/_/g, '/'));
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
};
const comprime = typeof CompressionStream !== 'undefined';

export async function enlaceDelProyecto(S) {
  const json = JSON.stringify(S);
  let datos, prefijo;
  if (comprime) {
    const flujo = new Blob([json]).stream().pipeThrough(new CompressionStream('deflate-raw'));
    datos = new Uint8Array(await new Response(flujo).arrayBuffer());
    prefijo = 'z';
  } else {
    datos = new TextEncoder().encode(json);
    prefijo = 'j';
  }
  return `${location.origin}${location.pathname}#p=${prefijo}${aB64(datos)}`;
}

/** Lee el proyecto del enlace (#p=...), o null si no hay o esta dañado. */
export async function proyectoDelEnlace(hash = location.hash) {
  const m = /^#p=([zj])([A-Za-z0-9_-]+)$/.exec(hash || '');
  if (!m) return null;
  try {
    const bytes = deB64(m[2]);
    if (m[1] === 'j') return JSON.parse(new TextDecoder().decode(bytes));
    if (!comprime) return null;
    const flujo = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
    return JSON.parse(await new Response(flujo).text());
  } catch {
    return null;
  }
}
