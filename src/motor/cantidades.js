/* ==========================================================================
   AXIONA OBRA · Cantidades y presupuesto por pais y sistema constructivo
   --------------------------------------------------------------------------
   Primero se mide la casa (medir): muros, losas, cubierta, aberturas,
   pisos por acabado, puntos electricos e hidraulicos, muebles. Despues cada
   pais arma sus partidas con su sistema: porticos de concreto o mamposteria
   confinada en Colombia, hormigon y ladrillo en España, entramado de madera
   con sotano en Canada. Mexico arma su catalogo de conceptos con numeros
   generadores (mexico.js). Los factores (acero por m³, rendimientos) son de
   referencia para anteproyecto y se pueden cambiar en los precios.
   ========================================================================== */

import { r2, near } from './geometria.js';
import { tr } from './idioma.js';
import { pais as paisDe } from './paises.js';
import { PISOS, ESTILOS, MUEBLES, tipoEspacio } from './catalogo.js';
import { partidasMX, materialesMX } from './mexico.js';

export const CATS = ['negra', 'gris', 'blanca', 'inst', 'dot'];
const CAT_N = {
  CO: { negra: { es: 'Obra negra', en: 'Structure & shell' }, gris: { es: 'Obra gris', en: 'Rough finishes' }, blanca: { es: 'Obra blanca', en: 'Finishes' }, inst: { es: 'Instalaciones', en: 'MEP' }, dot: { es: 'Dotación y tecnología', en: 'Furniture & technology' } },
  ES: { negra: { es: 'Estructura y envolvente', en: 'Structure & envelope' }, gris: { es: 'Albañilería y revestimientos', en: 'Masonry & linings' }, blanca: { es: 'Acabados', en: 'Finishes' }, inst: { es: 'Instalaciones', en: 'Services' }, dot: { es: 'Equipamiento', en: 'Furniture & equipment' } },
  CA: { negra: { es: 'Cimentación y estructura', en: 'Foundation & framing' }, gris: { es: 'Envolvente', en: 'Building envelope' }, blanca: { es: 'Acabados', en: 'Finishes' }, inst: { es: 'Instalaciones', en: 'Mechanical & electrical' }, dot: { es: 'Muebles y tecnología', en: 'Furniture & technology' } },
  MX: { negra: { es: 'Obra negra', en: 'Structure & shell' }, gris: { es: 'Obra gris', en: 'Rough finishes' }, blanca: { es: 'Acabados', en: 'Finishes' }, inst: { es: 'Instalaciones', en: 'MEP' }, dot: { es: 'Equipamiento y tecnología', en: 'Furniture & technology' } },
};
const UND = { CA: 'ea', ES: 'ud', MX: 'pza' };
export const CATEGORIAS = new Proxy({}, { get: (_, k) => tr(CAT_N.CO[k] || { es: String(k) }) });
export const nombreCategoria = (pais, k) => tr((CAT_N[pais] || CAT_N.CO)[k] || { es: k });

/** Acabado de piso de un espacio: el que se escogio a mano o el del estilo. */
export function pisoDe(r, f, S) {
  const k = `${f + 1}:${r.name}`;
  if (S.acabados?.pisos?.[k]) return S.acabados.pisos[k];
  const E = ESTILOS[S.acabados?.estilo] || ESTILOS.moderno;
  const t = r.tipo || tipoEspacio(r.name, r.zone);
  if (/bano/.test(t)) return E.pisos.bano;
  if (t === 'local' || t === 'bodega') return E.pisos.local;
  if (r.circ) return E.pisos.circ;
  return E.pisos[r.zone] || E.pisos.social;
}

