#!/usr/bin/env python3
"""Axiona Podcast · «El propósito y el para qué». Video podcast horizontal 1920 × 1080.

Una «mesa de trabajo digital»: a la izquierda, los dos hablantes (presentadora y
Claude) como avatares que reaccionan a la intensidad real de su voz; al centro,
un escenario que cambia cada 3 a 4 s con material real de Axiona (el glamping
en 3D girando, la consola con las pruebas de Axiona Obra, el presupuesto real,
los planos, la app publicada y Axiona Topo) y palabras clave con tipografía
cinética; abajo, los subtítulos con el color de quien habla.

Paleta: grafito #0B0F19, cian #00F2FE (agentes) y dorado #D4AF37 (valor humano).

Uso: AXIONA_FUENTES=… python3 video.py SALIDA.mp4 --medios DIR --tiempos tiempos.json --voz voz.wav [--cuadros 5,40]
  DIR tiene orbita/, heroe/, noche/, ui/ (tomas del glamping), obra/ (obra.cjs) y topo/ (Axiona Topo).
"""
from __future__ import annotations

import argparse
import json
import math
import os
import shutil
import subprocess
import tempfile
import wave
from functools import lru_cache
from multiprocessing import Pool
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

W, H, FPS = 1920, 1080, 30
BG = (11, 15, 25)
CIAN = (0, 242, 254)
ORO = (212, 175, 55)
FG = (232, 238, 246)
MUT = (138, 150, 170)
GRIS = (96, 106, 122)
FUENTES = Path(os.environ.get('AXIONA_FUENTES', '.'))
FF = os.environ.get('FFMPEG') or shutil.which('ffmpeg') or 'ffmpeg'
MEDIOS = Path('.')
T = {}
SEGMENTOS, SUBS = [], []

# Escenario
SX, SY, SW, SH = 620, 168, 1240, 720

BLOQUES = {
    'apertura': 'BLOQUE 1 · EL ESPEJISMO DEL FUTURO',
    'friccion': 'BLOQUE 2 · EL FIN DE LA FRICCIÓN',
    'valor': 'BLOQUE 3 · ¿QUIÉN SE QUEDA CON EL VALOR?',
    'audiencia': 'BLOQUE 4 · LA PREGUNTA PARA USTEDES',
}

# Datos reales de Axiona Obra publicada (mansión campestre Llano Grande, pestaña Presupuesto).
PRESUPUESTO = [('Obra negra', 429_489_572), ('Obra gris', 50_223_780), ('Obra blanca', 584_034_019),
               ('Instalaciones', 41_550_000), ('Dotación y tecnología', 220_110_000)]
TOTAL = 1_669_350_583
PRUEBAS = [
    ('motor › la casa de ejemplo', 'es determinista'),
    ('motor › la casa de ejemplo', 'presupuesto y materiales con sentido'),
    ('motor › estructura', 'ningun eje deja una luz mayor a 4.5 m'),
    ('motor › lotes dificiles', 'un lote girado da la misma casa que uno derecho'),
    ('fase2 › piscina, parqueadero y vía', 'si no cabe lo dice, y no la cobra'),
    ('v3 › paises', 'cada pais trae precios, pasos y profesionales'),
    ('v3 › cubierta', 'a cuatro aguas: cuatro caras y limatesas'),
    ('motor › plantillas', 'CO/campestre: bien armada y sin avisos'),
    ('motor › plantillas', 'ES/chalet: bien armada y sin avisos'),
    ('motor › plantillas', 'MX/tipoA: bien armada'),
]

# Qué se ve con cada frase. «palabra:…» es tipografía cinética; «@texto» cambia en esa palabra de la frase.
GUION = {
    'p1': ['titulo2', 'orbita', 'pantallas'],
    'p2': ['palabra:EL TRASFONDO', 'orbita'],
    'a1': ['consola', 'pantallas'],
    'a2': ['ruido', 'palabra:UNA LECTURA MÁS PROFUNDA'],
    'p3': ['palabra:¿POST-ESCASEZ?', 'ruido'],
    'p4': ['palabra:2036', '@para qué', 'palabra:¿PARA QUÉ?|oro'],
    'a3': ['palabra:LA SUPERFICIE|gris', 'superficie'],
    'a4': ['superficie', 'palabra:PROBAR UNA VEZ ≠ CONSTRUIR|gris'],
    'p5': ['palabra:AL BARRO DE LA EJECUCIÓN', 'consola'],
    'p6': ['topo', '@normas', 'norma', '@los planos', 'planos', '@el modelo', 'orbita', '@el presupuesto', 'finanzas'],
    'a5': ['palabra:REVELADOR', '@destruir', 'palabra:FRICCIÓN'],
    'a6': ['palabra:EL CÓMO|gris', '@calcular', 'manual'],
    'a7': ['palabra:EL CÓMO → EL QUÉ', '@la intención', 'palabra:LA INTENCIÓN|oro'],
    'p7': ['palabra:¿OBSOLETO?|gris', 'orbita'],
    'p8': ['pantallas', '@dónde queda', 'palabra:¿Y EL VALOR HUMANO?|oro'],
    'a8': ['palabra:CRITERIO DE NEGOCIO|oro'],
    'a9': ['finanzas', '@Pero el negocio', 'balanza'],
    'p9': ['palabra:APU', '@Pero la negociación', 'balanza'],
    'p10': ['palabra:LO REPETITIVO|gris', '@para que te concentres', 'palabra:CRITERIO HUMANO|oro'],
    'a10': ['palabra:LA PREGUNTA'],
    'a11': ['dilema'],
    'p11': ['pregunta'],
    'p12': ['pregunta'],
    'a12': ['cierre'],
}
RELLENO = ['orbita', 'pantallas', 'consola', 'finanzas', 'planos', 'noche']


# ---------------------------------------------------------------- utilidades

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


def con_alfa(im, a):
    if a >= 0.999:
        return im
    im = im.copy()
    im.putalpha(im.getchannel('A').point(lambda v: int(v * a)))
    return im


@lru_cache(128)
def imagen(rel):
    return Image.open(MEDIOS / rel).convert('RGBA')


@lru_cache(None)
def cuadros(carpeta):
    return sorted((MEDIOS / carpeta).glob('*.jpg'))


def cubrir(im, w, h, k=1.0, cy=0.5):
    """Recorta y escala la imagen para cubrir w × h (cy: dónde centrar en vertical)."""
    s = max(w / im.width, h / im.height) * k
    cw, ch = w / s, h / s
    x0 = (im.width - cw) / 2
    y0 = lim((im.height - ch) * cy, 0, im.height - ch)
    return im.resize((w, h), Image.BICUBIC, box=(x0, y0, x0 + cw, y0 + ch))


