#!/usr/bin/env python3
"""Historias (1080x1920) y carrusel (1080x1350) de Instagram para el nicho empresarial.

Estilo Axiona: fondo oscuro con brillo cian, Inter Black, etiquetas con
espaciado, capturas reales con borde redondeado. Sin cebo de comentarios.
Uso: python3 piezas.py SALIDA_DIR
"""
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

OUT = Path(sys.argv[1]); OUT.mkdir(parents=True, exist_ok=True)
F = Path('/tmp/claude-0/-home-user-axiona-obra/566d1b8e-acad-59e7-93fc-45f410b549a6/scratchpad/video/kit/fonts')
M = Path('/home/user/axiona-obra/marketing')
DL = Path(__file__).resolve().parent / 'dl'
CIAN, GRIS, BLANCO, FONDO = (27, 169, 192), (136, 144, 153), (238, 240, 242), (5, 10, 14)


def fu(n, t):
    return ImageFont.truetype(str(F / n), t)


def lienzo(w, h):
    im = Image.new('RGB', (w, h), FONDO)
    glow = Image.new('L', (w, h), 0)
    ImageDraw.Draw(glow).ellipse([w * 0.05, h * 0.18, w * 0.95, h * 0.62], fill=70)
    glow = glow.filter(ImageFilter.GaussianBlur(160))
    im.paste(Image.new('RGB', (w, h), (14, 70, 86)), (0, 0), glow)
    d = ImageDraw.Draw(im)
    for x in range(0, w, 60):  # rejilla técnica muy tenue
        d.line([(x, 0), (x, h)], fill=(10, 18, 24))
    for y in range(0, h, 60):
        d.line([(0, y), (w, y)], fill=(10, 18, 24))
    return im


def envolver(d, txt, f, ancho):
    out, linea = [], ''
    for p in txt.split():
        prueba = (linea + ' ' + p).strip()
        if d.textlength(prueba, font=f) <= ancho:
            linea = prueba
        else:
            out.append(linea); linea = p
    out.append(linea)
    return out


def texto(d, xy, txt, f, color, ancho, interlinea=1.12, centro=False, w=1080):
    x, y = xy
    for ln in envolver(d, txt, f, ancho):
        xx = (w - d.textlength(ln, font=f)) / 2 if centro else x
        d.text((xx, y), ln, font=f, fill=color)
        y += f.size * interlinea
    return y


def etiqueta(d, xy, txt, centro=False, w=1080):
    f = fu('ChakraPetch-Bold.ttf', 30)
    t = '  '.join(txt.upper())
    t = txt.upper()
    esp = 6
    largo = sum(d.textlength(c, font=f) + esp for c in t) - esp
    x = (w - largo) / 2 if centro else xy[0]
    d.rounded_rectangle([x - 22, xy[1] - 12, x + largo + 22, xy[1] + 46], radius=29, outline=CIAN, width=3)
    for c in t:
        d.text((x, xy[1]), c, font=f, fill=CIAN)
        x += d.textlength(c, font=f) + esp


def captura(im, ruta, caja, modo='cover', foco=0.5):
    x0, y0, x1, y1 = caja
    W, H = x1 - x0, y1 - y0
    src = Image.open(ruta).convert('RGB')
    r = max(W / src.width, H / src.height) if modo == 'cover' else min(W / src.width, H / src.height)
    s = src.resize((int(src.width * r), int(src.height * r)), Image.LANCZOS)
    if modo == 'cover':
        ox = (s.width - W) // 2
        oy = int((s.height - H) * foco)
        s = s.crop((ox, oy, ox + W, oy + H))
        px, py = x0, y0
    else:
        px, py = x0 + (W - s.width) // 2, y0 + (H - s.height) // 2
        W, H = s.width, s.height
    m = Image.new('L', (W, H), 0)
    ImageDraw.Draw(m).rounded_rectangle([0, 0, W - 1, H - 1], radius=34, fill=255)
    sombra = Image.new('L', im.size, 0)
    ImageDraw.Draw(sombra).rounded_rectangle([px - 6, py - 6, px + W + 6, py + H + 6], radius=40, fill=150)
    im.paste(Image.new('RGB', im.size, (20, 120, 140)), (0, 0), sombra.filter(ImageFilter.GaussianBlur(26)))
    im.paste(s, (px, py), m)
    ImageDraw.Draw(im).rounded_rectangle([px, py, px + W - 1, py + H - 1], radius=34, outline=CIAN, width=3)


