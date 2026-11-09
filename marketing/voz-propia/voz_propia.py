#!/usr/bin/env python3
"""Locución de un guion con la voz clonada de Santiago.

Sintetiza frase por frase (así cada escena y cada subtítulo sabe cuándo empieza),
recorta silencios, pone las pausas del guion, acelera un poco en tono de
locutor y normaliza el volumen. Deja voz.wav y tiempos.json, el mismo formato
que usan los generadores de video de marketing/.

Motores locales y gratuitos, con licencia comercial:
  qwen        Qwen3-TTS 0.6B Base (Apache 2.0), corre en el entorno env-qwen
  chatterbox  Chatterbox Multilingual (MIT, con marca de agua inaudible), entorno env-cb

Guion JSON: {"velocidad": 1.06, "frases": [{"clave": "h1", "dice": "...", "lee": "...", "pausa": 0.4}, ...]}
  dice  = cómo se pronuncia (siglas y cifras escritas como se dicen)
  lee   = lo que va en el subtítulo

Uso: python voz_propia.py MOTOR PERFIL_DIR GUION.json SALIDA_DIR
"""
import json
import subprocess
import sys
import time
import wave
from pathlib import Path

import numpy as np

MOTOR, PERFIL, GUION, SALIDA = sys.argv[1], Path(sys.argv[2]), Path(sys.argv[3]), Path(sys.argv[4])
SALIDA.mkdir(parents=True, exist_ok=True)
g = json.loads(GUION.read_text(encoding='utf-8'))
REF, REF_TXT = str(PERFIL / 'ref.wav'), (PERFIL / 'ref.txt').read_text(encoding='utf-8').strip()


def motor():
    import torch
    torch.set_num_threads(4)
    if MOTOR == 'qwen':
        from qwen_tts import Qwen3TTSModel
        m = Qwen3TTSModel.from_pretrained('Qwen/Qwen3-TTS-12Hz-0.6B-Base', device_map='cpu', dtype=torch.float32)

        def decir(t):
            w, sr = m.generate_voice_clone(text=t, language='Spanish', ref_audio=REF, ref_text=REF_TXT)
            return np.asarray(w[0], np.float32), sr
        return decir
    if MOTOR == 'chatterbox':
        from chatterbox.mtl_tts import ChatterboxMultilingualTTS
        m = ChatterboxMultilingualTTS.from_pretrained(device='cpu')
        exag, cfg = g.get('energia', 0.6), g.get('cfg', 0.45)

        def decir(t):
            w = m.generate(t, language_id='es', audio_prompt_path=REF, exaggeration=exag, cfg_weight=cfg)
            return w.squeeze(0).numpy().astype(np.float32), m.sr
        return decir
    raise SystemExit(f'motor desconocido: {MOTOR}')


def recortar(x, sr, umbral=0.012, margen=0.04):
    idx = np.where(np.abs(x) > umbral)[0]
    if not len(idx):
        return x
    return x[max(0, idx[0] - int(margen * sr)):min(len(x), idx[-1] + int(margen * sr))]


decir = motor()
t0, trozos, tiempos, t, sr = time.time(), [], [], 0.25, None
for f in g['frases']:
    x, sr = decir(f['dice'])
    x = recortar(x, sr)
    if not trozos:
        trozos.append(np.zeros(int(0.25 * sr), np.float32))
    tiempos.append({'clave': f.get('clave'), 'inicio': round(t, 3), 'fin': round(t + len(x) / sr, 3), 'lee': f.get('lee', f['dice'])})
    trozos += [x, np.zeros(int(f.get('pausa', 0.3) * sr), np.float32)]
    t += len(x) / sr + f.get('pausa', 0.3)
crudo = SALIDA / 'voz-cruda.wav'
y = np.concatenate(trozos)
y = y / max(1e-6, np.abs(y).max()) * 0.9
with wave.open(str(crudo), 'wb') as w:
    w.setnchannels(1); w.setsampwidth(2); w.setframerate(sr)
    w.writeframes((y * 32767).astype(np.int16).tobytes())
v = float(g.get('velocidad', 1.06))
subprocess.run(['ffmpeg', '-y', '-v', 'error', '-i', str(crudo), '-af',
                f'atempo={v},highpass=f=70,acompressor=threshold=-20dB:ratio=3:attack=5:release=80,loudnorm=I=-16:TP=-1.5:LRA=9',
                '-ar', '48000', str(SALIDA / 'voz.wav')], check=True)
for k in tiempos:  # los tiempos se escalan con la velocidad
    k['inicio'], k['fin'] = round(k['inicio'] / v, 3), round(k['fin'] / v, 3)
(SALIDA / 'tiempos.json').write_text(json.dumps(tiempos, ensure_ascii=False, indent=1), encoding='utf-8')
print(f'{MOTOR}: {len(g["frases"])} frases · {t / v:.1f} s de audio en {time.time() - t0:.0f} s')
