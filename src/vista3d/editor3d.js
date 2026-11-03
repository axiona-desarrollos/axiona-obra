/* ==========================================================================
   AXIONA OBRA · Editar en el 3D
   --------------------------------------------------------------------------
   El arquitecto toca y arrastra: un mueble (se mueve sobre su piso, de 5 en
   5 cm, y se gira, se le cambia la medida, se duplica o se quita), la
   piscina (se arrastra por el patio), o un acabado: el piso de un espacio,
   el enchape de los baños, la fachada o la teja. Cada cambio se guarda en el
   proyecto y se recalculan planos, cantidades y presupuesto. Teclado:
   flechas mueven 5 cm (con Mayús 50 cm), R gira, Supr quita, Esc suelta.
   ========================================================================== */

import * as THREE from 'three';
import { PISOS, FACHADAS, TEJAS, ENCHAPES, MUEBLES, AGREGABLES, medidasDe, tr } from '../motor/index.js';
import { miniatura } from './materiales.js';

const PASO = 0.05;
const ajustar = v => Math.round(v / PASO) * PASO;
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const cm = v => Math.round(v * 100);

/**
 * @param {object} T3   estado del 3D (escena, cámara, controles, muebles…)
 * @param {object} ctx  { app, cambiar(fn, {suave}), render3D, dinero(v), casaAbierta(on), pintarInteriores() }
 */
