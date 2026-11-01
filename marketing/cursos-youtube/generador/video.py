#!/usr/bin/env python3
"""Video «Lo que hicimos con IA» y los cursos que vienen en YouTube.

Vertical 1080 × 1920 a 30 fps, de unos 45 s, para estados de WhatsApp,
historias, reels y shorts. Muestra lo más fuerte de lo que construimos con
agentes de IA (Axiona Obra, Axiona Topo con rayos X, celular y computador en
vivo, las redes en automático) y anuncia los cursos del canal de YouTube.

Los tiempos salen de la locución (voz.py): cada escena dura lo que su frase.
Las tarjetas, el fondo y la utilidad de texto son los del video de los 5 cupos
(../../servicio-redes/generador/promo.py), así las piezas se ven de la misma familia.

Uso: python3 video.py SALIDA.mp4 --tiempos tiempos.json --voz voz.wav [--tomas DIR] [--cuadros 1.0,5.5 [--sin-subtitulos]]
"""
from __future__ import annotations

import argparse
import json
import math
import subprocess
import sys
import tempfile
import wave
from functools import lru_cache
from multiprocessing import Pool
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / 'servicio-redes' / 'generador'))
from promo import (BG, CIAN, FF, FG, FPS, H, LINEA, MENTA, MUT, AMBAR, W, Capa, brillo, con_alfa,  # noqa: E402
                   fondo, fuente, panel, preparar_fondo, sale, suave, tarjeta_marca, texto)

ROJO = (255, 92, 108)
YT = (255, 0, 51)
TOMAS = Path(__file__).resolve().parent.parent / 'tomas'

# Se llenan en preparar() antes de repartir el trabajo entre procesos.
E, F, CAPAS, SHOTS, PIEZAS = {}, {}, [], [], None

# Subtítulos: (lo que se lee, lo que se dice). El tiempo de cada trozo sale de lo que se dice.
SUBTITULOS = {
    'o1': [('Axiona Obra:', 'Axiona Obra:'), ('tu casa en 3D,', 'tu casa en tres de,'),
           ('con planos y presupuesto,', 'con planos y presupuesto,'), ('en cuatro países.', 'en cuatro países.')],
    'r2': [('el terreno en holograma,', 'el terreno en holograma,'), ('con rayos X,', 'con rayos equis,'),
           ('en la palma de tu mano.', 'en la palma de tu mano.')],
    'v1': [('El celular mide,', 'El celular mide,'), ('el computador recibe en vivo', 'el computador recibe en vivo'),
           ('y saca el plano.', 'y saca el plano.')],
    'n1': [('Y mis redes se publican solas:', 'Y mis redes se publican solas:'),
           ('más de 4.600 vistas', 'más de cuatro mil seiscientas vistas'), ('en el primer reel.', 'en el primer ril.')],
    'c1': [('Muy pronto,', 'Muy pronto,'), ('en mi canal de YouTube,', 'en mi canal de Yutub,'),
           ('subo los mejores cursos.', 'subo los mejores cursos.')],
}
RESALTE = {'3D,', 'X,', '4.600', 'YouTube,', 'vivo'}

# Lo que se escribe en la terminal del comienzo: los commits reales del proyecto.
TERMINAL = [
    ('cmd', 'git log --oneline'),
    ('out', 'e073fb3 En la palma funciona en cualquier celular'),
    ('out', '845a494 Axiona Topo: el topógrafo en el celular'),
    ('out', '95b8e59 Lanzamiento para México'),
    ('out', 'ad0fbf8 Video de los 5 cupos de redes…'),
    ('cmd', 'npm test'),
    ('ok', '✓ 62 pruebas pasaron'),
    ('cmd', 'npm run build && deploy'),
    ('ok', '✓ publicado en la web'),
]

TEMARIO = [
    ('Repositorios', 'tu código guardado en GitHub'),
    ('Git', 'cada cambio, con su historia'),
    ('Node.js', 'apps y servidores en JavaScript'),
    ('Actualizaciones', 'todo al día y sin romper nada'),
    ('Políticas', 'las reglas de cada plataforma'),
    ('Secretos', 'llaves y .env bien guardados'),
    ('Zapier', 'tus apps conectadas solas'),
    ('Databricks', 'datos a gran escala'),
]


def esc(nombre):
    return tuple(E[nombre])


def fin_de(clave, extra=0.0):
    return F[clave]['ini'] + F[clave]['dur'] + extra


# ---------- tomas a pantalla completa ----------

def suave_np(x):
    x = np.clip(x, 0, 1)
    return np.where(x < 0.5, 4 * x ** 3, 1 - (-2 * x + 2) ** 3 / 2)


@lru_cache(None)
def degradado():
    """Oscurece arriba (títulos) y abajo (subtítulos) sobre las capturas.

    Arriba queda casi sólido hasta donde llegan los títulos, para tapar las
    barras de la app que hay detrás."""
    y = np.arange(H, dtype=np.float32)
    a = 250 * (1 - suave_np((y - 560) / 340))
    a += 235 * suave_np((y - 1440) / 260)
    im = Image.new('RGBA', (W, H), BG + (0,))
    im.putalpha(Image.fromarray(np.repeat(a.clip(0, 255).astype(np.uint8)[:, None], W, axis=1)))
    return im


@lru_cache(None)
def foto(nombre):
    return Image.open(TOMAS / nombre).convert('RGB')


