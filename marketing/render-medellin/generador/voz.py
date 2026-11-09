#!/usr/bin/env python3
"""Locución del reel «Esta casa todavía no existe»: render fotorrealista con el valle de Aburrá.

Versión anónima de una demo hecha para una constructora: no nombra el
proyecto ni la empresa. Kokoro, voz «em_alex», español latino. Genera voz.wav
y tiempos.json (cada escena dura lo que sus frases).

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
        ('g1', 'Esta casa todavía no existe.', 'Esta casa todavía no existe.', 0.3),
        ('g2', 'Y ya se puede vender.', 'Y ya se puede vender.', 0.4),
    ]),
    ('etapas', [
        ('e1', 'La reconstruimos desde los planos, etapa por etapa: del lote, a la casa terminada.',
               'La reconstruimos desde los planos, etapa por etapa: del lote a la casa terminada.', 0.3),
    ]),
    ('gris', [
        ('r1', 'El comprador la ve en obra gris. Y con un gesto, terminada: piedra, madera y jardín.',
               'El comprador la ve en obra gris. Y con un gesto, terminada: piedra, madera y jardín.', 0.3),
    ]),
    ('vista', [
        ('v1', 'Entra a la sala, y ve la vista real del valle de Aburrá.', 'Entra a la sala y ve la vista real del valle de Aburrá.', 0.3),
    ]),
    ('noche', [
        ('n1', 'De noche, con las luces de la ciudad: la imagen que vende la primera visita.',
               'De noche, con las luces de la ciudad: la imagen que vende la primera visita.', 0.3),
    ]),
    ('recorrido', [
        ('t1', 'La gira en el navegador, entra a cada espacio, y la pone sobre su mesa con realidad aumentada.',
               'La gira en el navegador, entra a cada espacio y la pone sobre su mesa con realidad aumentada.', 0.35),
    ]),
    ('cierre', [
        ('z1', 'Render fotorrealista, recorrido tres de y video para redes, desde tus planos.',
               'Render fotorrealista, recorrido 3D y video para redes, desde tus planos.', 0.2),
        ('z2', '¿Tienes un proyecto en planos? Escríbenos.', '¿Tienes un proyecto en planos? Escríbenos.', 1.6),
    ]),
]

VOZ, IDIOMA, SR = 'em_alex', 'es-419', 24000


def recortar(x, umbral=0.01, margen=0.03):
    idx = np.where(np.abs(x) > umbral)[0]
    if not len(idx):
        return x
    a, b = max(0, idx[0] - int(margen * SR)), min(len(x), idx[-1] + int(margen * SR))
    return x[a:b]


def main(modelos, salida, velocidad=1.08):
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
        print(f'{e:10s} {a:6.2f} → {b:6.2f}')


if __name__ == '__main__':
    main(*sys.argv[1:3])
