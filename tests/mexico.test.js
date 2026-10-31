import { describe, it, expect } from 'vitest';
import {
  buildModel, PLANTILLAS, normalizarEstado, datosDePais, totales, precioDe, PASOS, PAISES, tipoEspacio,
  fsr, piezasAgua,
} from '../src/motor/index.js';
import { losaVB, sepCastillos } from '../src/motor/mexico.js';
import { leerTexto } from '../src/motor/lector.js';

const plantilla = k => normalizarEstado(PLANTILLAS.MX[k].estado());
const modelo = k => { const S = plantilla(k); return { S, M: buildModel(S) }; };
const costoM2 = (M, S) => { const T = totales(M, S.prices, 'MX'); return T.sinDot * (1 + T.factorInd) / M.built; };

describe('México · plantillas', () => {
  it('las cuatro plantillas se arman sin errores ni avisos', () => {
    for (const k of Object.keys(PLANTILLAS.MX)) {
      const { M } = modelo(k);
      expect(M.err, k).toBeUndefined();
      expect(M.warn, k).toEqual([]);
      expect(M.mx, k).toBeTruthy();
    }
  });
  it('la casa media cae en el rango de mercado de vivienda media (12,500 a 20,000 MXN/m²)', () => {
    const { M, S } = modelo('media');
    const m2 = costoM2(M, S);
    expect(m2).toBeGreaterThanOrEqual(PAISES.MX.referencia.min);
    expect(m2).toBeLessThanOrEqual(PAISES.MX.referencia.max);
  });
  it('ningún concepto queda sin precio', () => {
    for (const k of Object.keys(PLANTILLAS.MX)) {
      const { M, S } = modelo(k);
      M.quant.items.forEach(it => expect(Number.isFinite(precioDe(it, S.prices)), `${k} ${it.k}`).toBe(true));
      expect(Number.isFinite(totales(M, S.prices, 'MX').total)).toBe(true);
    }
  });
});

describe('México · trámite', () => {
  it('casa chica en la CDMX: manifestación tipo A, sin DRO', () => {
    const { M } = modelo('tipoA');
    expect(M.built).toBeLessThanOrEqual(120);
    expect(M.mx.tramite.modalidad).toBe('A');
    expect(M.mx.tramite.dro).toBe(false);
    expect(M.mx.tramite.motivos).toEqual([]);
  });
  it('la misma casa en zona de riesgo deja de ser tipo A', () => {
    const S = plantilla('tipoA');
    S.mx.riesgo = true;
    const t = buildModel(S).mx.tramite;
    expect(t.modalidad).toBe('B');
    expect(t.dro).toBe(true);
    expect(t.motivos.join(' ')).toMatch(/riesgo/);
  });
  it('casa de más de 120 m²: tipo B y dice por qué', () => {
    const t = modelo('media').M.mx.tramite;
    expect(t.modalidad).toBe('B');
    expect(t.motivos.join(' ')).toMatch(/120 m²/);
  });
  it('fuera de la CDMX es licencia municipal', () => {
    expect(modelo('local').M.mx.tramite.modalidad).toBe('licencia');
  });
  it('los pasos cambian con la entidad y la modalidad', () => {
    const ids = P => PASOS.MX.filter(p => !p.si || p.si(P)).map(p => p.id);
    expect(ids({ entidad: 'cdmx', modalidad: 'A' })).toContain('manifA');
    expect(ids({ entidad: 'cdmx', modalidad: 'A' })).not.toContain('manifBC');
    expect(ids({ entidad: 'cdmx', modalidad: 'B' })).toContain('manifBC');
    expect(ids({ entidad: 'jal', modalidad: 'licencia' })).toContain('licencia');
    expect(ids({ entidad: 'jal', modalidad: 'licencia' })).not.toContain('manifA');
  });
});

