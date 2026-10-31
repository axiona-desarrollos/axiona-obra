/* ==========================================================================
   AXIONA OBRA · AR Axiona (realidad aumentada propia)
   --------------------------------------------------------------------------
   No depende de que el celular traiga AR (ARCore, WebXR o Quick Look): usa
   solo la cámara del navegador, la visión propia de src/ar/vision y three.js.
   Tres modos:
   - Maqueta: la casa (o el condominio) se para sobre el marcador 0, en una
     mesa o en el piso, a 1:20, 1:50, 1:100 o 1:200.
   - En el lote: los marcadores 1, 2, 3… van en las esquinas P1, P2, P3… del
     lote, con la flecha hacia la esquina siguiente. La casa aparece a escala
     real en su sitio, con cualquiera de ellos que la cámara vea.
   - Sin marcador: con el giroscopio la casa queda quieta en el piso mientras
     se gira el celular (sin caminar).
   La lente se calibra sola cuando el marcador se ve inclinado.
   ========================================================================== */

import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { app, tr, toast, fm } from '../ui/comun.js';
import { ensure3D, buildScene, modeloParaLlevar, applyPhase, tres } from '../vista3d/escena.js';
import { condominioParaLlevar, condominioActivo } from '../vista3d/condominio3d.js';
import { intrinsecos, poseMarcador, homografia, esquinasMarcador, focalDeHomografia, FiltroEuro } from './vision/pose.js';
import { gris, detectar } from './vision/detector.js';
import { modeloAMarcadorLote } from './anclas.js';

const PREF = 'axiona-ar';
export function preferencias() {
  const base = { lado: 15, fov: 66 };
  try { return { ...base, ...JSON.parse(localStorage.getItem(PREF) || '{}') }; } catch { return base; }
}
export function guardarPreferencias(p) {
  try { localStorage.setItem(PREF, JSON.stringify({ ...preferencias(), ...p })); } catch { /* modo privado */ }
}

const ESCALAS = { maqueta: [1 / 50, 1 / 20, 1 / 100, 1 / 200], giro: [1, 1 / 20, 1 / 50], lote: [1] };
const FASES_AR = [{ i: 10, cat: 'dot' }, { i: 9, cat: 'blanca' }, { i: 6, cat: 'gris' }, { i: 5, cat: 'negra' }];
const PERDIDO_MS = 700;

// cámara de visión (x der, y abajo, z adelante) → cámara de three.js (x der, y arriba, z atrás)
const F = new THREE.Matrix4().makeScale(1, -1, -1);
// modelo (x, y arriba, z hacia el frente) → plano del marcador (x, y hacia el fondo, z arriba)
const AX = new THREE.Matrix4().set(1, 0, 0, 0, 0, 0, -1, 0, 0, 1, 0, 0, 0, 0, 0, 1);

const A = { activo: false };

const $id = id => document.getElementById(id);

function crearUI() {
  if ($id('axAR')) return;
  const d = document.createElement('div');
  d.id = 'axAR';
  d.hidden = true;
  d.innerHTML = `<video id="axARvideo" playsinline muted autoplay></video><canvas id="axARgl"></canvas>
    <div class="axar-top"><div><b id="axARestado"></b><span id="axARdet"></span></div><button class="axar-x" data-axar="salir" aria-label="${tr({ es: 'Salir de la realidad aumentada', en: 'Exit augmented reality' })}">×</button></div>
    <div class="axar-ayuda" id="axARayuda"></div>
    <div class="axar-bot">
      <div class="axar-modos" role="tablist">
        <button data-axar-modo="maqueta">${tr({ es: 'Maqueta', en: 'Table model' })}</button>
        <button data-axar-modo="lote">${tr({ es: 'En el lote', en: 'On the lot' })}</button>
        <button data-axar-modo="giro">${tr({ es: 'Sin marcador', en: 'No marker' })}</button>
      </div>
      <div class="axar-acc">
        <button data-axar="fase" id="axARfase"></button>
        <button data-axar="escala" id="axARescala"></button>
        <button data-axar="altura" id="axARaltura" hidden></button>
        <button data-axar="girar" aria-label="${tr({ es: 'Girar 15°', en: 'Rotate 15°' })}">↻ 15°</button>
        <button data-axar="foto">${tr({ es: 'Foto', en: 'Photo' })}</button>
      </div>
    </div>`;
  document.body.appendChild(d);
  d.addEventListener('click', e => {
    const m = e.target.closest('[data-axar-modo]')?.dataset.axarModo;
    if (m) return cambiarModo(m);
    const a = e.target.closest('[data-axar]')?.dataset.axar;
    if (a === 'salir') salirARAxiona();
    if (a === 'fase') { A.fase = (A.fase + 1) % FASES_AR.length; armarModelo(); }
    if (a === 'escala') { A.iEscala = (A.iEscala + 1) % ESCALAS[A.modo].length; aplicarEscala(); }
    if (a === 'altura') { A.ojo = A.ojo > 1 ? 0.45 : 1.4; pintarBotones(); }
    if (a === 'girar') { A.giro += Math.PI / 12; aplicarEscala(); }
    if (a === 'foto') foto();
  });
  conectarGestos(d);
}

