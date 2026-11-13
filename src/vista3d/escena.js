/* ==========================================================================
   AXIONA OBRA · Modelo 3D por fases de obra
   --------------------------------------------------------------------------
   Once fases, de terreno natural a la entrega amoblada. Cada fase es un
   grupo que se prende o se apaga; muros, columnas y culatas cambian de
   material segun la fase (ladrillo o tablero, pañete, pintura o
   revestimiento). Texturas en metros (materiales.js), muebles del amoblado
   (muebles3d.js), cubierta plana o inclinada, puertas abiertas, pisos y
   enchapes por espacio, jardin y arboles. Coordenadas: x del marco del
   frente, y arriba (la cota) y z = -y del marco, como espera three.js.
   ========================================================================== */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { rectMinus, near, PISOS, ESTILOS, FACHADAS, TEJAS, CIELOS, pisoDe, nombreCategoria, enchapeDe, pisoExtDe } from '../motor/index.js';
import { doorGeom } from '../ui/planos.js';
import { $, $$, fm, app, fases, tr, fmtA, fmtLu } from '../ui/comun.js';
import { textura, material, std, cajaM, planoM, matPiso, matPBR, alCargarTextura } from './materiales.js';
import { construirExterior } from './exterior3d.js';
import { aplicarNoche } from './noche.js';
import { crearEditor } from './editor3d.js';
import { paleta, mueble, cortina, arbol, estiloMuebles, cargarMuebles } from './muebles3d.js';

const T3 = {};
export const tres = T3;
if (typeof location !== 'undefined' && /[?&]depurar3d/.test(location.search)) window.__T3 = T3; // solo para medir rendimiento