def texto(s, f, color, a=255):
    asc, desc = f.getmetrics()
    im = Image.new('RGBA', (math.ceil(f.getlength(s)) + 16, asc + desc + 16), (0, 0, 0, 0))
    ImageDraw.Draw(im).text((8, 8), s, font=f, fill=color + (a,))
    return im


def halo(im, color, radio=16, fuerza=0.6):
    pad = radio * 3
    base = Image.new('RGBA', (im.width + 2 * pad, im.height + 2 * pad), (0, 0, 0, 0))
    a = Image.new('L', base.size, 0)
    a.paste(im.getchannel('A'), (pad, pad))
    glow = Image.new('RGBA', base.size, color + (0,))
    glow.putalpha(a.filter(ImageFilter.GaussianBlur(radio)).point(lambda v: int(v * fuerza)))
    base.alpha_composite(glow)
    base.alpha_composite(im, (pad, pad))
    return base


def pegar(dst, im, cx, cy, a=1.0, k=1.0):
    if a <= 0.01:
        return
    if abs(k - 1) > 1e-3:
        im = im.resize((max(1, int(im.width * k)), max(1, int(im.height * k))), Image.BICUBIC)
    dst.alpha_composite(con_alfa(im, min(1.0, a)), (int(cx - im.width / 2), int(cy - im.height / 2)))


def tarjeta(im, ancho, radio=22, borde=(52, 64, 82)):
    alto = round(ancho * im.height / im.width)
    rec = im.resize((ancho, alto), Image.LANCZOS)
    m = Image.new('L', rec.size, 0)
    ImageDraw.Draw(m).rounded_rectangle((0, 0, ancho - 1, alto - 1), radio, fill=255)
    rec.putalpha(m)
    out = Image.new('RGBA', (ancho + 60, alto + 60), (0, 0, 0, 0))
    sombra = Image.new('RGBA', out.size, (0, 0, 0, 0))
    ImageDraw.Draw(sombra).rounded_rectangle((30, 40, 30 + ancho, 40 + alto), radio, fill=(0, 0, 0, 170))
    out.alpha_composite(sombra.filter(ImageFilter.GaussianBlur(14)))
    out.alpha_composite(rec, (30, 30))
    ImageDraw.Draw(out).rounded_rectangle((30, 30, 30 + ancho - 1, 30 + alto - 1), radio, outline=borde + (255,), width=2)
    return out


@lru_cache(64)
def tarjeta_rel(rel, ancho):
    return tarjeta(imagen(rel), ancho)


def marca(clave, palabras):
    f = T['frases'][clave]
    i = f['lee'].find(palabras)
    assert i >= 0, (clave, palabras)
    return f['ini'] + f['dur'] * i / len(f['lee'])


def env(quien, t):
    e = T['envolvente'][quien]
    i = int(t * FPS)
    return e[i] if 0 <= i < len(e) else 0.0


def hablando(t):
    for k, f in T['frases'].items():
        if f['ini'] - 0.15 <= t < f['ini'] + f['dur'] + 0.25:
            return f['hablante'], k
    return None, None


# ---------------------------------------------------------------- fondo

@lru_cache(None)
def fondo_base():
    y = np.linspace(0, 1, H)[:, None, None]
    arriba, abajo = np.array((14, 19, 31)), np.array(BG)
    base = Image.fromarray((arriba * (1 - y) + abajo * y).repeat(W, axis=1).astype(np.uint8)).convert('RGBA')
    d = ImageDraw.Draw(base)
    for x in range(0, W, 64):
        d.line((x, 0, x, H), fill=(26, 34, 50, 255), width=1)
    for yy in range(0, H, 64):
        d.line((0, yy, W, yy), fill=(26, 34, 50, 255), width=1)
    r = np.hypot(*np.meshgrid(np.linspace(-1, 1, W), np.linspace(-1, 1, H)))
    vin = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    vin.putalpha(Image.fromarray((np.clip(r - 0.6, 0, 1) * 300).clip(0, 190).astype(np.uint8)))
    base.alpha_composite(vin)
    return base


@lru_cache(None)
def mancha(diam, color, fuerza):
    r = np.hypot(*np.meshgrid(np.linspace(-1, 1, diam), np.linspace(-1, 1, diam)))
    im = Image.new('RGBA', (diam, diam), color + (0,))
    im.putalpha(Image.fromarray((np.clip(1 - r, 0, 1) ** 2.4 * 255 * fuerza).astype(np.uint8)))
    return im


def fondo(t):
    f = fondo_base().copy()
    f.alpha_composite(mancha(1100, CIAN, 0.10), (int(1100 + 260 * math.sin(0.11 * t)) - 550, int(420 + 160 * math.cos(0.09 * t)) - 550))
    f.alpha_composite(mancha(900, ORO, 0.07), (int(320 - 200 * math.sin(0.08 * t + 1)) - 450, int(760 + 120 * math.sin(0.1 * t)) - 450))
    return f


# ---------------------------------------------------------------- hablantes

def avatar_oro(d_im, cx, cy, e, t, activo):
    """Presentadora: núcleo dorado con anillos y barras radiales que siguen su voz."""
    capa = Image.new('RGBA', (420, 420), (0, 0, 0, 0))
    d = ImageDraw.Draw(capa)
    c = 210
    r0 = 62 + 8 * e
    for k in range(3):
        rr = r0 + 18 + k * 16 + 8 * e * (1 + k)
        d.ellipse((c - rr, c - rr, c + rr, c + rr), outline=ORO + (int((150 - 40 * k) * (0.5 + 0.5 * activo)),), width=3)
    rng = np.random.default_rng(int(t * FPS))
    for i in range(36):
        ang = i * math.tau / 36 + 0.15 * t
        largo = 8 + 50 * e * (0.4 + 0.6 * rng.random()) if activo else 6
        a1, a2 = r0 + 12, r0 + 12 + largo
        d.line((c + a1 * math.cos(ang), c + a1 * math.sin(ang), c + a2 * math.cos(ang), c + a2 * math.sin(ang)), fill=ORO + (230,), width=5)
    d.ellipse((c - r0, c - r0, c + r0, c + r0), fill=(46, 38, 14, 255), outline=ORO + (255,), width=5)
    d.text((c, c), 'P', font=fuente('ChakraPetch-Bold.ttf', 66), fill=ORO + (255,), anchor='mm')
    glow = capa.filter(ImageFilter.GaussianBlur(12))
    out = Image.new('RGBA', capa.size, (0, 0, 0, 0))
    out.alpha_composite(glow)
    out.alpha_composite(capa)
    d_im.alpha_composite(con_alfa(out, 0.55 + 0.45 * activo), (int(cx - c), int(cy - c)))


