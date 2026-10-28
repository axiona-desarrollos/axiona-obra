/* ==========================================================================
   AXIONA OBRA · Datos del proyecto
   --------------------------------------------------------------------------
   El estado es lo unico que se guarda, se exporta en .json y viaja en el
   enlace para compartir: el lote, la norma, el programa y los precios. Todo
   lo demas (planos, cantidades, 3D) se recalcula de aqui.
   ========================================================================== */

export const SOILS = {
  blando: { q: 8, label: 'Blando · limo/arcilla blanda · 8 t/m²' },
  medio: { q: 15, label: 'Medio · arcilla firme/arena · 15 t/m²' },
  firme: { q: 25, label: 'Firme · grava/roca meteorizada · 25 t/m²' },
};

export const ZONAS = ['social', 'privada', 'servicio'];

/** Precios unitarios de referencia en COP (costo directo). Editables. */
export const PRECIOS = {
  exc: 48000, rel: 38000, solado: 480000, conc: 720000, acero: 6500,
  mamp: 88000, imper: 58000, pan: 34000, est: 30000, pext: 32000,
  cielo: 36000, piso: 98000, ench: 115000, puerta: 680000,
  puertaP: 1800000, vent: 450000,
};

const rect = (w, d, dz = 0) => [{ x: 0, y: 0, z: 0 }, { x: w, y: 0, z: 0 }, { x: w, y: d, z: dz }, { x: 0, y: d, z: dz }];
const E = (name, area, floor, zone) => ({ name, area, floor, zone });

export const DEFAULT_STATE = {
  nombre: 'Casa de ejemplo',
  lot: [
    { x: 0, y: 0, z: 0 },
    { x: 12.2, y: 0.4, z: 0.35 },
    { x: 12.6, y: 20.3, z: 1.8 },
    { x: -0.3, y: 19.8, z: 1.25 },
  ],
  frente: 0,
  spots: [{ x: 6, y: 10, z: 0.95 }],
  ret: { front: 2.0, back: 3.0, lat: 1.0 },
  occ: 0.70, floors: 2, fh: 2.70, slab: 0.12,
  soil: 'medio', desp: 1.20, dlAuto: true, dl: 0.6,
  rooms: [
    E('Sala', 20, 1, 'social'), E('Comedor', 12, 1, 'social'), E('Cocina', 10, 1, 'servicio'),
    E('Baño social', 3.5, 1, 'servicio'), E('Estudio', 9, 1, 'privada'), E('Patio de ropas', 5, 1, 'servicio'),
    E('Alcoba principal', 15, 2, 'privada'), E('Baño principal', 5, 2, 'servicio'), E('Alcoba 2', 11, 2, 'privada'),
    E('Alcoba 3', 10, 2, 'privada'), E('Baño 2', 4, 2, 'servicio'), E('Estar familiar', 9, 2, 'social'),
  ],
  prices: { ...PRECIOS },
};

