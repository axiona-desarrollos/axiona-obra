import { describe, it, expect } from 'vitest';
import { jsPDF } from 'jspdf';
import { escalaPara, pasoCuadricula, textoPDF, planoPDF } from '../src/motor/planoPDF.js';
import { nuevaSesion, enlaceSesion, sesionDelEnlace, cifrar, descifrar, trocear, armador, gana } from '../src/captura/envivo.js';
import { aCorto, deCorto } from '../src/motor/compartir.js';
import { normalizar } from '../src/motor/levantamiento.js';
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

describe('sesión en vivo: trozos y versiones', () => {
  it('un texto largo sale en trozos y se arma aunque lleguen desordenados', () => {
    const texto = 'x'.repeat(9000) + 'FIN';
    const t = trocear(texto, 3800);
    expect(t.length).toBe(3);
    expect(t.every(m => m.length <= 3800 + 20)).toBe(true);
    const armar = armador();
    expect(armar(t[2])).toBeNull();
    expect(armar(t[0])).toBeNull();
    expect(armar(t[0])).toBeNull();
    expect(armar(t[1])).toBe(texto);
    expect(armador()(trocear('corto')[0])).toBe('corto');
    expect(armador()('basura')).toBeNull();
  });
  it('un levantamiento de 600 puntos viaja cifrado en varios mensajes y llega igual', async () => {
    const s = nuevaSesion();
    const puntos = [];
    for (let i = 0; i < 600; i++) puntos.push({ tipo: i < 6 ? 'esquina' : 'nivel', x: (i % 30) * 1.37, y: Math.floor(i / 30) * 1.91, z: Math.sin(i) * 2, fuente: 'archivo' });
    const L = normalizar({ nombre: 'Grande', puntos });
    const c = await cifrar({ de: 'a', v: 7, L: aCorto(L) }, s.clave);
    const trozos = trocear(c);
    expect(trozos.length).toBeGreaterThan(1);
    const armar = armador();
    let completo = null;
    for (const m of trozos) completo = armar(m) ?? completo;
    const d = await descifrar(completo, s.clave);
    const B = deCorto(d.L);
    expect(d.v).toBe(7);
    expect(B.puntos.length).toBe(600);
    expect(B.puntos[599].x).toBeCloseTo(puntos[599].x, 2);
  });
  it('gana la versión más alta y, si empatan, el mismo equipo en los dos lados', () => {
    expect(gana(5, 'aaa', 4, 'zzz')).toBe(true);
    expect(gana(3, 'zzz', 4, 'aaa')).toBe(false);
    expect(gana(4, 'b', 4, 'a')).toBe(true);
    expect(gana(4, 'a', 4, 'b')).toBe(false);
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
