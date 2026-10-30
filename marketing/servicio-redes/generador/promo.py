#!/usr/bin/env python3
"""Video promocional de Axiona: 5 cupos de manejo de redes con IA.

Vertical 1080 × 1920 a 30 fps, para estados de WhatsApp, reels y shorts.
Todo se dibuja aquí (texto, tarjetas, fondo y música original), así que el
mismo script da el mismo video en cualquier máquina con Pillow, NumPy y ffmpeg.

Uso: python3 promo.py SALIDA.mp4 [--sin-musica] [--cuadros 1.0,5.5,...]
"""
from __future__ import annotations

import argparse
import json
import math
import os
import shutil
import subprocess
import wave
from functools import lru_cache
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

W, H, FPS, DUR = 1080, 1920, 30, 29.0
BG = (8, 12, 17)
PANEL = (15, 21, 29)
LINEA = (44, 59, 77)
FG = (227, 234, 242)
MUT = (134, 149, 168)
CIAN = (63, 207, 255)
MENTA = (65, 226, 164)
AMBAR = (255, 174, 43)

FUENTES = Path(os.environ.get('AXIONA_FUENTES', Path(__file__).resolve().parent.parent / 'kit' / 'fonts'))
FF = os.environ.get('FFMPEG') or shutil.which('ffmpeg') or 'ffmpeg'

# Escenas: (inicio, fin) en segundos.
GANCHO, DATOS, SERVICIO, CUPOS, CIERRE = (0.0, 3.4), (3.4, 11.6), (11.6, 17.8), (17.8, 23.6), (23.6, DUR)
# Momentos de las tarjetas, de los puntos de la lista y del remate. Con locución salen de tiempos.json.
T_TARJETAS = [3.75, 4.95, 6.15, 7.35]
T_LISTA = [12.6, 13.1, 13.6, 14.1]
T_REMATE = 15.0


def configurar(tiempos):
    """Toma los tiempos que calcula voz.py para que cada escena dure lo que su frase."""
    global DUR, GANCHO, DATOS, SERVICIO, CUPOS, CIERRE, T_TARJETAS, T_LISTA, T_REMATE
    DUR = tiempos['dur']
    GANCHO, DATOS, SERVICIO, CUPOS, CIERRE = (tuple(tiempos[k]) for k in ('gancho', 'datos', 'servicio', 'cupos', 'cierre'))
    T_TARJETAS, T_LISTA, T_REMATE = tiempos['tarjetas'], tiempos['lista'], tiempos['remate']


@lru_cache(None)
def fuente(nombre, tam):
    return ImageFont.truetype(str(FUENTES / nombre), tam)


def lim(x, a=0.0, b=1.0):
    return max(a, min(b, x))


def sale(x):
    x = lim(x)
    return 1 - (1 - x) ** 3


def suave(x):
    x = lim(x)
    return 4 * x ** 3 if x < 0.5 else 1 - (-2 * x + 2) ** 3 / 2


# ---------- sprites ----------

