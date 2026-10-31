/* ==========================================================================
   AXIONA OBRA · Datos del proyecto
   --------------------------------------------------------------------------
   El estado es lo unico que se guarda, se exporta en .json y viaja en el
   enlace para compartir: pais, lote, norma, programa, interiores, datos
   del rotulo y precios. Todo lo demas (planos, cantidades, 3D, laminas) se
   recalcula de aqui.
   ========================================================================== */

import { PAISES, PRECIOS_PAIS, PAPELES, CUBIERTAS, SISTEMAS, pais as paisDe } from './paises.js';
import { ESTILOS, PISOS } from './catalogo.js';
import { domoticaPorDefecto } from './domotica.js';
import { ENTIDADES, ZONAS_MX, FSR_BASE } from './mexico.js';
import { FORMAS } from './distribucion.js';

export const SOILS = {
  blando: { q: 8, n: { es: 'Blando · limo o arcilla blanda', en: 'Soft · silt or soft clay' } },
  medio: { q: 15, n: { es: 'Medio · arcilla firme o arena', en: 'Medium · stiff clay or sand' } },
  firme: { q: 25, n: { es: 'Firme · grava o roca meteorizada', en: 'Firm · gravel or weathered rock' } },
};

export const ZONAS = ['social', 'privada', 'servicio'];

/** Precios de Colombia (compatibilidad con proyectos de la version 2). */
export const PRECIOS = PRECIOS_PAIS.CO;

const rect = (w, d, dz = 0) => [{ x: 0, y: 0, z: 0 }, { x: w, y: 0, z: 0 }, { x: w, y: d, z: dz }, { x: 0, y: d, z: dz }];
const E = (name, area, floor, zone) => ({ name, area, floor, zone });
const FT = 0.3048;

/** Lo que se carga al escoger un pais: sistema, cubierta, unidades, papel y precios. */
export function datosDePais(id) {
  const P = paisDe(id);
  return {
    pais: P.id, idioma: P.idioma, unidades: P.unidades, sistema: P.sistema, sotano: P.sotano,
    cubierta: { ...P.cubierta }, prices: { ...PRECIOS_PAIS[P.id] }, laminas: { papel: P.papel, ocultas: [] },
    profesionales: P.profesionales.map(p => ({ rol: p.id, nombre: '', doc: '' })),
    acabados: { estilo: P.id === 'ES' ? 'calido' : P.id === 'CA' ? 'nordico' : 'moderno', pisos: {} },
  };
}

const BASE = {
  nombre: 'Casa de ejemplo',
  ...datosDePais('CO'),
  proyecto: { propietario: '', direccion: '', ciudad: 'Sabaneta, Antioquia', predio: '', empresa: 'Axiona Desarrollos Inteligentes', revision: '0', aprobado: false },
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
  forma: { tipo: 'recta', paso: 2.5, balcones: false, curvas: false },
  soil: 'medio', qadm: 0, desp: 1.20, freatico: 0, dlAuto: true, dl: 0.6,
  aa: 0, av: 0, ab: 0, zona: '', nieve: 0, helada: 0, sa: 0,
  rooms: [
    E('Sala', 20, 1, 'social'), E('Comedor', 12, 1, 'social'), E('Cocina', 10, 1, 'servicio'),
    E('Baño social', 3.5, 1, 'servicio'), E('Estudio', 9, 1, 'privada'), E('Patio de ropas', 5, 1, 'servicio'),
    E('Alcoba principal', 15, 2, 'privada'), E('Baño principal', 5, 2, 'servicio'), E('Alcoba 2', 11, 2, 'privada'),
    E('Alcoba 3', 10, 2, 'privada'), E('Baño 2', 4, 2, 'servicio'), E('Estar familiar', 9, 2, 'social'),
  ],
  amoblar: true,
  muebles: { quitar: [] },
  domotica: [],
  ascensor: false, ascensorVoz: true,
  tramites: {},
  condominio: { on: false, macro: rect(96, 74, 2.5), via: 8, lote: 0, fondo: 0, estados: {}, precioM2: 0 },
  // solo cuenta en México: entidad, zona geotécnica de la CDMX, riesgo, agua y jornal para el FSR
  mx: { entidad: 'cdmx', zona: '', riesgo: false, reserva: 3, dotacion: 0, salario: FSR_BASE.salario },
};
export const DEFAULT_STATE = BASE;

