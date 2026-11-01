/* ==========================================================================
   AXIONA OBRA · Tecnologia y domotica
   --------------------------------------------------------------------------
   Opciones de casa inteligente con su ubicacion en el plano electrico, su
   cantidad y su precio por pais. Las de Canada responden a problemas del
   frio que siguen costando: tuberias congeladas, hielo en los aleros,
   cortes de luz que apagan la calefaccion y radon; las de Mexico, al agua
   por tandeo y a los sismos. Cada una dice por que.
   ========================================================================== */

import { tr } from './idioma.js';

const F = (t, u) => [t, u];

export const DOMOTICA = {
  fuga: {
    n: { es: 'Sensores de fuga y congelamiento', en: 'Leak and freeze sensors' },
    por: { es: 'Avisan al celular antes de que una tubería se reviente. En enero de 2024 una ola de frío en el occidente de Canadá dejó más de 180 millones de dólares en daños asegurados.', en: 'Phone alerts before a pipe bursts. A January 2024 deep freeze in Western Canada caused over $180M in insured damage.' },
    fuente: F('IBC · Western Canada deep freeze', 'https://www.ibc.ca/news-insights/news/western-canada-deep-freeze-causes-over-180-million-in-insured-damage'),
    precio: { CO: 180000, ES: 45, CA: 70, MX: 650 }, defecto: ['CA'], sim: 'FG',
  },
  valvula: {
    n: { es: 'Válvula de cierre automático del agua', en: 'Automatic water shut-off valve' },
    por: { es: 'Cierra el agua sola cuando un sensor detecta una fuga.', en: 'Shuts the water off when a sensor detects a leak.' },
    precio: { CO: 1200000, ES: 350, CA: 650, MX: 4500 }, defecto: ['CA'], sim: 'VC',
  },
  termostato: {
    n: { es: 'Termostato inteligente por pisos', en: 'Smart thermostat per floor' },
    por: { es: 'Mantiene la casa caliente con menos energía y alerta si la temperatura baja demasiado.', en: 'Heats with less energy and alerts on low indoor temperature.' },
    precio: { CO: 900000, ES: 220, CA: 350, MX: 3500 }, defecto: ['CA', 'ES'], sim: 'TH',
  },
  deshielo: {
    n: { es: 'Cables antihielo en aleros con sensor', en: 'Roof de-icing cables with sensor' },
    por: { es: 'Contra las barreras de hielo en los aleros. Lo primero es aislar y ventilar bien el ático; los cables son el respaldo cuando eso no alcanza.', en: 'Against ice dams. Insulating and venting the attic comes first; cables are the fallback.' },
    fuente: F('CHBA · ice dams', 'https://hub.chba.ca/blog/Details/it-s-ice-dam-season-again-here-s-what-you-can-do-241309'),
    precio: { CO: 0, ES: 40, CA: 55, MX: 0 }, unidad: 'm', defecto: ['CA'], paises: ['CA', 'ES'], sim: 'DH',
  },
  respaldo: {
    n: { es: 'Respaldo eléctrico con transferencia automática', en: 'Standby power with automatic transfer' },
    por: { es: 'Casi toda calefacción se apaga sin luz, incluidas las bombas de calor; en tormentas de hielo el respaldo evita que la casa se congele.', en: 'Almost every heating system stops in an outage, heat pumps included.' },
    precio: { CO: 9000000, ES: 4500, CA: 9500, MX: 38000 }, defecto: ['CA'], sim: 'GE',
  },
  radon: {
    n: { es: 'Monitor de radón conectado', en: 'Connected radon monitor' },
    por: { es: 'Cerca de 1 de cada 5 casas en Canadá supera la guía de 200 Bq/m³; la chimenea pasiva ayuda, pero hay que medir.', en: 'About 1 in 5 Canadian homes exceed 200 Bq/m³; passive stacks help, but test anyway.' },
    fuente: F('Health Canada · radon', 'https://www.canada.ca/en/health-canada/services/health-risks-safety/radiation/radon/action-guides/municipalities/building-codes-bylaws-provisions.html'),
    precio: { CO: 0, ES: 200, CA: 250, MX: 0 }, defecto: ['CA'], paises: ['CA', 'ES'], sim: 'RN',
  },
  aire: {
    n: { es: 'Calidad del aire con control de ventilación', en: 'Air-quality sensor with ventilation control' },
    por: { es: 'Cierra la toma de aire exterior cuando entra humo de incendios forestales y la abre cuando el aire está limpio.', en: 'Closes outdoor air intake when wildfire smoke arrives.' },
    precio: { CO: 450000, ES: 180, CA: 280, MX: 2500 }, defecto: ['CA'], sim: 'AQ',
  },
  cerradura: {
    n: { es: 'Cerradura inteligente', en: 'Smart lock' },
    por: { es: 'Entrada con código o celular y registro de quién entra.', en: 'Keyless entry with access log.' },
    precio: { CO: 1100000, ES: 250, CA: 400, MX: 4500 }, defecto: ['CO', 'ES', 'CA', 'MX'], sim: 'CI',
  },
  luces: {
    n: { es: 'Iluminación inteligente con escenas', en: 'Smart lighting scenes' },
    por: { es: 'Cada punto de luz se maneja desde el celular o por voz.', en: 'Every light point from the phone or by voice.' },
    precio: { CO: 120000, ES: 35, CA: 60, MX: 450 }, unidad: 'punto', sim: 'LI',
  },
  persianas: {
    n: { es: 'Persianas motorizadas', en: 'Motorized blinds' },
    por: { es: 'Controlan el sol del verano y guardan el calor en invierno.', en: 'Control summer sun and keep winter heat.' },
    precio: { CO: 850000, ES: 280, CA: 450, MX: 3800 }, defecto: ['ES'], sim: 'PM',
  },
  camaras: {
    n: { es: 'Cámaras y alarma conectadas', en: 'Cameras and alarm' },
    por: { es: 'Vigilancia de accesos y fachada desde el celular.', en: 'Entry and facade monitoring from the phone.' },
    precio: { CO: 600000, ES: 180, CA: 250, MX: 2800 }, defecto: ['CO', 'MX'], sim: 'CV',
  },
  solar: {
    n: { es: 'Paneles solares con monitoreo', en: 'Solar panels with monitoring' },
    por: { es: 'Generación propia sobre la cubierta, dimensionada por el área disponible.', en: 'On-site generation sized to the roof area.' },
    precio: { CO: 4200000, ES: 1300, CA: 2800, MX: 21000 }, unidad: 'kWp', defecto: ['CO', 'ES'], sim: 'PV',
  },
  energia: {
    n: { es: 'Medidor de energía por circuito', en: 'Circuit-level energy monitor' },
    por: { es: 'Muestra qué consume cada circuito.', en: 'Shows what each circuit uses.' },
    precio: { CO: 800000, ES: 220, CA: 350, MX: 3500 }, sim: 'EM',
  },
  nivelAgua: {
    n: { es: 'Nivel de cisterna y tinaco con aviso al celular', en: 'Cistern and roof-tank level alerts' },
    por: { es: 'Avisa cuando la cisterna o el tinaco bajan y arranca la bomba solo cuando hay agua. En 2025 la CDMX publicó 284 colonias de 10 alcaldías con suministro por tandeo.', en: 'Alerts when the cistern or roof tank runs low and runs the pump only when there is water. In 2025 Mexico City listed 284 neighbourhoods in 10 boroughs on rationed supply.' },
    fuente: F('Expansión · colonias con tandeo en 2025', 'https://politica.expansion.mx/cdmx/2025/03/07/colonias-cdmx-agua-por-tandeo-2025'),
    precio: { MX: 3200 }, defecto: ['MX'], paises: ['MX'], sim: 'NA',
  },
  sismica: {
    n: { es: 'Receptor de alerta sísmica (SASMEX) por nivel', en: 'Earthquake early-warning receiver (SASMEX) per floor' },
    por: { es: 'Recibe por radio la señal del Sistema de Alerta Sísmica Mexicano y suena dentro de la casa, donde los altavoces de la calle no siempre se oyen.', en: 'Receives the Mexican Seismic Alert System radio signal and sounds indoors, where street speakers are not always heard.' },
    fuente: F('Xataka México · alerta sísmica en casa', 'https://www.xataka.com.mx/especiales/como-tener-tu-propia-alerta-sismica-en-casa'),
    precio: { MX: 1800 }, defecto: ['MX'], paises: ['MX'], sim: 'AS',
  },
  voz: {
    n: { es: 'Asistente de voz para la casa', en: 'Whole-home voice assistant' },
    por: { es: 'Luces, persianas, temperatura y ascensor por voz, sin dejar los botones.', en: 'Lights, blinds, heat and elevator by voice, buttons kept.' },
    precio: { CO: 350000, ES: 90, CA: 130, MX: 1500 }, sim: 'VZ',
  },
};

