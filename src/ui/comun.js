// Utilidades de interfaz compartidas por todos los modulos.
import { pais as paisDe, tr } from '../motor/index.js';

export const $ = s => document.querySelector(s);
export const $$ = s => [...document.querySelectorAll(s)];

/**
 * Estado compartido de la interfaz. S es el proyecto (lo que se guarda), M el
 * modelo calculado; el resto es solo de vista.
 */
export const app = { S: null, M: null, planView: 'p1', phase: 10, viewFloor: 99, threeDirty: true, cuadros: null };

const loc = () => paisDe(app.S?.pais).locale;
export const fm = (v, d = 2) => Number(v).toLocaleString(loc(), { minimumFractionDigits: d, maximumFractionDigits: d });
export const money = v => new Intl.NumberFormat(loc(), { style: 'currency', currency: paisDe(app.S?.pais).moneda, maximumFractionDigits: 0 }).format(Math.round(v || 0));
export const cop = money;
export const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/* ---------- unidades: metros o pies y pulgadas (Canada) ---------- */
export const FT = 0.3048, FT2 = 10.7639;
export const imperial = () => app.S?.unidades === 'ft';
const FRAC = { 0.125: '1/8', 0.25: '1/4', 0.375: '3/8', 0.5: '1/2', 0.625: '5/8', 0.75: '3/4', 0.875: '7/8' };
/** 3.45 m → 11'-3 7/8" */
export function ftIn(m) {
  const neg = m < 0, tot = Math.abs(m) / 0.0254;
  let ft = Math.floor(tot / 12), inch = Math.round((tot - ft * 12) * 8) / 8;
  if (inch >= 12) { ft++; inch -= 12; }
  const whole = Math.floor(inch), fr = FRAC[+(inch - whole).toFixed(3)] || '';
  return `${neg ? '−' : ''}${ft}'-${whole}${fr ? ' ' + fr : ''}"`;
}
/** Longitud para planos y tablas. */
export const fmtL = (m, d = 2) => (imperial() ? ftIn(m) : fm(m, d));
export const fmtLu = (m, d = 2) => (imperial() ? ftIn(m) : `${fm(m, d)} m`);
export const fmtA = (a, d = 1) => (imperial() ? `${fm(a * FT2, 0)} ft²` : `${fm(a, d)} m²`);
export const fmtN = v => (Math.abs(v) < 0.005 ? (imperial() ? '±0\'-0"' : 'N±0.00') : `${v > 0 ? '+' : '−'}${imperial() ? ftIn(Math.abs(v)) : Math.abs(v).toFixed(2)}`);
export const uL = () => (imperial() ? 'ft' : 'm');
export const uA = () => (imperial() ? 'ft²' : 'm²');
/** Paso de metros a la unidad de pantalla de un campo y de vuelta. */
export const aPantalla = (v, u) => (u === 'L' && imperial() ? +(v / FT).toFixed(2) : u === 'A' && imperial() ? +(v * FT2).toFixed(1) : v);
export const aMetros = (v, u) => (u === 'L' && imperial() ? v * FT : u === 'A' && imperial() ? v / FT2 : v);
export const fmtObj = () => ({ L: v => fmtL(v), A: v => fmtA(v), N: fmtN });

export function toast(t) {
  const d = document.createElement('div');
  d.className = 'toast';
  d.setAttribute('role', 'status');
  d.textContent = t;
  document.body.appendChild(d);
  setTimeout(() => d.remove(), 4200);
}

/** Fases de la obra en el 3D: diez de construccion y la entrega amoblada. */
export const fases = () => [
  { n: tr({ es: 'Terreno natural', en: 'Natural ground' }), cat: 'negra' }, { n: tr({ es: 'Explanación', en: 'Grading' }), cat: 'negra' },
  { n: tr({ es: 'Cimentación', en: 'Foundation' }), cat: 'negra' }, { n: tr({ es: 'Estructura', en: 'Structure' }), cat: 'negra' },
  { n: tr({ es: 'Muros', en: 'Walls' }), cat: 'negra' }, { n: tr({ es: 'Cubierta', en: 'Roof' }), cat: 'negra' },
  { n: tr({ es: 'Pañetes', en: 'Rough finishes' }), cat: 'gris' }, { n: tr({ es: 'Pintura', en: 'Paint' }), cat: 'blanca' },
  { n: tr({ es: 'Pisos y enchapes', en: 'Floors and tiling' }), cat: 'blanca' }, { n: tr({ es: 'Carpintería', en: 'Doors and windows' }), cat: 'blanca' },
  { n: tr({ es: 'Entrega amoblada', en: 'Furnished handover' }), cat: 'dot' },
];
export { tr };
