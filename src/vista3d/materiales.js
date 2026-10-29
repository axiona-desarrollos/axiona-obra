/* ==========================================================================
   AXIONA OBRA · Texturas y materiales del 3D
   --------------------------------------------------------------------------
   Todas las texturas se pintan en un canvas con semilla fija: maderas,
   marmol, porcelanatos, azulejo tipo metro, piedra, ladrillo, teja, teja
   asfaltica, revestimiento de tablas, pasto y asfalto. No se descarga
   ninguna imagen: pesan cero y son libres. Las cajas llevan coordenadas de
   textura en metros, asi un mismo material sirve para un muro de 2 m y uno
   de 12 m sin estirarse.
   ========================================================================== */

import * as THREE from 'three';

const cache = new Map();
const TAM = 512;

function azar(semilla) {
  let s = semilla >>> 0;
  return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const hex = c => new THREE.Color(c);
function tono(c, d) { const k = hex(c); const h = {}; k.getHSL(h); k.setHSL(h.h, h.s, Math.max(0, Math.min(1, h.l + d))); return '#' + k.getHexString(); }

function lienzo(pintar, semilla = 7) {
  const cv = document.createElement('canvas');
  cv.width = cv.height = TAM;
  const g = cv.getContext('2d');
  pintar(g, azar(semilla), TAM);
  return cv;
}

function ruido(g, r, n, alfa, colores) {
  for (let i = 0; i < n; i++) {
    g.fillStyle = colores[(r() * colores.length) | 0];
    g.globalAlpha = alfa * r();
    g.fillRect(r() * TAM, r() * TAM, 1 + r() * 2.5, 1 + r() * 2.5);
  }
  g.globalAlpha = 1;
}

const PINTORES = {
  madera(g, r, S, o) {
    const base = o.color || { roble: '#c49a6c', nogal: '#6a4630', teca: '#9b6a3e', claro: '#d8bd96', gris: '#a49c92' }[o.tono] || '#b88a5e';
    const n = 6, w = S / n;
    for (let k = 0; k < n; k++) {
      const c = tono(base, (r() - 0.5) * 0.08);
      g.fillStyle = c; g.fillRect(k * w, 0, w, S);
      // vetas
      g.strokeStyle = tono(c, -0.12); g.lineWidth = 1;
      for (let v = 0; v < 18; v++) {
        g.globalAlpha = 0.18 + r() * 0.25;
        g.beginPath();
        const x0 = k * w + r() * w, f = 2 + r() * 4, a = 1 + r() * 3;
        for (let y = 0; y <= S; y += 8) g.lineTo(x0 + Math.sin(y / S * Math.PI * f + v) * a, y);
        g.stroke();
      }
      g.globalAlpha = 1;
      // juntas de las tablas: a lo largo y escalonadas a lo ancho
      g.fillStyle = tono(base, -0.3); g.fillRect(k * w, 0, 1.5, S);
      const corte = r() * S; g.fillRect(k * w, corte, w, 1.5);
    }
  },
  marmol(g, r, S, o) {
    const base = o.color || '#efede8';
    g.fillStyle = base; g.fillRect(0, 0, S, S);
    ruido(g, r, 9000, 0.05, [tono(base, -0.06), tono(base, 0.03)]);
    for (let v = 0; v < 9; v++) {
      g.strokeStyle = o.vena || '#8f949b';
      g.lineWidth = 0.6 + r() * 1.8;
      g.globalAlpha = 0.12 + r() * 0.28;
      g.beginPath();
      let x = r() * S, y = 0;
      g.moveTo(x, y);
      while (y < S) { x += (r() - 0.5) * 34; y += 10 + r() * 22; g.lineTo(x, y); }
      g.stroke();
    }
    g.globalAlpha = 1;
    if (o.junta) { g.fillStyle = tono(base, -0.18); const p = S / Math.max(1, Math.round(1.2 / o.junta)); for (let i = 0; i <= S; i += p) { g.fillRect(i, 0, 1.2, S); g.fillRect(0, i, S, 1.2); } }
  },
  baldosa(g, r, S, o) {
    const base = o.color || '#d4d6d8', n = 4, p = S / n;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { g.fillStyle = tono(base, (r() - 0.5) * 0.05); g.fillRect(i * p, j * p, p, p); }
    ruido(g, r, 6000, 0.05, [tono(base, -0.08), tono(base, 0.05)]);
    g.fillStyle = tono(base, -0.25);
    for (let i = 0; i <= n; i++) { g.fillRect(i * p - 1, 0, 2, S); g.fillRect(0, i * p - 1, S, 2); }
  },
  metro(g, r, S, o) {
    const base = o.color || '#f4f3ef', fh = S / 8, fw = S / 2;
    g.fillStyle = tono(base, -0.12); g.fillRect(0, 0, S, S);
    for (let j = 0; j < 8; j++) for (let i = -1; i < 3; i++) {
      const x = i * fw + (j % 2 ? fw / 2 : 0);
      g.fillStyle = tono(base, (r() - 0.5) * 0.04);
      g.fillRect(x + 1.5, j * fh + 1.5, fw - 3, fh - 3);
    }
  },
  cemento(g, r, S, o) {
    const base = o.color || '#b9b4ac';
    g.fillStyle = base; g.fillRect(0, 0, S, S);
    ruido(g, r, 22000, 0.08, [tono(base, -0.1), tono(base, 0.06), tono(base, -0.04)]);
    for (let k = 0; k < 14; k++) { g.strokeStyle = tono(base, (r() - 0.5) * 0.08); g.globalAlpha = 0.25; g.lineWidth = 10 + r() * 30; g.beginPath(); g.arc(r() * S, r() * S, 40 + r() * 120, 0, Math.PI * (0.4 + r())); g.stroke(); }
    g.globalAlpha = 1;
  },
  piedra(g, r, S, o) {
    const base = o.color || '#a69c8d';
    g.fillStyle = tono(base, -0.25); g.fillRect(0, 0, S, S);
    let y = 0;
    while (y < S) {
      const h = 40 + r() * 50; let x = -r() * 60;
      while (x < S) { const w = 60 + r() * 90; g.fillStyle = tono(base, (r() - 0.5) * 0.18); g.beginPath(); g.roundRect(x + 3, y + 3, w - 6, h - 6, 8); g.fill(); x += w; }
      y += h;
    }
    ruido(g, r, 8000, 0.08, [tono(base, -0.12), tono(base, 0.08)]);
  },
  ladrillo(g, r, S, o) {
    const base = o.color || '#b0573a', fh = S / 16, fw = S / 5;
    g.fillStyle = '#cdc5b8'; g.fillRect(0, 0, S, S);
    for (let j = 0; j < 16; j++) for (let i = -1; i < 6; i++) { g.fillStyle = tono(base, (r() - 0.5) * 0.12); g.fillRect(i * fw + (j % 2 ? fw / 2 : 0) + 2, j * fh + 2, fw - 4, fh - 4); }
    ruido(g, r, 9000, 0.1, ['#5a2a1a', '#e09070']);
  },
  teja(g, r, S, o) {
    const base = o.color || '#b4593a', filas = 6, fh = S / filas, cols = 8, cw = S / cols;
    for (let j = 0; j < filas; j++) for (let i = 0; i < cols; i++) {
      const gr = g.createLinearGradient(i * cw, 0, (i + 1) * cw, 0);
      const c = tono(base, (r() - 0.5) * 0.12);
      gr.addColorStop(0, tono(c, -0.18)); gr.addColorStop(0.5, tono(c, 0.08)); gr.addColorStop(1, tono(c, -0.18));
      g.fillStyle = gr; g.fillRect(i * cw, j * fh, cw, fh);
      g.fillStyle = 'rgba(0,0,0,.28)'; g.fillRect(i * cw, (j + 1) * fh - 5, cw, 5);
    }
  },
  asfaltica(g, r, S, o) {
    const base = o.color || '#4a4d52', filas = 8, fh = S / filas, cw = S / 3;
    for (let j = 0; j < filas; j++) for (let i = -1; i < 4; i++) { g.fillStyle = tono(base, (r() - 0.5) * 0.1); g.fillRect(i * cw + (j % 2 ? cw / 2 : 0) + 1, j * fh, cw - 2, fh - 2); }
    ruido(g, r, 30000, 0.15, ['#2a2b2e', '#77797d', '#5d5a55']);
  },
  tablas(g, r, S, o) {
    const base = o.color || '#e8e6e1', n = 8, h = S / n;
    for (let j = 0; j < n; j++) {
      const gr = g.createLinearGradient(0, j * h, 0, (j + 1) * h);
      gr.addColorStop(0, tono(base, -0.1)); gr.addColorStop(0.25, base); gr.addColorStop(1, tono(base, 0.02));
      g.fillStyle = gr; g.fillRect(0, j * h, S, h);
    }
    ruido(g, r, 5000, 0.04, [tono(base, -0.1)]);
  },
  pasto(g, r, S) {
    g.fillStyle = '#4f6b35'; g.fillRect(0, 0, S, S);
    ruido(g, r, 40000, 0.35, ['#3e5a2a', '#6b8a44', '#5a7a3a', '#7d9a52']);
  },
  asfalto(g, r, S) {
    g.fillStyle = '#3a3c40'; g.fillRect(0, 0, S, S);
    ruido(g, r, 50000, 0.3, ['#2b2c2f', '#55575c', '#47494d']);
  },
  tierra(g, r, S) {
    g.fillStyle = '#7a6650'; g.fillRect(0, 0, S, S);
    ruido(g, r, 40000, 0.3, ['#5e4c3a', '#94806a', '#6d5a46']);
  },
  tela(g, r, S, o) {
    const base = o.color || '#8a8f94';
    g.fillStyle = base; g.fillRect(0, 0, S, S);
    for (let i = 0; i < S; i += 3) { g.fillStyle = tono(base, (r() - 0.5) * 0.06); g.fillRect(i, 0, 1.5, S); g.fillRect(0, i, S, 1.5); }
  },
  osb(g, r, S) {
    g.fillStyle = '#c9a66b'; g.fillRect(0, 0, S, S);
    for (let k = 0; k < 900; k++) { g.fillStyle = ['#b08a4f', '#dcbb84', '#a57f47', '#e3c792'][(r() * 4) | 0]; g.save(); g.translate(r() * S, r() * S); g.rotate(r() * Math.PI); g.fillRect(-14, -3, 28 + r() * 20, 6); g.restore(); }
  },
};

/** Periodo de cada textura en metros (lo que mide la imagen en la obra). */
const PERIODO = { madera: 1.2, marmol: 1.2, baldosa: 2.4, metro: 0.6, cemento: 2.5, piedra: 1.6, ladrillo: 1.2, teja: 1.0, asfaltica: 1.0, tablas: 1.2, pasto: 3, asfalto: 4, tierra: 3, tela: 0.5, osb: 2.4 };

export function textura(tipo, o = {}) {
  const k = `${tipo}|${JSON.stringify(o)}`;
  if (cache.has(k)) return cache.get(k);
  const cv = lienzo((g, r, S) => PINTORES[tipo](g, r, S, o), (tipo.length * 977 + JSON.stringify(o).length * 131) >>> 0);
  const t = new THREE.CanvasTexture(cv);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  const p = tipo === 'baldosa' && o.junta ? o.junta * 4 : PERIODO[tipo] || 1;
  t.repeat.set(1 / p, 1 / p);
  t.userData = { periodo: p };
  cache.set(k, t);
  return t;
}

const mats = new Map();
/** Material con textura (o color plano), compartido por clave. */
export function material(clave, crear) {
  if (!mats.has(clave)) mats.set(clave, crear());
  return mats.get(clave);
}
export const std = (color, roughness = 0.8, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness, ...extra });

