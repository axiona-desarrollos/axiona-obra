/* ==========================================================================
   AXIONA OBRA · Catalogo de acabados, estilos y dotacion
   --------------------------------------------------------------------------
   Pisos, muros y muebles con sus medidas y precios de referencia por pais
   (Mexico en MXN, calidad media, CDMX 2026).
   El estilo escoge un acabado por zona y la paleta del 3D; cada espacio se
   puede cambiar a mano. Lo que va pegado a la obra (closets, cocina
   integral, aparatos sanitarios) se paga en el presupuesto de obra y aqui
   lleva obra: true para no contarlo dos veces.
   ========================================================================== */

/** Pisos: textura para el 3D, codigo para el cuadro de acabados y precio por m². */
export const PISOS = {
  porc: { cod: 'P-01', n: { es: 'Porcelanato gris claro 60 × 60', en: 'Light grey porcelain tile 60 × 60' }, tex: 'baldosa', color: '#d4d6d8', junta: 0.6, precio: { CO: 98000, ES: 45, CA: 120, MX: 650 } },
  porcGF: { cod: 'P-02', n: { es: 'Porcelanato gran formato efecto mármol 60 × 120', en: 'Large-format marble-look porcelain 60 × 120' }, tex: 'marmol', color: '#eeece8', junta: 1.2, precio: { CO: 155000, ES: 62, CA: 170, MX: 1100 } },
  marmol: { cod: 'P-03', n: { es: 'Mármol blanco natural', en: 'White natural marble' }, tex: 'marmol', color: '#f1efea', junta: 0.8, precio: { CO: 380000, ES: 150, CA: 320, MX: 2800 } },
  roble: { cod: 'P-04', n: { es: 'Madera de roble de ingeniería', en: 'Engineered white oak' }, tex: 'madera', tono: 'roble', precio: { CO: 240000, ES: 75, CA: 140, MX: 1600 } },
  nogal: { cod: 'P-05', n: { es: 'Madera de nogal', en: 'Walnut hardwood' }, tex: 'madera', tono: 'nogal', precio: { CO: 290000, ES: 95, CA: 180, MX: 1900 } },
  teca: { cod: 'P-06', n: { es: 'Madera de teca', en: 'Teak' }, tex: 'madera', tono: 'teca', precio: { CO: 260000, ES: 90, CA: 175, MX: 1800 } },
  spc: { cod: 'P-07', n: { es: 'Vinilo SPC tipo madera', en: 'Luxury vinyl plank (SPC)' }, tex: 'madera', tono: 'gris', precio: { CO: 80000, ES: 32, CA: 60, MX: 550 } },
  micro: { cod: 'P-08', n: { es: 'Microcemento', en: 'Microcement' }, tex: 'cemento', color: '#b9b4ac', precio: { CO: 170000, ES: 70, CA: 150, MX: 1200 } },
  ceram: { cod: 'P-09', n: { es: 'Cerámica antideslizante', en: 'Non-slip ceramic tile' }, tex: 'baldosa', color: '#cfc8bd', junta: 0.33, precio: { CO: 68000, ES: 30, CA: 90, MX: 420 } },
  terracota: { cod: 'P-10', n: { es: 'Baldosa de terracota', en: 'Terracotta tile' }, tex: 'baldosa', color: '#b8693f', junta: 0.3, precio: { CO: 90000, ES: 38, CA: 110, MX: 600 } },
  concreto: { cod: 'P-11', n: { es: 'Concreto pulido', en: 'Polished concrete' }, tex: 'cemento', color: '#9c9a96', precio: { CO: 60000, ES: 35, CA: 70, MX: 380 } },
  // fotorrealistas: texturas reales (color, relieve y rugosidad) en public/texturas/<pbr>; m = lo que mide la foto en la obra
  porcBlanco: { cod: 'P-12', n: { es: 'Porcelanato blanco jaspeado 30 × 30', en: 'Speckled white porcelain 30 × 30' }, tex: 'baldosa', color: '#e2e2df', junta: 0.3, pbr: 'porcBlanco', m: 2.4, precio: { CO: 110000, ES: 48, CA: 125, MX: 720 } },
  porcNegro: { cod: 'P-13', n: { es: 'Porcelanato negro mate 40 × 40', en: 'Matte black porcelain 40 × 40' }, tex: 'baldosa', color: '#2b2c2f', junta: 0.4, pbr: 'porcNegro', m: 3.0, precio: { CO: 135000, ES: 55, CA: 140, MX: 850 } },
  marmolBlanco: { cod: 'P-14', n: { es: 'Mármol Carrara pulido', en: 'Polished Carrara marble' }, tex: 'marmol', color: '#d8d9dc', pbr: 'marmolBlanco', m: 2.0, rug: 0.5, precio: { CO: 420000, ES: 165, CA: 340, MX: 3100 } },
  marmolNegro: { cod: 'P-15', n: { es: 'Mármol negro Marquina', en: 'Nero Marquina marble' }, tex: 'marmol', color: '#26272a', pbr: 'marmolNegro', m: 2.0, rug: 0.5, precio: { CO: 460000, ES: 180, CA: 370, MX: 3400 } },
  travertino: { cod: 'P-16', n: { es: 'Travertino crema', en: 'Cream travertine' }, tex: 'marmol', color: '#e0d2b6', pbr: 'travertino', m: 1.2, rug: 0.7, precio: { CO: 300000, ES: 110, CA: 260, MX: 2200 } },
  terrazo: { cod: 'P-17', n: { es: 'Terrazo blanco con grano', en: 'White terrazzo' }, tex: 'cemento', color: '#e4e1dc', pbr: 'terrazo', m: 1.5, rug: 0.7, precio: { CO: 190000, ES: 80, CA: 190, MX: 1350 } },
  microGris: { cod: 'P-18', n: { es: 'Microcemento gris grafito', en: 'Graphite microcement' }, tex: 'cemento', color: '#77756f', pbr: 'microGris', m: 2.5, precio: { CO: 175000, ES: 72, CA: 155, MX: 1250 } },
  maderaMiel: { cod: 'P-19', n: { es: 'Madera maciza color miel', en: 'Honey solid hardwood' }, tex: 'madera', tono: 'teca', pbr: 'maderaMiel', m: 2.0, precio: { CO: 280000, ES: 92, CA: 175, MX: 1850 } },
  parque: { cod: 'P-20', n: { es: 'Parqué en espina de pez', en: 'Herringbone parquet' }, tex: 'madera', tono: 'roble', pbr: 'parque', m: 3.4, precio: { CO: 320000, ES: 105, CA: 195, MX: 2100 } },
  robleClaro: { cod: 'P-21', n: { es: 'Laminado roble claro', en: 'Light oak laminate' }, tex: 'madera', tono: 'claro', pbr: 'robleClaro', m: 1.7, precio: { CO: 95000, ES: 35, CA: 65, MX: 600 } },
  piedraGris: { cod: 'P-22', n: { es: 'Piedra gris en losetas (exterior)', en: 'Grey stone pavers (outdoor)' }, tex: 'baldosa', color: '#8e8b86', junta: 0.5, pbr: 'piedraGris', m: 2.0, precio: { CO: 150000, ES: 62, CA: 150, MX: 1000 } },
};