/** Medidas de la casa, comunes a todos los paises. */
export function medir(M, S) {
  const { R, F, fh, slab, floors } = M;
  const hw = fh - slab;
  const Q = { F, built: M.built ?? R.area * F, Rarea: R.area, perim: 2 * (R.w + R.h) };
  let Aext = 0, Aint = 0, Aops = 0, nDoor = 0, nMain = 0, Awin = 0, nWin = 0, Lext1 = 0, Lint1 = 0;
  const pisos = {};
  let Aench = 0, cielo = 0, Apiso = 0;
  floors.forEach(fl => {
    fl.lines.forEach(l => {
      const a = l.len * hw;
      if (l.ext) Aext += a; else Aint += a;
      if (fl.f === 0) { if (l.ext) Lext1 += l.len; else Lint1 += l.len; }
    });
    fl.ops.forEach(o => {
      if (o.kind === 'asc') return;
      Aops += o.w * o.h;
      if (o.kind === 'door') nDoor++;
      if (o.kind === 'main') nMain++;
      if (o.kind === 'win') { Awin += o.w * o.h; nWin++; }
    });
    fl.rects.forEach(r => {
      if (r.stair || r.asc) return;
      const cod = pisoDe(r, fl.f, S);
      pisos[cod] = (pisos[cod] || 0) + r.area;
      Apiso += r.area;
      cielo += r.area;
      if (/bano/.test(r.tipo || '')) Aench += 2 * (r.w + r.h) * 2.0;
    });
  });
  const opsRatio = Aops / Math.max(Aext + Aint, 1);
  Q.AextB = Aext; Q.AintB = Aint;
  Q.AextN = Aext * (1 - opsRatio); Q.AintN = Aint * (1 - opsRatio);
  Q.Lext1 = Lext1; Q.Lint1 = Lint1;
  Q.nDoor = nDoor; Q.nMain = nMain; Q.Awin = Awin; Q.nWin = nWin;
  // terrazas y balcones: piso exterior antideslizante, impermeabilización y baranda
  const exteriores = [...(M.terrazas || []), ...(M.balcones || [])];
  Q.terrazaA = r2(exteriores.reduce((t, x) => t + x.area, 0));
  Q.barandaL = r2(exteriores.reduce((t, x) => t + x.L, 0));
  if (Q.terrazaA > 0) pisos.ceram = (pisos.ceram || 0) + Q.terrazaA;
  Q.pisos = pisos; Q.Apiso = Apiso; Q.cielo = cielo;
  // muebles: cocina, closets y dotacion suelta
  const mu = M.muebles || [];
  Q.cocinaML = mu.filter(m => m.tipo === 'cocinaBase' || m.tipo === 'isla').reduce((t, m) => t + m.w, 0);
  Q.closetML = mu.filter(m => m.tipo === 'closet').reduce((t, m) => t + m.w, 0);
  mu.filter(m => m.tipo === 'cocinaBase').forEach(m => { Aench += m.w * 0.6; });
  Q.Aench = Aench;
  Q.aparatos = M.redes?.puntos.aparatos || 0;
  Q.hidro = M.redes?.puntos.hidro || 0;
  Q.elec = M.redes?.puntos.elec || 0;
  Q.humo = M.redes?.puntos.humo || 0;
  const E = ESTILOS[S.acabados?.estilo] || ESTILOS.moderno;
  const dot = {};
  if (S.amoblar) mu.forEach(m => { const d = MUEBLES[m.tipo]; if (d && !d.obra && d.precio) dot[m.tipo] = (dot[m.tipo] || 0) + 1; });
  Q.dotacion = dot; Q.estiloMult = E.mult;
  Q.techo = M.techo;
  Q.escaleras = M.stair ? F - 1 : 0;
  Q.paradas = M.asc ? F : 0;
  return Q;
}

/** Losa que techa el piso f (cada piso puede tener su propia huella); sin el hueco de la escalera salvo en la cubierta. */
function areaLosa(M, f, stair, R) {
  const A = M.floors?.[f - 1]?.R?.area ?? R.area;
  return f < M.F && stair ? A - (stair.x1 - stair.x0) * (stair.y1 - stair.y0) : A;
}

/** Estructura de concreto (porticos en Colombia, hormigon en España). */
function concreto(M) {
  const { R, F, cols, beamLen, desp, fh, slab, stair, colB } = M;
  const zap = cols.reduce((t, c) => t + c.B * c.B * c.h, 0);
  const sol = cols.reduce((t, c) => t + c.B * c.B * 0.05, 0);
  const solA = cols.reduce((t, c) => t + c.B * c.B, 0);
  const excZ = cols.reduce((t, c) => t + (c.B + 0.4) ** 2 * desp, 0);
  const excV = beamLen * 0.5 * 0.6;
  const vc = beamLen * 0.3 * 0.4;
  const contra = R.area * 0.08;
  const colLen = cols.reduce((t, c) => t + (desp - 0.45) + (c.n ?? F) * fh, 0);
  const colV = colLen * colB * colB;
  const vigaL = M.vigas ? M.vigas.reduce((t, v) => t + v.reduce((s, b) => s + b.b - b.a, 0), 0) : F * beamLen;
  const vA = vigaL * 0.3 * 0.25;
  let losaA = 0;
  for (let f = 1; f <= F; f++) losaA += areaLosa(M, f, stair, R);
  losaA += (M.balcones || []).reduce((t, b) => t + b.area, 0);
  const losaV = losaA * slab;
  const escV = stair ? (F - 1) * 1.9 : 0;
  const acero = zap * 60 + vc * 130 + contra * 20 + colV * 160 + vA * 130 + losaV * 85 + escV * 100;
  const encof = colLen * colB * 4 + vigaL * (0.3 + 2 * 0.25) + vc / 0.12;
  return { zap, sol, solA, excZ, excV, vc, contra, colV, vA, losaA, losaV, escV, acero, encof, concFund: zap + vc + contra, concStr: colV + vA + losaV + escV };
}

/** Mamposteria confinada (NSR-10 Titulo E): cimiento corrido, columnetas y vigas de amarre. */
function confinada(M, Q) {
  const { F, fh, R, stair } = M;
  const Lcim = Q.Lext1 + Q.Lint1;
  const ciclo = Lcim * 0.4 * 0.5;
  const vcim = Lcim * 0.25 * 0.3;
  const nCol = M.columnetasPiso ? M.columnetasPiso.reduce((t, c) => t + c.length, 0) : (M.columnetas?.length || 0) * F;
  const colV = nCol * fh * 0.15 * 0.2;
  const Lmuros = M.floors.reduce((t, fl) => t + fl.lines.reduce((s, l) => s + l.len, 0), 0);
  const amarre = Lmuros * 0.15 * 0.2;
  let losaA = 0;
  for (let f = 1; f <= F; f++) losaA += areaLosa(M, f, stair, R);
  losaA += (M.balcones || []).reduce((t, b) => t + b.area, 0);
  const losaV = losaA * M.slab, contra = R.area * 0.08, escV = stair ? (F - 1) * 1.9 : 0;
  const acero = vcim * 90 + colV * 140 + amarre * 120 + losaV * 85 + contra * 20 + escV * 100;
  return { ciclo, vcim, colV, amarre, losaV, contra, escV, acero, excF: Lcim * 0.5 * 0.6, concFund: vcim + contra, concStr: colV + amarre + losaV + escV };
}