/* ------------------------------------------------------------- tema, luz y calidad */
const FONDOS = {
  claro: { cielo: ['#c9dbea', '#e9f0f6', '#f3f5f7'], niebla: 0xe9eef3, entorno: 0.78 },
  oscuro: { cielo: ['#14202c', '#0b1118', '#070a0e'], niebla: 0x070a0e, entorno: 0.55 },
};
function cielo(tema) {
  const cv = document.createElement('canvas'); cv.width = 4; cv.height = 256;
  const g = cv.getContext('2d'), gr = g.createLinearGradient(0, 0, 0, 256), [a, b, c] = FONDOS[tema].cielo;
  gr.addColorStop(0, a); gr.addColorStop(0.55, b); gr.addColorStop(1, c);
  g.fillStyle = gr; g.fillRect(0, 0, 4, 256);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
/* Cielo de verdad: foto de 360° (Poly Haven, CC0) para el fondo y su versión HDR para la luz y los reflejos. */
const RAIZ_CIELO = (import.meta.env?.BASE_URL ?? './') + 'cielo/';
const DIR_SOL = new THREE.Vector3(0.53, 0.76, 0.38).normalize(); // donde está el sol en esa foto
function cargarCielo() {
  if (T3.cargandoCielo) return;
  T3.cargandoCielo = true;
  new THREE.TextureLoader().load(RAIZ_CIELO + 'dia.jpg', t => {
    t.mapping = THREE.EquirectangularReflectionMapping; t.colorSpace = THREE.SRGBColorSpace;
    T3.cieloDia = t;
    if (!T3.noche) temaEscena(T3.tema);
  });
  new RGBELoader().load(RAIZ_CIELO + 'dia_1k.hdr', hdr => {
    hdr.mapping = THREE.EquirectangularReflectionMapping;
    T3.hdrDia = hdr;
    T3.scene.userData.hdrDia = hdr;
    const pm = new THREE.PMREMGenerator(T3.renderer);
    T3.envDia = pm.fromEquirectangular(hdr).texture;
    pm.dispose();
    if (!T3.noche) temaEscena(T3.tema);
  });
}
/** Fondo del 3D: el cielo de verdad cuando ya llegó; mientras tanto, un degradado claro u oscuro según el tema. */
export function temaEscena(tema = document.documentElement.dataset.tema) {
  T3.tema = tema === 'oscuro' ? 'oscuro' : 'claro';
  if (!T3.renderer) return;
  if (T3.noche) { render3D(); return; }
  const F = FONDOS[T3.tema];
  const viejo = T3.scene.background;
  if (viejo?.dispose && viejo !== T3.cieloDia && viejo !== T3.cieloNoche) viejo.dispose();
  if (T3.cieloDia) {
    T3.scene.background = T3.cieloDia;
    T3.scene.fog = new THREE.Fog(0xc9d5e2, 220, 900);
    if (T3.envDia) T3.scene.environment = T3.envDia;
    T3.scene.environmentIntensity = 0.62;
    T3.scene.backgroundIntensity = 1;
    if (T3.tapaMat) T3.tapaMat.color.set(T3.tema === 'claro' ? 0x34404c : 0x9fb3c8);
    render3D();
    return;
  }
  T3.scene.background = cielo(T3.tema);
  T3.scene.fog = new THREE.Fog(F.niebla, 120, 420);
  T3.scene.environmentIntensity = F.entorno;
  if (T3.tapaMat) T3.tapaMat.color.set(T3.tema === 'claro' ? 0x34404c : 0x9fb3c8);
  render3D();
}
/** Equipos con mouse y pantalla grande: oclusión ambiental (sombras de contacto en esquinas y muebles). */
const calidadAlta = () => typeof matchMedia === 'function' && !matchMedia('(pointer: coarse)').matches && Math.min(window.innerWidth, window.innerHeight) > 600;
function nuevoComposer(r, scene, cam, w, h) {
  const comp = new EffectComposer(r);
  comp.addPass(new RenderPass(scene, cam));
  const ao = new GTAOPass(scene, cam, w, h);
  ao.updateGtaoMaterial({ radius: 0.55, distanceExponent: 1.4, thickness: 1.2, scale: 1, samples: 16 });
  ao.blendIntensity = 0.9;
  comp.addPass(ao);
  comp.addPass(new OutputPass());
  comp.setSize(w, h);
  return comp;
}

/* ------------------------------------------------------------- casa abierta (maqueta con muros cortados) */
const CORTE_SOBRE_PISO = 1.25; // m sobre el piso terminado, como las maquetas de presentación
const planoCorte = new THREE.Plane(new THREE.Vector3(0, -1, 0), 0);
const OBRA_CORTADA = ['conc', 'bruto', 'panete', 'drywall', 'pinturaI', 'fachada', 'zocalo', 'membrana', 'teja', 'sofito', 'canal', 'madera', 'puertaP', 'vidrio', 'ventana', 'marco', 'acero', 'cielo', 'enchape', 'losa'];
const pisoAbierto = () => (app.viewFloor < 99 ? Math.min(app.viewFloor, (app.M?.F || 1) - 1) : 0);
function quitarTapas() {
  if (!T3.tapas) return;
  T3.scene.remove(T3.tapas);
  T3.tapas.traverse(o => o.geometry?.dispose());
  T3.tapas = null;
}
/** Corta muros, ventanas y cielos a media altura del piso que se ve y pone la tapa oscura del corte. */
function aplicarCorte() {
  const mt = T3.mat;
  if (!mt) return;
  const on = !!T3.abierta && app.M && !app.M.err;
  const mats = new Set();
  OBRA_CORTADA.forEach(k => { if (mt[k]) mats.add(mt[k]); });
  [...T3.muros.map(w => w.m), ...T3.estructura, ...T3.culatas].forEach(m => [].concat(m.material).forEach(x => x && mats.add(x)));
  quitarTapas();
  T3.renderer.localClippingEnabled = on;
  if (!on) { mats.forEach(x => { if (x.clippingPlanes?.length) { x.clippingPlanes = []; x.needsUpdate = true; } }); return; }
  const M = app.M, f = pisoAbierto(), y = M.dl + f * M.fh + CORTE_SOBRE_PISO;
  planoCorte.constant = y;
  mats.forEach(x => { if (x.clippingPlanes?.[0] !== planoCorte) { x.clippingPlanes = [planoCorte]; x.needsUpdate = true; } });
  if (!T3.tapaMat) T3.tapaMat = new THREE.MeshStandardMaterial({ color: T3.tema === 'claro' ? 0x34404c : 0x9fb3c8, roughness: 0.8 });
  const g = new THREE.Group(), b = new THREE.Box3();
  [...T3.muros.map(w => w.m), ...T3.estructura].forEach(m => {
    if (m.userData.fl !== f || !m.visible) return;
    b.setFromObject(m);
    if (b.min.y >= y || b.max.y <= y) return;
    const t = new THREE.Mesh(new THREE.BoxGeometry(b.max.x - b.min.x + 0.004, 0.03, b.max.z - b.min.z + 0.004), T3.tapaMat);
    t.position.set((b.min.x + b.max.x) / 2, y, (b.min.z + b.max.z) / 2);
    g.add(t);
  });
  T3.tapas = g;
  T3.scene.add(g);
}
/** Vuelo suave de la cámara a una vista. */
function volar(pos, mira, ms = 900) {
  const p0 = T3.cam.position.clone(), m0 = T3.ctl.target.clone(), t0 = performance.now();
  T3.vuelo = () => {
    const k = Math.min(1, (performance.now() - t0) / ms), e = k < 0.5 ? 4 * k * k * k : 1 - (-2 * k + 2) ** 3 / 2;
    T3.cam.position.lerpVectors(p0, pos, e); T3.ctl.target.lerpVectors(m0, mira, e); T3.ctl.update(); render3D();
    if (k >= 1) T3.vuelo = null;
  };
}
/** Prende o apaga la casa abierta: amoblada, sin techo, con los muros cortados y la cámara arriba en tres cuartos. */
export function casaAbierta(on) {
  if (!ensure3D()) return;
  if (app.threeDirty) buildScene();
  T3.abierta = on;
  $('#abiertaBtn')?.setAttribute('aria-pressed', on);
  if (on && app.phase < 9) app.phase = 10;
  applyPhase();
  const M = app.M;
  if (on && M && !M.err) {
    const R = M.R, cx = (R.x0 + R.x1) / 2, cy = (R.y0 + R.y1) / 2, s = Math.max(R.w, R.h, 7), y = M.dl + pisoAbierto() * M.fh;
    volar(new THREE.Vector3(cx + s * 0.4, y + s * 0.7, -cy + s * 0.62), new THREE.Vector3(cx, y + 0.4, -cy));
  }
}
const OBRA = new Set(['cocinaBase', 'isla', 'inodoro', 'lavamanos', 'ducha', 'tina', 'lavadero', 'closet']);

export function ensure3D() {
  if (T3.renderer) return true;
  const box = $('#threeBox');
  let r;
  try {
    r = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  } catch {
    $('#hud').textContent = tr({ es: 'Este dispositivo no pudo iniciar el 3D (WebGL).', en: 'This device could not start 3D (WebGL).' });
    return false;
  }
  r.setPixelRatio(Math.min(devicePixelRatio, 2));
  r.toneMapping = THREE.ACESFilmicToneMapping;
  r.toneMappingExposure = 1.0;
  r.shadowMap.enabled = true;
  r.shadowMap.type = THREE.PCFSoftShadowMap;
  // Rendimiento: las sombras solo se recalculan cuando cambia la escena (no al girar la cámara),
  // y en producción no se piden los registros de compilación de cada sombreador (eso frena el primer cuadro).
  r.shadowMap.autoUpdate = false;
  r.shadowMap.needsUpdate = true;
  if (import.meta.env?.PROD) r.debug.checkShaderErrors = false;
  box.appendChild(r.domElement);
  const scene = new THREE.Scene();
  const pm = new THREE.PMREMGenerator(r);
  scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.55;
  const cam = new THREE.PerspectiveCamera(42, 1, 0.05, 900);
  const ctl = new OrbitControls(cam, r.domElement);
  ctl.enableDamping = true; ctl.dampingFactor = 0.08; ctl.maxPolarAngle = Math.PI * 0.495;
  scene.add(new THREE.HemisphereLight(0xdfeeff, 0x3a2e22, 0.9));
  const sun = new THREE.DirectionalLight(0xfff0dc, 2.6);
  sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.025;
  scene.add(sun, sun.target);
  Object.assign(T3, { renderer: r, scene, cam, ctl, sun, box, root: null, spin: false, damp: 0, sinTecho: false, enRecorrido: false, planoCorte });
  T3.alReconstruir = () => T3.editor?.refrescar();
  temaEscena(document.documentElement.dataset.tema);
  cargarCielo();
  // muebles reales: se descargan una vez; cuando llegan, la escena se rearma con ellos
  cargarMuebles().then(n => { if (n && T3.root) buildScene(); });
  if (calidadAlta()) { try { T3.composer = nuevoComposer(r, scene, cam, 2, 2); } catch { T3.composer = null; } }
  ctl.addEventListener('change', renderCamara);
  let cola = 0;
  alCargarTextura(() => { if (!cola) cola = requestAnimationFrame(() => { cola = 0; render3D(); }); });
  let colaTam = 0;
  new ResizeObserver(() => { if (!colaTam) colaTam = requestAnimationFrame(() => { colaTam = 0; resize3D(); }); }).observe(box);
  const loop = () => {
    requestAnimationFrame(loop);
    if (r.xr.isPresenting || T3.enRecorrido) return;
    ctl.autoRotate = T3.spin; ctl.autoRotateSpeed = 0.8;
    if (T3.spin || T3.damp > 0) { ctl.update(); T3.damp--; }
    if (T3.anim) T3.anim();
    if (T3.vuelo) T3.vuelo();
  };
  loop();
  r.domElement.addEventListener('pointerdown', () => { T3.damp = 120; });
  r.domElement.addEventListener('wheel', () => { T3.damp = 60; }, { passive: true });
  return true;
}

export function resize3D() {
  if (!T3.renderer || T3.renderer.xr.isPresenting) return;
  const w = T3.box.clientWidth, h = T3.box.clientHeight;
  if (!w || !h) return;
  T3.renderer.setSize(w, h, false);
  if (T3.composer) { T3.composer.setPixelRatio(T3.renderer.getPixelRatio()); T3.composer.setSize(w, h); }
  for (const c of [T3.cam, T3.camFP]) { if (c) { c.aspect = w / h; c.updateProjectionMatrix(); } }
  render3D();
}

/** Render completo: la escena cambió (se recalculan las sombras) y, en equipos potentes, con oclusión ambiental. */
export function render3D() {
  if (!T3.renderer || T3.renderer.xr.isPresenting) return;
  T3.renderer.shadowMap.needsUpdate = true;
  dibujar(true);
}
function dibujar(final) {
  if (T3.compilando) return; // los sombreadores se compilan en segundo plano; se dibuja al terminar
  const cam = T3.enRecorrido && T3.camFP ? T3.camFP : T3.cam;
  T3.exterior?.alRender?.(cam);
  clearTimeout(T3.tQuieto);
  if (final && T3.composer && !(T3.enRecorrido && T3.camFP)) T3.composer.render();
  else T3.renderer.render(T3.scene, cam);
}
/** Mientras la cámara se mueve: cuadro liviano (sin recalcular sombras ni oclusión); al quedarse quieta, el cuadro final. */
function renderCamara() {
  if (!T3.renderer || T3.renderer.xr.isPresenting) return;
  dibujar(!T3.composer);
  if (T3.composer) T3.tQuieto = setTimeout(() => dibujar(true), 180);
}
/** Compila los sombreadores sin congelar la página (KHR_parallel_shader_compile cuando el equipo lo tiene). */
function compilarEnSegundoPlano() {
  const r = T3.renderer;
  if (!r?.compileAsync || T3.compilando) return;
  T3.compilando = true;
  const hud = $('#hud'), antes = hud?.textContent;
  if (hud && !T3.compiladoUnaVez) hud.textContent = tr({ es: 'Preparando el 3D…', en: 'Preparing 3D…' });
  r.compileAsync(T3.scene, T3.cam).catch(() => {}).finally(() => {
    T3.compilando = false;
    if (hud && !T3.compiladoUnaVez && hud.textContent === tr({ es: 'Preparando el 3D…', en: 'Preparing 3D…' })) hud.textContent = antes || '';
    T3.compiladoUnaVez = true;
    render3D();
  });
}

/* ------------------------------------------------------------- ayudas */

/** Un rectángulo menos un hueco (la piscina interior): hasta cuatro franjas alrededor. */
function sinHueco(r, h) {
  if (!h || h.x1 <= r.x0 || h.x0 >= r.x1 || h.y1 <= r.y0 || h.y0 >= r.y1) return [r];
  const x0 = Math.max(r.x0, h.x0), x1 = Math.min(r.x1, h.x1);
  return [
    { x0: r.x0, x1: r.x1, y0: r.y0, y1: Math.max(r.y0, h.y0) },
    { x0: r.x0, x1: r.x1, y0: Math.min(r.y1, h.y1), y1: r.y1 },
    { x0: r.x0, x1: x0, y0: Math.max(r.y0, h.y0), y1: Math.min(r.y1, h.y1) },
    { x0: x1, x1: r.x1, y0: Math.max(r.y0, h.y0), y1: Math.min(r.y1, h.y1) },
  ].filter(q => q.x1 - q.x0 > 0.01 && q.y1 - q.y0 > 0.01);
}

function addBox(g, x0, x1, y0, y1, z0, z1, mat, fl = 0, ud = {}) {
  const sx = Math.abs(x1 - x0), sy = Math.abs(y1 - y0), sz = Math.abs(z1 - z0);
  if (sx < 0.004 || sy < 0.004 || sz < 0.004) return null;
  const c = [(x0 + x1) / 2, (z0 + z1) / 2, -(y0 + y1) / 2];
  const m = new THREE.Mesh(cajaM(sx, sz, sy, c), mat);
  m.position.set(...c);
  m.castShadow = true; m.receiveShadow = true;
  m.userData = { fl, ...ud };
  g.add(m);
  return m;
}

/**
 * Cielo en listones de madera: tablillas de 6 × 4 cm cada 11 cm, a lo largo del lado más largo, sobre un fondo
 * oscuro (como los cielos de las casas campestres). Se juntan en una sola malla por espacio.
 */
function listones(g, x0, x1, y0, y1, z, mat, fondo, ud = {}) {
  const largoX = x1 - x0 >= y1 - y0, L = largoX ? x1 - x0 : y1 - y0, A = largoX ? y1 - y0 : x1 - x0;
  if (L < 0.3 || A < 0.2) return;
  const n = Math.max(1, Math.floor(A / 0.11)), paso = A / n, piezas = [];
  for (let i = 0; i < n; i++) {
    const t = (largoX ? y0 : x0) + paso * (i + 0.5);
    const b = cajaM(largoX ? L : 0.06, 0.04, largoX ? 0.06 : L, largoX ? [(x0 + x1) / 2, z - 0.02, -t] : [t, z - 0.02, -(y0 + y1) / 2]);
    b.translate(largoX ? (x0 + x1) / 2 : t, z - 0.02, largoX ? -t : -(y0 + y1) / 2);
    piezas.push(b);
  }
  const m = new THREE.Mesh(mergeGeometries(piezas), mat);
  m.castShadow = true; m.receiveShadow = true; m.userData = { ...ud };
  g.add(m);
  piezas.forEach(p => p.dispose());
  const f = new THREE.Mesh(planoM(x0, x1, y0, y1, z + 0.005), fondo);
  f.userData = { ...ud };
  g.add(f);
}

function malla(posiciones, uvs, mat, ud = {}) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(posiciones, 3));
  if (uvs) g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  g.computeVertexNormals();
  const m = new THREE.Mesh(g, mat);
  m.castShadow = true; m.receiveShadow = true;
  m.userData = ud;
  return m;
}

function terrainMesh(M, graded, huecos = []) {
  const G = M.grid, { nx, ny, res } = G, pos = [], col = [], uv = [], idx = [];
  const lo = new THREE.Color(0x3d5131), hi = new THREE.Color(0x87744c), out0 = new THREE.Color(0x1b231d), out1 = new THREE.Color(0x2d2a22), plat = new THREE.Color(0x7a6650), c = new THREE.Color();
  const P = M.P, span = Math.max(G.zmax - G.zmin, 0.01);
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const x = G.x0 + i * res, y = G.y0 + j * res, k = j * nx + i;
    let z = G.Z[k], inP = false;
    if (graded) {
      const dx = Math.max(P.x0 - x, 0, x - P.x1), dy = Math.max(P.y0 - y, 0, y - P.y1), d = Math.hypot(dx, dy);
      if (d === 0) { z = M.dl; inP = true; } else if (d < 2) z = M.dl + (z - M.dl) * (d / 2);
      // alrededor de la piscina el terreno queda a nivel de la playa
      huecos.forEach(h => {
        const e = h.borde, hx = Math.max(h.x0 - e - x, 0, x - h.x1 - e), hy = Math.max(h.y0 - e - y, 0, y - h.y1 - e), dh = Math.hypot(hx, hy);
        if (dh === 0) { z = h.z; inP = true; } else if (dh < 2) z = h.z + (z - h.z) * (dh / 2);
      });
    }
    pos.push(x, z, -y);
    uv.push(x, y);
    const t = (G.Z[k] - G.zmin) / span;
    if (inP) c.copy(plat); else if (G.IN[k]) c.copy(lo).lerp(hi, t); else c.copy(out0).lerp(out1, t);
    col.push(c.r, c.g, c.b);
  }
  const enHueco = (x, y) => huecos.some(h => x > h.x0 - 0.05 && x < h.x1 + 0.05 && y > h.y0 - 0.05 && y < h.y1 + 0.05);
  for (let j = 0; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) {
    const a = j * nx + i, b = a + 1, d = a + nx, e = d + 1;
    if (graded && huecos.length && enHueco(G.x0 + (i + 0.5) * res, G.y0 + (j + 0.5) * res)) continue;
    idx.push(a, b, d, b, e, d); // normales hacia arriba (el trazador de rayos las necesita así)
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, transparent: true, opacity: 1, side: THREE.DoubleSide }));
  m.receiveShadow = true;
  m.userData = { fl: 0, terrain: true, own: true };
  return m;
}

