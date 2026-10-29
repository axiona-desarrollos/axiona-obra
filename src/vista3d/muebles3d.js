/* ==========================================================================
   AXIONA OBRA · Muebles en 3D
   --------------------------------------------------------------------------
   Cada mueble se arma con piezas simples (cajas redondeadas, cilindros,
   esferas) en su propio sistema: ancho en x, fondo en z con el frente hacia
   +z, apoyado en y = 0. La paleta del estilo pone la madera, las telas, el
   metal y el meson. Pocas piezas por mueble para que una casa amoblada se
   mueva fluida en un celular.
   ========================================================================== */

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { textura, material, std } from './materiales.js';

let PAL = null, M = null;

/** Prepara los materiales de un estilo (se llama al construir la escena). */
export function paleta(E) {
  PAL = E;
  const k = E.madera + E.tela + E.metal + E.meson + E.acento;
  M = {
    madera: material('mu|madera|' + E.madera, () => new THREE.MeshStandardMaterial({ map: textura('madera', { tono: E.madera }), roughness: 0.6 })),
    tela: material('mu|tela|' + k, () => new THREE.MeshStandardMaterial({ map: textura('tela', { color: E.tela }), roughness: 0.95 })),
    telaClara: material('mu|telaC|' + k, () => new THREE.MeshStandardMaterial({ map: textura('tela', { color: E.telaClara }), roughness: 0.95 })),
    blanco: material('mu|blanco', () => std(0xf3f2ee, 0.85)),
    cama: material('mu|sabana', () => std(0xf7f6f2, 0.95)),
    metal: material('mu|metal|' + E.metal, () => std(E.metal, 0.32, { metalness: 0.75 })),
    meson: material('mu|meson|' + E.meson, () => new THREE.MeshStandardMaterial({ map: textura('marmol', { color: E.meson }), roughness: 0.2 })),
    laca: material('mu|laca|' + E.acento, () => std(E.acento, 0.45)),
    lacaB: material('mu|lacaB', () => std(0xeceae5, 0.4)),
    ceramica: material('mu|ceramica', () => std(0xfbfbfa, 0.12)),
    cromo: material('mu|cromo', () => std(0xd8dadc, 0.15, { metalness: 0.95 })),
    acero: material('mu|acero', () => std(0xc9ccd0, 0.3, { metalness: 0.85 })),
    negro: material('mu|negro', () => std(0x141516, 0.35)),
    pantalla: material('mu|pantalla', () => std(0x0b0d10, 0.12, { metalness: 0.4 })),
    vidrio: material('mu|vidrio', () => new THREE.MeshStandardMaterial({ color: 0xcfe9f2, roughness: 0.05, transparent: true, opacity: 0.22, depthWrite: false })),
    espejo: material('mu|espejo', () => std(0xdfe8ee, 0.04, { metalness: 1 })),
    luz: material('mu|luz', () => new THREE.MeshStandardMaterial({ color: 0xfff1d6, emissive: 0xffd9a0, emissiveIntensity: 1.4, roughness: 0.6 })),
    hoja: material('mu|hoja', () => std(0x3f6b34, 0.8)),
    hoja2: material('mu|hoja2', () => std(0x56853f, 0.8)),
    matera: material('mu|matera', () => std(0xb36b47, 0.85)),
    agua: material('mu|agua', () => std(0x9fd3e6, 0.05, { metalness: 0.1 })),
  };
  return M;
}

const caja = (g, w, h, d, m, x = 0, y = 0, z = 0, r = 0) => {
  const geo = r > 0 ? new RoundedBoxGeometry(w, h, d, 2, Math.min(r, w / 2 - 0.001, h / 2 - 0.001, d / 2 - 0.001)) : new THREE.BoxGeometry(w, h, d);
  const me = new THREE.Mesh(geo, m);
  me.position.set(x, y + h / 2, z);
  me.castShadow = true; me.receiveShadow = true;
  g.add(me);
  return me;
};
const cil = (g, rt, rb, h, m, x = 0, y = 0, z = 0, seg = 18) => {
  const me = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), m);
  me.position.set(x, y + h / 2, z);
  me.castShadow = true; me.receiveShadow = true;
  g.add(me);
  return me;
};
const esf = (g, r, m, x, y, z, sx = 1, sy = 1, sz = 1) => {
  const me = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 1), m);
  me.position.set(x, y, z); me.scale.set(sx, sy, sz);
  me.castShadow = true;
  g.add(me);
  return me;
};
const patas = (g, w, d, h, m, r = 0.02, inset = 0.06) => [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([a, b]) => cil(g, r, r, h, m, a * (w / 2 - inset), 0, b * (d / 2 - inset), 8));

