import { describe, it, expect, afterEach } from 'vitest';
import {
  buildModel, DEFAULT_STATE, PLANTILLAS, ESTILOS, clonar, normalizarEstado, totales, tr, setIdioma,
  traducirEspacios, traducirNombre,
} from '../src/motor/index.js';
import { interpretar, noEntendi } from '../src/asistente/cerebro.js';
import { instrucciones } from '../src/asistente/llm.js';
import { FAQ, CAPACIDADES } from '../src/asistente/saber.js';

function contexto(S) {
  const M = buildModel(S), T = totales(M, S.prices, S.pais);
  return {
    S, M, total: T.total, m2: T.total / M.built, money: v => `$ ${Math.round(v)}`, fmtA: v => `${v.toFixed(1)} m²`,
    estilos: Object.fromEntries(Object.entries(ESTILOS).map(([k, E]) => [k, tr(E.n)])),
    plantillas: Object.fromEntries(Object.entries(PLANTILLAS[S.pais]).map(([k, p]) => [k, tr(p.titulo)])),
    sistemas: [['porticos', 'concrete frames'], ['confinada', 'confined masonry']], paisNombre: 'Colombia',
  };
}
/** El proyecto de ejemplo como lo ve quien escogió inglés: app en inglés y espacios con nombres en inglés. */
function enIngles() {
  const S = normalizarEstado({ ...clonar(DEFAULT_STATE), idioma: 'en' });
  traducirEspacios(S, 'en');
  const ctx = contexto(S);
  setIdioma('en');
  return ctx;
}

afterEach(() => setIdioma('es'));

