/* ==========================================================================
   AXIONA OBRA · México
   --------------------------------------------------------------------------
   Lo que pide una obra en México y no cabe en los datos del país:

   TRÁMITE. En la CDMX la obra se registra con una manifestación de
   construcción A, B o C (artículo 51 del Reglamento de Construcciones): la A
   es una sola vivienda unifamiliar de hasta 120 m², dos niveles, 5.5 m de
   altura y claros de hasta 4 m, en predio con frente de 6 m o más y fuera de
   zona de riesgo; si algo de eso no se cumple es B (habitacional hasta
   10.000 m², otros usos hasta 5.000 m²) o C. B y C llevan DRO. Fuera de la
   CDMX es licencia municipal. El motor dice cuál toca y por qué.

   MAMPOSTERÍA CONFINADA. Castillos en extremos, intersecciones y a no más
   del menor de 4 m y 1.5 H (NTC de mampostería), dalas en cada nivel, muros
   de arriba sobre muros de abajo y planta regular (largo hasta 2.5 veces el
   ancho, condición de regularidad de las NTC de sismo).

   LOSA DE VIGUETA Y BOVEDILLA. El peralte sale del claro mayor:
   12+4 hasta 4 m, 15+5 hasta 5 m, 20+5 hasta 6 m; más de eso, losa maciza
   o diseño especial. Son valores de referencia: mandan las tablas del
   fabricante de la vigueta.

   AGUA. Ocupantes = 2 por recámara + 1 por vivienda. Dotación de referencia
   de los manuales de instalaciones: 150 L por habitante al día en viviendas
   de hasta 100 m² y 200 L en las más grandes; el proyectista la puede fijar
   según la NTC de instalaciones hidráulicas o el organismo de agua local.
   Cisterna = días de reserva × consumo diario; tinaco = un día. Se redondea
   a las capacidades que se venden.

   PRESUPUESTO. Catálogo de conceptos con clave, unidad y precio unitario,
   como lo arma una constructora mexicana. Cada cantidad sale de sus NÚMEROS
   GENERADORES: renglón por renglón, con piso, eje o espacio y medidas. El
   total del concepto ES la suma de su generador, así que siempre cuadran.

   FSR. Factor de salario real = (días pagados / días laborados) × (1 +
   obligaciones patronales), con el desglose a la vista.

   Todo es predimensionamiento: lo revisa y firma el DRO.
   ========================================================================== */

import { r2, ivUnion, ivSubtract } from './geometria.js';
import { tr } from './idioma.js';
import { PISOS, tipoEspacio } from './catalogo.js';

/** Entidades con su propio trámite. Fuera de la CDMX es licencia municipal. */
export const ENTIDADES = {
  cdmx: 'Ciudad de México', edomex: 'Estado de México', jal: 'Jalisco', nl: 'Nuevo León', qro: 'Querétaro',
  pue: 'Puebla', gto: 'Guanajuato', yuc: 'Yucatán', qroo: 'Quintana Roo', bc: 'Baja California', otra: 'Otra entidad',
};

/** Zonas geotécnicas de la CDMX (NTC de Cimentaciones). */
export const ZONAS_MX = {
  I: { es: 'Zona I · Lomas', en: 'Zone I · Hills' },
  II: { es: 'Zona II · Transición', en: 'Zone II · Transition' },
  III: { es: 'Zona III · Lago', en: 'Zone III · Lake' },
};

/** Separación máxima de castillos: el menor de 4 m y 1.5 veces la altura del muro. */
export const sepCastillos = (fh, slab) => r2(Math.min(4, 1.5 * Math.max(1.5, fh - slab)));

/** Peralte de la losa de vigueta y bovedilla según el claro mayor. */
export function losaVB(claro) {
  if (claro <= 4 + 1e-9) return { k: 'vb12', tipo: '12+4', h: 0.16, ok: true };
  if (claro <= 5 + 1e-9) return { k: 'vb15', tipo: '15+5', h: 0.20, ok: true };
  if (claro <= 6 + 1e-9) return { k: 'vb20', tipo: '20+5', h: 0.25, ok: true };
  return { k: 'losaMac', tipo: 'maciza', h: 0.15, ok: false };
}

/**
 * Zapata corrida bajo los muros de mampostería: carga lineal de 1.0 t/m² por
 * nivel repartida en todos los muros de planta baja, B = 1.15 w / q (redondeado
 * a 10 cm, mínimo 50 cm), peralte 15 cm hasta B = 0.80 m y 20 cm más ancha.
 */
export function cimMX(M) {
  const L = M.floors[0].lines.reduce((t, l) => t + (l.b - l.a), 0) || 1;
  const w = M.R.area * M.F * 1.0 / L;
  const B = Math.max(0.5, r2(Math.ceil(1.15 * w / M.q / 0.1 - 1e-9) * 0.1));
  return { B, hz: B <= 0.8 ? 0.15 : 0.2, zanja: r2(B + 0.2), w: r2(w), L: r2(L) };
}

/**
 * Claro que gobierna la losa. En mampostería confinada cada espacio es un
 * tablero apoyado en sus muros; en marcos, cada tablero queda entre trabes.
 * La vigueta salva el lado corto del tablero: manda el mayor de esos lados.
 */
export function claroMX(M) {
  if (M.sistema === 'porticos') {
    const tramos = ejes => ejes.slice(1).map((v, i) => v - ejes[i]);
    const tx = tramos(M.axX), ty = tramos(M.axY);
    let c = 0;
    tx.forEach(a => ty.forEach(b => { c = Math.max(c, Math.min(a, b)); }));
    return r2(c);
  }
  return r2(Math.max(0, ...espacios(M).filter(r => !r.circ).map(r => Math.min(r.w, r.h))));
}

/** Capacidades comerciales (litros) de cisternas y tinacos de polietileno. */
const CISTERNAS = [1200, 2800, 5000, 10000];
const TINACOS = [450, 600, 750, 1100, 2500];

/**
 * Piezas comerciales para guardar `litros`: de todas las combinaciones de una
 * misma capacidad con hasta `max` piezas, la de menos litros de sobra y, si
 * empatan, la de menos piezas. Si ni así alcanza, piezas de la mayor capacidad.
 */
export function piezasAgua(litros, tabla, max = 2) {
  let mejor = null;
  for (const cap of tabla) for (let n = 1; n <= max; n++) {
    const total = n * cap;
    if (total + 1e-9 < litros) continue;
    if (!mejor || total < mejor.total || (total === mejor.total && n < mejor.n)) mejor = { n, cap, total };
  }
  if (mejor) return mejor;
  const cap = tabla[tabla.length - 1], n = Math.ceil(litros / cap);
  return { n, cap, total: n * cap };
}