/** Revestimiento de la fachada. El estuco lleva el color del estilo y se paga como pintura; los demás reemplazan la pintura exterior. */
export const FACHADAS = {
  estuco: { cod: 'F-01', n: { es: 'Estuco y pintura (color del estilo)', en: 'Render and paint (style colour)' } },
  ladrillo: { cod: 'F-02', n: { es: 'Ladrillo a la vista rojo', en: 'Red face brick' }, pbr: 'ladrillo', m: 1.4, color: '#a04a32', precio: { CO: 135000, ES: 55, CA: 190, MX: 900 } },
  ladrilloOscuro: { cod: 'F-03', n: { es: 'Ladrillo a la vista tostado', en: 'Dark fired face brick' }, pbr: 'ladrilloOscuro', m: 1.0, color: '#6b3a2c', precio: { CO: 150000, ES: 60, CA: 200, MX: 950 } },
  piedraClara: { cod: 'F-04', n: { es: 'Piedra arenisca en bloques', en: 'Sandstone blocks' }, pbr: 'piedraClara', m: 2.0, color: '#cbb991', precio: { CO: 210000, ES: 85, CA: 260, MX: 1500 } },
  piedraBlanca: { cod: 'F-05', n: { es: 'Piedra caliza blanca en placas', en: 'White limestone panels' }, pbr: 'piedraBlanca', m: 2.0, color: '#c9c7c1', precio: { CO: 230000, ES: 95, CA: 280, MX: 1650 } },
  piedraGris: { cod: 'F-06', n: { es: 'Piedra gris en placas', en: 'Grey stone panels' }, pbr: 'piedraGris', m: 2.0, color: '#8e8b86', precio: { CO: 190000, ES: 80, CA: 240, MX: 1400 } },
  microGris: { cod: 'F-07', n: { es: 'Microcemento gris grafito', en: 'Graphite microcement' }, pbr: 'microGris', m: 2.5, color: '#77756f', precio: { CO: 110000, ES: 50, CA: 140, MX: 800 } },
  marmolBlanco: { cod: 'F-08', n: { es: 'Mármol blanco en fachada ventilada', en: 'White marble rainscreen' }, pbr: 'marmolBlanco', m: 2.0, color: '#d8d9dc', precio: { CO: 420000, ES: 170, CA: 380, MX: 3000 } },
  listones: { cod: 'F-09', n: { es: 'Listones de madera', en: 'Timber battens' }, pbr: 'robleClaro', m: 1.7, color: '#b89a74', precio: { CO: 260000, ES: 95, CA: 180, MX: 1800 } },
};

