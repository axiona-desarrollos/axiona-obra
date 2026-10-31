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
     se gira el celular (sin caminar). Si el celular no tiene giroscopio
     (varios Android económicos), pasa solo a la vista fija: la casa queda
     delante de la cámara y se gira y agranda con los dedos.
   La lente se calibra sola cuando el marcador se ve inclinado.
   Si algo falla (navegador interno de una app, permiso, cámara sin imagen,
   gráficos), lo dice en pantalla con qué hacer, y ofrece «Probar mi celular».
   ========================================================================== */

import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { app, tr, toast, fm } from '../ui/comun.js';
import { ensure3D, buildScene, modeloParaLlevar, applyPhase, tres } from '../vista3d/escena.js';
import { condominioParaLlevar, condominioActivo } from '../vista3d/condominio3d.js';
import { intrinsecos, poseMarcador, homografia, esquinasMarcador, focalDeHomografia, FiltroEuro } from './vision/pose.js';
import { gris, detectar } from './vision/detector.js';
import { modeloAMarcadorLote } from './anclas.js';
import { abrirCamara, consejoCamara, navegadorInterno, enlaceChrome } from './diagnostico.js';

const PREF = 'axiona-ar';
export function preferencias() {
  const base = { lado: 15, fov: 66 };
  try { return { ...base, ...JSON.parse(localStorage.getItem(PREF) || '{}') }; } catch { return base; }
}
export function guardarPreferencias(p) {
  try { localStorage.setItem(PREF, JSON.stringify({ ...preferencias(), ...p })); } catch { /* modo privado */ }
}

const ESCALAS = { maqueta: [1 / 50, 1 / 20, 1 / 100, 1 / 200], giro: [1, 1 / 20, 1 / 50], lote: [1], fija: [1 / 50, 1 / 20, 1 / 100] };
const FASES_AR = [{ i: 10, cat: 'dot' }, { i: 9, cat: 'blanca' }, { i: 6, cat: 'gris' }, { i: 5, cat: 'negra' }];
const PERDIDO_MS = 700;
const AYUDA_SIN_MARCADOR_MS = 6000;   // sin marcador a la vista tanto tiempo: se ofrece verla sin marcador
const TRABAJADOR_MS = 2500;           // si el trabajador no responde, se detecta en la pantalla

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
    <div class="axar-panel" id="axARsin" hidden>
      <b>${tr({ es: '¿No tienes el marcador a mano?', en: 'No marker at hand?' })}</b>
      <p>${tr({ es: 'Puedes ver la casa sin marcador ahora mismo. Para la maqueta, abre obra.axionasoft.com en otra pantalla › AR › «Mostrar el marcador aquí», o imprime el PDF de marcadores.', en: 'You can see the house without a marker right now. For the table model, open obra.axionasoft.com on another screen › AR › “Show the marker here”, or print the markers PDF.' })}</p>
      <div class="axar-fila"><button class="pri" data-axar-modo="giro">${tr({ es: 'Ver sin marcador', en: 'View without marker' })}</button><button data-axar="cerrarSin">${tr({ es: 'Seguir buscando', en: 'Keep looking' })}</button></div>
    </div>
    <div class="axar-panel axar-fallo" id="axARfallo" hidden role="alertdialog" aria-live="assertive">
      <b id="axARfalloT"></b><p id="axARfalloP"></p>
      <div class="axar-fila" id="axARfalloA"></div>
    </div>
    <div class="axar-bot">
      <div class="axar-modos" role="tablist">
        <button data-axar-modo="giro">${tr({ es: 'Sin marcador', en: 'No marker' })}</button>
        <button data-axar-modo="maqueta">${tr({ es: 'Maqueta', en: 'Table model' })}</button>
        <button data-axar-modo="lote">${tr({ es: 'En el lote', en: 'On the lot' })}</button>
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
    if (a === 'reintentar') { const o = { modo: A.modo === 'fija' ? 'giro' : (A.modo || 'giro'), contenido: A.contenido || 'casa' }; salirARAxiona(); iniciarARAxiona(o); }
    if (a === 'diagnostico') { salirARAxiona(); A.alDiagnostico?.(); }
    if (a === 'cerrarSin') { $id('axARsin').hidden = true; A.sinCerrado = true; }
    if (a === 'fase') { A.fase = (A.fase + 1) % FASES_AR.length; armarModelo(); }
    if (a === 'escala') { A.iEscala = (A.iEscala + 1) % ESCALAS[A.modo].length; aplicarEscala(); if (A.modo === 'fija') ponerFija(); }
    if (a === 'altura') { A.ojo = A.ojo > 1 ? 0.45 : 1.4; pintarBotones(); }
    if (a === 'girar') { A.giro += Math.PI / 12; aplicarEscala(); }
    if (a === 'foto') foto();
  });
  conectarGestos(d);
}