function silla(g, x, z, rot, mat) {
  const s = new THREE.Group();
  caja(s, 0.44, 0.06, 0.44, mat.tela, 0, 0.42, 0, 0.02);
  caja(s, 0.44, 0.45, 0.05, mat.tela, 0, 0.48, -0.2, 0.02);
  patas(s, 0.44, 0.44, 0.42, mat.metal, 0.012, 0.04);
  s.position.set(x, 0, z); s.rotation.y = rot;
  g.add(s);
}

const ARTE = new Map();
function lienzoArte(semilla, P) {
  if (ARTE.has(semilla)) return ARTE.get(semilla);
  const cv = document.createElement('canvas'); cv.width = 256; cv.height = 176;
  const c = cv.getContext('2d');
  let s = semilla;
  const r = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  c.fillStyle = P.telaClara; c.fillRect(0, 0, 256, 176);
  const cols = [P.acento, P.tela, P.metal, '#d9cbb3', '#2f3a40'];
  for (let k = 0; k < 6; k++) { c.fillStyle = cols[(r() * cols.length) | 0]; c.globalAlpha = 0.55 + r() * 0.4; c.beginPath(); c.arc(r() * 256, r() * 176, 20 + r() * 70, 0, Math.PI * 2); c.fill(); }
  c.globalAlpha = 1; c.strokeStyle = '#222'; c.lineWidth = 2; c.beginPath(); c.moveTo(0, 110 + r() * 40); c.bezierCurveTo(80, 60, 170, 160, 256, 90); c.stroke();
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.MeshStandardMaterial({ map: t, roughness: 0.9 });
  ARTE.set(semilla, m);
  return m;
}

