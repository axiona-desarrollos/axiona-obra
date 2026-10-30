/* ==========================================================================
   AXIONA TOPO · Celular y computador en vivo
   --------------------------------------------------------------------------
   El que mide en el lote y el que dibuja en la oficina ven el mismo
   levantamiento al tiempo. Un equipo abre la sesion y muestra un codigo QR;
   el otro lo escanea. Cada cambio viaja por un canal de paso (ntfy.sh,
   gratuito y de codigo abierto) CIFRADO de punta a punta con AES-GCM: la
   llave va en el enlace despues del #, que el navegador nunca manda a ningun
   servidor, asi que el canal de paso solo ve bytes sin sentido.
   Si dos equipos cambian algo, gana el cambio mas reciente.
   ========================================================================== */

import { aCorto, deCorto } from '../motor/compartir.js';

const SERVIDOR = 'https://ntfy.sh';
const LIMITE = 3900;
const aB64 = bytes => { let s = ''; for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
const deB64 = t => { const s = atob(t.replace(/-/g, '+').replace(/_/g, '/')); const o = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) o[i] = s.charCodeAt(i); return o; };
const azar = n => crypto.getRandomValues(new Uint8Array(n));

async function comprimir(texto) {
  const flujo = new Blob([texto]).stream().pipeThrough(new CompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(flujo).arrayBuffer());
}
async function descomprimir(bytes) {
  const flujo = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new Response(flujo).text();
}

/** Sesion nueva: canal al azar (nadie lo adivina) y llave AES de 256 bits. */
export function nuevaSesion() {
  return { canal: 'axtopo-' + aB64(azar(15)).replace(/[-_]/g, 'x'), clave: aB64(azar(32)) };
}

export const enlaceSesion = (s, base) => `${base}#v=${s.canal}.${s.clave}`;

export function sesionDelEnlace(hash) {
  const m = /^#v=(axtopo-[A-Za-z0-9]{10,40})\.([A-Za-z0-9_-]{43})$/.exec(hash || '');
  return m ? { canal: m[1], clave: m[2] } : null;
}

const llave = clave => crypto.subtle.importKey('raw', deB64(clave), 'AES-GCM', false, ['encrypt', 'decrypt']);

/** Objeto -> texto cifrado (iv de 12 bytes + datos comprimidos y cifrados). */
export async function cifrar(obj, clave) {
  const iv = azar(12);
  const datos = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await llave(clave), await comprimir(JSON.stringify(obj)));
  const todo = new Uint8Array(12 + datos.byteLength);
  todo.set(iv); todo.set(new Uint8Array(datos), 12);
  return aB64(todo);
}

export async function descifrar(texto, clave) {
  const b = deB64(texto);
  const plano = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b.slice(0, 12) }, await llave(clave), b.slice(12));
  return JSON.parse(await descomprimir(new Uint8Array(plano)));
}

export const esComputador = () => typeof matchMedia !== 'undefined' && matchMedia('(pointer: fine)').matches && !('ontouchstart' in window);

/**
 * Se conecta a la sesion. eventos:
 *   alRecibir(L, equipo, t)  llego el levantamiento de otro equipo, cambiado en t (ms)
 *   alEquipo(equipo)      otro equipo entro (equipo: 'celular' | 'computador')
 *   alEstado(estado)      'conectando' | 'en vivo' | 'sin conexion'
 * Devuelve { enviar(L), cerrar() }.
 */
export function conectarSesion(s, { alRecibir, alEquipo = () => {}, alEstado = () => {}, alPedido = () => {} }) {
  const yo = aB64(azar(6)), equipo = esComputador() ? 'computador' : 'celular';
  let temporizador = null, pendiente = null, cerrada = false;
  alEstado('conectando');
  const es = new EventSource(`${SERVIDOR}/${s.canal}/sse?since=all`);
  es.onopen = () => { alEstado('en vivo'); publicar({ hola: equipo }); };
  es.onerror = () => { if (!cerrada) alEstado('sin conexion'); };
  es.onmessage = async e => {
    let men;
    try { men = JSON.parse(e.data); } catch { return; }
    if (men.event !== 'message' || !men.message) return;
    let d;
    try { d = await descifrar(men.message, s.clave); } catch { return; }
    if (!d || d.de === yo) return;
    if (d.hola) { alEquipo(d.hola); alPedido(); return; }
    if (d.L) {
      const L = deCorto(d.L);
      if (L) alRecibir(L, d.equipo, d.t);
    }
  };
  async function publicar(obj) {
    const cuerpo = await cifrar({ de: yo, equipo, t: Date.now(), ...obj }, s.clave);
    if (cuerpo.length > LIMITE) throw new Error('El levantamiento es muy grande para la sesión en vivo (más de unos 150 puntos). Compártalo con el enlace.');
    const r = await fetch(`${SERVIDOR}/${s.canal}`, { method: 'POST', body: cuerpo });
    if (!r.ok) throw new Error(`El canal en vivo no respondió (${r.status}).`);
  }
  return {
    equipo,
    /** Manda el levantamiento con la hora de su ultimo cambio (gana el mas
        reciente); si llegan muchos cambios seguidos, solo sale el ultimo. */
    enviar(L, t = Date.now()) {
      pendiente = { L, t };
      clearTimeout(temporizador);
      return new Promise((ok, falla) => {
        temporizador = setTimeout(() => publicar({ L: aCorto(pendiente.L), t: pendiente.t }).then(ok, falla), 900);
      });
    },
    cerrar() { cerrada = true; clearTimeout(temporizador); es.close(); },
  };
}
