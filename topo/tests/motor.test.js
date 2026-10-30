import { describe, it, expect } from 'vitest';
import { aLocal, aGeo, promediarGPS } from '../src/motor/geo.js';
import { area, perimetro, lados, angulosInternos, rumbo, loteACinta, centroide } from '../src/motor/poligono.js';
import { delaunay, armarTIN, cotaEn, curvasDeNivel, pendientes, perfil } from '../src/motor/tin.js';
import { corteRelleno, volumenes, nivelDeEquilibrio, viajes, recortar } from '../src/motor/volumen.js';
import { nuevoLevantamiento, normalizar, calcular, siguienteId, intervaloSugerido } from '../src/motor/levantamiento.js';
import { empacar, desempacar, enlaceDe, deEnlace } from '../src/motor/compartir.js';
import { aPNEZD, aDXF, aKML, aGeoJSON, proyectoObra, enlaceObra } from '../src/motor/exportar.js';

const MEDELLIN = { lat: 6.2442, lon: -75.5812 };

describe('coordenadas', () => {
  it('una milesima de grado al norte en Medellín son unos 110,6 m', () => {
    const p = aLocal(MEDELLIN.lat + 0.001, MEDELLIN.lon, MEDELLIN);
    expect(p.y).toBeCloseTo(110.6, 0);
    expect(Math.abs(p.x)).toBeLessThan(0.01);
  });
  it('una milesima de grado al este es cos(lat) veces más corta', () => {
    const p = aLocal(MEDELLIN.lat, MEDELLIN.lon + 0.001, MEDELLIN);
    expect(p.x).toBeCloseTo(111.32 * Math.cos(MEDELLIN.lat * Math.PI / 180), 0);
  });
  it('ida y vuelta metros -> lat/lon -> metros cuadra al milímetro', () => {
    for (const [x, y] of [[35.2, -18.7], [-420, 260], [900, 900]]) {
      const g = aGeo(x, y, MEDELLIN), q = aLocal(g.lat, g.lon, MEDELLIN);
      expect(Math.abs(q.x - x)).toBeLessThan(0.001);
      expect(Math.abs(q.y - y)).toBeLessThan(0.001);
    }
  });
  it('el promedio del GPS descarta lecturas malas y saltos', () => {
    const base = aGeo(10, 20, MEDELLIN);
    const lect = [];
    for (let i = 0; i < 20; i++) {
      const g = aGeo(10 + Math.sin(i) * 1.5, 20 + Math.cos(i * 1.3) * 1.5, MEDELLIN);
      lect.push({ lat: g.lat, lon: g.lon, acc: 4, t: i * 1000 });
    }
    const salto = aGeo(60, 20, MEDELLIN);
    lect.push({ lat: salto.lat, lon: salto.lon, acc: 5, t: 20000 });
    lect.push({ lat: base.lat, lon: base.lon, acc: 80, t: 21000 });
    const r = promediarGPS(lect);
    const q = aLocal(r.lat, r.lon, MEDELLIN);
    expect(Math.hypot(q.x - 10, q.y - 20)).toBeLessThan(0.6);
    expect(r.descartadas).toBe(2);
    expect(r.prec).toBeGreaterThanOrEqual(0.5);
    expect(r.prec).toBeLessThan(4);
  });
  it('sin lecturas válidas no inventa un punto', () => {
    expect(promediarGPS([])).toBeNull();
    expect(promediarGPS([{ lat: NaN, lon: 1, acc: 3 }])).toBeNull();
  });
});