const P = (cat, cap, k, q, und, d) => ({ cat, cap: tr(cap), k, q: Math.max(0, q), und, item: tr(d) });

function partidasCO(M, Q, S) {
  const T = Q.techo, items = [];
  const conf = S.sistema === 'confinada';
  const c = conf ? confinada(M, Q) : concreto(M);
  const cap = {
    tierras: { es: 'Preliminares y tierras', en: 'Site work' }, cim: { es: 'Cimentación', en: 'Foundation' }, est: { es: 'Estructura', en: 'Structure' },
    mamp: { es: 'Mampostería', en: 'Masonry' }, cub: { es: 'Cubierta', en: 'Roof' }, pan: { es: 'Pañetes', en: 'Plaster' }, muro: { es: 'Acabados de muro', en: 'Wall finishes' },
    pisos: { es: 'Pisos y enchapes', en: 'Floors and tiling' }, carp: { es: 'Carpintería', en: 'Doors and windows' }, red: { es: 'Redes', en: 'MEP' }, coc: { es: 'Cocina y closets', en: 'Kitchen and closets' }, mov: { es: 'Circulación vertical', en: 'Vertical circulation' },
  };
  items.push(P('negra', cap.tierras, 'exc', M.cut, 'm³', { es: 'Corte / explanación de plataforma', en: 'Platform cut' }));
  items.push(P('negra', cap.tierras, 'rel', M.fill, 'm³', { es: 'Relleno compactado de plataforma', en: 'Compacted fill' }));
  if (conf) {
    items.push(P('negra', cap.tierras, 'exc', c.excF, 'm³', { es: 'Excavación de cimiento corrido', en: 'Strip footing excavation' }));
    items.push(P('negra', cap.cim, 'ciclopeo', c.ciclo, 'm³', { es: 'Cimiento corrido en concreto ciclópeo 40 × 50', en: 'Cyclopean strip footing 40 × 50' }));
    items.push(P('negra', cap.cim, 'conc', c.vcim, 'm³', { es: 'Viga de cimentación 25 × 30 bajo todos los muros', en: 'Grade beam 25 × 30 under all walls' }));
    items.push(P('negra', cap.cim, 'conc', c.contra, 'm³', { es: 'Placa de contrapiso e=8 cm', en: 'Slab on grade 8 cm' }));
    items.push(P('negra', cap.est, 'conc', c.colV, 'm³', { es: `Columnetas de confinamiento 15 × 20 (${M.columnetas?.length || 0} und)`, en: `Tie columns 15 × 20 (${M.columnetas?.length || 0})` }));
    items.push(P('negra', cap.est, 'conc', c.amarre, 'm³', { es: 'Vigas de amarre 15 × 20 en cada nivel', en: 'Bond beams 15 × 20 at each level' }));
  } else {
    items.push(P('negra', cap.tierras, 'exc', c.excZ + c.excV, 'm³', { es: 'Excavación zapatas y vigas de cimentación', en: 'Footing and grade beam excavation' }));
    items.push(P('negra', cap.cim, 'solado', c.sol, 'm³', { es: 'Solado de limpieza e=5 cm', en: 'Blinding 5 cm' }));
    items.push(P('negra', cap.cim, 'conc', c.zap, 'm³', { es: `Concreto zapatas (${M.cols.length} und, ${M.types.length} tipos)`, en: `Footings (${M.cols.length}, ${M.types.length} types)` }));
    items.push(P('negra', cap.cim, 'conc', c.vc, 'm³', { es: 'Concreto vigas de cimentación 30 × 40', en: 'Grade beams 30 × 40' }));
    items.push(P('negra', cap.cim, 'conc', c.contra, 'm³', { es: 'Placa de contrapiso e=8 cm', en: 'Slab on grade 8 cm' }));
    const cm = Math.round(M.colB * 100);
    items.push(P('negra', cap.est, 'conc', c.colV, 'm³', { es: `Concreto columnas ${cm} × ${cm}`, en: `Columns ${cm} × ${cm}` }));
    items.push(P('negra', cap.est, 'conc', c.vA, 'm³', { es: 'Concreto vigas aéreas 30 × 25', en: 'Beams 30 × 25' }));
  }
  items.push(P('negra', cap.est, 'conc', c.losaV, 'm³', { es: `Losas de entrepiso y cubierta e=${M.slab.toFixed(2)} eq.`, en: `Floor and roof slabs ${M.slab.toFixed(2)} eq.` }));
  if (c.escV) items.push(P('negra', cap.est, 'conc', c.escV, 'm³', { es: 'Escalera en concreto', en: 'Concrete stair' }));
  items.push(P('negra', cap.est, 'acero', c.acero, 'kg', { es: 'Acero de refuerzo fy 420 MPa', en: 'Rebar fy 420 MPa' }));
  items.push(P('negra', cap.mamp, conf ? 'mampP' : 'mamp', Q.AextN + Q.AintN, 'm²', conf ? { es: 'Muro de bloque portante confinado', en: 'Load-bearing confined block wall' } : { es: 'Muro bloque N°5 (fachada e interior)', en: 'Block infill wall' }));
  if (T.tipo === 'plana') items.push(P('negra', cap.cub, 'imper', (M.Rtop || M.R).area, 'm²', { es: 'Impermeabilización losa de cubierta', en: 'Roof waterproofing' }));
  else {
    items.push(P('negra', cap.cub, 'cubInc', T.area, 'm²', { es: `Cubierta inclinada (${T.pend} %): estructura y teja`, en: `Pitched roof (${T.pend} %): structure and tiles` }));
    items.push(P('negra', cap.cub, 'canal', T.canal, 'm', { es: 'Canales y bajantes', en: 'Gutters and downspouts' }));
  }
  items.push(P('gris', cap.pan, 'pan', 2 * Q.AintN + 2 * Q.AextN, 'm²', { es: 'Pañete muros (interior 2 caras + fachada)', en: 'Plaster (both faces + facade)' }));
  items.push(P('blanca', cap.muro, 'est', 2 * Q.AintN + Q.AextN, 'm²', { es: 'Estuco y pintura interior', en: 'Interior skim coat and paint' }));
  items.push(P('blanca', cap.muro, 'pext', Q.AextN, 'm²', { es: 'Pintura de fachada', en: 'Facade paint' }));
  items.push(P('blanca', cap.muro, 'cielo', Q.cielo, 'm²', { es: 'Cielo raso en estuco y pintura', en: 'Ceilings' }));
  pisosItems(items, Q, 'CO', cap.pisos);
  items.push(P('blanca', cap.pisos, 'ench', Q.Aench, 'm²', { es: 'Enchape de muros de baño y salpicadero de cocina', en: 'Bath and kitchen wall tiling' }));
  items.push(P('blanca', cap.carp, 'puerta', Q.nDoor, 'und', { es: 'Puertas interiores', en: 'Interior doors' }));
  items.push(P('blanca', cap.carp, 'puertaP', Q.nMain, 'und', { es: 'Puerta principal', en: 'Main door' }));
  items.push(P('blanca', cap.carp, 'vent', Q.Awin, 'm²', { es: 'Ventanería aluminio y vidrio', en: 'Aluminium windows' }));
  items.push(P('inst', cap.red, 'elec', Q.elec, 'und', { es: 'Puntos eléctricos (luces, tomas, interruptores)', en: 'Electrical points' }));
  items.push(P('inst', cap.red, 'hidro', Q.hidro, 'und', { es: 'Puntos hidrosanitarios', en: 'Plumbing points' }));
  items.push(P('inst', cap.red, 'sanit', Q.aparatos, 'und', { es: 'Aparatos sanitarios y grifería', en: 'Plumbing fixtures' }));
  items.push(P('blanca', cap.coc, 'cocina', Q.cocinaML, 'ml', { es: 'Cocina integral con mesón', en: 'Kitchen cabinets and countertop' }));
  items.push(P('blanca', cap.coc, 'closet', Q.closetML, 'ml', { es: 'Closets', en: 'Closets' }));
  if (Q.paradas) items.push(P('inst', cap.mov, 'ascensor', 1, 'und', { es: `Ascensor de ${Q.paradas} paradas`, en: `${Q.paradas}-stop elevator` }));
  return { items, c };
}

