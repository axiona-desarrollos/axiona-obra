import { describe, it, expect } from 'vitest';
import { buildModel, totales, precioDe, normalizarEstado, PLANTILLAS, PRECIOS_PAIS, PAIS_IDS, clonar,
  UBICACIONES, ACCESOS, PROVINCIAS_CA, detectarLugar, lugarDe, preciosLugar, referenciaLugar, pais } from '../src/motor/index.js';

const proyecto = (pid, ciudad, extra = {}) => {
  const k = Object.keys(PLANTILLAS[pid])[0];
  const S = normalizarEstado({ ...clonar(PLANTILLAS[pid][k].estado()), pais: pid });
  S.proyecto = { ...S.proyecto, ciudad, zona: 'normal', indice: '', ...extra };
  return S;
};
const total = S => { const M = buildModel(S); return totales(M, preciosLugar(S), S.pais); };

describe('ubicación: reconocer la ciudad', () => {
  it('encuentra la ciudad aunque venga con barrio, tildes o departamento', () => {
    expect(detectarLugar('CO', 'Sabaneta, Antioquia').id).toBe('medellin');
    expect(detectarLugar('CO', 'Barrio Cedritos, Bogotá D.C.').id).toBe('bogota');
    expect(detectarLugar('CO', 'Llano Grande, Rionegro, Antioquia').id).toBe('oriente');
    expect(detectarLugar('ES', 'Collado Villalba, Madrid').id).toBe('madrid');
    expect(detectarLugar('CA', 'Toronto, Ontario').id).toBe('toronto');
    expect(detectarLugar('MX', 'Iztapalapa, Ciudad de México').id).toBe('cdmx');
    expect(detectarLugar('MX', 'Santiago de Querétaro, Querétaro').id).toBe('queretaro');
    expect(detectarLugar('MX', 'Zapopan, Jalisco').id).toBe('guadalajara');
  });

  it('gana lo que se nombra primero: Manizales, Caldas no es el Caldas del Valle de Aburrá', () => {
    expect(detectarLugar('CO', 'Manizales, Caldas').id).toBe('ejecafetero');
    expect(detectarLugar('CO', 'Caldas, Antioquia').id).toBe('medellin');
    expect(detectarLugar('ES', 'La Palma, Canarias').id).toBe('canarias');
    expect(detectarLugar('ES', 'Palma de Mallorca').id).toBe('baleares');
  });

  it('una ciudad que no está en el catálogo queda sin índice, no con uno inventado', () => {
    expect(detectarLugar('CO', 'Mitú, Vaupés')).toBe(null);
    const u = lugarDe(proyecto('CO', 'Mitú, Vaupés'));
    expect(u.factor).toBe(1);
    expect(u.conf).toBe('sin');
  });

  it('todos los alias son únicos dentro de cada país y cada índice es razonable', () => {
    for (const pid of PAIS_IDS) {
      const vistos = new Set();
      for (const l of UBICACIONES[pid].lugares) {
        expect(l.f, `${pid} ${l.id}`).toBeGreaterThanOrEqual(0.7);
        expect(l.f, `${pid} ${l.id}`).toBeLessThanOrEqual(1.3);
        // sin dato publicado no puede haber un índice distinto de 1
        if (l.conf === 'sin' || l.conf === 'base') expect(l.f, `${pid} ${l.id}`).toBe(1);
        for (const a of l.alias) { expect(vistos.has(a), `${pid} alias repetido: ${a}`).toBe(false); vistos.add(a); }
      }
      expect(UBICACIONES[pid].lugares.filter(l => l.conf === 'base').length, pid).toBeLessThanOrEqual(1);
      expect(UBICACIONES[pid].fuentes.length, pid).toBeGreaterThan(0);
    }
  });
});