/** Inicia la AR propia. modo: 'giro' | 'maqueta' | 'lote'. contenido: 'casa' | 'condo'. */
export async function iniciarARAxiona({ modo = 'giro', contenido = 'casa', alDiagnostico = null } = {}) {
  if (A.activo) return;
  if (alDiagnostico) A.alDiagnostico = alDiagnostico;
  const ua = navigator.userAgent, android = /Android/.test(ua), ios = /iP(hone|ad|od)/.test(ua);
  crearUI();
  const ov = $id('axAR');
  ov.hidden = false;
  document.body.classList.add('axar-on');
  Object.assign(A, { activo: true, modo, contenido });
  // el permiso del giroscopio en iPhone tiene que pedirse dentro del toque, antes de cualquier espera
  const permisoGiro = modo === 'giro' ? permisoGiroscopio() : null;
  // dentro de Instagram, Facebook o TikTok la cámara no se puede usar: se ofrece abrir la página en el navegador
  const interno = navegadorInterno(ua);
  if (interno) {
    return fallo(tr({ es: 'Abre la página en tu navegador', en: 'Open the page in your browser' }), tr(consejoCamara('', { android, ios, interno })),
      [android ? ['chrome', tr({ es: 'Abrir en Chrome', en: 'Open in Chrome' })] : null, ['copiar', tr({ es: 'Copiar el enlace', en: 'Copy the link' })], ['salir', tr({ es: 'Cerrar', en: 'Close' })]]);
  }
  if (!ensure3D()) {
    return fallo(tr({ es: 'Este navegador no pudo iniciar los gráficos 3D', en: 'This browser could not start 3D graphics' }),
      tr({ es: 'Actualiza Chrome desde la Play Store y vuelve a intentar. Si usas el Navegador Mi u otro, prueba en Chrome.', en: 'Update Chrome from the Play Store and try again. If you use Mi Browser or another one, try Chrome.' }),
      [['diagnostico', tr({ es: 'Probar mi celular', en: 'Test my phone' })], ['salir', tr({ es: 'Cerrar', en: 'Close' })]]);
  }
  if (app.threeDirty) buildScene();
  if (contenido === 'casa' && (!app.M || app.M.err)) { salirARAxiona(); toast(tr({ es: 'Primero arregla el proyecto: el motor no pudo armar la casa.', en: 'Fix the project first: the engine could not build the house.' })); return; }
  await permisoGiro;
  const pref = preferencias();
  Object.assign(A, {
    fase: 0, iEscala: 0, giro: 0, ojo: 1.4, lado: pref.lado / 100, fov: pref.fov, sinCerrado: false, desde: performance.now(),
    focales: [], ocupado: false, n: 0, visto: 0, nunca: true, ultimo: null, pw: 640, ms: 0, ori: null, colocado: null,
  });
  ocultarPaneles();
  pintar(tr({ es: 'Abriendo la cámara…', en: 'Opening the camera…' }));
  const v = $id('axARvideo');
  try {
    const c = await abrirCamara(v, { alIntentar: i => { if (i) pintar(tr({ es: `Probando otra cámara (${i + 1})…`, en: `Trying another camera (${i + 1})…` })); } });
    A.stream = c.stream; A.vw = c.ancho; A.vh = c.alto;
  } catch (e) {
    if (!A.activo) return;
    return fallo(tr({ es: 'No se pudo abrir la cámara', en: 'Could not open the camera' }), tr(consejoCamara(e.name, { android, ios })),
      [['reintentar', tr({ es: 'Reintentar', en: 'Try again' })], ['diagnostico', tr({ es: 'Probar mi celular', en: 'Test my phone' })], ['salir', tr({ es: 'Cerrar', en: 'Close' })]]);
  }
  if (!A.activo) { A.stream?.getTracks().forEach(t => t.stop()); return; }
  prepararVision();
  // los gráficos: primero con sombras y suavizado; si el celular no puede, en liviano
  for (const liviano of [false, true]) {
    try { prepararEscena(liviano); armarModelo(); break; } catch (e) {
      console.error('[ar] escena', liviano ? 'liviana' : 'completa', e);
      A.renderer?.dispose(); A.renderer = null;
      if (liviano) {
        return fallo(tr({ es: 'Los gráficos 3D fallaron en este celular', en: '3D graphics failed on this phone' }),
          tr({ es: 'Cierra otras pestañas y apps, y vuelve a intentar. Si sigue, usa «Probar mi celular» y envíanos el resultado.', en: 'Close other tabs and apps and try again. If it persists, use “Test my phone” and send us the result.' }),
          [['reintentar', tr({ es: 'Reintentar', en: 'Try again' })], ['diagnostico', tr({ es: 'Probar mi celular', en: 'Test my phone' })], ['salir', tr({ es: 'Cerrar', en: 'Close' })]]);
      }
    }
  }
  cambiarModo(modo, true);
  A.raf = requestAnimationFrame(cuadro);
}

