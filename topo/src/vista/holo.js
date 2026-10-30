/* ==========================================================================
   AXIONA TOPO · Holograma del terreno con rayos X
   --------------------------------------------------------------------------
   El terreno sale de la red de triangulos (TIN) y se pinta con un shader
   de holograma: color por cota, brillo en los bordes (Fresnel), curvas de
   nivel calculadas en el propio pixel y una franja que barre las cotas.
   RAYOS X vuelve transparente la superficie y deja ver lo que no se ve
   desde afuera: el bloque de suelo con reglas de profundidad cada metro,
   la plataforma de la obra y la tierra que se corta (rojo) o se rellena
   (azul) para llegar a ella. El ESCANER es un plano que recorre el lote y
   va dibujando el perfil del terreno.
   El mismo modelo sirve para la pantalla, para la realidad aumentada en la
   palma de la mano y, con materiales simples, para el AR de iPhone.
   ========================================================================== */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { perfil, cotaEn } from '../motor/tin.js';
import { recortar } from '../motor/volumen.js';

const H = { r: null, escena: null, cam: null, ctl: null, raiz: null, escaner: null, D: null, opc: {}, alPerfil: null, activo: true, ultimoPerfil: 0, reloj: new THREE.Clock() };
export const holo = H;

const C = { cian: [0.247, 0.812, 1], menta: [0.255, 0.886, 0.643], ambar: [1, 0.682, 0.169], rosa: [1, 0.373, 0.471] };
const FONDO = 0x05080c;

/* ---------- shader del holograma ---------- */
const VERT = /* glsl */`
  attribute float aZ;
  varying float vZ;
  varying vec3 vN;
  varying vec3 vW;
  varying vec3 vL;
  void main() {
    vZ = aZ;
    vL = position;
    vec4 w = modelMatrix * vec4(position, 1.0);
    vW = w.xyz;
    vN = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * viewMatrix * w;
  }`;
const FRAG = /* glsl */`
  uniform float uTiempo, uZmin, uZmax, uIntervalo, uOpacidad, uMayor;
  uniform vec3 uC1, uC2, uC3;
  varying float vZ;
  varying vec3 vN;
  varying vec3 vW;
  varying vec3 vL;
  float linea(float v, float ancho) {
    float f = abs(fract(v - 0.5) - 0.5);
    return 1.0 - smoothstep(0.0, fwidth(v) * ancho, f);
  }
  void main() {
    float t = clamp((vZ - uZmin) / max(uZmax - uZmin, 0.001), 0.0, 1.0);
    vec3 base = t < 0.5 ? mix(uC1, uC2, t * 2.0) : mix(uC2, uC3, (t - 0.5) * 2.0);
    vec3 V = normalize(cameraPosition - vW);
    float fres = pow(1.0 - abs(dot(normalize(vN), V)), 2.0);
    float c = linea(vZ / uIntervalo, 1.3);
    float cm = linea(vZ / (uIntervalo * uMayor), 2.2);
    float reja = max(linea(vL.x, 1.0), linea(vL.z, 1.0)) * 0.22;
    float s = fract(uTiempo * 0.12);
    float barrido = 1.0 - smoothstep(0.0, 0.035, abs(t - s));
    vec3 col = base * (0.30 + 0.70 * fres) + vec3(0.78, 1.0, 0.96) * (c * 0.45 + cm * 0.85) + base * reja + vec3(0.55, 0.95, 1.0) * barrido * 0.45;
    float a = uOpacidad * (0.40 + 0.60 * fres) + c * 0.40 + cm * 0.65 + reja * 0.35 + barrido * 0.25;
    gl_FragColor = vec4(col, clamp(a, 0.0, 1.0));
  }`;

function materialHolo(D, opc) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTiempo: { value: 0 },
      uZmin: { value: D.zmin }, uZmax: { value: Math.max(D.zmax, D.zmin + 0.01) },
      uIntervalo: { value: D.intervalo || 1 }, uMayor: { value: 5 },
      uOpacidad: { value: opc.rayos ? 0.16 : 0.55 },
      uC1: { value: new THREE.Vector3(...C.cian) }, uC2: { value: new THREE.Vector3(...C.menta) }, uC3: { value: new THREE.Vector3(...C.ambar) },
    },
    vertexShader: VERT,
    fragmentShader: FRAG,
    transparent: true,
    side: THREE.DoubleSide,
    depthWrite: !opc.rayos,
  });
}