/** Lotes tipicos para arrancar rapido. */
export const PLANTILLAS = {
  ejemplo: { titulo: 'Ejemplo · lote 12 × 20 con pendiente', estado: () => clonar(DEFAULT_STATE) },
  medianero: {
    titulo: 'Medianero · 7 × 15, pegado a los vecinos',
    estado: () => ({
      ...clonar(DEFAULT_STATE), nombre: 'Casa medianera 7 × 15', lot: rect(7, 15, 0.6), spots: [],
      ret: { front: 1.5, back: 2.5, lat: 0 }, occ: 0.85, floors: 2,
      rooms: [
        E('Sala-comedor', 22, 1, 'social'), E('Cocina', 8, 1, 'servicio'), E('Baño social', 2.8, 1, 'servicio'),
        E('Patio de ropas', 4, 1, 'servicio'),
        E('Alcoba principal', 12, 2, 'privada'), E('Alcoba 2', 9, 2, 'privada'), E('Baño', 4, 2, 'servicio'),
        E('Estudio', 6, 2, 'privada'),
      ],
    }),
  },
  esquinero: {
    titulo: 'Esquinero · 10 × 18, 3 pisos',
    estado: () => ({
      ...clonar(DEFAULT_STATE), nombre: 'Casa esquinera 10 × 18', lot: rect(10, 18, 0.9), spots: [],
      ret: { front: 2, back: 2.5, lat: 0 }, occ: 0.75, floors: 3,
      rooms: [
        E('Local comercial', 30, 1, 'social'), E('Baño local', 3, 1, 'servicio'), E('Bodega', 8, 1, 'servicio'),
        E('Sala', 16, 2, 'social'), E('Comedor', 10, 2, 'social'), E('Cocina', 9, 2, 'servicio'), E('Baño social', 3, 2, 'servicio'),
        E('Alcoba principal', 14, 3, 'privada'), E('Alcoba 2', 10, 3, 'privada'), E('Alcoba 3', 9, 3, 'privada'),
        E('Baño principal', 4.5, 3, 'servicio'), E('Baño 2', 3.5, 3, 'servicio'),
      ],
    }),
  },
  campestre: {
    titulo: 'Campestre · 30 × 40, un piso',
    estado: () => ({
      ...clonar(DEFAULT_STATE), nombre: 'Casa campestre', lot: rect(30, 40, 2.4), spots: [{ x: 15, y: 20, z: 1.1 }],
      ret: { front: 5, back: 5, lat: 3 }, occ: 0.4, floors: 1,
      rooms: [
        E('Sala', 28, 1, 'social'), E('Comedor', 16, 1, 'social'), E('Cocina', 14, 1, 'servicio'),
        E('Alcoba principal', 18, 1, 'privada'), E('Alcoba 2', 12, 1, 'privada'), E('Alcoba 3', 12, 1, 'privada'),
        E('Baño principal', 6, 1, 'servicio'), E('Baño 2', 4.5, 1, 'servicio'), E('Baño social', 3, 1, 'servicio'),
        E('Estudio', 10, 1, 'privada'), E('Patio de ropas', 6, 1, 'servicio'),
      ],
    }),
  },
};

export function clonar(o) { return JSON.parse(JSON.stringify(o)); }

const num = (v, def) => (Number.isFinite(+v) && v !== '' && v !== null ? +v : def);

/**
 * Completa y sanea un estado que viene de afuera (localStorage, un .json o
 * un enlace compartido): lo que falte se toma del ejemplo y lo que no sea
 * un numero se descarta. Nunca lanza.
 */
export function normalizarEstado(s) {
  const d = clonar(DEFAULT_STATE);
  if (!s || typeof s !== 'object') return d;
  const pts = (l, conZ = true) => Array.isArray(l)
    ? l.filter(p => p && Number.isFinite(+p.x) && Number.isFinite(+p.y)).map(p => ({ x: +p.x, y: +p.y, z: conZ ? num(p.z, 0) : 0 }))
    : null;
  const out = {
    ...d,
    nombre: typeof s.nombre === 'string' ? s.nombre.slice(0, 80) : d.nombre,
    lot: pts(s.lot) ?? d.lot,
    spots: (pts(s.spots) ?? d.spots).filter(p => Number.isFinite(p.z)),
    frente: Math.max(0, Math.round(num(s.frente, 0))),
    ret: { front: num(s.ret?.front, d.ret.front), back: num(s.ret?.back, d.ret.back), lat: num(s.ret?.lat, d.ret.lat) },
    occ: num(s.occ, d.occ), floors: num(s.floors, d.floors), fh: num(s.fh, d.fh), slab: num(s.slab, d.slab),
    soil: SOILS[s.soil] ? s.soil : d.soil, desp: num(s.desp, d.desp),
    dlAuto: s.dlAuto === undefined ? d.dlAuto : !!s.dlAuto, dl: num(s.dl, d.dl),
    rooms: Array.isArray(s.rooms)
      ? s.rooms.filter(r => r && typeof r === 'object').map(r => ({
        name: String(r.name ?? 'Espacio').slice(0, 40), area: num(r.area, 0),
        floor: Math.max(1, Math.round(num(r.floor, 1))), zone: ZONAS.includes(r.zone) ? r.zone : 'social',
      }))
      : d.rooms,
    prices: { ...PRECIOS },
  };
  for (const k of Object.keys(PRECIOS)) out.prices[k] = num(s.prices?.[k], PRECIOS[k]);
  if (out.lot.length < 3) out.lot = d.lot;
  if (out.frente >= out.lot.length) out.frente = 0;
  return out;
}
