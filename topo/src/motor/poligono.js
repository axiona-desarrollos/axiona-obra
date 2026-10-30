/* ==========================================================================
   AXIONA TOPO · Poligono del lote
   --------------------------------------------------------------------------
   Area por la formula de Gauss (la del agrimensor), lados con azimut y
   rumbo, angulos internos y el lote "a cinta": con los lados y las
   diagonales medidas desde la primera esquina, cada triangulo se arma con
   el corte de dos circulos (ley de cosenos). Asi miden los maestros de obra
   con la cinta, y el celular hace las cuentas.
   ========================================================================== */

export const grados = r => r * 180 / Math.PI;

export function areaFirmada(p) {
  let a = 0;
  for (let i = 0; i < p.length; i++) { const q = p[i], w = p[(i + 1) % p.length]; a += q.x * w.y - w.x * q.y; }
  return a / 2;
}
export const area = p => Math.abs(areaFirmada(p));

export function perimetro(p) {
  let s = 0;
  for (let i = 0; i < p.length; i++) { const a = p[i], b = p[(i + 1) % p.length]; s += Math.hypot(b.x - a.x, b.y - a.y); }
  return s;
}

/** Azimut en grados desde el norte (+y), en el sentido del reloj. */
export const azimut = (dx, dy) => (grados(Math.atan2(dx, dy)) + 360) % 360;

const dos = v => String(v).padStart(2, '0');

/** Grados y minutos (o grados, minutos y segundos): 35°20′ o 35°20′14″. */
export function gms(a, conSegundos = false) {
  let d = Math.floor(a);
  if (!conSegundos) {
    let m = Math.round((a - d) * 60);
    if (m === 60) { d += 1; m = 0; }
    return `${d}°${dos(m)}′`;
  }
  const mf = (a - d) * 60;
  let m = Math.floor(mf), s = Math.round((mf - m) * 60);
  if (s === 60) { s = 0; m += 1; }
  if (m === 60) { m = 0; d += 1; }
  return `${d}°${dos(m)}′${dos(s)}″`;
}

/** Rumbo de cuadrante, como en los planos de topografia: N 35°20′ E. */
export function rumbo(az) {
  const a = ((az % 360) + 360) % 360;
  if (a <= 90) return `N ${gms(a)} E`;
  if (a <= 180) return `S ${gms(180 - a)} E`;
  if (a <= 270) return `S ${gms(a - 180)} W`;
  return `N ${gms(360 - a)} W`;
}

export function lados(p) {
  return p.map((a, i) => {
    const j = (i + 1) % p.length, b = p[j], dx = b.x - a.x, dy = b.y - a.y, az = azimut(dx, dy);
    return { i, j, largo: Math.hypot(dx, dy), azimut: az, rumbo: rumbo(az), dz: (b.z ?? 0) - (a.z ?? 0) };
  });
}

/** Angulo interno en cada vertice, sirva el poligono en un sentido o en el otro. */
export function angulosInternos(p) {
  const s = Math.sign(areaFirmada(p)) || 1;
  return p.map((b, i) => {
    const a = p[(i - 1 + p.length) % p.length], c = p[(i + 1) % p.length];
    const u = { x: a.x - b.x, y: a.y - b.y }, v = { x: c.x - b.x, y: c.y - b.y };
    const ang = grados(Math.atan2(s * (v.x * u.y - v.y * u.x), v.x * u.x + v.y * u.y));
    return (ang + 360) % 360;
  });
}

export function centroide(p) {
  const A = areaFirmada(p);
  if (Math.abs(A) < 1e-9) {
    const n = p.length || 1;
    return { x: p.reduce((s, q) => s + q.x, 0) / n, y: p.reduce((s, q) => s + q.y, 0) / n };
  }
  let cx = 0, cy = 0;
  for (let i = 0; i < p.length; i++) {
    const a = p[i], b = p[(i + 1) % p.length], k = a.x * b.y - b.x * a.y;
    cx += (a.x + b.x) * k; cy += (a.y + b.y) * k;
  }
  return { x: cx / (6 * A), y: cy / (6 * A) };
}

/** ¿Esta (x, y) dentro del poligono? (rayo par-impar) */
export function dentro(x, y, p) {
  let c = false;
  for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
    const a = p[i], b = p[j];
    if (((a.y > y) !== (b.y > y)) && (x < (b.x - a.x) * (y - a.y) / (b.y - a.y) + a.x)) c = !c;
  }
  return c;
}

/** Corte de dos circulos, el que queda a la izquierda de A -> B. */
function cortarCirculos(A, rA, B, rB) {
  const dx = B.x - A.x, dy = B.y - A.y, d = Math.hypot(dx, dy);
  if (d < 1e-9) return null;
  const a = (rA * rA - rB * rB + d * d) / (2 * d), h2 = rA * rA - a * a;
  if (h2 < -1e-6 * Math.max(1, rA * rA)) return null;
  const h = Math.sqrt(Math.max(0, h2));
  return { x: A.x + a * dx / d - h * dy / d, y: A.y + a * dy / d + h * dx / d };
}

/**
 * Lote medido con cinta. Las esquinas se nombran en orden, empezando por la
 * del frente a la izquierda (mirando el lote desde la calle) y siguiendo por
 * el frente hacia la derecha.
 *   lados[i]        = esquina i -> esquina i+1 (el ultimo cierra en la primera)
 *   diagonales[k-2] = esquina 1 -> esquina k, para k = 3 ... n-1 (en abanico)
 *   control         = { i, j, medida } otra distancia para comprobar el cierre
 * Devuelve las esquinas en metros (la primera en 0,0 y el frente sobre el eje x)
 * o un error que dice que medida no cuadra.
 */
export function loteACinta({ lados: L = [], diagonales: D = [], control = null } = {}) {
  const n = L.length;
  if (n < 3) return { error: 'Hacen falta al menos 3 lados.' };
  if (L.some(v => !(v > 0))) return { error: 'Todos los lados deben tener medida.' };
  if (n > 3 && D.length < n - 3) return { error: `Faltan diagonales: un lote de ${n} esquinas necesita ${n - 3}, todas desde la esquina 1.` };
  if (D.slice(0, Math.max(0, n - 3)).some(v => !(v > 0))) return { error: 'Todas las diagonales deben tener medida.' };
  const P = [{ x: 0, y: 0 }, { x: L[0], y: 0 }];
  for (let k = 1; k <= n - 2; k++) {
    const rA = k + 1 <= n - 2 ? D[k - 1] : L[n - 1];
    const q = cortarCirculos(P[0], rA, P[k], L[k]);
    if (!q) {
      const qu = k + 1 <= n - 2 ? `la diagonal 1-${k + 2}` : `el lado ${n}-1`;
      return { error: `Las medidas no cierran en el triángulo de las esquinas 1, ${k + 1} y ${k + 2}: revise el lado ${k + 1}-${k + 2} o ${qu}.` };
    }
    P.push(q);
  }
  const out = { puntos: P.map(p => ({ x: +p.x.toFixed(4), y: +p.y.toFixed(4) })) };
  if (control && control.medida > 0 && P[control.i] && P[control.j]) {
    const calc = Math.hypot(P[control.j].x - P[control.i].x, P[control.j].y - P[control.i].y);
    const dif = calc - control.medida;
    out.cierre = { calculada: calc, medida: control.medida, diferencia: dif, relativa: Math.abs(dif) / control.medida };
  }
  return out;
}