/** Inicia la AR propia. modo: 'maqueta' | 'lote' | 'giro'. contenido: 'casa' | 'condo'. */
export async function iniciarARAxiona({ modo = 'maqueta', contenido = 'casa' } = {}) {
  if (A.activo) return;
  if (!navigator.mediaDevices?.getUserMedia) {
    toast(tr({ es: 'Este navegador no deja usar la cámara. Abre obra.axionasoft.com en Chrome, Safari o Firefox (con https).', en: 'This browser does not allow camera access. Open the site in Chrome, Safari or Firefox (https).' }));
    return;
  }
  if (!ensure3D()) return;
  if (app.threeDirty) buildScene();
  if (contenido === 'casa' && (!app.M || app.M.err)) { toast(tr({ es: 'Primero arregla el proyecto: el motor no pudo armar la casa.', en: 'Fix the project first: the engine could not build the house.' })); return; }
  // el permiso del giroscopio en iPhone tiene que pedirse dentro del toque
  if (modo === 'giro') await permisoGiroscopio();
  crearUI();
  const pref = preferencias();
  Object.assign(A, {
    activo: true, modo, contenido, fase: 0, iEscala: 0, giro: 0, ojo: 1.4, lado: pref.lado / 100, fov: pref.fov,
    focales: [], ocupado: false, n: 0, visto: 0, ultimo: null, pw: 640, ms: 0, ori: null, colocado: null,
  });
  const ov = $id('axAR');
  ov.hidden = false;
  document.body.classList.add('axar-on');
  pintar(tr({ es: 'Abriendo la cámara…', en: 'Opening the camera…' }));
  try {
    A.stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } } });
  } catch (e) {
    salirARAxiona();
    toast(e.name === 'NotAllowedError'
      ? tr({ es: 'Sin permiso para la cámara. Actívalo en el candado de la barra de direcciones y vuelve a intentar.', en: 'Camera permission denied. Enable it from the address bar lock and try again.' })
      : tr({ es: 'No se pudo abrir la cámara: ', en: 'Could not open the camera: ' }) + e.message);
    return;
  }
  const v = $id('axARvideo');
  v.srcObject = A.stream;
  await v.play().catch(() => {});
  await new Promise(r => (v.videoWidth ? r() : v.addEventListener('loadedmetadata', r, { once: true })));
  A.vw = v.videoWidth; A.vh = v.videoHeight;
  prepararVision();
  prepararEscena();
  armarModelo();
  cambiarModo(modo, true);
  A.raf = requestAnimationFrame(cuadro);
}

export function salirARAxiona() {
  if (!A.activo && !$id('axAR')) return;
  A.activo = false;
  cancelAnimationFrame(A.raf);
  A.stream?.getTracks().forEach(t => t.stop());
  A.stream = null;
  A.worker?.terminate(); A.worker = null;
  window.removeEventListener('deviceorientation', alOrientar);
  if (A.renderer) { A.renderer.dispose(); A.renderer.forceContextLoss?.(); A.renderer = null; }
  A.escena?.traverse(o => { if (o.userData?.propio) { o.geometry?.dispose(); o.material?.dispose?.(); } });
  A.escena = null; A.modelo = null;
  const ov = $id('axAR');
  if (ov) { ov.hidden = true; $id('axARvideo').srcObject = null; }
  document.body.classList.remove('axar-on');
  if (A.vistaPrevia) { app.phase = A.vistaPrevia.fase; app.viewFloor = A.vistaPrevia.piso; tres.sinTecho = A.vistaPrevia.sinTecho; applyPhase(); A.vistaPrevia = null; }
}

