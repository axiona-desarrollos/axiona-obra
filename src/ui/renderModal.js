/* ==========================================================================
   AXIONA OBRA · Ventana del render WebGPU
   --------------------------------------------------------------------------
   Toma el modelo tal como se ve en el 3D (fase, estilo, piso, casa abierta,
   día o noche), lo pasa como GLB al mundo del render (renderWebGPU.js,
   three 0.186) y muestra cómo se revela la imagen con trazado de rayos sobre
   la vista normal, que aparece al instante. Al terminar se guarda en JPG.
   Todo corre en el equipo del usuario: no se sube nada.
   ========================================================================== */
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { tres, ensure3D, buildScene, escenaParaFoto, render3D } from '../vista3d/escena.js';
import { texturasListas } from '../vista3d/materiales.js';
import { app, toast } from './comun.js';
import { tr } from '../motor/index.js';
import { evento } from './analitica.js';

const T = (es, en) => tr({ es, en });
const DEP = /[?&]depurar3d/.test(location.search);
const nombreArchivo = () => `${String(app.S?.nombre || 'proyecto').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w-]+/g, '-').slice(0, 50)}_render.jpg`;
const cuadro = () => new Promise(ok => requestAnimationFrame(() => setTimeout(ok, 0)));

export async function abrirRenderWebGPU() {
  if (!ensure3D()) return toast(T('El 3D no está disponible en este dispositivo.', '3D is not available on this device.'));
  if (app.threeDirty) buildScene();
  if (document.getElementById('rgpu')) return;
  const movil = Math.min(window.innerWidth, window.innerHeight) < 700;
  const o = (DEP && window.__rgpu) || {};
  // con el filtro de ruido bastan pocas muestras: en un PC ~10–30 s, en un celular algo más
  const ancho = o.ancho || (movil ? 960 : 1600), alto = o.alto || (movil ? 540 : 900), objetivo = o.objetivo || (movil ? 32 : 96);
  document.body.insertAdjacentHTML('beforeend', `<div class="rgpu" id="rgpu" role="dialog" aria-modal="true" aria-label="${T('Render WebGPU', 'WebGPU render')}">
    <div class="rgpu-caja">
      <header><b>${T('Render realista', 'Realistic render')}</b><span class="rgpu-motor" id="rgpuMotor">WebGPU</span><button class="rgpu-x" id="rgpuX" aria-label="${T('Cerrar', 'Close')}">×</button></header>
      <div class="rgpu-lienzo"><img id="rgpuPrevia" alt=""><canvas id="rgpuLienzo" width="${ancho}" height="${alto}"></canvas></div>
      <footer><div class="rgpu-barra"><i id="rgpuBarra"></i></div><span id="rgpuTxt">${T('Preparando el modelo…', 'Preparing the model…')}</span>
        <button class="btn pri sm" id="rgpuGuardar" disabled>${T('Guardar imagen', 'Save image')}</button></footer>
    </div></div>`);
  const $ = id => document.getElementById(id);
  let cerrado = false, motor = null;
  const cerrar = () => { cerrado = true; try { motor?.cerrar(); } catch { /* */ } $('rgpu')?.remove(); document.removeEventListener('keydown', tecla); };
  const tecla = e => { if (e.key === 'Escape') cerrar(); };
  document.addEventListener('keydown', tecla);
  $('rgpuX').onclick = cerrar;
  $('rgpu').addEventListener('click', e => { if (e.target.id === 'rgpu') cerrar(); });
  const txt = t => { if (!cerrado) $('rgpuTxt').textContent = t; };
  const barra = p => { if (!cerrado) $('rgpuBarra').style.width = `${Math.round(Math.min(1, p) * 100)}%`; };
  try {
    await cuadro();
    // la vista normal aparece al instante (lo que ya está en pantalla); el trazado de rayos la va reemplazando
    try { render3D(); $('rgpuPrevia').src = tres.renderer.domElement.toDataURL('image/jpeg', 0.85); } catch { /* sin vista previa */ }
    await texturasListas(8000);
    if (cerrado) return;
    const t0e = performance.now();
    // misma vista que la pantalla: fase, piso, casa abierta (los muros cortados se acortan de verdad)
    const E = escenaParaFoto({ w: ancho, h: alto, vista: 'actual' });
    let glb;
    try {
      const objetos = [tres.root, tres.tapas].filter(x => x && x.visible);
      glb = await new GLTFExporter().parseAsync(objetos, { binary: true, onlyVisible: true, maxTextureSize: 1024 });
    } finally { E.restaurar(); }
    if (DEP) console.info('[render] export GLB ms', Math.round(performance.now() - t0e), 'bytes', glb.byteLength);
    if (cerrado) return;
    txt(T('Cargando el motor de render…', 'Loading the render engine…')); barra(0.04);
    const R = await import('../vista3d/renderWebGPU.js');
    if (cerrado) return;
    const camara = { pos: E.cam.position.toArray(), quat: E.cam.quaternion.toArray(), obj: tres.ctl.target.toArray(), fov: E.cam.fov };
    motor = await R.iniciarRender({
      glb, camara, lienzo: $('rgpuLienzo'), ancho, alto, objetivo, presupuesto: o.presupuesto, noche: !!tres.scene?.userData?.noche,
      urlCielo: new URL('cielo/dia_1k.hdr', document.baseURI).href,
      urlFiltro: o.sinFiltro ? null : new URL('oidn/rt_hdr_alb_nrm_small.tza', document.baseURI).href,
      alAvanzar: (fase, p) => { txt(T(`Armando la escena para el trazado de rayos · ${Math.round(p * 100)} %`, `Building the ray tracing scene · ${Math.round(p * 100)} %`)); barra(0.05 + p * 0.1); },
    });
    if (cerrado) { motor.cerrar(); return; }
    $('rgpuMotor').textContent = motor.motor === 'WebGPU' ? 'WebGPU' : T('WebGL 2 · este equipo no tiene WebGPU', 'WebGL 2 · no WebGPU on this device');
    evento('render_webgpu', { motor: motor.motor });
    txt(T('Calculando la luz: primera pasada…', 'Computing light: first pass…'));
    const t0 = performance.now();
    let pasos = 0, n = 0;
    $('rgpuGuardar').onclick = async () => {
      // la vista normal de fondo (por si aún hay píxeles sin su primera muestra) y encima el render
      await motor.refrescar();
      const c = document.createElement('canvas'); c.width = ancho; c.height = alto;
      const x = c.getContext('2d'); const pv = $('rgpuPrevia');
      if (pv?.complete && pv.naturalWidth) x.drawImage(pv, 0, 0, ancho, alto); else { x.fillStyle = '#000'; x.fillRect(0, 0, ancho, alto); }
      x.drawImage($('rgpuLienzo'), 0, 0);
      const blob = await new Promise(ok => c.toBlob(ok, 'image/jpeg', 0.92));
      if (!blob) return toast(T('No se pudo guardar la imagen.', 'Could not save the image.'));
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = nombreArchivo();
      document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 8000);
      toast(T('Render guardado.', 'Render saved.'));
    };
    let fin = false;
    while (!cerrado) {
      await motor.paso(); pasos++;
      if (!fin && (pasos % 12 === 0 || pasos === 4)) {
        n = await motor.muestras();
        if (cerrado) break;
        barra(0.15 + 0.8 * Math.min(1, n / objetivo));
        if (n >= 1) { $('rgpuGuardar').disabled = false; $('rgpuPrevia').classList.add('ido'); }
        txt(T(`Revelando con trazado de rayos · ${Math.floor(n)} de ${objetivo} muestras`, `Path tracing · ${Math.floor(n)} of ${objetivo} samples`));
        if (n >= objetivo - 0.01 || performance.now() - t0 > 240000) fin = true;
      }
      if (fin) {
        const f = motor.filtro();
        if (f === 'filtrando' || f === 'esperando') txt(T('Limpiando el ruido con Intel Open Image Denoise…', 'Removing noise with Intel Open Image Denoise…'));
        if (f === 'sin' || f === 'listo' || performance.now() - t0 > 300000) {
          await motor.refrescar(); barra(1);
          const s = Math.round((performance.now() - t0) / 1000);
          txt(T(`Listo · ${Math.floor(n)} muestras${f === 'listo' ? ' + filtro de ruido' : ''} en ${s} s. Guárdalo en JPG.`, `Done · ${Math.floor(n)} samples${f === 'listo' ? ' + denoise' : ''} in ${s} s. Save it as JPG.`));
          $('rgpuGuardar').disabled = false;
          evento('render_webgpu_listo', { motor: motor.motor, muestras: Math.floor(n), segundos: s, filtro: f });
          break;
        }
      }
      await cuadro(); // cada paso le cede un cuadro a la pantalla: la página nunca se traba
    }
  } catch (e) {
    console.warn('render WebGPU', e);
    txt(T('No se pudo hacer el render en este equipo. Prueba con la «Foto».', 'The render could not run on this device. Try «Snapshot».'));
  }
}
