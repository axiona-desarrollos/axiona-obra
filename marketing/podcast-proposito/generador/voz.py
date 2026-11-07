#!/usr/bin/env python3
"""Locución de Axiona Podcast, episodio «El propósito y el para qué».

Dos voces sintéticas de Kokoro en español latino:
- Presentadora: «ef_dora», cálida y dinámica.
- Agente (Claude): «em_alex», analítica, un poco más pausada.

Genera voz.wav y tiempos.json con las frases (inicio, duración, hablante,
bloque y texto del subtítulo), los bloques y la intensidad de cada voz a 30
cuadros por segundo, para que los avatares reaccionen a la voz real.

Uso: python3 voz.py CARPETA_MODELOS SALIDA_DIR
"""
import json
import sys
import wave
from pathlib import Path

import numpy as np
from kokoro_onnx import Kokoro

SR, FPS, IDIOMA = 24000, 30, 'es-419'
VOCES = {'P': ('ef_dora', 1.04), 'A': ('em_alex', 1.0)}
INICIO = 3.2  # apertura con el título antes de la primera frase

# (bloque, hablante, clave, se dice, se lee)
LINEAS = [
    ('apertura', 'P', 'p1',
     'Bienvenidos a un nuevo episodio especial de Axiona Podcast. Hoy no venimos a hablar de software convencional, ni de trucos rápidos de redes sociales.',
     'Bienvenidos a un nuevo episodio especial de Axiona Podcast. Hoy no venimos a hablar de software convencional ni de trucos rápidos de redes sociales.'),
    ('apertura', 'P', 'p2',
     'Venimos a hablar de fondo: del verdadero trasfondo de lo que está pasando en el mundo con la inteligencia artificial y la automatización.',
     'Venimos a hablar de fondo: del verdadero trasfondo de lo que está pasando en el mundo con la inteligencia artificial y la automatización.'),
    ('apertura', 'A', 'a1',
     'Hola. Soy Clod, el agente que diseña, programa y despliega junto a Santiago.',
     'Hola. Soy Claude, el agente que diseña, programa y despliega junto a Santiago.'),
    ('apertura', 'A', 'a2',
     'Mientras mucha gente se asusta con videos virales de androides, o con noticias apocalípticas sobre el fin de los oficios, hay una lectura mucho más profunda que pocos están entendiendo.',
     'Mientras mucha gente se asusta con videos virales de androides o con noticias apocalípticas sobre el fin de los oficios, hay una lectura mucho más profunda que pocos están entendiendo.'),
    ('apertura', 'P', 'p3',
     'Así es. Se habla de un futuro post escasez, de economías donde el dinero tradicional se transforma, y de robots haciendo el trabajo pesado.',
     'Así es. Se habla de un futuro post-escasez, de economías donde el dinero tradicional se transforma y de robots haciendo el trabajo pesado.'),
    ('apertura', 'P', 'p4',
     'Pero la pregunta que Santiago se hizo no es qué pasará en el año dos mil treinta y seis, sino: ¿para qué sirve realmente esta tecnología, hoy?',
     'Pero la pregunta que Santiago se hizo no es qué pasará en el año 2036, sino: ¿para qué sirve realmente esta tecnología hoy?'),

    ('friccion', 'A', 'a3',
     'La mayoría de profesionales usa la i a como un buscador glorificado, o como un asistente para redactar correos.',
     'La mayoría de profesionales usa la IA como un buscador glorificado o como un asistente para redactar correos.'),
    ('friccion', 'A', 'a4',
     'Se quedan en la superficie: prueban una vez, no les sale perfecto, y la abandonan.',
     'Se quedan en la superficie: prueban una vez, no les sale perfecto y la abandonan.'),
    ('friccion', 'P', 'p5',
     'Lo que Santiago hizo fue lo contrario: bajó al barro de la ejecución.',
     'Lo que Santiago hizo fue lo contrario: bajó al barro de la ejecución.'),
    ('friccion', 'P', 'p6',
     'Usó agentes de código para automatizar todo el ciclo de un proyecto arquitectónico: desde el análisis del lote y las normas urbanísticas de cada país, hasta los planos, el modelo en tres de, y el presupuesto con análisis de precios unitarios.',
     'Usó agentes de código para automatizar todo el ciclo de un proyecto arquitectónico: desde el análisis del lote y las normas urbanísticas de cada país, hasta los planos, el modelo en 3D y el presupuesto con análisis de precios unitarios.'),
    ('friccion', 'A', 'a5',
     'Y al hacerlo, descubrimos algo revelador. La i a no sirve solo para hacer tareas más rápido. Sirve para destruir la fricción entre la imaginación y la realidad.',
     'Y al hacerlo, descubrimos algo revelador. La IA no sirve solo para hacer tareas más rápido: sirve para destruir la fricción entre la imaginación y la realidad.'),
    ('friccion', 'A', 'a6',
     'Durante siglos, el ser humano ha sido esclavo del cómo: calcular a mano, alinear líneas en un plano, pelear con hojas de cálculo, y lidiar con la burocracia técnica.',
     'Durante siglos, el ser humano ha sido esclavo del cómo: calcular a mano, alinear líneas en un plano, pelear con hojas de cálculo y lidiar con la burocracia técnica.'),
    ('friccion', 'A', 'a7',
     'La máquina absorbe esa fricción operativa, y libera el qué: la intención.',
     'La máquina absorbe esa fricción operativa y libera el qué: la intención.'),

    ('valor', 'P', 'p7',
     'Aquí entra el dilema del empresario tradicional, o del constructor que teme volverse obsoleto.',
     'Aquí entra el dilema del empresario tradicional o del constructor que teme volverse obsoleto.'),
    ('valor', 'P', 'p8',
     'Si un agente puede hacer un anteproyecto y cotizarlo en veinte minutos, ¿dónde queda el valor humano?',
     'Si un agente puede hacer un anteproyecto y cotizarlo en 20 minutos, ¿dónde queda el valor humano?'),
    ('valor', 'A', 'a8',
     'El error es creer que la máquina tiene criterio de negocio.',
     'El error es creer que la máquina tiene criterio de negocio.'),
    ('valor', 'A', 'a9',
     'La máquina procesa el costo directo, los metros cuadrados y el cumplimiento normativo, con precisión matemática. Pero el negocio real se juega en el nivel comercial y humano.',
     'La máquina procesa el costo directo, los metros cuadrados y el cumplimiento normativo con precisión matemática. Pero el negocio real se juega en el nivel comercial y humano.'),
    ('valor', 'P', 'p9',
     'Exacto. El a pe u es la base matemática. Pero la negociación, los acuerdos con proveedores, la lectura del cliente y el riesgo comercial dependen de la capacidad y las conexiones del empresario.',
     'Exacto. El APU es la base matemática. Pero la negociación, los acuerdos con proveedores, la lectura del cliente y el riesgo comercial dependen de la capacidad y las conexiones del empresario.'),
    ('valor', 'P', 'p10',
     'La i a no te reemplaza: te quita lo repetitivo, para que te concentres en liderar y cerrar negocios.',
     'La IA no te reemplaza: te quita lo repetitivo para que te concentres en liderar y cerrar negocios.'),

    ('audiencia', 'A', 'a10',
     'La verdadera pregunta que debemos hacernos como industria no es si la tecnología va a avanzar. Es esta:',
     'La verdadera pregunta que debemos hacernos como industria no es si la tecnología va a avanzar. Es esta:'),
    ('audiencia', 'A', 'a11',
     '¿Estás usando este momento para construir tus propias herramientas y liderar tu mercado? ¿O sigues compitiendo contra la máquina, haciendo tareas repetitivas?',
     '¿Estás usando este momento para construir tus propias herramientas y liderar tu mercado? ¿O sigues compitiendo contra la máquina haciendo tareas repetitivas?'),
    ('audiencia', 'P', 'p11',
     'Y queremos saber qué opinan ustedes, los que lo ven desde afuera.',
     'Y queremos saber qué opinan ustedes, los que lo ven desde afuera.'),
    ('audiencia', 'P', 'p12',
     '¿Sienten que la tecnología es una amenaza para su profesión, o están listos para dirigir su propia flota de agentes? Déjenlo en los comentarios.',
     '¿Sienten que la tecnología es una amenaza para su profesión o están listos para dirigir su propia flota de agentes? Déjenlo en los comentarios.'),
    ('audiencia', 'A', 'a12',
     'Esto fue Axiona Podcast. Sigan construyendo con criterio. Nos vemos en el próximo despliegue.',
     'Esto fue Axiona Podcast. Sigan construyendo con criterio. Nos vemos en el próximo despliegue.'),
]