async function permisoGiroscopio() {
  const D = window.DeviceOrientationEvent;
  if (D && typeof D.requestPermission === 'function') {
    try { await D.requestPermission(); } catch { /* sin permiso: el modo avisa */ }
  }
}

/* ---------------------------------------------------------------- visión */

function prepararVision() {
  A.proc = document.createElement('canvas');
  A.ctx = A.proc.getContext('2d', { willReadFrequently: true });
  try {
    A.worker = new Worker(new URL('./vision/trabajador.js', import.meta.url), { type: 'module' });
    A.worker.onmessage = e => alDetectar(e.data);
    A.worker.onerror = () => { A.worker = null; A.ocupado = false; };
  } catch { A.worker = null; }
}

/** Intrínsecos del cuadro que se procesa (la lente se define por el lado largo). */
function K(pw, ph) {
  const largo = Math.max(pw, ph), f = (largo / 2) / Math.tan(A.fov * Math.PI / 360);
  return intrinsecos(pw, ph, 60, f);
}

function enviarCuadro() {
  const v = $id('axARvideo');
  if (A.ocupado || !v || v.readyState < 2) return;
  const pw = Math.min(A.pw, A.vw), ph = Math.round(A.vh * pw / A.vw);
  if (A.proc.width !== pw || A.proc.height !== ph) { A.proc.width = pw; A.proc.height = ph; }
  A.ctx.drawImage(v, 0, 0, pw, ph);
  const img = A.ctx.getImageData(0, 0, pw, ph);
  A.ocupado = true;
  const n = ++A.n;
  if (A.worker) A.worker.postMessage({ buf: img.data.buffer, w: pw, h: ph, n }, [img.data.buffer]);
  else setTimeout(() => {
    const t0 = performance.now(), g = gris(img.data, pw, ph);
    alDetectar({ n, w: pw, h: ph, marcadores: detectar(g, pw, ph), ms: performance.now() - t0 });
  }, 0);
}

function alDetectar({ w, h, marcadores, ms }) {
  A.ocupado = false;
  if (!A.activo) return;
  // la resolución se ajusta al celular: rápido = más lejos se ve el marcador
  A.ms = A.ms ? A.ms * 0.8 + ms * 0.2 : ms;
  if (A.ms > 45 && A.pw > 360) A.pw -= 80; else if (A.ms < 18 && A.pw < 800) A.pw += 80;
  if (A.modo === 'giro') return;
  const k = K(w, h);
  calibrarLente(marcadores, k);
  // en el lote solo cuentan los marcadores de las esquinas; en la maqueta, cualquiera
  const nv = app.M?.lot?.length || 0;
  const utiles = marcadores.filter(m => (A.modo === 'lote' ? m.id >= 1 && m.id <= nv : true)).sort((a, b) => b.lado - a.lado);
  const m = utiles[0];
  if (!m) { pintarDeteccion(null); return; }
  const p = poseMarcador(m.esquinas, A.lado, k);
  if (!p || p.error > 3) return;
  A.visto = performance.now();
  A.ultimo = { id: m.id, R: p.R, t: p.t, d: Math.hypot(...p.t) };
  ponerPose(p.R, p.t, A.modo === 'lote' ? matrizLote(m.id) : null);
  pintarDeteccion(A.ultimo);
}

/** Junta focales de los marcadores bien inclinados y fija la lente con la mediana. */
function calibrarLente(marcadores, k) {
  marcadores.forEach(m => {
    const H = homografia(esquinasMarcador(A.lado).map(p => [p[0], p[1]]), m.esquinas);
    const f = H && focalDeHomografia(H, k.cx, k.cy);
    if (!f || m.lado < 40) return;
    const fov = 2 * Math.atan((Math.max(k.w, k.h) / 2) / f) * 180 / Math.PI;
    if (fov > 35 && fov < 100) A.focales.push(fov);
  });
  if (A.focales.length > 40) A.focales.splice(0, A.focales.length - 40);
  if (A.focales.length >= 12) {
    const o = [...A.focales].sort((a, b) => a - b), med = o[o.length >> 1];
    if (Math.abs(med - A.fov) > 1.5) { A.fov = med; A.calibrada = true; guardarPreferencias({ fov: +med.toFixed(1) }); ajustarCamara(); }
  }
}

