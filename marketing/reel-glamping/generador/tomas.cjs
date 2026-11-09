// Tomas del reel del glamping: trayectorias de cámara cuadro por cuadro y fijas.
// Uso: node tomas.cjs <toma|previa|fijas> [w h]
const fs = require('fs');
const path = require('path');
const m = require('./motor.cjs');
const SAL = path.join(process.env.TOMAS || path.join(__dirname, '..', 'tomas'));

const C = [-0.6, 1.3, 2.0]; // centro del glamping (deck incluido)
const rad = (g) => g * Math.PI / 180;
const orb = (th, R, h, c = C) => [c[0] + R * Math.sin(rad(th)), h, c[2] - R * Math.cos(rad(th))];
const lerp = (a, b, t) => a + (b - a) * t;
const suave = (t) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; // ease in-out cúbico
const suaveSalida = (t) => 1 - Math.pow(1 - t, 3);

// Catmull-Rom por componente
function cr(pts, t) {
  const n = pts.length - 1, f = Math.min(n - 1e-9, t * n), i = Math.floor(f), u = f - i;
  const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(n, i + 2)];
  return p1.map((_, k) => 0.5 * ((2 * p1[k]) + (-p0[k] + p2[k]) * u + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * u * u + (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * u * u * u));
}

const FIJA = { th: 24, R: 10.4, h: 1.6, obj: [-0.7, 1.55, 2.1], fov: 36 };
const camFija = () => ({ pos: orb(FIJA.th, FIJA.R, FIJA.h), obj: FIJA.obj, fov: FIJA.fov });
// Los acabados van en el costado del arco: se ven mejor con una cámara más de lado.
const camLado = () => ({ pos: orb(42, 11.8, 2.0), obj: [-0.6, 1.5, 2.6], fov: 36 });

const TOMAS = {
  // Giro completo y parejo (se puede repetir sin salto), para formato horizontal: node tomas.cjs orbita 1280 720
  orbita: {
    estado: { modelo: 'Arco Panorámico', acabado: 'Cedro', escenario: 'Atardecer' }, dur: 5,
    cam: (t) => ({ pos: orb(20 + 360 * t, 13.5, 3.2), obj: [-0.6, 1.3, 2.0], fov: 40 }),
  },
  heroe: {
    estado: { modelo: 'Arco Panorámico', acabado: 'Cedro', escenario: 'Atardecer' }, dur: 3.6,
    cam: (t) => { const s = suaveSalida(t); return { pos: orb(lerp(46, FIJA.th, s), lerp(14.5, FIJA.R, s), lerp(2.6, FIJA.h, s)), obj: [-0.7, lerp(1.35, 1.55, s), 2.1], fov: 36 }; },
  },
  interior: {
    estado: { modelo: 'Arco Panorámico', acabado: 'Cedro', escenario: 'Atardecer' }, dur: 3.2,
    cam: (t) => {
      const s = suave(t);
      const P = [[-0.25, 1.62, -7.2], [-0.25, 1.66, -4.2], [-0.25, 1.72, -1.5], [-0.45, 1.85, 0.4], [-0.9, 1.95, 0.75]];
      const O = [[-0.25, 1.62, 3.0], [-0.25, 1.6, 3.2], [-0.2, 1.55, 3.4], [0.2, 1.45, 3.6], [0.6, 1.35, 3.6]];
      return { pos: cr(P, s), obj: cr(O, s), fov: lerp(38, 56, s * s) };
    },
  },
  noche: {
    estado: { modelo: 'Arco Panorámico', acabado: 'Cedro', escenario: 'Noche' }, dur: 2.8,
    cam: (t) => { const s = suave(t); return { pos: orb(lerp(-38, -16, s), lerp(12.5, 10.8, s), lerp(3.4, 2.0, s)), obj: [-0.7, 1.5, 2.2], fov: 36 }; },
  },
};