/** Materiales del pais y del estilo. */
function materiales(S, M) {
  const E = ESTILOS[S.acabados?.estilo] || ESTILOS.moderno;
  const madera = M.sistema === 'madera';
  const teja = M.pais === 'CA' ? textura('asfaltica', {}) : textura('teja', { color: M.pais === 'ES' ? '#b5643f' : '#a9583b' });
  const Fa = FACHADAS[S.acabados?.fachada], Fb = FACHADAS[S.acabados?.fachadaBase], Tj = TEJAS[S.acabados?.teja], En = enchapeDe(S), Ci = CIELOS[S.acabados?.cielo];
  return {
    E,
    conc: material('m|conc', () => new THREE.MeshStandardMaterial({ map: textura('cemento', { color: '#a3a5a8' }), roughness: 0.92 })),
    lean: material('m|lean', () => std(0x5d6168, 1)),
    bruto: madera ? material('m|osb', () => new THREE.MeshStandardMaterial({ map: textura('osb'), roughness: 0.9 })) : material('m|ladrillo', () => new THREE.MeshStandardMaterial({ map: textura('ladrillo', { color: M.pais === 'ES' ? '#b9785a' : '#b0573a' }), roughness: 0.95 })),
    panete: madera ? material('m|tyvek', () => std(0xeef0f2, 0.7)) : material('m|panete', () => new THREE.MeshStandardMaterial({ map: textura('cemento', { color: '#bdb8ad' }), roughness: 1 })),
    drywall: material('m|drywall', () => std(0xd9d9d6, 0.95)),
    pinturaI: material('m|pintI|' + E.paredes, () => std(E.paredes, 0.9)),
    fachada: Fa?.pbr ? matPBR(Fa.pbr, Fa.m) : madera ? material('m|tablas|' + E.fachada, () => new THREE.MeshStandardMaterial({ map: textura('tablas', { color: E.fachada }), roughness: 0.75 })) : material('m|fach|' + E.fachada, () => new THREE.MeshStandardMaterial({ map: textura('cemento', { color: E.fachada }), roughness: 0.9 })),
    fachadaBase: Fb?.pbr ? matPBR(Fb.pbr, Fb.m) : null,
    listones: Ci?.pbr ? matPBR(Ci.pbr, Ci.m, { roughness: 0.8 }) : null,
    fondoListones: material('m|fondoListones', () => std(0x1f1c19, 0.95, { side: THREE.DoubleSide })),
    zocalo: material('m|zocalo', () => new THREE.MeshStandardMaterial({ map: textura('piedra', { color: '#8f877c' }), roughness: 0.95 })),
    losa: madera ? material('m|osb', () => new THREE.MeshStandardMaterial({ map: textura('osb'), roughness: 0.9 })) : material('m|conc', () => null),
    membrana: material('m|membrana', () => std(0x3a3f47, 0.7)),
    teja: Tj?.pbr ? matPBR(Tj.pbr, Tj.m, { side: THREE.DoubleSide }) : material('m|teja|' + M.pais, () => new THREE.MeshStandardMaterial({ map: teja, roughness: 0.85, side: THREE.DoubleSide })),
    sofito: material('m|sofito', () => std(0xf0eee9, 0.9, { side: THREE.DoubleSide })),
    canal: material('m|canal', () => std(0xe9e9e6, 0.4, { metalness: 0.3 })),
    madera: material('m|madera|' + E.madera, () => new THREE.MeshStandardMaterial({ map: textura('madera', { tono: E.madera }), roughness: 0.6 })),
    puertaP: material('m|puertaP', () => new THREE.MeshStandardMaterial({ map: textura('madera', { tono: 'nogal' }), roughness: 0.5 })),
    vidrio: material('m|vidrio', () => new THREE.MeshStandardMaterial({ color: 0x9fd0e6, roughness: 0.04, metalness: 0.2, transparent: true, opacity: 0.28, depthWrite: false })),
    ventana: material('m|ventana', () => new THREE.MeshStandardMaterial({ color: 0x9fd0e6, roughness: 0.04, metalness: 0.2, transparent: true, opacity: 0.28, depthWrite: false, emissive: 0x000000 })),
    marco: material('m|marco|' + E.carpinteria, () => std(E.carpinteria, 0.4, { metalness: 0.5 })),
    acero: material('m|acero', () => std(0xbfc3c8, 0.28, { metalness: 0.9 })),
    cielo: material('m|cielo', () => std(0xf6f5f2, 0.95, { side: THREE.BackSide })),
    pasto: matPBR('pasto', 2.6, { side: THREE.DoubleSide, color: 0xd6e2c8 }),
    anden: material('m|anden', () => new THREE.MeshStandardMaterial({ map: textura('baldosa', { color: '#bdb6aa', junta: 0.4 }), roughness: 0.9 })),
    stake: material('m|stake', () => std(0xffae2b, 0.5, { emissive: 0x4a2a00 })),
    pisoExt: matPiso(PISOS[pisoExtDe(S)]),
    enchape: En.pbr ? matPBR(En.pbr, En.m, { roughness: 0.6 }) : material('m|ench|' + En.cod, () => {
      const en = En;
      const tex = en.tex === 'metro' ? textura('metro', { color: en.color }) : en.tex === 'marmol' ? textura('marmol', { color: en.color, junta: en.junta }) : en.tex === 'piedra' ? textura('piedra', { color: en.color }) : textura('baldosa', { color: en.color, junta: en.junta || 0.3 });
      return new THREE.MeshStandardMaterial({ map: tex, roughness: 0.3 });
    }),
  };
}

/* ------------------------------------------------------------- escena */

