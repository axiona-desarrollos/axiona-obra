/* ==========================================================================
   AXIONA AR · Compatibilidad y diagnóstico del celular
   --------------------------------------------------------------------------
   La AR propia tiene que funcionar en cualquier celular, incluidos los Redmi
   y demás Android económicos. Aquí vive lo que lo hace posible:
   - Reconocer los navegadores internos (Instagram, Facebook, TikTok…), que
     no dejan usar la cámara, y ofrecer abrir la página en Chrome.
   - Abrir la cámara probando varias formas y varias cámaras traseras hasta
     que una entregue imagen (en los celulares con cámara macro o de
     profundidad, la primera a veces no da cuadros).
   - «Probar mi celular»: revisa paso a paso la cámara, los gráficos 3D, el
     trabajador de visión, el giroscopio y la AR nativa, y dice qué modo de
     AR va a funcionar. El resultado se puede copiar o enviar al equipo.
   Las funciones puras (sin DOM) se prueban en Node.
   ========================================================================== */

/** Navegadores internos de apps conocidas: no dan permiso de cámara a las páginas. */
const INTERNOS = [
  ['Instagram', /Instagram/i],
  ['Facebook', /FBAN|FBAV|FB_IAB|FBIOS|\[FB/i],
  ['Messenger', /MessengerForiOS|Orca-Android/i],
  ['TikTok', /BytedanceWebview|musical_ly|TikTok|trill_/i],
  ['Snapchat', /Snapchat/i],
  ['LinkedIn', /LinkedInApp/i],
  ['Line', /\bLine\//i],
  ['X (Twitter)', /Twitter(Android)?\b/i],
  ['Pinterest', /Pinterest/i],
  ['Telegram', /Telegram/i],
];

/** Nombre de la app si la página se abrió dentro de su navegador interno, o null. */
export function navegadorInterno(ua = '') {
  for (const [n, re] of INTERNOS) if (re.test(ua)) return n;
  // WebView genérica de Android (marca «; wv)»): otra app que abrió la página por dentro
  if (/Android/.test(ua) && /; wv\)/.test(ua)) return 'app';
  return null;
}

/** Navegador y sistema, para el diagnóstico. */
export function navegador(ua = '') {
  const so = /Android\s([\d.]+)/.exec(ua) ? `Android ${/Android\s([\d.]+)/.exec(ua)[1]}`
    : /iP(hone|ad|od)/.test(ua) ? `iOS ${(/OS (\d+[_\d]*)/.exec(ua)?.[1] || '').replace(/_/g, '.')}`
      : /Windows/.test(ua) ? 'Windows' : /Mac OS X/.test(ua) ? 'macOS' : /Linux/.test(ua) ? 'Linux' : '?';
  const m = /MiuiBrowser\/([\d.]+)/.exec(ua) ? ['Navegador Mi (Xiaomi)', /MiuiBrowser\/([\d.]+)/.exec(ua)[1]]
    : /SamsungBrowser\/([\d.]+)/.exec(ua) ? ['Samsung Internet', /SamsungBrowser\/([\d.]+)/.exec(ua)[1]]
      : /OPR\/([\d.]+)|Opera/.exec(ua) ? ['Opera', /OPR\/([\d.]+)/.exec(ua)?.[1] || '']
        : /EdgA?\/([\d.]+)/.exec(ua) ? ['Edge', /EdgA?\/([\d.]+)/.exec(ua)[1]]
          : /Firefox\/([\d.]+)|FxiOS\/([\d.]+)/.exec(ua) ? ['Firefox', (/Firefox\/([\d.]+)|FxiOS\/([\d.]+)/.exec(ua) || []).slice(1).find(Boolean) || '']
            : /CriOS\/([\d.]+)/.exec(ua) ? ['Chrome (iOS)', /CriOS\/([\d.]+)/.exec(ua)[1]]
              : /Chrome\/([\d.]+)/.exec(ua) ? ['Chrome', /Chrome\/([\d.]+)/.exec(ua)[1]]
                : /Version\/([\d.]+).*Safari/.exec(ua) ? ['Safari', /Version\/([\d.]+)/.exec(ua)[1]] : ['?', ''];
  const marca = /Redmi|Xiaomi|\bMi\s|POCO|M2\d{3}|2\d{3}[A-Z0-9]{4,}/i.test(ua) ? 'Xiaomi' : /SM-|Samsung/i.test(ua) ? 'Samsung' : /moto/i.test(ua) ? 'Motorola' : /Huawei|HONOR/i.test(ua) ? 'Huawei/Honor' : /iPhone|iPad/.test(ua) ? 'Apple' : '';
  const modelo = /Android[^;]*;\s*(?:[a-z]{2}[-_][A-Za-z]{2};\s*)?([^;)]+?)(?:\sBuild|\))/.exec(ua)?.[1]?.trim() || '';
  return { so, nombre: m[0], version: m[1], marca, modelo: modelo === 'K' ? '' : modelo, interno: navegadorInterno(ua) };
}