describe('polígono', () => {
  const R = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 20 }, { x: 0, y: 20 }];
  it('área, perímetro y ángulos de un rectángulo', () => {
    expect(area(R)).toBeCloseTo(200);
    expect(area([...R].reverse())).toBeCloseTo(200);
    expect(perimetro(R)).toBeCloseTo(60);
    expect(angulosInternos(R).every(a => Math.abs(a - 90) < 1e-9)).toBe(true);
    expect(angulosInternos([...R].reverse()).every(a => Math.abs(a - 90) < 1e-9)).toBe(true);
    const c = centroide(R);
    expect(c.x).toBeCloseTo(5); expect(c.y).toBeCloseTo(10);
  });
  it('los ángulos internos de un lote irregular suman (n-2)·180', () => {
    const p = [{ x: 0, y: 0 }, { x: 14, y: 1 }, { x: 12, y: 18 }, { x: 5, y: 22 }, { x: -2, y: 9 }];
    expect(angulosInternos(p).reduce((s, a) => s + a, 0)).toBeCloseTo(540);
  });
  it('rumbos de cuadrante', () => {
    expect(rumbo(35 + 20 / 60)).toBe('N 35°20′ E');
    expect(rumbo(135)).toBe('S 45°00′ E');
    expect(rumbo(200.5)).toBe('S 20°30′ W');
    expect(rumbo(300)).toBe('N 60°00′ W');
    const L = lados(R);
    expect(L[0].largo).toBeCloseTo(10);
    expect(L[0].rumbo).toBe('N 90°00′ E');
    expect(L[1].rumbo).toBe('N 0°00′ E');
  });
  it('lote a cinta: 4 lados y una diagonal arman el rectángulo', () => {
    const r = loteACinta({ lados: [10, 20, 10, 20], diagonales: [Math.hypot(10, 20)], control: { i: 1, j: 3, medida: Math.hypot(10, 20) } });
    expect(r.error).toBeUndefined();
    expect(area(r.puntos)).toBeCloseTo(200, 3);
    expect(r.puntos[2].x).toBeCloseTo(10, 3);
    expect(r.puntos[2].y).toBeCloseTo(20, 3);
    expect(Math.abs(r.cierre.diferencia)).toBeLessThan(0.001);
  });
  it('lote a cinta irregular de 5 esquinas', () => {
    const p = [{ x: 0, y: 0 }, { x: 14, y: 0 }, { x: 13, y: 17 }, { x: 4, y: 21 }, { x: -3, y: 10 }];
    const d = (a, b) => Math.hypot(p[b].x - p[a].x, p[b].y - p[a].y);
    const r = loteACinta({ lados: [d(0, 1), d(1, 2), d(2, 3), d(3, 4), d(4, 0)], diagonales: [d(0, 2), d(0, 3)] });
    expect(area(r.puntos)).toBeCloseTo(area(p), 3);
  });
  it('lote a cinta avisa cuando las medidas no cierran', () => {
    const r = loteACinta({ lados: [10, 3, 10, 20], diagonales: [30] });
    expect(r.error).toMatch(/no cierran/);
    expect(loteACinta({ lados: [10, 20, 10, 20] }).error).toMatch(/diagonales/);
  });
});

