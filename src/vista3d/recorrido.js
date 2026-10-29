/* ==========================================================================
   AXIONA OBRA · Recorrido a pie y ascensor por voz
   --------------------------------------------------------------------------
   Camara a la altura de los ojos (1,60 m). En computador: flechas o W A S D
   y arrastrar para mirar. En celular: palanca abajo a la izquierda y
   arrastrar con el otro dedo. Los muros y los muebles detienen el paso; las
   puertas estan abiertas. En la escalera aparecen los botones para subir o
   bajar. En el ascensor: botones de piso y, si el navegador lo permite, el
   microfono: se dice «piso tres» o «third floor» y la cabina sube, con los
   botones siempre disponibles por si la persona tiene las manos ocupadas.
   ========================================================================== */

import * as THREE from 'three';
import { tres, applyPhase } from './escena.js';
import { app, tr, toast, esc } from '../ui/comun.js';

const ALTO_OJOS = 1.6, RADIO = 0.24, VEL = 1.5;
let E = null;

const PALABRAS = [
  [/\b(s[oó]tano|basement)\b/, 0],
  [/\b(primer[oa]?|uno|planta baja|lobby|ground|first|one|premier|rez)\b/, 1],
  [/\b(segund[oa]|dos|second|two|deuxi[eè]me)\b/, 2],
  [/\b(tercer[oa]?|tres|third|three|troisi[eè]me)\b/, 3],
  [/\b(cuart[oa]|cuatro|fourth|four)\b/, 4],
  [/\b(quint[oa]|cinco|fifth|five)\b/, 5],
  [/\b(sext[oa]|seis|sixth|six)\b/, 6],
  [/\b(s[eé]ptim[oa]|siete|seventh|seven)\b/, 7],
  [/\b(octav[oa]|ocho|eighth|eight)\b/, 8],
];

/** Entiende «piso 3», «tercer piso», «third floor», «sube», «baja». */
export function pisoDeLaVoz(texto, actual, F) {
  const t = String(texto).toLowerCase();
  const n = t.match(/\b(\d{1,2})\b/);
  if (n) { const v = +n[1]; return v >= 1 && v <= F ? v : null; }
  for (const [re, v] of PALABRAS) if (re.test(t)) return v >= 1 && v <= F ? v : null;
  if (/\b(sube|subir|arriba|up)\b/.test(t)) return Math.min(F, actual + 1);
  if (/\b(baja|bajar|abajo|down)\b/.test(t)) return Math.max(1, actual - 1);
  return null;
}

function hablar(texto) {
  try {
    const u = new SpeechSynthesisUtterance(texto);
    u.lang = app.S.idioma === 'en' ? 'en-CA' : app.S.pais === 'ES' ? 'es-ES' : 'es-CO';
    speechSynthesis.cancel(); speechSynthesis.speak(u);
  } catch { /* sin voz */ }
}

/** Obstaculos de un piso: muros (sin las puertas) y muebles. */
function obstaculos(M, f) {
  const out = [];
  const fl = M.floors[f];
  fl.lines.forEach(l => {
    const t = (l.ext ? 0.2 : 0.12) / 2;
    let tramos = [[l.a - t, l.b + t]];
    fl.ops.filter(o => o.kind !== 'win' && o.o === l.o && Math.abs(o.c - l.c) < 0.02).forEach(o => {
      const nt = [];
      tramos.forEach(([a, b]) => { if (o.b <= a || o.a >= b) nt.push([a, b]); else { if (o.a > a) nt.push([a, o.a]); if (o.b < b) nt.push([o.b, b]); } });
      tramos = nt;
    });
    tramos.forEach(([a, b]) => out.push(l.o === 'H' ? { x0: a, x1: b, y0: l.c - t, y1: l.c + t } : { x0: l.c - t, x1: l.c + t, y0: a, y1: b }));
  });
  M.muebles.filter(m => m.f === f && !['tapete', 'cuadro', 'sillaEsc', 'lampara'].includes(m.tipo)).forEach(m => {
    if (!M.dotacionVisible && !['cocinaBase', 'isla', 'inodoro', 'lavamanos', 'ducha', 'tina', 'lavadero', 'closet'].includes(m.tipo)) return;
    const giro = m.rot === 90 || m.rot === 270, w = giro ? m.d : m.w, d = giro ? m.w : m.d;
    out.push({ x0: m.x - w / 2, x1: m.x + w / 2, y0: m.y - d / 2, y1: m.y + d / 2 });
  });
  return out;
}

