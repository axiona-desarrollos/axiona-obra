#!/usr/bin/env python3
"""Reel «Esto no es una app»: el sistema de una empresa de glamping, a su medida.

Vertical 1080 × 1920 a 30 fps para Instagram, TikTok y Shorts. Las escenas
duran lo que su locución (voz.py). Usa tomas reales de la demo
glamping-axiona.netlify.app (tomas.cjs, ui.cjs, ui2.cjs: render 3D cuadro por
cuadro y pantallas de la interfaz) y la grabación de la Casa Envigado sin la
franja con el nombre del cliente. El fondo, los textos y la música son los de
los otros videos de Axiona (../../servicio-redes/generador/promo.py).

Uso: AXIONA_FUENTES=… python3 video.py SALIDA.mp4 --tomas DIR --tiempos tiempos.json --voz voz.wav [--cuadros 2,8]
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

TOMAS = Path('.')
E, F, PIEZAS, SUBS = {}, {}, None, []
WHATSAPP = 'WhatsApp +57 310 392 2935'


def fr(k, extra=0.0):
    return F[k]['ini'] + extra


def fin_fr(k):
    return F[k]['ini'] + F[k]['dur']


def marca(k, palabras):
    """Instante aproximado en que la voz dice `palabras` dentro de la frase k."""
    lee = F[k]['lee']
    i = lee.find(palabras)
    assert i >= 0, (k, palabras)
    return F[k]['ini'] + F[k]['dur'] * i / len(lee)


# ---------------------------------------------------------------- imágenes

@lru_cache(64)
def imagen(rel):
    return Image.open(TOMAS / rel).convert('RGBA')


@lru_cache(None)
def cuenta(carpeta):
    return len(list((TOMAS / carpeta).glob('*.jpg')))


def cuadro_de(carpeta, i):
    n = cuenta(carpeta)
    i = max(0, min(n - 1, int(i)))
    nombres = sorted((TOMAS / carpeta).glob('*.jpg'))
    return imagen(str(nombres[i].relative_to(TOMAS)))


def lleno(lienzo, im, k=1.0):
    """Pinta la imagen a pantalla completa, ampliada k veces desde el centro."""
    s = max(W / im.width, H / im.height) * k
    cw, ch = W / s, H / s
    x0, y0 = (im.width - cw) / 2, (im.height - ch) / 2
    rec = im.resize((W, H), Image.BICUBIC, box=(x0, y0, x0 + cw, y0 + ch))
    lienzo.alpha_composite(rec)


def golpe(t, t0, fuerza=0.07):
    """Pequeño zoom que se asienta al entrar un corte."""
    return 1 + fuerza * (1 - sale((t - t0) / 0.28))


@lru_cache(16)
def desenfocado(rel, oscuro=0.42):
    im = imagen(rel).convert('RGB')
    peq = im.resize((im.width // 6, im.height // 6), Image.BILINEAR).filter(ImageFilter.GaussianBlur(6))
    peq = Image.eval(peq, lambda v: int(v * oscuro))
    s = max(W / peq.width, H / peq.height)
    return peq.resize((math.ceil(peq.width * s), math.ceil(peq.height * s)), Image.BICUBIC).crop((0, 0, W, H)).convert('RGBA')


def fondo_borroso(lienzo, rel):
    lienzo.alpha_composite(desenfocado(rel))


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


@lru_cache(32)
def celular(rel, ancho=600):
    """Pantalla real dentro de un marco de celular."""
    im = imagen(rel)
    alto = round(ancho * im.height / im.width)
    rec = im.resize((ancho, alto), Image.LANCZOS)
    m = Image.new('L', rec.size, 0)
    ImageDraw.Draw(m).rounded_rectangle((0, 0, ancho - 1, alto - 1), 36, fill=255)
    rec.putalpha(m)
    p = panel(ancho + 24, alto + 24, radio=48, borde=(70, 86, 104), opaco=255)
    p.alpha_composite(rec, (52, 52))
    return p


@lru_cache(32)
def tarjeta_img(rel, ancho):
    im = imagen(rel)
    alto = round(ancho * im.height / im.width)
    rec = im.resize((ancho, alto), Image.LANCZOS)
    m = Image.new('L', rec.size, 0)
    ImageDraw.Draw(m).rounded_rectangle((0, 0, ancho - 1, alto - 1), 22, fill=255)
    rec.putalpha(m)
    p = panel(ancho + 8, alto + 8, radio=26, borde=(70, 86, 104), opaco=255)
    p.alpha_composite(rec, (44, 44))
    return p


def pegar(lienzo, im, cx, y, a=1.0, k=1.0):
    if a <= 0.01:
        return
    if abs(k - 1) > 1e-3:
        im = im.resize((max(1, int(im.width * k)), max(1, int(im.height * k))), Image.BICUBIC)
    lienzo.alpha_composite(con_alfa(im, min(1.0, a)), (int(cx - im.width / 2), int(y)))


def entra_sale(t, t0, t1, ent=0.35, sal=0.3):
    return sale((t - t0) / ent) * (1 - suave((t - (t1 - sal)) / sal))


@lru_cache(64)
def chip(s, color=CIAN, tam=34):
    f = fuente('IBMPlexMono-Medium.ttf', tam)
    t = texto(s, f, color, esp=2)
    im = Image.new('RGBA', (t.width + 40, t.height + 16), (0, 0, 0, 0))
    ImageDraw.Draw(im).rounded_rectangle((0, 0, im.width - 1, im.height - 1), 20, fill=(8, 16, 24, 235), outline=color + (190,), width=2)
    im.alpha_composite(t, (20, 8))
    return im


@lru_cache(64)
def titulo(s, color=FG, tam=120, halo=None):
    im = texto(s, fuente('ChakraPetch-Bold.ttf', tam), color)
    sombra = Image.new('RGBA', (im.width + 80, im.height + 80), (0, 0, 0, 0))
    a = Image.new('L', sombra.size, 0)
    a.paste(im.getchannel('A'), (40, 46))
    sombra.putalpha(a.filter(ImageFilter.GaussianBlur(14)).point(lambda v: int(v * 0.8)))
    if halo:
        im = brillo(im, halo, 18, 0.5)
    sombra.alpha_composite(im, ((sombra.width - im.width) // 2, (sombra.height - im.height) // 2 - 6))
    return sombra


def lineas(lienzo, t, items, t0, t1, y0, paso, escalon=0.12):
    """items: [(texto, color, tamaño)] que entran escalonados y salen juntos."""
    for i, (s, c, tam) in enumerate(items):
        ini = t0 + escalon * i
        a = entra_sale(t, ini, t1)
        if t < ini or t >= t1:
            continue
        pegar(lienzo, titulo(s, c, tam), W / 2, y0 + i * paso + (1 - sale((t - ini) / 0.35)) * 40, a)


# ---------------------------------------------------------------- escenas

def gancho(lienzo, t):
    a, b = E['gancho']
    if not (a <= t < b + 0.001):
        return False
    n = cuenta('heroe')
    if t * FPS < n:
        lleno(lienzo, cuadro_de('heroe', t * FPS))
    else:
        lleno(lienzo, cuadro_de('heroe', n - 1), 1 + 0.025 * (t - n / FPS))
    sombras(lienzo)
    lineas(lienzo, t, [('ESTO NO ES', FG, 132), ('UNA APP.', CIAN, 150)], -0.5, fr('g2'), 250, 165, escalon=0.0)
    lineas(lienzo, t, [('ES EL SISTEMA', FG, 92), ('COMPLETO DE', FG, 92), ('UNA EMPRESA', FG, 92), ('DE GLAMPING', CIAN, 104)], fr('g2'), b + 0.2, 190, 110)
    if t >= marca('g2', 'hecho'):
        pegar(lienzo, chip('HECHO A SU MEDIDA', AMBAR, 38), W / 2, 680, entra_sale(t, marca('g2', 'hecho'), b + 0.2))
    return True


FIJAS = {
    'modelo': [('modelo-suite', 'Arco Suite XL'), ('modelo-capsula', 'Cápsula Torre'), ('modelo-arco', 'Arco Panorámico')],
    'acabado': [('acabado-nogal', 'Nogal'), ('acabado-frp', 'FRP'), ('acabado-grafito', 'Grafito')],
    'escenario': [('esc-manana', 'Mañana'), ('esc-bosque', 'Claro de bosque'), ('esc-noche', 'Noche')],
}


def configura(lienzo, t):
    a, b = E['configura']
    if not (a <= t < b):
        return False
    m1, m2, m3 = marca('c1', 'el modelo'), marca('c1', 'el acabado'), marca('c1', 'y el escenario')
    if t < m1:
        fondo_borroso(lienzo, 'heroe/0107.jpg' if (TOMAS / 'heroe/0107.jpg').exists() else 'fijas/modelo-arco.jpg')
        pegar(lienzo, chip('LA WEB DE LA EMPRESA'), W / 2, 150, entra_sale(t, a, m1 + 0.2))
        pegar(lienzo, celular('ui/m1-modelos.png'), W / 2, 230 + (1 - sale((t - a) / 0.45)) * 70 + 5 * math.sin(1.3 * t), entra_sale(t, a, m1 + 0.2, 0.4, 0.15))
        return True
    for (t0, t1, grupo) in ((m1, m2, 'modelo'), (m2, m3, 'acabado'), (m3, b, 'escenario')):
        if t0 <= t < t1:
            paso = (t1 - t0) / 3
            i = min(2, int((t - t0) / paso))
            nombre, rotulo = FIJAS[grupo][i]
            ti = t0 + i * paso
            lleno(lienzo, imagen(f'fijas/{nombre}.jpg'), golpe(t, ti) * (1 + 0.02 * (t - ti)))
            sombras(lienzo, 520, 520)
            pegar(lienzo, chip(grupo.upper(), CIAN, 36), W / 2, 170)
            pegar(lienzo, titulo(rotulo, FG, 96), W / 2, 230 + (1 - sale((t - ti) / 0.2)) * 18)
    return True


def recalcula(lienzo, t):
    a, b = E['recalcula']
    if not (a <= t < b):
        return False
    fondo_borroso(lienzo, 'fijas/acabado-grafito.jpg')
    r2 = fr('r2')
    mp, ml = marca('r2', 'el presupuesto'), marca('r2', 'y 10 planos')
    if t < r2:
        # medida: 4,40 → 5,20 m
        mitad = a + (r2 - a) * 0.45
        y = 250 + (1 - sale((t - a) / 0.45)) * 70
        pegar(lienzo, chip('ANCHO  4,40 m  →  5,20 m', AMBAR, 36), W / 2, 150, entra_sale(t, a, r2 + 0.1))
        pegar(lienzo, celular('ui/m3-medidas-440.png'), W / 2, y)
        if t >= mitad:
            pegar(lienzo, celular('ui/m4-medidas-520.png'), W / 2, y, sale((t - mitad) / 0.3))
        return True
    if t < ml:
        # ficha y presupuesto recalculados
        pegar(lienzo, chip('FICHA TÉCNICA Y PRESUPUESTO'), W / 2, 150, entra_sale(t, r2, ml + 0.1))
        y = 240 + (1 - sale((t - r2) / 0.4)) * 60
        pegar(lienzo, tarjeta_ficha('4.40'), W / 2, y)
        cambio = r2 + 0.35
        if t >= cambio:
            pegar(lienzo, tarjeta_ficha('5.20'), W / 2, y, sale((t - cambio) / 0.35))
        # los dos totales reales, sin cifras intermedias
        if t >= mp:
            e = entra_sale(t, mp, ml + 0.1)
            pegar(lienzo, texto('4,40 m:  $ 186.887.637', fuente('IBMPlexMono-Medium.ttf', 38), MUT), W / 2, 1360, e)
            pegar(lienzo, titulo('5,20 m:  $ 206.971.179', AMBAR, 70), W / 2, 1400, e)
        return True
    hojas = ['p1-planta', 'p2-fachadas', 'p3-cortes', 'p4-estructura', 'p5-cantidades', 'p6-implantacion']
    paso = (b - ml) / len(hojas)
    i = min(len(hojas) - 1, int((t - ml) / paso))
    ti = ml + i * paso
    pegar(lienzo, chip('10 LÁMINAS · PDF · DXF'), W / 2, 260)
    for j in range(max(0, i - 2), i + 1):  # pila de láminas
        d = i - j
        pegar(lienzo, tarjeta_img(f'ui/{hojas[j]}.png', 960), W / 2, 520 + d * -34 + (0 if d else (1 - sale((t - ti) / 0.25)) * 120),
              1.0 if d == 0 else 0.55 - 0.2 * d, 1 - 0.04 * d)
    return True


@lru_cache(4)
def tarjeta_ficha(clave, ancho=860):
    """Ficha técnica y presupuesto con los datos reales que leyó ui3.cjs; resalta lo que cambió."""
    datos = json.loads((TOMAS / 'ui' / 'ficha.json').read_text())
    f, base = datos[clave], datos['4.40']
    filas = [d for d in f['datos'] if d[0] != 'Transporte'][:8]
    previo = dict(base['datos'])
    costo = f['costo']
    total, partidas = costo[0], list(zip(costo[1:-1:2], costo[2:-1:2]))[:5]
    previo_c = dict(zip(base['costo'][1:-1:2], base['costo'][2:-1:2]))
    alto = 120 + len(filas) * 54 + 110 + 110 + len(partidas) * 50 + 70
    im = panel(ancho, alto, radio=34, borde=(58, 76, 96), opaco=246)
    d = ImageDraw.Draw(im)
    x0, x1, y = 40 + 50, 40 + ancho - 50, 40 + 60
    fm, fv = fuente('Inter-SemiBold.ttf', 34), fuente('Inter-Bold.ttf', 34)
    d.text((x0, y), 'FICHA TÉCNICA', font=fuente('IBMPlexMono-Medium.ttf', 32), fill=CIAN + (255,), anchor='lm')
    y += 64
    for etiqueta, valor in filas:
        cambia = clave != '4.40' and previo.get(etiqueta) != valor
        d.text((x0, y), etiqueta, font=fm, fill=MUT + (255,), anchor='lm')
        d.text((x1, y), valor, font=fv, fill=(AMBAR if cambia else FG) + (255,), anchor='rm')
        y += 54
    y += 40
    d.text((x0, y), 'PRESUPUESTO REFERENCIAL', font=fuente('IBMPlexMono-Medium.ttf', 32), fill=CIAN + (255,), anchor='lm')
    y += 74
    d.text((x0, y), total, font=fuente('ChakraPetch-Bold.ttf', 76), fill=(AMBAR if clave != '4.40' else FG) + (255,), anchor='lm')
    y += 84
    for etiqueta, valor in partidas:
        cambia = clave != '4.40' and previo_c.get(etiqueta) != valor
        d.text((x0, y), etiqueta, font=fm, fill=MUT + (255,), anchor='lm')
        d.text((x1, y), valor, font=fv, fill=(AMBAR if cambia else FG) + (255,), anchor='rm')
        y += 50
    d.text((x0, y + 20), 'COP referencial, sin IVA ni lote.', font=fuente('Inter-SemiBold.ttf', 26), fill=MUT + (255,), anchor='lm')
    return im


def lote(lienzo, t):
    a, b = E['lote']
    if not (a <= t < b):
        return False
    corte = a + 1.45
    n = cuenta('interior')
    if t < corte:
        fondo_borroso(lienzo, 'fijas/esc-bosque.jpg')
        pegar(lienzo, chip('VER EN MI LOTE · REALIDAD AUMENTADA'), W / 2, 150)
        pegar(lienzo, celular('ui/u11-ar.png'), W / 2, 230 + (1 - sale((t - a) / 0.4)) * 70)
        return True
    vel = (n / FPS) / max(0.1, b - corte)
    lleno(lienzo, cuadro_de('interior', (t - corte) * vel * FPS))
    sombras(lienzo, 420, 520)
    pegar(lienzo, chip('RECORRIDO POR DENTRO'), W / 2, 150, entra_sale(t, corte, b + 0.2))
    return True


def constructora(lienzo, t):
    a, b = E['constructora']
    if not (a <= t < b):
        return False
    i = (t - a) * FPS
    im = cuadro_de('casa', i)
    lleno(lienzo, im.filter(ImageFilter.GaussianBlur(3)).resize((im.width // 6, im.height // 6)).filter(ImageFilter.GaussianBlur(5)), 1.0)
    lienzo.alpha_composite(Image.new('RGBA', (W, H), (6, 9, 13, 150)))
    ancho = 600
    alto = round(ancho * im.height / im.width)
    rec = im.resize((ancho, alto), Image.LANCZOS)
    m = Image.new('L', rec.size, 0)
    ImageDraw.Draw(m).rounded_rectangle((0, 0, ancho - 1, alto - 1), 36, fill=255)
    rec.putalpha(m)
    p = panel(ancho + 24, alto + 24, radio=48, borde=(70, 86, 104), opaco=255)
    p.alpha_composite(rec, (52, 52))
    pegar(lienzo, chip('PARA UNA CONSTRUCTORA', MENTA), W / 2, 120, entra_sale(t, a, b + 0.3))
    pegar(lienzo, p, W / 2, 190 + (1 - sale((t - a) / 0.45)) * 70, entra_sale(t, a, b + 0.3, 0.35, 0.2))
    return True


NODOS = ['LA WEB QUE VE TU CLIENTE', 'CONFIGURADOR 3D', 'FICHA Y COTIZACIÓN', 'PLANOS PDF · DXF', 'REALIDAD AUMENTADA', 'LA OBRA']


@lru_cache(None)
def nodo(i, s):
    f = fuente('Inter-ExtraBold.ttf', 46)
    w, h = 820, 112
    im = panel(w, h, radio=30, borde=(52, 72, 94), opaco=238)
    d = ImageDraw.Draw(im)
    c = (40 + 66, 40 + h // 2)
    color = AMBAR if i == len(NODOS) - 1 else CIAN
    d.ellipse((c[0] - 30, c[1] - 30, c[0] + 30, c[1] + 30), outline=color + (255,), width=4)
    d.text(c, str(i + 1), font=fuente('ChakraPetch-Bold.ttf', 36), fill=color + (255,), anchor='mm')
    d.text((40 + 130, 40 + h // 2), s, font=f, fill=FG + (255,), anchor='lm')
    return im


def sistema(lienzo, t):
    a, b = E['sistema']
    if not (a <= t < b):
        return False
    s2 = fr('s2')
    n = cuenta('noche')
    if t < s2:
        i = (t - a) * FPS
        lleno(lienzo, cuadro_de('noche', i), 1 + (0.02 * (t - a - n / FPS) if i >= n else 0))
        sombras(lienzo, 700, 420)
        lineas(lienzo, t, [('CADA EMPRESA', FG, 112), ('NECESITA ALGO', FG, 112), ('DISTINTO', AMBAR, 128)], a + 0.15, s2 + 0.15, 250, 140)
        return True
    nombres = sorted((TOMAS / 'noche').glob('*.jpg'))
    fondo_borroso(lienzo, str(nombres[-1].relative_to(TOMAS)))
    lineas(lienzo, t, [('NO ES UNA APP GENÉRICA:', FG, 64), ('ES TU SISTEMA', CIAN, 104)], s2, b + 0.3, 150, 92)
    t_web, t_obra = marca('s2', 'desde la web'), marca('s2', 'hasta la obra')
    ini = min(s2 + 0.9, t_web)
    paso_t = (t_obra - ini) / (len(NODOS) - 1)
    y0, paso = 480, 168
    capa = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(capa)
    for i in range(len(NODOS) - 1):  # conectores
        ti = ini + i * paso_t
        k = sale((t - ti - 0.15) / paso_t)
        if k > 0:
            ya = y0 + i * paso + 152
            d.line((W / 2 - 340, ya, W / 2 - 340, ya + (paso - 112) * k + 4), fill=CIAN + (220,), width=6)
    lienzo.alpha_composite(capa)
    for i, s in enumerate(NODOS):
        ti = ini + i * paso_t
        if t >= ti:
            e = sale((t - ti) / 0.35)
            pegar(lienzo, nodo(i, s), W / 2 + (1 - e) * 80, y0 + i * paso, e)
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
    lienzo.alpha_composite(fondo(t, PIEZAS))
    pegar(lienzo, logo(), W / 2, 210, entra_sale(t, a, b + 9))
    pegar(lienzo, chip('ARQUITECTOS · CONSTRUCTORAS · DISEÑADORES', CIAN, 30), W / 2, 420, entra_sale(t, a + 0.1, b + 9))
    pegar(lienzo, texto('Este es solo un ejemplo.', fuente('Inter-SemiBold.ttf', 52), MUT), W / 2, 520, entra_sale(t, fr('z1') + 0.8, b + 9))
    z2 = fr('z2')
    lineas(lienzo, t, [('¿CÓMO SERÍA', FG, 128), ('EL TUYO?', AMBAR, 150)], z2 - 0.05, b + 9, 650, 165)
    pegar(lienzo, chip(f'{WHATSAPP}  ·  axionasoft.com', FG, 34), W / 2, 1080, entra_sale(t, marca('z2', 'Escríbenos'), b + 9))
    pegar(lienzo, texto('Demo: glamping-axiona.netlify.app', fuente('IBMPlexMono-Medium.ttf', 34), CIAN, esp=1), W / 2, 1170, entra_sale(t, marca('z2', 'Escríbenos') + 0.3, b + 9))
    pegar(lienzo, texto('PRIMERO SE CONSTRUYE EN CÓDIGO', fuente('Inter-Bold.ttf', 34), CIAN, esp=5), W / 2, 1440, entra_sale(t, z2 + 0.6, b + 9))
    pegar(lienzo, texto('DESPUÉS, EN OBRA', fuente('Inter-Bold.ttf', 34), FG, esp=5), W / 2, 1496, entra_sale(t, z2 + 0.75, b + 9))
    pegar(lienzo, texto('@axionadesarrollos', fuente('Inter-SemiBold.ttf', 36), MUT), W / 2, 1600, entra_sale(t, z2 + 0.9, b + 9))
    return True


ESCENAS = [gancho, configura, recalcula, lote, constructora, sistema, cierre]


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


RESALTE = {'web', 'modelo,', 'acabado', 'escenario.', 'recalcula', 'solo:', 'presupuesto', 'ficha', 'técnica,', '10', 'planos', 'PDF', 'DXF.',
           'lote', 'realidad', 'aumentada', 'constructora', 'distinto.', 'genérica:', 'tuya,', 'integrada,', 'obra.', 'por', 'dentro.'}


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
    a, b, ruta, tomas, tiempos = args
    preparar(tomas, tiempos)
    proc = subprocess.Popen([FF, '-y', '-v', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{W}x{H}', '-r', str(FPS),
                             '-i', '-', '-c:v', 'libx264', '-preset', 'medium', '-crf', '20', '-profile:v', 'high',
                             '-level', '4.1', '-pix_fmt', 'yuv420p', '-g', str(FPS * 2), str(ruta)], stdin=subprocess.PIPE)
    for k in range(a, b):
        proc.stdin.write(cuadro(k / FPS).tobytes())
    proc.stdin.close()
    if proc.wait():
        raise SystemExit('ffmpeg falló en un tramo')
    return ruta


def preparar(tomas, tiempos):
    global TOMAS, E, F, PIEZAS, SUBS
    TOMAS = Path(tomas)
    E, F = tiempos['escenas'], tiempos['frases']
    PIEZAS = preparar_fondo()
    SUBS = trozos()
    promo.DUR = tiempos['dur']
    promo.DATOS, promo.SERVICIO, promo.CIERRE = ((E[k][0], E[k][0]) for k in ('configura', 'constructora', 'cierre'))
    promo.CUPOS = (tiempos['dur'] - 0.5, tiempos['dur'])


def render(salida, voz, tomas, tiempos, procesos=4):
    salida = Path(salida)
    total = int(round(tiempos['dur'] * FPS))
    with tempfile.TemporaryDirectory() as tmp:
        tmp = Path(tmp)
        cortes = np.linspace(0, total, procesos + 1).astype(int)
        partes = [(int(a), int(b), tmp / f'tramo{k}.mp4', tomas, tiempos) for k, (a, b) in enumerate(zip(cortes, cortes[1:]))]
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
    p.add_argument('--tomas', required=True)
    p.add_argument('--tiempos', required=True)
    p.add_argument('--voz', required=True)
    p.add_argument('--cuadros', default='', help='solo guarda estos instantes como JPG')
    a = p.parse_args()
    tiempos = json.loads(Path(a.tiempos).read_text())
    if a.cuadros:
        preparar(a.tomas, tiempos)
        for t in (float(x) for x in a.cuadros.split(',') if x):
            cuadro(t).save(Path(a.salida).parent / f'cuadro_{t:06.2f}.jpg', quality=88)
    else:
        render(a.salida, a.voz, a.tomas, tiempos)
