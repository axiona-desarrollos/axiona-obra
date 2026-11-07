#!/usr/bin/env python3
"""Locución del video «No es usar IA: es construir el motor».

Kokoro, voz «em_alex», español latino. Genera voz.wav y tiempos.json: cada
frase se sintetiza aparte para saber cuándo empieza, y cada escena dura lo
que sus frases. Cada frase tiene lo que se dice (cifras y siglas escritas
como se pronuncian) y lo que se lee en los subtítulos.

Las afirmaciones sobre Axiona son comprobables en el repositorio: las 185
pruebas automáticas de Axiona Obra (npx vitest run) y sus nombres.

Uso: python3 voz.py CARPETA_MODELOS SALIDA_DIR
"""
import json
import sys
import wave
from pathlib import Path

import numpy as np
from kokoro_onnx import Kokoro

# (escena, [(clave, se dice, se lee, pausa después)])
ESCENAS = [
    ('gancho', [
        ('h1', 'Tu empresa no necesita usar inteligencia artificial.', 'Tu empresa no necesita usar inteligencia artificial.', 0.4),
        ('h2', 'Necesita construir su motor.', 'Necesita construir su motor.', 0.55),
    ]),
    ('antes', [
        ('a1', 'Durante décadas, el talento se gastó en el cómo:', 'Durante décadas, el talento se gastó en el cómo:', 0.15),
        ('a2', 'calcular a mano un presupuesto, alinear líneas en un plano, rehacer la misma cotización.',
               'calcular a mano un presupuesto, alinear líneas en un plano, rehacer la misma cotización.', 0.35),
    ]),
    ('chat', [
        ('p1', 'Hoy cualquiera le pregunta a un chat de i a. Pero un chat puede inventarse un dato, con toda seguridad.',
               'Hoy cualquiera le pregunta a un chat de IA. Pero un chat puede inventarse un dato, con toda seguridad.', 0.15),
        ('p3', 'Y en una obra, un número inventado cuesta millones.', 'Y en una obra, un número inventado cuesta millones.', 0.5),
    ]),
    ('motor', [
        ('m1', 'Por eso en Axiona no usamos la i a para adivinar: construimos motores.',
               'Por eso en Axiona no usamos la IA para adivinar: construimos motores.', 0.2),
        ('m2', 'Cálculos con datos verificados: normas, precios unitarios, y cantidades reales.',
               'Cálculos con datos verificados: normas, precios unitarios y cantidades reales.', 0.2),
        ('m3', 'Sus reglas tienen pruebas automáticas: hoy son ciento ochenta y cinco, y pasan todas.',
               'Sus reglas tienen pruebas automáticas: hoy son 185 y pasan todas.', 0.2),
        ('m4', 'Mismo dato, mismo resultado. Y si algo no cabe, lo dice: no se lo inventa.',
               'Mismo dato, mismo resultado. Y si algo no cabe, lo dice: no se lo inventa.', 0.45),
    ]),
    ('escala', [
        ('e1', 'Tú dices qué quieres lograr. El sistema hace el resto: planos, presupuesto, tres de y trámites.',
               'Tú dices qué quieres lograr. El sistema hace el resto: planos, presupuesto, 3D y trámites.', 0.15),
        ('e2', 'Una persona, con la fuerza de un equipo.', 'Una persona, con la fuerza de un equipo.', 0.45),
    ]),
    ('humano', [
        ('u1', 'Y el ser humano vuelve a lo que no se reemplaza: el criterio, la visión, y la confianza de su cliente.',
               'Y el ser humano vuelve a lo que no se reemplaza: el criterio, la visión y la confianza de su cliente.', 0.45),
    ]),
    ('ola', [
        ('o1', 'Si te quedas vendiendo horas de ejecución, la ola te va a alcanzar.',
               'Si te quedas vendiendo horas de ejecución, la ola te va a alcanzar.', 0.2),
        ('o2', 'Si construyes tu motor, la cabalgas.', 'Si construyes tu motor, la cabalgas.', 0.6),
    ]),
    ('cierre', [
        ('z1', '¿Qué motor necesita tu empresa?', '¿Qué motor necesita tu empresa?', 0.2),
        ('z2', 'Escríbenos, y te mostramos cómo lo construimos.', 'Escríbenos y te mostramos cómo lo construimos.', 1.8),
    ]),
]

VOZ, IDIOMA, SR = 'em_alex', 'es-419', 24000


def recortar(x, umbral=0.01, margen=0.03):
    idx = np.where(np.abs(x) > umbral)[0]
    if not len(idx):
        return x
    a, b = max(0, idx[0] - int(margen * SR)), min(len(x), idx[-1] + int(margen * SR))
    return x[a:b]


def main(modelos, salida, velocidad=1.1):
    modelos, salida = Path(modelos), Path(salida)
    salida.mkdir(parents=True, exist_ok=True)
    k = Kokoro(str(modelos / 'kokoro-v1.0.onnx'), str(modelos / 'voices-v1.0.bin'))
    t, frases, escenas, clips = 0.4, {}, {}, []
    for escena, lineas in ESCENAS:
        ini = t - 0.15 if escenas else 0.0
        for clave, dice, lee, pausa in lineas:
            x, sr = k.create(dice, voice=VOZ, speed=float(velocidad), lang=IDIOMA)
            assert sr == SR
            x = recortar(np.asarray(x, np.float32))
            d = len(x) / SR
            frases[clave] = {'ini': round(t, 3), 'dur': round(d, 3), 'lee': lee, 'escena': escena}
            clips.append((t, x))
            t += d + pausa
        escenas[escena] = [round(ini, 3), round(t - 0.15, 3)]
    dur = round(t, 2)
    escenas[ESCENAS[-1][0]][1] = dur
    pista = np.zeros(int((dur + 0.5) * SR), np.float32)
    for t0, x in clips:
        i = int(t0 * SR)
        pista[i:i + len(x)] += x
    pista = pista[:int(dur * SR)]
    pista /= max(1e-6, np.abs(pista).max()) / 0.9
    with wave.open(str(salida / 'voz.wav'), 'wb') as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes((pista * 32767).astype('<i2').tobytes())
    (salida / 'tiempos.json').write_text(json.dumps({'dur': dur, 'escenas': escenas, 'frases': frases}, indent=1, ensure_ascii=False))
    print('duración', dur, 's')
    for e, (a, b) in escenas.items():
        print(f'{e:10s} {a:6.2f} → {b:6.2f}')


if __name__ == '__main__':
    main(*sys.argv[1:3])