/** Muestra una falla en la pantalla de la AR, con qué hacer. acciones: [[id, texto]]. */
function fallo(titulo, texto, acciones = []) {
  cancelAnimationFrame(A.raf);
  A.stream?.getTracks().forEach(t => t.stop()); A.stream = null;
  pintar('');
  $id('axARayuda').hidden = true; $id('axARsin').hidden = true;
  $id('axARfalloT').textContent = titulo;
  $id('axARfalloP').textContent = texto;
  $id('axARfalloA').innerHTML = acciones.filter(Boolean).map(([id, t], i) => `<button class="${i ? '' : 'pri'}" data-axar="${id}">${t}</button>`).join('');
  $id('axARfallo').hidden = false;
  const ch = $id('axARfalloA').querySelector('[data-axar="chrome"]');
  if (ch) ch.addEventListener('click', () => { location.href = enlaceChrome(location.href); });
  const cp = $id('axARfalloA').querySelector('[data-axar="copiar"]');
  if (cp) cp.addEventListener('click', async () => { try { await navigator.clipboard.writeText(location.href); toast(tr({ es: 'Enlace copiado: pégalo en Chrome o Safari.', en: 'Link copied: paste it in Chrome or Safari.' })); } catch { prompt('obra.axionasoft.com', location.href); } });
}

function ocultarPaneles() {
  for (const id of ['axARfallo', 'axARsin']) { const e = $id(id); if (e) e.hidden = true; }
}

export function salirARAxiona() {
  if (!A.activo && !$id('axAR')) return;
  A.activo = false;
  cancelAnimationFrame(A.raf);
  ocultarPaneles();
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
  A.camara = null;
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
    A.worker.onerror = () => { A.worker?.terminate(); A.worker = null; A.ocupado = false; };
  } catch { A.worker = null; }
}

/** Intrínsecos del cuadro que se procesa (la lente se define por el lado largo). */
function K(pw, ph) {
  const largo = Math.max(pw, ph), f = (largo / 2) / Math.tan(A.fov * Math.PI / 360);
  return intrinsecos(pw, ph, 60, f);
}

