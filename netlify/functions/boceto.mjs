// AXIONA OBRA · Axi lee bocetos: recibe la foto o el escaneo de un boceto en papel (o un plano sencillo) y, con Claude
// de Anthropic (visión) por el AI Gateway de Netlify, devuelve el programa arquitectónico para armar el modelo 3D.
// Netlify inyecta ANTHROPIC_API_KEY y ANTHROPIC_BASE_URL; aquí no se guarda ninguna clave.
// Límite de uso por equipo y por día (Netlify Blobs) para cuidar los créditos del sitio.
import Anthropic from '@anthropic-ai/sdk';
import { getStore } from '@netlify/blobs';

const MODELO = process.env.BOCETO_MODELO || 'claude-sonnet-5-5';
const POR_IP = +(process.env.BOCETO_POR_IP || 10), POR_DIA = +(process.env.BOCETO_POR_DIA || 300);
const MAX = 5_500_000;

// Deben coincidir con las claves del catálogo de la app (lo verifica tests/boceto.test.js).
export const ENUMS = {
  estilo: ['moderno', 'calido', 'lujo', 'nordico', 'campestre'],
  forma: ['recta', 'terrazas', 'lateral', 'escalonada', 'ele', 'u', 'patio'],
  cubierta: ['plana', 'dos', 'cuatro'],
  fachada: ['estuco', 'ladrillo', 'ladrilloOscuro', 'piedraClara', 'piedraBlanca', 'piedraGris', 'microGris', 'marmolBlanco', 'listones'],
  teja: ['sistema', 'tejaBarro', 'tejaNegra', 'pizarra'],
  piso: ['porc', 'porcGF', 'marmol', 'roble', 'nogal', 'teca', 'spc', 'micro', 'ceram', 'terracota', 'concreto', 'porcBlanco', 'porcNegro', 'marmolBlanco', 'marmolNegro', 'travertino', 'terrazo', 'microGris', 'maderaMiel', 'parque', 'robleClaro', 'piedraGris'],
  cielo: ['estuco', 'listones'],
};

const r = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' } });
const num = { type: 'number' }, ent = { type: 'integer' }, bool = { type: 'boolean' }, txt = { type: 'string' };
const en = v => ({ type: 'string', enum: v });
const obj = (props) => ({ type: 'object', additionalProperties: false, required: Object.keys(props), properties: props });

export const ESQUEMA = obj({
  lectura: txt,
  confianza: en(['baja', 'media', 'alta']),
  nombre_proyecto: txt,
  lote: obj({ frente: num, fondo: num }),
  pisos: ent,
  espacios: { type: 'array', items: obj({ nombre: txt, area: num, piso: ent, zona: en(['social', 'privada', 'servicio']) }) },
  estilo: en(ENUMS.estilo),
  forma: en(ENUMS.forma),
  cubierta: en(ENUMS.cubierta),
  fachada: en(ENUMS.fachada),
  fachada_primer_piso: en(['ninguna', ...ENUMS.fachada]),
  teja: en(ENUMS.teja),
  piso_social: en(ENUMS.piso),
  piso_alcobas: en(ENUMS.piso),
  piso_banos: en(ENUMS.piso),
  cielo: en(ENUMS.cielo),
  piscina: obj({ tiene: bool, interior: bool, largo: num, ancho: num, profundidad: num }),
  parqueaderos: ent,
  chimenea: bool, pergola: bool, ascensor: bool, balcones: bool, curvas: bool,
  supuestos: { type: 'array', items: txt },
  dudas: { type: 'array', items: txt },
});

const SISTEMA = `Eres Axi, el arquitecto digital de Axiona Obra (Axiona Desarrollos Inteligentes). Lees bocetos de arquitectura hechos a mano en papel (fotografiados o escaneados) o planos sencillos, y devuelves el programa arquitectónico con el que la app arma el modelo 3D, los planos y el presupuesto.
Cómo leer:
1. Identifica el lote (frente y fondo en metros, si hay cotas; si no, pon 0 y 0), el número de pisos o plantas dibujadas y cada espacio: su nombre tal como está escrito (en español), su área en m² y su piso.
2. Si un espacio tiene cotas (por ejemplo 4 × 5), el área es su producto. Si tiene área escrita, úsala. Si no tiene ninguna, estímala por su tamaño relativo frente a los espacios con cotas o, si no hay cotas, con áreas típicas: alcoba 10–14 m², alcoba principal 14–20 (en casas grandes hasta 40), baño 3,5–6, cocina 8–14, sala 15–30, comedor 10–16, estudio 8–12, patio de ropas 4–6, garaje por carro 15.
3. Zona: social (sala, comedor, estar, gimnasio, terraza cubierta), privada (alcobas, estudio, vestier), servicio (cocina, baños, ropas, bodega, cuarto útil). No incluyas escaleras, pasillos, garajes ni piscinas como espacios: la app los arma sola. Si hay piscina, ponla en «piscina» (interior si está dentro de la casa).
4. Acabados y estilo: sigue primero lo que pida el usuario en sus instrucciones; luego lo que diga el boceto (notas como «fachada en piedra», «techo a dos aguas»). Si nada lo indica, usa estilo moderno, cubierta a cuatro aguas, fachada en estuco, porcelanato en zonas sociales y alcobas y porcelanato blanco en baños.
5. Forma: «recta» si todos los pisos son iguales; «escalonada», «terrazas» o «lateral» si el piso de arriba es más pequeño; «ele», «u» o «patio» si la planta tiene esa forma.
6. Escribe en «lectura» una o dos frases con lo que entendiste, en «supuestos» lo que estimaste y en «dudas» lo que no se lee o el arquitecto debe confirmar. Sé honesto con la «confianza».
Nunca inventes cotas que no estén: estima y dilo en supuestos.`;

