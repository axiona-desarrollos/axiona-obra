/* ==========================================================================
   AXIONA OBRA · Precios segun la ubicacion
   --------------------------------------------------------------------------
   La tabla de precios de cada pais esta hecha para una plaza base (Valle de
   Aburra, Toronto, Ciudad de Mexico y la referencia nacional de España). Este
   modulo lleva esa tabla a la ciudad del proyecto con tres piezas:

     1. Indice de ciudad: cuanto cuesta construir alli frente a la plaza base.
     2. Ajuste de zona: acceso y logistica del barrio o la vereda.
     3. Impuesto del lugar: la provincia en Canada, el IGIC en Canarias.

   COMO SE CALCULA EL INDICE. Punto medio del rango publicado para la ciudad
   dividido por el punto medio de la plaza base, de la misma tabla y la misma
   fuente. Si dos tablas dan la ciudad, se promedian. No hay ninguna cifra
   estimada a ojo: una ciudad sin dato publicado queda en 1,00 y lo dice.

   Son indices orientativos de guias de costos, no de una base de precios
   oficial. El profesional los puede cambiar a mano, y un precio que el usuario
   escribe en el presupuesto nunca se multiplica: se respeta tal cual.
   ========================================================================== */

import { PRECIOS_PAIS, pais as paisDe } from './paises.js';

/** Llave oculta con la que la tabla de precios lleva su ubicacion (no sale en JSON ni en Object.keys). */
export const LUGAR = Symbol.for('axiona.lugar');

const FUENTES = {
  co1: ['OneEstimate, costos de construcción por m² en Colombia 2026', 'https://oneestimate.ai/es/blog/costos-construccion-por-m2-colombia-2026'],
  co2: ['OneEstimate, costos de construir vivienda en Colombia 2026', 'https://oneestimate.ai/es/blog/costos-construccion-vivienda-colombia-2024'],
  dane: ['DANE, índice de costos de la construcción de edificaciones (ICOCED)', 'https://www.dane.gov.co/index.php/estadisticas-por-tema/precios-y-costos/indice-de-costos-de-la-construccion-de-edificaciones-icoced'],
  ca1: ['RE/MAX, cost to build a house (Altus Group cost guide)', 'https://blog.remax.ca/how-much-does-it-cost-to-build-a-house/'],
  mx1: ['OneEstimate, costos de construcción por m² en México 2026', 'https://oneestimate.ai/es/blog/costos-construccion-por-m2-mexico-2026'],
  es1: ['Certicalia, presupuestar una vivienda unifamiliar', 'https://www.certicalia.com/blog/presupuestar-proyecto-vivienda-unifamiliar'],
};

// conf: 'base' plaza de la tabla · 'media' dos tablas coinciden · 'baja' una sola tabla · 'sin' no hay dato publicado
const L = (id, n, f, conf, alias, extra = {}) => ({ id, n, f, conf, alias, ...extra });

