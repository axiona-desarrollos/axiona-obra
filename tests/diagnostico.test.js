import { describe, it, expect } from 'vitest';
import { navegadorInterno, navegador, enlaceChrome, intentosCamara, consejoCamara, veredicto, textoDiagnostico } from '../src/ar/diagnostico.js';

const REDMI = 'Mozilla/5.0 (Linux; Android 13; 23028RN4DG Build/TP1A.220624.014) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.6723.102 Mobile Safari/537.36';
const MIUI = 'Mozilla/5.0 (Linux; U; Android 12; es-us; Redmi Note 10 Build/SKQ1.210908.001) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/112.0.5615.136 Mobile Safari/537.36 XiaoMi/MiuiBrowser/14.5.31-gn';
const IG = 'Mozilla/5.0 (Linux; Android 13; 23028RN4DG Build/TP1A.220624.014; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/130.0.6723.102 Mobile Safari/537.36 Instagram 352.0.0.39.89 Android (33/13; 440dpi; 1080x2400; Xiaomi/Redmi; 23028RN4DG; sapphire; qcom; es_CO; 652745389)';
const FB = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/FBIOS;FBAV/490.0.0.39.106;FBBV/663412218]';
const WV = 'Mozilla/5.0 (Linux; Android 11; M2101K6G Build/RKQ1.200826.002; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/118.0.0.0 Mobile Safari/537.36';
const SAFARI = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1';

describe('AR en cualquier celular: compatibilidad', () => {
  it('reconoce los navegadores internos de las apps, y deja pasar Chrome, el Navegador Mi y Safari', () => {
    expect(navegadorInterno(IG)).toBe('Instagram');
    expect(navegadorInterno(FB)).toBe('Facebook');
    expect(navegadorInterno(WV)).toBe('app');
    expect(navegadorInterno(REDMI)).toBeNull();
    expect(navegadorInterno(MIUI)).toBeNull();
    expect(navegadorInterno(SAFARI)).toBeNull();
  });

  it('describe el equipo y el navegador', () => {
    expect(navegador(REDMI)).toMatchObject({ so: 'Android 13', nombre: 'Chrome', marca: 'Xiaomi', modelo: '23028RN4DG' });
    expect(navegador(MIUI)).toMatchObject({ nombre: 'Navegador Mi (Xiaomi)', marca: 'Xiaomi', modelo: 'Redmi Note 10' });
    expect(navegador(SAFARI)).toMatchObject({ so: 'iOS 18.1', nombre: 'Safari', marca: 'Apple' });
  });

  it('arma el enlace que abre la página en Chrome con su dirección completa', () => {
    const e = enlaceChrome('https://obra.axionasoft.com/?lang=es#ar');
    expect(e).toBe('intent://obra.axionasoft.com/?lang=es#ar#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=https%3A%2F%2Fobra.axionasoft.com%2F%3Flang%3Des%23ar;end');
  });

  it('pide la cámara de la forma más exigente a la más simple, y prueba cada cámara trasera', () => {
    const a = intentosCamara();
    expect(a[0].video.facingMode).toEqual({ ideal: 'environment' });
    expect(a.at(-1)).toEqual({ audio: false, video: true });
    const b = intentosCamara(['principal', 'macro']);
    expect(b.map(x => x.video.deviceId?.exact).filter(Boolean)).toEqual(['principal', 'macro']);
  });

  it('explica cada falla de la cámara con qué hacer, según el celular', () => {
    expect(consejoCamara('NotAllowedError', { android: true }).es).toMatch(/Apps › Chrome › Permisos › Cámara/);
    expect(consejoCamara('NotAllowedError', { ios: true }).es).toMatch(/Ajustes › Safari › Cámara/);
    expect(consejoCamara('NotReadableError').es).toMatch(/Otra app está usando la cámara/);
    expect(consejoCamara('', { interno: 'Instagram', android: true }).es).toMatch(/dentro de Instagram.*Chrome/);
    expect(consejoCamara('SinCuadros').en).toMatch(/no image/);
  });

  it('dice qué modos funcionan: sin giroscopio queda la vista fija, sin cámara solo el 3D', () => {
    const base = { camara: { ok: true }, webgl: { ok: true }, trabajador: { ok: false }, detector: { ok: true }, giroscopio: { ok: false }, nativa: { ok: false } };
    expect(veredicto(base)).toEqual({ maqueta: true, lote: true, giro: false, fija: true, nativa: false, vista3d: true });
    expect(veredicto({ ...base, camara: { ok: false } })).toMatchObject({ maqueta: false, giro: false, fija: false, vista3d: true });
    const r = { fecha: 'hoy', ua: REDMI, nav: navegador(REDMI), ...base, segura: { ok: true }, interno: { ok: true }, permiso: { ok: true, estado: 'granted' }, equipo: { memoria: 4, nucleos: 8, pantalla: '393×873 @2.75' } };
    r.camara = { ok: true, ancho: 1280, alto: 720, intento: 2, camaras: 4 };
    r.webgl = { ok: true, version: 2, tarjeta: 'Adreno (TM) 610', textura: 16384 };
    r.veredicto = veredicto(r);
    const t = textoDiagnostico(r);
    expect(t).toMatch(/Xiaomi 23028RN4DG · Android 13 · Chrome/);
    expect(t).toMatch(/✓ Cámara: 1280×720, intento 3, 4 cámaras/);
    expect(t).toMatch(/✗ Giroscopio/);
    expect(t).toMatch(/vista fija ✓/);
  });
});