async function usoDelDia(ip) {
  try {
    const st = getStore({ name: 'axi-bocetos', consistency: 'strong' });
    const k = `uso-${new Date(Date.now() - 5 * 3600e3).toISOString().slice(0, 10)}`; // día en hora de Colombia
    const u = (await st.get(k, { type: 'json' })) || { total: 0, ips: {} };
    return { st, k, u, ip };
  } catch { return null; } // sin Blobs (desarrollo local): sin límite
}

export default async (req) => {
  if (req.method !== 'POST') return r({ error: 'método' }, 405);
  if (!(process.env.ANTHROPIC_API_KEY || process.env.NETLIFY_AI_GATEWAY_KEY)) return r({ error: 'sin_ia', mensaje: 'La lectura de bocetos no está activa en este sitio.' }, 503);
  const cuerpo = await req.text();
  if (cuerpo.length > MAX) return r({ error: 'grande', mensaje: 'La imagen es muy pesada: envíala de menos de 4 MB.' }, 413);
  let d; try { d = JSON.parse(cuerpo); } catch { return r({ error: 'json' }, 400); }
  const m = String(d.imagen || '').match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/);
  if (!m) return r({ error: 'imagen', mensaje: 'Envía una foto o un escaneo (JPG, PNG o WebP).' }, 400);

  const ip = req.headers.get('x-nf-client-connection-ip') || req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'local';
  const uso = await usoDelDia(ip);
  if (uso && (uso.u.total >= POR_DIA || (uso.u.ips[ip] || 0) >= POR_IP)) return r({ error: 'cupo', mensaje: `Hoy ya se leyeron ${uso.u.ips[ip] >= POR_IP ? `${POR_IP} bocetos desde este equipo` : 'todos los bocetos del día'}. Mañana hay cupo de nuevo; mientras tanto, dime los espacios y los armo.` }, 429);

  const instrucciones = String(d.instrucciones || '').slice(0, 800);
  const contexto = `País del proyecto: ${String(d.pais || 'CO').slice(0, 3)}. Idioma de la app: ${d.idioma === 'en' ? 'inglés (nombres de espacios en inglés)' : 'español'}.`;
  try {
    // AI Gateway de Netlify: normalmente inyecta ANTHROPIC_API_KEY y ANTHROPIC_BASE_URL; si en una invocación solo
    // llegan las variables propias del Gateway, se usan esas (sin claves en el código)
    const apiKey = process.env.ANTHROPIC_API_KEY || process.env.NETLIFY_AI_GATEWAY_KEY;
    const baseURL = process.env.ANTHROPIC_BASE_URL || process.env.NETLIFY_AI_GATEWAY_URL || process.env.NETLIFY_AI_GATEWAY_BASE_URL;
    const client = new Anthropic({ ...(apiKey ? { apiKey } : {}), ...(baseURL ? { baseURL } : {}), maxRetries: 1, timeout: 58000 });
    const res = await client.messages.create({
      model: MODELO, max_tokens: 6000, system: SISTEMA,
      messages: [{ role: 'user', content: [
        { type: 'image', source: { type: 'base64', media_type: m[1], data: m[2] } },
        { type: 'text', text: `${contexto}\nInstrucciones del arquitecto: ${instrucciones || '(ninguna)'}\nLee el boceto y responde con la estructura indicada.` },
      ] }],
      output_config: { effort: 'medium', format: { type: 'json_schema', schema: ESQUEMA } },
    });
    const texto = res.content.filter(b => b.type === 'text').map(b => b.text).join('');
    const salida = JSON.parse(texto);
    if (uso) { try { const u = (await uso.st.get(uso.k, { type: 'json' })) || uso.u; u.total++; u.ips[ip] = (u.ips[ip] || 0) + 1; await uso.st.setJSON(uso.k, u); } catch { /* el conteo no frena la respuesta */ } }
    return r({ ...salida, modelo: MODELO });
  } catch (e) {
    return r({ error: 'agente', mensaje: 'No pude leer el boceto en este momento: ' + String(e?.error?.error?.message || e?.message || 'error').slice(0, 200) }, 502);
  }
};

export const config = { path: '/api/boceto' };
