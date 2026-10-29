/* ==========================================================================
   AXIONA OBRA · Redes electricas e hidrosanitarias (esquematicas)
   --------------------------------------------------------------------------
   Puntos de luz, tomas, interruptores, tablero y detectores por espacio;
   aparatos sanitarios a partir del amoblado, con agua fria y caliente desde
   el medidor y desagues hasta la bajante y la caja de inspeccion. Es un
   esquema para anteproyecto y cantidades: el diseño de redes lo firma el
   ingeniero electrico o hidraulico.
   ========================================================================== */

import { near, r2 } from './geometria.js';

const C = r => ({ x: (r.x0 + r.x1) / 2, y: (r.y0 + r.y1) / 2 });
const HUMEDOS = { inodoro: { f: 1, c: 0, d: 1 }, lavamanos: { f: 1, c: 1, d: 1 }, ducha: { f: 1, c: 1, d: 1 }, tina: { f: 1, c: 1, d: 1 }, lavadora: { f: 1, c: 1, d: 1 }, lavadero: { f: 1, c: 0, d: 1 }, lavaplatos: { f: 1, c: 1, d: 1 } };

/** Punto de conexion de un mueble: el centro de su espalda, contra el muro. */
function espalda(it) {
  const rad = it.rot * Math.PI / 180, bx = Math.sin(rad), by = -Math.cos(rad);
  return { x: r2(it.x + bx * it.d / 2), y: r2(it.y + by * it.d / 2) };
}

/** Ruta en L de a hasta b: primero en y, luego en x (o al reves). */
const enL = (a, b, yPrimero = true) => (yPrimero ? [[a.x, a.y], [a.x, b.y], [b.x, b.y]] : [[a.x, a.y], [b.x, a.y], [b.x, b.y]]);

