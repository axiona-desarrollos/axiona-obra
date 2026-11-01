/* ==========================================================================
   AXIONA OBRA · Axi entiende inglés
   --------------------------------------------------------------------------
   Traduce una orden en inglés (ya normalizada: minúsculas, sin tildes ni
   signos) a las palabras clave en español que entiende el cerebro local.
   Así todo lo que Axi sabe hacer funciona igual en los dos idiomas sin
   duplicar la lógica. El orden importa: primero las frases largas.
   ========================================================================== */

const NUMEROS = { one: 'una', two: 'dos', three: 'tres', four: 'cuatro', five: 'cinco', six: 'seis', seven: 'siete', eight: 'ocho', nine: 'nueve', ten: 'diez', eleven: 'once', twelve: 'doce', fifteen: 'quince', twenty: 'veinte', thirty: 'treinta' };
const ORDINALES = { first: 'primer', ground: 'primer', second: 'segundo', third: 'tercer', fourth: 'cuarto', fifth: 'quinto', sixth: 'sexto', seventh: 'septimo', eighth: 'octavo' };

const FRASES = [
  // saludos, ayuda y contacto
  [/^(hi|hello|hey there|hey|good morning|good afternoon|good evening)\b/, 'hola'],
  [/^(thanks|thank you|thanks a lot|thank you very much)\b/, 'gracias'],
  [/\b(what can you do|what do you do|how do you work|help me|help|commands)\b/, 'que puedes hacer'],
  [/\b(talk|speak|chat) (to|with) (a person|someone|a human|an advisor|support|the team)\b|\bcontact (you|the team|support)\b|\bcustomer support\b/, 'hablar con una persona'],
  [/\b(leave|write) a review\b|\brate the app\b/, 'quiero dejar una resena'],
  [/\b(i have )?(a )?(suggestion|proposal|idea) (to|for) improve( the app)?\b/, 'tengo una propuesta para mejorar la app'],
  // costo y datos del proyecto
  [/\bhow much (does it|will it|would it|does the house) cost\b|\bhow much is it\b|\bwhat does it cost\b|\btotal cost\b|\bhow much\b/, 'cuanto cuesta'],
  [/\bhow (many square meters|big is it|large is it|many m2)\b|\bbuilt area\b/, 'cuantos metros'],
  [/\bwhat rooms (are there|does it have)\b|\b(list|which) (the )?rooms\b|\bwhat rooms\b/, 'que espacios hay'],
  [/\b(any )?(warnings|problems|issues)\b|\bis anything wrong\b/, 'avisos'],
  [/\bhow (can|do) i save( money)?\b|\bsave money\b|\bcheaper\b|\breduce (the )?cost\b/, 'como puedo ahorrar'],
  // proyecto nuevo, ejemplos e idioma
  [/\bstart (from scratch|over|fresh)\b|\bfrom scratch\b|\bnew project\b|\bblank project\b|\bdesign my own( house)?\b/, 'empezar de cero'],
  [/\b(show|see) (the )?(examples|templates)\b/, 'ver ejemplos'],
  [/\b(examples|templates)\b/, 'ejemplos'],
  [/\bload\b/, 'carga'],
  [/\b(in )?spanish\b/, 'en espanol'],
  [/\b(in )?english\b/, 'en ingles'],
  [/\b(switch|change)( the country)? to\b/, 'cambia a'],
  [/\bspain\b/, 'espana'],
  // lote
  [/\b(?:lot|plot|site) (?:of )?(\d+(?:[.,]\d+)?) ?(?:m |meters |metres )?(?:x|by) (\d+(?:[.,]\d+)?)\b/, 'lote de $1 por $2'],
  // forma del edificio
  [/\b(courtyard house|central courtyard|inner courtyard|colonial house|around a courtyard|with a courtyard|patio house)\b/, 'casa con patio central'],
  [/\bl[- ]?shaped?\b|\b(in )?(an |the )?l shape\b/, 'en l'],
  [/\bu[- ]?shaped?\b|\b(in )?(a |the )?u shape\b/, 'en u'],
  [/\b(front and side|both ways|both directions)\b/, 'al frente y de lado'],
  [/\b(also on the side|on the side too|also (step )?it on the side)\b/, 'tambien de lado'],
  [/\bside terraces?\b/, 'terraza lateral'],
  [/\b(front terraces?|terraces? (at|in) the front)\b/, 'terrazas al frente'],
  [/\b(stepped|step it|terraced)\b/, 'escalonada'],
  [/\bsetback of\b/, 'retroceso de'],
  [/\b(straight( form| shape)?|all floors (the )?same|no terraces)\b/, 'forma recta'],
  [/\b(bay window|curves|curved|rounded|round)\b/, 'curvas'],
  [/\borganic\b/, 'organica'],
  [/\bmake (.+?) bigger\b/, 'agranda $1'],
  [/\bmake (.+?) smaller\b/, 'achica $1'],
  [/\bmake it\b/, 'hazla'],
  // cubierta, sistema, ascensor y muebles
  [/\b(flat roof|roof terrace)\b/, 'techo plano'],
  [/\b(gable(d)? roof|pitched roof|two[- ]?(pitch|slope|sided) roof)\b/, 'techo a dos aguas'],
  [/\b(hip(ped)? roof|four[- ]?(pitch|slope|sided) roof)\b/, 'techo a cuatro aguas'],
  [/\broof\b/, 'techo'],
  [/\b(confined masonry|masonry)\b/, 'mamposteria confinada'],
  [/\b(reinforced )?concrete frame\b|\bmoment frame\b/, 'porticos'],
  [/\b(no|without an?|remove the) (elevator|lift)\b/, 'sin ascensor'],
  [/\b(elevator|lift)\b/, 'ascensor'],
  [/\b(no|without) furniture\b|\bunfurnish(ed)?\b|\bremove (the )?furniture\b/, 'sin muebles'],
  [/\bfurnished\b|\bdecorated\b/, 'amoblada'],
  [/\b(furnish|decorate)( it)?\b|\bwith furniture\b/, 'amobla'],
  // realidad aumentada
  [/\b(augmented reality|ar)\b/, 'realidad aumentada'],
  [/\b(no|without a?) marker\b/, 'sin marcador'],
  [/\bmarkers?\b/, 'marcadores'],
  [/\bon (my|the) table\b/, 'sobre mi mesa'],
  [/\b(full (size|scale)|real scale)\b/, 'escala real'],
  // 3D, planos y descargas
  [/\b(bricks?|structure|skeleton|shell)\b/, 'ladrillos'],
  [/\brough (work|stage|finish)\b|\bplaster(ing)?\b/, 'obra gris'],
  [/\bfinished( house)?\b|\bfinal finishes\b/, 'terminada'],
  [/\bwalk (through|around|inside)\b|\bwalkthrough\b|\btour\b/, 'recorrer'],
  [/\b(photo|picture|screenshot)\b/, 'foto'],
  [/\broof plan\b/, 'planta de cubierta'],
  [/\b(floor plans|plans|drawings|blueprints|sheets)\b/, 'planos'],
  [/\b(facades?|elevations?)\b/, 'fachadas'],
  [/\bsections?\b/, 'corte'],
  [/\b(budget|quantities|costs)\b/, 'presupuesto'],
  [/\b(interiors?|finishes)\b/, 'interiores'],
  [/\b(room )?program\b/, 'programa'],
  [/\b(land|terrain)\b/, 'terreno'],
  [/\blots?\b|\bplot\b/, 'lote'],
  [/\bsales\b/, 'ventas'],
  [/\b3d model\b|\bmodel\b/, '3d'],
  [/\bspreadsheet\b/, 'excel'],
  [/\bmeasure with axiona topo\b|\bopen topo\b/, 'medir con axiona topo'],
  [/\bshare\b|\bsend (it )?to (the )?client\b/, 'comparte'],
  // espacios
  [/\b(master|main|primary) bedrooms?\b/, 'alcoba principal'],
  [/\b(master|main|primary) (ensuite )?bath(room)?s?\b|\bensuite\b/, 'bano principal'],
  [/\b(powder room|half bath(room)?|guest bath(room)?|guest toilet)\b/, 'bano social'],
  [/\bbedrooms\b/, 'alcobas'], [/\bbedroom\b/, 'alcoba'],
  [/\bbathrooms\b|\bbaths\b/, 'banos'], [/\bbathroom\b|\bbath\b|\btoilet\b/, 'bano'],
  [/\bkitchens\b/, 'cocinas'], [/\bkitchen\b/, 'cocina'],
  [/\bliving[- ]dining( room)?\b/, 'sala comedor'],
  [/\bdining( room)?\b/, 'comedor'],
  [/\b(family room|tv room|den)\b/, 'estar familiar'],
  [/\bliving( room)?\b|\blounge\b/, 'sala'],
  [/\b(home office|study|office)\b/, 'estudio'],
  [/\b(laundry( room)?|mudroom)\b/, 'patio de ropas'],
  [/\bterraces\b/, 'terrazas'], [/\bterrace\b/, 'terraza'],
  [/\bbalconies\b/, 'balcones'], [/\bbalcony\b/, 'balcon'],
  [/\bgarages?\b|\bparking\b/, 'garaje'],
  [/\b(retail )?(store|shop)s?\b/, 'local comercial'],
  [/\b(storage|warehouse)\b/, 'bodega'],
  [/\bgym\b/, 'gimnasio'],
  [/\b(staff|maid'?s?) (bed)?room\b/, 'alcoba de servicio'],
  // acabados de piso
  [/\blarge[- ]format porcelain( tile)?\b/, 'porcelanato de gran formato'],
  [/\bporcelain( tiles?)?\b|\btiles?\b/, 'porcelanato'],
  [/\bmarble\b/, 'marmol'], [/\bwalnut\b/, 'nogal'], [/\bteak\b/, 'teca'],
  [/\b(hardwood|wood|oak|laminate)\b/, 'madera'], [/\b(vinyl|lvp)\b/, 'vinilo'], [/\bmicrocement\b/, 'microcemento'],
  [/\bceramic\b/, 'ceramica'], [/\bterracotta\b/, 'terracota'], [/\bpolished concrete\b/, 'concreto pulido'],
  [/\b(the )?whole house\b|\beverywhere\b|\ball (the )?rooms\b|\bthroughout\b/, 'toda la casa'],
  [/\bstyle\b/, 'estilo'],
  // pisos de la edificación
  [/(\d)[- ](storey|story|floor|level)s?\b/, '$1 pisos'],
  [/\b(one more|another|add a|add one more) (floor|storey|story|level)\b/, 'un piso mas'],
  [/\b(one less|remove a|remove one) (floor|storey|story|level)\b/, 'un piso menos'],
  [/\b(floors|storeys|stories|levels)\b/, 'pisos'],
  [/\b(upstairs|top floor)\b/, 'arriba'], [/\bdownstairs\b/, 'abajo'],
  [/\b(floor|storey|story|level)\b/, 'piso'],
  // verbos
  [/\b(show me|show|open|go to|take me to|let me see|i want to see|see|view)\b/, 'muestrame'],
  [/\b(download|export|give me|send me|generate)\b/, 'descarga'],
  [/\b(remove|delete|take out|get rid of|drop)\b/, 'quita'],
  [/\b(enlarge|expand|increase)\b/, 'agranda'],
  [/\b(shrink|reduce|decrease)\b/, 'achica'],
  [/\brename\b/, 'renombra'],
  [/\bmove\b/, 'pasa'],
  [/\b(add|put|insert|include|i want|i need|create|make me)\b/, 'agrega'],
  [/\bset\b/, 'pon'],
  // enlaces y medidas
  [/\b(square meters|square metres|sqm|sq m)\b/, 'm2'],
  [/\b(meters|metres)\b/, 'metros'],
  [/\bto (\d)/, 'a $1'],
  [/\bmore\b/, 'mas'],
  [/\band\b/, 'y'],
  [/\bwith\b/, 'con'],
  [/\bin\b/, 'en'],
  [/\bon\b/, 'en'],
];

/** Traduce la orden en inglés (normalizada) a palabras clave en español. */
export function aEspanol(t) {
  let s = String(t).trim();
  for (const [re, por] of FRASES) s = s.replace(new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g'), por);
  s = s.replace(/\b(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|fifteen|twenty|thirty)\b/g, m => NUMEROS[m]);
  s = s.replace(/\b(first|ground|second|third|fourth|fifth|sixth|seventh|eighth) piso\b/g, (_, o) => `${ORDINALES[o]} piso`);
  // los artículos del inglés no aportan (la «a» se queda: en español es preposición)
  s = s.replace(/\b(the|an)\b/g, ' ');
  return s.replace(/\s+/g, ' ').trim();
}

const MARCAS = /\b(the|add|show|remove|delete|please|make|bedrooms?|bathrooms?|kitchen|living|floors?|storeys?|stories|house|rooms?|download|how much|what|courtyard|curves|furniture|roof|marker|start|hello|hi|thanks|walls?|wood|tiles?|budget)\b/g;

/** ¿La frase está en inglés? (dos o más palabras típicas del inglés) */
export function pareceIngles(t) {
  return (String(t).match(MARCAS) || []).length >= 2;
}
