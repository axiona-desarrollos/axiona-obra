/* ==========================================================================
   AXIONA TOPO · Levantamiento
   --------------------------------------------------------------------------
   Un levantamiento es una lista de puntos en metros locales:
     - ESQUINAS (en orden) forman el lindero del lote;
     - NIVELES son puntos sueltos con cota para leer el terreno por dentro.
   Cada punto guarda de donde salio (gps, camara, cinta, mira, archivo) y su
   precision. De ahi sale todo lo demas: area, lados, curvas de nivel,
   pendiente y movimiento de tierra.
   ========================================================================== */

import { area, perimetro, lados, angulosInternos, centroide } from './poligono.js';
import { armarTIN, curvasDeNivel, pendientes } from './tin.js';
import { volumenes, nivelDeEquilibrio, viajes } from './volumen.js';

export const FUENTES = ['gps', 'camara', 'cinta', 'mira', 'archivo', 'manual'];
export const MAX_PUNTOS = 600;

export function nuevoLevantamiento(nombre = '') {
  return {
    v: 1,
    nombre,
    metodo: '',
    origen: null,
    puntos: [],
    plataforma: { modo: 'equilibrio', z: 0 },
    huella: { activa: false, ancho: 8, fondo: 10, x: null, y: null },
    exageracion: 2,
    intervalo: 0,
    creado: new Date().toISOString(),
  };
}

const num = (v, d = null) => (v === null || v === undefined || v === '' || !Number.isFinite(+v) ? d : +v);
const texto = (v, d = '', max = 60) => (typeof v === 'string' ? v.slice(0, max) : d);

/** Limpia lo que llegue de un enlace, del almacenamiento o de un archivo. */
export function normalizar(s) {
  const L = nuevoLevantamiento();
  if (!s || typeof s !== 'object') return L;
  L.nombre = texto(s.nombre, '', 80);
  L.metodo = texto(s.metodo, '', 12);
  L.creado = texto(s.creado, L.creado, 40);
  if (s.origen && Number.isFinite(+s.origen.lat) && Number.isFinite(+s.origen.lon)
    && Math.abs(+s.origen.lat) <= 90 && Math.abs(+s.origen.lon) <= 180) L.origen = { lat: +s.origen.lat, lon: +s.origen.lon };
  const pts = Array.isArray(s.puntos) ? s.puntos : [];
  let ne = 0, nn = 0;
  for (const p of pts.slice(0, MAX_PUNTOS)) {
    if (!p || !Number.isFinite(+p.x) || !Number.isFinite(+p.y)) continue;
    const tipo = p.tipo === 'nivel' ? 'nivel' : 'esquina';
    const id = texto(p.id, '', 16) || (tipo === 'esquina' ? `P${++ne}` : `N${++nn}`);
    L.puntos.push({
      id,
      tipo,
      x: +p.x, y: +p.y,
      z: num(p.z),
      fuente: FUENTES.includes(p.fuente) ? p.fuente : 'manual',
      prec: num(p.prec),
      nota: texto(p.nota, '', 60),
    });
  }
  const pl = s.plataforma || {};
  L.plataforma = { modo: pl.modo === 'fija' ? 'fija' : 'equilibrio', z: num(pl.z, 0) };
  const h = s.huella || {};
  const medida = (v, d) => Math.min(300, Math.max(1, num(v, d)));
  L.huella = { activa: !!h.activa, ancho: medida(h.ancho, 8), fondo: medida(h.fondo, 10), x: num(h.x), y: num(h.y) };
  L.exageracion = Math.min(10, Math.max(1, num(s.exageracion, 2)));
  L.intervalo = Math.min(10, Math.max(0, num(s.intervalo, 0)));
  return L;
}

/** Siguiente nombre libre: P5 para esquinas, N3 para niveles. */
export function siguienteId(L, tipo) {
  const pre = tipo === 'nivel' ? 'N' : 'P';
  const usados = new Set(L.puntos.map(p => p.id));
  let k = L.puntos.filter(p => p.tipo === tipo).length + 1;
  while (usados.has(`${pre}${k}`)) k++;
  return `${pre}${k}`;
}