function enviarCuadro() {
  const v = $id('axARvideo');
  // si el trabajador no responde (algunos navegadores no cargan trabajadores de módulo), se detecta en la pantalla
  if (A.ocupado && A.worker && performance.now() - A.enviado > TRABAJADOR_MS) { A.worker.terminate(); A.worker = null; A.ocupado = false; }
  if (A.ocupado || !v || v.readyState < 2 || !A.vw) return;
  const pw = Math.min(A.pw, A.vw), ph = Math.round(A.vh * pw / A.vw);
  if (A.proc.width !== pw || A.proc.height !== ph) { A.proc.width = pw; A.proc.height = ph; }
  A.ctx.drawImage(v, 0, 0, pw, ph);
  const img = A.ctx.getImageData(0, 0, pw, ph);
  A.ocupado = true;
  A.enviado = performance.now();
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
  A.nunca = false;
  $id('axARsin').hidden = true;
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

function prepararEscena(liviano = false) {
  // un lienzo nuevo cada vez: si el contexto anterior se perdió, no se puede reusar
  const viejo = $id('axARgl'), c = document.createElement('canvas');
  c.id = 'axARgl';
  viejo.replaceWith(c);
  const r = new THREE.WebGLRenderer({ canvas: c, alpha: true, antialias: !liviano, preserveDrawingBuffer: true, powerPreference: liviano ? 'low-power' : 'default' });
  r.setPixelRatio(1);
  const lw = Math.min(A.vw, liviano ? 960 : 1280), lh = Math.round(A.vh * lw / A.vw);
  r.setSize(lw, lh, false);
  r.toneMapping = THREE.ACESFilmicToneMapping;
  r.shadowMap.enabled = !liviano;
  r.shadowMap.type = THREE.PCFSoftShadowMap;
  A.renderer = r;
  A.liviano = liviano;
  c.addEventListener('webglcontextlost', e => {
    e.preventDefault();
    if (!A.activo) return;
    fallo(tr({ es: 'Los gráficos se reiniciaron', en: 'Graphics were reset' }), tr({ es: 'El celular liberó memoria de los gráficos. Toca «Reintentar».', en: 'The phone freed graphics memory. Tap “Try again”.' }),
      [['reintentar', tr({ es: 'Reintentar', en: 'Try again' })], ['salir', tr({ es: 'Cerrar', en: 'Close' })]]);
  });
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
  sol.castShadow = !A.liviano; sol.shadow.mapSize.set(1024, 1024); sol.shadow.bias = -0.0005;
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

// sin brújula (alpha nulo) igual sirve la inclinación: la casa queda quieta al mirar arriba y abajo
function alOrientar(e) { if (e.beta != null) A.ori = { a: e.alpha ?? 0, b: e.beta, g: e.gamma ?? 0 }; }

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

/** Vista fija: sin giroscopio ni marcador, la casa queda delante de la cámara, como sobre una mesa. */
function ponerFija() {
  A.camara.position.set(0, 0, 0); A.camara.quaternion.identity(); A.camara.updateMatrixWorld();
  // lo que se ve de la cámara en la pantalla (el video se recorta para llenarla)
  const r = $id('axAR').getBoundingClientRect(), asp = A.vw / A.vh, pant = (r.width || 1) / (r.height || 1);
  const fx = Math.min(1, pant / asp), fy = Math.min(1, asp / pant);
  const tv = Math.tan(A.camara.fov * Math.PI / 360), th = tv * asp;
  // lado mayor de la casa a 1:50; el pellizco y el botón de escala la agrandan desde ahí
  const ancho = 2 * (A.radio || 8) * ESCALAS.fija[0];
  // que ocupe el 75 % del ancho visible y no más del 60 % del alto
  const d = Math.max(0.12, ancho / (0.75 * 2 * th * fx), ancho * 0.6 / (0.6 * 2 * tv * fy));
  const p = new THREE.Vector3(0, -d * tv * fy * 0.25, -d);
  A.ancla.matrix.compose(p, new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), 0.5), new THREE.Vector3(1, 1, 1));
  A.ancla.matrixWorldNeedsUpdate = true;
  A.ancla.visible = true;
}

function cambiarModo(m, inicio = false) {
  if (m === 'lote' && A.contenido === 'condo') m = 'maqueta';
  if (!A.camara) return;
  $id('axARsin').hidden = true; A.sinCerrado = m !== 'maqueta' && m !== 'lote' ? A.sinCerrado : false; A.desde = performance.now();
  A.modo = m; A.iEscala = 0; A.zoom = 1; A.ancla.visible = false; A.ultimo = null; A.colocado = null;
  A.filtroP.reiniciar(); A.filtroQ.reiniciar(); A.qPrev = null;
  A.camara.position.set(0, 0, 0); A.camara.quaternion.identity(); A.camara.updateMatrixWorld();
  window.removeEventListener('deviceorientation', alOrientar);
  if (m === 'giro') {
    if (!inicio) permisoGiroscopio();
    window.addEventListener('deviceorientation', alOrientar);
    A.giroDesde = performance.now();
  }
  document.querySelectorAll('[data-axar-modo]').forEach(b => b.setAttribute('aria-selected', b.dataset.axarModo === (m === 'fija' ? 'giro' : m)));
  aplicarEscala();
  if (m === 'fija') ponerFija();
  ayuda();
}

