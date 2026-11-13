/* ==========================================================================
   AXIONA OBRA · Render con WebGPU (trazado de rayos)
   --------------------------------------------------------------------------
   Este módulo vive en el «mundo del render» (ver vite.config.js): aquí
   «three» es three 0.186 y el motor es three-gpu-pathtracer 0.0.27 con
   WebGPU (compute shaders). Si el equipo no tiene WebGPU, usa el mismo
   trazado de rayos sobre WebGL 2. Recibe el modelo del visor como GLB, lo
   ilumina con el cielo HDRI real (Poly Haven, CC0) girado para que el sol
   bañe la fachada que se mira, y revela la imagen muestra a muestra.
   Para que la página no se trabe:
   · la escena se prepara por tandas cortas (normales, tangentes y BVH de
     cada geometría), devolviendo el control al navegador entre tandas;
   · en WebGL 2 el BVH se arma en un hilo aparte (Web Worker);
   · cada muestra espera a que la GPU termine la anterior y el tamaño de la
     tanda se ajusta a la GPU del equipo (computador o celular).
   Se carga solo cuando el usuario toca «Render WebGPU».
   ========================================================================== */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js';
import { MeshBVH, SAH } from 'three-mesh-bvh';

const DEP = typeof location !== 'undefined' && /[?&]depurar3d/.test(location.search);
const log = (...a) => { if (DEP) console.info('[render]', Math.round(performance.now()), ...a); };
const SOL_U = 0.5947; // sol del cielo dia_1k.hdr: u en la imagen equirectangular (48° de altura)
const pausa = () => new Promise(ok => setTimeout(ok, 0));
let cieloPromesa = null;
const cieloDia = url => (cieloPromesa ||= new HDRLoader().loadAsync(url).then(t => { t.mapping = THREE.EquirectangularReflectionMapping; return t; }));

/** Cielo de noche: degradado oscuro (las lámparas, los postes y la piscina hacen el trabajo). */
function cieloNoche() {
  const w = 8, h = 64, d = new Float32Array(w * h * 4);
  const arriba = new THREE.Color(0x070d1f), abajo = new THREE.Color(0x1a1d2a), c = new THREE.Color();
  for (let y = 0; y < h; y++) {
    c.copy(abajo).lerp(arriba, Math.pow(y / (h - 1), 0.75));
    for (let x = 0; x < w; x++) d.set([c.r, c.g, c.b, 1], (y * w + x) * 4);
  }
  const t = new THREE.DataTexture(d, w, h, THREE.RGBAFormat, THREE.FloatType);
  t.mapping = THREE.EquirectangularReflectionMapping; t.magFilter = t.minFilter = THREE.LinearFilter; t.needsUpdate = true;
  return t;
}

/** ¿Hay WebGPU utilizable en este equipo? */
export async function hayWebGPU() {
  try { if (!navigator.gpu) return false; return !!(await navigator.gpu.requestAdapter()); } catch { return false; }
}

