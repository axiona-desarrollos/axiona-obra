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
import { PLAYA } from '../motor/index.js';
import { textura, material, std, cajaM, planoM, matPBR } from './materiales.js';
import { arbol } from './muebles3d.js';

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

/**
 * Arma los exteriores dentro de los grupos de fase G y devuelve lo que la escena de noche necesita.
 * @returns {{ lamparas: THREE.Vector3[], piscina: null|{ centro: THREE.Vector3, w: number, h: number }, entorno: THREE.Group|null }}
 */
export function construirExterior(root, G, M, S, mt) {
  const X = M.exterior || {}, out = { lamparas: [], piscina: null, entorno: null, carros: [] };
  mt.luminaria ||= material('m|luminaria', () => std(0xf3efe6, 0.4, { emissive: 0xffd9a0, emissiveIntensity: 0 }));
  const zMin = Math.min(...M.lot.map(p => p.z ?? 0), M.grid?.zmin ?? 0);

  // ---------------- vía, andenes, bordillo, postes y árboles de la calle
  if (S.entorno !== false && X.via) {
    const V = X.via, ent = new THREE.Group();
    ent.userData = { terrain: true, entorno: true };
    const z = V.z, zb = zMin - 0.25, yA = -V.anden, yC = yA - V.calzada, yO = yC - V.anden;
    const asfalto = material('m|asfaltoVia', () => new THREE.MeshStandardMaterial({ map: textura('asfalto'), roughness: 0.92 }));
    const linea = material('m|lineaVia', () => std(0xf2f0e8, 0.6));
    const amarilla = material('m|lineaAmarilla', () => std(0xe8b923, 0.6));
    const bordillo = material('m|bordillo', () => new THREE.MeshStandardMaterial({ map: textura('cemento', { color: '#b4b1aa' }), roughness: 0.9 }));
    const base = material('m|baseEntorno', () => new THREE.MeshStandardMaterial({ map: textura('pasto'), color: 0x9aa58a, roughness: 1 }));
    const ud = { terrain: true };
    // terreno de alrededor (debajo del lote) para que la casa no flote en el cielo
    const cx = (V.lote.x0 + V.lote.x1) / 2, fondo = Math.max(...M.lot.map(p => p.y));
    plano(ent, cx - 70, cx + 70, yO - 30, fondo + 40, zb, base, ud);
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
    // postes cada 16 m en el andén del lote y árboles en el de enfrente
    for (let x = V.x0 + 4, k = 0; x < V.x1 - 2; x += 16, k++) {
      const p = poste(mt); p.position.set(x, z + 0.15, -(yA + 0.45)); p.rotation.y = Math.PI; p.userData = ud; ent.add(p);
      out.lamparas.push(new THREE.Vector3(x, z + 6.8, -(yA + 0.45 - 1.3)));
      const t = arbol(4.5 + (k % 3) * 0.6, k + 7); t.position.set(x + 8, z + 0.15, -(yO + V.anden / 2)); t.userData = ud; ent.add(t);
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
    const z = P.z, fondo = z - P.prof - 0.1, t = 0.2;
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
    const a = PLAYA;
    [[P.x0 - a, P.x1 + a, P.y0 - a, P.y0 - 0.3], [P.x0 - a, P.x1 + a, P.y1 + 0.3, P.y1 + a], [P.x0 - a, P.x0 - 0.3, P.y0 - 0.3, P.y1 + 0.3], [P.x1 + 0.3, P.x1 + a, P.y0 - 0.3, P.y1 + 0.3]]
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
  return out;
}