describe('México · estructura', () => {
  it('peralte de vigueta y bovedilla por claro', () => {
    expect(losaVB(4).tipo).toBe('12+4');
    expect(losaVB(4.01).tipo).toBe('15+5');
    expect(losaVB(5).tipo).toBe('15+5');
    expect(losaVB(6).tipo).toBe('20+5');
    expect(losaVB(6.1).ok).toBe(false);
  });
  it('castillos a no más del menor de 4 m y 1.5 H, en cada nivel', () => {
    expect(sepCastillos(2.6, 0.16)).toBeCloseTo(3.66, 2);
    expect(sepCastillos(3.2, 0.2)).toBe(4);
    const { M } = modelo('media');
    expect(M.castillos.length).toBe(M.F);
    M.floors.forEach((fl, f) => fl.lines.forEach(l => {
      const en = M.castillos[f].filter(c => (l.o === 'H' ? Math.abs(c.y - l.c) < 0.01 && c.x > l.a - 0.01 && c.x < l.b + 0.01 : Math.abs(c.x - l.c) < 0.01 && c.y > l.a - 0.01 && c.y < l.b + 0.01))
        .map(c => (l.o === 'H' ? c.x : c.y)).sort((a, b) => a - b);
      for (let i = 1; i < en.length; i++) expect(en[i] - en[i - 1]).toBeLessThanOrEqual(M.mx.sep + 0.01);
    }));
  });
  it('en marcos el claro de la losa es el de los tableros entre trabes', () => {
    const { M } = modelo('edificio');
    expect(M.sistema).toBe('porticos');
    expect(M.mx.losa.claro).toBeLessThanOrEqual(4.5);
    expect(M.mx.losa.ok).toBe(true);
  });
  it('la revisión señala los muros de arriba que no apoyan, con su eje', () => {
    const r = modelo('media').M.mx.revision.find(x => /muros de abajo/.test(x.t));
    expect(r).toBeTruthy();
    if (!r.ok) expect(r.t).toMatch(/Nivel 2 · (Eje|Entre ejes)/);
  });
});

describe('México · presupuesto con números generadores', () => {
  it('cada cantidad es la suma exacta de su generador', () => {
    for (const k of Object.keys(PLANTILLAS.MX)) {
      const { M } = modelo(k);
      expect(M.quant.gen.length).toBeGreaterThan(30);
      M.quant.gen.forEach(c => {
        expect(c.q).toBeCloseTo(c.filas.reduce((t, f) => t + f.cant, 0), 9);
        const it = M.quant.items.find(x => x.clave === c.clave);
        expect(it.q).toBe(c.q);
      });
    }
  });
  it('las claves no se repiten', () => {
    const claves = modelo('media').M.quant.gen.map(c => c.clave);
    expect(new Set(claves).size).toBe(claves.length);
  });
  it('el block descuenta puertas y ventanas', () => {
    const { M } = modelo('media');
    const muro = M.quant.gen.find(c => c.clave === 'ALB-01');
    const bruto = muro.filas.reduce((t, f) => t + f.largo * f.alto, 0);
    const vanos = M.floors.reduce((t, fl) => t + fl.ops.filter(o => o.kind !== 'asc').reduce((s, o) => s + o.w * o.h, 0), 0);
    expect(bruto - muro.q).toBeCloseTo(vanos, 6);
  });
  it('IVA en cero para vivienda y solo sobre la parte del local', () => {
    const casa = modelo('media');
    expect(totales(casa.M, casa.S.prices, 'MX').lineas.find(l => l.k === 'iva').v).toBe(0);
    const { M, S } = modelo('local');
    const T = totales(M, S.prices, 'MX');
    const iva = T.lineas.find(l => l.k === 'iva');
    const base = T.directo + T.lineas.filter(l => l.k !== 'iva').reduce((t, l) => t + l.v, 0);
    expect(M.mx.noHab).toBeGreaterThan(0);
    expect(M.mx.noHab).toBeLessThan(1);
    expect(iva.v).toBeCloseTo(base * 0.16 * M.mx.noHab, 4);
    expect(iva.imp).toBe(true);
  });
  it('indirectos encadenados: financiamiento y utilidad sobre lo anterior', () => {
    const { M, S } = modelo('media');
    const T = totales(M, S.prices, 'MX');
    const v = k => T.lineas.find(l => l.k === k).v;
    expect(v('ind')).toBeCloseTo(T.directo * 0.12, 6);
    expect(v('fin')).toBeCloseTo((T.directo + v('ind')) * 0.015, 6);
    expect(v('uti')).toBeCloseTo((T.directo + v('ind') + v('fin')) * 0.10, 6);
    expect(T.factorInd).toBeCloseTo(1.12 * 1.015 * 1.10 - 1, 9);
  });
  it('explosión de insumos coherente con los generadores', () => {
    const { M } = modelo('media');
    const g = cl => M.quant.gen.find(c => c.clave === cl).q;
    expect(M.quant.mat.block).toBe(Math.ceil(g('ALB-01') * 12.5));
    expect(M.quant.mat.vigueta).toBeGreaterThan(0);
    expect(M.quant.mat.concreto).toBeGreaterThan(10);
  });
});

