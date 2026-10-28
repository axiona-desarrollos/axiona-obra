// Utilidades de interfaz compartidas por todos los modulos.
export const $ = s => document.querySelector(s);
export const $$ = s => [...document.querySelectorAll(s)];
export const fm = (v, d = 2) => Number(v).toLocaleString('es-CO', { minimumFractionDigits: d, maximumFractionDigits: d });
export const cop = v => '$ ' + Math.round(v).toLocaleString('es-CO');
export const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export function toast(t) {
  const d = document.createElement('div');
  d.className = 'toast';
  d.setAttribute('role', 'status');
  d.textContent = t;
  document.body.appendChild(d);
  setTimeout(() => d.remove(), 3800);
}

/**
 * Estado compartido de la interfaz. S es el proyecto (lo que se guarda), M el
 * modelo calculado; el resto es solo de vista.
 */
export const app = { S: null, M: null, planView: 'p1', phase: 9, viewFloor: 99, threeDirty: true };

export const PHASES = [
  { n: 'Terreno natural', cat: 'negra' }, { n: 'Explanación', cat: 'negra' }, { n: 'Cimentación', cat: 'negra' },
  { n: 'Estructura', cat: 'negra' }, { n: 'Mampostería', cat: 'negra' }, { n: 'Cubierta', cat: 'negra' },
  { n: 'Pañetes', cat: 'gris' }, { n: 'Estuco y pintura', cat: 'blanca' }, { n: 'Pisos y enchapes', cat: 'blanca' }, { n: 'Carpintería', cat: 'blanca' },
];
