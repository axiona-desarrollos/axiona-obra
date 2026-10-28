/* ==========================================================================
   AXIONA OBRA · Modelo 3D por fases de obra
   --------------------------------------------------------------------------
   Diez fases, de terreno natural a carpinteria. Cada fase es un grupo que se
   prende o se apaga; la mamposteria cambia de material (ladrillo, panete,
   pintura) segun la fase. Coordenadas: x del marco del frente, y arriba (la
   cota) y z = -y del marco, como espera three.js.
   ========================================================================== */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { rectMinus, near } from '../motor/index.js';
import { $, $$, fm, app, PHASES } from '../ui/comun.js';
import { CATEGORIAS } from '../motor/index.js';

const T3 = {};
export const tres = T3;

export function ensure3D() {
  if (T3.renderer) return true;
  const box = $('#threeBox');
  let r;
  try {
    r = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  } catch {
    $('#hud').textContent = 'Este dispositivo no pudo iniciar el 3D (WebGL).';
    return false;
  }
  r.setPixelRatio(Math.min(devicePixelRatio, 2));
  r.toneMapping = THREE.ACESFilmicToneMapping;
  r.toneMappingExposure = 1.05;
  r.shadowMap.enabled = true;
  r.shadowMap.type = THREE.PCFSoftShadowMap;
  box.appendChild(r.domElement);
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x070a0e, 70, 190);
  const cam = new THREE.PerspectiveCamera(42, 1, 0.1, 600);
  const ctl = new OrbitControls(cam, r.domElement);
  ctl.enableDamping = true; ctl.dampingFactor = 0.08; ctl.maxPolarAngle = Math.PI * 0.495;
  scene.add(new THREE.HemisphereLight(0xcfe6ff, 0x2a2016, 1.7));
  const sun = new THREE.DirectionalLight(0xfff1dc, 2.9);
  sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.02;
  scene.add(sun, sun.target);
  Object.assign(T3, { renderer: r, scene, cam, ctl, sun, box, root: null, spin: false, damp: 0 });
  ctl.addEventListener('change', render3D);
  new ResizeObserver(resize3D).observe(box);
  const loop = () => {
    requestAnimationFrame(loop);
    if (r.xr.isPresenting) return;
    ctl.autoRotate = T3.spin; ctl.autoRotateSpeed = 0.8;
    if (T3.spin || T3.damp > 0) { ctl.update(); T3.damp--; }
  };
  loop();
  r.domElement.addEventListener('pointerdown', () => { T3.damp = 120; });
  r.domElement.addEventListener('wheel', () => { T3.damp = 60; }, { passive: true });
  const std = (color, roughness, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness, ...extra });
  T3.mat = {
    conc: std(0x9a9da3, 0.9), lean: std(0x5d6168, 1), brick: std(0xb0573a, 0.95), plaster: std(0xb9b4a9, 1),
    paintI: std(0xf1efe9, 0.85), paintE: std(0xd9cfbd, 0.85), membrane: std(0x3a3f47, 0.7),
    wood: std(0x7a4e2d, 0.7), woodD: std(0x3b2a1e, 0.6),
    glass: std(0x8fd3ff, 0.05, { metalness: 0.1, transparent: true, opacity: 0.35 }),
    frame: std(0x2b2f35, 0.4, { metalness: 0.6 }),
    tile: { social: std(0xcdbb9f, 0.5), privada: std(0xa47853, 0.6), servicio: std(0xdfe3e6, 0.35), circ: std(0xbfc4c9, 0.5) },
    stake: std(0xffae2b, 0.5, { emissive: 0x4a2a00 }),
  };
  return true;
}

export function resize3D() {
  if (!T3.renderer || T3.renderer.xr.isPresenting) return;
  const w = T3.box.clientWidth, h = T3.box.clientHeight;
  if (!w || !h) return;
  T3.renderer.setSize(w, h, false);
  T3.cam.aspect = w / h;
  T3.cam.updateProjectionMatrix();
  render3D();
}

export function render3D() { if (T3.renderer && !T3.renderer.xr.isPresenting) T3.renderer.render(T3.scene, T3.cam); }

function addBox(g, x0, x1, y0, y1, z0, z1, mat, fl = 0, ud = {}) {
  const sx = Math.abs(x1 - x0), sy = Math.abs(y1 - y0), sz = Math.abs(z1 - z0);
  if (sx < 0.005 || sy < 0.005 || sz < 0.005) return null;
  const m = new THREE.Mesh(new THREE.BoxGeometry(sx, sz, sy), mat);
  m.position.set((x0 + x1) / 2, (z0 + z1) / 2, -(y0 + y1) / 2);
  m.castShadow = true; m.receiveShadow = true;
  m.userData = { fl, ...ud };
  g.add(m);
  return m;
}

