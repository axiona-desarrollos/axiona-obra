import { describe, it, expect } from 'vitest';
import {
  buildModel, PLANTILLAS, normalizarEstado, datosDePais, totales, cubierta, PASOS, PAISES, PRECIOS_PAIS,
} from '../src/motor/index.js';
import { MUEBLES } from '../src/motor/catalogo.js';

const plantilla = (pid, k) => normalizarEstado(PLANTILLAS[pid][k].estado());
const sobre = (a, b) => Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0) > 0.02 && Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0) > 0.02;
const huella = m => {
  const giro = m.rot === 90 || m.rot === 270;
  const w = giro ? m.d : m.w, d = giro ? m.w : m.d;
  return { x0: m.x - w / 2, x1: m.x + w / 2, y0: m.y - d / 2, y1: m.y + d / 2 };
};

describe('paises', () => {
  it('cada pais trae precios, pasos y profesionales', () => {
    for (const id of Object.keys(PAISES)) {
      expect(Object.keys(PRECIOS_PAIS[id]).length).toBeGreaterThan(20);
      expect(PASOS[id].length).toBeGreaterThan(8);
      expect(PAISES[id].profesionales.length).toBeGreaterThan(1);
    }
  });
  it('un proyecto de la version 2 se abre como colombiano', () => {
    const S = normalizarEstado({ nombre: 'viejo', lot: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 20 }, { x: 0, y: 20 }], rooms: [{ name: 'Sala', area: 20, floor: 1, zone: 'social' }], prices: { conc: 800000 } });
    expect(S.pais).toBe('CO');
    expect(S.prices.conc).toBe(800000);
    expect(S.unidades).toBe('m');
  });
  it('al pasar a Canada cambian sistema, cubierta, unidades y moneda', () => {
    const d = datosDePais('CA');
    expect(d.sistema).toBe('madera');
    expect(d.cubierta.tipo).toBe('dos');
    expect(d.unidades).toBe('ft');
    expect(d.idioma).toBe('en');
  });
  it('los precios propios de pisos y muebles sobreviven al guardado', () => {
    const S = normalizarEstado({ ...plantilla('CO', 'ejemplo'), prices: { 'piso:roble': 300000, 'x:malo': 5 } });
    expect(S.prices['piso:roble']).toBe(300000);
    expect(S.prices['x:malo']).toBeUndefined();
  });
});

describe('cubierta', () => {
  const R = { x0: 0, x1: 12, y0: 0, y1: 8 };
  it('a dos aguas: cumbrera en el lado largo y area inclinada', () => {
    const T = cubierta(R, 6, { tipo: 'dos', pend: 50, alero: 0.5 });
    expect(T.dir).toBe('x');
    expect(T.zR).toBeCloseTo(6 - 0.25 + 0.5 * 4.5, 6);
    expect(T.area).toBeCloseTo(13 * 9 * Math.sqrt(1.25), 1);
    expect(T.altura(6, 4)).toBeCloseTo(T.zR, 6);
    expect(T.altura(6, 0)).toBeCloseTo(6, 6);
  });
  it('a cuatro aguas: cuatro caras y limatesas', () => {
    const T = cubierta(R, 6, { tipo: 'cuatro', pend: 30, alero: 0.4 });
    expect(T.caras.length).toBe(4);
    expect(T.limas.length).toBe(4);
    expect(T.altura(0, 4)).toBeCloseTo(6, 6);
  });
  it('plana: antepecho y sifones', () => {
    const T = cubierta(R, 6, { tipo: 'plana' });
    expect(T.antepecho).toBe(0.9);
    expect(T.bajantes.length).toBe(2);
  });
});

describe('amoblado', () => {
  for (const [pid, k] of [['CO', 'ejemplo'], ['CO', 'medianero'], ['ES', 'chalet'], ['CA', 'detached'], ['CO', 'campestre']]) {
    it(`${pid}/${k}: muebles dentro de su espacio, sin montarse y fuera del paso de las puertas`, () => {
      const M = buildModel(plantilla(pid, k));
      expect(M.muebles.length).toBeGreaterThan(15);
      for (const fl of M.floors) {
        const ms = M.muebles.filter(m => m.f === fl.f && !['tapete', 'cuadro', 'sillaEsc'].includes(m.tipo));
        for (const m of ms) {
          const r = fl.rects.find(x => x.name === m.room), h = huella(m);
          expect(h.x0 >= r.x0 - 0.01 && h.x1 <= r.x1 + 0.01 && h.y0 >= r.y0 - 0.01 && h.y1 <= r.y1 + 0.01, `${m.id} fuera de ${r.name}`).toBe(true);
        }
        for (let i = 0; i < ms.length; i++) for (let j = i + 1; j < ms.length; j++) {
          if (ms[i].tipo === 'comedor' || ms[j].tipo === 'comedor') continue;
          expect(sobre(huella(ms[i]), huella(ms[j])), `${ms[i].id} se monta con ${ms[j].id}`).toBe(false);
        }
      }
      // cada alcoba tiene cama y cada baño su sanitario
      for (const fl of M.floors) for (const r of fl.rects) {
        if (/alcoba/.test(r.tipo || '')) expect(M.muebles.some(m => m.room === r.name && m.f === fl.f && m.tipo === 'cama'), `${r.name} sin cama`).toBe(true);
        if (/bano/.test(r.tipo || '')) expect(M.muebles.some(m => m.room === r.name && m.f === fl.f && m.tipo === 'inodoro'), `${r.name} sin sanitario`).toBe(true);
      }
    });
  }
  it('los muebles quitados no vuelven', () => {
    const S = plantilla('CO', 'ejemplo');
    const M = buildModel(S);
    const id = M.muebles.find(m => m.tipo === 'sofa').id;
    const M2 = buildModel({ ...S, muebles: { quitar: [id] } });
    expect(M2.muebles.some(m => m.id === id)).toBe(false);
  });
  it('todos los tipos existen en el catalogo', () => {
    const M = buildModel(plantilla('CO', 'campestre'));
    for (const m of M.muebles) expect(MUEBLES[m.tipo], m.tipo).toBeTruthy();
  });
});

