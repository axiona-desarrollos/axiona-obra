/* ==========================================================================
   AXIONA OBRA · Escritor DXF AutoCAD 2000 (AC1015)
   --------------------------------------------------------------------------
   DXF completo para AutoCAD, BricsCAD, Revit (vincular/importar CAD) y
   cualquier programa compatible: unidades en metros ($INSUNITS = 6), capas
   con color y tipo de línea, estilo de texto, bloques de espacio modelo y
   papel, presentaciones y diccionarios. Parte de una plantilla validada
   (plantillaR2000.js, generada con ezdxf) y le inserta capas y entidades con
   sus identificadores (handles) y dueños, como lo exige el formato.
   ========================================================================== */
import { PLANTILLA_R2000, H_MODELO, H_TABLA_CAPAS, H_ESTILO_PLOT, SEMILLA } from './plantillaR2000.js';

/** Color AutoCAD (ACI) y tipo de línea por capa. Lo que no esté aquí sale en blanco/negro continuo. */
export const CAPAS = {
  LOTE: [3, 'DASHED'], EJES: [1, 'CENTER'], COLUMNAS: [5], MUROS: [7], VENTANAS: [4], PUERTAS: [2], CODIGOS: [8],
  TEXTO: [7], TITULOS: [7], ZAPATAS: [30], VIGAS_CIM: [30, 'HIDDEN'], COLUMNETAS: [5], CASTILLOS: [5], TERRAZAS: [9],
  BARANDAS: [8], ASCENSOR: [6], ESCALERA: [8], MOBILIARIO: [253], ELECTRICO: [1], HIDRO: [150], HIDRO_FRIA: [150],
  HIDRO_CALIENTE: [10], HIDRO_SANITARIA: [32], HIDRO_LLUVIAS: [140], FACHADAS: [7], CORTES: [7], DETALLES: [7],
  NIVELES: [3], COTAS: [2], NOTAS: [8], CUBIERTA: [32], PISCINA: [4],
};

