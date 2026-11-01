import { describe, it, expect } from 'vitest';
import { enlaceSistema, htmlSistema, EJEMPLO_SISTEMA } from '../src/ui/sistema.js';
import { numeroWhatsApp, enlaceWhatsApp } from '../src/asistente/contacto.js';
import { evento, analiticaActiva } from '../src/ui/analitica.js';
import { setIdioma } from '../src/motor/index.js';

describe('«¿Tu empresa construye algo distinto?»', () => {
  it('toda la asesoría va al WhatsApp 310 392 2935, en cualquier país', () => {
    for (const p of ['CO', 'ES', 'CA', 'MX', undefined]) expect(numeroWhatsApp(p)).toBe('573103922935');
  });

  it('arma el enlace de WhatsApp con el mensaje escrito en el idioma de la app', () => {
    const es = enlaceSistema('CO', 'es');
    expect(es.startsWith('https://wa.me/573103922935?text=')).toBe(true);
    expect(decodeURIComponent(es.split('text=')[1])).toContain('Quiero mi propio sistema integrado');
    const en = enlaceSistema('ES', 'en');
    expect(en).toContain('wa.me/573103922935');
    expect(decodeURIComponent(en.split('text=')[1])).toContain('my own integrated system');
    expect(enlaceWhatsApp('hola & adiós')).toContain(encodeURIComponent('hola & adiós'));
  });

  it('la tarjeta trae el botón de WhatsApp y el ejemplo del glamping, en los dos idiomas', () => {
    setIdioma('es');
    const es = htmlSistema('CO', 'es');
    expect(es).toContain('Quiero mi sistema');
    expect(es).toContain('a la medida de tu constructora');
    expect(es).toContain(EJEMPLO_SISTEMA);
    expect(es).toContain('data-evento="sistema-whatsapp"');
    setIdioma('en');
    expect(htmlSistema('CA', 'en')).toContain('I want my system');
    setIdioma('es');
  });
});

describe('contador de uso', () => {
  it('queda apagado sin VITE_UMAMI_ID y registrar un evento nunca falla', () => {
    expect(analiticaActiva()).toBe(false);
    expect(() => evento('pestana', { tab: 'modelo' })).not.toThrow();
  });
});
