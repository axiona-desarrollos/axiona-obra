/* ==========================================================================
   AXIONA OBRA · La casa de noche
   --------------------------------------------------------------------------
   Cielo nocturno con estrellas, luna fría, ventanas encendidas (no todas,
   como en una casa de verdad), una luz cálida en cada espacio, la fachada
   bañada desde el piso, los postes de la calle y la piscina iluminada.
   Las luces se rehacen cada vez que se rearma la escena.
   ========================================================================== */

import * as THREE from 'three';

function cieloNoche() {
  const W = 2048, H = 1024, cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const g = cv.getContext('2d'), gr = g.createLinearGradient(0, 0, 0, H);
  gr.addColorStop(0, '#02040a'); gr.addColorStop(0.38, '#071026'); gr.addColorStop(0.5, '#1b2440'); gr.addColorStop(0.53, '#2a2a3a'); gr.addColorStop(1, '#05060a');
  g.fillStyle = gr; g.fillRect(0, 0, W, H);
  // estrellas (semilla fija) solo en el cielo
  let s = 1234567;
  const r = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  for (let i = 0; i < 2600; i++) {
    const y = r() * H * 0.47, a = 0.25 + r() * 0.75 * (1 - y / (H * 0.5));
    g.fillStyle = `rgba(255,255,255,${a.toFixed(2)})`;
    const t = r() < 0.04 ? 2 : 1;
    g.fillRect(r() * W, y, t, t);
  }
  // resplandor de la ciudad en el horizonte
  const h = g.createLinearGradient(0, H * 0.42, 0, H * 0.52);
  h.addColorStop(0, 'rgba(255,170,90,0)'); h.addColorStop(1, 'rgba(255,170,90,0.18)');
  g.fillStyle = h; g.fillRect(0, H * 0.42, W, H * 0.1);
  const t = new THREE.CanvasTexture(cv);
  t.mapping = THREE.EquirectangularReflectionMapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const movil = () => typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;

/** Prende o apaga la noche. T3: estado del 3D; app: modelo y estado de la app. */
export function aplicarNoche(T3, on, M) {
  const { scene, renderer: r } = T3;
  if (!scene) return;
  if (T3.luzNoche) { scene.remove(T3.luzNoche); T3.luzNoche.traverse(o => o.dispose?.()); T3.luzNoche = null; }
  const hemi = scene.children.find(o => o.isHemisphereLight), sol = T3.sun, mt = T3.mat || {};
  if (!T3.dia) T3.dia = { hemi: hemi?.intensity ?? 0.9, hemiColor: hemi?.color.getHex(), sol: sol.intensity, solColor: sol.color.getHex(), exp: r.toneMappingExposure };
  const lumi = [mt.luminaria, mt.ventana].filter(Boolean);
  T3.noche = !!on;
  scene.userData.noche = !!on;
  if (!on) {
    if (hemi) { hemi.intensity = T3.dia.hemi; hemi.color.setHex(T3.dia.hemiColor); }
    sol.intensity = T3.dia.sol; sol.color.setHex(T3.dia.solColor);
    r.toneMappingExposure = T3.dia.exp;
    if (T3.cieloNoche && scene.background === T3.cieloNoche) scene.background = null;
    lumi.forEach(m => { m.emissiveIntensity = 0; });
    if (mt.ventana) { mt.ventana.opacity = 0.28; }
    if (mt.agua) mt.agua.emissiveIntensity = 0;
    return;
  }
  T3.cieloNoche ||= cieloNoche();
  scene.background = T3.cieloNoche;
  scene.fog = new THREE.Fog(0x05070d, 90, 360);
  scene.environmentIntensity = 0.05;
  if (hemi) { hemi.intensity = 0.16; hemi.color.setHex(0x8fa6d8); }
  sol.intensity = 0.32; sol.color.setHex(0xa9bcff);
  r.toneMappingExposure = 1.35;
  if (mt.luminaria) mt.luminaria.emissiveIntensity = 3;
  if (mt.ventana) { mt.ventana.emissive.setHex(0xffc27d); mt.ventana.emissiveIntensity = 1.1; mt.ventana.opacity = 0.82; }
  if (mt.agua) { mt.agua.emissive.setHex(0x1aa3c8); mt.agua.emissiveIntensity = 0.55; }
  if (!M || M.err) return;
  const g = new THREE.Group(), tope = movil() ? 4 : 12;
  // una luz cálida por espacio (las más grandes primero)
  const espacios = [];
  M.floors.forEach(fl => fl.rects.forEach(rc => { if (!rc.stair && !rc.asc) espacios.push({ rc, f: fl.f }); }));
  espacios.sort((a, b) => b.rc.area - a.rc.area).slice(0, tope).forEach(({ rc, f }) => {
    const l = new THREE.PointLight(0xffc98f, 7 + Math.min(10, rc.area * 0.35), 9, 1.6);
    l.position.set((rc.x0 + rc.x1) / 2, M.dl + f * M.fh + M.fh * 0.78, -(rc.y0 + rc.y1) / 2);
    g.add(l);
  });
  // la fachada bañada de luz desde el antejardín
  const R = M.R, H = M.F * M.fh;
  [[R.x0 + 0.6, R.y0 - 1.2], [R.x1 - 0.6, R.y0 - 1.2]].forEach(([x, y]) => {
    const s = new THREE.SpotLight(0xffd29c, 55, H + 8, 0.55, 0.7, 1.4);
    s.position.set(x, M.dl + 0.2, -y); s.target.position.set(x + (x < (R.x0 + R.x1) / 2 ? 1.2 : -1.2), M.dl + H, -R.y0);
    g.add(s, s.target);
  });
  // postes de la calle y piscina
  (T3.exterior?.lamparas || []).slice(0, movil() ? 1 : 4).forEach(p => {
    const s = new THREE.SpotLight(0xffd59e, 120, 20, 1.05, 0.65, 1.5);
    s.position.copy(p); s.target.position.set(p.x, p.y - 7, p.z);
    g.add(s, s.target);
  });
  const P = T3.exterior?.piscina;
  if (P) { const l = new THREE.PointLight(0x46d7ff, 14, Math.max(P.w, P.h) + 2, 1.4); l.position.copy(P.centro); g.add(l); }
  T3.luzNoche = g;
  scene.add(g);
}