/** Lotes tipicos por pais para arrancar rapido. */
export const PLANTILLAS = {
  CO: {
    ejemplo: { titulo: { es: 'Ejemplo · lote 12 × 20 con pendiente', en: 'Example · 12 × 20 sloped lot' }, estado: () => clonar(BASE) },
    medianero: {
      titulo: { es: 'Medianero · 7 × 15, pegado a los vecinos', en: 'Row house · 7 × 15' },
      estado: () => ({
        ...clonar(BASE), nombre: 'Casa medianera 7 × 15', lot: rect(7, 15, 0.6), spots: [],
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
      titulo: { es: 'Esquinero · 10 × 18, 3 pisos con local', en: 'Corner · 10 × 18, 3 storeys with store' },
      estado: () => ({
        ...clonar(BASE), nombre: 'Casa esquinera 10 × 18', lot: rect(10, 18, 0.9), spots: [],
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
      titulo: { es: 'Campestre · 30 × 40, un piso, cubierta a dos aguas', en: 'Country house · 30 × 40, one storey' },
      estado: () => ({
        ...clonar(BASE), nombre: 'Casa campestre', lot: rect(30, 40, 2.4), spots: [{ x: 15, y: 20, z: 1.1 }],
        ret: { front: 5, back: 5, lat: 3 }, occ: 0.4, floors: 1, cubierta: { tipo: 'dos', pend: 35, alero: 0.8 },
        acabados: { estilo: 'campestre', pisos: {} },
        rooms: [
          E('Sala', 28, 1, 'social'), E('Comedor', 16, 1, 'social'), E('Cocina', 14, 1, 'servicio'),
          E('Alcoba principal', 18, 1, 'privada'), E('Alcoba 2', 12, 1, 'privada'), E('Alcoba 3', 12, 1, 'privada'),
          E('Baño principal', 6, 1, 'servicio'), E('Baño 2', 4.5, 1, 'servicio'), E('Baño social', 3, 1, 'servicio'),
          E('Estudio', 10, 1, 'privada'), E('Patio de ropas', 6, 1, 'servicio'),
        ],
      }),
    },
    edificio: {
      titulo: { es: 'Edificio · 5 pisos con ascensor por voz', en: 'Building · 5 storeys, voice elevator' },
      estado: () => ({
        ...clonar(BASE), nombre: 'Edificio de 5 pisos', lot: rect(12, 24, 0.4), spots: [],
        ret: { front: 3, back: 3, lat: 0 }, occ: 0.8, floors: 5, ascensor: true, ascensorVoz: true,
        acabados: { estilo: 'lujo', pisos: {} },
        rooms: [
          E('Local comercial', 42, 1, 'social'), E('Baño local', 3, 1, 'servicio'), E('Portería', 8, 1, 'servicio'),
          ...[2, 3, 4, 5].flatMap(p => [
            E(`Sala-comedor ${p}01`, 26, p, 'social'), E(`Cocina ${p}01`, 9, p, 'servicio'), E(`Alcoba principal ${p}01`, 14, p, 'privada'),
            E(`Alcoba 2 ${p}01`, 10, p, 'privada'), E(`Baño principal ${p}01`, 4.5, p, 'servicio'), E(`Baño 2 ${p}01`, 3.5, p, 'servicio'),
            E(`Ropas ${p}01`, 3.5, p, 'servicio'),
          ]),
        ],
      }),
    },
  },
  ES: {
    chalet: {
      titulo: { es: 'Chalet aislado · parcela 20 × 30, dos plantas', en: 'Detached villa · 20 × 30 plot, two storeys' },
      estado: () => ({
        ...clonar(BASE), ...datosDePais('ES'), nombre: 'Vivienda unifamiliar aislada', lot: rect(20, 30, 1.6), spots: [],
        proyecto: { ...BASE.proyecto, ciudad: 'Collado Villalba, Madrid' },
        ret: { front: 4, back: 4, lat: 3 }, occ: 0.4, floors: 2, fh: 3.0, slab: 0.3,
        rooms: [
          E('Salón', 30, 1, 'social'), E('Comedor', 15, 1, 'social'), E('Cocina', 14, 1, 'servicio'), E('Aseo', 3, 1, 'servicio'),
          E('Despacho', 10, 1, 'privada'), E('Lavadero', 6, 1, 'servicio'),
          E('Dormitorio principal', 18, 2, 'privada'), E('Baño principal', 7, 2, 'servicio'), E('Dormitorio 2', 12, 2, 'privada'),
          E('Dormitorio 3', 12, 2, 'privada'), E('Baño 2', 5, 2, 'servicio'), E('Sala de estar', 10, 2, 'social'),
        ],
      }),
    },
    adosado: {
      titulo: { es: 'Adosado · 7 × 22, dos plantas', en: 'Townhouse · 7 × 22, two storeys' },
      estado: () => ({
        ...clonar(BASE), ...datosDePais('ES'), nombre: 'Vivienda adosada', lot: rect(7, 22, 0.5), spots: [],
        proyecto: { ...BASE.proyecto, ciudad: 'Madrid' },
        ret: { front: 3, back: 5, lat: 0 }, occ: 0.6, floors: 2, fh: 3.0, slab: 0.3, cubierta: { tipo: 'dos', pend: 30, alero: 0.4 },
        rooms: [
          E('Salón-comedor', 26, 1, 'social'), E('Cocina', 10, 1, 'servicio'), E('Aseo', 2.8, 1, 'servicio'),
          E('Dormitorio principal', 14, 2, 'privada'), E('Dormitorio 2', 10, 2, 'privada'), E('Baño', 5, 2, 'servicio'), E('Estudio', 7, 2, 'privada'),
        ],
      }),
    },
  },
  CA: {
    detached: {
      titulo: { es: 'Casa unifamiliar · lote 50 × 110 pies, sótano', en: 'Detached house · 50 × 110 ft lot, basement' },
      estado: () => ({
        ...clonar(BASE), ...datosDePais('CA'), nombre: 'Detached two-storey home', lot: rect(50 * FT, 110 * FT, 0.8), spots: [],
        proyecto: { ...BASE.proyecto, ciudad: 'Toronto, Ontario' },
        ret: { front: 6, back: 7.5, lat: 1.2 }, occ: 0.4, floors: 2, fh: 2.9, slab: 0.3, desp: 2.6, helada: 1.2,
        rooms: [
          E('Living room', 24, 1, 'social'), E('Dining room', 14, 1, 'social'), E('Kitchen', 15, 1, 'servicio'),
          E('Powder room', 3, 1, 'servicio'), E('Den / office', 10, 1, 'privada'), E('Mudroom / laundry', 6, 1, 'servicio'),
          E('Primary bedroom', 18, 2, 'privada'), E('Primary ensuite bath', 8, 2, 'servicio'), E('Bedroom 2', 12, 2, 'privada'),
          E('Bedroom 3', 11, 2, 'privada'), E('Bathroom', 5.5, 2, 'servicio'), E('Family room', 10, 2, 'social'),
        ],
      }),
    },
    fourplex: {
      titulo: { es: 'Fourplex · 2 pisos, 4 viviendas (estilo catálogo federal)', en: 'Fourplex · 2 storeys, 4 units (catalogue style)' },
      estado: () => ({
        ...clonar(BASE), ...datosDePais('CA'), nombre: 'Fourplex', lot: rect(50 * FT, 120 * FT, 0.6), spots: [],
        proyecto: { ...BASE.proyecto, ciudad: 'Ottawa, Ontario' },
        ret: { front: 6, back: 7.5, lat: 1.2 }, occ: 0.45, floors: 2, fh: 2.9, slab: 0.3, desp: 2.6, helada: 1.5,
        rooms: [1, 2].flatMap(p => [
          E(`Unit ${p}A living / dining`, 26, p, 'social'), E(`Unit ${p}A kitchen`, 9, p, 'servicio'), E(`Unit ${p}A bedroom 1`, 12, p, 'privada'),
          E(`Unit ${p}A bedroom 2`, 10, p, 'privada'), E(`Unit ${p}A bathroom`, 5, p, 'servicio'),
          E(`Unit ${p}B living / dining`, 26, p, 'social'), E(`Unit ${p}B kitchen`, 9, p, 'servicio'), E(`Unit ${p}B bedroom 1`, 12, p, 'privada'),
          E(`Unit ${p}B bedroom 2`, 10, p, 'privada'), E(`Unit ${p}B bathroom`, 5, p, 'servicio'),
        ]),
      }),
    },
  },
  MX: {
    tipoA: {
      titulo: { es: 'Casa tipo A · 6.5 × 16, dos niveles, hasta 120 m² (CDMX)', en: 'Type A house · 6.5 × 16, two storeys, up to 120 m² (Mexico City)' },
      estado: () => ({
        ...clonar(BASE), ...datosMX(), nombre: 'Casa unifamiliar tipo A', lot: rect(6.5, 16, 0.3), spots: [],
        proyecto: { ...BASE.proyecto, ciudad: 'Iztapalapa, Ciudad de México' },
        ret: { front: 1.5, back: 3, lat: 0 }, occ: 0.75, floors: 2, fh: 2.6, slab: 0.16,
        mx: { ...BASE.mx, zona: 'III' },
        rooms: [
          E('Estancia-comedor', 18.5, 1, 'social'), E('Cocina', 7, 1, 'servicio'), E('Medio baño', 2.5, 1, 'servicio'), E('Patio de servicio', 4, 1, 'servicio'),
          E('Recámara principal', 12, 2, 'privada'), E('Recámara 2', 9, 2, 'privada'), E('Baño completo', 4, 2, 'servicio'),
        ],
      }),
    },
    media: {
      titulo: { es: 'Casa media · 8 × 18, dos niveles, 3 recámaras', en: 'Mid-range house · 8 × 18, two storeys, 3 bedrooms' },
      estado: () => ({
        ...clonar(BASE), ...datosMX(), nombre: 'Casa media 8 × 18', lot: rect(8, 18, 0.5), spots: [],
        proyecto: { ...BASE.proyecto, ciudad: 'Coyoacán, Ciudad de México' },
        ret: { front: 2, back: 3, lat: 0 }, occ: 0.75, floors: 2, fh: 2.6, slab: 0.16,
        mx: { ...BASE.mx, zona: 'II' },
        rooms: [
          E('Estancia', 18, 1, 'social'), E('Comedor', 10, 1, 'social'), E('Cocina', 9, 1, 'servicio'), E('Medio baño', 2.5, 1, 'servicio'),
          E('Patio de servicio', 4, 1, 'servicio'), E('Estudio', 8.5, 1, 'privada'),
          E('Recámara principal', 14, 2, 'privada'), E('Baño principal', 4.5, 2, 'servicio'), E('Recámara 2', 10, 2, 'privada'),
          E('Recámara 3', 9.5, 2, 'privada'), E('Baño completo', 4, 2, 'servicio'), E('Estancia familiar', 8, 2, 'social'),
        ],
      }),
    },
    local: {
      titulo: { es: 'Casa con local · 10 × 20, tres niveles (Querétaro)', en: 'House with shop · 10 × 20, three storeys (Querétaro)' },
      estado: () => ({
        ...clonar(BASE), ...datosMX(), nombre: 'Casa con local comercial', lot: rect(10, 20, 0.6), spots: [],
        proyecto: { ...BASE.proyecto, ciudad: 'Santiago de Querétaro, Querétaro' },
        ret: { front: 2, back: 3, lat: 0 }, occ: 0.75, floors: 3, fh: 2.7, slab: 0.25,
        mx: { ...BASE.mx, entidad: 'qro' },
        rooms: [
          E('Local comercial', 35, 1, 'social'), E('Medio baño del local', 3, 1, 'servicio'), E('Bodega', 9, 1, 'servicio'),
          E('Estancia-comedor', 22, 2, 'social'), E('Cocina', 9, 2, 'servicio'), E('Medio baño', 3, 2, 'servicio'), E('Cuarto de lavado', 4, 2, 'servicio'),
          E('Recámara principal', 13, 3, 'privada'), E('Recámara 2', 10, 3, 'privada'), E('Recámara 3', 9, 3, 'privada'),
          E('Baño principal', 4.5, 3, 'servicio'), E('Baño completo', 3.5, 3, 'servicio'),
        ],
      }),
    },
    edificio: {
      titulo: { es: 'Edificio de departamentos · 5 niveles con elevador (Guadalajara)', en: 'Apartment building · 5 storeys with elevator (Guadalajara)' },
      estado: () => ({
        ...clonar(BASE), ...datosMX(), nombre: 'Edificio de departamentos', lot: rect(12, 24, 0.4), spots: [], sistema: 'porticos',
        proyecto: { ...BASE.proyecto, ciudad: 'Guadalajara, Jalisco' },
        ret: { front: 3, back: 3, lat: 0 }, occ: 0.8, floors: 5, fh: 2.7, slab: 0.25, ascensor: true, ascensorVoz: true,
        mx: { ...BASE.mx, entidad: 'jal' },
        rooms: [
          E('Local comercial', 42, 1, 'social'), E('Medio baño del local', 3, 1, 'servicio'), E('Caseta de vigilancia', 8, 1, 'servicio'),
          ...[2, 3, 4, 5].flatMap(p => [
            E(`Estancia-comedor ${p}01`, 27, p, 'social'), E(`Cocina ${p}01`, 9, p, 'servicio'), E(`Recámara principal ${p}01`, 14, p, 'privada'),
            E(`Recámara 2 ${p}01`, 11, p, 'privada'), E(`Baño principal ${p}01`, 4.5, p, 'servicio'), E(`Baño completo ${p}01`, 3.5, p, 'servicio'),
            E(`Cuarto de lavado ${p}01`, 4.5, p, 'servicio'),
          ]),
        ],
      }),
    },
  },
};

/** Lo de México que no trae datosDePais: la domótica que resuelve agua, sismo y seguridad. */
function datosMX() { return { ...datosDePais('MX'), domotica: domoticaPorDefecto('MX') }; }

export function clonar(o) { return JSON.parse(JSON.stringify(o)); }

const num = (v, def) => (Number.isFinite(+v) && v !== '' && v !== null ? +v : def);
const txt = (v, def, max = 120) => (typeof v === 'string' ? v.slice(0, max) : def);

/**
 * Completa y sanea un estado que viene de afuera (localStorage, un .json o
 * un enlace compartido): lo que falte se toma del pais y lo que no sea un
 * numero se descarta. Nunca lanza. Los proyectos de la version 2 no traen
 * pais: son de Colombia.
 */
export function normalizarEstado(s) {
  if (!s || typeof s !== 'object') return clonar(BASE);
  const pid = PAISES[s.pais] ? s.pais : 'CO';
  const d = { ...clonar(BASE), ...datosDePais(pid) };
  const pts = (l, conZ = true) => Array.isArray(l)
    ? l.filter(p => p && Number.isFinite(+p.x) && Number.isFinite(+p.y)).map(p => ({ x: +p.x, y: +p.y, z: conZ ? num(p.z, 0) : 0 }))
    : null;
  const P = paisDe(pid);
  const out = {
    ...d,
    nombre: txt(s.nombre, d.nombre, 80),
    pais: pid,
    idioma: ['es', 'en'].includes(s.idioma) ? s.idioma : d.idioma,
    unidades: s.unidades === 'ft' || s.unidades === 'm' ? s.unidades : d.unidades,
    sistema: P.sistemas.includes(s.sistema) ? s.sistema : d.sistema,
    sotano: s.sotano === undefined ? d.sotano : !!s.sotano,
    cubierta: {
      tipo: CUBIERTAS[s.cubierta?.tipo] ? s.cubierta.tipo : d.cubierta.tipo,
      pend: Math.min(120, Math.max(0, num(s.cubierta?.pend, d.cubierta.pend))),
      alero: Math.min(1.5, Math.max(0, num(s.cubierta?.alero, d.cubierta.alero))),
    },
    proyecto: Object.fromEntries(Object.entries(BASE.proyecto).map(([k, v]) => [k, k === 'aprobado' ? !!s.proyecto?.aprobado : txt(s.proyecto?.[k], v)])),
    profesionales: Array.isArray(s.profesionales)
      ? s.profesionales.filter(p => p && typeof p === 'object').slice(0, 8).map(p => ({ rol: txt(p.rol, 'arq', 12), nombre: txt(p.nombre, '', 80), doc: txt(p.doc, '', 40) }))
      : d.profesionales,
    lot: pts(s.lot) ?? d.lot,
    spots: (pts(s.spots) ?? d.spots).filter(p => Number.isFinite(p.z)),
    frente: Math.max(0, Math.round(num(s.frente, 0))),
    ret: { front: num(s.ret?.front, d.ret.front), back: num(s.ret?.back, d.ret.back), lat: num(s.ret?.lat, d.ret.lat) },
    occ: num(s.occ, d.occ), floors: num(s.floors, d.floors), fh: num(s.fh, d.fh), slab: num(s.slab, d.slab),
    forma: { tipo: FORMAS[s.forma?.tipo] ? s.forma.tipo : 'recta', paso: Math.min(6, Math.max(1, num(s.forma?.paso, 2.5))), balcones: !!s.forma?.balcones, curvas: !!s.forma?.curvas },
    soil: SOILS[s.soil] ? s.soil : d.soil, qadm: Math.max(0, num(s.qadm, 0)), desp: num(s.desp, d.desp), freatico: Math.max(0, num(s.freatico, 0)),
    dlAuto: s.dlAuto === undefined ? d.dlAuto : !!s.dlAuto, dl: num(s.dl, d.dl),
    aa: num(s.aa, 0), av: num(s.av, 0), ab: num(s.ab, 0), zona: txt(s.zona, '', 8), nieve: num(s.nieve, 0), helada: num(s.helada, 0), sa: num(s.sa, 0),
    rooms: Array.isArray(s.rooms)
      ? s.rooms.filter(r => r && typeof r === 'object').map(r => ({
        name: String(r.name ?? 'Espacio').slice(0, 40), area: num(r.area, 0),
        floor: Math.max(1, Math.round(num(r.floor, 1))), zone: ZONAS.includes(r.zone) ? r.zone : 'social',
      }))
      : d.rooms,
    amoblar: s.amoblar === undefined ? true : !!s.amoblar,
    acabados: {
      estilo: ESTILOS[s.acabados?.estilo] ? s.acabados.estilo : d.acabados.estilo,
      pisos: Object.fromEntries(Object.entries(s.acabados?.pisos || {}).filter(([k, v]) => typeof k === 'string' && PISOS[v]).slice(0, 200)),
    },
    muebles: { quitar: Array.isArray(s.muebles?.quitar) ? s.muebles.quitar.filter(x => typeof x === 'string').slice(0, 400) : [] },
    domotica: Array.isArray(s.domotica) ? s.domotica.filter(x => typeof x === 'string').slice(0, 40) : [],
    ascensor: !!s.ascensor, ascensorVoz: s.ascensorVoz === undefined ? true : !!s.ascensorVoz,
    tramites: Object.fromEntries(Object.entries(s.tramites || {}).filter(([, v]) => [0, 1, 2].includes(v)).slice(0, 60)),
    laminas: {
      papel: PAPELES[s.laminas?.papel] ? s.laminas.papel : d.laminas.papel,
      ocultas: Array.isArray(s.laminas?.ocultas) ? s.laminas.ocultas.filter(x => typeof x === 'string').slice(0, 60) : [],
    },
    condominio: {
      on: !!s.condominio?.on,
      macro: (pts(s.condominio?.macro) || d.condominio.macro),
      via: Math.min(20, Math.max(4, num(s.condominio?.via, d.condominio.via))),
      lote: Math.max(0, num(s.condominio?.lote, 0)), fondo: Math.max(0, num(s.condominio?.fondo, 0)),
      estados: Object.fromEntries(Object.entries(s.condominio?.estados || {}).filter(([, v]) => ['libre', 'reservado', 'vendido'].includes(v)).slice(0, 300)),
      precioM2: Math.max(0, num(s.condominio?.precioM2, 0)),
    },
    mx: {
      entidad: ENTIDADES[s.mx?.entidad] ? s.mx.entidad : d.mx.entidad,
      zona: ZONAS_MX[s.mx?.zona] ? s.mx.zona : '',
      riesgo: !!s.mx?.riesgo,
      reserva: Math.min(7, Math.max(1, Math.round(num(s.mx?.reserva, d.mx.reserva)))),
      dotacion: Math.min(1000, Math.max(0, num(s.mx?.dotacion, 0))),
      salario: Math.min(10000, Math.max(0, num(s.mx?.salario, d.mx.salario))),
    },
    prices: { ...PRECIOS_PAIS[pid] },
  };
  for (const k of Object.keys(out.prices)) out.prices[k] = num(s.prices?.[k], PRECIOS_PAIS[pid][k]);
  // precios propios de pisos, muebles y domotica (se crean al editarlos)
  for (const [k, v] of Object.entries(s.prices || {})) if (/^(piso|mueble|domo):[A-Za-z0-9]+$/.test(k) && Number.isFinite(+v) && +v >= 0) out.prices[k] = +v;
  if (out.lot.length < 3) out.lot = d.lot;
  if (out.frente >= out.lot.length) out.frente = 0;
  if (out.condominio.macro.length < 3) out.condominio.macro = d.condominio.macro;
  return out;
}

export { SISTEMAS, CUBIERTAS };
