import { describe, it, expect } from 'vitest';
import { buildModel, DEFAULT_STATE, PLANTILLAS, clonar, normalizarEstado, ladoColumna, totales } from '../src/motor/index.js';
import { marcoDelFrente, polyArea } from '../src/motor/geometria.js';

const ejemplo = () => normalizarEstado(clonar(DEFAULT_STATE));
const rect = (w, d, dz = 0) => [{ x: 0, y: 0, z: 0 }, { x: w, y: 0, z: 0 }, { x: w, y: d, z: dz }, { x: 0, y: d, z: dz }];

/** Propiedades que toda casa generada debe cumplir. */
function revisarCasa(M) {
  expect(M.err).toBeUndefined();
  for (const fl of M.floors) {
    const rs = fl.rects;
    // sin solapes
    for (let i = 0; i < rs.length; i++) for (let j = i + 1; j < rs.length; j++) {
      const a = rs[i], b = rs[j];
      const ox = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0), oy = Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0);
      expect(ox > 0.02 && oy > 0.02, `${a.name} y ${b.name} se montan`).toBe(false);
    }
    // los espacios cubren la huella
    const suma = rs.reduce((t, r) => t + r.area, 0);
    expect(Math.abs(suma - M.R.area)).toBeLessThan(0.8);
    // todo espacio (salvo circulaciones) tiene puerta
    for (const r of rs.filter(r => !r.circ)) expect(fl.ops.some(o => o.kind === 'door' && o.room === r.name), `${r.name} sin puerta`).toBe(true);
  }
  // columnas dentro de la huella
  for (const c of M.cols) {
    expect(c.x).toBeGreaterThanOrEqual(M.R.x0 - 0.01);
    expect(c.x).toBeLessThanOrEqual(M.R.x1 + 0.01);
  }
}

describe('marco del frente', () => {
  it('ida y vuelta al mundo sin error', () => {
    const lot = [{ x: 3, y: 1 }, { x: 15, y: 6 }, { x: 9, y: 22 }, { x: -2, y: 14 }];
    const m = marcoDelFrente(lot, 0);
    for (const p of lot) {
      const q = m.aMundo(m.aLocal(p));
      expect(q.x).toBeCloseTo(p.x, 9);
      expect(q.y).toBeCloseTo(p.y, 9);
    }
  });
  it('el frente queda sobre y = 0 y el lote hacia y positivo, en cualquier sentido de giro', () => {
    for (const lot of [rect(10, 20), rect(10, 20).reverse()]) {
      const local = lot.map(marcoDelFrente(lot, 0).aLocal);
      expect(Math.min(...local.map(p => p.y))).toBeCloseTo(0, 9);
      // giro, nunca espejo: conserva el sentido de los vertices
      expect(Math.sign(polyArea(local))).toBe(Math.sign(polyArea(lot)));
    }
  });
});

describe('la casa de ejemplo', () => {
  const M = buildModel(ejemplo());
  it('sale sin avisos: todo con puerta, ventana y buen ancho', () => {
    expect(M.warn).toEqual([]);
    revisarCasa(M);
  });
  it('los espacios habitables tienen ventana', () => {
    for (const fl of M.floors) for (const r of fl.rects.filter(r => !r.circ && !r.bath)) {
      expect(fl.ops.some(o => o.kind === 'win' && o.room === r.name), `${r.name} sin ventana`).toBe(true);
    }
  });
  it('es determinista', () => {
    const B = buildModel(ejemplo());
    expect(JSON.stringify(B.floors)).toBe(JSON.stringify(M.floors));
  });
  it('presupuesto y materiales con sentido', () => {
    const t = totales(M, ejemplo().prices);
    expect(t.all).toBeGreaterThan(50e6);
    expect(t.all / M.built).toBeGreaterThan(5e5);
    expect(t.all / M.built).toBeLessThan(3e6);
    expect(M.quant.mat.concreto).toBeGreaterThan(20);
  });
});