def marca(d, y, w=1080, extra=None):
    f = fu('Inter-Black.ttf', 46)
    t = 'A X I O N A'
    tw = d.textlength(t, font=f)
    x = (w - tw - 52) / 2
    d.arc([x, y + 4, x + 38, y + 42], 180, 360, fill=CIAN, width=9)
    d.line([(x + 4, y + 23), (x + 4, y + 46)], fill=CIAN, width=9)
    d.line([(x + 34, y + 23), (x + 34, y + 46)], fill=CIAN, width=9)
    d.text((x + 52, y), t, font=f, fill=BLANCO)
    if extra:
        fe = fu('IBMPlexMono-Medium.ttf', 28)
        d.text(((w - d.textlength(extra, font=fe)) / 2, y + 66), extra, font=fe, fill=GRIS)


# ---------------- historias ----------------
def historia(n, label, titulo, img, sub, pie, modo='cover', foco=0.5, caja=(90, 700, 990, 1500)):
    im = lienzo(1080, 1920); d = ImageDraw.Draw(im)
    etiqueta(d, (0, 190), label, centro=True)
    y = texto(d, (90, 300), titulo, fu('Inter-Black.ttf', 74), BLANCO, 900, 1.1, centro=True)
    cx0, cy0, cx1, cy1 = caja
    off = max(0, int(y + 50 - cy0))
    captura(im, img, (cx0, cy0 + off, cx1, cy1 + off // 2), modo, foco)
    d = ImageDraw.Draw(im)
    yb = cy1 + off // 2 + 50
    yb = texto(d, (90, yb), sub, fu('Inter-Bold.ttf', 44), BLANCO, 900, 1.2, centro=True)
    if pie:
        texto(d, (90, yb + 14), pie, fu('IBMPlexMono-Medium.ttf', 34), CIAN, 900, 1.2, centro=True)
    marca(d, 1760)
    im.save(OUT / f'historia-{n}.jpg', quality=92)


historia(1, 'Nuevo en el perfil', 'Tu empresa no necesita usar IA. Necesita construir su motor.',
         DL / 'motor.png', 'Datos verificados, pruebas automáticas y cero números inventados.',
         'Míralo en el perfil', modo='contain')
historia(2, 'Constructoras', '¿Cuántas horas pierde tu equipo buscando licitaciones?',
         DL / 'lic-filtro.png', 'Hoy a las 6 p. m.: así trabajaría un agente de IA para tu empresa.',
         'Ejemplo ilustrativo', foco=0.0, caja=(90, 700, 990, 1380))
historia(3, 'Axiona Obra · gratis', 'Del lote al juego de planos, en el navegador.',
         M / 'cursos-youtube/tomas/plano-pdf.jpg', 'Láminas en PDF y DXF con la norma de tu país. Las revisa y firma tu profesional.',
         'obra.axionasoft.com', modo='contain', caja=(70, 700, 1010, 1380))
historia(4, 'Vende antes de construir', 'Tu cliente recorre su casa amoblada antes del primer ladrillo.',
         M / 'cursos-youtube/tomas/obra-interior.jpg', '3D, realidad aumentada y presupuesto, dentro de tu web.',
         'axionasoft.com', foco=0.45)
historia(5, 'Demo · glamping', 'El sistema completo de una empresa de glamping.',
         DL / 'glamping.png', 'Su cliente lo configura y salen la ficha, el presupuesto y 10 planos.',
         'glamping-axiona.netlify.app', foco=0.4)


def historia_lista():
    im = lienzo(1080, 1920); d = ImageDraw.Draw(im)
    etiqueta(d, (0, 190), 'Lo que construimos', centro=True)
    y = texto(d, (90, 300), 'Software a la medida para constructoras', fu('Inter-Black.ttf', 78), BLANCO, 900, 1.08, centro=True)
    items = ['Tu web con tus obras en 3D y el antes y después', 'El configurador de lo que fabricas',
             'Planos, cantidades y presupuesto automáticos', 'Agentes que vigilan licitaciones y vencimientos',
             'Redes con publicación diaria automática']
    y += 70
    for i, t in enumerate(items, 1):
        d.rounded_rectangle([90, y, 990, y + 168], radius=28, fill=(9, 20, 27), outline=(22, 60, 72), width=2)
        d.text((122, y + 40), f'{i:02d}', font=fu('ChakraPetch-Bold.ttf', 64), fill=CIAN)
        texto(d, (250, y + 36 if len(envolver(d, t, fu('Inter-Bold.ttf', 44), 700)) > 1 else y + 58), t,
              fu('Inter-Bold.ttf', 44), BLANCO, 700, 1.15)
        y += 196
    texto(d, (90, y + 30), 'WhatsApp +57 310 392 2935', fu('IBMPlexMono-Medium.ttf', 40), CIAN, 900, centro=True)
    marca(d, 1760)
    im.save(OUT / 'historia-6.jpg', quality=92)


historia_lista()


# ---------------- carrusel 4:5 ----------------
def lamina(n, num, titulo, cuerpo, img, modo='cover', foco=0.5, nota=None):
    im = lienzo(1080, 1350); d = ImageDraw.Draw(im)
    d.text((80, 80), num, font=fu('ChakraPetch-Bold.ttf', 120), fill=CIAN)
    y = texto(d, (80, 230), titulo, fu('Inter-Black.ttf', 66), BLANCO, 920, 1.08)
    y = texto(d, (80, y + 18), cuerpo, fu('Inter-SemiBold.ttf', 38), GRIS, 920, 1.25)
    captura(im, img, (80, int(y + 40), 1000, 1200), modo, foco)
    d = ImageDraw.Draw(im)
    if nota:
        d.text((80, 1222), nota, font=fu('IBMPlexMono-Medium.ttf', 26), fill=GRIS)
    d.text((1000 - d.textlength(f'{n}/7', font=fu('IBMPlexMono-Medium.ttf', 30)), 1262), f'{n}/7',
           font=fu('IBMPlexMono-Medium.ttf', 30), fill=CIAN)
    d.text((80, 1262), 'AXIONA · axionasoft.com', font=fu('IBMPlexMono-Medium.ttf', 30), fill=GRIS)
    im.save(OUT / f'carrusel-{n}.jpg', quality=92)


def portada():
    im = lienzo(1080, 1350); d = ImageDraw.Draw(im)
    etiqueta(d, (80, 150), 'Constructoras · 2026')
    y = texto(d, (80, 260), '5 trabajos de mesa que tu constructora ya puede automatizar', fu('Inter-Black.ttf', 96), BLANCO, 920, 1.05)
    texto(d, (80, y + 40), 'Con ejemplos reales de lo que construimos en Axiona.', fu('Inter-SemiBold.ttf', 42), GRIS, 920, 1.2)
    d.text((80, 1150), 'Desliza  →', font=fu('Inter-Black.ttf', 54), fill=CIAN)
    d.text((80, 1262), 'AXIONA · axionasoft.com', font=fu('IBMPlexMono-Medium.ttf', 30), fill=GRIS)
    im.save(OUT / 'carrusel-1.jpg', quality=92)


def cierre():
    im = lienzo(1080, 1350); d = ImageDraw.Draw(im)
    y = texto(d, (80, 230), 'No es usar IA: es construir el motor de tu empresa.', fu('Inter-Black.ttf', 84), BLANCO, 920, 1.06, centro=True)
    y = texto(d, (80, y + 50), 'Axiona Obra es gratis y funciona en el navegador:', fu('Inter-SemiBold.ttf', 40), GRIS, 920, 1.25, centro=True)
    y = texto(d, (80, y + 6), 'obra.axionasoft.com', fu('IBMPlexMono-Medium.ttf', 46), CIAN, 920, centro=True)
    y = texto(d, (80, y + 60), '¿Lo quieres a la medida de tu constructora?', fu('Inter-Bold.ttf', 44), BLANCO, 920, 1.2, centro=True)
    texto(d, (80, y + 6), 'WhatsApp +57 310 392 2935', fu('IBMPlexMono-Medium.ttf', 46), CIAN, 920, centro=True)
    marca(d, 1130, extra='Sabaneta, Antioquia · Colombia')
    im.save(OUT / 'carrusel-7.jpg', quality=92)


portada()
lamina(2, '01', 'Planos y trámites', 'El juego de planos en PDF y DXF sale del lote y los espacios. Tu profesional lo revisa y lo firma.',
       M / 'cursos-youtube/tomas/plano-pdf.jpg', modo='contain')
lamina(3, '02', 'Vender con 3D', 'Tu cliente recorre la casa amoblada y la ve en su lote con realidad aumentada.',
       M / 'cursos-youtube/tomas/obra-interior.jpg', foco=0.45)
lamina(4, '03', 'Cantidades sobre la planta', 'Espacios, áreas y redes salen de la misma planta, sin rehacer la hoja de cálculo.',
       M / 'cursos-youtube/tomas/obra-planta.jpg', modo='contain')
lamina(5, '04', 'Licitaciones que sí cumples', 'Un agente revisa los portales cada día y te avisa solo de las que tu empresa puede cumplir.',
       DL / 'lic-filtro.png', foco=0.08, nota='Ejemplo ilustrativo')
lamina(6, '05', 'Movimiento de tierras', 'Corte, relleno y viajes de volqueta, calculados desde el celular con Axiona Topo.',
       M / 'cursos-youtube/tomas/topo-holo.jpg', foco=0.62)
cierre()
print('ok')
