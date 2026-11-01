# Manejo de redes de Axiona · 5 cupos

Video de 37 segundos para estados de WhatsApp, reels y shorts. Ofrece el manejo de redes de Axiona a 5 emprendedores y lo respalda con los resultados del primer reel. No lleva precios: la cotización se pide por mensaje directo.

| Pieza | Archivo |
|---|---|
| Video vertical 1080 × 1920 con voz masculina en español latino | `axiona-5-cupos.mp4` |
| Portada del reel | `portada.jpg` |
| Generador: tarjetas, música original y locución | `generador/` |

## Datos que muestra

- Más de 4.600 vistas y 99.7 % de personas que no seguían la cuenta: estadísticas de Instagram del primer reel de Axiona Obra.
- 49 % de esas vistas desde México.
- 51 «me gusta» al 30 de octubre de 2026; los reels anteriores no pasaban de 5.

## Dónde y cuándo sale

| Hora de Bogotá | Dónde | Cómo |
|---|---|---|
| Viernes 30 oct, 18:00 (17:00 en la CDMX) | Reel de Instagram, también en la cuadrícula del perfil | Metricool |
| Viernes 30 oct, 18:00 | Página de Facebook y Short de YouTube | Zapier |
| Viernes 30 oct, 18:00 | Estado de WhatsApp de Santiago | A mano |
| Domingo 1 nov, 19:00 | Historia de Instagram con el mismo video | Metricool |

Las horas siguen la regla de `../publicacion-diaria.md`: de lunes a sábado entre las 18:00 y las 19:00, y domingos y festivos entre las 17:00 y las 21:00. El lunes 2 de noviembre es festivo en Colombia.

## Textos

Instagram y Facebook:

```
Ayer automaticé mis redes con Claude, la IA de Anthropic, y el primer reel pasó las 4.600 vistas en menos de un día. El 99.7 % de quienes lo vieron no me seguía.

Ahora lo hago para tu negocio. Abro 5 cupos para emprendedores:
✅ contenido y calendario del mes
✅ publicación diaria automática
✅ reels con subtítulos y portada
✅ métricas cada semana

Escríbeme al interno y te paso la cotización para tu negocio.

Axiona Desarrollos Inteligentes · Sabaneta, Antioquia
#marketingdigital #emprendedores #redessociales #inteligenciaartificial #ClaudeAI
```

Estado de WhatsApp:

```
Ayer automaticé mis redes con IA y el primer reel pasó las 4.600 vistas en menos de un día.
Ahora lo hago para tu negocio: abro 5 cupos para emprendedores.
Escríbeme al interno y te paso la cotización.
```

Título del Short de YouTube: `Automaticé mis redes con IA: 4.600 vistas en un día · 5 cupos para emprendedores`.

## Cómo se rehace

Hace falta Python 3 con Pillow, NumPy y `kokoro-onnx`, además de ffmpeg con libx264.

1. Descarga el modelo `kokoro-v1.0.onnx` y las voces `voices-v1.0.bin` de los lanzamientos de `thewh1teagle/kokoro-onnx` en GitHub.
2. Descarga las fuentes Chakra Petch Bold, IBM Plex Mono Medium e Inter (Black, Bold y SemiBold) en una carpeta.
3. Genera la locución y los tiempos de cada escena:

   ```
   python3 generador/voz.py CARPETA_MODELOS locucion
   ```

4. Arma el video:

   ```
   AXIONA_FUENTES=CARPETA_FUENTES python3 generador/promo.py video.mp4 --tiempos locucion/tiempos.json --voz locucion/voz.wav
   ```

La voz es «em_alex» de Kokoro (licencia Apache 2.0), con pronunciación latina. Para que diga «reels» como en Latinoamérica, el guion lo escribe «rils». La música se genera en el mismo script, así que no tiene derechos de terceros.