function partidasES(M, Q) {
  const T = Q.techo, c = concreto(M), items = [];
  const cap = {
    mov: { es: '01 Movimiento de tierras', en: '01 Earthworks' }, cim: { es: '02 Cimentación', en: '02 Foundations' }, est: { es: '03 Estructura', en: '03 Structure' },
    fab: { es: '04 Fachadas y particiones', en: '04 Facades and partitions' }, cub: { es: '05 Cubierta', en: '05 Roof' }, rev: { es: '06 Revestimientos', en: '06 Linings' },
    sol: { es: '07 Solados y alicatados', en: '07 Floors and tiling' }, carp: { es: '08 Carpintería', en: '08 Joinery' }, inst: { es: '09 Instalaciones', en: '09 Services' },
    equ: { es: '10 Equipamiento', en: '10 Equipment' }, res: { es: '11 Gestión de residuos', en: '11 Waste management' }, ss: { es: '12 Seguridad y salud', en: '12 Health and safety' },
  };
  const excT = M.cut + c.excZ + c.excV;
  items.push(P('negra', cap.mov, 'exc', excT, 'm³', { es: 'Excavación con medios mecánicos', en: 'Mechanical excavation' }));
  items.push(P('negra', cap.mov, 'rel', M.fill, 'm³', { es: 'Relleno compactado', en: 'Compacted fill' }));
  items.push(P('negra', cap.mov, 'tra', Math.max(0, excT - M.fill), 'm³', { es: 'Transporte de tierras a gestor autorizado', en: 'Soil haulage' }));
  items.push(P('negra', cap.cim, 'hl', c.solA, 'm²', { es: 'Hormigón de limpieza HL-150, 10 cm', en: 'Blinding concrete 10 cm' }));
  items.push(P('negra', cap.cim, 'ha', c.zap + c.vc, 'm³', { es: `Hormigón HA-25 en zapatas (${M.cols.length}) y vigas de atado`, en: `HA-25 footings (${M.cols.length}) and tie beams` }));
  items.push(P('negra', cap.est, 'ha', c.colV + c.vA + c.escV, 'm³', { es: 'Hormigón HA-25 en pilares, vigas y escalera', en: 'HA-25 columns, beams and stair' }));
  items.push(P('negra', cap.est, 'ace', c.acero, 'kg', { es: 'Acero B 500 S elaborado y colocado', en: 'B 500 S rebar' }));
  items.push(P('negra', cap.est, 'enc', c.encof, 'm²', { es: 'Encofrado de pilares y vigas', en: 'Formwork' }));
  items.push(P('negra', cap.est, 'forj', c.losaA + M.R.area, 'm²', { es: 'Forjados unidireccionales 25+5 (incluye sanitario)', en: 'One-way slabs 25+5 (incl. ground floor)' }));
  items.push(P('negra', cap.fab, 'fab', Q.AextN, 'm²', { es: 'Fábrica de ladrillo cerámico perforado en fachada', en: 'Perforated brick facade wall' }));
  items.push(P('negra', cap.fab, 'ais', Q.AextN, 'm²', { es: 'Aislamiento por el exterior tipo SATE (CTE DB-HE)', en: 'External insulation system (CTE DB-HE)' }));
  items.push(P('gris', cap.fab, 'tab', Q.AintN, 'm²', { es: 'Tabiquería interior', en: 'Interior partitions' }));
  if (T.tipo === 'plana') items.push(P('negra', cap.cub, 'cubPlana', (M.Rtop || M.R).area, 'm²', { es: 'Cubierta plana invertida transitable', en: 'Inverted flat roof' }));
  else {
    items.push(P('negra', cap.cub, 'cubTeja', T.area, 'm²', { es: `Cubierta de teja cerámica (${T.pend} %)`, en: `Clay tile roof (${T.pend} %)` }));
    items.push(P('negra', cap.cub, 'canal', T.canal, 'm', { es: 'Canalones y bajantes', en: 'Gutters and downpipes' }));
  }
  items.push(P('gris', cap.rev, 'enl', 2 * Q.AintN + Q.AextN, 'm²', { es: 'Guarnecido y enlucido de yeso', en: 'Gypsum plaster' }));
  items.push(P('blanca', cap.rev, 'pin', 2 * Q.AintN + 2 * Q.AextN, 'm²', { es: 'Pintura plástica interior y exterior', en: 'Paint' }));
  items.push(P('blanca', cap.rev, 'falso', Q.cielo * 0.35, 'm²', { es: 'Falso techo de placa de yeso (zonas húmedas y pasos)', en: 'Plasterboard ceilings' }));
  pisosItems(items, Q, 'ES', cap.sol);
  items.push(P('blanca', cap.sol, 'ali', Q.Aench, 'm²', { es: 'Alicatado de baños y cocina', en: 'Wall tiling' }));
  items.push(P('blanca', cap.carp, 'carpExt', Q.Awin, 'm²', { es: 'Carpintería de aluminio con rotura de puente térmico', en: 'Thermally broken aluminium windows' }));
  items.push(P('blanca', cap.carp, 'pInt', Q.nDoor, 'ud', { es: 'Puertas de paso', en: 'Interior doors' }));
  items.push(P('blanca', cap.carp, 'pEnt', Q.nMain, 'ud', { es: 'Puerta de entrada de seguridad', en: 'Security entrance door' }));
  items.push(P('inst', cap.inst, 'elec', Q.elec, 'ud', { es: 'Instalación eléctrica por punto (REBT)', en: 'Electrical points' }));
  items.push(P('inst', cap.inst, 'font', Q.aparatos, 'ud', { es: 'Fontanería y aparatos sanitarios', en: 'Plumbing and fixtures' }));
  items.push(P('inst', cap.inst, 'sanea', Q.aparatos, 'ud', { es: 'Saneamiento por aparato', en: 'Drainage per fixture' }));
  items.push(P('inst', cap.inst, 'clima', 1, 'ud', { es: 'Aerotermia para calefacción y agua caliente', en: 'Air-to-water heat pump' }));
  items.push(P('inst', cap.inst, 'radiante', Q.Apiso, 'm²', { es: 'Suelo radiante', en: 'Underfloor heating' }));
  items.push(P('inst', cap.inst, 'vmc', 1, 'ud', { es: 'Ventilación mecánica (CTE DB HS 3)', en: 'Mechanical ventilation (CTE DB HS 3)' }));
  items.push(P('inst', cap.inst, 'sanEnt', 1, 'ud', { es: 'Red de saneamiento enterrada y arqueta', en: 'Below-ground drainage' }));
  items.push(P('blanca', cap.equ, 'cocina', Q.cocinaML, 'm', { es: 'Mobiliario de cocina con encimera', en: 'Kitchen units and worktop' }));
  items.push(P('blanca', cap.equ, 'armario', Q.closetML, 'm', { es: 'Armarios empotrados', en: 'Built-in wardrobes' }));
  if (Q.escaleras) items.push(P('blanca', cap.carp, 'escalera', Q.escaleras, 'ud', { es: 'Revestimiento y barandilla de escalera', en: 'Stair finish and railing' }));
  if (Q.paradas) items.push(P('inst', cap.inst, 'ascensor', 1, 'ud', { es: `Ascensor de ${Q.paradas} paradas`, en: `${Q.paradas}-stop lift` }));
  items.push(P('negra', cap.res, 'res', Q.built * 0.12, 'm³', { es: 'Gestión de residuos de construcción (RD 105/2008)', en: 'Construction waste (RD 105/2008)' }));
  items.push(P('negra', cap.ss, 'ss', Q.built, 'm²', { es: 'Seguridad y salud', en: 'Health and safety' }));
  return { items, c };
}

