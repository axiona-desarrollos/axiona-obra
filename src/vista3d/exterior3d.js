/* ==========================================================================
   AXIONA OBRA · Exteriores en 3D: vía, andenes, postes, piscina y parqueadero
   --------------------------------------------------------------------------
   La vía y los andenes se dibujan frente al lindero del frente (son contexto:
   no van al presupuesto ni a la realidad aumentada). La piscina tiene su vaso
   de concreto en la fase de cimentación, el mosaico y la playa en la de
   acabados y el agua con la dotación. El parqueadero lleva adoquín, líneas y
   un carro por cajón. Todo en el marco del frente: x, y del lote → (x, z, -y).
   ========================================================================== */

import * as THREE from 'three';
import { PLAYA, vecindario } from '../motor/index.js';
import { textura, material, std, cajaM, planoM, matPBR } from './materiales.js';
import { arbol, persona, mueble } from './muebles3d.js';

const COLORES_CARRO = [0x1d2733, 0xd9dcdf, 0x7a1f24, 0x2f3a45, 0x9aa3ab, 0x0e3b5c];

function caja(g, x0, x1, y0, y1, z0, z1, mat, ud = {}) {
  const sx = x1 - x0, sy = y1 - y0, sz = z1 - z0;
  if (sx < 0.004 || sy < 0.004 || sz < 0.004) return null;
  const c = [(x0 + x1) / 2, (z0 + z1) / 2, -(y0 + y1) / 2];
  const m = new THREE.Mesh(cajaM(sx, sz, sy, c), mat);
  m.position.set(...c);
  m.castShadow = true; m.receiveShadow = true;
  m.userData = { ...ud };
  g.add(m);
  return m;
}
function plano(g, x0, x1, y0, y1, z, mat, ud = {}) {
  const m = new THREE.Mesh(planoM(x0, x1, y0, y1, z), mat);
  m.receiveShadow = true; m.userData = { ...ud };
  g.add(m);
  return m;
}

/** Carro de calle, sencillo pero con proporciones reales (4.5 × 1.8 × 1.45 m). Mira hacia +x. */
export function carro(color = COLORES_CARRO[0]) {
  const g = new THREE.Group();
  const perfil = [[0, 0.32], [0, 0.72], [0.18, 0.86], [1.25, 0.96], [1.8, 1.4], [3.25, 1.44], [3.9, 1.0], [4.5, 0.92], [4.5, 0.32]];
  const sh = new THREE.Shape(perfil.map(([x, y]) => new THREE.Vector2(x, y)));
  const cuerpo = new THREE.Mesh(new THREE.ExtrudeGeometry(sh, { depth: 1.66, bevelEnabled: true, bevelThickness: 0.07, bevelSize: 0.06, bevelSegments: 3, curveSegments: 4 }),
    material('m|carro|' + color, () => new THREE.MeshPhysicalMaterial({ color, roughness: 0.32, metalness: 0.6, clearcoat: 1, clearcoatRoughness: 0.08 })));
  cuerpo.position.set(-2.25, 0, -0.83);
  const cab = new THREE.Shape([[1.3, 0.97], [1.82, 1.38], [3.22, 1.41], [3.85, 1.0]].map(([x, y]) => new THREE.Vector2(x, y)));
  const vidrio = new THREE.Mesh(new THREE.ExtrudeGeometry(cab, { depth: 1.84, bevelEnabled: false }), material('m|carroVidrio', () => std(0x111820, 0.05, { metalness: 0.4 })));
  vidrio.position.set(-2.25, 0.005, -0.92);
  g.add(cuerpo, vidrio);
  const llanta = material('m|llanta', () => std(0x151515, 0.85)), rin = material('m|rin', () => std(0xb9bec4, 0.25, { metalness: 0.9 }));
  [[-1.45, 0.86], [-1.45, -0.86], [1.4, 0.86], [1.4, -0.86]].forEach(([x, z]) => {
    const r = new THREE.Mesh(new THREE.CylinderGeometry(0.33, 0.33, 0.24, 20), llanta);
    r.rotation.x = Math.PI / 2; r.position.set(x, 0.33, z);
    const c = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.25, 16), rin);
    c.rotation.x = Math.PI / 2; c.position.copy(r.position);
    g.add(r, c);
  });
  // faros y stops: se encienden de noche
  const faro = material('m|faro', () => std(0xfff6e0, 0.3, { emissive: 0xfff1cf, emissiveIntensity: 0 }));
  const stop = material('m|stop', () => std(0x7a0d0d, 0.3, { emissive: 0xff2a1a, emissiveIntensity: 0 }));
  [-0.55, 0.55].forEach(z => {
    const f = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.1, 0.32), faro); f.position.set(2.29, 0.78, z); g.add(f);
    const s = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.1, 0.3), stop); s.position.set(-2.29, 0.86, z); g.add(s);
  });
  g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}

