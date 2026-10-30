// Prueba de punta a punta de la sesion en vivo contra ntfy.sh (necesita red).
// node --experimental-eventsource tests/envivo.e2e.mjs
import { nuevaSesion, conectarSesion } from '../src/captura/envivo.js';
import { normalizar } from '../src/motor/levantamiento.js';

const s = nuevaSesion();
const L = normalizar({ nombre: 'Prueba en vivo', puntos: [{ x: 0, y: 0, z: 0 }, { x: 12, y: 0, z: 0.4 }, { x: 12, y: 20, z: 1.8 }, { x: 0, y: 20, z: 1.1 }] });
const recibido = new Promise((ok, falla) => {
  const B = conectarSesion(s, { alRecibir: (l, eq, t) => { ok({ l, eq, t }); B.cerrar(); }, alEstado: e => console.log('B:', e) });
  setTimeout(() => falla(new Error('no llego nada en 20 s')), 20000);
});
const A = conectarSesion(s, { alRecibir: () => {}, alEstado: e => console.log('A:', e) });
setTimeout(() => A.enviar(L, Date.now()).then(() => console.log('A envio')).catch(e => console.log('A error', e.message)), 2500);
try {
  const r = await recibido;
  console.log('B recibio:', r.l.nombre, r.l.puntos.length, 'puntos, desde', r.eq);
  process.exitCode = r.l.puntos.length === 4 && r.l.nombre === 'Prueba en vivo' ? 0 : 1;
} catch (e) { console.log('FALLO', e.message); process.exitCode = 1; }
A.cerrar();
setTimeout(() => process.exit(), 200);