const espacios = M => M.floors.flatMap(fl => fl.rects.filter(r => !r.stair && !r.asc).map(r => ({ ...r, f: fl.f, tipo: r.tipo || tipoEspacio(r.name, r.zone) })));
const noHabitacional = r => r.tipo === 'local' || /comercial|oficina|consultorio/i.test(r.name);

/** Cisterna, tinaco y bomba según ocupantes y dotación. */
export function aguaMX(M, reserva = 3, dotFija = 0) {
  const E = espacios(M);
  const viviendas = Math.max(1, E.filter(r => r.tipo === 'cocina').length);
  const recamaras = E.filter(r => r.tipo === 'alcoba' || r.tipo === 'alcobaP').length;
  const areaHab = E.filter(r => !noHabitacional(r)).reduce((t, r) => t + r.area, 0);
  const ocupantes = 2 * recamaras + viviendas;
  const dotacion = +dotFija > 0 ? Math.round(+dotFija) : areaHab / viviendas <= 100 ? 150 : 200;
  const diario = ocupantes * dotacion;
  const dias = Math.min(7, Math.max(1, Math.round(+reserva || 3)));
  // una cisterna común; cada vivienda con su tinaco (uno o dos por vivienda)
  const cis = piezasAgua(diario * dias, CISTERNAS, 1), t1 = piezasAgua(diario / viviendas, TINACOS, 2);
  const tin = { n: t1.n * viviendas, cap: t1.cap, total: t1.total * viviendas, porVivienda: t1 };
  const bomba = M.F <= 2 ? 0.5 : M.F <= 4 ? 1 : 1.5;
  return { viviendas, recamaras, ocupantes, dotacion, diario, dias, reserva: diario * dias, cisterna: cis.total, cisternaPzas: cis, tinaco: tin.total, tinacoPzas: tin, bomba };
}

/** Modalidad del trámite y quién firma. */
export function tramiteMX(M, mx = {}) {
  const E = espacios(M);
  const noHab = E.filter(noHabitacional).reduce((t, r) => t + r.area, 0);
  const total = E.reduce((t, r) => t + r.area, 0) || 1;
  const viviendas = Math.max(1, E.filter(r => r.tipo === 'cocina').length);
  const altura = r2(M.F * M.fh);
  const claro = claroMX(M);
  const frente = r2(M.sides[M.frente]?.L || 0);
  const cdmx = (mx.entidad || 'cdmx') === 'cdmx';
  const motivos = [];
  const fuera = (cond, t, v) => { if (cond) motivos.push(tr(t, v)); };
  fuera(M.built > 120, { es: '{a} m² construidos (el tipo A llega a 120 m²)', en: '{a} m² built (type A allows 120 m²)' }, { a: Math.round(M.built) });
  fuera(M.F > 2, { es: '{F} niveles (el tipo A llega a 2)', en: '{F} storeys (type A allows 2)' }, { F: M.F });
  fuera(altura > 5.5, { es: '{h} m de altura (el tipo A llega a 5.5 m)', en: '{h} m high (type A allows 5.5 m)' }, { h: altura });
  fuera(claro > 4, { es: 'claro de {c} m (el tipo A llega a 4 m)', en: '{c} m span (type A allows 4 m)' }, { c: claro });
  fuera(frente < 6, { es: 'frente de {fr} m (el tipo A pide 6 m o más)', en: '{fr} m frontage (type A needs 6 m)' }, { fr: frente });
  fuera(!!mx.riesgo, { es: 'predio en zona de riesgo', en: 'lot in a risk zone' });
  fuera(noHab > 0, { es: 'tiene uso no habitacional', en: 'has non-residential use' });
  fuera(viviendas > 1, { es: '{v} viviendas (el tipo A es una sola)', en: '{v} dwellings (type A is one)' }, { v: viviendas });
  let modalidad = 'licencia';
  if (cdmx) modalidad = !motivos.length ? 'A' : (noHab > 0 ? M.built <= 5000 : M.built <= 10000) ? 'B' : 'C';
  // Corresponsable en Seguridad Estructural: estructuras del subgrupo B1
  // (más de 30 m o 6.000 m²; en zona de lago, más de 15 m o 3.000 m²).
  const lago = mx.zona === 'III';
  const cse = lago ? altura > 15 || M.built > 3000 : altura > 30 || M.built > 6000;
  const dro = cdmx ? modalidad !== 'A' : M.built > 50;
  return { cdmx, modalidad, motivos, dro, cse, altura, claro, frente, noHab: r2(noHab / total), viviendas };
}

