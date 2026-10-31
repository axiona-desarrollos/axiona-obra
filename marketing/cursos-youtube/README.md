# Lo que hicimos con IA · cursos en YouTube

Video de 45 segundos para estados de WhatsApp, historias, reels y shorts. Santiago muestra lo más fuerte de lo que construyó con agentes de IA y anuncia los cursos de su canal de YouTube. Los publica él a mano en cada red.

| Pieza | Archivo |
|---|---|
| Video vertical 1080 × 1920 con voz masculina en español latino, música original y subtítulos | `axiona-cursos.mp4` |
| Portada del reel y del Short | `portada.jpg` |
| Capturas reales de Axiona Obra y Axiona Topo que usa el video | `tomas/` |
| Generador: locución, escenas y música | `generador/` |

## Qué muestra

| Segundos | Escena | Fuente |
|---|---|---|
| 0–6 | «Soy Santiago, de Axiona», «en menos de 3 días, con IA», y una terminal con los commits reales del proyecto | Historial de git: del 28 al 30 de octubre de 2026 |
| 6–10 | Axiona Obra: la casa en 3D, los planos y el presupuesto para Colombia, España, Canadá y México | Capturas de obra.axionasoft.com |
| 10–13 | Axiona Topo: el topógrafo en el celular | Captura del plano con curvas de nivel |
| 13–18 | Lo más brutal: el holograma con rayos X, el corte y el relleno | Capturas de Axiona Topo |
| 18–21 | Celular y computador en vivo, cifrado AES-256, y el plano en PDF | Captura del computador y plano PDF real |
| 21–26 | Redes en automático: 4.600+ vistas, 99.7 % no seguía la cuenta, 49 % desde México | Estadísticas de Instagram del primer reel (30 oct 2026) |
| 26–29 | Muy pronto, los mejores cursos en el canal de YouTube | — |
| 29–33 | «En menos de un mes vas a hacer lo imposible… posible» | — |
| 33–42 | Lo que debes saber: repositorios, Git, Node.js, actualizaciones, políticas, secretos, Zapier y Databricks | — |
| 42–45 | «Sígueme y activa la campana» y la marca | — |

## Textos

Estado de WhatsApp:

```
En menos de 3 días, con IA, llevé Axiona Obra a 4 países y creé Axiona Topo: un topógrafo en el celular con rayos X.
Muy pronto en mi canal de YouTube: los cursos para pasar del código a proyectos reales.
```

Instagram y Facebook:

```
En menos de 3 días, con agentes de IA:
🏠 Axiona Obra llegó a 4 países: tu casa en 3D, con planos y presupuesto
📡 Axiona Topo: el topógrafo en tu celular, con holograma y rayos X
💻 Celular y computador en vivo, cifrado, con el plano en PDF
📈 Redes que se publican solas

Muy pronto, en mi canal de YouTube, los mejores cursos: repositorios, Git, Node.js, actualizaciones, políticas y secretos, Zapier y Databricks. Lo que debes saber para pasar del código a proyectos reales.

Sígueme y activa la campana 🔔

Axiona Desarrollos Inteligentes · Sabaneta, Antioquia
#inteligenciaartificial #programacion #emprendedores #ClaudeAI #desarrolloweb
```

Título del Short de YouTube: `Lo que hice con IA en 3 días · Muy pronto, los cursos`.

## Cómo se rehace

Hace falta Python 3 con Pillow, NumPy y `kokoro-onnx`, además de ffmpeg con libx264. El video usa la utilidad de texto y el fondo de `../servicio-redes/generador/promo.py`, así que las dos carpetas van juntas.

1. Descarga el modelo `kokoro-v1.0.onnx` y las voces `voices-v1.0.bin` de los lanzamientos de `thewh1teagle/kokoro-onnx` en GitHub.
2. Descarga las fuentes Chakra Petch Bold, IBM Plex Mono Medium e Inter (Bold y SemiBold) en una carpeta.
3. Genera la locución y los tiempos de cada escena:

   ```
   python3 generador/voz.py CARPETA_MODELOS locucion
   ```

4. Arma el video. Usa los 4 núcleos y tarda cerca de un minuto:

   ```
   AXIONA_FUENTES=CARPETA_FUENTES python3 generador/video.py axiona-cursos.mp4 --tiempos locucion/tiempos.json --voz locucion/voz.wav
   ```

5. Para la portada, guarda un cuadro sin subtítulos:

   ```
   AXIONA_FUENTES=CARPETA_FUENTES python3 generador/video.py portada.mp4 --tiempos locucion/tiempos.json --voz locucion/voz.wav --cuadros 15.0 --sin-subtitulos
   ```

Así salen las capturas de `tomas/`, que se guardan en JPG de calidad 90:
- **Axiona Topo:** `generador/tomas.cjs` las toma con Playwright, contra la app servida en el puerto 8171. Salen a 1080 px de ancho, así que no se pierde nitidez.
- **Plano:** es la primera hoja del PDF A3 que descarga Axiona Topo, pasada a imagen con `pdftoppm -r 220`.
- **Axiona Obra:** son las capturas del lanzamiento 3.0.

### Pronunciación

La voz es «em_alex» de Kokoro (licencia Apache 2.0). Algunas palabras van escritas como se dicen: «Guit», «Noud», «Yutub», «ril», «Zápier», «Databriks», «tres de» y «rayos equis». La locución se pasó por Whisper y sale escrita como «Git y Node», «YouTube», «reel», «Zapier y Databricks», «3D» y «rayos X».

El temario se dice de corrido, porque así se entiende mejor: dicho palabra por palabra, Whisper oye «Gating node». Cada ficha aparece cuando se nombra su palabra. Ese momento se calcula midiendo cada parte por separado.
