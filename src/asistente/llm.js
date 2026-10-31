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

export const MODELO_WEBLLM = 'Qwen2.5-1.5B-Instruct-q4f16_1-MLC';

export async function disponible() {
  try {
    if (typeof self !== 'undefined' && 'LanguageModel' in self) {
      const a = await self.LanguageModel.availability({ expectedInputs: [{ type: 'text', languages: ['es'] }], expectedOutputs: [{ type: 'text', languages: ['es'] }] });
      if (a && a !== 'unavailable') return { tipo: 'chrome', listo: a === 'available' };
    }
  } catch { /* sin modelo de Chrome */ }
  try {
    if (navigator.gpu && await navigator.gpu.requestAdapter()) return { tipo: 'webllm', listo: false };
  } catch { /* sin WebGPU */ }
  return null;
}

export function instrucciones(resumenProyecto) {
  return `Eres Axi, el asistente de Axiona Obra, una app web gratuita que diseña casas y edificios desde el lote: planos en PDF, modelo 3D amoblado, presupuesto, trámites y realidad aumentada, para Colombia, España, Canadá y México. La hizo Axiona Desarrollos Inteligentes (Sabaneta, Antioquia).
Responde siempre en español, cálido y claro, en máximo 4 frases. No inventes funciones: si algo no existe, dilo y ofrece hablar con el equipo.
Cuando el usuario pida cambiar el proyecto, además de responder escribe al final una línea por cada cambio con el formato exacto «ORDEN: <orden corta>», usando órdenes como: agrega una alcoba de 12 m2 en el piso 2 · quita el estudio · agranda la sala a 25 m2 · pasa el estudio al piso 2 · pon 3 pisos · porcelanato en toda la casa · madera en la alcoba principal · estilo moderno · techo a dos aguas · casa con patio central · hazla en L · en U · ponle curvas · hazla escalonada con terrazas · terraza lateral · agrega balcones · forma recta · lote de 10 por 20 · muéstrame los planos · muéstrame los ladrillos · descarga el pdf.
Lo que Axi sabe hacer: ${CAPACIDADES.join(' ')}
Datos de la app: ${FAQ.map(f => f.r).join(' ')}
Proyecto actual: ${resumenProyecto}`;
}

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
            expectedInputs: [{ type: 'text', languages: ['es'] }], expectedOutputs: [{ type: 'text', languages: ['es'] }],
            monitor(m) { m.addEventListener('downloadprogress', e => progreso(e.loaded, 'Descargando el modelo de Chrome…')); },
          });
        }
        return await sesion.prompt(texto);
      },
    };
  }
  const webllm = await import('@mlc-ai/web-llm');
  const motor = await webllm.CreateMLCEngine(MODELO_WEBLLM, {
    initProgressCallback: p => progreso(p.progress ?? 0, p.text || 'Cargando el modelo…'),
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
