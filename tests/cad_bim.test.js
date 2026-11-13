import { describe, it, expect } from 'vitest';
import { buildModel, normalizarEstado, ejemploInicial, PLANTILLAS } from '../src/motor/index.js';
import { toDXF } from '../src/exportar/planosDXF.js';
import { exportarIFC } from '../src/exportar/ifc.js';

const S = normalizarEstado(ejemploInicial()), M = buildModel(S);

describe('Planos para AutoCAD: DXF 2000 completo', () => {
  const t = toDXF(M);
  it('es AutoCAD 2000 (AC1015) en metros, con todas las secciones', () => {
    expect(t).toMatch(/\$ACADVER\r\n\s*1\r\nAC1015/);
    expect(t).toMatch(/\$INSUNITS\r\n\s*70\r\n\s*6/);
    for (const sec of ['HEADER', 'CLASSES', 'TABLES', 'BLOCKS', 'ENTITIES', 'OBJECTS']) expect(t).toContain(`\r\n  2\r\n${sec}\r\n`);
    expect(t.trim().endsWith('EOF')).toBe(true);
  });
  it('declara cada capa usada, con color, y los identificadores no se repiten', () => {
    const capasUsadas = new Set([...t.matchAll(/\r\n\s*100\r\nAcDbEntity\r\n\s*8\r\n([^\r]+)/g)].map(m => m[1]));
    const capasDeclaradas = new Set([...t.matchAll(/\r\nLAYER\r\n[\s\S]*?\r\n\s*2\r\n([^\r]+)/g)].map(m => m[1]));
    capasUsadas.forEach(c => expect(capasDeclaradas.has(c), c).toBe(true));
    expect(capasUsadas.has('MUROS')).toBe(true);
    const handles = [...t.matchAll(/\r\n\s*5\r\n([0-9A-F]+)\r\n/g)].map(m => m[1]);
    expect(new Set(handles).size).toBe(handles.length);
  });
  it('trae plantas, piscina y cientos de entidades', () => {
    expect((t.match(/\r\nLINE\r\n/g) || []).length).toBeGreaterThan(1000);
    expect(t).toContain('PISCINA');
    expect(t).toContain('AXIONA OBRA - PLANTA PISO 1');
  });
});

describe('Modelo BIM: IFC 4 para Revit', () => {
  const ifc = exportarIFC(M, S);
  const ids = new Set([...ifc.matchAll(/^#(\d+)=/gm)].map(m => m[1]));
  it('encabezado IFC4 y todas las referencias existen', () => {
    expect(ifc).toContain("FILE_SCHEMA(('IFC4'));");
    const refs = [...ifc.replace(/'[^']*'/g, '').matchAll(/#(\d+)/g)].map(m => m[1]);
    refs.forEach(r => expect(ids.has(r), '#' + r).toBe(true));
  });
  it('un piso por nivel, muros, vanos llenos por puertas y ventanas, espacios y cubierta', () => {
    const n = k => (ifc.match(new RegExp(`=${k}\\(`, 'g')) || []).length;
    expect(n('IFCBUILDINGSTOREY')).toBe(M.F);
    expect(n('IFCWALL')).toBeGreaterThan(20);
    expect(n('IFCOPENINGELEMENT')).toBe(n('IFCRELFILLSELEMENT'));
    expect(n('IFCDOOR') + n('IFCWINDOW')).toBe(n('IFCRELFILLSELEMENT'));
    expect(n('IFCSPACE')).toBe(M.floors.reduce((a, f) => a + f.rects.filter(r => !r.stair).length, 0));
    expect(n('IFCROOF') + (ifc.includes('.ROOF.') ? 1 : 0)).toBeGreaterThan(0);
    expect(ifc).toContain('Piscina interior');
  });
  it('las tildes van codificadas para que Revit las muestre', () => expect(ifc).toMatch(/\\X2\\00F1\\X0\\|\\X2\\00ED\\X0\\/));
  it('todas las plantillas de los cuatro países exportan sin errores', () => {
    for (const g of Object.values(PLANTILLAS)) for (const p of Object.values(g)) {
      const s = normalizarEstado(p.estado()), m = buildModel(s);
      if (m.err) continue;
      expect(() => exportarIFC(m, s)).not.toThrow();
      expect(toDXF(m)).toContain('AC1015');
    }
  });
});