function choque(p, obs) {
  for (let it = 0; it < 3; it++) {
    for (const o of obs) {
      const cx = Math.max(o.x0, Math.min(p.x, o.x1)), cy = Math.max(o.y0, Math.min(p.y, o.y1));
      const dx = p.x - cx, dy = p.y - cy, d = Math.hypot(dx, dy);
      if (d < RADIO) {
        if (d > 1e-6) { p.x = cx + dx / d * RADIO; p.y = cy + dy / d * RADIO; }
        else {
          const sal = [[o.x0 - RADIO - p.x, 0], [o.x1 + RADIO - p.x, 0], [0, o.y0 - RADIO - p.y], [0, o.y1 + RADIO - p.y]].sort((a, b) => Math.hypot(...a) - Math.hypot(...b))[0];
          p.x += sal[0]; p.y += sal[1];
        }
      }
    }
  }
}

const dentro = (r, p) => r && p.x > r.x0 && p.x < r.x1 && p.y > r.y0 && p.y < r.y1;

export function iniciarRecorrido({ adentro = false } = {}) {
  const T = tres, M = app.M;
  if (!T.root || !M || M.err) return;
  if (E) salirRecorrido();
  app.phase = 10; app.viewFloor = 99; T.sinTecho = false;
  applyPhase();
  const z0 = M.sistema === 'madera' ? 0.32 : 0;
  const main = M.floors[0].ops.find(o => o.kind === 'main');
  const cx = main ? (main.a + main.b) / 2 : (M.R.x0 + M.R.x1) / 2;
  E = {
    p: { x: cx, y: adentro ? M.R.y0 + 1.0 : M.R.y0 - 2.6 }, f: 0, yaw: 0, pitch: -0.05, z: M.dl + z0, z0,
    teclas: new Set(), palanca: { x: 0, y: 0 }, obs: [], viaje: null, ultimo: performance.now(),
  };
  E.obs = obstaculos(M, 0);
  const cam = T.camFP = new THREE.PerspectiveCamera(72, T.box.clientWidth / T.box.clientHeight, 0.05, 500);
  cam.rotation.order = 'YXZ';
  T.enRecorrido = true;
  // interfaz
  const ui = document.createElement('div');
  ui.className = 'recorrido';
  ui.innerHTML = `<div class="rc-top"><b>${tr({ es: 'Recorrido', en: 'Walkthrough' })}</b> <span id="rcPiso"></span><span class="rc-ayuda">${tr({ es: 'Flechas o W A S D para caminar · arrastra para mirar', en: 'Arrow keys or W A S D to walk · drag to look' })}</span></div>
    <div class="rc-acc" id="rcAcc"></div>
    <div class="rc-pal" id="rcPal"><i></i></div>
    <button class="btn rc-salir" data-rc="salir">${tr({ es: 'Salir del recorrido', en: 'Exit walkthrough' })}</button>`;
  T.box.appendChild(ui);
  E.ui = ui;
  const hud = T.box.querySelector('#hud');
  if (hud) hud.hidden = true;
  ui.addEventListener('click', e => {
    const b = e.target.closest('[data-rc]');
    if (!b) return;
    const a = b.dataset.rc;
    if (a === 'salir') salirRecorrido();
    if (a === 'sube') irAPiso(E.f + 1, 'escalera');
    if (a === 'baja') irAPiso(E.f - 1, 'escalera');
    if (a.startsWith('asc')) irAPiso(+a.slice(3) - 1, 'ascensor');
    if (a === 'voz') escuchar();
  });
  // mirar arrastrando (raton o dedo) y palanca en pantallas tactiles
  const lienzo = T.renderer.domElement;
  let mira = null;
  E.onDown = e => { if (e.target.closest('.rc-pal')) return; mira = { id: e.pointerId, x: e.clientX, y: e.clientY }; };
  E.onMove = e => {
    if (!mira || e.pointerId !== mira.id) return;
    E.yaw -= (e.clientX - mira.x) * 0.005; E.pitch = Math.max(-1.2, Math.min(1.2, E.pitch - (e.clientY - mira.y) * 0.004));
    mira.x = e.clientX; mira.y = e.clientY;
  };
  E.onUp = e => { if (mira && e.pointerId === mira.id) mira = null; };
  lienzo.addEventListener('pointerdown', E.onDown);
  addEventListener('pointermove', E.onMove);
  addEventListener('pointerup', E.onUp);
  const pal = ui.querySelector('#rcPal'), bola = pal.querySelector('i');
  let pid = null;
  pal.addEventListener('pointerdown', e => { pid = e.pointerId; pal.setPointerCapture(pid); });
  pal.addEventListener('pointermove', e => {
    if (e.pointerId !== pid) return;
    const r = pal.getBoundingClientRect(), dx = (e.clientX - r.left - r.width / 2) / (r.width / 2), dy = (e.clientY - r.top - r.height / 2) / (r.height / 2);
    const L = Math.min(1, Math.hypot(dx, dy)), a = Math.atan2(dy, dx);
    E.palanca = { x: Math.cos(a) * L, y: Math.sin(a) * L };
    bola.style.transform = `translate(${E.palanca.x * 34}px, ${E.palanca.y * 34}px)`;
  });
  const suelta = () => { pid = null; E.palanca = { x: 0, y: 0 }; bola.style.transform = ''; };
  pal.addEventListener('pointerup', suelta); pal.addEventListener('pointercancel', suelta);
  E.onKey = e => {
    if (e.target.closest?.('input,select,textarea')) return;
    const k = e.key.toLowerCase();
    if (e.type === 'keydown') {
      if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'w', 'a', 's', 'd', 'pageup', 'pagedown'].includes(k)) e.preventDefault();
      if (k === 'escape') return salirRecorrido();
      if (k === 'pageup') irAPiso(E.f + 1, 'escalera');
      if (k === 'pagedown') irAPiso(E.f - 1, 'escalera');
      E.teclas.add(k);
    } else E.teclas.delete(k);
  };
  addEventListener('keydown', E.onKey);
  addEventListener('keyup', E.onKey);
  acciones();
  bucle();
}