export function buildScene() {
  const M = app.M, S = app.S;
  if (!T3.renderer || !M || M.err) return;
  app.threeDirty = false;
  quitarTapas();
  if (T3.root) {
    T3.scene.remove(T3.root);
    T3.root.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material && o.userData.own) o.material.dispose(); });
  }
  const root = new THREE.Group(), G = [...Array(11)].map(() => new THREE.Group());
  G.forEach((g, i) => { g.userData.phase = i; root.add(g); });
  const mt = T3.mat = materiales(S, M);
  paleta(mt.E);
  estiloMuebles(S.acabados?.estilo);
  const R = M.R, dl = M.dl, fh = M.fh, sl = M.slab, F = M.F, desp = M.desp, cb = M.colB / 2, Tt = M.techo;
  T3.muros = []; T3.estructura = []; T3.culatas = []; T3.puertasAsc = [];
  const est = m => { if (m) T3.estructura.push(m); return m; };
  const madera = M.sistema === 'madera';

  // 0 / 1 terreno natural y explanado
  G[0].add(terrainMesh(M, false));
  G[0].userData.terrain = true;
  const pis = M.exterior?.piscina;
  const tg = terrainMesh(M, true, pis ? [{ ...pis, borde: 1.0, z: M.dl }] : []);
  G[1].add(tg);
  G[1].userData.terrain = true;
  T3.tGraded = tg;
  const lp = [];
  M.lot.forEach((p, i) => {
    const q = M.lot[(i + 1) % M.lot.length];
    for (let k = 0; k <= 10; k++) { const x = p.x + (q.x - p.x) * k / 10, y = p.y + (q.y - p.y) * k / 10; lp.push(new THREE.Vector3(x, M.zf(x, y) + 0.04, -y)); }
  });
  const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(lp), new THREE.LineBasicMaterial({ color: 0xffae2b }));
  line.userData = { fl: 0, own: true, terrain: true };
  root.add(line);
  M.lot.forEach(p => {
    const s = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.0, 8), mt.stake);
    s.position.set(p.x, p.z + 0.5, -p.y);
    s.userData = { fl: 0, terrain: true };
    root.add(s);
  });

  // 2 cimentacion segun el sistema
  const losas0 = M.compuesta ? M.floors[0].rects : [R];
  if (madera) {
    const hM = M.sotano ? 2.6 : Math.max(desp, 1.2) + 0.3, zb = dl + 0.3 - hM;
    const perim = M.compuesta
      ? M.floors[0].lines.filter(l => l.ext).map(l => (l.o === 'H' ? [l.a, l.b, l.c, l.c] : [l.c, l.c, l.a, l.b]))
      : [[R.x0, R.x1, R.y0, R.y0], [R.x0, R.x1, R.y1, R.y1], [R.x0, R.x0, R.y0, R.y1], [R.x1, R.x1, R.y0, R.y1]];
    perim.forEach(([a, b, c, d]) => addBox(G[2], a - 0.3, b + 0.3, c - 0.3, d + 0.3, zb - 0.25, zb, mt.conc));
    perim.forEach(([a, b, c, d]) => addBox(G[2], a - 0.1, b + 0.1, c - 0.1, d + 0.1, zb, dl + 0.3, mt.conc));
    losas0.forEach(r => addBox(G[2], r.x0 + 0.2, r.x1 - 0.2, r.y0 + 0.2, r.y1 - 0.2, zb, zb + 0.1, mt.conc));
    M.cols.forEach(c => { addBox(G[2], c.x - c.B / 2, c.x + c.B / 2, c.y - c.B / 2, c.y + c.B / 2, zb, zb + c.h, mt.conc); addBox(G[3], c.x - 0.05, c.x + 0.05, c.y - 0.05, c.y + 0.05, zb + c.h, dl + 0.05, mt.acero); });
    M.beams.forEach(b => addBox(G[3], b.a + 0.2, b.b - 0.2, b.c - 0.06, b.c + 0.06, dl + 0.05, dl + 0.3, mt.acero));
  } else if (M.sistema === 'confinada' && M.mx?.cim) {
    // México: zapata corrida B × h al desplante, muro de enrase y dala de desplante de 15 cm
    const { B, hz } = M.mx.cim, b = B / 2;
    M.floors[0].lines.forEach(l => {
      const caja = (m, z0, z1, mat) => (l.o === 'H' ? addBox(G[2], l.a - m, l.b + m, l.c - m, l.c + m, z0, z1, mat) : addBox(G[2], l.c - m, l.c + m, l.a - m, l.b + m, z0, z1, mat));
      caja(b, dl - desp, dl - desp + hz, mt.conc);
      caja(0.075, dl - desp + hz, dl - 0.08, mt.conc);
    });
  } else if (M.sistema === 'confinada') {
    M.floors[0].lines.forEach(l => {
      const [x0, x1, y0, y1] = l.o === 'H' ? [l.a - 0.2, l.b + 0.2, l.c - 0.2, l.c + 0.2] : [l.c - 0.2, l.c + 0.2, l.a - 0.2, l.b + 0.2];
      addBox(G[2], x0, x1, y0, y1, dl - 0.9, dl - 0.4, mt.conc);
      const [a0, a1, b0, b1] = l.o === 'H' ? [l.a - 0.125, l.b + 0.125, l.c - 0.125, l.c + 0.125] : [l.c - 0.125, l.c + 0.125, l.a - 0.125, l.b + 0.125];
      addBox(G[2], a0, a1, b0, b1, dl - 0.4, dl - 0.08, mt.conc);
    });
  } else {
    M.cols.forEach(c => {
      addBox(G[2], c.x - c.B / 2 - 0.05, c.x + c.B / 2 + 0.05, c.y - c.B / 2 - 0.05, c.y + c.B / 2 + 0.05, dl - desp - 0.05, dl - desp, mt.lean);
      addBox(G[2], c.x - c.B / 2, c.x + c.B / 2, c.y - c.B / 2, c.y + c.B / 2, dl - desp, dl - desp + c.h, mt.conc);
    });
    // las vigas de cimentación no cruzan el vaso de la piscina interior
    const pV = M.exterior?.piscina?.interior ? M.exterior.piscina : null;
    const hV = pV ? { x0: pV.x0 - 0.25, x1: pV.x1 + 0.25, y0: pV.y0 - 0.25, y1: pV.y1 + 0.25 } : null;
    M.beams.forEach(b => {
      const r = b.o === 'H' ? { x0: b.a - 0.15, x1: b.b + 0.15, y0: b.c - 0.15, y1: b.c + 0.15 } : { x0: b.c - 0.15, x1: b.c + 0.15, y0: b.a - 0.15, y1: b.b + 0.15 };
      sinHueco(r, hV).forEach(q => addBox(G[2], q.x0, q.x1, q.y0, q.y1, dl - 0.4, dl - 0.08, mt.conc));
    });
  }
  // contrapiso: en la casa de patio, solo bajo lo construido (el patio queda descubierto)
  // con piscina interior, el contrapiso deja el hueco del vaso (con su remate)
  const pIn = M.exterior?.piscina?.interior ? M.exterior.piscina : null;
  const hueco = pIn ? { x0: pIn.x0 - 0.2, x1: pIn.x1 + 0.2, y0: pIn.y0 - 0.2, y1: pIn.y1 + 0.2 } : null;
  if (!madera) losas0.flatMap(r => sinHueco(r, hueco)).forEach(r => addBox(G[2], r.x0, r.x1, r.y0, r.y1, dl - 0.08, dl, mt.conc, 0));
  else losas0.flatMap(r => sinHueco(r, hueco)).forEach(r => addBox(G[3], r.x0, r.x1, r.y0, r.y1, dl + 0.3, dl + 0.32, mt.losa, 0));

  // 3 estructura
  const z0 = madera ? 0.32 : 0;
  for (let f = 0; f < F; f++) {
    const L0 = dl + f * fh + z0, L1 = dl + (f + 1) * fh + z0;
    // cada piso con su huella: si retrocede, sus columnas y vigas se quedan dentro de ella
    const Rf = M.floors[f].R || R;
    if (M.sistema === 'porticos' || M.sistema === 'hormigon') {
      M.cols.forEach(c => {
        if (f >= (c.n ?? F)) return;
        if (f === 0) addBox(G[3], c.x - cb, c.x + cb, c.y - cb, c.y + cb, dl - desp + c.h, dl, mt.conc, f);
        est(addBox(G[3], c.x - cb, c.x + cb, c.y - cb, c.y + cb, f === 0 ? dl : L0, L1 - sl, mt.conc, f));
      });
      (M.vigas?.[f] || M.beams).forEach(b => est(b.o === 'H'
        ? addBox(G[3], b.a - 0.15, b.b + 0.15, b.c - 0.15, b.c + 0.15, L1 - sl - 0.25, L1 - sl, mt.conc, f + 1)
        : addBox(G[3], b.c - 0.15, b.c + 0.15, b.a - 0.15, b.b + 0.15, L1 - sl - 0.25, L1 - sl, mt.conc, f + 1)));
    } else if (M.sistema === 'confinada') {
      if (M.castillos) M.castillos[f].forEach(c => est(addBox(G[3], c.x - 0.075, c.x + 0.075, c.y - 0.075, c.y + 0.075, L0, L1 - sl, mt.conc, f)));
      else (M.columnetasPiso?.[f] || M.columnetas).forEach(c => est(addBox(G[3], c.x - 0.1, c.x + 0.1, c.y - 0.075, c.y + 0.075, L0, L1 - sl, mt.conc, f)));
      M.floors[f].lines.forEach(l => est(l.o === 'H'
        ? addBox(G[3], l.a - 0.075, l.b + 0.075, l.c - 0.075, l.c + 0.075, L1 - sl - 0.2, L1 - sl, mt.conc, f + 1)
        : addBox(G[3], l.c - 0.075, l.c + 0.075, l.a - 0.075, l.b + 0.075, L1 - sl - 0.2, L1 - sl, mt.conc, f + 1)));
    }
    const ultima = f === F - 1;
    if (!(ultima && madera && Tt.tipo !== 'plana')) {
      (M.compuesta ? M.floors[f].rects.filter(r => !(r.stair && f < F - 1)) : rectMinus(Rf, f < F - 1 ? M.stair : null)).forEach(r => {
        const m = addBox(G[3], r.x0, r.x1, r.y0, r.y1, L1 - sl, L1, madera ? mt.losa : mt.conc, f + 1, { techo: ultima });
        if (m && ultima) T3.losaTecho = m;
      });
      est(addBox(G[3], Rf.x0 - 0.01, Rf.x1 + 0.01, Rf.y0 - 0.01, Rf.y0 + 0.01, L1 - sl, L1, mt.conc, f + 1));
    }
    // columnas del corredor de la casa de patio (en pórticos ya son columnas de la estructura)
    (M.pilares || []).forEach(c => est(addBox(G[3], c.x - c.lado / 2, c.x + c.lado / 2, c.y - c.lado / 2, c.y + c.lado / 2, f === 0 ? dl : L0, L1 - sl, madera ? mt.madera : mt.conc, f)));
    if (f < F - 1 && M.stair) {
      const s = M.stair, n = Math.round(fh / 0.18), rz = fh / n, tr0 = (s.y1 - s.y0 - 0.2) / n;
      for (let k = 0; k < n; k++) addBox(G[3], s.x0 + 0.15, s.x1 - 0.15, s.y0 + k * tr0, s.y0 + (k + 1) * tr0, L0, L0 + (k + 1) * rz, madera ? mt.madera : mt.conc, f);
    }
  }

  // 4 muros (cambian de material en las fases 6 y 7)
  const caraExterior = (l, Rf) => (l.o === 'H' ? (near(l.c, Rf.y0) ? 4 : near(l.c, Rf.y1) ? 5 : -1) : (near(l.c, Rf.x0) ? 1 : near(l.c, Rf.x1) ? 0 : -1));
  const wb = (fl, l, a, b, za, zb) => {
    const t = l.ext ? 0.2 : 0.12;
    const a2 = Math.abs(a - l.a) < 0.02 ? a - t / 2 : a, b2 = Math.abs(b - l.b) < 0.02 ? b + t / 2 : b;
    const m = l.o === 'H' ? addBox(G[4], a2, b2, l.c - t / 2, l.c + t / 2, za, zb, mt.bruto, fl, { ext: l.ext }) : addBox(G[4], l.c - t / 2, l.c + t / 2, a2, b2, za, zb, mt.bruto, fl, { ext: l.ext });
    if (m) T3.muros.push({ m, cara: l.ext ? caraExterior(l, M.floors[fl].R || R) : -1, zocalo: l.ext && fl === 0 });
  };
  M.floors.forEach(fl => {
    const L0 = dl + fl.f * fh + z0, top = L0 + fh - sl;
    fl.lines.forEach(l => {
      l.pieces.forEach(([a, b]) => wb(fl.f, l, a, b, L0, top));
      fl.ops.filter(o => o.o === l.o && near(o.c, l.c) && o.a >= l.a - 0.01 && o.b <= l.b + 0.01).forEach(o => {
        if (o.kind === 'win') {
          wb(fl.f, l, o.a, o.b, L0, L0 + o.sill);
          if (L0 + o.sill + o.h < top) wb(fl.f, l, o.a, o.b, L0 + o.sill + o.h, top);
        } else if (L0 + o.h < top) wb(fl.f, l, o.a, o.b, L0 + o.h, top);
      });
    });
  });

  // 5 cubierta
  const Lt = dl + F * fh + z0, Rt = M.Rtop || R;
  if (Tt.tipo === 'plana' && M.compuesta) {
    // azotea por alas; antepecho en las fachadas y en el borde del corredor hacia el patio
    M.compuesta.alas.forEach(a => addBox(G[5], a.x0, a.x1, a.y0, a.y1, Lt, Lt + 0.02, mt.membrana, F, { techo: true }));
    const top = M.floors[F - 1];
    [...top.lines.filter(l => l.ext), ...top.abiertos].forEach(l => {
      const m = l.o === 'H' ? addBox(G[5], l.a - 0.075, l.b + 0.075, l.c - 0.075, l.c + 0.075, Lt, Lt + 0.9, mt.bruto, F, { ext: true, techo: true }) : addBox(G[5], l.c - 0.075, l.c + 0.075, l.a - 0.075, l.b + 0.075, Lt, Lt + 0.9, mt.bruto, F, { ext: true, techo: true });
      if (m) T3.muros.push({ m, cara: caraExterior(l, R) });
    });
  } else if (Tt.tipo === 'plana') {
    addBox(G[5], Rt.x0, Rt.x1, Rt.y0, Rt.y1, Lt, Lt + 0.02, mt.membrana, F, { techo: true });
    [[Rt.x0, Rt.x1, Rt.y0, Rt.y0 + 0.15, 4], [Rt.x0, Rt.x1, Rt.y1 - 0.15, Rt.y1, 5], [Rt.x0, Rt.x0 + 0.15, Rt.y0, Rt.y1, 1], [Rt.x1 - 0.15, Rt.x1, Rt.y0, Rt.y1, 0]]
      .forEach(([a, b, c, d, cara]) => { const m = addBox(G[5], a, b, c, d, Lt, Lt + 0.9, mt.bruto, F, { ext: true, techo: true }); if (m) T3.muros.push({ m, cara }); });
  } else {
    const dz = z0;
    Tt.caras.forEach(cara => {
      const p = cara.pts, pos = [], uv = [];
      // u a lo largo del alero, v por la pendiente (en metros)
      const ex = [p[1][0] - p[0][0], p[1][1] - p[0][1]], el = Math.hypot(...ex) || 1, ux = ex[0] / el, uy = ex[1] / el;
      const tri = (i, j, k) => [p[i], p[j], p[k]].forEach(q => {
        pos.push(q[0], q[2] + dz + 0.02, -q[1]);
        const dx = q[0] - p[0][0], dy = q[1] - p[0][1];
        uv.push(dx * ux + dy * uy, Math.hypot(dx * -uy + dy * ux, q[2] - p[0][2]));
      });
      tri(0, 1, 2); if (p.length === 4) tri(0, 2, 3);
      const m = malla(pos, uv, mt.teja, { fl: F, techo: true });
      G[5].add(m);
    });
    // aleros: sofito, fascia y canal de cada cubierta (en la casa de patio, una por ala); culatas en los extremos
    (Tt.partes ? Tt.partes.map((t, i) => [t, Tt.alas[i]]) : [[Tt, Rt]]).forEach(([T, Ra]) => {
      const E = T.E;
      [[E.x0, E.x1, E.y0, Ra.y0], [E.x0, E.x1, Ra.y1, E.y1], [E.x0, Ra.x0, Ra.y0, Ra.y1], [Ra.x1, E.x1, Ra.y0, Ra.y1]].forEach(([a, b, c, d]) => {
        if (!(b - a > 0.01 && d - c > 0.01)) return;
        if (mt.listones) { listones(G[5], a, b, c, d, T.zA + dz - 0.03, mt.listones, mt.fondoListones, { fl: F, techo: true }); return; }
        const m = new THREE.Mesh(planoM(a, b, c, d, T.zA + dz - 0.03), mt.sofito); m.userData = { fl: F, techo: true }; G[5].add(m);
      });
      const bajos = T.tipo === 'dos' ? (T.dir === 'x' ? [[E.x0, E.x1, E.y0, E.y0], [E.x0, E.x1, E.y1, E.y1]] : [[E.x0, E.x0, E.y0, E.y1], [E.x1, E.x1, E.y0, E.y1]]) : [[E.x0, E.x1, E.y0, E.y0], [E.x0, E.x1, E.y1, E.y1], [E.x0, E.x0, E.y0, E.y1], [E.x1, E.x1, E.y0, E.y1]];
      bajos.forEach(([a, b, c, d]) => addBox(G[5], a - 0.04, b + 0.04, c - 0.06, d + 0.06, T.zA + dz - 0.16, T.zA + dz + 0.02, mt.canal, F, { techo: true }));
    });
    // la bajante llega al suelo o a la terraza del piso de abajo, si cae sobre ella
    const pieBajante = (x, y) => {
      for (let g = F - 2; g >= 0; g--) { const Rg = M.floors[g].R; if (x > Rg.x0 && x < Rg.x1 && y > Rg.y0 && y < Rg.y1) return dl + (g + 1) * fh + z0; }
      return dl;
    };
    Tt.bajantes.forEach(([x, y]) => {
      const z0b = pieBajante(x, y), h = Tt.zA + dz - z0b;
      if (h < 0.1) return;
      const b = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, h, 8), mt.canal); b.position.set(x, z0b + h / 2, -y); b.userData = { fl: 0 }; G[5].add(b);
    });
    Tt.timpanos.forEach(tp => {
      const pos = [], uv = [];
      [...tp.pts, ...tp.pts.slice().reverse()].forEach(q => { pos.push(q[0], q[2] + dz, -q[1]); uv.push(q[0] + q[1], q[2]); });
      const m = malla(pos, uv, mt.bruto, { fl: F - 1, culata: true });
      m.material = mt.bruto;
      G[5].add(m);
      T3.culatas.push(m);
    });
  }

  // 6-7 cielos rasos (solo se ven desde adentro)
  M.floors.forEach(fl => fl.rects.forEach(r => {
    if (r.stair) return;
    const zc = dl + fl.f * fh + z0 + fh - sl - 0.01;
    // en las zonas sociales, cielo en listones de madera si se escogió
    if (mt.listones && r.zone === 'social' && !/bano|cocina/.test(r.tipo || '')) { listones(G[7], r.x0, r.x1, r.y0, r.y1, zc, mt.listones, mt.fondoListones, { fl: fl.f, cieloListones: true }); return; }
    const m = new THREE.Mesh(planoM(r.x0, r.x1, r.y0, r.y1, zc), mt.cielo);
    m.userData = { fl: fl.f };
    G[7].add(m);
  }));

  // 8 pisos y enchapes
  M.floors.forEach(fl => {
    const L0 = dl + fl.f * fh + z0;
    fl.rects.forEach(r => {
      if (r.stair) return;
      const p = PISOS[pisoDe(r, fl.f, S)] || PISOS.porc;
      const pIn = fl.f === 0 && M.exterior?.piscina?.interior ? M.exterior.piscina : null;
      const huecoP = pIn ? { x0: pIn.x0 - 0.3, x1: pIn.x1 + 0.3, y0: pIn.y0 - 0.3, y1: pIn.y1 + 0.3 } : null;
      sinHueco({ x0: r.x0 + 0.06, x1: r.x1 - 0.06, y0: r.y0 + 0.06, y1: r.y1 - 0.06 }, huecoP).forEach(q => {
        const m = new THREE.Mesh(planoM(q.x0, q.x1, q.y0, q.y1, L0 + 0.02), matPiso(p));
        m.receiveShadow = true; m.userData = { fl: fl.f, piso: `${fl.f + 1}:${r.name}`, espacio: r.name };
        G[8].add(m);
      });
      if (!/bano/.test(r.tipo || '')) return;
      // enchape de baño hasta 2.0 m, sin tapar puertas ni ventanas
      const lados = [['H', r.y0, r.x0, r.x1, 1], ['H', r.y1, r.x0, r.x1, -1], ['V', r.x0, r.y0, r.y1, 1], ['V', r.x1, r.y0, r.y1, -1]];
      lados.forEach(([o, c, a, b, s]) => {
        const Rf = fl.R || R, t = (near(c, o === 'H' ? Rf.y0 : Rf.x0) || near(c, o === 'H' ? Rf.y1 : Rf.x1)) ? 0.1 : 0.06;
        const ops = fl.ops.filter(op => op.o === o && near(op.c, c) && op.b > a && op.a < b);
        let tramos = [[a + t, b - t, 2.0]];
        ops.forEach(op => {
          const nt = [];
          tramos.forEach(([p0, p1, h]) => {
            if (op.b <= p0 || op.a >= p1) { nt.push([p0, p1, h]); return; }
            if (op.a > p0) nt.push([p0, op.a, h]);
            if (op.kind === 'win') nt.push([Math.max(p0, op.a), Math.min(p1, op.b), Math.min(h, op.sill)]);
            if (op.b < p1) nt.push([op.b, p1, h]);
          });
          tramos = nt;
        });
        tramos.forEach(([p0, p1, h]) => {
          if (p1 - p0 < 0.05 || h < 0.1) return;
          const off = c + s * (t + 0.004);
          const ud = { enchape: true, espacio: r.name };
          const m2 = o === 'H' ? addBox(G[8], p0, p1, off - 0.004, off + 0.004, L0 + 0.02, L0 + h, mt.enchape, fl.f, ud) : addBox(G[8], off - 0.004, off + 0.004, p0, p1, L0 + 0.02, L0 + h, mt.enchape, fl.f, ud);
          if (m2) m2.castShadow = false;
        });
      });
    });
  });

  // 9 carpinteria, ascensor y muebles de obra
  M.floors.forEach(fl => {
    const L0 = dl + fl.f * fh + z0;
    fl.ops.forEach(o => {
      if (o.kind === 'win') {
        if (o.mirador) return;          // el mirador lleva vidrio curvo (más abajo)
        const z1 = L0 + o.sill, z2 = z1 + o.h, H = o.o === 'H';
        const bx = (a, b, c0, c1, za, zb, m) => (H ? addBox(G[9], a, b, o.c + c0, o.c + c1, za, zb, m, fl.f) : addBox(G[9], o.c + c0, o.c + c1, a, b, za, zb, m, fl.f));
        const luz = (Math.round(o.a * 7 + o.c * 13) + fl.f * 3) % 4 !== 0;
        bx(o.a, o.b, -0.015, 0.015, z1, z2, luz ? mt.ventana : mt.vidrio);
        bx(o.a, o.b, -0.04, 0.04, z1, z1 + 0.05, mt.marco); bx(o.a, o.b, -0.04, 0.04, z2 - 0.05, z2, mt.marco);
        bx(o.a, o.a + 0.05, -0.04, 0.04, z1, z2, mt.marco); bx(o.b - 0.05, o.b, -0.04, 0.04, z1, z2, mt.marco);
        const np = Math.max(o.w > 1.1 ? 2 : 1, Math.round(o.w / 1.25));
        for (let k = 1; k < np; k++) { const mm = o.a + o.w * k / np; bx(mm - 0.025, mm + 0.025, -0.04, 0.04, z1, z2, mt.marco); }
        bx(o.a - 0.05, o.b + 0.05, -0.13, 0.13, z1 - 0.03, z1, mt.conc);
      } else if (o.kind === 'asc') {
        const H = o.o === 'H';
        [[o.a, (o.a + o.b) / 2], [(o.a + o.b) / 2, o.b]].forEach(([a, b]) => { const m = H ? addBox(G[9], a + 0.01, b - 0.01, o.c - 0.02, o.c + 0.02, L0, L0 + o.h, mt.acero, fl.f) : null; if (m) (T3.puertasAsc ||= []).push({ m, f: fl.f }); });
      } else {
        const g = doorGeom(o), ang = 1.25, w = o.w - 0.04;
        const dx = Math.cos(ang) * g.u.x + Math.sin(ang) * g.n.x, dy = Math.cos(ang) * g.u.y + Math.sin(ang) * g.n.y;
        const leaf = new THREE.Mesh(cajaM(w, o.h - 0.04, 0.045), o.kind === 'main' ? mt.puertaP : mt.madera);
        leaf.position.set(g.h.x + dx * w / 2, L0 + 0.02 + (o.h - 0.04) / 2, -(g.h.y + dy * w / 2));
        leaf.rotation.y = Math.atan2(dy, dx);
        leaf.castShadow = true; leaf.userData = { fl: fl.f };
        G[9].add(leaf);
      }
    });
  });
  if (M.asc) {
    const a = M.asc;
    const cab = new THREE.Group();
    const bx = (x0, x1, y0, y1, za, zb, m) => addBox(cab, x0, x1, y0, y1, za, zb, m, 0);
    bx(a.x0 + 0.2, a.x1 - 0.2, a.y0 + 0.25, a.y1 - 0.2, 0, 0.05, mt.acero);
    bx(a.x0 + 0.2, a.x1 - 0.2, a.y1 - 0.25, a.y1 - 0.2, 0.05, 2.2, mt.vidrio);
    bx(a.x0 + 0.2, a.x0 + 0.25, a.y0 + 0.25, a.y1 - 0.2, 0.05, 2.2, mt.acero);
    bx(a.x1 - 0.25, a.x1 - 0.2, a.y0 + 0.25, a.y1 - 0.2, 0.05, 2.2, mt.acero);
    bx(a.x0 + 0.2, a.x1 - 0.2, a.y0 + 0.25, a.y1 - 0.2, 2.2, 2.25, mt.acero);
    cab.position.y = dl + z0;
    cab.userData = { fl: 0, cabina: true };
    G[9].add(cab);
    T3.cabina = cab;
  } else T3.cabina = null;

  // terrazas de los pisos que retroceden y balcones: losa, piso exterior, baranda de vidrio y materas
  const pisoExt = mt.pisoExt;
  const baranda = (fl, br, mid, z) => {
    const s = br.c < mid ? 1 : -1, c = br.c + s * 0.06, H = br.o === 'H';
    const bx = (a, b, c0, c1, za, zb, m) => (H ? addBox(G[9], a, b, c0, c1, za, zb, m, fl) : addBox(G[9], c0, c1, a, b, za, zb, m, fl));
    bx(br.a, br.b, c - 0.012, c + 0.012, z + 0.1, z + 0.95, mt.vidrio);
    bx(br.a, br.b, c - 0.03, c + 0.03, z + 0.95, z + 1.0, mt.acero);
    const n = Math.max(1, Math.round((br.b - br.a) / 1.2));
    for (let k = 0; k <= n; k++) { const p = br.a + (br.b - br.a) * k / n; bx(p - 0.025, p + 0.025, c - 0.025, c + 0.025, z, z + 1.0, mt.acero); }
  };
  (M.terrazas || []).forEach(t => {
    const z = dl + t.f * fh + z0, A = M.floors[t.f - 1].R;
    t.zonas.forEach(zn => {
      const m = new THREE.Mesh(planoM(zn.x0 + 0.02, zn.x1 - 0.02, zn.y0 + 0.02, zn.y1 - 0.02, z + 0.02), pisoExt);
      m.receiveShadow = true; m.userData = { fl: t.f };
      G[8].add(m);
      if (!M.dotacionVisible) return;
      // materas junto a la baranda, cada 3 m en el lado largo
      const largoX = zn.x1 - zn.x0 >= zn.y1 - zn.y0, L = largoX ? zn.x1 - zn.x0 : zn.y1 - zn.y0, n = Math.max(1, Math.floor(L / 3));
      for (let k = 0; k < n; k++) {
        const u = (largoX ? zn.x0 : zn.y0) + L * (k + 0.5) / n;
        const [x, y] = largoX ? [u, near(zn.y0, A.y0) ? zn.y0 + 0.45 : zn.y1 - 0.45] : [near(zn.x0, A.x0) ? zn.x0 + 0.45 : zn.x1 - 0.45, u];
        addBox(G[10], x - 0.45, x + 0.45, y - 0.2, y + 0.2, z, z + 0.45, mt.conc, t.f);
        const a = new THREE.Mesh(new THREE.IcosahedronGeometry(0.34, 1), material('m|arbusto', () => std(0x4a7339, 0.85)));
        a.position.set(x, z + 0.68, -y); a.scale.set(1.25, 0.85, 0.7); a.castShadow = true; a.userData = { fl: t.f };
        G[10].add(a);
      }
    });
    t.barandas.forEach(br => baranda(t.f, br, br.o === 'H' ? (A.y0 + A.y1) / 2 : (A.x0 + A.x1) / 2, z));
  });
  // casa de patio: baranda del corredor en los pisos de arriba, piso del patio y un árbol en el centro
  if (M.compuesta) {
    M.floors.forEach(fl => { if (fl.f > 0) fl.abiertos.forEach(a => baranda(fl.f, a, a.c + a.s, dl + fl.f * fh + z0)); });
    M.compuesta.patios.forEach(pt => {
      const m = new THREE.Mesh(planoM(pt.x0, pt.x1, pt.y0, pt.y1, dl + 0.01), pisoExt);
      m.receiveShadow = true; m.userData = { fl: 0 };
      G[8].add(m);
      if (M.dotacionVisible && Math.min(pt.w, pt.h) >= 3) {
        const t = arbol(Math.min(5.5, 2.8 + Math.min(pt.w, pt.h) * 0.25), 3);
        t.position.set((pt.x0 + pt.x1) / 2, dl, -(pt.y0 + pt.y1) / 2);
        t.userData = { fl: 0 };
        G[10].add(t);
        addBox(G[10], (pt.x0 + pt.x1) / 2 - 0.7, (pt.x0 + pt.x1) / 2 + 0.7, (pt.y0 + pt.y1) / 2 - 0.7, (pt.y0 + pt.y1) / 2 + 0.7, dl, dl + 0.35, mt.conc, 0);
      }
    });
  }
  // piezas curvas: losa de un polígono en planta y tramos rectos girados que siguen la curva
  const losaCurva = (g, pts, za, zb, mat, fl) => {
    const sh = new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y)));
    const geo = new THREE.ExtrudeGeometry(sh, { depth: zb - za, bevelEnabled: false, curveSegments: 1 }).rotateX(-Math.PI / 2);
    const m = new THREE.Mesh(geo, mat);
    m.position.y = za; m.castShadow = true; m.receiveShadow = true; m.userData = { fl, own: false };
    g.add(m);
    return m;
  };
  const tramo = (g, a, b, za, zb, t, mat, fl) => {
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (L < 0.005) return;
    const m = new THREE.Mesh(cajaM(L, zb - za, t), mat);
    m.position.set((a[0] + b[0]) / 2, (za + zb) / 2, -(a[1] + b[1]) / 2);
    m.rotation.y = Math.atan2(b[1] - a[1], b[0] - a[0]);
    m.castShadow = true; m.userData = { fl };
    g.add(m);
  };
  const mediaElipse = (cx, cy, rx, ry, n = 24) => Array.from({ length: n + 1 }, (_, k) => [cx + rx * Math.cos(Math.PI + Math.PI * k / n), cy - ry * Math.sin(Math.PI * k / n)]);
  const barandaCurva = (pts, z, fl) => {
    for (let k = 1; k < pts.length; k++) { tramo(G[9], pts[k - 1], pts[k], z + 0.1, z + 0.95, 0.024, mt.vidrio, fl); tramo(G[9], pts[k - 1], pts[k], z + 0.95, z + 1.0, 0.06, mt.acero, fl); }
    pts.forEach((p, k) => { if (k % 4 === 0) addBox(G[9], p[0] - 0.025, p[0] + 0.025, p[1] - 0.025, p[1] + 0.025, z, z + 1.0, mt.acero, fl); });
  };
  (M.balcones || []).forEach(b => {
    const z = dl + b.f * fh + z0;
    if (b.curvo) {
      const arco = mediaElipse((b.x0 + b.x1) / 2, b.y1, (b.x1 - b.x0) / 2, b.y1 - b.y0);
      losaCurva(G[3], arco, z - sl, z, madera ? mt.losa : mt.conc, b.f);
      losaCurva(G[8], arco, z, z + 0.02, pisoExt, b.f);
      barandaCurva(arco.map(([x, y], k) => [x, y + (k === 0 || k === arco.length - 1 ? 0 : 0.06)]), z, b.f);
      return;
    }
    addBox(G[3], b.x0, b.x1, b.y0, b.y1, z - sl, z, madera ? mt.losa : mt.conc, b.f);
    const m = new THREE.Mesh(planoM(b.x0 + 0.02, b.x1 - 0.02, b.y0 + 0.02, b.y1 - 0.02, z + 0.02), pisoExt);
    m.receiveShadow = true; m.userData = { fl: b.f };
    G[8].add(m);
    b.barandas.forEach(br => baranda(b.f, br, br.o === 'H' ? (b.y0 + b.y1) / 2 : (b.x0 + b.x1) / 2, z));
  });
  // mirador: media vuelta de vidrio de piso a techo con parales, su losa, su piso y su techo
  (M.miradores || []).forEach(md => {
    const z = dl + md.f * fh + z0, arco = mediaElipse(md.cx, md.cy, md.r, md.r, 28);
    const r = M.floors[md.f].rects.find(x => x.name === md.room);
    losaCurva(G[2], arco, z - 0.08, z, mt.conc, md.f);
    if (r) losaCurva(G[8], arco, z, z + 0.02, matPiso(PISOS[pisoDe(r, md.f, S)] || PISOS.porc), md.f);
    losaCurva(G[3], arco, z + md.h, z + md.h + 0.14, madera ? mt.losa : mt.conc, md.f);
    for (let k = 1; k < arco.length; k++) {
      tramo(G[9], arco[k - 1], arco[k], z + 0.02, z + md.h, 0.03, mt.vidrio, md.f);
      tramo(G[9], arco[k - 1], arco[k], z + 0.02, z + 0.08, 0.07, mt.marco, md.f);
      tramo(G[9], arco[k - 1], arco[k], z + md.h - 0.06, z + md.h, 0.07, mt.marco, md.f);
    }
    arco.forEach((p, k) => { if (k % 4 === 0) addBox(G[9], p[0] - 0.03, p[0] + 0.03, p[1] - 0.03, p[1] + 0.03, z + 0.02, z + md.h, mt.marco, md.f); });
  });

  // muebles: los de obra en la fase 9; la dotacion, cortinas y jardin en la 10
  T3.muebles = [];
  M.muebles.forEach(it => {
    const esObra = OBRA.has(it.tipo);
    if (!esObra && !M.dotacionVisible) return;
    const g = mueble(it);
    g.position.set(it.x, dl + it.f * fh + z0 + 0.025, -it.y);
    g.rotation.y = it.rot * Math.PI / 180 + Math.PI;
    const colgado = it.tipo === 'cuadro'; // va colgado en el muro: en la casa abierta quedaría flotando
    g.traverse(o => { o.userData.fl = it.f; if (colgado) o.userData.colgado = true; });
    g.userData = { fl: it.f, mueble: it.id, colgado };
    (esObra ? G[9] : G[10]).add(g);
    T3.muebles.push(g);
  });
  if (M.dotacionVisible) {
    M.floors.forEach(fl => fl.ops.forEach(o => {
      if (o.kind !== 'win') return;
      const r = fl.rects.find(x => x.name === o.room);
      if (!r || !/sala|estar|comedor|alcoba|estudio/.test(r.tipo || '')) return;
      const L0 = dl + fl.f * fh + z0, alto = Math.min(fh - sl - 0.08, o.sill + o.h + 0.35);
      const c = cortina(o.w, alto);
      const Rf = fl.R || R, ext = o.o === 'H' ? (near(o.c, Rf.y0) ? 1 : -1) : (near(o.c, Rf.x0) ? 1 : -1);
      if (o.o === 'H') { c.position.set((o.a + o.b) / 2, L0 + 0.03, -(o.c + ext * 0.16)); }
      else { c.position.set(o.c + ext * 0.16, L0 + 0.03, -(o.a + o.b) / 2); c.rotation.y = Math.PI / 2; }
      c.traverse(x => { x.userData.fl = fl.f; x.userData.colgado = true; });
      G[10].add(c);
    }));
    // jardin: anden a la puerta, arboles y arbustos
    const main = M.floors[0].ops.find(o => o.kind === 'main');
    if (main) addBox(G[10], (main.a + main.b) / 2 - 0.7, (main.a + main.b) / 2 + 0.7, M.P.y0, R.y0, dl, dl + 0.04, mt.anden, 0);
    const cx = (M.bbox.minx + M.bbox.maxx) / 2;
    const sitios = [[M.bbox.minx + 1.6, M.bbox.miny + 1.6], [M.bbox.maxx - 1.6, M.bbox.miny + 1.6], [M.bbox.minx + 1.6, M.bbox.maxy - 1.6], [M.bbox.maxx - 1.6, M.bbox.maxy - 1.6], [cx, M.bbox.maxy - 1.4]];
    sitios.forEach(([x, y], k) => {
      if (x > M.P.x0 - 0.5 && x < M.P.x1 + 0.5 && y > M.P.y0 - 0.5 && y < M.P.y1 + 0.5) return;
      const t = arbol(3.8 + (k % 3), k + 1);
      t.position.set(x, M.zf(x, y), -y);
      t.userData = { fl: 0 };
      G[10].add(t);
    });
    for (let x = R.x0 + 0.5; x < R.x1 - 0.4; x += 0.9) {
      if (main && x > main.a - 0.9 && x < main.b + 0.9) continue;
      const a = new THREE.Mesh(new THREE.IcosahedronGeometry(0.32, 1), material('m|arbusto', () => std(0x4a7339, 0.85)));
      a.position.set(x, dl + 0.28, -(R.y0 - 0.45)); a.scale.set(1, 0.8, 1); a.castShadow = true; a.userData = { fl: 0 };
      G[10].add(a);
    }
  }
  T3.exterior = construirExterior(root, G, M, S, mt);
  T3.root = root;
  T3.scene.add(root);
  aplicarNoche(T3, !!T3.noche, M);
  if (!T3.noche) temaEscena(T3.tema);

  // camara y sol
  const cx = (R.x0 + R.x1) / 2, cy = (R.y0 + R.y1) / 2, size = Math.max(M.bbox.w, M.bbox.h, 12);
  // la cámara arranca encuadrando la casa (no todo el lote), para que se vea grande; con la rueda se aleja
  const sCasa = Math.max(R.w, R.h, F * fh * 1.4, 8);
  // vista de tres cuartos desde el frente, baja, para que se vea la casa con su cielo
  // entre medianeras la vista es casi de frente: de lado, el vecino tapa media fachada
  const lado = T3.exterior?.cuadra === 'medianera' ? 0.32 : 0.95;
  if (!T3.framed) { T3.cam.position.set(cx + sCasa * lado, dl + sCasa * 0.42 + F * fh * 0.2, -cy + sCasa * (lado < 0.5 ? 1.5 : 1.3)); T3.framed = true; }
  T3.ctl.target.set(cx, dl + F * fh * 0.4, -cy);
  T3.ctl.update();
  const sh = T3.sun.shadow.camera;
  sh.left = -size; sh.right = size; sh.top = size; sh.bottom = -size; sh.near = 1; sh.far = size * 6;
  sh.updateProjectionMatrix();
  T3.sun.position.set(cx + DIR_SOL.x * size * 2, dl + DIR_SOL.y * size * 2, -cy + DIR_SOL.z * size * 2);
  T3.sun.target.position.set(cx, dl, -cy);
  $('#floorSel').innerHTML = `<option value="99">${tr({ es: 'Todo', en: 'All' })}</option>` + [...Array(F)].map((_, i) => `<option value="${i}">${tr({ es: 'Piso', en: 'Floor' })} ${i + 1}</option>`).join('');
  if (app.viewFloor < 99 && app.viewFloor >= F) app.viewFloor = 99;
  $('#floorSel').value = app.viewFloor;
  applyPhase();
  T3.alReconstruir?.();
  compilarEnSegundoPlano();
}

