/* ==========================================================================
   AXIONA TOPO · Archivos para otros programas
   --------------------------------------------------------------------------
   - PNEZD (.csv): el formato de puntos de las estaciones totales y de
     AutoCAD Civil 3D. Coordenadas locales: E 1000, N 1000 y cota 100 en el
     origen, como se arranca una poligonal con coordenadas arbitrarias.
   - DXF (R12): lindero y curvas como polilineas 3D, puntos con su cota y
     las medidas de los lados. Lo abren AutoCAD, Civil 3D, QGIS y LibreCAD.
   - KML y GeoJSON: el lote sobre el mapa (Google Earth, QGIS). Solo si se
     midio con GPS, porque es lo unico que amarra el lote a la Tierra.
   - Enlace a Axiona Obra: abre el lote medido para diseñar la casa.
   ========================================================================== */

import { aGeo } from './geo.js';
import { empacar } from './compartir.js';

export const E0 = 1000, N0 = 1000, Z0 = 100;

const f = (v, d = 3) => (Number.isFinite(v) ? v.toFixed(d) : '');
const ascii = t => String(t).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\x20-\x7e]/g, '');

/** Puntos P,N,E,Z,D sin encabezado, punto decimal. */
export function aPNEZD(D) {
  return D.puntos.map((p, i) => [i + 1, f(N0 + p.y), f(E0 + p.x), f(Z0 + p.z), ascii(`${p.id} ${p.tipo}${p.estimada ? ' cota estimada' : ''}`).replace(/,/g, ' ')].join(',')).join('\r\n') + '\r\n';
}

export function aDXF(D, nombre = 'LOTE') {
  const o = [];
  const capas = [['LINDERO', 4], ['PUNTOS', 2], ['CURVAS_MAYOR', 3], ['CURVAS_MENOR', 8], ['TEXTO', 7]];
  o.push('0', 'SECTION', '2', 'HEADER', '9', '$ACADVER', '1', 'AC1009', '9', '$INSUNITS', '70', '6', '0', 'ENDSEC');
  o.push('0', 'SECTION', '2', 'TABLES');
  o.push('0', 'TABLE', '2', 'LTYPE', '70', '1', '0', 'LTYPE', '2', 'CONTINUOUS', '70', '0', '3', 'Solid line', '72', '65', '73', '0', '40', '0.0', '0', 'ENDTAB');
  o.push('0', 'TABLE', '2', 'LAYER', '70', String(capas.length));
  for (const [n, c] of capas) o.push('0', 'LAYER', '2', n, '70', '0', '62', String(c), '6', 'CONTINUOUS');
  o.push('0', 'ENDTAB', '0', 'ENDSEC', '0', 'SECTION', '2', 'ENTITIES');
  const X = p => f(E0 + p.x, 4), Y = p => f(N0 + p.y, 4), Z = p => f(Z0 + (p.z ?? 0), 4);
  const pol3d = (capa, pts, cerrada) => {
    o.push('0', 'POLYLINE', '8', capa, '66', '1', '10', '0', '20', '0', '30', '0', '70', String(cerrada ? 9 : 8));
    for (const p of pts) o.push('0', 'VERTEX', '8', capa, '10', X(p), '20', Y(p), '30', Z(p), '70', '32');
    o.push('0', 'SEQEND', '8', capa);
  };
  const tx = (capa, p, h, t, rot = 0) => o.push('0', 'TEXT', '8', capa, '10', X(p), '20', Y(p), '30', Z(p), '40', f(h, 3), '1', ascii(t), '50', f(rot, 2));
  if (D.lindero.length >= 3) {
    pol3d('LINDERO', D.lindero, true);
    D.lados.forEach(l => {
      const a = D.lindero[l.i], b = D.lindero[l.j];
      let rot = Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI;
      if (rot > 90 || rot < -90) rot += 180;
      tx('TEXTO', { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, z: (a.z + b.z) / 2 }, 0.25, `${l.largo.toFixed(2)} m`, rot);
    });
  }
  for (const c of D.curvas) for (const ln of c.lineas) pol3d(c.mayor ? 'CURVAS_MAYOR' : 'CURVAS_MENOR', ln.map(p => ({ ...p, z: c.z })), false);
  for (const p of D.puntos) {
    o.push('0', 'POINT', '8', 'PUNTOS', '10', X(p), '20', Y(p), '30', Z(p));
    tx('PUNTOS', { x: p.x + 0.15, y: p.y + 0.15, z: p.z }, 0.2, `${p.id} ${(Z0 + p.z).toFixed(2)}`);
  }
  tx('TEXTO', { x: D.centro.x, y: D.centro.y, z: D.zmin }, 0.4, `${nombre} - AREA ${D.area.toFixed(2)} m2 - AXIONA TOPO (levantamiento preliminar)`);
  o.push('0', 'ENDSEC', '0', 'EOF');
  return o.join('\r\n') + '\r\n';
}