/** Enlace que abre la misma página en Chrome desde el navegador interno de una app (Android). */
export function enlaceChrome(url) {
  const u = new URL(url);
  return `intent://${u.host}${u.pathname}${u.search}${u.hash}#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=${encodeURIComponent(url)};end`;
}

/** Las formas de pedir la cámara, de la más exigente a la más simple. */
export function intentosCamara(ids = []) {
  const base = [
    { audio: false, video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } } },
    { audio: false, video: { facingMode: 'environment' } },
  ];
  // en los Xiaomi y otros con varias cámaras traseras se prueba cada una
  const porId = ids.map(id => ({ audio: false, video: { deviceId: { exact: id }, width: { ideal: 1280 }, height: { ideal: 720 } } }));
  return [...base, ...porId, { audio: false, video: true }];
}

/** Explicación y qué hacer con cada error de la cámara. */
export function consejoCamara(nombre, { android = false, ios = false, interno = null } = {}) {
  if (interno) return {
    es: `Estás dentro de ${interno === 'app' ? 'una app' : interno}, que no deja usar la cámara. Abre la página en ${ios ? 'Safari' : 'Chrome'}.`,
    en: `You are inside ${interno === 'app' ? 'an app' : interno}, which blocks the camera. Open the page in ${ios ? 'Safari' : 'Chrome'}.`,
  };
  switch (nombre) {
    case 'NotAllowedError': case 'SecurityError': case 'PermissionDeniedError':
      return android ? {
        es: 'El permiso de la cámara está bloqueado. Toca el candado junto a la dirección › Permisos › Cámara › Permitir. Si no aparece: Ajustes del celular › Apps › Chrome › Permisos › Cámara › Permitir.',
        en: 'Camera permission is blocked. Tap the lock next to the address › Permissions › Camera › Allow. If it is not there: phone Settings › Apps › Chrome › Permissions › Camera › Allow.',
      } : ios ? {
        es: 'El permiso de la cámara está bloqueado. Ajustes › Safari › Cámara › Permitir, y vuelve a cargar la página.',
        en: 'Camera permission is blocked. Settings › Safari › Camera › Allow, then reload the page.',
      } : {
        es: 'El permiso de la cámara está bloqueado. Actívalo en el candado de la barra de direcciones y vuelve a intentar.',
        en: 'Camera permission is blocked. Allow it from the lock in the address bar and try again.',
      };
    case 'NotReadableError': case 'TrackStartError': case 'AbortError':
      return { es: 'Otra app está usando la cámara (videollamada, cámara, linterna). Ciérrala y vuelve a intentar.', en: 'Another app is using the camera (video call, camera, flashlight). Close it and try again.' };
    case 'NotFoundError': case 'DevicesNotFoundError': case 'OverconstrainedError':
      return { es: 'No se encontró una cámara que sirva en este equipo.', en: 'No usable camera was found on this device.' };
    case 'SinCuadros':
      return { es: 'La cámara se abrió pero no entregó imagen. Cierra otras apps que usen la cámara, reinicia Chrome y vuelve a intentar.', en: 'The camera opened but sent no image. Close other camera apps, restart Chrome and try again.' };
    case 'SinAPI': case 'NotSupportedError': case 'TypeError':
      return { es: 'Este navegador no deja usar la cámara. Abre obra.axionasoft.com en Chrome (Android) o Safari (iPhone).', en: 'This browser does not allow camera access. Open obra.axionasoft.com in Chrome (Android) or Safari (iPhone).' };
    default:
      return { es: 'No se pudo abrir la cámara. Vuelve a intentar o usa «Probar mi celular».', en: 'Could not open the camera. Try again or use “Test my phone”.' };
  }
}