export const UBICACIONES = {
  CO: {
    base: { es: 'Valle de Aburrá', en: 'Aburrá Valley' },
    nota: { es: 'Índices sacados de los rangos por ciudad de OneEstimate (2026). Para una cifra oficial, cruza con el ICOCED del DANE y con cotizaciones del lugar.', en: 'Indices taken from OneEstimate city ranges (2026). For an official figure, check DANE’s ICOCED and local quotes.' },
    fuentes: [FUENTES.co1, FUENTES.co2, FUENTES.dane],
    lugares: [
      L('medellin', 'Medellín y Valle de Aburrá', 1, 'base', ['medellin', 'envigado', 'sabaneta', 'itagui', 'bello', 'la estrella', 'copacabana', 'girardota', 'barbosa', 'valle de aburra', 'caldas, antioquia']),
      L('oriente', 'Oriente antioqueño', 1, 'sin', ['rionegro', 'llano grande', 'llanogrande', 'la ceja', 'el retiro', 'guarne', 'marinilla', 'el carmen de viboral', 'san antonio de pereira']),
      // estrato 4: 3,30 M / 3,05 M = 1,08 · costo total: 2,10 M / 1,95 M = 1,08
      L('bogota', 'Bogotá y la Sabana', 1.08, 'media', ['bogota', 'chia', 'cajica', 'soacha', 'mosquera', 'funza', 'zipaquira', 'cota', 'la calera', 'tocancipa', 'sopo']),
      // estrato 4: 2,85 M / 3,05 M = 0,93 · costo total: 1,85 M / 1,95 M = 0,95
      L('cali', 'Cali y su área', 0.94, 'media', ['cali', 'jamundi', 'palmira', 'yumbo']),
      // costo total: 1,75 M / 1,95 M = 0,90
      L('barranquilla', 'Barranquilla y su área', 0.9, 'baja', ['barranquilla', 'soledad', 'puerto colombia']),
      L('cartagena', 'Cartagena', 1, 'sin', ['cartagena', 'turbaco']),
      L('santamarta', 'Santa Marta', 1, 'sin', ['santa marta']),
      L('bucaramanga', 'Bucaramanga y su área', 1, 'sin', ['bucaramanga', 'floridablanca', 'giron', 'piedecuesta']),
      L('ejecafetero', 'Eje Cafetero', 1, 'sin', ['pereira', 'dosquebradas', 'manizales', 'armenia']),
      L('cucuta', 'Cúcuta', 1, 'sin', ['cucuta']),
      L('ibague', 'Ibagué', 1, 'sin', ['ibague']),
      L('villavicencio', 'Villavicencio', 1, 'sin', ['villavicencio']),
      L('pasto', 'Pasto', 1, 'sin', ['pasto']),
      L('monteria', 'Montería', 1, 'sin', ['monteria']),
      L('neiva', 'Neiva', 1, 'sin', ['neiva']),
    ],
  },
  ES: {
    base: { es: 'referencia nacional', en: 'national reference' },
    nota: { es: 'En España el coste de ejecución cambia poco entre provincias; lo que cambia es el suelo. No hay una tabla pública fiable por comunidad: si tu colegio o tu comunidad publica su base de precios, escribe aquí el índice.', en: 'In Spain building cost varies little between provinces; land is what changes. There is no reliable public table by region: if your regional price base gives one, type the index here.' },
    fuentes: [FUENTES.es1],
    lugares: [
      L('madrid', 'Madrid', 1, 'sin', ['madrid', 'alcobendas', 'pozuelo', 'las rozas', 'majadahonda', 'collado villalba', 'getafe', 'alcala de henares']),
      L('barcelona', 'Barcelona', 1, 'sin', ['barcelona', 'hospitalet', 'badalona', 'sabadell', 'terrassa', 'sant cugat']),
      L('valencia', 'Comunitat Valenciana', 1, 'sin', ['valencia', 'alicante', 'castellon']),
      L('andalucia', 'Andalucía', 1, 'sin', ['sevilla', 'malaga', 'granada', 'cordoba', 'cadiz', 'almeria', 'huelva', 'jaen', 'marbella']),
      L('norte', 'Cornisa cantábrica', 1, 'sin', ['bilbao', 'san sebastian', 'donostia', 'vitoria', 'santander', 'oviedo', 'gijon', 'a coruna', 'vigo', 'pamplona']),
      L('zaragoza', 'Zaragoza', 1, 'sin', ['zaragoza']),
      L('baleares', 'Illes Balears', 1, 'sin', ['palma', 'mallorca', 'ibiza', 'menorca', 'baleares']),
      L('canarias', 'Canarias', 1, 'sin', ['canarias', 'las palmas', 'santa cruz de tenerife', 'tenerife', 'gran canaria', 'lanzarote', 'fuerteventura', 'la palma'],
        { imp: { k: 'iva', pct: 0.07, n: { es: 'IGIC 7 % (tipo general en Canarias; confirmar si aplica un tipo reducido)', en: 'IGIC 7 % (Canary Islands general rate; confirm whether a reduced rate applies)' } } }),
    ],
  },
  CA: {
    base: { es: 'Toronto', en: 'Toronto' },
    nota: { es: 'Índices de la guía de costos de Altus Group, casa unifamiliar con sótano sin terminar, citada por RE/MAX. El impuesto cambia con la provincia.', en: 'Indices from the Altus Group cost guide, single-family house with unfinished basement, as cited by RE/MAX. Sales tax follows the province.' },
    fuentes: [FUENTES.ca1],
    // CAD por pie²: Toronto 210–290 (punto medio 250)
    lugares: [
      L('toronto', 'Toronto (GTA)', 1, 'base', ['toronto', 'gta', 'mississauga', 'brampton', 'markham', 'vaughan', 'oakville', 'hamilton'], { prov: 'ON' }),
      L('vancouver', 'Vancouver', 1.1, 'baja', ['vancouver', 'burnaby', 'surrey', 'richmond', 'north vancouver'], { prov: 'BC' }),   // 210–340
      L('calgary', 'Calgary', 0.93, 'baja', ['calgary'], { prov: 'AB' }),                                                          // 185–280
      L('edmonton', 'Edmonton', 0.92, 'baja', ['edmonton'], { prov: 'AB' }),                                                       // 180–280
      L('winnipeg', 'Winnipeg', 0.88, 'baja', ['winnipeg'], { prov: 'MB' }),                                                       // 175–265
      L('ottawa', 'Ottawa', 0.75, 'baja', ['ottawa', 'gatineau'], { prov: 'ON' }),                                                 // 145–230
      L('montreal', 'Montréal', 0.73, 'baja', ['montreal', 'laval', 'longueuil'], { prov: 'QC' }),                                 // 150–215
      L('halifax', 'Halifax', 0.74, 'baja', ['halifax', 'dartmouth'], { prov: 'NS' }),                                             // 145–225
      L('stjohns', 'St. John’s', 0.75, 'baja', ['st. john\'s', 'st johns', 'saint john\'s'], { prov: 'NL' }),                      // 155–220
      L('quebec', 'Ville de Québec', 1, 'sin', ['quebec city', 'ville de quebec'], { prov: 'QC' }),
      L('saskatoon', 'Saskatoon y Regina', 1, 'sin', ['saskatoon', 'regina'], { prov: 'SK' }),
      L('victoria', 'Victoria', 1, 'sin', ['victoria', 'kelowna'], { prov: 'BC' }),
      L('london', 'London y Kitchener-Waterloo', 1, 'sin', ['london', 'kitchener', 'waterloo', 'windsor'], { prov: 'ON' }),
    ],
  },
  MX: {
    base: { es: 'Ciudad de México', en: 'Mexico City' },
    nota: { es: 'Índices de los rangos y del índice relativo por ciudad de OneEstimate (2026). Las guías de costos que citan al CEICO-CMIC hablan de diferencias de 15 a 40 % entre ciudades.', en: 'Indices from OneEstimate city ranges and relative index (2026). Cost guides citing CEICO-CMIC report 15–40 % differences between cities.' },
    fuentes: [FUENTES.mx1],
    lugares: [
      L('cdmx', 'Ciudad de México y zona metropolitana', 1, 'base', ['ciudad de mexico', 'cdmx', 'iztapalapa', 'coyoacan', 'benito juarez', 'miguel hidalgo', 'tlalpan', 'alvaro obregon', 'naucalpan', 'tlalnepantla', 'huixquilucan']),
      // vivienda media: 16.500 / 18.000 = 0,92 · índice relativo: 1,20 / 1,25 = 0,96
      L('monterrey', 'Monterrey', 0.94, 'media', ['monterrey', 'san pedro garza garcia', 'apodaca', 'guadalupe, nuevo leon', 'nuevo leon']),
      // índice relativo: 1,10 / 1,25 = 0,88
      L('guadalajara', 'Guadalajara', 0.88, 'baja', ['guadalajara', 'zapopan', 'tlaquepaque', 'jalisco']),
      L('queretaro', 'Querétaro', 1, 'sin', ['queretaro']),
      L('puebla', 'Puebla', 1, 'sin', ['puebla', 'cholula']),
      L('merida', 'Mérida', 1, 'sin', ['merida', 'yucatan']),
      L('tijuana', 'Tijuana', 1, 'sin', ['tijuana', 'mexicali', 'baja california']),
      L('cancun', 'Cancún y Riviera Maya', 1, 'sin', ['cancun', 'playa del carmen', 'tulum', 'quintana roo']),
      L('bajio', 'León y el Bajío', 1, 'sin', ['leon', 'guanajuato', 'aguascalientes', 'san luis potosi']),
    ],
  },
};

