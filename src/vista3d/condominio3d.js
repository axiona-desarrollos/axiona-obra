/* ==========================================================================
   AXIONA OBRA · Condominio en 3D
   --------------------------------------------------------------------------
   El terreno grande con su via, andenes, arboles y los lotes pintados segun
   su estado (libre, reservado, vendido). En cada lote va la envolvente de
   la casa del proyecto, mirando a la via. Tocar un lote lo selecciona; desde
   ahi se entra a la casa a pie. Todo en el marco local del terreno grande.
   ========================================================================== */

import * as THREE from 'three';
import { lotear } from '../motor/condominio.js';
import { tres, cascaron, render3D, buildScene } from './escena.js';
import { textura, material, std } from './materiales.js';
import { arbol } from './muebles3d.js';
import { app, tr } from '../ui/comun.js';

const COLOR = { libre: 0x41e2a4, reservado: 0xffae2b, vendido: 0xff5f78 };
let C = null;

function etiqueta(texto) {
  const cv = document.createElement('canvas'); cv.width = 256; cv.height = 96;
  const g = cv.getContext('2d');
  g.fillStyle = 'rgba(8,12,17,.82)'; g.beginPath(); g.roundRect(4, 4, 248, 88, 18); g.fill();
  g.fillStyle = '#e3eaf2'; g.font = 'bold 52px Helvetica, Arial'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(texto, 128, 50);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false }));
  s.scale.set(3.2, 1.2, 1);
  return s;
}

/** Medidas del lote tipo: las del condominio o las del lote del proyecto. */
export function medidasLote(S, M) {
  return { frente: S.condominio.lote || Math.round(M.bbox.w * 10) / 10, fondo: S.condominio.fondo || Math.round(M.bbox.h * 10) / 10 };
}

export function construirCondominio() {
  const S = app.S, M = app.M;
  if (app.threeDirty || !tres.root) buildScene();
  const { frente, fondo } = medidasLote(S, M);
  const L = lotear(S.condominio.macro, { via: S.condominio.via, frente, fondo });
  if (L.err || !L.lotes.length) return { L, grupo: null };
  const grupo = new THREE.Group();
  const zs = S.condominio.macro.map(p => +p.z || 0), z0 = zs.reduce((a, b) => a + b, 0) / zs.length;
  // terreno
  const forma = new THREE.Shape(L.loc.map(p => new THREE.Vector2(p.x, p.y)));
  const suelo = new THREE.Mesh(new THREE.ShapeGeometry(forma).rotateX(-Math.PI / 2), material('c|pasto', () => {
    const t = textura('pasto').clone(); t.needsUpdate = true; t.repeat.set(1 / 3, 1 / 3);
    return new THREE.MeshStandardMaterial({ map: t, roughness: 1 });
  }));
  // la forma queda en (x, 0, -y): coordenadas de textura en metros
  const uv = suelo.geometry.attributes.uv, pos = suelo.geometry.attributes.position;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, pos.getX(i), -pos.getZ(i));
  suelo.position.y = z0; suelo.receiveShadow = true;
  grupo.add(suelo);
  // via y andenes
  const v = L.via, vx0 = v[0].x, vx1 = v[1].x, vy0 = v[0].y, vy1 = v[2].y;
  const asf = material('c|asfalto', () => new THREE.MeshStandardMaterial({ map: textura('asfalto'), roughness: 0.95 }));
  const caja = (x0, x1, y0, y1, za, zb, m) => { const me = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, zb - za, y1 - y0), m); me.position.set((x0 + x1) / 2, z0 + (za + zb) / 2, -(y0 + y1) / 2); me.receiveShadow = true; grupo.add(me); return me; };
  caja(vx0, vx1, vy0, vy1, 0, 0.03, asf);
  const anden = material('c|anden', () => std(0xc9c3b6, 0.9));
  caja(vx0, vx1, vy0 - 1.2, vy0, 0, 0.12, anden);
  caja(vx0, vx1, vy1, vy1 + 1.2, 0, 0.12, anden);
  const linea = material('c|linea', () => std(0xf2f2f2, 0.6));
  for (let x = vx0 + 1; x < vx1 - 2; x += 6) caja(x, x + 3, (vy0 + vy1) / 2 - 0.06, (vy0 + vy1) / 2 + 0.06, 0.03, 0.035, linea);
  for (let x = vx0 + 4, k = 0; x < vx1 - 2; x += 12, k++) [vy0 - 0.6, vy1 + 0.6].forEach((y, j) => { const t = arbol(4.2 + ((k + j) % 3) * 0.5, k + j); t.position.set(x + j * 6, z0 + 0.12, -y); grupo.add(t); });
  // lotes con la casa
  const casa = cascaron();
  const R = M.R;
  const molde = new THREE.Group();
  if (casa) { casa.position.set(-R.x0, 0, R.y0); molde.add(casa); }
  const pads = [];
  L.lotes.forEach(lote => {
    const est = S.condominio.estados[lote.id] || 'libre';
    const pad = new THREE.Mesh(new THREE.PlaneGeometry(frente - 0.3, fondo - 0.3).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: COLOR[est], transparent: true, opacity: 0.22, roughness: 1, depthWrite: false }));
    pad.position.set(lote.x + frente / 2, z0 + 0.02, -(lote.ya + lote.yb) / 2);
    pad.userData = { lote: lote.id };
    grupo.add(pad); pads.push(pad);
    const borde = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(lote.poly.map(p => new THREE.Vector3(p.x, z0 + 0.04, -p.y))), new THREE.LineBasicMaterial({ color: COLOR[est] }));
    grupo.add(borde);
    if (casa) {
      const dx = Math.max(0, (frente - R.w) / 2), dy = Math.min(Math.max(0.5, S.ret.front), Math.max(0.5, fondo - R.h - 0.5));
      const c = molde.clone(true);
      if (lote.lado === 'N') c.position.set(lote.x + dx, z0, -(lote.ya + dy));
      else { c.position.set(lote.x + dx + R.w, z0, -(lote.yb - dy)); c.rotation.y = Math.PI; }
      grupo.add(c);
    }
    const s = etiqueta(lote.id);
    s.position.set(lote.x + frente / 2, z0 + M.F * M.fh + 3.2, -(lote.lado === 'N' ? lote.ya + 1 : lote.yb - 1));
    grupo.add(s);
  });
  grupo.traverse(o => { if (o.isMesh) o.castShadow = true; });
  return { L, grupo, pads, z0 };
}

