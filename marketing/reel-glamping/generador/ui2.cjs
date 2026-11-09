// Segunda tanda de pantallas reales: celular con el glamping visible sobre el panel,
// y la ficha y las láminas desde la vista de computador (en celular la ficha no se muestra).
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const DIR = path.join(process.env.TOMAS || path.join(__dirname, '..', 'tomas'), 'ui');
fs.mkdirSync(DIR, { recursive: true });
const ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];

async function abrir(b, opts) {
  const ctx = await b.newContext({ locale: 'es-CO', ...opts });
  const p = await ctx.newPage();
  await p.goto('https://glamping-axiona.netlify.app/', { waitUntil: 'domcontentloaded', timeout: 90000 });
  await p.waitForFunction(() => window.glamping && window.glamping.listo, null, { timeout: 120000 });
  await p.evaluate(() => { window.glamping.motor.alDegradar = () => {}; const c = document.querySelector('#chkCalidad'); if (!c.checked) { c.checked = true; c.dispatchEvent(new Event('change')); } });
  await p.waitForTimeout(8000);
  await p.evaluate(() => window.glamping.motor.renderer.setAnimationLoop(null));
  return p;
}
const render = (p, w, h, pr) => p.evaluate(([w, h, pr]) => {
  const U = window.glamping.motor;
  U.renderer.setPixelRatio(pr); U.composer.setPixelRatio?.(pr);
  U.renderer.setSize(w, h, false); U.composer.setSize(w, h);
  U.camara.aspect = w / h; U.camara.updateProjectionMatrix();
  U.vuelo = null; U.gtao.enabled = U.aoActivo; U.renderer.shadowMap.needsUpdate = true;
  U.composer.render();
}, [w, h, pr]);
const cam = (p, pos, obj, fov) => p.evaluate(([pos, obj, fov]) => {
  const U = window.glamping.motor; U.camara.position.set(...pos); U.controles.target.set(...obj);
  U.camara.fov = fov; U.camara.updateProjectionMatrix(); U.camara.lookAt(...obj); U.controles.update?.();
}, [pos, obj, fov]);
const ancho = (p, v) => p.evaluate((v) => { const s = document.querySelector('#parametros input[type=range]'); s.value = v; s.dispatchEvent(new Event('input')); }, v);

(async () => {
  const b = await chromium.launch({ args: ARGS });
  // ---- Computador: ficha y láminas
  const d = await abrir(b, { viewport: { width: 1280, height: 800 }, deviceScaleFactor: 2 });
  // Solo se recortan la ficha y las láminas: sin el lienzo 3D detrás, el desenfoque de fondo no traba la captura.
  await d.evaluate(() => { document.querySelector('#lienzo').style.visibility = 'hidden'; });
  // Sin GPU, el vidrio esmerilado (backdrop-filter) a 2560 px traba la captura: se apaga solo para la foto.
  await d.addStyleTag({ content: '*, *::before, *::after { backdrop-filter: none !important; -webkit-backdrop-filter: none !important; animation: none !important; transition: none !important; }' });
  const el = async (sel, n) => { await d.waitForTimeout(500); const r = await d.evaluate((sel) => { const b = document.querySelector(sel).getBoundingClientRect(); return { x: b.x, y: b.y, width: b.width, height: b.height }; }, sel);
    const t = Date.now(); await d.screenshot({ path: path.join(DIR, n + '.png'), clip: r, timeout: 180000 }); console.log('ok', n, JSON.stringify(r), Date.now() - t, 'ms'); };
  await el('#ficha', 'f1-ficha-440');
  await ancho(d, 5.2); await d.waitForTimeout(9000);
  await el('#ficha', 'f2-ficha-520');
  await ancho(d, 4.4); await d.waitForTimeout(9000);
  await d.evaluate(() => document.querySelector('#btnPlanos').click()); await d.waitForTimeout(3500);
  for (const [i, n] of [[0, 'p1-planta'], [1, 'p2-fachadas'], [3, 'p3-cortes'], [4, 'p4-estructura'], [7, 'p5-cantidades'], [9, 'p6-implantacion']]) {
    await d.evaluate((i) => document.querySelectorAll('#pestanasPlanos button')[i].click(), i);
    await d.waitForTimeout(2500);
    await el('#hojaPlano', n);
  }
  await d.context().close();
  // ---- Celular: panel abierto con el glamping completo arriba
  const m = await abrir(b, { viewport: { width: 405, height: 720 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const shot = async (n) => { await m.waitForTimeout(600); await render(m, 405, 720, 2); const t = Date.now(); await m.screenshot({ path: path.join(DIR, n + '.png'), timeout: 180000 }); console.log('ok', n, Date.now() - t, 'ms'); };
  await cam(m, [6.2, 2.6, -12.5], [-0.6, -2.1, 2.4], 50);
  await m.evaluate(() => document.querySelector('#asaPanel').click()); await m.waitForTimeout(800);
  await shot('m1-modelos');
  await m.evaluate(() => document.querySelector('#acabados').scrollIntoView({ block: 'start' })); await shot('m2-acabados');
  await m.evaluate(() => document.querySelector('#parametros').scrollIntoView({ block: 'start' })); await shot('m3-medidas-440');
  await ancho(m, 5.2); await m.waitForTimeout(9000);
  await cam(m, [6.2, 2.6, -12.5], [-0.6, -2.1, 2.4], 50);
  await shot('m4-medidas-520');
  await b.close();
})().catch(e => { console.error('FALLA', e); process.exit(1); });
