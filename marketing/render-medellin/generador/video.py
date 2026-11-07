#!/usr/bin/env python3
"""Reel «Esta casa todavía no existe»: render fotorrealista con el valle de Aburrá.

Versión anónima de una demo residencial hecha por Axiona: no muestra el
nombre del proyecto ni de la constructora, ni fotos de su obra, ni el código
QR (lleva a una dirección con el nombre). Usa el reel nocturno sin su título,
los renders de obra gris y terminada, y el visor 3D por etapas con Medellín
de fondo. Mismo estilo, letras y música que los otros videos de Axiona.

Uso: AXIONA_FUENTES=… python3 video.py SALIDA.mp4 --medios DIR --tiempos tiempos.json --voz voz.wav [--cuadros 2,8]
  DIR tiene reel/ (cuadros JPG), fotos/ (renders) y visor/ (etapas del visor 3D).
"""
from __future__ import annotations

import argparse
import json
import math
import subprocess
import sys
import tempfile
from functools import lru_cache
from multiprocessing import Pool
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / 'servicio-redes' / 'generador'))
import promo  # noqa: E402
from promo import (AMBAR, CIAN, FF, FG, FPS, H, MUT, W, con_alfa,  # noqa: E402
                   fondo, fuente, panel, preparar_fondo, sale, suave, texto)

MEDIOS = Path('.')
E, F, PIEZAS, SUBS = {}, {}, None, []
WHATSAPP = 'WhatsApp +57 310 392 2935'
ETAPAS = ['Lote y replanteo', 'Cimentación', 'Columnas y contrapiso', 'Losa de entrepiso', 'Mampostería primer piso',
          'Segundo piso y cubierta', 'Obra gris', 'Fachada', 'Casa terminada']


def fr(k, extra=0.0):
    return F[k]['ini'] + extra


def marca(k, palabras):
    lee = F[k]['lee']
    i = lee.find(palabras)
    assert i >= 0, (k, palabras)
    return F[k]['ini'] + F[k]['dur'] * i / len(lee)


@lru_cache(48)
def imagen(rel):
    return Image.open(MEDIOS / rel).convert('RGBA')


@lru_cache(None)
def cuadros(carpeta):
    return sorted((MEDIOS / carpeta).glob('*.jpg'))


def entra_sale(t, t0, t1, ent=0.35, sal=0.3):
    return sale((t - t0) / ent) * (1 - suave((t - (t1 - sal)) / sal))


def pegar(lienzo, im, cx, y, a=1.0, k=1.0):
    if a <= 0.01:
        return
    if abs(k - 1) > 1e-3:
        im = im.resize((max(1, int(im.width * k)), max(1, int(im.height * k))), Image.BICUBIC)
    lienzo.alpha_composite(con_alfa(im, min(1.0, a)), (int(cx - im.width / 2), int(y)))


def lleno(lienzo, im, k=1.0, dx=0.0):
    """Pantalla completa; dx de -1 a 1 corre el encuadre por lo ancho de la imagen."""
    s = max(W / im.width, H / im.height) * max(1.0, k)
    cw, ch = W / s, H / s
    x0 = max(0.0, min(im.width - cw, (im.width - cw) / 2 * (1 + dx)))
    y0 = max(0.0, (im.height - ch) / 2)
    lienzo.alpha_composite(im.resize((W, H), Image.BICUBIC, box=(x0, y0, x0 + cw, y0 + ch)))