/* ---------- ayudas ---------- */
function geometria(pos, idx = null, extra = null) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  if (extra) for (const [k, v, n] of extra) g.setAttribute(k, new THREE.Float32BufferAttribute(v, n));
  if (idx) g.setIndex(idx);
  return g;
}

const basico = (color, opacidad, aditivo = true) => new THREE.MeshBasicMaterial({
  color, transparent: true, opacity: opacidad, side: THREE.DoubleSide, depthWrite: false,
  blending: aditivo ? THREE.AdditiveBlending : THREE.NormalBlending,
});

function textura(ancho, alto, pintar) {
  const cv = document.createElement('canvas');
  cv.width = ancho; cv.height = alto;
  pintar(cv.getContext('2d'), ancho, alto);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function etiqueta(txt, color = '#3fcfff', alto = 1) {
  const tex = textura(512, 128, (g, w, h) => {
    g.font = '600 64px "Chakra Petch", "IBM Plex Mono", sans-serif';
    const ancho = Math.min(w - 8, g.measureText(txt).width + 44);
    g.fillStyle = 'rgba(4,10,16,0.78)';
    g.strokeStyle = color; g.lineWidth = 4;
    const x0 = (w - ancho) / 2;
    g.beginPath(); g.roundRect(x0, 14, ancho, h - 28, 22); g.fill(); g.stroke();
    g.fillStyle = color; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(txt, w / 2, h / 2 + 3);
  });
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false }));
  s.scale.set(alto * 4, alto, 1);
  s.renderOrder = 10;
  return s;
}

/** Parte un triangulo con cota en lo que queda por encima y por debajo de Z0. */
export function partir(tri, Z0) {
  const arriba = [], abajo = [];
  for (let i = 0; i < 3; i++) {
    const p = tri[i], q = tri[(i + 1) % 3], hp = p.z - Z0, hq = q.z - Z0;
    if (hp >= 0) arriba.push(p);
    if (hp <= 0) abajo.push(p);
    if ((hp > 0 && hq < 0) || (hp < 0 && hq > 0)) {
      const t = hp / (hp - hq), m = { x: p.x + t * (q.x - p.x), y: p.y + t * (q.y - p.y), z: Z0 };
      arriba.push(m); abajo.push(m);
    }
  }
  return { arriba: arriba.length >= 3 ? arriba : [], abajo: abajo.length >= 3 ? abajo : [] };
}

/**
 * Arma el modelo en THREE (un Group). cfg:
 *   exag: exageracion vertical; rayos: con subsuelo y movimiento de tierra
 *   centro {x,y} y zref: que punto del levantamiento queda en el origen
 *   etiquetas: nombres de los puntos; prof: metros de suelo bajo el punto mas bajo
 */
