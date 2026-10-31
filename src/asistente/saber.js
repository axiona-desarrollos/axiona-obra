/* ==========================================================================
   AXIONA OBRA · Lo que Axi sabe de la app
   --------------------------------------------------------------------------
   Respuestas a las dudas frecuentes. Las usa el cerebro local (por palabras
   clave) y van completas en las instrucciones del modelo de lenguaje cuando
   el usuario lo activa. Solo hechos de la app: si algo no existe todavía, se
   dice así. Cada respuesta va en {es, en}; claves en español y clavesEn en
   inglés (sin tildes, en minúscula).
   ========================================================================== */

export const TOPO_URL = 'https://axiona-topo.netlify.app';

/** Preguntas frecuentes: claves, clavesEn y respuesta {es, en}. */
export const FAQ = [
  {
    id: 'que', claves: ['que es axiona', 'que es esto', 'que hace la app', 'para que sirve', 'que es obra'],
    clavesEn: ['what is axiona', 'what is this', 'what does the app do', 'what is it for', 'what is obra'],
    r: {
      es: 'Axiona Obra diseña tu casa o edificio desde el lote: distribuye los espacios, saca el juego de planos en PDF, el modelo 3D amoblado, las cantidades, el presupuesto, los trámites y la realidad aumentada. Funciona en el navegador, gratis, para Colombia, España, Canadá y México.',
      en: 'Axiona Obra designs your house or building from the lot: it lays out the rooms and produces the PDF drawing set, the furnished 3D model, quantities, the budget, permits and augmented reality. It runs in the browser, for free, for Colombia, Spain, Canada and Mexico.',
    },
  },
  {
    id: 'gratis', claves: ['es gratis', 'cuanto vale la app', 'cuanto cuesta la app', 'precio de la app', 'hay que pagar', 'cobran'],
    clavesEn: ['is it free', 'free', 'how much is the app', 'do i have to pay', 'price of the app', 'cost of the app'],
    r: {
      es: 'La app es gratis y de código abierto. Si quieres que Axiona te acompañe con los diseños firmados, la licencia o la obra, eso sí es un servicio aparte: escríbenos desde «Hablar con una persona».',
      en: 'The app is free and open source. If you want Axiona to help you with signed drawings, the permit or the construction, that is a separate service: write to us from «Talk to a person».',
    },
  },
  {
    id: 'editar', claves: ['como edito', 'como editar', 'puedo editar', 'editar', 'modificar', 'cambiar la distribucion', 'mover muros', 'mover un muro', 'mi propio diseno', 'a mi gusto', 'personalizar', 'solo trae disenos', 'solo salen disenos', 'disenos ya hechos'],
    clavesEn: ['how do i edit', 'can i edit', 'edit', 'modify', 'change the layout', 'move walls', 'move a wall', 'my own design', 'customize', 'only templates', 'ready made designs'],
    r: {
      es: 'Todo se puede cambiar. Dímelo con palabras, por ejemplo «agrega una alcoba de 12 m² en el segundo piso», «pon 3 pisos» o «porcelanato en toda la casa». También puedes tocar un espacio en el plano (pestaña Planos) y cambiarle el nombre, el área o el piso. Y en Programa tienes la lista completa de espacios. El motor vuelve a distribuir, saca muros, puertas, ventanas, escalera y redes, y recalcula el presupuesto al instante.',
      en: 'Everything can be changed. Just tell me, for example «add a 12 m² bedroom on the second floor», «set 3 floors» or «porcelain tile in the whole house». You can also tap a room on the plan (Drawings tab) and change its name, area or floor. The Program tab has the full list of rooms. The engine lays everything out again, places walls, doors, windows, stairs and services, and recalculates the budget instantly.',
    },
  },
  {
    id: 'revit', claves: ['revit', 'archicad', 'autocad', 'sketchup', 'diferencia con', 'mejor que', 'bim'],
    clavesEn: ['revit', 'archicad', 'autocad', 'sketchup', 'difference with', 'better than', 'bim'],
    r: {
      es: 'Revit es para dibujar todo a mano y exige meses de curso y una licencia costosa. Axiona Obra hace el trabajo de mesa por ti: tú dices qué espacios quieres y en segundos tienes planos, 3D amoblado, presupuesto con precios del país, trámites y realidad aumentada, desde el celular y gratis. Además exporta DXF para seguir en AutoCAD o Revit si lo necesitas.',
      en: 'Revit is for drawing everything by hand and takes months of training and an expensive license. Axiona Obra does the drafting for you: you say which rooms you want and in seconds you get drawings, a furnished 3D model, a budget with local prices, permits and augmented reality, from your phone and for free. It also exports DXF so you can continue in AutoCAD or Revit if you need to.',
    },
  },
  {
    id: 'materiales', claves: ['ladrillo', 'texturas', 'materiales reales', 'porcelanato real', 'se ve real', 'realista', 'render'],
    clavesEn: ['brick', 'textures', 'real materials', 'looks real', 'realistic', 'render'],
    r: {
      es: 'El 3D tiene ladrillo, concreto, pañete, porcelanato, mármol, madera, piedra y teja, con luz y sombras. En el Modelo 3D cambia la fase: «obra negra» muestra el ladrillo y la estructura, «obra gris» el pañete, «obra blanca» los acabados y «amoblada» los muebles. Si quieres te la muestro: di «muéstrame los ladrillos».',
      en: 'The 3D model has brick, concrete, plaster, porcelain tile, marble, wood, stone and roof tile, with light and shadows. In the 3D Model, change the phase: «shell» shows the brick and structure, «plastered» the plaster, «finished» the finishes and «furnished» the furniture. I can show you: say «show me the bricks».',
    },
  },
  {
    id: 'normas', claves: ['licencia', 'quien firma', 'firmar', 'curaduria', 'norma', 'nsr', 'legal', 'es valido', 'sirve para la licencia'],
    clavesEn: ['permit', 'license', 'who signs', 'sign the drawings', 'building code', 'code', 'legal', 'is it valid'],
    r: {
      es: 'Axiona Obra hace el anteproyecto con las normas de cada país (NSR-10 en Colombia). Para la licencia, los planos los revisan y firman profesionales con matrícula: arquitecto, ingeniero estructural y geotecnista. En la pestaña Proyecto pones sus nombres y matrículas, y salen en el rótulo de cada lámina.',
      en: 'Axiona Obra produces the schematic design following each country\'s codes (NSR-10 in Colombia, NBC in Canada). For the permit, the drawings are reviewed and signed by licensed professionals: architect, structural engineer and geotechnical engineer. In the Project tab you enter their names and license numbers, and they appear in the title block of every sheet.',
    },
  },
  {
    id: 'suelos', claves: ['estudio de suelos', 'suelo', 'geotecn'],
    clavesEn: ['soil study', 'soil report', 'soil', 'geotechn'],
    r: {
      es: 'El estudio de suelos lo hace un laboratorio con perforaciones y es obligatorio para la licencia. Ni Axiona Obra ni Axiona Topo lo reemplazan. Cuando lo tengas, adjúntalo en Proyecto: la app lee la capacidad portante y el desplante.',
      en: 'The soil study is done by a laboratory with boreholes and is required for the permit. Neither Axiona Obra nor Axiona Topo replaces it. When you have it, attach it in Project: the app reads the bearing capacity and foundation depth.',
    },
  },
  {
    id: 'topo', claves: ['topo', 'medir el lote', 'medir el terreno', 'levantamiento', 'topografia', 'curvas de nivel'],
    clavesEn: ['topo', 'measure the lot', 'measure the land', 'survey', 'topography', 'contour lines'],
    r: {
      es: 'Para medir el lote usa Axiona Topo, el topógrafo en el celular: mide con GPS, cinta o cámara, saca curvas de nivel, pendiente y tierra a mover, y te manda el lote directo a Axiona Obra.',
      en: 'To measure the lot use Axiona Topo, the surveyor on your phone: it measures with GPS, tape or camera, produces contour lines, slope and earthwork, and sends the lot straight to Axiona Obra.',
    },
  },
  {
    id: 'paises', claves: ['paises', 'que paises', 'funciona en', 'otro pais', 'peru', 'chile', 'argentina', 'ecuador', 'estados unidos'],
    clavesEn: ['countries', 'which countries', 'does it work in', 'another country', 'united states', 'usa'],
    r: {
      es: 'Hoy tiene normas, trámites y precios de Colombia, España, Canadá y México. Puedes diseñar para cualquier lugar, pero los trámites y precios son los de esos cuatro países. Pronto vienen más.',
      en: 'Today it has codes, permits and prices for Colombia, Spain, Canada and Mexico. You can design for any place, but permits and prices are those of these four countries. More are coming soon.',
    },
  },
  {
    id: 'idiomas', claves: ['idioma', 'idiomas', 'ingles', 'en ingles', 'portugues', 'frances', 'otro idioma'],
    clavesEn: ['language', 'languages', 'english', 'spanish', 'portuguese', 'french', 'another language'],
    r: {
      es: 'La app y yo funcionamos en español y en inglés: escoges el idioma al entrar y lo cambias cuando quieras arriba (ES / EN), o me dices «en inglés». Portugués y francés vienen pronto.',
      en: 'The app and I work in English and Spanish: you choose the language when you open it and you can change it any time at the top (ES / EN), or tell me «in Spanish». Portuguese and French are coming soon.',
    },
  },
  {
    id: 'otras', claves: ['puente', 'puentes', 'vias', 'carretera', 'via ', 'moldes', 'formaleta', 'industrial', 'bodega grande'],
    clavesEn: ['bridge', 'bridges', 'roads', 'highway', 'formwork', 'industrial', 'warehouse'],
    r: {
      es: 'Hoy Axiona Obra diseña edificaciones: casas, edificios, locales, conjuntos y condominios. Puentes, vías y obras civiles son otra disciplina y vienen en el plan de Axiona; para el terreno de cualquier obra ya puedes usar Axiona Topo. Cuéntanos tu caso en «Hablar con una persona».',
      en: 'Today Axiona Obra designs buildings: houses, apartment buildings, stores and housing developments. Bridges, roads and civil works are another discipline and are on Axiona\'s roadmap; for the land of any project you can already use Axiona Topo. Tell us your case in «Talk to a person».',
    },
  },
  {
    id: 'exportar', claves: ['formatos', 'exportar', 'descargar', 'que archivos'],
    clavesEn: ['formats', 'export', 'download', 'which files', 'file types'],
    r: {
      es: 'Puedes descargar el juego de planos en PDF, los planos en DXF (AutoCAD), el modelo 3D en GLB y USDZ (iPhone), el presupuesto en CSV (Excel) y el proyecto completo en JSON. Dime «descarga el PDF» y lo genero.',
      en: 'You can download the drawing set as PDF, the drawings as DXF (AutoCAD), the 3D model as GLB and USDZ (iPhone), the budget as CSV (Excel) and the full project as JSON. Say «download the PDF» and I will generate it.',
    },
  },
  {
    id: 'datos', claves: ['mis datos', 'privacidad', 'se guarda', 'donde se guarda', 'nube'],
    clavesEn: ['my data', 'privacy', 'is it saved', 'where is it saved', 'cloud'],
    r: {
      es: 'Tu proyecto se guarda en tu propio navegador: no sube a ningún servidor. Para pasarlo a otro equipo usa «Compartir» o descarga el proyecto en JSON.',
      en: 'Your project is saved in your own browser: it is not uploaded to any server. To move it to another device use «Share» or download the project as JSON.',
    },
  },
  {
    id: 'instalar', claves: ['instalar', 'descargar la app', 'app en el celular', 'play store'],
    clavesEn: ['install', 'download the app', 'app on my phone', 'play store', 'app store'],
    r: {
      es: 'Axiona Obra se instala desde el navegador: en Chrome toca «Instalar app» arriba, o el menú ⋮ y «Agregar a la pantalla principal». Queda como una app y funciona sin internet.',
      en: 'Axiona Obra installs from the browser: in Chrome tap «Install app» at the top, or the ⋮ menu and «Add to Home screen». It works like an app and runs offline.',
    },
  },
  {
    id: 'axiona', claves: ['quien hizo', 'quienes son', 'axiona desarrollos', 'santiago', 'empresa'],
    clavesEn: ['who made', 'who built', 'who are you', 'axiona desarrollos', 'company'],
    r: {
      es: 'Axiona Obra la hace Axiona Desarrollos Inteligentes, de Sabaneta (Antioquia), con agentes de inteligencia artificial. El código es abierto y puedes verlo en GitHub.',
      en: 'Axiona Obra is made by Axiona Desarrollos Inteligentes, from Sabaneta (Antioquia, Colombia), with artificial intelligence agents. The code is open source and you can see it on GitHub.',
    },
  },
  {
    id: 'cursos', claves: ['curso', 'cursos', 'aprender', 'youtube', 'canal'],
    clavesEn: ['course', 'courses', 'learn', 'youtube', 'channel', 'tutorial'],
    r: {
      es: 'Muy pronto, en el canal de YouTube de Axiona, salen cursos para pasar del código a proyectos reales: repositorios, Git, Node, actualizaciones, políticas y secretos, Zapier y Databricks. Síguenos en Instagram: @axionadesarrollos.',
      en: 'Very soon, on Axiona\'s YouTube channel, there will be courses to go from code to real projects: repositories, Git, Node, updates, policies and secrets, Zapier and Databricks. Follow us on Instagram: @axionadesarrollos.',
    },
  },
  {
    id: 'formas', claves: ['cubo', 'cubos', 'caja', 'organic', 'curva', 'curvas', 'formas libres', 'forma libre', 'compleja', 'complejas', 'irregular', 'diseno libre', 'parametric', 'forma del edificio', 'otras formas', 'patio central', 'forma de u', 'forma de l'],
    clavesEn: ['cube', 'cubes', 'box', 'boxes', 'organic', 'curve', 'curves', 'curved', 'free form', 'complex', 'irregular', 'parametric', 'building shape', 'other shapes', 'courtyard', 'u shape', 'l shape', 'u-shaped', 'l-shaped'],
    r: {
      es: 'No solo cubos. Puedes pedir: una casa con patio central y corredor de columnas, como la casa de patio antioqueña; en U, con el patio abierto al fondo; en L, con el patio al fondo y a un lado; pisos escalonados con terrazas (al frente, de lado o en los dos sentidos); balcones; y curvas: un mirador de vidrio en media vuelta en la sala y balcones redondeados. Dime «casa con patio central», «hazla en L», «en U», «ponle curvas» o «hazla escalonada con terrazas», o escógelo en Programa › Forma del edificio. El 3D, los planos, las fachadas, los cortes y el presupuesto salen con esa forma. Si el lote no alcanza para el patio, la app dice cuánto necesita.',
      en: 'Not just boxes. You can ask for: a house around a central courtyard with a colonnade, like the traditional Antioquia courtyard house; U-shaped, with the courtyard open at the back; L-shaped, with the courtyard at the back and one side; stepped floors with terraces (front, side or both); balconies; and curves: a half-round glass bay in the living room and rounded balconies. Say «house with a courtyard», «make it L-shaped», «U-shaped», «add curves» or «make it stepped with terraces», or choose it in Program › Building shape. The 3D model, drawings, elevations, sections and budget follow that shape. If the lot is too small for the courtyard, the app tells you how much it needs.',
    },
  },
  {
    id: 'acero', claves: ['estructura metalica', 'acero', 'steel', 'metalica'],
    clavesEn: ['steel structure', 'steel', 'metal structure', 'metal frame'],
    r: {
      es: 'Hoy Axiona Obra calcula en pórticos de concreto o mampostería confinada en Colombia, concreto en España y México, y madera en Canadá. La estructura metálica está en desarrollo; mientras tanto, Axiona la puede trabajar contigo como servicio.',
      en: 'Today Axiona Obra calculates concrete frames or confined masonry in Colombia, concrete in Spain and Mexico, and wood frame in Canada. Steel structures are in development; meanwhile, Axiona can work on it with you as a service.',
    },
  },
];

