/* ==========================================================================
   AXIONA OBRA · Lo que Axi sabe de la app
   --------------------------------------------------------------------------
   Respuestas a las dudas frecuentes. Las usa el cerebro local (por palabras
   clave) y van completas en las instrucciones del modelo de lenguaje cuando
   el usuario lo activa. Solo hechos de la app: si algo no existe todavía, se
   dice así.
   ========================================================================== */

export const TOPO_URL = 'https://axiona-topo.netlify.app';

/** Preguntas frecuentes: claves (sin tildes, en minúscula) y respuesta. */
export const FAQ = [
  {
    id: 'que', claves: ['que es axiona', 'que es esto', 'que hace la app', 'para que sirve', 'que es obra'],
    r: 'Axiona Obra diseña tu casa o edificio desde el lote: distribuye los espacios, saca el juego de planos en PDF, el modelo 3D amoblado, las cantidades, el presupuesto, los trámites y la realidad aumentada. Funciona en el navegador, gratis, para Colombia, España, Canadá y México.',
  },
  {
    id: 'gratis', claves: ['es gratis', 'cuanto vale la app', 'cuanto cuesta la app', 'precio de la app', 'hay que pagar', 'cobran'],
    r: 'La app es gratis y de código abierto. Si quieres que Axiona te acompañe con los diseños firmados, la licencia o la obra, eso sí es un servicio aparte: escríbenos desde «Hablar con una persona».',
  },
  {
    id: 'editar', claves: ['como edito', 'como editar', 'puedo editar', 'editar', 'modificar', 'cambiar la distribucion', 'mover muros', 'mover un muro', 'mi propio diseno', 'a mi gusto', 'personalizar', 'solo trae disenos', 'solo salen disenos', 'disenos ya hechos'],
    r: 'Todo se puede cambiar. Dímelo con palabras, por ejemplo «agrega una alcoba de 12 m² en el segundo piso», «pon 3 pisos» o «porcelanato en toda la casa». También puedes tocar un espacio en el plano (pestaña Planos) y cambiarle el nombre, el área o el piso. Y en Programa tienes la lista completa de espacios. El motor vuelve a distribuir, saca muros, puertas, ventanas, escalera y redes, y recalcula el presupuesto al instante.',
  },
  {
    id: 'revit', claves: ['revit', 'archicad', 'autocad', 'sketchup', 'diferencia con', 'mejor que', 'bim'],
    r: 'Revit es para dibujar todo a mano y exige meses de curso y una licencia costosa. Axiona Obra hace el trabajo de mesa por ti: tú dices qué espacios quieres y en segundos tienes planos, 3D amoblado, presupuesto con precios del país, trámites y realidad aumentada, desde el celular y gratis. Además exporta DXF para seguir en AutoCAD o Revit si lo necesitas.',
  },
  {
    id: 'materiales', claves: ['ladrillo', 'texturas', 'materiales reales', 'porcelanato real', 'se ve real', 'realista', 'render'],
    r: 'El 3D tiene ladrillo, concreto, pañete, porcelanato, mármol, madera, piedra y teja, con luz y sombras. En el Modelo 3D cambia la fase: «obra negra» muestra el ladrillo y la estructura, «obra gris» el pañete, «obra blanca» los acabados y «amoblada» los muebles. Si quieres te la muestro: di «muéstrame los ladrillos».',
  },
  {
    id: 'normas', claves: ['licencia', 'quien firma', 'firmar', 'curaduria', 'norma', 'nsr', 'legal', 'es valido', 'sirve para la licencia'],
    r: 'Axiona Obra hace el anteproyecto con las normas de cada país (NSR-10 en Colombia). Para la licencia, los planos los revisan y firman profesionales con matrícula: arquitecto, ingeniero estructural y geotecnista. En la pestaña Proyecto pones sus nombres y matrículas, y salen en el rótulo de cada lámina.',
  },
  {
    id: 'suelos', claves: ['estudio de suelos', 'suelo', 'geotecn'],
    r: 'El estudio de suelos lo hace un laboratorio con perforaciones y es obligatorio para la licencia. Ni Axiona Obra ni Axiona Topo lo reemplazan. Cuando lo tengas, adjúntalo en Proyecto: la app lee la capacidad portante y el desplante.',
  },
  {
    id: 'topo', claves: ['topo', 'medir el lote', 'medir el terreno', 'levantamiento', 'topografia', 'curvas de nivel'],
    r: 'Para medir el lote usa Axiona Topo, el topógrafo en el celular: mide con GPS, cinta o cámara, saca curvas de nivel, pendiente y tierra a mover, y te manda el lote directo a Axiona Obra.',
  },
  {
    id: 'paises', claves: ['paises', 'que paises', 'funciona en', 'otro pais', 'peru', 'chile', 'argentina', 'ecuador', 'estados unidos'],
    r: 'Hoy tiene normas, trámites y precios de Colombia, España, Canadá y México. Puedes diseñar para cualquier lugar, pero los trámites y precios son los de esos cuatro países. Pronto vienen más.',
  },
  {
    id: 'otras', claves: ['puente', 'puentes', 'vias', 'carretera', 'via ', 'moldes', 'formaleta', 'industrial', 'bodega grande'],
    r: 'Hoy Axiona Obra diseña edificaciones: casas, edificios, locales, conjuntos y condominios. Puentes, vías y obras civiles son otra disciplina y vienen en el plan de Axiona; para el terreno de cualquier obra ya puedes usar Axiona Topo. Cuéntanos tu caso en «Hablar con una persona».',
  },
  {
    id: 'exportar', claves: ['formatos', 'exportar', 'descargar', 'que archivos'],
    r: 'Puedes descargar el juego de planos en PDF, los planos en DXF (AutoCAD), el modelo 3D en GLB y USDZ (iPhone), el presupuesto en CSV (Excel) y el proyecto completo en JSON. Dime «descarga el PDF» y lo genero.',
  },
  {
    id: 'datos', claves: ['mis datos', 'privacidad', 'se guarda', 'donde se guarda', 'nube'],
    r: 'Tu proyecto se guarda en tu propio navegador: no sube a ningún servidor. Para pasarlo a otro equipo usa «Compartir» o descarga el proyecto en JSON.',
  },
  {
    id: 'instalar', claves: ['instalar', 'descargar la app', 'app en el celular', 'play store'],
    r: 'Axiona Obra se instala desde el navegador: en Chrome toca «Instalar app» arriba, o el menú ⋮ y «Agregar a la pantalla principal». Queda como una app y funciona sin internet.',
  },
  {
    id: 'axiona', claves: ['quien hizo', 'quienes son', 'axiona desarrollos', 'santiago', 'empresa'],
    r: 'Axiona Obra la hace Axiona Desarrollos Inteligentes, de Sabaneta (Antioquia), con agentes de inteligencia artificial. El código es abierto y puedes verlo en GitHub.',
  },
  {
    id: 'cursos', claves: ['curso', 'cursos', 'aprender', 'youtube', 'canal'],
    r: 'Muy pronto, en el canal de YouTube de Axiona, salen cursos para pasar del código a proyectos reales: repositorios, Git, Node, actualizaciones, políticas y secretos, Zapier y Databricks. Síguenos en Instagram: @axionadesarrollos.',
  },
  {
    id: 'formas', claves: ['cubo', 'cubos', 'organic', 'curva', 'curvas', 'formas libres', 'forma libre', 'compleja', 'complejas', 'irregular', 'diseno libre', 'parametric'],
    r: 'Hoy el motor arma edificaciones ortogonales: plantas rectangulares por piso, que son la mayoría de las casas y edificios que se construyen. Las formas orgánicas (curvas, plantas en L o en U, patios y pisos escalonados con terrazas) son el siguiente gran paso de Axiona Obra. Mientras tanto, cambia la cubierta, los pisos, los espacios y los acabados, y exporta el DXF o el GLB para seguir en Rhino, Revit o SketchUp.',
  },
  {
    id: 'acero', claves: ['estructura metalica', 'acero', 'steel', 'metalica'],
    r: 'Hoy Axiona Obra calcula en pórticos de concreto o mampostería confinada en Colombia, concreto en España y México, y madera en Canadá. La estructura metálica está en desarrollo; mientras tanto, Axiona la puede trabajar contigo como servicio.',
  },
];

