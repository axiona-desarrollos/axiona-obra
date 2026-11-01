// Pantallas reales de Axiona Topo y Axiona Obra para el video de Walter (celular 1080 × 1920).
// Uso: node tomas.cjs  (Topo en :8171 y Obra en :4173 servidos con vite preview)
const { chromium } = require('playwright');
const path = require('path');
const T = path.resolve(__dirname, '../tomas') + '/';
const TOPO = process.env.TOPO_URL || 'http://localhost:8171/';
const OBRA = process.env.OBRA_URL || 'http://localhost:4173/';
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const errores = [];
  const ctx = await b.newContext({ viewport: { width: 405, height: 720 }, deviceScaleFactor: 1080 / 405, isMobile: true, hasTouch: true, locale: 'es-CO' });
  await ctx.addInitScript(() => {
    try { localStorage.setItem('axiona-obra-idioma', 'es'); localStorage.setItem('axi-visto', '1'); } catch (e) {}
    // sin avisos emergentes encima de las tomas
    addEventListener('DOMContentLoaded', () => { const st = document.createElement('style'); st.textContent = '.toast,#toast{display:none!important}'; document.head.appendChild(st); });
  });
  const p = await ctx.newPage();
  p.on('pageerror', e => errores.push('topo: ' + e.message));
  const foto = async (n, sel, block = 'center') => { await p.waitForTimeout(500); if (sel) await p.evaluate(([s, b]) => document.querySelector(s)?.scrollIntoView({ block: b }), [sel, block]); await p.waitForTimeout(350); await p.screenshot({ path: T + n + '.png' }); };
  await p.goto(TOPO, { waitUntil: 'networkidle' });
  await foto('t1-inicio');
  await p.fill('#nombre', 'Lote de Walter').catch(() => {});
  await p.click('[data-act="metodo"][data-m="cinta"]'); await foto('t2-cinta', '#metodos');
  await p.click('[data-act="metodo"][data-m="gps"]'); await foto('t3-gps', '#metodos');
  await p.click('[data-act="metodo"][data-m="mira"]'); await foto('t4-mira', '#metodos');
  // un lote de ejemplo para mostrar los resultados
  await p.click('[data-act="ejemplo"]').catch(async () => { await p.evaluate(() => document.querySelector('[data-act="ejemplo"]')?.click()); });
  await p.waitForTimeout(800);
  await foto('t5-puntos', '.col-b', 'start');
  await p.click('.dock [data-vista="plano"]'); await p.waitForTimeout(800); await foto('t6-plano');
  await p.click('.dock [data-vista="holo"]'); await p.waitForTimeout(2500); await foto('t7-holo');
  // vista con el botón «Abrir en Axiona Obra»
  const vistas = await p.$$eval('.dock [data-vista]', bs => bs.map(x => x.dataset.vista));
  for (const v of vistas) {
    await p.click(`.dock [data-vista="${v}"]`); await p.waitForTimeout(500);
    if (await p.locator('[data-act="obra"]').isVisible().catch(() => false)) { await foto('t8-enviar', '[data-act="obra"]'); break; }
  }
  // el enlace que manda a Axiona Obra, abierto en Obra local
  const enlace = await p.evaluate(async () => {
    let url = null; const abrir = window.open; window.open = u => { url = u; return null; };
    document.querySelector('[data-act="obra"]').click();
    await new Promise(r => setTimeout(r, 800)); window.open = abrir; return url;
  });
  console.log('enlace a Obra:', enlace ? enlace.slice(0, 60) + '…' : 'no salió');
  const q = await ctx.newPage();
  q.on('pageerror', e => errores.push('obra: ' + e.message));
  const local = enlace ? enlace.replace('https://obra.axionasoft.com/', OBRA + '?lang=es') : OBRA + '?lang=es';
  await q.goto(local, { waitUntil: 'networkidle' });
  await q.waitForTimeout(1200);
  await q.click('.tab[data-tab="terreno"]'); await q.waitForTimeout(800);
  await q.screenshot({ path: T + 'o1-terreno.png' });
  await q.evaluate(() => document.querySelector('[data-p="ret.front"]')?.closest('.card')?.scrollIntoView({ block: 'start' }));
  await q.waitForTimeout(300); await q.screenshot({ path: T + 'o2-retiros.png' });
  await q.click('.tab[data-tab="planos"]'); await q.waitForTimeout(1200);
  await q.screenshot({ path: T + 'o3-planos.png' });
  await q.click('.tab[data-tab="proyecto"]'); await q.waitForTimeout(600);
  await q.locator('#impDoc').first().evaluate(e => e.closest('.card').scrollIntoView({ block: 'center' })).catch(() => {});
  await q.waitForTimeout(300); await q.screenshot({ path: T + 'o4-documentos.png' });
  console.log('ERRORES', errores.length ? errores.join('\n') : 'ninguno');
  await b.close();
})();