/** Qué modos de AR van a funcionar según las pruebas. */
export function veredicto(r) {
  const camara = r.camara?.ok, webgl = r.webgl?.ok, giro = r.giroscopio?.ok, vision = r.trabajador?.ok || r.detector?.ok;
  return {
    maqueta: !!(camara && webgl && vision),
    lote: !!(camara && webgl && vision),
    giro: !!(camara && webgl && giro),
    fija: !!(camara && webgl),
    nativa: !!r.nativa?.ok,
    vista3d: !!webgl,
  };
}

/* ---------------------------------------------------------------- en el navegador */

const espera = ms => new Promise(r => setTimeout(r, ms));

/** Espera a que el video tenga cuadros de verdad (ancho y tiempo que avanza). */
export function esperarCuadros(v, ms = 3500) {
  return new Promise(res => {
    const t0 = performance.now();
    let t1 = -1;
    const mirar = () => {
      if (v.videoWidth > 0 && v.readyState >= 2) {
        if (t1 < 0) t1 = v.currentTime;
        else if (v.currentTime !== t1 || performance.now() - t0 > ms * 0.6) return res(true);
      }
      if (performance.now() - t0 > ms) return res(v.videoWidth > 0);
      setTimeout(mirar, 80);
    };
    mirar();
  });
}

/** Abre la cámara trasera probando formas y cámaras hasta que una entregue imagen. */
export async function abrirCamara(video, { alIntentar = () => {} } = {}) {
  if (!navigator.mediaDevices?.getUserMedia) throw Object.assign(new Error('getUserMedia'), { name: 'SinAPI' });
  let ultimo = null, ids = [], listado = false;
  const intentos = intentosCamara();
  for (let i = 0; i < intentos.length; i++) {
    const c = intentos[i];
    alIntentar(i, c);
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia(c);
    } catch (e) {
      ultimo = e;
      if (e.name === 'NotAllowedError' || e.name === 'SecurityError') throw e;   // reintentar no sirve: falta el permiso
      continue;
    }
    video.srcObject = stream;
    video.muted = true; video.setAttribute('playsinline', ''); video.setAttribute('muted', '');
    // play() nunca termina si la cámara no manda cuadros: se espera un rato y se sigue
    await Promise.race([video.play().catch(() => {}), espera(1500)]);
    if (await esperarCuadros(video)) {
      const s = stream.getVideoTracks()[0]?.getSettings?.() || {};
      return { stream, intento: i, ancho: video.videoWidth || s.width, alto: video.videoHeight || s.height, etiqueta: stream.getVideoTracks()[0]?.label || '' };
    }
    stream.getTracks().forEach(t => t.stop());
    video.srcObject = null;
    ultimo = Object.assign(new Error('La cámara no entregó imagen'), { name: 'SinCuadros' });
    // con el permiso ya dado, enumerateDevices trae las cámaras: se agregan las traseras para probarlas una por una
    if (!listado) {
      listado = true;
      try {
        const dev = (await navigator.mediaDevices.enumerateDevices()).filter(d => d.kind === 'videoinput' && d.deviceId);
        const traseras = dev.filter(d => /back|rear|trasera|environment|facing back/i.test(d.label));
        ids = (traseras.length ? traseras : dev).map(d => d.deviceId);
        intentos.splice(i + 1, intentos.length - i - 2, ...intentosCamara(ids).slice(2, -1));
      } catch { /* sin lista */ }
    }
    await espera(150);
  }
  throw ultimo || Object.assign(new Error('Sin cámara'), { name: 'NotFoundError' });
}

