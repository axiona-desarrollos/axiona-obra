/* ==========================================================================
   AXIONA TOPO · Compartir por enlace
   --------------------------------------------------------------------------
   El levantamiento viaja comprimido dentro del enlace, despues del #. No hay
   servidor ni cuentas: quien abre el enlace en su celular ve el mismo
   terreno en 3D. Los puntos van como listas cortas y redondeados al
   centimetro para que el enlace quepa en un mensaje de WhatsApp.
   ========================================================================== */

import { normalizar } from './levantamiento.js';

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
const comprime = () => typeof CompressionStream !== 'undefined';

/** Objeto -> texto para el enlace: 'z' + deflate en base64url, o 'j' sin comprimir. */
export async function empacar(obj) {
  const json = JSON.stringify(obj);
  if (comprime()) {
    const flujo = new Blob([json]).stream().pipeThrough(new CompressionStream('deflate-raw'));
    return 'z' + aB64(new Uint8Array(await new Response(flujo).arrayBuffer()));
  }
  return 'j' + aB64(new TextEncoder().encode(json));
}

export async function desempacar(txt) {
  const m = /^([zj])([A-Za-z0-9_-]+)$/.exec(txt || '');
  if (!m) return null;
  try {
    const bytes = deB64(m[2]);
    if (m[1] === 'j') return JSON.parse(new TextDecoder().decode(bytes));
    if (!comprime()) return null;
    const flujo = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
    return JSON.parse(await new Response(flujo).text());
  } catch {
    return null;
  }
}

const cm = v => (Number.isFinite(v) ? Math.round(v * 100) / 100 : null);
const FUENTE = ['gps', 'camara', 'cinta', 'mira', 'archivo', 'manual'];

/** Levantamiento -> forma corta para el enlace. */
export function aCorto(L) {
  return {
    v: 1,
    n: L.nombre,
    m: L.metodo,
    o: L.origen ? [+L.origen.lat.toFixed(8), +L.origen.lon.toFixed(8), cm(L.origen.alt)] : 0,
    p: L.puntos.map(p => [p.id, cm(p.x), cm(p.y), cm(p.z), p.tipo === 'nivel' ? 1 : 0, Math.max(0, FUENTE.indexOf(p.fuente)), p.prec == null ? 0 : Math.round(p.prec * 10) / 10]),
    pl: L.plataforma.modo === 'fija' ? cm(L.plataforma.z) : null,
    h: L.huella?.activa ? [cm(L.huella.ancho), cm(L.huella.fondo), cm(L.huella.x), cm(L.huella.y)] : 0,
    ex: L.exageracion,
    iv: L.intervalo,
    s: L.suelo,
  };
}

export function deCorto(c) {
  if (!c || c.v !== 1 || !Array.isArray(c.p)) return null;
  return normalizar({
    nombre: c.n,
    metodo: c.m,
    origen: Array.isArray(c.o) ? { lat: c.o[0], lon: c.o[1], alt: c.o[2] } : null,
    puntos: c.p.map(q => Array.isArray(q) && ({
      id: q[0], x: q[1], y: q[2], z: q[3], tipo: q[4] === 1 ? 'nivel' : 'esquina', fuente: FUENTE[q[5]] || 'manual', prec: q[6] || null,
    })).filter(Boolean),
    plataforma: c.pl == null ? { modo: 'equilibrio' } : { modo: 'fija', z: c.pl },
    huella: Array.isArray(c.h) ? { activa: true, ancho: c.h[0], fondo: c.h[1], x: c.h[2], y: c.h[3] } : { activa: false },
    exageracion: c.ex,
    intervalo: c.iv,
    suelo: c.s,
  });
}

/** Enlace completo para compartir: base + '#t=' + datos. */
export async function enlaceDe(L, base) {
  return `${base}#t=${await empacar(aCorto(L))}`;
}

/** Lee el levantamiento de un hash '#t=…'; null si no hay o esta dañado. */
export async function deEnlace(hash) {
  const m = /^#t=(.+)$/.exec(hash || '');
  if (!m) return null;
  return deCorto(await desempacar(m[1]));
}
