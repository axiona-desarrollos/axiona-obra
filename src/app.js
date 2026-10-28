/* ==========================================================================
   AXIONA OBRA · Interfaz
   --------------------------------------------------------------------------
   Aqui solo se cablea: tablas de entrada, pestañas, recalculo y render. El
   calculo vive en src/motor (sin DOM), los planos en src/ui/planos.js, el
   3D en src/vista3d, la AR en src/ar y los exportes en src/exportar.
   ========================================================================== */

import './estilos.css';
import {
  buildModel, normalizarEstado, clonar, DEFAULT_STATE, PLANTILLAS, SOILS, ZONAS, CATEGORIAS, totales, dms,
} from './motor/index.js';
import { $, $$, fm, cop, esc, toast, app } from './ui/comun.js';
import { planSVG, vistas, instalarPanZoom, ajustarPlano } from './ui/planos.js';
import { enlaceDelProyecto, proyectoDelEnlace } from './ui/compartir.js';
import { ensure3D, buildScene, resize3D, applyPhase, conectarControles3D } from './vista3d/escena.js';
import { conectarAR, iniciarAR, revisarAR, verEnIPhone } from './ar/ar.js';
import { descargar, toDXF, toCSV, exportarGLB, exportarUSDZ } from './exportar/exportar.js';

const KEY = 'axiona-obra-v2';
const TABS = ['terreno', 'programa', 'planos', 'modelo', 'cantidades', 'ar'];
let avisoInstalar = null;

function cargarGuardado() {
  try { const s = JSON.parse(localStorage.getItem(KEY)); return s ? normalizarEstado(s) : null; } catch { return null; }
}
function guardar() { try { localStorage.setItem(KEY, JSON.stringify(app.S)); } catch { /* modo privado */ } }

/* ---------------- tablas de entrada ---------------- */
const getP = (o, p) => p.split('.').reduce((a, k) => a?.[k], o);
function setP(o, p, v) { const ks = p.split('.'), last = ks.pop(); ks.reduce((a, k) => a[k], o)[last] = v; }

function bindStatic() {
  $$('[data-p]').forEach(el => {
    if (el.closest('tbody')) return;
    const v = getP(app.S, el.dataset.p);
    if (el.type === 'checkbox') el.checked = !!v; else el.value = v;
  });
  $('#dlInput').disabled = !!app.S.dlAuto;
  $('#nombreProyecto').textContent = app.S.nombre || 'Lote → planos → obra → presupuesto → AR';
}

const numIn = (p, v, step = '0.01') => `<input type="number" inputmode="decimal" step="${step}" data-p="${p}" value="${v}">`;
function renderLot() {
  const S = app.S;
  $('#lotBody').innerHTML = S.lot.map((p, i) => `<tr><td class="mono" style="color:var(--amber)">P${i + 1}</td><td>${numIn(`lot.${i}.x`, p.x)}</td><td>${numIn(`lot.${i}.y`, p.y)}</td><td>${numIn(`lot.${i}.z`, p.z)}</td><td><button class="btn x" data-del="lot.${i}" aria-label="Quitar P${i + 1}">×</button></td></tr>`).join('');
  $('#spotBody').innerHTML = S.spots.length
    ? S.spots.map((p, i) => `<tr><td class="mono">C${i + 1}</td><td>${numIn(`spots.${i}.x`, p.x)}</td><td>${numIn(`spots.${i}.y`, p.y)}</td><td>${numIn(`spots.${i}.z`, p.z)}</td><td><button class="btn x" data-del="spots.${i}" aria-label="Quitar C${i + 1}">×</button></td></tr>`).join('')
    : '<tr><td colspan="5" style="color:var(--mut);font-size:12.5px;padding:8px 4px">Sin cotas interiores. El terreno se interpola desde los vértices.</td></tr>';
  const n = S.lot.length;
  if (S.frente >= n) S.frente = 0;
  $('#frenteSel').innerHTML = S.lot.map((p, i) => {
    const q = S.lot[(i + 1) % n];
    return `<option value="${i}" ${i === S.frente ? 'selected' : ''}>P${i + 1}–P${(i + 1) % n + 1} · ${fm(Math.hypot(q.x - p.x, q.y - p.y))} m</option>`;
  }).join('');
}