/* ---------------------------------------------------------------- escena */

function prepararEscena() {
  const c = $id('axARgl');
  const r = new THREE.WebGLRenderer({ canvas: c, alpha: true, antialias: true, preserveDrawingBuffer: true });
  r.setPixelRatio(1);
  const lw = Math.min(A.vw, 1280), lh = Math.round(A.vh * lw / A.vw);
  r.setSize(lw, lh, false);
  r.toneMapping = THREE.ACESFilmicToneMapping;
  r.shadowMap.enabled = true;
  r.shadowMap.type = THREE.PCFSoftShadowMap;
  A.renderer = r;
  const s = new THREE.Scene();
  const pm = new THREE.PMREMGenerator(r);
  s.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
  s.environmentIntensity = 0.6;
  s.add(new THREE.HemisphereLight(0xffffff, 0x50463a, 1.1));
  A.escena = s;
  A.camara = new THREE.PerspectiveCamera(50, A.vw / A.vh, 0.005, 2000);
  A.ancla = new THREE.Group();
  A.ancla.matrixAutoUpdate = false;
  A.ancla.visible = false;
  s.add(A.ancla);
  A.filtroP = new FiltroEuro({ minCorte: 1.5, beta: 0.4 });
  A.filtroQ = new FiltroEuro({ minCorte: 1.5, beta: 0.4 });
  ajustarCamara();
}

function ajustarCamara() {
  if (!A.camara) return;
  const fovV = A.vw >= A.vh
    ? 2 * Math.atan(Math.tan(A.fov * Math.PI / 360) * A.vh / A.vw) * 180 / Math.PI
    : A.fov;
  A.camara.fov = fovV;
  A.camara.aspect = A.vw / A.vh;
  A.camara.updateProjectionMatrix();
}

function armarModelo() {
  if (A.modelo) { A.ancla.remove(A.modelo); A.modelo = null; }
  let m;
  if (A.contenido === 'condo' && condominioActivo()) m = condominioParaLlevar(1);
  else {
    if (!A.vistaPrevia) A.vistaPrevia = { fase: app.phase, piso: app.viewFloor, sinTecho: tres.sinTecho };
    app.phase = FASES_AR[A.fase].i; app.viewFloor = 99; tres.sinTecho = false;
    applyPhase();
    m = modeloParaLlevar(1);
  }
  if (!m) return;
  // lo que queda bajo el piso (zapatas, vigas de cimentación) no se ve a través de la mesa
  m.updateMatrixWorld(true);
  const bb = new THREE.Box3(), bajo = [];
  m.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; if (bb.setFromObject(o).max.y < 0.02) bajo.push(o); } });
  bajo.forEach(o => { o.visible = false; });
  // tamaño del modelo para la sombra y el piso que la recibe
  const caja = new THREE.Box3().setFromObject(m), tam = caja.getSize(new THREE.Vector3());
  A.radio = Math.max(tam.x, tam.z, 4) / 2;
  A.prof = tam.z;
  const piso = new THREE.Mesh(new THREE.PlaneGeometry(A.radio * 3.2, A.radio * 3.2).rotateX(-Math.PI / 2), new THREE.ShadowMaterial({ opacity: 0.3 }));
  piso.receiveShadow = true; piso.position.y = 0.01; piso.userData.propio = true;
  const sol = new THREE.DirectionalLight(0xfff2e0, 2.2);
  sol.position.set(A.radio * 0.8, A.radio * 2.2, A.radio * 1.1);
  sol.castShadow = true; sol.shadow.mapSize.set(1024, 1024); sol.shadow.bias = -0.0005;
  const g = new THREE.Group();
  g.add(m, piso, sol, sol.target);
  A.modelo = g;
  A.sol = sol;
  A.ancla.add(g);
  aplicarEscala();
  pintarBotones();
}

function escala() { return ESCALAS[A.modo][A.iEscala % ESCALAS[A.modo].length] * (A.zoom || 1); }

function aplicarEscala() {
  if (!A.modelo) return;
  const e = A.modo === 'lote' ? 1 : escala();
  A.modelo.scale.setScalar(e);
  A.modelo.rotation.y = A.modo === 'lote' ? 0 : A.giro;
  // la cámara de la sombra mide en la escena, no en el modelo: va a la escala del modelo
  const cs = A.sol.shadow.camera, r = A.radio * 1.6 * e;
  Object.assign(cs, { left: -r, right: r, top: r, bottom: -r, near: 0.01 * e, far: A.radio * 8 * e });
  cs.updateProjectionMatrix();
  pintarBotones();
}