const FIJAS = [
  ['modelo-arco', { modelo: 'Arco Panorámico', acabado: 'Cedro', escenario: 'Atardecer' }],
  ['modelo-suite', { modelo: 'Arco Suite XL', acabado: 'Cedro', escenario: 'Atardecer' }],
  ['modelo-capsula', { modelo: 'Cápsula Torre', acabado: 'Cedro', escenario: 'Atardecer' }],
  ['acabado-nogal', { modelo: 'Arco Panorámico', acabado: 'Nogal', escenario: 'Atardecer' }, 'lado'],
  ['acabado-frp', { modelo: 'Arco Panorámico', acabado: 'FRP', escenario: 'Atardecer' }, 'lado'],
  ['acabado-grafito', { modelo: 'Arco Panorámico', acabado: 'Grafito', escenario: 'Atardecer' }, 'lado'],
  ['esc-manana', { modelo: 'Arco Panorámico', acabado: 'Grafito', escenario: 'Mañana' }],
  ['esc-bosque', { modelo: 'Arco Panorámico', acabado: 'Grafito', escenario: 'Claro de bosque' }],
  ['esc-noche', { modelo: 'Arco Panorámico', acabado: 'Grafito', escenario: 'Noche' }],
];

let actual = {};
async function estado(p, e, w, h) {
  for (const [k, sel] of [['modelo', '#modelos'], ['acabado', '#acabados'], ['escenario', '#escenarios']]) {
    if (actual[k] === e[k]) continue;
    const ok = await p.evaluate(([sel, txt]) => {
      const b = [...document.querySelectorAll(sel + ' button')].find(x => x.innerText.trim().startsWith(txt));
      if (!b) return false; b.click(); return true;
    }, [sel, e[k]]);
    if (!ok) throw new Error('No encontré ' + e[k]);
    await p.waitForTimeout(k === 'modelo' ? 9000 : 7000);
    // Los materiales y el escenario terminan de aplicarse en los cuadros de la propia app.
    for (let i = 0; i < 6; i++) { await p.evaluate(() => window.glamping.motor.renderUna()); await p.waitForTimeout(700); }
    actual[k] = e[k];
  }
  await m.congelar(p, w, h);
}

async function preparar(w, h) {
  const { b, p } = await m.abrir();
  await m.calidadAlta(p);
  await p.evaluate(() => { const U = window.glamping.motor; U.renderer.shadowMap.autoUpdate = false; });
  actual = { modelo: 'Arco Panorámico', acabado: 'Cedro', escenario: 'Atardecer' };
  await m.congelar(p, w, h);
  return { b, p };
}

(async () => {
  const [modo, W = '1080', H = '1920', fpsArg = '30'] = process.argv.slice(2);
  const w = +W, h = +H, fps = +fpsArg;
  const { b, p } = await preparar(w, h);
  const t0 = Date.now();
  if (modo === 'previa') {
    const dir = path.join(SAL, 'previa'); fs.mkdirSync(dir, { recursive: true });
    for (const [nom, T] of Object.entries(TOMAS)) {
      await estado(p, T.estado, w, h);
      const ts = nom === 'interior' ? [0, 0.45, 0.6, 0.7, 0.8, 1] : [0, 0.5, 1];
      for (const t of ts) { const c = T.cam(t); await m.cuadro(p, c.pos, c.obj, c.fov, path.join(dir, `${nom}-${t}.jpg`)); }
      console.log('previa', nom, Math.round((Date.now() - t0) / 1000), 's');
    }
  } else if (modo === 'fijas') {
    const dir = path.join(SAL, 'fijas'); fs.mkdirSync(dir, { recursive: true });
    for (const [nom, e, vista] of FIJAS) {
      if (fs.existsSync(path.join(dir, nom + '.jpg'))) continue;
      await estado(p, e, w, h);
      const c = vista === 'lado' ? camLado() : camFija();
      await m.cuadro(p, c.pos, c.obj, c.fov, path.join(dir, nom + '.jpg'));
      console.log('fija', nom, Math.round((Date.now() - t0) / 1000), 's');
    }
  } else {
    const T = TOMAS[modo];
    const dir = path.join(SAL, modo); fs.mkdirSync(dir, { recursive: true });
    await estado(p, T.estado, w, h);
    const n = Math.round(T.dur * fps);
    for (let i = 0; i < n; i++) {
      const f = path.join(dir, String(i).padStart(4, '0') + '.jpg');
      if (fs.existsSync(f)) continue;
      const c = T.cam(i / (n - 1));
      await m.cuadro(p, c.pos, c.obj, c.fov, f);
      if (i % 10 === 0) console.log(modo, i + '/' + n, Math.round((Date.now() - t0) / 1000), 's');
    }
  }
  console.log('listo', modo, Math.round((Date.now() - t0) / 1000), 's');
  await b.close();
})().catch(e => { console.error('FALLA', e); process.exit(1); });