def avatar_cian(d_im, cx, cy, e, t, activo):
    """Claude: motor de anillos cian que gira más rápido y se expande cuando habla."""
    capa = Image.new('RGBA', (420, 420), (0, 0, 0, 0))
    d = ImageDraw.Draw(capa)
    c = 210
    R = 96 + 16 * e
    giro = t * (0.6 + 2.4 * e if activo else 0.3)
    d.ellipse((c - R, c - R, c + R, c + R), outline=CIAN + (150,), width=3)
    for i in range(60):
        ang = giro + i * math.tau / 60
        r1 = R - (16 if i % 5 == 0 else 8)
        d.line((c + r1 * math.cos(ang), c + r1 * math.sin(ang), c + R * math.cos(ang), c + R * math.sin(ang)), fill=CIAN + (220,), width=3 if i % 5 == 0 else 2)
    rm = R * 0.72
    for i in range(6):
        ini = math.degrees(-giro * 1.5 + i * math.tau / 6)
        d.arc((c - rm, c - rm, c + rm, c + rm), ini, ini + 38, fill=CIAN + (235,), width=9)
    rn = R * 0.38
    pts = [(c + rn * math.cos(giro * 0.5 + k * math.tau / 6), c + rn * math.sin(giro * 0.5 + k * math.tau / 6)) for k in range(6)]
    d.polygon(pts, outline=CIAN + (255,), fill=(6, 40, 52, 240), width=5)
    for k in range(6):
        ang = -giro * 0.35 + k * math.tau / 6
        f = (t * 0.9 + k / 6) % 1
        nx, ny = c + R * 1.18 * math.cos(ang), c + R * 1.18 * math.sin(ang)
        px, py = nx + (c - nx) * f, ny + (c - ny) * f
        d.ellipse((px - 5, py - 5, px + 5, py + 5), fill=ORO + (255,))
        d.ellipse((nx - 11, ny - 11, nx + 11, ny + 11), fill=(8, 16, 24, 255), outline=CIAN + (255,), width=3)
    glow = capa.filter(ImageFilter.GaussianBlur(14))
    out = Image.new('RGBA', capa.size, (0, 0, 0, 0))
    out.alpha_composite(glow)
    out.alpha_composite(glow)
    out.alpha_composite(capa)
    d_im.alpha_composite(con_alfa(out, 0.55 + 0.45 * activo), (int(cx - c), int(cy - c)))


def onda(d, x0, y0, ancho, alto, quien, t, color, activo):
    """Barras con la intensidad real de la voz en los últimos 2 segundos."""
    n = 40
    for i in range(n):
        tt = t - (n - 1 - i) * (2.0 / n)
        v = env(quien, tt)
        h = 4 + (alto - 4) * v
        x = x0 + i * (ancho / n)
        d.rounded_rectangle((x, y0 + (alto - h) / 2, x + ancho / n - 4, y0 + (alto + h) / 2), 2, fill=color + (int(110 + 140 * activo),))