def texto(s, f, color, esp=0):
    """Sprite RGBA del texto con la altura de línea de la fuente (esp: aire entre letras)."""
    ancho = sum(f.getlength(c) + esp for c in s) - esp if esp else f.getlength(s)
    asc, desc = f.getmetrics()
    im = Image.new('RGBA', (math.ceil(ancho) + 12, asc + desc + 12), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    if esp:
        x = 6
        for c in s:
            d.text((x, 6), c, font=f, fill=color + (255,))
            x += f.getlength(c) + esp
    else:
        d.text((6, 6), s, font=f, fill=color + (255,))
    return im


def brillo(im, color, radio=18, fuerza=0.75):
    """Halo de color detrás del sprite."""
    pad = radio * 3
    base = Image.new('RGBA', (im.width + 2 * pad, im.height + 2 * pad), (0, 0, 0, 0))
    alfa = Image.new('L', base.size, 0)
    alfa.paste(im.getchannel('A'), (pad, pad))
    alfa = alfa.filter(ImageFilter.GaussianBlur(radio)).point(lambda v: int(v * fuerza))
    halo = Image.new('RGBA', base.size, color + (0,))
    halo.putalpha(alfa)
    base.alpha_composite(halo)
    base.alpha_composite(im, (pad, pad))
    return base


def panel(w, h, radio=30, borde=LINEA, acento=None, opaco=232):
    pad = 40
    im = Image.new('RGBA', (w + 2 * pad, h + 2 * pad), (0, 0, 0, 0))
    sombra = Image.new('RGBA', im.size, (0, 0, 0, 0))
    ImageDraw.Draw(sombra).rounded_rectangle((pad, pad + 14, pad + w, pad + h + 14), radio, fill=(0, 0, 0, 150))
    im.alpha_composite(sombra.filter(ImageFilter.GaussianBlur(20)))
    d = ImageDraw.Draw(im)
    d.rounded_rectangle((pad, pad, pad + w, pad + h), radio, fill=PANEL + (opaco,), outline=borde + (255,), width=3)
    if acento:
        d.rounded_rectangle((pad + 22, pad + 30, pad + 31, pad + h - 30), 5, fill=acento + (255,))
    return im


def con_alfa(im, a):
    if a >= 0.999:
        return im
    im = im.copy()
    im.putalpha(im.getchannel('A').point(lambda v: int(v * a)))
    return im


class Capa:
    """Elemento que entra subiendo (o creciendo) y sale al final de su escena."""

    def __init__(self, im, y, ini, fin, x=None, modo='sube', dur=0.5):
        self.im, self.y, self.ini, self.fin, self.modo, self.dur = im, y, ini, fin, modo, dur
        self.x = (W - im.width) // 2 if x is None else x

    def pintar(self, lienzo, t):
        if t < self.ini or t >= self.fin:
            return
        e = sale((t - self.ini) / self.dur)
        s = 1 - suave((t - (self.fin - 0.35)) / 0.35)
        a = e * s
        if a <= 0.01:
            return
        im, x, y = self.im, self.x, self.y + (1 - e) * 46 - (1 - s) * 24
        if self.modo == 'crece':
            k = 0.86 + 0.14 * e
            im = im.resize((max(1, int(im.width * k)), max(1, int(im.height * k))), Image.BICUBIC)
            x += (self.im.width - im.width) / 2
            y += (self.im.height - im.height) / 2
        lienzo.alpha_composite(con_alfa(im, a), (int(x), int(y)))


# ---------- fondo ----------

def mancha(diam, color, fuerza):
    r = np.hypot(*np.meshgrid(np.linspace(-1, 1, diam), np.linspace(-1, 1, diam)))
    a = (np.clip(1 - r, 0, 1) ** 2.2 * 255 * fuerza).astype(np.uint8)
    im = Image.new('RGBA', (diam, diam), color + (0,))
    im.putalpha(Image.fromarray(a))
    return im


def preparar_fondo():
    y = np.linspace(0, 1, H)[:, None, None]
    arriba, abajo = np.array((11, 16, 24)), np.array((6, 9, 13))
    base = (arriba * (1 - y) + abajo * y).repeat(W, axis=1).astype(np.uint8)
    base = Image.fromarray(base).convert('RGBA')
    paso = 72
    rejilla = Image.new('RGBA', (W, H + paso), (0, 0, 0, 0))
    d = ImageDraw.Draw(rejilla)
    for x in range(0, W, paso):
        d.line((x, 0, x, H + paso), fill=(33, 45, 59, 70), width=1)
    for yy in range(0, H + paso, paso):
        d.line((0, yy, W, yy), fill=(33, 45, 59, 70), width=1)
    r = np.hypot(*np.meshgrid(np.linspace(-1, 1, W), np.linspace(-1, 1, H)))
    vin = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    vin.putalpha(Image.fromarray((np.clip(r - 0.55, 0, 1) * 330).clip(0, 200).astype(np.uint8)))
    return base, rejilla, paso, mancha(1300, CIAN, 0.20), mancha(1100, MENTA, 0.10), vin


def fondo(t, piezas):
    base, rejilla, paso, m1, m2, vin = piezas
    f = base.copy()
    f.alpha_composite(m1, (int(540 + 230 * math.sin(0.26 * t) - 650), int(720 + 200 * math.cos(0.21 * t) - 650)))
    f.alpha_composite(m2, (int(540 - 280 * math.sin(0.19 * t + 1) - 550), int(1380 + 170 * math.sin(0.23 * t) - 550)))
    off = int(t * 16) % paso
    f.alpha_composite(rejilla.crop((0, off, W, off + H)))
    f.alpha_composite(vin)
    return f


# ---------- escenas ----------

def lineas_centradas(textos, f, color, y0, paso, ini, fin, modo='sube', halo=None, escalon=0.0):
    capas = []
    for i, s in enumerate(textos):
        im = texto(s, f, color)
        if halo:
            im = brillo(im, halo, 16, 0.55)
            capas.append(Capa(im, y0 + i * paso - (im.height - texto(s, f, color).height) // 2, ini + i * escalon, fin, modo=modo))
        else:
            capas.append(Capa(im, y0 + i * paso, ini + i * escalon, fin, modo=modo))
    return capas


def etiqueta(s, color, y, ini, fin):
    return Capa(texto(s, fuente('IBMPlexMono-Medium.ttf', 30), color, esp=5), y, ini, fin)


def tarjeta_dato(sub1, sub2):
    """Tarjeta sin la cifra: la cifra se pinta encima mientras cuenta."""
    im = panel(920, 232, acento=CIAN)
    d = ImageDraw.Draw(im)
    d.text((40 + 500, 40 + 64), sub1, font=fuente('Inter-Bold.ttf', 44), fill=FG + (255,))
    d.text((40 + 500, 40 + 124), sub2, font=fuente('Inter-SemiBold.ttf', 34), fill=MUT + (255,))
    return im


@lru_cache(4096)
def cifra(s):
    return brillo(texto(s, fuente('ChakraPetch-Bold.ttf', 100), CIAN), CIAN, 16, 0.5)


def formato_cifra(meta, k):
    if meta == '4.600+':
        v = int(round(4600 * k / 10) * 10)
        return f'{v // 1000}.{v % 1000:03d}+' if v >= 1000 else f'{v}+'
    if meta == '99.7 %':
        return f'{99.7 * k:.1f} %'
    n = int(meta.split()[0])
    return f'{round(n * k)}' + (' %' if '%' in meta else '')


DATOS_REEL = [
    ('4.600+', 'vistas', 'en el primer reel'),
    ('99.7 %', 'no me seguía', 'de quienes lo vieron'),
    ('49 %', 'desde México', 'de todas las vistas'),
    ('51', 'me gusta', 'antes no pasaba de 5'),
]
Y_TARJETAS = [430, 712, 994, 1276]


def check(d, x, y, r=30):
    d.ellipse((x, y, x + 2 * r, y + 2 * r), fill=CIAN + (255,))
    d.line((x + r * 0.55, y + r * 1.02, x + r * 0.9, y + r * 1.38, x + r * 1.5, y + r * 0.66), fill=BG + (255,), width=7, joint='curve')


def item_lista(s):
    f = fuente('Inter-SemiBold.ttf', 48)
    im = Image.new('RGBA', (900, 80), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    check(d, 0, 10)
    d.text((88, 8), s, font=f, fill=FG + (255,))
    return im


def tarjeta_marca():
    im = panel(780, 250, radio=36, borde=CIAN)
    d = ImageDraw.Draw(im)
    marca = texto('AXIONA', fuente('ChakraPetch-Bold.ttf', 78), FG, esp=12)
    im.alpha_composite(marca, ((im.width - marca.width) // 2, 40 + 22))
    sub = texto('DESARROLLOS INTELIGENTES', fuente('IBMPlexMono-Medium.ttf', 27), CIAN, esp=6)
    im.alpha_composite(sub, ((im.width - sub.width) // 2, 40 + 122))
    f = fuente('Inter-SemiBold.ttf', 36)
    d.text((im.width / 2, 40 + 205), '@axionadesarrollos', font=f, fill=MUT + (255,), anchor='mm')
    return im


def armar_capas():
    capas = []
    # Cabecera fija, debajo de la barra de la app.
    cab = texto('AXIONA · REDES CON IA', fuente('IBMPlexMono-Medium.ttf', 28), MUT, esp=5)
    punto = Image.new('RGBA', (cab.width + 34, cab.height), (0, 0, 0, 0))
    ImageDraw.Draw(punto).ellipse((0, cab.height // 2 - 9, 18, cab.height // 2 + 9), fill=MENTA + (255,))
    punto.alpha_composite(cab, (34, 0))
    capas.append(Capa(punto, 214, 0.0, DUR + 1, dur=0.3))

    # 1. Gancho
    i, f = GANCHO
    capas.append(etiqueta('CASO REAL', CIAN, 560, i + 0.05, f))
    capas += lineas_centradas(['Automaticé', 'mis redes', 'con IA.'], fuente('ChakraPetch-Bold.ttf', 128), FG, 640, 138, i + 0.12, f, escalon=0.12)
    capas.append(Capa(texto('y esto pasó en menos de un día', fuente('Inter-SemiBold.ttf', 50), MUT), 1110, i + 1.0, f))

    # 2. Resultados
    i, f = DATOS
    capas.append(etiqueta('RESULTADOS DEL PRIMER REEL', CIAN, 340, i + 0.1, f))
    for (meta, s1, s2), y, t0 in zip(DATOS_REEL, Y_TARJETAS, T_TARJETAS):
        capas.append(Capa(tarjeta_dato(s1, s2), y - 40, t0, f))
    capas.append(Capa(texto('Datos de Instagram · @axionadesarrollos · 30 oct 2026', fuente('IBMPlexMono-Medium.ttf', 24), MUT), 1560, T_TARJETAS[3] + 1.0, f))

    # 3. Servicio
    i, f = SERVICIO
    capas.append(etiqueta('AHORA LO HAGO PARA TU NEGOCIO', CIAN, 380, i + 0.1, f))
    capas += lineas_centradas(['Tus redes,'], fuente('ChakraPetch-Bold.ttf', 104), FG, 460, 0, i + 0.25, f)
    capas += lineas_centradas(['en piloto automático'], fuente('ChakraPetch-Bold.ttf', 84), CIAN, 580, 0, i + 0.45, f)
    for k, s in enumerate(['Contenido y calendario del mes', 'Publicación diaria automática',
                           'Reels con subtítulos y portada', 'Métricas cada semana']):
        capas.append(Capa(item_lista(s), 790 + k * 122, T_LISTA[k], f, x=130))
    capas.append(Capa(texto('Tú vendes. Yo me encargo de tus redes.', fuente('Inter-SemiBold.ttf', 44), MUT), 1330, T_REMATE, f))

    # 4. Cupos
    i, f = CUPOS
    capas.append(etiqueta('CUPOS LIMITADOS', AMBAR, 520, i + 0.1, f))
    capas.append(Capa(brillo(texto('5 cupos', fuente('ChakraPetch-Bold.ttf', 176), FG), CIAN, 22, 0.45), 540, i + 0.2, f, modo='crece'))
    capas.append(Capa(texto('para emprendedores', fuente('Inter-Bold.ttf', 62), FG), 840, i + 0.6, f))
    capas.append(Capa(texto('Instagram · Facebook · TikTok · YouTube', fuente('Inter-SemiBold.ttf', 40), MUT), 1170, i + 2.0, f))

    # 5. Cierre
    i, f = CIERRE
    capas += lineas_centradas(['Escríbeme'], fuente('ChakraPetch-Bold.ttf', 132), FG, 520, 0, i + 0.15, f + 1, modo='crece')
    capas += lineas_centradas(['al interno'], fuente('ChakraPetch-Bold.ttf', 132), CIAN, 670, 0, i + 0.35, f + 1, modo='crece', halo=CIAN)
    capas.append(Capa(texto('y te paso la cotización', fuente('Inter-SemiBold.ttf', 48), MUT), 880, i + 0.9, f + 1))
    capas.append(Capa(texto('para tu negocio', fuente('Inter-SemiBold.ttf', 48), MUT), 944, i + 1.0, f + 1))
    capas.append(Capa(tarjeta_marca(), 1100, i + 1.5, f + 1, modo='crece'))
    return capas


def dinamicos(lienzo, t):
    # Flecha del gancho.
    i, f = GANCHO
    if i + 1.4 <= t < f:
        a = sale((t - i - 1.4) / 0.4) * (1 - suave((t - (f - 0.35)) / 0.35))
        capa = Image.new('RGBA', (120, 90), (0, 0, 0, 0))
        dy = 10 * math.sin((t - i) * 6)
        ImageDraw.Draw(capa).line((24, 20 + dy, 60, 56 + dy, 96, 20 + dy), fill=CIAN + (int(255 * a),), width=10, joint='curve')
        lienzo.alpha_composite(capa, (W // 2 - 60, 1210))

    # Cifras que cuentan dentro de las tarjetas.
    i, f = DATOS
    if i <= t < f:
        s = 1 - suave((t - (f - 0.35)) / 0.35)
        for (meta, _, _), y, t0 in zip(DATOS_REEL, Y_TARJETAS, T_TARJETAS):
            if t < t0:
                continue
            e = sale((t - t0) / 0.5)
            k = sale((t - t0 - 0.15) / 0.95)
            im = cifra(formato_cifra(meta, k))
            yy = y - 40 + (1 - e) * 46 - (1 - s) * 24
            lienzo.alpha_composite(con_alfa(im, e * s), (int((W - 920) // 2 + 30), int(yy + 40 + 116 - im.height / 2)))

    # Los 5 cupos: aparecen y se encienden uno por uno.
    i, f = CUPOS
    if i + 1.0 <= t < f:
        s = 1 - suave((t - (f - 0.35)) / 0.35)
        lado, hueco = 132, 30
        x0 = (W - (5 * lado + 4 * hueco)) // 2
        fnum = fuente('ChakraPetch-Bold.ttf', 66)
        for n in range(5):
            t0 = i + 1.0 + n * 0.16
            if t < t0:
                continue
            e = sale((t - t0) / 0.35)
            luz = sale((t - (i + 2.6 + n * 0.22)) / 0.3)
            pad = 30
            cuadro = Image.new('RGBA', (lado + 2 * pad, lado + 2 * pad), (0, 0, 0, 0))
            d = ImageDraw.Draw(cuadro)
            relleno = tuple(int(PANEL[c] + (CIAN[c] - PANEL[c]) * luz) for c in range(3))
            d.rounded_rectangle((pad, pad, pad + lado, pad + lado), 26, fill=relleno + (240,), outline=CIAN + (255,), width=4)
            num = tuple(int(FG[c] + (BG[c] - FG[c]) * luz) for c in range(3))
            d.text((pad + lado / 2, pad + lado / 2 + 2), str(n + 1), font=fnum, fill=num + (255,), anchor='mm')
            if luz > 0:
                cuadro = brillo(cuadro, CIAN, 14, 0.5 * luz)
            k = 0.7 + 0.3 * e
            if k < 0.999:
                cuadro = cuadro.resize((int(cuadro.width * k), int(cuadro.height * k)), Image.BICUBIC)
            cx = x0 + n * (lado + hueco) + lado / 2
            cy = 1000 + lado / 2
            lienzo.alpha_composite(con_alfa(cuadro, e * s), (int(cx - cuadro.width / 2), int(cy - cuadro.height / 2)))


# ---------- música original ----------

def musica(ruta, sr=48000):
    """Pulso tranquilo en La menor (Am–F–C–G) a 112 bpm, hecho con osciladores.

    El bajo y el punteo van en registros que suenan en el parlante de un celular."""
    n = int(DUR * sr)
    t = np.arange(n) / sr
    rng = np.random.default_rng(7)
    pulso = 60 / 112
    nota = lambda m: 440 * 2 ** ((m - 69) / 12)
    acordes = [(57, 60, 64, 69), (53, 57, 60, 65), (48, 52, 55, 60), (55, 59, 62, 67)]
    bajos = [45, 41, 48, 43]
    largo = 8 * pulso
    pad_l, pad_r, bajo, bombo, plato, punteo = (np.zeros(n) for _ in range(6))
    for k in range(int(DUR / largo) + 1):
        a = k * largo
        if a >= DUR:
            break
        i0, i1 = int(a * sr), min(n, int((a + largo + 0.3) * sr))
        tt = t[i0:i1] - a
        env = np.minimum(1, tt / 0.8) * np.clip((largo + 0.3 - tt) / 0.6, 0, 1)
        ac = acordes[k % 4]
        pad_l[i0:i1] += env * sum(np.sin(2 * np.pi * nota(m) * tt) + 0.25 * np.sin(4 * np.pi * nota(m) * tt) for m in ac) / len(ac)
        pad_r[i0:i1] += env * sum(np.sin(2 * np.pi * nota(m) * 1.003 * tt + 0.7) + 0.25 * np.sin(4 * np.pi * nota(m) * 1.003 * tt) for m in ac) / len(ac)
        for b in range(8):
            j0 = int((a + b * pulso) * sr)
            if j0 >= n:
                break
            j1 = min(n, j0 + int(0.42 * sr))
            tb = t[j0:j1] - (a + b * pulso)
            f0 = nota(bajos[k % 4])
            onda = np.tanh(1.6 * np.sin(2 * np.pi * f0 * tb)) + 0.45 * np.sin(4 * np.pi * f0 * tb)
            bajo[j0:j1] += onda * np.minimum(1, tb / 0.012) * np.exp(-5.5 * tb)
        # Punteo en corcheas con las notas del acorde, una octava arriba.
        for b in range(16):
            j0 = int((a + b * pulso / 2) * sr)
            if j0 >= n:
                break
            j1 = min(n, j0 + int(0.5 * sr))
            tb = t[j0:j1] - (a + b * pulso / 2)
            fp = nota(ac[[0, 1, 2, 3, 2, 1, 2, 3][b % 8]] + 12)
            onda = np.sin(2 * np.pi * fp * tb) + 0.3 * np.sin(4 * np.pi * fp * tb) + 0.12 * np.sin(6 * np.pi * fp * tb)
            punteo[j0:j1] += onda * np.minimum(1, tb / 0.004) * np.exp(-7.5 * tb)
    for b in range(int(DUR / pulso) + 1):
        tb0 = b * pulso
        if tb0 < 4 * pulso or tb0 >= DUR - 1.2:  # el bombo entra al segundo compás
            continue
        j0, j1 = int(tb0 * sr), min(n, int((tb0 + 0.45) * sr))
        tb = t[j0:j1] - tb0
        bombo[j0:j1] += np.sin(2 * np.pi * (52 * tb + 110 / 32 * (1 - np.exp(-32 * tb)))) * np.exp(-9 * tb)
        k1 = min(n, j0 + int(0.006 * sr))  # golpe corto para que el bombo se oiga en el celular
        bombo[j0:k1] += 0.5 * np.diff(rng.standard_normal(k1 - j0), prepend=0)
        h0 = int((tb0 + pulso / 2) * sr)
        h1 = min(n, h0 + int(0.12 * sr))
        if h0 < n:
            ruido = rng.standard_normal(h1 - h0)
            plato[h0:h1] += np.diff(ruido, prepend=0) * np.exp(-40 * (t[h0:h1] - t[h0]))
    # Barridos suaves en los cambios de escena.
    barrido = np.zeros(n)
    for tc in (DATOS[0], SERVICIO[0], CUPOS[0], CIERRE[0]):
        j0, j1 = int((tc - 0.45) * sr), min(n, int((tc + 0.25) * sr))
        tb = t[j0:j1] - (tc - 0.45)
        env = np.sin(np.pi * np.clip(tb / 0.7, 0, 1)) ** 2
        ruido = rng.standard_normal(j1 - j0)
        espectro = np.fft.rfft(ruido)
        fr = np.fft.rfftfreq(len(ruido), 1 / sr)
        espectro *= np.exp(-((np.log(fr + 1) - np.log(1800)) ** 2) / 0.9)
        barrido[j0:j1] += np.fft.irfft(espectro, len(ruido)) * env
    barrido /= max(1e-9, np.abs(barrido).max())
    # Toques cuando se encienden los cupos.
    toques = np.zeros(n)
    for m in range(5):
        tc = CUPOS[0] + 2.6 + m * 0.22
        j0, j1 = int(tc * sr), min(n, int((tc + 0.25) * sr))
        tb = t[j0:j1] - tc
        toques[j0:j1] += np.sin(2 * np.pi * nota(76 + [0, 3, 7, 10, 12][m]) * tb) * np.exp(-14 * tb)
    mezcla = 0.12 * bajo + 0.3 * bombo + 0.06 * plato + 0.06 * barrido + 0.09 * toques + 0.1 * punteo
    izq = mezcla + 0.2 * pad_l
    der = mezcla + 0.2 * pad_r
    estereo = np.stack([izq, der], axis=1)
    fade = np.ones(n)
    fade[: int(0.25 * sr)] = np.linspace(0, 1, int(0.25 * sr))
    fade[-int(1.4 * sr):] = np.linspace(1, 0, int(1.4 * sr))
    estereo *= fade[:, None]
    estereo /= np.abs(estereo).max() / 0.8
    with wave.open(str(ruta), 'wb') as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(sr)
        w.writeframes((estereo * 32767).astype('<i2').tobytes())


def render(salida, sin_musica=False, cuadros=None, voz=None):
    piezas = preparar_fondo()
    capas = armar_capas()

    def cuadro(t):
        lienzo = fondo(t, piezas)
        for c in capas:
            c.pintar(lienzo, t)
        dinamicos(lienzo, t)
        return lienzo.convert('RGB')

    salida = Path(salida)
    if cuadros:
        for t in cuadros:
            cuadro(t).save(salida.parent / f'cuadro_{t:05.2f}.png')
        return
    audio = salida.with_suffix('.wav')
    if sin_musica:
        entrada_audio = ['-f', 'lavfi', '-t', str(DUR), '-i', 'anullsrc=r=48000:cl=stereo']
        filtro = []
    else:
        musica(audio)
        entrada_audio = ['-i', str(audio)]
        filtro = ['-af', 'loudnorm=I=-16:TP=-1.5:LRA=11,alimiter=limit=0.84:level=false']
    if voz:
        # La música baja cuando habla la voz (compresión por cadena lateral).
        entrada_audio += ['-i', str(voz)]
        filtro = ['-filter_complex',
                  '[1:a]aresample=48000,volume=0.32[m];'
                  '[2:a]aresample=48000,highpass=f=80,acompressor=threshold=0.1:ratio=3:attack=5:release=120,'
                  'pan=stereo|c0=c0|c1=c0,asplit=2[v][vs];'
                  '[m][vs]sidechaincompress=threshold=0.03:ratio=6:attack=15:release=350[md];'
                  '[md][v]amix=inputs=2:normalize=0,loudnorm=I=-16:TP=-1.5:LRA=11,alimiter=limit=0.84:level=false[a]']
    proc = subprocess.Popen([FF, '-y', '-v', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{W}x{H}', '-r', str(FPS),
                             '-i', '-', *entrada_audio, '-map', '0:v', '-map', '[a]' if voz else '1:a', *filtro,
                             '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-profile:v', 'high', '-level', '4.1',
                             '-pix_fmt', 'yuv420p', '-g', str(FPS * 2), '-c:a', 'aac', '-b:a', '192k', '-ar', '48000',
                             '-movflags', '+faststart', '-shortest', str(salida)], stdin=subprocess.PIPE)
    for k in range(int(DUR * FPS)):
        proc.stdin.write(cuadro(k / FPS).tobytes())
    proc.stdin.close()
    if proc.wait():
        raise SystemExit('ffmpeg falló')
    audio.unlink(missing_ok=True)


if __name__ == '__main__':
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument('salida')
    p.add_argument('--sin-musica', action='store_true')
    p.add_argument('--cuadros', default='', help='solo guarda estos instantes como PNG, separados por coma')
    p.add_argument('--tiempos', help='tiempos.json de voz.py')
    p.add_argument('--voz', help='voz.wav de voz.py')
    a = p.parse_args()
    if a.tiempos:
        configurar(json.loads(Path(a.tiempos).read_text()))
    render(a.salida, a.sin_musica, [float(x) for x in a.cuadros.split(',') if x] or None, a.voz)