export function redes(M, muebles, opts = {}) {
  const { R, floors } = M;
  const pais = opts.pais || 'CO';
  const pisos = [];
  const franjaX = M.franja ? (M.franja.x0 + M.franja.x1) / 2 : (R.x0 + R.x1) / 2;
  let nLuz = 0, nToma = 0, nInt = 0, nEsp = 0, nAparatos = 0, nPuntosH = 0, nHumo = 0;

  floors.forEach(fl => {
    const sim = [], lin = [];
    const mueblesPiso = muebles.filter(m => m.f === fl.f);
    fl.rects.forEach(r => {
      const I = { x0: r.x0 + 0.15, x1: r.x1 - 0.15, y0: r.y0 + 0.15, y1: r.y1 - 0.15 };
      const w = r.x1 - r.x0, h = r.y1 - r.y0, A = w * h;
      if (w < 0.6 || h < 0.6) return;
      // luces
      const luces = [];
      if (r.stair || r.asc) {
        if (r.stair) luces.push(C(r));
      } else if (r.hall || r.circ) {
        const n = Math.max(1, Math.round((h > w ? h : w) / 3.2));
        for (let k = 0; k < n; k++) luces.push(h > w ? { x: (r.x0 + r.x1) / 2, y: r.y0 + (k + 0.5) * h / n } : { x: r.x0 + (k + 0.5) * w / n, y: (r.y0 + r.y1) / 2 });
      } else if (A > 17 || (r.tipo === 'cocina' && A > 10)) {
        if (w >= h) luces.push({ x: r.x0 + w * 0.28, y: (r.y0 + r.y1) / 2 }, { x: r.x0 + w * 0.72, y: (r.y0 + r.y1) / 2 });
        else luces.push({ x: (r.x0 + r.x1) / 2, y: r.y0 + h * 0.28 }, { x: (r.x0 + r.x1) / 2, y: r.y0 + h * 0.72 });
      } else luces.push(C(r));
      luces.forEach(p => sim.push({ k: 'luz', x: r2(p.x), y: r2(p.y) }));
      nLuz += luces.length;
      // interruptor junto a la puerta por la que se entra
      const puerta = fl.ops.find(o => (o.kind === 'door' || o.kind === 'main') && o.room === r.name);
      if (puerta && luces.length && !r.stair) {
        const t = puerta.b + 0.18;
        const lado = puerta.o === 'H' ? (near(puerta.c, r.y0) ? 1 : -1) : (near(puerta.c, r.x0) ? 1 : -1);
        const s = puerta.o === 'H' ? { x: Math.min(t, r.x1 - 0.2), y: puerta.c + lado * 0.14 } : { x: puerta.c + lado * 0.14, y: Math.min(t, r.y1 - 0.2) };
        sim.push({ k: 'int', x: r2(s.x), y: r2(s.y), n: luces.length > 1 ? 2 : 1 });
        nInt++;
        luces.forEach(p => lin.push({ k: 'circuito', pts: [[s.x, s.y], [p.x, p.y]], curva: true }));
      }
      if (r.circ) {
        if (r.hall) { sim.push({ k: 'humo', x: r2(C(r).x), y: r2(r.y0 + Math.min(h, 2.2) / 2) }); nHumo++; }
        return;
      }
      // tomas por el perimetro, sin caer en las puertas
      const paso = r.tipo === 'local' ? 2.6 : 3.2;
      const lados = [
        { a: [I.x0, I.y0], b: [I.x1, I.y0], o: 'H', c: r.y0, n: [0, 1] }, { a: [I.x1, I.y0], b: [I.x1, I.y1], o: 'V', c: r.x1, n: [-1, 0] },
        { a: [I.x1, I.y1], b: [I.x0, I.y1], o: 'H', c: r.y1, n: [0, -1] }, { a: [I.x0, I.y1], b: [I.x0, I.y0], o: 'V', c: r.x0, n: [1, 0] },
      ];
      const perim = 2 * (w + h);
      const nT = r.tipo === 'banoS' || r.tipo === 'bano' || r.tipo === 'banoP' ? 0 : Math.max(2, Math.round(perim / paso));
      let puestas = 0, acum = perim / nT / 2;
      for (const L of lados) {
        const len = Math.hypot(L.b[0] - L.a[0], L.b[1] - L.a[1]);
        while (acum < len && puestas < nT) {
          const f = acum / len, x = L.a[0] + (L.b[0] - L.a[0]) * f, y = L.a[1] + (L.b[1] - L.a[1]) * f;
          const choca = fl.ops.some(o => o.kind !== 'win' && o.o === L.o && near(o.c, L.c) && (L.o === 'H' ? x > o.a - 0.15 && x < o.b + 0.15 : y > o.a - 0.15 && y < o.b + 0.15));
          if (!choca) { sim.push({ k: 'toma', x: r2(x), y: r2(y), rot: Math.atan2(L.n[1], L.n[0]) }); puestas++; nToma++; }
          acum += perim / nT;
        }
        acum -= len;
      }
      // humo en alcobas (exigido en Canada; recomendado en los demas)
      if (/alcoba/.test(r.tipo || '') && (pais === 'CA' || opts.humoAlcobas)) { sim.push({ k: 'humo', x: r2(C(r).x + 0.6), y: r2(C(r).y + 0.4) }); nHumo++; }
    });
    // tomas especiales: mesones de cocina, baños, lavadora, estufa y nevera
    mueblesPiso.forEach(m => {
      if (m.tipo === 'cocinaBase') {
        const n = Math.max(1, Math.floor(m.w / 1.2));
        for (let k = 0; k < n; k++) {
          const t = (k + 0.5) / n - 0.5, rad = m.rot * Math.PI / 180;
          const ux = Math.cos(rad), uy = Math.sin(rad), e = espalda(m);
          sim.push({ k: 'tomaGFCI', x: r2(e.x + ux * t * m.w), y: r2(e.y + uy * t * m.w) });
          nToma++;
        }
      }
      if (m.tipo === 'lavamanos') { const e = espalda(m); sim.push({ k: 'tomaGFCI', x: r2(e.x + 0.35), y: r2(e.y) }); nToma++; }
      if (m.tipo === 'lavadora' || m.tipo === 'secadora' || m.tipo === 'estufa' || m.tipo === 'nevera') { const e = espalda(m); sim.push({ k: 'especial', x: e.x, y: e.y }); nEsp++; }
    });
    // tablero en el hall del primer piso
    if (fl.f === 0) {
      const hall = fl.rects.find(r => r.hall);
      if (hall) sim.push({ k: 'tablero', x: r2(hall.x0 + 0.25), y: r2(hall.y0 + 0.6) });
    }

    // ---------------- hidrosanitario
    const aparatos = [];
    mueblesPiso.forEach(m => {
      if (m.tipo === 'cocinaBase' && m.lav !== undefined) {
        const rad = m.rot * Math.PI / 180, ux = Math.cos(rad), uy = Math.sin(rad), e = espalda(m);
        const t = m.lav - m.w / 2;
        aparatos.push({ tipo: 'lavaplatos', ...HUMEDOS.lavaplatos, x: r2(e.x + ux * t), y: r2(e.y + uy * t), room: m.room });
      } else if (HUMEDOS[m.tipo]) {
        const e = m.tipo === 'ducha' ? { x: m.x, y: m.y } : espalda(m);
        aparatos.push({ tipo: m.tipo, ...HUMEDOS[m.tipo], x: e.x, y: e.y, room: m.room });
      }
    });
    nAparatos += aparatos.length;
    aparatos.forEach(a => { nPuntosH += a.f + a.c + a.d; sim.push({ k: 'aparato', x: a.x, y: a.y, t: a.tipo }); });
    // bajante por espacio humedo, en la esquina interior mas cercana a sus aparatos
    const porEspacio = {};
    aparatos.forEach(a => { (porEspacio[a.room] ||= []).push(a); });
    const bajantes = [];
    Object.entries(porEspacio).forEach(([room, as]) => {
      const r = fl.rects.find(x => x.name === room);
      if (!r) return;
      const cx = as.reduce((t, a) => t + a.x, 0) / as.length, cy = as.reduce((t, a) => t + a.y, 0) / as.length;
      const esq = [[r.x0 + 0.18, r.y0 + 0.18], [r.x1 - 0.18, r.y0 + 0.18], [r.x0 + 0.18, r.y1 - 0.18], [r.x1 - 0.18, r.y1 - 0.18]]
        .sort((p, q) => Math.hypot(p[0] - cx, p[1] - cy) - Math.hypot(q[0] - cx, q[1] - cy))[0];
      const b = { x: r2(esq[0]), y: r2(esq[1]) };
      bajantes.push(b);
      sim.push({ k: 'bajante', x: b.x, y: b.y });
      as.forEach(a => lin.push({ k: 'desague', pts: enL(a, b, false) }));
    });
    // agua: medidor al frente (piso 1) o columna junto a la escalera (pisos altos)
    const hall = fl.rects.find(r => r.hall) || fl.rects[0];
    const entrada = fl.f === 0 ? { x: r2(franjaX), y: r2(R.y0 - 0.6) } : { x: r2(franjaX), y: r2(hall.y0 + 0.4) };
    sim.push({ k: fl.f === 0 ? 'medidor' : 'columna', x: entrada.x, y: entrada.y });
    aparatos.forEach(a => {
      lin.push({ k: 'fria', pts: enL(entrada, a, true) });
      if (a.c) lin.push({ k: 'caliente', pts: enL({ x: entrada.x + 0.12, y: entrada.y }, { x: a.x + 0.08, y: a.y + 0.08 }, true) });
    });
    if (fl.f === 0) {
      const caja = { x: r2(franjaX + 0.8), y: r2(R.y0 - 1.1) };
      sim.push({ k: 'caja', x: caja.x, y: caja.y });
      bajantes.forEach(b => lin.push({ k: 'desague', pts: enL(b, caja, false), colector: true }));
      // las bajantes de los pisos de arriba bajan hasta la caja por el primer piso
      M.techo?.bajantes?.forEach(([x, y]) => { sim.push({ k: 'lluvia', x: r2(x), y: r2(y) }); lin.push({ k: 'lluvia', pts: enL({ x, y }, { x: caja.x - 0.4, y: caja.y }, false) }); });
    }
    pisos.push({ f: fl.f, sim, lin, bajantes });
  });
  return { pisos, puntos: { luz: nLuz, toma: nToma, int: nInt, esp: nEsp, humo: nHumo, elec: nLuz + nToma + nInt + nEsp, aparatos: nAparatos, hidro: nPuntosH } };
}
