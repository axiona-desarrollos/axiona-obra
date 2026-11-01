#!/usr/bin/env python3
"""Video para Walter: qué medir con Axiona Topo para la fase de planos.

Vertical 1080 × 1920 a 30 fps, para mandar por WhatsApp. Las escenas duran lo
que su locución (voz.py). Mezcla dibujos del lote hechos aquí (dónde van P1 y
P2, el recorrido, los puntos de nivel) con pantallas reales de Axiona Topo y
Axiona Obra (tomas.cjs) dentro de un celular, con el botón que hay que tocar
resaltado. El fondo, las tarjetas, el texto y la música son los de los otros
videos de Axiona (../../servicio-redes/generador/promo.py).

Uso: AXIONA_FUENTES=… python3 video.py SALIDA.mp4 --tiempos tiempos.json --voz voz.wav [--cuadros 5,20]
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
from PIL import Image, ImageDraw

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / 'servicio-redes' / 'generador'))
import promo  # noqa: E402
from promo import (AMBAR, CIAN, FF, FG, FPS, H, LINEA, MENTA, MUT, W, Capa, brillo, con_alfa,  # noqa: E402
                   fondo, fuente, panel, preparar_fondo, sale, suave, texto)

ROJO = (255, 92, 108)
TOMAS = Path(__file__).resolve().parent.parent / 'tomas'
E, F, PIEZAS, CAPAS, SUBS = {}, {}, None, [], []


def esc(n):
    return E[n]


def fr(k, extra=0.0):
    return F[k]['ini'] + extra


def fin_fr(k):
    return F[k]['ini'] + F[k]['dur']


# ---------------------------------------------------------------- piezas

@lru_cache(None)
def foto(nombre):
    return Image.open(TOMAS / f'{nombre}.png').convert('RGBA')


@lru_cache(None)
def celular(nombre, ancho=560):
    """Pantalla real dentro de un marco de celular."""
    im = foto(nombre)
    alto = round(ancho * im.height / im.width)
    rec = im.resize((ancho, alto), Image.LANCZOS)
    m = Image.new('L', rec.size, 0)
    ImageDraw.Draw(m).rounded_rectangle((0, 0, ancho - 1, alto - 1), 34, fill=255)
    rec.putalpha(m)
    p = panel(ancho + 24, alto + 24, radio=46, borde=(70, 86, 104), opaco=255)
    p.alpha_composite(rec, (52, 52))
    return p


class Telefono:
    """Celular con una pantalla, que entra, flota un poco y sale; con un resalte opcional."""

    def __init__(self, nombre, ini, fin, y=410, ancho=560, resalte=None, desde=None):
        self.im, self.ini, self.fin, self.y, self.ancho = celular(nombre, ancho), ini, fin, y, ancho
        self.resalte, self.desde = resalte, desde      # resalte: (x0, y0, x1, y1) en px de la toma de 1080
        self.k = ancho / foto(nombre).width

    def pintar(self, lienzo, t):
        if t < self.ini or t >= self.fin:
            return
        e, s = sale((t - self.ini) / 0.45), 1 - suave((t - (self.fin - 0.35)) / 0.35)
        a = e * s
        if a <= 0.01:
            return
        x = (W - self.im.width) // 2
        y = self.y + (1 - e) * 60 + 6 * math.sin(1.3 * t)
        lienzo.alpha_composite(con_alfa(self.im, a), (int(x), int(y)))
        if self.resalte and t >= (self.desde or self.ini + 0.6):
            x0, y0, x1, y1 = self.resalte
            k, ox, oy = self.k, x + 52, y + 52
            r = (ox + x0 * k - 10, oy + y0 * k - 10, ox + x1 * k + 10, oy + y1 * k + 10)
            p = 0.5 + 0.5 * math.sin(6 * (t - self.ini))
            capa = Image.new('RGBA', lienzo.size, (0, 0, 0, 0))
            d = ImageDraw.Draw(capa)
            d.rounded_rectangle(r, 18, outline=AMBAR + (int(255 * a),), width=6)
            d.rounded_rectangle((r[0] - 8 - 6 * p, r[1] - 8 - 6 * p, r[2] + 8 + 6 * p, r[3] + 8 + 6 * p), 24,
                                outline=AMBAR + (int(120 * (1 - p) * a),), width=4)
            lienzo.alpha_composite(capa)


def chip(s, color=CIAN, tam=34):
    f = fuente('IBMPlexMono-Medium.ttf', tam)
    t = texto(s, f, color, esp=2)
    im = Image.new('RGBA', (t.width + 36, t.height + 14), (0, 0, 0, 0))
    ImageDraw.Draw(im).rounded_rectangle((0, 0, im.width - 1, im.height - 1), 18, fill=(10, 22, 32, 235), outline=color + (180,), width=2)
    im.alpha_composite(t, (18, 7))
    return im


def titulo(s, color=FG, tam=74):
    return texto(s, fuente('ChakraPetch-Bold.ttf', tam), color)


def tarjeta(n, linea1, linea2, color=CIAN, ancho=940, alto=150, marca=None):
    p = panel(ancho, alto, radio=28, acento=color)
    d = ImageDraw.Draw(p)
    cx, cy = 40 + 62, 40 + alto / 2
    if n == '✓':      # dibujados: las fuentes no traen todos los símbolos
        d.line((cx - 26, cy + 2, cx - 6, cy + 22, cx + 28, cy - 22), fill=color + (255,), width=12, joint='curve')
    elif n == '✗':
        d.line((cx - 22, cy - 22, cx + 22, cy + 22), fill=color + (255,), width=12)
        d.line((cx - 22, cy + 22, cx + 22, cy - 22), fill=color + (255,), width=12)
    elif n == '+':
        d.line((cx - 24, cy, cx + 24, cy), fill=color + (255,), width=12)
        d.line((cx, cy - 24, cx, cy + 24), fill=color + (255,), width=12)
    else:
        d.text((cx, cy), str(n), font=fuente('ChakraPetch-Bold.ttf', 64), fill=color + (255,), anchor='mm')
    d.text((40 + 120, 40 + 44), linea1, font=fuente('Inter-Bold.ttf', 44), fill=FG + (255,), anchor='lm')
    d.text((40 + 120, 40 + 104), linea2, font=fuente('Inter-SemiBold.ttf', 32), fill=MUT + (255,), anchor='lm')
    if marca:
        s, c = marca
        d.text((40 + ancho - 40, 40 + alto / 2), s, font=fuente('Inter-ExtraBold.ttf', 40), fill=c + (255,), anchor='rm')
    return p


def documento(titulo_, de, items, color):
    alto = 140 + 62 * len(items)
    p = panel(940, alto, radio=30, acento=color)
    d = ImageDraw.Draw(p)
    d.text((40 + 70, 40 + 50), titulo_, font=fuente('Inter-ExtraBold.ttf', 44), fill=FG + (255,), anchor='lm')
    d.text((40 + 70, 40 + 100), de, font=fuente('Inter-SemiBold.ttf', 30), fill=color + (255,), anchor='lm')
    for i, s in enumerate(items):
        y = 40 + 160 + i * 62
        d.ellipse((40 + 74, y - 8, 40 + 90, y + 8), fill=color + (255,))
        d.text((40 + 110, y), s, font=fuente('Inter-SemiBold.ttf', 36), fill=FG + (255,), anchor='lm')
    return p


# ---------------------------------------------------------------- dibujo del lote

LOTE = [(250, 1180), (850, 1215), (930, 700), (520, 560), (200, 760)]   # P1 … P5; P1 y P2 sobre el frente
ANDEN = 1255


def lado(d, a, b, color, ancho, avance=1.0, punteado=False):
    (x0, y0), (x1, y1) = a, b
    x1, y1 = x0 + (x1 - x0) * avance, y0 + (y1 - y0) * avance
    if punteado:
        n = int(math.hypot(x1 - x0, y1 - y0) / 26)
        for i in range(n):
            if i % 2 == 0:
                d.line((x0 + (x1 - x0) * i / n, y0 + (y1 - y0) * i / n, x0 + (x1 - x0) * (i + 1) / n, y0 + (y1 - y0) * (i + 1) / n), fill=color, width=ancho)
    else:
        d.line((x0, y0, x1, y1), fill=color, width=ancho)
    return x1, y1


def flecha(d, a, b, color):
    (x0, y0), (x1, y1) = a, b
    ang = math.atan2(y1 - y0, x1 - x0)
    mx, my = (x0 + x1) / 2, (y0 + y1) / 2
    for s in (-1, 1):
        d.line((mx, my, mx - 30 * math.cos(ang + s * 0.5), my - 30 * math.sin(ang + s * 0.5)), fill=color, width=6)


def calle(d, a=1.0):
    d.rectangle((60, ANDEN + 30, 1020, ANDEN + 150), fill=(20, 28, 38, int(255 * a)))
    d.line((60, ANDEN, 1020, ANDEN), fill=(150, 160, 172, int(200 * a)), width=6)
    for x in range(90, 1000, 110):
        d.line((x, ANDEN + 90, x + 60, ANDEN + 90), fill=(255, 210, 90, int(200 * a)), width=6)
    d.text((540, ANDEN + 55), 'CALLE', font=fuente('ChakraPetch-Bold.ttf', 38), fill=MUT + (int(255 * a),), anchor='mm')
    d.text((1010, ANDEN - 22), 'ANDÉN', font=fuente('IBMPlexMono-Medium.ttf', 28), fill=MUT + (int(255 * a),), anchor='rm')


def punto(d, p, nombre, color, a=1.0, r=16):
    x, y = p
    d.ellipse((x - r, y - r, x + r, y + r), fill=color + (int(255 * a),), outline=(8, 12, 17, int(255 * a)), width=4)
    if nombre:
        f = fuente('ChakraPetch-Bold.ttf', 46)
        dx = -44 if x < 540 else 44
        d.text((x + dx, y - 34), nombre, font=f, fill=color + (int(255 * a),), anchor='rm' if dx < 0 else 'lm')


def dibujo_esquinas(lienzo, t):
    a0, a1 = esc('esquinas')
    a1 = fr('e4') + 0.3                      # en e4 pasa a la pantalla de Obra
    if t < a0 + 0.2 or t >= a1:
        return
    a = sale((t - a0 - 0.2) / 0.4) * (1 - suave((t - (a1 - 0.3)) / 0.3))
    capa = Image.new('RGBA', lienzo.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(capa)
    calle(d, a)
    # el lote en tenue, para que se vea la forma completa
    d.polygon(LOTE, fill=(63, 207, 255, int(26 * a)))
    for i in range(5):
        lado(d, LOTE[i], LOTE[(i + 1) % 5], (63, 207, 255, int(70 * a)), 3, punteado=True)
    t1, t2 = fr('e2', 1.6), fr('e2', 4.6)
    if t >= t1:
        punto(d, LOTE[0], 'P1', AMBAR, a * sale((t - t1) / 0.3))
    if t >= t2:
        e = sale((t - t2) / 0.9)
        lado(d, LOTE[0], LOTE[1], AMBAR + (int(255 * a),), 12, e)
        if e >= 1:
            punto(d, LOTE[1], 'P2', AMBAR, a)
            d.text((550, 1135), 'FRENTE · FACHADA', font=fuente('IBMPlexMono-Medium.ttf', 32), fill=AMBAR + (int(255 * a),), anchor='mm')
    # e3: alrededor del lote, en el mismo sentido
    t3, t3f = fr('e3', 0.4), fin_fr('e3')
    if t >= t3:
        tramos = [(1, 2), (2, 3), (3, 4), (4, 0)]
        u = (t - t3) / max(0.5, t3f - t3) * len(tramos)
        for k, (i, j) in enumerate(tramos):
            e = max(0.0, min(1.0, u - k))
            if e <= 0:
                break
            lado(d, LOTE[i], LOTE[j], CIAN + (int(255 * a),), 9, e)
            if e >= 1:
                flecha(d, LOTE[i], LOTE[j], CIAN + (int(255 * a),))
                if j:
                    punto(d, LOTE[j], f'P{j + 1}', CIAN, a)
        punto(d, LOTE[0], 'P1', AMBAR, a)
        if u >= 1:
            punto(d, LOTE[1], 'P2', AMBAR, a)
    lienzo.alpha_composite(capa)


REJILLA = [(x, y) for y in range(640, 1180, 105) for x in range(250, 900, 105)]


def dentro(p, poli=LOTE):
    x, y = p
    c = False
    for i in range(len(poli)):
        (x0, y0), (x1, y1) = poli[i], poli[(i + 1) % len(poli)]
        if (y0 > y) != (y1 > y) and x < (x1 - x0) * (y - y0) / (y1 - y0) + x0:
            c = not c
    return c


def dibujo_cotas(lienzo, t):
    a0, a1 = fr('c3') - 0.3, esc('cotas')[1]
    if t < a0 or t >= a1:
        return
    a = sale((t - a0) / 0.4) * (1 - suave((t - (a1 - 0.3)) / 0.3))
    capa = Image.new('RGBA', lienzo.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(capa)
    calle(d, a)
    d.polygon(LOTE, fill=(63, 207, 255, int(26 * a)), outline=CIAN + (int(200 * a),))
    for i in range(5):
        lado(d, LOTE[i], LOTE[(i + 1) % 5], CIAN + (int(220 * a),), 6)
    for i, p in enumerate(LOTE):                 # la cota de cada esquina
        punto(d, p, f'P{i + 1}', AMBAR if i < 2 else CIAN, a, r=14)
    puntos = [p for p in REJILLA if dentro(p)]
    tg = fr('c4')
    for k, p in enumerate(puntos):              # puntos de nivel por dentro, en onda
        tk = tg + k * 0.06
        if t >= tk:
            e = sale((t - tk) / 0.25)
            x, y = p
            d.ellipse((x - 9 * e, y - 9 * e, x + 9 * e, y + 9 * e), fill=MENTA + (int(230 * a),))
    if t >= tg + 1.2:                           # el más alto y el más bajo
        e = a * sale((t - tg - 1.2) / 0.3)
        d.polygon([(560, 622), (586, 622), (573, 598)], fill=AMBAR + (int(255 * e),))
        d.text((600, 610), 'más alto', font=fuente('Inter-ExtraBold.ttf', 38), fill=AMBAR + (int(255 * e),), anchor='lm')
        d.polygon([(300, 1108), (326, 1108), (313, 1132)], fill=CIAN + (int(255 * e),))
        d.text((340, 1120), 'más bajo', font=fuente('Inter-ExtraBold.ttf', 38), fill=CIAN + (int(255 * e),), anchor='lm')
    tc = fr('c5', 0.6)                          # el nivel del andén
    if t >= tc:
        e = a * sale((t - tc) / 0.4)
        x = 540
        d.ellipse((x - 18, ANDEN - 18, x + 18, ANDEN + 18), fill=AMBAR + (int(255 * e),), outline=(8, 12, 17, int(255 * e)), width=4)
        d.text((x + 34, ANDEN - 30), 'nivel del andén', font=fuente('Inter-ExtraBold.ttf', 40), fill=AMBAR + (int(255 * e),), anchor='lm')
    lienzo.alpha_composite(capa)


# ---------------------------------------------------------------- escenas

ENCAB = [  # escena: (paso, título)
    ('esquinas', ('1 · LAS ESQUINAS', 'Desde el frente')),
    ('metodos', ('1 · LAS ESQUINAS', '¿Con qué medir?')),
    ('cotas', ('2 · LAS COTAS', 'Cotas y niveles')),
    ('existente', ('3 · LO QUE YA HAY', 'Lo existente')),
    ('revisar', ('REVISAR', 'El plano en Topo')),
    ('enviar', ('ENVIAR', 'A Axiona Obra')),
    ('documentos', ('4 · LO QUE NO SE MIDE', 'Uso del suelo')),
]


def armar():
    capas = []
    # marca arriba, todo el video
    tx = texto('AXIONA TOPO  →  AXIONA OBRA', fuente('IBMPlexMono-Medium.ttf', 30), CIAN, esp=3)
    m = Image.new('RGBA', (tx.width + 34, tx.height), (0, 0, 0, 0))
    ImageDraw.Draw(m).ellipse((4, tx.height / 2 - 9, 22, tx.height / 2 + 9), fill=MENTA + (255,))   # el punto, dibujado
    m.alpha_composite(tx, (34, 0))
    marca = brillo(m, CIAN, 10, 0.35)
    capas.append(Capa(marca, 70, 0.0, F['z2']['ini'] + F['z2']['dur'] + 1.4, dur=0.6))
    # intro
    i0, i1 = esc('intro')
    capas.append(Capa(brillo(titulo('Walter:', CIAN, 120), CIAN, 22, 0.5), 230, 0.3, i1))
    capas.append(Capa(titulo('lo que Axiona Obra necesita', FG, 66), 420, 0.8, i1))
    capas.append(Capa(titulo('para los planos', FG, 66), 500, 1.0, i1))
    cuatro = [('Las esquinas del lote', 'desde el frente: P1 y P2', AMBAR), ('Las cotas', 'esquinas, niveles y andén', CIAN),
              ('Lo que ya hay', 'árboles, postes, redes, quebradas', MENTA), ('Uso del suelo y suelos', 'dos documentos que no se miden', (181, 140, 255))]
    for k, (l1, l2, c) in enumerate(cuatro):
        capas.append(Capa(tarjeta(k + 1, l1, l2, c), 680 + k * 205, fr('i2', 0.9 + 0.75 * k), i1, modo='crece'))
    # encabezados de cada escena
    for e, (paso, tit) in ENCAB:
        a, b = esc(e)
        capas.append(Capa(chip(paso, AMBAR if e in ('esquinas', 'metodos') else CIAN), 180, a + 0.1, b))
        capas.append(Capa(titulo(tit), 250, a + 0.25, b))
    # e4: en Obra, el frente es P1–P2
    capas.append(Telefono('o1-terreno', fr('e4') - 0.1, esc('esquinas')[1], resalte=(560, 1272, 992, 1368), desde=fr('e4', 1.0)))
    # métodos
    m0, m1 = esc('metodos')
    capas.append(Capa(tarjeta('✓', 'Cinta métrica', 'lados, diagonales y comprobación', MENTA, marca=('exacto', MENTA)), 400, fr('m1', 0.6), m1, modo='crece'))
    capas.append(Capa(tarjeta('✓', 'GPS con antena RTK', 'la antena por Bluetooth al celular', MENTA, marca=('±1–3 cm', MENTA)), 600, fr('m1', 2.2), m1, modo='crece'))
    capas.append(Capa(tarjeta('✗', 'GPS del celular', 'fincas y tanteo, no planos', ROJO, marca=('±2–5 m', ROJO)), 800, fr('m3', 0.2), m1, modo='crece'))
    capas.append(Telefono('t2-cinta', fr('m2'), fr('m3') + 0.1, y=990, ancho=300))
    # cotas: primero la mira (calibrar), luego el dibujo
    capas.append(Telefono('t4-mira', fr('c2') - 0.2, fr('c3') - 0.2))
    # lo existente
    x0, x1 = esc('existente')
    cosas = ['Árboles grandes', 'Postes', 'Cajas de agua y alcantarillado', 'Quebradas', 'Muros', 'Construcciones']
    for k, s in enumerate(cosas):
        capas.append(Capa(chip(s, MENTA, 40), 420 + k * 118, fr('x1', 1.6 + 0.55 * k), x1, x=90, modo='crece'))
    capas.append(Capa(tarjeta('+', 'Foto de cada cosa', 'y cerca de qué punto queda', CIAN), 1160, fr('x2', 0.2), x1, modo='crece'))
    # revisar: plano y 3D
    capas.append(Telefono('t6-plano', esc('revisar')[0] + 0.2, fr('r2') - 0.1))
    capas.append(Telefono('t7-holo', fr('r2') - 0.2, esc('revisar')[1]))
    # enviar: el botón y lo que llega a Obra
    capas.append(Telefono('t8-enviar', esc('enviar')[0] + 0.2, fr('s1', 3.6), resalte=(80, 904, 552, 1016), desde=fr('s1', 0.9)))
    capas.append(Telefono('o1-terreno', fr('s1', 3.4), esc('enviar')[1]))
    # documentos
    d1 = esc('documentos')[1]
    capas.append(Capa(documento('Certificado de uso del suelo', 'o norma urbanística · Planeación del municipio',
                                ['Uso permitido', 'Índice de ocupación', 'Altura máxima', 'Retiros: frente, fondo y lados'], AMBAR),
                      390, fr('d2', 0.5), fr('d5'), modo='crece'))
    capas.append(Capa(documento('Estudio de suelos', 'laboratorio con perforaciones',
                                ['Capacidad portante', 'Profundidad de cimentación', 'Nivel freático'], (181, 140, 255)),
                      910, fr('d4', 0.4), fr('d5'), modo='crece'))
    capas.append(Telefono('o4-documentos', fr('d5') - 0.1, d1, resalte=(88, 840, 568, 928), desde=fr('d5', 1.4)))
    # resumen
    z0, z1 = esc('resumen')
    capas.append(Capa(titulo('Lo que nos entregas', CIAN, 70), 220, z0 + 0.2, z1 + 2))
    lista = [('Esquinas desde el frente', 'P1 y P2 sobre el andén · cinta o RTK', AMBAR), ('Cotas y niveles', 'esquinas, rejilla de 5–10 m y andén', CIAN),
             ('Lo que ya hay', 'fotos y su ubicación', MENTA), ('Uso del suelo y estudio de suelos', 'se adjuntan en Axiona Obra', (181, 140, 255))]
    for k, (l1, l2, c) in enumerate(lista):
        capas.append(Capa(tarjeta('✓', l1, l2, c), 360 + k * 200, fr('z1', 0.8 + 1.1 * k), z1 + 2, modo='crece'))
    capas.append(Capa(texto('obra.axionasoft.com  ·  topo.axionasoft.com', fuente('IBMPlexMono-Medium.ttf', 34), FG, esp=1), 1230, fr('z2'), z1 + 2))
    capas.append(Capa(texto('El plano oficial lo firma un topógrafo con tarjeta profesional.', fuente('Inter-SemiBold.ttf', 32), MUT), 1300, fr('z2', 2.5), z1 + 2))
    return capas


# ---------------------------------------------------------------- subtítulos

def trozos():
    salida = []
    for k, f in F.items():
        palabras, lineas, actual = f['lee'].split(' '), [], ''
        for p in palabras:
            if len(actual) + len(p) + 1 > 36 and actual:
                lineas.append(actual)
                actual = p
            else:
                actual = f'{actual} {p}'.strip()
        lineas.append(actual)
        total = sum(len(s) + 1 for s in lineas)
        acum = 0
        for i, s in enumerate(lineas):
            ini = f['ini'] + f['dur'] * acum / total
            acum += len(s) + 1
            fin = f['ini'] + f['dur'] * acum / total if i < len(lineas) - 1 else f['ini'] + f['dur'] + 0.2
            salida.append((ini, fin, s))
    return salida


RESALTE = {'P1', 'P2', 'P1.', 'P1,', 'P1:', 'frente', 'frente:', 'RTK:', 'cinta', 'cotas.', 'cota', 'andén', 'uso', 'suelo', 'suelos,', 'Planeación', '«Abrir', 'Obra»:', 'PDF', 'P1 →'}


@lru_cache(256)
def sprite_sub(s):
    f = fuente('Inter-Bold.ttf', 48)
    palabras = s.split(' ')
    esp = f.getlength(' ')
    ancho = sum(f.getlength(p) for p in palabras) + esp * (len(palabras) - 1)
    im = Image.new('RGBA', (int(ancho) + 64, 92), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.rounded_rectangle((0, 0, im.width - 1, im.height - 1), 24, fill=(8, 12, 17, 225))
    x = 32
    for p in palabras:
        d.text((x, 46), p, font=f, fill=(CIAN if p in RESALTE else FG) + (255,), anchor='lm')
        x += f.getlength(p) + esp
    return im


def subtitulos(lienzo, t):
    for ini, fin, s in SUBS:
        if ini <= t < fin:
            im = sprite_sub(s)
            lienzo.alpha_composite(con_alfa(im, sale((t - ini) / 0.12)), ((W - im.width) // 2, 1690))


# ---------------------------------------------------------------- render

def cuadro(t):
    lienzo = fondo(t, PIEZAS)
    for c in CAPAS:
        c.pintar(lienzo, t)
    dibujo_esquinas(lienzo, t)
    dibujo_cotas(lienzo, t)
    subtitulos(lienzo, t)
    return lienzo.convert('RGB')


def tramo(args):
    a, b, ruta = args
    proc = subprocess.Popen([FF, '-y', '-v', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{W}x{H}', '-r', str(FPS),
                             '-i', '-', '-c:v', 'libx264', '-preset', 'medium', '-crf', '19', '-profile:v', 'high',
                             '-level', '4.1', '-pix_fmt', 'yuv420p', '-g', str(FPS * 2), str(ruta)], stdin=subprocess.PIPE)
    for k in range(a, b):
        proc.stdin.write(cuadro(k / FPS).tobytes())
    proc.stdin.close()
    if proc.wait():
        raise SystemExit('ffmpeg falló en un tramo')
    return ruta


def preparar(tiempos):
    global E, F, PIEZAS, CAPAS, SUBS
    E, F = tiempos['escenas'], tiempos['frases']
    PIEZAS = preparar_fondo()
    CAPAS = armar()
    SUBS = trozos()
    # la música de los otros videos, con barridos en los cambios de escena
    promo.DUR = tiempos['dur']
    cambios = [E[k][0] for k in ('esquinas', 'cotas', 'existente', 'documentos')]
    promo.DATOS, promo.SERVICIO, promo.CUPOS, promo.CIERRE = ((c, c) for c in cambios)
    # los toques de los cupos caen después del final, así que no suenan; el barrido queda suave antes del cierre
    promo.CUPOS = (tiempos['dur'] - 0.5, tiempos['dur'])


def render(salida, voz, procesos=4):
    salida = Path(salida)
    total = int(round(promo.DUR * FPS))
    with tempfile.TemporaryDirectory() as tmp:
        tmp = Path(tmp)
        cortes = np.linspace(0, total, procesos + 1).astype(int)
        partes = [(int(a), int(b), tmp / f'tramo{k}.mp4') for k, (a, b) in enumerate(zip(cortes, cortes[1:]))]
        with Pool(procesos) as pool:
            hechos = pool.map(tramo, partes)
        (tmp / 'lista.txt').write_text(''.join(f"file '{p}'\n" for p in hechos))
        subprocess.run([FF, '-y', '-v', 'error', '-f', 'concat', '-safe', '0', '-i', str(tmp / 'lista.txt'), '-c', 'copy', str(tmp / 'video.mp4')], check=True)
        promo.musica(tmp / 'musica.wav')
        subprocess.run([FF, '-y', '-v', 'error', '-i', str(tmp / 'video.mp4'), '-i', str(tmp / 'musica.wav'), '-i', str(voz),
                        '-filter_complex',
                        '[1:a]aresample=48000,volume=0.22[m];'
                        '[2:a]aresample=48000,highpass=f=80,acompressor=threshold=0.1:ratio=3:attack=5:release=120,'
                        'pan=stereo|c0=c0|c1=c0,asplit=2[v][vs];'
                        '[m][vs]sidechaincompress=threshold=0.03:ratio=6:attack=15:release=350[md];'
                        '[md][v]amix=inputs=2:normalize=0,loudnorm=I=-16:TP=-1.5:LRA=11,alimiter=limit=0.84:level=false[a]',
                        '-map', '0:v', '-map', '[a]', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-ar', '48000',
                        '-movflags', '+faststart', '-shortest', str(salida)], check=True)


if __name__ == '__main__':
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument('salida')
    p.add_argument('--tiempos', required=True)
    p.add_argument('--voz', required=True)
    p.add_argument('--cuadros', default='', help='solo guarda estos instantes como PNG')
    a = p.parse_args()
    preparar(json.loads(Path(a.tiempos).read_text()))
    if a.cuadros:
        for t in (float(x) for x in a.cuadros.split(',') if x):
            cuadro(t).save(Path(a.salida).parent / f'cuadro_{t:06.2f}.png')
    else:
        render(a.salida, a.voz)