/** De día o de noche (con luces interiores, fachada iluminada, postes y piscina). */
export function nocheEscena(on) {
  if (!ensure3D()) return;
  if (app.threeDirty) buildScene();
  aplicarNoche(T3, on, app.M);
  if (!on) temaEscena(T3.tema);
  $('#nocheBtn')?.setAttribute('aria-pressed', !!on);
  render3D();
}

export function applyPhase() {
  const M = app.M, phase = app.phase, FS = fases();
  $('#phaseRange').max = FS.length - 1;
  $('#phaseRange').value = phase;
  const cat = FS[phase].cat;
  $$('[data-cat]').forEach(b => b.setAttribute('aria-pressed', b.dataset.cat === cat));
  $('#phaseList').innerHTML = FS.map((p, i) => `<button class="ph c-${p.cat} ${i === phase ? 'on' : i < phase ? 'done' : ''}" data-ph="${i}"><em>${i < phase ? '✓ ' : ''}${nombreCategoria(app.S.pais, p.cat === 'dot' ? 'dot' : p.cat)}</em><span style="color:var(--fg)">${i + 1}. ${p.n}</span></button>`).join('');
  if (!T3.root || !M || M.err) return;
  const mt = T3.mat;
  T3.root.children.forEach(g => { if (g.userData.phase === undefined) return; const i = g.userData.phase; g.visible = i === 0 ? phase === 0 : i <= phase; });
  T3.tGraded.material.opacity = phase === 2 ? 0.35 : 1;
  T3.tGraded.material.depthWrite = phase !== 2;
  if (phase >= 10 && M.dotacionVisible) { T3.tGraded.material = mt.pasto; } else if (T3.tGraded.material === mt.pasto) {
    T3.tGraded.material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, transparent: true, opacity: 1, side: THREE.DoubleSide });
    T3.tGraded.userData.own = true;
  }
  // muros por fase: bruto → pañete → acabado (pintura adentro, fachada afuera)
  const ext = phase >= 7 ? mt.fachada : phase >= 6 ? mt.panete : mt.bruto;
  const int = phase >= 7 ? mt.pinturaI : phase >= 6 ? (M.sistema === 'madera' ? mt.drywall : mt.panete) : mt.bruto;
  // fachada mixta: el primer piso con su propio revestimiento (piedra, ladrillo…) y los de arriba con el de la fachada
  const ext0 = phase >= 7 && mt.fachadaBase ? mt.fachadaBase : ext;
  T3.muros.forEach(({ m, cara }) => {
    if (cara < 0) { m.material = int; return; }
    const arr = [int, int, int, int, int, int];
    arr[cara] = m.userData.fl === 0 ? ext0 : ext;
    m.material = arr;
  });
  T3.culatas.forEach(m => { m.material = ext; });
  const em = phase >= 7 ? mt.fachada : phase >= 6 ? mt.panete : mt.conc;
  T3.estructura.forEach(m => { m.material = m.userData.fl === 0 && phase >= 7 && mt.fachadaBase ? mt.fachadaBase : em; });
  T3.root.traverse(o => {
    if (o.userData.fl === undefined || o.userData.terrain) return;
    let vis = o.userData.fl <= app.viewFloor;
    if (T3.sinTecho && (o.userData.techo || o.userData.culata)) vis = false;
    if (T3.sinTecho && app.viewFloor < 99 && o.userData.fl > app.viewFloor) vis = false;
    if (T3.abierta && (o.userData.techo || o.userData.culata || o.userData.colgado || o.userData.fl > pisoAbierto())) vis = false;
    // el cielo en listones se ve desde adentro; desde arriba (sin techo o casa abierta) taparía los espacios
    if ((T3.sinTecho || T3.abierta) && o.userData.cieloListones) vis = false;
    if (o.isMesh || o.isGroup) o.visible = vis || o.userData.phase !== undefined;
  });
  const Q = M.quant;
  const info = [
    tr({ es: `Terreno · corte ${fm(M.cut, 1)} m³ / relleno ${fm(M.fill, 1)} m³`, en: `Site · cut ${fm(M.cut, 1)} m³ / fill ${fm(M.fill, 1)} m³` }),
    tr({ es: `Plataforma N±0.00 = ${fm(M.dl)} m`, en: `Platform ±0.00 = ${fm(M.dl)} m` }),
    tr({ es: `Cimentación · ${fm(Q.concFund, 1)} m³ de concreto`, en: `Foundation · ${fm(Q.concFund, 1)} m³ concrete` }),
    M.sistema === 'madera' ? tr({ es: 'Entrepisos y estructura de madera', en: 'Floor systems and framing' }) : tr({ es: `Estructura · ${fm(Q.concStr, 1)} m³ de concreto`, en: `Structure · ${fm(Q.concStr, 1)} m³ concrete` }),
    tr({ es: `${fmtA(Q.mamp)} de muros`, en: `${fmtA(Q.mamp)} of walls` }),
    tr({ es: `Cubierta ${fmtA(M.techo.area)}`, en: `Roof ${fmtA(M.techo.area)}` }),
    tr({ es: `${fmtA(Q.pan)} de pañete o revestimiento`, en: `${fmtA(Q.pan)} of rough finish` }),
    tr({ es: `${fmtA(Q.est + Q.cielo)} de pintura y cielos`, en: `${fmtA(Q.est + Q.cielo)} of paint and ceilings` }),
    tr({ es: `${fmtA(Q.Apiso)} de piso · ${fmtA(Q.Aench)} de enchape`, en: `${fmtA(Q.Apiso)} of flooring · ${fmtA(Q.Aench)} of tile` }),
    tr({ es: `${Q.nDoor} puertas · ${fmtA(Q.Awin)} de ventanas`, en: `${Q.nDoor} doors · ${fmtA(Q.Awin)} of windows` }),
    tr({ es: `${M.muebles.length} muebles y aparatos · estilo ${ESTILOS[app.S.acabados.estilo]?.n[app.S.idioma] || ''}`, en: `${M.muebles.length} furniture pieces · ${ESTILOS[app.S.acabados.estilo]?.n.en || ''} style` }),
  ][phase];
  $('#hud').textContent = `${tr({ es: 'FASE', en: 'PHASE' })} ${phase + 1}/${FS.length} · ${FS[phase].n.toUpperCase()} · ${info}`
    + (T3.abierta ? ` · ${tr({ es: `CASA ABIERTA · PISO ${pisoAbierto() + 1}`, en: `DOLLHOUSE · FLOOR ${pisoAbierto() + 1}` })}` : '');
  aplicarCorte();
  render3D();
}