describe('lotes dificiles', () => {
  it('un lote girado da la misma casa que uno derecho', () => {
    const base = buildModel(normalizarEstado({ ...ejemplo(), lot: rect(12, 20, 1.5), spots: [] }));
    const a = Math.PI / 5;
    const girado = rect(12, 20, 1.5).map(p => ({ x: p.x * Math.cos(a) - p.y * Math.sin(a) + 40, y: p.x * Math.sin(a) + p.y * Math.cos(a) - 7, z: p.z }));
    const M = buildModel(normalizarEstado({ ...ejemplo(), lot: girado, spots: [] }));
    expect(M.R.w).toBeCloseTo(base.R.w, 1);
    expect(M.R.h).toBeCloseTo(base.R.h, 1);
    revisarCasa(M);
  });
  it('vertices en sentido horario funcionan igual', () => {
    const M = buildModel(normalizarEstado({ ...ejemplo(), lot: rect(12, 20).reverse(), spots: [] }));
    revisarCasa(M);
  });
  it('en un lote muy ancho la casa no sale como un vagon', () => {
    const M = buildModel(normalizarEstado({ ...ejemplo(), lot: rect(30, 40, 1), spots: [] }));
    expect(M.R.w / M.R.h).toBeLessThan(2.5);
    revisarCasa(M);
  });
  it('lote medianero angosto sin retiros laterales', () => {
    const M = buildModel(normalizarEstado({ ...ejemplo(), lot: rect(6, 30, 3), spots: [], ret: { front: 2, back: 3, lat: 0 } }));
    revisarCasa(M);
  });
  it('lote triangular', () => {
    revisarCasa(buildModel(normalizarEstado({ ...ejemplo(), lot: [{ x: 0, y: 0, z: 0 }, { x: 20, y: 0, z: 0 }, { x: 10, y: 25, z: 2 }], spots: [] })));
  });
  it('una casa de un piso con 4 espacios: ninguno sin puerta', () => {
    const S = ejemplo();
    S.floors = 1;
    S.rooms = S.rooms.filter(r => r.floor === 1).slice(0, 4);
    const M = buildModel(S);
    expect(M.warn.filter(w => /sin acceso/.test(w))).toEqual([]);
    revisarCasa(M);
  });
  it('si los retiros no dejan espacio, explica cuanto da', () => {
    const M = buildModel(normalizarEstado({ ...ejemplo(), lot: rect(6, 30), spots: [], ret: { front: 2, back: 3, lat: 1 } }));
    expect(M.err).toMatch(/frente útil da 4 m/);
  });
});

describe('avisos de los datos', () => {
  it('avisa del espacio en un piso que no existe', () => {
    const S = ejemplo();
    S.rooms[0].floor = 3;
    expect(buildModel(S).warn.some(w => /piso 3, pero la casa tiene 2/.test(w))).toBe(true);
  });
  it('avisa del area que no es un numero', () => {
    const S = ejemplo();
    S.rooms[0].area = 0;
    expect(buildModel(S).warn.some(w => /no tiene un área válida/.test(w))).toBe(true);
  });
  it('normalizarEstado nunca lanza y completa lo que falte', () => {
    for (const basura of [null, 3, 'x', {}, { lot: 'no' }, { rooms: [null, { area: 'abc' }] }, { lot: [{ x: 1, y: 2 }] }]) {
      const S = normalizarEstado(basura);
      expect(S.lot.length).toBeGreaterThanOrEqual(3);
      expect(buildModel(S).err).toBeUndefined();
    }
  });
});

describe('estructura', () => {
  it('las columnas crecen con los pisos', () => {
    expect(ladoColumna(2)).toBe(0.30);
    expect(ladoColumna(3)).toBe(0.35);
    expect(ladoColumna(5)).toBe(0.40);
  });
  it('ningun eje deja una luz mayor a 4.5 m', () => {
    const M = buildModel(ejemplo());
    for (const ax of [M.axX, M.axY]) for (let i = 1; i < ax.length; i++) expect(ax[i] - ax[i - 1]).toBeLessThanOrEqual(4.5 + 1e-6);
  });
  it('el replanteo se mide desde P1 en coordenadas del lote', () => {
    const S = normalizarEstado({ ...ejemplo(), lot: rect(12, 20).map(p => ({ ...p, x: p.x + 100, y: p.y + 50 })), spots: [] });
    const M = buildModel(S);
    for (const s of M.stake) expect(Math.hypot(s.x - 100, s.y - 50)).toBeCloseTo(s.d, 1);
  });
});

describe('plantillas', () => {
  for (const [k, p] of Object.entries(PLANTILLAS)) {
    it(`${k}: sin avisos y bien armada`, () => {
      const M = buildModel(p.estado());
      expect(M.warn).toEqual([]);
      revisarCasa(M);
    });
  }
});