/** Coloca el ancla con la pose del marcador (R, t de visión) y la matriz modelo→marcador. */
function ponerPose(R, t, B) {
  const T = new THREE.Matrix4().set(R[0][0], R[0][1], R[0][2], t[0], R[1][0], R[1][1], R[1][2], t[1], R[2][0], R[2][1], R[2][2], t[2], 0, 0, 0, 1);
  const rig = new THREE.Matrix4().multiplyMatrices(F, T).multiply(AX);
  const p = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3();
  rig.decompose(p, q, s);
  const ahora = performance.now() / 1000;
  if (A.qPrev && q.dot(A.qPrev) < 0) q.set(-q.x, -q.y, -q.z, -q.w);
  const pf = A.filtroP.filtrar([p.x, p.y, p.z], ahora), qf = A.filtroQ.filtrar([q.x, q.y, q.z, q.w], ahora);
  const qn = new THREE.Quaternion(qf[0], qf[1], qf[2], qf[3]).normalize();
  A.qPrev = qn.clone();
  const M = new THREE.Matrix4().compose(new THREE.Vector3(...pf), qn, new THREE.Vector3(1, 1, 1));
  if (B) M.multiply(B);
  A.ancla.matrix.copy(M);
  A.ancla.matrixWorldNeedsUpdate = true;
  A.ancla.visible = true;
}

/** Modelo → marcador k de una esquina; ponerPose ya multiplicó por AX, así que se deshace. */
function matrizLote(k) {
  return new THREE.Matrix4().copy(AX).invert().multiply(modeloAMarcadorLote(app.M, k));
}

/* ---------------------------------------------------------------- giroscopio */

function alOrientar(e) { if (e.alpha != null) A.ori = { a: e.alpha, b: e.beta, g: e.gamma }; }

function camaraGiroscopio() {
  const o = A.ori;
  if (!o) return false;
  const rad = Math.PI / 180, ang = (window.screen?.orientation?.angle ?? window.orientation ?? 0) * rad;
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(o.b * rad, o.a * rad, -o.g * rad, 'YXZ'));
  q.multiply(new THREE.Quaternion(-Math.SQRT1_2, 0, 0, Math.SQRT1_2));
  q.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), -ang));
  A.camara.quaternion.copy(q);
  A.camara.position.set(0, A.ojo, 0);
  A.camara.updateMatrixWorld();
  return true;
}

/** Pone la casa donde el rayo de la pantalla (x, y en −1..1) toca el piso. */
function colocarEnPiso(nx = 0, ny = 0) {
  const ray = new THREE.Raycaster();
  ray.setFromCamera(new THREE.Vector2(nx, ny), A.camara);
  const d = ray.ray.direction;
  if (d.y > -0.05) { pintar(tr({ es: 'Apunta un poco más hacia el piso y toca para poner la casa.', en: 'Point a bit lower at the floor and tap to place the house.' })); return; }
  const t = Math.min(40, -A.ojo / d.y);
  const p = ray.ray.origin.clone().addScaledVector(d, t);
  p.y = 0;
  // la casa mira hacia quien la pone; a escala real la fachada queda donde se tocó y la casa se extiende hacia atrás
  const yaw = Math.atan2(A.camara.position.x - p.x, A.camara.position.z - p.z);
  const e = escala(), dist = p.distanceTo(new THREE.Vector3(A.camara.position.x, 0, A.camara.position.z));
  if (e > 0.5) p.add(new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw)).multiplyScalar((A.prof || 10) * e / 2 + 0.3));
  A.colocado = { p, yaw, dist };
  A.ancla.matrix.compose(p, new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw), new THREE.Vector3(1, 1, 1));
  A.ancla.matrixWorldNeedsUpdate = true;
  A.ancla.visible = true;
}

/* ---------------------------------------------------------------- modos y UI */

