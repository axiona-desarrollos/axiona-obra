import { describe, it, expect } from 'vitest';
import { jsPDF } from 'jspdf';
import { escalaPara, pasoCuadricula, textoPDF, planoPDF } from '../src/motor/planoPDF.js';
import { nuevaSesion, enlaceSesion, sesionDelEnlace, cifrar, descifrar } from '../src/captura/envivo.js';
import { svgQR } from '../src/vista/qr.js';
import { lotedeEjemplo } from '../src/motor/ejemplo.js';
import { calcular } from '../src/motor/levantamiento.js';

describe('plano en PDF', () => {
  it('escoge la escala normalizada más grande que cabe', () => {
    expect(escalaPara(40, 50, 280, 250)).toBe(200);
    expect(escalaPara(8, 15, 280, 250)).toBe(75);
    expect(escalaPara(900, 700, 280, 250)).toBe(4000);
    expect(pasoCuadricula(200)).toBe(5);
    expect(pasoCuadricula(1000)).toBe(25);
  });
  it('cambia los signos que no traen las fuentes del PDF', () => {
    expect(textoPDF('N 35°20′ E → P2 − 3')).toBe("N 35°20' E - P2 - 3");
    expect(textoPDF('Área 120 m²')).toBe('Área 120 m²');
  });
  it('arma la hoja con dibujo, cuadros y rótulo, en A3 y carta', () => {
    const L = lotedeEjemplo();
    L.huella.activa = true;
    const D = calcular(L);
    const { doc, escala } = planoPDF(D, L, jsPDF, { hoja: 'A3', fecha: new Date('2026-10-30T12:00:00Z') });
    const pdf = doc.output();
    expect(pdf.startsWith('%PDF-')).toBe(true);
    for (const t of ['PLANO TOPOGRAFICO PRELIMINAR', 'CUADRO DE COORDENADAS', 'CUADRO DE LINDEROS', 'DATOS DEL TERRENO', 'AXIONA TOPO', `ESCALA 1:${escala}`, 'Fecha: 2026-10-30', 'OBRA']) expect(pdf).toContain(t);
    expect([200, 250, 300]).toContain(escala);
    const c = planoPDF(D, L, jsPDF, { hoja: 'carta' });
    expect(c.escala).toBeGreaterThan(escala);
    expect(c.doc.internal.pageSize.getWidth()).toBeCloseTo(279.4, 1);
  });
});

describe('sesión en vivo', () => {
  it('enlace de sesión ida y vuelta', () => {
    const s = nuevaSesion();
    expect(s.canal).toMatch(/^axtopo-[A-Za-z0-9]{20}$/);
    const e = enlaceSesion(s, 'https://topo.axionasoft.com/');
    expect(sesionDelEnlace(e.slice(e.indexOf('#')))).toEqual(s);
    expect(sesionDelEnlace('#v=otra.cosa')).toBeNull();
  });
  it('cifra y descifra; con otra llave no se puede leer', async () => {
    const s = nuevaSesion(), otra = nuevaSesion();
    const obj = { de: 'abc', t: 1, L: { v: 1, p: [['P1', 0, 0, 0, 0, 0, 0]] } };
    const c = await cifrar(obj, s.clave);
    expect(c).not.toContain('P1');
    expect(await descifrar(c, s.clave)).toEqual(obj);
    await expect(descifrar(c, otra.clave)).rejects.toBeTruthy();
    const c2 = await cifrar(obj, s.clave);
    expect(c2).not.toBe(c);
  });
});

describe('QR', () => {
  it('dibuja módulos negros sobre fondo blanco', () => {
    const s = svgQR('https://topo.axionasoft.com/#v=axtopo-abc.def');
    expect(s).toContain('fill="#fff"');
    expect(s).toMatch(/viewBox="0 0 (\d+) \1"/);
    expect(s.match(/h1v1h-1z/g).length).toBeGreaterThan(200);
  });
});