function terrainMesh(M, graded) {
  const G = M.grid, { nx, ny, res } = G, pos = [], col = [], idx = [];
  const lo = new THREE.Color(0x3d5131), hi = new THREE.Color(0x87744c), out0 = new THREE.Color(0x1b231d), out1 = new THREE.Color(0x2d2a22), plat = new THREE.Color(0x7a6650), c = new THREE.Color();
  const P = M.P, span = Math.max(G.zmax - G.zmin, 0.01);
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const x = G.x0 + i * res, y = G.y0 + j * res, k = j * nx + i;
    let z = G.Z[k], inP = false;
    if (graded) {
      const dx = Math.max(P.x0 - x, 0, x - P.x1), dy = Math.max(P.y0 - y, 0, y - P.y1), d = Math.hypot(dx, dy);
      if (d === 0) { z = M.dl; inP = true; } else if (d < 2) z = M.dl + (z - M.dl) * (d / 2);
    }
    pos.push(x, z, -y);
    const t = (G.Z[k] - G.zmin) / span;
    if (inP) c.copy(plat); else if (G.IN[k]) c.copy(lo).lerp(hi, t); else c.copy(out0).lerp(out1, t);
    col.push(c.r, c.g, c.b);
  }
  for (let j = 0; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) { const a = j * nx + i, b = a + 1, d = a + nx, e = d + 1; idx.push(a, d, b, b, d, e); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, transparent: true, opacity: 1, side: THREE.DoubleSide }));
  m.receiveShadow = true;
  m.userData = { fl: 0, terrain: true, own: true };
  return m;
}