/** Material de un acabado de piso del catalogo. */
export function matPiso(p) {
  return material('piso|' + p.cod, () => {
    const tex = p.tex === 'madera' ? textura('madera', { tono: p.tono }) : p.tex === 'marmol' ? textura('marmol', { color: p.color, junta: p.junta }) : p.tex === 'cemento' ? textura('cemento', { color: p.color }) : textura('baldosa', { color: p.color, junta: p.junta || 0.6 });
    return new THREE.MeshStandardMaterial({ map: tex, roughness: p.tex === 'marmol' ? 0.18 : p.tex === 'madera' ? 0.55 : 0.35, metalness: 0 });
  });
}

/** Caja con coordenadas de textura en metros (u y v escalados por cara). */
export function cajaM(sx, sy, sz) {
  const g = new THREE.BoxGeometry(sx, sy, sz);
  const uv = g.attributes.uv;
  // orden de caras: +x, -x, +y, -y, +z, -z ; cada una con 4 vertices
  const dims = [[sz, sy], [sz, sy], [sx, sz], [sx, sz], [sx, sy], [sx, sy]];
  for (let f = 0; f < 6; f++) for (let k = 0; k < 4; k++) { const i = f * 4 + k; uv.setXY(i, uv.getX(i) * dims[f][0], uv.getY(i) * dims[f][1]); }
  uv.needsUpdate = true;
  return g;
}

/** Plano horizontal con coordenadas de textura en metros (x, -y del modelo). */
export function planoM(x0, x1, y0, y1, z) {
  const g = new THREE.BufferGeometry();
  const p = [x0, z, -y0, x1, z, -y0, x1, z, -y1, x0, z, -y1];
  g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute([x0, y0, x1, y0, x1, y1, x0, y1], 2));
  g.setIndex([0, 1, 2, 0, 2, 3]);
  g.computeVertexNormals();
  return g;
}

export function limpiarCacheMateriales() { mats.forEach(m => m.dispose()); mats.clear(); }