@lru_cache(16)
def borroso(rel):
    im = imagen(rel).convert('RGB')
    peq = im.resize((max(1, im.width // 8), max(1, im.height // 8)), Image.BILINEAR).filter(ImageFilter.GaussianBlur(5))
    peq = Image.eval(peq, lambda v: int(v * 0.42))
    s = max(W / peq.width, H / peq.height)
    big = peq.resize((math.ceil(peq.width * s), math.ceil(peq.height * s)), Image.BICUBIC)
    x0 = (big.width - W) // 2
    return big.crop((x0, 0, x0 + W, H)).convert('RGBA')


@lru_cache(None)
def degradado(alto, desde_arriba=True, fuerza=200):
    a = np.linspace(1, 0, alto) if desde_arriba else np.linspace(0, 1, alto)
    a = (a ** 1.6 * fuerza).astype(np.uint8)
    im = Image.new('RGBA', (W, alto), (6, 9, 13, 0))
    im.putalpha(Image.fromarray(np.repeat(a[:, None], W, axis=1)))
    return im


def sombras(lienzo, arriba=760, abajo=520):
    lienzo.alpha_composite(degradado(arriba, True, 205), (0, 0))
    lienzo.alpha_composite(degradado(abajo, False, 215), (0, H - abajo))


@lru_cache(64)
def chip(s, color=CIAN, tam=34):
    f = fuente('IBMPlexMono-Medium.ttf', tam)
    t = texto(s, f, color, esp=2)
    im = Image.new('RGBA', (t.width + 40, t.height + 16), (0, 0, 0, 0))
    ImageDraw.Draw(im).rounded_rectangle((0, 0, im.width - 1, im.height - 1), 20, fill=(8, 16, 24, 235), outline=color + (190,), width=2)
    im.alpha_composite(t, (20, 8))
    return im


@lru_cache(96)
def titulo(s, color=FG, tam=120):
    im = texto(s, fuente('ChakraPetch-Bold.ttf', tam), color)
    base = Image.new('RGBA', (im.width + 80, im.height + 80), (0, 0, 0, 0))
    a = Image.new('L', base.size, 0)
    a.paste(im.getchannel('A'), (40, 46))
    base.putalpha(a.filter(ImageFilter.GaussianBlur(14)).point(lambda v: int(v * 0.85)))
    base.alpha_composite(im, ((base.width - im.width) // 2, (base.height - im.height) // 2 - 6))
    return base


def lineas(lienzo, t, items, t0, t1, y0, paso, escalon=0.12):
    for i, (s, c, tam) in enumerate(items):
        ini = t0 + escalon * i
        if t < ini or t >= t1:
            continue
        pegar(lienzo, titulo(s, c, tam), W / 2, y0 + i * paso + (1 - sale((t - ini) / 0.35)) * 40, entra_sale(t, ini, t1))


def tarjeta(im, ancho):
    alto = round(ancho * im.height / im.width)
    rec = im.resize((ancho, alto), Image.LANCZOS)
    m = Image.new('L', rec.size, 0)
    ImageDraw.Draw(m).rounded_rectangle((0, 0, ancho - 1, alto - 1), 26, fill=255)
    rec.putalpha(m)
    p = panel(ancho + 8, alto + 8, radio=30, borde=(70, 86, 104), opaco=255)
    p.alpha_composite(rec, (44, 44))
    return p


@lru_cache(24)
def tarjeta_rel(rel, ancho):
    return tarjeta(imagen(rel), ancho)


def antes_despues(rel_a, rel_b, k, ancho=1040):
    """Tarjeta con las dos imágenes y la manija que las separa en la fracción k."""
    a, b = imagen(rel_a), imagen(rel_b)
    alto = round(ancho * a.height / a.width)
    ia, ib = a.resize((ancho, alto), Image.LANCZOS), b.resize((ancho, alto), Image.LANCZOS)
    x = int(ancho * k)
    mezcla = ia.copy()
    mezcla.paste(ib.crop((0, 0, x, alto)), (0, 0))
    d = ImageDraw.Draw(mezcla)
    d.line((x, 0, x, alto), fill=(255, 255, 255, 255), width=5)
    d.ellipse((x - 34, alto / 2 - 34, x + 34, alto / 2 + 34), fill=(255, 255, 255, 255))
    d.text((x, alto / 2), '‹›', font=fuente('Inter-Bold.ttf', 38), fill=(20, 24, 30, 255), anchor='mm')
    f = fuente('IBMPlexMono-Medium.ttf', 28)
    if x > 200:
        d.rounded_rectangle((20, 20, 240, 66), 14, fill=(8, 16, 24, 220))
        d.text((130, 43), 'TERMINADA', font=f, fill=AMBAR + (255,), anchor='mm')
    if x < ancho - 200:
        d.rounded_rectangle((ancho - 240, 20, ancho - 20, 66), 14, fill=(8, 16, 24, 220))
        d.text((ancho - 130, 43), 'OBRA GRIS', font=f, fill=(200, 205, 212, 255), anchor='mm')
    return tarjeta(mezcla, ancho)


# ---------------------------------------------------------------- escenas

def gancho(lienzo, t):
    a, b = E['gancho']
    if not (a <= t < b):
        return False
    fs = cuadros('reel')
    i = min(len(fs) - 1, int((t - a) / (b - a + 0.3) * len(fs)))
    lleno(lienzo, imagen(str(fs[i].relative_to(MEDIOS))))
    sombras(lienzo, 820, 420)
    lineas(lienzo, t, [('ESTA CASA', FG, 140), ('TODAVÍA NO EXISTE', FG, 104)], -0.5, fr('g2') + 0.1, 250, 160, 0.0)
    lineas(lienzo, t, [('Y YA SE PUEDE', FG, 116), ('VENDER', AMBAR, 170)], fr('g2') - 0.05, b + 0.3, 250, 150)
    return True


def etapas(lienzo, t):
    a, b = E['etapas']
    if not (a <= t < b):
        return False
    m_lote = marca('e1', 'del lote')
    ini = min(a + 0.6, m_lote)
    paso = (b - 0.25 - ini) / 9
    i = max(0, min(8, int((t - ini) / paso))) if t >= ini else 0
    rel = f'visor/fase{i + 1}.png'
    lienzo.alpha_composite(borroso(rel))
    pegar(lienzo, chip('DEL LOTE A LA LLAVE', CIAN, 38), W / 2, 260)
    lineas(lienzo, t, [('DESDE LOS PLANOS,', FG, 80), ('ETAPA POR ETAPA', CIAN, 96)], a - 0.1, b + 0.3, 340, 108)
    ti = ini + i * paso
    pegar(lienzo, tarjeta_rel(rel, 1000), W / 2, 640, 1.0, 1 + 0.035 * (1 - sale((t - ti) / 0.25)) if t >= ini else 1.0)
    pegar(lienzo, titulo(f'{i + 1}/9  {ETAPAS[i]}', AMBAR if i == 8 else FG, 60), W / 2, 1270)
    return True


def gris(lienzo, t):
    a, b = E['gris']
    if not (a <= t < b):
        return False
    lienzo.alpha_composite(borroso('fotos/frente-1920.jpg'))
    g = marca('r1', 'Y con un gesto')
    k = 0.02 + 0.96 * suave((t - g) / 1.6)
    lineas(lienzo, t, [('OBRA GRIS', (200, 205, 212), 110)], a - 0.1, g + 0.1, 300, 0)
    lineas(lienzo, t, [('Y CON UN GESTO,', FG, 92), ('TERMINADA', AMBAR, 130)], g, b + 0.3, 260, 120)
    pegar(lienzo, antes_despues('fotos/frente_gris-1920.jpg', 'fotos/frente-1920.jpg', k), W / 2, 640, 1.0, 1 + 0.02 * (t - a) / (b - a))
    return True


def vista(lienzo, t):
    a, b = E['vista']
    if not (a <= t < b):
        return False
    k = suave((t - a - 0.3) / 1.4)
    if k < 0.999:
        lienzo.alpha_composite(borroso('fotos/sala-1920.jpg'))
        pegar(lienzo, antes_despues('fotos/sala_gris-1920.jpg', 'fotos/sala-1920.jpg', 0.02 + 0.96 * k), W / 2, 640)
    else:
        e = max(0.0, (t - a - 1.7) / max(0.1, b - a - 1.7))
        lleno(lienzo, imagen('fotos/sala-1920.jpg'), 1.0 + 0.05 * e, -0.2 + 0.7 * e)
        sombras(lienzo, 700, 420)
    lineas(lienzo, t, [('LA VISTA REAL', FG, 104), ('DEL VALLE DE ABURRÁ', CIAN, 84)], a - 0.1, b + 0.3, 250, 128)
    return True


def noche(lienzo, t):
    a, b = E['noche']
    if not (a <= t < b):
        return False
    tomas = [('fotos/aerea-1920.jpg', -0.6, 0.4), ('fotos/tres4-1200.jpg', 0.5, -0.4), ('fotos/piedra-1200.jpg', -0.3, 0.3)]
    paso = (b - a) / len(tomas)
    i = min(len(tomas) - 1, int((t - a) / paso))
    rel, d0, d1 = tomas[i]
    e = (t - a - i * paso) / paso
    lleno(lienzo, imagen(rel), 1.04 + 0.05 * e, d0 + (d1 - d0) * e)
    sombras(lienzo, 760, 460)
    lineas(lienzo, t, [('LA IMAGEN QUE VENDE', FG, 92), ('LA PRIMERA VISITA', AMBAR, 104)], marca('n1', 'la imagen') - 0.1, b + 0.3, 250, 120)
    return True


def navegador(rel, ancho=1000):
    im = imagen(rel)
    alto = round(ancho * im.height / im.width)
    rec = im.resize((ancho, alto), Image.LANCZOS)
    barra = 64
    p = panel(ancho + 8, alto + barra + 8, radio=30, borde=(70, 86, 104), opaco=255)
    d = ImageDraw.Draw(p)
    for i, col in enumerate([(255, 95, 86), (255, 189, 46), (39, 201, 63)]):
        d.ellipse((40 + 30 + i * 34, 40 + 24, 40 + 50 + i * 34, 40 + 44), fill=col + (255,))
    d.rounded_rectangle((40 + 150, 40 + 14, 40 + ancho - 30, 40 + 54), 14, fill=(22, 28, 36, 255))
    d.text((40 + 176, 40 + 34), 'Recorrido 3D en el navegador', font=fuente('Inter-SemiBold.ttf', 26), fill=MUT + (255,), anchor='lm')
    m = Image.new('L', rec.size, 0)
    ImageDraw.Draw(m).rounded_rectangle((0, 0, ancho - 1, alto - 1), 18, fill=255)
    rec.putalpha(m)
    p.alpha_composite(rec, (44, 44 + barra))
    return p


def recorrido(lienzo, t):
    a, b = E['recorrido']
    if not (a <= t < b):
        return False
    lienzo.alpha_composite(borroso('visor/frente-noche.png'))
    hitos = [(a, 'visor/frente.png'), (marca('t1', 'entra'), 'visor/frente-noche.png'), (marca('t1', 'entra') + 0.9, 'visor/sala-noche.png')]
    actual = [h for h in hitos if t >= h[0]][-1]
    pegar(lienzo, chip('GÍRELA · ACÉRQUESE · ÁBRALA', CIAN, 36), W / 2, 300)
    pegar(lienzo, navegador(actual[1]), W / 2, 420 + 4 * math.sin(1.4 * t), 1.0, 1 + 0.03 * (1 - sale((t - actual[0]) / 0.25)))
    ra = marca('t1', 'realidad')
    if t >= ra:
        pegar(lienzo, chip('REALIDAD AUMENTADA: SOBRE LA MESA DEL CLIENTE', AMBAR, 30), W / 2, 1180, sale((t - ra) / 0.3))
    return True


@lru_cache(None)
def logo(alto=96):
    im = Image.new('RGBA', (alto, alto), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    k = alto / 32
    gr = int(2.6 * k)
    d.arc((6 * k, 5 * k, 26 * k, 25 * k), 180, 360, fill=CIAN + (255,), width=gr)
    d.line((6 * k + gr / 2, 15 * k, 6 * k + gr / 2, 25 * k), fill=CIAN + (255,), width=gr)
    d.line((26 * k - gr / 2, 15 * k, 26 * k - gr / 2, 25 * k), fill=CIAN + (255,), width=gr)
    pal = texto('AXIONA', fuente('ChakraPetch-Bold.ttf', int(alto * 0.62)), FG, esp=int(alto * 0.18))
    out = Image.new('RGBA', (alto + 28 + pal.width, alto), (0, 0, 0, 0))
    out.alpha_composite(im, (0, 0))
    out.alpha_composite(pal, (alto + 28, (alto - pal.height) // 2 + 4))
    return out


def cierre(lienzo, t):
    a, b = E['cierre']
    if t < a:
        return False
    fin = b + 9
    lienzo.alpha_composite(fondo(t, PIEZAS))
    pegar(lienzo, logo(), W / 2, 200, entra_sale(t, a, fin))
    for i, s in enumerate(('RENDER FOTORREALISTA', 'RECORRIDO 3D', 'VIDEO PARA REDES')):
        pegar(lienzo, chip(s, CIAN, 36), W / 2, 400 + i * 86, entra_sale(t, a + 0.15 * i, fin))
    z2 = fr('z2')
    lineas(lienzo, t, [('¿TIENES UN PROYECTO', FG, 96), ('EN PLANOS?', AMBAR, 150)], z2 - 0.05, fin, 720, 130)
    pegar(lienzo, chip(f'{WHATSAPP}  ·  axionasoft.com', FG, 34), W / 2, 1090, entra_sale(t, marca('z2', 'Escríbenos'), fin))
    pegar(lienzo, texto('PRIMERO SE CONSTRUYE EN CÓDIGO', fuente('Inter-Bold.ttf', 34), CIAN, esp=5), W / 2, 1420, entra_sale(t, z2 + 0.6, fin))
    pegar(lienzo, texto('DESPUÉS, EN OBRA', fuente('Inter-Bold.ttf', 34), FG, esp=5), W / 2, 1476, entra_sale(t, z2 + 0.75, fin))
    pegar(lienzo, texto('@axionadesarrollos', fuente('Inter-SemiBold.ttf', 36), MUT), W / 2, 1580, entra_sale(t, z2 + 0.9, fin))
    return True


ESCENAS = [gancho, etapas, gris, vista, noche, recorrido, cierre]


# ---------------------------------------------------------------- subtítulos

def trozos():
    salida = []
    for k, f in F.items():
        if f['escena'] in ('gancho', 'cierre'):
            continue
        palabras, lineas_, actual = f['lee'].split(' '), [], ''
        for p in palabras:
            if len(actual) + len(p) + 1 > 34 and actual:
                lineas_.append(actual)
                actual = p
            else:
                actual = f'{actual} {p}'.strip()
        lineas_.append(actual)
        total = sum(len(s) + 1 for s in lineas_)
        acum = 0
        for i, s in enumerate(lineas_):
            ini = f['ini'] + f['dur'] * acum / total
            acum += len(s) + 1
            fin = f['ini'] + f['dur'] * acum / total if i < len(lineas_) - 1 else f['ini'] + f['dur'] + 0.2
            salida.append((ini, fin, s))
    return salida


RESALTE = {'planos,', 'lote', 'terminada.', 'gris.', 'terminada:', 'vista', 'real', 'Aburrá.', 'noche,', 'primera', 'visita.',
           'navegador,', 'realidad', 'aumentada.'}


@lru_cache(256)
def sprite_sub(s):
    f = fuente('Inter-Bold.ttf', 50)
    palabras = s.split(' ')
    esp = f.getlength(' ')
    ancho = sum(f.getlength(p) for p in palabras) + esp * (len(palabras) - 1)
    im = Image.new('RGBA', (int(ancho) + 64, 96), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.rounded_rectangle((0, 0, im.width - 1, im.height - 1), 26, fill=(8, 12, 17, 228))
    x = 32
    for p in palabras:
        d.text((x, 48), p, font=f, fill=(CIAN if p in RESALTE else FG) + (255,), anchor='lm')
        x += f.getlength(p) + esp
    return im


def subtitulos(lienzo, t):
    for ini, fin, s in SUBS:
        if ini <= t < fin:
            im = sprite_sub(s)
            lienzo.alpha_composite(con_alfa(im, sale((t - ini) / 0.12)), ((W - im.width) // 2, 1676))


# ---------------------------------------------------------------- render

def cuadro(t):
    lienzo = Image.new('RGBA', (W, H), (6, 9, 13, 255))
    for esc in ESCENAS:
        if esc(lienzo, t):
            break
    subtitulos(lienzo, t)
    return lienzo.convert('RGB')


def tramo(args):
    a, b, ruta, medios, tiempos = args
    preparar(medios, tiempos)
    proc = subprocess.Popen([FF, '-y', '-v', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{W}x{H}', '-r', str(FPS),
                             '-i', '-', '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-profile:v', 'high',
                             '-level', '4.1', '-pix_fmt', 'yuv420p', '-g', str(FPS * 2), str(ruta)], stdin=subprocess.PIPE)
    for k in range(a, b):
        proc.stdin.write(cuadro(k / FPS).tobytes())
    proc.stdin.close()
    if proc.wait():
        raise SystemExit('ffmpeg falló en un tramo')
    return ruta


def preparar(medios, tiempos):
    global MEDIOS, E, F, PIEZAS, SUBS
    MEDIOS = Path(medios)
    E, F = tiempos['escenas'], tiempos['frases']
    PIEZAS = preparar_fondo()
    SUBS = trozos()
    promo.DUR = tiempos['dur']
    promo.DATOS, promo.SERVICIO, promo.CIERRE = ((E[k][0], E[k][0]) for k in ('etapas', 'noche', 'cierre'))
    promo.CUPOS = (tiempos['dur'] - 0.5, tiempos['dur'])


def render(salida, voz, medios, tiempos, procesos=4):
    salida = Path(salida)
    total = int(round(tiempos['dur'] * FPS))
    with tempfile.TemporaryDirectory() as tmp:
        tmp = Path(tmp)
        cortes = np.linspace(0, total, procesos + 1).astype(int)
        partes = [(int(a), int(b), tmp / f'tramo{k}.mp4', medios, tiempos) for k, (a, b) in enumerate(zip(cortes, cortes[1:]))]
        with Pool(procesos) as pool:
            hechos = pool.map(tramo, partes)
        (tmp / 'lista.txt').write_text(''.join(f"file '{p}'\n" for p in hechos))
        subprocess.run([FF, '-y', '-v', 'error', '-f', 'concat', '-safe', '0', '-i', str(tmp / 'lista.txt'), '-c', 'copy', str(tmp / 'video.mp4')], check=True)
        promo.musica(tmp / 'musica.wav')
        subprocess.run([FF, '-y', '-v', 'error', '-i', str(tmp / 'video.mp4'), '-i', str(tmp / 'musica.wav'), '-i', str(voz),
                        '-filter_complex',
                        '[1:a]aresample=48000,volume=0.24[m];'
                        '[2:a]aresample=48000,highpass=f=80,acompressor=threshold=0.1:ratio=3:attack=5:release=120,'
                        'pan=stereo|c0=c0|c1=c0,asplit=2[v][vs];'
                        '[m][vs]sidechaincompress=threshold=0.03:ratio=6:attack=15:release=350[md];'
                        '[md][v]amix=inputs=2:normalize=0,loudnorm=I=-14:TP=-1.5:LRA=11,alimiter=limit=0.84:level=false[a]',
                        '-map', '0:v', '-map', '[a]', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-ar', '48000',
                        '-movflags', '+faststart', '-shortest', str(salida)], check=True)


if __name__ == '__main__':
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument('salida')
    p.add_argument('--medios', required=True)
    p.add_argument('--tiempos', required=True)
    p.add_argument('--voz', required=True)
    p.add_argument('--cuadros', default='', help='solo guarda estos instantes como JPG')
    a = p.parse_args()
    tiempos = json.loads(Path(a.tiempos).read_text())
    if a.cuadros:
        preparar(a.medios, tiempos)
        for t in (float(x) for x in a.cuadros.split(',') if x):
            cuadro(t).save(Path(a.salida).parent / f'cuadro_{t:06.2f}.jpg', quality=88)
    else:
        render(a.salida, a.voz, a.medios, tiempos)