@lru_cache(None)
def placa(nombre, sub, color):
    im = Image.new('RGBA', (240, 100), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.text((0, 4), nombre, font=fuente('ChakraPetch-Bold.ttf', 27), fill=color + (255,))
    for i, s in enumerate(sub.split('|')):
        d.text((0, 46 + i * 24), s, font=fuente('IBMPlexMono-Medium.ttf', 18), fill=MUT + (255,))
    return im


def hablantes(lienzo, t):
    quien, _ = hablando(t)
    d = ImageDraw.Draw(lienzo)
    for (q, y, nombre, sub, color) in (('P', 168, 'PRESENTADORA', 'anfitriona|voz sintética', ORO),
                                        ('A', 534, 'CLAUDE', 'agente de IA|voz sintética', CIAN)):
        activo = 1.0 if quien == q else 0.0
        d.rounded_rectangle((60, y, 580, y + 354), 26, fill=(15, 21, 33, 235),
                            outline=(color if activo else (44, 54, 70)) + (255,), width=3 if activo else 2)
        e = env(q, t)
        (avatar_oro if q == 'P' else avatar_cian)(lienzo, 210, y + 150, e, t, activo)
        lienzo.alpha_composite(placa(nombre, sub, color), (340, y + 34))
        onda(d, 340, y + 150, 210, 70, q, t, color, activo)
        if activo:
            p = 0.5 + 0.5 * math.sin(t * 6)
            d.ellipse((340, y + 252, 356, y + 268), fill=color + (int(140 + 115 * p),))
            d.text((366, y + 260), 'HABLANDO', font=fuente('IBMPlexMono-Medium.ttf', 20), fill=color + (255,), anchor='lm')


# ---------------------------------------------------------------- escenas del escenario

def esc_orbita(img, t, t0, t1, arg):
    fs = cuadros('orbita')
    i = int(((t - t0) * FPS * 0.9 + (hash(round(t0, 1)) % len(fs))) % len(fs))
    img.alpha_composite(cubrir(imagen(str(fs[i].relative_to(MEDIOS))), SW, SH, 1.02))
    etiqueta(img, 'MODELO 3D · CONFIGURADOR PARAMÉTRICO', CIAN)


def esc_noche(img, t, t0, t1, arg):
    fs = cuadros('noche')
    i = min(len(fs) - 1, int((t - t0) * FPS * 0.6))
    img.alpha_composite(cubrir(imagen(str(fs[i].relative_to(MEDIOS))), SW, SH, 1.0, 0.55))
    etiqueta(img, 'RENDER 3D CUADRO POR CUADRO', CIAN)


def etiqueta(img, s, color):
    f = fuente('IBMPlexMono-Medium.ttf', 22)
    tx = texto(s, f, color)
    caja = Image.new('RGBA', (tx.width + 24, tx.height + 6), (8, 12, 20, 210))
    caja.alpha_composite(tx, (12, 3))
    img.alpha_composite(caja, (24, 22))


PANTALLAS = ['obra/b0-inicio.png', 'obra/b1-presupuesto.png', 'obra/b4-planos.png', 'obra/b5-modelo.png', 'obra/b3-presupuesto.png', 'obra/b6-norma.png']


def esc_pantallas(img, t, t0, t1, arg):
    img.alpha_composite(cubrir(imagen('glamping/fijas/esc-noche.jpg'), SW, SH, 1.1).filter(ImageFilter.GaussianBlur(18)))
    img.alpha_composite(Image.new('RGBA', (SW, SH), BG + (170,)))
    base = int(t0 * 7) % len(PANTALLAS)
    for j, dx in enumerate((-380, 0, 380)):
        rel = PANTALLAS[(base + j) % len(PANTALLAS)]
        e = sale((t - t0 - 0.08 * j) / 0.4)
        y = SH / 2 + 30 + (1 - e) * 80 + 6 * math.sin(1.2 * t + j)
        pegar(img, tarjeta_rel(rel, 300), SW / 2 + dx, y, e, 1.06 if j == 1 else 0.96)
    etiqueta(img, 'AXIONA OBRA · obra.axionasoft.com', CIAN)


def esc_norma(img, t, t0, t1, arg):
    img.alpha_composite(Image.new('RGBA', (SW, SH), (16, 22, 34, 255)))
    pegar(img, tarjeta_rel('obra/b6-norma.png', 420), SW / 2 - 250, SH / 2 + 40 + 6 * math.sin(t), sale((t - t0) / 0.35))
    for i, (k, v) in enumerate((('RETIRO FRONTAL', '12 m'), ('ÍND. OCUPACIÓN', '0,4'), ('SUELO', '15 t/m²'))):
        e = sale((t - t0 - 0.3 - 0.2 * i) / 0.35)
        pegar(img, texto(k, fuente('IBMPlexMono-Medium.ttf', 26), MUT), SW / 2 + 300, 210 + i * 130, e)
        pegar(img, texto(v, fuente('ChakraPetch-Bold.ttf', 60), CIAN), SW / 2 + 300, 258 + i * 130, e)
    etiqueta(img, 'NORMA URBANÍSTICA · DATOS VERIFICADOS', CIAN)


def esc_planos(img, t, t0, t1, arg):
    img.alpha_composite(Image.new('RGBA', (SW, SH), (16, 22, 34, 255)))
    hojas = ['p1-planta', 'p2-fachadas', 'p3-cortes', 'p4-estructura', 'p5-cantidades', 'p6-implantacion']
    n = int((t - t0) / 0.9)
    for j in range(max(0, n - 2), n + 1):
        h = hojas[j % len(hojas)]
        d = n - j
        e = sale((t - t0 - j * 0.9) / 0.3)
        pegar(img, tarjeta_rel(f'glamping/ui/{h}.png', 820), SW / 2 + d * 30, SH / 2 + 20 - d * 26 + (1 - e) * 90, 1.0 if d == 0 else 0.55 - 0.2 * d)
    etiqueta(img, 'PLANOS PDF · DXF · GENERADOS POR EL MOTOR', CIAN)


def esc_topo(img, t, t0, t1, arg):
    img.alpha_composite(Image.new('RGBA', (SW, SH), (16, 22, 34, 255)))
    for j, (rel, dx) in enumerate((('topo/t6-plano.png', -230), ('topo/t7-holo.png', 230))):
        e = sale((t - t0 - 0.12 * j) / 0.4)
        pegar(img, tarjeta_rel(rel, 340), SW / 2 + dx, SH / 2 + 40 + (1 - e) * 70 + 5 * math.sin(t + j), e)
    etiqueta(img, 'AXIONA TOPO · ANÁLISIS DEL LOTE', CIAN)


def esc_consola(img, t, t0, t1, arg):
    img.alpha_composite(Image.new('RGBA', (SW, SH), (8, 11, 18, 255)))
    d = ImageDraw.Draw(img)
    for i, col in enumerate([(255, 95, 86), (255, 189, 46), (39, 201, 63)]):
        d.ellipse((30 + i * 34, 26, 50 + i * 34, 46), fill=col + (255,))
    d.text((150, 36), '$ npx vitest run   # Axiona Obra', font=fuente('IBMPlexMono-Medium.ttf', 28), fill=FG + (255,), anchor='lm')
    n = int((t - t0) / 0.18) + 1
    fm, fn = fuente('IBMPlexMono-Medium.ttf', 22), fuente('IBMPlexMono-Medium.ttf', 30)
    vis = PRUEBAS[max(0, min(n, len(PRUEBAS)) - 8):min(n, len(PRUEBAS))]
    for i, (g, nombre) in enumerate(vis):
        y = 96 + i * 66
        d.text((40, y), g, font=fm, fill=GRIS + (255,))
        d.text((40, y + 26), '✓', font=fuente('Inter-Bold.ttf', 30), fill=(46, 230, 160, 255))
        d.text((82, y + 26), nombre, font=fn, fill=FG + (255,))
    if n > len(PRUEBAS):
        d.rounded_rectangle((SW - 470, SH - 92, SW - 34, SH - 34), 16, fill=(10, 40, 32, 255), outline=(46, 230, 160, 255), width=2)
        d.text((SW - 252, SH - 63), 'Tests  185 passed (185)', font=fuente('IBMPlexMono-Medium.ttf', 28), fill=(46, 230, 160, 255), anchor='mm')
    etiqueta(img, 'PRUEBAS AUTOMÁTICAS DEL MOTOR DE CÁLCULO', CIAN)


def esc_finanzas(img, t, t0, t1, arg):
    img.alpha_composite(Image.new('RGBA', (SW, SH), (14, 19, 30, 255)))
    d = ImageDraw.Draw(img)
    d.text((60, 100), 'PRESUPUESTO REFERENCIAL', font=fuente('IBMPlexMono-Medium.ttf', 26), fill=MUT + (255,))
    e_total = sale((t - t0 - 0.2) / 0.5)
    d.text((60, 136), f'$ {TOTAL:,}'.replace(',', '.'), font=fuente('ChakraPetch-Bold.ttf', 76), fill=ORO + (int(255 * e_total),))
    pulso = 0.5 * (env('P', t) + env('A', t))
    mx = max(v for _, v in PRESUPUESTO)
    for i, (k, v) in enumerate(PRESUPUESTO):
        y = 268 + i * 82
        e = sale((t - t0 - 0.25 - 0.15 * i) / 0.6)
        largo = (SW - 720) * (v / mx) * e
        d.text((60, y + 26), k, font=fuente('Inter-SemiBold.ttf', 28), fill=FG + (255,), anchor='lm')
        d.rounded_rectangle((380, y + 4, 380 + max(6, largo), y + 48), 10, fill=CIAN + (int(150 + 100 * pulso),))
        if e > 0.98:
            d.text((390 + largo, y + 26), f'$ {v:,}'.replace(',', '.'), font=fuente('IBMPlexMono-Medium.ttf', 24), fill=FG + (255,), anchor='lm')
    d.text((60, SH - 46), 'Axiona Obra · mansión campestre Llano Grande · COP, referencial', font=fuente('IBMPlexMono-Medium.ttf', 20), fill=GRIS + (255,), anchor='lm')
    etiqueta(img, 'APU · COSTO DIRECTO · CANTIDADES', CIAN)


def esc_ruido(img, t, t0, t1, arg):
    img.alpha_composite(Image.new('RGBA', (SW, SH), (18, 14, 18, 255)))
    d = ImageDraw.Draw(img)
    titulares = ['¿EL FIN DE LOS OFICIOS?', 'ROBOTS POR TODAS PARTES', 'LA MÁQUINA VIENE POR TU EMPLEO', '¿QUÉ PASARÁ EN 2036?']
    for i, s in enumerate(titulares):
        e = sale((t - t0 - 0.25 * i) / 0.3)
        dx = (1 - e) * 120 + 4 * math.sin(t * 30 + i) * (1 if int(t * 6 + i) % 5 == 0 else 0)
        y = 120 + i * 130
        d.rounded_rectangle((70 + dx, y, SW - 70 + dx, y + 100), 14, fill=(40, 22, 28, int(230 * e)), outline=(255, 86, 104, int(200 * e)), width=2)
        d.text((100 + dx, y + 50), s, font=fuente('Inter-Black.ttf', 48), fill=(255, 210, 214, int(255 * e)), anchor='lm')
    etiqueta(img, 'EL RUIDO · TITULARES GENÉRICOS', (255, 86, 104))


def esc_superficie(img, t, t0, t1, arg):
    img.alpha_composite(Image.new('RGBA', (SW, SH), (16, 18, 24, 255)))
    d = ImageDraw.Draw(img)
    consulta = 'Escríbeme un correo para mi cliente…'
    k = int(len(consulta) * sale((t - t0 - 0.2) / 1.4))
    d.rounded_rectangle((140, 250, SW - 140, 350), 50, fill=(30, 34, 44, 255), outline=(70, 78, 92, 255), width=2)
    d.text((200, 300), consulta[:k] + ('|' if int(t * 2) % 2 else ''), font=fuente('Inter-SemiBold.ttf', 40), fill=MUT + (255,), anchor='lm')
    if t - t0 > 1.8:
        e = sale((t - t0 - 1.8) / 0.4)
        d.text((SW / 2, 470), 'Y AHÍ SE QUEDA', font=fuente('Inter-Black.ttf', 64), fill=GRIS + (int(255 * e),), anchor='mm')
    etiqueta(img, 'LA IA COMO BUSCADOR GLORIFICADO', GRIS)


def esc_manual(img, t, t0, t1, arg):
    img.alpha_composite(Image.new('RGBA', (SW, SH), (18, 20, 26, 255)))
    d = ImageDraw.Draw(img)
    tareas = ['Calcular a mano', 'Alinear líneas en un plano', 'Pelear con hojas de cálculo', 'Lidiar con la burocracia técnica']
    for i, s in enumerate(tareas):
        e = sale((t - t0 - 0.35 * i) / 0.35)
        y = 150 + i * 120
        d.text((140, y), f'{i + 1:02d}', font=fuente('ChakraPetch-Bold.ttf', 56), fill=GRIS + (int(255 * e),))
        d.text((260, y + 6), s, font=fuente('Inter-Bold.ttf', 50), fill=MUT + (int(255 * e),))
        tc = t0 + 0.35 * i + 1.1
        if t > tc:
            k = sale((t - tc) / 0.3)
            ancho = fuente('Inter-Bold.ttf', 50).getlength(s)
            d.line((255, y + 38, 255 + (ancho + 20) * k, y + 38), fill=CIAN + (255,), width=6)
    etiqueta(img, 'EL IMPUESTO DE FRICCIÓN · LO QUE ABSORBE LA MÁQUINA', CIAN)


def esc_balanza(img, t, t0, t1, arg):
    img.alpha_composite(Image.new('RGBA', (SW, SH), (14, 19, 30, 255)))
    d = ImageDraw.Draw(img)
    mitad = SW // 2
    d.line((mitad, 60, mitad, SH - 60), fill=(44, 54, 70, 255), width=2)
    for lado, (titulo, color, items) in enumerate((('LA MÁQUINA', CIAN, ['Costo directo', 'Metros cuadrados', 'Cumplimiento normativo', 'Planos y cantidades']),
                                                   ('EL HUMANO', ORO, ['Negociación', 'Acuerdos con proveedores', 'Lectura del cliente', 'Riesgo comercial']))):
        x = 70 + lado * mitad
        e = sale((t - t0 - 0.4 * lado) / 0.4)
        d.text((x, 90), titulo, font=fuente('Inter-Black.ttf', 56), fill=color + (int(255 * e),))
        d.text((x, 160), 'precisión matemática' if lado == 0 else 'criterio y conexiones', font=fuente('IBMPlexMono-Medium.ttf', 24), fill=MUT + (int(255 * e),))
        for i, s in enumerate(items):
            ei = sale((t - t0 - 0.4 * lado - 0.3 - 0.15 * i) / 0.3)
            y = 250 + i * 98
            d.rounded_rectangle((x, y, x + mitad - 140, y + 76), 16, fill=(20, 28, 42, int(255 * ei)), outline=color + (int(200 * ei),), width=2)
            d.text((x + 28, y + 38), s, font=fuente('Inter-Bold.ttf', 34), fill=FG + (int(255 * ei),), anchor='lm')
    etiqueta(img, 'LA MÁQUINA CALCULA · EL HUMANO DECIDE', ORO)


def esc_dilema(img, t, t0, t1, arg):
    img.alpha_composite(Image.new('RGBA', (SW, SH), (14, 19, 30, 255)))
    d = ImageDraw.Draw(img)
    for i, (s1, s2, color) in enumerate((('CONSTRUIR TUS', 'PROPIAS HERRAMIENTAS', CIAN), ('COMPETIR CONTRA', 'LA MÁQUINA', GRIS))):
        e = sale((t - t0 - 0.6 * i) / 0.4)
        y = 110 + i * 300
        d.rounded_rectangle((90, y, SW - 90, y + 230), 26, fill=(20, 28, 42, int(255 * e)), outline=color + (int(255 * e),), width=3)
        d.text((150, y + 70), s1, font=fuente('Inter-Black.ttf', 60), fill=color + (int(255 * e),), anchor='lm')
        d.text((150, y + 150), s2, font=fuente('Inter-Black.ttf', 60), fill=color + (int(255 * e),), anchor='lm')
        d.text((SW - 150, y + 115), '¿A?' if i == 0 else '¿B?', font=fuente('ChakraPetch-Bold.ttf', 80), fill=color + (int(160 * e),), anchor='rm')
    etiqueta(img, 'LA PREGUNTA PARA LA INDUSTRIA', CIAN)


def esc_pregunta(img, t, t0, t1, arg):
    img.alpha_composite(Image.new('RGBA', (SW, SH), (20, 17, 10, 255)))
    img.alpha_composite(cubrir(mancha(900, ORO, 0.25), SW, SH))
    d = ImageDraw.Draw(img)
    e = sale((t - T['frases']['p11']['ini'] + 0.1) / 0.5)
    for i, s in enumerate(('¿QUÉ OPINAN USTEDES,', 'LOS QUE LO VEN', 'DESDE AFUERA?')):
        d.text((SW / 2, 170 + i * 104), s, font=fuente('Inter-Black.ttf', 86), fill=(ORO if i == 2 else FG) + (int(255 * e),), anchor='mm')
    p12 = T['frases']['p12']['ini']
    if t >= p12:
        e2 = sale((t - p12) / 0.4)
        for j, (s, c) in enumerate((('¿Amenaza para su profesión?', MUT), ('¿O dirigir su propia flota de agentes?', CIAN))):
            d.text((SW / 2, 520 + j * 66), s, font=fuente('Inter-Bold.ttf', 44), fill=c + (int(255 * e2),), anchor='mm')
    m = marca('p12', 'Déjenlo')
    if t >= m:
        e3 = sale((t - m) / 0.3)
        d.rounded_rectangle((SW / 2 - 300, SH - 92, SW / 2 + 300, SH - 34), 28, fill=ORO + (int(255 * e3),))
        d.text((SW / 2, SH - 63), 'DÉJENLO EN LOS COMENTARIOS', font=fuente('IBMPlexMono-Medium.ttf', 28), fill=BG + (int(255 * e3),), anchor='mm')
    etiqueta(img, 'SU TURNO', ORO)


@lru_cache(None)
def logo(alto=84):
    im = Image.new('RGBA', (alto, alto), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    k = alto / 32
    gr = int(2.6 * k)
    d.arc((6 * k, 5 * k, 26 * k, 25 * k), 180, 360, fill=CIAN + (255,), width=gr)
    d.line((6 * k + gr / 2, 15 * k, 6 * k + gr / 2, 25 * k), fill=CIAN + (255,), width=gr)
    d.line((26 * k - gr / 2, 15 * k, 26 * k - gr / 2, 25 * k), fill=CIAN + (255,), width=gr)
    pal = texto('AXIONA', fuente('ChakraPetch-Bold.ttf', int(alto * 0.62)), FG)
    out = Image.new('RGBA', (alto + 20 + pal.width, alto), (0, 0, 0, 0))
    out.alpha_composite(im, (0, 0))
    out.alpha_composite(pal, (alto + 20, (alto - pal.height) // 2 + 4))
    return out


def esc_cierre(img, t, t0, t1, arg):
    img.alpha_composite(Image.new('RGBA', (SW, SH), (12, 17, 27, 255)))
    e = sale((t - t0) / 0.5)
    pegar(img, logo(96), SW / 2, 150, e)
    pegar(img, texto('PODCAST', fuente('IBMPlexMono-Medium.ttf', 34), ORO), SW / 2, 228, e)
    pegar(img, halo(texto('Sigan construyendo con criterio.', fuente('Inter-Black.ttf', 64), FG), CIAN, 14, 0.35), SW / 2, 340, sale((t - t0 - 0.4) / 0.5))
    for i, s in enumerate(('axionasoft.com  ·  WhatsApp +57 310 392 2935', 'Prueba gratis Axiona Obra: obra.axionasoft.com')):
        pegar(img, texto(s, fuente('IBMPlexMono-Medium.ttf', 30), CIAN if i else FG), SW / 2, 470 + i * 60, sale((t - t0 - 0.8 - 0.2 * i) / 0.4))
    pegar(img, texto('PRIMERO SE CONSTRUYE EN CÓDIGO · DESPUÉS, EN OBRA', fuente('Inter-Bold.ttf', 28), ORO), SW / 2, 620, sale((t - t0 - 1.4) / 0.4))


def esc_titulo2(img, t, t0, t1, arg):
    esc_orbita(img, t, t0, t1, arg)
    img.alpha_composite(Image.new('RGBA', (SW, SH), BG + (120,)))
    pegar(img, halo(texto('EL PROPÓSITO', fuente('Inter-Black.ttf', 110), FG), CIAN, 18, 0.4), SW / 2, SH / 2 - 60, sale((t - t0) / 0.5))
    pegar(img, halo(texto('Y EL PARA QUÉ', fuente('Inter-Black.ttf', 110), ORO), ORO, 18, 0.4), SW / 2, SH / 2 + 70, sale((t - t0 - 0.2) / 0.5))


@lru_cache(None)
def ajustar(nombre, s, maximo):
    """El tamaño más grande (hasta `maximo`) con el que `s` cabe en el escenario con margen."""
    tam = maximo
    while tam > 40 and fuente(nombre, tam).getlength(s) > SW - 140:
        tam -= 4
    return tam


def esc_palabra(img, t, t0, t1, arg):
    s, _, estilo = arg.partition('|')
    color = {'oro': ORO, 'gris': MUT}.get(estilo, CIAN)
    img.alpha_composite(Image.new('RGBA', (SW, SH), (13, 18, 29, 255)))
    img.alpha_composite(cubrir(mancha(800, color, 0.16), SW, SH))
    d = ImageDraw.Draw(img)
    # líneas de código que corren de fondo
    fm = fuente('IBMPlexMono-Medium.ttf', 18)
    for i in range(14):
        y = (i * 52 + (t - t0) * 90) % SH
        d.text((40 + (i * 137) % 600, y), CODIGO[i % len(CODIGO)], font=fm, fill=(40, 52, 70, 255))
    escribir = 0.55
    k = sale((t - t0) / escribir)
    n = max(1, int(len(s) * k))
    if t - t0 < escribir:
        tm = ajustar('IBMPlexMono-Medium.ttf', s + '▌', 76)
        tx = texto(s[:n] + '▌', fuente('IBMPlexMono-Medium.ttf', tm), color)
        pegar(img, tx, SW / 2, SH / 2)
    else:
        tam = ajustar('Inter-Black.ttf', s, 132)
        e = sale((t - t0 - escribir) / 0.25)
        tx = halo(texto(s, fuente('Inter-Black.ttf', tam), color), color, 18, 0.45)
        pegar(img, tx, SW / 2, SH / 2, e, 0.94 + 0.06 * e + 0.01 * (t - t0))


CODIGO = ['const presupuesto = apu(cantidades, precios);', 'if (!cabe(piscina, lote)) avisar("no cabe");', 'norma.retiroFrontal >= 12 // m',
          'estado = normalizarEstado(entrada);', 'planos.exportar("dxf");', 'expect(casa).toEqual(casaGirada);',
          'agente.ejecutar(intencion)', 'costoDirecto + aiu + iva', 'for (const espacio of programa) ubicar(espacio);']

ESCENAS = {'orbita': esc_orbita, 'noche': esc_noche, 'pantallas': esc_pantallas, 'norma': esc_norma, 'planos': esc_planos,
           'topo': esc_topo, 'consola': esc_consola, 'finanzas': esc_finanzas, 'ruido': esc_ruido, 'superficie': esc_superficie,
           'manual': esc_manual, 'balanza': esc_balanza, 'dilema': esc_dilema, 'pregunta': esc_pregunta, 'cierre': esc_cierre,
           'titulo2': esc_titulo2, 'palabra': esc_palabra}


def armar_segmentos():
    """Reparte cada frase en tomas de 3 a 4 s (o en las palabras marcadas con @)."""
    seg = []
    claves = list(T['frases'].keys())
    for n, clave in enumerate(claves):
        f = T['frases'][clave]
        ini = f['ini'] - 0.2
        fin = T['frases'][claves[n + 1]]['ini'] - 0.2 if n + 1 < len(claves) else T['dur']
        partes, actual, cortes = [], [], [ini]
        for x in GUION[clave]:
            if x.startswith('@'):
                cortes.append(marca(clave, x[1:]) - 0.1)
                partes.append(actual)
                actual = []
            else:
                actual.append(x)
        partes.append(actual)
        cortes.append(fin)
        for p, (a, b) in zip(partes, zip(cortes, cortes[1:])):
            if not p:
                continue
            k = max(len(p), round((b - a) / 3.6))
            lista = (p * k)[:k] if len(p) >= k or len(p) > 1 or p[0] in ('pregunta', 'cierre', 'dilema', 'balanza') else \
                [p[0]] + [r for r in RELLENO if r != p[0]][:k - 1]
            if len(lista) < k:
                lista = (lista * k)[:k]
            paso = (b - a) / k
            for i, esc in enumerate(lista):
                seg.append((a + i * paso, a + (i + 1) * paso, esc))
    return seg


def escenario(lienzo, t):
    if t < T['frases']['p1']['ini'] - 0.2:
        return
    actual = previo = None
    for i, (a, b, esc) in enumerate(SEGMENTOS):
        if a <= t < b:
            actual = (a, b, esc)
            previo = SEGMENTOS[i - 1] if i else None
            break
    if not actual:
        actual = SEGMENTOS[-1]
    img = dibujar(actual, t)
    a = actual[0]
    if previo and t - a < 0.25:  # transición: lo anterior sale mientras lo nuevo entra con un leve zoom
        k = sale((t - a) / 0.25)
        img_prev = dibujar(previo, t)
        img = Image.blend(img_prev, img, k)
    m = Image.new('L', (SW, SH), 0)
    ImageDraw.Draw(m).rounded_rectangle((0, 0, SW - 1, SH - 1), 28, fill=255)
    img.putalpha(m)
    lienzo.alpha_composite(img, (SX, SY))
    ImageDraw.Draw(lienzo).rounded_rectangle((SX, SY, SX + SW - 1, SY + SH - 1), 28, outline=(52, 66, 86, 255), width=2)


def dibujar(seg, t):
    a, b, esc = seg
    tipo, _, arg = esc.partition(':')
    img = Image.new('RGBA', (SW, SH), BG + (255,))
    ESCENAS[tipo](img, t, a, b, arg)
    return img


# ---------------------------------------------------------------- marco, subtítulos y apertura

def barra(lienzo, t):
    lienzo.alpha_composite(logo(52), (60, 54))
    d = ImageDraw.Draw(lienzo)
    d.text((262, 80), 'PODCAST', font=fuente('IBMPlexMono-Medium.ttf', 26), fill=ORO + (255,), anchor='lm')
    d.text((SX, 80), 'El propósito y el para qué', font=fuente('Inter-Bold.ttf', 34), fill=FG + (255,), anchor='lm')
    bloque = None
    for k, (a, b) in T['bloques'].items():
        if a <= t < b + 0.95:
            bloque = k
    if bloque:
        s = BLOQUES[bloque]
        f = fuente('IBMPlexMono-Medium.ttf', 22)
        ancho = f.getlength(s) + 36
        d.rounded_rectangle((SX + SW - ancho, 62, SX + SW, 100), 19, fill=(14, 22, 34, 255), outline=CIAN + (200,), width=2)
        d.text((SX + SW - ancho / 2, 81), s, font=f, fill=CIAN + (255,), anchor='mm')


def trozos():
    salida = []
    for k, f in T['frases'].items():
        palabras, lineas, actual = f['lee'].split(' '), [], ''
        for p in palabras:
            if len(actual) + len(p) + 1 > 62 and actual:
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
            fin = f['ini'] + f['dur'] * acum / total if i < len(lineas) - 1 else f['ini'] + f['dur'] + 0.15
            salida.append((ini, fin, s, f['hablante']))
    return salida


@lru_cache(512)
def sprite_sub(s, quien):
    f = fuente('Inter-Bold.ttf', 38)
    color = ORO if quien == 'P' else CIAN
    nombre = 'PRESENTADORA' if quien == 'P' else 'CLAUDE'
    fn = fuente('IBMPlexMono-Medium.ttf', 22)
    ancho = int(f.getlength(s) + fn.getlength(nombre) + 110)
    im = Image.new('RGBA', (ancho, 76), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.rounded_rectangle((0, 0, ancho - 1, 75), 22, fill=(8, 12, 20, 232))
    d.text((26, 38), nombre, font=fn, fill=color + (255,), anchor='lm')
    d.text((26 + fn.getlength(nombre) + 30, 38), s, font=f, fill=FG + (255,), anchor='lm')
    return im


def subtitulos(lienzo, t):
    for ini, fin, s, quien in SUBS:
        if ini <= t < fin:
            im = sprite_sub(s, quien)
            if im.width > W - 80:
                im = im.resize((W - 80, int(im.height * (W - 80) / im.width)), Image.LANCZOS)
            lienzo.alpha_composite(con_alfa(im, sale((t - ini) / 0.1)), (int(W / 2 - im.width / 2), 940))
    d = ImageDraw.Draw(lienzo)
    d.text((W - 60, H - 30), 'Voces sintéticas · guion de Axiona escrito con Claude (Anthropic)', font=fuente('IBMPlexMono-Medium.ttf', 18), fill=GRIS + (255,), anchor='rm')


def apertura(lienzo, t):
    """Antes de la primera frase: título con efecto de máquina de escribir."""
    ini = T['frases']['p1']['ini']
    if t >= ini:
        return
    s1, s2 = 'AXIONA PODCAST', 'El propósito y el para qué'
    e = sale(t / 0.6)
    k = int(len(s2) * lim((t - 0.6) / 1.2))
    pegar(lienzo, halo(texto(s1, fuente('ChakraPetch-Bold.ttf', 120), FG), CIAN, 20, 0.5), W / 2, H / 2 - 90, e * (1 - sale((t - ini + 0.4) / 0.4)))
    tx = texto(s2[:max(0, k)] + ('▌' if k < len(s2) else ''), fuente('IBMPlexMono-Medium.ttf', 64), ORO)
    pegar(lienzo, tx, W / 2, H / 2 + 40, 1 - sale((t - ini + 0.4) / 0.4))


def cuadro(t):
    lienzo = fondo(t)
    if t < T['frases']['p1']['ini']:
        apertura(lienzo, t)
        return lienzo.convert('RGB')
    barra(lienzo, t)
    hablantes(lienzo, t)
    escenario(lienzo, t)
    subtitulos(lienzo, t)
    return lienzo.convert('RGB')


# ---------------------------------------------------------------- música ambiental

def musica(ruta, dur, sr=48000):
    """Fondo tranquilo: acordes largos (La menor, Fa, Do, Sol) y un pulso suave."""
    n = int(dur * sr)
    t = np.arange(n) / sr
    nota = lambda m: 440 * 2 ** ((m - 69) / 12)
    acordes = [(45, 57, 60, 64), (41, 53, 57, 60), (48, 55, 60, 64), (43, 55, 59, 62)]
    largo = 8.0
    izq, der = np.zeros(n), np.zeros(n)
    for k in range(int(dur / largo) + 1):
        a = k * largo
        i0, i1 = int(a * sr), min(n, int((a + largo + 2) * sr))
        tt = t[i0:i1] - a
        envlp = np.minimum(1, tt / 2.0) * np.clip((largo + 2 - tt) / 2.0, 0, 1)
        for j, m in enumerate(acordes[k % 4]):
            f = nota(m)
            izq[i0:i1] += envlp * np.sin(2 * np.pi * f * tt + j) / 4
            der[i0:i1] += envlp * np.sin(2 * np.pi * f * 1.004 * tt + j * 1.3) / 4
    pulso = 0.5 + 0.5 * np.sin(2 * np.pi * t * (100 / 60) / 2) ** 8
    est = np.stack([izq * (0.8 + 0.2 * pulso), der * (0.8 + 0.2 * pulso)], axis=1)
    fade = np.ones(n)
    fade[:int(2 * sr)] = np.linspace(0, 1, int(2 * sr))
    fade[-int(3 * sr):] = np.linspace(1, 0, int(3 * sr))
    est *= fade[:, None]
    est /= np.abs(est).max() / 0.8
    with wave.open(str(ruta), 'wb') as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(sr)
        w.writeframes((est * 32767).astype('<i2').tobytes())


# ---------------------------------------------------------------- render

def preparar(medios, tiempos):
    global MEDIOS, T, SEGMENTOS, SUBS
    MEDIOS = Path(medios)
    T = tiempos
    SEGMENTOS = armar_segmentos()
    SUBS = trozos()


def tramo(args):
    a, b, ruta, medios, tiempos = args
    preparar(medios, tiempos)
    proc = subprocess.Popen([FF, '-y', '-v', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{W}x{H}', '-r', str(FPS),
                             '-i', '-', '-c:v', 'libx264', '-preset', 'medium', '-crf', '20', '-profile:v', 'high',
                             '-level', '4.1', '-pix_fmt', 'yuv420p', '-g', str(FPS * 2), str(ruta)], stdin=subprocess.PIPE)
    for k in range(a, b):
        proc.stdin.write(cuadro(k / FPS).tobytes())
    proc.stdin.close()
    if proc.wait():
        raise SystemExit('ffmpeg falló en un tramo')
    return ruta


def render(salida, voz, medios, tiempos, procesos=4):
    total = int(round(tiempos['dur'] * FPS))
    with tempfile.TemporaryDirectory() as tmp:
        tmp = Path(tmp)
        cortes = np.linspace(0, total, procesos * 2 + 1).astype(int)
        partes = [(int(a), int(b), tmp / f'tramo{k:02d}.mp4', medios, tiempos) for k, (a, b) in enumerate(zip(cortes, cortes[1:]))]
        with Pool(procesos) as pool:
            hechos = pool.map(tramo, partes)
        (tmp / 'lista.txt').write_text(''.join(f"file '{p}'\n" for p in hechos))
        subprocess.run([FF, '-y', '-v', 'error', '-f', 'concat', '-safe', '0', '-i', str(tmp / 'lista.txt'), '-c', 'copy', str(tmp / 'video.mp4')], check=True)
        musica(tmp / 'musica.wav', tiempos['dur'])
        subprocess.run([FF, '-y', '-v', 'error', '-i', str(tmp / 'video.mp4'), '-i', str(tmp / 'musica.wav'), '-i', str(voz),
                        '-filter_complex',
                        '[1:a]aresample=48000,volume=0.16[m];'
                        '[2:a]aresample=48000,highpass=f=80,acompressor=threshold=0.1:ratio=3:attack=5:release=120,'
                        'pan=stereo|c0=c0|c1=c0,asplit=2[v][vs];'
                        '[m][vs]sidechaincompress=threshold=0.03:ratio=5:attack=20:release=400[md];'
                        '[md][v]amix=inputs=2:normalize=0,loudnorm=I=-16:TP=-1.5:LRA=11,alimiter=limit=0.84:level=false[a]',
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