function partidasCA(M, Q, S) {
  const T = Q.techo, items = [], R = M.R;
  const cap = {
    site: { es: 'Terreno', en: 'Site work' }, fnd: { es: 'Cimentación y sótano', en: 'Foundation and basement' }, frm: { es: 'Estructura de madera', en: 'Framing' },
    roof: { es: 'Cubierta', en: 'Roofing' }, env: { es: 'Envolvente', en: 'Envelope' }, int: { es: 'Interiores', en: 'Interior finishes' },
    flo: { es: 'Pisos', en: 'Flooring' }, opn: { es: 'Puertas y ventanas', en: 'Doors and windows' }, mep: { es: 'Instalaciones', en: 'Mechanical and electrical' }, kit: { es: 'Cocina', en: 'Kitchen' },
  };
  const sot = !!S.sotano, hMuro = sot ? 2.6 : Math.max(M.desp, 1.2) + 0.3;
  const per = Q.perim;
  const excSot = sot ? (R.w + 1.2) * (R.h + 1.2) * (hMuro - 0.3) : 0;
  items.push(P('negra', cap.site, 'exc', M.cut + excSot + per * 0.6 * 0.4, 'm³', { es: sot ? 'Excavación del sótano y zapatas' : 'Excavación de zapatas', en: sot ? 'Basement and footing excavation' : 'Footing excavation' }));
  items.push(P('negra', cap.site, 'rel', M.fill + per * 0.6 * hMuro * 0.5, 'm³', { es: 'Relleno perimetral', en: 'Backfill' }));
  items.push(P('negra', cap.fnd, 'zap', per * 0.6 * 0.25 + (M.cols.length * 0.6 * 0.6 * 0.3), 'm³', { es: 'Zapatas corridas y de poste', en: 'Strip and pad footings' }));
  items.push(P('negra', cap.fnd, 'muroC', per * hMuro * 0.2, 'm³', { es: sot ? 'Muros de sótano en concreto 200 mm' : 'Muros de cimentación hasta la helada', en: sot ? 'Basement walls, 200 mm concrete' : 'Frost walls' }));
  items.push(P('negra', cap.fnd, 'losaS', R.area, 'm²', { es: sot ? 'Losa del sótano con grava y barrera' : 'Losa sobre terreno', en: sot ? 'Basement slab with gravel and poly' : 'Slab on grade' }));
  items.push(P('negra', cap.fnd, 'impermC', per * (hMuro - 0.2), 'm²', { es: 'Impermeabilización de muros', en: 'Damp-proofing' }));
  items.push(P('negra', cap.fnd, 'drenaje', per, 'm', { es: 'Tubo de drenaje perimetral', en: 'Weeping tile' }));
  items.push(P('negra', cap.frm, 'marcoExt', Q.AextB, 'm²', { es: 'Muros exteriores 2×6 @ 16" con tablero OSB', en: 'Exterior walls 2×6 @ 16" with OSB' }));
  items.push(P('negra', cap.frm, 'marcoInt', Q.AintB, 'm²', { es: 'Tabiques 2×4', en: 'Interior partitions 2×4' }));
  items.push(P('negra', cap.frm, 'entrepiso', (M.built - R.area) + (sot ? R.area : 0), 'm²', { es: 'Entrepisos: viguetas y contrapiso', en: 'Floor joists and subfloor' }));
  items.push(P('negra', cap.roof, 'cerchas', T.tipo === 'plana' ? (M.Rtop || R).area : T.areaPlanta, 'm²', { es: 'Cerchas de cubierta y tablero', en: 'Roof trusses and sheathing' }));
  items.push(P('negra', cap.roof, 'tejas', T.area, 'm²', { es: 'Tejas asfálticas con membrana', en: 'Asphalt shingles with underlay' }));
  if (T.tipo !== 'plana') items.push(P('negra', cap.roof, 'hielo', T.canal, 'm', { es: 'Membrana contra hielo en aleros', en: 'Ice and water shield at eaves' }));
  items.push(P('gris', cap.roof, 'canal', T.canal || per, 'm', { es: 'Canales y bajantes', en: 'Gutters and downspouts' }));
  items.push(P('gris', cap.env, 'revest', Q.AextN, 'm²', { es: 'Revestimiento exterior', en: 'Exterior cladding' }));
  items.push(P('gris', cap.env, 'aislM', Q.AextB, 'm²', { es: 'Aislamiento de muros y barrera de vapor', en: 'Wall insulation and vapour barrier' }));
  items.push(P('gris', cap.env, 'aislA', (M.Rtop || R).area, 'm²', { es: 'Aislamiento del ático', en: 'Attic insulation' }));
  items.push(P('blanca', cap.int, 'drywall', 2 * Q.AintN + Q.AextN + Q.cielo, 'm²', { es: 'Paneles de yeso con acabado y pintura', en: 'Drywall, taping and paint' }));
  pisosItems(items, Q, 'CA', cap.flo);
  items.push(P('blanca', cap.flo, 'ali', Q.Aench, 'm²', { es: 'Enchape de baños y salpicadero', en: 'Bath and backsplash tile' }));
  items.push(P('blanca', cap.opn, 'vent', Q.Awin, 'm²', { es: 'Ventanas de PVC con doble vidrio bajo emisivo', en: 'Vinyl low-e windows' }));
  items.push(P('blanca', cap.opn, 'pEnt', Q.nMain, 'ea', { es: 'Puerta exterior aislada', en: 'Insulated entry door' }));
  items.push(P('blanca', cap.opn, 'pInt', Q.nDoor, 'ea', { es: 'Puertas interiores', en: 'Interior doors' }));
  if (Q.escaleras || sot) items.push(P('blanca', cap.int, 'escalera', Q.escaleras + (sot ? 1 : 0), 'ea', { es: 'Escaleras', en: 'Stairs' }));
  items.push(P('blanca', cap.kit, 'cocina', Q.cocinaML, 'm', { es: 'Gabinetes de cocina y mesón', en: 'Kitchen cabinets and counters' }));
  items.push(P('inst', cap.mep, 'sanit', Q.aparatos, 'ea', { es: 'Aparatos sanitarios con instalación', en: 'Plumbing fixtures incl. rough-in' }));
  items.push(P('inst', cap.mep, 'elec', Q.elec, 'ea', { es: 'Puntos eléctricos', en: 'Electrical points' }));
  items.push(P('inst', cap.mep, 'tablero', 1, 'ea', { es: 'Tablero de 200 A', en: '200 A panel' }));
  items.push(P('inst', cap.mep, 'humo', Math.max(Q.humo, M.F + (sot ? 1 : 0)), 'ea', { es: 'Detectores de humo y CO interconectados', en: 'Interconnected smoke/CO alarms' }));
  items.push(P('inst', cap.mep, 'hvac', Q.built + (sot ? R.area : 0), 'm²', { es: 'Bomba de calor para clima frío con ductos y ventilación con recuperación', en: 'Cold-climate heat pump, ducts and HRV/ERV' }));
  items.push(P('inst', cap.mep, 'radon', 1, 'ls', { es: 'Preinstalación de radón (chimenea pasiva)', en: 'Radon rough-in (passive stack)' }));
  if (Q.paradas) items.push(P('inst', cap.mep, 'ascensor', 1, 'ea', { es: `Ascensor residencial de ${Q.paradas} paradas`, en: `${Q.paradas}-stop residential elevator` }));
  return { items, c: { concFund: per * 0.6 * 0.25 + per * hMuro * 0.2 + R.area * 0.1, concStr: 0, acero: 0, excF: excSot }, hMuro };
}

