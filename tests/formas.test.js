import { describe, it, expect } from 'vitest';
import { buildModel, DEFAULT_STATE, clonar, normalizarEstado, totales, huellaPiso, FORMAS } from '../src/motor/index.js';
import { fachadas, cortes, plantaCubierta } from '../src/motor/alzados.js';

const estado = (forma, extra = {}) => normalizarEstado({ ...clonar(DEFAULT_STATE), floors: 2, ...extra, forma: { paso: 2.5, balcones: false, ...forma } });
const finito = v => v.prims.every(p => { const pts = p.p && Array.isArray(p.p[0]) ? p.p : p.p ? [p.p] : []; return pts.every(q => q.every(Number.isFinite)); });

describe('Formas del edificio', () => {
  it('la forma recta deja todo como antes', () => {
    const S0 = normalizarEstado(clonar(DEFAULT_STATE)), S1 = estado({ tipo: 'recta' });
    const M0 = buildModel(S0), M1 = buildModel(S1);
    expect(M1.floors.every(fl => fl.R.area === M1.R.area)).toBe(true);
    expect(M1.terrazas).toEqual([]);
    expect(M1.built).toBeCloseTo(M0.built, 6);
    expect(totales(M1, S1.prices, 'CO').total).toBeCloseTo(totales(M0, S0.prices, 'CO').total, 0);
    expect(M1.cols.every(c => c.n === M1.F)).toBe(true);
  });

  it('el estado normaliza la forma y huellaPiso no deja pisos sin escalera', () => {
    expect(normalizarEstado({}).forma).toEqual({ tipo: 'recta', paso: 2.5, balcones: false });
    expect(normalizarEstado({ forma: { tipo: 'pirámide', paso: 40 } }).forma).toEqual({ tipo: 'recta', paso: 6, balcones: false });
    expect(Object.keys(FORMAS)).toEqual(['recta', 'terrazas', 'lateral', 'escalonada']);
    const R = { x0: 0, x1: 10, y0: 0, y1: 8, w: 10, h: 8, area: 80 };
    const R2 = huellaPiso(R, 2, 'izq', { tipo: 'escalonada', paso: 6 });
    expect(R2.y1).toBe(8);
    expect(R2.h).toBeGreaterThanOrEqual(4.2 + 2.4 - 1e-9);
    expect(R2.w).toBeGreaterThanOrEqual(2.6 + 3 - 1e-9);
    expect(huellaPiso(R, 0, 'izq', { tipo: 'terrazas' })).toBe(R);
  });

  for (const tipo of ['terrazas', 'lateral', 'escalonada']) {
    it(`«${tipo}»: los pisos de arriba retroceden, dejan terraza con baranda y todo cuadra`, () => {
      const M = buildModel(estado({ tipo }, { floors: 3 }));
      expect(M.err).toBeFalsy();
      const A = M.floors.map(fl => fl.R.area);
      expect(A[1]).toBeLessThan(A[0]);
      expect(A[2]).toBeLessThanOrEqual(A[1]);
      expect(M.built).toBeCloseTo(A.reduce((t, a) => t + a, 0), 1);
      expect(M.Rtop).toBe(M.floors[2].R);
      expect(M.terrazas.length).toBeGreaterThan(0);
      M.terrazas.forEach(t => {
        expect(t.area).toBeCloseTo(M.floors[t.f - 1].R.area - M.floors[t.f].R.area, 1);
        expect(t.L).toBeGreaterThan(0);
      });
      // cada espacio queda dentro de la huella de su piso, y la escalera sube por todos
      M.floors.forEach(fl => fl.rects.forEach(r => {
        expect(r.x0).toBeGreaterThanOrEqual(fl.R.x0 - 0.01); expect(r.x1).toBeLessThanOrEqual(fl.R.x1 + 0.01);
        expect(r.y0).toBeGreaterThanOrEqual(fl.R.y0 - 0.01); expect(r.y1).toBeLessThanOrEqual(fl.R.y1 + 0.01);
      }));
      M.floors.forEach(fl => expect(fl.rects.some(r => r.stair)).toBe(true));
      // la fachada nueva de cada piso cae sobre un eje
      M.floors.forEach(fl => {
        if (tipo !== 'lateral') expect(M.axY.some(y => Math.abs(y - fl.R.y0) < 0.01)).toBe(true);
        else expect(M.axX.some(x => Math.abs(x - fl.R.x0) < 0.01) && M.axX.some(x => Math.abs(x - fl.R.x1) < 0.01)).toBe(true);
      });
      // columnas: las que quedan bajo la terraza paran ahí
      expect(M.cols.some(c => c.n < M.F)).toBe(true);
      M.cols.forEach(c => { for (let f = 0; f < c.n; f++) { const R = M.floors[f].R; expect(c.x >= R.x0 - 0.01 && c.x <= R.x1 + 0.01 && c.y >= R.y0 - 0.01 && c.y <= R.y1 + 0.01).toBe(true); } });
      M.vigas.forEach((v, f) => v.forEach(b => {
        const R = M.floors[f].R, [a0, a1] = b.o === 'H' ? [R.x0, R.x1] : [R.y0, R.y1];
        expect(b.a).toBeGreaterThanOrEqual(a0 - 0.01); expect(b.b).toBeLessThanOrEqual(a1 + 0.01);
      }));
      // presupuesto: impermeabilización y baranda de terrazas
      const it = M.quant.items.filter(i => /terrazas y balcones/i.test(i.item));
      expect(it.length).toBe(2);
      expect(it.find(i => i.und === 'm²').q).toBeCloseTo(M.quant.Q.terrazaA, 6);
      expect(it.find(i => i.und === 'm').q).toBeCloseTo(M.quant.Q.barandaL, 6);
      // fachadas, cortes y cubierta sin números inválidos
      [...fachadas(M), ...cortes(M), plantaCubierta(M)].forEach(v => expect(finito(v)).toBe(true));
    });
  }

  it('las terrazas al frente se ven en la fachada lateral como escalones', () => {
    const M = buildModel(estado({ tipo: 'terrazas' }, { floors: 3 }));
    const der = fachadas(M).find(v => v.id === 'F-derecha');
    const muro = der.prims.find(p => p.capa === 'MUROS' && p.t === 'P');
    expect(muro.p.length).toBeGreaterThan(4);
    // la baranda del costado de la terraza se ve de lado, y la del frente no
    expect(der.prims.some(p => p.capa === 'BARANDAS')).toBe(true);
    const fondo = fachadas(M).find(v => v.id === 'F-fondo');
    expect(fondo.prims.some(p => p.capa === 'BARANDAS')).toBe(false);
    expect(fachadas(M).find(v => v.id === 'F-frente').prims.some(p => p.capa === 'BARANDAS')).toBe(true);
  });

  it('balcones: al frente de las alcobas de arriba, con puerta-ventana, losa y baranda', () => {
    const S = estado({ tipo: 'recta', balcones: true }), M = buildModel(S);
    expect(M.balcones.length).toBeGreaterThan(0);
    M.balcones.forEach(b => {
      expect(b.y1).toBeCloseTo(M.floors[b.f].R.y0, 6);
      expect(b.y1 - b.y0).toBeCloseTo(1.2, 6);
      const v = M.floors[b.f].ops.find(o => o.balcon && o.room === b.room);
      expect(v).toMatchObject({ kind: 'win', sill: 0, h: 2.1 });
    });
    const S0 = estado({ tipo: 'recta' }), sin = buildModel(S0);
    expect(totales(M, S.prices, 'CO').total).toBeGreaterThan(totales(sin, S0.prices, 'CO').total);
  });

  it('funciona en los cuatro países y en todos sus sistemas', () => {
    for (const [pais, sistemas] of [['CO', ['porticos', 'confinada']], ['ES', ['hormigon']], ['CA', ['madera']], ['MX', ['porticos', 'confinada']]]) {
      for (const sistema of sistemas) {
        const S = estado({ tipo: 'escalonada', balcones: true }, { pais, sistema, floors: 3 }), M = buildModel(S);
        expect(M.err, `${pais} ${sistema}`).toBeFalsy();
        expect(M.quant.items.every(i => Number.isFinite(i.q) && i.q >= 0)).toBe(true);
        expect(Number.isFinite(totales(M, S.prices, pais).total)).toBe(true);
        if (pais === 'MX') {
          expect(M.quant.items.some(i => /^AZO-04/.test(i.item))).toBe(true);
          expect(M.quant.items.some(i => /^CAN-07/.test(i.item))).toBe(true);
          expect(M.quant.items.filter(i => /terrazas y balcones/i.test(i.cap)).length).toBe(0);
        }
        if (sistema === 'confinada' && pais === 'CO') expect(M.columnetasPiso[1]).not.toBe(M.columnetas);
      }
    }
  });

  it('con un piso la forma no cambia la casa', () => {
    const base = buildModel(estado({ tipo: 'recta' }, { floors: 1, rooms: DEFAULT_STATE.rooms.map(r => ({ ...r, floor: 1 })) }));
    const esc = buildModel(estado({ tipo: 'escalonada' }, { floors: 1, rooms: DEFAULT_STATE.rooms.map(r => ({ ...r, floor: 1 })) }));
    expect(esc.R).toEqual(base.R);
    expect(esc.terrazas).toEqual([]);
  });
});