/** Poste de luz de 7 m con brazo y luminaria (la luminaria se enciende de noche). */
function poste(mt) {
  const g = new THREE.Group();
  const metal = material('m|poste', () => std(0x3a3f45, 0.45, { metalness: 0.7 }));
  const fuste = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.09, 7, 12), metal); fuste.position.y = 3.5;
  const brazo = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 1.4), metal); brazo.position.set(0, 6.95, 0.65);
  const cabeza = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.1, 0.6), mt.luminaria); cabeza.position.set(0, 6.88, 1.3);
  g.add(fuste, brazo, cabeza);
  g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  return g;
}

/** Montañas alrededor: una cadena verde cerca y otra azulada lejos (se funden con la neblina), como el Oriente antioqueño. */
function montanas(ent, cx, cy, z) {
  const capa = (radio, hMin, hMax, color, sem, lejana) => {
    const n = 360, pos = [], idx = [];
    for (let i = 0; i <= n; i++) {
      const a = i / n * Math.PI * 2;
      const ola = 0.5 + 0.5 * (0.45 * Math.sin(a * 3 + sem) + 0.25 * Math.sin(a * 7.3 + sem * 2.1) + 0.15 * Math.sin(a * 17.1 + sem * 3.7) + 0.09 * Math.sin(a * 41.3 + sem) + 0.06 * Math.sin(a * 97.7 + sem * 1.7));
      const h = hMin + (hMax - hMin) * ola, rt = radio - h * (lejana ? 0.6 : 2.4);
      pos.push(cx + Math.cos(a) * radio, z - 3, -(cy + Math.sin(a) * radio), cx + Math.cos(a) * rt, z + h, -(cy + Math.sin(a) * rt));
    }
    for (let i = 0; i < n; i++) { const k = i * 2; idx.push(k, k + 2, k + 1, k + 1, k + 2, k + 3); }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
    const m = new THREE.Mesh(g, lejana ? material('m|montLejos', () => new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide }))
      : material('m|montCerca', () => new THREE.MeshStandardMaterial({ color, roughness: 1, side: THREE.DoubleSide })));
    m.userData = { terrain: true }; m.receiveShadow = false;
    ent.add(m);
  };
  capa(330, 5, 26, 0x6a8758, 1.3, false);
  capa(620, 18, 62, 0x9fb1c2, 4.1, true);
}

/** Techo a dos aguas con la cumbrera paralela a la calle. */
function prisma(g, x0, x1, y0, y1, z, h, mat, ud) {
  const a = 0.3, zf = -(y0 - a), zb = -(y1 + a), zm = -(y0 + y1) / 2, xa = x0 - a, xb = x1 + a;
  const V = [[xa, z, zf], [xb, z, zf], [xb, z, zb], [xa, z, zb], [xa, z + h, zm], [xb, z + h, zm]];
  const caras = [0, 1, 5, 0, 5, 4, 2, 3, 4, 2, 4, 5, 0, 4, 3, 1, 2, 5, 0, 3, 2, 0, 2, 1];
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(caras.flatMap(i => V[i]), 3));
  geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = true; m.receiveShadow = true; m.userData = { ...ud };
  g.add(m);
}

const TEJA_VECINO = { ES: 0xa8553a, CA: 0x3b3f45 };

/**
 * Casas de contexto alrededor del lote (motor/vecindario.js). Las ventanas y puertas van en
 * mallas instanciadas: toda la cuadra son pocas llamadas de dibujo.
 * @returns {THREE.Group|null} la fila de enfrente, para ocultarla cuando la camara queda detras de ella
 */
