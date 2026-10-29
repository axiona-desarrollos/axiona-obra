import { describe, it, expect } from 'vitest';
import { leerTexto, leerDXF, numero, programaTipico } from '../src/motor/lector.js';
import { lotear } from '../src/motor/condominio.js';

const valor = (r, k) => r.datos.find(d => d.k === k)?.v;

describe('lector de documentos', () => {
  it('numeros en español e ingles', () => {
    expect(numero('1.234,56')).toBe(1234.56);
    expect(numero('12,5')).toBe(12.5);
    expect(numero('1,250', true)).toBe(1250);
    expect(numero('9.50')).toBe(9.5);
  });
  it('estudio de suelos colombiano', () => {
    const r = leerTexto(`ESTUDIO GEOTECNICO · Proyecto: Casa Los Almendros
Propietario: María Fernanda Restrepo
Dirección: Calle 75 Sur # 43-21, Sabaneta
Matrícula inmobiliaria No. 001-1234567
Lote con frente de 9,50 m y fondo de 18,00 m. Área del lote: 171 m2.
Edificación de 2 pisos con 3 alcobas y 2 baños. NSR-10, curaduría.
Perfil de suelo tipo D. Aa = 0,15 y Av = 0,20.
Capacidad portante admisible: 12 t/m2 a una profundidad de desplante de 1,50 m.
Retiro frontal 3,0 m; retiro posterior 2,5 m. Índice de ocupación 70 %.
Ingeniero civil: Carlos Andrés Gómez, M.P. 05202-123456`);
    expect(r.pais).toBe('CO');
    expect(valor(r, 'frente')).toBeCloseTo(9.5, 6);
    expect(valor(r, 'fondo')).toBeCloseTo(18, 6);
    expect(valor(r, 'areaLote')).toBeCloseTo(171, 6);
    expect(valor(r, 'pisos')).toBe(2);
    expect(valor(r, 'alcobas')).toBe(3);
    expect(valor(r, 'banos')).toBe(2);
    expect(valor(r, 'qadm')).toBeCloseTo(12, 6);
    expect(valor(r, 'desp')).toBeCloseTo(1.5, 6);
    expect(valor(r, 'aa')).toBeCloseTo(0.15, 6);
    expect(valor(r, 'av')).toBeCloseTo(0.2, 6);
    expect(valor(r, 'retFrente')).toBeCloseTo(3, 6);
    expect(valor(r, 'retFondo')).toBeCloseTo(2.5, 6);
    expect(valor(r, 'occ')).toBeCloseTo(0.7, 6);
    expect(valor(r, 'perfil')).toBe('D');
    expect(valor(r, 'predio')).toBe('001-1234567');
    expect(valor(r, 'propietario')).toMatch(/María Fernanda/);
    expect(r.datos.find(d => d.k === 'profesional')?.v.doc).toBe('05202-123456');
    expect(r.datos.find(d => d.k === 'qadm').frag).toMatch(/Capacidad portante/);
  });
  it('documento canadiense en pies y kPa', () => {
    const r = leerTexto(`Building permit application - City of Toronto, Ontario. Part 9 house.
Lot frontage: 40 ft. Lot depth 120 ft. Front yard setback 6.0 m.
Allowable bearing pressure 150 kPa. Frost depth 1.2 m. Ss = 1.0 kPa.
Two storeys, 4 bedrooms, 3 bathrooms.`);
    expect(r.pais).toBe('CA');
    expect(valor(r, 'frente')).toBeCloseTo(12.192, 3);
    expect(valor(r, 'fondo')).toBeCloseTo(36.576, 3);
    expect(valor(r, 'qadm')).toBeCloseTo(150 / 9.80665, 3);
    expect(valor(r, 'helada')).toBeCloseTo(1.2, 6);
    expect(valor(r, 'nieve')).toBeCloseTo(1.0, 6);
    expect(valor(r, 'alcobas')).toBe(4);
  });
  it('programa tipico con baño social en casas de dos pisos', () => {
    const p = programaTipico(3, 2, 2, 'es');
    expect(p.filter(r => /Alcoba/.test(r.name)).length).toBe(3);
    expect(p.some(r => r.name === 'Baño social' && r.floor === 1)).toBe(true);
  });
  it('DXF: el poligono cerrado mas grande es el lote', () => {
    const dxf = ['0', 'SECTION', '2', 'HEADER', '9', '$INSUNITS', '70', '6', '0', 'ENDSEC', '0', 'SECTION', '2', 'ENTITIES',
      '0', 'LWPOLYLINE', '8', 'LOTE', '90', '4', '70', '1', '10', '100', '20', '200', '10', '112', '20', '200', '10', '112', '20', '218', '10', '100', '20', '218',
      '0', 'TEXT', '8', 'T', '10', '0', '20', '0', '40', '1', '1', 'Area del lote: 216 m2',
      '0', 'ENDSEC', '0', 'EOF'].join('\n');
    const d = leerDXF(dxf);
    expect(d.poly.length).toBe(4);
    expect(d.area).toBeCloseTo(216, 6);
    expect(d.poly[1].x).toBeCloseTo(12, 6);
    expect(d.textos).toMatch(/216/);
  });
});

describe('condominio', () => {
  it('lotes a lado y lado de la via, todos dentro del terreno', () => {
    const macro = [{ x: 0, y: 0 }, { x: 96, y: 0 }, { x: 96, y: 74 }, { x: 0, y: 74 }];
    const L = lotear(macro, { via: 8, frente: 12, fondo: 20 });
    expect(L.dosFilas).toBe(true);
    expect(L.lotes.length).toBe(14);
    expect(new Set(L.lotes.map(l => l.lado))).toEqual(new Set(['N', 'S']));
    for (const l of L.lotes) for (const p of l.poly) { expect(p.x).toBeGreaterThanOrEqual(-0.01); expect(p.x).toBeLessThanOrEqual(96.01); }
  });
});
