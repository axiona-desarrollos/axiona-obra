/* global Request, process */
import { describe, it, expect } from 'vitest';
import { buildModel, normalizarEstado, clonar, DEFAULT_STATE, datosDePais } from '../src/motor/index.js';
import { ESTILOS, FACHADAS, TEJAS, PISOS, CIELOS } from '../src/motor/catalogo.js';
import { FORMAS } from '../src/motor/distribucion.js';
import { estadoDesdeBoceto, resumenBoceto } from '../src/asistente/boceto.js';
import { ENUMS, ESQUEMA } from '../netlify/functions/boceto.mjs';

const base = () => normalizarEstado({ ...clonar(DEFAULT_STATE), ...datosDePais('CO'), nombre: 'Mi casa', floors: 1, rooms: [{ name: 'Sala-comedor', area: 22, floor: 1, zone: 'social' }] });
const lectura = {
  lectura: 'Casa de dos pisos con piscina interior.', confianza: 'media', nombre_proyecto: 'Casa boceto', lote: { frente: 40, fondo: 60 }, pisos: 2,
  espacios: [
    { nombre: 'Sala', area: 50, piso: 1, zona: 'social' }, { nombre: 'Comedor', area: 30, piso: 1, zona: 'social' }, { nombre: 'Cocina', area: 28, piso: 1, zona: 'servicio' },
    { nombre: 'Escalera', area: 10, piso: 1, zona: 'social' }, { nombre: 'Alcoba', area: 22, piso: 2, zona: 'privada' }, { nombre: 'Alcoba', area: 22, piso: 2, zona: 'privada' },
    { nombre: 'Alcoba principal', area: 40, piso: 2, zona: 'privada' }, { nombre: 'Baño principal', area: 14, piso: 2, zona: 'servicio' },
  ],
  estilo: 'moderno', forma: 'escalonada', cubierta: 'cuatro', fachada: 'estuco', fachada_primer_piso: 'piedraClara', teja: 'pizarra',
  piso_social: 'marmolNegro', piso_alcobas: 'parque', piso_banos: 'marmolBlanco', cielo: 'listones',
  piscina: { tiene: true, interior: true, largo: 12, ancho: 5, profundidad: 1.6 }, parqueaderos: 4,
  chimenea: true, pergola: true, ascensor: true, balcones: true, curvas: false, supuestos: ['Áreas de alcobas estimadas'], dudas: [],
};

describe('Axi lee bocetos', () => {
  it('las opciones que puede responder Claude existen en el catálogo de la app', () => {
    expect(ENUMS.estilo.sort()).toEqual(Object.keys(ESTILOS).sort());
    expect(ENUMS.forma.sort()).toEqual(Object.keys(FORMAS).sort());
    expect(ENUMS.fachada.sort()).toEqual(Object.keys(FACHADAS).sort());
    expect(ENUMS.teja.sort()).toEqual(Object.keys(TEJAS).sort());
    expect(ENUMS.piso.sort()).toEqual(Object.keys(PISOS).sort());
    expect(ENUMS.cielo.sort()).toEqual(Object.keys(CIELOS).sort());
    expect(ESQUEMA.required).toEqual(expect.arrayContaining(['espacios', 'pisos', 'lote', 'piscina', 'estilo']));
  });
  it('del boceto sale un proyecto completo que el motor arma sin errores', () => {
    const S = normalizarEstado(estadoDesdeBoceto(lectura, base()));
    expect(S.floors).toBe(2);
    expect(S.rooms.some(r => /escalera/i.test(r.name))).toBe(false); // la escalera la arma el motor
    expect(S.rooms.filter(r => r.name.startsWith('Alcoba')).map(r => r.name)).toEqual(['Alcoba', 'Alcoba 2', 'Alcoba principal']);
    expect(S.rooms.find(r => r.name === 'Piscina interior')).toBeTruthy();
    expect(S.piscina).toMatchObject({ on: true, interior: true, largo: 12, ancho: 5 });
    expect(S.acabados).toMatchObject({ estilo: 'moderno', fachadaBase: 'piedraClara', teja: 'pizarra', cielo: 'listones' });
    expect(S.acabados.pisos['1:Sala']).toBe('marmolNegro');
    expect(S.acabados.pisos['2:Alcoba principal']).toBe('parque');
    expect(S.parqueo).toMatchObject({ on: true, n: 4 });
    const M = buildModel(S);
    expect(M.err).toBeFalsy();
    expect(M.exterior.piscina?.interior).toBe(true);
  });
  it('sin cotas del lote calcula uno que alcanza; valores raros se acotan', () => {
    const S = estadoDesdeBoceto({ ...lectura, lote: { frente: 0, fondo: 0 }, pisos: 40, espacios: [{ nombre: 'Sala', area: 9999, piso: 9, zona: 'x' }], piscina: { tiene: false } }, base());
    expect(S.floors).toBe(6);
    expect(S.rooms[0]).toMatchObject({ area: 400, floor: 6, zone: 'social' });
    expect(S.lot[2].x).toBeGreaterThanOrEqual(10);
    expect(buildModel(normalizarEstado(S)).err).toBeFalsy();
  });
  it('el resumen para el chat dice lote, pisos, espacios y piscina', () => {
    const t = resumenBoceto(lectura, (es) => es);
    expect(t).toMatch(/40 × 60/); expect(t).toMatch(/2 pisos/); expect(t).toMatch(/piscina interior de 12 × 5/);
  });
});

