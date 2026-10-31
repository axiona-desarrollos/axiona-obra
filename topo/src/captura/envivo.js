/* ==========================================================================
   AXIONA TOPO · Celular y computador en vivo
   --------------------------------------------------------------------------
   El que mide en el lote y el que dibuja en la oficina ven el mismo
   levantamiento al tiempo. Un equipo abre la sesion y muestra un codigo QR;
   el otro lo escanea. Cada cambio viaja por un canal de paso (ntfy.sh,
   gratuito y de codigo abierto) CIFRADO de punta a punta con AES-GCM: la
   llave va en el enlace despues del #, que el navegador nunca manda a ningun
   servidor, asi que el canal de paso solo ve bytes sin sentido.
   Que cambio gana no depende de la hora de cada equipo (los relojes se
   corren): cada levantamiento lleva un contador de version que sube con
   cada cambio y nunca baja (reloj de Lamport). Gana la version mas alta; si
   empatan, decide el identificador del equipo, igual en los dos lados.
   Un levantamiento grande se parte en varios mensajes y se vuelve a armar.
   ========================================================================== */

import { aCorto, deCorto } from '../motor/compartir.js';

const SERVIDOR = 'https://ntfy.sh';
const TROZO = 3800;
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

/** Parte el texto cifrado en mensajes 'id.i.n.trozo' que caben en ntfy (4 KB). */
export function trocear(texto, max = TROZO) {
  const id = aB64(azar(6)), n = Math.max(1, Math.ceil(texto.length / max)), out = [];
  for (let i = 0; i < n; i++) out.push(`${id}.${i}.${n}.${texto.slice(i * max, (i + 1) * max)}`);
  return out;
}

/** Junta los trozos que van llegando; devuelve el texto completo cuando estan todos. */
export function armador() {
  const pend = new Map();
  return mensaje => {
    const m = /^([A-Za-z0-9_-]{8})\.(\d+)\.(\d+)\.(.*)$/s.exec(mensaje);
    if (!m) return null;
    const [, id, i, n, trozo] = m, total = +n;
    if (total === 1) return trozo;
    if (!pend.has(id)) pend.set(id, { total, partes: new Array(total), llegaron: 0, t: Date.now() });
    const p = pend.get(id);
    if (p.partes[+i] === undefined) { p.partes[+i] = trozo; p.llegaron++; }
    for (const [k, v] of pend) if (Date.now() - v.t > 120000) pend.delete(k);
    if (p.llegaron < p.total) return null;
    pend.delete(id);
    return p.partes.join('');
  };
}

/** ¿El cambio que llega (version v, del equipo de) le gana al que se tiene? */
export const gana = (v, de, miVersion, yo) => v > miVersion || (v === miVersion && de > yo);

export const esComputador = () => typeof matchMedia !== 'undefined' && matchMedia('(pointer: fine)').matches && !('ontouchstart' in window);

/**
 * Se conecta a la sesion. eventos:
 *   alRecibir(L, equipo, version, de)  llego el levantamiento de otro equipo
 *   alEquipo(equipo)       otro equipo entro (equipo: 'celular' | 'computador')
 *   alEstado(estado)       'conectando' | 'en vivo' | 'sin conexion'
 *   alPedido()             otro equipo acaba de entrar: conviene mandarle lo que hay
 * Devuelve { yo, equipo, enviar(L, version), cerrar() }.
 */
export function conectarSesion(s, { alRecibir, alEquipo = () => {}, alEstado = () => {}, alPedido = () => {} }) {
  const yo = aB64(azar(6)), equipo = esComputador() ? 'computador' : 'celular';
  const armar = armador();
  let temporizador = null, pendiente = null, cerrada = false;
  alEstado('conectando');
  const es = new EventSource(`${SERVIDOR}/${s.canal}/sse?since=all`);
  es.onopen = () => { alEstado('en vivo'); publicar({ hola: equipo }).catch(() => {}); };
  es.onerror = () => { if (!cerrada) alEstado('sin conexion'); };
  es.onmessage = async e => {
    let men;
    try { men = JSON.parse(e.data); } catch { return; }
    if (men.event !== 'message' || !men.message) return;
    const completo = armar(men.message);
    if (!completo) return;
    let d;
    try { d = await descifrar(completo, s.clave); } catch { return; }
    if (!d || d.de === yo) return;
    if (d.hola) { alEquipo(d.hola); alPedido(); return; }
    if (d.L) {
      const L = deCorto(d.L);
      if (L) alRecibir(L, d.equipo, d.v, d.de);
    }
  };
  async function publicar(obj) {
    const cuerpo = await cifrar({ de: yo, equipo, ...obj }, s.clave);
    for (const trozo of trocear(cuerpo)) {
      const r = await fetch(`${SERVIDOR}/${s.canal}`, { method: 'POST', body: trozo });
      if (!r.ok) throw new Error(r.status === 429 ? 'Demasiados cambios seguidos: el canal en vivo pide esperar unos segundos.' : `El canal en vivo no respondió (${r.status}).`);
    }
  }
  return {
    yo,
    equipo,
    /** Manda el levantamiento con su version; si llegan muchos cambios
        seguidos, solo sale el ultimo. */
    enviar(L, version) {
      pendiente = { L, v: version };
      clearTimeout(temporizador);
      return new Promise((ok, falla) => {
        temporizador = setTimeout(() => publicar({ L: aCorto(pendiente.L), v: pendiente.v }).then(ok, falla), 900);
      });
    },
    cerrar() { cerrada = true; clearTimeout(temporizador); es.close(); },
  };
}
