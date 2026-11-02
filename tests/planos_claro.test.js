import { describe, it, expect } from 'vitest';
import { buildModel, DEFAULT_STATE, PLANTILLAS, clonar, normalizarEstado } from '../src/motor/index.js';
import { planSVG, patronPiso } from '../src/ui/planos.js';

/** Cada etiqueta del SVG sin atributos repetidos: el archivo debe abrir como XML en CAD e Illustrator. */
function atributosRepetidos(svg) {
  const malos = [];
  for (const tag of svg.match(/<[a-zA-Z][^>]*>/g) || []) {
    const nombres = [...tag.matchAll(/\s([a-zA-Z:-]+)=/g)].map(m => m[1]);
    const rep = nombres.filter((n, i) => nombres.indexOf(n) !== i);
    if (rep.length) malos.push(tag.slice(0, 80));
  }
  return malos;
}

describe('Planta a color (tema claro) y SVG válido', () => {
  const casos = [['ejemplo', normalizarEstado(clonar(DEFAULT_STATE))], ['campestre', normalizarEstado(PLANTILLAS.CO.campestre.estado())]];

  it('pinta cada espacio con el patrón de su piso real', () => {
    for (const [, S] of casos) {
      const svg = planSVG(buildModel(S), 'p1', 'claro', { S });
      expect(svg).toMatch(/<defs>.*<pattern id="pz-/);
      expect(svg).toMatch(/fill="url\(#pz-/);
    }
    expect(patronPiso('roble').def).toContain('<pattern');
    expect(patronPiso('porc').def).toContain('<pattern');
    expect(patronPiso('no-existe')).toBeNull();
  });

  it('ningún tema repite atributos (el tapete llevaba fill dos veces)', () => {
    for (const [, S] of casos) {
      const M = buildModel(S);
      for (const tema of ['claro', 'dark', 'print']) {
        for (const vista of ['p1', 'sitio', 'e1', 'h1']) expect(atributosRepetidos(planSVG(M, vista, tema, { S })), `${tema} ${vista}`).toEqual([]);
      }
    }
  });
});
