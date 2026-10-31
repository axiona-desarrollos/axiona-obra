/* ==========================================================================
   AXIONA OBRA · Paises
   --------------------------------------------------------------------------
   Lo que cambia de Colombia a España, a Canada y a Mexico: unidades, moneda, sistema
   constructivo, cubierta tipica, formato de las laminas, quien firma, los
   tramites antes de construir, las normas y los precios de referencia.
   El motor y los planos son los mismos; el pais solo cambia estos datos.

   Las normas y los pasos se verificaron en octubre de 2026 con las fuentes
   que van en cada uno. Lo que no se pudo confirmar lleva «confirmar».
   ========================================================================== */

export const PAISES = {
  CO: {
    id: 'CO', locale: 'es-CO', idioma: 'es', moneda: 'COP', unidades: 'm', papel: 'P70',
    nombre: { es: 'Colombia', en: 'Colombia' },
    sistema: 'porticos', sistemas: ['porticos', 'confinada'],
    cubierta: { tipo: 'plana', pend: 0, alero: 0.4 },
    sotano: false,
    // Rotulo: casilla del sello oficial y nombre del documento de identidad profesional.
    sello: { es: 'Sello de la curaduría', en: 'Planning office stamp' },
    norma: 'NSR-10',
    profesionales: [
      { id: 'arq', rol: { es: 'Arquitecto proyectista', en: 'Architect' }, doc: { es: 'Matrícula', en: 'Licence' } },
      { id: 'est', rol: { es: 'Ingeniero estructural', en: 'Structural engineer' }, doc: { es: 'Matrícula', en: 'Licence' } },
      { id: 'geo', rol: { es: 'Ingeniero geotecnista', en: 'Geotechnical engineer' }, doc: { es: 'Matrícula', en: 'Licence' } },
      { id: 'con', rol: { es: 'Constructor responsable', en: 'Builder' }, doc: { es: 'Matrícula', en: 'Licence' } },
    ],
    indirectos: [
      { k: 'adm', pct: 0.17, n: { es: 'Administración', en: 'Overhead' } },
      { k: 'imp', pct: 0.03, n: { es: 'Imprevistos', en: 'Contingency' } },
      { k: 'uti', pct: 0.05, n: { es: 'Utilidad', en: 'Profit' } },
      { k: 'iva', pct: 0.19, sobre: 'uti', imp: true, n: { es: 'IVA sobre la utilidad', en: 'VAT on profit' } },
    ],
    // Costo directo de construccion por m², sin lote, diseños ni licencias.
    referencia: {
      min: 1600000, max: 2400000,
      nota: { es: 'Acabados medios. Rango nacional de 2026 con el recargo de hasta 20 % del Valle de Aburrá: es una estimación, no una cifra publicada.', en: 'Mid-range finishes. 2026 national range plus the up-to-20 % Aburrá Valley premium: an estimate, not a published figure.' },
      fuentes: [
        ['OneEstimate, costos por m² 2026', 'https://oneestimate.ai/blog/costos-construccion-por-m2-colombia-2026'],
        ['vivienda.com.co, precio del m² de construcción 2026', 'https://vivienda.com.co/precio-metro-cuadrado-construccion-colombia-2026/'],
      ],
    },
    campos: ['aa', 'av'],
  },
  ES: {
    id: 'ES', locale: 'es-ES', idioma: 'es', moneda: 'EUR', unidades: 'm', papel: 'A1',
    nombre: { es: 'España', en: 'Spain' },
    sistema: 'hormigon', sistemas: ['hormigon'],
    cubierta: { tipo: 'cuatro', pend: 30, alero: 0.5 },
    sotano: false,
    sello: { es: 'Visado colegial', en: 'Professional college stamp' },
    norma: 'CTE',
    profesionales: [
      { id: 'arq', rol: { es: 'Arquitecto (proyectista)', en: 'Architect (designer)' }, doc: { es: 'Nº colegiado', en: 'Registration no.' } },
      { id: 'dej', rol: { es: 'Director de ejecución', en: 'Site director' }, doc: { es: 'Nº colegiado', en: 'Registration no.' } },
      { id: 'css', rol: { es: 'Coordinador de seguridad y salud', en: 'Health & safety coordinator' }, doc: { es: 'Nº colegiado', en: 'Registration no.' } },
    ],
    indirectos: [
      { k: 'gg', pct: 0.13, n: { es: 'Gastos generales', en: 'General expenses' } },
      { k: 'bi', pct: 0.06, n: { es: 'Beneficio industrial', en: 'Contractor profit' } },
      { k: 'iva', pct: 0.10, sobre: 'todo', imp: true, n: { es: 'IVA (obra de vivienda, 10 %)', en: 'VAT (housing works, 10 %)' } },
    ],
    referencia: {
      min: 1200, max: 1800,
      nota: { es: 'Vivienda unifamiliar de calidad media. La Sociedad de Tasación daba 1.323 €/m² en septiembre de 2025.', en: 'Mid-quality single-family house. Sociedad de Tasación gave €1,323/m² in September 2025.' },
      fuentes: [
        ['OCU, coste de construir una vivienda en 2026', 'https://www.ocu.org/fincas-y-casas/gestion/gestion-patrimonial/analisis/2026/03/construir-una-vivienda'],
        ['Hipotecas.me, costes de construir una casa', 'https://www.hipotecas.me/guias/hipoteca-autopromotor/costes-construir-casa'],
      ],
    },
    campos: ['ab', 'zona'],
  },
  CA: {
    id: 'CA', locale: 'en-CA', idioma: 'en', moneda: 'CAD', unidades: 'ft', papel: 'ANSIB',
    nombre: { es: 'Canadá', en: 'Canada' },
    sistema: 'madera', sistemas: ['madera'],
    cubierta: { tipo: 'dos', pend: 50, alero: 0.45 },
    sotano: true,
    sello: { es: 'Sello del permiso', en: 'Permit stamp' },
    norma: 'NBC',
    profesionales: [
      { id: 'des', rol: { es: 'Diseñador calificado', en: 'Qualified designer' }, doc: { es: 'BCIN / registro', en: 'BCIN / registration' } },
      { id: 'arq', rol: { es: 'Arquitecto', en: 'Architect' }, doc: { es: 'Licencia', en: 'Licence no.' } },
      { id: 'eng', rol: { es: 'Ingeniero estructural', en: 'Structural engineer' }, doc: { es: 'P.Eng.', en: 'P.Eng. no.' } },
    ],
    indirectos: [
      { k: 'ohp', pct: 0.12, n: { es: 'Gastos y utilidad del constructor', en: 'Builder overhead & profit' } },
      { k: 'cont', pct: 0.05, n: { es: 'Imprevistos', en: 'Contingency' } },
      { k: 'tax', pct: 0.13, sobre: 'todo', imp: true, n: { es: 'Impuesto (HST 13 % en Ontario; cambia por provincia)', en: 'Sales tax (13 % HST in Ontario; varies by province)' } },
    ],
    referencia: {
      min: 1990, max: 3660,
      nota: { es: 'Casa unifamiliar con sótano sin terminar: 185 a 340 CAD por pie² según la ciudad (Altus Group 2025, citado por RE/MAX).', en: 'Single-family house with unfinished basement: CAD 185–340 per ft² depending on the city (Altus Group 2025, cited by RE/MAX).' },
      fuentes: [
        ['RE/MAX, cost to build a house (Altus 2025)', 'https://blog.remax.ca/how-much-does-it-cost-to-build-a-house/'],
        ['Altus Group, Canadian Cost Guide', 'https://www.altusgroup.com/services/cost-guide'],
      ],
    },
    campos: ['nieve', 'helada', 'sa'],
  },
  MX: {
    id: 'MX', locale: 'es-MX', idioma: 'es', moneda: 'MXN', unidades: 'm', papel: 'MX90',
    nombre: { es: 'México', en: 'Mexico' },
    sistema: 'confinada', sistemas: ['confinada', 'porticos'],
    cubierta: { tipo: 'plana', pend: 0, alero: 0 },
    sotano: false,
    sello: { es: 'Sello de registro de la alcaldía o el municipio', en: 'Borough or municipal registration stamp' },
    norma: 'RC CDMX · NTC',
    profesionales: [
      { id: 'dro', rol: { es: 'Director Responsable de Obra (DRO)', en: 'Director of Works (DRO)' }, doc: { es: 'Registro DRO', en: 'DRO registration' } },
      { id: 'arq', rol: { es: 'Arquitecto proyectista', en: 'Architect' }, doc: { es: 'Cédula profesional', en: 'Professional licence' } },
      { id: 'cse', rol: { es: 'Corresponsable en Seguridad Estructural', en: 'Structural co-responsible' }, doc: { es: 'Registro C/SE', en: 'C/SE registration' } },
      { id: 'ci', rol: { es: 'Corresponsable en Instalaciones', en: 'Services co-responsible' }, doc: { es: 'Registro C/I', en: 'C/I registration' } },
    ],
    // Sobrecosto a la mexicana: cada cargo se suma sobre lo anterior
    // (indirectos sobre el directo, financiamiento sobre directo + indirectos,
    // utilidad sobre todo lo anterior). El IVA solo grava la parte que no es
    // casa habitacion: construirla con materiales y mano de obra esta exento.
    indirectos: [
      { k: 'ind', pct: 0.12, n: { es: 'Indirectos de oficina central y de obra', en: 'Head-office and site overhead' } },
      { k: 'fin', pct: 0.015, sobre: 'todo', n: { es: 'Financiamiento', en: 'Financing' } },
      { k: 'uti', pct: 0.10, sobre: 'todo', n: { es: 'Utilidad', en: 'Profit' } },
      { k: 'iva', pct: 0.16, sobre: 'todo', imp: true, parte: 'noHab', n: { es: 'IVA 16 % de la parte no habitacional (la casa habitación construida con materiales y mano de obra está exenta, art. 9-II de la Ley del IVA)', en: 'VAT 16 % on the non-residential part (housing built with labour and materials is exempt, VAT Law art. 9-II)' } },
    ],
    referencia: {
      min: 12500, max: 20000,
      nota: { es: 'Vivienda de interés medio en 2026. Son rangos de guías de costos que citan al CEICO-CMIC, sin un documento oficial por segmento; la CMIC reporta +4.52 % en el costo de la vivienda entre diciembre de 2024 y diciembre de 2025.', en: 'Mid-range housing in 2026. Ranges from cost guides that cite CEICO-CMIC, with no official per-segment document; CMIC reports +4.52 % in housing cost from Dec 2024 to Dec 2025.' },
      fuentes: [
        ['Expansión Obras · construir en 2026 sale más caro', 'https://obras.expansion.mx/inmobiliario/2026/02/17/construir-propia-casa-mexico-2026-es-mas-caro'],
        ['Odigos · costo de construcción por m² 2026', 'https://odigos.mx/blog/costo-de-construccion-m2'],
      ],
    },
    campos: ['mx'],
  },
};

