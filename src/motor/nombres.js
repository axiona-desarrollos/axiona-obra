/* ==========================================================================
   AXIONA OBRA · Nombres de los espacios en cada idioma
   --------------------------------------------------------------------------
   Al cambiar de idioma, los espacios que tienen un nombre conocido («Alcoba
   2», «Cocina», «Primary bedroom») pasan al otro idioma; los que escribió el
   usuario a su manera se dejan como están. Cada espacio traducido recuerda
   sus nombres en r.nombres, así al volver al idioma anterior recupera el
   nombre exacto que tenía (Recámara, Dormitorio o Alcoba, según el país).
   También se renombran las claves que dependen del nombre: el piso escogido
   por espacio (acabados.pisos) y los muebles quitados (muebles.quitar).
   ========================================================================== */

import { slugEspacio } from './mobiliario.js';

/** en[0] y es[0] son los nombres por defecto; pais da el nombre en español de cada país. */
const NOMBRES = [
  { en: ['Main bedroom', 'Primary bedroom', 'Master bedroom'], es: ['Alcoba principal', 'Recámara principal', 'Dormitorio principal', 'Habitación principal'], pais: { MX: 'Recámara principal', ES: 'Dormitorio principal', CA: 'Dormitorio principal' } },
  { en: ['Guest bedroom'], es: ['Alcoba de huéspedes', 'Cuarto de huéspedes', 'Habitación de invitados'] },
  { en: ['Staff bedroom'], es: ['Alcoba de servicio', 'Cuarto de servicio'] },
  { en: ['Bedroom'], es: ['Alcoba', 'Recámara', 'Dormitorio', 'Habitación', 'Cuarto'], pais: { MX: 'Recámara', ES: 'Dormitorio', CA: 'Dormitorio' } },
  { en: ['Main bathroom', 'Primary ensuite bath', 'Master bathroom', 'Ensuite bathroom'], es: ['Baño principal'] },
  { en: ['Full bathroom'], es: ['Baño completo'] },
  { en: ['Store half bath'], es: ['Medio baño del local'] },
  { en: ['Half bath', 'Half bathroom'], es: ['Medio baño'] },
  { en: ['Store bathroom'], es: ['Baño local', 'Baño del local'] },
  { en: ['Powder room', 'Guest bathroom'], es: ['Baño social', 'Aseo', 'Baño de visitas'], pais: { ES: 'Aseo' } },
  { en: ['Bathroom'], es: ['Baño'] },
  { en: ['Kitchen'], es: ['Cocina'] },
  { en: ['Living-dining room', 'Living-dining'], es: ['Sala-comedor', 'Salón-comedor', 'Estancia-comedor', 'Sala comedor'], pais: { ES: 'Salón-comedor', MX: 'Estancia-comedor' } },
  { en: ['Family room'], es: ['Estar familiar', 'Sala de estar', 'Estancia familiar', 'Estar'], pais: { ES: 'Sala de estar', MX: 'Estancia familiar', CA: 'Sala de estar' } },
  { en: ['Living room'], es: ['Sala', 'Salón', 'Estancia'], pais: { ES: 'Salón', MX: 'Estancia', CA: 'Sala' } },
  { en: ['Dining room'], es: ['Comedor'] },
  { en: ['Den / office'], es: ['Estudio / oficina'] },
  { en: ['Study'], es: ['Estudio'] },
  { en: ['Office', 'Home office'], es: ['Despacho', 'Oficina'], pais: { ES: 'Despacho', CO: 'Oficina' } },
  { en: ['Mudroom / laundry'], es: ['Vestíbulo / lavandería'] },
  { en: ['Laundry room'], es: ['Cuarto de lavado'] },
  { en: ['Laundry'], es: ['Patio de ropas', 'Lavadero', 'Lavandería'], pais: { ES: 'Lavadero', MX: 'Cuarto de lavado', CA: 'Lavandería' } },
  { en: ['Service yard'], es: ['Patio de servicio'] },
  { en: ['Retail store', 'Commercial space'], es: ['Local comercial'] },
  { en: ['Store', 'Shop'], es: ['Local'] },
  { en: ['Storage'], es: ['Bodega', 'Depósito', 'Trastero'], pais: { ES: 'Trastero' } },
  { en: ['Concierge'], es: ['Portería'] },
  { en: ['Guard booth'], es: ['Caseta de vigilancia'] },
  { en: ['Garage'], es: ['Garaje', 'Cochera'], pais: { MX: 'Cochera' } },
  { en: ['Terrace'], es: ['Terraza'] },
  { en: ['Balcony'], es: ['Balcón'] },
  { en: ['Gym'], es: ['Gimnasio'] },
  { en: ['Walk-in closet'], es: ['Vestier', 'Vestidor'], pais: { ES: 'Vestidor', MX: 'Vestidor' } },
  { en: ['Playroom'], es: ['Cuarto de juegos'] },
  { en: ['Pantry'], es: ['Despensa'] },
  { en: ['Open space'], es: ['Espacio libre'] },
  { en: ['Room'], es: ['Espacio'] },
];

