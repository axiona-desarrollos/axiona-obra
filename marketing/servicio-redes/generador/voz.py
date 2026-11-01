#!/usr/bin/env python3
"""Locución del video de los 5 cupos con voz masculina (Kokoro, «em_alex», español latino).

Genera voz.wav y tiempos.json: cada escena dura lo que su frase, y promo.py arma
el video con esos tiempos.

Uso: python3 voz.py CARPETA_MODELOS SALIDA_DIR
"""
import json
import sys
import wave
from pathlib import Path

import numpy as np
from kokoro_onnx import Kokoro

LINEAS = {
    'gancho': 'Automaticé mis redes con inteligencia artificial, y mira lo que pasó.',
    'dato1': 'Más de cuatro mil seiscientas vistas en el primer reel.',
    'dato2': 'El noventa y nueve por ciento no me seguía.',
    'dato3': 'Casi la mitad llegó desde México.',
    'dato4': 'Y cincuenta y un me gusta, cuando antes no pasaba de cinco.',
    'serv1': 'Ahora lo hago para tu negocio.',
    # «rils» para que la voz lo diga como se dice en Latinoamérica; con «reels» suena «reils».
    'serv2': 'Contenido, publicación diaria, rils con subtítulos y métricas cada semana.',
    'serv3': 'Tú vendes. Yo me encargo de tus redes.',
    'cupos': 'Abro solo cinco cupos para emprendedores.',
    'cierre': 'Escríbeme al interno y te paso la cotización para tu negocio.',
}


def recortar(x, sr, umbral=0.01, margen=0.04):
    idx = np.where(np.abs(x) > umbral)[0]
    if not len(idx):
        return x
    a, b = max(0, idx[0] - int(margen * sr)), min(len(x), idx[-1] + int(margen * sr))
    return x[a:b]


def main(modelos, salida):
    modelos, salida = Path(modelos), Path(salida)
    salida.mkdir(parents=True, exist_ok=True)
    k = Kokoro(str(modelos / 'kokoro-v1.0.onnx'), str(modelos / 'voices-v1.0.bin'))
    audio, sr = {}, 24000
    for clave, texto in LINEAS.items():
        x, sr = k.create(texto, voice='em_alex', speed=1.08, lang='es-419')
        audio[clave] = recortar(np.asarray(x, np.float32), sr)
    d = {c: len(x) / sr for c, x in audio.items()}

    voz, t = {}, 0.25
    voz['gancho'] = t
    gancho = [0.0, t + d['gancho'] + 0.45]
    t = gancho[1] + 0.35
    tarjetas = []
    for c in ('dato1', 'dato2', 'dato3', 'dato4'):
        tarjetas.append(t)
        voz[c] = t
        t += d[c] + 0.3
    datos = [gancho[1], t - 0.3 + 1.0]
    t = datos[1] + 0.3
    voz['serv1'] = t
    t += d['serv1'] + 0.15
    voz['serv2'] = t
    lista = [t + n * d['serv2'] / 4 for n in range(4)]
    t += d['serv2'] + 0.3
    voz['serv3'] = remate = t
    servicio = [datos[1], t + d['serv3'] + 0.5]
    voz['cupos'] = servicio[1] + 0.3
    cupos = [servicio[1], max(voz['cupos'] + d['cupos'] + 1.0, servicio[1] + 4.3)]
    voz['cierre'] = cupos[1] + 0.3
    dur = round(voz['cierre'] + d['cierre'] + 1.8, 2)
    cierre = [cupos[1], dur]

    pista = np.zeros(int((dur + 0.5) * sr), np.float32)
    for c, x in audio.items():
        i = int(voz[c] * sr)
        pista[i:i + len(x)] += x
    pista = pista[:int(dur * sr)]
    pista /= max(1e-6, np.abs(pista).max()) / 0.9
    with wave.open(str(salida / 'voz.wav'), 'wb') as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(sr)
        w.writeframes((pista * 32767).astype('<i2').tobytes())

    tiempos = {'dur': dur, 'gancho': gancho, 'datos': datos, 'servicio': servicio, 'cupos': cupos, 'cierre': cierre,
               'tarjetas': tarjetas, 'lista': lista, 'remate': remate, 'voz': voz}
    (salida / 'tiempos.json').write_text(json.dumps(tiempos, indent=1))
    print(json.dumps({c: round(v, 2) for c, v in d.items()}), '\n', json.dumps(tiempos))


if __name__ == '__main__':
    main(*sys.argv[1:3])
