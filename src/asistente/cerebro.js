/* ==========================================================================
   AXIONA OBRA · Cerebro local de Axi
   --------------------------------------------------------------------------
   Entiende órdenes en español y las convierte en acciones sobre el proyecto,
   sin internet ni modelo de lenguaje. No toca el DOM: recibe una foto del
   proyecto (ctx) y devuelve { dice, hacer, chips }. Quien ejecuta las
   acciones es axi.js. Si no entiende, devuelve null y, si el usuario activó
   el cerebro avanzado, la pregunta pasa al modelo de lenguaje.
   ========================================================================== */

import { FAQ, CAPACIDADES, TOPO_URL } from './saber.js';

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
  { re: /alcobas? principal(?:es)?|habitacion(?:es)? principal(?:es)?|cuartos? principal(?:es)?|recamaras? principal(?:es)?|master/, n: 'Alcoba principal', a: 14, z: 'privada' },
  { re: /alcobas?|habitacion(?:es)?|dormitorios?|recamaras?|cuartos? (?:de dormir|para dormir|extra)|cuartos?\b(?! piso)/, n: 'Alcoba', a: 10, z: 'privada', serie: true },
  { re: /banos? sociale?s?|banos? de visitas?|medio bano/, n: 'Baño social', a: 3, z: 'servicio' },
  { re: /banos? principal(?:es)?/, n: 'Baño principal', a: 5, z: 'servicio' },
  { re: /banos?/, n: 'Baño', a: 4, z: 'servicio', serie: true },
  { re: /cocinas?/, n: 'Cocina', a: 9, z: 'servicio' },
  { re: /sala comedor|sala-comedor/, n: 'Sala-comedor', a: 24, z: 'social' },
  { re: /comedor(?:es)?/, n: 'Comedor', a: 12, z: 'social' },
  { re: /salas? de estar|estar(?: familiar)?|sala de tv|cuarto de tv/, n: 'Estar familiar', a: 10, z: 'social' },
  { re: /salas?/, n: 'Sala', a: 18, z: 'social' },
  { re: /estudios?|oficinas?|despachos?/, n: 'Estudio', a: 9, z: 'privada' },
  { re: /patios? de ropas|lavander(?:ia|ias)|zona de ropas|lavadero/, n: 'Patio de ropas', a: 5, z: 'servicio' },
  { re: /terrazas?/, n: 'Terraza', a: 12, z: 'social' },
  { re: /balcon(?:es)?/, n: 'Balcón', a: 4, z: 'social' },
  { re: /garajes?|parqueaderos?|cocheras?/, n: 'Garaje', a: 15, z: 'servicio' },
  { re: /locale?s?(?: comercial(?:es)?)?|tiendas?/, n: 'Local comercial', a: 25, z: 'social' },
  { re: /bodegas?|depositos?|cuarto util/, n: 'Bodega', a: 6, z: 'servicio' },
  { re: /gimnasios?/, n: 'Gimnasio', a: 15, z: 'social' },
  { re: /cuarto de servicio|alcoba de servicio/, n: 'Alcoba de servicio', a: 8, z: 'servicio' },
];

const PISOS_PAL = [
  [/porcelanato (?:de )?gran formato|porcelanato tipo marmol|porcelanato marmolizado/, 'porcGF'],
  [/porcelanato/, 'porc'], [/marmol/, 'marmol'], [/nogal/, 'nogal'], [/teca/, 'teca'],
  [/madera|roble|piso laminado|laminado/, 'roble'], [/vinilo|spc/, 'spc'], [/microcemento/, 'micro'],
  [/ceramica|baldosa/, 'ceram'], [/terracota/, 'terracota'], [/concreto pulido|cemento pulido|piso pulido/, 'concreto'],
];

const TABS = [
  [/\b(3d|modelo|maqueta|tridimensional)\b/, 'modelo', 'el modelo 3D'],
  [/\b(planos?|planta arquitectonica|plantas|laminas)\b/, 'planos', 'los planos'],
  [/\b(presupuesto|costos|cantidades|apu)\b/, 'cantidades', 'el presupuesto'],
  [/\b(interiores|acabados|muebles|decoracion|domotica)\b/, 'interiores', 'los interiores'],
  [/\b(programa|espacios|lista de espacios)\b/, 'programa', 'el programa de espacios'],
  [/\b(terreno|lote|topografia)\b/, 'terreno', 'el terreno'],
  [/\b(ventas|condominio|conjunto|lotes)\b/, 'ventas', 'ventas y condominio'],
  [/\b(realidad aumentada|ar|exportar)\b/, 'ar', 'la realidad aumentada'],
  [/\b(proyecto|tramites|inicio|portada)\b/, 'proyecto', 'el proyecto'],
];