const xml = t => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export function aKML(D, origen, nombre = 'Lote') {
  if (!origen) return null;
  const g = p => aGeo(p.x, p.y, origen);
  const anillo = D.lindero.length >= 3 ? [...D.lindero, D.lindero[0]].map(p => { const q = g(p); return `${q.lon.toFixed(8)},${q.lat.toFixed(8)},0`; }).join(' ') : '';
  const marcas = D.puntos.map(p => {
    const q = g(p);
    return `<Placemark><name>${xml(p.id)}</name><description>${xml(`${p.tipo} · cota ${p.z.toFixed(2)} m`)}</description><styleUrl>#punto</styleUrl><Point><coordinates>${q.lon.toFixed(8)},${q.lat.toFixed(8)},0</coordinates></Point></Placemark>`;
  }).join('');
  return `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2"><Document><name>${xml(nombre)}</name>
<Style id="lote"><LineStyle><color>ffffcf3f</color><width>3</width></LineStyle><PolyStyle><color>4dffcf3f</color></PolyStyle></Style>
<Style id="punto"><IconStyle><color>ff2baeff</color><scale>0.8</scale></IconStyle></Style>
${anillo ? `<Placemark><name>${xml(nombre)} · ${D.area.toFixed(1)} m²</name><styleUrl>#lote</styleUrl><Polygon><outerBoundaryIs><LinearRing><coordinates>${anillo}</coordinates></LinearRing></outerBoundaryIs></Polygon></Placemark>` : ''}
${marcas}
</Document></kml>
`;
}

export function aGeoJSON(D, origen, nombre = 'Lote') {
  if (!origen) return null;
  const g = p => { const q = aGeo(p.x, p.y, origen); return [+q.lon.toFixed(8), +q.lat.toFixed(8)]; };
  const feats = [];
  if (D.lindero.length >= 3) {
    feats.push({ type: 'Feature', properties: { nombre, area_m2: +D.area.toFixed(2), perimetro_m: +D.perimetro.toFixed(2) }, geometry: { type: 'Polygon', coordinates: [[...D.lindero, D.lindero[0]].map(g)] } });
  }
  for (const p of D.puntos) feats.push({ type: 'Feature', properties: { id: p.id, tipo: p.tipo, cota_m: +p.z.toFixed(3) }, geometry: { type: 'Point', coordinates: g(p) } });
  return JSON.stringify({ type: 'FeatureCollection', features: feats }, null, 1);
}

/** Proyecto minimo de Axiona Obra con el lote medido (cotas desde la primera esquina). */
export function proyectoObra(D, nombre = '') {
  if (D.lindero.length < 3) return null;
  const z0 = D.lindero[0].z;
  const r = v => Math.round(v * 100) / 100;
  return {
    nombre: nombre || 'Lote medido con Axiona Topo',
    lot: D.lindero.map(p => ({ x: r(p.x), y: r(p.y), z: r(p.z - z0) })),
    spots: D.niveles.map(p => ({ x: r(p.x), y: r(p.y), z: r(p.z - z0) })),
    frente: 0,
  };
}

export async function enlaceObra(D, nombre = '', base = 'https://obra.axionasoft.com/') {
  const S = proyectoObra(D, nombre);
  return S ? `${base}#p=${await empacar(S)}` : null;
}