/** Arma un mueble del amoblado. Devuelve un grupo con el frente hacia +z. */
export function mueble(m) {
  const g = new THREE.Group(), w = m.w, d = m.d, X = M;
  const hw = w / 2, hd = d / 2;
  switch (m.tipo) {
    case 'cama': {
      caja(g, w, 0.3, d, X.madera, 0, 0, 0, 0.02);
      caja(g, w - 0.04, 0.24, d - 0.06, X.cama, 0, 0.3, 0.01, 0.06);
      caja(g, w - 0.02, 0.08, d * 0.62, X.tela, 0, 0.5, hd - d * 0.31, 0.04);
      caja(g, w + 0.06, 1.05, 0.1, X.telaClara, 0, 0, -hd - 0.02, 0.04);
      const np = w > 1.2 ? 2 : 1;
      for (let k = 0; k < np; k++) caja(g, (w - 0.3) / np - 0.05, 0.14, 0.4, X.blanco, -hw + 0.15 + ((w - 0.3) / np) * (k + 0.5), 0.52, -hd + 0.32, 0.06);
      break;
    }
    case 'mesaNoche': caja(g, w, 0.52, d, X.madera, 0, 0, 0, 0.015); caja(g, w - 0.06, 0.01, 0.01, X.negro, 0, 0.32, hd); cil(g, 0.05, 0.06, 0.18, X.metal, 0, 0.52, -0.05, 12); cil(g, 0.09, 0.13, 0.16, X.luz, 0, 0.7, -0.05, 16); break;
    case 'closet': {
      caja(g, w, 2.3, d, X.lacaB, 0, 0, 0, 0.01);
      const n = Math.max(2, Math.round(w / 0.6));
      for (let k = 1; k < n; k++) caja(g, 0.008, 2.2, 0.01, X.negro, -hw + w * k / n, 0.05, hd + 0.001);
      for (let k = 0; k < n; k++) caja(g, 0.02, 0.35, 0.03, X.metal, -hw + w * (k + 0.5) / n + (k % 2 ? -0.08 : 0.08), 1.0, hd + 0.01);
      break;
    }
    case 'comoda': caja(g, w, 0.8, d, X.madera, 0, 0.05, 0, 0.015); [0.25, 0.5, 0.75].forEach(h => caja(g, w - 0.08, 0.008, 0.01, X.negro, 0, 0.05 + h * 0.8, hd)); patas(g, w, d, 0.05, X.metal, 0.015); break;
    case 'escritorio': caja(g, w, 0.04, d, X.madera, 0, 0.72, 0, 0.01); patas(g, w, d, 0.72, X.metal, 0.018); caja(g, 0.55, 0.32, 0.03, X.pantalla, 0, 0.8, -hd + 0.12); caja(g, 0.06, 0.06, 0.06, X.metal, 0, 0.76, -hd + 0.14); break;
    case 'sillaEsc': caja(g, 0.48, 0.07, 0.46, X.tela, 0, 0.44, 0, 0.03); caja(g, 0.46, 0.5, 0.06, X.tela, 0, 0.52, -0.21, 0.03); cil(g, 0.025, 0.025, 0.4, X.metal, 0, 0.04, 0, 8); cil(g, 0.26, 0.26, 0.04, X.negro, 0, 0, 0, 5); break;
    case 'biblioteca': {
      caja(g, w, 2.0, d, X.madera, 0, 0, 0);
      for (let k = 0; k < 5; k++) {
        const y = 0.08 + k * 0.38;
        caja(g, w - 0.04, 0.3, d - 0.02, X.negro, 0, y + 0.02, 0.01);
        let x = -hw + 0.06;
        let s = (k + 1) * 13 + Math.round(w * 100);
        while (x < hw - 0.08) {
          s = (s * 16807) % 2147483647;
          const bw = 0.025 + (s % 30) / 1000, bh = 0.2 + (s % 9) / 100;
          caja(g, bw, bh, d * 0.75, [X.laca, X.tela, X.telaClara, X.blanco, X.madera][s % 5], x + bw / 2, y + 0.02, 0.02);
          x += bw + 0.004;
        }
      }
      break;
    }
    case 'sofa': case 'poltrona': {
      const brazo = 0.16;
      caja(g, w, 0.22, d, X.tela, 0, 0.08, 0, 0.05);
      caja(g, w, 0.5, 0.2, X.tela, 0, 0.3, -hd + 0.1, 0.07);
      caja(g, brazo, 0.32, d, X.tela, -hw + brazo / 2, 0.3, 0, 0.06);
      caja(g, brazo, 0.32, d, X.tela, hw - brazo / 2, 0.3, 0, 0.06);
      const n = m.tipo === 'sofa' ? 3 : 1, cw = (w - 2 * brazo) / n;
      for (let k = 0; k < n; k++) {
        caja(g, cw - 0.02, 0.14, d - 0.26, X.telaClara, -hw + brazo + cw * (k + 0.5), 0.3, 0.08, 0.06);
        caja(g, cw - 0.04, 0.36, 0.16, X.telaClara, -hw + brazo + cw * (k + 0.5), 0.44, -hd + 0.27, 0.07);
      }
      patas(g, w, d, 0.08, X.metal, 0.018, 0.08);
      break;
    }
    case 'mesaCentro': caja(g, w, 0.05, d, X.meson, 0, 0.36, 0, 0.02); patas(g, w, d, 0.36, X.metal, 0.015); break;
    case 'muebleTV': {
      caja(g, w, 0.45, d, X.madera, 0, 0.05, 0, 0.015);
      caja(g, w - 0.06, 0.008, 0.01, X.negro, 0, 0.27, hd);
      patas(g, w, d, 0.05, X.metal, 0.015);
      if (m.var === 'aparador') { cil(g, 0.07, 0.05, 0.32, X.ceramica, -hw + 0.25, 0.5, 0, 14); }
      else { const tw = Math.min(1.45, w - 0.2); caja(g, tw, tw * 0.57, 0.04, X.pantalla, 0, 0.62, -hd + 0.06); }
      break;
    }
    case 'tapete': caja(g, w, 0.012, d, X.telaClara); break;
    case 'lampara': cil(g, 0.16, 0.16, 0.02, X.metal); cil(g, 0.012, 0.012, 1.45, X.metal, 0, 0.02); cil(g, 0.13, 0.19, 0.26, X.luz, 0, 1.36); break;
    case 'comedor': {
      caja(g, w, 0.045, d, X.madera, 0, 0.72, 0, 0.01);
      patas(g, w, d, 0.72, X.metal, 0.025, 0.1);
      const n = m.var === 'c8' ? 3 : 2, cab = m.var !== 'c4';
      for (let k = 0; k < n; k++) {
        const x = -hw + w * (k + 0.5) / n;
        silla(g, x, hd + 0.28, Math.PI, X); silla(g, x, -hd - 0.28, 0, X);
      }
      if (cab) { silla(g, hw + 0.3, 0, -Math.PI / 2, X); silla(g, -hw - 0.3, 0, Math.PI / 2, X); }
      cil(g, 0.004, 0.004, 0.6, X.negro, 0, 1.6, 0, 4);
      cil(g, 0.16, 0.28, 0.2, X.luz, 0, 1.45, 0, 20);
      cil(g, 0.08, 0.06, 0.24, X.ceramica, 0.15, 0.765, 0, 14);
      break;
    }
    case 'cocinaBase': case 'isla': {
      caja(g, w, 0.86, d - 0.04, X.laca, 0, 0.06, -0.02, 0.008);
      caja(g, w - 0.02, 0.06, d - 0.06, X.negro, 0, 0, -0.04);
      caja(g, w + (m.tipo === 'isla' ? 0.3 : 0.02), 0.04, d + 0.02, X.meson, 0, 0.88, 0, 0.005);
      const n = Math.max(1, Math.round(w / 0.6));
      for (let k = 1; k < n; k++) caja(g, 0.006, 0.8, 0.01, X.negro, -hw + w * k / n, 0.08, hd - 0.03);
      if (m.lav !== undefined) { const x = -hw + m.lav; caja(g, 0.7, 0.02, 0.42, X.acero, x, 0.905, 0); cil(g, 0.012, 0.012, 0.32, X.cromo, x, 0.92, -0.2, 8); }
      if (m.est !== undefined) {
        const x = -hw + m.est;
        caja(g, 0.62, 0.012, 0.52, X.pantalla, x, 0.92, 0);
        if (m.tipo !== 'isla') { caja(g, 0.7, 0.1, 0.45, X.acero, x, 1.62, -hd + 0.25); caja(g, 0.25, 0.5, 0.25, X.acero, x, 1.72, -hd + 0.15); }
      }
      if (m.tipo === 'cocinaBase') {
        // alacenas altas, menos encima del lavaplatos (alli va la ventana)
        const segs = m.lav !== undefined ? [[-hw, -hw + m.lav - 0.45], [-hw + m.lav + 0.45, hw]] : [[-hw, hw]];
        segs.forEach(([a, b]) => { if (b - a > 0.3) caja(g, b - a, 0.7, 0.35, X.lacaB, (a + b) / 2, 1.5, -hd + 0.175, 0.006); });
      } else {
        [-0.45, 0.45].forEach(x => { cil(g, 0.17, 0.17, 0.05, X.tela, x, 0.68, hd + 0.35, 16); cil(g, 0.015, 0.015, 0.68, X.metal, x, 0, hd + 0.35, 6); });
      }
      break;
    }
    case 'nevera': caja(g, w, 1.8, d, X.acero, 0, 0, 0, 0.02); caja(g, w - 0.02, 0.006, 0.01, X.negro, 0, 1.15, hd + 0.001); caja(g, 0.025, 0.5, 0.03, X.cromo, -hw + 0.08, 0.5, hd + 0.02); caja(g, 0.025, 0.4, 0.03, X.cromo, -hw + 0.08, 1.25, hd + 0.02); break;
    case 'inodoro': caja(g, 0.38, 0.4, 0.18, X.ceramica, 0, 0.36, -hd + 0.09, 0.03); cil(g, 0.17, 0.13, 0.4, X.ceramica, 0, 0, -hd + 0.44, 20).scale.set(1, 1, 1.35); caja(g, 0.36, 0.03, 0.46, X.ceramica, 0, 0.4, -hd + 0.42, 0.02); break;
    case 'lavamanos': {
      caja(g, w, 0.55, d, X.madera, 0, 0.25, 0, 0.01);
      caja(g, w + 0.02, 0.04, d + 0.02, X.meson, 0, 0.8, 0, 0.005);
      const b = w >= 1.15 ? [-w / 4, w / 4] : [0];
      b.forEach(x => { cil(g, 0.19, 0.15, 0.12, X.ceramica, x, 0.84, 0.02, 24).scale.set(1, 1, 0.75); cil(g, 0.012, 0.012, 0.22, X.cromo, x, 0.84, -hd + 0.06, 8); });
      caja(g, Math.min(w, 1.2), 0.8, 0.02, X.espejo, 0, 1.1, -hd - 0.005);
      break;
    }
    case 'ducha': {
      caja(g, w, 0.04, d, X.ceramica);
      caja(g, w, 1.95, 0.01, X.vidrio, 0, 0.04, hd);
      cil(g, 0.012, 0.012, 1.0, X.cromo, -hw + 0.1, 1.1, -hd + 0.06, 8);
      cil(g, 0.1, 0.1, 0.015, X.cromo, -hw + 0.1, 2.05, -hd + 0.18, 16);
      break;
    }
    case 'tina': caja(g, w, 0.55, d, X.ceramica, 0, 0, 0, 0.08); caja(g, w - 0.16, 0.02, d - 0.16, X.agua, 0, 0.47, 0, 0.05); break;
    case 'lavadora': case 'secadora': caja(g, w, 0.86, d, X.blanco, 0, 0, 0, 0.03); { const p = cil(g, 0.2, 0.2, 0.03, X.vidrio, 0, 0.36, hd, 24); p.rotation.x = Math.PI / 2; p.position.y = 0.42; } caja(g, w - 0.06, 0.08, 0.02, X.negro, 0, 0.74, hd); break;
    case 'lavadero': caja(g, w, 0.9, d, X.lacaB, 0, 0, 0, 0.02); caja(g, w - 0.1, 0.02, d - 0.1, X.acero, 0, 0.89, 0); break;
    case 'mostrador': caja(g, w, 1.0, d, X.laca, 0, 0, 0, 0.01); caja(g, w + 0.05, 0.04, d + 0.08, X.meson, 0, 1.0, 0); break;
    case 'estante': {
      [0, 0.5, 1.0, 1.5, 1.95].forEach(y => caja(g, w, 0.03, d, X.metal, 0, y, 0));
      [-hw + 0.02, hw - 0.02].forEach(x => caja(g, 0.03, 2.0, d, X.metal, x, 0, 0));
      for (let k = 0; k < 4; k++) for (let i = 0; i < 4; i++) caja(g, w / 5, 0.2 + ((i + k) % 3) * 0.05, d * 0.7, [X.laca, X.telaClara, X.blanco][(i + k) % 3], -hw + w * (i + 0.6) / 4.6, 0.03 + k * 0.5, 0);
      break;
    }
    case 'planta': {
      cil(g, 0.2, 0.15, 0.42, X.matera, 0, 0, 0, 16);
      cil(g, 0.012, 0.012, 0.6, X.madera, 0, 0.4, 0, 6);
      [[0, 1.05, 0, 0.3], [0.12, 0.85, 0.06, 0.22], [-0.1, 0.9, -0.05, 0.24], [0.04, 1.25, -0.04, 0.2]].forEach(([x, y, z, r], k) => esf(g, r, k % 2 ? X.hoja2 : X.hoja, x, y, z, 1, 0.85, 1));
      break;
    }
    case 'cuadro': {
      const cw = w, ch = Math.min(0.9, cw * 0.66), y = (m.colgado || 1.45) - ch / 2;
      caja(g, cw + 0.05, ch + 0.05, 0.03, X.negro, 0, y - 0.025, -hd + 0.015);
      const sem = Math.abs([...m.id].reduce((a, c) => a * 31 + c.charCodeAt(0), 7)) % 2147483646 + 1;
      caja(g, cw, ch, 0.01, lienzoArte(sem, PAL), 0, y, -hd + 0.035);
      break;
    }
    default: caja(g, w, m.h || 0.8, d, X.madera); break;
  }
  return g;
}

