/* ==========================================================================
   AXIONA TOPO · Realidad aumentada
   --------------------------------------------------------------------------
   MEDIR (Android con ARCore, Chrome): la camara detecta el piso y cada
   toque marca un punto en 3D con precision de centimetros cerca del
   celular. Se marcan esquinas, puntos de nivel o la profundidad de una
   excavacion (borde y fondo). Con RAYOS X el modelo se dibuja a escala
   real encima del terreno: las curvas sobre el piso, la tierra a cortar
   y rellenar y el suelo hacia abajo, en el mismo sitio donde se midio.
   PALMA: el holograma del lote en pequeño (30 cm) sobre una mesa o la mano.
   iPhone: Safari no tiene WebXR; la palma se abre con AR Quick Look.
   ========================================================================== */

import * as THREE from 'three';
import { USDZExporter } from 'three/addons/exporters/USDZExporter.js';
import { rendererHolo, pausarHolo, reanudarHolo, construirModelo, modeloParaUSDZ } from '../vista/holo.js';
import { calcular, normalizar } from '../motor/levantamiento.js';
import { area } from '../motor/poligono.js';

const XR = { sesion: null, hit: null, modo: null, tipo: 'esquina', pts: [], marcas: [], escena: null, cam: null, ret: null, colocado: null, borde: null, rayos: null, p0: null, alTerminar: null, D: null, opc: null, escala: 1, ui: null, reloj: new THREE.Clock() };

export const esIOS = () => /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

export async function arDisponible() {
  try { return !!(navigator.xr && await navigator.xr.isSessionSupported('immersive-ar')); } catch { return false; }
}

const f2 = v => v.toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Puntos del AR en metros del levantamiento: x, y en el piso y z hacia arriba, desde el primero. */
function aLevantamiento(p) {
  const o = XR.p0;
  return { x: +(p.x - o.x).toFixed(3), y: +(-(p.z - o.z)).toFixed(3), z: +(p.y - o.y).toFixed(3) };
}

function marca(p, color) {
  const g = new THREE.Group();
  const m = new THREE.MeshBasicMaterial({ color });
  const s = new THREE.Mesh(new THREE.SphereGeometry(0.03, 16, 12), m);
  s.position.copy(p);
  const palo = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.007, 0.5, 6), m);
  palo.position.copy(p).add(new THREE.Vector3(0, 0.25, 0));
  g.add(s, palo);
  return g;
}

function actualizarUI() {
  const { msg, botones } = XR.ui;
  if (XR.modo === 'medir') {
    const esq = XR.pts.filter(p => p.tipo === 'esquina'), niv = XR.pts.filter(p => p.tipo === 'nivel');
    const u = XR.pts[XR.pts.length - 1], a = XR.pts[XR.pts.length - 2];
    let t = '';
    if (XR.tipo === 'profundidad') t = XR.borde ? '<b>Profundidad</b> · ahora toque el FONDO de la excavación.' : '<b>Profundidad</b> · toque el BORDE de arriba de la excavación.';
    else if (!XR.pts.length) t = 'Apunte al suelo hasta ver el anillo y toque la primera esquina del FRENTE (la de la izquierda mirando desde la calle).';
    else {
      const lado = u && a ? Math.hypot(u.v.x - a.v.x, u.v.z - a.v.z) : 0;
      const sup = esq.length >= 3 ? area(esq.map(p => aLevantamiento(p.v))) : 0;
      t = `<b>${esq.length} esquinas · ${niv.length} niveles</b> · último tramo ${f2(lado)} m · cota ${u ? (aLevantamiento(u.v).z >= 0 ? '+' : '') + f2(aLevantamiento(u.v).z) : ''} m${sup ? ` · área ${f2(sup)} m²` : ''}`;
    }
    msg.innerHTML = t;
    const b = (k, txt, extra = '') => `<button class="btn${XR.tipo === k ? ' activo' : ''}" data-xr="${k}" ${extra}>${txt}</button>`;
    botones.innerHTML = b('esquina', 'Esquina') + b('nivel', 'Nivel') + b('profundidad', 'Profundidad')
      + `<button class="btn" data-xr="deshacer">Deshacer</button>`
      + `<button class="btn${XR.rayos ? ' activo' : ''}" data-xr="rayos" ${XR.pts.length < 3 ? 'disabled' : ''}>Rayos X</button>`
      + `<button class="btn pri" data-xr="listo">Listo</button>`;
  } else {
    msg.innerHTML = XR.colocado ? 'Holograma colocado. Toque otro punto para moverlo.' : 'Apunte a una mesa, al piso o a la palma abierta y toque para poner el holograma.';
    botones.innerHTML = '<button class="btn" data-xr="menos">−</button><button class="btn" data-xr="mas">+</button><button class="btn" data-xr="rotar">Rotar</button>'
      + `<button class="btn${XR.opc?.rayos ? ' activo' : ''}" data-xr="rayosPalma">Rayos X</button><button class="btn pri" data-xr="salir">Salir</button>`;
  }
}