describe('Axi en inglés: entiende y responde en el idioma escogido', () => {
  it('agrega espacios con nombre en inglés, área y piso', () => {
    const ctx = enIngles();
    const r = interpretar('Add a 12 m² bedroom on the second floor', ctx);
    expect(r.hacer).toEqual([{ tipo: 'room+', room: { name: 'Bedroom', area: 12, floor: 2, zone: 'privada' } }]);
    expect(r.dice).toMatch(/^[A-Z][a-z ]/);
    expect(r.dice).not.toMatch(/Agregué|alcoba/);
    const r2 = interpretar('add two bathrooms', ctx);
    expect(r2.hacer.map(h => h.room.name)).toEqual(['Bathroom', 'Bathroom 3']);
  });

  it('cambia pisos, acabados, estilo, cubierta y forma', () => {
    const ctx = enIngles();
    expect(interpretar('set 3 floors', ctx).hacer).toEqual([{ tipo: 'set', p: 'floors', v: 3 }]);
    expect(interpretar('I want a 3-storey house', ctx).hacer[0]).toMatchObject({ p: 'floors', v: 3 });
    expect(interpretar('porcelain tile in the whole house', ctx).hacer).toEqual([{ tipo: 'piso', key: '*', k: 'porc' }]);
    expect(interpretar('wood in the main bedroom', ctx).hacer).toEqual([{ tipo: 'piso', key: '2:Main bedroom', k: 'roble' }]);
    expect(interpretar('modern style', ctx).hacer).toEqual([{ tipo: 'estilo', k: 'moderno' }]);
    expect(interpretar('gable roof', ctx).hacer[0]).toMatchObject({ p: 'cubierta.tipo', v: 'dos' });
    expect(interpretar('make it L-shaped', ctx).hacer[0]).toMatchObject({ p: 'forma.tipo', v: 'ele' });
    expect(interpretar('U-shaped please', ctx).hacer[0]).toMatchObject({ p: 'forma.tipo', v: 'u' });
    expect(interpretar('a house with a courtyard', ctx).hacer[0]).toMatchObject({ p: 'forma.tipo', v: 'patio' });
    expect(interpretar('add curves', ctx).hacer).toEqual([{ tipo: 'set', p: 'forma.curvas', v: true }]);
    expect(interpretar('lot of 10 by 20', ctx).hacer).toEqual([{ tipo: 'lote', w: 10, d: 20 }]);
  });

  it('quita, agranda y pasa de piso los espacios con nombre en inglés', () => {
    const ctx = enIngles();
    const iEst = ctx.S.rooms.findIndex(r => r.name === 'Study');
    expect(iEst).toBeGreaterThan(-1);
    expect(interpretar('remove the study', ctx).hacer).toEqual([{ tipo: 'room-', i: iEst }]);
    const iSala = ctx.S.rooms.findIndex(r => r.name === 'Living room');
    expect(interpretar('make the living room bigger', ctx).hacer[0]).toMatchObject({ tipo: 'room=', i: iSala });
    expect(interpretar('move the study to floor 2', ctx).hacer).toEqual([{ tipo: 'room=', i: iEst, cambios: { floor: 2 } }]);
  });

  it('navega, muestra el 3D por fases, descarga y abre la AR', () => {
    const ctx = enIngles();
    expect(interpretar('show me the drawings', ctx).hacer).toEqual([{ tipo: 'tab', tab: 'planos' }]);
    expect(interpretar('show me the bricks', ctx).hacer).toEqual([{ tipo: 'tab', tab: 'modelo' }, { tipo: 'fase', cat: 'negra' }]);
    expect(interpretar('download the PDF', ctx).hacer.map(h => h.a || h.tab)).toEqual(['planos', 'expPDF']);
    expect(interpretar('show me the house in augmented reality', ctx).hacer).toEqual([{ tipo: 'act', a: 'arAxMaqueta' }]);
  });

  it('responde datos, dudas y ayuda en inglés', () => {
    const ctx = enIngles();
    expect(interpretar('hello', ctx).dice).toMatch(/^Hi! I’m Axi/);
    expect(interpretar('how much does it cost?', ctx).dice).toMatch(/The estimated budget is/);
    expect(interpretar('which rooms are there', ctx).dice).toMatch(/Floor 1: Living room/);
    expect(interpretar('is it free?', ctx).dice).toMatch(/The app is free and open source/);
    expect(interpretar('what can you do', ctx).dice).toMatch(/This is what I can do/);
    expect(interpretar('does it only make boxes or organic shapes?', ctx).dice).toMatch(/Not just boxes/);
    expect(interpretar('I want to talk to a person', ctx).hacer).toEqual([{ tipo: 'contacto' }]);
    expect(noEntendi().dice).not.toMatch(/No entendí/);
  });

  it('cambia de idioma cuando se lo piden, y explica los idiomas cuando preguntan', () => {
    const ctx = enIngles();
    expect(interpretar('in spanish', ctx).hacer).toEqual([{ tipo: 'idioma', l: 'es' }]);
    setIdioma('es');
    expect(interpretar('háblame en inglés', ctx).hacer).toEqual([{ tipo: 'idioma', l: 'en' }]);
    const q = interpretar('qué idiomas tiene la app', ctx);
    expect(q.hacer).toEqual([]);
    expect(q.dice).toMatch(/español y en inglés/);
  });

  it('con la app en español entiende una orden escrita en inglés', () => {
    const ctx = contexto(normalizarEstado(clonar(DEFAULT_STATE)));
    const r = interpretar('add a bedroom on the second floor', ctx);
    expect(r.hacer[0]).toMatchObject({ tipo: 'room+', room: { name: 'Alcoba', floor: 2 } });
  });

  it('cada respuesta frecuente y capacidad está en los dos idiomas, y el cerebro avanzado contesta en el escogido', () => {
    for (const f of FAQ) { expect(f.r.es).toBeTruthy(); expect(f.r.en).toBeTruthy(); expect(f.clavesEn?.length).toBeGreaterThan(0); }
    for (const c of CAPACIDADES) { expect(c.es).toBeTruthy(); expect(c.en).toBeTruthy(); }
    setIdioma('en');
    expect(instrucciones('test')).toMatch(/Always answer in English/);
    setIdioma('es');
    expect(instrucciones('test')).toMatch(/Responde siempre en español/);
  });
});