/** Cortina a lado y lado de una ventana (ancho de la ventana, alto hasta el cielo). */
export function cortina(ancho, alto) {
  const g = new THREE.Group();
  const geo = new THREE.PlaneGeometry(Math.max(0.3, ancho * 0.32), alto, 12, 1);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) p.setZ(i, Math.sin(p.getX(i) * 22) * 0.03);
  geo.computeVertexNormals();
  const mat = material('mu|cortina|' + PAL.telaClara, () => new THREE.MeshStandardMaterial({ color: PAL.telaClara, roughness: 1, side: THREE.DoubleSide, transparent: true, opacity: 0.92 }));
  [-1, 1].forEach(s => { const c = new THREE.Mesh(geo, mat); c.position.set(s * (ancho / 2 + 0.05), alto / 2, 0); g.add(c); });
  return g;
}

/** Arbol estilizado para el exterior. */
export function arbol(alto = 4.5, semilla = 1) {
  const g = new THREE.Group();
  const tronco = material('ar|tronco', () => std(0x5b4636, 0.9));
  const copa = material('ar|copa' + (semilla % 3), () => std([0x3f6b34, 0x4c7a3a, 0x355d2e][semilla % 3], 0.85));
  cil(g, 0.08, 0.14, alto * 0.45, tronco, 0, 0, 0, 7);
  const r = alto * 0.22;
  esf(g, r, copa, 0, alto * 0.62, 0, 1, 1.15, 1);
  esf(g, r * 0.75, copa, r * 0.5, alto * 0.52, r * 0.2);
  esf(g, r * 0.7, copa, -r * 0.45, alto * 0.55, -r * 0.25);
  return g;
}