function modeloPalma() {
  const g = construirModelo(XR.D, { exag: XR.opc.exag, rayos: XR.opc.rayos, centro: XR.D.centro, zref: XR.D.zmin, etiquetas: true });
  g.scale.setScalar(XR.escala);
  return g;
}

function alTocar() {
  if (!XR.ret.visible) return;
  const v = new THREE.Vector3().setFromMatrixPosition(XR.ret.matrix);
  if (XR.modo === 'palma') {
    if (!XR.colocado) XR.escena.add(XR.colocado = modeloPalma());
    XR.colocado.position.copy(v);
    actualizarUI();
    return;
  }
  if (XR.tipo === 'profundidad') {
    if (!XR.borde) { XR.borde = v; XR.escena.add(XR.marcaBorde = marca(v, 0xff5f78)); }
    else {
      const prof = XR.borde.y - v.y, hz = Math.hypot(v.x - XR.borde.x, v.z - XR.borde.z);
      XR.ui.msg.innerHTML = `<b>Profundidad ${f2(prof)} m</b> · desplazamiento ${f2(hz)} m. Toque de nuevo el borde para otra medida.`;
      XR.escena.add(marca(v, 0xff5f78));
      XR.borde = null;
      XR.medidas.push({ prof, hz });
      return;
    }
    actualizarUI();
    return;
  }
  if (!XR.p0) XR.p0 = v.clone();
  const g = marca(v, XR.tipo === 'esquina' ? 0x3fcfff : 0xffae2b);
  const ant = [...XR.pts].reverse().find(p => p.tipo === 'esquina');
  if (XR.tipo === 'esquina' && ant) g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([ant.v, v]), new THREE.LineBasicMaterial({ color: 0x3fcfff })));
  XR.escena.add(g);
  XR.marcas.push(g);
  XR.pts.push({ v, tipo: XR.tipo });
  if (XR.rayos) pintarRayos();
  actualizarUI();
}

function puntosDelAR() {
  let ne = 0, nn = 0;
  return XR.pts.map(p => ({ ...aLevantamiento(p.v), tipo: p.tipo, id: p.tipo === 'esquina' ? `P${++ne}` : `N${++nn}`, fuente: 'camara', prec: 0.03 }));
}

function pintarRayos() {
  if (XR.rayos) { XR.escena.remove(XR.rayos); XR.rayos = null; }
  const D = calcular(normalizar({ puntos: puntosDelAR() }));
  if (!D.T.triangulos.length) return;
  XR.rayos = construirModelo(D, { exag: 1, rayos: true, centro: { x: 0, y: 0 }, zref: 0, etiquetas: false, prof: 1.5 });
  XR.rayos.position.copy(XR.p0);
  XR.escena.add(XR.rayos);
}

function alBoton(e) {
  const a = e.target.closest('[data-xr]')?.dataset.xr;
  if (!a) return;
  if (['esquina', 'nivel', 'profundidad'].includes(a)) { XR.tipo = a; XR.borde = null; }
  if (a === 'deshacer' && XR.pts.length) { XR.pts.pop(); XR.escena.remove(XR.marcas.pop()); if (!XR.pts.length) XR.p0 = null; if (XR.rayos) pintarRayos(); }
  if (a === 'rayos') { if (XR.rayos) { XR.escena.remove(XR.rayos); XR.rayos = null; } else pintarRayos(); }
  if (a === 'listo' || a === 'salir') { XR.terminar = a === 'listo'; XR.sesion?.end(); return; }
  if (a === 'mas' || a === 'menos') { XR.escala *= a === 'mas' ? 1.5 : 1 / 1.5; XR.colocado?.scale.setScalar(XR.escala); }
  if (a === 'rotar' && XR.colocado) XR.colocado.rotation.y += Math.PI / 8;
  if (a === 'rayosPalma') {
    XR.opc = { ...XR.opc, rayos: !XR.opc.rayos };
    if (XR.colocado) {
      const viejo = XR.colocado;
      XR.colocado = modeloPalma();
      XR.colocado.position.copy(viejo.position);
      XR.colocado.rotation.y = viejo.rotation.y;
      XR.escena.remove(viejo);
      XR.escena.add(XR.colocado);
    }
  }
  actualizarUI();
}