describe('Nombres de los espacios en el idioma escogido', () => {
  it('traduce los nombres conocidos y respeta el número', () => {
    expect(traducirNombre('Alcoba 2', 'en')).toBe('Bedroom 2');
    expect(traducirNombre('Baño principal', 'en')).toBe('Main bathroom');
    expect(traducirNombre('Sala-comedor', 'en')).toBe('Living-dining room');
    expect(traducirNombre('Bedroom 3', 'es', 'MX')).toBe('Recámara 3');
    expect(traducirNombre('Bedroom 3', 'es', 'ES')).toBe('Dormitorio 3');
    expect(traducirNombre('Bedroom 3', 'es', 'CO')).toBe('Alcoba 3');
    expect(traducirNombre('Primary bedroom', 'es', 'CA')).toBe('Dormitorio principal');
    // ya está en ese idioma, o lo escribió el usuario a su manera
    expect(traducirNombre('Cocina', 'es')).toBeNull();
    expect(traducirNombre('Taller de Juan', 'en')).toBeNull();
  });

  it('ida y vuelta: al volver al español recupera el nombre exacto, también en México', () => {
    for (const [pais, k] of [['MX', Object.keys(PLANTILLAS.MX)[0]], ['ES', Object.keys(PLANTILLAS.ES)[0]], ['CA', Object.keys(PLANTILLAS.CA)[0]]]) {
      const S = normalizarEstado({ ...PLANTILLAS[pais][k].estado(), idioma: 'es' });
      const antes = S.rooms.map(r => r.name);
      traducirEspacios(S, 'en');
      traducirEspacios(S, 'es');
      const S2 = normalizarEstado(JSON.parse(JSON.stringify(S)));   // también después de guardar y recargar
      traducirEspacios(S2, 'en');
      traducirEspacios(S2, 'es');
      if (pais !== 'CA') expect(S2.rooms.map(r => r.name)).toEqual(antes);
      else expect(S2.rooms.every(r => !/^(Primary|Kitchen|Bedroom|Living)/.test(r.name))).toBe(true);
    }
  });

  it('lleva consigo el piso escogido por espacio y los muebles quitados, y deja quieto lo que escribió el usuario', () => {
    const S = normalizarEstado(clonar(DEFAULT_STATE));
    S.rooms.push({ name: 'Taller de Juan', area: 9, floor: 1, zone: 'social' });
    S.acabados.pisos['2:Alcoba principal'] = 'roble';
    S.muebles.quitar = ['2-alcoba-principal-cama'];
    traducirEspacios(S, 'en');
    expect(S.rooms.some(r => r.name === 'Taller de Juan')).toBe(true);
    expect(S.acabados.pisos).toEqual({ '2:Main bedroom': 'roble' });
    expect(S.muebles.quitar).toEqual(['2-main-bedroom-cama']);
    traducirEspacios(S, 'es');
    expect(S.acabados.pisos).toEqual({ '2:Alcoba principal': 'roble' });
    expect(S.muebles.quitar).toEqual(['2-alcoba-principal-cama']);
  });

  it('el nombre del proyecto de ejemplo cambia de idioma; el que escribió el usuario no', () => {
    const S = normalizarEstado(clonar(DEFAULT_STATE));
    traducirEspacios(S, 'en');
    expect(S.nombre).toBe('Sample house');
    traducirEspacios(S, 'es');
    expect(S.nombre).toBe('Casa de ejemplo');
    S.nombre = 'Casa de la abuela';
    traducirEspacios(S, 'en');
    expect(S.nombre).toBe('Casa de la abuela');
  });

  it('con los nombres en inglés el motor arma el mismo proyecto: mismas áreas, muebles y presupuesto', () => {
    for (const [pais, k] of ['CO', 'ES', 'MX', 'CA'].flatMap(p => Object.keys(PLANTILLAS[p]).map(k => [p, k]))) {
      const Ses = normalizarEstado({ ...PLANTILLAS[pais][k].estado(), idioma: 'es' });
      traducirEspacios(Ses, 'es');
      const Sen = normalizarEstado({ ...clonar(Ses), idioma: 'en' });
      traducirEspacios(Sen, 'en');
      const Mes = buildModel(Ses), Men = buildModel(Sen);
      expect(Mes.err).toBeFalsy(); expect(Men.err).toBeFalsy();
      expect(Men.built).toBeCloseTo(Mes.built, 6);
      expect(Men.muebles.length).toBe(Mes.muebles.length);
      expect(totales(Men, Sen.prices, pais).total).toBeCloseTo(totales(Mes, Ses.prices, pais).total, 0);
    }
  });
});