export function construirModelo(D, cfg = {}) {
  const exag = cfg.exag ?? 1, rayos = !!cfg.rayos, cx = cfg.centro?.x ?? 0, cy = cfg.centro?.y ?? 0, zr = cfg.zref ?? 0;
  const prof = cfg.prof ?? 3;
  const V = (x, y, z) => [x - cx, (z - zr) * exag, -(y - cy)];
  const g = new THREE.Group();
  g.name = 'terreno';
  const T = D.T, P = T.puntos;
  const tam = Math.max(8, Math.sqrt(Math.max(D.area, 1)));
  const mats = [];

  // Superficie del terreno
  if (T.triangulos.length) {
    const pos = [], zz = [];
    for (const p of P) { pos.push(...V(p.x, p.y, p.z)); zz.push(p.z); }
    const geo = geometria(pos, T.triangulos.flat(), [['aZ', zz, 1]]);
    geo.computeVertexNormals();
    const mat = materialHolo(D, { rayos });
    mats.push(mat);
    const m = new THREE.Mesh(geo, mat);
    m.renderOrder = rayos ? 4 : 1;
    m.name = 'superficie';
    g.add(m);
  }

  // Curvas de nivel como lineas (nitidas de lejos)
  if (D.curvas.length) {
    for (const mayor of [false, true]) {
      const seg = [];
      for (const c of D.curvas) if (c.mayor === mayor) for (const ln of c.lineas) for (let i = 1; i < ln.length; i++) {
        seg.push(...V(ln[i - 1].x, ln[i - 1].y, c.z), ...V(ln[i].x, ln[i].y, c.z));
      }
      if (seg.length) {
        const l = new THREE.LineSegments(geometria(seg), new THREE.LineBasicMaterial({ color: mayor ? 0x9dffe0 : 0x41e2a4, transparent: true, opacity: mayor ? 0.95 : 0.45, blending: THREE.AdditiveBlending, depthWrite: false }));
        l.position.y = 0.02 * exag;
        l.renderOrder = 5;
        g.add(l);
      }
    }
  }

  // Lindero, pines y nombres
  const L = D.lindero;
  if (L.length >= 3) {
    const pts = L.map(p => new THREE.Vector3(...V(p.x, p.y, p.z)));
    const loop = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: 0x3fcfff, transparent: true, opacity: 1, blending: THREE.AdditiveBlending, depthWrite: false }));
    loop.position.y = 0.05 * exag;
    loop.renderOrder = 6;
    g.add(loop);
  }
  const alto = tam * 0.12;
  const seg = [];
  for (const p of D.puntos) {
    const [x, y, z] = V(p.x, p.y, p.z);
    if (p.tipo !== 'esquina') {
      const punto = new THREE.Mesh(new THREE.SphereGeometry(tam * 0.006, 8, 6), basico(0xffae2b, 0.9));
      punto.position.set(x, y + 0.02 * exag, z);
      g.add(punto);
      continue;
    }
    seg.push(x, y, z, x, y + alto, z);
    const bola = new THREE.Mesh(new THREE.SphereGeometry(tam * 0.012, 12, 8), basico(0x3fcfff, 0.95));
    bola.position.set(x, y + alto, z);
    g.add(bola);
    if (cfg.etiquetas !== false) {
      const e = etiqueta(p.id, '#3fcfff', tam * 0.045);
      e.position.set(x, y + alto + tam * 0.04, z);
      g.add(e);
    }
  }
  if (seg.length) g.add(new THREE.LineSegments(geometria(seg), new THREE.LineBasicMaterial({ color: 0x8fe9ff, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false })));

  // ---------- Rayos X ----------
  if (rayos && L.length >= 3 && D.plataforma) {
    const Z0 = D.plataforma.z, zb = D.zmin - prof;
    const rx = new THREE.Group();
    rx.name = 'rayos';

    // Paredes del bloque de suelo con una raya por cada metro de profundidad
    const rayas = textura(64, 64, (c, w, h) => {
      const gr = c.createLinearGradient(0, 0, 0, h);
      gr.addColorStop(0, 'rgba(255,174,43,0.10)'); gr.addColorStop(1, 'rgba(120,70,20,0.05)');
      c.fillStyle = gr; c.fillRect(0, 0, w, h);
      c.fillStyle = 'rgba(255,190,90,0.85)'; c.fillRect(0, 0, w, 3);
    });
    rayas.wrapS = rayas.wrapT = THREE.RepeatWrapping;
    const pos = [], uv = [], idx = [];
    let u = 0;
    L.forEach((a, i) => {
      const b = L[(i + 1) % L.length], largo = Math.hypot(b.x - a.x, b.y - a.y), k = pos.length / 3;
      pos.push(...V(a.x, a.y, a.z), ...V(b.x, b.y, b.z), ...V(b.x, b.y, zb), ...V(a.x, a.y, zb));
      uv.push(u, a.z - Z0, u + largo, b.z - Z0, u + largo, zb - Z0, u, zb - Z0);
      idx.push(k, k + 1, k + 2, k, k + 2, k + 3);
      u += largo;
    });
    const paredes = new THREE.Mesh(geometria(pos, idx, [['uv', uv, 2]]), new THREE.MeshBasicMaterial({ map: rayas, transparent: true, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }));
    paredes.renderOrder = 2;
    rx.add(paredes);

    // Fondo del bloque y plataforma de la obra
    const forma = poli => new THREE.Shape(poli.map(p => new THREE.Vector2(p.x - cx, -(p.y - cy))));
    const fondo = new THREE.Mesh(new THREE.ShapeGeometry(forma(L)), basico(0x3a2a14, 0.35, false));
    fondo.rotation.x = Math.PI / 2; fondo.position.y = (zb - zr) * exag;
    rx.add(fondo);
    const zona = D.huella, borde = zona || L;
    const plat = new THREE.Mesh(new THREE.ShapeGeometry(forma(borde)), basico(0xdffcff, zona ? 0.16 : 0.10));
    plat.rotation.x = Math.PI / 2; plat.position.y = (Z0 - zr) * exag;
    plat.renderOrder = 3;
    rx.add(plat);
    rx.add(new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(borde.map(p => new THREE.Vector3(...V(p.x, p.y, Z0)))), new THREE.LineBasicMaterial({ color: 0xe9fdff, transparent: true, opacity: 0.9 })));

    // Tierra que se corta (por encima de la plataforma) y que se rellena (por debajo)
    const corte = [], relleno = [];
    for (const [a, b, c] of T.triangulos) {
      const pedazo = zona ? recortar([P[a], P[b], P[c]], zona) : [P[a], P[b], P[c]];
      for (let j = 1; j < pedazo.length - 1; j++) {
        const { arriba, abajo } = partir([pedazo[0], pedazo[j], pedazo[j + 1]], Z0);
        for (const [lista, poli] of [[corte, arriba], [relleno, abajo]]) {
          for (let k = 1; k < poli.length - 1; k++) {
            const tri = [poli[0], poli[k], poli[k + 1]];
            for (const p of tri) lista.push(...V(p.x, p.y, p.z));
            for (const p of tri) lista.push(...V(p.x, p.y, Z0));
          }
        }
      }
    }
    // Paredes de tierra por el borde (lindero o huella), entre el terreno y la plataforma
    const tramo = (p, q) => {
      const ha = p.z - Z0, hb = q.z - Z0;
      const pared = (u, w) => {
        const lista = (u.z + w.z) / 2 >= Z0 ? corte : relleno;
        lista.push(...V(u.x, u.y, u.z), ...V(w.x, w.y, w.z), ...V(w.x, w.y, Z0), ...V(u.x, u.y, u.z), ...V(w.x, w.y, Z0), ...V(u.x, u.y, Z0));
      };
      if ((ha > 0 && hb < 0) || (ha < 0 && hb > 0)) {
        const t = ha / (ha - hb), m = { x: p.x + t * (q.x - p.x), y: p.y + t * (q.y - p.y), z: Z0 };
        pared(p, m); pared(m, q);
      } else pared(p, q);
    };
    borde.forEach((a, i) => {
      const b = borde[(i + 1) % borde.length];
      if (!zona) return tramo(a, b);
      const n = Math.max(2, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 0.5));
      let ant = null;
      for (let k = 0; k <= n; k++) {
        const x = a.x + (k / n) * (b.x - a.x), y = a.y + (k / n) * (b.y - a.y), z = cotaEn(T, x, y);
        const p = z === null ? null : { x, y, z };
        if (ant && p) tramo(ant, p);
        ant = p;
      }
    });
    if (corte.length) { const m = new THREE.Mesh(geometria(corte), basico(0xff5f78, 0.30)); m.renderOrder = 3; m.name = 'corte'; rx.add(m); }
    if (relleno.length) { const m = new THREE.Mesh(geometria(relleno), basico(0x3fcfff, 0.30)); m.renderOrder = 3; m.name = 'relleno'; rx.add(m); }

    // Regla de profundidad en la primera esquina
    if (cfg.etiquetas !== false) {
      const a = L[0];
      for (let d = 1; d <= Math.floor(Z0 - zb); d++) {
        const e = etiqueta(`−${d} m`, '#ffbe5a', tam * 0.035);
        const [x, y, z] = V(a.x, a.y, Z0 - d);
        e.position.set(x - tam * 0.08, y, z);
        rx.add(e);
      }
      const ep = etiqueta(`Plataforma ${Z0 >= 0 ? '+' : ''}${Z0.toFixed(2)}`, '#e9fdff', tam * 0.045);
      const cb = borde.reduce((s, p) => ({ x: s.x + p.x / borde.length, y: s.y + p.y / borde.length }), { x: 0, y: 0 });
      const [x, y, z] = V(cb.x, cb.y, Z0);
      ep.position.set(x, y + tam * 0.03, z);
      rx.add(ep);
    }
    g.add(rx);
  }
  g.userData = { mats, tam, exag, cx, cy, zr };
  return g;
}