function irAPiso(f, como) {
  const M = app.M;
  if (!E || f < 0 || f >= M.F || f === E.f || E.viaje) return;
  const desde = E.z, hasta = M.dl + f * M.fh + E.z0;
  E.viaje = { t0: performance.now(), dur: como === 'ascensor' ? 2600 : 1400, desde, hasta, f };
  if (como === 'ascensor') hablar(tr({ es: `Piso ${f + 1}`, en: `Floor ${f + 1}` }));
}

function escuchar() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) { toast(tr({ es: 'Este navegador no reconoce la voz: usa los botones del ascensor.', en: 'Voice is not supported in this browser: use the elevator buttons.' })); return; }
  const rec = new SR();
  rec.lang = app.S.idioma === 'en' ? 'en-CA' : app.S.pais === 'ES' ? 'es-ES' : 'es-CO';
  rec.interimResults = false; rec.maxAlternatives = 3;
  const b = E.ui.querySelector('[data-rc="voz"]');
  if (b) b.classList.add('oyendo');
  rec.onresult = ev => {
    const alts = [...ev.results[0]].map(a => a.transcript);
    const f = alts.map(a => pisoDeLaVoz(a, E.f + 1, app.M.F)).find(v => v);
    if (f) { toast(`«${alts[0]}» → ${tr({ es: 'piso', en: 'floor' })} ${f}`); irAPiso(f - 1, 'ascensor'); }
    else toast(tr({ es: `No entendí «${alts[0]}». Di por ejemplo «piso tres».`, en: `Didn't catch “${alts[0]}”. Try “floor three”.` }));
  };
  rec.onend = () => b?.classList.remove('oyendo');
  rec.onerror = ev => { b?.classList.remove('oyendo'); if (ev.error === 'not-allowed') toast(tr({ es: 'Permite el micrófono para hablarle al ascensor.', en: 'Allow the microphone to talk to the elevator.' })); };
  try { rec.start(); } catch { b?.classList.remove('oyendo'); }
}

/** Botones segun donde esta la persona: escalera o ascensor. */
function acciones() {
  const M = app.M, fl = M.floors[E.f];
  const esc0 = fl.rects.find(r => r.stair), asc = fl.rects.find(r => r.asc);
  const enEsc = dentro(esc0, E.p), enAsc = dentro(asc, E.p);
  const clave = `${E.f}|${enEsc}|${enAsc}`;
  if (clave === E.claveAcc) return;
  E.claveAcc = clave;
  let h = '';
  if (enEsc) {
    if (E.f < M.F - 1) h += `<button class="btn pri" data-rc="sube">${tr({ es: `Subir al piso ${E.f + 2}`, en: `Up to floor ${E.f + 2}` })}</button>`;
    if (E.f > 0) h += `<button class="btn" data-rc="baja">${tr({ es: `Bajar al piso ${E.f}`, en: `Down to floor ${E.f}` })}</button>`;
  }
  if (enAsc) {
    h += `<div class="rc-asc"><span>${tr({ es: 'Ascensor', en: 'Elevator' })}</span>${[...Array(M.F)].map((_, i) => `<button class="btn ${i === E.f ? 'pri' : ''}" data-rc="asc${i + 1}">${i + 1}</button>`).join('')}`;
    if (app.S.ascensorVoz) h += `<button class="btn amb" data-rc="voz" title="${esc(tr({ es: 'Di el piso: «piso tres»', en: 'Say the floor: “floor three”' }))}">🎤 ${tr({ es: 'Hablar', en: 'Speak' })}</button>`;
    h += '</div>';
  }
  E.ui.querySelector('#rcAcc').innerHTML = h;
  E.ui.querySelector('#rcPiso').textContent = `· ${tr({ es: 'Piso', en: 'Floor' })} ${E.f + 1}`;
}

