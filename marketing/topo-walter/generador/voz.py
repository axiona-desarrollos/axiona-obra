#!/usr/bin/env python3
"""Locución del video para Walter: qué medir con Axiona Topo para la fase de planos.

Kokoro, voz «em_alex», español latino. Genera voz.wav y tiempos.json: cada
frase se sintetiza aparte para saber cuándo empieza, y cada escena dura lo
que sus frases. Cada frase tiene lo que se dice (con las siglas escritas como
se pronuncian) y lo que se lee en los subtítulos.

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
    ('intro', [
        ('i1', 'Walter, esto es lo que Axiona Obra necesita para sacar los planos de la casa, y cómo lo mides con Axiona Topo.',
               'Walter, esto es lo que Axiona Obra necesita para sacar los planos, y cómo lo mides con Axiona Topo.', 0.35),
        ('i2', 'Son cuatro cosas: las esquinas del lote, las cotas, lo que ya hay en el terreno, y dos documentos que no se miden.',
               'Son 4 cosas: las esquinas, las cotas, lo que ya hay en el terreno y 2 documentos que no se miden.', 0.45),
    ]),
    ('esquinas', [
        ('e1', 'Primero: las esquinas del lote.', 'Primero: las esquinas del lote.', 0.25),
        ('e2', 'Empieza en una esquina del frente, sobre la línea del andén. Esa es pe uno. La siguiente, pe dos, también va en el frente.',
               'Empieza en una esquina del frente, sobre la línea del andén: esa es P1. La siguiente, P2, también va en el frente.', 0.25),
        ('e3', 'Después sigue alrededor del lote, siempre en el mismo sentido, hasta volver a pe uno.',
               'Después sigue alrededor del lote, siempre en el mismo sentido, hasta volver a P1.', 0.25),
        ('e4', 'Así Axiona Obra sabe que el lado de pe uno a pe dos es la fachada hacia la calle.',
               'Así Axiona Obra sabe que el lado P1 → P2 es la fachada hacia la calle.', 0.45),
    ]),
    ('metodos', [
        ('m1', 'Para planos, mide con cinta o con una antena ge pe ese erre te ka: las dos dan centímetros.',
               'Para planos, mide con cinta o con una antena GPS RTK: las dos dan centímetros.', 0.25),
        ('m2', 'Con cinta, toma los lados y las diagonales desde pe uno, y una medida de comprobación. La app te dice el error de cierre.',
               'Con cinta: lados y diagonales desde P1, y una medida de comprobación. La app te da el error de cierre.', 0.25),
        ('m3', 'El ge pe ese del celular da de dos a cinco metros: sirve para fincas y para tantear, no para planos.',
               'El GPS del celular da de 2 a 5 m: sirve para fincas y para tantear, no para planos.', 0.45),
    ]),
    ('cotas', [
        ('c1', 'Segundo: las cotas.', 'Segundo: las cotas.', 0.25),
        ('c2', 'Antes de empezar, calibra la mira con las dos lecturas contra un libro, como te indica la app.',
               'Antes de empezar, calibra la mira con las 2 lecturas contra un libro, como indica la app.', 0.25),
        ('c3', 'Toma la cota de cada esquina, y puntos de nivel por dentro del lote.',
               'Toma la cota de cada esquina y puntos de nivel por dentro del lote:', 0.2),
        ('c4', 'En el punto más alto, en el más bajo, donde cambia la pendiente, y más o menos cada cinco a diez metros.',
               'el más alto, el más bajo, donde cambia la pendiente, y más o menos cada 5 a 10 m.', 0.25),
        ('c5', 'Y no olvides el nivel del andén al frente: de ahí sale el nivel del primer piso.',
               'Y no olvides el nivel del andén al frente: de ahí sale el nivel del primer piso.', 0.45),
    ]),
    ('existente', [
        ('x1', 'Tercero: lo que ya hay. Árboles grandes, postes, cajas de agua y alcantarillado, quebradas, muros y construcciones.',
               'Tercero: lo que ya hay. Árboles grandes, postes, cajas de agua y alcantarillado, quebradas, muros y construcciones.', 0.25),
        ('x2', 'Tómale una foto a cada cosa y anota cerca de qué esquina o punto queda.',
               'Tómale una foto a cada cosa y anota cerca de qué esquina o punto queda.', 0.45),
    ]),
    ('revisar', [
        ('r1', 'Con eso, Topo dibuja el plano con las curvas de nivel, la pendiente, y el corte y el relleno.',
               'Con eso, Topo dibuja el plano con curvas de nivel, pendiente, y corte y relleno.', 0.25),
        ('r2', 'Revísalo en el computador, en vivo, y confirma que el lote cierre bien.',
               'Revísalo en el computador, en vivo, y confirma que el lote cierre bien.', 0.45),
    ]),
    ('enviar', [
        ('s1', 'Cuando esté listo, toca: abrir en Axiona Obra. El lote llega con sus medidas y sus cotas, listo para diseñar.',
               'Cuando esté listo, toca «Abrir en Axiona Obra»: el lote llega con sus medidas y cotas, listo para diseñar.', 0.25),
        ('s2', 'Envíanos también el plano topográfico en pe de efe y el archivo de puntos.',
               'Envíanos también el plano topográfico en PDF y el archivo de puntos.', 0.45),
    ]),
    ('documentos', [
        ('d1', 'Cuarto: lo que no se mide.', 'Cuarto: lo que no se mide.', 0.25),
        ('d2', 'Pide en Planeación del municipio el certificado de uso del suelo, o la norma urbanística del predio.',
               'Pide en Planeación del municipio el certificado de uso del suelo o la norma urbanística del predio.', 0.2),
        ('d3', 'Ahí salen el uso permitido, el índice de ocupación, la altura máxima, y los retiros de frente, fondo y lados.',
               'Ahí salen el uso permitido, el índice de ocupación, la altura máxima y los retiros de frente, fondo y lados.', 0.3),
        ('d4', 'Y el estudio de suelos, que lo hace un laboratorio con perforaciones. Topo no lo reemplaza.',
               'Y el estudio de suelos, que lo hace un laboratorio con perforaciones. Topo no lo reemplaza.', 0.25),
        ('d5', 'Súbelos en Axiona Obra, en Proyecto, adjuntar documentos. La app lee los datos y tú los apruebas.',
               'Súbelos en Axiona Obra › Proyecto › Adjuntar documentos: la app lee los datos y tú los apruebas.', 0.45),
    ]),
    ('resumen', [
        ('z1', 'En resumen: esquinas desde el frente, cotas y niveles, lo que hay en el lote, y los dos documentos.',
               'En resumen: esquinas desde el frente, cotas y niveles, lo que hay en el lote y los 2 documentos.', 0.25),
        ('z2', 'Con eso salen los planos, el tres de y el presupuesto. El plano oficial para la licencia lo firma un topógrafo con tarjeta profesional.',
               'Con eso salen los planos, el 3D y el presupuesto. El plano oficial para la licencia lo firma un topógrafo con tarjeta profesional.', 1.4),
    ]),
]

VOZ, IDIOMA, SR = 'em_alex', 'es-419', 24000


def recortar(x, umbral=0.01, margen=0.03):
    idx = np.where(np.abs(x) > umbral)[0]
    if not len(idx):
        return x
    a, b = max(0, idx[0] - int(margen * SR)), min(len(x), idx[-1] + int(margen * SR))
    return x[a:b]


def main(modelos, salida, velocidad=1.06):
    modelos, salida = Path(modelos), Path(salida)
    salida.mkdir(parents=True, exist_ok=True)
    k = Kokoro(str(modelos / 'kokoro-v1.0.onnx'), str(modelos / 'voices-v1.0.bin'))
    t, frases, escenas, clips = 0.6, {}, {}, []
    for escena, lineas in ESCENAS:
        ini = t - 0.2 if escenas else 0.0
        for clave, dice, lee, pausa in lineas:
            x, sr = k.create(dice, voice=VOZ, speed=float(velocidad), lang=IDIOMA)
            assert sr == SR
            x = recortar(np.asarray(x, np.float32))
            d = len(x) / SR
            frases[clave] = {'ini': round(t, 3), 'dur': round(d, 3), 'lee': lee, 'escena': escena}
            clips.append((t, x))
            t += d + pausa
        escenas[escena] = [round(ini, 3), round(t - 0.2, 3)]
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