const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[’']/g, '').replace(/\s+/g, ' ').trim();
const IDX = { es: new Map(), en: new Map() };
NOMBRES.forEach(n => { for (const l of ['es', 'en']) n[l].forEach(x => { if (!IDX[l].has(norm(x))) IDX[l].set(norm(x), n); }); });

/** Separa «Alcoba 2» en ['Alcoba', ' 2']. */
function partir(nombre) {
  const m = String(nombre).match(/^(.*?)(\s+\d+)?$/);
  return [m[1], m[2] || ''];
}

/** Idioma en que está escrito un nombre conocido, o null si no lo conoce. */
export function idiomaDeNombre(nombre) {
  const k = norm(partir(nombre)[0]);
  return IDX.es.has(k) ? 'es' : IDX.en.has(k) ? 'en' : null;
}

/** El nombre en el idioma l, o null si no es un nombre conocido o ya está en ese idioma. */
export function traducirNombre(nombre, l, pais = 'CO') {
  const [base, suf] = partir(nombre);
  const k = norm(base);
  if (IDX[l].has(k)) return null;
  const otro = l === 'en' ? 'es' : 'en';
  const n = IDX[otro].get(k);
  if (!n) return null;
  const nuevo = l === 'es' ? (n.pais?.[pais] || n.es[0]) : n.en[0];
  return nuevo + suf;
}

/** Nombres de los proyectos que trae la app (ejemplo, en blanco y plantillas), en los dos idiomas. */
const PROYECTOS = [
  ['Casa de ejemplo', 'Sample house'], ['Mi casa', 'My house'],
  ['Casa medianera 7 × 15', 'Terraced house 7 × 15'], ['Casa esquinera 10 × 18', 'Corner house 10 × 18'],
  ['Casa campestre', 'Country house'], ['Edificio de 5 pisos', '5-storey building'],
  ['Vivienda unifamiliar aislada', 'Detached single-family home'], ['Vivienda adosada', 'Terraced home'],
  ['Casa aislada de dos plantas', 'Detached two-storey home'], ['Cuatro viviendas (fourplex)', 'Fourplex'],
  ['Casa unifamiliar tipo A', 'Single-family house type A'], ['Casa media 8 × 18', 'Mid-range house 8 × 18'],
  ['Casa con local comercial', 'House with a retail store'], ['Edificio de departamentos', 'Apartment building'],
];

/** El nombre del proyecto en el idioma l, si es uno de los que trae la app; si lo escribió el usuario, igual. */
export function traducirProyecto(nombre, l) {
  const par = PROYECTOS.find(p => p.includes(nombre));
  return par ? par[l === 'en' ? 1 : 0] : nombre;
}

/** Pone en el idioma l los nombres de los espacios del estado S (lo cambia en sitio). Devuelve cuántos cambió. */
export function traducirEspacios(S, l) {
  if (!Array.isArray(S?.rooms)) return 0;
  let n = 0;
  const np = traducirProyecto(S.nombre, l);
  if (np !== S.nombre) { S.nombre = np; n++; }
  for (const r of S.rooms) {
    const actual = r.name;
    let nuevo = null;
    if (r.nombres && r.nombres[l] && Object.values(r.nombres).includes(actual)) {
      nuevo = r.nombres[l] === actual ? null : r.nombres[l];
    } else {
      const desde = idiomaDeNombre(actual);
      const t = desde && desde !== l ? traducirNombre(actual, l, S.pais) : null;
      if (t) { r.nombres = { [desde]: actual, [l]: t }; nuevo = t; } else if (r.nombres && !Object.values(r.nombres).includes(actual)) delete r.nombres;
    }
    if (!nuevo || nuevo === actual) continue;
    renombrarClaves(S, r.floor, actual, nuevo);
    r.name = nuevo;
    n++;
  }
  return n;
}

/** Mueve las claves que dependen del nombre del espacio. */
export function renombrarClaves(S, piso, antes, despues) {
  const pisos = S.acabados?.pisos;
  if (pisos) {
    const k0 = `${piso}:${antes}`, k1 = `${piso}:${despues}`;
    if (k0 in pisos) { pisos[k1] = pisos[k0]; delete pisos[k0]; }
  }
  const q = S.muebles?.quitar;
  if (Array.isArray(q)) {
    const p0 = `${piso}-${slugEspacio(antes)}-`, p1 = `${piso}-${slugEspacio(despues)}-`;
    S.muebles.quitar = q.map(id => (id.startsWith(p0) ? p1 + id.slice(p0.length) : id));
  }
}
