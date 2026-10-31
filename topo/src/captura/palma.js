/* ==========================================================================
   AXIONA TOPO · Holograma sobre la camara
   --------------------------------------------------------------------------
   Cuando el navegador no tiene realidad aumentada (WebXR), el holograma se
   dibuja encima de lo que ve la camara trasera, a unos 50 cm y un poco
   abajo: se pone la mano abierta debajo y queda "en la palma". No se ancla
   a la mesa (eso necesita ARCore), pero funciona en cualquier celular con
   camara, en el computador con la camara web y dentro de otras apps.
   Se gira con el dedo, se agranda con dos dedos y se mueve un poco con la
   inclinacion del celular, como si estuviera ahi.
   ========================================================================== */

import * as THREE from 'three';
import { construirModelo } from '../vista/holo.js';

const P = { r: null, escena: null, cam: null, pivote: null, modelo: null, stream: null, quitar: [], reloj: new THREE.Clock(), giro: 0, escala: 1, b0: null, g0: null, tilt: { x: 0, y: 0 } };

/** ¿Por que no hay realidad aumentada en este navegador? Texto para el usuario o null. */
export function motivoSinAR(ua = navigator.userAgent) {
  const app = /Instagram/i.test(ua) ? 'Instagram' : /FBAN|FBAV|FB_IAB/i.test(ua) ? 'Facebook' : /WhatsApp/i.test(ua) ? 'WhatsApp' : /TikTok|musical_ly/i.test(ua) ? 'TikTok' : /; wv\)/.test(ua) ? 'otra app' : null;
  if (!/Android/i.test(ua)) return null;
  if (app) return `Está abriendo Axiona Topo dentro de ${app}. Toque los tres puntos (⋮) de arriba y elija «Abrir en Chrome»: ahí funciona la realidad aumentada anclada a la mesa.`;
  if (/SamsungBrowser/i.test(ua)) return 'Samsung Internet no trae realidad aumentada. Abra esta misma página en Chrome.';
  if (!/Chrome\/\d+/.test(ua) || /Edg|OPR|Firefox/i.test(ua)) return 'Este navegador no trae realidad aumentada. Abra esta misma página en Chrome.';
  return 'Para anclarlo a la mesa, instale o actualice la app gratuita «Servicios de Google Play para RA» y vuelva a abrir Chrome.';
}

export const enlaceARCore = 'https://play.google.com/store/apps/details?id=com.google.ar.core';

function armar(D, opc) {
  if (P.modelo) { P.pivote.remove(P.modelo); P.modelo.traverse(o => { o.geometry?.dispose(); o.material?.map?.dispose?.(); o.material?.dispose?.(); }); }
  const m = construirModelo(D, { exag: opc.exag, rayos: opc.rayos, centro: D.centro, zref: D.zmin, etiquetas: true });
  const caja = new THREE.Box3().setFromObject(m), s = caja.getSize(new THREE.Vector3());
  const k = 0.3 / Math.max(s.x, s.z, 0.01);
  m.scale.setScalar(k);
  m.position.y = -caja.min.y * k;
  P.pivote.add(m);
  P.modelo = m;
}

function luz() {
  const g = new THREE.Group();
  const cono = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.015, 0.1, 48, 1, true), new THREE.MeshBasicMaterial({ color: 0x3fcfff, transparent: true, opacity: 0.12, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }));
  cono.position.y = -0.05;
  const aro = new THREE.Mesh(new THREE.RingGeometry(0.165, 0.17, 64), new THREE.MeshBasicMaterial({ color: 0x3fcfff, transparent: true, opacity: 0.8, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }));
  aro.rotation.x = -Math.PI / 2;
  g.add(cono, aro);
  return g;
}

/** El holograma (30 cm, que girando ocupa hasta ~42) cabe en el 75 % del
    ancho de la pantalla y queda en el tercio de abajo, donde va la mano. */
function tamano() {
  const w = window.innerWidth, h = window.innerHeight;
  P.r.setSize(w, h, false);
  P.cam.aspect = w / h;
  P.cam.updateProjectionMatrix();
  const tv = Math.tan(THREE.MathUtils.degToRad(P.cam.fov) / 2), th = tv * P.cam.aspect;
  const d = (0.42 / 2) / (0.75 * Math.min(th, tv));
  P.pivote.position.set(0, -d * tv * 0.32, -d);
}