describe('modelo del terreno', () => {
  const plano = (a, b, c) => (x, y) => a * x + b * y + c;
  const malla = (fz, n = 5, L = 10) => {
    const P = [];
    for (let i = 0; i <= n; i++) for (let j = 0; j <= n; j++) { const x = (i * L) / n, y = (j * L) / n; P.push({ x, y, z: fz(x, y) }); }
    return P;
  };
  it('Delaunay: n puntos en posición general dan 2n-2-h triángulos', () => {
    const P = [];
    let s = 7;
    const azar = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
    for (let i = 0; i < 60; i++) P.push({ x: azar() * 50, y: azar() * 30 });
    const T = delaunay(P);
    for (const [a, b, c] of T) {
      const A = P[a], B = P[b], C = P[c];
      expect((B.x - A.x) * (C.y - A.y) - (B.y - A.y) * (C.x - A.x)).toBeGreaterThan(0);
      const d = 2 * (A.x * (B.y - C.y) + B.x * (C.y - A.y) + C.x * (A.y - B.y));
      const ux = ((A.x ** 2 + A.y ** 2) * (B.y - C.y) + (B.x ** 2 + B.y ** 2) * (C.y - A.y) + (C.x ** 2 + C.y ** 2) * (A.y - B.y)) / d;
      const uy = ((A.x ** 2 + A.y ** 2) * (C.x - B.x) + (B.x ** 2 + B.y ** 2) * (A.x - C.x) + (C.x ** 2 + C.y ** 2) * (B.x - A.x)) / d;
      const r2 = (A.x - ux) ** 2 + (A.y - uy) ** 2;
      for (let k = 0; k < P.length; k++) if (k !== a && k !== b && k !== c) expect((P[k].x - ux) ** 2 + (P[k].y - uy) ** 2).toBeGreaterThan(r2 * (1 - 1e-9));
    }
    const area2 = T.reduce((s2, [a, b, c]) => s2 + Math.abs((P[b].x - P[a].x) * (P[c].y - P[a].y) - (P[b].y - P[a].y) * (P[c].x - P[a].x)) / 2, 0);
    expect(area2).toBeGreaterThan(0);
  });
  it('la cota interpolada de un plano es exacta', () => {
    const fz = plano(0.1, -0.05, 2);
    const T = armarTIN(malla(fz));
    for (const [x, y] of [[1.3, 7.2], [5, 5], [9.9, 0.1]]) expect(cotaEn(T, x, y)).toBeCloseTo(fz(x, y), 9);
    expect(cotaEn(T, -1, 5)).toBeNull();
  });
  it('curvas de nivel de z = x: rectas verticales de 10 m', () => {
    const T = armarTIN(malla(plano(1, 0, 0)));
    const C = curvasDeNivel(T, 1);
    // 0 y 10 caen justo sobre el borde del modelo: se dibujen o no, no importa.
    expect(C.map(c => c.z).filter(z => z > 0 && z < 10)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    const c5 = C.find(c => c.z === 5);
    expect(c5.mayor).toBe(true);
    expect(c5.lineas.length).toBe(1);
    const ln = c5.lineas[0];
    expect(ln.every(p => Math.abs(p.x - 5) < 1e-9)).toBe(true);
    const largo = ln.slice(1).reduce((s, p, i) => s + Math.hypot(p.x - ln[i].x, p.y - ln[i].y), 0);
    expect(largo).toBeCloseTo(10, 6);
  });
  it('pendiente de un plano al 12 % que baja hacia el sur', () => {
    const T = armarTIN(malla(plano(0, 0.12, 0)));
    const S = pendientes(T);
    expect(S.media).toBeCloseTo(12, 6);
    expect(S.general).toBeCloseTo(12, 6);
    expect(S.baja).toBeCloseTo(180, 6);
    expect(S.clase).toBe('Fuertemente inclinada');
  });
  it('perfil del terreno', () => {
    const T = armarTIN(malla(plano(0.2, 0, 1)));
    const pr = perfil(T, { x: 0, y: 5 }, { x: 10, y: 5 }, 10);
    expect(pr[0].z).toBeCloseTo(1); expect(pr[10].z).toBeCloseTo(3); expect(pr[5].d).toBeCloseTo(5);
  });
  it('quita los triángulos que quedan fuera de un lote en L', () => {
    const L = [{ x: 0, y: 0, z: 0 }, { x: 10, y: 0, z: 0 }, { x: 10, y: 4, z: 0 }, { x: 4, y: 4, z: 0 }, { x: 4, y: 10, z: 0 }, { x: 0, y: 10, z: 0 }];
    const T = armarTIN(L, L);
    const A = T.triangulos.reduce((s, [a, b, c]) => { const P = T.puntos; return s + Math.abs((P[b].x - P[a].x) * (P[c].y - P[a].y) - (P[b].y - P[a].y) * (P[c].x - P[a].x)) / 2; }, 0);
    expect(A).toBeCloseTo(64, 6);
  });
});

describe('movimiento de tierra', () => {
  const malla = (fz, n = 4, L = 10) => {
    const P = [];
    for (let i = 0; i <= n; i++) for (let j = 0; j <= n; j++) { const x = (i * L) / n, y = (j * L) / n; P.push({ x, y, z: fz(x, y) }); }
    return armarTIN(P);
  };
  it('cuña de un triángulo: corte + relleno cuadra con el total', () => {
    for (const h of [[2, -1, -1], [1, 1, -2], [3, 0, -1], [-1, -2, -3], [0.5, 0.2, 0.1]]) {
      const r = corteRelleno(6, h);
      expect(r.corte - r.relleno).toBeCloseTo(6 * (h[0] + h[1] + h[2]) / 3, 9);
      expect(r.corte).toBeGreaterThanOrEqual(0); expect(r.relleno).toBeGreaterThanOrEqual(0);
    }
    expect(corteRelleno(6, [3, -3, -3]).corte).toBeCloseTo(6 * 27 / (3 * 6 * 6), 9);
  });
  it('plano z = x sobre 10 × 10 contra la plataforma 5: 125 m³ de corte y 125 de relleno', () => {
    const T = malla((x) => x);
    const v = volumenes(T, 5);
    expect(v.corte).toBeCloseTo(125, 6);
    expect(v.relleno).toBeCloseTo(125, 6);
    expect(v.area).toBeCloseTo(100, 6);
    expect(nivelDeEquilibrio(T)).toBeCloseTo(5, 9);
  });
  it('terreno curvo: la cota media deja corte igual a relleno', () => {
    const T = malla((x, y) => 0.02 * x * x + 0.05 * y + Math.sin(x) * 0.2, 8);
    const eq = nivelDeEquilibrio(T), v = volumenes(T, eq);
    expect(v.corte).toBeCloseTo(v.relleno, 6);
    expect(volumenes(T, eq + 0.5).relleno).toBeGreaterThan(volumenes(T, eq).relleno);
  });
  it('solo dentro de la huella de la casa', () => {
    const T = malla((x) => x);
    const huella = [{ x: 6, y: 2 }, { x: 10, y: 2 }, { x: 10, y: 8 }, { x: 6, y: 8 }];
    const v = volumenes(T, 6, huella);
    expect(v.area).toBeCloseTo(24, 6);
    expect(v.corte).toBeCloseTo(6 * 8, 6);
    expect(v.relleno).toBeCloseTo(0, 9);
    expect(recortar([{ x: 0, y: 0, z: 0 }, { x: 10, y: 0, z: 10 }, { x: 0, y: 10, z: 0 }], huella).length).toBeGreaterThan(2);
  });
  it('viajes de volqueta con el esponjamiento', () => {
    expect(viajes(24)).toBe(5);
    expect(viajes(24, { capacidad: 14 })).toBe(3);
    expect(viajes(0)).toBe(0);
  });
});

describe('levantamiento', () => {
  const lev = () => normalizar({
    nombre: 'Lote de prueba',
    puntos: [
      { tipo: 'esquina', x: 0, y: 0, z: 0 }, { tipo: 'esquina', x: 20, y: 0, z: 1 },
      { tipo: 'esquina', x: 20, y: 30, z: 4 }, { tipo: 'esquina', x: 0, y: 30, z: 3 },
      { tipo: 'nivel', x: 10, y: 15, z: 2.2 },
    ],
  });
  it('limpia datos raros y pone nombres', () => {
    const L = normalizar({ puntos: [{ x: 1, y: 2 }, { x: 'a' }, null, { tipo: 'nivel', x: 3, y: 4, z: '1.5' }], exageracion: 99 });
    expect(L.puntos.map(p => p.id)).toEqual(['P1', 'N1']);
    expect(L.puntos[0].z).toBeNull();
    expect(L.puntos[1].z).toBe(1.5);
    expect(L.exageracion).toBe(10);
    expect(siguienteId(L, 'esquina')).toBe('P2');
    expect(normalizar(null).puntos).toEqual([]);
    expect(nuevoLevantamiento().plataforma.modo).toBe('equilibrio');
  });
  it('calcula área, curvas, pendiente y tierra', () => {
    const D = calcular(lev());
    expect(D.area).toBeCloseTo(600);
    expect(D.perimetro).toBeCloseTo(100);
    expect(D.desnivel).toBeCloseTo(4);
    expect(D.intervalo).toBe(0.5);
    expect(D.curvas.length).toBeGreaterThan(5);
    expect(D.pendiente.general).toBeGreaterThan(5);
    expect(D.volumen.corte).toBeCloseTo(D.volumen.relleno, 6);
    expect(D.plataforma.z).toBeCloseTo(D.plataforma.equilibrio, 9);
    expect(D.volumen.viajes6).toBeGreaterThan(0);
  });
  it('sin cotas el terreno queda plano y sin curvas', () => {
    const L = normalizar({ puntos: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }] });
    const D = calcular(L);
    expect(D.sinNiveles).toBe(true);
    expect(D.curvas).toEqual([]);
    expect(D.area).toBeCloseTo(100);
  });
  it('rellena la cota de los puntos que no la tienen', () => {
    const L = lev();
    L.puntos[4].z = null;
    const D = calcular(L);
    expect(D.estimadas).toBe(1);
    expect(D.puntos[4].z).toBeGreaterThan(0);
  });
  it('plataforma fija', () => {
    const L = lev();
    L.plataforma = { modo: 'fija', z: 1 };
    const D = calcular(L);
    expect(D.plataforma.z).toBe(1);
    expect(D.volumen.corte).toBeGreaterThan(D.volumen.relleno);
  });
  it('intervalo de curvas según el desnivel', () => {
    expect(intervaloSugerido(0.6)).toBe(0.1);
    expect(intervaloSugerido(12)).toBe(1);
  });
});