/** Teja de la cubierta inclinada. La del sistema ya está en el presupuesto; las demás suman su mayor valor por m². */
export const TEJAS = {
  sistema: { cod: 'T-01', n: { es: 'Teja del sistema (barro o asfáltica)', en: 'Standard (clay or asphalt)' } },
  tejaBarro: { cod: 'T-02', n: { es: 'Teja española de barro', en: 'Spanish clay tile' }, pbr: 'tejaBarro', m: 2.9, color: '#9c4f35', extra: { CO: 18000, ES: 8, CA: 45, MX: 120 } },
  tejaNegra: { cod: 'T-03', n: { es: 'Teja cerámica negra', en: 'Black ceramic tile' }, pbr: 'tejaNegra', m: 2.9, color: '#2c2d31', extra: { CO: 45000, ES: 18, CA: 60, MX: 300 } },
  pizarra: { cod: 'T-04', n: { es: 'Pizarra natural', en: 'Natural slate' }, pbr: 'pizarra', m: 3.0, color: '#4c5056', extra: { CO: 110000, ES: 40, CA: 95, MX: 700 } },
};

/** Cielo raso: estuco (va en el presupuesto de obra) o listones de madera en las zonas sociales y los aleros. */
export const CIELOS = {
  estuco: { cod: 'C-01', n: { es: 'Estuco y pintura', en: 'Plaster and paint' }, color: '#f4f3ef' },
  listones: { cod: 'C-02', n: { es: 'Listones de madera (zonas sociales y aleros)', en: 'Timber slats (living areas and eaves)' }, pbr: 'maderaMiel', m: 2.0, precio: { CO: 230000, ES: 85, CA: 165, MX: 1550 } },
};

