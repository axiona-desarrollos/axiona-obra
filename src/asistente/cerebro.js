/* ==========================================================================
   AXIONA OBRA · Cerebro local de Axi
   --------------------------------------------------------------------------
   Entiende órdenes en español y en inglés y las convierte en acciones sobre
   el proyecto, sin internet ni modelo de lenguaje. El inglés se traduce
   primero a las palabras clave en español (aEspanol) y responde en el
   idioma que escogió el usuario. No toca el DOM: recibe una foto del
   proyecto (ctx) y devuelve { dice, hacer, chips }. Quien ejecuta las
   acciones es axi.js. Si no entiende, devuelve null y, si el usuario activó
   el cerebro avanzado, la pregunta pasa al modelo de lenguaje.
   ========================================================================== */

import { FAQ, CAPACIDADES, TOPO_URL } from './saber.js';
import { tr, idioma } from '../motor/idioma.js';
import { aEspanol, pareceIngles } from './ingles.js';

export function normalizar(t = '') {
  return String(t).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/m²|mt2|mts2|m2\b/g, ' m2 ').replace(/[¿?¡!.,;:()"«»]/g, ' ').replace(/\s+/g, ' ').trim();
}

const PALABRAS = { un: 1, uno: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10, once: 11, doce: 12, quince: 15, veinte: 20, treinta: 30 };
const ORDINALES = { primer: 1, primero: 1, primera: 1, segundo: 2, segunda: 2, tercer: 3, tercero: 3, tercera: 3, cuarto: 4, cuarta: 4, quinto: 5, quinta: 5, sexto: 6, septimo: 7, octavo: 8 };

function aNumero(s) {
  if (s == null) return NaN;
  const n = parseFloat(String(s).replace(',', '.'));
  return Number.isFinite(n) ? n : (PALABRAS[s] ?? NaN);
}

const NUM = '(\\d+(?:[.,]\\d+)?|un|uno|una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce|quince|veinte|treinta)';

/** Piso mencionado en la frase: «en el segundo piso», «piso 2», «arriba», «primer piso». */
export function pisoDe(t, pisos = 1) {
  let m = t.match(/(?:en |al |del |el |la )?(primer|primero|primera|segundo|segunda|tercer|tercero|tercera|cuarto|cuarta|quinto|quinta|sexto|septimo|octavo) (?:piso|nivel|planta)/);
  if (m) return ORDINALES[m[1]];
  m = t.match(/(?:piso|nivel|planta) (\d+|uno|dos|tres|cuatro|cinco|seis|siete|ocho)\b/);
  if (m) return aNumero(m[1]);
  if (/\b(arriba|segunda planta|planta alta)\b/.test(t)) return Math.max(2, pisos);
  if (/\b(abajo|planta baja|primera planta)\b/.test(t)) return 1;
  return null;
}

function areaDe(t) {
  const m = t.match(new RegExp(`${NUM} ?(?:m2|metros cuadrados|metros|mts|m)\\b`));
  return m ? aNumero(m[1]) : null;
}

/** Tipos de espacio que se pueden pedir: patrón, nombre, área y zona por defecto. */
const TIPOS = [
  { re: /alcobas? principal(?:es)?|habitacion(?:es)? principal(?:es)?|cuartos? principal(?:es)?|recamaras? principal(?:es)?|dormitorios? principal(?:es)?|master|main bedroom|primary bedroom/, n: { es: 'Alcoba principal', en: 'Main bedroom' }, a: 14, z: 'privada' },
  { re: /alcobas?|habitacion(?:es)?|dormitorios?|recamaras?|cuartos? (?:de dormir|para dormir|extra)|cuartos?\b(?! piso)|bedrooms?/, n: { es: 'Alcoba', en: 'Bedroom' }, a: 10, z: 'privada', serie: true },
  { re: /banos? sociale?s?|banos? de visitas?|medio bano|powder room|half bath|guest bath/, n: { es: 'Baño social', en: 'Powder room' }, a: 3, z: 'servicio' },
  { re: /banos? principal(?:es)?|main bath|primary (?:ensuite )?bath|master bath/, n: { es: 'Baño principal', en: 'Main bathroom' }, a: 5, z: 'servicio' },
  { re: /banos?|bathrooms?|\bbaths?\b/, n: { es: 'Baño', en: 'Bathroom' }, a: 4, z: 'servicio', serie: true },
  { re: /cocinas?|kitchens?/, n: { es: 'Cocina', en: 'Kitchen' }, a: 9, z: 'servicio' },
  { re: /sala comedor|sala-comedor|salon-comedor|living-dining|living dining/, n: { es: 'Sala-comedor', en: 'Living-dining room' }, a: 24, z: 'social' },
  { re: /comedor(?:es)?|dining/, n: { es: 'Comedor', en: 'Dining room' }, a: 12, z: 'social' },
  { re: /salas? de estar|estar(?: familiar)?|sala de tv|cuarto de tv|family room|tv room/, n: { es: 'Estar familiar', en: 'Family room' }, a: 10, z: 'social' },
  { re: /salas?|salon|living/, n: { es: 'Sala', en: 'Living room' }, a: 18, z: 'social' },
  { re: /estudios?|oficinas?|despachos?|study|office/, n: { es: 'Estudio', en: 'Study' }, a: 9, z: 'privada' },
  { re: /patios? de ropas|lavander(?:ia|ias)|zona de ropas|lavadero|laundry|mudroom/, n: { es: 'Patio de ropas', en: 'Laundry' }, a: 5, z: 'servicio' },
  { re: /terrazas?|terraces?/, n: { es: 'Terraza', en: 'Terrace' }, a: 12, z: 'social' },
  { re: /balcon(?:es)?|balcon(?:y|ies)/, n: { es: 'Balcón', en: 'Balcony' }, a: 4, z: 'social' },
  { re: /garajes?|parqueaderos?|cocheras?|garages?/, n: { es: 'Garaje', en: 'Garage' }, a: 15, z: 'servicio' },
  { re: /locale?s?(?: comercial(?:es)?)?|tiendas?|retail store|\bstores?\b|\bshops?\b/, n: { es: 'Local comercial', en: 'Retail store' }, a: 25, z: 'social' },
  { re: /bodegas?|depositos?|cuarto util|storage|warehouse/, n: { es: 'Bodega', en: 'Storage' }, a: 6, z: 'servicio' },
  { re: /gimnasios?|\bgym\b/, n: { es: 'Gimnasio', en: 'Gym' }, a: 15, z: 'social' },
  { re: /cuarto de servicio|alcoba de servicio|staff (?:bed)?room/, n: { es: 'Alcoba de servicio', en: 'Staff bedroom' }, a: 8, z: 'servicio' },
];

const PISOS_PAL = [
  [/porcelanato (?:de )?gran formato|porcelanato tipo marmol|porcelanato marmolizado/, 'porcGF'],
  [/porcelanato/, 'porc'], [/marmol/, 'marmol'], [/nogal/, 'nogal'], [/teca/, 'teca'],
  [/madera|roble|piso laminado|laminado/, 'roble'], [/vinilo|spc/, 'spc'], [/microcemento/, 'micro'],
  [/ceramica|baldosa/, 'ceram'], [/terracota/, 'terracota'], [/concreto pulido|cemento pulido|piso pulido/, 'concreto'],
];

const TABS = [
  [/\b(3d|modelo|maqueta|tridimensional)\b/, 'modelo', { es: 'el modelo 3D', en: 'the 3D model' }],
  [/\b(planos?|planta arquitectonica|plantas|laminas)\b/, 'planos', { es: 'los planos', en: 'the drawings' }],
  [/\b(presupuesto|costos|cantidades|apu)\b/, 'cantidades', { es: 'el presupuesto', en: 'the budget' }],
  [/\b(interiores|acabados|muebles|decoracion|domotica)\b/, 'interiores', { es: 'los interiores', en: 'the interiors' }],
  [/\b(programa|espacios|lista de espacios)\b/, 'programa', { es: 'el programa de espacios', en: 'the room program' }],
  [/\b(terreno|lote|topografia)\b/, 'terreno', { es: 'el terreno', en: 'the site' }],
  [/\b(ventas|condominio|conjunto|lotes)\b/, 'ventas', { es: 'ventas y condominio', en: 'sales and development' }],
  [/\b(realidad aumentada|ar|exportar)\b/, 'ar', { es: 'la realidad aumentada', en: 'augmented reality' }],
  [/\b(proyecto|tramites|inicio|portada)\b/, 'proyecto', { es: 'el proyecto', en: 'the project' }],
];

const VERBO_IR = /\b(muestra(?:me)?|abre|abrir|ir a|ve a|vamos a|llevame a|ensename|quiero ver|ver|mira|mirar|pasa a)\b/;
const VERBO_AGREGAR = /\b(agrega(?:r|le|me)?|anade|anadir|anadele|pon(?:le|me|er)?|mete(?:le)?|suma(?:le)?|incluye|quiero|necesito|crea|hazme|haz)\b/;
const VERBO_QUITAR = /\b(quita(?:r|le)?|elimina(?:r)?|borra(?:r)?|saca(?:r)?|suprime|remueve)\b/;

function chips(...l) { return l.filter(Boolean); }
/** Texto en el idioma del usuario. */
const T2 = (es, en) => tr({ es, en });

/** Busca el espacio del proyecto que nombra la frase (el nombre más largo que aparece). */
export function buscarEspacio(t, rooms) {
  let mejor = -1, largo = 0;
  rooms.forEach((r, i) => {
    const n = normalizar(r.name);
    if (n && t.includes(n) && n.length > largo) { mejor = i; largo = n.length; }
  });
  if (mejor >= 0) return mejor;
  // sin el número: «la alcoba» cuando hay «Alcoba 2»; solo si hay uno de ese tipo
  for (const T of TIPOS) {
    if (!T.re.test(t)) continue;
    const cand = rooms.map((r, i) => [i, normalizar(r.name)]).filter(([, n]) => T.re.test(n));
    if (cand.length === 1) return cand[0][0];
    if (cand.length > 1) return { varios: cand.map(([i]) => rooms[i].name) };
  }
  return -1;
}

function nombreLibre(base, rooms) {
  const usados = new Set(rooms.map(r => normalizar(r.name)));
  if (!usados.has(normalizar(base))) return base;
  for (let k = 2; k < 100; k++) if (!usados.has(normalizar(`${base} ${k}`))) return `${base} ${k}`;
  return `${base} ${tr({ es: 'nuevo', en: 'new' })}`;
}

/** Espacios pedidos en «agrega dos alcobas y un baño de 5 m2». */
function espaciosPedidos(t) {
  const out = [];
  const partes = t.split(/,| y | e | con | mas /);
  for (const p of partes) {
    const T = TIPOS.find(x => x.re.test(p));
    if (!T) continue;
    const m = p.match(new RegExp(`\\b${NUM}\\b ?(?:${T.re.source})`));
    let n = m ? aNumero(m[1]) : 1;
    if (!(n >= 1 && n <= 10)) n = 1;
    const a = areaDe(p);
    out.push({ T, n, a: a && a >= 1.5 && a <= 500 ? a : null });
  }
  return out;
}

function lista(nombres) {
  if (nombres.length <= 1) return nombres.join('');
  return nombres.slice(0, -1).join(', ') + T2(' y ', ' and ') + nombres[nombres.length - 1];
}

/**
 * @param texto lo que dijo o escribió el usuario (en español o en inglés)
 * @param ctx   { S, M, total, m2, money, fmtA, estilos: {k: nombre}, plantillas: {k: titulo}, sistemas: [[k, nombre]], pais }
 * @returns {{dice: string, hacer: object[], chips: string[]}|null}
 */
export function interpretar(texto, ctx) {
  const t0 = normalizar(texto);
  if (!t0) return null;
  // en inglés se traduce primero a las palabras clave que entiende el cerebro
  const ingles = idioma() === 'en' || pareceIngles(t0);
  const t = ingles ? aEspanol(t0) : t0;
  const S = ctx.S;
  const espacio = frase => { const i = buscarEspacio(frase, S.rooms); return i === -1 && ingles ? buscarEspacio(t0, S.rooms) : i; };

  // saludos, gracias y ayuda
  if (/^(hola|buenas|buenos dias|buenas tardes|buenas noches|hey|que mas|quiubo|ola)\b/.test(t) && t.split(' ').length <= 4) {
    return { dice: T2('¡Hola! Soy Axi, el asistente de Axiona Obra. Dime qué casa quieres y la voy armando contigo: puedo agregar espacios, cambiar pisos y acabados, mostrarte el 3D o descargar los planos.', 'Hi! I’m Axi, the Axiona Obra assistant. Tell me what house you want and I’ll build it with you: I can add rooms, change floors and finishes, show you the 3D or download the drawings.'), hacer: [], chips: chips(T2('Agrega una alcoba', 'Add a bedroom'), T2('Pon 2 pisos', 'Make it 2 floors'), T2('Muéstrame el 3D', 'Show me the 3D'), T2('Empezar de cero', 'Start from scratch')) };
  }
  if (/^(gracias|muchas gracias|mil gracias|listo gracias|ok gracias)\b/.test(t)) return { dice: T2('Con gusto. Aquí estoy si necesitas algo más.', 'You’re welcome. I’m here if you need anything else.'), hacer: [], chips: [] };
  if (/\b(que puedes hacer|que sabes hacer|ayuda|ayudame|como funcionas|comandos|que haces)\b/.test(t) && !/\b(como edito|editar)\b/.test(t)) {
    return { dice: T2('Esto puedo hacer por ti:', 'This is what I can do for you:') + '\n• ' + CAPACIDADES.map(c => tr(c)).join('\n• '), hacer: [], chips: chips(T2('Agrega una alcoba de 12 m2', 'Add a 12 m2 bedroom'), T2('Porcelanato en toda la casa', 'Porcelain tile in the whole house'), T2('Cuánto cuesta', 'How much does it cost'), T2('Hablar con una persona', 'Talk to a person')) };
  }

  // contacto, reseñas y propuestas
  if (/\b(hablar con (una persona|alguien|un humano|un asesor|santiago|soporte)|soporte|asesor|contacto|contactar|numero de whatsapp|su whatsapp|correo|email|llamar)\b/.test(t)) {
    return { dice: T2('Te comunico con el equipo de Axiona. Escoge cómo quieres escribirnos.', 'I’ll connect you with the Axiona team. Choose how you want to reach us.'), hacer: [{ tipo: 'contacto' }], chips: [] };
  }
  if (/\b(resena|opinion|calificar|propuesta|sugerencia|sugerir|recomendacion|mejora|idea)\b/.test(t) && !VERBO_AGREGAR.test(t.replace(/\b(quiero|necesito)\b/, ''))) {
    const tipo = /propuesta|sugerencia|sugerir|recomendacion|mejora|idea/.test(t) ? 'propuesta' : 'resena';
    return { dice: tipo === 'propuesta' ? T2('¡Gracias por ayudarnos a mejorar! Cuéntanos tu propuesta y la lee el equipo.', 'Thanks for helping us improve! Tell us your idea and the team will read it.') : T2('¡Gracias! Cuéntanos qué te pareció Axiona Obra.', 'Thank you! Tell us what you think of Axiona Obra.'), hacer: [{ tipo: 'formulario', clase: tipo }], chips: [] };
  }

  // datos del proyecto
  const M = ctx.M;
  const pisosTxt = n => (n === 1 ? T2('piso', 'floor') : T2('pisos', 'floors'));
  if (M && !M.err) {
    if (/\b(cuanto (cuesta|vale|sale|me cuesta)|costo total|valor total|presupuesto total|cuanta plata|cuanto dinero)\b/.test(t)) {
      return { dice: T2(`El presupuesto estimado es ${ctx.money(ctx.total)}, unos ${ctx.money(ctx.m2)} por metro cuadrado, para ${ctx.fmtA(M.built)} construidos. Es una estimación de anteproyecto con precios de referencia del país; en la pestaña Presupuesto puedes cambiar cada precio.`, `The estimated budget is ${ctx.money(ctx.total)}, about ${ctx.money(ctx.m2)} per square meter, for ${ctx.fmtA(M.built)} built. It is a preliminary estimate with the country’s reference prices; you can change every price in the Budget tab.`), hacer: [{ tipo: 'tab', tab: 'cantidades' }], chips: chips(T2('Descarga el presupuesto en Excel', 'Download the budget in Excel'), T2('¿Cómo puedo ahorrar?', 'How can I save money?')) };
    }
    if (/\b(cuantos metros|cuanto mide|area construida|metros construidos|area del lote|tamano)\b/.test(t)) {
      return { dice: T2(`El lote tiene ${ctx.fmtA(M.lotArea)} y la casa ${ctx.fmtA(M.built)} construidos en ${S.floors} ${pisosTxt(S.floors)}.`, `The lot is ${ctx.fmtA(M.lotArea)} and the house has ${ctx.fmtA(M.built)} built on ${S.floors} ${pisosTxt(S.floors)}.`), hacer: [], chips: chips(T2('Pon un piso más', 'Add one more floor'), T2('Muéstrame los planos', 'Show me the drawings')) };
    }
    if (/\b(que espacios|que tiene la casa|lista de espacios|cuales espacios|cuantas alcobas|cuantos banos|que hay en)\b/.test(t)) {
      const porPiso = {};
      S.rooms.forEach(r => (porPiso[r.floor] ||= []).push(`${r.name} (${r.area} m²)`));
      const txt = Object.keys(porPiso).sort((a, b) => a - b).map(f => `${T2('Piso', 'Floor')} ${f}: ${porPiso[f].join(', ')}`).join('\n');
      return { dice: `${T2('Estos son los espacios:', 'These are the rooms:')}\n${txt}`, hacer: [{ tipo: 'tab', tab: 'programa' }], chips: chips(T2('Agrega un baño', 'Add a bathroom'), T2('Quita el estudio', 'Remove the study')) };
    }
    if (/\b(avisos|problemas|errores|algo mal|revision|esta bien)\b/.test(t)) {
      return M.warn.length
        ? { dice: T2(`Hay ${M.warn.length} ${M.warn.length === 1 ? 'aviso' : 'avisos'} del diseño:`, `There ${M.warn.length === 1 ? 'is 1 design warning' : `are ${M.warn.length} design warnings`}:`) + `\n• ${M.warn.slice(0, 4).join('\n• ')}`, hacer: [{ tipo: 'tab', tab: 'programa' }], chips: [] }
        : { dice: T2('La revisión automática no encontró avisos en el diseño.', 'The automatic review found no design warnings.'), hacer: [], chips: [] };
    }
  }
  if (/\b(como (puedo )?ahorrar|mas barato|economizar|bajar el costo|reducir el costo)\b/.test(t)) {
    return { dice: T2('Para ahorrar: baja las áreas de los espacios grandes, usa cerámica en vez de porcelanato, quita el amoblado del presupuesto, prueba la mampostería confinada (en Colombia, para 1 y 2 pisos suele salir más barata) y construye por etapas.', 'To save money: reduce the size of the large rooms, use ceramic instead of porcelain, take the furniture out of the budget, try confined masonry (in Colombia it is usually cheaper for 1 and 2 floors) and build in stages.'), hacer: [], chips: chips(T2('Cerámica en toda la casa', 'Ceramic in the whole house'), T2('Mampostería confinada', 'Confined masonry'), T2('Sin muebles', 'No furniture')) };
  }

  // empezar de cero, ejemplos y plantillas
  if (/\b(empezar de cero|desde cero|nuevo proyecto|proyecto nuevo|en blanco|proyecto vacio|mi propia casa|disenar la mia|disenar mi casa)\b/.test(t)) {
    return { dice: T2('Listo: arranqué un proyecto en blanco con un lote de 10 × 20 m y una casa básica de un piso. Ahora dime qué espacios quieres, por ejemplo «agrega dos alcobas y un baño en el segundo piso».', 'Done: I started a blank project with a 10 × 20 m lot and a basic one-floor house. Now tell me what rooms you want, for example “add two bedrooms and a bathroom on the second floor”.'), hacer: [{ tipo: 'nuevo' }, { tipo: 'tab', tab: 'programa' }], chips: chips(T2('Pon 2 pisos', 'Make it 2 floors'), T2('Agrega dos alcobas en el segundo piso', 'Add two bedrooms on the second floor'), T2('Lote de 8 por 15', 'Lot of 8 by 15')) };
  }
  if (/\b(ejemplos?|plantillas?|modelos de casa|disenos de ejemplo|casas de ejemplo)\b/.test(t) && !/\b(carga|cargar|usa|abre)\b/.test(t)) {
    const pl = Object.entries(ctx.plantillas);
    return { dice: T2(`Estos son los ejemplos de ${ctx.paisNombre}. Toca uno para cargarlo y después cámbialo a tu gusto.`, `These are the examples for ${ctx.paisNombre}. Tap one to load it, then change it as you like.`), hacer: [], chips: pl.map(([, n]) => `${T2('Carga', 'Load')} ${n}`) };
  }
  {
    const m = t.match(/\b(?:carga|cargar|usa|abre)(?: la plantilla| el ejemplo)? (.+)/);
    if (m) {
      const q = m[1];
      const pl = Object.entries(ctx.plantillas).map(([k, n]) => [k, n, normalizar(n)]);
      const hit = pl.find(([, , n]) => n.startsWith(q) || q.startsWith(n.split(' · ')[0]) || n.includes(q));
      if (hit) return { dice: T2(`Cargué «${hit[1]}». Ahora cámbialo como quieras.`, `I loaded “${hit[1]}”. Now change it as you like.`), hacer: [{ tipo: 'plantilla', k: hit[0] }], chips: chips(T2('Muéstrame el 3D', 'Show me the 3D'), T2('Qué espacios hay', 'What rooms are there')) };
    }
  }

  // país e idioma
  {
    const m = t.match(/\b(colombia|espana|mexico|canada)\b/);
    if (m && /\b(cambia|cambiar|pasa|pasar|para|en|pais|usar|usa|normas de)\b/.test(t)) {
      const id = { colombia: 'CO', espana: 'ES', mexico: 'MX', canada: 'CA' }[m[1]];
      const nom = { colombia: T2('Colombia', 'Colombia'), espana: T2('España', 'Spain'), mexico: T2('México', 'Mexico'), canada: T2('Canadá', 'Canada') }[m[1]];
      if (id === S.pais) return { dice: T2(`El proyecto ya está con las normas de ${nom}.`, `The project already uses the rules of ${nom}.`), hacer: [], chips: [] };
      return { dice: T2('Cambio el país: se cargan sus normas, trámites, moneda, sistema constructivo y precios. El lote y los espacios se conservan.', 'Switching the country: its codes, permits, currency, building system and prices are loaded. The lot and the rooms are kept.'), hacer: [{ tipo: 'pais', id }], chips: [] };
    }
  }
  // al cambiar de idioma, Axi contesta ya en el idioma nuevo
  // (si pregunta qué idiomas hay, responde la ayuda en vez de cambiar)
  const preguntaIdiomas = /\b(idiomas|languages|que idioma|which language|what language|portugues|portuguese|frances|french)\b/.test(t0);
  if (!preguntaIdiomas && /\b(en ingles|in english|english)\b/.test(t)) return { dice: 'Done: the app is now in English, and so am I.', hacer: [{ tipo: 'idioma', l: 'en' }], chips: ['Show me the 3D', 'What can you do'] };
  if (!preguntaIdiomas && /\b(en espanol|in spanish|spanish)\b/.test(t)) return { dice: 'Listo: la app queda en español, y yo también.', hacer: [{ tipo: 'idioma', l: 'es' }], chips: ['Muéstrame el 3D', 'Qué puedes hacer'] };

  // pisos de la edificación
  {
    const m = t.match(new RegExp(`\\b${NUM} (?:pisos|niveles|plantas)\\b`)) || t.match(/\b(?:de|a) (\d) (?:piso|nivel|planta)\b/);
    if (m && !/\b(piso de|pisos de (porcelanato|madera|ceramica|marmol))\b/.test(t)) {
      const n = Math.round(aNumero(m[1]));
      if (n >= 1 && n <= 8) {
        const hacer = [{ tipo: 'set', p: 'floors', v: n }];
        const huerfanos = S.rooms.filter(r => r.floor > n).length;
        const ojo = huerfanos ? T2(` Ojo: ${huerfanos} ${huerfanos === 1 ? 'espacio estaba' : 'espacios estaban'} en pisos que ya no existen; pásalos de piso o quítalos.`, ` Note: ${huerfanos} ${huerfanos === 1 ? 'room was' : 'rooms were'} on floors that no longer exist; move or remove ${huerfanos === 1 ? 'it' : 'them'}.`) : '';
        return { dice: T2(`Listo: la edificación queda de ${n} ${pisosTxt(n)}.`, `Done: the building now has ${n} ${pisosTxt(n)}.`) + ojo, hacer, chips: chips(T2('Qué espacios hay', 'What rooms are there'), T2('Muéstrame el 3D', 'Show me the 3D')) };
      }
      if (n > 8) return { dice: T2('Por ahora el motor llega hasta 8 pisos.', 'For now the engine goes up to 8 floors.'), hacer: [], chips: [] };
    }
    if (/\b(un piso mas|otro piso|agrega un piso|sube un piso)\b/.test(t)) {
      const n = Math.min(8, S.floors + 1);
      return { dice: T2(`Listo: ahora son ${n} pisos. Dime qué espacios van en el piso ${n}.`, `Done: now there are ${n} floors. Tell me what rooms go on floor ${n}.`), hacer: [{ tipo: 'set', p: 'floors', v: n }], chips: chips(T2(`Agrega una terraza en el piso ${n}`, `Add a terrace on floor ${n}`)) };
    }
    if (/\b(un piso menos|quita un piso|baja un piso)\b/.test(t)) {
      const n = Math.max(1, S.floors - 1);
      return { dice: T2(`Listo: quedan ${n} ${pisosTxt(n)}.`, `Done: ${n} ${pisosTxt(n)} left.`), hacer: [{ tipo: 'set', p: 'floors', v: n }], chips: [] };
    }
  }

  // lote
  {
    const m = t.match(new RegExp(`lote (?:de )?${NUM} ?(?:m |metros )?(?:x|por) ${NUM}`));
    if (m) {
      const w = aNumero(m[1]), d = aNumero(m[2]);
      if (w > 3 && d > 3 && w <= 300 && d <= 300) return { dice: T2(`Listo: el lote queda de ${w} × ${d} m, plano. Si tiene pendiente, mídelo con Axiona Topo o pon las cotas en Terreno.`, `Done: the lot is now ${w} × ${d} m, flat. If it slopes, measure it with Axiona Topo or enter the levels in Site.`), hacer: [{ tipo: 'lote', w, d }], chips: chips(T2('Muéstrame el terreno', 'Show me the site'), T2('Medir con Axiona Topo', 'Measure with Axiona Topo')) };
    }
  }

  // ascensor y amoblado
  if (/\bascensor\b/.test(t)) {
    const no = /\b(quita|sin|elimina|no quiero)\b/.test(t);
    return { dice: no ? T2('Quité el ascensor.', 'I removed the elevator.') : T2('Puse ascensor, con mando por voz además de los botones.', 'I added an elevator, with voice control besides the buttons.'), hacer: [{ tipo: 'set', p: 'ascensor', v: !no, repintar: true }], chips: [] };
  }
  if (/\b(sin muebles|quita los muebles|desamobla|vacia|sin amoblar)\b/.test(t)) return { dice: T2('Quité los muebles y la decoración.', 'I removed the furniture and decoration.'), hacer: [{ tipo: 'set', p: 'amoblar', v: false, repintar: true }], chips: [] };
  if (/\b(amobla|amueblala|amueblar|con muebles|decora|decorala)\b/.test(t)) return { dice: T2('La casa queda amoblada y decorada: muebles, cortinas, cuadros, plantas y jardín.', 'The house is now furnished and decorated: furniture, curtains, artwork, plants and garden.'), hacer: [{ tipo: 'set', p: 'amoblar', v: true, repintar: true }], chips: chips(T2('Muéstrame la casa amoblada', 'Show me the furnished house')) };

  // forma del edificio: pisos escalonados con terrazas, balcones, plantas en L, en U, con patio, curvas o recta
  {
    const pasoM = t.match(new RegExp(`\\b(?:retroceso|retrocede|terrazas?|escalon(?:es)?) (?:de )?${NUM} ?(?:m|mts|metros)\\b`));
    const paso = pasoM ? Math.min(6, Math.max(1, aNumero(pasoM[1]))) : null;
    const lateral = /\bterrazas? (?:lateral(?:es)?|de lado|al lado|a un lado|al costado)\b|\bescalonad[ao]s? (?:de|al|a un) (?:lado|costado)\b/.test(t);
    const ambos = /\b(?:frente y (?:de |al )?lado|lado y (?:al )?frente|los dos sentidos|ambos sentidos|en los dos lados|tambien de lado)\b/.test(t);
    const frente = /\bescalonad[ao]s?\b|\bescalona(?:la|lo|r)?\b|\bterrazas? (?:al frente|adelante|en el frente|en cada piso|en los pisos de arriba|escalonadas)\b|\bcon terrazas\b/.test(t);
    const pideOrganica = /\b(organic[ao]s?|mas compleja|menos cuadrada|no tan cuadrada|que no sea un cubo|que no sea una caja|mas interesante)\b/.test(t) && /\b(hazla|hazlo|ponla|ponle|que sea|dale|vuelvela|cambiala|quiero que)\b/.test(t);
    const recta = /\b(forma recta|pisos iguales|todos los pisos iguales|sin terrazas|quita(?:le)? las terrazas|sin escalonar|que no sea escalonada|quita lo escalonado)\b/.test(t);
    const balcon = /\bbalcon(?:es)?\b/.test(t) && !/\b\d+(?:[.,]\d+)? ?(?:m2|metros cuadrados)\b/.test(t);
    const sinBalcon = balcon && /\b(quita|sin|elimina|no quiero)\b/.test(t);
    const ele = /\b(en l|en forma de l|en forma de ele|planta en l|casa en l)\b/.test(t);
    const enU = /\b(en u|en forma de u|planta en u|casa en u)\b/.test(t);
    const patio = /\b(patio central|casa de patio|casa colonial|claustro|alrededor de un patio|patio interior|con patio(?! de ropas))\b/.test(t);
    const curvas = /\b(curvas?|curvos?|redondead[ao]s?|redondos?|mirador|media vuelta)\b/.test(t) && !/\bcurvas de nivel\b/.test(t);
    const sinCurvas = curvas && /\b(quita|sin|elimina|no quiero)\b/.test(t);
    const tipo = recta ? 'recta' : patio ? 'patio' : enU ? 'u' : ele ? 'ele' : ambos || pideOrganica ? 'escalonada' : lateral ? 'lateral' : frente ? 'terrazas' : null;
    if (tipo || balcon || curvas || (paso && S.forma?.tipo && S.forma.tipo !== 'recta')) {
      const hacer = [];
      if (tipo) hacer.push({ tipo: 'set', p: 'forma.tipo', v: tipo, repintar: true });
      if (paso) hacer.push({ tipo: 'set', p: 'forma.paso', v: paso });
      if (balcon || pideOrganica) hacer.push({ tipo: 'set', p: 'forma.balcones', v: !sinBalcon });
      if (curvas || pideOrganica) hacer.push({ tipo: 'set', p: 'forma.curvas', v: !sinCurvas });
      const p = paso || S.forma?.paso || 2.5, pTxt = T2(String(p).replace('.', ','), String(p));
      const partes = [];
      if (tipo === 'recta') partes.push(T2('todos los pisos quedan con la misma huella, sin terrazas', 'every floor keeps the same footprint, with no terraces'));
      else if (tipo === 'terrazas') partes.push(T2(`cada piso de arriba retrocede ${pTxt} m al frente y deja una terraza con baranda de vidrio`, `each upper floor steps back ${pTxt} m at the front and leaves a terrace with a glass railing`));
      else if (tipo === 'lateral') partes.push(T2(`cada piso de arriba retrocede ${pTxt} m de un lado y deja una terraza lateral con baranda`, `each upper floor steps back ${pTxt} m on one side and leaves a side terrace with a railing`));
      else if (tipo === 'escalonada') partes.push(T2(`la casa se escalona ${pTxt} m al frente y de lado, con terrazas en cada piso`, `the house steps back ${pTxt} m at the front and on one side, with terraces on every floor`));
      else if (tipo === 'patio') partes.push(T2('la casa queda alrededor de un patio central, con corredor de columnas y zaguán de entrada con la escalera, como la casa de patio', 'the house wraps around a central courtyard, with a colonnaded gallery and an entry hall with the stair, like a traditional courtyard house'));
      else if (tipo === 'u') partes.push(T2('la casa queda en U: tres alas alrededor de un patio que se abre al fondo, con corredor de columnas', 'the house is U-shaped: three wings around a courtyard that opens to the back, with a colonnaded gallery'));
      else if (tipo === 'ele') partes.push(T2('la casa queda en L: dos alas con corredor de columnas hacia un patio que se abre al fondo y al lado', 'the house is L-shaped: two wings with a colonnaded gallery facing a courtyard open to the back and the side'));
      else if (paso) partes.push(T2(`el retroceso queda de ${pTxt} m por piso`, `the setback is now ${pTxt} m per floor`));
      if (balcon || pideOrganica) partes.push(sinBalcon ? T2('quité los balcones', 'I removed the balconies') : T2('los pisos de arriba llevan balcones al frente donde no hay terraza, con puerta-ventana', 'the upper floors get front balconies where there is no terrace, with French doors'));
      if (curvas || pideOrganica) partes.push(sinCurvas ? T2('quité las curvas', 'I removed the curves') : T2('la sala lleva un mirador de vidrio en media vuelta y los balcones quedan redondeados', 'the living room gets a half-round glass bay and the balconies are rounded'));
      let dice = `${T2('Listo', 'Done')}: ${partes.join(T2(', y ', ', and '))}.`;
      const compuesta = ['patio', 'u', 'ele'].includes(tipo);
      if (compuesta) dice += T2(' Si el lote no alcanza, la dejo recta y te digo cuánto necesita. El 3D, los planos, las fachadas, los cortes y el presupuesto salen con esa forma.', ' If the lot is too small, I keep it straight and tell you how much it needs. The 3D, drawings, elevations, sections and budget follow that form.');
      else if (tipo && tipo !== 'recta') dice += T2(' La base crece lo necesario para que cada piso quepa con su programa, y el 3D, los planos, las fachadas, los cortes y el presupuesto salen con esa forma.', ' The base grows as needed so every floor fits its program, and the 3D, drawings, elevations, sections and budget follow that form.');
      if (S.floors < 2 && !compuesta && ((tipo && tipo !== 'recta') || balcon)) dice += T2(' Para que se note necesita 2 pisos o más: ¿le pongo 2?', ' It needs 2 floors or more to show: shall I make it 2?');
      return { dice, hacer, chips: compuesta ? chips(T2('Muéstrame el 3D', 'Show me the 3D'), T2('Muéstrame los planos', 'Show me the drawings'), T2('Ponle curvas', 'Add curves')) : S.floors < 2 && !curvas ? chips(T2('Pon 2 pisos', 'Make it 2 floors'), T2('Muéstrame el 3D', 'Show me the 3D')) : chips(T2('Muéstrame el 3D', 'Show me the 3D'), T2('Muéstrame las fachadas', 'Show me the elevations'), tipo !== 'escalonada' ? T2('Escalónala también de lado', 'Also step it on the side') : T2('Forma recta', 'Straight form')) };
    }
  }

  // cubierta y sistema constructivo
  if (/\b(cubierta|techo|tejado)\b/.test(t)) {
    const k = /dos aguas/.test(t) ? 'dos' : /cuatro aguas/.test(t) ? 'cuatro' : /plan[ao]|terraza/.test(t) ? 'plana' : null;
    if (k) return { dice: T2(`Listo: cubierta ${k === 'plana' ? 'plana con antepecho' : k === 'dos' ? 'a dos aguas' : 'a cuatro aguas'}.`, `Done: ${k === 'plana' ? 'flat roof with parapet' : k === 'dos' ? 'gable roof' : 'hip roof'}.`), hacer: [{ tipo: 'set', p: 'cubierta.tipo', v: k, repintar: true }], chips: chips(T2('Muéstrame el 3D', 'Show me the 3D')) };
  }
  if (/\b(confinada|mamposteria|porticos|aporticad|sistema constructivo|estructura de concreto)\b/.test(t)) {
    const k = /confinada|mamposteria/.test(t) ? 'confinada' : /portico|aporticad|concreto/.test(t) ? 'porticos' : null;
    const ok = ctx.sistemas.find(([s]) => s === k);
    if (ok) return { dice: T2(`Listo: el sistema queda en ${ok[1]}. El presupuesto y los planos estructurales se recalculan.`, `Done: the building system is now ${ok[1]}. The budget and the structural drawings are recalculated.`), hacer: [{ tipo: 'set', p: 'sistema', v: k, repintar: true }], chips: chips(T2('Cuánto cuesta', 'How much does it cost')) };
    return { dice: T2(`En ${ctx.paisNombre} el motor trabaja con ${lista(ctx.sistemas.map(([, n]) => n))}.`, `In ${ctx.paisNombre} the engine works with ${lista(ctx.sistemas.map(([, n]) => n))}.`), hacer: [], chips: [] };
  }

  // estilo
  {
    const est = Object.entries(ctx.estilos).find(([, n]) => t.includes(normalizar(n)) || t0.includes(normalizar(n)));
    if (est && /\b(estilo|look|decoracion|acabados|ponla|hazla|quiero)\b/.test(t)) {
      return { dice: T2(`Listo: estilo ${est[1]}. Cambian pisos, enchapes, maderas, telas y colores.`, `Done: ${est[1]} style. Floors, tiles, woods, fabrics and colors change.`), hacer: [{ tipo: 'estilo', k: est[0] }], chips: chips(T2('Muéstrame la casa amoblada', 'Show me the furnished house'), T2('Cuánto cuesta', 'How much does it cost')) };
    }
    if (/\bestilos?\b/.test(t)) return { dice: T2('Estos son los estilos. Toca uno.', 'These are the styles. Tap one.'), hacer: [{ tipo: 'tab', tab: 'interiores' }], chips: Object.values(ctx.estilos).map(n => T2(`Estilo ${n}`, `${n} style`)) };
  }

  // acabado de piso
  {
    const P = PISOS_PAL.find(([re]) => re.test(t));
    if (P && /\b(piso|pisos|en |pon|ponle|quiero|cambia|todo|toda)\b/.test(t)) {
      const todo = /\b(toda la casa|todo|todos|todas|en todas partes|en general)\b/.test(t);
      if (!todo) {
        const i = espacio(t);
        if (typeof i === 'object') return { dice: T2(`¿En cuál? Hay ${lista(i.varios)}.`, `Which one? There are ${lista(i.varios)}.`), hacer: [], chips: i.varios.map(n => T2(`${nombrePiso(P[1])} en ${n}`, `${nombrePiso(P[1])} in ${n}`)) };
        if (i >= 0) {
          const r = S.rooms[i];
          return { dice: T2(`Listo: ${r.name} queda en ${nombrePiso(P[1])}.`, `Done: ${r.name} now has ${nombrePiso(P[1])}.`), hacer: [{ tipo: 'piso', key: `${r.floor}:${r.name}`, k: P[1] }], chips: chips(T2('Muéstrame el 3D', 'Show me the 3D')) };
        }
      }
      return { dice: T2(`Listo: ${nombrePiso(P[1])} en toda la casa (los baños también, salvo que me digas otra cosa).`, `Done: ${nombrePiso(P[1])} in the whole house (bathrooms too, unless you tell me otherwise).`), hacer: [{ tipo: 'piso', key: '*', k: P[1] }], chips: chips(T2('Muéstrame la casa terminada', 'Show me the finished house'), T2('Cuánto cuesta', 'How much does it cost')) };
    }
  }

  // quitar un espacio
  if (VERBO_QUITAR.test(t) && !/\b(muebles|ascensor|piso mas|un piso|pdf|dxf|planos|foto|presupuesto)\b/.test(t)) {
    const i = espacio(t);
    if (typeof i === 'object') return { dice: T2(`¿Cuál quito? Hay ${lista(i.varios)}.`, `Which one should I remove? There are ${lista(i.varios)}.`), hacer: [], chips: i.varios.map(n => T2(`Quita ${n}`, `Remove ${n}`)) };
    if (i >= 0) return { dice: T2(`Quité ${S.rooms[i].name}. El motor redistribuye el piso.`, `I removed ${S.rooms[i].name}. The engine lays out the floor again.`), hacer: [{ tipo: 'room-', i }], chips: chips(T2('Qué espacios hay', 'What rooms are there'), T2('Muéstrame los planos', 'Show me the drawings')) };
    return { dice: T2('No encontré ese espacio. Dime el nombre como sale en la lista.', 'I couldn’t find that room. Tell me its name as it appears in the list.'), hacer: [], chips: chips(T2('Qué espacios hay', 'What rooms are there')) };
  }

  // agrandar, achicar, cambiar área, pasar de piso, renombrar
  {
    const ren = t.match(/(?:cambia(?:le)? el nombre (?:de |a )?|renombra |llama )(.+?) (?:a|como|por) (.+)/);
    if (ren) {
      const i = espacio(ren[1]);
      if (typeof i === 'number' && i >= 0) {
        const nuevo = texto.split(/ (?:a|como|por|to|as) /i).pop().trim().replace(/^["«“]|["»”]$/g, '');
        return { dice: T2(`Listo: ${S.rooms[i].name} ahora se llama «${nuevo}».`, `Done: ${S.rooms[i].name} is now called “${nuevo}”.`), hacer: [{ tipo: 'room=', i, cambios: { name: nuevo.slice(0, 40) } }], chips: [] };
      }
    }
    const grande = /\b(agranda|amplia|aumenta|mas grande|haz mas grande|crece)\b/.test(t);
    const chico = /\b(achica|reduce|disminuye|mas pequen|mas chic|encoge)\b/.test(t);
    const fija = t.match(new RegExp(`\\b(?:de|a|en) ${NUM} ?(?:m2|metros)`));
    const mover = /\b(pasa|mueve|lleva|sube|baja|cambia)\b/.test(t) && pisoDe(t, S.floors);
    if (grande || chico || mover || (fija && /\b(deja|pon|ponle|cambia|que tenga|que mida)\b/.test(t))) {
      const i = espacio(t);
      if (typeof i === 'object') return { dice: T2(`¿Cuál? Hay ${lista(i.varios)}.`, `Which one? There are ${lista(i.varios)}.`), hacer: [], chips: [] };
      if (i >= 0) {
        const r = S.rooms[i], cambios = {};
        if (mover && !grande && !chico) {
          const f = pisoDe(t, S.floors);
          if (f > S.floors) return { dice: T2(`La casa tiene ${S.floors} ${pisosTxt(S.floors)}. Primero di «pon ${f} pisos».`, `The house has ${S.floors} ${pisosTxt(S.floors)}. First say “make it ${f} floors”.`), hacer: [], chips: chips(T2(`Pon ${f} pisos`, `Make it ${f} floors`)) };
          cambios.floor = f;
        }
        if (fija) cambios.area = Math.max(1.5, Math.min(500, aNumero(fija[1])));
        else if (grande) cambios.area = Math.round(r.area * 1.25 * 2) / 2;
        else if (chico) cambios.area = Math.max(1.5, Math.round(r.area * 0.8 * 2) / 2);
        const partes = [];
        if (cambios.area) partes.push(`${cambios.area} m²`);
        if (cambios.floor) partes.push(T2(`en el piso ${cambios.floor}`, `on floor ${cambios.floor}`));
        return { dice: T2(`Listo: ${r.name} queda de ${partes.join(' y ') || 'igual'}.`, `Done: ${r.name} is now ${partes.join(' and ') || 'unchanged'}.`), hacer: [{ tipo: 'room=', i, cambios }], chips: chips(T2('Muéstrame los planos', 'Show me the drawings')) };
      }
    }
  }

  // agregar espacios
  if (VERBO_AGREGAR.test(t) || /^(una?|dos|tres|otra?) /.test(t)) {
    const pedidos = espaciosPedidos(t);
    if (pedidos.length) {
      const f = pisoDe(t, S.floors) || 1;
      if (f > S.floors) return { dice: T2(`La casa tiene ${S.floors} ${pisosTxt(S.floors)}. ¿Le pongo ${f}?`, `The house has ${S.floors} ${pisosTxt(S.floors)}. Shall I make it ${f}?`), hacer: [], chips: chips(T2(`Pon ${f} pisos`, `Make it ${f} floors`)) };
      const rooms = S.rooms.map(r => ({ ...r })), nuevos = [];
      for (const { T, n, a } of pedidos) {
        for (let k = 0; k < n; k++) {
          const name = nombreLibre(tr(T.n), rooms);
          const room = { name, area: a || T.a, floor: f, zone: T.z };
          rooms.push(room); nuevos.push(room);
        }
      }
      return {
        dice: T2(`Listo: agregué ${lista(nuevos.map(r => `${r.name} (${r.area} m²)`))} en el piso ${f}. El motor ya redistribuyó todo.`, `Done: I added ${lista(nuevos.map(r => `${r.name} (${r.area} m²)`))} on floor ${f}. The engine has already laid everything out again.`),
        hacer: nuevos.map(room => ({ tipo: 'room+', room })), chips: chips(T2('Muéstrame los planos', 'Show me the drawings'), T2('Cuánto cuesta', 'How much does it cost'), T2('Muéstrame el 3D', 'Show me the 3D')),
      };
    }
  }

  // realidad aumentada propia (cualquier celular con cámara)
  {
    const ar = /\b(realidad aumentada|en ar|la ar|el ar|ar axiona|sobre (?:la|mi) mesa|en mi mesa|maqueta virtual|holograma de la casa)\b/.test(t);
    const marcadores = /\bmarcador(?:es)?\b/.test(t) && /\b(descarga|imprim|dame|pdf|baja|sacar?)\w*/.test(t);
    if (marcadores) return { dice: T2('Descargando los marcadores en PDF: el 0 es para la maqueta y los demás para las esquinas del lote. Imprímelos al 100 % y mide el lado negro.', 'Downloading the markers as a PDF: marker 0 is for the table model and the others for the lot corners. Print them at 100 % and measure the black square.'), hacer: [{ tipo: 'act', a: 'arAxPDF' }], chips: chips(T2('Muéstrame la casa en realidad aumentada', 'Show me the house in augmented reality')) };
    if (ar && /\b(funciona|sirve|no me|no abre|no funciona|no tiene|no trae|por que|arcore|mi celular)\b/.test(t)) {
      return { dice: T2('La realidad aumentada de Axiona no depende de que el celular traiga AR: la app hace la visión con la cámara. Imprime el marcador 0 (o muéstralo en el computador), abre la maqueta y apúntale. Si no tienes marcador, di «sin marcador» y la pongo con el giroscopio.', 'Axiona’s augmented reality does not depend on the phone having AR: the app does the vision with the camera. Print marker 0 (or show it on a computer), open the table model and point at it. If you have no marker, say “no marker” and I’ll place it with the gyroscope.'), hacer: [], chips: chips(T2('Muéstrame la casa en realidad aumentada', 'Show me the house in augmented reality'), T2('Descarga los marcadores', 'Download the markers'), T2('Sin marcador', 'No marker')) };
    }
    if (ar || /^sin marcador$/.test(t)) {
      if (/\bsin marcador\b/.test(t)) return { dice: T2('Abro la realidad aumentada sin marcador: apunta al piso y toca donde quieres la casa; luego gira el celular para mirarla.', 'Opening augmented reality without a marker: point at the floor and tap where you want the house; then turn the phone to look at it.'), hacer: [{ tipo: 'act', a: 'arAxGiro' }], chips: [] };
      if (/\b(lote|escala real|tamano real|tamano natural)\b/.test(t)) return { dice: T2('Abro la casa a escala real en el lote: pon el marcador 1 sobre la estaca de P1 con la flecha hacia P2 y aléjate unos metros.', 'Opening the house at full scale on the lot: place marker 1 on the P1 stake with the arrow toward P2 and step back a few meters.'), hacer: [{ tipo: 'act', a: 'arAxLote' }], chips: [] };
      return { dice: T2('Abro la maqueta en realidad aumentada: apunta la cámara al marcador 0, impreso o en otra pantalla. Si no lo tienes, di «sin marcador».', 'Opening the table model in augmented reality: point the camera at marker 0, printed or on another screen. If you don’t have it, say “no marker”.'), hacer: [{ tipo: 'act', a: 'arAxMaqueta' }], chips: chips(T2('Descarga los marcadores', 'Download the markers'), T2('Sin marcador', 'No marker')) };
    }
  }

  // 3D por fases y acciones del modelo
  if (/\b(ladrillos?|obra negra|estructura|esqueleto|columnas)\b/.test(t) && /\b(muestra(?:me|nos)?|ver|verla|mira|ensena(?:me)?|como se ve|quiero ver)\b/.test(t)) {
    return { dice: T2('Esta es la obra negra: estructura y muros en ladrillo, como queda antes del pañete.', 'This is the structure stage: frame and brick walls, as they are before plastering.'), hacer: [{ tipo: 'tab', tab: 'modelo' }, { tipo: 'fase', cat: 'negra' }], chips: chips(T2('Ahora la obra gris', 'Now the rough finish'), T2('La casa terminada', 'The finished house')) };
  }
  if (/\b(obra gris|panete|revoque)\b/.test(t)) return { dice: T2('Esta es la obra gris: muros pañetados, redes y cubierta.', 'This is the rough finish: plastered walls, services and roof.'), hacer: [{ tipo: 'tab', tab: 'modelo' }, { tipo: 'fase', cat: 'gris' }], chips: chips(T2('La casa terminada', 'The finished house')) };
  if (/\b(terminada|obra blanca|acabados finales|como queda al final)\b/.test(t)) return { dice: T2('Así queda terminada: pisos, enchapes, pintura y carpintería.', 'This is how it looks finished: floors, tiles, paint, doors and windows.'), hacer: [{ tipo: 'tab', tab: 'modelo' }, { tipo: 'fase', cat: 'blanca' }], chips: chips(T2('Muéstrame la casa amoblada', 'Show me the furnished house'), T2('Recorrer la casa', 'Walk through the house')) };
  if (/\b(amoblada|con los muebles|decorada)\b/.test(t)) return { dice: T2('Aquí está amoblada y decorada.', 'Here it is, furnished and decorated.'), hacer: [{ tipo: 'tab', tab: 'modelo' }, { tipo: 'fase', cat: 'dot' }], chips: chips(T2('Recorrer la casa', 'Walk through the house'), T2('Toma una foto', 'Take a photo')) };
  if (/\b(recorr|caminar|camina|entrar a la casa|entra a la casa|paseo)\b/.test(t)) return { dice: T2('Entramos a la casa: muévete con el dedo o con las flechas.', 'Let’s go inside: move with your finger or the arrow keys.'), hacer: [{ tipo: 'act', a: 'recorridoCasa' }], chips: [] };
  if (/\b(foto|captura|render|imagen del 3d)\b/.test(t)) return { dice: T2('Tomé la foto del 3D: se descarga en un momento.', 'I took a photo of the 3D: it will download in a moment.'), hacer: [{ tipo: 'tab', tab: 'modelo' }, { tipo: 'act', a: 'foto', espera: 900 }], chips: [] };

  // descargas y compartir
  if (/\b(descarga|descargar|baja|bajar|genera|exporta|dame|manda(?:me)?|imprime)\b/.test(t) || /\b(pdf|dxf|autocad|excel|csv|glb|usdz)\b/.test(t)) {
    if (/\b(dxf|autocad|cad)\b/.test(t)) return { dice: T2('Descargando los planos en DXF para AutoCAD.', 'Downloading the drawings as DXF for AutoCAD.'), hacer: [{ tipo: 'act', a: 'expDXF' }], chips: [] };
    if (/\b(excel|csv)\b/.test(t)) return { dice: T2('Descargando el presupuesto en CSV (se abre en Excel).', 'Downloading the budget as CSV (it opens in Excel).'), hacer: [{ tipo: 'act', a: 'expCSV' }], chips: [] };
    if (/\b(usdz|iphone)\b/.test(t)) return { dice: T2('Descargando el modelo para iPhone (USDZ).', 'Downloading the model for iPhone (USDZ).'), hacer: [{ tipo: 'tab', tab: 'modelo' }, { tipo: 'act', a: 'expUSDZ', espera: 900 }], chips: [] };
    if (/\b(glb|modelo 3d|el 3d)\b/.test(t)) return { dice: T2('Descargando el modelo 3D (GLB).', 'Downloading the 3D model (GLB).'), hacer: [{ tipo: 'tab', tab: 'modelo' }, { tipo: 'act', a: 'expGLB', espera: 900 }], chips: [] };
    if (/\b(pdf|planos|juego de planos|laminas)\b/.test(t)) return { dice: T2('Estoy armando el juego de planos en PDF; tarda unos segundos.', 'I’m putting together the drawing set as a PDF; it takes a few seconds.'), hacer: [{ tipo: 'tab', tab: 'planos' }, { tipo: 'act', a: 'expPDF', espera: 600 }], chips: [] };
    if (/\b(proyecto|json)\b/.test(t)) return { dice: T2('Descargando el proyecto completo (JSON).', 'Downloading the full project (JSON).'), hacer: [{ tipo: 'act', a: 'expJSON' }], chips: [] };
  }
  if (/\b(comparte|compartir|enviar al cliente|envialo|mandalo)\b/.test(t)) return { dice: T2('Te armo el enlace del proyecto para compartirlo.', 'I’ll make you a link to share the project.'), hacer: [{ tipo: 'act', a: 'compartir' }], chips: [] };
  if (/\b(medir con axiona topo|abre topo|abrir topo|axiona topo)\b/.test(t)) return { dice: T2('Abro Axiona Topo, el topógrafo en el celular.', 'Opening Axiona Topo, the surveyor on your phone.'), hacer: [{ tipo: 'abrir', url: TOPO_URL }], chips: [] };

  // ir a una pestaña o a una vista de los planos
  if (VERBO_IR.test(t) || t.split(' ').length <= 3) {
    if (/\b(fachadas?|alzados?)\b/.test(t)) return { dice: T2('Aquí está la fachada principal; arriba cambias a las laterales y la posterior.', 'Here is the front elevation; switch to the side and rear ones above.'), hacer: [{ tipo: 'vista', v: 'F-frente' }], chips: chips(T2('Muéstrame el corte', 'Show me the section'), T2('Muéstrame el 3D', 'Show me the 3D')) };
    if (/\bcortes?\b/.test(t)) return { dice: T2('Este es el corte longitudinal por la escalera.', 'This is the long section through the stair.'), hacer: [{ tipo: 'vista', v: 'C-A' }], chips: chips(T2('Muéstrame las fachadas', 'Show me the elevations')) };
    if (/\b(planta|plano) de (la )?cubierta\b/.test(t)) return { dice: T2('Esta es la planta de cubierta, con las terrazas de los pisos de abajo.', 'This is the roof plan, with the terraces of the floors below.'), hacer: [{ tipo: 'vista', v: 'cub' }], chips: [] };
    const tb = TABS.find(([re]) => re.test(t));
    if (tb) return { dice: T2(`Aquí tienes ${tr(tb[2])}.`, `Here is ${tr(tb[2])}.`), hacer: [{ tipo: 'tab', tab: tb[1] }], chips: [] };
  }

  // preguntas frecuentes (palabras clave en español sobre la frase traducida, y en inglés sobre la original)
  const puntaje = f => f.claves.filter(k => t.includes(k)).reduce((s, k) => s + k.length, 0) + (ingles ? (f.clavesEn || []).filter(k => t0.includes(k)).reduce((s, k) => s + k.length, 0) : 0);
  const faq = FAQ.map(f => [f, puntaje(f)]).filter(([, s]) => s > 0).sort((a, b) => b[1] - a[1])[0];
  if (faq) {
    const c = { editar: [T2('Empezar de cero', 'Start from scratch'), T2('Agrega una alcoba', 'Add a bedroom')], materiales: [T2('Muéstrame los ladrillos', 'Show me the bricks')], topo: [T2('Medir con Axiona Topo', 'Measure with Axiona Topo')], exportar: [T2('Descarga el PDF', 'Download the PDF')], formas: [T2('Casa con patio central', 'Courtyard house'), T2('Hazla en L', 'Make it L-shaped'), T2('Ponle curvas', 'Add curves'), T2('Hazla escalonada con terrazas', 'Make it stepped with terraces')], otras: [T2('Hablar con una persona', 'Talk to a person')] }[faq[0].id] || [];
    return { dice: tr(faq[0].r), hacer: [], chips: c };
  }
  return null;
}

const NOMBRES_PISO = {
  porc: { es: 'porcelanato', en: 'porcelain tile' }, porcGF: { es: 'porcelanato de gran formato', en: 'large-format porcelain' }, marmol: { es: 'mármol', en: 'marble' },
  roble: { es: 'madera de roble', en: 'oak wood' }, nogal: { es: 'madera de nogal', en: 'walnut wood' }, teca: { es: 'madera de teca', en: 'teak wood' },
  spc: { es: 'vinilo tipo madera', en: 'wood-look vinyl' }, micro: { es: 'microcemento', en: 'microcement' }, ceram: { es: 'cerámica antideslizante', en: 'non-slip ceramic' },
  terracota: { es: 'terracota', en: 'terracotta' }, concreto: { es: 'concreto pulido', en: 'polished concrete' },
};
function nombrePiso(k) { return NOMBRES_PISO[k] ? tr(NOMBRES_PISO[k]) : k; }

/** Respuesta cuando nada coincide y no hay cerebro avanzado. */
export function noEntendi() {
  return {
    dice: T2('No te entendí del todo. Prueba con algo como «agrega una alcoba de 12 m² en el segundo piso», «pon 3 pisos», «porcelanato en toda la casa» o «cuánto cuesta». También puedes hablar con una persona del equipo.', 'I didn’t quite get that. Try something like “add a 12 m² bedroom on the second floor”, “make it 3 floors”, “porcelain tile in the whole house” or “how much does it cost”. You can also talk to a person on the team.'),
    hacer: [], chips: [T2('Qué puedes hacer', 'What can you do'), T2('Hablar con una persona', 'Talk to a person')],
  };
}

/** Resumen del proyecto para el modelo de lenguaje y los mensajes al equipo. */
export function resumen(ctx) {
  const S = ctx.S, M = ctx.M, ok = M && !M.err;
  const esp = S.rooms.map(r => `${r.name} ${r.area} m² (${T2('piso', 'floor')} ${r.floor})`).join('; ');
  return T2(
    `País: ${ctx.paisNombre}. Pisos: ${S.floors}. Lote: ${ok ? ctx.fmtA(M.lotArea) : '?'}. Construido: ${ok ? ctx.fmtA(M.built) : '?'}. Presupuesto: ${ok ? ctx.money(ctx.total) : '?'}. Estilo: ${ctx.estilos[S.acabados.estilo] || S.acabados.estilo}. Forma: ${S.forma?.tipo || 'recta'}${S.forma?.tipo && S.forma.tipo !== 'recta' ? `, retroceso ${S.forma.paso} m` : ''}${S.forma?.balcones ? ', con balcones' : ''}. Espacios: ${esp}.`,
    `Country: ${ctx.paisNombre}. Floors: ${S.floors}. Lot: ${ok ? ctx.fmtA(M.lotArea) : '?'}. Built: ${ok ? ctx.fmtA(M.built) : '?'}. Budget: ${ok ? ctx.money(ctx.total) : '?'}. Style: ${ctx.estilos[S.acabados.estilo] || S.acabados.estilo}. Form: ${S.forma?.tipo || 'recta'}${S.forma?.tipo && S.forma.tipo !== 'recta' ? `, setback ${S.forma.paso} m` : ''}${S.forma?.balcones ? ', with balconies' : ''}. Rooms: ${esp}.`,
  );
}
