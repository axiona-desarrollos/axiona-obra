# Voz propia de Santiago para los videos de Axiona

Los reels y videos de Axiona se narran con la voz clonada de Santiago, con su autorización. El agente escribe el guion, lo locuta con esa voz en tono de presentador y monta el video.

La voz es un dato personal. **La grabación y el perfil nunca entran a este repositorio**, que es público: viven en la carpeta privada de Google Drive «AXIONA · Voz de Santiago (privado)». El `.gitignore` de esta carpeta bloquea cualquier audio.

## Motores

Los dos son gratuitos, tienen licencia comercial y corren en CPU, sin GPU ni servicios externos.

| Motor | Licencia | Prueba en CPU de 4 núcleos | Parecido con la referencia |
|---|---|---|---|
| Qwen3-TTS 0.6B Base | Apache 2.0 | 8,2 s de voz en 68 s | 0,952 |
| Chatterbox Multilingual | MIT, con marca de agua inaudible | 11,0 s de voz en 64 s | 0,955 |

El parecido es el coseno entre las huellas de voz (`similitud.py`); una voz distinta da 0,80. Con la grabación real de Santiago se generan los dos y él escoge.

Si algún día hace falta más calidad de estudio, la opción paga es ElevenLabs, que clona la voz desde su plan Starter y hace clonación profesional desde el plan Creator.

## Flujo

1. **Grabar.** Santiago graba de 1 a 3 minutos con la guía de abajo y los sube a la carpeta privada.
2. **Preparar el perfil.** `python3 preparar_perfil.py GRABACION PERFIL_DIR` limpia el audio, toma el mejor tramo de 8 a 15 s (`ref.wav`) y lo transcribe (`ref.txt`).
3. **Locutar un guion.** `env-qwen/bin/python voz_propia.py qwen PERFIL_DIR guion.json SALIDA` deja `voz.wav` y `tiempos.json`, el mismo formato de los generadores de video. Con `chatterbox` usa el entorno `env-cb`. El guion lleva por frase `dice` (como se pronuncia), `lee` (el subtítulo) y `pausa`; `velocidad` da el ritmo de locutor (1,06 por defecto).
4. **Etiquetar.** Todo video con la voz clonada se publica con la etiqueta de contenido con IA de cada red (`isAiGenerated`, `isAigc`).

### Entornos

```
python3 -m venv env-qwen && uv pip install --python env-qwen/bin/python \
  --index-url https://download.pytorch.org/whl/cpu --extra-index-url https://pypi.org/simple \
  --index-strategy unsafe-best-match "torch==2.8.*" "torchaudio==2.8.*" qwen-tts soundfile
python3 -m venv env-cb && uv pip install --python env-cb/bin/python \
  --index-url https://download.pytorch.org/whl/cpu --extra-index-url https://pypi.org/simple \
  --index-strategy unsafe-best-match chatterbox-tts "setuptools<81"
```

`preparar_perfil.py` usa el Whisper de sherpa-onnx del sistema.

## Guía de grabación

- **Dónde:** cuarto silencioso y sin eco; un clóset con ropa sirve. Sin música, ventilador ni aire acondicionado.
- **Con qué:** la grabadora de voz del celular, en m4a o wav. La nota de voz de WhatsApp comprime demasiado.
- **Cómo:** celular a un palmo de la boca y de lado, para no soplar el micrófono. Léelo como si presentaras un producto en video, con energía, sonriendo y a buen ritmo.
- **Cuánto:** de 1 a 3 minutos. Si puedes, dos tomas: una tranquila y otra en modo presentador.

### Texto para leer

> Yo, Santiago, autorizo a Axiona Desarrollos Inteligentes a crear y usar una voz sintética a partir de esta grabación, solo para los contenidos de Axiona.
>
> Hola, soy Santiago, de Axiona Desarrollos Inteligentes, en Sabaneta, Antioquia.
>
> ¿Sabías que una constructora puede perder semanas haciendo planos, cantidades y presupuestos a mano?
>
> Con Axiona Obra escribes el lote y los espacios, y en minutos tienes el juego de planos, el modelo en 3D y el presupuesto.
>
> Es gratis, funciona en el celular y está en obra punto axionasoft punto com.
>
> Y si tu empresa necesita algo propio, lo construimos a la medida: tu web, tu configurador y tus agentes de inteligencia artificial.
>
> Lo desarrollamos con Claude, la inteligencia artificial de Anthropic, y cada cálculo tiene pruebas automáticas.
>
> Uno, dos, tres: menos horas de mesa, menos errores y más propuestas a tiempo.
>
> ¿Quieres verlo en tu empresa? Escríbenos por WhatsApp y te lo mostramos.

Al final, 20 a 30 segundos libres: cuenta con tus palabras qué es Axiona y para qué sirve. El habla espontánea le enseña al motor tu forma natural de hablar.
