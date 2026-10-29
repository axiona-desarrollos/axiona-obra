/* ==========================================================================
   AXIONA OBRA · Catalogo de acabados, estilos y dotacion
   --------------------------------------------------------------------------
   Pisos, muros y muebles con sus medidas y precios de referencia por pais.
   El estilo escoge un acabado por zona y la paleta del 3D; cada espacio se
   puede cambiar a mano. Lo que va pegado a la obra (closets, cocina
   integral, aparatos sanitarios) se paga en el presupuesto de obra y aqui
   lleva obra: true para no contarlo dos veces.
   ========================================================================== */

/** Pisos: textura para el 3D, codigo para el cuadro de acabados y precio por m². */
export const PISOS = {
  porc: { cod: 'P-01', n: { es: 'Porcelanato gris claro 60 × 60', en: 'Light grey porcelain tile 60 × 60' }, tex: 'baldosa', color: '#d4d6d8', junta: 0.6, precio: { CO: 98000, ES: 45, CA: 120 } },
  porcGF: { cod: 'P-02', n: { es: 'Porcelanato gran formato efecto mármol 60 × 120', en: 'Large-format marble-look porcelain 60 × 120' }, tex: 'marmol', color: '#eeece8', junta: 1.2, precio: { CO: 155000, ES: 62, CA: 170 } },
  marmol: { cod: 'P-03', n: { es: 'Mármol blanco natural', en: 'White natural marble' }, tex: 'marmol', color: '#f1efea', junta: 0.8, precio: { CO: 380000, ES: 150, CA: 320 } },
  roble: { cod: 'P-04', n: { es: 'Madera de roble de ingeniería', en: 'Engineered white oak' }, tex: 'madera', tono: 'roble', precio: { CO: 240000, ES: 75, CA: 140 } },
  nogal: { cod: 'P-05', n: { es: 'Madera de nogal', en: 'Walnut hardwood' }, tex: 'madera', tono: 'nogal', precio: { CO: 290000, ES: 95, CA: 180 } },
  teca: { cod: 'P-06', n: { es: 'Madera de teca', en: 'Teak' }, tex: 'madera', tono: 'teca', precio: { CO: 260000, ES: 90, CA: 175 } },
  spc: { cod: 'P-07', n: { es: 'Vinilo SPC tipo madera', en: 'Luxury vinyl plank (SPC)' }, tex: 'madera', tono: 'gris', precio: { CO: 80000, ES: 32, CA: 60 } },
  micro: { cod: 'P-08', n: { es: 'Microcemento', en: 'Microcement' }, tex: 'cemento', color: '#b9b4ac', precio: { CO: 170000, ES: 70, CA: 150 } },
  ceram: { cod: 'P-09', n: { es: 'Cerámica antideslizante', en: 'Non-slip ceramic tile' }, tex: 'baldosa', color: '#cfc8bd', junta: 0.33, precio: { CO: 68000, ES: 30, CA: 90 } },
  terracota: { cod: 'P-10', n: { es: 'Baldosa de terracota', en: 'Terracotta tile' }, tex: 'baldosa', color: '#b8693f', junta: 0.3, precio: { CO: 90000, ES: 38, CA: 110 } },
  concreto: { cod: 'P-11', n: { es: 'Concreto pulido', en: 'Polished concrete' }, tex: 'cemento', color: '#9c9a96', precio: { CO: 60000, ES: 35, CA: 70 } },
};