/** WebGL: si hay, cuál versión y qué tarjeta gráfica. */
export function probarWebGL() {
  try {
    const c = document.createElement('canvas');
    const gl = c.getContext('webgl2') || c.getContext('webgl') || c.getContext('experimental-webgl');
    if (!gl) return { ok: false };
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const r = {
      ok: true, version: typeof window.WebGL2RenderingContext !== 'undefined' && gl instanceof window.WebGL2RenderingContext ? 2 : 1,
      tarjeta: ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER),
      textura: gl.getParameter(gl.MAX_TEXTURE_SIZE),
    };
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return r;
  } catch (e) { return { ok: false, error: e.message }; }
}

/** El trabajador de visión responde con un cuadro de prueba. */
export function probarTrabajador(ms = 4000) {
  return new Promise(res => {
    let w;
    try { w = new Worker(new URL('./vision/trabajador.js', import.meta.url), { type: 'module' }); } catch (e) { return res({ ok: false, error: e.message }); }
    const fin = r => { clearTimeout(t); w.terminate(); res(r); };
    const t = setTimeout(() => fin({ ok: false, error: 'sin respuesta' }), ms);
    w.onmessage = e => fin({ ok: true, ms: Math.round(e.data.ms) });
    w.onerror = e => fin({ ok: false, error: e.message || 'error' });
    const wi = 320, hi = 240, buf = new Uint8ClampedArray(wi * hi * 4).fill(200);
    w.postMessage({ buf: buf.buffer, w: wi, h: hi, n: 1 }, [buf.buffer]);
  });
}

/** El giroscopio manda lecturas. */
export async function probarGiroscopio(ms = 1500) {
  const D = window.DeviceOrientationEvent;
  if (!D) return { ok: false, error: 'sin DeviceOrientation' };
  if (typeof D.requestPermission === 'function') {
    try { if (await D.requestPermission() !== 'granted') return { ok: false, error: 'sin permiso' }; } catch (e) { return { ok: false, error: e.message }; }
  }
  return new Promise(res => {
    let alfa = false, beta = false;
    const f = e => { if (e.alpha != null) alfa = true; if (e.beta != null) beta = true; };
    window.addEventListener('deviceorientation', f);
    setTimeout(() => { window.removeEventListener('deviceorientation', f); res({ ok: alfa || beta, alfa, beta }); }, ms);
  });
}

/**
 * Corre todas las pruebas. alPaso(id, resultado) se llama a medida que terminan.
 * pruebaDetector: función opcional que mide el detector en el hilo principal.
 */
