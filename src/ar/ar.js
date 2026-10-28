/* ==========================================================================
   AXIONA OBRA · Realidad aumentada
   --------------------------------------------------------------------------
   Android: WebXR con detección de superficies. Sirve para MEDIR el lote
   (se toca cada esquina) y para COLOCAR la casa sobre el piso real.
   iPhone/iPad: Safari no tiene WebXR, pero abre AR Quick Look con un .usdz;
   el modelo de la fase actual se exporta al vuelo y se abre ahi.
   ========================================================================== */

import * as THREE from 'three';
import { USDZExporter } from 'three/addons/exporters/USDZExporter.js';
import { $, fm, toast, app, PHASES } from '../ui/comun.js';
import { ensure3D, buildScene, resize3D, modeloParaLlevar, tres } from '../vista3d/escena.js';

const XR = { session: null, hit: null, mode: null, pts: [], marks: [], placed: null };
let alUsarLote = () => {};

export const esIOS = () => /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

export async function arSoportado() {
  try { return !!(navigator.xr && await navigator.xr.isSessionSupported('immersive-ar')); } catch { return false; }
}

export async function revisarAR() {
  const ok = await arSoportado();
  const ios = esIOS();
  $('#arStatus').innerHTML = ok
    ? '<span style="color:var(--mint)">●</span> WebXR AR disponible: puedes medir el lote y ver la casa.'
    : ios
      ? '<span style="color:var(--mint)">●</span> iPhone/iPad: usa «Ver en iPhone» (AR Quick Look). Medir el lote en AR solo funciona en Android.'
      : '<span style="color:var(--amber)">●</span> Este navegador no tiene AR. En Android abre esta página en Chrome; en iPhone, en Safari.';
}

/** @param {(lot:Array)=>void} usarLote recibe los vertices medidos */
export function conectarAR(usarLote) {
  alUsarLote = usarLote;
  $('#arOverlay').addEventListener('beforexrselect', e => { if (e.target.closest('button')) e.preventDefault(); });
  $('#arBtns').addEventListener('click', e => {
    const a = e.target.closest('[data-ar]')?.dataset.ar;
    if (!a) return;
    if (a === 'exit') XR.session?.end();
    if (a === 'undo') { XR.pts.pop(); const mk = XR.marks.pop(); if (mk) XR.scene.remove(mk); arUI(); }
    if (a === 'rot' && XR.placed) XR.placed.rotation.y += Math.PI / 12;
    if (a === 'use' && XR.pts.length >= 3) {
      const p0 = XR.pts[0];
      const lot = XR.pts.map(p => ({ x: +(p.x - p0.x).toFixed(2), y: +(-(p.z - p0.z)).toFixed(2), z: +(p.y - p0.y).toFixed(2) }));
      XR.session.end();
      alUsarLote(lot);
    }
  });
}

export async function iniciarAR(mode) {
  if (!await arSoportado()) {
    if (mode === 'place' && esIOS()) return verEnIPhone();
    toast(esIOS() ? 'En iPhone usa «Ver en iPhone».' : 'AR no disponible aquí. Abre la página en Chrome para Android con ARCore.');
    return;
  }
  if (!ensure3D()) return;
  if (app.threeDirty) buildScene();
  const ov = $('#arOverlay');
  ov.hidden = false;
  let session;
  try {
    session = await navigator.xr.requestSession('immersive-ar', { requiredFeatures: ['hit-test'], optionalFeatures: ['dom-overlay'], domOverlay: { root: ov } });
  } catch (e) {
    ov.hidden = true;
    toast('No se pudo iniciar AR: ' + e.message);
    return;
  }
  Object.assign(XR, { session, mode, pts: [], marks: [], placed: null });
  const r = tres.renderer;
  r.xr.enabled = true;
  r.xr.setReferenceSpaceType('local');
  await r.xr.setSession(session);
  XR.hit = await session.requestHitTestSource({ space: await session.requestReferenceSpace('viewer') });
  XR.scene = new THREE.Scene();
  XR.scene.add(new THREE.HemisphereLight(0xffffff, 0x445566, 2.2));
  const d = new THREE.DirectionalLight(0xffffff, 1.4);
  d.position.set(2, 5, 1);
  XR.scene.add(d);
  XR.ret = new THREE.Mesh(new THREE.RingGeometry(0.07, 0.1, 32).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: mode === 'measure' ? 0xffae2b : 0x3fcfff }));
  XR.ret.matrixAutoUpdate = false;
  XR.ret.visible = false;
  XR.scene.add(XR.ret);
  XR.cam = new THREE.PerspectiveCamera();
  session.addEventListener('select', alTocar);
  session.addEventListener('end', terminarAR);
  r.setAnimationLoop((t, frame) => {
    if (frame && XR.hit) {
      const ref = r.xr.getReferenceSpace(), h = frame.getHitTestResults(XR.hit);
      if (h.length) { XR.ret.visible = true; XR.ret.matrix.fromArray(h[0].getPose(ref).transform.matrix); } else XR.ret.visible = false;
    }
    r.render(XR.scene, XR.cam);
  });
  arUI();
}

