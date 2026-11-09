"""Parecido entre la voz de referencia y cada audio clonado (coseno de huellas de voz, 0 a 1)."""
import sys, librosa, numpy as np, torch
from chatterbox.models.voice_encoder import VoiceEncoder
from huggingface_hub import hf_hub_download
ve = VoiceEncoder(); ve.load_state_dict(torch.load(hf_hub_download('ResembleAI/chatterbox', 've.pt'), map_location='cpu')); ve.eval()
def huella(p):
    w, _ = librosa.load(p, sr=16000)
    e = ve.embeds_from_wavs([w], sample_rate=16000)
    return e[0] / np.linalg.norm(e[0])
ref = huella(sys.argv[1])
for p in sys.argv[2:]:
    print(f'{p}: {float(np.dot(ref, huella(p))):.3f}')