export const PAIS_IDS = Object.keys(PAISES);
export const pais = id => PAISES[id] || PAISES.CO;

export const SISTEMAS = {
  porticos: { es: 'Pórticos de concreto y bloque', en: 'Concrete frame with block infill' },
  confinada: { es: 'Mampostería confinada (NSR-10 Título E)', en: 'Confined masonry (NSR-10 Title E)' },
  hormigon: { es: 'Estructura de hormigón y fábrica de ladrillo', en: 'Concrete frame and brick walls' },
  madera: { es: 'Entramado de madera (platform framing)', en: 'Wood-frame (platform framing)' },
};

/** En Mexico la mamposteria confinada se rige por las NTC, no por la NSR-10. */
const SISTEMA_PAIS = {
  MX: {
    confinada: { es: 'Mampostería confinada de block (NTC Mampostería)', en: 'Confined block masonry (NTC Masonry)' },
    porticos: { es: 'Marcos de concreto y muros de block', en: 'Concrete frames with block walls' },
  },
};
export const nombreSistema = (pid, k) => SISTEMA_PAIS[pid]?.[k] || SISTEMAS[k];

/** Paises que dan la capacidad del suelo en t/m² (los demas en kPa). */
export const usaTm2 = pid => pid === 'CO' || pid === 'MX';