describe('ubicación: el presupuesto sigue a la ciudad', () => {
  it('en la plaza base el total es idéntico al de la tabla del país', () => {
    for (const [pid, ciudad] of [['CO', 'Medellín'], ['CA', 'Toronto, Ontario'], ['MX', 'Ciudad de México'], ['ES', 'Madrid']]) {
      const S = proyecto(pid, ciudad), M = buildModel(S);
      expect(totales(M, preciosLugar(S), pid).total, pid).toBeCloseTo(totales(M, S.prices, pid).total, 4);
    }
  });

  it('Bogotá sale 8 % por encima del Valle de Aburrá y Barranquilla 10 % por debajo', () => {
    const base = total(proyecto('CO', 'Medellín')).directo;
    expect(total(proyecto('CO', 'Bogotá')).directo / base).toBeCloseTo(1.08, 3);
    expect(total(proyecto('CO', 'Barranquilla')).directo / base).toBeCloseTo(0.9, 3);
    expect(total(proyecto('MX', 'Monterrey, Nuevo León')).directo / total(proyecto('MX', 'CDMX')).directo).toBeCloseTo(0.94, 3);
  });

  it('la zona de difícil acceso suma sobre el índice de la ciudad', () => {
    const u = lugarDe(proyecto('CO', 'Bogotá', { zona: 'rural' }));
    expect(u.factor).toBeCloseTo(1.08 * 1.08, 4);
    expect(ACCESOS[0].pct).toBe(0);
  });

  it('el índice escrito a mano manda sobre el automático y se acota', () => {
    expect(lugarDe(proyecto('CO', 'Bogotá', { indice: '1.2' })).indice).toBe(1.2);
    expect(lugarDe(proyecto('CO', 'Bogotá', { indice: '1,15' })).indice).toBe(1.15);
    expect(lugarDe(proyecto('CO', 'Bogotá', { indice: '9' })).indice).toBe(2);
    expect(lugarDe(proyecto('CO', 'Bogotá', { indice: 'abc' })).indice).toBe(1.08);
    expect(lugarDe(proyecto('CO', 'Bogotá', { indice: '1.2' })).conf).toBe('manual');
  });

  it('un precio que el usuario escribió no se multiplica; los demás sí', () => {
    const S = proyecto('CO', 'Bogotá'), M = buildModel(S);
    const it0 = M.quant.items.find(i => i.k in PRECIOS_PAIS.CO && PRECIOS_PAIS.CO[i.k] > 0);
    const ref = PRECIOS_PAIS.CO[it0.k];
    expect(Math.abs(precioDe(it0, preciosLugar(S)) - ref * 1.08)).toBeLessThanOrEqual(0.5);
    S.prices[it0.k] = ref + 1234;
    expect(precioDe(it0, preciosLugar(S))).toBe(ref + 1234);
    // sin ubicación en la tabla, el precio es el de siempre
    expect(precioDe(it0, { ...PRECIOS_PAIS.CO })).toBe(ref);
  });

  it('el rango de mercado se mueve con la ciudad, no con la zona', () => {
    const ref = pais('CO').referencia;
    expect(referenciaLugar(proyecto('CO', 'Bogotá', { zona: 'remota' })).min).toBeCloseTo(ref.min * 1.08, 0);
    expect(referenciaLugar(proyecto('CO', 'Medellín')).max).toBe(ref.max);
  });

  it('la ciudad, la zona y el índice sobreviven a guardar y abrir', () => {
    const S = normalizarEstado(JSON.parse(JSON.stringify(proyecto('CO', 'Cali', { zona: 'densa', indice: '0.97' }))));
    expect(S.proyecto.zona).toBe('densa');
    expect(S.proyecto.indice).toBe('0.97');
    expect(JSON.stringify(preciosLugar(S))).toBe(JSON.stringify(S.prices));
    // un proyecto viejo, sin estos campos, abre en automático
    const viejo = proyecto('CO', 'Cali'); delete viejo.proyecto.zona; delete viejo.proyecto.indice;
    expect(lugarDe(normalizarEstado(viejo)).factor).toBe(0.94);
  });
});