function cuadra(ent, VC, S, z, zb, fh) {
  if (!VC.casas.length) return null;
  const ud = { terrain: true }, enf = new THREE.Group();
  enf.userData = { terrain: true };
  ent.add(enf);
  const losa = material('vec|losa', () => std(0x8d8a84, 0.95));
  const teja = material('vec|teja' + S.pais, () => std(TEJA_VECINO[S.pais] || 0x9a5b40, 0.85));
  const vidrio = material('vec|vidrio', () => std(0x7f9bb0, 0.08, { metalness: 0.75 }));
  const puerta = material('vec|puerta', () => std(0x4a3628, 0.7));
  const huecos = { resto: { v: [], p: [] }, enfrente: { v: [], p: [] } };
  for (const c of VC.casas) {
    const g = c.fila === 'enfrente' ? enf : ent, base = z + 0.15, tope = base + c.alto;
    caja(g, c.x0, c.x1, c.y0, c.y1, zb, tope, material('vec|c' + c.color, () => std(c.color, 0.92)), ud);
    if (c.techo === 'plana') caja(g, c.x0 - 0.12, c.x1 + 0.12, c.y0 - 0.12, c.y1 + 0.12, tope, tope + 0.14, losa, ud);
    else prisma(g, c.x0, c.x1, c.y0, c.y1, tope, Math.min(2.6, (c.y1 - c.y0) * 0.22), teja, ud);
    const H = huecos[c.fila === 'enfrente' ? 'enfrente' : 'resto'];
    const n = Math.max(1, Math.floor((c.x1 - c.x0 - 0.8) / 2.4)), paso = (c.x1 - c.x0) / n;
    // la cara que da a la calle lleva la puerta: y0 en los vecinos del lado, y1 en la fila de enfrente
    const caraCalle = c.fila === 'enfrente' ? c.y1 : c.fila === 'lado' ? c.y0 : null;
    for (const y of [c.y0, c.y1]) {
      const zc = -(y + (y === c.y0 ? -0.02 : 0.02));
      for (let p = 0; p < c.pisos; p++) for (let i = 0; i < n; i++) {
        const xc = c.x0 + paso * (i + 0.5);
        if (p === 0 && i === 0 && y === caraCalle) H.p.push([xc, base + 1.05, zc, 0.95, 2.1]);
        else H.v.push([xc, base + p * fh + 1.5, zc, Math.min(1.3, paso - 0.9), 1.2]);
      }
    }
  }
  const instanciar = (g, lista, mat) => {
    if (!lista.length) return;
    const im = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), mat, lista.length), o = new THREE.Object3D();
    lista.forEach(([x, y, zz, w, h], i) => { o.position.set(x, y, zz); o.scale.set(w, h, 0.06); o.updateMatrix(); im.setMatrixAt(i, o.matrix); });
    im.instanceMatrix.needsUpdate = true; im.userData = { ...ud };
    g.add(im);
  };
  instanciar(ent, huecos.resto.v, vidrio); instanciar(ent, huecos.resto.p, puerta);
  instanciar(enf, huecos.enfrente.v, vidrio); instanciar(enf, huecos.enfrente.p, puerta);
  return enf;
}

/** Árboles a lo largo de los linderos (menos el del frente), sin tapar la casa, la piscina, la pérgola ni el parqueadero. */
function arboleda(g, M, X) {
  const R = M.R, ocup = [{ x0: R.x0 - 3, x1: R.x1 + 3, y0: R.y0 - 3, y1: R.y1 + 3 }];
  const P = X.piscina; if (P) ocup.push({ x0: P.x0 - 2.5, x1: P.x1 + 2.5, y0: P.y0 - 2.5, y1: P.y1 + 2.5 });
  if (X.pergola) ocup.push({ x0: X.pergola.x0 - 1.5, x1: X.pergola.x1 + 1.5, y0: X.pergola.y0 - 1, y1: X.pergola.y1 + 1.5 });
  (X.parqueo?.cajones || []).forEach(c => ocup.push({ x0: c.x0 - 1.5, x1: c.x1 + 1.5, y0: c.y0 - 1.5, y1: c.y1 + 1.5 }));
  const n = M.lot.length, cx = M.lot.reduce((t, p) => t + p.x, 0) / n, cy = M.lot.reduce((t, p) => t + p.y, 0) / n;
  let k = 0;
  for (let i = 0; i < n; i++) {
    if (i === (M.frente || 0)) continue;
    const a = M.lot[i], b = M.lot[(i + 1) % n], L = Math.hypot(b.x - a.x, b.y - a.y);
    if (L < 10) continue;
    let nx = -(b.y - a.y) / L, ny = (b.x - a.x) / L;
    if ((cx - (a.x + b.x) / 2) * nx + (cy - (a.y + b.y) / 2) * ny < 0) { nx = -nx; ny = -ny; }
    for (let t = 6; t < L - 5; t += 6.5) {
      const x = a.x + (b.x - a.x) * t / L + nx * 2.4, y = a.y + (b.y - a.y) * t / L + ny * 2.4;
      if (ocup.some(o => x > o.x0 && x < o.x1 && y > o.y0 && y < o.y1)) continue;
      const tr = arbol(4.6 + (k % 4) * 1.1, k + 5);
      tr.position.set(x, M.zf(x, y), -y); tr.rotation.y = k * 1.7; tr.userData = { fl: 0 };
      g.add(tr); k++;
    }
  }
}

