#!/usr/bin/env python3
"""Prepara el perfil de voz de Santiago a partir de su grabación.

1. Convierte la grabación (m4a, mp3, ogg, wav) a WAV mono de 24 kHz, sin ruido de fondo.
2. Busca el tramo de habla continua más largo de 8 a 15 segundos y lo guarda como ref.wav.
3. Transcribe ese tramo con Whisper (lo necesita Qwen3-TTS) y lo guarda en ref.txt.

La grabación y el perfil son datos personales: viven en una carpeta privada,
nunca en un repositorio público.

Uso: python3 preparar_perfil.py GRABACION PERFIL_DIR
"""
import subprocess
import sys
import wave
from pathlib import Path

import numpy as np
import sherpa_onnx

ENTRADA, PERFIL = Path(sys.argv[1]), Path(sys.argv[2])
PERFIL.mkdir(parents=True, exist_ok=True)
SR = 24000
W = '/tmp/claude-0/-home-user-axiona-obra/566d1b8e-acad-59e7-93fc-45f410b549a6/scratchpad/video/modelos/sherpa-onnx-whisper-turbo'

limpio = PERFIL / 'completo.wav'
subprocess.run(['ffmpeg', '-y', '-v', 'error', '-i', str(ENTRADA), '-ac', '1', '-ar', str(SR),
                '-af', 'highpass=f=70,afftdn=nf=-25,loudnorm=I=-18:TP=-2:LRA=9', str(limpio)], check=True)
with wave.open(str(limpio)) as w:
    x = np.frombuffer(w.readframes(w.getnframes()), np.int16).astype(np.float32) / 32768

# Energía por ventanas de 50 ms: habla si supera el 8 % del percentil 95.
n = int(0.05 * SR)
e = np.array([np.sqrt(np.mean(x[i:i + n] ** 2)) for i in range(0, len(x) - n, n)])
hay = e > 0.08 * np.percentile(e, 95)
# Tramos de habla separados por silencios de más de 0,6 s.
tramos, ini, sil = [], None, 0
for k, v in enumerate(hay):
    if v:
        ini = k if ini is None else ini
        sil = 0
    elif ini is not None:
        sil += 1
        if sil * 0.05 > 0.6:
            tramos.append((ini, k - sil)); ini, sil = None, 0
if ini is not None:
    tramos.append((ini, len(hay) - 1))
# Une tramos vecinos hasta formar 8 a 15 s y se queda con el más largo.
mejor, a = (0, 0), 0
for b in range(len(tramos)):
    while (tramos[b][1] - tramos[a][0]) * 0.05 > 15:
        a += 1
    dur = (tramos[b][1] - tramos[a][0]) * 0.05
    if dur > (mejor[1] - mejor[0]) * 0.05:
        mejor = (tramos[a][0], tramos[b][1])
i0, i1 = max(0, mejor[0] * n - int(0.15 * SR)), min(len(x), mejor[1] * n + int(0.25 * SR))
ref = x[i0:i1]
with wave.open(str(PERFIL / 'ref.wav'), 'wb') as w:
    w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes((np.clip(ref, -1, 1) * 32767).astype(np.int16).tobytes())

asr = sherpa_onnx.OfflineRecognizer.from_whisper(encoder=f'{W}/turbo-encoder.int8.onnx', decoder=f'{W}/turbo-decoder.int8.onnx',
                                                 tokens=f'{W}/turbo-tokens.txt', language='es', num_threads=4)
r16 = subprocess.run(['ffmpeg', '-v', 'error', '-i', str(PERFIL / 'ref.wav'), '-ac', '1', '-ar', '16000', '-f', 's16le', '-'],
                     capture_output=True, check=True).stdout
st = asr.create_stream(); st.accept_waveform(16000, np.frombuffer(r16, np.int16).astype(np.float32) / 32768)
asr.decode_stream(st)
texto = st.result.text.strip()
for mal, bien in {'Acciona': 'Axiona', 'acciona': 'Axiona', 'Antropic': 'Anthropic', 'Cloud': 'Claude'}.items():
    texto = texto.replace(mal, bien)  # Whisper no conoce las marcas
(PERFIL / 'ref.txt').write_text(texto, encoding='utf-8')
print(f'grabación {len(x) / SR:.1f} s · referencia {len(ref) / SR:.1f} s ({i0 / SR:.1f}–{i1 / SR:.1f} s)')
print('texto:', texto)