function renderRooms() {
  $('#roomBody').innerHTML = app.S.rooms.map((r, i) => `<tr>
    <td style="min-width:130px"><input type="text" data-p="rooms.${i}.name" value="${esc(r.name)}" aria-label="Nombre del espacio"></td>
    <td style="width:76px">${numIn(`rooms.${i}.area`, r.area, '0.5')}</td>
    <td style="width:60px">${numIn(`rooms.${i}.floor`, r.floor, '1')}</td>
    <td style="width:104px"><select data-p="rooms.${i}.zone" aria-label="Zona">${ZONAS.map(z => `<option ${z === r.zone ? 'selected' : ''}>${z}</option>`).join('')}</select></td>
    <td><button class="btn x" data-del="rooms.${i}" aria-label="Quitar ${esc(r.name)}">×</button></td></tr>`).join('');
}

function cargarProyecto(S, aviso) {
  app.S = normalizarEstado(S);
  app.threeDirty = true;
  guardar(); bindStatic(); renderLot(); renderRooms(); recompute();
  if (aviso) toast(aviso);
}

/* ---------------- acciones ---------------- */
const ACT = {
  addLot() { const S = app.S, l = S.lot[S.lot.length - 1], f = S.lot[0]; S.lot.push({ x: +((l.x + f.x) / 2).toFixed(2), y: +((l.y + f.y) / 2).toFixed(2), z: +((l.z + f.z) / 2).toFixed(2) }); guardar(); renderLot(); recompute(); },
  addSpot() { const b = app.M?.lotW, cx = b ? b.reduce((t, p) => t + p.x, 0) / b.length : 5, cy = b ? b.reduce((t, p) => t + p.y, 0) / b.length : 5; app.S.spots.push({ x: +cx.toFixed(1), y: +cy.toFixed(1), z: 0 }); guardar(); renderLot(); recompute(); },
  addRoom() { app.S.rooms.push({ name: 'Nuevo espacio', area: 8, floor: 1, zone: 'social' }); guardar(); renderRooms(); recompute(); },
  rectLot() { $('#rectForm').hidden = !$('#rectForm').hidden; },
  applyRect() {
    const w = +$('#rfW').value, d = +$('#rfD').value, z = +$('#rfZ').value;
    if (!(w > 3 && d > 3)) return toast('Frente y fondo deben ser mayores a 3 m.');
    Object.assign(app.S, { lot: [{ x: 0, y: 0, z: 0 }, { x: w, y: 0, z: 0 }, { x: w, y: d, z }, { x: 0, y: d, z }], spots: [], frente: 0 });
    guardar(); renderLot(); recompute(); $('#rectForm').hidden = true;
  },
  reset() { cargarProyecto(clonar(DEFAULT_STATE), 'Proyecto de ejemplo restaurado.'); },
  expDXF() { if (!app.M?.err) descargar('axiona-obra_planos.dxf', toDXF(app.M), 'application/dxf'); },
  expSVG() { if (!app.M?.err) descargar(`axiona-obra_${app.planView}.svg`, planSVG(app.M, app.planView, 'print'), 'image/svg+xml'); },
  expGLB() { exportarGLB(); },
  expUSDZ() { exportarUSDZ(); },
  expCSV() { if (!app.M?.err) descargar('axiona-obra_presupuesto.csv', toCSV(app.M, app.S), 'text/csv;charset=utf-8'); },
  expJSON() { descargar('axiona-obra_proyecto.json', JSON.stringify(app.S, null, 2), 'application/json'); },
  arMeasure() { iniciarAR('measure'); },
  arPlace() { iniciarAR('place'); },
  arIOS() { verEnIPhone(); },
  async compartir() {
    const url = await enlaceDelProyecto(app.S);
    const texto = `Mira este proyecto en Axiona Obra: planos, 3D por fases y presupuesto de «${app.S.nombre || 'mi casa'}».`;
    try {
      if (navigator.share) { await navigator.share({ title: 'Axiona Obra', text: texto, url }); return; }
      await navigator.clipboard.writeText(url);
      toast('Enlace copiado: pégalo en WhatsApp o donde quieras.');
    } catch (e) {
      if (e?.name !== 'AbortError') prompt('Copia este enlace:', url);
    }
  },
  instalar() {
    if (!avisoInstalar) return;
    avisoInstalar.prompt();
    avisoInstalar.userChoice.finally(() => { avisoInstalar = null; $('#bInstalar').hidden = true; });
  },
};