describe('ubicación: el impuesto del lugar', () => {
  const linea = (S, k) => total(S).lineas.find(l => l.k === k);

  it('Canadá cobra el impuesto de la provincia, no siempre el de Ontario', () => {
    expect(linea(proyecto('CA', 'Toronto, Ontario'), 'tax').pct).toBe(0.13);
    expect(linea(proyecto('CA', 'Calgary, Alberta'), 'tax').pct).toBe(0.05);
    expect(linea(proyecto('CA', 'Montréal, QC'), 'tax').pct).toBeCloseTo(0.14975, 5);
    expect(linea(proyecto('CA', 'Halifax'), 'tax').pct).toBe(0.14);
    // ciudad fuera del catálogo: vale la provincia que nombra el texto
    expect(linea(proyecto('CA', 'Moncton, New Brunswick'), 'tax').pct).toBe(0.15);
    expect(linea(proyecto('CA', 'Kamloops, BC'), 'tax').pct).toBe(0.05);
    expect(linea(proyecto('CA', 'Somewhere'), 'tax').pct).toBe(0.13);
    for (const p of Object.values(PROVINCIAS_CA)) { expect(p.pct).toBeGreaterThanOrEqual(0.05); expect(p.pct).toBeLessThanOrEqual(0.15); }
  });

  it('en Canarias el IVA del 10 % pasa a IGIC del 7 %', () => {
    expect(linea(proyecto('ES', 'Madrid'), 'iva').pct).toBe(0.1);
    const igic = linea(proyecto('ES', 'Las Palmas de Gran Canaria'), 'iva');
    expect(igic.pct).toBe(0.07);
    expect(igic.n).toMatch(/IGIC/);
  });

  it('los demás países conservan sus líneas de indirectos', () => {
    for (const pid of ['CO', 'MX']) {
      const S = proyecto(pid, 'cualquiera');
      expect(total(S).lineas.map(l => l.pct)).toEqual(pais(pid).indirectos.map(i => i.pct));
    }
  });
});

describe('vecindario: la cuadra alrededor del lote', async () => {
  const { vecindario } = await import('../src/motor/index.js');
  const armar = (pid, k, cambios = {}) => {
    const S = normalizarEstado({ ...clonar(PLANTILLAS[pid][k].estado()), pais: pid });
    Object.assign(S.proyecto, cambios);
    const M = buildModel(S);
    return { S, M, V: vecindario(M, S) };
  };

  it('ninguna casa vecina pisa el lote ni la vía, en todas las plantillas', () => {
    for (const pid of PAIS_IDS) for (const k of Object.keys(PLANTILLAS[pid])) {
      const { M, V } = armar(pid, k), via = M.exterior.via;
      const fondo = Math.max(...M.lot.map(p => p.y)), yVia = -(via.anden * 2 + via.calzada);
      for (const c of V.casas) {
        const enLote = c.x1 > via.lote.x0 + 0.01 && c.x0 < via.lote.x1 - 0.01 && c.y1 > 0 && c.y0 < fondo;
        expect(enLote, `${pid} ${k} ${c.fila} pisa el lote`).toBe(false);
        expect(c.y1 <= yVia || c.y0 >= 0, `${pid} ${k} ${c.fila} pisa la vía`).toBe(true);
        expect(c.pisos).toBeGreaterThanOrEqual(1);
      }
    }
  });

  it('entre medianeras los vecinos quedan pegados al lindero; con retiro, separados', () => {
    const med = armar('CO', 'medianero'), via = med.M.exterior.via;
    expect(med.V.tipo).toBe('medianera');
    const lados = med.V.casas.filter(c => c.fila === 'lado');
    expect(Math.min(...lados.filter(c => c.x0 >= via.lote.x1).map(c => c.x0 - via.lote.x1))).toBeLessThan(0.05);
    expect(Math.min(...lados.filter(c => c.x1 <= via.lote.x0).map(c => via.lote.x0 - c.x1))).toBeLessThan(0.05);
    const ais = armar('CA', 'detached'), v2 = ais.M.exterior.via;
    expect(ais.V.tipo).toBe('aislada');
    expect(Math.min(...ais.V.casas.filter(c => c.fila === 'lado' && c.x0 >= v2.lote.x1).map(c => c.x0 - v2.lote.x1))).toBeGreaterThanOrEqual(1);
    for (const fila of ['lado', 'atras', 'enfrente']) expect(med.V.casas.some(c => c.fila === fila), fila).toBe(true);
  });

  it('en lote campestre o en vereda no hay vecinos, solo paisaje', () => {
    expect(armar('CO', 'mansion').V.casas.length).toBe(0);
    expect(armar('CO', 'medianero', { zona: 'rural' }).V.casas.length).toBe(0);
  });

  it('el mismo lote da siempre la misma cuadra y ningún poste queda frente a la casa', () => {
    const a = armar('MX', 'media'), b = armar('MX', 'media'), via = a.M.exterior.via;
    expect(JSON.stringify(a.V)).toBe(JSON.stringify(b.V));
    for (const x of a.V.postes) expect(x < via.lote.x0 - 1 || x > via.lote.x1 + 12, `poste en x=${x}`).toBe(true);
  });
});