class Toma:
    """Captura a pantalla completa con un acercamiento lento; entra y sale con fundido."""

    def __init__(self, nombre, ini, fin, z=(1.0, 1.08), c0=(0.5, 0.5), c1=None, fundido=0.3):
        self.nombre, self.ini, self.fin, self.z, self.c0, self.c1, self.fundido = nombre, ini, fin, z, c0, c1 or c0, fundido

    def pintar(self, lienzo, t):
        if not (self.ini - self.fundido <= t < self.fin + self.fundido):
            return
        im = foto(self.nombre)
        k = suave((t - self.ini) / (self.fin - self.ini))
        z = self.z[0] + (self.z[1] - self.z[0]) * k
        cx = self.c0[0] + (self.c1[0] - self.c0[0]) * k
        cy = self.c0[1] + (self.c1[1] - self.c0[1]) * k
        s = max(W / im.width, H / im.height) * z
        bw, bh = W / s, H / s
        x0 = min(max(0, cx * im.width - bw / 2), im.width - bw)
        y0 = min(max(0, cy * im.height - bh / 2), im.height - bh)
        cuadro = im.resize((W, H), Image.BILINEAR, box=(x0, y0, x0 + bw, y0 + bh)).convert('RGBA')
        cuadro.alpha_composite(degradado())
        a = lim01((t - self.ini + self.fundido) / self.fundido) * lim01((self.fin + self.fundido - t) / self.fundido)
        lienzo.alpha_composite(con_alfa(cuadro, a) if a < 0.999 else cuadro)


def lim01(x):
    return max(0.0, min(1.0, x))


# ---------- piezas ----------

def etiqueta(s, color, y, ini, fin):
    return Capa(texto(s, fuente('IBMPlexMono-Medium.ttf', 30), color, esp=5), y, ini, fin)


def grande(s, tam, color, y, ini, fin, halo=None, modo='sube', fuente_='ChakraPetch-Bold.ttf'):
    im = texto(s, fuente(fuente_, tam), color)
    if halo:
        base = im
        im = brillo(im, halo, 18, 0.55)
        y -= (im.height - base.height) // 2
    return Capa(im, y, ini, fin, modo=modo)


def chips(textos, y, ini, fin, color=CIAN, paso=0.12):
    f = fuente('Inter-Bold.ttf', 38)
    ims = []
    for s in textos:
        w = int(f.getlength(s)) + 64
        im = Image.new('RGBA', (w + 8, 84), (0, 0, 0, 0))
        d = ImageDraw.Draw(im)
        d.rounded_rectangle((4, 4, w + 4, 80), 38, fill=(10, 18, 26, 225), outline=color + (255,), width=3)
        d.text((w / 2 + 4, 42), s, font=f, fill=FG + (255,), anchor='mm')
        ims.append(im)
    total = sum(i.width for i in ims) + 14 * (len(ims) - 1)
    x, capas = (W - total) // 2, []
    for k, im in enumerate(ims):
        capas.append(Capa(im, y, ini + k * paso, fin, x=x))
        x += im.width + 14
    return capas


def con_marco(nombre, ancho, radio=26, borde=LINEA):
    """Captura dentro de un panel redondeado con sombra."""
    im = foto(nombre)
    alto = round(im.height * ancho / im.width)
    p = panel(ancho + 20, alto + 20, radio=radio + 6, borde=borde, opaco=250)
    foto_r = im.resize((ancho, alto), Image.LANCZOS).convert('RGBA')
    m = Image.new('L', (ancho, alto), 0)
    ImageDraw.Draw(m).rounded_rectangle((0, 0, ancho - 1, alto - 1), radio, fill=255)
    foto_r.putalpha(m)
    p.alpha_composite(foto_r, (50, 50))
    return p