function conectarEntradas() {
  $('#soilSel').innerHTML = Object.entries(SOILS).map(([k, v]) => `<option value="${k}">${v.label}</option>`).join('');
  $('#plantillaSel').innerHTML += Object.entries(PLANTILLAS).map(([k, p]) => `<option value="${k}">${p.titulo}</option>`).join('');
  $('#plantillaSel').addEventListener('change', e => {
    const p = PLANTILLAS[e.target.value];
    e.target.value = '';
    if (p) cargarProyecto(p.estado(), `Cargado: ${p.titulo}.`);
  });
  let tmr = null;
  document.addEventListener('input', e => {
    const el = e.target, p = el.dataset.p;
    if (!p) return;
    let v = el.type === 'checkbox' ? el.checked : el.type === 'number' ? parseFloat(el.value) : el.value;
    if (el.type === 'number' && !Number.isFinite(v)) return;
    if (p === 'frente') v = +v;
    setP(app.S, p, v);
    guardar();
    if (p.startsWith('prices.')) { $$(`[data-p="${p}"]`).forEach(o => { if (o !== el) o.value = v; }); actualizarPresupuesto(); return; }
    if (p === 'dlAuto') $('#dlInput').disabled = !!v;
    if (/^lot\.\d+\.[xy]$/.test(p)) renderFrenteSolo();
    clearTimeout(tmr);
    tmr = setTimeout(recompute, 220);
  });
  document.addEventListener('change', e => { if (e.target.dataset.p === 'frente') recompute(); });
  document.addEventListener('click', e => {
    const d = e.target.closest('[data-del]');
    if (d) {
      const [arr, i] = d.dataset.del.split('.');
      if (arr === 'lot' && app.S.lot.length <= 3) { toast('El lote necesita al menos 3 vértices.'); return; }
      app.S[arr].splice(+i, 1);
      guardar();
      if (arr === 'rooms') renderRooms(); else renderLot();
      recompute();
      return;
    }
    const a = e.target.closest('[data-act]');
    if (a) ACT[a.dataset.act]?.(a);
  });
  $('#impJSON').addEventListener('change', e => {
    const f = e.target.files[0];
    if (!f) return;
    const rd = new FileReader();
    rd.onload = () => {
      try {
        const s = JSON.parse(rd.result);
        if (!s.lot || !s.rooms) throw new Error('sin lote');
        cargarProyecto(s, 'Proyecto cargado.');
      } catch { toast('El archivo no es un proyecto de Axiona Obra.'); }
    };
    rd.readAsText(f);
    e.target.value = '';
  });
}

/** Solo las etiquetas de longitud del selector de frente, sin redibujar la tabla que se esta editando. */
function renderFrenteSolo() {
  const S = app.S, n = S.lot.length;
  [...$('#frenteSel').options].forEach((o, i) => {
    const p = S.lot[i], q = S.lot[(i + 1) % n];
    if (p && q) o.textContent = `P${i + 1}–P${(i + 1) % n + 1} · ${fm(Math.hypot(q.x - p.x, q.y - p.y))} m`;
  });
}