/** Intervalo de curvas segun el desnivel del lote. */
export function intervaloSugerido(desnivel) {
  if (desnivel <= 1) return 0.1;
  if (desnivel <= 3) return 0.25;
  if (desnivel <= 8) return 0.5;
  if (desnivel <= 25) return 1;
  if (desnivel <= 60) return 2;
  return 5;
}

/** Cota por distancia inversa al cuadrado, para los puntos que no tienen. */
function rellenarCotas(puntos) {
  const con = puntos.filter(p => Number.isFinite(p.z));
  if (!con.length) return { puntos: puntos.map(p => ({ ...p, z: 0, estimada: true })), sinNiveles: true };
  return {
    sinNiveles: false,
    puntos: puntos.map(p => {
      if (Number.isFinite(p.z)) return p;
      let sw = 0, sz = 0;
      for (const q of con) { const w = 1 / Math.max(1e-6, (p.x - q.x) ** 2 + (p.y - q.y) ** 2); sw += w; sz += w * q.z; }
      return { ...p, z: sz / sw, estimada: true };
    }),
  };
}

/**
 * Huella de la obra: rectangulo de ancho x fondo, paralelo al frente del lote
 * (lado P1 -> P2), centrado en (x, y) o en el centro del lote.
 */
export function rectanguloHuella(esquinas, h, centro) {
  const a = esquinas[0], b = esquinas[1], d = Math.hypot(b.x - a.x, b.y - a.y) || 1;
  const u = { x: (b.x - a.x) / d, y: (b.y - a.y) / d }, v = { x: -u.y, y: u.x };
  const c = { x: h.x ?? centro.x, y: h.y ?? centro.y }, ra = h.ancho / 2, rf = h.fondo / 2;
  return [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([i, j]) => ({ x: c.x + u.x * ra * i + v.x * rf * j, y: c.y + u.y * ra * i + v.y * rf * j }));
}

/** Todo lo que se calcula de un levantamiento. */
export function calcular(L) {
  const R = rellenarCotas(L.puntos);
  const P = R.puntos;
  const esquinas = P.filter(p => p.tipo === 'esquina');
  const lote = esquinas.length >= 3;
  const lindero = lote ? esquinas.map(p => ({ x: p.x, y: p.y, z: p.z })) : [];
  const out = {
    puntos: P,
    esquinas,
    niveles: P.filter(p => p.tipo === 'nivel'),
    lindero,
    sinNiveles: R.sinNiveles,
    estimadas: P.filter(p => p.estimada).length,
    area: lote ? area(lindero) : 0,
    perimetro: lote ? perimetro(lindero) : 0,
    lados: lote ? lados(lindero) : [],
    angulos: lote ? angulosInternos(lindero) : [],
    centro: lote ? centroide(lindero) : P.length ? { x: P.reduce((s, p) => s + p.x, 0) / P.length, y: P.reduce((s, p) => s + p.y, 0) / P.length } : { x: 0, y: 0 },
  };
  const zs = P.map(p => p.z);
  out.zmin = zs.length ? Math.min(...zs) : 0;
  out.zmax = zs.length ? Math.max(...zs) : 0;
  out.desnivel = out.zmax - out.zmin;
  out.T = armarTIN(P, lote ? lindero : null);
  out.intervalo = L.intervalo > 0 ? L.intervalo : intervaloSugerido(out.desnivel);
  out.curvas = R.sinNiveles || out.desnivel < 1e-6 ? [] : curvasDeNivel(out.T, out.intervalo);
  out.pendiente = pendientes(out.T);
  out.huella = null;
  out.huellaFuera = false;
  if (lote && L.huella?.activa && out.T.triangulos.length) {
    out.huella = rectanguloHuella(esquinas, L.huella, out.centro);
    if (!(volumenes(out.T, 0, out.huella).area > 0.01)) { out.huella = null; out.huellaFuera = true; }
  }
  if (out.T.triangulos.length) {
    const eq = nivelDeEquilibrio(out.T, out.huella);
    const Z0 = L.plataforma.modo === 'fija' ? L.plataforma.z : eq;
    const v = volumenes(out.T, Z0, out.huella);
    out.plataforma = { z: Z0, equilibrio: eq, modo: L.plataforma.modo };
    out.volumen = { ...v, viajes6: viajes(v.corte), viajes14: viajes(v.corte, { capacidad: 14 }) };
  } else {
    out.plataforma = null;
    out.volumen = null;
  }
  return out;
}
