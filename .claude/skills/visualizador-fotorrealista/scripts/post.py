# Acabado fotográfico: viñeta suave, grano fino, nitidez y curva leve. Uso: python3 post.py entrada.png salida.jpg [semilla]
import sys
import numpy as np
from PIL import Image, ImageFilter

src, dst = sys.argv[1], sys.argv[2]
seed = int(sys.argv[3]) if len(sys.argv) > 3 else 1
im = Image.open(src).convert('RGB')
im = im.filter(ImageFilter.UnsharpMask(radius=1.2, percent=55, threshold=2))
a = np.asarray(im).astype(np.float32) / 255.0
h, w, _ = a.shape
# curva S leve
a = np.clip(a, 0, 1)
a = a + 0.06 * (a - a * a) * (a - 0.5) * 4
# viñeta
y, x = np.mgrid[0:h, 0:w]
r = np.sqrt(((x - w / 2) / (w / 2)) ** 2 + ((y - h / 2) / (h / 2)) ** 2)
v = 1 - 0.22 * np.clip((r - 0.55) / 0.9, 0, 1) ** 1.6
a *= v[..., None]
# grano de película (más visible en sombras)
rng = np.random.default_rng(seed)
g = rng.normal(0, 1, (h, w, 1)).astype(np.float32)
lum = a.mean(axis=2, keepdims=True)
a += g * (0.010 + 0.012 * (1 - lum))
a = np.clip(a, 0, 1)
out = Image.fromarray((a * 255 + 0.5).astype(np.uint8))
if dst.lower().endswith('.jpg'):
    out.save(dst, quality=93, subsampling=0, optimize=True)
else:
    out.save(dst)