/* ---------------- pestañas ---------------- */
function showTab(t) {
  $$('.tab').forEach(b => b.setAttribute('aria-selected', b.dataset.tab === t));
  $$('main > section').forEach(s => { s.hidden = s.id !== 'tab-' + t; });
  if (t === 'modelo' && ensure3D()) { if (app.threeDirty) buildScene(); resize3D(); }
  if (t === 'planos') ajustarPlano();
  if (t === 'ar') revisarAR();
  try { history.replaceState(null, '', '#' + t); } catch { /* file:// */ }
}

/* ---------------- recalculo y render ---------------- */
function recompute() {
  const M = app.M = buildModel(app.S);
  $('#errbox').innerHTML = M.err ? `<div class="warn" style="margin-bottom:14px">${esc(M.err)}</div>` : '';
  if (M.err) return;
  if (app.S.dlAuto) $('#dlInput').value = M.dl;
  renderKPIs(); renderTerrain(); renderProgram(); renderPlanViews(); renderPlan(); renderStake(); renderBudget(); renderGantt();
  app.threeDirty = true;
  if (!$('#tab-modelo').hidden) buildScene();
}

function renderKPIs() {
  const M = app.M, t = totales(M, app.S.prices);
  $('#kpis').innerHTML = [['Lote', fm(M.lotArea, 1) + ' m²'], ['Construido', fm(M.built, 1) + ' m²'], ['Presupuesto', cop(t.all)], ['Por m²', cop(t.all / M.built)]]
    .map(([k, v]) => `<div class="kpi"><span>${k}</span><b>${v}</b></div>`).join('');
}
const stat = (l, v, u = '') => `<div class="stat"><span class="lbl">${l}</span><b>${v}${u ? ` <small>${u}</small>` : ''}</b></div>`;

function renderTerrain() {
  const M = app.M, g = M.grid;
  $('#lotStats').innerHTML = [
    stat('Área', fm(M.lotArea), 'm²'), stat('Perímetro', fm(M.per), 'm'), stat('Pendiente media', fm(M.slope, 1), '%'),
    stat('Baja hacia', dms(M.slopeDir), 'az'), stat('Desnivel', fm(g.zmax - g.zmin), 'm'), stat('N±0.00', fm(M.dl), 'm'),
    stat('Corte', fm(M.cut, 1), 'm³'), stat('Relleno', fm(M.fill, 1), 'm³'), stat('Suelo q adm', M.q, 't/m²'),
  ].join('');
  $('#sideBody').innerHTML = M.sides.map(s => `<tr${s.i === M.frente ? ' style="color:var(--amber)"' : ''}><td class="mono">P${s.from}–P${s.to}${s.i === M.frente ? ' · frente' : ''}</td><td class="n">${fm(s.L)}</td><td class="n">${dms(s.az)}</td><td class="n">${fm(s.pend, 1)} %</td><td class="n">${fm(M.angles[s.from - 1], 2)}°</td></tr>`).join('');
  const exp = (M.lotW.length - 2) * 180;
  $('#angCheck').textContent = `Suma de ángulos internos ${fm(M.angSum, 2)}° · teórica ${exp}° para ${M.lotW.length} lados${Math.abs(M.angSum - exp) > 0.5 ? ' · el polígono se cruza: revisa el orden de los vértices' : ' · cierre correcto'}.`;
  $('#siteBox').innerHTML = planSVG(M, 'sitio', 'dark');
}

function renderProgram() {
  const M = app.M, st = M.stair;
  $('#progStats').innerHTML = [
    stat('Huella', `${fm(M.R.w)} × ${fm(M.R.h)}`, 'm'), stat('Área huella', fm(M.R.area, 1), 'm²'), stat('Ocupación', fm(M.R.area / M.lotArea * 100, 1), '%'),
    stat('Construido', fm(M.built, 1), 'm²'), stat('Ejes', `${M.axX.length} × ${M.axY.length}`),
    stat('Escalera', st ? `${fm(st.x1 - st.x0, 1)} × ${fm(st.y1 - st.y0, 1)}` : '—', st ? 'm' : ''),
  ].join('');
  $('#warns').innerHTML = M.warn.length
    ? M.warn.map(w => `<div class="warn">${esc(w)}</div>`).join('')
    : '<div class="warn ok">Todos los espacios tienen puerta, ventana y proporción aceptable.</div>';
  $('#areaBody').innerHTML = M.floors.map(fl => fl.rects.map(r => `<tr><td class="mono">${fl.f + 1}</td><td>${esc(r.name)}</td><td class="n">${r.req ? fm(r.req, 1) : '—'}</td><td class="n">${fm(r.area, 1)}</td><td class="n">${fm(r.w)}×${fm(r.h)}</td><td style="color:var(--mut)">${esc(r.via || '')}</td></tr>`).join('')).join('');
}