function pisosItems(items, Q, pais, cap) {
  Object.entries(Q.pisos).sort((a, b) => b[1] - a[1]).forEach(([cod, a]) => {
    const p = PISOS[cod] || PISOS.porc;
    items.push({ cat: 'blanca', cap: tr(cap), k: 'piso:' + cod, q: a, und: pais === 'CA' ? 'm²' : 'm²', item: `${p.cod} · ${tr(p.n)}`, precio: p.precio[pais] });
  });
}

/** Muebles y aparatos sueltos (si se amobla). */
function dotacion(items, Q, pais) {
  const cap = { es: 'Dotación', en: 'Furniture and appliances' };
  Object.entries(Q.dotacion).forEach(([tipo, n]) => {
    const d = MUEBLES[tipo];
    items.push({ cat: 'dot', cap: tr(cap), k: 'mueble:' + tipo, q: n, und: UND[pais] || 'und', item: tr(d.n), precio: Math.round(d.precio[pais] * Q.estiloMult) });
  });
}

/** Cantidades de obra y materiales principales. */
export function quantities(M, S) {
  const pid = S.pais || 'CO';
  const Q = medir(M, S);
  const { items, c, hMuro, gen } = pid === 'ES' ? partidasES(M, Q) : pid === 'CA' ? partidasCA(M, Q, S) : pid === 'MX' ? partidasMX(M, Q, S, pisoDe) : partidasCO(M, Q, S);
  // en México ya salen en los números generadores (AZO-04, CAN-07 y piso exterior)
  if (Q.terrazaA > 0 && pid !== 'MX') {
    const [kImp, kBar] = { ES: ['cubPlana', 'baranda'], CA: ['impermC', 'baranda'] }[pid] || ['imper', 'baranda'];
    const capT = { es: 'Terrazas y balcones', en: 'Terraces and balconies' };
    items.push(P('negra', capT, kImp, Q.terrazaA, 'm²', { es: 'Impermeabilización de terrazas y balcones', en: 'Terrace and balcony waterproofing' }));
    items.push(P('blanca', capT, kBar, Q.barandaL, 'm', { es: 'Baranda metálica de terrazas y balcones', en: 'Metal railing for terraces and balconies' }));
  }
  dotacion(items, Q, pid);
  (M.domotica || []).forEach(d => items.push({ cat: 'dot', cap: tr({ es: 'Tecnología y domótica', en: 'Smart home' }), k: 'domo:' + d.id, q: d.n, und: pid === 'CA' ? 'ea' : pid === 'MX' ? 'pza' : 'und', item: tr(d.nombre), precio: d.precio }));
  items.forEach((it, i) => { it.id = 'q' + i; });
  const conc = (c.concFund || 0) + (c.concStr || 0);
  const mamp = Q.AextN + Q.AintN;
  let mat;
  if (pid === 'CA') {
    const studsExt = Math.ceil(Q.AextB / M.fh / 0.406) + Q.nWin * 2, studsInt = Math.ceil(Q.AintB / M.fh / 0.406) + Q.nDoor * 2;
    mat = {
      concreto: r2(conc), studs6: studsExt, studs4: studsInt,
      osb: Math.ceil((Q.AextB + (M.built - M.R.area) + (S.sotano ? M.R.area : 0) + (Q.techo.tipo === 'plana' ? (M.Rtop || M.R).area : Q.techo.area)) / 2.97 * 1.08),
      drywall: Math.ceil((2 * Q.AintN + Q.AextN + Q.cielo) / 2.97 * 1.1), shingles: Math.ceil(Q.techo.area / 3.1 * 1.1), hMuro: r2(hMuro),
    };
  } else if (pid === 'ES') {
    mat = { concreto: r2(conc), acero: Math.round(c.acero), ladrillos: Math.ceil(Q.AextN * 52), bloquesTab: Math.ceil(Q.AintN * 12.5), forjado: r2(c.losaA + M.R.area) };
  } else if (pid === 'MX') {
    mat = materialesMX(gen, c);
  } else {
    mat = {
      bloques: Math.ceil(mamp * 12.5),
      cemento: Math.ceil(conc * 7 + mamp * 0.25 + (2 * Q.AintN + 2 * Q.AextN) * 0.2),
      arena: r2(conc * 0.56 + mamp * 0.03 + (2 * Q.AintN + 2 * Q.AextN) * 0.02),
      grava: r2(conc * 0.84), acero: Math.round(c.acero), concreto: r2(conc),
    };
  }
  return {
    items, mat, Q, gen: gen || null, concFund: c.concFund || 0, concStr: c.concStr || 0, excF: c.excF ?? ((c.excZ || 0) + (c.excV || 0)),
    mamp, pan: 2 * Q.AintN + 2 * Q.AextN, est: 2 * Q.AintN + Q.AextN, Apiso: Q.Apiso, Aench: Q.Aench, nDoor: Q.nDoor + Q.nMain, Awin: Q.Awin, cielo: Q.cielo,
  };
}