/** Lo que Axi sabe hacer, para la ayuda y las instrucciones del modelo. */
export const CAPACIDADES = [
  'Ir a una pestaña: «muéstrame los planos», «abre el 3D», «ver el presupuesto».',
  'Cambiar los pisos: «pon 3 pisos».',
  'Agregar espacios: «agrega una alcoba de 12 m² en el segundo piso», «agrega dos baños».',
  'Quitar, agrandar, achicar o pasar de piso un espacio: «quita el estudio», «agranda la sala a 25 m²», «pasa el estudio al piso 2».',
  'Acabados: «porcelanato en toda la casa», «madera en la alcoba principal», «estilo moderno».',
  'Cubierta y sistema: «techo a dos aguas», «mampostería confinada».',
  'Lote: «lote de 10 por 20».',
  'Ver el 3D por fases: «muéstrame los ladrillos», «la casa terminada», «recorrer la casa».',
  'Descargar: «descarga el PDF», «DXF», «presupuesto en Excel».',
  'Datos: «cuánto cuesta», «cuántos metros», «qué espacios hay», «hay algún problema».',
  'Empezar de cero o cargar un ejemplo: «empezar de cero», «ver ejemplos».',
  'Hablar con una persona de Axiona o dejar una reseña o propuesta.',
];
