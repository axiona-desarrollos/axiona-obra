import { describe, it, expect } from 'vitest';
import { buildModel, DEFAULT_STATE, clonar, normalizarEstado, totales, datosDePais, PISOS, FACHADAS, TEJAS } from '../src/motor/index.js';
import { exterior, piscinaDe } from '../src/motor/exterior.js';
import { planSVG } from '../src/ui/planos.js';
import { existsSync } from 'node:fs';

const base = (cambios = {}, pais = 'CO') => normalizarEstado({ ...clonar(DEFAULT_STATE), ...datosDePais(pais), ...cambios });

describe('Fase 2 · materiales fotorrealistas', () => {
  it('cada material con foto tiene sus tres mapas y su miniatura en public/texturas', () => {
    const claves = new Set([...Object.values(PISOS), ...Object.values(FACHADAS), ...Object.values(TEJAS)].filter(a => a.pbr).map(a => a.pbr));
    expect(claves.size).toBeGreaterThan(12);
    claves.forEach(k => ['color', 'normal', 'rough', 'mini'].forEach(m => expect(existsSync(`public/texturas/${k}/${m}.jpg`), `${k}/${m}`).toBe(true)));
  });
  it('los pisos nuevos tienen precio en los cuatro países y patrón para el plano', () => {
    Object.values(PISOS).filter(p => p.pbr).forEach(p => {
      ['CO', 'ES', 'CA', 'MX'].forEach(c => expect(p.precio[c], p.cod).toBeGreaterThan(0));
      expect(p.tex).toMatch(/baldosa|marmol|madera|cemento/);
      expect(p.m).toBeGreaterThan(0.5);
    });
  });
  it('la fachada de ladrillo reemplaza la pintura exterior en los cuatro países y la teja suma su mayor valor', () => {
    for (const pais of ['CO', 'ES', 'CA', 'MX']) {
      const S0 = base({}, pais); S0.cubierta.tipo = 'dos';
      const S1 = normalizarEstado({ ...clonar(S0), acabados: { ...S0.acabados, fachada: 'ladrillo', teja: 'pizarra' } });
      const M0 = buildModel(S0), M1 = buildModel(S1);
      expect(M1.quant.items.some(i => ['pext', 'pintExt', 'revest'].includes(i.k)), pais).toBe(false);
      const f = M1.quant.items.find(i => i.k === 'fach:ladrillo');
      expect(f.q, pais).toBeCloseTo(M1.quant.Q.AextN, 1);
      expect(M1.quant.items.find(i => i.k === 'teja:pizarra').q, pais).toBeGreaterThan(10);
      expect(totales(M1, S1.prices, pais).total, pais).toBeGreaterThan(totales(M0, S0.prices, pais).total);
    }
  });
});

describe('Fase 2 · piscina, parqueadero y vía', () => {
  it('la piscina va en el patio, dentro del lote y sin pisar la casa', () => {
    const S = base({ piscina: { on: true, largo: 8, ancho: 4, prof: 1.5 } });
    const M = buildModel(S), P = M.exterior.piscina;
    expect(P).toBeTruthy();
    expect(P.y0).toBeGreaterThan(M.R.y1);
    expect(P.w).toBe(8); expect(P.h).toBe(4);
    expect(P.litros).toBe(48000);
    expect(M.quant.items.map(i => i.k)).toEqual(expect.arrayContaining(['pisc:exc', 'pisc:vaso', 'pisc:mosaico', 'pisc:equipo']));
  });
  it('si no cabe lo dice, y no la cobra', () => {
    const S = base({ piscina: { on: true, largo: 25, ancho: 12, prof: 2 } });
    const M = buildModel(S);
    expect(M.exterior.piscina).toBeNull();
    expect(M.warn.join(' ')).toMatch(/No cabe una piscina/);
    expect(M.quant.items.some(i => i.k.startsWith('pisc:exc'))).toBe(false);
  });
  it('la piscina arrastrada se queda donde la dejaron si cabe', () => {
    const S = base({ piscina: { on: true, largo: 6, ancho: 3, prof: 1.4, x: 5, y: 15 } });
    const P = buildModel(S).exterior.piscina;
    expect(P.manual).toBe(true);
    expect((P.x0 + P.x1) / 2).toBeCloseTo(5, 2);
    expect((P.y0 + P.y1) / 2).toBeCloseTo(15, 2);
  });
  it('las medidas se limitan a valores razonables', () => {
    expect(piscinaDe({ piscina: { on: true, largo: 90, ancho: 0.2, prof: 9 } })).toMatchObject({ largo: 25, ancho: 1.5, prof: 3 });
  });
  it('el parqueadero va atrás si el antejardín no alcanza, y la vía queda frente al lindero del frente', () => {
    const S = base({ parqueo: { on: true, n: 2 } });
    const M = buildModel(S);
    expect(M.exterior.parqueo.donde).toBe('atras');
    expect(M.exterior.parqueo.cajones).toHaveLength(2);
    const X = exterior(M, S);
    expect(X.via.anden).toBe(2);
    expect(X.via.x1 - X.via.x0).toBeGreaterThan(30);
  });
});

