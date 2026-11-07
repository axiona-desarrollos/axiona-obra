#!/usr/bin/env python3
"""Locución del reel «No es una app: es tu sistema», con la demo del glamping.

Kokoro, voz «em_alex», español latino. Genera voz.wav y tiempos.json: cada
frase se sintetiza aparte para saber cuándo empieza, y cada escena dura lo
que sus frases. Cada frase tiene lo que se dice (siglas escritas como se
pronuncian) y lo que se lee en los subtítulos.

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
        ('g1', 'Esto no es una app.', 'Esto no es una app.', 0.3),
        ('g2', 'Es el sistema completo de una empresa de glamping, hecho a su medida.',
               'Es el sistema completo de una empresa de glamping, hecho a su medida.', 0.3),
    ]),
    ('configura', [
        ('c1', 'Su cliente entra a la web y arma su glamping: el modelo, el acabado y el escenario.',
               'Su cliente entra a la web y arma su glamping: el modelo, el acabado y el escenario.', 0.3),
    ]),
    ('recalcula', [
        ('r1', 'Mueve una medida, y todo se recalcula solo:', 'Mueve una medida y todo se recalcula solo:', 0.12),
        ('r2', 'la ficha técnica, el presupuesto, y diez planos en pe de efe y de equis efe.',
               'la ficha técnica, el presupuesto y 10 planos en PDF y DXF.', 0.3),
    ]),
    ('lote', [
        ('l1', 'Lo pone en su lote con realidad aumentada, y lo recorre por dentro.',
               'Lo pone en su lote con realidad aumentada y lo recorre por dentro.', 0.3),
    ]),
    ('constructora', [
        ('k1', 'Para una constructora, es otra cosa: la casa de su cliente antes de construirla.',
               'Para una constructora es otra cosa: la casa de su cliente antes de construirla.', 0.15),
        ('k2', 'La ve terminada desde afuera, y la camina por dentro.',
               'La ve terminada desde afuera y la camina por dentro.', 0.3),
    ]),
    ('sistema', [
        ('s1', 'Cada empresa necesita algo distinto.', 'Cada empresa necesita algo distinto.', 0.15),
        ('s2', 'No te vendemos una app genérica: construimos la tuya, integrada, desde la web que ve tu cliente hasta la obra.',
               'No te vendemos una app genérica: construimos la tuya, integrada, desde la web que ve tu cliente hasta la obra.', 0.35),
    ]),
    ('cierre', [
        ('z1', 'Arquitectos, constructoras y diseñadores: este es solo un ejemplo.',
               'Arquitectos, constructoras y diseñadores: este es solo un ejemplo.', 0.15),
        ('z2', '¿Cómo sería el tuyo? Escríbenos.', '¿Cómo sería el tuyo? Escríbenos.', 1.6),
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
    t, frases, escenas, clips = 0.35, {}, {}, []
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
        print(f'{e:13s} {a:6.2f} → {b:6.2f}')


if __name__ == '__main__':
    main(*sys.argv[1:3])
