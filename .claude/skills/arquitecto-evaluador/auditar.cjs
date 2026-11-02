// Arquitecto evaluador de Axiona Obra: abre la app, carga cada escenario, le da órdenes a Axi,
// recorre las pestañas y guarda capturas, respuestas de Axi y errores en un informe JSON.
// Uso: node .claude/skills/arquitecto-evaluador/auditar.cjs [URL] [id-escenario ...]
// URL por defecto: http://localhost:5173/?lang=es (npm run dev). Para producción: https://obra.axionasoft.com/?lang=es
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const URL = process.argv.slice(2).find(a => a.startsWith('http')) || 'http://localhost:5173/?lang=es';
console.log('Probando', URL);
const filtro = process.argv.slice(2).filter(a => !a.startsWith('http'));
const ESC = JSON.parse(fs.readFileSync(path.join(__dirname, 'escenarios.json'), 'utf8')).filter(e => !filtro.length || filtro.includes(e.id));
const OUT = path.resolve('evaluacion', new Date().toISOString().slice(0, 10)); fs.mkdirSync(OUT, { recursive: true });
const TABS = ['proyecto', 'terreno', 'programa', 'planos', 'interiores', 'modelo', 'cantidades', 'ventas', 'ar'];
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  const informe = [];
  for (const e of ESC) {
    const p = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
    const errores = []; p.on('pageerror', x => errores.push(x.message)); p.on('dialog', d => d.accept());
    await p.goto(URL, { waitUntil: 'networkidle' }); await p.waitForSelector('[data-tab]', { timeout: 30000 }); await p.waitForTimeout(800);
    await p.click('[data-tab="proyecto"]'); await p.click(`[data-pais="${e.pais}"]`).catch(() => errores.push('sin botón de país ' + e.pais)); await p.waitForTimeout(600);
    await p.click('[data-tab="terreno"]'); await p.selectOption('#plantillaSel', e.plantilla).catch(() => errores.push('sin plantilla ' + e.plantilla)); await p.waitForTimeout(1200);
    const axi = [];
    for (const o of e.ordenes) {
      if (await p.locator('#axiPanel').isHidden()) await p.click('#axiBtn');
      await p.fill('#axiTxt', o); await p.press('#axiTxt', 'Enter'); await p.waitForTimeout(1800);
      const msgs = await p.$$eval('#axiMsgs > *', n => n.map(x => x.innerText.trim()).filter(Boolean));
      axi.push({ orden: o, respuesta: msgs.at(-1) || '' });
    }
    if (await p.locator('#axiPanel').isVisible()) await p.click('#axiCerrar').catch(() => {});
    const capturas = [];
    for (const t of TABS) {
      await p.click(`[data-tab="${t}"]`); await p.waitForTimeout(t === 'modelo' ? 4000 : 900);
      const f = `${e.id}_${t}.png`; await p.screenshot({ path: path.join(OUT, f) }); capturas.push(f);
    }
    const resumen = await p.evaluate(() => [...document.querySelectorAll('header .kpi, header [class*=kpi], .top .kpi')].map(x => x.innerText.replace(/\s+/g, ' ')).join(' | '));
    informe.push({ ...e, axi, errores, capturas, resumen });
    console.log(e.id, '· errores:', errores.length, '· capturas:', capturas.length);
    await p.close();
  }
  fs.writeFileSync(path.join(OUT, 'informe.json'), JSON.stringify(informe, null, 1));
  console.log('Informe:', path.join(OUT, 'informe.json'));
  await b.close();
})().catch(x => { console.error(x); process.exit(1); });