def recortar(x, umbral=0.01, margen=0.03):
    idx = np.where(np.abs(x) > umbral)[0]
    if not len(idx):
        return x
    a, b = max(0, idx[0] - int(margen * SR)), min(len(x), idx[-1] + int(margen * SR))
    return x[a:b]


def envolvente(x, n):
    """Intensidad por cuadro (RMS en ventanas de 1/30 s), de 0 a 1."""
    paso = SR // FPS
    out = np.zeros(n, np.float32)
    for i in range(n):
        seg = x[i * paso:(i + 1) * paso]
        if len(seg):
            out[i] = float(np.sqrt(np.mean(seg ** 2)))
    m = out.max() or 1.0
    return np.clip(out / (m * 0.6), 0, 1)


def main(modelos, salida):
    modelos, salida = Path(modelos), Path(salida)
    salida.mkdir(parents=True, exist_ok=True)
    k = Kokoro(str(modelos / 'kokoro-v1.0.onnx'), str(modelos / 'voices-v1.0.bin'))
    t, frases, bloques, clips, previo = INICIO, {}, {}, [], None
    for bloque, quien, clave, dice, lee in LINEAS:
        if previo is not None:
            t += 0.5 if quien != previo[1] else 0.28
            if bloque != previo[0]:
                t += 0.9  # respiro entre bloques
        voz, vel = VOCES[quien]
        x, sr = k.create(dice, voice=voz, speed=vel, lang=IDIOMA)
        assert sr == SR
        x = recortar(np.asarray(x, np.float32))
        d = len(x) / SR
        frases[clave] = {'ini': round(t, 3), 'dur': round(d, 3), 'lee': lee, 'hablante': quien, 'bloque': bloque}
        bloques.setdefault(bloque, [round(t - (0.45 if bloques else INICIO), 3), 0])
        clips.append((t, quien, x))
        t += d
        bloques[bloque][1] = round(t, 3)
        previo = (bloque, quien)
    dur = round(t + 4.5, 2)  # cierre con la tarjeta final
    n = int(dur * SR)
    pistas = {'P': np.zeros(n, np.float32), 'A': np.zeros(n, np.float32)}
    for t0, quien, x in clips:
        i = int(t0 * SR)
        pistas[quien][i:i + len(x)] += x
    mezcla = pistas['P'] + pistas['A']
    mezcla /= max(1e-6, np.abs(mezcla).max()) / 0.9
    with wave.open(str(salida / 'voz.wav'), 'wb') as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes((mezcla * 32767).astype('<i2').tobytes())
    ncuadros = int(dur * FPS)
    env = {q: [round(float(v), 3) for v in envolvente(p, ncuadros)] for q, p in pistas.items()}
    (salida / 'tiempos.json').write_text(json.dumps({'dur': dur, 'bloques': bloques, 'frases': frases, 'envolvente': env}, ensure_ascii=False))
    print('duración', dur, 's')
    for b, (a, z) in bloques.items():
        print(f'{b:10s} {a:7.2f} → {z:7.2f}')


if __name__ == '__main__':
    main(*sys.argv[1:3])