export function buildScene() {
  const M = app.M;
  if (!T3.renderer || !M || M.err) return;
  app.threeDirty = false;
  if (T3.root) {
    T3.scene.remove(T3.root);
    T3.root.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material && o.userData.own) o.material.dispose(); });
  }
  const root = new THREE.Group(), G = [...Array(10)].map(() => new THREE.Group());
  G.forEach((g, i) => { g.userData.phase = i; root.add(g); });
  const mt = T3.mat, R = M.R, dl = M.dl, fh = M.fh, sl = M.slab, F = M.F, desp = M.desp, cb = M.colB / 2;
  T3.wallMeshes = [];
  // Columnas y vigas aereas: en obra blanca ya van pañetadas y pintadas
  // como los muros, no en concreto a la vista.
  T3.estructura = [];
  const est = m => { if (m) T3.estructura.push(m); return m; };

  // 0 / 1 terreno natural y explanado
  G[0].add(terrainMesh(M, false));
  G[0].userData.terrain = true;
  const tg = terrainMesh(M, true);
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

  // 2 cimentacion
  M.cols.forEach(c => {
    addBox(G[2], c.x - c.B / 2 - 0.05, c.x + c.B / 2 + 0.05, c.y - c.B / 2 - 0.05, c.y + c.B / 2 + 0.05, dl - desp - 0.05, dl - desp, mt.lean);
    addBox(G[2], c.x - c.B / 2, c.x + c.B / 2, c.y - c.B / 2, c.y + c.B / 2, dl - desp, dl - desp + c.h, mt.conc);
  });
  M.beams.forEach(b => (b.o === 'H'
    ? addBox(G[2], b.a - 0.15, b.b + 0.15, b.c - 0.15, b.c + 0.15, dl - 0.4, dl - 0.08, mt.conc)
    : addBox(G[2], b.c - 0.15, b.c + 0.15, b.a - 0.15, b.b + 0.15, dl - 0.4, dl - 0.08, mt.conc)));
  addBox(G[2], R.x0, R.x1, R.y0, R.y1, dl - 0.08, dl, mt.conc, 0);

  // 3 estructura
  for (let f = 0; f < F; f++) {
    const L0 = dl + f * fh, L1 = dl + (f + 1) * fh;
    M.cols.forEach(c => {
      // el tramo enterrado (bajo el contrapiso) queda en concreto
      if (f === 0) addBox(G[3], c.x - cb, c.x + cb, c.y - cb, c.y + cb, dl - desp + c.h, dl, mt.conc, f);
      est(addBox(G[3], c.x - cb, c.x + cb, c.y - cb, c.y + cb, f === 0 ? dl : L0, L1 - sl, mt.conc, f));
    });
    rectMinus(R, f < F - 1 ? M.stair : null).forEach(r => addBox(G[3], r.x0, r.x1, r.y0, r.y1, L1 - sl, L1, mt.conc, f + 1));
    M.beams.forEach(b => est(b.o === 'H'
      ? addBox(G[3], b.a - 0.15, b.b + 0.15, b.c - 0.15, b.c + 0.15, L1 - sl - 0.25, L1 - sl, mt.conc, f + 1)
      : addBox(G[3], b.c - 0.15, b.c + 0.15, b.a - 0.15, b.b + 0.15, L1 - sl - 0.25, L1 - sl, mt.conc, f + 1)));
    // borde de la losa: tambien se pañeta y se pinta con la fachada
    est(addBox(G[3], R.x0 - 0.01, R.x1 + 0.01, R.y0 - 0.01, R.y0 + 0.01, L1 - sl, L1, mt.conc, f + 1));
    if (f < F - 1 && M.stair) {
      const s = M.stair, n = Math.round(fh / 0.18), rz = fh / n, tr = (s.y1 - s.y0 - 0.2) / n;
      for (let k = 0; k < n; k++) addBox(G[3], s.x0 + 0.15, s.x1 - 0.15, s.y0 + k * tr, s.y0 + (k + 1) * tr, L0, L0 + (k + 1) * rz, mt.conc, f);
    }
  }
  // 4 mamposteria (el material cambia en las fases 6 y 7)
  const wb = (fl, l, a, b, z0, z1) => {
    const t = l.ext ? 0.2 : 0.12;
    const a2 = Math.abs(a - l.a) < 0.02 ? a - t / 2 : a, b2 = Math.abs(b - l.b) < 0.02 ? b + t / 2 : b;
    const m = l.o === 'H'
      ? addBox(G[4], a2, b2, l.c - t / 2, l.c + t / 2, z0, z1, mt.brick, fl, { ext: l.ext })
      : addBox(G[4], l.c - t / 2, l.c + t / 2, a2, b2, z0, z1, mt.brick, fl, { ext: l.ext });
    if (m) T3.wallMeshes.push(m);
  };
  M.floors.forEach(fl => {
    const L0 = dl + fl.f * fh, top = L0 + fh - sl;
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
  // 5 cubierta con antepecho
  const Lt = dl + F * fh;
  addBox(G[5], R.x0, R.x1, R.y0, R.y1, Lt, Lt + 0.02, mt.membrane, F);
  [[R.x0, R.x1, R.y0, R.y0 + 0.15], [R.x0, R.x1, R.y1 - 0.15, R.y1], [R.x0, R.x0 + 0.15, R.y0, R.y1], [R.x1 - 0.15, R.x1, R.y0, R.y1]]
    .forEach(([a, b, c, d]) => { const m = addBox(G[5], a, b, c, d, Lt, Lt + 0.9, mt.brick, F, { ext: true }); if (m) T3.wallMeshes.push(m); });
  // 8 pisos
  M.floors.forEach(fl => fl.rects.forEach(r => {
    if (!r.stair) addBox(G[8], r.x0 + 0.06, r.x1 - 0.06, r.y0 + 0.06, r.y1 - 0.06, dl + fl.f * fh, dl + fl.f * fh + 0.025, mt.tile[r.zone] || mt.tile.circ, fl.f);
  }));
  // 9 carpinteria
  M.floors.forEach(fl => {
    const L0 = dl + fl.f * fh;
    fl.ops.forEach(o => {
      if (o.kind === 'win') {
        const z0 = L0 + o.sill, z1 = z0 + o.h;
        if (o.o === 'H') {
          addBox(G[9], o.a, o.b, o.c - 0.02, o.c + 0.02, z0, z1, mt.glass, fl.f);
          addBox(G[9], o.a, o.b, o.c - 0.05, o.c + 0.05, z0, z0 + 0.04, mt.frame, fl.f);
          addBox(G[9], o.a, o.b, o.c - 0.05, o.c + 0.05, z1 - 0.04, z1, mt.frame, fl.f);
        } else {
          addBox(G[9], o.c - 0.02, o.c + 0.02, o.a, o.b, z0, z1, mt.glass, fl.f);
          addBox(G[9], o.c - 0.05, o.c + 0.05, o.a, o.b, z0, z0 + 0.04, mt.frame, fl.f);
          addBox(G[9], o.c - 0.05, o.c + 0.05, o.a, o.b, z1 - 0.04, z1, mt.frame, fl.f);
        }
      } else {
        const mm = o.kind === 'main' ? mt.woodD : mt.wood, h = o.h - 0.03;
        if (o.o === 'H') addBox(G[9], o.a + 0.02, o.b - 0.02, o.c - 0.025, o.c + 0.025, L0 + 0.03, L0 + h, mm, fl.f);
        else addBox(G[9], o.c - 0.025, o.c + 0.025, o.a + 0.02, o.b - 0.02, L0 + 0.03, L0 + h, mm, fl.f);
      }
    });
  });
  T3.root = root;
  T3.scene.add(root);

  // camara y sol
  const cx = (R.x0 + R.x1) / 2, cy = (R.y0 + R.y1) / 2, size = Math.max(M.bbox.w, M.bbox.h, 12);
  if (!T3.framed) { T3.cam.position.set(cx + size * 0.9, dl + size * 0.75, -cy + size * 1.05); T3.framed = true; }
  T3.ctl.target.set(cx, dl + F * fh * 0.4, -cy);
  T3.ctl.update();
  const sh = T3.sun.shadow.camera;
  sh.left = -size; sh.right = size; sh.top = size; sh.bottom = -size; sh.near = 1; sh.far = size * 6;
  sh.updateProjectionMatrix();
  T3.sun.position.set(cx - size * 0.8, dl + size * 1.6, -cy + size * 0.6);
  T3.sun.target.position.set(cx, dl, -cy);
  $('#floorSel').innerHTML = '<option value="99">Todo</option>' + [...Array(F)].map((_, i) => `<option value="${i}">Piso ${i + 1}</option>`).join('');
  $('#floorSel').value = app.viewFloor > F ? 99 : app.viewFloor;
  applyPhase();
}

export function applyPhase() {
  const M = app.M, phase = app.phase;
  $('#phaseRange').value = phase;
  const cat = PHASES[phase].cat;
  $$('[data-cat]').forEach(b => b.setAttribute('aria-pressed', b.dataset.cat === cat));
  $('#phaseList').innerHTML = PHASES.map((p, i) => `<button class="ph c-${p.cat} ${i === phase ? 'on' : i < phase ? 'done' : ''}" data-ph="${i}"><em>${i < phase ? '✓ ' : ''}${CATEGORIAS[p.cat]}</em><span style="color:var(--fg)">${i + 1}. ${p.n}</span></button>`).join('');
  if (!T3.root || !M || M.err) return;
  T3.root.children.forEach(g => { if (g.userData.phase === undefined) return; const i = g.userData.phase; g.visible = i === 0 ? phase === 0 : i <= phase; });
  T3.tGraded.material.opacity = phase === 2 ? 0.35 : 1;
  T3.tGraded.material.depthWrite = phase !== 2;
  const wm = phase >= 7 ? null : phase >= 6 ? T3.mat.plaster : T3.mat.brick;
  T3.wallMeshes.forEach(m => { m.material = wm || (m.userData.ext ? T3.mat.paintE : T3.mat.paintI); });
  const em = phase >= 7 ? T3.mat.paintE : phase >= 6 ? T3.mat.plaster : T3.mat.conc;
  T3.estructura.forEach(m => { m.material = em; });
  T3.root.traverse(o => { if (o.isMesh && o.userData.fl !== undefined && !o.userData.terrain) o.visible = o.userData.fl <= app.viewFloor; });
  const Q = M.quant;
  const info = [
    `Terreno · corte ${fm(M.cut, 1)} m³ / relleno ${fm(M.fill, 1)} m³`, `Plataforma N±0.00 = ${fm(M.dl)} m`,
    `${M.cols.length} zapatas · ${fm(Q.concFund, 1)} m³ concreto`, `Estructura · ${fm(Q.concStr, 1)} m³ concreto`,
    `${fm(Q.mamp, 1)} m² de mampostería`, `${fm(M.R.area, 1)} m² impermeabilizados`, `${fm(Q.pan, 1)} m² de pañete`,
    `${fm(Q.est + Q.cielo, 1)} m² de estuco y pintura`, `${fm(Q.Apiso, 1)} m² de piso · ${fm(Q.Aench, 1)} m² enchape`,
    `${Q.nDoor} puertas · ${fm(Q.Awin, 1)} m² ventanería`,
  ][phase];
  $('#hud').textContent = `FASE ${phase + 1}/10 · ${PHASES[phase].n.toUpperCase()} · ${info}`;
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

export function conectarControles3D() {
  $('#phaseRange').addEventListener('input', e => { app.phase = +e.target.value; applyPhase(); });
  $('#phaseList').addEventListener('click', e => { const b = e.target.closest('[data-ph]'); if (b) { app.phase = +b.dataset.ph; applyPhase(); } });
  $$('[data-cat]').forEach(b => b.addEventListener('click', () => { app.phase = { negra: 5, gris: 6, blanca: 9 }[b.dataset.cat]; applyPhase(); }));
  $('#floorSel').addEventListener('change', e => { app.viewFloor = +e.target.value; applyPhase(); });
  $('#spinBtn').addEventListener('click', e => { T3.spin = !T3.spin; e.target.setAttribute('aria-pressed', T3.spin); });
}
