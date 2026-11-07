// Tercera tanda, sin capturas de la vista de computador (sin GPU se traban):
// 1) datos reales de la ficha a 4,40 y 5,20 m (los dibuja video.py);
// 2) el SVG original de cada lámina, rasterizado en una página limpia;
// 3) celular con el panel abierto y el glamping completo arriba.
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
  await p.evaluate(() => { window.glamping.motor.alDegradar = () => {}; });
  return p;
}
const ancho = (p, v) => p.evaluate((v) => { const s = document.querySelector('#parametros input[type=range]'); s.value = v; s.dispatchEvent(new Event('input')); }, v);
const ficha = (p) => p.evaluate(() => ({
  datos: [...document.querySelectorAll('#datosFicha dt')].map(dt => [dt.innerText.trim(), dt.nextElementSibling.innerText.trim()]),
  costo: document.querySelector('#resumenCosto').innerText.split('\n').map(s => s.trim()).filter(Boolean),
}));

(async () => {
  const b = await chromium.launch({ args: ARGS });
  // ---- 1 y 2: datos de la ficha y láminas en SVG
  const d = await abrir(b, { viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
  await d.evaluate(() => window.glamping.motor.renderer.setAnimationLoop(null));
  const f440 = await ficha(d);
  await ancho(d, 5.2); await d.waitForTimeout(6000);
  const f520 = await ficha(d);
  fs.writeFileSync(path.join(DIR, 'ficha.json'), JSON.stringify({ '4.40': f440, '5.20': f520 }, null, 1));
  console.log('ficha', JSON.stringify(f440.costo.slice(0, 3)), JSON.stringify(f520.costo.slice(0, 3)));
  await ancho(d, 4.4); await d.waitForTimeout(6000);
  await d.evaluate(() => document.querySelector('#btnPlanos').click()); await d.waitForTimeout(3000);
  const hojas = [[0, 'p1-planta'], [1, 'p2-fachadas'], [3, 'p3-cortes'], [4, 'p4-estructura'], [7, 'p5-cantidades'], [9, 'p6-implantacion']];
  const svgs = {};
  for (const [i, n] of hojas) {
    await d.evaluate((i) => document.querySelectorAll('#pestanasPlanos button')[i].click(), i);
    await d.waitForTimeout(1500);
    svgs[n] = await d.evaluate(() => { const s = document.querySelector('#hojaPlano svg'); return s ? s.outerHTML : ''; });
    console.log('svg', n, svgs[n].length);
  }
  await d.context().close();
  const limpio = await (await b.newContext({ viewport: { width: 1800, height: 1273 }, deviceScaleFactor: 1 })).newPage();
  for (const [n, svg] of Object.entries(svgs)) {
    if (!svg) continue;
    await limpio.setContent(`<!doctype html><html><body style="margin:0;background:#fff">${svg}</body></html>`);
    await limpio.evaluate(() => { const s = document.querySelector('svg'); s.setAttribute('width', '1800'); s.removeAttribute('height'); s.style.display = 'block'; });
    const r = await limpio.evaluate(() => { const b = document.querySelector('svg').getBoundingClientRect(); return { x: 0, y: 0, width: Math.ceil(b.width), height: Math.ceil(b.height) }; });
    await limpio.setViewportSize({ width: r.width, height: Math.max(200, r.height) });
    await limpio.screenshot({ path: path.join(DIR, n + '.png'), clip: r });
    console.log('ok', n, r.width + 'x' + r.height);
  }
  await limpio.context().close();
  // ---- 3: celular con el panel abierto
  const m = await abrir(b, { viewport: { width: 405, height: 720 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await m.evaluate(() => { const c = document.querySelector('#chkCalidad'); if (!c.checked) { c.checked = true; c.dispatchEvent(new Event('change')); } });
  await m.waitForTimeout(8000);
  await m.evaluate(() => window.glamping.motor.renderer.setAnimationLoop(null));
  const render = () => m.evaluate(() => {
    const U = window.glamping.motor;
    U.renderer.setPixelRatio(2); U.composer.setPixelRatio?.(2);
    U.renderer.setSize(405, 720, false); U.composer.setSize(405, 720);
    U.camara.aspect = 405 / 720;
    U.camara.position.set(6.2, 2.6, -12.5); U.controles.target.set(-0.6, -2.1, 2.4);
    U.camara.fov = 50; U.camara.updateProjectionMatrix(); U.camara.lookAt(-0.6, -2.1, 2.4);
    U.vuelo = null; U.gtao.enabled = U.aoActivo; U.renderer.shadowMap.needsUpdate = true;
    U.composer.render();
  });
  const shot = async (n) => { await m.waitForTimeout(600); await render(); const t = Date.now(); await m.screenshot({ path: path.join(DIR, n + '.png'), timeout: 240000 }); console.log('ok', n, Date.now() - t, 'ms'); };
  await m.evaluate(() => document.querySelector('#asaPanel').click()); await m.waitForTimeout(800);
  await shot('m1-modelos');
  await m.evaluate(() => document.querySelector('#parametros').scrollIntoView({ block: 'start' })); await shot('m3-medidas-440');
  await ancho(m, 5.2); await m.waitForTimeout(9000);
  await shot('m4-medidas-520');
  await b.close();
})().catch(e => { console.error('FALLA', e); process.exit(1); });