export const CUBIERTAS = {
  plana: { es: 'Plana con antepecho', en: 'Flat with parapet' },
  dos: { es: 'A dos aguas', en: 'Gable' },
  cuatro: { es: 'A cuatro aguas', en: 'Hip' },
};

/** Formatos de lamina en mm (apaisados). */
export const PAPELES = {
  P70: { n: { es: 'Medio pliego 70 × 50 cm', en: 'Half sheet 70 × 50 cm' }, w: 700, h: 500 },
  P100: { n: { es: 'Pliego 100 × 70 cm', en: 'Full sheet 100 × 70 cm' }, w: 1000, h: 700 },
  A1: { n: 'A1 · 841 × 594 mm', w: 841, h: 594 },
  A2: { n: 'A2 · 594 × 420 mm', w: 594, h: 420 },
  A3: { n: 'A3 · 420 × 297 mm', w: 420, h: 297 },
  ANSIB: { n: 'Tabloid 11 × 17 in', w: 431.8, h: 279.4 },
  ARCHD: { n: 'ARCH D 24 × 36 in', w: 914.4, h: 609.6 },
  MX90: { n: { es: 'Plano 90 × 60 cm', en: 'Sheet 90 × 60 cm' }, w: 900, h: 600 },
};

/* --------------------------------------------------------------------------
   Antes de construir: los pasos en orden, por pais. `si` decide si el paso
   aplica al proyecto; `axiona` dice que parte genera la app.
   -------------------------------------------------------------------------- */