export function crearEditor(T3, ctx) {
  const { app } = ctx;
  const ray = new THREE.Raycaster(), pt = new THREE.Vector2(), plano = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), hit = new THREE.Vector3();
  let activo = false, sel = null, arrastre = null, caja = null;
  const panel = document.createElement('div');
  panel.className = 'editor3d';
  panel.hidden = true;
  T3.box.appendChild(panel);

  /* ---------- selección y resaltado ---------- */
  const visibleDe = o => { for (let x = o; x; x = x.parent) if (!x.visible) return false; return true; };
  const corteY = () => (T3.abierta && T3.renderer.localClippingEnabled ? T3.planoCorte?.constant ?? Infinity : Infinity);
  function apuntar(e) {
    const r = T3.renderer.domElement.getBoundingClientRect();
    pt.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(pt, T3.cam);
  }
  function tocado() {
    const hits = ray.intersectObject(T3.root, true), cy = corteY();
    for (const h of hits) {
      const o = h.object;
      if (!o.isMesh || !visibleDe(o)) continue;
      const mats = [].concat(o.material);
      if (h.point.y > cy + 0.01 && mats.some(m => m?.clippingPlanes?.length)) continue;
      const mat = Array.isArray(o.material) ? o.material[h.face?.materialIndex ?? 0] : o.material;
      if (mat?.transparent && mat.opacity < 0.5 && !o.userData.agua) continue; // a través de los vidrios
      let g = o;
      while (g && g.userData.mueble === undefined && g.parent && g.parent !== T3.root) g = g.parent;
      if (g?.userData.mueble !== undefined) return { tipo: 'mueble', id: g.userData.mueble, obj: g, punto: h.point };
      if (o.userData.piscina || o.userData.agua) return { tipo: 'piscina', punto: h.point };
      if (o.userData.piso) return { tipo: 'piso', key: o.userData.piso, espacio: o.userData.espacio };
      if (o.userData.enchape) return { tipo: 'enchape', espacio: o.userData.espacio };
      if (mat === T3.mat?.teja) return { tipo: 'teja' };
      if (mat === T3.mat?.fachada || o.userData.culata) return { tipo: 'fachada' };
      if (o.userData.ext && mat === T3.mat?.pinturaI) return { tipo: 'interior' };
      if (o.userData.terrain || o.userData.entorno) return { tipo: 'nada' };
      return { tipo: 'nada' };
    }
    return null;
  }
  function resaltar() {
    if (caja) { T3.scene.remove(caja); caja.geometry.dispose(); caja = null; }
    const g = sel?.tipo === 'mueble' ? T3.muebles?.find(m => m.userData.mueble === sel.id) : null;
    if (g) { caja = new THREE.BoxHelper(g, 0x22d3ee); caja.material.depthTest = false; caja.renderOrder = 9; T3.scene.add(caja); }
    ctx.render3D();
  }
  const itemDe = id => app.M?.muebles?.find(m => m.id === id);

  /* ---------- guardar cambios ---------- */
  function moverMueble(id, cambios) {
    ctx.cambiar(S => {
      const ex = S.muebles.extra.find(e => e.id === id);
      if (ex) { Object.assign(ex, Object.fromEntries(Object.entries(cambios).filter(([k]) => ['x', 'y', 'rot'].includes(k)))); const r = { ...(S.muebles.mover[id] || {}) }; ['w', 'd'].forEach(k => { if (k in cambios) r[k] = cambios[k]; }); if (Object.keys(r).length) S.muebles.mover[id] = r; return; }
      S.muebles.mover[id] = { ...(S.muebles.mover[id] || {}), ...cambios };
    });
  }
  function quitar(id) {
    ctx.cambiar(S => {
      const i = S.muebles.extra.findIndex(e => e.id === id);
      if (i >= 0) S.muebles.extra.splice(i, 1); else if (!S.muebles.quitar.includes(id)) S.muebles.quitar.push(id);
      delete S.muebles.mover[id];
    });
    sel = null;
  }
  function agregar(tipo, f, x, y, rot = 0) {
    const id = `x${Date.now().toString(36)}`;
    const md = medidasDe(tipo);
    ctx.cambiar(S => { S.muebles.extra.push({ id, tipo, f, x: +x.toFixed(2), y: +y.toFixed(2), rot, ...(md.var ? { var: md.var } : {}) }); S.amoblar = true; });
    sel = { tipo: 'mueble', id };
  }
  /** Centro del espacio más grande del piso que se está viendo (para poner un mueble nuevo). */
  function sitioLibre() {
    const M = app.M, f = T3.abierta ? Math.min(app.viewFloor < 99 ? app.viewFloor : 0, M.F - 1) : app.viewFloor < 99 ? Math.min(app.viewFloor, M.F - 1) : 0;
    const it = sel?.tipo === 'mueble' ? itemDe(sel.id) : null;
    if (it) return { f: it.f, x: it.x + 0.6, y: it.y + 0.6 };
    if (sel?.tipo === 'piso') { const [p, ...n] = sel.key.split(':'); const r = M.floors[+p - 1]?.rects.find(q => q.name === n.join(':')); if (r) return { f: +p - 1, x: (r.x0 + r.x1) / 2, y: (r.y0 + r.y1) / 2 }; }
    const r = [...M.floors[f].rects].filter(q => !q.stair && !q.asc).sort((a, b) => b.area - a.area)[0] || M.R;
    return { f, x: (r.x0 + r.x1) / 2, y: (r.y0 + r.y1) / 2 };
  }

  /* ---------- panel ---------- */
  const T = (es, en) => tr({ es, en });
  const pais = () => app.S.pais;
  const rejilla = (lista, actual, attr) => `<div class="mats">${lista.map(([k, a, precio]) => `<button type="button" class="mat ${k === actual ? 'on' : ''}" ${attr}="${esc(k)}" title="${esc(tr(a.n))}">${miniatura(a) ? `<img src="${esc(miniatura(a))}" alt="" loading="lazy">` : `<i style="background:${esc(a.color || '#ddd')}"></i>`}<b>${esc(tr(a.n))}</b>${precio ? `<small>${esc(precio)}</small>` : ''}</button>`).join('')}</div>`;
  function pintar() {
    if (!activo) { panel.hidden = true; return; }
    panel.hidden = false;
    const S = app.S, M = app.M, pid = pais();
    const cab = `<div class="ed-cab"><b>✥ ${T('Editar', 'Edit')}</b><button type="button" class="x" data-ed="cerrar" aria-label="${T('Cerrar', 'Close')}">×</button></div>`;
    let cuerpo = '';
    if (!sel) {
      cuerpo = `<p class="ed-ayuda">${T('Toca un mueble y arrástralo. Toca un piso, un baño, la fachada o el techo para cambiar el material. La piscina también se arrastra.', 'Tap a piece and drag it. Tap a floor, a bathroom, the facade or the roof to change its material. The pool can be dragged too.')}</p>`;
    } else if (sel.tipo === 'mueble') {
      const it = itemDe(sel.id);
      if (!it) { sel = null; return pintar(); }
      cuerpo = `<p class="ed-tit">${esc(tr(MUEBLES[it.tipo]?.n || { es: it.tipo }))} <small>· ${esc(it.room || '')} · ${T('piso', 'floor')} ${it.f + 1}</small></p>
        <div class="ed-fila"><button type="button" data-ed="girar">⟳ 90°</button><button type="button" data-ed="girarI">⟲ 90°</button><button type="button" data-ed="duplicar">⧉ ${T('Duplicar', 'Duplicate')}</button><button type="button" data-ed="quitar" class="peligro">🗑 ${T('Quitar', 'Remove')}</button></div>
        <div class="ed-fila"><label>${T('Ancho', 'Width')} <input type="number" step="5" min="20" max="600" data-ed-med="w" value="${cm(it.w)}"> cm</label><label>${T('Fondo', 'Depth')} <input type="number" step="5" min="20" max="600" data-ed-med="d" value="${cm(it.d)}"> cm</label></div>
        <div class="ed-fila"><span class="mono">x ${it.x.toFixed(2)} · y ${it.y.toFixed(2)} m</span>${it.movido && !it.agregado ? `<button type="button" data-ed="volver">↺ ${T('A su sitio', 'Reset')}</button>` : ''}</div>`;
    } else if (sel.tipo === 'piscina') {
      const P = M.exterior?.piscina, p = S.piscina;
      cuerpo = `<p class="ed-tit">${T('Piscina', 'Pool')} ${P ? `<small>· ${P.w} × ${P.h} m · ${Math.round(P.litros / 1000)} m³</small>` : ''}</p>
        <div class="ed-fila"><label>${T('Largo', 'Length')} <input type="number" step="0.5" min="2" max="25" data-ed-pis="largo" value="${p.largo}"> m</label><label>${T('Ancho', 'Width')} <input type="number" step="0.5" min="1.5" max="12" data-ed-pis="ancho" value="${p.ancho}"> m</label><label>${T('Prof.', 'Depth')} <input type="number" step="0.1" min="0.6" max="3" data-ed-pis="prof" value="${p.prof}"> m</label></div>
        <div class="ed-fila"><button type="button" data-ed="pisAuto">↺ ${T('Centrar en el patio', 'Center in yard')}</button><button type="button" data-ed="pisQuitar" class="peligro">🗑 ${T('Quitar', 'Remove')}</button></div>`;
    } else if (sel.tipo === 'piso') {
      const actual = S.acabados.pisos[sel.key];
      cuerpo = `<p class="ed-tit">${T('Piso de', 'Floor of')} ${esc(sel.espacio)}</p>${rejilla(Object.entries(PISOS).map(([k, p]) => [k, p, ctx.dinero(p.precio[pid]) + '/m²']), actual, 'data-ed-piso')}
        <div class="ed-fila"><button type="button" data-ed="pisoTodo">${T('Aplicar a todo este piso', 'Apply to this whole floor')}</button>${actual ? `<button type="button" data-ed="pisoEstilo">↺ ${T('El del estilo', 'Style default')}</button>` : ''}</div>`;
    } else if (sel.tipo === 'fachada') {
      cuerpo = `<p class="ed-tit">${T('Fachada', 'Facade')}</p>${rejilla(Object.entries(FACHADAS).map(([k, f]) => [k, f, f.precio ? ctx.dinero(f.precio[pid]) + '/m²' : T('pintura', 'paint')]), S.acabados.fachada || 'estuco', 'data-ed-fachada')}`;
    } else if (sel.tipo === 'teja') {
      cuerpo = `<p class="ed-tit">${T('Teja de la cubierta', 'Roof tiles')}</p>${rejilla(Object.entries(TEJAS).map(([k, f]) => [k, f, f.extra ? '+' + ctx.dinero(f.extra[pid]) + '/m²' : '']), S.acabados.teja || 'sistema', 'data-ed-teja')}`;
    } else if (sel.tipo === 'enchape') {
      cuerpo = `<p class="ed-tit">${T('Enchape de baños y cocina', 'Bath and kitchen wall tile')}</p>${rejilla(Object.entries(ENCHAPES).map(([k, f]) => [k, f, '']), S.acabados.enchape || '', 'data-ed-enchape')}`;
    } else if (sel.tipo === 'interior') {
      cuerpo = `<p class="ed-ayuda">${T('Muro interior: el color sale del estilo (pestaña Interiores). Toca la cara de afuera para cambiar la fachada.', 'Interior wall: its colour comes from the style (Interiors tab). Tap the outside face to change the facade.')}</p>`;
    }
    const agregar = `<div class="ed-agregar"><select data-ed-nuevo aria-label="${T('Agregar mueble', 'Add furniture')}"><option value="">＋ ${T('Agregar mueble…', 'Add furniture…')}</option>${AGREGABLES.map(k => `<option value="${k}">${esc(tr(MUEBLES[k].n))}</option>`).join('')}</select>${S.piscina?.on ? '' : `<button type="button" data-ed="pisPoner">＋ ${T('Piscina', 'Pool')}</button>`}</div>`;
    panel.innerHTML = cab + cuerpo + agregar;
  }

  panel.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    const S = app.S, a = b.dataset.ed;
    const it = sel?.tipo === 'mueble' ? itemDe(sel.id) : null;
    if (a === 'cerrar') return activar(false);
    if (a === 'girar' && it) return moverMueble(it.id, { rot: (it.rot + 90) % 360 });
    if (a === 'girarI' && it) return moverMueble(it.id, { rot: (it.rot + 270) % 360 });
    if (a === 'quitar' && it) return quitar(it.id);
    if (a === 'duplicar' && it) return agregar(it.tipo, it.f, it.x + 0.4, it.y + 0.4, it.rot);
    if (a === 'volver' && it) return ctx.cambiar(Sx => { delete Sx.muebles.mover[it.id]; });
    if (a === 'pisAuto') return ctx.cambiar(Sx => { Sx.piscina.x = null; Sx.piscina.y = null; });
    if (a === 'pisQuitar') { sel = null; return ctx.cambiar(Sx => { Sx.piscina.on = false; }); }
    if (a === 'pisPoner') { sel = { tipo: 'piscina' }; return ctx.cambiar(Sx => { Sx.piscina = { ...Sx.piscina, on: true, x: null, y: null }; }); }
    if (a === 'pisoTodo' && sel?.tipo === 'piso') {
      const k = S.acabados.pisos[sel.key] || null; if (!k) return;
      const f = +sel.key.split(':')[0];
      return ctx.cambiar(Sx => { app.M.floors[f - 1].rects.filter(r => !r.stair && !r.asc).forEach(r => { Sx.acabados.pisos[`${f}:${r.name}`] = k; }); });
    }
    if (a === 'pisoEstilo' && sel?.tipo === 'piso') return ctx.cambiar(Sx => { delete Sx.acabados.pisos[sel.key]; });
    const m = b.dataset.edPiso ?? b.dataset.edFachada ?? b.dataset.edTeja ?? b.dataset.edEnchape;
    if (m !== undefined) {
      if (b.dataset.edPiso) ctx.cambiar(Sx => { Sx.acabados.pisos[sel.key] = m; });
      else if (b.dataset.edFachada) ctx.cambiar(Sx => { if (m === 'estuco') delete Sx.acabados.fachada; else Sx.acabados.fachada = m; });
      else if (b.dataset.edTeja) ctx.cambiar(Sx => { if (m === 'sistema') delete Sx.acabados.teja; else Sx.acabados.teja = m; });
      else ctx.cambiar(Sx => { Sx.acabados.enchape = m; });
    }
  });
  panel.addEventListener('change', e => {
    const t = e.target;
    if (t.dataset.edNuevo !== undefined && t.value) { const s = sitioLibre(); agregar(t.value, s.f, s.x, s.y); return; }
    if (t.dataset.edMed && sel?.tipo === 'mueble') { const v = Math.min(600, Math.max(20, +t.value || 0)) / 100; moverMueble(sel.id, { [t.dataset.edMed]: v }); return; }
    if (t.dataset.edPis) { const k = t.dataset.edPis, v = +t.value; if (Number.isFinite(v)) ctx.cambiar(S => { S.piscina[k] = v; }); }
  });

  /* ---------- tocar y arrastrar ---------- */
  const lienzo = () => T3.renderer.domElement;
  function abajo(e) {
    if (!activo || e.button > 0) return;
    apuntar(e);
    const h = tocado();
    if (!h) return;
    if (h.tipo === 'mueble' || h.tipo === 'piscina') {
      const obj = h.tipo === 'mueble' ? h.obj : null;
      const it = h.tipo === 'mueble' ? itemDe(h.id) : null;
      const P = app.M.exterior?.piscina;
      const y0 = obj ? obj.position.y : (P?.z ?? app.M.dl);
      plano.constant = -y0;
      if (!ray.ray.intersectPlane(plano, hit)) return;
      sel = h.tipo === 'mueble' ? { tipo: 'mueble', id: h.id } : { tipo: 'piscina' };
      const base = it ? { x: it.x, y: it.y } : { x: (P.x0 + P.x1) / 2, y: (P.y0 + P.y1) / 2 };
      const grupos = h.tipo === 'piscina' ? piezasPiscina() : [obj];
      arrastre = { id: pointerId(e), ini: hit.clone(), base, grupos, pos0: grupos.map(g => g.position.clone()), dx: 0, dy: 0, movio: false, sx: e.clientX, sy: e.clientY };
      T3.ctl.enabled = false;
      lienzo().setPointerCapture?.(e.pointerId);
      resaltar(); pintar();
      e.preventDefault();
      return;
    }
    if (h.tipo === 'nada') { sel = null; resaltar(); pintar(); return; }
    sel = h; resaltar(); pintar();
  }
  const pointerId = e => e.pointerId;
  function mueve(e) {
    if (!arrastre || pointerId(e) !== arrastre.id) return;
    apuntar(e);
    if (!ray.ray.intersectPlane(plano, hit)) return;
    if (!arrastre.movio && Math.hypot(e.clientX - arrastre.sx, e.clientY - arrastre.sy) < 4) return;
    arrastre.movio = true;
    const dx = ajustar(hit.x - arrastre.ini.x), dz = ajustar(hit.z - arrastre.ini.z);
    arrastre.dx = dx; arrastre.dy = -dz;
    arrastre.grupos.forEach((g, i) => { g.position.set(arrastre.pos0[i].x + dx, arrastre.pos0[i].y, arrastre.pos0[i].z + dz); });
    if (caja) caja.update();
    ctx.render3D();
  }
  function arriba(e) {
    if (!arrastre || pointerId(e) !== arrastre.id) return;
    const a = arrastre; arrastre = null;
    T3.ctl.enabled = true;
    if (!a.movio || (!a.dx && !a.dy)) return;
    const x = +(a.base.x + a.dx).toFixed(2), y = +(a.base.y + a.dy).toFixed(2);
    if (sel?.tipo === 'mueble') moverMueble(sel.id, { x, y });
    else ctx.cambiar(S => { S.piscina.x = x; S.piscina.y = y; });
  }
  /** Las piezas de la piscina viven en varias fases: se mueven todas juntas mientras se arrastra. */
  function piezasPiscina() {
    const out = [];
    T3.root.traverse(o => { if ((o.userData.piscina || o.userData.agua) && o.isMesh) out.push(o); });
    return out;
  }
  function tecla(e) {
    if (!activo || /input|select|textarea/i.test(e.target?.tagName || '')) return;
    if (e.key === 'Escape') { sel = null; resaltar(); pintar(); return; }
    const it = sel?.tipo === 'mueble' ? itemDe(sel.id) : null;
    if (!it) return;
    const p = e.shiftKey ? 0.5 : PASO;
    const d = { ArrowLeft: [-p, 0], ArrowRight: [p, 0], ArrowUp: [0, p], ArrowDown: [0, -p] }[e.key];
    if (d) { e.preventDefault(); moverMueble(it.id, { x: +(it.x + d[0]).toFixed(2), y: +(it.y + d[1]).toFixed(2) }); return; }
    if (e.key === 'r' || e.key === 'R') { moverMueble(it.id, { rot: (it.rot + 90) % 360 }); return; }
    if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); quitar(it.id); }
  }

  function activar(on) {
    activo = !!on;
    $btn()?.setAttribute('aria-pressed', activo);
    T3.box.classList.toggle('editando', activo);
    if (activo) {
      lienzo().addEventListener('pointerdown', abajo);
      window.addEventListener('pointermove', mueve);
      window.addEventListener('pointerup', arriba);
      window.addEventListener('keydown', tecla);
      // se edita la casa terminada y amoblada; si tiene techo, se abre para ver adentro
      if (app.phase < 10) { app.phase = 10; }
      if (!T3.abierta && !T3.sinTecho) ctx.casaAbierta(true); else ctx.aplicar();
    } else {
      lienzo().removeEventListener('pointerdown', abajo);
      window.removeEventListener('pointermove', mueve);
      window.removeEventListener('pointerup', arriba);
      window.removeEventListener('keydown', tecla);
      sel = null; arrastre = null; T3.ctl.enabled = true;
      resaltar();
    }
    pintar();
  }
  const $btn = () => document.getElementById('editarBtn');

  return {
    activar, get activo() { return activo; },
    /** Después de rearmar la escena: vuelve a resaltar lo escogido y repinta el panel. */
    refrescar() { if (!activo) return; if (sel?.tipo === 'mueble' && !itemDe(sel.id)) sel = null; resaltar(); pintar(); },
  };
}