/** Revisión de la mampostería confinada (NTC) para el predimensionamiento. */
export function revisionMX(M, losa, sep) {
  const { F, R, floors } = M;
  const out = [];
  const largo = Math.max(R.w, R.h), ancho = Math.min(R.w, R.h);
  const nCast = (M.castillos || []).map(c => c.length);
  if (M.sistema === 'confinada') {
    out.push({ ok: true, info: true, t: tr({ es: 'Castillos en extremos, intersecciones y a no más de {s} m (el menor de 4 m y 1.5 H): {n} en planta baja.', en: 'Tie columns at ends, intersections and every {s} m at most (lesser of 4 m and 1.5 H): {n} on the ground floor.' }, { s: sep, n: nCast[0] || 0 }) });
    out.push({ ok: true, info: true, t: tr({ es: 'Dala de desplante bajo todos los muros y dala de cerramiento en cada nivel.', en: 'Grade beam under every wall and bond beam at each level.' }) });
    out.push({ ok: F <= 3, t: F <= 3 ? tr({ es: '{F} niveles en mampostería confinada.', en: '{F} storeys of confined masonry.' }, { F }) : tr({ es: '{F} niveles: la mampostería pide diseño estructural detallado; compara con marcos de concreto.', en: '{F} storeys: masonry needs a detailed structural design; compare with concrete frames.' }, { F }) });
  }
  out.push({ ok: largo <= 2.5 * ancho + 1e-9, t: tr({ es: 'Planta de {l} × {a} m: el largo no pasa de 2.5 veces el ancho (condición de regularidad de las NTC de sismo).', en: 'Plan {l} × {a} m: length within 2.5 × width (seismic regularity condition).' }, { l: r2(largo), a: r2(ancho) }) });
  floors.forEach(fl => {
    let mx = 0, my = 0, Lt = 0;
    fl.lines.forEach(l => {
      const len = l.b - l.a, cx = l.o === 'H' ? (l.a + l.b) / 2 : l.c, cy = l.o === 'H' ? l.c : (l.a + l.b) / 2;
      mx += cx * len; my += cy * len; Lt += len;
    });
    const ex = Math.abs(mx / Lt - (R.x0 + R.x1) / 2) / R.w, ey = Math.abs(my / Lt - (R.y0 + R.y1) / 2) / R.h;
    out.push({ ok: ex <= 0.1 && ey <= 0.1, t: tr({ es: 'Nivel {f}: el centro de los muros queda a {ex} % y {ey} % del centro de la planta (criterio de Axiona: menos de 10 %).', en: 'Level {f}: wall centroid at {ex} % and {ey} % from the plan centre (Axiona criterion: under 10 %).' }, { f: fl.f + 1, ex: Math.round(ex * 100), ey: Math.round(ey * 100) }) });
  });
  for (let f = 1; f < F && M.sistema === 'confinada'; f++) {
    const abajo = { H: {}, V: {} };
    floors[f - 1].lines.forEach(l => { (abajo[l.o][l.c.toFixed(2)] ||= []).push([l.a, l.b]); });
    let total = 0, apoyado = 0;
    const sueltos = [];
    floors[f].lines.forEach(l => {
      const base = ivUnion(abajo[l.o][l.c.toFixed(2)] || []);
      total += l.b - l.a;
      base.forEach(([a, b]) => { apoyado += Math.max(0, Math.min(b, l.b) - Math.max(a, l.a)); });
      ivSubtract([[l.a, l.b]], base).forEach(([a, b]) => { if (b - a > 0.3) sueltos.push({ l: { ...l, a, b }, len: b - a }); });
    });
    const pct = total ? Math.min(100, Math.round(apoyado / total * 100)) : 100;
    const peores = sueltos.sort((x, y) => y.len - x.len).slice(0, 3).map(x => `${ubicMuro(M, floors[f], x.l)} ${r2(x.len)} m`).join('; ');
    out.push({ ok: pct >= 90, t: pct >= 90
      ? tr({ es: 'El {p} % de los muros del nivel {f} cae sobre muros del nivel de abajo.', en: '{p} % of level {f} walls sit on walls below.' }, { p: pct, f: f + 1 })
      : tr({ es: 'Solo el {p} % de los muros del nivel {f} cae sobre muros de abajo (se busca 90 % o más). Sin apoyo: {s}. Alinéalos o apóyalos en trabes.', en: 'Only {p} % of level {f} walls sit on walls below (aim for 90 %+). Unsupported: {s}. Align them or carry them on beams.' }, { p: pct, f: f + 1, s: peores }) });
  }
  if (losa.ok && M.slab + 0.005 < losa.h) out.push({ ok: false, t: tr({ es: 'La losa {t} mide {h} m y en Programa la losa es de {s} m: súbela para que alturas y cortes cuadren.', en: 'The {t} slab is {h} m deep but the Program slab is {s} m: raise it so heights and sections match.' }, { t: losa.tipo, h: losa.h.toFixed(2), s: M.slab.toFixed(2) }) });
  out.push({ ok: losa.ok, info: losa.ok, t: losa.ok ? tr({ es: 'Losa de vigueta y bovedilla {t} para el claro mayor de {c} m (referencia; mandan las tablas del fabricante).', en: 'Joist-and-block slab {t} for the largest {c} m span (reference; the maker’s tables govern).' }, { t: losa.tipo, c: losa.claro }) : tr({ es: 'Claro de {c} m: más de lo usual en vigueta y bovedilla; losa maciza o diseño especial.', en: '{c} m span: beyond usual joist-and-block; solid slab or special design.' }, { c: losa.claro }) });
  return out;
}

/** Factor de salario real con su desglose (Ley Federal del Trabajo, 2026). */
export const FSR_BASE = { salario: 315.04, aguinaldo: 15, vacaciones: 12, primaVac: 0.25, domingos: 52, festivos: 7, clima: 5, cargas: 0.30 };
export function fsr(p = {}) {
  const v = { ...FSR_BASE, ...p };
  const Tp = 365 + v.aguinaldo + v.vacaciones * v.primaVac;
  const Tl = 365 - v.domingos - v.vacaciones - v.festivos - v.clima;
  const factor = Tp / Tl * (1 + v.cargas);
  return { ...v, Tp: r2(Tp), Tl, factor: Math.round(factor * 1000) / 1000, salarioReal: r2(v.salario * factor) };
}

/** Todo lo de México que el resto de la app muestra. */
export function analizarMexico(M, S) {
  const mx = S.mx || {};
  const claro = claroMX(M);
  const losa = { ...losaVB(claro), claro };
  const sep = sepCastillos(M.fh, M.slab);
  const tramite = tramiteMX(M, mx);
  const cim = M.sistema === 'porticos' ? null : cimMX(M);
  return { tramite, losa, sep, cim, agua: aguaMX(M, mx.reserva, mx.dotacion), revision: revisionMX(M, losa, sep), noHab: tramite.noHab, fsr: fsr({ salario: +mx.salario > 0 ? +mx.salario : FSR_BASE.salario }) };
}

/* --------------------------------------------------------------------------
   Números generadores y catálogo de conceptos
   -------------------------------------------------------------------------- */

const letra = i => String.fromCharCode(65 + i);
function ejeCercano(ejes, v, tol = 0.2) {
  let best = -1, d = tol;
  ejes.forEach((x, i) => { const e = Math.abs(x - v); if (e <= d) { d = e; best = i; } });
  return best;
}
const pisoTxt = f => tr({ es: 'Nivel {f}', en: 'Level {f}' }, { f: f + 1 });

/**
 * Ubicación de un muro por ejes, como en los generadores: «Nivel 1 · Eje 2
 * (A–C)». Si el muro no cae en un eje: «entre ejes 2 y 3»; un extremo fuera
 * de eje se mide desde el eje anterior: «B+1.20».
 */
function ubicMuro(M, fl, l) {
  const eti = (i, conLetra) => (conLetra ? letra(i) : String(i + 1));
  const punto = (ejes, v, conLetra) => {
    const i = ejeCercano(ejes, v);
    if (i >= 0) return eti(i, conLetra);
    const k = Math.max(0, ejes.filter(x => x < v).length - 1);
    return `${eti(k, conLetra)}${v >= ejes[k] ? '+' : '−'}${Math.abs(v - ejes[k]).toFixed(2)}`;
  };
  const ejes = l.o === 'H' ? M.axY : M.axX, conLetra = l.o !== 'H';
  const i = ejeCercano(ejes, l.c);
  const k = Math.max(0, ejes.filter(x => x < l.c).length - 1);
  const sobre = i >= 0 ? `${tr({ es: 'Eje', en: 'Grid' })} ${eti(i, conLetra)}` : tr({ es: 'Entre ejes {a} y {b}', en: 'Between grids {a} and {b}' }, { a: eti(k, conLetra), b: eti(Math.min(k + 1, ejes.length - 1), conLetra) });
  const otros = l.o === 'H' ? M.axX : M.axY;
  return `${pisoTxt(fl.f)} · ${sobre} (${punto(otros, l.a, !conLetra)}–${punto(otros, l.b, !conLetra)})`;
}