export const domoticaDePais = pid => Object.entries(DOMOTICA).filter(([, d]) => !d.paises || d.paises.includes(pid)).map(([id]) => id);
export const domoticaPorDefecto = pid => Object.entries(DOMOTICA).filter(([, d]) => d.defecto?.includes(pid) && (!d.paises || d.paises.includes(pid))).map(([id]) => id);

/** Cantidades y ubicaciones en planta de lo escogido. */
export function domotica(M, ids = [], pid = 'CO') {
  const out = [];
  const humedos = [], alcobas = [];
  M.floors.forEach(fl => fl.rects.forEach(r => {
    if (/bano|cocina|ropas/.test(r.tipo || '')) humedos.push({ f: fl.f, r });
    if (/alcoba/.test(r.tipo || '')) alcobas.push({ f: fl.f, r });
  }));
  const C = r => ({ x: (r.x0 + r.x1) / 2, y: (r.y0 + r.y1) / 2 });
  const hall0 = M.floors[0].rects.find(r => r.hall);
  const sala = M.floors.flatMap(fl => fl.rects.filter(r => /sala|estar/.test(r.tipo || '')).map(r => ({ f: fl.f, r })))[0] || { f: 0, r: hall0 };
  for (const id of ids) {
    const d = DOMOTICA[id];
    if (!d || (d.paises && !d.paises.includes(pid))) continue;
    const pts = [];
    let n = 1;
    if (id === 'fuga') { humedos.forEach(({ f, r }) => pts.push({ f, x: r.x0 + 0.3, y: r.y0 + 0.3 })); n = Math.max(1, humedos.length); }
    else if (id === 'valvula' || id === 'respaldo' || id === 'energia') { pts.push({ f: 0, x: (hall0?.x0 ?? M.R.x0) + 0.25, y: (hall0?.y0 ?? M.R.y0) + 1.0 }); }
    else if (id === 'nivelAgua') { pts.push({ f: 0, x: (hall0?.x0 ?? M.R.x0) + 0.25, y: (hall0?.y0 ?? M.R.y0) + 1.4 }); }
    else if (id === 'sismica') { M.floors.forEach(fl => { const h = fl.rects.find(r => r.hall) || fl.rects[0]; pts.push({ f: fl.f, x: h.x1 - 0.25, y: (h.y0 + h.y1) / 2 }); }); n = M.F; }
    else if (id === 'termostato') { M.floors.forEach(fl => { const h = fl.rects.find(r => r.hall) || fl.rects[0]; pts.push({ f: fl.f, x: h.x0 + 0.25, y: (h.y0 + h.y1) / 2 }); }); n = M.F; }
    else if (id === 'deshielo') { if (!M.techo || M.techo.tipo === 'plana') continue; n = Math.round(M.techo.canal); }
    else if (id === 'radon' || id === 'aire') { const c = C(sala.r); pts.push({ f: sala.f, x: c.x - 0.6, y: c.y - 0.6 }); }
    else if (id === 'cerradura') { const o = M.floors[0].ops.find(x => x.kind === 'main'); if (o) pts.push({ f: 0, x: (o.a + o.b) / 2 + 0.6, y: o.c + 0.2 }); }
    else if (id === 'luces') { n = M.redes?.puntos.luz || 0; }
    else if (id === 'persianas') { n = M.floors.reduce((t, fl) => t + fl.ops.filter(o => o.kind === 'win' && !/bano/.test(fl.rects.find(r => r.name === o.room)?.tipo || '')).length, 0); }
    else if (id === 'camaras') { n = 4; const R = M.R; [[R.x0, R.y0], [R.x1, R.y0], [R.x0, R.y1], [R.x1, R.y1]].forEach(([x, y]) => pts.push({ f: 0, x, y })); }
    else if (id === 'solar') { const A = M.techo ? (M.techo.tipo === 'plana' ? M.R.area : M.techo.area / 2) : M.R.area; n = Math.max(1, Math.min(10, Math.round(A * 0.6 / 5.5))); }
    else if (id === 'voz') { n = 1 + alcobas.length; const c = C(sala.r); pts.push({ f: sala.f, x: c.x + 0.6, y: c.y + 0.6 }); alcobas.forEach(({ f, r }) => pts.push({ f, x: r.x1 - 0.4, y: r.y1 - 0.4 })); }
    if (!n) continue;
    out.push({ id, nombre: d.n, por: d.por, fuente: d.fuente, sim: d.sim, n, unidad: d.unidad, precio: d.precio[pid] || 0, pts });
  }
  return out;
}

export const nombreDomotica = id => tr(DOMOTICA[id]?.n || id);