/** Piscina: vaso con mosaico, playa con el piso exterior y equipo. Precios por país (suministro e instalación). */
export const PISCINA = {
  exc: { n: { es: 'Excavación de la piscina', en: 'Pool excavation' }, und: 'm³', precio: { CO: 45000, ES: 18, CA: 35, MX: 250 } },
  vaso: { n: { es: 'Vaso de concreto armado impermeabilizado', en: 'Waterproofed reinforced concrete shell' }, und: 'm²', precio: { CO: 380000, ES: 160, CA: 320, MX: 2600 } },
  mosaico: { n: { es: 'Mosaico vítreo azul en vaso', en: 'Blue glass mosaic lining' }, und: 'm²', precio: { CO: 160000, ES: 60, CA: 140, MX: 1100 } },
  equipo: { n: { es: 'Bomba, filtro, luces LED y cuarto técnico', en: 'Pump, filter, LED lights and plant room' }, und: 'und', precio: { CO: 18000000, ES: 6500, CA: 12000, MX: 95000 } },
  parq: { n: { es: 'Parqueadero en adoquín de concreto', en: 'Concrete paver parking' }, und: 'm²', precio: { CO: 95000, ES: 40, CA: 90, MX: 650 } },
  pergola: { n: { es: 'Pérgola de madera con listones sobre terraza', en: 'Timber pergola with slats over the terrace' }, und: 'm²', precio: { CO: 650000, ES: 220, CA: 380, MX: 3800 } },
  chimenea: { n: { es: 'Chimenea a leña con ducto y revestimiento en piedra', en: 'Wood-burning fireplace with flue and stone cladding' }, und: 'und', precio: { CO: 14000000, ES: 5200, CA: 9500, MX: 78000 } },
};

/** Revestimiento de muros de baños y cocina (salpicadero). */
export const ENCHAPES = {
  porcMuro: { cod: 'M-02', n: { es: 'Porcelanato de muro 30 × 60', en: 'Porcelain wall tile 30 × 60' }, tex: 'baldosa', color: '#e7e5e1', junta: 0.6 },
  metro: { cod: 'M-03', n: { es: 'Azulejo tipo metro', en: 'Subway tile' }, tex: 'metro', color: '#f4f3ef' },
  marmolM: { cod: 'M-04', n: { es: 'Mármol en muro', en: 'Marble wall cladding' }, tex: 'marmol', color: '#efede8', junta: 1.2 },
  piedra: { cod: 'M-05', n: { es: 'Enchape de piedra', en: 'Stone cladding' }, tex: 'piedra', color: '#a69c8d' },
  azulejoBlanco: { cod: 'M-06', n: { es: 'Azulejo blanco brillante 10 × 10', en: 'Glossy white tile 10 × 10' }, tex: 'baldosa', color: '#e9eeee', junta: 0.1, pbr: 'azulejoBlanco', m: 1.0 },
  marmolBlancoM: { cod: 'M-07', n: { es: 'Mármol Carrara en muro', en: 'Carrara marble wall' }, tex: 'marmol', color: '#d8d9dc', pbr: 'marmolBlanco', m: 2.0 },
  marmolNegroM: { cod: 'M-08', n: { es: 'Mármol negro Marquina en muro', en: 'Nero Marquina marble wall' }, tex: 'marmol', color: '#26272a', pbr: 'marmolNegro', m: 2.0 },
  travertinoM: { cod: 'M-09', n: { es: 'Travertino en muro', en: 'Travertine wall' }, tex: 'marmol', color: '#e0d2b6', pbr: 'travertino', m: 1.2 },
};

