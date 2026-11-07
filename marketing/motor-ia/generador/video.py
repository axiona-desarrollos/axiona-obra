#!/usr/bin/env python3
"""Video «No es usar IA: es construir el motor».

Vertical 1080 × 1920 a 30 fps para Instagram, TikTok, Shorts y LinkedIn.
Las escenas duran lo que su locución (voz.py). Mezcla tipografía cinética y un
motor dibujado aquí con pantallas reales de Axiona Obra (obra.cjs), de Axiona
Topo (../../topo-walter/tomas) y del glamping (../../reel-glamping), y con los
nombres reales de las pruebas automáticas del repositorio. El fondo, los
textos y la música son los de los otros videos de Axiona.

Uso: AXIONA_FUENTES=… python3 video.py SALIDA.mp4 --medios DIR --tiempos tiempos.json --voz voz.wav [--cuadros 2,8]
  DIR tiene obra/ (obra.cjs), topo/ (topo-walter/tomas) y glamping/ (fijas/).
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
from promo import (AMBAR, CIAN, FF, FG, FPS, H, MENTA, MUT, W, brillo, con_alfa,  # noqa: E402
                   fondo, fuente, panel, preparar_fondo, sale, suave, texto)

ROJO = (255, 86, 104)
GRIS = (150, 158, 170)
MEDIOS = Path('.')
E, F, PIEZAS, SUBS = {}, {}, None, []
WHATSAPP = 'WhatsApp +57 310 392 2935'

# Nombres reales de pruebas de Axiona Obra (npx vitest run --reporter=verbose).
PRUEBAS = [
    ('motor › la casa de ejemplo', 'es determinista'),
    ('motor › la casa de ejemplo', 'presupuesto y materiales con sentido'),
    ('motor › estructura', 'ningun eje deja una luz mayor a 4.5 m'),
    ('motor › lotes dificiles', 'un lote girado da la misma casa que uno derecho'),
    ('motor › lotes dificiles', 'si los retiros no dejan espacio, explica cuanto da'),
    ('fase2 › piscina, parqueadero y vía', 'si no cabe lo dice, y no la cobra'),
    ('v3 › paises', 'cada pais trae precios, pasos y profesionales'),
    ('v3 › cubierta', 'a cuatro aguas: cuatro caras y limatesas'),
    ('motor › plantillas', 'CO/campestre: bien armada y sin avisos'),
    ('motor › plantillas', 'ES/chalet: bien armada y sin avisos'),
    ('motor › plantillas', 'CA/detached: bien armada y sin avisos'),
    ('motor › plantillas', 'MX/tipoA: bien armada'),
]


def fr(k, extra=0.0):
    return F[k]['ini'] + extra


def fin_fr(k):
    return F[k]['ini'] + F[k]['dur']


def marca(k, palabras):
    lee = F[k]['lee']
    i = lee.find(palabras)
    assert i >= 0, (k, palabras)
    return F[k]['ini'] + F[k]['dur'] * i / len(lee)


# ---------------------------------------------------------------- piezas

@lru_cache(32)
def imagen(rel):
    return Image.open(MEDIOS / rel).convert('RGBA')


def entra_sale(t, t0, t1, ent=0.35, sal=0.3):
    return sale((t - t0) / ent) * (1 - suave((t - (t1 - sal)) / sal))


def pegar(lienzo, im, cx, y, a=1.0, k=1.0):
    if a <= 0.01:
        return
    if abs(k - 1) > 1e-3:
        im = im.resize((max(1, int(im.width * k)), max(1, int(im.height * k))), Image.BICUBIC)
    lienzo.alpha_composite(con_alfa(im, min(1.0, a)), (int(cx - im.width / 2), int(y)))


@lru_cache(64)
def chip(s, color=CIAN, tam=34):
    f = fuente('IBMPlexMono-Medium.ttf', tam)
    t = texto(s, f, color, esp=2)
    im = Image.new('RGBA', (t.width + 40, t.height + 16), (0, 0, 0, 0))
    ImageDraw.Draw(im).rounded_rectangle((0, 0, im.width - 1, im.height - 1), 20, fill=(8, 16, 24, 235), outline=color + (190,), width=2)
    im.alpha_composite(t, (20, 8))
    return im


@lru_cache(96)
def titulo(s, color=FG, tam=120, halo=None):
    im = texto(s, fuente('ChakraPetch-Bold.ttf', tam), color)
    base = Image.new('RGBA', (im.width + 80, im.height + 80), (0, 0, 0, 0))
    a = Image.new('L', base.size, 0)
    a.paste(im.getchannel('A'), (40, 46))
    base.putalpha(a.filter(ImageFilter.GaussianBlur(14)).point(lambda v: int(v * 0.8)))
    if halo:
        im = brillo(im, halo, 18, 0.55)
    base.alpha_composite(im, ((base.width - im.width) // 2, (base.height - im.height) // 2 - 6))
    return base


def lineas(lienzo, t, items, t0, t1, y0, paso, escalon=0.12):
    for i, (s, c, tam) in enumerate(items):
        ini = t0 + escalon * i
        if t < ini or t >= t1:
            continue
        pegar(lienzo, titulo(s, c, tam), W / 2, y0 + i * paso + (1 - sale((t - ini) / 0.35)) * 40, entra_sale(t, ini, t1))


@lru_cache(32)
def celular(rel, ancho=560):
    im = imagen(rel)
    alto = round(ancho * im.height / im.width)
    rec = im.resize((ancho, alto), Image.LANCZOS)
    m = Image.new('L', rec.size, 0)
    ImageDraw.Draw(m).rounded_rectangle((0, 0, ancho - 1, alto - 1), 36, fill=255)
    rec.putalpha(m)
    p = panel(ancho + 24, alto + 24, radio=48, borde=(70, 86, 104), opaco=255)
    p.alpha_composite(rec, (52, 52))
    return p


def lleno(lienzo, im, k=1.0, oscuro=0.0):
    s = max(W / im.width, H / im.height) * k
    cw, ch = W / s, H / s
    x0, y0 = (im.width - cw) / 2, (im.height - ch) / 2
    lienzo.alpha_composite(im.resize((W, H), Image.BICUBIC, box=(x0, y0, x0 + cw, y0 + ch)))
    if oscuro:
        lienzo.alpha_composite(Image.new('RGBA', (W, H), (6, 9, 13, int(255 * oscuro))))


def gris(lienzo, fuerza):
    """Lleva el cuadro hacia el gris: el mundo de antes."""
    if fuerza <= 0:
        return lienzo
    rgb = lienzo.convert('RGB')
    g = rgb.convert('L').convert('RGB')
    return Image.blend(rgb, g, fuerza).convert('RGBA')


# ---------------------------------------------------------------- motor dibujado

ETIQUETAS = ['NORMAS', 'PRECIOS', 'CANTIDADES', 'PLANOS', '3D', 'PRUEBAS']


def motor(lienzo, t, cx, cy, R, a=1.0, vel=1.0, etiquetas=False, color=CIAN):
    if a <= 0.01:
        return
    lado = int(R * 2.9)
    capa = Image.new('RGBA', (lado, lado), (0, 0, 0, 0))
    d = ImageDraw.Draw(capa)
    c = lado / 2
    giro = t * 0.9 * vel
    # anillo exterior con marcas
    d.ellipse((c - R, c - R, c + R, c + R), outline=color + (150,), width=3)
    for i in range(60):
        ang = giro + i * math.tau / 60
        r1, r2 = R - (18 if i % 5 == 0 else 9), R
        d.line((c + r1 * math.cos(ang), c + r1 * math.sin(ang), c + r2 * math.cos(ang), c + r2 * math.sin(ang)), fill=color + (220,), width=3 if i % 5 == 0 else 2)
    # anillo medio en arcos, gira al revés
    rm = R * 0.72
    for i in range(6):
        ini = math.degrees(-giro * 1.6 + i * math.tau / 6)
        d.arc((c - rm, c - rm, c + rm, c + rm), ini, ini + 38, fill=color + (235,), width=10)
    # núcleo
    rn = R * 0.36
    pts = [(c + rn * math.cos(giro * 0.5 + k * math.tau / 6), c + rn * math.sin(giro * 0.5 + k * math.tau / 6)) for k in range(6)]
    d.polygon(pts, outline=color + (255,), fill=(10, 30, 44, 230), width=5)
    # nodos en órbita y datos que entran al núcleo
    for k in range(6):
        ang = -giro * 0.35 + k * math.tau / 6
        nx, ny = c + R * 1.18 * math.cos(ang), c + R * 1.18 * math.sin(ang)
        d.line((nx, ny, c + rn * math.cos(ang), c + rn * math.sin(ang)), fill=color + (90,), width=2)
        f = (t * 0.8 * vel + k / 6) % 1
        px, py = nx + (c - nx) * f, ny + (c - ny) * f
        d.ellipse((px - 6, py - 6, px + 6, py + 6), fill=AMBAR + (255,))
        d.ellipse((nx - 15, ny - 15, nx + 15, ny + 15), fill=(8, 16, 24, 255), outline=color + (255,), width=4)
        if etiquetas:
            ft = fuente('IBMPlexMono-Medium.ttf', 28)
            d.text((nx, ny + (34 if ny > c else -34)), ETIQUETAS[k], font=ft, fill=FG + (255,), anchor='mm')
    halo = capa.filter(ImageFilter.GaussianBlur(16))
    salida = Image.new('RGBA', capa.size, (0, 0, 0, 0))
    salida.alpha_composite(halo)
    salida.alpha_composite(halo)
    salida.alpha_composite(capa)
    lienzo.alpha_composite(con_alfa(salida, a), (int(cx - c), int(cy - c)))


# ---------------------------------------------------------------- escenas

def gancho(lienzo, t):
    a, b = E['gancho']
    if not (a <= t < b):
        return False
    h2 = fr('h2')
    lineas(lienzo, t, [('TU EMPRESA', FG, 124), ('NO NECESITA', FG, 124), ('USAR IA', MUT, 150)], -0.5, h2 + 0.25, 250, 150, escalon=0.0)
    if h2 - 0.4 <= t < h2 + 0.25:  # tachón rojo sobre «USAR IA»
        k = sale((t - (h2 - 0.4)) / 0.3)
        capa = Image.new('RGBA', (W, H), (0, 0, 0, 0))
        ImageDraw.Draw(capa).line((250, 640, 250 + 580 * k, 610), fill=ROJO + (255,), width=16)
        lienzo.alpha_composite(capa)
    lineas(lienzo, t, [('NECESITA', FG, 120), ('CONSTRUIR', FG, 136), ('SU MOTOR', CIAN, 170)], h2 + 0.1, b + 0.3, 230, 160)
    motor(lienzo, t, W / 2, 1180, 250, sale((t - h2) / 0.6) * (1 - suave((t - b + 0.3) / 0.3)), vel=0.4 + 2.2 * sale((t - h2) / 1.2))
    return True


def tarjeta_vacia(ancho, alto, titulo_, color):
    im = panel(ancho, alto, radio=34, borde=(58, 70, 86), opaco=240)
    d = ImageDraw.Draw(im)
    d.text((40 + 44, 40 + 52), titulo_, font=fuente('IBMPlexMono-Medium.ttf', 34), fill=color + (255,), anchor='lm')
    return im


def antes(lienzo, t):
    a, b = E['antes']
    if not (a <= t < b):
        return False
    a2 = fr('a2')
    lineas(lienzo, t, [('DURANTE DÉCADAS,', GRIS, 84), ('EL TALENTO SE GASTÓ', FG, 84), ('EN EL CÓMO', AMBAR, 150)], fr('a1') - 0.1, a2 + 0.2, 330, 120)
    if t < a2:
        return True
    m_plano, m_cot = marca('a2', 'alinear'), marca('a2', 'rehacer')
    rng = np.random.default_rng(int(t * 12))
    y0 = 300
    if t < m_plano:
        im = tarjeta_vacia(920, 900, 'PRESUPUESTO A MANO', GRIS).copy()
        d = ImageDraw.Draw(im)
        f = fuente('IBMPlexMono-Medium.ttf', 36)
        for fila in range(12):
            y = 40 + 120 + fila * 62
            d.line((84, y + 50, 40 + 920 - 44, y + 50), fill=(50, 58, 70, 255), width=1)
            d.text((84, y + 20), f'Ítem {fila + 1:02d}', font=f, fill=GRIS + (255,), anchor='lm')
            v = int(rng.integers(100_000, 9_000_000)) if fila == int(t * 7) % 12 else 1_000_000 + fila * 731_113
            d.text((40 + 920 - 60, y + 20), f'$ {v:,}'.replace(',', '.'), font=f, fill=(AMBAR if fila == int(t * 7) % 12 else FG) + (255,), anchor='rm')
        pegar(lienzo, im, W / 2, y0 + (1 - sale((t - a2) / 0.3)) * 60)
    elif t < m_cot:
        im = tarjeta_vacia(920, 900, 'LÍNEAS EN UN PLANO', GRIS).copy()
        d = ImageDraw.Draw(im)
        k = (t - m_plano) / max(0.1, m_cot - m_plano)
        segs = [(140, 260, 860, 260), (860, 260, 860, 860), (860, 860, 140, 860), (140, 860, 140, 260), (500, 260, 500, 600),
                (140, 600, 700, 600), (700, 600, 700, 860), (300, 600, 300, 860)]
        n = len(segs) * k
        for i, (x1, y1, x2, y2) in enumerate(segs):
            if i > n:
                break
            f_ = min(1, n - i)
            d.line((x1, y1, x1 + (x2 - x1) * f_, y1 + (y2 - y1) * f_), fill=FG + (255,), width=7)
        borr = int(t * 3) % 2  # una línea que se corrige una y otra vez
        d.line((300, 600 + borr * 30, 300, 860), fill=(AMBAR if borr else ROJO) + (255,), width=7)
        pegar(lienzo, im, W / 2, y0)
    else:
        im = tarjeta_vacia(920, 900, 'LA MISMA COTIZACIÓN', GRIS).copy()
        d = ImageDraw.Draw(im)
        v = 1 + int((t - m_cot) * 18)
        for i in range(6):
            x, y = 200 + i * 22, 220 + i * 26
            d.rounded_rectangle((x, y, x + 520, y + 560), 18, fill=(22, 28, 36, 255), outline=(70, 80, 94, 255), width=3)
        d.text((40 + 460, 40 + 520), f'v{v}', font=fuente('ChakraPetch-Bold.ttf', 190), fill=AMBAR + (255,), anchor='mm')
        pegar(lienzo, im, W / 2, y0)
    return True


def burbuja(s, ancho, propio, borde=None):
    f = fuente('Inter-SemiBold.ttf', 44)
    palabras, lineas_, act = s.split(' '), [], ''
    for p in palabras:
        if f.getlength(f'{act} {p}'.strip()) > ancho - 80 and act:
            lineas_.append(act)
            act = p
        else:
            act = f'{act} {p}'.strip()
    lineas_.append(act)
    alto = 60 + 58 * len(lineas_)
    im = Image.new('RGBA', (ancho, alto), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.rounded_rectangle((0, 0, ancho - 1, alto - 1), 30, fill=((18, 52, 70, 255) if propio else (30, 36, 46, 255)), outline=(borde or (60, 72, 88)) + (255,), width=4 if borde else 2)
    for i, s_ in enumerate(lineas_):
        d.text((40, 30 + 58 * i + 29), s_, font=f, fill=FG + (255,), anchor='lm')
    return im


def chat(lienzo, t):
    a, b = E['chat']
    if not (a <= t < b):
        return False
    p3 = fr('p3')
    inv = marca('p1', 'inventarse')
    if t < p3 + 0.2:
        y = 260 + (1 - sale((t - a) / 0.35)) * 60
        caja = panel(940, 1150, radio=40, borde=(58, 70, 86), opaco=245)
        d = ImageDraw.Draw(caja)
        d.ellipse((40 + 40, 40 + 36, 40 + 100, 40 + 96), fill=(40, 48, 60, 255))
        d.text((40 + 70, 40 + 66), 'IA', font=fuente('Inter-Bold.ttf', 26), fill=FG + (255,), anchor='mm')
        d.text((40 + 124, 40 + 66), 'Un chat de IA cualquiera', font=fuente('Inter-SemiBold.ttf', 36), fill=GRIS + (255,), anchor='lm')
        d.line((40 + 30, 40 + 130, 40 + 910, 40 + 130), fill=(52, 62, 76, 255), width=2)
        pegar(lienzo, caja, W / 2, y)
        pregunta = '¿Cuánto concreto lleva una placa de 120 m²?'
        k = sale((t - a - 0.2) / 1.2)
        if k > 0:
            pegar(lienzo, burbuja(pregunta[:max(1, int(len(pregunta) * k))], 700, True), W / 2 + 90, y + 230)
        t_escribe, t_resp = a + 1.7, a + 2.7
        if t_escribe <= t < t_resp:
            capa = Image.new('RGBA', (220, 90), (0, 0, 0, 0))
            dd = ImageDraw.Draw(capa)
            dd.rounded_rectangle((0, 0, 219, 89), 30, fill=(30, 36, 46, 255))
            for i in range(3):
                r = 10 + 4 * max(0, math.sin(t * 9 - i))
                dd.ellipse((50 + i * 60 - r, 45 - r, 50 + i * 60 + r, 45 + r), fill=GRIS + (255,))
            pegar(lienzo, capa, W / 2 - 250, y + 470)
        if t >= t_resp:
            mala = t >= inv
            pegar(lienzo, burbuja('Son 48 m³. Puedes pedirlos con total confianza.', 720, False, ROJO if mala else None), W / 2 - 80, y + 470, sale((t - t_resp) / 0.25))
            if mala:
                k = sale((t - inv) / 0.25)
                sello = titulo('¿DE DÓNDE SALE?', ROJO, 92)
                sello = sello.rotate(-8 * k, expand=True, resample=Image.BICUBIC)
                pegar(lienzo, sello, W / 2 + 6 * math.sin(t * 60) * (1 - k), y + 800, k, 1.4 - 0.4 * k)
        return True
    k = sale((t - p3) / 0.3)
    lineas(lienzo, t, [('EN UNA OBRA,', GRIS, 90), ('UN NÚMERO', FG, 130), ('INVENTADO', FG, 130)], p3, b + 0.3, 330, 150)
    m = marca('p3', 'cuesta')
    if t >= m:
        g = 1 - sale((t - m) / 0.35)
        im = titulo('CUESTA MILLONES', ROJO, 120)
        if g > 0.05:
            pegar(lienzo, titulo('CUESTA MILLONES', CIAN, 120), W / 2 - 14 * g, 900, 0.6 * g)
        pegar(lienzo, im, W / 2 + 10 * g * math.sin(t * 70), 900, sale((t - m) / 0.15))
    return True


def motor_esc(lienzo, t):
    a, b = E['motor']
    if not (a <= t < b):
        return False
    m2, m3, m4 = fr('m2'), fr('m3'), fr('m4')
    if t < m2:
        c = marca('m1', 'construimos')
        lineas(lienzo, t, [('EN AXIONA NO USAMOS', FG, 74), ('LA IA PARA ADIVINAR', FG, 74)], fr('m1') - 0.1, c + 0.1, 190, 100)
        lineas(lienzo, t, [('CONSTRUIMOS', FG, 110), ('MOTORES', CIAN, 160)], c, m2 + 0.2, 180, 140)
        motor(lienzo, t, W / 2, 1060, 300, sale((t - fr('m1')) / 0.5), vel=2.2, etiquetas=True)
        return True
    if t < m3:
        hitos = [(m2, 'o2', 'NORMAS', 'topo/o2-retiros.png'), (marca('m2', 'precios'), 'b2', 'PRECIOS UNITARIOS', 'obra/b2-presupuesto.png'),
                 (marca('m2', 'cantidades'), 'b3', 'CANTIDADES REALES', 'obra/b3-presupuesto.png')]
        actual = [h for h in hitos if t >= h[0]][-1]
        pegar(lienzo, chip('DATOS VERIFICADOS'), W / 2, 130)
        pegar(lienzo, titulo(actual[2], CIAN, 84), W / 2, 190 + (1 - sale((t - actual[0]) / 0.25)) * 20)
        pegar(lienzo, celular(actual[3]), W / 2, 330 + (1 - sale((t - actual[0]) / 0.3)) * 50 + 5 * math.sin(1.3 * t), 1.0)
        return True
    if t < m4:
        # terminal con las pruebas reales
        y = 230
        caja = panel(960, 1300, radio=34, borde=(58, 70, 86), opaco=250)
        d = ImageDraw.Draw(caja)
        for i, col in enumerate([(255, 95, 86), (255, 189, 46), (39, 201, 63)]):
            d.ellipse((40 + 40 + i * 40, 40 + 34, 40 + 64 + i * 40, 40 + 58), fill=col + (255,))
        d.text((40 + 190, 40 + 46), '$ npx vitest run', font=fuente('IBMPlexMono-Medium.ttf', 34), fill=FG + (255,), anchor='lm')
        n = int((t - m3) / 0.22) + 1
        fm, fg = fuente('IBMPlexMono-Medium.ttf', 24), fuente('IBMPlexMono-Medium.ttf', 28)
        vis = PRUEBAS[max(0, min(n, len(PRUEBAS)) - 10):min(n, len(PRUEBAS))]
        for i, (grupo, nombre) in enumerate(vis):
            yy = 40 + 120 + i * 100
            d.text((40 + 50, yy + 20), grupo, font=fm, fill=GRIS + (255,), anchor='lm')
            d.text((40 + 50, yy + 58), '✓', font=fuente('Inter-Bold.ttf', 36), fill=MENTA + (255,), anchor='lm')
            d.text((40 + 96, yy + 58), nombre, font=fg, fill=FG + (255,), anchor='lm')
        pegar(lienzo, caja, W / 2, y)
        if n >= len(PRUEBAS):
            pegar(lienzo, chip('Tests  185 passed (185)', MENTA, 40), W / 2, 1420)
        else:
            pegar(lienzo, chip('ejecutando 13 archivos de pruebas…', MUT, 36), W / 2, 1420)
        if t >= marca('m3', 'pasan'):
            pegar(lienzo, titulo('185 PRUEBAS · 0 FALLAS', MENTA, 76), W / 2, 110, sale((t - marca('m3', 'pasan')) / 0.3))
        return True
    # mismo dato, mismo resultado / si no cabe, lo dice
    c2 = marca('m4', 'Y si algo')
    for (t0, rot, grupo, nombre, y) in ((m4, 'MISMO DATO → MISMO RESULTADO', 'motor › la casa de ejemplo', 'es determinista', 360),
                                         (c2, 'SI NO CABE, LO DICE', 'fase2 › piscina, parqueadero y vía', 'si no cabe lo dice, y no la cobra', 960)):
        if t < t0:
            continue
        e = sale((t - t0) / 0.35)
        pegar(lienzo, titulo(rot, CIAN if y < 900 else AMBAR, 54 if len(rot) > 22 else 70), W / 2, y + (1 - e) * 40, e)
        caja = panel(940, 230, radio=30, borde=MENTA, opaco=245)
        d = ImageDraw.Draw(caja)
        d.text((40 + 50, 40 + 60), grupo, font=fuente('IBMPlexMono-Medium.ttf', 30), fill=GRIS + (255,), anchor='lm')
        d.text((40 + 50, 40 + 150), '✓', font=fuente('Inter-Bold.ttf', 56), fill=MENTA + (255,), anchor='lm')
        d.text((40 + 120, 40 + 150), nombre, font=fuente('IBMPlexMono-Medium.ttf', 36 if len(nombre) > 24 else 44), fill=FG + (255,), anchor='lm')
        pegar(lienzo, caja, W / 2, y + 140 + (1 - e) * 60, e)
    return True


def escala(lienzo, t):
    a, b = E['escala']
    if not (a <= t < b):
        return False
    e2 = fr('e2')
    if t < e2:
        lineas(lienzo, t, [('TÚ DICES EL QUÉ.', FG, 88), ('EL SISTEMA HACE EL CÓMO.', CIAN, 70)], fr('e1') - 0.1, e2 + 0.2, 120, 100)
        hitos = [(a, 'obra/b0-inicio.png', ''), (marca('e1', 'planos'), 'obra/b4-planos.png', 'PLANOS'),
                 (marca('e1', 'presupuesto'), 'obra/b1-presupuesto.png', 'PRESUPUESTO'), (marca('e1', '3D'), 'obra/b5-modelo.png', '3D'),
                 (marca('e1', 'trámites'), 'topo/o4-documentos.png', 'TRÁMITES')]
        actual = [h for h in hitos if t >= h[0]][-1]
        k = 1 + 0.06 * (1 - sale((t - actual[0]) / 0.25))
        pegar(lienzo, celular(actual[1], 540), W / 2, 380 + 5 * math.sin(1.3 * t), 1.0, k)
        if actual[2]:
            pegar(lienzo, chip(actual[2], AMBAR, 40), W / 2, 1500, sale((t - actual[0]) / 0.2))
        return True
    # una persona → un equipo
    lineas(lienzo, t, [('UNA PERSONA,', FG, 100), ('CON LA FUERZA', FG, 100), ('DE UN EQUIPO', CIAN, 130)], e2 - 0.05, b + 0.3, 200, 130)
    capa = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(capa)
    k = sale((t - e2 - 0.3) / 1.2)
    cx, cy = W / 2, 1150
    for i in range(5):
        for j in range(5):
            x, y = cx + (i - 2) * 150 * k, cy + (j - 2) * 110 * k
            if (i, j) != (2, 2):
                d.line((cx, cy, x, y), fill=CIAN + (int(70 * k),), width=2)
            r = 30 if (i, j) == (2, 2) else 18
            d.ellipse((x - r, y - r, x + r, y + r), fill=(AMBAR if (i, j) == (2, 2) else CIAN) + (255 if (i, j) == (2, 2) else int(255 * k),))
    lienzo.alpha_composite(capa)
    return True


def humano(lienzo, t):
    a, b = E['humano']
    if not (a <= t < b):
        return False
    im = imagen('glamping/fijas/esc-noche.jpg')
    lleno(lienzo, im, 1.04 + 0.012 * (t - a), 0.45)
    lineas(lienzo, t, [('LO QUE NO', FG, 96), ('SE REEMPLAZA:', FG, 96)], fr('u1') - 0.05, b + 0.3, 220, 120)
    for i, (pal, voz) in enumerate((('CRITERIO', 'criterio'), ('VISIÓN', 'visión'), ('CONFIANZA', 'confianza'))):
        ti = marca('u1', voz)
        if t >= ti:
            e = sale((t - ti) / 0.3)
            pegar(lienzo, titulo(pal, AMBAR, 132, AMBAR), W / 2, 640 + i * 190 + (1 - e) * 40, e * (1 - suave((t - b) / 0.3)))
    return True


def olas(lienzo, t, nivel, color=CIAN):
    capa = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(capa)
    for k in range(9):
        base = nivel + k * 34
        pts = [(x, base + 38 * math.sin(x / 140 + t * 2.2 + k * 0.6) + 18 * math.sin(x / 61 - t * 1.4)) for x in range(0, W + 20, 20)]
        d.line(pts, fill=color + (int(230 - k * 20),), width=6 if k == 0 else 3)
        if k == 0:
            d.polygon(pts + [(W, H), (0, H)], fill=(8, 30, 46, 210))
    lienzo.alpha_composite(capa.filter(ImageFilter.GaussianBlur(1)))
    return pts


def ola(lienzo, t, ):
    a, b = E['ola']
    if not (a <= t < b):
        return False
    o2 = fr('o2')
    if t < o2:
        lineas(lienzo, t, [('VENDER HORAS', GRIS, 110), ('DE EJECUCIÓN', GRIS, 110)], fr('o1') - 0.05, o2 + 0.1, 280, 130)
        nivel = 1500 - 900 * suave((t - marca('o1', 'la ola')) / 1.6)
        olas(lienzo, t, nivel, (90, 140, 170))
        if t >= marca('o1', 'la ola'):
            pegar(lienzo, titulo('LA OLA TE ALCANZA', ROJO, 96), W / 2, 640, sale((t - marca('o1', 'la ola')) / 0.3) * (1 - suave((t - o2 + 0.2) / 0.2)))
        return True
    lineas(lienzo, t, [('CONSTRUYE', FG, 130), ('TU MOTOR', CIAN, 170)], o2 - 0.05, b + 0.3, 200, 160)
    nivel = 1250 + 20 * math.sin(t * 2)
    olas(lienzo, t, nivel)
    cab = marca('o2', 'la cabalgas')
    motor(lienzo, t, W / 2, nivel - 170 + 30 * math.sin(t * 2.2 + W / 2 / 140), 150, sale((t - o2) / 0.4), vel=2.0)
    if t >= cab:
        pegar(lienzo, chip('Y LA CABALGAS', AMBAR, 44), W / 2, 640, sale((t - cab) / 0.3))
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
    pegar(lienzo, logo(), W / 2, 200, entra_sale(t, a, fin))
    lineas(lienzo, t, [('¿QUÉ MOTOR', FG, 120), ('NECESITA', FG, 120), ('TU EMPRESA?', CIAN, 136)], fr('z1') - 0.1, fin, 380, 150)
    motor(lienzo, t, W / 2, 1060, 120, entra_sale(t, a + 0.3, fin), vel=1.5)
    z2 = fr('z2')
    pegar(lienzo, chip('ESCRÍBENOS · COTIZA TU SISTEMA', AMBAR, 38), W / 2, 1250, entra_sale(t, z2, fin))
    pegar(lienzo, chip(f'{WHATSAPP}  ·  axionasoft.com', FG, 34), W / 2, 1345, entra_sale(t, z2 + 0.25, fin))
    pegar(lienzo, texto('PRIMERO SE CONSTRUYE EN CÓDIGO', fuente('Inter-Bold.ttf', 34), CIAN, esp=5), W / 2, 1490, entra_sale(t, z2 + 0.6, fin))
    pegar(lienzo, texto('DESPUÉS, EN OBRA', fuente('Inter-Bold.ttf', 34), FG, esp=5), W / 2, 1546, entra_sale(t, z2 + 0.75, fin))
    pegar(lienzo, texto('@axionadesarrollos', fuente('Inter-SemiBold.ttf', 36), MUT), W / 2, 1650, entra_sale(t, z2 + 0.9, fin))
    return True


ESCENAS = [gancho, antes, chat, motor_esc, escala, humano, ola, cierre]


# ---------------------------------------------------------------- subtítulos

SIN_SUB = {'h1', 'h2', 'a1', 'p3', 'm1', 'e2', 'o1', 'o2', 'z1', 'z2', 'u1'}


def trozos():
    salida = []
    for k, f in F.items():
        if k in SIN_SUB:
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


RESALTE = {'presupuesto,', 'plano,', 'cotización.', 'inventarse', 'dato,', 'verificados:', 'normas,', 'unitarios', 'cantidades', 'reales.',
           'automáticas:', '185', 'todas.', 'resultado.', 'dice:', 'inventa.', 'qué', 'planos,', 'presupuesto,', '3D', 'trámites.'}


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
    lienzo = fondo(t, PIEZAS)
    for esc in ESCENAS:
        if esc(lienzo, t):
            break
    a, b = E['antes']
    if a <= t < b:  # el mundo de antes, en gris
        lienzo = gris(lienzo, 0.85 * entra_sale(t, a, b, 0.4, 0.4))
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
    promo.DATOS, promo.SERVICIO, promo.CIERRE = ((E[k][0], E[k][0]) for k in ('antes', 'motor', 'cierre'))
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