/** Copia del modelo en la fase actual, sin terreno, centrada y a escala (AR y exportes). */
export function modeloParaLlevar(escala = 1) {
  if (!T3.root) return null;
  const M = app.M, c = T3.root.clone(true);
  const quitar = [];
  c.traverse(o => { if (o.userData.terrain || !o.visible) quitar.push(o); });
  quitar.forEach(o => o.parent?.remove(o));
  const w = new THREE.Group();
  c.position.set(-(M.R.x0 + M.R.x1) / 2, -M.dl, (M.R.y0 + M.R.y1) / 2);
  w.add(c);
  w.scale.setScalar(escala);
  return w;
}

/** Imagen del 3D (portada del juego de planos y ventas). */
export function capturar({ w = 1600, h = 1000, vista = 'exterior' } = {}) {
  if (!ensure3D()) return null;
  if (app.threeDirty) buildScene();
  const M = app.M, r = T3.renderer, cam = T3.cam.clone();
  const fase = app.phase, piso = app.viewFloor, sin = T3.sinTecho, actual = vista === 'actual';
  if (!actual) { app.phase = 10; app.viewFloor = 99; T3.sinTecho = vista === 'interior'; applyPhase(); }
  const R = M.R, cx = (R.x0 + R.x1) / 2, cy = (R.y0 + R.y1) / 2, s = Math.max(R.w, R.h);
  cam.aspect = w / h;
  if (actual) { /* la cámara tal como la dejó el usuario */ }
  else if (vista === 'interior') { cam.position.set(cx + s * 0.35, M.dl + s * 1.25, -cy + s * 0.55); cam.lookAt(cx, M.dl, -cy); }
  else { cam.position.set(cx + s * 0.95, M.dl + s * 0.42, -(R.y0 - s * 1.15)); cam.lookAt(cx, M.dl + M.F * M.fh * 0.45, -cy); }
  cam.updateProjectionMatrix();
  const prev = new THREE.Vector2(); r.getSize(prev);
  const fondo = T3.scene.background, niebla = T3.scene.fog;
  const degradado = !T3.noche && !T3.cieloDia;
  if (degradado) { T3.scene.background = cielo('claro'); T3.scene.fog = new THREE.Fog(0xe9eef3, 120, 420); }
  const pr = r.getPixelRatio();
  r.setPixelRatio(1);
  r.setSize(w, h, false);
  let comp = null;
  if (calidadAlta()) { try { comp = nuevoComposer(r, T3.scene, cam, w, h); } catch { comp = null; } }
  if (comp) comp.render(); else r.render(T3.scene, cam);
  const url = r.domElement.toDataURL('image/jpeg', 0.9);
  comp?.dispose?.();
  if (degradado) T3.scene.background.dispose();
  T3.scene.background = fondo; T3.scene.fog = niebla;
  r.setPixelRatio(pr);
  r.setSize(prev.x, prev.y, false);
  if (!actual) { app.phase = fase; app.viewFloor = piso; T3.sinTecho = sin; applyPhase(); } else render3D();
  return url;
}

