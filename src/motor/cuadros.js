/* ==========================================================================
   AXIONA OBRA · Cuadros del juego de planos
   --------------------------------------------------------------------------
   Puertas y ventanas agrupadas por tipo (P1, V1...) con cantidad y medidas,
   acabados por espacio y cuadro de areas con los indices del lote. Cada
   abertura del modelo recibe su codigo, que se rotula en las plantas.
   ========================================================================== */

import { r2 } from './geometria.js';
import { tr } from './idioma.js';
import { PISOS, ENCHAPES, ESTILOS } from './catalogo.js';
import { pisoDe } from './cantidades.js';

/** Tipos de puertas y ventanas; marca cada abertura con su codigo (o.tag). */
export function cuadroAberturas(M, S) {
  const E = ESTILOS[S.acabados?.estilo] || ESTILOS.moderno;
  const tipos = new Map();
  const mat = {
    main: tr({ es: 'Puerta de seguridad en madera maciza', en: 'Solid wood security door' }),
    door: tr({ es: `Puerta entamborada en ${E.madera}`, en: `Flush door, ${E.madera} veneer` }),
    bano: tr({ es: 'Puerta entamborada con rejilla de ventilación', en: 'Flush door with vent grille' }),
    win: M.pais === 'CA' ? tr({ es: 'PVC con doble vidrio bajo emisivo', en: 'Vinyl, double low-e glazing' }) : M.pais === 'ES' ? tr({ es: 'Aluminio con rotura de puente térmico, doble vidrio', en: 'Thermally broken aluminium, double glazing' }) : tr({ es: 'Aluminio y vidrio de 5 mm', en: 'Aluminium, 5 mm glass' }),
    winB: tr({ es: 'Aluminio, vidrio esmerilado (baños)', en: 'Aluminium, obscure glass (baths)' }),
  };
  M.floors.forEach(fl => fl.ops.forEach(o => {
    if (o.kind === 'asc') { o.tag = 'ASC'; return; }
    const room = fl.rects.find(r => r.name === o.room);
    const bano = /bano/.test(room?.tipo || '');
    const clase = o.kind === 'win' ? 'V' : 'P';
    const key = `${clase}|${o.kind}|${r2(o.w)}|${r2(o.h)}|${o.sill ?? 0}|${bano ? 1 : 0}`;
    if (!tipos.has(key)) tipos.set(key, { clase, kind: o.kind, w: r2(o.w), h: r2(o.h), sill: o.sill ?? 0, bano, n: 0, pisos: new Set(), mat: o.kind === 'main' ? mat.main : o.kind === 'win' ? (bano ? mat.winB : mat.win) : bano ? mat.bano : mat.door });
    const t = tipos.get(key);
    t.n++; t.pisos.add(fl.f + 1);
    o.tagKey = key;
  }));
  const lista = [...tipos.values()].sort((a, b) => a.clase.localeCompare(b.clase) || (b.kind === 'main') - (a.kind === 'main') || b.w * b.h - a.w * a.h);
  const cont = { P: 0, V: 0 };
  lista.forEach(t => { t.cod = `${t.clase}${++cont[t.clase]}`; t.pisos = [...t.pisos].join(', '); });
  const porKey = new Map([...tipos.entries()].map(([k, t]) => [k, t.cod]));
  M.floors.forEach(fl => fl.ops.forEach(o => { if (o.tagKey) o.tag = porKey.get(o.tagKey); }));
  return lista;
}

/** Acabados por espacio: piso, muros, cielo y guardaescoba. */
export function cuadroAcabados(M, S) {
  const E = ESTILOS[S.acabados?.estilo] || ESTILOS.moderno;
  const filas = [];
  M.floors.forEach(fl => fl.rects.forEach(r => {
    if (r.stair || r.asc) return;
    const piso = PISOS[pisoDe(r, fl.f, S)] || PISOS.porc;
    const bano = /bano/.test(r.tipo || ''), coc = r.tipo === 'cocina';
    const enchape = ENCHAPES[E.enchape] || ENCHAPES.porcMuro;
    const muro = bano ? `${enchape.cod} ${tr(enchape.n)} h=2.00` : coc ? tr({ es: `Pintura lavable + salpicadero ${enchape.cod}`, en: `Washable paint + ${enchape.cod} backsplash` }) : M.pais === 'CA' ? tr({ es: 'Panel de yeso pintado', en: 'Painted drywall' }) : M.pais === 'ES' ? tr({ es: 'Enlucido de yeso y pintura plástica', en: 'Gypsum plaster and paint' }) : tr({ es: 'Pañete, estuco y pintura', en: 'Plaster, skim coat and paint' });
    const cielo = bano || coc ? tr({ es: 'Placa de yeso resistente a la humedad', en: 'Moisture-resistant board' }) : M.pais === 'CA' ? tr({ es: 'Panel de yeso pintado', en: 'Painted drywall' }) : tr({ es: 'Estuco y pintura', en: 'Skim coat and paint' });
    filas.push({ piso: fl.f + 1, nombre: r.name, area: r2(r.area), perim: r2(2 * (r.w + r.h)), alto: r2(M.fh - M.slab), codPiso: piso.cod, pisoN: tr(piso.n), muro, cielo, guarda: bano ? '—' : tr({ es: `Guardaescoba ${E.madera}`, en: `${E.madera} baseboard` }) });
  }));
  return filas;
}

/** Cuadro de areas con indices de ocupacion y construccion. */
export function cuadroAreas(M) {
  const pisos = M.floors.map(fl => ({ piso: fl.f + 1, area: r2(fl.rects.reduce((t, r) => t + r.area, 0)), util: r2(fl.rects.filter(r => !r.circ).reduce((t, r) => t + r.area, 0)) }));
  const construida = r2(pisos.reduce((t, p) => t + p.area, 0));
  return {
    lote: r2(M.lotArea), huella: r2(M.R.area), construida, pisos,
    io: r2(M.R.area / M.lotArea), ic: r2(construida / M.lotArea), libre: r2(M.lotArea - M.R.area), sotano: M.sotano ? r2(M.R.area) : 0,
  };
}