/* ---------- vista en pantalla ---------- */
function redimensionar() {
  if (!H.r) return;
  const w = H.caja.clientWidth || 1, h = H.caja.clientHeight || 1;
  H.r.setSize(w, h, false);
  H.cam.aspect = w / h;
  // El panel de abajo tapa el ultimo tercio: el modelo se dibuja mas arriba
  H.cam.setViewOffset(w, h, 0, h * 0.14, w, h);
  H.cam.updateProjectionMatrix();
}

function escenario() {
  const anillo = new THREE.Mesh(new THREE.RingGeometry(0.985, 1, 96), basico(0x3fcfff, 0.3));
  anillo.rotation.x = -Math.PI / 2;
  const halo = new THREE.Mesh(new THREE.CircleGeometry(1, 64), new THREE.MeshBasicMaterial({
    map: textura(256, 256, (c, w) => {
      const gr = c.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
      gr.addColorStop(0, 'rgba(63,207,255,0.28)'); gr.addColorStop(0.7, 'rgba(63,207,255,0.05)'); gr.addColorStop(1, 'rgba(63,207,255,0)');
      c.fillStyle = gr; c.fillRect(0, 0, w, w);
    }),
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  }));
  halo.rotation.x = -Math.PI / 2;
  const e = new THREE.Group();
  e.add(halo, anillo);
  e.name = 'escenario';
  return e;
}