export const ESTILOS = {
  moderno: {
    n: { es: 'Moderno', en: 'Modern' },
    pisos: { social: 'porcGF', privada: 'roble', servicio: 'porc', bano: 'porc', circ: 'porcGF', local: 'porc' },
    enchape: 'porcMuro', paredes: '#eeece7', acento: '#33373c', fachada: '#e9e5dc', madera: 'roble', tela: '#7f868d', telaClara: '#cfc9bf',
    metal: '#1e2023', meson: '#f2f1ee', carpinteria: '#22252a', mult: 1,
  },
  calido: {
    n: { es: 'Cálido natural', en: 'Warm natural' },
    pisos: { social: 'nogal', privada: 'nogal', servicio: 'terracota', bano: 'ceram', circ: 'nogal', local: 'micro' },
    enchape: 'metro', paredes: '#efe6d7', acento: '#a8613b', fachada: '#e8dcc6', madera: 'nogal', tela: '#b78d62', telaClara: '#e4d6c0',
    metal: '#6f5236', meson: '#d9cbb3', carpinteria: '#5a3b26', mult: 1,
  },
  lujo: {
    n: { es: 'Lujo', en: 'Luxury' },
    pisos: { social: 'marmol', privada: 'nogal', servicio: 'porcGF', bano: 'marmol', circ: 'marmol', local: 'porcGF' },
    enchape: 'marmolM', paredes: '#f3f0ea', acento: '#123f3a', fachada: '#efebe3', madera: 'nogal', tela: '#1f4d45', telaClara: '#e9e1d3',
    metal: '#b8964f', meson: '#f4f2ee', carpinteria: '#1b1d20', mult: 2.2,
  },
  nordico: {
    n: { es: 'Nórdico', en: 'Scandinavian' },
    pisos: { social: 'roble', privada: 'roble', servicio: 'porc', bano: 'micro', circ: 'roble', local: 'micro' },
    enchape: 'metro', paredes: '#f7f6f3', acento: '#8fa39b', fachada: '#f4f2ee', madera: 'roble', tela: '#d7d3cb', telaClara: '#efece6',
    metal: '#e2e2e0', meson: '#fbfbfa', carpinteria: '#f2f2f0', mult: 0.95,
  },
  campestre: {
    n: { es: 'Campestre', en: 'Country' },
    pisos: { social: 'terracota', privada: 'teca', servicio: 'ceram', bano: 'ceram', circ: 'terracota', local: 'concreto' },
    enchape: 'piedra', paredes: '#f1e8d9', acento: '#5d6a39', fachada: '#eadfca', madera: 'teca', tela: '#a6865a', telaClara: '#e2d5bf',
    metal: '#2b2a28', meson: '#7b6f61', carpinteria: '#6b4a2e', mult: 0.9,
  },
};

/**
 * Muebles y aparatos. Medidas en metros (ancho a lo largo del muro, fondo,
 * alto). precio por pais, en la moneda local, calidad media; el estilo lo
 * multiplica. obra: se paga en el presupuesto de obra.
 */