// Respuesta real de /api/boceto (Claude) al leer la foto del boceto de la mansión con piscina interior
import { readFileSync } from 'node:fs';
const RESPUESTA = JSON.parse(readFileSync(new URL('./fixtures/boceto_mansion.json', import.meta.url), 'utf8'));

describe('Boceto real: mansión con piscina interior', () => {
  it('arma el modelo completo: 2 pisos, 19 espacios + salón de la piscina, acabados del boceto', () => {
    const S = estadoDesdeBoceto(RESPUESTA, base());
    expect(S.floors).toBe(2);
    expect(S.rooms.length).toBe(20);
    expect(S.rooms.find(r => /piscina/i.test(r.name))?.floor).toBe(1);
    expect(S.piscina).toMatchObject({ on: true, interior: true, largo: 12, ancho: 5 });
    expect(S.forma.tipo).toBe('escalonada');
    expect(S.acabados).toMatchObject({ teja: 'pizarra', cielo: 'listones', fachadaBase: 'piedraClara' });
    expect(S.acabados.pisos['1:Sala']).toBe('marmolNegro');
    expect(S.ascensor && S.chimenea && S.pergola).toBe(true);
    expect(S.parqueo).toMatchObject({ on: true, n: 4 });
    const M = buildModel(normalizarEstado(S));
    expect(M.err).toBeFalsy();
    expect(M.F).toBe(2);
  });
  it('Axi le pasa a la app una sola acción (no una lista) al crear el modelo', () => {
    const src = readFileSync(new URL('../src/asistente/axi.js', import.meta.url), 'utf8');
    expect(src).not.toMatch(/A\.ejecutar\(\s*\[/);
    expect(src).toMatch(/A\.ejecutar\(\{ tipo: 'boceto'/);
  });
});

// /api/boceto es exclusivo del equipo Axiona: sin la clave no llama a Claude (no gasta créditos)
import funcionBoceto, { claveValida } from '../netlify/functions/boceto.mjs';
describe('Lectura de bocetos: solo el equipo Axiona', () => {
  const pedir = (cuerpo, clave) => funcionBoceto(new Request('http://local/api/boceto', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(clave ? { 'x-axiona-equipo': clave } : {}) }, body: JSON.stringify(cuerpo) }));
  it('sin clave o con clave equivocada responde «exclusivo» (403)', async () => {
    process.env.BOCETO_CLAVE = 'AXIONA-PRUEBA-1234';
    for (const clave of [null, 'otra', 'AXIONA-PRUEBA-123']) {
      const r = await pedir({ verificar: true }, clave);
      expect(r.status).toBe(403);
      expect((await r.json()).error).toBe('exclusivo');
    }
  });
  it('con la clave del equipo verifica sin llamar a Claude', async () => {
    process.env.BOCETO_CLAVE = 'AXIONA-PRUEBA-1234';
    const r = await pedir({ verificar: true }, 'AXIONA-PRUEBA-1234');
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ ok: true });
  });
  it('si el sitio no tiene clave configurada, nadie entra', async () => {
    delete process.env.BOCETO_CLAVE;
    expect((await pedir({ verificar: true }, 'cualquiera')).status).toBe(403);
    expect(claveValida('x', '')).toBe(false);
  });
});