/** Precio de una partida: los pisos y muebles traen su precio; el resto sale de la tabla del pais. */
export const precioDe = (it, precios) => (it.k in precios ? +precios[it.k] : it.precio ?? 0);

/** Totales por categoria, costo directo, indirectos del pais y total. */
export function totales(M, precios, pid = M.pais || 'CO') {
  const t = { negra: 0, gris: 0, blanca: 0, inst: 0, dot: 0 };
  M.quant.items.forEach(it => { t[it.cat] = (t[it.cat] || 0) + it.q * precioDe(it, precios); });
  const directo = t.negra + t.gris + t.blanca + t.inst + t.dot;
  const lineas = [];
  for (const ind of paisDe(pid).indirectos) {
    const base = ind.sobre === 'uti' ? (lineas.find(l => l.k === 'uti')?.v || 0) : ind.sobre === 'todo' ? directo + lineas.reduce((s, l) => s + l.v, 0) : directo;
    // parte 'noHab': el impuesto solo grava la fraccion no habitacional (IVA de Mexico)
    const parte = ind.parte === 'noHab' ? (M.mx?.noHab ?? 1) : 1;
    lineas.push({ k: ind.k, n: tr(ind.n), pct: ind.pct, v: base * ind.pct * parte, imp: !!ind.imp, ...(ind.parte ? { parte } : {}) });
  }
  const total = directo + lineas.reduce((s, l) => s + l.v, 0);
  // gastos, imprevistos y utilidad (sin impuestos) como fraccion del costo directo
  const factorInd = directo ? lineas.filter(l => !l.imp).reduce((s, l) => s + l.v, 0) / directo : 0;
  return { ...t, directo, all: directo, lineas, total, sinDot: directo - t.dot, factorInd };
}

export { near };