describe('compartir y exportar', () => {
  const L = normalizar({
    nombre: 'Finca la Ñata',
    origen: MEDELLIN,
    puntos: [
      { tipo: 'esquina', x: 0, y: 0, z: 0, fuente: 'gps', prec: 2.4 }, { tipo: 'esquina', x: 40, y: 2, z: 3.1, fuente: 'gps' },
      { tipo: 'esquina', x: 38, y: 55, z: 9.4, fuente: 'gps' }, { tipo: 'esquina', x: -2, y: 50, z: 6.2, fuente: 'gps' },
      { tipo: 'nivel', x: 20, y: 25, z: 4.4, fuente: 'mira' },
    ],
  });
  it('el enlace ida y vuelta conserva el levantamiento', async () => {
    const e = await enlaceDe(L, 'https://topo.axionasoft.com/');
    expect(e.startsWith('https://topo.axionasoft.com/#t=')).toBe(true);
    expect(e.length).toBeLessThan(700);
    const B = await deEnlace(e.slice(e.indexOf('#')));
    expect(B.nombre).toBe('Finca la Ñata');
    expect(B.puntos.length).toBe(5);
    expect(B.puntos[1]).toMatchObject({ id: 'P2', x: 40, y: 2, z: 3.1, tipo: 'esquina', fuente: 'gps' });
    expect(B.puntos[4].fuente).toBe('mira');
    expect(B.origen.lat).toBeCloseTo(MEDELLIN.lat, 6);
    expect(await deEnlace('#t=basura')).toBeNull();
    expect(await desempacar(await empacar({ a: [1, 2] }))).toEqual({ a: [1, 2] });
  });
  it('PNEZD, DXF, KML y GeoJSON', () => {
    const D = calcular(L);
    const csv = aPNEZD(D).trim().split('\r\n');
    expect(csv.length).toBe(5);
    expect(csv[1]).toBe('2,1002.000,1040.000,103.100,P2 esquina');
    const dxf = aDXF(D, 'Finca');
    for (const t of ['AC1009', 'LINDERO', 'CURVAS_MAYOR', 'VERTEX', 'SEQEND', 'EOF']) expect(dxf).toContain(t);
    expect(dxf).not.toMatch(/[^\x00-\x7f]/);
    const kml = aKML(D, L.origen, 'Finca');
    expect(kml).toContain('<Polygon>');
    expect(kml.match(/<Placemark>/g).length).toBe(6);
    const gj = JSON.parse(aGeoJSON(D, L.origen, 'Finca'));
    expect(gj.features[0].geometry.coordinates[0].length).toBe(5);
    expect(gj.features[0].geometry.coordinates[0][0][0]).toBeCloseTo(MEDELLIN.lon, 6);
    expect(aKML(D, null)).toBeNull();
  });
  it('lote para Axiona Obra con cotas desde la primera esquina', async () => {
    const D = calcular(L);
    const S = proyectoObra(D, 'Finca');
    expect(S.lot.length).toBe(4);
    expect(S.lot[0]).toEqual({ x: 0, y: 0, z: 0 });
    expect(S.lot[2].z).toBe(9.4);
    expect(S.spots).toEqual([{ x: 20, y: 25, z: 4.4 }]);
    const e = await enlaceObra(D, 'Finca');
    expect(e).toMatch(/^https:\/\/obra\.axionasoft\.com\/#p=z[A-Za-z0-9_-]+$/);
    expect(await desempacar(e.split('#p=')[1])).toEqual(S);
  });
});

describe('huella de la obra', () => {
  const L = () => normalizar({
    puntos: [
      { x: 0, y: 0, z: 0 }, { x: 20, y: 0, z: 0 }, { x: 20, y: 30, z: 3 }, { x: 0, y: 30, z: 3 },
    ],
    huella: { activa: true, ancho: 8, fondo: 10 },
  });
  it('calcula la tierra solo dentro de la obra, paralela al frente', () => {
    const D = calcular(L());
    expect(D.huella.length).toBe(4);
    expect(D.volumen.area).toBeCloseTo(80, 6);
    // Terreno z = 0,1·y: en el centro (y = 15) la cota media es 1,5 y la cuña vale 8·10·0,5/2·... en cada mitad
    expect(D.plataforma.z).toBeCloseTo(1.5, 6);
    expect(D.volumen.corte).toBeCloseTo(8 * (0.5 * 5 * 5 * 0.1), 6);
    expect(D.volumen.relleno).toBeCloseTo(D.volumen.corte, 6);
  });
  it('se mueve con x, y y avisa si queda fuera del terreno', () => {
    const A = L(); A.huella.x = 10; A.huella.y = 25;
    expect(calcular(A).plataforma.z).toBeCloseTo(2.5, 6);
    const B = L(); B.huella.x = 200; B.huella.y = 200;
    const D = calcular(B);
    expect(D.huellaFuera).toBe(true);
    expect(D.huella).toBeNull();
    expect(D.volumen.area).toBeCloseTo(600, 6);
  });
  it('viaja en el enlace', async () => {
    const A = L(); A.huella.x = 9.5; A.huella.y = 12;
    const e = await enlaceDe(A, 'https://topo.axionasoft.com/');
    const B = await deEnlace(e.slice(e.indexOf('#')));
    expect(B.huella).toEqual({ activa: true, ancho: 8, fondo: 10, x: 9.5, y: 12 });
  });
});

describe('pendiente fuerte', () => {
  it('un triángulo delgado del borde no dispara la pendiente fuerte', () => {
    const D = calcular(normalizar({ puntos: [
      { x: 0, y: 0, z: 0 }, { x: 20, y: 0, z: 0 }, { x: 20, y: 20, z: 2 }, { x: 0, y: 20, z: 2 },
      { tipo: 'nivel', x: 0.2, y: 10, z: 6 },
    ] }));
    expect(D.pendiente.maxima).toBeGreaterThan(100);
    expect(D.pendiente.fuerte).toBeLessThan(D.pendiente.maxima);
  });
});

describe('triangulación sin huecos', () => {
  it('un punto casi sobre el borde no deja huecos: el área del modelo es la del lote', () => {
    const P = [{ x: 0, y: 0, z: 0 }, { x: 20, y: 0, z: 0 }, { x: 20, y: 20, z: 2 }, { x: 0, y: 20, z: 2 }, { x: 0.01, y: 10, z: 6 }, { x: 10, y: 0.005, z: 1 }];
    const T = armarTIN(P, P.slice(0, 4));
    const A = T.triangulos.reduce((s, [a, b, c]) => { const Q = T.puntos; return s + Math.abs((Q[b].x - Q[a].x) * (Q[c].y - Q[a].y) - (Q[b].y - Q[a].y) * (Q[c].x - Q[a].x)) / 2; }, 0);
    expect(A).toBeCloseTo(400, 6);
    expect(T.triangulos.length).toBe(2 * 6 - 2 - 4);
  });
  it('puntos alineados y repetidos no rompen nada', () => {
    expect(delaunay([{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }])).toEqual([]);
    const T = armarTIN([{ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 1 }, { x: 5, y: 0, z: 0 }, { x: 0, y: 5, z: 0 }]);
    expect(T.puntos.length).toBe(3);
    expect(T.triangulos.length).toBe(1);
  });
});

describe('ajuste por mínimos cuadrados del lote a cinta', async () => {
  const { ajustarCinta, medidasDeCinta } = await import('../src/motor/poligono.js');
  const real = [{ x: 0, y: 0 }, { x: 14, y: 0 }, { x: 15.5, y: 21 }, { x: 0.8, y: 19.6 }];
  const d = (a, b) => Math.hypot(real[b].x - real[a].x, real[b].y - real[a].y);
  it('con medidas exactas devuelve el lote real y residuos cero', () => {
    const med = { lados: [d(0, 1), d(1, 2), d(2, 3), d(3, 0)], diagonales: [d(0, 2)], control: { i: 1, j: 3, medida: d(1, 3) } };
    const r = ajustarCinta(medidasDeCinta(med), loteACinta(med).puntos);
    expect(r.redundancia).toBe(1);
    expect(r.sigma0).toBeLessThan(1e-6);
    r.puntos.forEach((p, i) => { expect(p.x).toBeCloseTo(real[i].x, 4); expect(p.y).toBeCloseTo(real[i].y, 4); });
  });
  it('con un error de 6 cm en un lado reparte el cierre y se acerca más al lote real', () => {
    const med = { lados: [d(0, 1), d(1, 2) + 0.06, d(2, 3), d(3, 0)], diagonales: [d(0, 2)], control: { i: 1, j: 3, medida: d(1, 3) } };
    const directo = loteACinta(med).puntos;
    const r = ajustarCinta(medidasDeCinta(med), directo);
    const errorArea = pts => Math.abs(area(pts) - area(real));
    expect(errorArea(r.puntos)).toBeLessThan(errorArea(directo));
    expect(r.sigma0).toBeGreaterThan(0.005);
    expect(r.residuos.find(o => o.que === 'lado 2-3').residuo).toBeLessThan(0);
  });
  it('sin medidas de más no cambia nada', () => {
    const med = { lados: [d(0, 1), d(1, 2), d(2, 3), d(3, 0)], diagonales: [d(0, 2)] };
    const r = ajustarCinta(medidasDeCinta(med), loteACinta(med).puntos);
    expect(r.redundancia).toBe(0);
    expect(r.sigma0).toBeNull();
  });
});

describe('GPS con antena RTK', () => {
  it('reporta centímetros y la altura sirve', () => {
    const lect = [];
    for (let i = 0; i < 15; i++) {
      const g = aGeo(5 + 0.004 * Math.sin(i), 7 + 0.004 * Math.cos(i), MEDELLIN);
      lect.push({ lat: g.lat, lon: g.lon, acc: 0.014, alt: 1500.25 + 0.005 * Math.sin(i * 2), altAcc: 0.02, t: i * 1000 });
    }
    const salto = aGeo(5.6, 7, MEDELLIN);
    lect.push({ lat: salto.lat, lon: salto.lon, acc: 0.014, alt: 1500.25, altAcc: 0.02, t: 16000 });
    const r = promediarGPS(lect);
    expect(r.rtk).toBe(true);
    expect(r.descartadas).toBe(1);
    expect(r.prec).toBeLessThan(0.02);
    expect(r.altPrec).toBeLessThan(0.03);
    expect(r.alt).toBeCloseTo(1500.25, 2);
    const q = aLocal(r.lat, r.lon, MEDELLIN);
    expect(Math.hypot(q.x - 5, q.y - 7)).toBeLessThan(0.005);
  });
  it('el GPS del celular sigue con piso de 50 cm', () => {
    const g = aGeo(1, 1, MEDELLIN);
    const r = promediarGPS([{ lat: g.lat, lon: g.lon, acc: 0.8, t: 0 }, { lat: g.lat, lon: g.lon, acc: 0.8, t: 1000 }]);
    expect(r.rtk).toBe(false);
    expect(r.prec).toBeGreaterThanOrEqual(0.05);
  });
});