const L = (t, u) => [t, u];
export const PASOS = {
  CO: [
    { id: 'titulos', t: { es: 'Lote en regla', en: 'Clear title' }, d: { es: 'Certificado de tradición y libertad al día, linderos claros y lote a nombre de quien construye o vende.', en: 'Up-to-date title certificate, clear boundaries, lot owned by whoever builds or sells.' } },
    { id: 'norma', t: { es: 'Norma urbanística del lote (POT)', en: 'Zoning rules (POT)' }, d: { es: 'Usos, alturas, retiros e índices que permite el plan de ordenamiento del municipio. En Medellín rige el Acuerdo 48 de 2014 y su revisión está en el Concejo.', en: 'Uses, heights, setbacks and ratios allowed by the municipal land-use plan. Medellín: Agreement 48 of 2014, under review in 2026.' }, fuente: L('Alcaldía de Medellín · POT', 'https://www.medellin.gov.co/es/transparencia/plan-de-ordenamiento-territorial-de-medellin/que-es-pot/'), axiona: { es: 'Retiros, índice de ocupación y huella en la pestaña Terreno.', en: 'Setbacks, coverage and footprint in the Site tab.' } },
    { id: 'topo', t: { es: 'Levantamiento topográfico', en: 'Topographic survey' }, d: { es: 'Esquinas del lote, cotas y curvas de nivel medidas en sitio.', en: 'Lot corners, spot levels and contours measured on site.' }, axiona: { es: 'Medición en AR, curvas de nivel, corte y relleno.', en: 'AR measuring, contours, cut and fill.' } },
    { id: 'suelos', t: { es: 'Estudio de suelos', en: 'Geotechnical study' }, d: { es: 'Obligatorio por la NSR-10 (Título H). Define la cimentación y la capacidad portante.', en: 'Required by NSR-10 (Title H). Sets the foundation and bearing capacity.' }, fuente: L('NSR-10 Título H', 'https://www.idrd.gov.co/sites/default/files/documentos/Construcciones/8titulo-h-nsr-100.pdf'), axiona: { es: 'Lee la capacidad portante y el desplante del PDF del estudio.', en: 'Reads bearing capacity and footing depth from the study PDF.' } },
    { id: 'arq', t: { es: 'Diseño arquitectónico', en: 'Architectural design' }, d: { es: 'Plantas, fachadas, cortes, cubierta y cuadros de áreas, puertas, ventanas y acabados.', en: 'Plans, elevations, sections, roof and schedules.' }, axiona: { es: 'Juego de planos completo, editable y en PDF.', en: 'Complete, editable drawing set in PDF.' } },
    { id: 'est', t: { es: 'Diseño estructural sismorresistente', en: 'Seismic structural design' }, d: { es: 'Según la NSR-10, firmado por ingeniero civil con matrícula y la experiencia que pide la Ley 400 de 1997. Casas de 1 y 2 pisos pueden usar el Título E.', en: 'Per NSR-10, signed by a licensed civil engineer as required by Law 400 of 1997. 1–2 storey houses may use Title E.' }, fuente: L('Ley 400 de 1997', 'https://www.funcionpublica.gov.co/eva/gestornormativo/norma.php?i=336'), axiona: { es: 'Predimensionamiento de ejes, columnas y zapatas y revisión del Título E. No reemplaza el diseño.', en: 'Pre-sizing of grids, columns and footings plus a Title E check. Not a replacement for the design.' } },
    { id: 'redes', t: { es: 'Diseños de redes', en: 'MEP designs' }, d: { es: 'Hidrosanitario, eléctrico (RETIE, Resolución 40117 de 2024) y gas.', en: 'Plumbing, electrical (RETIE, Resolution 40117 of 2024) and gas.' }, fuente: L('Nuevo RETIE', 'https://www.asuntoslegales.com.co/consultorio/nuevo-reglamento-tecnico-de-instalaciones-electricas-retie-3843194'), axiona: { es: 'Planos esquemáticos de puntos eléctricos e hidrosanitarios.', en: 'Schematic electrical and plumbing layouts.' } },
    { id: 'revision', si: P => P.area > 2000, t: { es: 'Revisión independiente de la estructura', en: 'Independent structural review' }, d: { es: 'Si el proyecto pasa de 2.000 m², otro ingeniero independiente revisa los diseños (Ley 1796 de 2016).', en: 'Above 2,000 m², an independent engineer reviews the design (Law 1796 of 2016).' }, fuente: L('Ley 1796 de 2016', 'https://www.funcionpublica.gov.co/eva/gestornormativo/norma.php?i=78234') },
    { id: 'licencia', t: { es: 'Radicar la licencia de construcción', en: 'Apply for the building licence' }, d: { es: 'En la curaduría (o en planeación donde no hay curador): Formulario Único Nacional y los documentos de la Resolución 462 de 2017, modificada por la 1025 de 2021. Valla en el predio.', en: 'At the curaduría: national form plus the documents of Resolution 462/2017 as amended by 1025/2021. Notice board on site.' }, fuente: L('Minvivienda · documentos de licencias', 'https://minvivienda.gov.co/node/46761') },
    { id: 'vigencia', t: { es: 'Licencia aprobada y vigencia anotada', en: 'Licence granted, expiry noted' }, d: { es: 'La prórroga se pide 30 días hábiles antes del vencimiento.', en: 'Extensions are requested 30 business days before expiry.' }, fuente: L('Concepto Minvivienda 2021', 'https://ventanilla.minvivienda.gov.co/sites/default/files/conceptos_juridicos/2021ee0047621.pdf') },
    { id: 'supervision', si: P => P.area > 2000, t: { es: 'Supervisión técnica independiente', en: 'Independent site supervision' }, d: { es: 'Obligatoria cuando el proyecto pasa de 2.000 m² (Ley 1796). La contrata el titular de la licencia.', en: 'Mandatory above 2,000 m² (Law 1796), hired by the licence holder.' }, fuente: L('Ley 1796 de 2016', 'https://www.funcionpublica.gov.co/eva/gestornormativo/norma.php?i=78234') },
    { id: 'amparo', t: { es: 'Amparo de 10 años (vivienda nueva para la venta)', en: '10-year warranty (new homes for sale)' }, d: { es: 'Decreto 282 de 2019. Su aplicación ha sido por etapas: confirmarla con la aseguradora.', en: 'Decree 282 of 2019, phased in: confirm with the insurer.' }, fuente: L('Decreto 282 de 2019', 'https://normas.cra.gov.co/gestor/docs/decreto_0282_2019.htm') },
    { id: 'obra', t: { es: 'Seguridad y escombros', en: 'Site safety and waste' }, d: { es: 'Trabajo en alturas (Resolución 4272 de 2021) y manejo de escombros (Resolución 1257 de 2021).', en: 'Work at heights (Res. 4272/2021) and construction waste (Res. 1257/2021).' }, fuente: L('Resolución 4272 de 2021', 'https://normativa.colpensiones.gov.co/compilacion/docs/resolucion_mtra_4272_2021.htm') },
    { id: 'ocupacion', t: { es: 'Certificado técnico de ocupación', en: 'Occupancy certificate' }, d: { es: 'Al terminar, cuando hubo supervisión técnica (Ley 1796).', en: 'At completion, when supervision applied (Law 1796).' } },
  ],
  ES: [
    { id: 'urbanistica', t: { es: 'Información urbanística del solar', en: 'Planning information for the plot' }, d: { es: 'Planeamiento y ordenanza municipal: uso, edificabilidad, alturas y retranqueos.', en: 'Municipal plan and by-law: use, buildability, heights and setbacks.' }, axiona: { es: 'Retranqueos, ocupación y huella en Terreno.', en: 'Setbacks, coverage and footprint in Site.' } },
    { id: 'topo', t: { es: 'Levantamiento topográfico', en: 'Topographic survey' }, d: { es: 'Linderos, cotas y curvas de nivel del solar.', en: 'Boundaries, levels and contours.' }, axiona: { es: 'Medición en AR, curvas y movimiento de tierras.', en: 'AR measuring, contours and earthworks.' } },
    { id: 'geotecnico', t: { es: 'Estudio geotécnico', en: 'Geotechnical report' }, d: { es: 'El CTE DB SE-C lo pide para dimensionar la cimentación; algunos ayuntamientos no lo comprueban, pero hace falta para el cálculo.', en: 'CTE DB SE-C requires it to size foundations.' }, fuente: L('Código Técnico de la Edificación', 'https://www.codigotecnico.org/') },
    { id: 'basico', t: { es: 'Proyecto básico', en: 'Basic design' }, d: { es: 'Contenido del Anejo I del CTE: memoria descriptiva y constructiva, cumplimiento del CTE, planos generales y presupuesto aproximado. Basta para pedir la licencia, no para construir.', en: 'CTE Annex I: descriptive memory, code compliance, general drawings and estimate. Enough for the permit, not to build.' }, fuente: L('CTE Anejo I', 'https://www.iberley.es/legislacion/anexo-1-codigo-tecnico-edificacion'), axiona: { es: 'Planos generales, cuadro de superficies y presupuesto por capítulos.', en: 'General drawings, area schedule and budget by chapters.' } },
    { id: 'visado', t: { es: 'Visado colegial', en: 'Professional college approval' }, d: { es: 'Real Decreto 1000/2010. Confirmar en su artículo 2 si el trabajo lo exige.', en: 'Royal Decree 1000/2010: check article 2.' }, fuente: L('BOE · RD 1000/2010', 'https://boe.gob.es/buscar/pdf/2010/BOE-A-2010-12618-consolidado.pdf') },
    { id: 'licencia', t: { es: 'Licencia de obra mayor o declaración responsable', en: 'Building permit or responsible declaration' }, d: { es: 'Depende de la comunidad autónoma y del ayuntamiento. Con la solicitud: tasa urbanística e ICIO (tipo máximo del 4 %).', en: 'Depends on region and town hall. Fees and ICIO tax (max 4 %).' } },
    { id: 'ejecucion', t: { es: 'Proyecto de ejecución', en: 'Construction design' }, d: { es: 'Memoria y anejos, planos, pliego, mediciones y presupuesto, estudio de seguridad y salud, estudio de gestión de residuos (RD 105/2008) y plan de control de calidad.', en: 'Report, drawings, specifications, bill of quantities, health & safety and waste studies, quality plan.' }, fuente: L('Ejemplo de contenido (Junta de Andalucía)', 'https://www.juntadeandalucia.es/haciendayadministracionpublica/apl/pdc_sirec_documentacion/rest/descargar/documento/361746'), axiona: { es: 'Mediciones y presupuesto con PEM, gastos generales, beneficio e IVA.', en: 'Quantities and budget with overheads, profit and VAT.' } },
    { id: 'estructura', t: { es: 'Estructura y sismo', en: 'Structure and seismic' }, d: { es: 'Código Estructural (RD 470/2021), obligatorio desde el 10 de noviembre de 2024, y NCSE-02 cuando la aceleración básica es de 0,04 g o más.', en: 'Structural Code (RD 470/2021) and NCSE-02 where ab ≥ 0.04 g.' }, fuente: L('BOE · Código Estructural', 'https://www.boe.es/eli/es/rd/2021/06/29/470') },
    { id: 'decenal', t: { es: 'Seguro decenal', en: '10-year insurance' }, d: { es: 'LOE, artículo 19: obligatorio para el promotor de viviendas; el autopromotor de su propia casa queda exento salvo que la venda antes de 10 años.', en: 'LOE art. 19: mandatory for housing developers; self-builders exempt unless they sell within 10 years.' }, fuente: L('idealista · seguro decenal', 'https://www.idealista.com/news/node/877801') },
    { id: 'replanteo', t: { es: 'Inicio de obra', en: 'Start of works' }, d: { es: 'Acta de replanteo, coordinador de seguridad y salud (RD 1627/1997) y comunicación de apertura.', en: 'Setting-out record, H&S coordinator and site opening notice.' } },
    { id: 'cee', t: { es: 'Certificado de eficiencia energética', en: 'Energy performance certificate' }, d: { es: 'Real Decreto 390/2021, etiqueta de la A a la G.', en: 'Royal Decree 390/2021, A to G label.' } },
    { id: 'final', t: { es: 'Final de obra y primera ocupación', en: 'Completion and first occupancy' }, d: { es: 'Certificado final de obra, libro del edificio y licencia o declaración de primera ocupación.', en: 'Completion certificate, building log book and occupancy.' } },
  ],
  CA: [
    { id: 'zoning', t: { es: 'Zonificación', en: 'Zoning check' }, d: { es: 'Uso permitido, retiros, altura y ocupación según el reglamento de zonificación del municipio.', en: 'Permitted use, setbacks, height and lot coverage under the municipal zoning by-law.' }, axiona: { es: 'Retiros, ocupación y huella en Terreno.', en: 'Setbacks, coverage and footprint in Site.' } },
    { id: 'survey', t: { es: 'Levantamiento y nivelación del lote', en: 'Site survey and lot grading' }, d: { es: 'Plano del lote con retiros acotados.', en: 'Survey or site plan with dimensioned setbacks.' }, axiona: { es: 'Plano de implantación con retiros y curvas.', en: 'Site plan with setbacks and contours.' } },
    { id: 'geotech', t: { es: 'Suelo y profundidad de helada', en: 'Soil and frost depth' }, d: { es: 'Las zapatas van por debajo de la profundidad de congelamiento del lugar.', en: 'Footings below the local frost depth.' }, axiona: { es: 'Desplante mínimo según la profundidad de helada que se escriba.', en: 'Minimum footing depth from the frost depth entered.' } },
    { id: 'code', t: { es: 'Código de construcción vigente', en: 'Building code in force' }, d: { es: 'Casas de hasta 3 pisos y 600 m²: Parte 9 del código. La edición nacional 2025 salió en diciembre de 2025 y cada provincia la adopta a su ritmo; Ontario usa su código 2024 desde el 1 de enero de 2025.', en: 'Houses up to 3 storeys and 600 m²: Part 9. The 2025 national edition was released Dec 2025; provinces adopt it on their own timelines. Ontario uses its 2024 code since Jan 1, 2025.' }, fuente: L('Ontario · 2024 Building Code', 'https://www.ontario.ca/page/2024-ontario-building-code') },
    { id: 'designer', t: { es: 'Diseñador calificado', en: 'Qualified designer' }, d: { es: 'En Ontario los planos llevan nombre, registro y BCIN del diseñador, o los firma un arquitecto o ingeniero.', en: 'In Ontario drawings show the designer’s name, registration and BCIN, or are sealed by an architect/engineer.' }, fuente: L('City of Vaughan · new houses', 'https://www.vaughan.ca/residential/building-and-construction/building-permits/building-permits-homes/new-houses-and-additions') },
    { id: 'catalogue', t: { es: 'Catálogo federal de diseños', en: 'Federal Housing Design Catalogue' }, d: { es: 'Unos 50 diseños estandarizados (filas, fourplex, sixplex, unidades accesorias) con paquetes técnicos desde octubre de 2025; 14 ciudades se comprometieron a pre-revisarlos.', en: 'About 50 standardized designs with technical packages since Oct 2025; 14 cities committed to pre-review them.' }, fuente: L('CMHC · Housing Design Catalogue', 'https://housingcatalogue.cmhc-schl.gc.ca/about') },
    { id: 'energy', t: { es: 'Eficiencia energética', en: 'Energy efficiency' }, d: { es: 'Cumplimiento energético (Sección 9.36 del código nacional o el equivalente provincial).', en: 'Energy compliance (NBC 9.36 or provincial equivalent).' } },
    { id: 'drawings', t: { es: 'Planos para el permiso', en: 'Permit drawings' }, d: { es: 'Plano del lote, cimentación, plantas, fachadas, cortes, estructura de madera y detalles.', en: 'Site plan, foundation, floor plans, elevations, sections, framing and details.' }, fuente: L('City of Peterborough · drawing requirements', 'https://peterborough.ca/media/xr2huqa5/residential-drawing-requirements-brochure-final-july-2-19.pdf'), axiona: { es: 'Juego de planos completo en PDF tabloide.', en: 'Complete drawing set in tabloid PDF.' } },
    { id: 'permit', t: { es: 'Solicitud del permiso de construcción', en: 'Building permit application' }, d: { es: 'Ante el departamento de construcción del municipio.', en: 'To the municipal building department.' } },
    { id: 'radon', t: { es: 'Radón', en: 'Radon' }, d: { es: 'Preinstalación o chimenea pasiva de radón: la edición 2025 del código nacional añade la chimenea pasiva. Cerca de 1 de cada 5 casas supera la guía de 200 Bq/m³.', en: 'Rough-in or passive stack: the 2025 national code adds a passive radon stack. About 1 in 5 homes exceed the 200 Bq/m³ guideline.' }, fuente: L('Health Canada · radon and building codes', 'https://www.canada.ca/en/health-canada/services/health-risks-safety/radiation/radon/action-guides/municipalities/building-codes-bylaws-provisions.html') },
    { id: 'inspections', t: { es: 'Inspecciones de obra', en: 'Inspections' }, d: { es: 'Zapatas, estructura, aislamiento y final, según el municipio.', en: 'Footings, framing, insulation and final, per municipality.' } },
    { id: 'occupancy', t: { es: 'Ocupación', en: 'Occupancy' }, d: { es: 'Inspección final y permiso de ocupación.', en: 'Final inspection and occupancy.' } },
  ],
  MX: [
    { id: 'predio', t: { es: 'Predio en regla', en: 'Clear title' }, d: { es: 'Escritura inscrita en el Registro Público de la Propiedad y predial pagado.', en: 'Deed registered with the Public Property Registry and property tax paid.' } },
    { id: 'uso', t: { es: 'Uso de suelo', en: 'Land-use certificate' }, d: { es: 'En la CDMX, certificado de uso de suelo; en los municipios, dictamen o licencia de uso de suelo. Fija usos, niveles, área libre y restricciones, y el expediente de la licencia debe cumplir sus condicionantes.', en: 'In Mexico City, a land-use certificate; in municipalities, a land-use ruling or licence. It sets uses, storeys, open area and restrictions.' }, fuente: L('Querétaro · licencia unifamiliar', 'https://tramitesqro.municipiodequeretaro.gob.mx/cedula.php?id=TR-170100-059'), axiona: { es: 'Retiros, área libre y huella en la pestaña Terreno.', en: 'Setbacks, open area and footprint in the Site tab.' } },
    { id: 'alineamiento', t: { es: 'Alineamiento y número oficial', en: 'Alignment and official number' }, d: { es: 'Constancia vigente de alineamiento y número oficial; la piden la manifestación de construcción en la CDMX y la licencia en los municipios.', en: 'Current alignment and official number certificate, required for the permit.' }, fuente: L('CDMX · manifestación tipo A', 'https://www.cdmx.gob.mx/public/InformacionTramite.xhtml?idTramite=463') },
    { id: 'topo', t: { es: 'Levantamiento topográfico', en: 'Topographic survey' }, d: { es: 'Vértices, colindancias, niveles y curvas del predio.', en: 'Corners, boundaries, levels and contours.' }, axiona: { es: 'Medición en AR, curvas de nivel, corte y relleno.', en: 'AR measuring, contours, cut and fill.' } },
    { id: 'ems', t: { es: 'Estudio de mecánica de suelos', en: 'Soil mechanics study' }, d: { es: 'Define la cimentación y la capacidad de carga. En la zona de lago o de transición de la CDMX y en suelos blandos es indispensable.', en: 'Sets the foundation and bearing capacity; essential on soft soils such as Mexico City’s lake zone.' }, axiona: { es: 'Lee la capacidad de carga y el desplante del PDF del estudio.', en: 'Reads bearing capacity and footing depth from the study PDF.' } },
    { id: 'arq', t: { es: 'Proyecto arquitectónico', en: 'Architectural design' }, d: { es: 'Plantas, cortes, fachadas, planta de azotea y cuadro de áreas.', en: 'Plans, sections, elevations, roof plan and area schedule.' }, axiona: { es: 'Juego de planos completo en PDF de 90 × 60 cm.', en: 'Complete drawing set in 90 × 60 cm PDF.' } },
    { id: 'est', t: { es: 'Proyecto estructural y memoria de cálculo', en: 'Structural design and calculations' }, d: { es: 'Según el Reglamento de Construcciones y sus Normas Técnicas Complementarias (mampostería, concreto, sismo). Lo firma el DRO y, cuando aplica, el Corresponsable en Seguridad Estructural.', en: 'Per the Building Regulations and their Complementary Technical Standards, signed by the DRO and, where required, the structural co-responsible.' }, fuente: L('NTC Mampostería (CDMX)', 'https://www.transparencia.cdmx.gob.mx/storage/app/uploads/public/5c3/7d1/af4/5c37d1af4ac13848933250.pdf'), axiona: { es: 'Castillos, dalas, losa de vigueta y bovedilla y revisión de la mampostería confinada. No reemplaza el diseño.', en: 'Tie columns, bond beams, joist-and-block slab and a confined masonry check. Not a replacement for the design.' } },
    { id: 'inst', t: { es: 'Instalaciones hidrosanitarias, eléctricas y de gas', en: 'Plumbing, electrical and gas' }, d: { es: 'Con cisterna, tinaco y bomba dimensionados para los ocupantes.', en: 'With cistern, roof tank and pump sized for the occupants.' }, axiona: { es: 'Cisterna, tinaco y bomba calculados; planos esquemáticos de salidas.', en: 'Cistern, roof tank and pump sized; schematic layouts.' } },
    { id: 'manifA', si: P => P.entidad === 'cdmx' && P.modalidad === 'A', t: { es: 'Manifestación de construcción tipo A', en: 'Type A building notice' }, d: { es: 'Una vivienda unifamiliar de hasta 120 m², dos niveles, 5.5 m de altura y claros de hasta 4 m, en predio con frente de 6 m o más y fuera de zona de riesgo (artículo 51 del Reglamento). Se registra en la alcaldía.', en: 'One single-family home up to 120 m², two storeys, 5.5 m high and 4 m spans, on a lot at least 6 m wide and outside risk zones (art. 51). Filed at the borough.' }, fuente: L('CDMX · manifestación tipo A', 'https://www.cdmx.gob.mx/public/InformacionTramite.xhtml?idTramite=463') },
    { id: 'manifBC', si: P => P.entidad === 'cdmx' && P.modalidad !== 'A', t: { es: 'Manifestación de construcción tipo B o C', en: 'Type B or C building notice' }, d: { es: 'Con responsiva del DRO y de los corresponsables que apliquen, certificado de uso de suelo, constancia de alineamiento y número oficial, proyecto de protección a colindancias y bitácora de obra.', en: 'With the DRO’s and co-responsibles’ sign-off, land-use certificate, alignment and number certificate, neighbour protection plan and site log.' }, fuente: L('Alcaldía Iztapalapa · tipo B o C', 'https://www.iztapalapa.cdmx.gob.mx/principal/TramitesServicios/RegisManifestacionConstruT.BoC.html') },
    { id: 'licencia', si: P => P.entidad !== 'cdmx', t: { es: 'Licencia de construcción municipal', en: 'Municipal building permit' }, d: { es: 'Con uso de suelo, número oficial y planos firmados por el DRO. En Querétaro el DRO no se pide en obras menores; en Guadalajara las obras de hasta 50 m² tramitan licencia menor. Confirmar con el municipio.', en: 'With land use, official number and drawings signed by the DRO. Rules for minor works vary by municipality.' }, fuente: L('Guadalajara · requisitos de licencia', 'https://transparencia.guadalajara.gob.mx/requisitos-licencia-construccion') },
    { id: 'imss', t: { es: 'Registro de la obra ante el IMSS', en: 'Site registration with IMSS' }, d: { es: 'Alta de la obra y de los trabajadores antes de empezar. Confirmar plazos y forma con el IMSS.', en: 'Register the works and the workers before starting; confirm with IMSS.' } },
    { id: 'bitacora', t: { es: 'Bitácora y dirección de obra', en: 'Site log and supervision' }, d: { es: 'La bitácora la lleva el DRO durante toda la obra; ahí quedan las visitas, los cambios y las pruebas.', en: 'The DRO keeps the site log for the whole build.' } },
    { id: 'terminacion', t: { es: 'Aviso de terminación de obra', en: 'Completion notice' }, d: { es: 'Al acabar, se da aviso de terminación a la alcaldía o al municipio para la ocupación.', en: 'At completion, file the completion notice for occupancy.' }, fuente: L('CDMX · trámite con aviso de terminación', 'https://www.cdmx.gob.mx/public/InformacionTramite.xhtml?idTramite=463') },
  ],
};