/** La foto realista está pensada para computadores (en el celular sale la foto normal). */
export const fotoRealDisponible = () => calidadAlta();

/** Acorta de verdad los muros cortados (el trazador de rayos no usa planos de corte). Devuelve cómo deshacerlo. */
function recortarParaFoto() {
  const deshacer = [], y = planoCorte.constant, b = new THREE.Box3();
  T3.root.traverse(o => {
    if (!o.isMesh || !o.visible) return;
    const mats = [].concat(o.material);
    if (!mats.some(x => x?.clippingPlanes?.includes(planoCorte))) return;
    b.setFromObject(o);
    if (b.max.y <= y + 1e-4) return;
    if (b.min.y >= y - 1e-4) { o.visible = false; deshacer.push(() => { o.visible = true; }); return; }
    const esc = o.scale.y, pos = o.position.y, k = (y - b.min.y) / (b.max.y - b.min.y);
    o.scale.y = esc * k; o.updateMatrixWorld(true);
    const b2 = new THREE.Box3().setFromObject(o);
    o.position.y += b.min.y - b2.min.y; o.updateMatrixWorld(true);
    deshacer.push(() => { o.scale.y = esc; o.position.y = pos; o.updateMatrixWorld(true); });
  });
  return deshacer;
}

/**
 * Prepara la escena para una foto (realista o normal) con la cámara de la vista pedida.
 * vista: 'exterior', 'interior' (sin techo, desde arriba) o 'actual' (la cámara del usuario; respeta la casa abierta).
 */
