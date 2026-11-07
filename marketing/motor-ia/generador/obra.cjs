// Pantallas reales de Axiona Obra para el video «construir el motor».
// Requiere `npm run build && npx vite preview --port 4173` en la raíz del repositorio.
// Uso: node obra.cjs SALIDA_DIR [URL]
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const SAL = process.argv[2];
const URL = process.argv[3] || 'http://localhost:4173/';
fs.mkdirSync(SAL, { recursive: true });

(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const ctx = await b.newContext({ viewport: { width: 405, height: 720 }, deviceScaleFactor: 1080 / 405, isMobile: true, hasTouch: true, locale: 'es-CO' });
  await ctx.addInitScript(() => {
    try {
      localStorage.setItem('axiona-obra-idioma', 'es');
      localStorage.setItem('axiona-obra-tutorial', 'visto');
      localStorage.setItem('axiona-obra-tema', 'oscuro');
      localStorage.setItem('axi-visto', '1');
    } catch { /* nada */ }
  });
  const p = await ctx.newPage();
  p.on('pageerror', e => console.log('ERR', e.message));
  await p.goto(URL, { waitUntil: 'networkidle', timeout: 90000 });
  await p.waitForTimeout(2500);
  const shot = async (n, espera = 1500) => { await p.waitForTimeout(espera); const t = Date.now(); await p.screenshot({ path: path.join(SAL, n + '.png'), timeout: 180000 }); console.log('ok', n, Date.now() - t, 'ms'); };
  const tab = async (t) => { await p.evaluate((t) => document.querySelector(`.tab[data-tab="${t}"]`).click(), t); await p.waitForTimeout(1500); };
  const texto = async () => (await p.evaluate(() => document.querySelector('main, #app, body').innerText)).replace(/\s+/g, ' ').slice(0, 700);
  await shot('b0-inicio');
  await tab('cantidades'); await p.evaluate(() => window.scrollTo(0, 0)); await shot('b1-presupuesto');
  console.log('PRESUPUESTO', await texto());
  for (const [y, n] of [[700, 'b2-presupuesto'], [1500, 'b3-presupuesto']]) { await p.evaluate((y) => window.scrollTo(0, y), y); await shot(n); }
  await tab('planos'); await p.evaluate(() => window.scrollTo(0, 0)); await shot('b4-planos', 3000);
  await tab('modelo'); await p.waitForTimeout(6000);
  await p.evaluate(() => { const c = document.querySelector('canvas'); if (c) c.scrollIntoView({ block: 'center' }); });
  await shot('b5-modelo', 9000);
  await b.close();
})().catch(e => { console.error('FALLA', e); process.exit(1); });
