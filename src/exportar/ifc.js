/* ==========================================================================
   AXIONA OBRA · Exportación BIM en IFC 4 (ISO 16739-1:2018)
   --------------------------------------------------------------------------
   El mismo modelo de los planos convertido en un modelo BIM que abren Revit
   (Abrir → IFC / Vincular IFC), ArchiCAD, Navisworks, BIMcollab, Solibri,
   Tekla y cualquier visor IFC:
     proyecto → sitio → edificio → un piso (IfcBuildingStorey) por nivel,
     muros con sus vanos reales (IfcOpeningElement) y puertas y ventanas
     que los llenan, losas de entrepiso y cubierta, columnas, espacios con
     nombre y área, escaleras, terrazas, cubierta inclinada y piscina,
     con materiales, propiedades (Pset_*Common) y cantidades.
   Coordenadas en metros, iguales a las del DXF/DWG: el IFC y el CAD caen
   uno encima del otro. Módulo puro (sin DOM).
   ========================================================================== */

const B64 = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz_$';
/** GlobalId IFC: 22 caracteres (128 bits en base 64 IFC). */
function guid() {
  const a = new Uint8Array(22); globalThis.crypto.getRandomValues(a);
  let s = B64[a[0] % 4]; for (let i = 1; i < 22; i++) s += B64[a[i] % 64];
  return s;
}
/** Cadena IFC: ASCII directo; lo demás como \X2\HHHH\X0\ (UTF-16), así Revit muestra bien las tildes. */
function str(t) {
  if (t === null || t === undefined || t === '') return '$';
  let o = '';
  for (const ch of String(t)) {
    const c = ch.codePointAt(0);
    if (ch === "'") o += "''"; else if (ch === '\\') o += '\\\\';
    else if (c >= 32 && c < 127) o += ch;
    else if (c <= 0xffff) o += '\\X2\\' + c.toString(16).toUpperCase().padStart(4, '0') + '\\X0\\';
  }
  return `'${o}'`;
}
const R = n => { const v = Math.abs(n) < 1e-9 ? 0 : +n; const s = String(+v.toFixed(6)); return /[.eE]/.test(s) ? s : s + '.'; };
const cerca = (a, b, e = 0.02) => Math.abs(a - b) <= e;

class Escritor {
  constructor() { this.l = []; this.n = 0; }
  e(t) { this.n++; this.l.push(`#${this.n}=${t};`); return `#${this.n}`; }
  pt(x, y, z) { return z === undefined ? this.e(`IFCCARTESIANPOINT((${R(x)},${R(y)}))`) : this.e(`IFCCARTESIANPOINT((${R(x)},${R(y)},${R(z)}))`); }
  dir(x, y, z) { return z === undefined ? this.e(`IFCDIRECTION((${R(x)},${R(y)}))`) : this.e(`IFCDIRECTION((${R(x)},${R(y)},${R(z)}))`); }
  ax3(x = 0, y = 0, z = 0, eje = null, ref = null) { return this.e(`IFCAXIS2PLACEMENT3D(${this.pt(x, y, z)},${eje || '$'},${ref || '$'})`); }
  ax2(x = 0, y = 0) { return this.e(`IFCAXIS2PLACEMENT2D(${this.pt(x, y)},$)`); }
  lugar(rel, x = 0, y = 0, z = 0, eje = null, ref = null) { return this.e(`IFCLOCALPLACEMENT(${rel || '$'},${this.ax3(x, y, z, eje, ref)})`); }
}

/**
 * IFC 4 del proyecto.
 * @param {object} M  modelo calculado (buildModel)
 * @param {object} S  estado del proyecto
 * @returns {string} archivo .ifc (STEP)
 */