function arUI() {
  const m = $('#arMsg'), b = $('#arBtns');
  if (XR.mode === 'measure') {
    const n = XR.pts.length;
    let per = 0;
    for (let i = 1; i < n; i++) per += XR.pts[i].distanceTo(XR.pts[i - 1]);
    const last = n > 1 ? XR.pts[n - 1].distanceTo(XR.pts[n - 2]) : 0, dh = n > 1 ? XR.pts[n - 1].y - XR.pts[0].y : 0;
    m.innerHTML = n
      ? `<b>${n} esquinas</b> · último lado ${fm(last)} m · Δh vs P1 ${dh >= 0 ? '+' : ''}${fm(dh)} m · perímetro abierto ${fm(per)} m`
      : 'Apunta al suelo hasta ver el anillo naranja y toca primero las DOS esquinas del frente (la calle), luego las demás.';
    b.innerHTML = `<button class="btn" data-ar="undo">Deshacer</button><button class="btn amb" data-ar="use" ${n < 3 ? 'disabled' : ''}>Cerrar y usar lote</button><button class="btn" data-ar="exit">Salir</button>`;
  } else {
    m.innerHTML = XR.placed
      ? `Modelo colocado · fase ${app.phase + 1}: ${PHASES[app.phase].n}. Toca otro punto para moverlo.`
      : 'Apunta al suelo o a una mesa y toca para colocar la casa.';
    b.innerHTML = '<button class="btn" data-ar="rot">Rotar 15°</button><button class="btn pri" data-ar="exit">Salir</button>';
  }
}

function alTocar() {
  if (!XR.ret.visible) return;
  const p = new THREE.Vector3().setFromMatrixPosition(XR.ret.matrix);
  if (XR.mode === 'measure') {
    const g = new THREE.Group();
    const naranja = new THREE.MeshBasicMaterial({ color: 0xffae2b });
    const s = new THREE.Mesh(new THREE.SphereGeometry(0.035, 16, 12), naranja);
    s.position.copy(p);
    g.add(s);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.6, 6), naranja);
    pole.position.copy(p).add(new THREE.Vector3(0, 0.3, 0));
    g.add(pole);
    if (XR.pts.length) g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([XR.pts[XR.pts.length - 1], p]), new THREE.LineBasicMaterial({ color: 0x3fcfff })));
    XR.scene.add(g);
    XR.marks.push(g);
    XR.pts.push(p);
  } else {
    if (!XR.placed) { XR.placed = modeloParaLlevar(+$('#arScale').value); XR.scene.add(XR.placed); }
    XR.placed.position.copy(p);
  }
  arUI();
}

function terminarAR() {
  const r = tres.renderer;
  r.setAnimationLoop(null);
  XR.hit = null; XR.session = null;
  r.xr.enabled = false;
  $('#arOverlay').hidden = true;
  resize3D();
}

/** Exporta la fase actual a USDZ (Blob). */
export async function usdzDeLaFase(escala = 1) {
  if (!ensure3D()) return null;
  if (app.threeDirty) buildScene();
  const modelo = modeloParaLlevar(escala);
  if (!modelo) return null;
  const datos = await new USDZExporter().parseAsync(modelo);
  return new Blob([datos], { type: 'model/vnd.usdz+zip' });
}

/** AR Quick Look en iPhone/iPad: un enlace rel="ar" con una imagen adentro. */
export async function verEnIPhone() {
  toast('Preparando el modelo para AR…');
  const blob = await usdzDeLaFase(+$('#arScale').value);
  if (!blob) return toast('El 3D no está disponible en este dispositivo.');
  const a = document.createElement('a');
  a.rel = 'ar';
  a.href = URL.createObjectURL(blob) + '#allowsContentScaling=1';
  a.appendChild(document.createElement('img'));
  document.body.appendChild(a);
  a.click();
  a.remove();
  if (!esIOS()) toast('AR Quick Look solo abre en iPhone/iPad. Puedes descargar el .USDZ en Exportar.');
}
