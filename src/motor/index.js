// Motor de Axiona Obra: todo lo que no toca el DOM. Se prueba en Node.
export { buildModel, ladoColumna, pickAxes } from './modelo.js';
export { FORMAS, huellaPiso } from './distribucion.js';
export { DEFAULT_STATE, PLANTILLAS, ejemploInicial, PRECIOS, SOILS, ZONAS, clonar, normalizarEstado, datosDePais } from './estado.js';
export { CATEGORIAS, CATS, nombreCategoria, totales, precioDe, pisoDe } from './cantidades.js';
export { UBICACIONES, ACCESOS, PROVINCIAS_CA, LUGAR, detectarLugar, lugarDe, preciosLugar, referenciaLugar, ciudadesDe } from './ubicacion.js';
export { vecindario } from './vecindario.js';
export { contours } from './cronograma.js';
export { r2, dms, near, rectMinus } from './geometria.js';
export { PAISES, PAIS_IDS, PASOS, NORMAS, PAPELES, SISTEMAS, CUBIERTAS, PRECIOS_PAIS, pais, nombreSistema, usaTm2 } from './paises.js';
export { ENTIDADES, ZONAS_MX, FSR_BASE, fsr, analizarMexico, piezasAgua } from './mexico.js';
export { PISOS, ENCHAPES, ESTILOS, MUEBLES, TIPOS_ESPACIO, FACHADAS, TEJAS, PISCINA, CIELOS, tipoEspacio, enchapeDe, pisoExtDe } from './catalogo.js';
export { AGREGABLES, medidasDe } from './mobiliario.js';
export { PLAYA } from './exterior.js';
export { DOMOTICA, domoticaDePais, domoticaPorDefecto } from './domotica.js';
export { cubierta } from './cubierta.js';
export { setIdioma, idioma, tr, IDIOMAS } from './idioma.js';
export { traducirEspacios, traducirNombre, renombrarClaves } from './nombres.js';