function ayuda() {
  const n = app.M?.lot?.length || 0;
  const txt = {
    maqueta: tr({ es: 'Pon el marcador 0 sobre una mesa y apúntale con la cámara. La flecha del papel apunta al fondo de la casa. Arrastra para girarla y pellizca para agrandarla.', en: 'Put marker 0 on a table and point the camera at it. The arrow points to the back of the house. Drag to rotate, pinch to resize.' }),
    lote: tr({ es: `En el lote: pon el marcador 1 con su centro sobre la estaca de P1 y la flecha hacia P2 (y si quieres el 2 en P2 hacia P3, hasta el ${n}). La casa aparece a escala real; aléjate 2 a 6 m.`, en: `On the lot: place marker 1 centred on the P1 stake with the arrow toward P2 (optionally 2 on P2 toward P3, up to ${n}). The house appears at full scale; step back 2–6 m.` }),
    giro: tr({ es: 'Sin marcador: apunta al piso y toca donde quieres la casa. Gira el celular para mirarla; no camines, porque sin marcador no se puede seguir el paso.', en: 'No marker: point at the floor and tap where you want the house. Turn the phone to look around; don’t walk, without a marker steps can’t be tracked.' }),
    fija: tr({ es: 'Vista fija: este celular no tiene giroscopio, así que la casa queda delante de la cámara. Arrastra para girarla y pellizca para agrandarla. Con un marcador impreso, la maqueta sí se queda quieta sobre la mesa.', en: 'Fixed view: this phone has no gyroscope, so the house stays in front of the camera. Drag to rotate, pinch to resize. With a printed marker the model stays put on the table.' }),
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
  e.hidden = A.modo === 'lote';
  h.textContent = A.ojo > 1 ? tr({ es: 'De pie', en: 'Standing' }) : tr({ es: 'Sobre una mesa', en: 'Over a table' });
}

function cuadro() {
  if (!A.activo) return;
  A.raf = requestAnimationFrame(cuadro);
  const ahora = performance.now();
  if (A.modo === 'fija') {
    pintar(tr({ es: 'Vista fija · arrastra para girar, pellizca para agrandar', en: 'Fixed view · drag to rotate, pinch to resize' }));
  } else if (A.modo === 'giro') {
    const ok = camaraGiroscopio();
    if (!ok && ahora - A.giroDesde > 1500) { cambiarModo('fija'); toast(tr({ es: 'Este celular no tiene giroscopio: la casa queda fija delante de la cámara.', en: 'No gyroscope on this phone: the house stays fixed in front of the camera.' })); }
    else if (ok && !A.colocado) pintar(tr({ es: 'Apunta al piso y toca para poner la casa', en: 'Point at the floor and tap to place the house' }));
    else if (A.colocado) pintar(tr({ es: `Casa a ${fm(A.colocado.dist, 1)} m · gira el celular para verla`, en: `House ${fm(A.colocado.dist, 1)} m away · turn the phone to look` }));
  } else {
    enviarCuadro();
    if (A.ancla.visible && ahora - A.visto > PERDIDO_MS) { A.ancla.visible = false; A.filtroP.reiniciar(); A.filtroQ.reiniciar(); A.qPrev = null; }
    if (!A.ancla.visible) pintar(A.modo === 'lote' ? tr({ es: 'Buscando el marcador de una esquina…', en: 'Looking for a corner marker…' }) : tr({ es: 'Buscando el marcador…', en: 'Looking for the marker…' }));
    if (A.nunca && !A.sinCerrado && ahora - A.desde > AYUDA_SIN_MARCADOR_MS) $id('axARsin').hidden = false;
  }
  const ay = $id('axARayuda');
  if (ay) ay.hidden = A.ancla.visible || !$id('axARsin').hidden;
  A.renderer?.render(A.escena, A.camara);
}

/* ---------------------------------------------------------------- gestos y foto */

function conectarGestos(d) {
  const pts = new Map();
  let base = null, toque = null;
  const dentroUI = e => e.target.closest('button, .axar-top, .axar-bot, .axar-panel');
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
