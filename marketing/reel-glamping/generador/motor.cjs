// Utilidades para manejar la demo de glamping cuadro por cuadro.
const { chromium } = require('playwright');
const URL = 'https://glamping-axiona.netlify.app/';
async function abrir({ w = 1080, h = 1920, ui = false } = {}) {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const ctx = await b.newContext({ viewport: { width: 405, height: 720 }, deviceScaleFactor: ui ? 1080 / 405 : 1, isMobile: true, hasTouch: true, locale: 'es-CO' });
  const p = await ctx.newPage();
  p.on('pageerror', e => console.log('ERR', e.message));
  await p.goto(URL, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await p.waitForFunction(() => window.glamping && window.glamping.listo, null, { timeout: 120000 });
  await p.evaluate(() => { window.glamping.motor.alDegradar = () => {}; });
  return { b, p };
}
async function calidadAlta(p) {
  await p.evaluate(async () => {
    const c = document.querySelector('#chkCalidad');
    if (!c.checked) { c.checked = true; c.dispatchEvent(new Event('change')); }
  });
  await p.waitForTimeout(8000);
}
async function congelar(p, w = 1080, h = 1920) {
  await p.evaluate(([w, h]) => {
    const J = window.glamping, U = J.motor;
    U.renderer.setAnimationLoop(null);
    U.renderer.setPixelRatio(1); U.renderer.setSize(w, h, false); U.composer.setSize(w, h);
    U.camara.aspect = w / h; U.camara.updateProjectionMatrix();
    U.gtao.enabled = U.aoActivo;
    window.__fov = (f) => { const c = w / h; return c < 1 ? Math.min(78, 180 / Math.PI * 2 * Math.atan(Math.tan(f * Math.PI / 360) / Math.pow(c, 0.8))) : f; };
    window.__sombras = true;
    window.__cuadro = (pos, obj, fov, q = 0.92) => {
      U.camara.position.set(...pos); U.controles.target.set(...obj);
      U.camara.fov = window.__fov(fov); U.camara.updateProjectionMatrix();
      U.camara.lookAt(...obj); U.controles.update?.();
      if (window.__sombras) { U.renderer.shadowMap.needsUpdate = true; window.__sombras = false; }
      U.composer.render();
      return U.renderer.domElement.toDataURL('image/jpeg', q);
    };
  }, [w, h]);
}
async function cuadro(p, pos, obj, fov, archivo) {
  const url = await p.evaluate(([a, b, c]) => window.__cuadro(a, b, c), [pos, obj, fov]);
  require('fs').writeFileSync(archivo, Buffer.from(url.split(',')[1], 'base64'));
}
module.exports = { abrir, calidadAlta, congelar, cuadro };