export function exportarIFC(M, S = {}) {
  if (!M || M.err) throw new Error('El modelo tiene errores: corrígelos antes de exportar.');
  const w = new Escritor();
  const fh = M.fh, sl = M.slab, hMuro = fh - sl, dl = M.dl || 0, F = M.F;
  const nombre = S.nombre || 'Proyecto Axiona Obra';

  // ---------- unidades, contextos y proyecto
  const unidades = w.e(`IFCUNITASSIGNMENT((${w.e('IFCSIUNIT(*,.LENGTHUNIT.,$,.METRE.)')},${w.e('IFCSIUNIT(*,.AREAUNIT.,$,.SQUARE_METRE.)')},${w.e('IFCSIUNIT(*,.VOLUMEUNIT.,$,.CUBIC_METRE.)')},${w.e('IFCSIUNIT(*,.PLANEANGLEUNIT.,$,.RADIAN.)')}))`);
  const ctx = w.e(`IFCGEOMETRICREPRESENTATIONCONTEXT($,'Model',3,1.E-05,${w.ax3()},${w.dir(0, 1)})`);
  const cBody = w.e(`IFCGEOMETRICREPRESENTATIONSUBCONTEXT('Body','Model',*,*,*,*,${ctx},$,.MODEL_VIEW.,$)`);
  const cEje = w.e(`IFCGEOMETRICREPRESENTATIONSUBCONTEXT('Axis','Model',*,*,*,*,${ctx},$,.GRAPH_VIEW.,$)`);
  const proyecto = w.e(`IFCPROJECT('${guid()}',$,${str(nombre)},${str(S.proyecto?.direccion || S.proyecto?.ciudad || '')},$,$,$,(${ctx}),${unidades})`);
  const lSitio = w.lugar(null);
  const sitio = w.e(`IFCSITE('${guid()}',$,${str('Lote')},${str(S.proyecto?.ciudad || '')},$,${lSitio},$,$,.ELEMENT.,$,$,${R(dl)},$,$)`);
  const lEd = w.lugar(lSitio);
  const edificio = w.e(`IFCBUILDING('${guid()}',$,${str(nombre)},${str('Generado con Axiona Obra')},$,${lEd},$,$,.ELEMENT.,${R(dl)},$,$)`);
  w.e(`IFCRELAGGREGATES('${guid()}',$,$,$,${proyecto},(${sitio}))`);
  w.e(`IFCRELAGGREGATES('${guid()}',$,$,$,${sitio},(${edificio}))`);

  // ---------- materiales, formas y propiedades
  const mats = {}, usoMat = {};
  const material = (n, cat) => (mats[n] ||= w.e(`IFCMATERIAL(${str(n)},$,${str(cat || '')})`));
  const asociar = (n, cat, el) => { material(n, cat); (usoMat[n] ||= []).push(el); };
  const forma = (items, tipo = 'SweptSolid', ctxR = cBody, id = 'Body') => w.e(`IFCSHAPEREPRESENTATION(${ctxR},'${id}',${str(tipo)},(${items.join(',')}))`);
  const producto = (...reps) => w.e(`IFCPRODUCTDEFINITIONSHAPE($,$,(${reps.join(',')}))`);
  /** Caja extruida: lx × ly en planta (esquina en x, y) y alto h desde z. */
  const caja = (lx, ly, h, x = 0, y = 0, z = 0) => w.e(`IFCEXTRUDEDAREASOLID(${w.e(`IFCRECTANGLEPROFILEDEF(.AREA.,$,${w.ax2(lx / 2, ly / 2)},${R(lx)},${R(ly)})`)},${w.ax3(x, y, z)},${w.dir(0, 0, 1)},${R(h)})`);
  const pset = (el, nom, props) => {
    const ps = Object.entries(props).filter(([, v]) => v !== undefined && v !== null).map(([k, v]) => w.e(`IFCPROPERTYSINGLEVALUE(${str(k)},$,${typeof v === 'boolean' ? `IFCBOOLEAN(.${v ? 'T' : 'F'}.)` : typeof v === 'number' ? `IFCREAL(${R(v)})` : `IFCLABEL(${str(v)})`},$)`));
    if (ps.length) w.e(`IFCRELDEFINESBYPROPERTIES('${guid()}',$,$,$,(${el}),${w.e(`IFCPROPERTYSET('${guid()}',$,${str(nom)},$,(${ps.join(',')}))`)})`);
  };
  const cantidades = (el, nom, q) => {
    const qs = Object.entries(q).map(([k, [tipo, v]]) => w.e(`IFCQUANTITY${tipo}(${str(k)},$,$,${R(v)},$)`));
    w.e(`IFCRELDEFINESBYPROPERTIES('${guid()}',$,$,$,(${el}),${w.e(`IFCELEMENTQUANTITY('${guid()}',$,${str(nom)},$,$,(${qs.join(',')}))`)})`);
  };

  const sistema = M.sistema;
  const muroExt = sistema === 'madera' ? 'Entramado de madera' : sistema === 'confinada' ? 'Mampostería confinada' : 'Mampostería de bloque';
  const pisos = [], lPisos = [], contenido = new Map(), espacios = new Map();
  const meter = (p, el) => { if (!contenido.has(p)) contenido.set(p, []); contenido.get(p).push(el); };

  M.floors.forEach(fl => {
    const f = fl.f, z = dl + f * fh;
    const lP = w.lugar(lEd, 0, 0, z);
    const piso = w.e(`IFCBUILDINGSTOREY('${guid()}',$,${str(`Piso ${f + 1}`)},$,$,${lP},$,${str(f === 0 ? 'Primer piso' : `Piso ${f + 1}`)},.ELEMENT.,${R(z)})`);
    pisos.push(piso); lPisos.push(lP);

    // losa de este nivel (en el primer piso, placa de contrapiso)
    const zonas = fl.alas?.length ? fl.alas : [fl.R || M.R];
    zonas.forEach((r, i) => {
      const lL = w.lugar(lP);
      const losa = w.e(`IFCSLAB('${guid()}',$,${str(`${f === 0 ? 'Placa de contrapiso' : 'Losa de entrepiso'} ${zonas.length > 1 ? i + 1 : ''}`.trim())},$,$,${lL},${producto(forma([caja(r.x1 - r.x0, r.y1 - r.y0, sl, r.x0, r.y0, -sl)]))},$,${f === 0 ? '.BASESLAB.' : '.FLOOR.'})`);
      meter(piso, losa); asociar('Concreto reforzado', 'concrete', losa);
      pset(losa, 'Pset_SlabCommon', { IsExternal: false, LoadBearing: true });
      cantidades(losa, 'Qto_SlabBaseQuantities', { GrossArea: ['AREA', (r.x1 - r.x0) * (r.y1 - r.y0)], Depth: ['LENGTH', sl] });
    });

    // muros con sus vanos
    const opsLibres = new Set(fl.ops);
    fl.lines.forEach((l, k) => {
      const t = l.ext ? 0.2 : 0.12;
      const a0 = l.a - (l.ext ? t / 2 : 0), L = l.b - l.a + (l.ext ? t : 0);
      if (L < 0.05) return;
      const [ox, oy, ref] = l.o === 'H' ? [a0, l.c, w.dir(1, 0, 0)] : [l.c, a0, w.dir(0, 1, 0)];
      const lM = w.lugar(lP, ox, oy, 0, w.dir(0, 0, 1), ref);
      const cuerpo = forma([w.e(`IFCEXTRUDEDAREASOLID(${w.e(`IFCRECTANGLEPROFILEDEF(.AREA.,$,${w.ax2(L / 2, 0)},${R(L)},${R(t)})`)},${w.ax3()},${w.dir(0, 0, 1)},${R(hMuro)})`)]);
      const eje = forma([w.e(`IFCPOLYLINE((${w.pt(0, 0)},${w.pt(L, 0)}))`)], 'Curve2D', cEje, 'Axis');
      const muro = w.e(`IFCWALL('${guid()}',$,${str(`${l.ext ? 'Muro exterior' : 'Muro interior'} P${f + 1}-${k + 1}`)},$,$,${lM},${producto(eje, cuerpo)},$,.STANDARD.)`);
      meter(piso, muro);
      asociar(l.ext ? muroExt : (sistema === 'madera' ? 'Entramado de madera' : 'Mampostería liviana / drywall'), 'masonry', muro);
      pset(muro, 'Pset_WallCommon', { IsExternal: !!l.ext, LoadBearing: !!l.ext && sistema !== 'porticos', Reference: l.ext ? 'Exterior' : 'Interior' });
      cantidades(muro, 'Qto_WallBaseQuantities', { Length: ['LENGTH', L], Width: ['LENGTH', t], Height: ['LENGTH', hMuro], GrossSideArea: ['AREA', L * hMuro] });

      // vanos de puertas y ventanas sobre este muro
      fl.ops.filter(o => opsLibres.has(o) && o.o === l.o && cerca(o.c, l.c) && o.a >= l.a - 0.05 && o.b <= l.b + 0.05).forEach(o => {
        opsLibres.delete(o);
        const ancho = Math.max(0.3, o.b - o.a), ventana = o.kind === 'win';
        const z0 = ventana ? Math.max(0, o.sill ?? 1) : 0;
        const alto = Math.min(hMuro - z0 - 0.02, ventana ? (o.h || 1.2) : (o.h || 2.1));
        if (alto < 0.2) return;
        const lV = w.e(`IFCLOCALPLACEMENT(${lM},${w.ax3(o.a - a0, 0, z0)})`);
        const hueco = w.e(`IFCEXTRUDEDAREASOLID(${w.e(`IFCRECTANGLEPROFILEDEF(.AREA.,$,${w.ax2(ancho / 2, 0)},${R(ancho)},${R(t + 0.1)})`)},${w.ax3()},${w.dir(0, 0, 1)},${R(alto)})`);
        const vano = w.e(`IFCOPENINGELEMENT('${guid()}',$,${str(`Vano ${ventana ? 'ventana' : 'puerta'}`)},$,$,${lV},${producto(forma([hueco]))},$,.OPENING.)`);
        w.e(`IFCRELVOIDSELEMENT('${guid()}',$,$,$,${muro},${vano})`);
        const lE = w.e(`IFCLOCALPLACEMENT(${lV},${w.ax3()})`);
        const grueso = ventana ? 0.06 : 0.045;
        const hoja = w.e(`IFCEXTRUDEDAREASOLID(${w.e(`IFCRECTANGLEPROFILEDEF(.AREA.,$,${w.ax2(ancho / 2, 0)},${R(ancho)},${R(grueso)})`)},${w.ax3()},${w.dir(0, 0, 1)},${R(alto)})`);
        const nombreEl = ventana ? `${o.ventanal ? 'Ventanal' : 'Ventana'}${o.tag ? ' ' + o.tag : ''} · ${o.room || ''}` : `${o.kind === 'main' ? 'Puerta principal' : o.kind === 'asc' ? 'Puerta de ascensor' : 'Puerta'} · ${o.room || ''}`;
        const el = ventana
          ? w.e(`IFCWINDOW('${guid()}',$,${str(nombreEl)},$,$,${lE},${producto(forma([hoja]))},${str(o.tag || '')},${R(alto)},${R(ancho)},.WINDOW.,.SINGLE_PANEL.,$)`)
          : w.e(`IFCDOOR('${guid()}',$,${str(nombreEl)},$,$,${lE},${producto(forma([hoja]))},$,${R(alto)},${R(ancho)},.DOOR.,${o.kind === 'asc' ? '.SLIDING_TO_LEFT.' : '.SINGLE_SWING_LEFT.'},$)`);
        w.e(`IFCRELFILLSELEMENT('${guid()}',$,$,$,${vano},${el})`);
        meter(piso, el);
        asociar(ventana ? 'Vidrio y aluminio' : 'Madera', ventana ? 'glass' : 'wood', el);
        pset(el, ventana ? 'Pset_WindowCommon' : 'Pset_DoorCommon', { IsExternal: ventana ? !!l.ext : o.kind === 'main', Reference: o.tag || undefined });
      });
    });

    // columnas (pórticos)
    if (sistema === 'porticos' || sistema === 'hormigon') {
      const b = M.colB || 0.3;
      M.cols.filter(c => f < (c.n ?? F)).forEach(c => {
        const col = w.e(`IFCCOLUMN('${guid()}',$,${str(`Columna ${c.id || ''} P${f + 1}`.trim())},$,$,${w.lugar(lP)},${producto(forma([caja(b, b, hMuro, c.x - b / 2, c.y - b / 2, 0)]))},$,.COLUMN.)`);
        meter(piso, col); asociar('Concreto reforzado', 'concrete', col);
        pset(col, 'Pset_ColumnCommon', { LoadBearing: true, IsExternal: false });
      });
    }

    // espacios y escaleras
    fl.rects.forEach((r, i) => {
      const lx = r.x1 - r.x0, ly = r.y1 - r.y0;
      if (lx < 0.2 || ly < 0.2) return;
      if (r.stair) {
        const largo = Math.max(lx, ly), alongX = lx >= ly, n = Math.max(8, Math.round(fh / 0.175)), huella = largo / n, ch = fh / n;
        const pasos = [];
        for (let k = 0; k < n; k++) pasos.push(alongX ? caja(huella, ly, (k + 1) * ch, r.x0 + k * huella, r.y0, 0) : caja(lx, huella, (k + 1) * ch, r.x0, r.y0 + k * huella, 0));
        const esc = w.e(`IFCSTAIR('${guid()}',$,${str(`Escalera P${f + 1}`)},$,$,${w.lugar(lP)},${producto(forma(pasos))},$,.STRAIGHT_RUN_STAIR.)`);
        meter(piso, esc); asociar('Concreto reforzado', 'concrete', esc);
        pset(esc, 'Pset_StairCommon', { NumberOfRiser: n, NumberOfTreads: n - 1, RiserHeight: ch, TreadLength: huella });
        return;
      }
      const esp = w.e(`IFCSPACE('${guid()}',$,${str(`${f + 1}.${String(i + 1).padStart(2, '0')}`)},$,$,${w.lugar(lP)},${producto(forma([caja(lx, ly, hMuro, r.x0, r.y0, 0)]))},${str(r.name)},.ELEMENT.,.INTERNAL.,$)`);
      if (!espacios.has(piso)) espacios.set(piso, []);
      espacios.get(piso).push(esp);
      pset(esp, 'Pset_SpaceCommon', { Reference: r.zone || '', IsExternal: false });
      cantidades(esp, 'Qto_SpaceBaseQuantities', { NetFloorArea: ['AREA', r.area || lx * ly], Height: ['LENGTH', hMuro] });
    });

    // terrazas y balcones de este nivel
    [...(M.terrazas || []).filter(t => t.f === f).flatMap(t => t.zonas || []), ...(M.balcones || []).filter(b => b.f === f)].forEach(z0 => {
      const tz = w.e(`IFCSLAB('${guid()}',$,${str('Terraza / balcón')},$,$,${w.lugar(lP)},${producto(forma([caja(z0.x1 - z0.x0, z0.y1 - z0.y0, sl, z0.x0, z0.y0, -sl)]))},$,.FLOOR.)`);
      meter(piso, tz); asociar('Concreto reforzado', 'concrete', tz);
      pset(tz, 'Pset_SlabCommon', { IsExternal: true });
    });
  });

  // ---------- losa superior y cubierta (en el último piso)
  const ultimo = pisos[pisos.length - 1], flU = M.floors[F - 1], zU = dl + (F - 1) * fh;
  const lU = w.lugar(lEd, 0, 0, zU);
  (flU.alas?.length ? flU.alas : [flU.R || M.R]).forEach(r => {
    const tapa = w.e(`IFCSLAB('${guid()}',$,${str(M.techo?.tipo === 'plana' ? 'Losa de cubierta' : 'Losa de cielo')},$,$,${lU},${producto(forma([caja(r.x1 - r.x0, r.y1 - r.y0, sl, r.x0, r.y0, fh - sl)]))},$,${M.techo?.tipo === 'plana' ? '.ROOF.' : '.FLOOR.'})`);
    meter(ultimo, tapa); asociar('Concreto reforzado', 'concrete', tapa);
  });
  const caras = (M.techo?.caras || []).filter(c => c.pts?.length >= 3);
  if (caras.length && M.techo.tipo !== 'plana') {
    const coords = [], tri = [];
    caras.forEach(c => {
      const base = coords.length;
      c.pts.forEach(([x, y, z]) => coords.push([x, y, z - zU]));
      for (let k = 1; k + 1 < c.pts.length; k++) tri.push([base + 1, base + k + 1, base + k + 2]);
    });
    const lista = w.e(`IFCCARTESIANPOINTLIST3D((${coords.map(p => `(${p.map(R).join(',')})`).join(',')}))`);
    const malla = w.e(`IFCTRIANGULATEDFACESET(${lista},$,.F.,(${tri.map(t => `(${t.join(',')})`).join(',')}),$)`);
    const techo = w.e(`IFCROOF('${guid()}',$,${str(`Cubierta ${M.techo.tipo === 'dos' ? 'a dos aguas' : 'a cuatro aguas'}`)},$,$,${w.lugar(lU)},${producto(forma([malla], 'Tessellation'))},$,${M.techo.tipo === 'dos' ? '.GABLE_ROOF.' : '.HIP_ROOF.'})`);
    meter(ultimo, techo); asociar(S.acabados?.teja === 'pizarra' ? 'Pizarra natural' : 'Teja', 'roofing', techo);
    pset(techo, 'Pset_RoofCommon', { IsExternal: true });
  }

  // ---------- piscina
  const P = M.exterior?.piscina;
  if (P) {
    const z0 = (P.z ?? dl) - dl;
    const pis = w.e(`IFCBUILDINGELEMENTPROXY('${guid()}',$,${str(P.interior ? 'Piscina interior (vaso)' : 'Piscina (vaso)')},${str(`${P.w} × ${P.h} × ${P.prof} m`)},$,${w.lugar(lPisos[0])},${producto(forma([caja(P.x1 - P.x0, P.y1 - P.y0, P.prof, P.x0, P.y0, z0 - P.prof)]))},$,.ELEMENT.)`);
    meter(pisos[0], pis); asociar('Concreto impermeabilizado y mosaico', 'concrete', pis);
    pset(pis, 'Pset_Axiona_Piscina', { Largo: P.w, Ancho: P.h, Profundidad: P.prof, Interior: !!P.interior, Litros: P.litros });
  }

  // ---------- relaciones espaciales y materiales
  w.e(`IFCRELAGGREGATES('${guid()}',$,$,$,${edificio},(${pisos.join(',')}))`);
  for (const [p, els] of contenido) w.e(`IFCRELCONTAINEDINSPATIALSTRUCTURE('${guid()}',$,$,$,(${els.join(',')}),${p})`);
  for (const [p, es] of espacios) w.e(`IFCRELAGGREGATES('${guid()}',$,$,$,${p},(${es.join(',')}))`);
  for (const [n, els] of Object.entries(usoMat)) w.e(`IFCRELASSOCIATESMATERIAL('${guid()}',$,$,$,(${els.join(',')}),${mats[n]})`);

  const ahora = new Date().toISOString().slice(0, 19);
  const archivo = `${String(nombre).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w-]+/g, '-').slice(0, 60)}.ifc`;
  return [
    'ISO-10303-21;', 'HEADER;',
    "FILE_DESCRIPTION(('ViewDefinition [DesignTransferView]'),'2;1');",
    `FILE_NAME(${str(archivo)},'${ahora}',(${str('Axiona Obra')}),(${str('Axiona Desarrollos Inteligentes')}),'Axiona Obra','Axiona Obra','');`,
    "FILE_SCHEMA(('IFC4'));", 'ENDSEC;', 'DATA;', ...w.l, 'ENDSEC;', 'END-ISO-10303-21;', '',
  ].join('\n');
}