function cambiarModo(m, inicio = false) {
  if (m === 'lote' && A.contenido === 'condo') m = 'maqueta';
  A.modo = m; A.iEscala = 0; A.zoom = 1; A.ancla.visible = false; A.ultimo = null; A.colocado = null;
  A.filtroP.reiniciar(); A.filtroQ.reiniciar(); A.qPrev = null;
  A.camara.position.set(0, 0, 0); A.camara.quaternion.identity(); A.camara.updateMatrixWorld();
  window.removeEventListener('deviceorientation', alOrientar);
  if (m === 'giro') {
    if (!inicio) permisoGiroscopio();
    window.addEventListener('deviceorientation', alOrientar);
    A.giroDesde = performance.now();
  }
  document.querySelectorAll('[data-axar-modo]').forEach(b => b.setAttribute('aria-selected', b.dataset.axarModo === m));
  aplicarEscala();
  ayuda();
}

function ayuda() {
  const n = app.M?.lot?.length || 0;
  const txt = {
    maqueta: tr({ es: 'Pon el marcador 0 sobre una mesa y apúntale con la cámara. La flecha del papel apunta al fondo de la casa. Arrastra para girarla y pellizca para agrandarla.', en: 'Put marker 0 on a table and point the camera at it. The arrow points to the back of the house. Drag to rotate, pinch to resize.' }),
    lote: tr({ es: `En el lote: pon el marcador 1 con su centro sobre la estaca de P1 y la flecha hacia P2 (y si quieres el 2 en P2 hacia P3, hasta el ${n}). La casa aparece a escala real; aléjate 2 a 6 m.`, en: `On the lot: place marker 1 centred on the P1 stake with the arrow toward P2 (optionally 2 on P2 toward P3, up to ${n}). The house appears at full scale; step back 2–6 m.` }),
    giro: tr({ es: 'Sin marcador: apunta al piso y toca donde quieres la casa. Gira el celular para mirarla; no camines, porque sin marcador no se puede seguir el paso.', en: 'No marker: point at the floor and tap where you want the house. Turn the phone to look around; don’t walk, without a marker steps can’t be tracked.' }),
  }[A.modo];
  $id('axARayuda').textContent = txt;
}

function pintar(t) { const e = $id('axARestado'); if (e) e.textContent = t; }

function pintarDeteccion(u) {
  if (!u) return;
  const lente = `${tr({ es: 'lente', en: 'lens' })} ${Math.round(A.fov)}°${A.calibrada ? ' ✓' : ''}`;
  const que = A.modo === 'lote' ? tr({ es: `Esquina P${u.id}`, en: `Corner P${u.id}` }) : tr({ es: `Marcador ${u.id}`, en: `Marker ${u.id}` });
  pintar(`${que} · ${fm(u.d, 2)} m`);
  $id('axARdet').textContent = ` · ${lente} · ${A.pw}px · ${Math.round(A.ms)} ms`;
}

function pintarBotones() {
  const f = $id('axARfase'), e = $id('axARescala'), h = $id('axARaltura');
  if (!f) return;
  const nombres = { dot: tr({ es: 'Amoblada', en: 'Furnished' }), blanca: tr({ es: 'Terminada', en: 'Finished' }), gris: tr({ es: 'Obra gris', en: 'Rough' }), negra: tr({ es: 'Obra negra', en: 'Structure' }) };
  f.textContent = `${tr({ es: 'Fase', en: 'Phase' })}: ${nombres[FASES_AR[A.fase].cat]}`;
  f.hidden = A.contenido === 'condo';
  const es = ESCALAS[A.modo][A.iEscala % ESCALAS[A.modo].length];
  e.textContent = es === 1 ? tr({ es: 'Escala real', en: 'Full scale' }) : `1:${Math.round(1 / es)}`;
  e.hidden = A.modo === 'lote';
  h.hidden = A.modo !== 'giro';
  h.textContent = A.ojo > 1 ? tr({ es: 'De pie', en: 'Standing' }) : tr({ es: 'Sobre una mesa', en: 'Over a table' });
}

