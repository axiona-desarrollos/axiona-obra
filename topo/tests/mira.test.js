import { describe, it, expect } from 'vitest';
import { conDistancia, conMira, alturaObjeto, elevacionCamara, calibracionPorInversion, pendienteDe, incertidumbre } from '../src/motor/mira.js';
import { partir } from '../src/vista/holo.js';
import { svgPlano, svgPerfil } from '../src/vista/plano.js';
import { calcular, normalizar } from '../src/motor/levantamiento.js';
import { perfil } from '../src/motor/tin.js';

const grados = r => r * 180 / Math.PI;

describe('mira', () => {
  it('con distancia: un punto 1 m más arriba a 20 m', () => {
    const alfa = grados(Math.atan(1 / 20));
    const r = conDistancia({ D: 20, alfa, hi: 1.5, ht: 1.5 });
    expect(r.dH).toBeCloseTo(1, 9);
    expect(r.error).toBeGreaterThan(0.05);
    expect(r.error).toBeLessThan(0.1);
    expect(conDistancia({ D: 0, alfa: 3 })).toBeNull();
  });
  it('con mira de 2 m: distancia y desnivel sin cinta', () => {
    // Estacion con el celular a 1,5 m; punto 15 m adelante y 0,8 m mas abajo
    const D = 15, hi = 1.5, dz = -0.8;
    const pie = grados(Math.atan((dz - hi) / D)), punta = grados(Math.atan((dz + 2 - hi) / D));
    const r = conMira({ L: 2, alfaPie: pie, alfaPunta: punta, hi });
    expect(r.D).toBeCloseTo(15, 9);
    expect(r.dH).toBeCloseTo(-0.8, 9);
    expect(conMira({ L: 2, alfaPie: 5, alfaPunta: 5 })).toBeNull();
  });
  it('altura de un poste a 10 m', () => {
    const r = alturaObjeto({ D: 10, alfaPie: grados(Math.atan(-1.5 / 10)), alfaPunta: grados(Math.atan(6.5 / 10)) });
    expect(r.h).toBeCloseTo(8, 9);
  });
  it('ángulo de la cámara con beta y gamma', () => {
    expect(elevacionCamara(90, 0)).toBeCloseTo(0, 9);
    expect(elevacionCamara(0, 0)).toBeCloseTo(-90, 9);
    expect(elevacionCamara(180, 0)).toBeCloseTo(90, 9);
    expect(elevacionCamara(80, 0)).toBeCloseTo(-10, 9);
    expect(elevacionCamara(90, 35)).toBeCloseTo(0, 9);
  });
  it('calibración por inversión y pendientes', () => {
    const c = calibracionPorInversion(1.3, -0.7);
    expect(c.cero).toBeCloseTo(0.3); expect(c.inclinacion).toBeCloseTo(1);
    expect(pendienteDe(45).pct).toBeCloseTo(100);
    expect(pendienteDe(1).mmPorM).toBeCloseTo(17.455, 2);
    expect(incertidumbre(20, 0)).toBeCloseTo(20 * 0.2 * Math.PI / 180, 9);
  });
});

describe('vistas', () => {
  const D = calcular(normalizar({
    puntos: [
      { x: 0, y: 0, z: 0 }, { x: 20, y: 0, z: 1 }, { x: 20, y: 30, z: 4 }, { x: 0, y: 30, z: 3 },
      { tipo: 'nivel', x: 10, y: 15, z: 2.2 },
    ],
  }));
  it('partir un triángulo por la plataforma', () => {
    const r = partir([{ x: 0, y: 0, z: 2 }, { x: 4, y: 0, z: -2 }, { x: 0, y: 4, z: -2 }], 0);
    expect(r.arriba.length).toBe(3);
    expect(r.abajo.length).toBe(4);
    expect(partir([{ x: 0, y: 0, z: 1 }, { x: 1, y: 0, z: 1 }, { x: 0, y: 1, z: 1 }], 0).abajo).toEqual([]);
  });
  it('el plano SVG trae lindero, medidas, curvas y escala', () => {
    const s = svgPlano(D, { curvas: true, tierra: true });
    expect(s.startsWith('<svg')).toBe(true);
    expect(s).toContain('20,00 m');
    expect(s).toContain('30,00 m');
    expect((s.match(/class="t-esq"/g) || []).length).toBe(4);
    expect(s).toContain('t-curva');
    expect(s).toContain('Frente: P1 → P2');
    expect(svgPlano(D, { pendiente: true, norte: true })).toContain('>N</text>');
  });
  it('el perfil SVG del escáner', () => {
    const pr = perfil(D.T, { x: -1, y: 15 }, { x: 21, y: 15 }, 40);
    const s = svgPerfil(pr, D.plataforma.z);
    expect(s).toContain('plataforma');
    expect(svgPerfil([{ d: 0, z: null }], 0)).toBe('');
  });
});

describe('importar puntos', async () => {
  const { leerPuntos } = await import('../src/motor/importar.js');
  it('PNEZD de una estación total', () => {
    const r = leerPuntos('1,1000.000,500.000,100.000,LINDERO\n2,1000.000,520.000,100.500,LINDERO\n3,1030.000,520.000,102.000,lindero\n4,1030,500,101.2,MOJON\n5,1015,510,101.0,TN\n');
    expect(r.puntos.length).toBe(5);
    expect(r.puntos[1]).toMatchObject({ id: 'P2', tipo: 'esquina', x: 20, y: 0, z: 0.5 });
    expect(r.puntos[4]).toMatchObject({ id: 'N1', tipo: 'nivel', x: 10, y: 15, z: 1 });
    expect(r.aviso).toBe('');
  });
  it('punto y coma con coma decimal, encabezado y XYZ', () => {
    const r = leerPuntos('P;N;E;Z;D\nA1;10,5;20,25;1,5;esquina\nA2;12;25;2;arbol\n');
    expect(r.puntos[0]).toMatchObject({ id: 'A1', tipo: 'esquina' });
    expect(r.puntos[1]).toMatchObject({ x: 4.75, y: 1.5, z: 0.5 });
    const x = leerPuntos('0 0 0\n10 0 1\n10 10 2\n', 'XYZ');
    expect(x.puntos.length).toBe(3);
    expect(x.aviso).toMatch(/esquina/);
    expect(leerPuntos('').puntos).toEqual([]);
  });
});
