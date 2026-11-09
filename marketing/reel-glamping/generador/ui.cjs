// Pantallas reales de la demo del glamping (con su interfaz) a 810 × 1440.
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const DIR = path.join(process.env.TOMAS || path.join(__dirname, '..', 'tomas'), 'ui');
fs.mkdirSync(DIR, { recursive: true });

(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const ctx = await b.newContext({ viewport: { width: 405, height: 720 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'es-CO' });
  const p = await ctx.newPage();
  await p.goto('https://glamping-axiona.netlify.app/', { waitUntil: 'domcontentloaded', timeout: 90000 });
  await p.waitForFunction(() => window.glamping && window.glamping.listo, null, { timeout: 120000 });
  await p.evaluate(() => { window.glamping.motor.alDegradar = () => {}; const c = document.querySelector('#chkCalidad'); if (!c.checked) { c.checked = true; c.dispatchEvent(new Event('change')); } });
  await p.waitForTimeout(8000);
  await p.evaluate(() => { const U = window.glamping.motor; U.renderer.setAnimationLoop(null); });
  const R = () => p.evaluate(() => {
    const U = window.glamping.motor;
    U.renderer.setPixelRatio(2); U.composer.setPixelRatio?.(2);
    U.renderer.setSize(405, 720, false); U.composer.setSize(405, 720);
    U.camara.aspect = 405 / 720; U.camara.updateProjectionMatrix();
    U.vuelo = null; U.gtao.enabled = U.aoActivo; U.renderer.shadowMap.needsUpdate = true;
    U.composer.render();
  });
  const cam = (pos, obj, fov) => p.evaluate(([pos, obj, fov]) => {
    const U = window.glamping.motor; U.camara.position.set(...pos); U.controles.target.set(...obj);
    U.camara.fov = fov; U.camara.updateProjectionMatrix(); U.camara.lookAt(...obj); U.controles.update?.();
  }, [pos, obj, fov]);
  const shot = async (n) => { await p.waitForTimeout(600); await R(); const t = Date.now(); await p.screenshot({ path: path.join(DIR, n + '.png'), timeout: 180000 }); console.log('ok', n, Date.now() - t, 'ms'); };
  const clic = (sel) => p.evaluate((sel) => document.querySelector(sel).click(), sel);
  const scroll = (sel) => p.evaluate((sel) => document.querySelector(sel).scrollIntoView({ block: 'start' }), sel);
  // Cámara de portada con el glamping arriba, que se vea sobre el panel.
  await cam([5.2, 2.6, -11.5], [-0.6, 0.6, 2.4], 50);

  await shot('u0-inicio');
  await clic('#asaPanel'); await p.waitForTimeout(800);
  await p.evaluate(() => { document.querySelector('#panel').scrollTop = 0; });
  await shot('u1-modelos');
  await scroll('#acabados'); await shot('u2-acabados');
  await scroll('#parametros'); await shot('u3-medidas-a');
  // Ancho exterior 4.40 → 5.20 m: la app reconstruye el glamping y recalcula todo.
  await p.evaluate(() => {
    const s = document.querySelector('#parametros input[type=range]');
    s.value = 5.2; s.dispatchEvent(new Event('input'));
  });
  await p.waitForTimeout(9000);
  await shot('u4-medidas-b');
  await scroll('#ficha'); await shot('u5-ficha-b');
  console.log('FICHA-B', (await p.evaluate(() => document.querySelector('#resumenCosto')?.innerText || document.querySelector('#ficha').innerText)).replace(/\s+/g, ' ').slice(0, 300));
  await p.evaluate(() => { const s = document.querySelector('#parametros input[type=range]'); s.value = 4.4; s.dispatchEvent(new Event('input')); });
  await p.waitForTimeout(9000);
  await scroll('#ficha'); await shot('u6-ficha-a');
  console.log('FICHA-A', (await p.evaluate(() => document.querySelector('#resumenCosto')?.innerText || '')).replace(/\s+/g, ' ').slice(0, 300));
  await clic('#asaPanel');
  await clic('#btnPlanos'); await p.waitForTimeout(3500); await shot('u7-planos');
  const pest = await p.$$eval('#pestanasPlanos button', bs => bs.map(b => b.innerText.replace(/\s+/g, ' ').trim()));
  console.log('PESTAÑAS', JSON.stringify(pest));
  for (const [i, n] of [[2, 'u8-fachadas'], [4, 'u9-estructura'], [7, 'u10-cantidades']]) {
    await p.evaluate((i) => document.querySelectorAll('#pestanasPlanos button')[i]?.click(), i);
    await p.waitForTimeout(2500); await shot(n);
  }
  await clic('#btnCerrarPlanos');
  await clic('#btnAR'); await p.waitForTimeout(2500); await shot('u11-ar');
  await b.close();
})().catch(e => { console.error('FALLA', e); process.exit(1); });