function cuadro() {
  if (!A.activo) return;
  A.raf = requestAnimationFrame(cuadro);
  const ahora = performance.now();
  if (A.modo === 'giro') {
    const ok = camaraGiroscopio();
    if (!ok && ahora - A.giroDesde > 1500) pintar(tr({ es: 'Este equipo no tiene giroscopio: usa la maqueta con marcador.', en: 'No gyroscope on this device: use the table model with a marker.' }));
    else if (ok && !A.colocado) pintar(tr({ es: 'Apunta al piso y toca para poner la casa', en: 'Point at the floor and tap to place the house' }));
    else if (A.colocado) pintar(tr({ es: `Casa a ${fm(A.colocado.dist, 1)} m · gira el celular para verla`, en: `House ${fm(A.colocado.dist, 1)} m away · turn the phone to look` }));
  } else {
    enviarCuadro();
    if (A.ancla.visible && ahora - A.visto > PERDIDO_MS) { A.ancla.visible = false; A.filtroP.reiniciar(); A.filtroQ.reiniciar(); A.qPrev = null; }
    if (!A.ancla.visible) pintar(A.modo === 'lote' ? tr({ es: 'Buscando el marcador de una esquina…', en: 'Looking for a corner marker…' }) : tr({ es: 'Buscando el marcador…', en: 'Looking for the marker…' }));
  }
  const ay = $id('axARayuda');
  if (ay) ay.hidden = A.ancla.visible;
  A.renderer.render(A.escena, A.camara);
}

/* ---------------------------------------------------------------- gestos y foto */

function conectarGestos(d) {
  const pts = new Map();
  let base = null, toque = null;
  const dentroUI = e => e.target.closest('button, .axar-top, .axar-bot');
  d.addEventListener('pointerdown', e => {
    if (dentroUI(e) || !A.activo) return;
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    toque = pts.size === 1 ? { x: e.clientX, y: e.clientY, t: performance.now() } : null;
    if (pts.size === 2) { const [a, b] = [...pts.values()]; base = { d: Math.hypot(a.x - b.x, a.y - b.y), zoom: A.zoom || 1 }; }
  });
  d.addEventListener('pointermove', e => {
    if (!pts.has(e.pointerId)) return;
    const prev = pts.get(e.pointerId);
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pts.size === 1 && A.modo !== 'lote') { A.giro += (e.clientX - prev.x) * 0.01; aplicarEscala(); }
    if (pts.size === 2 && base && A.modo !== 'lote') {
      const [a, b] = [...pts.values()];
      A.zoom = Math.max(0.2, Math.min(5, base.zoom * Math.hypot(a.x - b.x, a.y - b.y) / base.d));
      aplicarEscala();
    }
  });
  const fin = e => {
    if (toque && A.modo === 'giro' && Math.hypot(e.clientX - toque.x, e.clientY - toque.y) < 8 && performance.now() - toque.t < 400) {
      const [nx, ny] = aNDC(e.clientX, e.clientY);
      colocarEnPiso(nx, ny);
    }
    pts.delete(e.pointerId); toque = null; if (pts.size < 2) base = null;
  };
  d.addEventListener('pointerup', fin);
  d.addEventListener('pointercancel', fin);
}

/** Toque en pantalla → coordenadas del cuadro de la cámara (−1..1), con el recorte del video. */
function aNDC(x, y) {
  const r = $id('axAR').getBoundingClientRect(), s = Math.max(r.width / A.vw, r.height / A.vh);
  const ox = (r.width - A.vw * s) / 2, oy = (r.height - A.vh * s) / 2;
  const u = (x - r.left - ox) / s, v = (y - r.top - oy) / s;
  return [2 * u / A.vw - 1, 1 - 2 * v / A.vh];
}

function foto() {
  const c = document.createElement('canvas');
  c.width = A.vw; c.height = A.vh;
  const x = c.getContext('2d');
  x.drawImage($id('axARvideo'), 0, 0, A.vw, A.vh);
  A.renderer.render(A.escena, A.camara);
  x.drawImage(A.renderer.domElement, 0, 0, A.vw, A.vh);
  x.fillStyle = 'rgba(0,0,0,.45)'; x.fillRect(0, A.vh - 34, A.vw, 34);
  x.fillStyle = '#fff'; x.font = '600 16px sans-serif';
  x.fillText(`Axiona Obra · ${app.S?.nombre || ''} · obra.axionasoft.com`, 12, A.vh - 12);
  c.toBlob(b => {
    if (!b) return;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(b); a.download = 'axiona-ar.jpg';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    toast(tr({ es: 'Foto guardada.', en: 'Photo saved.' }));
  }, 'image/jpeg', 0.9);
}

/** Lo que la prueba de navegador y Axi necesitan saber del estado. */
export function estadoAR() {
  return { activo: !!A.activo, modo: A.modo, visible: !!A.ancla?.visible, marcador: A.ultimo?.id ?? null, distancia: A.ultimo?.d ?? null, fov: A.fov, calibrada: !!A.calibrada, pw: A.pw };
}