/** Revestimiento de muros de baños y cocina (salpicadero). */
export const ENCHAPES = {
  porcMuro: { cod: 'M-02', n: { es: 'Porcelanato de muro 30 × 60', en: 'Porcelain wall tile 30 × 60' }, tex: 'baldosa', color: '#e7e5e1', junta: 0.6 },
  metro: { cod: 'M-03', n: { es: 'Azulejo tipo metro', en: 'Subway tile' }, tex: 'metro', color: '#f4f3ef' },
  marmolM: { cod: 'M-04', n: { es: 'Mármol en muro', en: 'Marble wall cladding' }, tex: 'marmol', color: '#efede8', junta: 1.2 },
  piedra: { cod: 'M-05', n: { es: 'Enchape de piedra', en: 'Stone cladding' }, tex: 'piedra', color: '#a69c8d' },
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
  cama: { n: { es: 'Cama', en: 'Bed' }, h: 0.55, var: { sencilla: [1.0, 1.95], doble: [1.4, 1.95], queen: [1.6, 2.05], king: [2.0, 2.05] }, precio: { CO: 2800000, ES: 900, CA: 1500 } },
  mesaNoche: { n: { es: 'Mesa de noche', en: 'Nightstand' }, w: 0.45, d: 0.4, h: 0.55, precio: { CO: 450000, ES: 150, CA: 250 } },
  closet: { n: { es: 'Clóset', en: 'Closet' }, d: 0.6, h: 2.3, obra: true },
  comoda: { n: { es: 'Cómoda', en: 'Dresser' }, w: 1.2, d: 0.5, h: 0.8, precio: { CO: 900000, ES: 350, CA: 600 } },
  escritorio: { n: { es: 'Escritorio', en: 'Desk' }, w: 1.4, d: 0.7, h: 0.75, precio: { CO: 800000, ES: 300, CA: 450 } },
  sillaEsc: { n: { es: 'Silla de escritorio', en: 'Desk chair' }, w: 0.6, d: 0.6, h: 1.0, precio: { CO: 450000, ES: 150, CA: 250 } },
  biblioteca: { n: { es: 'Biblioteca', en: 'Bookcase' }, w: 1.0, d: 0.35, h: 2.0, precio: { CO: 700000, ES: 250, CA: 400 } },
  sofa: { n: { es: 'Sofá de 3 puestos', en: '3-seat sofa' }, w: 2.2, d: 0.92, h: 0.82, precio: { CO: 3500000, ES: 1100, CA: 1800 } },
  poltrona: { n: { es: 'Poltrona', en: 'Armchair' }, w: 0.82, d: 0.82, h: 0.8, precio: { CO: 1200000, ES: 400, CA: 700 } },
  mesaCentro: { n: { es: 'Mesa de centro', en: 'Coffee table' }, w: 1.1, d: 0.6, h: 0.4, precio: { CO: 600000, ES: 200, CA: 350 } },
  muebleTV: { n: { es: 'Mueble y televisor', en: 'TV unit and TV' }, w: 1.8, d: 0.45, h: 0.5, precio: { CO: 3400000, ES: 900, CA: 1400 } },
  tapete: { n: { es: 'Tapete', en: 'Rug' }, h: 0.01, precio: { CO: 700000, ES: 200, CA: 350 } },
  lampara: { n: { es: 'Lámpara de pie', en: 'Floor lamp' }, w: 0.4, d: 0.4, h: 1.6, precio: { CO: 400000, ES: 120, CA: 200 } },
  comedor: { n: { es: 'Comedor', en: 'Dining set' }, h: 0.76, var: { c4: [1.2, 0.85], c6: [1.8, 0.95], c8: [2.3, 1.0] }, precio: { CO: 3600000, ES: 1150, CA: 1900 } },
  cocinaBase: { n: { es: 'Cocina integral', en: 'Kitchen cabinets' }, d: 0.62, h: 0.92, obra: true },
  nevera: { n: { es: 'Nevera', en: 'Refrigerator' }, w: 0.78, d: 0.72, h: 1.8, precio: { CO: 3200000, ES: 900, CA: 1800 } },
  estufa: { n: { es: 'Estufa y horno', en: 'Range' }, w: 0.76, d: 0.62, h: 0.92, precio: { CO: 2000000, ES: 600, CA: 1200 } },
  lavaplatos: { n: { es: 'Lavaplatos', en: 'Kitchen sink' }, w: 0.8, d: 0.62, h: 0.92, obra: true },
  isla: { n: { es: 'Isla de cocina', en: 'Kitchen island' }, d: 0.9, h: 0.92, obra: true },
  inodoro: { n: { es: 'Sanitario', en: 'Toilet' }, w: 0.42, d: 0.7, h: 0.78, obra: true },
  lavamanos: { n: { es: 'Mueble de lavamanos', en: 'Vanity' }, d: 0.5, h: 0.85, obra: true },
  ducha: { n: { es: 'Ducha', en: 'Shower' }, h: 2.1, obra: true },
  tina: { n: { es: 'Tina', en: 'Bathtub' }, w: 1.6, d: 0.75, h: 0.55, obra: true },
  lavadora: { n: { es: 'Lavadora', en: 'Washer' }, w: 0.62, d: 0.65, h: 0.88, precio: { CO: 2200000, ES: 500, CA: 1000 } },
  secadora: { n: { es: 'Secadora', en: 'Dryer' }, w: 0.62, d: 0.65, h: 0.88, precio: { CO: 1800000, ES: 450, CA: 900 } },
  lavadero: { n: { es: 'Lavadero', en: 'Laundry sink' }, w: 0.6, d: 0.6, h: 0.9, obra: true },
  mostrador: { n: { es: 'Mostrador', en: 'Counter' }, w: 2.0, d: 0.6, h: 1.05, precio: { CO: 2500000, ES: 900, CA: 1500 } },
  estante: { n: { es: 'Estantería', en: 'Shelving' }, w: 1.0, d: 0.45, h: 2.0, precio: { CO: 600000, ES: 200, CA: 350 } },
  planta: { n: { es: 'Matera con planta', en: 'Planter' }, w: 0.45, d: 0.45, h: 1.3, precio: { CO: 250000, ES: 70, CA: 120 } },
  cuadro: { n: { es: 'Cuadro', en: 'Artwork' }, w: 0.9, d: 0.04, h: 0.6, precio: { CO: 300000, ES: 100, CA: 150 } },
};