/** Impuesto sobre el contrato de construccion en cada provincia de Canada (2026). */
export const PROVINCIAS_CA = {
  ON: { n: 'Ontario', pct: 0.13, t: 'HST 13 %' },
  QC: { n: 'Québec', pct: 0.14975, t: 'GST 5 % + QST 9.975 %', tEs: 'GST 5 % + QST 9,975 %', alias: ['quebec'] },
  BC: { n: 'British Columbia', pct: 0.05, t: 'GST 5 % (PST goes inside materials)', tEs: 'GST 5 % (el PST va dentro de los materiales)', alias: ['british columbia', 'colombie-britannique'] },
  AB: { n: 'Alberta', pct: 0.05, t: 'GST 5 %' },
  SK: { n: 'Saskatchewan', pct: 0.11, t: 'GST 5 % + PST 6 %' },
  MB: { n: 'Manitoba', pct: 0.05, t: 'GST 5 % (RST goes inside materials)', tEs: 'GST 5 % (el RST va dentro de los materiales)' },
  NS: { n: 'Nova Scotia', pct: 0.14, t: 'HST 14 %', alias: ['nova scotia'] },
  NB: { n: 'New Brunswick', pct: 0.15, t: 'HST 15 %', alias: ['new brunswick'] },
  NL: { n: 'Newfoundland and Labrador', pct: 0.15, t: 'HST 15 %', alias: ['newfoundland', 'labrador'] },
  PE: { n: 'Prince Edward Island', pct: 0.15, t: 'HST 15 %', alias: ['prince edward island', 'pei'] },
};