const vanosDe = (fl, l) => fl.ops.filter(o => o.kind !== 'asc' && o.o === l.o && Math.abs(o.c - l.c) < 0.02 && o.a >= l.a - 0.02 && o.b <= l.b + 0.02);

/**
 * Conceptos con su generador. Cada concepto: clave, precio (k), categoría,
 * capítulo, unidad, descripción y filas { ubic, largo, ancho, alto, piezas,
 * menos, cant }. La cantidad del presupuesto es la suma de sus filas.
 */
export function generadoresMX(M, Q, S, pisoDe) {
  const hw = r2(M.fh - M.slab);
  const out = [];
  const cap = {
    pre: { es: 'Preliminares', en: 'Preliminaries' }, cim: { es: 'Cimentación', en: 'Foundation' }, est: { es: 'Estructura', en: 'Structure' },
    alb: { es: 'Albañilería', en: 'Masonry' }, azo: { es: 'Azotea', en: 'Roof' }, apl: { es: 'Aplanados y yesos', en: 'Plaster' },
    pin: { es: 'Pintura', en: 'Paint' }, pis: { es: 'Pisos y lambrines', en: 'Floors and wall tiling' }, can: { es: 'Cancelería y carpintería', en: 'Windows and doors' },
    ihs: { es: 'Instalación hidrosanitaria y gas', en: 'Plumbing and gas' }, ie: { es: 'Instalación eléctrica', en: 'Electrical' },
    agua: { es: 'Almacenamiento de agua', en: 'Water storage' }, coc: { es: 'Cocina y clósets', en: 'Kitchen and closets' }, mov: { es: 'Circulación vertical', en: 'Vertical circulation' }, lim: { es: 'Limpieza', en: 'Cleaning' },
  };
  const C = (clave, cat, capK, k, und, desc) => { const c = { clave, cat, cap: tr(cap[capK]), k, und, desc: tr(desc), filas: [] }; out.push(c); return c; };
  const fila = (c, ubic, o) => { c.filas.push({ ubic, largo: o.largo ?? null, ancho: o.ancho ?? null, alto: o.alto ?? null, piezas: o.piezas ?? null, menos: o.menos ?? null, cant: Math.max(0, o.cant) }); };
  const lineas = fl => fl.lines.map(l => ({ l, len: l.b - l.a }));
  const pb = M.floors[0];
  const conf = M.sistema !== 'porticos';

  // preliminares
  const trazo = C('PRE-01', 'negra', 'pre', 'trazo', 'm²', { es: 'Trazo y nivelación del terreno con equipo topográfico', en: 'Setting out and levelling' });
  fila(trazo, tr({ es: 'Huella de la construcción', en: 'Building footprint' }), { largo: M.R.w, ancho: M.R.h, cant: M.R.area });

  // cimentación
  const desp = M.desp;
  if (conf) {
    const { B, hz, zanja } = M.mx?.cim || cimMX(M);
    const exc = C('CIM-01', 'negra', 'cim', 'exc', 'm³', { es: `Excavación en cepa a mano, ancho ${zanja.toFixed(2)} m, profundidad ${desp.toFixed(2)} m`, en: `Hand trench excavation ${zanja.toFixed(2)} m wide, ${desp.toFixed(2)} m deep` });
    const plan = C('CIM-02', 'negra', 'cim', 'plantilla', 'm²', { es: "Plantilla de concreto pobre f'c = 100 kg/cm² de 5 cm", en: 'Blinding concrete 5 cm' });
    const zap = C('CIM-03', 'negra', 'cim', 'zapC', 'm³', { es: `Zapata corrida de concreto armado f'c = 200 kg/cm², B = ${B.toFixed(2)} m, h = ${hz.toFixed(2)} m, con acero y cimbra`, en: `Reinforced strip footing B = ${B.toFixed(2)} m, h = ${hz.toFixed(2)} m` });
    const dala = C('CIM-04', 'negra', 'cim', 'dalaD', 'ml', { es: 'Dala de desplante de 15 × 20 cm armada con 4 varillas de 3/8" y estribos', en: 'Grade beam 15 × 20 cm' });
    const rel = C('CIM-05', 'negra', 'cim', 'rel', 'm³', { es: 'Relleno compactado en capas de 20 cm con material de banco', en: 'Compacted fill in 20 cm layers' });
    const he = r2(Math.max(0, desp - hz - 0.2));
    const enr = C('CIM-07', 'negra', 'cim', 'enrase', 'm²', { es: `Muro de enrase de block de 15 cm relleno de concreto, h = ${he.toFixed(2)} m`, en: `15 cm concrete-filled block stem wall, h = ${he.toFixed(2)} m` });
    lineas(pb).forEach(({ l, len }) => {
      const u = ubicMuro(M, pb, l);
      fila(exc, u, { largo: len, ancho: zanja, alto: desp, cant: len * zanja * desp });
      fila(plan, u, { largo: len, ancho: B, cant: len * B });
      fila(zap, u, { largo: len, ancho: B, alto: hz, cant: len * B * hz });
      if (he > 0) fila(enr, u, { largo: len, alto: he, cant: len * he });
      fila(dala, u, { largo: len, cant: len });
      // la zanja menos zapata, plantilla y el muro de 15 cm (enrase y dala) que sube hasta el piso
      fila(rel, u, { largo: len, cant: len * (zanja * desp - B * hz - B * 0.05 - 0.15 * (desp - hz)) });
    });
  } else {
    const exc = C('CIM-01', 'negra', 'cim', 'exc', 'm³', { es: `Excavación a mano para zapatas aisladas, profundidad ${desp.toFixed(2)} m`, en: `Hand excavation for pad footings, ${desp.toFixed(2)} m deep` });
    const zap = C('CIM-03', 'negra', 'cim', 'zapA', 'm³', { es: "Zapata aislada de concreto armado f'c = 250 kg/cm², con acero y cimbra", en: 'Reinforced pad footing' });
    const ct = C('CIM-04', 'negra', 'cim', 'trabe', 'm³', { es: 'Contratrabe de 25 × 50 cm de concreto armado', en: 'Grade beam 25 × 50 cm' });
    const rel = C('CIM-05', 'negra', 'cim', 'rel', 'm³', { es: 'Relleno compactado con material de banco', en: 'Compacted fill' });
    M.cols.forEach(c => {
      const u = `${tr({ es: 'Eje', en: 'Grid' })} ${c.id} · ${c.type}`;
      const e = (c.B + 0.2) ** 2 * desp;
      fila(exc, u, { largo: c.B + 0.2, ancho: c.B + 0.2, alto: desp, cant: e });
      fila(zap, u, { largo: c.B, ancho: c.B, alto: c.h, cant: c.B * c.B * c.h });
      fila(rel, u, { cant: e - c.B * c.B * c.h - M.colB * M.colB * (desp - c.h) });
    });
    M.beams.forEach(b => fila(ct, `${tr({ es: 'Eje', en: 'Grid' })} ${b.o === 'H' ? (ejeCercano(M.axY, b.c) + 1) : letra(Math.max(0, ejeCercano(M.axX, b.c)))}`, { largo: b.b - b.a, ancho: 0.25, alto: 0.5, cant: (b.b - b.a) * 0.25 * 0.5 }));
  }
  const sumaC = cl => out.filter(c => c.clave === cl).reduce((t, c) => t + c.filas.reduce((s, x) => s + x.cant, 0), 0);
  const sobra = Math.max(0, sumaC('CIM-01') - sumaC('CIM-05'));
  if (sobra > 0) {
    const aca = C('CIM-08', 'negra', 'cim', 'acarreo', 'm³', { es: 'Acarreo en camión fuera de la obra del material sobrante, con abundamiento de 30 %', en: 'Haul-off of surplus excavated material, 30 % bulking' });
    fila(aca, tr({ es: 'Excavación (CIM-01) menos relleno (CIM-05), × 1.30', en: 'Excavation (CIM-01) minus fill (CIM-05), × 1.30' }), { cant: sobra * 1.3 });
  }
  const firme = C('CIM-06', 'negra', 'cim', 'firme', 'm²', { es: 'Firme de concreto de 8 cm con malla electrosoldada 6-6/10-10', en: 'Slab on grade 8 cm with welded mesh' });
  pb.rects.forEach(r => fila(firme, `${pisoTxt(0)} · ${r.name}`, { largo: r.w, ancho: r.h, cant: r.w * r.h }));

  // estructura
  if (conf) {
    const cas = C('EST-01', 'negra', 'est', 'castillo', 'ml', { es: 'Castillo de 15 × 15 cm armado con armex 15-15-4, concreto 200 kg/cm²', en: 'Tie column 15 × 15 cm with prefab cage' });
    (M.castillos || []).forEach((lista, f) => fila(cas, pisoTxt(f), { piezas: lista.length, alto: hw, cant: lista.length * hw }));
    const dc = C('EST-02', 'negra', 'est', 'dalaC', 'ml', { es: 'Dala de cerramiento de 15 × 20 cm armada, concreto 200 kg/cm²', en: 'Bond beam 15 × 20 cm' });
    M.floors.forEach(fl => lineas(fl).forEach(({ l, len }) => fila(dc, ubicMuro(M, fl, l), { largo: len, cant: len })));
  } else {
    const col = C('EST-01', 'negra', 'est', 'columna', 'm³', { es: `Columna de concreto armado ${Math.round(M.colB * 100)} × ${Math.round(M.colB * 100)} cm, f'c = 250 kg/cm²`, en: `Reinforced column ${Math.round(M.colB * 100)} cm` });
    const tr2 = C('EST-02', 'negra', 'est', 'trabe', 'm³', { es: 'Trabe de concreto armado de 20 × 40 cm', en: 'Reinforced beam 20 × 40 cm' });
    M.floors.forEach(fl => {
      M.cols.filter(c => fl.f < (c.n ?? M.F)).forEach(c => fila(col, `${pisoTxt(fl.f)} · ${tr({ es: 'Eje', en: 'Grid' })} ${c.id}`, { largo: M.colB, ancho: M.colB, alto: M.fh, cant: M.colB * M.colB * M.fh }));
      (M.vigas?.[fl.f] || M.beams).forEach(b => fila(tr2, `${pisoTxt(fl.f)} · ${b.o === 'H' ? 'y' : 'x'} = ${b.c.toFixed(2)}`, { largo: b.b - b.a, ancho: 0.2, alto: 0.4, cant: (b.b - b.a) * 0.2 * 0.4 }));
    });
  }
  const losa = M.mx?.losa || { ...losaVB(4), claro: 4 };
  const lo = C('EST-03', 'negra', 'est', losa.k, 'm²', losa.k === 'losaMac'
    ? { es: "Losa maciza de concreto armado de 15 cm, f'c = 250 kg/cm²", en: 'Solid reinforced slab 15 cm' }
    : { es: `Losa de vigueta y bovedilla ${losa.tipo} con capa de compresión, malla y cimbra`, en: `Joist-and-block slab ${losa.tipo} with topping, mesh and shoring` });
  const hueco = M.stair ? (M.stair.x1 - M.stair.x0) * (M.stair.y1 - M.stair.y0) : 0;
  for (let f = 1; f <= M.F; f++) {
    const Rf = M.floors[f - 1].R || M.R, a = f < M.F ? Rf.area - hueco : Rf.area;
    fila(lo, f < M.F ? tr({ es: 'Entrepiso sobre el nivel {f} (sin hueco de escalera)', en: 'Floor over level {f} (minus stair opening)' }, { f }) : tr({ es: 'Losa de azotea', en: 'Roof slab' }), { largo: Rf.w, ancho: Rf.h, menos: f < M.F ? r2(hueco) : null, cant: a });
  }
  (M.balcones || []).forEach(b => fila(lo, `${pisoTxt(b.f)} · ${tr({ es: 'Balcón de {r}', en: '{r} balcony' }, { r: b.room })}`, { largo: r2(b.x1 - b.x0), ancho: 1.2, cant: b.area }));
  if (M.stair && M.F > 1) {
    const esc = C('EST-04', 'negra', 'est', 'escalera', 'tramo', { es: 'Escalera de concreto armado con escalones forjados', en: 'Reinforced concrete stair flight' });
    fila(esc, tr({ es: 'Entre niveles', en: 'Between levels' }), { piezas: M.F - 1, cant: M.F - 1 });
  }

  // albañilería: muro de block por tramo, descontando vanos
  const muro = C('ALB-01', 'negra', 'alb', 'block', 'm²', { es: 'Muro de block hueco de 15 × 20 × 40 cm junteado con mortero cemento-arena 1:5', en: 'Hollow concrete block wall 15 × 20 × 40' });
  const aplE = C('APL-01', 'gris', 'apl', 'aplExt', 'm²', { es: 'Aplanado de mortero cemento-arena 1:4 en muros exteriores, acabado fino', en: 'Exterior cement plaster' });
  const yesoM = C('APL-02', 'gris', 'apl', 'yesoMuro', 'm²', { es: 'Aplanado de yeso a regla en muros interiores', en: 'Interior gypsum plaster on walls' });
  const yesoP = C('APL-03', 'gris', 'apl', 'yesoPlaf', 'm²', { es: 'Aplanado de yeso en plafón', en: 'Gypsum plaster on ceilings' });
  M.floors.forEach(fl => lineas(fl).forEach(({ l, len }) => {
    const u = ubicMuro(M, fl, l);
    const vanos = vanosDe(fl, l).reduce((t, o) => t + o.w * o.h, 0);
    const neto = len * hw - vanos;
    fila(muro, u, { largo: len, alto: hw, menos: vanos ? r2(vanos) : null, cant: neto });
    if (l.ext) {
      fila(aplE, u, { largo: len, alto: hw, menos: vanos ? r2(vanos) : null, cant: neto });
      fila(yesoM, u, { largo: len, alto: hw, piezas: 1, menos: vanos ? r2(vanos) : null, cant: neto });
    } else fila(yesoM, u, { largo: len, alto: hw, piezas: 2, menos: vanos ? r2(2 * vanos) : null, cant: 2 * neto });
  }));
  M.floors.forEach(fl => fl.rects.filter(r => !r.stair && !r.asc).forEach(r => fila(yesoP, `${pisoTxt(fl.f)} · ${r.name}`, { largo: r.w, ancho: r.h, cant: r.w * r.h })));

  // azotea
  const T = M.techo, Rt = M.Rtop || M.R;
  if (T.tipo === 'plana') {
    const pre = C('AZO-01', 'negra', 'azo', 'pretil', 'ml', { es: 'Pretil de block de 60 cm con castillos y dala de remate', en: '60 cm block parapet' });
    fila(pre, tr({ es: 'Perímetro de azotea', en: 'Roof perimeter' }), { largo: 2 * (Rt.w + Rt.h), cant: 2 * (Rt.w + Rt.h) });
    const imp = C('AZO-02', 'negra', 'azo', 'imperm', 'm²', { es: 'Impermeabilización de azotea con entortado, chaflanes y sistema prefabricado', en: 'Roof waterproofing' });
    fila(imp, tr({ es: 'Losa de azotea', en: 'Roof slab' }), { largo: Rt.w, ancho: Rt.h, cant: Rt.area });
    const nb = Math.max(2, Math.ceil(Rt.area / 80 - 1e-9));
    const baj = C('AZO-03', 'negra', 'azo', 'bajada', 'pza', { es: 'Bajada pluvial de PVC de 4" con coladera de azotea', en: '4" PVC downpipe with roof drain' });
    fila(baj, tr({ es: 'Una por cada 80 m² de azotea, mínimo 2', en: 'One per 80 m² of roof, at least 2' }), { piezas: nb, cant: nb });
  } else {
    const cub = C('AZO-01', 'negra', 'azo', 'cubInc', 'm²', { es: `Cubierta inclinada al ${T.pend} % con estructura y teja`, en: `Pitched roof ${T.pend} %` });
    fila(cub, tr({ es: 'Faldones', en: 'Roof planes' }), { cant: T.area });
    const can = C('AZO-02', 'negra', 'azo', 'canal', 'ml', { es: 'Canalón y bajadas pluviales', en: 'Gutters and downspouts' });
    fila(can, tr({ es: 'Aleros', en: 'Eaves' }), { cant: T.canal });
  }
  // terrazas que dejan los pisos escalonados y balcones: impermeabilización, piso exterior y barandal
  const exteriores = [
    ...(M.terrazas || []).map(t => ({ u: `${pisoTxt(t.f)} · ${tr({ es: 'Terraza', en: 'Terrace' })}`, x: t })),
    ...(M.balcones || []).map(b => ({ u: `${pisoTxt(b.f)} · ${tr({ es: 'Balcón de {r}', en: '{r} balcony' }, { r: b.room })}`, x: b })),
  ];
  if (exteriores.length) {
    const impT = C('AZO-04', 'negra', 'azo', 'imperm', 'm²', { es: 'Impermeabilización de terrazas y balcones con chaflanes y pendiente al desagüe', en: 'Terrace and balcony waterproofing' });
    const barT = C('CAN-07', 'blanca', 'can', 'barandal', 'ml', { es: 'Barandal de herrería de 1.00 m en terrazas y balcones, con pintura de esmalte', en: '1.00 m steel railing on terraces and balconies' });
    exteriores.forEach(({ u, x }) => { fila(impT, u, { cant: x.area }); if (x.L) fila(barT, u, { largo: x.L, cant: x.L }); });
  }

  // pintura (sobre los aplanados medidos arriba)
  const suma = c => c.filas.reduce((t, x) => t + x.cant, 0);
  const pinI = C('PIN-01', 'blanca', 'pin', 'pintInt', 'm²', { es: 'Pintura vinílica en muros y plafones interiores, dos manos con sellador', en: 'Interior vinyl paint, two coats' });
  fila(pinI, tr({ es: 'Muros interiores (APL-02)', en: 'Interior walls (APL-02)' }), { cant: suma(yesoM) });
  fila(pinI, tr({ es: 'Plafones (APL-03)', en: 'Ceilings (APL-03)' }), { cant: suma(yesoP) });
  const pinE = C('PIN-02', 'blanca', 'pin', 'pintExt', 'm²', { es: 'Pintura vinílica para exteriores, dos manos', en: 'Exterior paint, two coats' });
  fila(pinE, tr({ es: 'Fachadas (APL-01)', en: 'Facades (APL-01)' }), { cant: suma(aplE) });

  // pisos: un concepto por acabado, una fila por espacio
  const porPiso = {};
  M.floors.forEach(fl => fl.rects.filter(r => !r.stair && !r.asc).forEach(r => { (porPiso[pisoDe(r, fl.f, S)] ||= []).push({ r, f: fl.f }); }));
  let np = 0;
  Object.entries(porPiso).sort((a, b) => b[1].reduce((t, x) => t + x.r.area, 0) - a[1].reduce((t, x) => t + x.r.area, 0)).forEach(([cod, lista]) => {
    const p = PISOS[cod] || PISOS.porc;
    const c = C(`PIS-${String(++np).padStart(2, '0')}`, 'blanca', 'pis', 'piso:' + cod, 'm²', { es: `${p.cod} · ${tr(p.n)}, asentado con pegazulejo`, en: `${p.cod} · ${tr(p.n)}` });
    c.precio = p.precio.MX;
    lista.forEach(({ r, f }) => fila(c, `${pisoTxt(f)} · ${r.name}`, { largo: r.w, ancho: r.h, cant: r.w * r.h }));
  });
  if (exteriores.length) {
    const ce = PISOS.ceram, c = C(`PIS-${String(++np).padStart(2, '0')}`, 'blanca', 'pis', 'piso:ceram', 'm²', { es: `${ce.cod} · ${tr(ce.n)} en terrazas y balcones, con pegazulejo para exterior`, en: `${ce.cod} · ${tr(ce.n)} on terraces and balconies` });
    c.precio = ce.precio.MX;
    exteriores.forEach(({ u, x }) => fila(c, u, { cant: x.area }));
  }
  const zoc = C(`PIS-${String(++np).padStart(2, '0')}`, 'blanca', 'pis', 'zoclo', 'ml', { es: 'Zoclo de 7 cm del mismo piso, asentado con pegazulejo', en: '7 cm skirting of the same tile' });
  M.floors.forEach(fl => fl.rects.filter(r => !r.stair && !r.asc && !/bano/.test(r.tipo || '')).forEach(r => fila(zoc, `${pisoTxt(fl.f)} · ${r.name}`, { largo: r2(2 * (r.w + r.h)), menos: 0.9, cant: 2 * (r.w + r.h) - 0.9 })));
  const lam = C(`PIS-${String(++np).padStart(2, '0')}`, 'blanca', 'pis', 'lambrin', 'm²', { es: 'Lambrín cerámico en baños (h = 2.00 m) y salpicadero de cocina', en: 'Bathroom wall tiling (2.00 m) and kitchen backsplash' });
  M.floors.forEach(fl => fl.rects.filter(r => /bano/.test(r.tipo || '')).forEach(r => fila(lam, `${pisoTxt(fl.f)} · ${r.name}`, { largo: r2(2 * (r.w + r.h)), alto: 2, cant: 2 * (r.w + r.h) * 2 })));
  (M.muebles || []).filter(m => m.tipo === 'cocinaBase').forEach(m => fila(lam, `${tr({ es: 'Cocina', en: 'Kitchen' })} · ${m.room || ''}`.trim(), { largo: m.w, alto: 0.6, cant: m.w * 0.6 }));

  // cancelería y carpintería
  const pta = C('CAN-01', 'blanca', 'can', 'puerta', 'pza', { es: 'Puerta de tambor de 0.90 × 2.10 m con marco y chapa', en: 'Interior hollow-core door with frame and lock' });
  const ptaP = C('CAN-02', 'blanca', 'can', 'puertaP', 'pza', { es: 'Puerta de acceso principal con chapa de seguridad', en: 'Main entrance door' });
  const ven = C('CAN-03', 'blanca', 'can', 'cancel', 'm²', { es: 'Cancelería de aluminio natural de 2" con vidrio de 6 mm', en: 'Aluminium windows with 6 mm glass' });
  M.floors.forEach(fl => {
    const n = fl.ops.filter(o => o.kind === 'door').length, m = fl.ops.filter(o => o.kind === 'main').length;
    if (n) fila(pta, pisoTxt(fl.f), { piezas: n, cant: n });
    if (m) fila(ptaP, pisoTxt(fl.f), { piezas: m, cant: m });
    fl.ops.filter(o => o.kind === 'win').forEach(o => fila(ven, `${pisoTxt(fl.f)} · ${o.room}`, { largo: o.w, alto: o.h, cant: o.w * o.h }));
  });
  const pro = C('CAN-06', 'blanca', 'can', 'proteccion', 'm²', { es: 'Protección de herrería en ventanas de planta baja', en: 'Steel security bars on ground-floor windows' });
  pb.ops.filter(o => o.kind === 'win').forEach(o => fila(pro, `${pisoTxt(0)} · ${o.room}`, { largo: o.w, alto: o.h, cant: o.w * o.h }));
  if (M.stair && M.F > 1) {
    const run = r2(Math.max(M.stair.x1 - M.stair.x0, M.stair.y1 - M.stair.y0));
    const bar = C('CAN-04', 'blanca', 'can', 'barandal', 'ml', { es: 'Barandal de herrería en escalera, con pintura de esmalte', en: 'Steel stair railing, enamel painted' });
    fila(bar, tr({ es: 'Escalera entre niveles', en: 'Stair between levels' }), { largo: run, piezas: M.F - 1, cant: run * (M.F - 1) });
  }
  const regaderas = M.floors.flatMap(fl => fl.rects.filter(r => r.tipo === 'bano' || r.tipo === 'banoP').map(r => ({ r, f: fl.f })));
  if (regaderas.length) {
    const cb = C('CAN-05', 'blanca', 'can', 'cancelBano', 'pza', { es: 'Cancel de baño de aluminio y vidrio templado de 6 mm', en: 'Shower screen, aluminium and 6 mm tempered glass' });
    regaderas.forEach(({ r, f }) => fila(cb, `${pisoTxt(f)} · ${r.name}`, { piezas: 1, cant: 1 }));
  }

  // instalaciones
  const ag = M.mx?.agua || aguaMX(M);
  const hid = C('IHS-01', 'inst', 'ihs', 'hidro', 'salida', { es: 'Salida hidrosanitaria con tubería de CPVC y PVC sanitario', en: 'Plumbing outlet (CPVC and PVC)' });
  fila(hid, tr({ es: 'Según el plano hidrosanitario', en: 'Per plumbing plan' }), { piezas: Q.hidro, cant: Q.hidro });
  const mue = C('IHS-02', 'inst', 'ihs', 'sanit', 'pza', { es: 'Mueble de baño (WC, lavabo o regadera) con llaves y accesorios', en: 'Plumbing fixture with fittings' });
  fila(mue, tr({ es: 'Baños y cocina', en: 'Baths and kitchen' }), { piezas: Q.aparatos, cant: Q.aparatos });
  const gas = C('IHS-03', 'inst', 'ihs', 'gas', 'salida', { es: 'Salida de gas en tubería de cobre para estufa y calentador', en: 'Gas outlet in copper pipe' });
  fila(gas, tr({ es: 'Estufa y calentador por vivienda', en: 'Range and water heater per dwelling' }), { piezas: 2 * ag.viviendas, cant: 2 * ag.viviendas });
  const cal = C('IHS-04', 'inst', 'ihs', 'calentador', 'pza', { es: 'Calentador de agua de paso o de depósito, instalado', en: 'Water heater, installed' });
  fila(cal, tr({ es: 'Uno por vivienda', en: 'One per dwelling' }), { piezas: ag.viviendas, cant: ag.viviendas });
  const tg = C('IHS-05', 'inst', 'ihs', 'tanqueGas', 'pza', { es: 'Tanque estacionario de gas LP de 300 L con regulador y válvulas', en: '300 L LPG tank with regulator and valves' });
  fila(tg, tr({ es: 'Uno por vivienda (o red de gas natural donde la haya)', en: 'One per dwelling (or natural gas where available)' }), { piezas: ag.viviendas, cant: ag.viviendas });
  const alb = r2(M.R.h + M.R.w / 2), nr = Math.max(2, Math.ceil(alb / 10 - 1e-9) + 1);
  const reg = C('IHS-06', 'inst', 'ihs', 'registro', 'pza', { es: 'Registro sanitario de 40 × 60 cm con tapa, en el albañal', en: '40 × 60 cm drain inspection chamber' });
  fila(reg, tr({ es: 'Albañal de {l} m: uno cada 10 m y en la salida a la calle', en: '{l} m house drain: one every 10 m and at the street' }, { l: alb }), { largo: alb, piezas: nr, cant: nr });
  const ele = C('IE-01', 'inst', 'ie', 'elec', 'salida', { es: 'Salida eléctrica (contacto, apagador o luminaria) con poliducto y cable calibre 12', en: 'Electrical outlet (socket, switch or light)' });
  fila(ele, tr({ es: 'Según el plano eléctrico', en: 'Per electrical plan' }), { piezas: Q.elec, cant: Q.elec });
  const cc = C('IE-02', 'inst', 'ie', 'tablero', 'pza', { es: 'Centro de carga con interruptores, acometida y tierra física', en: 'Load centre with breakers, service entrance and grounding' });
  fila(cc, tr({ es: 'Uno por vivienda', en: 'One per dwelling' }), { piezas: ag.viviendas, cant: ag.viviendas });
  const pz = p => (p.n > 1 ? `${p.n} × ${p.cap.toLocaleString('es-MX')} L` : `${p.cap.toLocaleString('es-MX')} L`);
  const cisP = ag.cisternaPzas || { n: 1, cap: ag.cisterna }, tinP = ag.tinacoPzas || { n: 1, cap: ag.tinaco };
  const cis = C('AGU-01', 'inst', 'agua', 'cisterna', 'L', { es: `Cisterna de ${pz(cisP)} instalada, con tapa y conexiones`, en: `Cistern ${pz(cisP)} installed` });
  fila(cis, tr({ es: '{o} ocupantes × {d} L/día × {r} días de reserva = {l} L', en: '{o} occupants × {d} L/day × {r} days of reserve = {l} L' }, { o: ag.ocupantes, d: ag.dotacion, r: ag.dias, l: ag.diario * ag.dias }), { piezas: cisP.n, cant: ag.cisterna });
  const tin = C('AGU-02', 'inst', 'agua', 'tinaco', 'L', { es: `Tinaco de ${pz(tinP)} en azotea, con base y flotador`, en: `Roof tank ${pz(tinP)}` });
  fila(tin, ag.viviendas > 1
    ? tr({ es: 'Un día de consumo por vivienda: {v} × {l} L', en: 'One day of use per dwelling: {v} × {l} L' }, { v: ag.viviendas, l: Math.round(ag.diario / ag.viviendas) })
    : tr({ es: 'Un día de consumo ({l} L)', en: 'One day of use ({l} L)' }, { l: ag.diario }), { piezas: tinP.n, cant: ag.tinaco });
  const bom = C('AGU-03', 'inst', 'agua', 'bomba', 'pza', { es: `Bomba de ${ag.bomba} HP de cisterna a tinaco, con control de nivel`, en: `${ag.bomba} HP pump, cistern to tank` });
  fila(bom, tr({ es: 'Cuarto de máquinas o junto a la cisterna', en: 'Next to the cistern' }), { piezas: 1, cant: 1 });

  // cocina, clósets, elevador y limpieza
  if (Q.cocinaML) { const c = C('COC-01', 'blanca', 'coc', 'cocina', 'ml', { es: 'Cocina integral con cubierta', en: 'Kitchen cabinets with countertop' }); fila(c, tr({ es: 'Cocinas', en: 'Kitchens' }), { cant: Q.cocinaML }); }
  if (Q.closetML) { const c = C('COC-02', 'blanca', 'coc', 'closet', 'ml', { es: 'Clóset de madera con puertas', en: 'Wooden closets' }); fila(c, tr({ es: 'Recámaras', en: 'Bedrooms' }), { cant: Q.closetML }); }
  if (Q.paradas) { const c = C('MOV-01', 'inst', 'mov', 'ascensor', 'pza', { es: `Elevador de ${Q.paradas} paradas`, en: `${Q.paradas}-stop elevator` }); fila(c, tr({ es: 'Cubo de elevador', en: 'Elevator shaft' }), { piezas: 1, cant: 1 }); }
  const lim = C('LIM-01', 'blanca', 'lim', 'limpieza', 'm²', { es: 'Limpieza final y retiro de escombro', en: 'Final cleaning and debris removal' });
  fila(lim, tr({ es: 'Área construida', en: 'Built area' }), { cant: M.built });

  out.forEach(c => { c.q = c.filas.reduce((t, x) => t + x.cant, 0); });
  // capítulos en el orden de la obra y, dentro de cada uno, por clave
  const cap0 = c => c.clave.split('-')[0], orden = [...new Set(out.map(cap0))];
  return out.filter(c => c.q > 0).sort((a, b) => orden.indexOf(cap0(a)) - orden.indexOf(cap0(b)) || a.clave.localeCompare(b.clave, 'es', { numeric: true }));
}