function cuadro() {
  if (!H.activo) return;
  const t = H.reloj.getElapsedTime();
  H.raiz?.userData.mats?.forEach(m => { m.uniforms.uTiempo.value = t; });
  if (H.escaner?.visible && H.D) moverEscaner(t);
  H.ctl.update();
  H.r.render(H.escena, H.cam);
}

export function iniciarHolo(caja) {
  if (H.r) return true;
  let r;
  try {
    r = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  } catch {
    return false;
  }
  r.setPixelRatio(Math.min(devicePixelRatio, 2));
  r.setClearColor(FONDO, 1);
  caja.appendChild(r.domElement);
  const escena = new THREE.Scene();
  escena.fog = new THREE.FogExp2(FONDO, 0.004);
  const cam = new THREE.PerspectiveCamera(40, 1, 0.05, 6000);
  const ctl = new OrbitControls(cam, r.domElement);
  ctl.enableDamping = true; ctl.dampingFactor = 0.08;
  ctl.autoRotate = true; ctl.autoRotateSpeed = 0.7;
  ctl.maxPolarAngle = Math.PI * 0.9;
  r.domElement.addEventListener('pointerdown', () => { ctl.autoRotate = false; });
  const esc = escenario();
  escena.add(esc);
  Object.assign(H, { r, escena, cam, ctl, caja, esc });
  new ResizeObserver(redimensionar).observe(caja);
  redimensionar();
  r.setAnimationLoop(cuadro);
  return true;
}

export const rendererHolo = () => H.r;
export function pausarHolo() { H.activo = false; }
export function reanudarHolo() {
  if (!H.r) return;
  H.activo = true;
  H.r.setClearColor(FONDO, 1);
  H.r.setAnimationLoop(cuadro);
  redimensionar();
}
export const girar = (si) => { if (H.ctl) H.ctl.autoRotate = si; };

function liberar(obj) {
  obj?.traverse(o => {
    o.geometry?.dispose();
    const ms = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
    for (const m of ms) { m.map?.dispose(); m.dispose(); }
  });
}

/** Pinta (o repinta) el levantamiento. opc: { exag, rayos, escaner } */
export function pintarHolo(D, opc = {}) {
  if (!H.r) return;
  const nuevo = !H.raiz;
  if (H.raiz) { H.escena.remove(H.raiz); liberar(H.raiz); H.raiz = null; }
  if (H.escaner) { H.escena.remove(H.escaner); liberar(H.escaner); H.escaner = null; }
  H.D = D; H.opc = opc;
  if (!D || !D.T.triangulos.length) return;
  const raiz = construirModelo(D, { exag: opc.exag, rayos: opc.rayos, centro: D.centro, zref: D.plataforma?.z ?? D.zmin });
  H.escena.add(raiz);
  H.raiz = raiz;
  const caja = new THREE.Box3().setFromObject(raiz), r = Math.max(caja.max.x - caja.min.x, caja.max.z - caja.min.z) / 2;
  H.esc.scale.setScalar(r * 1.25);
  H.esc.position.y = caja.min.y - 0.02;
  H.escena.fog.density = 0.6 / Math.max(r, 1) / 6;
  if (opc.escaner) crearEscaner(D, opc);
  if (nuevo || opc.encuadrar) encuadrar(raiz);
}