describe('México · agua y FSR', () => {
  it('ocupantes, dotación, cisterna y tinaco en capacidades comerciales', () => {
    const a = modelo('media').M.mx.agua;
    expect(a.ocupantes).toBe(2 * a.recamaras + a.viviendas);
    expect(a.diario).toBe(a.ocupantes * a.dotacion);
    expect(a.cisterna).toBeGreaterThanOrEqual(a.diario * a.dias);
    expect(a.tinaco).toBeGreaterThanOrEqual(a.diario);
    expect([1200, 2800, 5000, 10000]).toContain(a.cisternaPzas.cap);
  });
  it('edificio: una cisterna común y un tinaco por vivienda', () => {
    const a = modelo('edificio').M.mx.agua;
    expect(a.viviendas).toBe(4);
    expect(a.tinacoPzas.n % 4).toBe(0);
    expect(a.tinacoPzas.porVivienda.total).toBeGreaterThanOrEqual(a.diario / 4);
  });
  it('la dotación se puede fijar a mano', () => {
    const S = plantilla('media');
    S.mx.dotacion = 250;
    expect(buildModel(S).mx.agua.dotacion).toBe(250);
  });
  it('piezas comerciales: el menor volumen que alcanza', () => {
    expect(piezasAgua(2250, [1200, 2800, 5000, 10000], 1)).toEqual({ n: 1, cap: 2800, total: 2800 });
    expect(piezasAgua(1400, [450, 600, 750, 1100, 2500], 2)).toEqual({ n: 2, cap: 750, total: 1500 });
    expect(piezasAgua(25000, [1200, 2800, 5000, 10000], 1)).toEqual({ n: 3, cap: 10000, total: 30000 });
  });
  it('factor de salario real con la Ley Federal del Trabajo', () => {
    const f = fsr();
    expect(f.Tp).toBe(383);
    expect(f.Tl).toBe(289);
    expect(f.factor).toBeCloseTo(383 / 289 * 1.3, 3);
    expect(fsr({ salario: 600 }).salarioReal).toBeCloseTo(600 * f.factor, 0);
  });
});

describe('México · estado y textos', () => {
  it('el estado guarda y sanea los datos de México', () => {
    const S = normalizarEstado({ ...plantilla('media'), mx: { entidad: 'xx', zona: 'IV', riesgo: 1, reserva: 99, dotacion: -5, salario: 'nada' } });
    expect(S.mx).toEqual({ entidad: 'cdmx', zona: '', riesgo: true, reserva: 7, dotacion: 0, salario: 315.04 });
    const B = normalizarEstado(plantilla('local'));
    expect(B.mx.entidad).toBe('qro');
  });
  it('al cambiar a México cargan MXN, mampostería confinada y losa plana', () => {
    const d = datosDePais('MX');
    expect(d.sistema).toBe('confinada');
    expect(d.cubierta.tipo).toBe('plana');
    expect(PAISES.MX.moneda).toBe('MXN');
  });
  it('nombres de espacios de México', () => {
    expect(tipoEspacio('Medio baño')).toBe('banoS');
    expect(tipoEspacio('Cuarto de lavado')).toBe('ropas');
    expect(tipoEspacio('Patio de servicio')).toBe('ropas');
    expect(tipoEspacio('Recámara principal')).toBe('alcobaP');
    expect(tipoEspacio('Estancia')).toBe('sala');
    expect(tipoEspacio('Cochera')).toBe('bodega');
  });
  it('el lector reconoce un documento de la CDMX', () => {
    const r = leerTexto('Manifestación de construcción tipo B en la Alcaldía Coyoacán, Ciudad de México. Director Responsable de Obra (DRO) y corresponsable. Superficie del predio: 144 m2.');
    expect(r.pais).toBe('MX');
  });
});

describe('Colombia, España y Canadá no cambian', () => {
  it('el costo por m² sigue saliendo igual que antes', () => {
    for (const pid of ['CO', 'ES', 'CA']) {
      const k = Object.keys(PLANTILLAS[pid])[0];
      const S = normalizarEstado(PLANTILLAS[pid][k].estado()), M = buildModel(S);
      const T = totales(M, S.prices, pid);
      const antes = PAISES[pid].indirectos.filter(i => !i.sobre).reduce((t, i) => t + i.pct, 0);
      expect(T.factorInd).toBeCloseTo(antes, 12);
      expect(M.mx).toBeNull();
      expect(M.castillos).toBeNull();
      expect(M.quant.gen).toBeNull();
    }
  });
});