/** Normas y fuentes de referencia por pais. */
export const NORMAS = {
  CO: [
    ['NSR-10 · Decreto 926 de 2010', 'https://normas.cra.gov.co/gestor/docs/decreto_0926_2010.htm'],
    ['NSR-10 · Título E (casas de 1 y 2 pisos)', 'https://www.idrd.gov.co/sites/default/files/documentos/Construcciones/5titulo-e-nsr-100.pdf'],
    ['Ley 400 de 1997', 'https://www.funcionpublica.gov.co/eva/gestornormativo/norma.php?i=336'],
    ['Ley 1796 de 2016 (vivienda segura)', 'https://www.funcionpublica.gov.co/eva/gestornormativo/norma.php?i=78234'],
    ['Decreto 282 de 2019 (amparo de 10 años)', 'https://normas.cra.gov.co/gestor/docs/decreto_0282_2019.htm'],
    ['Resolución 1257 de 2021 (escombros)', 'https://normas.cra.gov.co/gestor/docs/resolucion_minambienteds_1257_2021.htm'],
  ],
  ES: [
    ['Código Técnico de la Edificación', 'https://www.codigotecnico.org/'],
    ['Código Estructural · RD 470/2021', 'https://www.boe.es/eli/es/rd/2021/06/29/470'],
    ['Visado colegial · RD 1000/2010', 'https://boe.gob.es/buscar/pdf/2010/BOE-A-2010-12618-consolidado.pdf'],
    ['CTE · Anejo I, contenido del proyecto', 'https://www.iberley.es/legislacion/anexo-1-codigo-tecnico-edificacion'],
  ],
  CA: [
    ['2025 National Model Codes (AIBC)', 'https://aibc.ca/2026/02/2025-editions-of-the-national-model-codes-now-available/'],
    ['2024 Ontario Building Code', 'https://www.ontario.ca/page/2024-ontario-building-code'],
    ['CMHC · Housing Design Catalogue', 'https://housingcatalogue.cmhc-schl.gc.ca/about'],
    ['Health Canada · radon', 'https://www.canada.ca/en/health-canada/services/health-risks-safety/radiation/radon/action-guides/municipalities/building-codes-bylaws-provisions.html'],
  ],
  MX: [
    ['Reglamento de Construcciones para el Distrito Federal (CDMX)', 'https://data.consejeria.cdmx.gob.mx/images/leyes/reglamentos/RGTO_DE_CONSTRUCCIONES_DEL_DISTRITO_FEDERAL_8.pdf'],
    ['NTC para Diseño y Construcción de Estructuras de Mampostería', 'https://www.transparencia.cdmx.gob.mx/storage/app/uploads/public/5c3/7d1/af4/5c37d1af4ac13848933250.pdf'],
    ['CDMX · manifestación de construcción tipo A', 'https://www.cdmx.gob.mx/public/InformacionTramite.xhtml?idTramite=463'],
    ['Alcaldía Iztapalapa · manifestación tipo B o C', 'https://www.iztapalapa.cdmx.gob.mx/principal/TramitesServicios/RegisManifestacionConstruT.BoC.html'],
    ['Municipio de Querétaro · licencia habitacional unifamiliar', 'https://tramitesqro.municipiodequeretaro.gob.mx/cedula.php?id=TR-170100-059'],
    ['Guadalajara · requisitos de licencia de construcción', 'https://transparencia.guadalajara.gob.mx/requisitos-licencia-construccion'],
    ['IDC · IVA en la construcción de casa habitación', 'https://idconline.mx/fiscal-contable/2021/10/18/subcontratacion-de-obras-de-construccion-de-casa-habitacion-y-el-iva'],
  ],
};