function encuadrar(raiz) {
  const caja = new THREE.Box3().setFromObject(raiz), c = caja.getCenter(new THREE.Vector3()), s = caja.getSize(new THREE.Vector3());
  const r = Math.max(s.x, s.z, s.y) * 0.5;
  H.ctl.target.copy(c);
  // Que quepa a lo ancho y a lo alto: en un celular vertical manda el ancho
  const fv = THREE.MathUtils.degToRad(H.cam.fov) / 2, fh = Math.atan(Math.tan(fv) * H.cam.aspect);
  const d = (r * 1.15) / Math.sin(Math.min(fv, fh));
  H.cam.position.copy(c).addScaledVector(new THREE.Vector3(0.55, 0.62, 0.75).normalize(), d);
  H.cam.near = Math.max(0.01, r / 200); H.cam.far = r * 60;
  H.cam.updateProjectionMatrix();
  H.ctl.update();
}

/* ---------- escaner ---------- */
const MUESTRAS = 91;

function crearEscaner(D, opc) {
  const g = new THREE.Group();
  g.name = 'escaner';
  const plano = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({
    map: textura(16, 128, (c, w, h) => {
      const gr = c.createLinearGradient(0, 0, 0, h);
      gr.addColorStop(0, 'rgba(63,207,255,0)'); gr.addColorStop(0.5, 'rgba(63,207,255,0.35)'); gr.addColorStop(1, 'rgba(63,207,255,0.05)');
      c.fillStyle = gr; c.fillRect(0, 0, w, h);
    }),
    transparent: true, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending,
  }));
  const lineaFija = (color, opacidad) => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(MUESTRAS * 3), 3));
    geo.setDrawRange(0, 0);
    const l = new THREE.Line(geo, new THREE.LineBasicMaterial({ color, transparent: true, opacity: opacidad, depthTest: false }));
    l.frustumCulled = false;
    l.renderOrder = 12;
    return l;
  };
  const linea = lineaFija(0xffffff, 1), lineaP = lineaFija(0xffae2b, 0.9);
  g.add(plano, linea, lineaP);
  g.userData = { plano, linea, lineaP, exag: opc.exag };
  H.escena.add(g);
  H.escaner = g;
}

function moverEscaner(t) {
  const D = H.D, { plano, linea, lineaP, exag } = H.escaner.userData;
  const u = H.raiz.userData;
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const p of D.lindero.length ? D.lindero : D.puntos) { x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); y0 = Math.min(y0, p.y); y1 = Math.max(y1, p.y); }
  const s = 0.5 - 0.5 * Math.cos(t * 0.45), y = y0 + 0.02 + s * (y1 - y0 - 0.04);
  const zb = D.zmin - 3, zt = D.zmax + 1, Z0 = D.plataforma?.z ?? D.zmin;
  plano.scale.set(x1 - x0 + 2, (zt - zb) * exag, 1);
  plano.position.set((x0 + x1) / 2 - u.cx, ((zt + zb) / 2 - u.zr) * exag, -(y - u.cy));
  if (t - H.ultimoPerfil < 0.08) return;
  H.ultimoPerfil = t;
  const pr = perfil(D.T, { x: x0 - 0.5, y }, { x: x1 + 0.5, y }, MUESTRAS - 1);
  const a = linea.geometry.attributes.position, b = lineaP.geometry.attributes.position;
  let n = 0;
  pr.forEach((p, i) => {
    if (p.z === null) return;
    const x = x0 - 0.5 + (i / (MUESTRAS - 1)) * (x1 - x0 + 1);
    a.setXYZ(n, x - u.cx, (p.z - u.zr) * exag + 0.03, -(y - u.cy));
    b.setXYZ(n, x - u.cx, (Z0 - u.zr) * exag, -(y - u.cy));
    n++;
  });
  a.needsUpdate = b.needsUpdate = true;
  linea.geometry.setDrawRange(0, n);
  lineaP.geometry.setDrawRange(0, n);
  H.alPerfil?.({ y: y - y0, perfil: pr, Z0 });
}

/* ---------- modelo para el AR de iPhone (USDZ) ---------- */
/** Lo mismo que el holograma, con materiales que entiende AR Quick Look:
    el color por cota y las curvas van "horneados" en una textura. */