/** Ajuste por el barrio o la vereda: no cambia el precio del material, cambia lo que cuesta llevarlo y trabajar alli. */
export const ACCESOS = [
  { k: 'normal', pct: 0, n: { es: 'Barrio con acceso normal', en: 'Normal access' } },
  { k: 'densa', pct: 0.04, n: { es: 'Centro denso, horario restringido o sin sitio para acopio (+4 %)', en: 'Dense centre, restricted hours or no storage (+4 %)' } },
  { k: 'rural', pct: 0.08, n: { es: 'Vereda, parcelación o vía destapada (+8 %)', en: 'Rural lot or unpaved road (+8 %)' } },
  { k: 'remota', pct: 0.15, n: { es: 'Isla o sitio remoto, material por barco o trocha (+15 %)', en: 'Island or remote site (+15 %)' } },
];

const plano = s => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[’`]/g, '\'').replace(/\s+/g, ' ').trim();
const borde = a => new RegExp(`(^|[^a-z0-9])${a.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}($|[^a-z0-9])`);

/** Lugar del catalogo que aparece primero en el texto de la ciudad (si empatan, el nombre mas largo). */
export function detectarLugar(pid, texto) {
  const U = UBICACIONES[pid], t = plano(texto);
  if (!U || !t) return null;
  let mejor = null;
  for (const lugar of U.lugares) {
    for (const a of lugar.alias) {
      const m = borde(a).exec(t);
      if (!m) continue;
      const pos = m.index + m[1].length;
      if (!mejor || pos < mejor.pos || (pos === mejor.pos && a.length > mejor.largo)) mejor = { lugar, pos, largo: a.length };
    }
  }
  return mejor ? mejor.lugar : null;
}

/** Provincia de Canada: la de la ciudad hallada o la que nombra el texto («Kelowna, BC»). */
export function provinciaCA(texto, lugar = null) {
  if (lugar?.prov) return lugar.prov;
  const crudo = String(texto ?? ''), t = plano(crudo);
  for (const [cod, p] of Object.entries(PROVINCIAS_CA)) {
    if (new RegExp(`(^|[^A-Za-z])${cod}($|[^A-Za-z])`).test(crudo)) return cod;
    if ([plano(p.n), ...(p.alias || [])].some(a => borde(a).test(t))) return cod;
  }
  return 'ON';
}

const acotar = (v, a, b) => Math.min(b, Math.max(a, v));

/**
 * Todo lo que la ubicacion le cambia al presupuesto de un proyecto.
 * `indice` a mano (proyecto.indice) manda sobre el detectado; vacio = automatico.
 */
export function lugarDe(S) {
  const pid = S?.pais || 'CO', pr = S?.proyecto || {};
  const U = UBICACIONES[pid] || UBICACIONES.CO;
  const lugar = detectarLugar(pid, pr.ciudad);
  const auto = lugar ? lugar.f : 1;
  const m = parseFloat(String(pr.indice ?? '').replace(',', '.'));
  const manual = Number.isFinite(m) && m > 0 ? acotar(m, 0.5, 2) : null;
  const zona = ACCESOS.find(z => z.k === pr.zona) || ACCESOS[0];
  const indice = manual ?? auto;
  let impuesto = lugar?.imp || null, provincia = null;
  if (pid === 'CA') {
    provincia = provinciaCA(pr.ciudad, lugar);
    const p = PROVINCIAS_CA[provincia];
    impuesto = { k: 'tax', pct: p.pct, n: { es: `Impuesto en ${p.n}: ${p.tEs || p.t}`, en: `Sales tax in ${p.n}: ${p.t}` } };
  }
  return {
    pid, lugar, auto, manual, indice, zona, provincia, impuesto,
    factor: +(indice * (1 + zona.pct)).toFixed(4),
    conf: manual !== null ? 'manual' : lugar ? lugar.conf : 'sin',
    base: U.base, nota: U.nota, fuentes: U.fuentes,
  };
}

/**
 * Tabla de precios del proyecto con su ubicacion puesta. Es la que hay que
 * pasar a precioDe() y a totales(): sin ella el presupuesto sale a precio de
 * la plaza base.
 */
export function preciosLugar(S) {
  const u = lugarDe(S);
  return { ...S.prices, [LUGAR]: { factor: u.factor, impuesto: u.impuesto, base: PRECIOS_PAIS[S.pais] || {} } };
}

/** Rango de mercado por m² del pais llevado a la ciudad (la zona no lo mueve: es logistica de esta obra). */
export function referenciaLugar(S) {
  const ref = paisDe(S.pais).referencia, { indice } = lugarDe(S);
  return { ...ref, min: ref.min * indice, max: ref.max * indice };
}

/** Nombres para la lista de sugerencias del campo Ciudad. */
export const ciudadesDe = pid => (UBICACIONES[pid]?.lugares || []).map(l => l.n);