/**
 * Arma los exteriores dentro de los grupos de fase G y devuelve lo que la escena de noche necesita.
 * @returns {{ lamparas: THREE.Vector3[], piscina: null|{ centro: THREE.Vector3, w: number, h: number }, entorno: THREE.Group|null }}
 */
export function construirExterior(root, G, M, S, mt) {
  const X = M.exterior || {}, out = { lamparas: [], piscina: null, entorno: null, carros: [], hogar: null, alRender: null };
  mt.luminaria ||= material('m|luminaria', () => std(0xf3efe6, 0.4, { emissive: 0xffd9a0, emissiveIntensity: 0 }));
  const zMin = Math.min(...M.lot.map(p => p.z ?? 0), M.grid?.zmin ?? 0);

  // ---------------- vía, andenes, bordillo, postes y árboles de la calle
  if (S.entorno !== false && X.via) {
    // la cuadra: vecinos, fila de atras y de enfrente; la via se alarga hasta donde llegan
    const VC = vecindario(M, S);
    const V = VC.casas.length ? { ...X.via, x0: Math.min(X.via.x0, VC.via.x0), x1: Math.max(X.via.x1, VC.via.x1) } : X.via, ent = new THREE.Group();
    ent.userData = { terrain: true, entorno: true };
    const z = V.z, zb = zMin - 0.25, yA = -V.anden, yC = yA - V.calzada, yO = yC - V.anden;
    const asfalto = material('m|asfaltoVia', () => new THREE.MeshStandardMaterial({ map: textura('asfalto'), roughness: 0.92 }));
    const linea = material('m|lineaVia', () => std(0xf2f0e8, 0.6));
    const amarilla = material('m|lineaAmarilla', () => std(0xe8b923, 0.6));
    const bordillo = material('m|bordillo', () => new THREE.MeshStandardMaterial({ map: textura('cemento', { color: '#b4b1aa' }), roughness: 0.9 }));
    const base = matPBR('pasto', 2.6, { color: 0xb9c7aa });
    const ud = { terrain: true };
    // terreno de alrededor (debajo del lote) para que la casa no flote en el cielo
    const cx = (V.lote.x0 + V.lote.x1) / 2, fondo = Math.max(...M.lot.map(p => p.y));
    const cyL = fondo / 2;
    plano(ent, cx - 260, cx + 260, cyL - 260, cyL + 260, zb, base, ud);
    montanas(ent, cx, cyL, zb);
    caja(ent, V.x0, V.x1, yC, yA, zb, z, asfalto, ud);
    // líneas: doble amarilla en el centro y blancas en los bordes
    const yM = (yA + yC) / 2;
    caja(ent, V.x0, V.x1, yM - 0.12, yM - 0.04, z, z + 0.006, amarilla, ud);
    caja(ent, V.x0, V.x1, yM + 0.04, yM + 0.12, z, z + 0.006, amarilla, ud);
    for (let x = V.x0 + 1; x < V.x1 - 3; x += 6) { caja(ent, x, x + 3, yA - 0.45, yA - 0.33, z, z + 0.006, linea, ud); caja(ent, x, x + 3, yC + 0.33, yC + 0.45, z, z + 0.006, linea, ud); }
    // andenes con bordillo a los dos lados
    [[yA, 0], [yO, yC]].forEach(([a, b]) => {
      caja(ent, V.x0, V.x1, a, b, zb, z + 0.15, mt.anden, ud);
      const yb = a === yA ? a : b - 0.15;
      caja(ent, V.x0, V.x1, yb, yb + 0.15, zb, z + 0.17, bordillo, ud);
    });
    // postes en el andén del lote, fuera del frente de la casa y de la línea de la cámara inicial
    for (const x of VC.postes) {
      const p = poste(mt); p.position.set(x, z + 0.15, -(yA + 0.45)); p.rotation.y = Math.PI; p.userData = ud; ent.add(p);
      out.lamparas.push(new THREE.Vector3(x, z + 6.8, -(yA + 0.45 - 1.3)));
    }
    // árboles en el andén de enfrente
    for (let x = V.x0 + 12, k = 0; x < V.x1 - 2; x += 16, k++) {
      const t = arbol(4.5 + (k % 3) * 0.6, k + 7); t.position.set(x, z + 0.15, -(yO + V.anden / 2)); t.userData = ud; ent.add(t);
    }
    out.cuadra = VC.tipo;
    const enf = cuadra(ent, VC, S, z, zb, M.fh || 2.8);
    if (enf) {
      // la fila de enfrente estorba cuando la cámara se sale de la vía hacia atrás: ahí se oculta
      const techoMax = z + Math.max(...VC.casas.map(c => c.alto)) + 3;
      out.alRender = cam => { enf.visible = -cam.position.z > VC.yEnfrente + 0.4 || cam.position.y > techoMax + 14; };
    }
    // un carro estacionado en la vía da la escala
    const c = carro(COLORES_CARRO[(M.lot.length + Math.round(V.x1)) % COLORES_CARRO.length]);
    c.position.set(V.lote.x1 + 3.5, z, -(yA - 1.2)); c.userData = ud; ent.add(c); out.carros.push(c);
    root.add(ent);
    out.entorno = ent;
  }

  // ---------------- piscina: vaso (fase 2), mosaico y playa (fase 8), agua y asoleadoras (fase 10)
  const P = X.piscina;
  if (P) {
    // la piscina interior queda a ras del piso terminado de la casa
    const z = P.interior ? P.z + (M.sistema === 'madera' ? 0.34 : 0.02) : P.z, fondo = z - P.prof - 0.1, t = 0.2;
    const mosaico = matPBR('mosaicoPiscina', 1.0, { roughness: 0.35 });
    const borde = material('m|bordePiscina', () => new THREE.MeshStandardMaterial({ map: textura('cemento', { color: '#e4dfd5' }), roughness: 0.75 }));
    const ud = { fl: 0, piscina: true };
    // vaso de concreto
    caja(G[2], P.x0 - t, P.x1 + t, P.y0 - t, P.y0, fondo - 0.2, z, mt.conc, ud);
    caja(G[2], P.x0 - t, P.x1 + t, P.y1, P.y1 + t, fondo - 0.2, z, mt.conc, ud);
    caja(G[2], P.x0 - t, P.x0, P.y0, P.y1, fondo - 0.2, z, mt.conc, ud);
    caja(G[2], P.x1, P.x1 + t, P.y0, P.y1, fondo - 0.2, z, mt.conc, ud);
    caja(G[2], P.x0, P.x1, P.y0, P.y1, fondo - 0.2, fondo, mt.conc, ud);
    // mosaico por dentro
    const e = 0.006;
    caja(G[8], P.x0, P.x1, P.y0, P.y0 + e, fondo, z - 0.02, mosaico, ud);
    caja(G[8], P.x0, P.x1, P.y1 - e, P.y1, fondo, z - 0.02, mosaico, ud);
    caja(G[8], P.x0, P.x0 + e, P.y0, P.y1, fondo, z - 0.02, mosaico, ud);
    caja(G[8], P.x1 - e, P.x1, P.y0, P.y1, fondo, z - 0.02, mosaico, ud);
    plano(G[8], P.x0, P.x1, P.y0, P.y1, fondo + 0.002, mosaico, ud);
    // escalera de entrada en una esquina
    for (let k = 0; k < 3; k++) caja(G[8], P.x0, P.x0 + 1.2, P.y0, P.y0 + 0.35 * (3 - k), fondo, z - 0.25 - k * 0.32 * (P.prof / 1.2), mosaico, ud);
    // remate (borde de 30 cm) y playa con el piso exterior
    caja(G[8], P.x0 - 0.3, P.x1 + 0.3, P.y0 - 0.3, P.y0, z, z + 0.04, borde, ud);
    caja(G[8], P.x0 - 0.3, P.x1 + 0.3, P.y1, P.y1 + 0.3, z, z + 0.04, borde, ud);
    caja(G[8], P.x0 - 0.3, P.x0, P.y0, P.y1, z, z + 0.04, borde, ud);
    caja(G[8], P.x1, P.x1 + 0.3, P.y0, P.y1, z, z + 0.04, borde, ud);
    const a = P.interior ? 1.2 : PLAYA;
    if (!P.interior) [[P.x0 - a, P.x1 + a, P.y0 - a, P.y0 - 0.3], [P.x0 - a, P.x1 + a, P.y1 + 0.3, P.y1 + a], [P.x0 - a, P.x0 - 0.3, P.y0 - 0.3, P.y1 + 0.3], [P.x1 + 0.3, P.x1 + a, P.y0 - 0.3, P.y1 + 0.3]]
      .forEach(([x0, x1, y0, y1]) => caja(G[8], x0, x1, y0, y1, z - 0.05, z + 0.02, mt.pisoExt, ud));
    // agua
    const agua = new THREE.Mesh(planoM(P.x0, P.x1, P.y0, P.y1, z - 0.12), material('m|agua', () => new THREE.MeshPhysicalMaterial({
      color: 0x3fb7d6, roughness: 0.04, metalness: 0, transmission: 0.55, thickness: 1.2, transparent: true, opacity: 0.62, ior: 1.33, depthWrite: false,
    })));
    agua.userData = { ...ud, agua: true }; agua.renderOrder = 2;
    mt.agua = agua.material;
    G[10].add(agua);
    // asoleadoras sobre la playa (del lado más ancho)
    if (M.dotacionVisible) {
      const tela = material('m|asoleadora', () => std(0xf1ede4, 0.85)), pata = material('m|asoleadoraPata', () => std(0x2d3135, 0.4, { metalness: 0.6 }));
      const n = Math.min(3, Math.floor(P.w / 1.6));
      for (let k = 0; k < n; k++) {
        const x = P.x0 + 0.9 + k * 1.6, y = P.y1 + 0.3 + (a - 0.3) / 2 + 0.05;
        if (a < 0.9) break;
        const g = new THREE.Group();
        caja(g, -0.33, 0.33, -0.95, 0.5, 0.28, 0.36, tela);
        const resp = caja(g, -0.33, 0.33, 0, 0.08, 0, 0.75, tela); if (resp) { resp.rotation.x = -0.9; resp.position.set(0, 0.55, -0.62); }
        caja(g, -0.3, -0.26, -0.9, 0.45, 0.02, 0.28, pata); caja(g, 0.26, 0.3, -0.9, 0.45, 0.02, 0.28, pata);
        g.position.set(x, z + 0.02, -y); g.rotation.y = Math.PI / 2; g.userData = { fl: 0 };
        G[10].add(g);
      }
    }
    out.piscina = { centro: new THREE.Vector3((P.x0 + P.x1) / 2, z - P.prof * 0.6, -(P.y0 + P.y1) / 2), w: P.w, h: P.h };
  }

  // ---------------- parqueadero: adoquín, líneas y un carro por cajón
  const Q = X.parqueo;
  if (Q) {
    const adoquin = material('m|adoquin', () => new THREE.MeshStandardMaterial({ map: textura('baldosa', { color: '#8f8a82', junta: 0.2 }), roughness: 0.95 }));
    const linea = material('m|lineaParq', () => std(0xf2f0e8, 0.6));
    const z = M.dl;
    Q.cajones.forEach((c, k) => {
      caja(G[8], c.x0, c.x1, c.y0, c.y1, z - 0.06, z + 0.01, adoquin, { fl: 0 });
      const deFrente = c.h > c.w;
      if (deFrente) { caja(G[8], c.x0, c.x0 + 0.1, c.y0, c.y1, z + 0.01, z + 0.016, linea, { fl: 0 }); caja(G[8], c.x1 - 0.1, c.x1, c.y0, c.y1, z + 0.01, z + 0.016, linea, { fl: 0 }); }
      else { caja(G[8], c.x0, c.x1, c.y0, c.y0 + 0.1, z + 0.01, z + 0.016, linea, { fl: 0 }); }
      if (!M.dotacionVisible) return;
      const car = carro(COLORES_CARRO[(k + 1) % COLORES_CARRO.length]);
      car.position.set((c.x0 + c.x1) / 2, z + 0.01, -(c.y0 + c.y1) / 2);
      car.rotation.y = deFrente ? Math.PI / 2 : 0;
      car.userData = { fl: 0 };
      G[10].add(car); out.carros.push(car);
    });
  }
  // ---------------- pérgola de madera sobre la terraza de atrás, con su sala de exterior
  const Pg = X.pergola;
  if (Pg) {
    const madera = matPBR('maderaMiel', 2.0, { roughness: 0.75 });
    const z = M.dl, top = z + Math.min(M.fh - M.slab - 0.2, 2.8), ud = { fl: 0 };
    caja(G[8], Pg.x0, Pg.x1, Pg.y0, Pg.y1, z - 0.04, z + 0.02, mt.pisoExt, ud);
    out.pergolaLuz = new THREE.Vector3((Pg.x0 + Pg.x1) / 2, top - 0.2, -(Pg.y0 + Pg.y1) / 2);
    const n = Math.max(2, Math.round(Pg.w / 3) + 1);
    for (let k = 0; k < n; k++) { const x = Pg.x0 + 0.12 + (Pg.w - 0.24) * k / (n - 1); caja(G[9], x - 0.09, x + 0.09, Pg.y1 - 0.3, Pg.y1 - 0.12, z + 0.02, top, madera, ud); }
    caja(G[9], Pg.x0, Pg.x1, Pg.y1 - 0.31, Pg.y1 - 0.11, top, top + 0.24, madera, ud);
    caja(G[9], Pg.x0, Pg.x1, Pg.y0 + 0.02, Pg.y0 + 0.2, top, top + 0.24, madera, ud);
    for (let x = Pg.x0 + 0.1; x < Pg.x1 - 0.05; x += 0.6) caja(G[9], x - 0.035, x + 0.035, Pg.y0, Pg.y1 + 0.15, top + 0.24, top + 0.4, madera, ud);
    for (let y = Pg.y0 + 0.12; y < Pg.y1 + 0.1; y += 0.16) caja(G[9], Pg.x0 - 0.1, Pg.x1 + 0.1, y - 0.025, y + 0.025, top + 0.4, top + 0.45, madera, ud);
    if (M.dotacionVisible) {
      const cxp = Pg.x0 + Pg.w * 0.35, cyp = (Pg.y0 + Pg.y1) / 2;
      [[{ tipo: 'sofa', w: 2.2, d: 0.92, h: 0.82, rot: 180 }, cxp, cyp + 0.95], [{ tipo: 'mesaCentro', w: 1.1, d: 0.6, h: 0.4, rot: 0 }, cxp, cyp - 0.05],
        [{ tipo: 'poltrona', w: 0.82, d: 0.82, h: 0.8, rot: 90 }, cxp + 1.5, cyp - 0.1], [{ tipo: 'poltrona', w: 0.82, d: 0.82, h: 0.8, rot: 270 }, cxp - 1.5, cyp - 0.1],
        [{ tipo: 'comedor', w: 1.8, d: 0.95, h: 0.76, rot: 0, var: 'c6' }, Pg.x0 + Pg.w * 0.78, cyp]]
        .forEach(([it, x, y], i) => {
          const g = mueble({ ...it, id: 'pergola-' + i, x, y, f: 0 });
          g.position.set(x, z + 0.02, -y); g.rotation.y = it.rot * Math.PI / 180 + Math.PI; g.userData = { fl: 0 };
          G[10].add(g);
        });
    }
  }

  // ---------------- chimenea: el ducto de piedra por fuera y el hogar adentro de la sala
  const Ch = X.chimenea;
  if (Ch) {
    const piedra = mt.fachadaBase || matPBR('piedraGris', 2.0);
    const caras = M.techo?.caras || [];
    const zTecho = caras.length ? Math.max(...caras.flatMap(c => c.pts.map(p => p[2]))) : M.dl + M.F * M.fh;
    const top = zTecho + 0.9, z = M.dl;
    caja(G[4], Ch.x0, Ch.x1, Ch.y0, Ch.y1, z - 0.05, top, piedra, { fl: 0, chimenea: true });
    caja(G[4], Ch.x0 - 0.06, Ch.x1 + 0.06, Ch.y0 - 0.06, Ch.y1 + 0.06, top, top + 0.08, mt.conc, { fl: 0, chimenea: true });
    const cyl = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.5, 14), material('m|ducto', () => std(0x2a2b2d, 0.5, { metalness: 0.6 })));
    cyl.position.set((Ch.x0 + Ch.x1) / 2, top + 0.33, -(Ch.y0 + Ch.y1) / 2); cyl.castShadow = true; cyl.userData = { fl: 0 };
    G[4].add(cyl);
    // el hogar, contra el mismo muro por dentro
    const p = 0.55, t0 = Ch.t0, t1 = Ch.t1, c = Ch.c;
    const h = Ch.lado === 'N' ? { x0: t0, x1: t1, y0: c - 0.1 - p, y1: c - 0.1 } : Ch.lado === 'W' ? { x0: c + 0.1, x1: c + 0.1 + p, y0: t0, y1: t1 } : { x0: c - 0.1 - p, x1: c - 0.1, y0: t0, y1: t1 };
    caja(G[9], h.x0, h.x1, h.y0, h.y1, z + 0.02, z + 1.3, piedra, { fl: 0 });
    caja(G[9], h.x0 - 0.08, h.x1 + 0.08, h.y0 - 0.08, h.y1 + 0.08, z + 1.3, z + 1.36, mt.madera, { fl: 0 });
    mt.fuego ||= material('m|fuego', () => std(0xff8a2a, 0.6, { emissive: 0xff6a00, emissiveIntensity: 0.7 }));
    const hueco = material('m|hueco', () => std(0x141210, 1));
    const m = (h.x0 + h.x1) / 2, mm = (h.y0 + h.y1) / 2;
    if (Ch.lado === 'N') { caja(G[9], m - 0.45, m + 0.45, h.y0 - 0.01, h.y0 + 0.02, z + 0.3, z + 0.95, hueco, { fl: 0 }); caja(G[9], m - 0.3, m + 0.3, h.y0 - 0.02, h.y0 + 0.01, z + 0.32, z + 0.5, mt.fuego, { fl: 0 }); out.hogar = new THREE.Vector3(m, z + 0.5, -(h.y0 - 0.4)); }
    else { const f = Ch.lado === 'W' ? h.x1 : h.x0, s = Ch.lado === 'W' ? 1 : -1; caja(G[9], f - 0.02 * s, f + 0.01 * s, mm - 0.45, mm + 0.45, z + 0.3, z + 0.95, hueco, { fl: 0 }); caja(G[9], f + 0.005 * s, f + 0.02 * s, mm - 0.3, mm + 0.3, z + 0.32, z + 0.5, mt.fuego, { fl: 0 }); out.hogar = new THREE.Vector3(f + 0.4 * s, z + 0.5, -mm); }
  }

  // ---------------- árboles en los linderos y personas que dan escala
  if (M.dotacionVisible) {
    arboleda(G[10], M, X);
    if (S.personas !== false) {
      const sitios = [];
      if (Pg) sitios.push([Pg.x0 + Pg.w * 0.55, Pg.y1 + 0.9, 'pie', 0.3, 0], [Pg.x0 + Pg.w * 0.55 + 0.75, Pg.y1 + 1.15, 'pie', -2.7, 1]);
      if (P) sitios.push([P.x1 + 0.65, (P.y0 + P.y1) / 2, 'camina', 1.6, 2]);
      const main = M.floors[0].ops.find(o => o.kind === 'main');
      if (main) sitios.push([(main.a + main.b) / 2 + 1.4, M.R.y0 - 2.4, 'camina', 2.9, 3]);
      sitios.forEach(([x, y, pose, rot, k]) => { const p = persona(pose, k); p.position.set(x, M.dl + 0.02, -y); p.rotation.y = rot; p.userData = { fl: 0 }; G[10].add(p); });
    }
  }
  return out;
}
