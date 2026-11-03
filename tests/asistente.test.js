import { describe, it, expect } from 'vitest';
import { buildModel, DEFAULT_STATE, PLANTILLAS, ESTILOS, clonar, normalizarEstado, totales, tr } from '../src/motor/index.js';
import { interpretar, normalizar, pisoDe, noEntendi, resumen } from '../src/asistente/cerebro.js';

function contexto(S = normalizarEstado(clonar(DEFAULT_STATE))) {
  const M = buildModel(S), T = totales(M, S.prices, S.pais);
  return {
    S, M, total: T.total, m2: T.total / M.built, money: v => `$ ${Math.round(v)}`, fmtA: v => `${v.toFixed(1)} m²`,
    estilos: Object.fromEntries(Object.entries(ESTILOS).map(([k, E]) => [k, tr(E.n)])),
    plantillas: Object.fromEntries(Object.entries(PLANTILLAS[S.pais]).map(([k, p]) => [k, tr(p.titulo)])),
    sistemas: [['porticos', 'pórticos de concreto'], ['confinada', 'mampostería confinada']], paisNombre: 'Colombia',
  };
}
const dice = (t, ctx = contexto()) => interpretar(t, ctx);

describe('Axi entiende órdenes en español', () => {
  it('normaliza tildes, signos y m²', () => {
    expect(normalizar('¿Agrega una ALCOBA de 12 m² en el 2.º piso?')).toBe('agrega una alcoba de 12 m2 en el 2 º piso');
    expect(pisoDe('en el segundo piso')).toBe(2);
    expect(pisoDe('al piso 3')).toBe(3);
    expect(pisoDe('en el cuarto piso')).toBe(4);
    expect(pisoDe('arriba', 3)).toBe(3);
  });

  it('agrega espacios con área y piso, y les da nombres que no chocan', () => {
    const r = dice('Agrega una alcoba de 12 m² en el segundo piso');
    expect(r.hacer).toEqual([{ tipo: 'room+', room: { name: 'Alcoba', area: 12, floor: 2, zone: 'privada' } }]);
    const r2 = dice('agrega dos alcobas y un baño en el segundo piso');
    expect(r2.hacer.map(h => h.room.name)).toEqual(['Alcoba', 'Alcoba 4', 'Baño']);
    expect(r2.hacer.every(h => h.room.floor === 2)).toBe(true);
    const r3 = dice('agrega un garaje');
    expect(r3.hacer[0].room).toMatchObject({ name: 'Garaje', area: 15, floor: 1 });
  });

  it('no agrega en un piso que no existe', () => {
    const r = dice('agrega una terraza en el quinto piso');
    expect(r.hacer).toEqual([]);
    expect(r.chips).toContain('Pon 5 pisos');
  });

  it('cambia los pisos de la edificación sin confundirlos con el acabado', () => {
    expect(dice('pon 3 pisos').hacer).toEqual([{ tipo: 'set', p: 'floors', v: 3 }]);
    expect(dice('quiero una casa de tres pisos').hacer[0]).toMatchObject({ p: 'floors', v: 3 });
    expect(dice('un piso más').hacer[0]).toMatchObject({ p: 'floors', v: 3 });
    expect(dice('porcelanato en toda la casa').hacer).toEqual([{ tipo: 'piso', key: '*', k: 'porc' }]);
  });

  it('pone acabados por espacio y pregunta cuando hay varios', () => {
    expect(dice('madera en la alcoba principal').hacer).toEqual([{ tipo: 'piso', key: '2:Alcoba principal', k: 'roble' }]);
    const r = dice('mármol en la alcoba');
    expect(r.hacer).toEqual([]);
    expect(r.dice).toMatch(/¿En cuál\?/);
  });

  it('quita, agranda, achica, pasa de piso y renombra espacios', () => {
    const ctx = contexto();
    const iEst = ctx.S.rooms.findIndex(r => r.name === 'Estudio');
    expect(dice('quita el estudio', ctx).hacer).toEqual([{ tipo: 'room-', i: iEst }]);
    const iSala = ctx.S.rooms.findIndex(r => r.name === 'Sala');
    expect(dice('agranda la sala a 25 m2', ctx).hacer).toEqual([{ tipo: 'room=', i: iSala, cambios: { area: 25 } }]);
    expect(dice('achica la sala', ctx).hacer[0].cambios.area).toBe(16);
    expect(dice('pasa el estudio al piso 2', ctx).hacer).toEqual([{ tipo: 'room=', i: iEst, cambios: { floor: 2 } }]);
    expect(dice('cambia el nombre del estudio a Oficina de Juan', ctx).hacer).toEqual([{ tipo: 'room=', i: iEst, cambios: { name: 'Oficina de Juan' } }]);
    expect(dice('quita la alcoba', ctx).dice).toMatch(/¿Cuál quito\?/);
  });

  it('navega, muestra fases del 3D y descarga', () => {
    expect(dice('muéstrame los planos').hacer).toEqual([{ tipo: 'tab', tab: 'planos' }]);
    expect(dice('quiero ver el 3D').hacer).toEqual([{ tipo: 'tab', tab: 'modelo' }]);
    expect(dice('muéstrame los ladrillos').hacer).toEqual([{ tipo: 'tab', tab: 'modelo' }, { tipo: 'fase', cat: 'negra' }]);
    expect(dice('descarga el PDF').hacer.map(h => h.a || h.tab)).toEqual(['planos', 'expPDF']);
    expect(dice('dame los planos en dxf').hacer[0]).toMatchObject({ tipo: 'act', a: 'expDXF' });
    expect(dice('saca el pdf').hacer.map(h => h.a || h.tab)).toEqual(['planos', 'expPDF']);
  });

  it('responde datos del proyecto', () => {
    const ctx = contexto();
    expect(dice('¿cuánto cuesta?', ctx).dice).toContain(ctx.money(ctx.total));
    expect(dice('qué espacios hay', ctx).dice).toMatch(/Piso 1: Sala/);
    expect(dice('cuantos metros tiene', ctx).dice).toMatch(/construidos en 2 pisos/);
  });

  it('cambia estilo, cubierta, sistema, lote, país y amoblado', () => {
    expect(dice('estilo moderno').hacer).toEqual([{ tipo: 'estilo', k: 'moderno' }]);
    expect(dice('techo a dos aguas').hacer[0]).toMatchObject({ p: 'cubierta.tipo', v: 'dos' });
    expect(dice('mampostería confinada').hacer[0]).toMatchObject({ p: 'sistema', v: 'confinada' });
    expect(dice('lote de 10 por 20').hacer).toEqual([{ tipo: 'lote', w: 10, d: 20 }]);
    expect(dice('cambia a México').hacer).toEqual([{ tipo: 'pais', id: 'MX' }]);
    expect(dice('sin muebles').hacer[0]).toMatchObject({ p: 'amoblar', v: false });
  });

  it('empieza de cero y carga ejemplos', () => {
    expect(dice('quiero empezar de cero').hacer[0]).toEqual({ tipo: 'nuevo' });
    const ej = dice('ver ejemplos');
    expect(ej.chips.length).toBeGreaterThan(2);
    expect(dice(ej.chips[1]).hacer[0]).toMatchObject({ tipo: 'plantilla' });
  });

  it('responde dudas, incluida la de los «cubos», y lleva al contacto', () => {
    const cubos = dice('solo hace cubos o se le pueden pedir edificaciones orgánicas?');
    expect(cubos.dice).toMatch(/No solo cubos/);
    expect(cubos.hacer).toEqual([]);
    expect(cubos.chips).toContain('Hazla escalonada con terrazas');
    expect(dice('cuál es la diferencia con Revit').dice).toMatch(/Revit/);
    expect(dice('se ven los ladrillos reales?').dice).toMatch(/obra negra/);
    expect(dice('quiero hablar con una persona').hacer).toEqual([{ tipo: 'contacto' }]);
    expect(dice('tengo una propuesta para mejorar la app').hacer).toEqual([{ tipo: 'formulario', clase: 'propuesta' }]);
    expect(dice('quiero dejar una reseña').hacer).toEqual([{ tipo: 'formulario', clase: 'resena' }]);
  });

  it('cambia la forma del edificio: escalonada, lateral, en los dos sentidos, balcones y recta', () => {
    expect(dice('hazla escalonada con terrazas').hacer).toEqual([{ tipo: 'set', p: 'forma.tipo', v: 'terrazas', repintar: true }]);
    expect(dice('quiero terrazas al frente').hacer[0]).toMatchObject({ p: 'forma.tipo', v: 'terrazas' });
    expect(dice('ponle una terraza lateral').hacer[0]).toMatchObject({ p: 'forma.tipo', v: 'lateral' });
    expect(dice('escalonada al frente y de lado').hacer[0]).toMatchObject({ p: 'forma.tipo', v: 'escalonada' });
    expect(dice('Escalónala también de lado').hacer[0]).toMatchObject({ p: 'forma.tipo', v: 'escalonada' });
    expect(dice('terrazas al frente con retroceso de 3 metros').hacer).toEqual([{ tipo: 'set', p: 'forma.tipo', v: 'terrazas', repintar: true }, { tipo: 'set', p: 'forma.paso', v: 3 }]);
    expect(dice('agrega balcones').hacer).toEqual([{ tipo: 'set', p: 'forma.balcones', v: true }]);
    expect(dice('quita los balcones').hacer).toEqual([{ tipo: 'set', p: 'forma.balcones', v: false }]);
    expect(dice('forma recta, todos los pisos iguales').hacer[0]).toMatchObject({ p: 'forma.tipo', v: 'recta' });
    const org = dice('hazla más orgánica, que no sea un cubo');
    expect(org.hacer.map(h => [h.p, h.v])).toEqual([['forma.tipo', 'escalonada'], ['forma.balcones', true], ['forma.curvas', true]]);
    // una terraza como espacio del programa sigue siendo un espacio
    expect(dice('agrega una terraza en el segundo piso').hacer[0]).toMatchObject({ tipo: 'room+', room: { name: 'Terraza', floor: 2 } });
    // con un piso avisa que necesita 2
    const S1 = normalizarEstado({ ...clonar(DEFAULT_STATE), floors: 1, rooms: DEFAULT_STATE.rooms.map(r => ({ ...r, floor: 1 })) });
    expect(dice('hazla escalonada', contexto(S1)).chips).toContain('Pon 2 pisos');
    expect(dice('muéstrame las fachadas').hacer).toEqual([{ tipo: 'vista', v: 'F-frente' }]);
  });

  it('pide plantas en L, en U, con patio central y curvas, sin confundir el patio de ropas', () => {
    expect(dice('quiero una casa con patio central').hacer[0]).toMatchObject({ p: 'forma.tipo', v: 'patio' });
    expect(dice('hazla como una casa colonial').hacer[0]).toMatchObject({ p: 'forma.tipo', v: 'patio' });
    expect(dice('hazla en L').hacer[0]).toMatchObject({ p: 'forma.tipo', v: 'ele' });
    expect(dice('mejor en forma de U').hacer[0]).toMatchObject({ p: 'forma.tipo', v: 'u' });
    expect(dice('ponle curvas').hacer).toEqual([{ tipo: 'set', p: 'forma.curvas', v: true }]);
    expect(dice('quiero un mirador redondo en la sala').hacer).toEqual([{ tipo: 'set', p: 'forma.curvas', v: true }]);
    expect(dice('quita las curvas').hacer).toEqual([{ tipo: 'set', p: 'forma.curvas', v: false }]);
    // lo que no es forma sigue igual
    expect(dice('agrega un patio de ropas').hacer[0]).toMatchObject({ tipo: 'room+' });
    expect(dice('madera en la alcoba principal').hacer).toEqual([{ tipo: 'piso', key: '2:Alcoba principal', k: 'roble' }]);
    expect(dice('qué son las curvas de nivel').hacer).toEqual([]);
  });

  it('cada orden de forma deja un modelo con terrazas que el motor arma sin error', () => {
    for (const orden of ['hazla escalonada con terrazas', 'terraza lateral', 'escalonada al frente y de lado', 'agrega balcones']) {
      const ctx = contexto();
      const S = clonar(ctx.S);
      dice(orden, ctx).hacer.forEach(h => { const [a, b] = h.p.split('.'); S[a][b] = h.v; });
      const M = buildModel(normalizarEstado(S));
      expect(M.err).toBeFalsy();
      expect(M.terrazas.length + M.balcones.length).toBeGreaterThan(0);
    }
  });

  it('abre la realidad aumentada propia y explica que no depende del celular', () => {
    expect(dice('muéstrame la casa en realidad aumentada').hacer).toEqual([{ tipo: 'act', a: 'arAxMaqueta' }]);
    expect(dice('ponla en mi mesa').hacer).toEqual([{ tipo: 'act', a: 'arAxMaqueta' }]);
    expect(dice('realidad aumentada sin marcador').hacer).toEqual([{ tipo: 'act', a: 'arAxGiro' }]);
    expect(dice('Sin marcador').hacer).toEqual([{ tipo: 'act', a: 'arAxGiro' }]);
    expect(dice('quiero ver la casa en el lote a escala real en realidad aumentada').hacer).toEqual([{ tipo: 'act', a: 'arAxLote' }]);
    expect(dice('descarga los marcadores').hacer).toEqual([{ tipo: 'act', a: 'arAxPDF' }]);
    const r = dice('mi celular no tiene realidad aumentada, no funciona');
    expect(r.hacer).toEqual([]);
    expect(r.dice).toMatch(/no depende de que el celular traiga AR/);
    // los planos siguen siendo los planos
    expect(dice('muéstrame los planos').hacer).toEqual([{ tipo: 'tab', tab: 'planos' }]);
  });

  it('devuelve null cuando no entiende, para pasarle la pregunta al modelo', () => {
    expect(dice('cuál es la capital de Francia')).toBeNull();
    expect(noEntendi().chips).toContain('Hablar con una persona');
    expect(resumen(contexto())).toMatch(/Espacios: Sala 20 m² \(piso 1\)/);
  });

  it('cada orden que agrega espacios deja un proyecto que el motor distribuye sin error', () => {
    const ctx = contexto();
    const r = dice('agrega dos alcobas y un baño en el segundo piso', ctx);
    const S = clonar(ctx.S);
    r.hacer.forEach(h => S.rooms.push(h.room));
    const M = buildModel(normalizarEstado(S));
    expect(M.err).toBeFalsy();
    expect(M.floors[1].rects.some(x => x.name === 'Alcoba 4')).toBe(true);
  });
});

