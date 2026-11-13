import { describe, it, expect } from 'vitest';
import { buildModel, DEFAULT_STATE, clonar, normalizarEstado, datosDePais, setIdioma } from '../src/motor/index.js';
import { interpretar } from '../src/asistente/cerebro.js';
import { ESPACIO_PISCINA, areaEspacioPiscina, esEspacioPiscina } from '../src/motor/exterior.js';
import { planSVG } from '../src/ui/planos.js';

const base = (cambios = {}, pais = 'CO') => normalizarEstado({ ...clonar(DEFAULT_STATE), ...datosDePais(pais), ...cambios });
const conPiscinaInterior = (pais = 'CO', largo = 10, ancho = 4) => {
  const S = base({}, pais);
  S.lot = S.lot; S.piscina = { on: true, interior: true, largo, ancho, prof: 1.5 };
  S.rooms = [...S.rooms, { name: ESPACIO_PISCINA.es, area: areaEspacioPiscina(largo, ancho), floor: 1, zone: 'social' }];
  return normalizarEstado(S);
};
function aplicar(S, r) {
  const T = clonar(S);
  r.hacer.filter(h => h.tipo === 'set').forEach(h => {
    const ks = h.p.split('.'), last = ks.pop(); ks.reduce((a, k) => (a[k] ??= {}), T)[last] = h.v;
  });
  return normalizarEstado(T);
}

describe('Piscina interior', () => {
  it('el vaso queda dentro del espacio «Piscina interior» del primer piso, con playa de 1.2 m o más', () => {
    const M = buildModel(conPiscinaInterior()), P = M.exterior.piscina;
    expect(P).toBeTruthy();
    expect(P.interior).toBe(true);
    const s = P.sala;
    expect(P.x0 - s.x0).toBeGreaterThanOrEqual(1.19);
    expect(s.x1 - P.x1).toBeGreaterThanOrEqual(1.19);
    expect(P.y0 - s.y0).toBeGreaterThanOrEqual(1.19);
    expect(s.y1 - P.y1).toBeGreaterThanOrEqual(1.19);
    expect(P.playa).toBe(0);
    expect(P.playaInt).toBeGreaterThan(0);
  });

  it('el presupuesto suma clima, bomba de calor, barrera de vapor y antideslizante, en los cuatro países', () => {
    for (const pais of ['CO', 'ES', 'CA', 'MX']) {
      const M = buildModel(conPiscinaInterior(pais));
      const ks = M.quant.items.map(i => i.k);
      if (pais !== 'MX') ['pisc:vaso', 'pisc:deshum', 'pisc:calor', 'pisc:barrera', 'pisc:antides'].forEach(k => expect(ks, `${pais} ${k}`).toContain(k));
      expect(M.exterior.piscina.interior, pais).toBe(true);
    }
  });

  it('sin el espacio avisa en vez de inventar la piscina', () => {
    const S = base(); S.piscina = { on: true, interior: true, largo: 8, ancho: 4, prof: 1.5 };
    const M = buildModel(normalizarEstado(S));
    expect(M.exterior.piscina).toBeNull();
    expect(M.warn.join(' ')).toMatch(/Piscina interior/);
  });

  it('el plano del primer piso dibuja el vaso con su medida', () => {
    const S = conPiscinaInterior(), M = buildModel(S);
    const svg = planSVG(M, 'p1', 'print');
    expect(svg).toMatch(/[\d,]+ × [\d,]+ · prof\. 1,50/);
  });

  it('Axi entiende «piscina interior» y arma el espacio; «en el patio» la saca; «quita la piscina» borra todo', () => {
    setIdioma('es');
    const S0 = base();
    const ctx = S => ({ S, M: buildModel(S) });
    const r1 = interpretar('pon una piscina interior de 10 por 4', ctx(S0));
    const S1 = aplicar(S0, r1);
    expect(S1.piscina).toMatchObject({ on: true, interior: true, largo: 10, ancho: 4 });
    expect(S1.rooms.filter(r => esEspacioPiscina(r.name))).toHaveLength(1);
    expect(r1.dice).toMatch(/piscina interior/);
    const S2 = aplicar(S1, interpretar('mejor la piscina en el patio', ctx(S1)));
    expect(S2.piscina.interior).toBe(false);
    expect(S2.rooms.some(r => esEspacioPiscina(r.name))).toBe(false);
    const S3 = aplicar(S1, interpretar('quita la piscina', ctx(S1)));
    expect(S3.piscina.on).toBe(false);
    expect(S3.rooms.some(r => esEspacioPiscina(r.name))).toBe(false);
    expect(interpretar('quiero una piscina dentro de la casa', ctx(S0)).dice).toMatch(/piscina interior/);
  });
});

describe('Piscina interior · estructura', () => {
  it('ninguna columna queda dentro del vaso; si se retiran, avisa y cobra las vigas de transferencia', () => {
    const S = conPiscinaInterior('CO', 12, 5), M = buildModel(S), P = M.exterior.piscina;
    expect(M.cols.some(c => c.x > P.x0 && c.x < P.x1 && c.y > P.y0 && c.y < P.y1)).toBe(false);
    if (P.transferencia) {
      expect(M.warn.join(' ')).toMatch(/vigas de transferencia/);
      expect(M.quant.items.some(i => i.k === 'pisc:transf')).toBe(true);
    }
  });
});