const num = v => { const x = Math.abs(v) < 1e-10 ? 0 : +v; return Number.isInteger(x) ? `${x}.0` : String(+x.toFixed(6)); };
/** Texto en ASCII (el DXF va en ANSI_1252 y el navegador escribe UTF-8): sin tildes ni caracteres especiales. */
export const ascii = t => String(t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\x20-\x7e]/g, '');
const nombreCapa = n => ascii(n).toUpperCase().replace(/[<>/\\":;?*|=',]/g, '_').slice(0, 60) || '0';

export class DXF {
  constructor() { this.h = 0x1000; this.ent = []; this.capas = new Set(); this.min = [Infinity, Infinity]; this.max = [-Infinity, -Infinity]; }
  sig() { return (this.h++).toString(16).toUpperCase(); }
  caja(x, y) { if (!Number.isFinite(x) || !Number.isFinite(y)) return; this.min[0] = Math.min(this.min[0], x); this.min[1] = Math.min(this.min[1], y); this.max[0] = Math.max(this.max[0], x); this.max[1] = Math.max(this.max[1], y); }
  cab(tipo, capa, sub) {
    const c = nombreCapa(capa); this.capas.add(c);
    return ['0', tipo, '5', this.sig(), '330', H_MODELO, '100', 'AcDbEntity', '8', c, '100', sub];
  }
  linea(capa, x1, y1, x2, y2) {
    if (![x1, y1, x2, y2].every(Number.isFinite)) return;
    this.caja(x1, y1); this.caja(x2, y2);
    this.ent.push(...this.cab('LINE', capa, 'AcDbLine'), '10', num(x1), '20', num(y1), '30', '0.0', '11', num(x2), '21', num(y2), '31', '0.0');
  }
  polilinea(capa, pts, cerrada = true) {
    const p = pts.filter(([x, y]) => Number.isFinite(x) && Number.isFinite(y));
    if (p.length < 2) return;
    p.forEach(([x, y]) => this.caja(x, y));
    this.ent.push(...this.cab('LWPOLYLINE', capa, 'AcDbPolyline'), '90', String(p.length), '70', cerrada ? '1' : '0', '43', '0.0');
    p.forEach(([x, y]) => this.ent.push('10', num(x), '20', num(y)));
  }
  rect(capa, x0, y0, x1, y1) { this.polilinea(capa, [[x0, y0], [x1, y0], [x1, y1], [x0, y1]], true); }
  texto(capa, x, y, alto, t) {
    const s = ascii(t); if (!s || !Number.isFinite(x) || !Number.isFinite(y)) return;
    this.caja(x, y);
    this.ent.push(...this.cab('TEXT', capa, 'AcDbText'), '10', num(x), '20', num(y), '30', '0.0', '40', num(Math.max(0.01, alto)), '1', s, '7', 'Standard', '100', 'AcDbText');
  }
  circulo(capa, x, y, r) {
    if (![x, y, r].every(Number.isFinite) || r <= 0) return;
    this.caja(x - r, y - r); this.caja(x + r, y + r);
    this.ent.push(...this.cab('CIRCLE', capa, 'AcDbCircle'), '10', num(x), '20', num(y), '30', '0.0', '40', num(r));
  }
  arco(capa, x, y, r, a1, a2) {
    if (![x, y, r, a1, a2].every(Number.isFinite) || r <= 0) return;
    this.caja(x - r, y - r); this.caja(x + r, y + r);
    this.ent.push(...this.cab('ARC', capa, 'AcDbCircle'), '10', num(x), '20', num(y), '30', '0.0', '40', num(r), '100', 'AcDbArc', '50', num(a1), '51', num(a2));
  }
  /** Archivo completo. */
  toString() {
    const pares = arr => { const o = []; for (let i = 0; i < arr.length; i += 2) o.push(String(arr[i]).padStart(3, ' '), arr[i + 1]); return o.join('\n'); };
    const capas = [...this.capas].filter(c => c !== '0').sort().map(c => {
      const [color, tipo] = CAPAS[c] || CAPAS[c.split('_')[0]] || [7];
      return pares(['0', 'LAYER', '5', this.sig(), '330', H_TABLA_CAPAS, '100', 'AcDbSymbolTableRecord', '100', 'AcDbLayerTableRecord', '2', c, '70', '0', '62', String(color), '6', tipo || 'Continuous', '370', '-3', '390', H_ESTILO_PLOT]);
    });
    let t = PLANTILLA_R2000;
    // capas: se insertan en la tabla LAYER (después de la capa 0) y se actualiza la cuenta
    const iTabla = t.indexOf('\n  2\nLAYER\n');
    const iFin = t.indexOf('\n  0\nENDTAB', iTabla);
    const tabla = t.slice(iTabla, iFin).replace(/(\n 70\n)(\d+)/, (_, a, n) => a + String(+n + capas.length));
    t = t.slice(0, iTabla) + tabla + (capas.length ? '\n' + capas.join('\n') : '') + t.slice(iFin);
    // entidades
    t = t.replace('\n  2\nENTITIES\n  0\nENDSEC', '\n  2\nENTITIES\n' + (this.ent.length ? pares(this.ent) + '\n' : '') + '  0\nENDSEC');
    // semilla de identificadores y extensión del dibujo (para «Zoom extensión» y la importación en Revit)
    const sem = Math.max(this.h, SEMILLA).toString(16).toUpperCase();
    t = t.replace(/(\n\s*9\n\$HANDSEED\n\s*5\n)[0-9A-Fa-f]+/, `$1${sem}`);
    if (Number.isFinite(this.min[0])) {
      t = t.replace(/(\n\s*9\n\$EXTMIN\n\s*10\n)[^\n]+(\n\s*20\n)[^\n]+/, `$1${num(this.min[0])}$2${num(this.min[1])}`);
      t = t.replace(/(\n\s*9\n\$EXTMAX\n\s*10\n)[^\n]+(\n\s*20\n)[^\n]+/, `$1${num(this.max[0])}$2${num(this.max[1])}`);
    }
    return t.replace(/\r?\n/g, '\r\n');
  }
}