function renderStake() {
  const M = app.M;
  $('#stakeBody').innerHTML = M.stake.map(s => `<tr><td class="mono" style="color:var(--amber)">${s.id}</td><td class="n">${fm(s.x)}</td><td class="n">${fm(s.y)}</td><td class="n">${fm(s.d)}</td><td class="n">${dms(s.az)}</td><td class="n">${fm(s.cut)}</td></tr>`).join('');
  const tp = M.types.map((B, i) => { const cs = M.cols.filter(c => c.B === B); return { t: 'Z' + (i + 1), B, h: cs[0].h, n: cs.length, P: Math.max(...cs.map(c => c.P)) }; });
  $('#fndSub').textContent = `Suelo ${SOILS[app.S.soil]?.label || ''} · desplante ${fm(M.desp)} m bajo N±0.00 · área de zapata = 1.15·P / q adm · columnas ${Math.round(M.colB * 100)}×${Math.round(M.colB * 100)} cm.`;
  $('#fndBody').innerHTML = tp.map(t => `<tr><td class="mono" style="color:var(--cyan)">${t.t}</td><td class="n">${fm(t.B)} × ${fm(t.B)}</td><td class="n">${fm(t.h)}</td><td class="n">${t.n}</td><td class="n">${fm(t.P, 1)} t</td></tr>`).join('');
}

function renderBudget() {
  const M = app.M;
  let html = '', cap = '';
  M.quant.items.forEach(it => {
    const c = `${it.cat}|${it.cap}`;
    if (c !== cap) { cap = c; html += `<tr class="cap"><td colspan="5"><span class="c-${it.cat}">●</span> ${CATEGORIAS[it.cat]} · ${esc(it.cap)}</td></tr>`; }
    html += `<tr><td>${esc(it.item)}</td><td class="mono" style="color:var(--mut)">${it.und}</td><td class="n">${fm(it.q, it.und === 'und' ? 0 : 2)}</td><td><input type="number" inputmode="numeric" step="500" data-p="prices.${it.k}" value="${app.S.prices[it.k]}" style="text-align:right" aria-label="Valor unitario de ${esc(it.item)}"></td><td class="n" id="t_${it.id}"></td></tr>`;
  });
  html += '<tr class="cap"><td colspan="4">Total costo directo</td><td class="n" id="t_all" style="color:var(--fg);font-size:14px"></td></tr>';
  $('#budBody').innerHTML = html;
  const m = M.quant.mat;
  $('#matStats').innerHTML = [stat('Concreto', fm(m.concreto, 1), 'm³'), stat('Acero', m.acero.toLocaleString('es-CO'), 'kg'), stat('Bloques N°5', m.bloques.toLocaleString('es-CO'), 'und'), stat('Cemento', m.cemento.toLocaleString('es-CO'), 'bultos'), stat('Arena', fm(m.arena, 1), 'm³'), stat('Grava', fm(m.grava, 1), 'm³')].join('');
  actualizarPresupuesto();
}

