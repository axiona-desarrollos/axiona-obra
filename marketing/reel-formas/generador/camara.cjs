/* Ayudas para grabar Axiona Obra con Playwright: abre la app (servidor de
   desarrollo, que expone window.__obra), cambia el proyecto y renderiza el 3D
   cuadro a cuadro con una cámara que gira suave, con fondo transparente. */
const fs = require('fs');
const path = require('path');

const URL = process.env.OBRA_URL || 'http://localhost:5199/';

async function abrir(b, { w = 405, h = 720, escala = 1080 / 405, idioma = 'es', movil = true } = {}) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: escala, isMobile: movil, hasTouch: movil, locale: idioma === 'en' ? 'en-US' : 'es-CO' });
  await ctx.addInitScript(l => { try { localStorage.setItem('axiona-obra-idioma', l); localStorage.setItem('axi-visto', '1'); } catch (e) { /* */ } }, idioma);
  const p = await ctx.newPage();
  p.on('pageerror', e => console.error('[pagina]', e.message));
  await p.goto(URL + '?lang=' + idioma, { waitUntil: 'networkidle' });
  await p.waitForFunction(() => window.__obra && window.__obra.app.M);
  return p;
}

/** Cambia el estado del proyecto y recalcula. cambios: función (S) => void serializada. */
async function proyecto(p, cambios) {
  await p.evaluate(src => {
    const O = window.__obra, S = O.app.S;
    (new Function('S', src))(S);
    O.app.threeDirty = true;
    O.recompute();
  }, cambios);
}

/** Renderiza n cuadros de una órbita. Devuelve las rutas de los PNG. */
async function orbita(p, dir, { n = 90, w = 1080, h = 1920, ang0 = -35, ang1 = 25, pitch0 = 38, pitch1 = null, zoom0 = 1.25, zoom1 = null, fov = 32, fase = 10, sinTecho = false, piso = 99, alto = 0.35, dx = 0, dy = 0, prefijo = 'f', inicio = 0 } = {}) {
  fs.mkdirSync(dir, { recursive: true });
  await p.evaluate(({ fase, sinTecho, piso }) => {
    const O = window.__obra;
    if (O.app.threeDirty || !O.tres.root) O.showTab('modelo');
    O.app.viewFloor = piso; O.tres.sinTecho = sinTecho;
    const r = document.querySelector('#phaseRange');
    r.value = fase; r.dispatchEvent(new Event('input', { bubbles: true }));
  }, { fase, sinTecho, piso });
  const rutas = [];
  for (let i = 0; i < n; i++) {
    const t = n === 1 ? 0 : i / (n - 1);
    const url = await p.evaluate(({ t, w, h, ang0, ang1, pitch0, pitch1, zoom0, zoom1, fov, alto, dx, dy }) => {
      const O = window.__obra, T = O.tres, M = O.app.M;
      const s = Math.hypot(M.R.w, M.R.h), cx = (M.R.x0 + M.R.x1) / 2 + dx, cy = (M.R.y0 + M.R.y1) / 2 + dy;
      const e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;   // suave al entrar y al salir
      const L = (a, b) => a + ((b ?? a) - a) * e;
      const a = L(ang0, ang1) * Math.PI / 180, pit = L(pitch0, pitch1) * Math.PI / 180, z = L(zoom0, zoom1);
      const cam = T.cam.clone();
      cam.fov = fov; cam.aspect = w / h;
      const hf = 2 * Math.atan(Math.tan(fov * Math.PI / 360) * Math.min(1, w / h));
      const d = s * z / (2 * Math.tan(hf / 2));
      const ty = M.dl + M.F * M.fh * alto;
      cam.position.set(cx + Math.sin(a) * Math.cos(pit) * d, ty + Math.sin(pit) * d, -cy + Math.cos(a) * Math.cos(pit) * d);
      cam.lookAt(cx, ty, -cy);
      cam.updateProjectionMatrix();
      // renderizador aparte, fuera de la página: el de la app es lento para leer cuadros grandes
      if (!window.__rr || window.__rr.w !== w || window.__rr.h !== h) {
        window.__rr?.r.dispose();
        const R0 = T.renderer, r = new R0.constructor({ antialias: true, preserveDrawingBuffer: true });
        r.toneMapping = R0.toneMapping; r.toneMappingExposure = R0.toneMappingExposure; r.outputColorSpace = R0.outputColorSpace;
        r.shadowMap.enabled = true; r.shadowMap.type = R0.shadowMap.type;
        r.setPixelRatio(1); r.setSize(w, h, false);
        r.setClearColor(0x080c11, 1);
        window.__rr = { r, w, h };
      }
      window.__rr.r.render(T.scene, cam);
      return window.__rr.r.domElement.toDataURL('image/jpeg', 0.93);
    }, { t, w, h, ang0, ang1, pitch0, pitch1, zoom0, zoom1, fov, alto, dx, dy });
    const ruta = path.join(dir, `${prefijo}${String(inicio + i).padStart(4, '0')}.jpg`);
    fs.writeFileSync(ruta, Buffer.from(url.split(',')[1], 'base64'));
    rutas.push(ruta);
  }
    return rutas;
}

module.exports = { abrir, proyecto, orbita, URL };
