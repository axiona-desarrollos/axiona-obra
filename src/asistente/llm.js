/* ==========================================================================
   AXIONA OBRA · Cerebro avanzado de Axi (opcional)
   --------------------------------------------------------------------------
   Un modelo de lenguaje que corre en el propio equipo del usuario, sin API
   ni costo por pregunta:
   1. El modelo que trae Chrome (LanguageModel), si el navegador lo tiene.
   2. Si no, WebLLM con Qwen2.5 1.5B en la tarjeta gráfica (WebGPU). Se
      descarga una sola vez (~1 GB) y queda guardado en el navegador.
   Si ninguno está disponible, Axi sigue con su cerebro local.
   El modelo responde y, cuando hay que cambiar el proyecto, escribe líneas
   «ORDEN: ...» que el cerebro local convierte en acciones.
   ========================================================================== */

import { FAQ, CAPACIDADES } from './saber.js';
import { tr, idioma } from '../motor/idioma.js';

export const MODELO_WEBLLM = 'Qwen2.5-1.5B-Instruct-q4f16_1-MLC';

export async function disponible() {
  try {
    if (typeof self !== 'undefined' && 'LanguageModel' in self) {
      const a = await self.LanguageModel.availability({ expectedInputs: [{ type: 'text', languages: [LANG()] }], expectedOutputs: [{ type: 'text', languages: [LANG()] }] });
      if (a && a !== 'unavailable') return { tipo: 'chrome', listo: a === 'available' };
    }
  } catch { /* sin modelo de Chrome */ }
  try {
    if (navigator.gpu && await navigator.gpu.requestAdapter()) return { tipo: 'webllm', listo: false };
  } catch { /* sin WebGPU */ }
  return null;
}

export function instrucciones(resumenProyecto) {
  const datos = `${tr({ es: 'Lo que Axi sabe hacer', en: 'What Axi can do' })}: ${CAPACIDADES.map(c => tr(c)).join(' ')}
${tr({ es: 'Datos de la app', en: 'App facts' })}: ${FAQ.map(f => tr(f.r)).join(' ')}
${tr({ es: 'Proyecto actual', en: 'Current project' })}: ${resumenProyecto}`;
  if (idioma() === 'en') {
    return `You are Axi, the assistant of Axiona Obra, a free web app that designs houses and buildings from the lot: PDF drawings, a furnished 3D model, budget, permits and augmented reality, for Colombia, Spain, Canada and Mexico. It was made by Axiona Desarrollos Inteligentes (Sabaneta, Antioquia, Colombia).
Always answer in English, warm and clear, in at most 4 sentences. Do not invent features: if something does not exist, say so and offer to talk to the team.
When the user asks to change the project, besides answering write at the end one line per change with the exact format «ORDEN: <short order>», using orders like: add a 12 m2 bedroom on floor 2 · remove the study · make the living room 25 m2 · move the study to floor 2 · set 3 floors · porcelain tile in the whole house · wood in the main bedroom · modern style · gable roof · house with a courtyard · make it l-shaped · u-shaped · add curves · make it stepped with terraces · side terrace · add balconies · straight shape · lot of 10 by 20 · show me the drawings · show me the bricks · download the pdf.
${datos}`;
  }
  return `Eres Axi, el asistente de Axiona Obra, una app web gratuita que diseña casas y edificios desde el lote: planos en PDF, modelo 3D amoblado, presupuesto, trámites y realidad aumentada, para Colombia, España, Canadá y México. La hizo Axiona Desarrollos Inteligentes (Sabaneta, Antioquia).
Responde siempre en español, cálido y claro, en máximo 4 frases. No inventes funciones: si algo no existe, dilo y ofrece hablar con el equipo.
Cuando el usuario pida cambiar el proyecto, además de responder escribe al final una línea por cada cambio con el formato exacto «ORDEN: <orden corta>», usando órdenes como: agrega una alcoba de 12 m2 en el piso 2 · quita el estudio · agranda la sala a 25 m2 · pasa el estudio al piso 2 · pon 3 pisos · porcelanato en toda la casa · madera en la alcoba principal · estilo moderno · techo a dos aguas · casa con patio central · hazla en L · en U · ponle curvas · hazla escalonada con terrazas · terraza lateral · agrega balcones · forma recta · lote de 10 por 20 · muéstrame los planos · muéstrame los ladrillos · descarga el pdf.
${datos}`;
}

const LANG = () => (idioma() === 'en' ? 'en' : 'es');

/** Crea una sesión: { preguntar(texto, resumen) → Promise<string> }. progreso(fraccion, texto) mientras descarga. */
export async function crearCerebro(tipo, progreso = () => {}) {
  if (tipo === 'chrome') {
    let sesion = null, base = '';
    return {
      tipo,
      async preguntar(texto, resumenProyecto) {
        const sis = instrucciones(resumenProyecto);
        if (!sesion || sis !== base) {
          sesion?.destroy?.();
          base = sis;
          sesion = await self.LanguageModel.create({
            initialPrompts: [{ role: 'system', content: sis }],
            expectedInputs: [{ type: 'text', languages: [LANG()] }], expectedOutputs: [{ type: 'text', languages: [LANG()] }],
            monitor(m) { m.addEventListener('downloadprogress', e => progreso(e.loaded, tr({ es: 'Descargando el modelo de Chrome…', en: 'Downloading Chrome’s model…' }))); },
          });
        }
        return await sesion.prompt(texto);
      },
    };
  }
  const webllm = await import('@mlc-ai/web-llm');
  const motor = await webllm.CreateMLCEngine(MODELO_WEBLLM, {
    initProgressCallback: p => progreso(p.progress ?? 0, p.text || tr({ es: 'Cargando el modelo…', en: 'Loading the model…' })),
  });
  const historial = [];
  return {
    tipo,
    async preguntar(texto, resumenProyecto) {
      historial.push({ role: 'user', content: texto });
      while (historial.length > 8) historial.shift();
      const r = await motor.chat.completions.create({
        messages: [{ role: 'system', content: instrucciones(resumenProyecto) }, ...historial],
        temperature: 0.4, max_tokens: 320,
      });
      const out = r.choices?.[0]?.message?.content?.trim() || '';
      historial.push({ role: 'assistant', content: out });
      return out;
    },
  };
}

/** Separa la respuesta del modelo en texto para el usuario y órdenes para el cerebro local. */
export function separarOrdenes(texto) {
  const ordenes = [], lineas = [];
  for (const l of String(texto).split('\n')) {
    const m = l.match(/^\s*[-•*]?\s*ORDEN\s*:\s*(.+)$/i);
    if (m) ordenes.push(m[1].trim()); else lineas.push(l);
  }
  return { dice: lineas.join('\n').trim(), ordenes };
}