export const MUEBLES = {
  cama: { n: { es: 'Cama', en: 'Bed' }, h: 0.55, var: { sencilla: [1.0, 1.95], doble: [1.4, 1.95], queen: [1.6, 2.05], king: [2.0, 2.05] }, precio: { CO: 2800000, ES: 900, CA: 1500, MX: 14000 } },
  mesaNoche: { n: { es: 'Mesa de noche', en: 'Nightstand' }, w: 0.45, d: 0.4, h: 0.55, precio: { CO: 450000, ES: 150, CA: 250, MX: 2500 } },
  closet: { n: { es: 'Clóset', en: 'Closet' }, d: 0.6, h: 2.3, obra: true },
  comoda: { n: { es: 'Cómoda', en: 'Dresser' }, w: 1.2, d: 0.5, h: 0.8, precio: { CO: 900000, ES: 350, CA: 600, MX: 6000 } },
  escritorio: { n: { es: 'Escritorio', en: 'Desk' }, w: 1.4, d: 0.7, h: 0.75, precio: { CO: 800000, ES: 300, CA: 450, MX: 4500 } },
  sillaEsc: { n: { es: 'Silla de escritorio', en: 'Desk chair' }, w: 0.6, d: 0.6, h: 1.0, precio: { CO: 450000, ES: 150, CA: 250, MX: 2500 } },
  biblioteca: { n: { es: 'Biblioteca', en: 'Bookcase' }, w: 1.0, d: 0.35, h: 2.0, precio: { CO: 700000, ES: 250, CA: 400, MX: 4000 } },
  sofa: { n: { es: 'Sofá de 3 puestos', en: '3-seat sofa' }, w: 2.2, d: 0.92, h: 0.82, precio: { CO: 3500000, ES: 1100, CA: 1800, MX: 18000 } },
  poltrona: { n: { es: 'Poltrona', en: 'Armchair' }, w: 0.82, d: 0.82, h: 0.8, precio: { CO: 1200000, ES: 400, CA: 700, MX: 6500 } },
  mesaCentro: { n: { es: 'Mesa de centro', en: 'Coffee table' }, w: 1.1, d: 0.6, h: 0.4, precio: { CO: 600000, ES: 200, CA: 350, MX: 3500 } },
  muebleTV: { n: { es: 'Mueble y televisor', en: 'TV unit and TV' }, w: 1.8, d: 0.45, h: 0.5, precio: { CO: 3400000, ES: 900, CA: 1400, MX: 16000 } },
  tapete: { n: { es: 'Tapete', en: 'Rug' }, h: 0.01, precio: { CO: 700000, ES: 200, CA: 350, MX: 3500 } },
  lampara: { n: { es: 'Lámpara de pie', en: 'Floor lamp' }, w: 0.4, d: 0.4, h: 1.6, precio: { CO: 400000, ES: 120, CA: 200, MX: 2000 } },
  comedor: { n: { es: 'Comedor', en: 'Dining set' }, h: 0.76, var: { c4: [1.2, 0.85], c6: [1.8, 0.95], c8: [2.3, 1.0] }, precio: { CO: 3600000, ES: 1150, CA: 1900, MX: 18000 } },
  cocinaBase: { n: { es: 'Cocina integral', en: 'Kitchen cabinets' }, d: 0.62, h: 0.92, obra: true },
  nevera: { n: { es: 'Nevera', en: 'Refrigerator' }, w: 0.78, d: 0.72, h: 1.8, precio: { CO: 3200000, ES: 900, CA: 1800, MX: 16000 } },
  estufa: { n: { es: 'Estufa y horno', en: 'Range' }, w: 0.76, d: 0.62, h: 0.92, precio: { CO: 2000000, ES: 600, CA: 1200, MX: 9000 } },
  lavaplatos: { n: { es: 'Lavaplatos', en: 'Kitchen sink' }, w: 0.8, d: 0.62, h: 0.92, obra: true },
  isla: { n: { es: 'Isla de cocina', en: 'Kitchen island' }, d: 0.9, h: 0.92, obra: true },
  inodoro: { n: { es: 'Sanitario', en: 'Toilet' }, w: 0.42, d: 0.7, h: 0.78, obra: true },
  lavamanos: { n: { es: 'Mueble de lavamanos', en: 'Vanity' }, d: 0.5, h: 0.85, obra: true },
  ducha: { n: { es: 'Ducha', en: 'Shower' }, h: 2.1, obra: true },
  tina: { n: { es: 'Tina', en: 'Bathtub' }, w: 1.6, d: 0.75, h: 0.55, obra: true },
  lavadora: { n: { es: 'Lavadora', en: 'Washer' }, w: 0.62, d: 0.65, h: 0.88, precio: { CO: 2200000, ES: 500, CA: 1000, MX: 11000 } },
  secadora: { n: { es: 'Secadora', en: 'Dryer' }, w: 0.62, d: 0.65, h: 0.88, precio: { CO: 1800000, ES: 450, CA: 900, MX: 9500 } },
  lavadero: { n: { es: 'Lavadero', en: 'Laundry sink' }, w: 0.6, d: 0.6, h: 0.9, obra: true },
  mostrador: { n: { es: 'Mostrador', en: 'Counter' }, w: 2.0, d: 0.6, h: 1.05, precio: { CO: 2500000, ES: 900, CA: 1500, MX: 12000 } },
  estante: { n: { es: 'Estantería', en: 'Shelving' }, w: 1.0, d: 0.45, h: 2.0, precio: { CO: 600000, ES: 200, CA: 350, MX: 3000 } },
  planta: { n: { es: 'Matera con planta', en: 'Planter' }, w: 0.45, d: 0.45, h: 1.3, precio: { CO: 250000, ES: 70, CA: 120, MX: 1200 } },
  cuadro: { n: { es: 'Cuadro', en: 'Artwork' }, w: 0.9, d: 0.04, h: 0.6, precio: { CO: 300000, ES: 100, CA: 150, MX: 1500 } },
};