describe('Fase 2 · editar a mano', () => {
  it('mover, girar, cambiar medida y agregar muebles', () => {
    const S = base({ muebles: { quitar: [], mover: { '1-sala-sofa': { x: 4, y: 3, rot: 95, w: 2.6 } }, extra: [{ id: 'x1', tipo: 'poltrona', f: 0, x: 3, y: 4, rot: 270 }] } });
    const M = buildModel(S);
    const sofa = M.muebles.find(m => m.id === '1-sala-sofa');
    expect(sofa).toMatchObject({ x: 4, y: 3, rot: 90, w: 2.6, movido: true });
    const nueva = M.muebles.find(m => m.id === 'x1');
    expect(nueva).toMatchObject({ tipo: 'poltrona', rot: 270, agregado: true, w: 0.82 });
    expect(M.quant.Q.dotacion.poltrona).toBeGreaterThanOrEqual(1);
  });
  it('el estado ignora lo que no sirve (muebles de obra agregados, cotas sin números)', () => {
    const S = normalizarEstado({ ...clonar(DEFAULT_STATE), muebles: { extra: [{ id: 'x', tipo: 'noExiste', f: 0, x: 1, y: 1 }], mover: { a: 'mal' } }, cotas: [{ f: 0, x0: 1, y0: 1, x1: 'x', y1: 2 }, { f: 0, x0: 1, y0: 1, x1: 4, y1: 1 }] });
    expect(S.muebles.extra).toEqual([]);
    expect(S.muebles.mover).toEqual({});
    expect(S.cotas).toHaveLength(1);
  });
  it('las cotas del ingeniero salen en la planta con su medida', () => {
    const S = base({ cotas: [{ f: 0, x0: 1, y0: 2, x1: 4.5, y1: 2, off: -0.8 }] });
    const svg = planSVG(buildModel(S), 'p1', 'print');
    expect(svg).toMatch(/#e8590c/);
    expect(svg).toMatch(/3[.,]50/);
    expect(svg).toMatch(/data-ex0="/);
  });
  it('la piscina sale en la implantación con sus medidas', () => {
    const svg = planSVG(buildModel(base({ piscina: { on: true, largo: 8, ancho: 4, prof: 1.5 } })), 'sitio', 'print');
    expect(svg).toMatch(/PISCINA/);
  });
});

describe('Ejemplo inicial · mansión campestre Llano Grande', () => {
  it('arma la casa completa sin avisos: piscina, pérgola, chimenea, parqueadero y ventanales', async () => {
    const { ejemploInicial } = await import('../src/motor/index.js');
    const S = normalizarEstado(ejemploInicial());
    const M = buildModel(S);
    expect(M.err).toBeFalsy();
    expect(M.warn).toEqual([]);
    expect(M.F).toBe(2);
    expect(M.built).toBeGreaterThan(450);
    expect(M.exterior.piscina).toMatchObject({ w: 14, h: 5 });
    expect(M.exterior.pergola).toBeTruthy();
    expect(M.exterior.chimenea?.room).toBe('Sala');
    expect(M.exterior.parqueo.cajones).toHaveLength(4);
    expect(M.floors[0].ops.some(o => o.ventanal && o.sill < 0.2)).toBe(true);
    const ks = M.quant.items.map(i => i.k);
    expect(ks).toEqual(expect.arrayContaining(['fach:piedraClara', 'cielo:listones', 'teja:pizarra', 'pisc:pergola', 'pisc:chimenea', 'pisc:vaso']));
  });
  it('la chimenea no pisa la pérgola ni la piscina', async () => {
    const { ejemploInicial } = await import('../src/motor/index.js');
    const X = buildModel(normalizarEstado(ejemploInicial())).exterior;
    const choca = (a, b) => a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0;
    expect(choca(X.chimenea, X.pergola)).toBe(false);
    expect(X.piscina.y0).toBeGreaterThan(X.pergola.y1);
  });
});
