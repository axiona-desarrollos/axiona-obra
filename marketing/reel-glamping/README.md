# Reel «Esto no es una app»

Reel vertical de unos 45 s para Instagram, TikTok y Shorts. Muestra que Axiona no vende una app genérica, sino el sistema completo de cada empresa:

- **Glamping.** La web de la empresa con su configurador 3D: modelo, acabado y escenario. Las medidas recalculan la ficha, el presupuesto y 10 láminas de planos en PDF y DXF. Incluye realidad aumentada y recorrido por dentro.
- **Constructora.** La casa del cliente antes de construirla, vista desde afuera y caminada por dentro.

| Pieza | Archivo |
|---|---|
| Video 1080 × 1920 con voz en español latino y subtítulos | `axiona-sistema-glamping.mp4` |
| Locución y tiempos | `generador/voz.py` |
| Composición del video | `generador/video.py` |
| Render 3D cuadro por cuadro y pantallas de la demo | `generador/tomas.cjs`, `generador/motor.cjs`, `generador/ui.cjs`, `generador/ui3.cjs` (`ui2.cjs` captura la vista de computador, pero sin GPU se traba) |

Todo sale de material real:

- **La demo pública** [glamping-axiona.netlify.app](https://glamping-axiona.netlify.app): render 3D en calidad alta, cuadro por cuadro, y pantallas de la interfaz.
- **El recálculo:** al pasar el ancho de 4,40 a 5,20 m, el presupuesto referencial sube de $186.887.637 a $206.971.179.
- **La grabación de la Casa Envigado:** recortada para que no se vea la franja con el nombre del cliente. La grabación original no va en el repositorio.

## Texto para publicar

```
Esto no es una app. Es el sistema completo de una empresa de glamping. ⛺

Su cliente entra a la web y arma su glamping: modelo, acabado y escenario. Mueve una medida y se recalculan la ficha técnica, el presupuesto y 10 planos en PDF y DXF. Lo pone en su lote con realidad aumentada y lo recorre por dentro.

Para una constructora es otra cosa: la casa de su cliente antes de construirla.

Cada empresa necesita algo distinto. No vendemos apps genéricas: construimos el sistema de tu empresa, desde la web que ve tu cliente hasta la obra.

Prueba la demo: glamping-axiona.netlify.app
WhatsApp +57 310 392 2935 · axionasoft.com

Axiona Desarrollos Inteligentes · Sabaneta, Antioquia

#glamping #arquitectura #constructoras #realidadaumentada #softwarealamedida
```

## Cómo se rehace

Hace falta lo siguiente:

- Python 3 con Pillow, NumPy y `kokoro-onnx`;
- ffmpeg con libx264;
- Playwright;
- las fuentes y modelos de voz de `../servicio-redes`.

Los cuadros del render (unos 300 JPG) no van en el repositorio, por peso. Se regeneran con los pasos 1 a 3.

```
# 1. Render 3D: llegada, interior, noche y tomas fijas (8 s por cuadro sin GPU)
node generador/tomas.cjs heroe; node generador/tomas.cjs interior; node generador/tomas.cjs noche; node generador/tomas.cjs fijas
# 2. Pantallas de la interfaz: celular, las láminas desde su SVG y los datos reales de la ficha (ficha.json, que dibuja video.py)
node generador/ui.cjs; node generador/ui3.cjs
# 3. Grabación de la casa, sin la franja de arriba: recorte 1080x2210 desde y=190, tramos 0.3-6.6 s y 14-19 s, a 30 fps, en TOMAS/casa/%04d.jpg
# 4. Voz (Kokoro, «em_alex»)
python3 generador/voz.py CARPETA_MODELOS SALIDA
# 5. Video
AXIONA_FUENTES=CARPETA_FUENTES python3 generador/video.py axiona-sistema-glamping.mp4 --tomas TOMAS --tiempos SALIDA/tiempos.json --voz SALIDA/voz.wav
```