/* --------------------------------------------------------------------------
   Precios unitarios de referencia (costo directo, en la moneda del pais).
   CO: referencias de Axiona en COP. ES: las que llevan CYPE son del
   Generador de Precios (septiembre de 2026); el resto son estimaciones.
   CA: estimaciones instaladas en CAD calibradas con el rango de Altus 2025.
   MX: precios unitarios de referencia en MXN para la CDMX (material, mano de
   de obra y herramienta), calibrados con el rango de vivienda media 2026.
   Todas se editan en la tabla del presupuesto.
   -------------------------------------------------------------------------- */
export const PRECIOS_PAIS = {
  CO: {
    exc: 48000, rel: 38000, solado: 480000, conc: 720000, ciclopeo: 430000, acero: 6500,
    mamp: 88000, mampP: 105000, imper: 58000, cubInc: 125000, pan: 34000, est: 30000, pext: 32000, cielo: 36000,
    ench: 115000, puerta: 680000, puertaP: 1800000, vent: 450000, elec: 120000, hidro: 190000, sanit: 650000,
    cocina: 1400000, closet: 950000, escalera: 4200000, ascensor: 165000000, canal: 65000, baranda: 280000,
  },
  ES: {
    exc: 6.34, tra: 7.8, rel: 13.47, hl: 9.07, ha: 121.66, ace: 1.9, enc: 20.37, forj: 64.34,
    fab: 46.21, ais: 58, tab: 38, cubTeja: 166.91, cubPlana: 92, enl: 16, pin: 9.5, falso: 24,
    ali: 38, carpExt: 450, pInt: 290, pEnt: 1150, elec: 95, sanea: 160, font: 520, clima: 9500, radiante: 42, vmc: 2800, sanEnt: 1800,
    cocina: 680, armario: 540, escalera: 2400, ascensor: 26000, canal: 32, res: 18, ss: 16, baranda: 120,
  },
  CA: {
    exc: 32, rel: 24, zap: 470, muroC: 650, losaS: 90, impermC: 21, drenaje: 55,
    marcoExt: 130, marcoInt: 70, entrepiso: 110, cerchas: 88, tejas: 68, hielo: 24, revest: 115,
    aislM: 36, aislA: 26, drywall: 70, ali: 135, vent: 1050, pEnt: 2400, pInt: 760,
    cocina: 1400, sanit: 2300, elec: 240, tablero: 3900, hvac: 150, radon: 1050, canal: 52,
    humo: 175, escalera: 7500, ascensor: 72000, baranda: 190,
  },
  MX: {
    trazo: 25, exc: 300, rel: 380, acarreo: 220, plantilla: 220, zapC: 8200, enrase: 800, dalaD: 520, firme: 480,
    zapA: 7900, columna: 12000, trabe: 11000,
    block: 590, castillo: 450, dalaC: 520, vb12: 1250, vb15: 1400, vb20: 1650, losaMac: 1800,
    escalera: 28000, pretil: 680, imperm: 450, bajada: 1800, cubInc: 2200, canal: 540,
    aplExt: 300, yesoMuro: 230, yesoPlaf: 260, pintInt: 105, pintExt: 130, lambrin: 680, zoclo: 140,
    puerta: 4800, puertaP: 14000, cancel: 3400, cancelBano: 5500, barandal: 1900, proteccion: 1400,
    elec: 1450, tablero: 9500, hidro: 2400, sanit: 4500, registro: 3200,
    gas: 2200, tanqueGas: 7500, calentador: 9500, cisterna: 6.5, tinaco: 4.2, bomba: 6500,
    cocina: 12000, closet: 7500, ascensor: 1100000, limpieza: 45,
  },
};