describe('Axi entiende cantidades totales y dice lo que aún no hace (hallazgos del arquitecto evaluador)', () => {
  const alcobas = S => S.rooms.filter(r => /alcoba/i.test(r.name) && !/servicio/i.test(r.name)).length;

  it('«pon 3 alcobas» deja 3 en total, en el piso de las alcobas', () => {
    const ctx = contexto();
    const n = alcobas(ctx.S), pisoAlcobas = ctx.S.rooms.find(r => r.name === 'Alcoba 2').floor;
    const igual = dice(`pon ${n} alcobas`, ctx);
    expect(igual.hacer).toEqual([]);
    expect(igual.dice).toMatch(/ya tiene/);
    const mas = dice(`pon ${n + 1} alcobas`, ctx);
    expect(mas.hacer).toHaveLength(1);
    expect(mas.hacer[0]).toMatchObject({ tipo: 'room+', room: { floor: pisoAlcobas, zone: 'privada' } });
    expect(mas.dice).toMatch(/en total/);
    const menos = dice(`quiero ${n - 1} alcobas`, ctx);
    expect(menos.hacer.every(h => h.tipo === 'room-')).toBe(true);
    expect(menos.hacer).toHaveLength(1);
    expect(ctx.S.rooms[menos.hacer[0].i].name).not.toMatch(/principal/i);
  });

  it('en la casa medianera de 2 alcobas, «pon 3 alcobas» agrega una sola, arriba', () => {
    const S = normalizarEstado(PLANTILLAS.CO.medianero.estado());
    const r = dice('pon 3 alcobas', contexto(S));
    expect(r.hacer).toEqual([{ tipo: 'room+', room: { name: 'Alcoba', area: 10, floor: 2, zone: 'privada' } }]);
  });

  it('«agrega» suma; sin piso, va donde están los de su tipo', () => {
    const ctx = contexto();
    const pisoAlcobas = ctx.S.rooms.find(r => r.name === 'Alcoba 2').floor;
    expect(dice('agrega 2 alcobas más', ctx).hacer).toHaveLength(2);
    expect(dice('agrega una alcoba', ctx).hacer[0].room.floor).toBe(pisoAlcobas);
    expect(dice('agrega un garaje', ctx).hacer[0].room.floor).toBe(1);
  });

  it('guadua, acero, muros vaciados y jacuzzi: respuesta honesta, sin tocar el proyecto', () => {
    for (const orden of ['hazla en guadua', 'casa en bahareque', 'estructura metálica', 'quiero muros vaciados', 'agrega un jacuzzi', 'add a hot tub']) {
      const r = dice(orden);
      expect(r.hacer, orden).toEqual([]);
      expect(r.dice, orden).toMatch(/Todavía no|I don’t do/);
      expect(r.dice, orden).toMatch(/310 392 2935/);
    }
  });

  it('piscina, parqueadero, fachada, teja y noche (fase 2)', () => {
    const p = dice('pon una piscina de 10 por 5 de 1.6 de profundidad');
    expect(p.hacer[0]).toMatchObject({ tipo: 'set', p: 'piscina', v: { on: true, largo: 10, ancho: 5, prof: 1.6 } });
    expect(dice('add a swimming pool').hacer[0]).toMatchObject({ tipo: 'set', p: 'piscina', v: { on: true } });
    expect(dice('quita la piscina').hacer).toEqual([{ tipo: 'set', p: 'piscina.on', v: false, repintar: true }]);
    expect(dice('parqueadero para 3 carros').hacer[0]).toMatchObject({ p: 'parqueo', v: { on: true, n: 3 } });
    expect(dice('la fachada en ladrillo a la vista').hacer[0]).toMatchObject({ p: 'acabados.fachada', v: 'ladrillo' });
    expect(dice('fachada en piedra arenisca').hacer[0]).toMatchObject({ p: 'acabados.fachada', v: 'piedraClara' });
    const t = dice('techo de pizarra');
    expect(t.hacer[0]).toMatchObject({ p: 'acabados.teja', v: 'pizarra' });
    expect(dice('muéstrala de noche').hacer).toContainEqual({ tipo: 'act', a: 'noche' });
    expect(dice('quiero mover los muebles de la sala').hacer).toContainEqual({ tipo: 'act', a: 'editar3d' });
    expect(dice('parqué en espina de pez en toda la casa').hacer).toEqual([{ tipo: 'piso', key: '*', k: 'parque' }]);
    expect(dice('mármol negro en la sala').hacer).toEqual([{ tipo: 'piso', key: '1:Sala', k: 'marmolNegro' }]);
  });

  it('la madera de piso sigue siendo acabado, y la estructura en madera solo es «no disponible» fuera de Canadá', () => {
    expect(dice('madera en la alcoba principal').hacer).toEqual([{ tipo: 'piso', key: '2:Alcoba principal', k: 'roble' }]);
    const ES = normalizarEstado({ ...clonar(DEFAULT_STATE), pais: 'ES' });
    expect(dice('hazla con estructura de madera', { ...contexto(ES), paisNombre: 'España' }).dice).toMatch(/Todavía no/);
    const CA = normalizarEstado({ ...clonar(DEFAULT_STATE), pais: 'CA' });
    expect(dice('hazla con estructura de madera', { ...contexto(CA), paisNombre: 'Canadá' }).dice).not.toMatch(/Todavía no/);
  });
});
