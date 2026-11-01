/* ==========================================================================
   AXIONA TOPO · Nivelacion trigonometrica con el celular
   --------------------------------------------------------------------------
   Lo que hace el teodolito: el angulo vertical (alfa, + hacia arriba) entre
   la horizontal y la visual al punto. El celular lo lee con sus sensores de
   inclinacion. Con la camara puesta en la visual:
     - con distancia medida a cinta:   dH = D·tan(alfa) + hi - ht
     - con una mira de largo conocido L (apuntando al pie y a la punta):
           D  = L / (tan(alfa_punta) - tan(alfa_pie))
           dH = hi + D·tan(alfa_pie)
     - altura de un objeto (poste, arbol, muro) a distancia D:
           h  = D·(tan(alfa_punta) - tan(alfa_pie))
   hi = altura del celular sobre el piso donde uno esta parado;
   ht = altura sobre el piso del punto al que se apunta en la mira.
   dH es la cota del piso del punto menos la del piso de la estacion.
   El error crece con la distancia: un error de 0,2° en el angulo a 20 m son
   7 cm de cota. Por eso se dice cuanto puede fallar cada lectura.
   ========================================================================== */

const rad = g => g * Math.PI / 180;
const ERROR_ANGULO = 0.2;

/** Cuanto puede fallar dH por el error del angulo (en metros). */
export const incertidumbre = (D, alfa, err = ERROR_ANGULO) => Math.abs(D) * rad(err) / Math.cos(rad(alfa)) ** 2;

export function conDistancia({ D, alfa, hi = 1.5, ht = 1.5 }) {
  if (!(D > 0) || !Number.isFinite(alfa) || Math.abs(alfa) >= 89) return null;
  return { D, dH: D * Math.tan(rad(alfa)) + hi - ht, error: incertidumbre(D, alfa) };
}

export function conMira({ L, alfaPie, alfaPunta, hi = 1.5 }) {
  if (!(L > 0) || !Number.isFinite(alfaPie) || !Number.isFinite(alfaPunta)) return null;
  const k = Math.tan(rad(alfaPunta)) - Math.tan(rad(alfaPie));
  if (k <= 1e-6) return null;
  const D = L / k;
  // El error de D sale de la diferencia de dos angulos: casi el doble de relativo
  const errD = D * D / L * rad(ERROR_ANGULO) * Math.SQRT2;
  return { D, dH: hi + D * Math.tan(rad(alfaPie)), error: Math.hypot(incertidumbre(D, alfaPie), errD * Math.abs(Math.tan(rad(alfaPie)))), errorD: errD };
}

export function alturaObjeto({ D, alfaPie, alfaPunta }) {
  if (!(D > 0) || !Number.isFinite(alfaPie) || !Number.isFinite(alfaPunta)) return null;
  return { h: D * (Math.tan(rad(alfaPunta)) - Math.tan(rad(alfaPie))), error: Math.SQRT2 * incertidumbre(D, Math.max(Math.abs(alfaPie), Math.abs(alfaPunta))) };
}

/** Angulo de la camara trasera sobre la horizontal, con beta y gamma del
    evento deviceorientation (grados). De pie y derecho da 0°; acostado boca
    arriba, -90° (la camara mira al suelo). */
export function elevacionCamara(beta, gamma) {
  const s = -Math.cos(rad(beta)) * Math.cos(rad(gamma));
  return Math.asin(Math.max(-1, Math.min(1, s))) * 180 / Math.PI;
}

/** Calibracion por inversion, como con un nivel de burbuja: se lee, se gira
    el celular 180° en el mismo sitio y se vuelve a leer. */
export const calibracionPorInversion = (lectura1, lectura2) => ({ cero: (lectura1 + lectura2) / 2, inclinacion: (lectura1 - lectura2) / 2 });

/** Pendiente en %, mm por metro y grados a partir de un angulo. */
export const pendienteDe = grados => ({ pct: 100 * Math.tan(rad(grados)), mmPorM: 1000 * Math.tan(rad(grados)), grados });