def portatil(nombre, ancho):
    pantalla = con_marco(nombre, ancho, radio=14, borde=(70, 86, 104))
    base_w = ancho + 150
    im = Image.new('RGBA', (max(pantalla.width, base_w + 20), pantalla.height + 34), (0, 0, 0, 0))
    im.alpha_composite(pantalla, ((im.width - pantalla.width) // 2, 0))
    d = ImageDraw.Draw(im)
    cx, y = im.width / 2, pantalla.height - 44
    d.rounded_rectangle((cx - base_w / 2, y, cx + base_w / 2, y + 26), 12, fill=(58, 72, 90, 255))
    d.rounded_rectangle((cx - 90, y, cx + 90, y + 10), 5, fill=(36, 46, 58, 255))
    return im


def celular(nombre, ancho):
    im = foto(nombre)
    alto = round(ancho * 2.05)
    rec = im.crop((0, 0, im.width, round(im.width * 2.05))).resize((ancho, alto), Image.LANCZOS).convert('RGBA')
    m = Image.new('L', rec.size, 0)
    ImageDraw.Draw(m).rounded_rectangle((0, 0, ancho - 1, alto - 1), 30, fill=255)
    rec.putalpha(m)
    p = panel(ancho + 24, alto + 24, radio=42, borde=(70, 86, 104), opaco=255)
    p.alpha_composite(rec, (52, 52))
    return p


def hoja_pdf(nombre, ancho):
    im = foto(nombre)
    alto = round(im.height * ancho / im.width)
    pad = 40
    base = Image.new('RGBA', (ancho + 2 * pad, alto + 2 * pad), (0, 0, 0, 0))
    sombra = Image.new('RGBA', base.size, (0, 0, 0, 0))
    ImageDraw.Draw(sombra).rectangle((pad, pad + 16, pad + ancho, pad + alto + 16), fill=(0, 0, 0, 170))
    base.alpha_composite(sombra.filter(ImageFilter.GaussianBlur(18)))
    base.alpha_composite(im.resize((ancho, alto), Image.LANCZOS).convert('RGBA'), (pad, pad))
    sello = texto('PLANO EN PDF', fuente('IBMPlexMono-Medium.ttf', 28), BG, esp=4)
    pill = Image.new('RGBA', (sello.width + 36, sello.height + 12), (0, 0, 0, 0))
    ImageDraw.Draw(pill).rounded_rectangle((0, 0, pill.width - 1, pill.height - 1), 22, fill=AMBAR + (255,))
    pill.alpha_composite(sello, (18, 6))
    base.alpha_composite(pill, (pad + 24, pad + alto - pill.height - 20))
    return base.rotate(-3, Image.BICUBIC, expand=True)


def boton_play(ancho=300):
    alto = round(ancho * 0.7)
    im = Image.new('RGBA', (ancho, alto), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.rounded_rectangle((0, 0, ancho - 1, alto - 1), round(alto * 0.28), fill=YT + (255,))
    cx, cy, r = ancho * 0.52, alto / 2, alto * 0.24
    d.polygon([(cx - r * 0.8, cy - r), (cx - r * 0.8, cy + r), (cx + r * 1.0, cy)], fill=(255, 255, 255, 255))
    return brillo(im, YT, 26, 0.6)


def ficha(n, titulo, sub, ancho=474, alto=150):
    im = panel(ancho, alto, radio=24, acento=CIAN)
    d = ImageDraw.Draw(im)
    d.text((40 + 52, 40 + 24), f'{n:02d}', font=fuente('IBMPlexMono-Medium.ttf', 26), fill=CIAN + (255,))
    d.text((40 + 52, 40 + 54), titulo, font=fuente('Inter-Bold.ttf', 44), fill=FG + (255,))
    d.text((40 + 52, 40 + 108), sub, font=fuente('Inter-SemiBold.ttf', 25), fill=MUT + (255,))
    return im


def tarjeta_dato(cifra, s1, s2, ancho=460):
    im = panel(ancho, 200, radio=26, acento=CIAN)
    d = ImageDraw.Draw(im)
    d.text((40 + 56, 40 + 22), cifra, font=fuente('ChakraPetch-Bold.ttf', 74), fill=CIAN + (255,))
    d.text((40 + 56, 40 + 112), s1, font=fuente('Inter-Bold.ttf', 38), fill=FG + (255,))
    d.text((40 + 56, 40 + 156), s2, font=fuente('Inter-SemiBold.ttf', 26), fill=MUT + (255,))
    return im


# ---------- escenas ----------

def armar():
    capas, shots = [], []
    dur = E['cierre'][1]
    cab = texto('AXIONA · HECHO CON IA', fuente('IBMPlexMono-Medium.ttf', 28), MUT, esp=5)
    punto = Image.new('RGBA', (cab.width + 34, cab.height), (0, 0, 0, 0))
    ImageDraw.Draw(punto).ellipse((0, cab.height // 2 - 9, 18, cab.height // 2 + 9), fill=MENTA + (255,))
    punto.alpha_composite(cab, (34, 0))
    capas.append(Capa(punto, 214, 0.0, dur + 1, dur=0.3))

    # 1. Gancho: quién habla y en cuánto tiempo se hizo.
    i, f = esc('gancho')
    g2 = F['g2']['ini']
    capas.append(etiqueta('HOLA, SOY', CIAN, 400, i + 0.25, g2))
    capas.append(grande('Santiago', 170, FG, 450, i + 0.35, g2, modo='crece'))
    capas.append(grande('de Axiona', 96, CIAN, 650, i + 0.7, g2, halo=CIAN))
    capas.append(grande('En menos de', 92, FG, 360, g2, f))
    capas.append(grande('3 días', 230, CIAN, 470, g2 + 0.25, f, halo=CIAN, modo='crece'))
    capas.append(Capa(texto('con inteligencia artificial', fuente('Inter-SemiBold.ttf', 54), MUT), 770, g2 + 0.7, f))

    # 2. Axiona Obra
    i, f = esc('obra')
    shots.append(Toma('obra-interior.jpg', i, f, z=(1.0, 1.1), c0=(0.5, 0.5), c1=(0.5, 0.54)))
    capas.append(etiqueta('01 · AXIONA OBRA', CIAN, 320, i + 0.1, f))
    capas.append(grande('Tu casa en 3D', 120, FG, 370, i + 0.2, f))
    capas += chips(['Planos', 'Presupuesto', 'CO · ES · CA · MX'], 540, i + 0.6, f)
    capas.append(Capa(con_marco('obra-planta.jpg', 900), 1060, i + 1.7, f))

    # 3. Axiona Topo
    i, f = esc('topo')
    shots.append(Toma('topo-plano.jpg', i, f, z=(1.0, 1.07), c0=(0.5, 0.43), c1=(0.5, 0.45)))
    capas.append(etiqueta('02 · AXIONA TOPO', CIAN, 320, i + 0.1, f))
    capas.append(grande('El topógrafo', 116, FG, 370, i + 0.15, f))
    capas.append(grande('en tu celular', 96, CIAN, 500, i + 0.35, f, halo=CIAN))

    # 4. Rayos X: lo más brutal
    i, f = esc('rayos')
    r2 = F['r2']['ini']
    palma = r2 + 0.55 * (f - r2)
    shots.append(Toma('topo-holo.jpg', i, r2, z=(1.0, 1.06), c0=(0.5, 0.43), fundido=0.25))
    shots.append(Toma('topo-rayos.jpg', r2, palma, z=(1.02, 1.1), c0=(0.5, 0.44), fundido=0.2))
    shots.append(Toma('topo-rayos-x5.jpg', palma, f, z=(1.0, 1.08), c0=(0.5, 0.44), fundido=0.25))
    capas.append(grande('Lo más', 104, FG, 330, i + 0.1, r2))
    capas.append(grande('BRUTAL', 180, AMBAR, 440, i + 0.3, r2, halo=AMBAR, modo='crece'))
    capas.append(etiqueta('03 · HOLOGRAMA 3D', CIAN, 320, r2, f))
    capas.append(grande('RAYOS X', 170, CIAN, 360, r2 + 0.05, palma, halo=CIAN, modo='crece'))
    capas.append(grande('En la palma', 110, FG, 370, palma, f))
    capas.append(grande('de tu mano', 96, CIAN, 500, palma + 0.15, f, halo=CIAN))

    # 5. Celular y computador en vivo, y el plano en PDF
    i, f = esc('vivo')
    capas.append(etiqueta('04 · CELULAR Y COMPUTADOR', CIAN, 300, i + 0.1, f))
    capas.append(grande('En vivo y cifrado', 100, FG, 350, i + 0.15, f))
    capas.append(Capa(portatil('pc-holo.jpg', 860), 520, i + 0.25, f, modo='crece'))
    capas.append(Capa(celular('topo-plano.jpg', 250), 930, i + 0.5, f, x=20))
    capas.append(Capa(hoja_pdf('plano-pdf.jpg', 520), 1080, F['v1']['ini'] + 0.7 * F['v1']['dur'], f, x=430))

    # 6. Redes en automático
    i, f = esc('redes')
    capas.append(etiqueta('05 · REDES EN PILOTO AUTOMÁTICO', CIAN, 400, i + 0.1, f))
    capas.append(Capa(texto('vistas en el primer reel', fuente('Inter-Bold.ttf', 64), FG), 830, i + 0.9, f))
    capas.append(Capa(tarjeta_dato('99.7 %', 'no me seguía', 'de quienes lo vieron'), 940, i + 2.2, f, x=20))
    capas.append(Capa(tarjeta_dato('49 %', 'desde México', 'de todas las vistas'), 940, i + 2.45, f, x=520))
    capas.append(Capa(texto('Datos de Instagram · @axionadesarrollos · 30 oct 2026', fuente('IBMPlexMono-Medium.ttf', 24), MUT),
                      1240, i + 2.8, f))

    # 7. Cursos en YouTube
    i, f = esc('cursos')
    capas.append(etiqueta('PRÓXIMAMENTE', AMBAR, 360, i + 0.1, f))
    capas.append(Capa(boton_play(300), 400, i + 0.2, f, modo='crece'))
    capas.append(grande('Los mejores', 120, FG, 720, i + 0.45, f))
    capas.append(grande('cursos', 190, CIAN, 840, i + 0.6, f, halo=CIAN, modo='crece'))
    capas.append(Capa(texto('en mi canal de YouTube', fuente('Inter-SemiBold.ttf', 56), MUT), 1090, i + 0.9, f))

    # 8. Lo imposible, posible (la palabra se arma en dinamicos)
    i, f = esc('posible')
    capas.append(etiqueta('EN MENOS DE UN MES', CIAN, 560, i + 0.1, f))
    capas.append(Capa(texto('vas a hacer lo', fuente('Inter-SemiBold.ttf', 62), FG), 640, i + 0.3, f))

    # 9. Temario: lo que debes saber
    i, f = esc('temario')
    capas.append(etiqueta('LO QUE DEBES SABER', CIAN, 280, i + 0.1, f))
    capas.append(grande('Del código', 108, FG, 330, i + 0.2, f))
    capas.append(grande('a proyectos reales', 84, CIAN, 460, i + 0.45, f, halo=CIAN))
    m = F['m']['marcas']
    aparece = [m[0], m[1], m[1] + 0.32, m[2], m[3], m[3] + 0.45, m[4], m[4] + 0.38]
    for k, ((titulo, sub), t0) in enumerate(zip(TEMARIO, aparece)):
        fila, col = divmod(k, 2)
        capas.append(Capa(ficha(k + 1, titulo, sub), 600 + fila * 178, t0, f, x=14 + col * 498))
    capas.append(Capa(texto('Los cursos, muy pronto en YouTube', fuente('Inter-SemiBold.ttf', 44), MUT), 1370, m[4] + 0.9, f))

    # 10. Cierre
    i, f = esc('cierre')
    capas.append(grande('Sígueme', 150, FG, 380, i + 0.1, f + 1, modo='crece'))
    capas.append(grande('y activa la campana', 76, CIAN, 570, i + 0.3, f + 1, halo=CIAN))
    capas.append(Capa(tarjeta_marca(), 1000, i + 0.8, f + 1, modo='crece'))
    return capas, shots


def terminal(lienzo, t):
    i, f = esc('gancho')
    t0 = i + 0.45
    if not (t0 <= t < f):
        return
    a = sale((t - t0) / 0.4) * (1 - suave((t - (f - 0.35)) / 0.35))
    ancho, alto = 960, 560
    im = panel(ancho, alto, radio=26)
    d = ImageDraw.Draw(im)
    for k, c in enumerate((ROJO, AMBAR, MENTA)):
        d.ellipse((40 + 30 + k * 34, 40 + 26, 40 + 50 + k * 34, 40 + 46), fill=c + (255,))
    d.text((40 + ancho / 2, 40 + 36), 'axiona-obra — zsh', font=fuente('IBMPlexMono-Medium.ttf', 24), fill=MUT + (255,), anchor='mm')
    fm = fuente('IBMPlexMono-Medium.ttf', 29)
    reloj, y, cursor = t0 + 0.2, 40 + 82, None
    for tipo, s in TERMINAL:
        if t < reloj:
            break
        if tipo == 'cmd':
            n = min(len(s), int((t - reloj) * 34))
            d.text((40 + 34, y), '$', font=fm, fill=MENTA + (255,))
            d.text((40 + 34 + 30, y), s[:n], font=fm, fill=FG + (255,))
            cursor = (40 + 34 + 30 + fm.getlength(s[:n]), y)
            reloj += len(s) / 34 + 0.12
        else:
            if tipo == 'out':  # hash del commit en ámbar, mensaje en blanco
                d.text((40 + 34, y), s[:7], font=fm, fill=AMBAR + (255,))
                d.text((40 + 34 + fm.getlength(s[:8]), y), s[8:], font=fm, fill=FG + (255,))
            else:
                d.text((40 + 34, y), s, font=fm, fill=MENTA + (255,))
            cursor = None
            reloj += 0.16
        y += 46
    if cursor and int(t * 3) % 2 == 0:
        d.rectangle((cursor[0] + 4, cursor[1] + 4, cursor[0] + 20, cursor[1] + 36), fill=FG + (255,))
    lienzo.alpha_composite(con_alfa(im, a), ((W - im.width) // 2, int(930 + (1 - a) * 30)))


@lru_cache(512)
def cifra_vistas(s):
    return brillo(texto(s, fuente('ChakraPetch-Bold.ttf', 220), CIAN), CIAN, 20, 0.5)


@lru_cache(64)
def palabra(s, color, tam=170):
    return texto(s, fuente('ChakraPetch-Bold.ttf', tam), color)


def campana(lado, ang):
    im = Image.new('RGBA', (lado, lado), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    c = lado / 2
    d.pieslice((c - 70, c - 95, c + 70, c + 45), 180, 360, fill=CIAN + (255,))
    d.polygon([(c - 70, c - 25), (c + 70, c - 25), (c + 92, c + 55), (c - 92, c + 55)], fill=CIAN + (255,))
    d.rounded_rectangle((c - 105, c + 48, c + 105, c + 70), 11, fill=CIAN + (255,))
    d.ellipse((c - 22, c + 66, c + 22, c + 104), fill=CIAN + (255,))
    d.ellipse((c - 12, c - 118, c + 12, c - 94), fill=CIAN + (255,))
    return brillo(im.rotate(ang, Image.BICUBIC, center=(c, c - 100)), CIAN, 18, 0.5)


def dinamicos(lienzo, t):
    terminal(lienzo, t)

    # Rayos X: barrido del escáner y esquinas del visor.
    i, f = esc('rayos')
    r2 = F['r2']['ini']
    if r2 <= t < f:
        a = sale((t - r2) / 0.3) * (1 - suave((t - (f - 0.3)) / 0.3))
        y0, y1 = 640, 1330
        y = y0 + ((t - r2) * 420) % (y1 - y0)
        capa = Image.new('RGBA', (W, 140), (0, 0, 0, 0))
        dd = ImageDraw.Draw(capa)
        for k in range(110):
            dd.line((70, 110 - k, W - 70, 110 - k), fill=CIAN + (int(70 * a * (1 - k / 110) ** 2),))
        dd.line((70, 110, W - 70, 110), fill=CIAN + (int(255 * a),), width=4)
        lienzo.alpha_composite(capa, (0, int(y - 110)))
        d = ImageDraw.Draw(lienzo)
        for (x, yy, sx, sy) in ((60, 620, 1, 1), (W - 60, 620, -1, 1), (60, 1345, 1, -1), (W - 60, 1345, -1, -1)):
            d.line((x, yy, x + 70 * sx, yy), fill=CIAN + (int(230 * a),), width=6)
            d.line((x, yy, x, yy + 70 * sy), fill=CIAN + (int(230 * a),), width=6)
        # destello al entrar a los rayos X
        if t < r2 + 0.3:
            flash = Image.new('RGBA', (W, H), (190, 240, 255, int(150 * (1 - (t - r2) / 0.3))))
            lienzo.alpha_composite(flash)

    # En vivo: datos que viajan del celular al computador, con candado.
    i, f = esc('vivo')
    if i + 0.8 <= t < f:
        a = sale((t - i - 0.8) / 0.3) * (1 - suave((t - (f - 0.3)) / 0.3))
        p0, pc, p1 = (330, 990), (380, 760), (560, 820)
        d = ImageDraw.Draw(lienzo)
        for n in range(6):
            u = ((t - i) * 0.9 + n / 6) % 1
            x = (1 - u) ** 2 * p0[0] + 2 * (1 - u) * u * pc[0] + u ** 2 * p1[0]
            y = (1 - u) ** 2 * p0[1] + 2 * (1 - u) * u * pc[1] + u ** 2 * p1[1]
            r = 9
            d.ellipse((x - r, y - r, x + r, y + r), fill=MENTA + (int(255 * a * math.sin(math.pi * u)),))
        candado = Image.new('RGBA', (300, 70), (0, 0, 0, 0))
        dc = ImageDraw.Draw(candado)
        dc.rounded_rectangle((0, 0, 299, 69), 34, fill=(10, 18, 26, 235), outline=MENTA + (255,), width=3)
        dc.arc((26, 10, 52, 40), 180, 360, fill=MENTA + (255,), width=5)
        dc.rounded_rectangle((20, 26, 58, 56), 6, fill=MENTA + (255,))
        dc.text((176, 35), 'AES-256', font=fuente('IBMPlexMono-Medium.ttf', 30), fill=FG + (255,), anchor='mm')
        lienzo.alpha_composite(con_alfa(candado, a), (40, 800))

    # Redes: el contador de vistas.
    i, f = esc('redes')
    if i + 0.3 <= t < f:
        s = 1 - suave((t - (f - 0.35)) / 0.35)
        e = sale((t - i - 0.3) / 0.5)
        k = sale((t - i - 0.4) / 1.8)
        v = int(round(4600 * k / 10) * 10)
        im = cifra_vistas(f'{v // 1000}.{v % 1000:03d}+' if v >= 1000 else f'{v}+')
        lienzo.alpha_composite(con_alfa(im, e * s), ((W - im.width) // 2, int(470 + (1 - e) * 40)))

    # Lo imposible se vuelve posible.
    i, f = esc('posible')
    p2 = F['p2']['ini']
    if i + 0.3 <= t < f:
        s = 1 - suave((t - (f - 0.35)) / 0.35)
        e = sale((t - i - 0.3) / 0.5)
        k = suave((t - p2 + 0.05) / 0.45)
        im_ = palabra('IM', FG)
        pos = palabra('POSIBLE', FG)
        pos_v = brillo(palabra('POSIBLE', MENTA), MENTA, 22, 0.6)
        total = im_.width + pos.width - 12
        x_im = (W - total) / 2
        x_pos = x_im + im_.width - 12
        x_fin = (W - pos.width) / 2
        y = 740 + (1 - e) * 40
        if k < 1:
            caida = suave((t - p2 - 0.15) / 0.4)
            ai = e * s * (1 - caida)
            if ai > 0.01:
                lienzo.alpha_composite(con_alfa(im_, ai), (int(x_im), int(y + caida * 120)))
            if t >= p2 - 0.05:
                largo = sale((t - p2 + 0.05) / 0.18) * (im_.width - 10)
                d = ImageDraw.Draw(lienzo)
                yc = y + im_.height * 0.55 + caida * 120
                d.line((x_im + 6, yc, x_im + 6 + largo, yc - 10), fill=ROJO + (int(255 * e * s * (1 - caida)),), width=14)
        xp = x_pos + (x_fin - x_pos) * k
        lienzo.alpha_composite(con_alfa(pos, e * s * (1 - k)), (int(xp), int(y)))
        if k > 0:
            lienzo.alpha_composite(con_alfa(pos_v, s * k), (int(xp - (pos_v.width - pos.width) / 2), int(y - (pos_v.height - pos.height) / 2)))
        if p2 <= t < p2 + 0.25:
            flash = Image.new('RGBA', (W, H), MENTA + (int(70 * (1 - (t - p2) / 0.25)),))
            lienzo.alpha_composite(flash)

    # Cierre: la campana se mece.
    i, f = esc('cierre')
    if i + 0.5 <= t:
        e = sale((t - i - 0.5) / 0.4)
        ang = 18 * math.sin((t - i - 0.5) * 11) * math.exp(-(t - i - 0.5) * 1.6)
        im = campana(300, ang)
        lienzo.alpha_composite(con_alfa(im, e), ((W - im.width) // 2, int(690 + (1 - e) * 30)))


# ---------- subtítulos ----------

def trozos():
    salida = []
    for clave, partes in SUBTITULOS.items():
        fr = F[clave]
        total = sum(len(dicho) + 1 for _, dicho in partes)
        acum = 0
        for k, (leido, dicho) in enumerate(partes):
            ini = fr['ini'] + fr['dur'] * acum / total
            acum += len(dicho) + 1
            fin = fr['ini'] + fr['dur'] * acum / total if k < len(partes) - 1 else fr['ini'] + fr['dur'] + 0.25
            salida.append((ini, fin, leido))
    return salida


@lru_cache(64)
def sprite_sub(s):
    f = fuente('Inter-Bold.ttf', 50)
    palabras = s.split(' ')
    esp = f.getlength(' ')
    ancho = sum(f.getlength(p) for p in palabras) + esp * (len(palabras) - 1)
    im = Image.new('RGBA', (int(ancho) + 64, 92), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.rounded_rectangle((0, 0, im.width - 1, im.height - 1), 24, fill=(8, 12, 17, 220))
    x = 32
    for p in palabras:
        d.text((x, 46), p, font=f, fill=(CIAN if p in RESALTE else FG) + (255,), anchor='lm')
        x += f.getlength(p) + esp
    return im


SUBS = []


def subtitulos(lienzo, t):
    for ini, fin, s in SUBS:
        if ini <= t < fin:
            im = sprite_sub(s)
            a = sale((t - ini) / 0.12)
            lienzo.alpha_composite(con_alfa(im, a), ((W - im.width) // 2, 1594))


# ---------- música original ----------

def musica(ruta, sr=48000):
    """Pulso en Re menor (Dm–B♭–F–C) a 118 bpm, hecho con osciladores, con subida y golpe en «posible»."""
    dur = E['cierre'][1]
    n = int(dur * sr)
    t = np.arange(n) / sr
    rng = np.random.default_rng(11)
    pulso = 60 / 118
    nota = lambda m: 440 * 2 ** ((m - 69) / 12)
    acordes = [(62, 65, 69, 74), (58, 62, 65, 70), (53, 57, 60, 65), (60, 64, 67, 72)]
    bajos = [38, 46, 41, 48]
    largo = 8 * pulso
    p_ini, p2 = E['posible'][0], F['p2']['ini']

    def calma(x):  # sin bombo ni bajo mientras se dice «imposible»
        return p_ini + 0.2 <= x < p2

    pad_l, pad_r, bajo, bombo, plato, punteo = (np.zeros(n) for _ in range(6))
    for k in range(int(dur / largo) + 1):
        a = k * largo
        if a >= dur:
            break
        i0, i1 = int(a * sr), min(n, int((a + largo + 0.3) * sr))
        tt = t[i0:i1] - a
        env = np.minimum(1, tt / 0.8) * np.clip((largo + 0.3 - tt) / 0.6, 0, 1)
        ac = acordes[k % 4]
        pad_l[i0:i1] += env * sum(np.sin(2 * np.pi * nota(m) * tt) + 0.25 * np.sin(4 * np.pi * nota(m) * tt) for m in ac) / len(ac)
        pad_r[i0:i1] += env * sum(np.sin(2 * np.pi * nota(m) * 1.003 * tt + 0.7) + 0.25 * np.sin(4 * np.pi * nota(m) * 1.003 * tt) for m in ac) / len(ac)
        for b in range(8):
            tb0 = a + b * pulso
            j0 = int(tb0 * sr)
            if j0 >= n:
                break
            if calma(tb0):
                continue
            j1 = min(n, j0 + int(0.42 * sr))
            tb = t[j0:j1] - tb0
            f0 = nota(bajos[k % 4])
            onda = np.tanh(1.6 * np.sin(2 * np.pi * f0 * tb)) + 0.45 * np.sin(4 * np.pi * f0 * tb)
            bajo[j0:j1] += onda * np.minimum(1, tb / 0.012) * np.exp(-5.5 * tb)
        for b in range(16):
            tb0 = a + b * pulso / 2
            j0 = int(tb0 * sr)
            if j0 >= n:
                break
            j1 = min(n, j0 + int(0.5 * sr))
            tb = t[j0:j1] - tb0
            fp = nota(ac[[0, 1, 2, 3, 2, 1, 2, 3][b % 8]] + 12)
            onda = np.sin(2 * np.pi * fp * tb) + 0.3 * np.sin(4 * np.pi * fp * tb) + 0.12 * np.sin(6 * np.pi * fp * tb)
            punteo[j0:j1] += onda * np.minimum(1, tb / 0.004) * np.exp(-7.5 * tb)
    for b in range(int(dur / pulso) + 1):
        tb0 = b * pulso
        if tb0 < 4 * pulso or tb0 >= dur - 1.2 or calma(tb0):
            continue
        j0, j1 = int(tb0 * sr), min(n, int((tb0 + 0.45) * sr))
        tb = t[j0:j1] - tb0
        bombo[j0:j1] += np.sin(2 * np.pi * (52 * tb + 110 / 32 * (1 - np.exp(-32 * tb)))) * np.exp(-9 * tb)
        k1 = min(n, j0 + int(0.006 * sr))
        bombo[j0:k1] += 0.5 * np.diff(rng.standard_normal(k1 - j0), prepend=0)
        h0 = int((tb0 + pulso / 2) * sr)
        h1 = min(n, h0 + int(0.12 * sr))
        if h0 < n:
            plato[h0:h1] += np.diff(rng.standard_normal(h1 - h0), prepend=0) * np.exp(-40 * (t[h0:h1] - t[h0]))

    def ruido_banda(j0, j1, centro, ancho=0.9):
        r = rng.standard_normal(j1 - j0)
        esp = np.fft.rfft(r)
        fr = np.fft.rfftfreq(len(r), 1 / sr)
        esp *= np.exp(-((np.log(fr + 1) - np.log(centro)) ** 2) / ancho)
        return np.fft.irfft(esp, len(r))

    barrido = np.zeros(n)
    for nombre in ('obra', 'topo', 'rayos', 'vivo', 'redes', 'cursos', 'temario', 'cierre'):
        tc = E[nombre][0]
        j0, j1 = int((tc - 0.45) * sr), min(n, int((tc + 0.25) * sr))
        tb = t[j0:j1] - (tc - 0.45)
        barrido[j0:j1] += ruido_banda(j0, j1, 1800) * np.sin(np.pi * np.clip(tb / 0.7, 0, 1)) ** 2
    barrido /= max(1e-9, np.abs(barrido).max())
    # Subida antes de «posible» y golpe grave al decirlo.
    subida = np.zeros(n)
    j0, j1 = int((p2 - 1.6) * sr), int(p2 * sr)
    tb = t[j0:j1] - (p2 - 1.6)
    subida[j0:j1] = ruido_banda(j0, j1, 3000, 1.4) * (tb / 1.6) ** 2
    subida[j0:j1] += 0.5 * np.sin(2 * np.pi * (220 * tb + 300 * tb ** 2 / 3.2)) * (tb / 1.6) ** 2
    subida /= max(1e-9, np.abs(subida).max())
    golpe = np.zeros(n)
    j0, j1 = int(p2 * sr), min(n, int((p2 + 1.4) * sr))
    tb = t[j0:j1] - p2
    golpe[j0:j1] = np.sin(2 * np.pi * (34 * tb + 90 / 6 * (1 - np.exp(-6 * tb)))) * np.exp(-2.6 * tb)
    golpe[j0:j1] += 0.35 * ruido_banda(j0, j1, 900, 2.0) / 3 * np.exp(-9 * tb)
    # Tecleo suave mientras se escribe en la terminal.
    tecleo = np.zeros(n)
    t0 = E['gancho'][0] + 0.65
    reloj = t0
    for tipo, s in TERMINAL:
        if tipo == 'cmd':
            for c in range(len(s)):
                tc = reloj + c / 34
                j0 = int(tc * sr)
                j1 = min(n, j0 + int(0.02 * sr))
                tecleo[j0:j1] += np.diff(rng.standard_normal(j1 - j0), prepend=0) * np.exp(-260 * (t[j0:j1] - tc)) * rng.uniform(0.5, 1)
            reloj += len(s) / 34 + 0.12
        else:
            reloj += 0.16
    mezcla = 0.12 * bajo + 0.28 * bombo + 0.05 * plato + 0.06 * barrido + 0.1 * punteo + 0.08 * subida + 0.55 * golpe + 0.05 * tecleo
    estereo = np.stack([mezcla + 0.2 * pad_l, mezcla + 0.2 * pad_r], axis=1)
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


# ---------- render ----------

def cuadro(t):
    lienzo = fondo(t, PIEZAS)
    for s in SHOTS:
        s.pintar(lienzo, t)
    for c in CAPAS:
        c.pintar(lienzo, t)
    dinamicos(lienzo, t)
    subtitulos(lienzo, t)
    return lienzo.convert('RGB')


def tramo(args):
    """Codifica los cuadros [a, b) en un archivo propio; los tramos se pegan al final."""
    a, b, ruta = args
    proc = subprocess.Popen([FF, '-y', '-v', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{W}x{H}', '-r', str(FPS),
                             '-i', '-', '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-profile:v', 'high',
                             '-level', '4.1', '-pix_fmt', 'yuv420p', '-g', str(FPS * 2), str(ruta)], stdin=subprocess.PIPE)
    for k in range(a, b):
        proc.stdin.write(cuadro(k / FPS).tobytes())
    proc.stdin.close()
    if proc.wait():
        raise SystemExit('ffmpeg falló en un tramo')
    return ruta


def preparar(tiempos):
    global E, F, CAPAS, SHOTS, PIEZAS, SUBS
    E, F = tiempos['escenas'], tiempos['frases']
    PIEZAS = preparar_fondo()
    CAPAS, SHOTS = armar()
    SUBS = trozos()


def render(salida, voz, procesos=4):
    salida = Path(salida)
    dur = E['cierre'][1]
    total = int(round(dur * FPS))
    with tempfile.TemporaryDirectory() as tmp:
        tmp = Path(tmp)
        cortes = np.linspace(0, total, procesos + 1).astype(int)
        partes = [(int(a), int(b), tmp / f'tramo{k}.mp4') for k, (a, b) in enumerate(zip(cortes, cortes[1:]))]
        with Pool(procesos) as pool:
            hechos = pool.map(tramo, partes)
        (tmp / 'lista.txt').write_text(''.join(f"file '{p}'\n" for p in hechos))
        subprocess.run([FF, '-y', '-v', 'error', '-f', 'concat', '-safe', '0', '-i', str(tmp / 'lista.txt'), '-c', 'copy',
                        str(tmp / 'video.mp4')], check=True)
        musica(tmp / 'musica.wav')
        # La música baja cuando habla la voz (compresión por cadena lateral).
        subprocess.run([FF, '-y', '-v', 'error', '-i', str(tmp / 'video.mp4'), '-i', str(tmp / 'musica.wav'), '-i', str(voz),
                        '-filter_complex',
                        '[1:a]aresample=48000,volume=0.3[m];'
                        '[2:a]aresample=48000,highpass=f=80,acompressor=threshold=0.1:ratio=3:attack=5:release=120,'
                        'pan=stereo|c0=c0|c1=c0,asplit=2[v][vs];'
                        '[m][vs]sidechaincompress=threshold=0.03:ratio=6:attack=15:release=350[md];'
                        '[md][v]amix=inputs=2:normalize=0,loudnorm=I=-16:TP=-1.5:LRA=11,alimiter=limit=0.84:level=false[a]',
                        '-map', '0:v', '-map', '[a]', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-ar', '48000',
                        '-movflags', '+faststart', '-shortest', str(salida)], check=True)


if __name__ == '__main__':
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument('salida')
    p.add_argument('--tiempos', required=True, help='tiempos.json de voz.py')
    p.add_argument('--voz', required=True, help='voz.wav de voz.py')
    p.add_argument('--tomas', help='carpeta de las capturas (por defecto ../tomas)')
    p.add_argument('--cuadros', default='', help='solo guarda estos instantes como PNG, separados por coma')
    p.add_argument('--sin-subtitulos', action='store_true', help='cuadros sin subtítulos, para la portada')
    a = p.parse_args()
    if a.tomas:
        TOMAS = Path(a.tomas)
    preparar(json.loads(Path(a.tiempos).read_text()))
    if a.sin_subtitulos:
        SUBS = []
    if a.cuadros:
        for t in (float(x) for x in a.cuadros.split(',') if x):
            cuadro(t).save(Path(a.salida).parent / f'cuadro_{t:05.2f}.png')
    else:
        render(a.salida, a.voz)