export const TIPOS_ESPACIO = {
  sala: { es: 'Sala', en: 'Living' }, comedor: { es: 'Comedor', en: 'Dining' }, cocina: { es: 'Cocina', en: 'Kitchen' },
  alcobaP: { es: 'Alcoba principal', en: 'Main bedroom' }, alcoba: { es: 'Alcoba', en: 'Bedroom' },
  banoP: { es: 'Baño principal', en: 'Main bath' }, bano: { es: 'Baño', en: 'Bathroom' }, banoS: { es: 'Baño social', en: 'Powder room' },
  estudio: { es: 'Estudio', en: 'Study' }, ropas: { es: 'Patio de ropas', en: 'Laundry' }, local: { es: 'Local', en: 'Store' },
  bodega: { es: 'Bodega', en: 'Storage' }, estar: { es: 'Estar', en: 'Family room' }, otro: { es: 'Espacio', en: 'Room' },
};

/** Tipo de espacio a partir del nombre que escribe el usuario (es, en, fr). */
export function tipoEspacio(nombre = '', zona = 'social') {
  const n = nombre.toLowerCase();
  const es = re => re.test(n);
  if (es(/ba[ñn]o|wc|aseo|sanitario|bath|toilet|washroom|powder|ensuite|salle d.eau|salle de bain|toilette/)) {
    if (es(/social|visita|powder|aseo|toilette|wc/)) return 'banoS';
    if (es(/principal|master|main|primary|ensuite|suite/)) return 'banoP';
    return 'bano';
  }
  if (es(/alcoba|habitaci|dormitorio|cuarto|rec[aá]mara|bedroom|chambre|suite/)) return es(/principal|master|main|primary/) ? 'alcobaP' : 'alcoba';
  if (es(/cocina|kitchen|cuisine/)) return 'cocina';
  if (es(/comedor|dining|salle à manger|manger/)) return /sala|living|salon/.test(n) ? 'sala' : 'comedor';
  if (es(/estar|family|familiar|den\b|tv/)) return 'estar';
  if (es(/sala|living|salon|great room|lounge/)) return 'sala';
  if (es(/estudio|oficina|office|study|bureau|despacho/)) return 'estudio';
  if (es(/ropas|lavander|laundry|buanderie|utility|lavadero/)) return 'ropas';
  if (es(/local|comercial|store|shop|retail|tienda|commerce/)) return 'local';
  if (es(/bodega|dep[oó]sito|storage|trastero|rangement|garaje|garage/)) return 'bodega';
  return zona === 'privada' ? 'alcoba' : zona === 'servicio' ? 'bodega' : 'otro';
}