export function escenaParaFoto({ w = 1600, h = 1000, vista = 'exterior' } = {}) {
  if (!ensure3D()) return null;
  if (app.threeDirty) buildScene();
  const M = app.M, cam = T3.cam.clone(), actual = vista === 'actual';
  const fase = app.phase, piso = app.viewFloor, sin = T3.sinTecho;
  if (!actual) { app.phase = 10; app.viewFloor = 99; T3.sinTecho = vista === 'interior'; applyPhase(); }
  const R = M.R, cx = (R.x0 + R.x1) / 2, cy = (R.y0 + R.y1) / 2, s = Math.max(R.w, R.h);
  if (vista === 'interior') { cam.position.set(cx + s * 0.35, M.dl + s * 1.25, -cy + s * 0.55); cam.lookAt(cx, M.dl, -cy); }
  else if (!actual) { cam.position.set(cx + s * 0.95, M.dl + s * 0.42, -(R.y0 - s * 1.15)); cam.lookAt(cx, M.dl + M.F * M.fh * 0.45, -cy); }
  cam.aspect = w / h;
  cam.updateProjectionMatrix();
  const deshacer = T3.abierta && actual ? recortarParaFoto() : [];
  return {
    scene: T3.scene, cam,
    restaurar() {
      deshacer.reverse().forEach(f => f());
      if (!actual) { app.phase = fase; app.viewFloor = piso; T3.sinTecho = sin; applyPhase(); } else render3D();
    },
  };
}

/** Solo la envolvente exterior (para los lotes del condominio). */
export function cascaron() {
  if (!T3.root) return null;
  const g = new THREE.Group();
  const M = app.M;
  T3.root.children.forEach(ph => {
    const i = ph.userData.phase;
    if (i === undefined || i < 4 || i === 6 || i === 7 || i === 8) return;
    ph.traverse(o => {
      if (!o.isMesh) return;
      if (i === 4 && o.userData.ext !== true) return;
      if ((i === 9 || i === 10) && !(o.material === T3.mat.vidrio || o.material === T3.mat.ventana || o.material === T3.mat.marco || o.material === T3.mat.puertaP || o.userData.techo)) return;
      const c = o.clone();
      o.updateWorldMatrix(true, false);
      c.matrix.copy(o.matrixWorld); c.matrixAutoUpdate = false;
      g.add(c);
    });
  });
  const w = new THREE.Group();
  w.add(g);
  g.position.set(0, -M.dl, 0);
  return w;
}

/* ------------------------------------------------------------- editar en el 3D */
let ctxEditor = null;
/** La app le pasa cómo guardar un cambio y cómo mostrar precios. */
export function configurarEditor(ctx) { ctxEditor = ctx; }
/** Prende o apaga el modo Editar (sin argumento, lo alterna). */
export function editar3D(on) {
  if (!ctxEditor || !ensure3D()) return;
  if (on === false && !T3.editor) return;
  if (app.threeDirty) buildScene();
  T3.editor ||= crearEditor(T3, { ...ctxEditor, app, render3D, casaAbierta, aplicar: applyPhase });
  T3.editor.activar(on ?? !T3.editor.activo);
}

export function conectarControles3D() {
  $('#phaseRange').addEventListener('input', e => { app.phase = +e.target.value; applyPhase(); });
  $('#phaseList').addEventListener('click', e => { const b = e.target.closest('[data-ph]'); if (b) { app.phase = +b.dataset.ph; applyPhase(); } });
  $$('[data-cat]').forEach(b => b.addEventListener('click', () => { app.phase = { negra: 5, gris: 6, blanca: 9, dot: 10 }[b.dataset.cat]; applyPhase(); }));
  $('#floorSel').addEventListener('change', e => { app.viewFloor = +e.target.value; applyPhase(); });
  $('#spinBtn').addEventListener('click', e => { T3.spin = !T3.spin; e.target.setAttribute('aria-pressed', T3.spin); });
  $('#techoBtn').addEventListener('click', e => { T3.sinTecho = !T3.sinTecho; e.target.setAttribute('aria-pressed', T3.sinTecho); applyPhase(); });
  $('#abiertaBtn').addEventListener('click', () => casaAbierta(!T3.abierta));
  $('#nocheBtn')?.addEventListener('click', () => nocheEscena(!T3.noche));
  $('#editarBtn')?.addEventListener('click', () => editar3D());
}

export { fmtLu };