export function modeloParaUSDZ(D, opc = {}) {
  const g = new THREE.Group();
  const T = D.T, P = T.puntos;
  if (!T.triangulos.length) return null;
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const p of P) { x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); y0 = Math.min(y0, p.y); y1 = Math.max(y1, p.y); }
  const w = Math.max(x1 - x0, 0.01), h = Math.max(y1 - y0, 0.01), N = 1024;
  const U = (x, y) => [(x - x0) / w, (y - y0) / h];
  const tex = textura(N, N, (c) => {
    c.fillStyle = '#05080c'; c.fillRect(0, 0, N, N);
    const ramp = z => {
      const t = Math.min(1, Math.max(0, (z - D.zmin) / Math.max(D.zmax - D.zmin, 0.01)));
      const [a, b, s] = t < 0.5 ? [C.cian, C.menta, t * 2] : [C.menta, C.ambar, (t - 0.5) * 2];
      return `rgb(${[0, 1, 2].map(i => Math.round(255 * (a[i] + (b[i] - a[i]) * s))).join(',')})`;
    };
    const px = (x, y) => [((x - x0) / w) * N, N - ((y - y0) / h) * N];
    for (const [a, b, cc] of T.triangulos) {
      c.fillStyle = ramp((P[a].z + P[b].z + P[cc].z) / 3);
      c.beginPath(); c.moveTo(...px(P[a].x, P[a].y)); c.lineTo(...px(P[b].x, P[b].y)); c.lineTo(...px(P[cc].x, P[cc].y)); c.closePath(); c.fill();
      c.strokeStyle = c.fillStyle; c.lineWidth = 1; c.stroke();
    }
    for (const cv of D.curvas) {
      c.strokeStyle = cv.mayor ? '#ffffff' : 'rgba(255,255,255,0.55)';
      c.lineWidth = cv.mayor ? 4 : 2;
      for (const ln of cv.lineas) { c.beginPath(); ln.forEach((p, i) => (i ? c.lineTo : c.moveTo).call(c, ...px(p.x, p.y))); c.stroke(); }
    }
    if (D.lindero.length >= 3) {
      c.strokeStyle = '#3fcfff'; c.lineWidth = 8;
      c.beginPath(); D.lindero.forEach((p, i) => (i ? c.lineTo : c.moveTo).call(c, ...px(p.x, p.y))); c.closePath(); c.stroke();
    }
  });
  tex.flipY = true;
  const exag = opc.exag ?? 1, cx = D.centro.x, cy = D.centro.y, zr = D.zmin;
  const pos = [], uv = [];
  for (const p of P) { pos.push(p.x - cx, (p.z - zr) * exag, -(p.y - cy)); uv.push(...U(p.x, p.y)); }
  const geo = geometria(pos, T.triangulos.flat(), [['uv', uv, 2]]);
  geo.computeVertexNormals();
  g.add(new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: tex, emissiveMap: tex, emissive: 0xffffff, emissiveIntensity: 0.6, roughness: 0.6, side: THREE.DoubleSide })));
  // Pines de las esquinas
  const tam = Math.max(8, Math.sqrt(Math.max(D.area, 1)));
  for (const p of D.esquinas) {
    const pin = new THREE.Mesh(new THREE.CylinderGeometry(tam * 0.006, tam * 0.006, tam * 0.12, 8), new THREE.MeshStandardMaterial({ color: 0x3fcfff, emissive: 0x3fcfff, emissiveIntensity: 0.8 }));
    pin.position.set(p.x - cx, (p.z - zr) * exag + tam * 0.06, -(p.y - cy));
    g.add(pin);
  }
  // Bloque de suelo bajo el terreno
  if (D.lindero.length >= 3) {
    const zb = D.zmin - 2, L = D.lindero, pp = [], idx = [];
    L.forEach((a, i) => {
      const b = L[(i + 1) % L.length], k = pp.length / 3;
      pp.push(a.x - cx, (a.z - zr) * exag, -(a.y - cy), b.x - cx, (b.z - zr) * exag, -(b.y - cy), b.x - cx, (zb - zr) * exag, -(b.y - cy), a.x - cx, (zb - zr) * exag, -(a.y - cy));
      idx.push(k, k + 1, k + 2, k, k + 2, k + 3);
    });
    const pg = geometria(pp, idx);
    pg.computeVertexNormals();
    g.add(new THREE.Mesh(pg, new THREE.MeshStandardMaterial({ color: 0x6b4a22, roughness: 0.95, side: THREE.DoubleSide })));
  }
  return g;
}