const VERBO_IR = /\b(muestra(?:me)?|abre|abrir|ir a|ve a|vamos a|llevame a|ensename|quiero ver|ver|mira|mirar|pasa a)\b/;
const VERBO_AGREGAR = /\b(agrega(?:r|le|me)?|anade|anadir|anadele|pon(?:le|me|er)?|mete(?:le)?|suma(?:le)?|incluye|quiero|necesito|crea|hazme|haz)\b/;
const VERBO_QUITAR = /\b(quita(?:r|le)?|elimina(?:r)?|borra(?:r)?|saca(?:r)?|suprime|remueve)\b/;

function chips(...l) { return l.filter(Boolean); }

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
  return `${base} nuevo`;
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
  return nombres.slice(0, -1).join(', ') + ' y ' + nombres[nombres.length - 1];
}

/**
 * @param texto lo que dijo o escribió el usuario
 * @param ctx   { S, M, total, m2, money, fmtA, estilos: {k: nombre}, plantillas: {k: titulo}, sistemas: [[k, nombre]], pais }
 * @returns {{dice: string, hacer: object[], chips: string[]}|null}
 */
export function interpretar(texto, ctx) {
  const t = normalizar(texto);
  if (!t) return null;
  const S = ctx.S;

  // saludos, gracias y ayuda
  if (/^(hola|buenas|buenos dias|buenas tardes|buenas noches|hey|que mas|quiubo|ola)\b/.test(t) && t.split(' ').length <= 4) {
    return { dice: '¡Hola! Soy Axi, el asistente de Axiona Obra. Dime qué casa quieres y la voy armando contigo: puedo agregar espacios, cambiar pisos y acabados, mostrarte el 3D o descargar los planos.', hacer: [], chips: chips('Agrega una alcoba', 'Pon 2 pisos', 'Muéstrame el 3D', 'Empezar de cero') };
  }
  if (/^(gracias|muchas gracias|mil gracias|listo gracias|ok gracias)\b/.test(t)) return { dice: 'Con gusto. Aquí estoy si necesitas algo más.', hacer: [], chips: [] };
  if (/\b(que puedes hacer|que sabes hacer|ayuda|ayudame|como funcionas|comandos|que haces)\b/.test(t) && !/\b(como edito|editar)\b/.test(t)) {
    return { dice: 'Esto puedo hacer por ti:\n• ' + CAPACIDADES.join('\n• '), hacer: [], chips: chips('Agrega una alcoba de 12 m2', 'Porcelanato en toda la casa', 'Cuánto cuesta', 'Hablar con una persona') };
  }

  // contacto, reseñas y propuestas
  if (/\b(hablar con (una persona|alguien|un humano|un asesor|santiago|soporte)|soporte|asesor|contacto|contactar|numero de whatsapp|su whatsapp|correo|email|llamar)\b/.test(t)) {
    return { dice: 'Te comunico con el equipo de Axiona. Escoge cómo quieres escribirnos.', hacer: [{ tipo: 'contacto' }], chips: [] };
  }
  if (/\b(resena|opinion|calificar|propuesta|sugerencia|sugerir|recomendacion|mejora|idea)\b/.test(t) && !VERBO_AGREGAR.test(t.replace(/\b(quiero|necesito)\b/, ''))) {
    const tipo = /propuesta|sugerencia|sugerir|recomendacion|mejora|idea/.test(t) ? 'propuesta' : 'resena';
    return { dice: tipo === 'propuesta' ? '¡Gracias por ayudarnos a mejorar! Cuéntanos tu propuesta y la lee el equipo.' : '¡Gracias! Cuéntanos qué te pareció Axiona Obra.', hacer: [{ tipo: 'formulario', clase: tipo }], chips: [] };
  }

  // datos del proyecto
  const M = ctx.M;
  if (M && !M.err) {
    if (/\b(cuanto (cuesta|vale|sale|me cuesta)|costo total|valor total|presupuesto total|cuanta plata|cuanto dinero)\b/.test(t)) {
      return { dice: `El presupuesto estimado es ${ctx.money(ctx.total)}, unos ${ctx.money(ctx.m2)} por metro cuadrado, para ${ctx.fmtA(M.built)} construidos. Es una estimación de anteproyecto con precios de referencia del país; en la pestaña Presupuesto puedes cambiar cada precio.`, hacer: [{ tipo: 'tab', tab: 'cantidades' }], chips: chips('Descarga el presupuesto en Excel', '¿Cómo puedo ahorrar?') };
    }
    if (/\b(cuantos metros|cuanto mide|area construida|metros construidos|area del lote|tamano)\b/.test(t)) {
      return { dice: `El lote tiene ${ctx.fmtA(M.lotArea)} y la casa ${ctx.fmtA(M.built)} construidos en ${S.floors} ${S.floors === 1 ? 'piso' : 'pisos'}.`, hacer: [], chips: chips('Pon un piso más', 'Muéstrame los planos') };
    }
    if (/\b(que espacios|que tiene la casa|lista de espacios|cuales espacios|cuantas alcobas|cuantos banos|que hay en)\b/.test(t)) {
      const porPiso = {};
      S.rooms.forEach(r => (porPiso[r.floor] ||= []).push(`${r.name} (${r.area} m²)`));
      const txt = Object.keys(porPiso).sort((a, b) => a - b).map(f => `Piso ${f}: ${porPiso[f].join(', ')}`).join('\n');
      return { dice: `Estos son los espacios:\n${txt}`, hacer: [{ tipo: 'tab', tab: 'programa' }], chips: chips('Agrega un baño', 'Quita el estudio') };
    }
    if (/\b(avisos|problemas|errores|algo mal|revision|esta bien)\b/.test(t)) {
      return M.warn.length
        ? { dice: `Hay ${M.warn.length} ${M.warn.length === 1 ? 'aviso' : 'avisos'} del diseño:\n• ${M.warn.slice(0, 4).join('\n• ')}`, hacer: [{ tipo: 'tab', tab: 'programa' }], chips: [] }
        : { dice: 'La revisión automática no encontró avisos en el diseño.', hacer: [], chips: [] };
    }
  }
  if (/\b(como (puedo )?ahorrar|mas barato|economizar|bajar el costo|reducir el costo)\b/.test(t)) {
    return { dice: 'Para ahorrar: baja las áreas de los espacios grandes, usa cerámica en vez de porcelanato, quita el amoblado del presupuesto, prueba la mampostería confinada (en Colombia, para 1 y 2 pisos suele salir más barata) y construye por etapas.', hacer: [], chips: chips('Cerámica en toda la casa', 'Mampostería confinada', 'Sin muebles') };
  }

  // empezar de cero, ejemplos y plantillas
  if (/\b(empezar de cero|desde cero|nuevo proyecto|proyecto nuevo|en blanco|proyecto vacio|mi propia casa|disenar la mia|disenar mi casa)\b/.test(t)) {
    return { dice: 'Listo: arranqué un proyecto en blanco con un lote de 10 × 20 m y una casa básica de un piso. Ahora dime qué espacios quieres, por ejemplo «agrega dos alcobas y un baño en el segundo piso».', hacer: [{ tipo: 'nuevo' }, { tipo: 'tab', tab: 'programa' }], chips: chips('Pon 2 pisos', 'Agrega dos alcobas en el segundo piso', 'Lote de 8 por 15') };
  }
  if (/\b(ejemplos?|plantillas?|modelos de casa|disenos de ejemplo|casas de ejemplo)\b/.test(t) && !/\b(carga|cargar|usa|abre)\b/.test(t)) {
    const pl = Object.entries(ctx.plantillas);
    return { dice: `Estos son los ejemplos de ${ctx.paisNombre}. Toca uno para cargarlo y después cámbialo a tu gusto.`, hacer: [], chips: pl.map(([, n]) => `Carga ${n}`) };
  }
  {
    const m = t.match(/\b(?:carga|cargar|usa|abre)(?: la plantilla| el ejemplo)? (.+)/);
    if (m) {
      const q = m[1];
      const pl = Object.entries(ctx.plantillas).map(([k, n]) => [k, n, normalizar(n)]);
      const hit = pl.find(([, , n]) => n.startsWith(q) || q.startsWith(n.split(' · ')[0]) || n.includes(q));
      if (hit) return { dice: `Cargué «${hit[1]}». Ahora cámbialo como quieras.`, hacer: [{ tipo: 'plantilla', k: hit[0] }], chips: chips('Muéstrame el 3D', 'Qué espacios hay') };
    }
  }

  // país e idioma
  {
    const m = t.match(/\b(colombia|espana|mexico|canada)\b/);
    if (m && /\b(cambia|cambiar|pasa|pasar|para|en|pais|usar|usa|normas de)\b/.test(t)) {
      const id = { colombia: 'CO', espana: 'ES', mexico: 'MX', canada: 'CA' }[m[1]];
      if (id === S.pais) return { dice: `El proyecto ya está con las normas de ${m[1] === 'espana' ? 'España' : m[1] === 'mexico' ? 'México' : m[1] === 'canada' ? 'Canadá' : 'Colombia'}.`, hacer: [], chips: [] };
      return { dice: 'Cambio el país: se cargan sus normas, trámites, moneda, sistema constructivo y precios. El lote y los espacios se conservan.', hacer: [{ tipo: 'pais', id }], chips: [] };
    }
  }
  if (/\b(en ingles|in english|english)\b/.test(t)) return { dice: 'Cambio la app a inglés. Yo sigo hablándote en español.', hacer: [{ tipo: 'idioma', l: 'en' }], chips: [] };
  if (/\b(en espanol|in spanish|spanish)\b/.test(t)) return { dice: 'La app queda en español.', hacer: [{ tipo: 'idioma', l: 'es' }], chips: [] };

  // pisos de la edificación
  {
    const m = t.match(new RegExp(`\\b${NUM} (?:pisos|niveles|plantas)\\b`)) || t.match(/\b(?:de|a) (\d) (?:piso|nivel|planta)\b/);
    if (m && !/\b(piso de|pisos de (porcelanato|madera|ceramica|marmol))\b/.test(t)) {
      const n = Math.round(aNumero(m[1]));
      if (n >= 1 && n <= 8) {
        const hacer = [{ tipo: 'set', p: 'floors', v: n }];
        const huerfanos = S.rooms.filter(r => r.floor > n).length;
        return { dice: `Listo: la edificación queda de ${n} ${n === 1 ? 'piso' : 'pisos'}.${huerfanos ? ` Ojo: ${huerfanos} ${huerfanos === 1 ? 'espacio estaba' : 'espacios estaban'} en pisos que ya no existen; pásalos de piso o quítalos.` : ''}`, hacer, chips: chips('Qué espacios hay', 'Muéstrame el 3D') };
      }
      if (n > 8) return { dice: 'Por ahora el motor llega hasta 8 pisos.', hacer: [], chips: [] };
    }
    if (/\b(un piso mas|otro piso|agrega un piso|sube un piso)\b/.test(t)) {
      const n = Math.min(8, S.floors + 1);
      return { dice: `Listo: ahora son ${n} pisos. Dime qué espacios van en el piso ${n}.`, hacer: [{ tipo: 'set', p: 'floors', v: n }], chips: chips(`Agrega una terraza en el piso ${n}`) };
    }
    if (/\b(un piso menos|quita un piso|baja un piso)\b/.test(t)) {
      const n = Math.max(1, S.floors - 1);
      return { dice: `Listo: quedan ${n} ${n === 1 ? 'piso' : 'pisos'}.`, hacer: [{ tipo: 'set', p: 'floors', v: n }], chips: [] };
    }
  }

  // lote
  {
    const m = t.match(new RegExp(`lote (?:de )?${NUM} ?(?:m |metros )?(?:x|por) ${NUM}`));
    if (m) {
      const w = aNumero(m[1]), d = aNumero(m[2]);
      if (w > 3 && d > 3 && w <= 300 && d <= 300) return { dice: `Listo: el lote queda de ${w} × ${d} m, plano. Si tiene pendiente, mídelo con Axiona Topo o pon las cotas en Terreno.`, hacer: [{ tipo: 'lote', w, d }], chips: chips('Muéstrame el terreno', 'Medir con Axiona Topo') };
    }
  }

  // ascensor y amoblado
  if (/\bascensor\b/.test(t)) {
    const no = /\b(quita|sin|elimina|no quiero)\b/.test(t);
    return { dice: no ? 'Quité el ascensor.' : 'Puse ascensor, con mando por voz además de los botones.', hacer: [{ tipo: 'set', p: 'ascensor', v: !no, repintar: true }], chips: [] };
  }
  if (/\b(sin muebles|quita los muebles|desamobla|vacia|sin amoblar)\b/.test(t)) return { dice: 'Quité los muebles y la decoración.', hacer: [{ tipo: 'set', p: 'amoblar', v: false, repintar: true }], chips: [] };
  if (/\b(amobla|amueblala|amueblar|con muebles|decora|decorala)\b/.test(t)) return { dice: 'La casa queda amoblada y decorada: muebles, cortinas, cuadros, plantas y jardín.', hacer: [{ tipo: 'set', p: 'amoblar', v: true, repintar: true }], chips: chips('Muéstrame la casa amoblada') };

  // forma del edificio: pisos escalonados con terrazas, balcones o recta
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
    const tipo = recta ? 'recta' : ambos || pideOrganica ? 'escalonada' : lateral ? 'lateral' : frente ? 'terrazas' : null;
    if (tipo || balcon || (paso && S.forma?.tipo && S.forma.tipo !== 'recta')) {
      const hacer = [];
      if (tipo) hacer.push({ tipo: 'set', p: 'forma.tipo', v: tipo, repintar: true });
      if (paso) hacer.push({ tipo: 'set', p: 'forma.paso', v: paso });
      if (balcon || pideOrganica) hacer.push({ tipo: 'set', p: 'forma.balcones', v: !sinBalcon });
      const p = paso || S.forma?.paso || 2.5, pTxt = String(p).replace('.', ',');
      const partes = [];
      if (tipo === 'recta') partes.push('todos los pisos quedan con la misma huella, sin terrazas');
      else if (tipo === 'terrazas') partes.push(`cada piso de arriba retrocede ${pTxt} m al frente y deja una terraza con baranda de vidrio`);
      else if (tipo === 'lateral') partes.push(`cada piso de arriba retrocede ${pTxt} m de un lado y deja una terraza lateral con baranda`);
      else if (tipo === 'escalonada') partes.push(`la casa se escalona ${pTxt} m al frente y de lado, con terrazas en cada piso`);
      else if (paso) partes.push(`el retroceso queda de ${pTxt} m por piso`);
      if (balcon || pideOrganica) partes.push(sinBalcon ? 'quité los balcones' : 'los pisos de arriba llevan balcones al frente donde no hay terraza, con puerta-ventana');
      let dice = `Listo: ${partes.join(', y ')}.`;
      if (tipo && tipo !== 'recta') dice += ' La base crece lo necesario para que cada piso quepa con su programa, y el 3D, los planos, las fachadas, los cortes y el presupuesto salen con esa forma.';
      if (S.floors < 2 && (tipo !== 'recta' || balcon)) dice += ' Para que se note necesita 2 pisos o más: ¿le pongo 2?';
      return { dice, hacer, chips: S.floors < 2 ? chips('Pon 2 pisos', 'Muéstrame el 3D') : chips('Muéstrame el 3D', 'Muéstrame las fachadas', tipo !== 'escalonada' ? 'Escalónala también de lado' : 'Forma recta') };
    }
  }

  // cubierta y sistema constructivo
  if (/\b(cubierta|techo|tejado)\b/.test(t)) {
    const k = /dos aguas/.test(t) ? 'dos' : /cuatro aguas/.test(t) ? 'cuatro' : /plan[ao]|terraza/.test(t) ? 'plana' : null;
    if (k) return { dice: `Listo: cubierta ${k === 'plana' ? 'plana con antepecho' : k === 'dos' ? 'a dos aguas' : 'a cuatro aguas'}.`, hacer: [{ tipo: 'set', p: 'cubierta.tipo', v: k, repintar: true }], chips: chips('Muéstrame el 3D') };
  }
  if (/\b(confinada|mamposteria|porticos|aporticad|sistema constructivo|estructura de concreto)\b/.test(t)) {
    const k = /confinada|mamposteria/.test(t) ? 'confinada' : /portico|aporticad|concreto/.test(t) ? 'porticos' : null;
    const ok = ctx.sistemas.find(([s]) => s === k);
    if (ok) return { dice: `Listo: el sistema queda en ${ok[1]}. El presupuesto y los planos estructurales se recalculan.`, hacer: [{ tipo: 'set', p: 'sistema', v: k, repintar: true }], chips: chips('Cuánto cuesta') };
    return { dice: `En ${ctx.paisNombre} el motor trabaja con ${lista(ctx.sistemas.map(([, n]) => n))}.`, hacer: [], chips: [] };
  }

  // estilo
  {
    const est = Object.entries(ctx.estilos).find(([, n]) => t.includes(normalizar(n)));
    if (est && /\b(estilo|look|decoracion|acabados|ponla|hazla|quiero)\b/.test(t)) {
      return { dice: `Listo: estilo ${est[1]}. Cambian pisos, enchapes, maderas, telas y colores.`, hacer: [{ tipo: 'estilo', k: est[0] }], chips: chips('Muéstrame la casa amoblada', 'Cuánto cuesta') };
    }
    if (/\bestilos?\b/.test(t)) return { dice: 'Estos son los estilos. Toca uno.', hacer: [{ tipo: 'tab', tab: 'interiores' }], chips: Object.values(ctx.estilos).map(n => `Estilo ${n}`) };
  }

  // acabado de piso
  {
    const P = PISOS_PAL.find(([re]) => re.test(t));
    if (P && /\b(piso|pisos|en |pon|ponle|quiero|cambia|todo|toda)\b/.test(t)) {
      const todo = /\b(toda la casa|todo|todos|todas|en todas partes|en general)\b/.test(t);
      if (!todo) {
        const i = buscarEspacio(t, S.rooms);
        if (typeof i === 'object') return { dice: `¿En cuál? Hay ${lista(i.varios)}.`, hacer: [], chips: i.varios.map(n => `${nombrePiso(P[1])} en ${n}`) };
        if (i >= 0) {
          const r = S.rooms[i];
          return { dice: `Listo: ${r.name} queda en ${nombrePiso(P[1])}.`, hacer: [{ tipo: 'piso', key: `${r.floor}:${r.name}`, k: P[1] }], chips: chips('Muéstrame el 3D') };
        }
      }
      return { dice: `Listo: ${nombrePiso(P[1])} en toda la casa (los baños también, salvo que me digas otra cosa).`, hacer: [{ tipo: 'piso', key: '*', k: P[1] }], chips: chips('Muéstrame la casa terminada', 'Cuánto cuesta') };
    }
  }

  // quitar un espacio
  if (VERBO_QUITAR.test(t) && !/\b(muebles|ascensor|piso mas|un piso|pdf|dxf|planos|foto|presupuesto)\b/.test(t)) {
    const i = buscarEspacio(t, S.rooms);
    if (typeof i === 'object') return { dice: `¿Cuál quito? Hay ${lista(i.varios)}.`, hacer: [], chips: i.varios.map(n => `Quita ${n}`) };
    if (i >= 0) return { dice: `Quité ${S.rooms[i].name}. El motor redistribuye el piso.`, hacer: [{ tipo: 'room-', i }], chips: chips('Qué espacios hay', 'Muéstrame los planos') };
    return { dice: 'No encontré ese espacio. Dime el nombre como sale en la lista.', hacer: [], chips: chips('Qué espacios hay') };
  }

  // agrandar, achicar, cambiar área, pasar de piso, renombrar
  {
    const ren = t.match(/(?:cambia(?:le)? el nombre (?:de |a )?|renombra |llama )(.+?) (?:a|como|por) (.+)/);
    if (ren) {
      const i = buscarEspacio(ren[1], S.rooms);
      if (typeof i === 'number' && i >= 0) {
        const nuevo = texto.split(/ (?:a|como|por) /i).pop().trim().replace(/^["«]|["»]$/g, '');
        return { dice: `Listo: ${S.rooms[i].name} ahora se llama «${nuevo}».`, hacer: [{ tipo: 'room=', i, cambios: { name: nuevo.slice(0, 40) } }], chips: [] };
      }
    }
    const grande = /\b(agranda|amplia|aumenta|mas grande|haz mas grande|crece)\b/.test(t);
    const chico = /\b(achica|reduce|disminuye|mas pequen|mas chic|encoge)\b/.test(t);
    const fija = t.match(new RegExp(`\\b(?:de|a|en) ${NUM} ?(?:m2|metros)`));
    const mover = /\b(pasa|mueve|lleva|sube|baja|cambia)\b/.test(t) && pisoDe(t, S.floors);
    if (grande || chico || mover || (fija && /\b(deja|pon|ponle|cambia|que tenga|que mida)\b/.test(t))) {
      const i = buscarEspacio(t, S.rooms);
      if (typeof i === 'object') return { dice: `¿Cuál? Hay ${lista(i.varios)}.`, hacer: [], chips: [] };
      if (i >= 0) {
        const r = S.rooms[i], cambios = {};
        if (mover && !grande && !chico) {
          const f = pisoDe(t, S.floors);
          if (f > S.floors) return { dice: `La casa tiene ${S.floors} ${S.floors === 1 ? 'piso' : 'pisos'}. Primero di «pon ${f} pisos».`, hacer: [], chips: chips(`Pon ${f} pisos`) };
          cambios.floor = f;
        }
        if (fija) cambios.area = Math.max(1.5, Math.min(500, aNumero(fija[1])));
        else if (grande) cambios.area = Math.round(r.area * 1.25 * 2) / 2;
        else if (chico) cambios.area = Math.max(1.5, Math.round(r.area * 0.8 * 2) / 2);
        const partes = [];
        if (cambios.area) partes.push(`${cambios.area} m²`);
        if (cambios.floor) partes.push(`en el piso ${cambios.floor}`);
        return { dice: `Listo: ${r.name} queda de ${partes.join(' y ') || 'igual'}.`, hacer: [{ tipo: 'room=', i, cambios }], chips: chips('Muéstrame los planos') };
      }
    }
  }

  // agregar espacios
  if (VERBO_AGREGAR.test(t) || /^(una?|dos|tres|otra?) /.test(t)) {
    const pedidos = espaciosPedidos(t);
    if (pedidos.length) {
      const f = pisoDe(t, S.floors) || 1;
      if (f > S.floors) return { dice: `La casa tiene ${S.floors} ${S.floors === 1 ? 'piso' : 'pisos'}. ¿Le pongo ${f}?`, hacer: [], chips: chips(`Pon ${f} pisos`) };
      const rooms = S.rooms.map(r => ({ ...r })), nuevos = [];
      for (const { T, n, a } of pedidos) {
        for (let k = 0; k < n; k++) {
          const name = nombreLibre(T.n, rooms);
          const room = { name, area: a || T.a, floor: f, zone: T.z };
          rooms.push(room); nuevos.push(room);
        }
      }
      return {
        dice: `Listo: agregué ${lista(nuevos.map(r => `${r.name} (${r.area} m²)`))} en el piso ${f}. El motor ya redistribuyó todo.`,
        hacer: nuevos.map(room => ({ tipo: 'room+', room })), chips: chips('Muéstrame los planos', 'Cuánto cuesta', 'Muéstrame el 3D'),
      };
    }
  }

  // realidad aumentada propia (cualquier celular con cámara)
  {
    const ar = /\b(realidad aumentada|en ar|la ar|el ar|ar axiona|sobre (?:la|mi) mesa|en mi mesa|maqueta virtual|holograma de la casa)\b/.test(t);
    const marcadores = /\bmarcador(?:es)?\b/.test(t) && /\b(descarga|imprim|dame|pdf|baja|sacar?)\w*/.test(t);
    if (marcadores) return { dice: 'Descargando los marcadores en PDF: el 0 es para la maqueta y los demás para las esquinas del lote. Imprímelos al 100 % y mide el lado negro.', hacer: [{ tipo: 'act', a: 'arAxPDF' }], chips: chips('Muéstrame la casa en realidad aumentada') };
    if (ar && /\b(funciona|sirve|no me|no abre|no funciona|no tiene|no trae|por que|arcore|mi celular)\b/.test(t)) {
      return { dice: 'La realidad aumentada de Axiona no depende de que el celular traiga AR: la app hace la visión con la cámara. Imprime el marcador 0 (o muéstralo en el computador), abre la maqueta y apúntale. Si no tienes marcador, di «sin marcador» y la pongo con el giroscopio.', hacer: [], chips: chips('Muéstrame la casa en realidad aumentada', 'Descarga los marcadores', 'Sin marcador') };
    }
    if (ar || /^sin marcador$/.test(t)) {
      if (/\bsin marcador\b/.test(t)) return { dice: 'Abro la realidad aumentada sin marcador: apunta al piso y toca donde quieres la casa; luego gira el celular para mirarla.', hacer: [{ tipo: 'act', a: 'arAxGiro' }], chips: [] };
      if (/\b(lote|escala real|tamano real|tamano natural)\b/.test(t)) return { dice: 'Abro la casa a escala real en el lote: pon el marcador 1 sobre la estaca de P1 con la flecha hacia P2 y aléjate unos metros.', hacer: [{ tipo: 'act', a: 'arAxLote' }], chips: [] };
      return { dice: 'Abro la maqueta en realidad aumentada: apunta la cámara al marcador 0, impreso o en otra pantalla. Si no lo tienes, di «sin marcador».', hacer: [{ tipo: 'act', a: 'arAxMaqueta' }], chips: chips('Descarga los marcadores', 'Sin marcador') };
    }
  }

  // 3D por fases y acciones del modelo
  if (/\b(ladrillos?|obra negra|estructura|esqueleto|columnas)\b/.test(t) && /\b(muestra(?:me|nos)?|ver|verla|mira|ensena(?:me)?|como se ve|quiero ver)\b/.test(t)) {
    return { dice: 'Esta es la obra negra: estructura y muros en ladrillo, como queda antes del pañete.', hacer: [{ tipo: 'tab', tab: 'modelo' }, { tipo: 'fase', cat: 'negra' }], chips: chips('Ahora la obra gris', 'La casa terminada') };
  }
  if (/\b(obra gris|panete|revoque)\b/.test(t)) return { dice: 'Esta es la obra gris: muros pañetados, redes y cubierta.', hacer: [{ tipo: 'tab', tab: 'modelo' }, { tipo: 'fase', cat: 'gris' }], chips: chips('La casa terminada') };
  if (/\b(terminada|obra blanca|acabados finales|como queda al final)\b/.test(t)) return { dice: 'Así queda terminada: pisos, enchapes, pintura y carpintería.', hacer: [{ tipo: 'tab', tab: 'modelo' }, { tipo: 'fase', cat: 'blanca' }], chips: chips('Muéstrame la casa amoblada', 'Recorrer la casa') };
  if (/\b(amoblada|con los muebles|decorada)\b/.test(t)) return { dice: 'Aquí está amoblada y decorada.', hacer: [{ tipo: 'tab', tab: 'modelo' }, { tipo: 'fase', cat: 'dot' }], chips: chips('Recorrer la casa', 'Toma una foto') };
  if (/\b(recorr|caminar|camina|entrar a la casa|entra a la casa|paseo)\b/.test(t)) return { dice: 'Entramos a la casa: muévete con el dedo o con las flechas.', hacer: [{ tipo: 'act', a: 'recorridoCasa' }], chips: [] };
  if (/\b(foto|captura|render|imagen del 3d)\b/.test(t)) return { dice: 'Tomé la foto del 3D: se descarga en un momento.', hacer: [{ tipo: 'tab', tab: 'modelo' }, { tipo: 'act', a: 'foto', espera: 900 }], chips: [] };

  // descargas y compartir
  if (/\b(descarga|descargar|baja|bajar|genera|exporta|dame|manda(?:me)?|imprime)\b/.test(t) || /\b(pdf|dxf|autocad|excel|csv|glb|usdz)\b/.test(t)) {
    if (/\b(dxf|autocad|cad)\b/.test(t)) return { dice: 'Descargando los planos en DXF para AutoCAD.', hacer: [{ tipo: 'act', a: 'expDXF' }], chips: [] };
    if (/\b(excel|csv)\b/.test(t)) return { dice: 'Descargando el presupuesto en CSV (se abre en Excel).', hacer: [{ tipo: 'act', a: 'expCSV' }], chips: [] };
    if (/\b(usdz|iphone)\b/.test(t)) return { dice: 'Descargando el modelo para iPhone (USDZ).', hacer: [{ tipo: 'tab', tab: 'modelo' }, { tipo: 'act', a: 'expUSDZ', espera: 900 }], chips: [] };
    if (/\b(glb|modelo 3d|el 3d)\b/.test(t)) return { dice: 'Descargando el modelo 3D (GLB).', hacer: [{ tipo: 'tab', tab: 'modelo' }, { tipo: 'act', a: 'expGLB', espera: 900 }], chips: [] };
    if (/\b(pdf|planos|juego de planos|laminas)\b/.test(t)) return { dice: 'Estoy armando el juego de planos en PDF; tarda unos segundos.', hacer: [{ tipo: 'tab', tab: 'planos' }, { tipo: 'act', a: 'expPDF', espera: 600 }], chips: [] };
    if (/\b(proyecto|json)\b/.test(t)) return { dice: 'Descargando el proyecto completo (JSON).', hacer: [{ tipo: 'act', a: 'expJSON' }], chips: [] };
  }
  if (/\b(comparte|compartir|enviar al cliente|envialo|mandalo)\b/.test(t)) return { dice: 'Te armo el enlace del proyecto para compartirlo.', hacer: [{ tipo: 'act', a: 'compartir' }], chips: [] };
  if (/\b(medir con axiona topo|abre topo|abrir topo|axiona topo)\b/.test(t)) return { dice: 'Abro Axiona Topo, el topógrafo en el celular.', hacer: [{ tipo: 'abrir', url: TOPO_URL }], chips: [] };

  // ir a una pestaña o a una vista de los planos
  if (VERBO_IR.test(t) || t.split(' ').length <= 3) {
    if (/\b(fachadas?|alzados?)\b/.test(t)) return { dice: 'Aquí está la fachada principal; arriba cambias a las laterales y la posterior.', hacer: [{ tipo: 'vista', v: 'F-frente' }], chips: chips('Muéstrame el corte', 'Muéstrame el 3D') };
    if (/\bcortes?\b/.test(t)) return { dice: 'Este es el corte longitudinal por la escalera.', hacer: [{ tipo: 'vista', v: 'C-A' }], chips: chips('Muéstrame las fachadas') };
    if (/\b(planta|plano) de (la )?cubierta\b/.test(t)) return { dice: 'Esta es la planta de cubierta, con las terrazas de los pisos de abajo.', hacer: [{ tipo: 'vista', v: 'cub' }], chips: [] };
    const tb = TABS.find(([re]) => re.test(t));
    if (tb) return { dice: `Aquí tienes ${tb[2]}.`, hacer: [{ tipo: 'tab', tab: tb[1] }], chips: [] };
  }

  // preguntas frecuentes
  const faq = FAQ.map(f => [f, f.claves.filter(k => t.includes(k)).reduce((s, k) => s + k.length, 0)]).filter(([, s]) => s > 0).sort((a, b) => b[1] - a[1])[0];
  if (faq) {
    const c = { editar: ['Empezar de cero', 'Agrega una alcoba'], materiales: ['Muéstrame los ladrillos'], topo: ['Medir con Axiona Topo'], exportar: ['Descarga el PDF'], formas: ['Hazla escalonada con terrazas', 'Terraza lateral', 'Agrega balcones'], otras: ['Hablar con una persona'] }[faq[0].id] || [];
    return { dice: faq[0].r, hacer: [], chips: c };
  }
  return null;
}