/** Lo que Axi sabe hacer, para la ayuda y las instrucciones del modelo. */
export const CAPACIDADES = [
  { es: 'Ir a una pestaña: «muéstrame los planos», «abre el 3D», «ver el presupuesto».', en: 'Go to a tab: «show me the drawings», «open the 3D», «see the budget».' },
  { es: 'Cambiar los pisos: «pon 3 pisos».', en: 'Change the floors: «set 3 floors».' },
  { es: 'Agregar espacios: «agrega una alcoba de 12 m² en el segundo piso», «agrega dos baños».', en: 'Add rooms: «add a 12 m² bedroom on the second floor», «add two bathrooms».' },
  { es: 'Quitar, agrandar, achicar o pasar de piso un espacio: «quita el estudio», «agranda la sala a 25 m²», «pasa el estudio al piso 2».', en: 'Remove, enlarge, shrink or move a room to another floor: «remove the study», «make the living room 25 m²», «move the study to floor 2».' },
  { es: 'Acabados: «porcelanato en toda la casa», «madera en la alcoba principal», «estilo moderno».', en: 'Finishes: «porcelain tile in the whole house», «wood in the main bedroom», «modern style».' },
  { es: 'Cubierta y sistema: «techo a dos aguas», «mampostería confinada».', en: 'Roof and system: «gable roof», «confined masonry».' },
  { es: 'Forma del edificio: «casa con patio central», «hazla en L», «en U», «ponle curvas», «hazla escalonada con terrazas», «terraza lateral», «retroceso de 3 metros», «agrega balcones», «forma recta».', en: 'Building shape: «house with a courtyard», «make it L-shaped», «U-shaped», «add curves», «make it stepped with terraces», «side terrace», «3 meter setback», «add balconies», «straight shape».' },
  { es: 'Lote: «lote de 10 por 20».', en: 'Lot: «lot of 10 by 20».' },
  { es: 'Ver el 3D por fases: «muéstrame los ladrillos», «la casa terminada», «recorrer la casa».', en: 'See the 3D by phase: «show me the bricks», «the finished house», «walk through the house».' },
  { es: 'Realidad aumentada en cualquier celular con cámara: «muéstrame la casa en realidad aumentada», «la casa en el lote a escala real», «sin marcador», «descarga los marcadores».', en: 'Augmented reality on any phone with a camera: «show me the house in augmented reality», «the house on the lot at full scale», «without marker», «download the markers».' },
  { es: 'Descargar: «descarga el PDF», «DXF», «presupuesto en Excel».', en: 'Download: «download the PDF», «DXF», «budget in Excel».' },
  { es: 'Datos: «cuánto cuesta», «cuántos metros», «qué espacios hay», «hay algún problema».', en: 'Data: «how much does it cost», «how many square meters», «which rooms are there», «is there any problem».' },
  { es: 'Empezar de cero o cargar un ejemplo: «empezar de cero», «ver ejemplos».', en: 'Start from scratch or load an example: «start from scratch», «see examples».' },
  { es: 'Idioma: «en inglés», «en español».', en: 'Language: «in English», «in Spanish».' },
  { es: 'Hablar con una persona de Axiona o dejar una reseña o propuesta.', en: 'Talk to a person at Axiona or leave a review or proposal.' },
];
