#!/usr/bin/env python3
"""Locución del video «Lo que hicimos con IA · cursos en YouTube» (Kokoro, «em_alex», español latino).

Genera voz.wav y tiempos.json. Cada frase se sintetiza aparte para saber
cuándo empieza: así cada escena dura lo que su frase. El temario va en una
sola frase, porque dicho de corrido suena natural y se entiende mejor; cada
ficha aparece cuando se nombra.

Algunas palabras van escritas como se dicen, para que la voz las pronuncie
como en Latinoamérica: «Guit», «Noud», «Yutub», «ril», «Zápier». Whisper
transcribe la locución como «Git y Node», «YouTube», «reel», «Zapier y Databricks».

Uso: python3 voz.py CARPETA_MODELOS SALIDA_DIR
"""
import json
import sys
import wave
from pathlib import Path

import numpy as np
from kokoro_onnx import Kokoro

# (escena, [(clave, texto, pausa después)]). Una escena dura lo que sus frases.
ESCENAS = [
    ('gancho', [('g1', 'Soy Santiago, de Axiona.', 0.2),
                ('g2', 'Esto lo construimos en menos de tres días, con inteligencia artificial.', 0.3)]),
    ('obra', [('o1', 'Axiona Obra: tu casa en tres de, con planos y presupuesto, en cuatro países.', 0.3)]),
    ('topo', [('t1', 'Axiona Topo: el topógrafo en tu celular.', 0.3)]),
    ('rayos', [('r1', 'Y lo más brutal:', 0.1),
               ('r2', 'el terreno en holograma, con rayos equis, en la palma de tu mano.', 0.3)]),
    ('vivo', [('v1', 'El celular mide, el computador recibe en vivo y saca el plano.', 0.3)]),
    ('redes', [('n1', 'Y mis redes se publican solas: más de cuatro mil seiscientas vistas en el primer ril.', 0.35)]),
    ('cursos', [('c1', 'Muy pronto, en mi canal de Yutub, subo los mejores cursos.', 0.3)]),
    ('posible', [('p1', 'En menos de un mes vas a hacer lo imposible...', 0.35),
                 ('p2', 'posible.', 0.5)]),
    # El temario va en partes: cada ficha aparece cuando empieza su parte.
    ('temario', [('m', ['Lo que debes saber para pasar del código a proyectos reales:', 'repositorios,', 'Guit y Noud,',
                        'actualizaciones,', 'políticas y secretos,', 'Zápier y Databriks.'], 0.4)]),
    ('cierre', [('z1', 'Sígueme y activa la campana.', 1.6)]),
]


def marcas(k, partes, total, velocidad):
    """Dónde empieza cada parte dentro de la frase dicha de corrido.

    Cada parte se sintetiza sola para medirla, y las medidas se escalan a la frase completa."""
    d = [len(recortar(np.asarray(k.create(p, voice='em_alex', speed=velocidad, lang='es-419')[0], np.float32), 24000)) for p in partes]
    escala, t, inicios = total / sum(d), 0.0, []
    for n in d[:-1]:
        t += n * escala
        inicios.append(t)
    return inicios


def recortar(x, sr, umbral=0.01, margen=0.03):
    idx = np.where(np.abs(x) > umbral)[0]
    if not len(idx):
        return x
    a, b = max(0, idx[0] - int(margen * sr)), min(len(x), idx[-1] + int(margen * sr))
    return x[a:b]


def main(modelos, salida, velocidad=1.12):
    modelos, salida = Path(modelos), Path(salida)
    salida.mkdir(parents=True, exist_ok=True)
    k = Kokoro(str(modelos / 'kokoro-v1.0.onnx'), str(modelos / 'voices-v1.0.bin'))
    sr, t = 24000, 0.3
    frases, escenas, clips = {}, {}, []
    for escena, lineas in ESCENAS:
        ini = 0.0 if not escenas else t - 0.15
        for clave, texto, pausa in lineas:
            partes = texto if isinstance(texto, list) else None
            texto = ' '.join(partes) if partes else texto
            x, sr = k.create(texto, voice='em_alex', speed=float(velocidad), lang='es-419')
            x = recortar(np.asarray(x, np.float32), sr)
            d = len(x) / sr
            frases[clave] = {'ini': round(t, 3), 'dur': round(d, 3), 'texto': texto}
            if partes:
                frases[clave]['marcas'] = [round(t + m, 3) for m in marcas(k, partes, d, float(velocidad))]
            clips.append((t, x))
            t += d + pausa
        escenas[escena] = [round(ini, 3), round(t - 0.15, 3)]
    dur = round(t, 2)
    escenas['cierre'][1] = dur

    pista = np.zeros(int((dur + 0.5) * sr), np.float32)
    for t0, x in clips:
        i = int(t0 * sr)
        pista[i:i + len(x)] += x
    pista = pista[:int(dur * sr)]
    pista /= max(1e-6, np.abs(pista).max()) / 0.9
    with wave.open(str(salida / 'voz.wav'), 'wb') as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(sr)
        w.writeframes((pista * 32767).astype('<i2').tobytes())

    tiempos = {'dur': dur, 'escenas': escenas, 'frases': frases}
    (salida / 'tiempos.json').write_text(json.dumps(tiempos, indent=1, ensure_ascii=False))
    print('duración', dur, 's')
    for e, (a, b) in escenas.items():
        print(f'{e:8s} {a:6.2f} → {b:6.2f}')


if __name__ == '__main__':
    main(*sys.argv[1:4])