/** Abre el holograma sobre la camara. Devuelve { conCamara } y lanza si no hay 3D. */
export async function abrirPalmaCamara(D, opc, { pantalla, video, lienzo }) {
  pantalla.hidden = false;
  let conCamara = true;
  try {
    P.stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
    video.srcObject = P.stream;
    video.hidden = false;
    await video.play().catch(() => {});
  } catch {
    conCamara = false;
    video.hidden = true;
  }
  try {
    P.r = new THREE.WebGLRenderer({ canvas: lienzo, antialias: true, alpha: true });
  } catch {
    cerrarPalmaCamara({ pantalla, video });
    throw new Error('Este celular no pudo abrir el 3D (WebGL).');
  }
  P.r.setPixelRatio(Math.min(devicePixelRatio, 2));
  P.r.setClearColor(0x000000, 0);
  P.escena = new THREE.Scene();
  P.cam = new THREE.PerspectiveCamera(55, 1, 0.01, 20);
  P.pivote = new THREE.Group();
  P.pivote.position.set(0, -0.11, -0.55);
  P.pivote.add(luz());
  P.escena.add(P.pivote);
  P.giro = 0; P.escala = 1; P.b0 = P.g0 = null; P.tilt = { x: 0, y: 0 };
  armar(D, opc);
  tamano();

  // Dedo: girar; dos dedos: agrandar
  const toques = new Map();
  let dist0 = 0, escala0 = 1;
  const abajo = e => { toques.set(e.pointerId, { x: e.clientX, y: e.clientY }); if (toques.size === 2) { const [a, b] = [...toques.values()]; dist0 = Math.hypot(a.x - b.x, a.y - b.y); escala0 = P.escala; } };
  const mueve = e => {
    const t = toques.get(e.pointerId);
    if (!t) return;
    if (toques.size === 1) P.giro += (e.clientX - t.x) * 0.012;
    toques.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (toques.size === 2 && dist0) { const [a, b] = [...toques.values()]; P.escala = Math.min(3, Math.max(0.4, escala0 * Math.hypot(a.x - b.x, a.y - b.y) / dist0)); }
  };
  const arriba = e => { toques.delete(e.pointerId); if (toques.size < 2) dist0 = 0; };
  const gira = e => {
    if (e.beta == null) return;
    if (P.b0 === null) { P.b0 = e.beta; P.g0 = e.gamma; }
    P.tilt = { x: THREE.MathUtils.degToRad(Math.max(-25, Math.min(25, e.beta - P.b0))) * 0.6, y: THREE.MathUtils.degToRad(Math.max(-25, Math.min(25, e.gamma - P.g0))) * 0.6 };
  };
  lienzo.addEventListener('pointerdown', abajo);
  lienzo.addEventListener('pointermove', mueve);
  lienzo.addEventListener('pointerup', arriba);
  lienzo.addEventListener('pointercancel', arriba);
  addEventListener('deviceorientation', gira);
  addEventListener('resize', tamano);
  P.quitar = [
    () => lienzo.removeEventListener('pointerdown', abajo), () => lienzo.removeEventListener('pointermove', mueve),
    () => lienzo.removeEventListener('pointerup', arriba), () => lienzo.removeEventListener('pointercancel', arriba),
    () => removeEventListener('deviceorientation', gira), () => removeEventListener('resize', tamano),
  ];
  P.r.setAnimationLoop(() => {
    const t = P.reloj.getElapsedTime();
    P.modelo?.userData.mats?.forEach(m => { m.uniforms.uTiempo.value = t; });
    P.pivote.rotation.set(0.35 + P.tilt.x, P.giro + t * 0.25 + P.tilt.y, 0);
    P.pivote.scale.setScalar(P.escala);
    P.r.render(P.escena, P.cam);
  });
  return { conCamara };
}

export function rayosPalmaCamara(D, opc) { if (P.r) armar(D, opc); }

export function cerrarPalmaCamara({ pantalla, video }) {
  P.quitar.forEach(f => f());
  P.quitar = [];
  P.r?.setAnimationLoop(null);
  P.r?.dispose();
  P.r = null; P.modelo = null;
  P.stream?.getTracks().forEach(t => t.stop());
  P.stream = null;
  if (video) video.srcObject = null;
  pantalla.hidden = true;
}