/** Enchape de baños y cocina: el escogido a mano o el del estilo. */
export const enchapeDe = S => ENCHAPES[S.acabados?.enchape] || ENCHAPES[(ESTILOS[S.acabados?.estilo] || ESTILOS.moderno).enchape] || ENCHAPES.porcMuro;
/** Piso exterior de terrazas, balcones, patios y playa de la piscina. */
export const pisoExtDe = S => (PISOS[S.acabados?.pisoExt] ? S.acabados.pisoExt : 'ceram');

export const TIPOS_ESPACIO = {
  sala: { es: 'Sala', en: 'Living' }, comedor: { es: 'Comedor', en: 'Dining' }, cocina: { es: 'Cocina', en: 'Kitchen' },
  alcobaP: { es: 'Alcoba principal', en: 'Main bedroom' }, alcoba: { es: 'Alcoba', en: 'Bedroom' },
  banoP: { es: 'Baño principal', en: 'Main bath' }, bano: { es: 'Baño', en: 'Bathroom' }, banoS: { es: 'Baño social', en: 'Powder room' },
  estudio: { es: 'Estudio', en: 'Study' }, ropas: { es: 'Patio de ropas', en: 'Laundry' }, local: { es: 'Local', en: 'Store' },
  bodega: { es: 'Bodega', en: 'Storage' }, estar: { es: 'Estar', en: 'Family room' }, otro: { es: 'Espacio', en: 'Room' },
};

/** Tipo de espacio a partir del nombre que escribe el usuario (es, en, fr). */
export function tipoEspacio(nombre = '', zona = 'social') {
  // sin tildes: «Salón», «Recámara» y «Depósito» se reconocen igual escritos con o sin tilde
  const n = nombre.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const es = re => re.test(n);
  if (es(/ba[ñn]o|wc|aseo|sanitario|bath|toilet|washroom|powder|ensuite|salle d.eau|salle de bain|toilette/)) {
    if (es(/social|visita|powder|aseo|toilette|wc|medio|half|guest/)) return 'banoS';
    if (es(/principal|master|main|primary|ensuite|suite/)) return 'banoP';
    return 'bano';
  }
  if (es(/cuarto de lavado|\blavado\b|patio de servicio|service yard/)) return 'ropas';
  if (es(/alcoba|habitaci|dormitorio|cuarto|rec[aá]mara|bedroom|chambre|suite/)) return es(/principal|master|main|primary/) ? 'alcobaP' : 'alcoba';
  if (es(/cocina|kitchen|cuisine/)) return 'cocina';
  if (es(/comedor|dining|salle a manger|manger/)) return /sala|living|salon|estancia/.test(n) ? 'sala' : 'comedor';
  // «Den / office» y «Estudio / oficina» son estudio, no estar
  if (es(/estudio|oficina|office|study|bureau|despacho/)) return 'estudio';
  if (es(/estar|family|familiar|den\b|tv/)) return 'estar';
  if (es(/sala|living|salon|great room|lounge|estancia/)) return 'sala';
  if (es(/ropas|lavander|laundry|buanderie|utility|lavadero/)) return 'ropas';
  if (es(/local|comercial|store|shop|retail|tienda|commerce/)) return 'local';
  if (es(/bodega|dep[oó]sito|storage|trastero|rangement|garaje|garage|cochera/)) return 'bodega';
  return zona === 'privada' ? 'alcoba' : zona === 'servicio' ? 'bodega' : 'otro';
}