/** Partidas del presupuesto a partir de los generadores. */
export function partidasMX(M, Q, S, pisoDe) {
  const gen = generadoresMX(M, Q, S, pisoDe);
  const items = gen.map(c => ({ cat: c.cat, cap: c.cap, k: c.k, q: c.q, und: c.und, item: `${c.clave} · ${c.desc}`, clave: c.clave, ...(c.precio != null ? { precio: c.precio } : {}) }));
  const q = cl => gen.find(c => c.clave === cl)?.q || 0;
  const conf = M.sistema !== 'porticos';
  const concFund = conf ? q('CIM-03') + q('CIM-04') * 0.15 * 0.2 + q('CIM-06') * 0.08 : q('CIM-03') + q('CIM-04') + q('CIM-06') * 0.08;
  const losa = gen.find(c => c.clave === 'EST-03');
  const concStr = (conf ? q('EST-01') * 0.15 * 0.15 + q('EST-02') * 0.15 * 0.2 : q('EST-01') + q('EST-02')) + (losa ? losa.q * (losa.k === 'losaMac' ? 0.15 : 0.06) : 0) + q('EST-04') * 1.9;
  return { items, gen, c: { concFund, concStr, excF: q('CIM-01') } };
}

/** Materiales principales para pedir en obra. */
export function materialesMX(gen, c) {
  const q = cl => gen.find(x => x.clave === cl)?.q || 0;
  const losa = gen.find(x => x.clave === 'EST-03');
  const conc = c.concFund + c.concStr;
  const block = q('ALB-01'), apl = q('APL-01') + q('APL-02');
  const vb = losa && losa.k !== 'losaMac' ? losa.q : 0;
  return {
    concreto: r2(conc),
    block: Math.ceil(block * 12.5),
    cemento: Math.ceil(conc * 7 + block * 0.17 + q('APL-01') * 0.2),
    arena: r2(conc * 0.5 + block * 0.02 + apl * 0.02),
    grava: r2(conc * 0.7),
    armex: Math.ceil((q('EST-01') + q('EST-02') + q('CIM-04')) / 6),
    vigueta: Math.ceil(vb / 0.7),
    bovedilla: Math.ceil(vb * 5),
  };
}