async function escena({ glb, camara, urlCielo, ancho, alto, noche }) {
  log('glb bytes', glb.byteLength);
  const gltf = await new GLTFLoader().parseAsync(glb, '');
  const esc = new THREE.Scene();
  esc.add(gltf.scene);
  if (DEP) { let tri = 0, mallas = 0; esc.traverse(o => { if (o.isMesh) { mallas++; tri += (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3 * (o.count || 1); } }); log('glb leído', mallas, 'mallas', Math.round(tri), 'triángulos'); }
  const tex = noche ? cieloNoche() : await cieloDia(urlCielo);
  esc.environment = tex; esc.background = tex; esc.environmentIntensity = noche ? 0.25 : 1.0;
  const cam = new THREE.PerspectiveCamera(camara.fov || 42, ancho / alto, 0.05, 2000);
  cam.position.fromArray(camara.pos);
  if (camara.quat) cam.quaternion.fromArray(camara.quat); else cam.lookAt(new THREE.Vector3().fromArray(camara.obj));
  cam.updateMatrixWorld();
  if (!noche) {
    // el sol queda 40° a un lado de la cámara y detrás de ella: ilumina la fachada que se mira
    const v = cam.position.clone().sub(new THREE.Vector3().fromArray(camara.obj));
    const giro = -(Math.atan2(v.z, v.x) + 0.7 - (SOL_U - 0.5) * 2 * Math.PI);
    esc.environmentRotation.set(0, giro, 0); esc.backgroundRotation.set(0, giro, 0);
  }
  return { esc, cam };
}

/** Normales, tangentes y BVH de cada geometría, por tandas de ~25 ms (el navegador sigue respondiendo). */
async function prepararPorTandas(esc, alAvanzar) {
  const geos = new Set();
  esc.traverse(o => { if (o.isMesh && o.geometry?.isBufferGeometry) geos.add(o.geometry); });
  const lista = [...geos];
  let t = performance.now();
  for (let i = 0; i < lista.length; i++) {
    const g = lista[i];
    const n = g.attributes.position.count;
    if (!g.index) { const idx = n > 65535 ? new Uint32Array(n) : new Uint16Array(n); for (let k = 0; k < n; k++) idx[k] = k; g.setIndex(new THREE.BufferAttribute(idx, 1)); }
    if (!g.attributes.normal) g.computeVertexNormals();
    if (!g.attributes.tangent) {
      if (g.attributes.uv) { try { g.computeTangents(); } catch { /* geometría sin uv útiles */ } }
      if (!g.attributes.tangent) g.setAttribute('tangent', new THREE.BufferAttribute(new Float32Array(n * 4), 4));
    }
    if (!g.boundsTree) g.boundsTree = new MeshBVH(g, { strategy: SAH, targetLeafSize: 5 });
    if (performance.now() - t > 25) { alAvanzar?.((i + 1) / lista.length); await pausa(); t = performance.now(); }
  }
  alAvanzar?.(1);
}

/**
 * Empieza el render progresivo. La imagen se muestra en `lienzo` (un canvas 2D normal): en WebGPU se calcula
 * en la GPU y se lee de vuelta cada ~0,4 s, lo que funciona en cualquier navegador y deja la misma imagen
 * que luego se guarda.
 * @param {{glb: ArrayBuffer, camara: {pos:number[], quat?:number[], obj:number[], fov:number}, lienzo: HTMLCanvasElement,
 *   ancho: number, alto: number, objetivo?: number, urlCielo: string, noche?: boolean, presupuesto?: number,
 *   alAvanzar?: (fase:string, p:number)=>void}} o
 * @returns {Promise<{motor:string, paso:()=>Promise<void>, muestras:()=>Promise<number>, refrescar:()=>Promise<void>, cerrar:()=>void}>}
 */
export async function iniciarRender({ glb, camara, lienzo, ancho, alto, objetivo = 256, urlCielo, urlFiltro = null, noche = false, alAvanzar, presupuesto: inicial = 1 << 14 }) {
  const { esc, cam } = await escena({ glb, camara, urlCielo, ancho, alto, noche });
  lienzo.width = ancho; lienzo.height = alto;
  const cx = lienzo.getContext('2d');
  const expo = noche ? 1.5 : 1.0;
  if (await hayWebGPU()) {
    const TW = await import('three/webgpu');
    const PT = await import('three-gpu-pathtracer/webgpu');
    const renderer = new TW.WebGPURenderer({ antialias: false, alpha: true });
    renderer.setPixelRatio(1); renderer.setSize(ancho, alto, false);
    await renderer.init();
    log('webgpu init');
    await prepararPorTandas(esc, p => alAvanzar?.('escena', p));
    log('geometrías listas');
    await pausa();
    const pt = new PT.WebGPUPathTracer(renderer);
    // la imagen normal queda debajo del lienzo y la del trazado de rayos aparece encima en cuanto cada píxel tiene su primera muestra
    Object.assign(pt, { renderDelay: 0, fadeDuration: 700, minSamples: 1, dynamicLowRes: false, synchronizeRenderSize: false });
    pt.maxSamples = objetivo; pt.maxBounces = 8; pt.filterGlossyFactor = 0.5;
    pt.transmissiveBackground = PT.TRANSMISSIVE_BACKGROUND_ENVIRONMENT; // el vidrio deja ver el cielo y lo que hay detrás
    // filtro de ruido (Intel Open Image Denoise en WebGPU): al llegar a las muestras pedidas limpia la imagen,
    // guiado por el color base y las normales de la escena. Si no carga, el render sigue sin filtro.
    let filtro = null;
    if (urlFiltro) {
      try {
        const { initUNetFromURL } = await import('oidn-web');
        filtro = new PT.OIDNDenoiser({ initUNetFromURL, auxWeightsUrl: urlFiltro });
        pt.setDenoiser(filtro);
      } catch (e) { log('sin filtro de ruido', e?.message); filtro = null; }
    }
    // empieza con tandas pequeñas (celulares, GPU integradas) y las duplica mientras la GPU vaya sobrada
    let presupuesto = inicial; pt.frameBudget = presupuesto;
    pt.setSize(ancho, alto);
    pt.setScene(esc, cam);
    log('setScene listo');
    // el resultado se dibuja (con AgX y sRGB) en un destino propio y de ahí se lee: no depende del lienzo WebGPU
    const destino = new TW.RenderTarget(ancho, alto, { type: TW.UnsignedByteType, depthBuffer: false });
    destino.texture.colorSpace = TW.SRGBColorSpace;
    const blit = pt._blitQuad?.material;
    if (blit) { blit.toneMapping = TW.AgXToneMapping; blit.exposure = expo; }
    renderer.setRenderTarget(destino);
    const dispositivo = renderer.backend?.device;
    const esperarGPU = () => (dispositivo ? dispositivo.queue.onSubmittedWorkDone() : new Promise(ok => requestAnimationFrame(ok)));
    const datos = cx.createImageData(ancho, alto), fila = ancho * 4, zancada = Math.ceil(fila / 256) * 256;
    const refrescar = async () => {
      const px = await renderer.readRenderTargetPixelsAsync(destino, 0, 0, ancho, alto);
      const b = new Uint8Array(px.buffer, px.byteOffset, px.byteLength);
      if (zancada === fila) datos.data.set(b.subarray(0, fila * alto));
      else for (let y = 0; y < alto; y++) datos.data.set(b.subarray(y * zancada, y * zancada + fila), y * fila);
      cx.putImageData(datos, 0, 0);
    };
    let tiempos = [], visto = 0;
    if (DEP) window.__rgpuPT = { pt, renderer, destino };
    return {
      motor: 'WebGPU',
      async paso() {
        const t = performance.now();
        renderer.setRenderTarget(destino);
        pt.renderSample();
        await esperarGPU();
        // la tanda se ajusta a la GPU: ~20–60 ms por paso deja libre la pantalla y el resto de la página
        tiempos.push(performance.now() - t);
        if (tiempos.length === 4) {
          const ms = tiempos.reduce((a, b) => a + b) / 4; tiempos = [];
          if (ms < 20 && presupuesto < 1 << 20) presupuesto *= 2; else if (ms > 60 && presupuesto > 1 << 10) presupuesto /= 2;
          if (pt.frameBudget !== presupuesto) { pt.frameBudget = presupuesto; log('tanda', presupuesto, Math.round(ms) + ' ms'); }
        }
        if (performance.now() - visto > 400) { visto = performance.now(); await refrescar(); }
      },
      async muestras() { const c = await pt.getSampleCountsAsync(); return c?.avg ?? 0; },
      /** 'sin' si no hay filtro; 'filtrando' mientras corre; 'listo' cuando la imagen ya salió limpia */
      filtro: () => (!filtro ? 'sin' : filtro.complete ? 'listo' : filtro.running ? 'filtrando' : 'esperando'),
      refrescar,
      cerrar() { try { pt.dispose(); } catch { /* */ } try { filtro?.dispose?.(); } catch { /* */ } destino.dispose(); renderer.dispose(); },
    };
  }
  // Respaldo: el mismo trazado de rayos sobre WebGL 2, con el BVH armado en un Web Worker
  const { WebGLPathTracer } = await import('three-gpu-pathtracer');
  const { GenerateMeshBVHWorker } = await import('three-mesh-bvh/worker');
  const lienzoGL = document.createElement('canvas'); lienzoGL.width = ancho; lienzoGL.height = alto;
  const renderer = new THREE.WebGLRenderer({ canvas: lienzoGL, antialias: false, alpha: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1); renderer.setSize(ancho, alto, false);
  renderer.toneMapping = THREE.AgXToneMapping; renderer.toneMappingExposure = expo;
  const pt = new WebGLPathTracer(renderer);
  Object.assign(pt, { renderDelay: 0, fadeDuration: 700, minSamples: 1, dynamicLowRes: false, bounces: 6, filterGlossyFactor: 0.5 });
  pt.tiles.set(3, 3);
  const trabajador = new GenerateMeshBVHWorker();
  pt.setBVHWorker(trabajador);
  await pt.setSceneAsync(esc, cam, { onProgress: p => alAvanzar?.('escena', p) });
  trabajador.dispose?.();
  log('setSceneAsync listo (WebGL 2)');
  const refrescar = async () => { cx.clearRect(0, 0, ancho, alto); cx.drawImage(lienzoGL, 0, 0); };
  let tiempos = [], visto = 0;
  return {
    motor: 'WebGL 2',
    async paso() {
      if (pt.samples >= objetivo) return;
      const t = performance.now();
      pt.renderSample();
      await new Promise(ok => requestAnimationFrame(ok));
      tiempos.push(performance.now() - t);
      if (tiempos.length === 6) { const ms = tiempos.reduce((a, b) => a + b) / 6; tiempos = []; if (ms > 70 && pt.tiles.x < 6) pt.tiles.set(pt.tiles.x + 1, pt.tiles.y + 1); }
      if (performance.now() - visto > 400) { visto = performance.now(); await refrescar(); }
    },
    async muestras() { return pt.samples; },
    filtro: () => 'sin',
    refrescar,
    cerrar() { try { pt.dispose(); } catch { /* */ } renderer.dispose(); renderer.forceContextLoss?.(); },
  };
}