export async function diagnosticar({ alPaso = () => {}, pruebaDetector = null } = {}) {
  const ua = navigator.userAgent, nav = navegador(ua);
  const r = { fecha: new Date().toISOString(), ua, nav };
  const paso = (id, v) => { r[id] = v; alPaso(id, v); };
  paso('segura', { ok: !!window.isSecureContext });
  paso('interno', { ok: !nav.interno, app: nav.interno });
  paso('equipo', { ok: true, memoria: navigator.deviceMemory || null, nucleos: navigator.hardwareConcurrency || null, pantalla: `${window.screen.width}×${window.screen.height} @${window.devicePixelRatio}` });
  let permiso = null;
  try { permiso = (await navigator.permissions?.query({ name: 'camera' }))?.state || null; } catch { /* no todos lo traen */ }
  paso('permiso', { ok: permiso !== 'denied', estado: permiso });
  const v = document.createElement('video');
  try {
    const c = await abrirCamara(v);
    const n = (await navigator.mediaDevices.enumerateDevices()).filter(d => d.kind === 'videoinput').length;
    paso('camara', { ok: true, ancho: c.ancho, alto: c.alto, intento: c.intento, camaras: n, etiqueta: c.etiqueta });
    c.stream.getTracks().forEach(t => t.stop());
  } catch (e) {
    paso('camara', { ok: false, error: e.name || 'Error', detalle: e.message });
  }
  v.srcObject = null;
  paso('webgl', probarWebGL());
  paso('trabajador', await probarTrabajador());
  if (pruebaDetector) { try { paso('detector', { ok: true, ms: Math.round(pruebaDetector()) }); } catch (e) { paso('detector', { ok: false, error: e.message }); } }
  paso('giroscopio', await probarGiroscopio());
  let nativa = false;
  try { nativa = !!(navigator.xr && await navigator.xr.isSessionSupported('immersive-ar')); } catch { /* sin WebXR */ }
  paso('nativa', { ok: nativa });
  r.veredicto = veredicto(r);
  return r;
}

/** Texto plano del diagnóstico para copiar, compartir o enviar. */
export function textoDiagnostico(r) {
  const s = b => (b ? '✓' : '✗');
  const n = r.nav || {};
  const l = [
    `Diagnóstico AR · Axiona Obra · ${r.fecha}`,
    `Equipo: ${[n.marca, n.modelo].filter(Boolean).join(' ') || '?'} · ${n.so} · ${n.nombre} ${n.version}${n.interno ? ` · dentro de ${n.interno}` : ''}`,
    `${s(r.segura?.ok)} Conexión segura (https)`,
    `${s(r.interno?.ok)} Navegador ${r.interno?.ok ? 'normal' : `interno de ${r.interno?.app}`}`,
    `${s(r.permiso?.ok)} Permiso de cámara: ${r.permiso?.estado ?? 'sin dato'}`,
    `${s(r.camara?.ok)} Cámara: ${r.camara?.ok ? `${r.camara.ancho}×${r.camara.alto}, intento ${r.camara.intento + 1}, ${r.camara.camaras} cámaras` : `${r.camara?.error} ${r.camara?.detalle || ''}`}`,
    `${s(r.webgl?.ok)} Gráficos 3D: ${r.webgl?.ok ? `WebGL ${r.webgl.version} · ${r.webgl.tarjeta} · ${r.webgl.textura}px` : r.webgl?.error || 'no disponible'}`,
    `${s(r.trabajador?.ok)} Trabajador de visión: ${r.trabajador?.ok ? `${r.trabajador.ms} ms` : r.trabajador?.error}`,
    r.detector ? `${s(r.detector.ok)} Detector en pantalla: ${r.detector.ok ? `${r.detector.ms} ms` : r.detector.error}` : null,
    `${s(r.giroscopio?.ok)} Giroscopio: ${r.giroscopio?.ok ? (r.giroscopio.alfa ? 'completo' : 'solo inclinación') : r.giroscopio?.error || 'sin lecturas'}`,
    `${s(r.nativa?.ok)} AR nativa del celular (ARCore/WebXR)`,
    `Memoria ${r.equipo?.memoria ?? '?'} GB · ${r.equipo?.nucleos ?? '?'} núcleos · pantalla ${r.equipo?.pantalla}`,
    `Modos: maqueta ${s(r.veredicto?.maqueta)} · lote ${s(r.veredicto?.lote)} · sin marcador ${s(r.veredicto?.giro)} · vista fija ${s(r.veredicto?.fija)} · 3D ${s(r.veredicto?.vista3d)}`,
    `UA: ${r.ua}`,
  ];
  return l.filter(Boolean).join('\n');
}
