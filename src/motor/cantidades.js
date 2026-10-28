/* ==========================================================================
   AXIONA OBRA · Cantidades de obra
   --------------------------------------------------------------------------
   Cantidades por capitulo para el presupuesto y los materiales principales.
   Es predimensionamiento para anteproyecto: los factores de acero (kg por
   m³) y de materiales son de referencia y van en el pie de cada tabla.
   ========================================================================== */

import { r2 } from './geometria.js';

export const CATEGORIAS = { negra: 'Obra negra', gris: 'Obra gris', blanca: 'Obra blanca' };

export function quantities(M) {
  const { R, F, cols, beamLen, desp, fh, slab, stair, floors, colB } = M;
  const hw = fh - slab;
  const zap = cols.reduce((t, c) => t + c.B * c.B * c.h, 0);
  const sol = cols.reduce((t, c) => t + c.B * c.B * 0.05, 0);
  const excZ = cols.reduce((t, c) => t + (c.B + 0.4) ** 2 * desp, 0);
  const excV = beamLen * 0.5 * 0.6;
  const vc = beamLen * 0.3 * 0.4;
  const contra = R.area * 0.08;
  const colLen = cols.length * ((desp - 0.45) + F * fh);
  const colV = colLen * colB * colB;
  const vA = F * beamLen * 0.3 * 0.25;
  let losaA = 0;
  for (let f = 1; f <= F; f++) losaA += (f < F && stair) ? R.area - (stair.x1 - stair.x0) * (stair.y1 - stair.y0) : R.area;
  const losaV = losaA * slab;
  const escV = stair ? (F - 1) * 1.9 : 0;
  const concFund = zap + vc + contra, concStr = colV + vA + losaV + escV;
  const acero = zap * 60 + vc * 130 + contra * 20 + colV * 160 + vA * 130 + losaV * 85 + escV * 100;

  let Aext = 0, Aint = 0, Aops = 0, nDoor = 0, nMain = 0, Awin = 0, Aench = 0, Apiso = 0;
  floors.forEach(fl => {
    fl.lines.forEach(l => { const a = l.len * hw; if (l.ext) Aext += a; else Aint += a; });
    fl.ops.forEach(o => {
      Aops += o.w * o.h;
      if (o.kind === 'door') nDoor++;
      if (o.kind === 'main') nMain++;
      if (o.kind === 'win') Awin += o.w * o.h;
    });
    fl.rects.forEach(r => { if (!r.stair) Apiso += r.area; if (r.bath) Aench += 2 * (r.w + r.h) * 1.8; });
  });
  const opsRatio = Aops / Math.max(Aext + Aint, 1);
  const AextN = Aext * (1 - opsRatio), AintN = Aint * (1 - opsRatio);
  const mamp = AextN + AintN;
  const cielo = floors.reduce((t, fl) => t + fl.area, 0);
  const cm = Math.round(colB * 100);
  const items = [
    { cat: 'negra', cap: 'Preliminares y tierras', item: 'Corte / explanación de plataforma', und: 'm³', q: M.cut, k: 'exc' },
    { cat: 'negra', cap: 'Preliminares y tierras', item: 'Relleno compactado de plataforma', und: 'm³', q: M.fill, k: 'rel' },
    { cat: 'negra', cap: 'Preliminares y tierras', item: 'Excavación zapatas y vigas de cimentación', und: 'm³', q: excZ + excV, k: 'exc' },
    { cat: 'negra', cap: 'Cimentación', item: 'Solado de limpieza e=5 cm', und: 'm³', q: sol, k: 'solado' },
    { cat: 'negra', cap: 'Cimentación', item: `Concreto zapatas (${cols.length} und, ${M.types.length} tipos)`, und: 'm³', q: zap, k: 'conc' },
    { cat: 'negra', cap: 'Cimentación', item: 'Concreto vigas de cimentación 30×40', und: 'm³', q: vc, k: 'conc' },
    { cat: 'negra', cap: 'Cimentación', item: 'Placa de contrapiso e=8 cm', und: 'm³', q: contra, k: 'conc' },
    { cat: 'negra', cap: 'Estructura', item: `Concreto columnas ${cm}×${cm}`, und: 'm³', q: colV, k: 'conc' },
    { cat: 'negra', cap: 'Estructura', item: 'Concreto vigas aéreas 30×25 (descolgadas)', und: 'm³', q: vA, k: 'conc' },
    { cat: 'negra', cap: 'Estructura', item: `Losas de entrepiso y cubierta e=${slab.toFixed(2)} eq.`, und: 'm³', q: losaV, k: 'conc' },
    ...(escV ? [{ cat: 'negra', cap: 'Estructura', item: 'Escalera en concreto', und: 'm³', q: escV, k: 'conc' }] : []),
    { cat: 'negra', cap: 'Estructura', item: 'Acero de refuerzo fy 420 MPa', und: 'kg', q: acero, k: 'acero' },
    { cat: 'negra', cap: 'Mampostería', item: 'Muro bloque N°5 (fachada e interior)', und: 'm²', q: mamp, k: 'mamp' },
    { cat: 'negra', cap: 'Cubierta', item: 'Impermeabilización losa de cubierta', und: 'm²', q: R.area, k: 'imper' },
    { cat: 'gris', cap: 'Pañetes', item: 'Pañete muros (interior 2 caras + fachada)', und: 'm²', q: 2 * AintN + 2 * AextN, k: 'pan' },
    { cat: 'blanca', cap: 'Acabados de muro', item: 'Estuco y pintura interior', und: 'm²', q: 2 * AintN + AextN, k: 'est' },
    { cat: 'blanca', cap: 'Acabados de muro', item: 'Pintura de fachada', und: 'm²', q: AextN, k: 'pext' },
    { cat: 'blanca', cap: 'Acabados de muro', item: 'Cielo raso en estuco y pintura', und: 'm²', q: cielo, k: 'cielo' },
    { cat: 'blanca', cap: 'Pisos', item: 'Piso cerámico / porcelanato', und: 'm²', q: Apiso, k: 'piso' },
    { cat: 'blanca', cap: 'Pisos', item: 'Enchape muros de baño h=1.8 m', und: 'm²', q: Aench, k: 'ench' },
    { cat: 'blanca', cap: 'Carpintería', item: 'Puertas interiores', und: 'und', q: nDoor, k: 'puerta' },
    { cat: 'blanca', cap: 'Carpintería', item: 'Puerta principal', und: 'und', q: nMain, k: 'puertaP' },
    { cat: 'blanca', cap: 'Carpintería', item: 'Ventanería aluminio y vidrio', und: 'm²', q: Awin, k: 'vent' },
  ];
  items.forEach((it, i) => { it.id = 'q' + i; });
  const mat = {
    bloques: Math.ceil(mamp * 12.5),
    cemento: Math.ceil((concFund + concStr) * 7 + mamp * 0.25 + (2 * AintN + 2 * AextN) * 0.2),
    arena: r2((concFund + concStr) * 0.56 + mamp * 0.03 + (2 * AintN + 2 * AextN) * 0.02),
    grava: r2((concFund + concStr) * 0.84),
    acero: Math.round(acero), concreto: r2(concFund + concStr),
  };
  return { items, mat, concFund, concStr, excF: excZ + excV, mamp, pan: 2 * AintN + 2 * AextN, est: 2 * AintN + AextN, Apiso, Aench, nDoor: nDoor + nMain, Awin, cielo };
}

/** Totales por categoria con los precios del estado. */
export function totales(M, precios) {
  const t = { negra: 0, gris: 0, blanca: 0 };
  M.quant.items.forEach(it => { t[it.cat] += it.q * (+precios[it.k] || 0); });
  t.all = t.negra + t.gris + t.blanca;
  return t;
}
