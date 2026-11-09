#!/usr/bin/env python3
"""Cambia el cierre «Comenta X» de dos reels por un cierre limpio (sin cebo).

Toma el último cuadro del video, borra la zona del «Comenta» con el fondo
limpio de un cuadro anterior y escribe el nuevo texto con las mismas fuentes.
Uso: python3 cierre.py DL_DIR
"""
import subprocess
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

DL = Path(sys.argv[1])
F = Path('/tmp/claude-0/-home-user-axiona-obra/566d1b8e-acad-59e7-93fc-45f410b549a6/scratchpad/video/kit/fonts')
CIAN, GRIS, BLANCO = (27, 169, 192), (136, 144, 153), (236, 238, 240)


def fuente(n, t):
    return ImageFont.truetype(str(F / n), t)


def centrado(d, y, txt, f, color, sombra=False):
    w = d.textlength(txt, font=f)
    x = (1080 - w) / 2
    if sombra:
        d.text((x, y), txt, font=f, fill=(0, 0, 0), stroke_width=6, stroke_fill=(0, 0, 0))
    d.text((x, y), txt, font=f, fill=color)


def tarjeta(final, limpio, linea1, caja, sub1, sub2, salida):
    im = Image.open(DL / final).convert('RGB')
    fondo = Image.open(DL / limpio).convert('RGB')
    # zona a reemplazar: del «Comenta» a la línea divisoria, con bordes suaves
    m = Image.new('L', im.size, 0)
    ImageDraw.Draw(m).rectangle([0, 372, 1080, 985], fill=255)
    im.paste(fondo, (0, 0), m.filter(ImageFilter.GaussianBlur(6)))
    d = ImageDraw.Draw(im)
    centrado(d, 392, linea1, fuente('Inter-Black.ttf', 92), BLANCO, sombra=True)
    t = 104
    while d.textlength(caja, font=fuente('Inter-Black.ttf', t)) + 112 > 940:
        t -= 2
    f = fuente('Inter-Black.ttf', t)
    w = d.textlength(caja, font=f)
    x0, x1 = (1080 - w) / 2 - 56, (1080 + w) / 2 + 56
    d.rounded_rectangle([x0, 528, x1, 772], radius=34, outline=CIAN, width=7, fill=(8, 22, 30))
    centrado(d, 650 - t * 0.62, caja, f, CIAN)
    centrado(d, 828, sub1, fuente('Inter-Bold.ttf', 44), BLANCO)
    centrado(d, 896, sub2, fuente('Inter-SemiBold.ttf', 38), GRIS)
    im.save(DL / salida)


def armar(src, card, t1, t2, salida):
    dur = float(subprocess.check_output(['ffprobe', '-v', 'error', '-show_entries', 'format=duration',
                                         '-of', 'csv=p=0', str(DL / src)]).decode())
    d = dur - t2
    fc = (f'[0:v]trim=0:{t1},setpts=PTS-STARTPTS,fps=30,format=yuv420p,setsar=1[v0];'
          f'[1:v]fps=30,format=yuv420p,setsar=1,trim=0:{d:.3f},setpts=PTS-STARTPTS[v1];'
          f'[v0][v1]xfade=transition=fade:duration=0.3:offset={t1 - 0.3:.3f}[v];'
          f'[0:a]atrim=0:{t1},asetpts=PTS-STARTPTS[a0];'
          f'[0:a]atrim={t2},asetpts=PTS-STARTPTS[a1];'
          f'[a0][a1]acrossfade=d=0.3[a]')
    subprocess.run(['ffmpeg', '-y', '-v', 'error', '-i', str(DL / src), '-loop', '1', '-t', f'{d + 0.5:.3f}',
                    '-i', str(DL / card), '-filter_complex', fc, '-map', '[v]', '-map', '[a]',
                    '-c:v', 'libx264', '-preset', 'medium', '-crf', '19', '-pix_fmt', 'yuv420p',
                    '-c:a', 'aac', '-b:a', '160k', '-movflags', '+faststart', str(DL / salida)], check=True)


tarjeta('lic-final.png', 'lic-limpio.png', 'UN AGENTE ASÍ', 'PARA TU EMPRESA',
        'Escríbenos por WhatsApp', 'y te mostramos cómo trabajaría', 'lic-cierre.png')
tarjeta('amo-final.png', 'lic-limpio.png', 'CONSTRUIMOS', 'TU SISTEMA',
        'Escríbenos por WhatsApp', 'Prueba gratis: obra.axionasoft.com', 'amo-cierre.png')
armar('licitaciones.mp4', 'lic-cierre.png', 26.95, 31.55, 'axiona-agente-licitaciones.mp4')
armar('amoblada.mp4', 'amo-cierre.png', 33.2, 36.45, 'axiona-del-lote-a-tu-sistema.mp4')
print('listo')