function bucle() {
  if (!E) return;
  E.raf = requestAnimationFrame(bucle);
  const T = tres, M = app.M, ahora = performance.now(), dt = Math.min(0.05, (ahora - E.ultimo) / 1000);
  E.ultimo = ahora;
  if (E.viaje) {
    const v = E.viaje, k = Math.min(1, (ahora - v.t0) / v.dur), s = k * k * (3 - 2 * k);
    E.z = v.desde + (v.hasta - v.desde) * s;
    if (T.cabina && dentro(M.floors[0].rects.find(r => r.asc), E.p)) T.cabina.position.y = E.z;
    if (k >= 1) { E.f = v.f; E.viaje = null; E.obs = obstaculos(M, E.f); E.claveAcc = null; T.puertasAsc?.forEach(d => { d.m.visible = d.f !== E.f; }); }
  } else {
    let fw = 0, st = 0;
    const K = E.teclas;
    if (K.has('arrowup') || K.has('w')) fw += 1;
    if (K.has('arrowdown') || K.has('s')) fw -= 1;
    if (K.has('a')) st -= 1;
    if (K.has('d')) st += 1;
    if (K.has('arrowleft')) E.yaw += 1.8 * dt;
    if (K.has('arrowright')) E.yaw -= 1.8 * dt;
    fw -= E.palanca.y; st += E.palanca.x;
    const L = Math.hypot(fw, st);
    if (L > 0.05) {
      const k = VEL * dt / Math.max(1, L);
      // yaw 0 mira hacia +y del modelo (hacia el fondo del lote)
      const fx = -Math.sin(E.yaw), fy = Math.cos(E.yaw), rx = Math.cos(E.yaw), ry = Math.sin(E.yaw);
      E.p.x += (fx * fw + rx * st) * k; E.p.y += (fy * fw + ry * st) * k;
      choque(E.p, E.obs);
      const b = M.bbox, R = M.R;
      if (E.f === 0) { E.p.x = Math.max(b.minx - 1, Math.min(b.maxx + 1, E.p.x)); E.p.y = Math.max(b.miny - 3, Math.min(b.maxy + 1, E.p.y)); }
      else { E.p.x = Math.max(R.x0 + 0.2, Math.min(R.x1 - 0.2, E.p.x)); E.p.y = Math.max(R.y0 + 0.2, Math.min(R.y1 - 0.2, E.p.y)); }
      acciones();
    }
    if (E.f === 0) {
      const P = M.P, enP = E.p.x >= P.x0 && E.p.x <= P.x1 && E.p.y >= P.y0 && E.p.y <= P.y1;
      const piso = dentro(M.R, E.p) ? M.dl + E.z0 : enP ? M.dl : M.zf(E.p.x, E.p.y);
      E.z += (piso - E.z) * Math.min(1, dt * 8);
    }
  }
  const cam = T.camFP;
  cam.position.set(E.p.x, E.z + ALTO_OJOS, -E.p.y);
  cam.rotation.set(E.pitch, E.yaw, 0);
  T.renderer.render(T.scene, cam);
}

export function salirRecorrido() {
  if (!E) return;
  cancelAnimationFrame(E.raf);
  const lienzo = tres.renderer.domElement;
  lienzo.removeEventListener('pointerdown', E.onDown);
  removeEventListener('pointermove', E.onMove);
  removeEventListener('pointerup', E.onUp);
  removeEventListener('keydown', E.onKey);
  removeEventListener('keyup', E.onKey);
  E.ui.remove();
  const hud = tres.box.querySelector('#hud');
  if (hud) hud.hidden = false;
  tres.puertasAsc?.forEach(d => { d.m.visible = true; });
  if (tres.cabina) tres.cabina.position.y = app.M.dl + (app.M.sistema === 'madera' ? 0.32 : 0);
  E = null;
  tres.enRecorrido = false;
  tres.renderer.render(tres.scene, tres.cam);
}

export const enRecorrido = () => !!E;