function actualizarPresupuesto() {
  const M = app.M;
  if (!M || M.err) return;
  M.quant.items.forEach(it => { const c = $('#t_' + it.id); if (c) c.textContent = cop(it.q * (+app.S.prices[it.k] || 0)); });
  const t = totales(M, app.S.prices);
  const a = $('#t_all');
  if (a) a.textContent = cop(t.all);
  $('#budStats').innerHTML = [stat('Total', cop(t.all)), stat('Por m² construido', cop(t.all / M.built)), stat('Obra negra', cop(t.negra)), stat('Obra gris', cop(t.gris)), stat('Obra blanca', cop(t.blanca))].join('');
  const color = k => (k === 'negra' ? 'amber' : k === 'gris' ? 'gris' : 'cyan');
  $('#budBar').innerHTML = ['negra', 'gris', 'blanca'].map(k => `<div style="width:${t[k] / t.all * 100}%;background:var(--${color(k)})" title="${CATEGORIAS[k]}"></div>`).join('');
  renderKPIs();
}

function renderGantt() {
  const G = app.M.gantt, tot = G.total;
  const color = c => (c === 'negra' ? 'amber' : c === 'gris' ? 'gris' : 'cyan');
  $('#ganttSub').textContent = `${tot} días hábiles ≈ ${Math.ceil(tot / 6)} semanas con una cuadrilla (oficial + 2 ayudantes)${app.M.F > 1 ? '. La mampostería arranca con la estructura del piso 2' : ''}.`;
  $('#gantt').innerHTML = G.tasks.map(t => `<div class="g-row"><span>${esc(t.name)}</span><div class="g-track"><div style="left:${t.s / tot * 100}%;width:${Math.max(t.d / tot * 100, 1)}%;background:var(--${color(t.cat)})"></div></div><span class="mono" style="color:var(--mut);text-align:right">${t.d} d</span></div>`).join('');
}

function renderPlanViews() {
  const v = vistas(app.M);
  if (!v.some(x => x[0] === app.planView)) app.planView = 'p1';
  $('#planViews').innerHTML = v.map(([k, l]) => `<button class="chip" data-view="${k}" aria-pressed="${k === app.planView}">${l}</button>`).join('');
}
function renderPlan() {
  const box = $('#planBox'), old = box.querySelector('svg');
  if (old) old.remove();
  box.insertAdjacentHTML('afterbegin', planSVG(app.M, app.planView, 'dark'));
  ajustarPlano();
}

/* ---------------- app instalable ---------------- */
function conectarInstalacion() {
  if (import.meta.env.PROD && 'serviceWorker' in navigator) {
    addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(e => console.warn('[sw]', e)));
  }
  addEventListener('beforeinstallprompt', e => { e.preventDefault(); avisoInstalar = e; $('#bInstalar').hidden = false; });
  addEventListener('appinstalled', () => { avisoInstalar = null; $('#bInstalar').hidden = true; });
}

/* ---------------- arranque ---------------- */
async function iniciar() {
  const compartido = await proyectoDelEnlace();
  app.S = compartido ? normalizarEstado(compartido) : (cargarGuardado() || clonar(DEFAULT_STATE));
  if (compartido) guardar();
  conectarEntradas();
  conectarControles3D();
  conectarAR(lot => {
    Object.assign(app.S, { lot, spots: [], frente: 0 });
    guardar(); renderLot(); recompute(); showTab('terreno');
    toast(`Lote medido en AR: ${lot.length} vértices, ${fm(app.M.lotArea || 0, 1)} m².`);
  });
  instalarPanZoom($('#planBox'));
  $('#planViews').addEventListener('click', e => {
    const b = e.target.closest('[data-view]');
    if (!b) return;
    app.planView = b.dataset.view;
    renderPlanViews(); renderPlan();
  });
  $('#tabs').addEventListener('click', e => { const b = e.target.closest('.tab'); if (b) showTab(b.dataset.tab); });
  conectarInstalacion();
  bindStatic(); renderLot(); renderRooms(); recompute(); applyPhase();
  const h0 = (location.hash || '').slice(1);
  showTab(TABS.includes(h0) ? h0 : 'terreno');
  if (compartido) toast(`Abriste un proyecto compartido: ${app.S.nombre || 'sin nombre'}.`);
  // Acceso para pruebas en desarrollo; no sale en la version publicada.
  if (import.meta.env.DEV) window.__obra = { app, recompute, showTab };
}

iniciar();