describe('redes, domotica y ascensor', () => {
  it('cada baño y cocina tiene puntos hidraulicos y la casa tiene tablero', () => {
    const M = buildModel(plantilla('CO', 'ejemplo'));
    expect(M.redes.puntos.aparatos).toBeGreaterThanOrEqual(8);
    expect(M.redes.pisos[0].sim.some(s => s.k === 'tablero')).toBe(true);
    expect(M.redes.pisos[0].sim.some(s => s.k === 'caja')).toBe(true);
  });
  it('el edificio de 5 pisos lleva ascensor con puerta al hall en cada piso', () => {
    const M = buildModel(plantilla('CO', 'edificio'));
    expect(M.asc).toBeTruthy();
    for (const fl of M.floors) {
      expect(fl.rects.some(r => r.asc)).toBe(true);
      expect(fl.ops.some(o => o.kind === 'asc')).toBe(true);
    }
    expect(M.quant.items.some(i => i.k === 'ascensor')).toBe(true);
  });
  it('la domotica de Canada se ubica y se cobra', () => {
    const S = { ...plantilla('CA', 'detached'), domotica: ['fuga', 'deshielo', 'respaldo', 'radon'] };
    const M = buildModel(S);
    expect(M.domotica.map(d => d.id)).toEqual(['fuga', 'deshielo', 'respaldo', 'radon']);
    expect(M.domotica.find(d => d.id === 'fuga').n).toBeGreaterThanOrEqual(3);
    expect(M.quant.items.filter(i => i.k.startsWith('domo:')).length).toBe(4);
  });
});

describe('presupuesto por pais', () => {
  const casos = [['CO', 'ejemplo', 1.6e6, 2.4e6], ['ES', 'chalet', 950, 1500], ['CA', 'detached', 1900, 3300]];
  for (const [pid, k, min, max] of casos) {
    it(`${pid}/${k}: costo por m² dentro del rango de referencia`, () => {
      const S = plantilla(pid, k);
      const M = buildModel(S);
      const T = totales(M, S.prices, pid);
      const sinImpuesto = PAISES[pid].indirectos.filter(i => !i.sobre).reduce((t, i) => t + i.pct, 0);
      const m2 = T.sinDot * (1 + sinImpuesto) / M.built;
      expect(m2).toBeGreaterThan(min);
      expect(m2).toBeLessThan(max);
      expect(T.total).toBeGreaterThan(T.directo);
    });
  }
});

describe('normas', () => {
  it('Titulo E: la esquinera de 3 pisos con local no cumple', () => {
    const M = buildModel({ ...plantilla('CO', 'esquinero'), sistema: 'confinada' });
    expect(M.tituloE.filter(c => !c.info && c.ok === false).length).toBeGreaterThanOrEqual(2);
    expect(M.warn.some(w => /Título E|Title E/.test(w))).toBe(true);
    expect(M.columnetas.length).toBeGreaterThan(8);
  });
  it('Titulo E: la medianera de 2 pisos revisa la continuidad de muros', () => {
    const M = buildModel({ ...plantilla('CO', 'medianero'), sistema: 'confinada' });
    expect(M.tituloE.some(c => /piso 2|floor 2/.test(c.t))).toBe(true);
    expect(M.quant.items.some(i => i.k === 'ciclopeo')).toBe(true);
  });
  it('en ingles el motor habla ingles', () => {
    const M = buildModel({ ...plantilla('CO', 'ejemplo'), idioma: 'en' });
    expect(M.floors[0].rects.some(r => r.name === 'Entry hall')).toBe(true);
    expect(M.gantt.tasks[0].name).toBe('Layout and staking');
  });
  it('Canada baja el desplante a la profundidad de helada', () => {
    const M = buildModel({ ...plantilla('CA', 'detached'), sotano: false, helada: 1.8, desp: 1.2 });
    expect(M.desp).toBeCloseTo(1.8, 6);
  });
});