const NOMBRES_PISO = { porc: 'porcelanato', porcGF: 'porcelanato de gran formato', marmol: 'mármol', roble: 'madera de roble', nogal: 'madera de nogal', teca: 'madera de teca', spc: 'vinilo tipo madera', micro: 'microcemento', ceram: 'cerámica antideslizante', terracota: 'terracota', concreto: 'concreto pulido' };
function nombrePiso(k) { return NOMBRES_PISO[k] || k; }

/** Respuesta cuando nada coincide y no hay cerebro avanzado. */
export function noEntendi() {
  return { dice: 'No te entendí del todo. Prueba con algo como «agrega una alcoba de 12 m² en el segundo piso», «pon 3 pisos», «porcelanato en toda la casa» o «cuánto cuesta». También puedes hablar con una persona del equipo.', hacer: [], chips: ['Qué puedes hacer', 'Hablar con una persona'] };
}

/** Resumen del proyecto para el modelo de lenguaje. */
export function resumen(ctx) {
  const S = ctx.S, M = ctx.M;
  const esp = S.rooms.map(r => `${r.name} ${r.area} m² (piso ${r.floor})`).join('; ');
  return `País: ${ctx.paisNombre}. Pisos: ${S.floors}. Lote: ${M && !M.err ? ctx.fmtA(M.lotArea) : '?'}. Construido: ${M && !M.err ? ctx.fmtA(M.built) : '?'}. Presupuesto: ${M && !M.err ? ctx.money(ctx.total) : '?'}. Estilo: ${ctx.estilos[S.acabados.estilo] || S.acabados.estilo}. Forma: ${S.forma?.tipo || 'recta'}${S.forma?.tipo && S.forma.tipo !== 'recta' ? `, retroceso ${S.forma.paso} m` : ''}${S.forma?.balcones ? ', con balcones' : ''}. Espacios: ${esp}.`;
}