/**
 * Abre la sesion. modo 'medir' devuelve los puntos con alTerminar(puntos, medidas);
 * modo 'palma' necesita D (el levantamiento calculado) y opc { exag, rayos }.
 */
export async function iniciarAR(modo, { overlay, msg, botones, D = null, opc = {}, alTerminar = () => {} }) {
  const r = rendererHolo();
  if (!r) throw new Error('El 3D no está disponible en este celular.');
  overlay.hidden = false;
  let sesion;
  try {
    sesion = await navigator.xr.requestSession('immersive-ar', { requiredFeatures: ['hit-test'], optionalFeatures: ['dom-overlay'], domOverlay: { root: overlay } });
  } catch (e) {
    overlay.hidden = true;
    throw new Error('No se pudo abrir la cámara en realidad aumentada: ' + e.message);
  }
  pausarHolo();
  Object.assign(XR, { sesion, modo, tipo: 'esquina', pts: [], marcas: [], medidas: [], p0: null, colocado: null, borde: null, rayos: null, D, opc, alTerminar, terminar: false, ui: { msg, botones } });
  const tam = D ? Math.max(1, ...D.puntos.map(p => Math.hypot(p.x - D.centro.x, p.y - D.centro.y))) * 2 : 1;
  XR.escala = 0.3 / tam;
  r.xr.enabled = true;
  r.xr.setReferenceSpaceType('local');
  r.setClearColor(0x000000, 0);
  await r.xr.setSession(sesion);
  XR.hit = await sesion.requestHitTestSource({ space: await sesion.requestReferenceSpace('viewer') });
  XR.escena = new THREE.Scene();
  XR.ret = new THREE.Mesh(new THREE.RingGeometry(0.06, 0.085, 36).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: modo === 'medir' ? 0xffae2b : 0x3fcfff }));
  XR.ret.matrixAutoUpdate = false;
  XR.ret.visible = false;
  XR.escena.add(XR.ret);
  XR.cam = new THREE.PerspectiveCamera();
  const bloquear = e => { if (e.target.closest('button')) e.preventDefault(); };
  overlay.addEventListener('beforexrselect', bloquear);
  botones.addEventListener('click', alBoton);
  sesion.addEventListener('select', alTocar);
  sesion.addEventListener('end', () => {
    r.setAnimationLoop(null);
    r.xr.enabled = false;
    overlay.hidden = true;
    overlay.removeEventListener('beforexrselect', bloquear);
    botones.removeEventListener('click', alBoton);
    XR.hit = null; XR.sesion = null;
    reanudarHolo();
    if (XR.modo === 'medir' && XR.terminar) XR.alTerminar(puntosDelAR(), XR.medidas);
  });
  r.setAnimationLoop((_t, frame) => {
    if (frame && XR.hit) {
      const ref = r.xr.getReferenceSpace(), h = frame.getHitTestResults(XR.hit);
      if (h.length) { XR.ret.visible = true; XR.ret.matrix.fromArray(h[0].getPose(ref).transform.matrix); } else XR.ret.visible = false;
    }
    const t = XR.reloj.getElapsedTime();
    for (const g of [XR.rayos, XR.colocado]) g?.userData.mats?.forEach(m => { m.uniforms.uTiempo.value = t; });
    r.render(XR.escena, XR.cam);
  });
  actualizarUI();
}

/** AR Quick Look en iPhone/iPad: el holograma en pequeño con un .usdz. */
export async function palmaEnIPhone(D, opc = {}) {
  const g = modeloParaUSDZ(D, opc);
  if (!g) throw new Error('Faltan puntos para armar el terreno.');
  const tam = Math.max(1, ...D.puntos.map(p => Math.hypot(p.x - D.centro.x, p.y - D.centro.y))) * 2;
  g.scale.setScalar(0.3 / tam);
  const datos = await new USDZExporter().parseAsync(g);
  const blob = new Blob([datos], { type: 'model/vnd.usdz+zip' });
  const a = document.createElement('a');
  a.rel = 'ar';
  a.href = URL.createObjectURL(blob) + '#allowsContentScaling=1';
  a.appendChild(document.createElement('img'));
  document.body.appendChild(a);
  a.click();
  a.remove();
  return blob;
}