/** Muestra u oculta el condominio en la vista 3D. alElegir(id) se llama al tocar un lote. */
export function mostrarCondominio(on, alElegir) {
  const T = tres;
  if (C) { T.scene.remove(C.grupo); C.grupo.traverse(o => { if (o.geometry) o.geometry.dispose(); }); T.renderer.domElement.removeEventListener('pointerup', C.click); T.renderer.domElement.removeEventListener('pointerdown', C.down); C = null; }
  if (T.root) T.root.visible = !on;
  if (!on) { T.framed = false; if (T.root) buildScene(); render3D(); return null; }
  const r = construirCondominio();
  if (!r.grupo) { if (T.root) T.root.visible = true; return r; }
  C = r;
  T.scene.add(r.grupo);
  const L = r.L, cx = L.ancho / 2 + Math.min(...L.loc.map(p => p.x)), cy = L.largo / 2 + Math.min(...L.loc.map(p => p.y)), s = Math.max(L.ancho, L.largo);
  T.cam.position.set(cx + s * 0.55, r.z0 + s * 0.6, -cy + s * 0.75);
  T.ctl.target.set(cx, r.z0, -cy);
  T.ctl.update();
  const sh = T.sun.shadow.camera;
  sh.left = -s; sh.right = s; sh.top = s; sh.bottom = -s; sh.far = s * 6; sh.updateProjectionMatrix();
  T.sun.position.set(cx - s * 0.6, r.z0 + s * 1.2, -cy + s * 0.5); T.sun.target.position.set(cx, r.z0, -cy);
  const ray = new THREE.Raycaster(), v = new THREE.Vector2();
  let inicio = null;
  C.down = e => { inicio = [e.clientX, e.clientY]; };
  T.renderer.domElement.addEventListener('pointerdown', C.down);
  C.click = e => {
    if (inicio && Math.hypot(e.clientX - inicio[0], e.clientY - inicio[1]) > 6) return;
    const rc = T.renderer.domElement.getBoundingClientRect();
    v.set((e.clientX - rc.left) / rc.width * 2 - 1, -(e.clientY - rc.top) / rc.height * 2 + 1);
    ray.setFromCamera(v, T.cam);
    const hit = ray.intersectObjects(C.pads)[0];
    if (hit) alElegir?.(hit.object.userData.lote);
  };
  T.renderer.domElement.addEventListener('pointerup', C.click);
  render3D();
  return r;
}

/** Maqueta del condominio para AR (escala 1:200 por defecto). */
export function condominioParaLlevar(escala = 0.005) {
  if (!C) return null;
  const w = new THREE.Group(), c = C.grupo.clone(true);
  const L = C.L, cx = L.ancho / 2 + Math.min(...L.loc.map(p => p.x)), cy = L.largo / 2 + Math.min(...L.loc.map(p => p.y));
  c.position.set(-cx, -C.z0, cy);
  w.add(c); w.scale.setScalar(escala);
  return w;
}

export const condominioActivo = () => !!C;
export const nombreEstado = e => tr({ libre: { es: 'Libre', en: 'Available' }, reservado: { es: 'Reservado', en: 'Reserved' }, vendido: { es: 'Vendido', en: 'Sold' } }[e] || { es: e });
