# «Esta casa todavía no existe»: render fotorrealista con el valle de Aburrá

Reel vertical de unos 36 s que vende un servicio de Axiona: tomar los planos de un proyecto y entregar con ellos material para vender antes de construir.

- Render fotorrealista: la fachada en obra gris y terminada, desde la misma cámara.
- La sala con la vista real del valle.
- El visor 3D por etapas de obra.
- Realidad aumentada.
- Video para redes.

> **Antes de publicar:** el material viene de una demo que Axiona hizo para una constructora, como propuesta privada. El video es **anónimo**:
> - no nombra el proyecto ni la empresa;
> - no muestra el título del reel original, ni fotos de la obra real, ni planos;
> - no muestra el código QR, que lleva a una dirección con el nombre del proyecto.
>
> Aun así, la casa es diseño de esa constructora. **Solo se publica cuando Santiago confirme que la constructora está de acuerdo.**

| Pieza | Archivo |
|---|---|
| Video 1080 × 1920 con voz en español latino y subtítulos | `axiona-render-medellin.mp4` |
| Locución y tiempos | `generador/voz.py` |
| Composición del video | `generador/video.py` |

Los medios no van en el repositorio: el reel, los renders y las capturas del visor son de la demo.

## Texto para publicar (cuando haya permiso)

```
Esta casa todavía no existe. Y ya se puede vender. 🏡

La reconstruimos desde los planos, etapa por etapa: del lote a la casa terminada. El comprador la ve en obra gris y, con un gesto, terminada. Entra a la sala y ve la vista real del valle de Aburrá. De noche, con las luces de la ciudad: la imagen que vende la primera visita.

Además la gira en el navegador, entra a cada espacio y la pone sobre su mesa con realidad aumentada.

Render fotorrealista, recorrido 3D y video para redes, desde tus planos.
¿Tienes un proyecto en planos? Escríbenos.
WhatsApp +57 310 392 2935 · axionasoft.com

Axiona Desarrollos Inteligentes · Sabaneta, Antioquia

#renderarquitectonico #fincaraiz #medellin #constructoras #realidadaumentada
```

## Cómo se rehace

```
# MEDIOS/reel: cuadros del reel nocturno de 4,1 a 7,1 s (antes de 4,1 s se ve el título), a 30 fps
# MEDIOS/fotos: frente, frente_gris, sala, sala_gris, piedra, tres4, aerea
# MEDIOS/visor: fase1…fase9, frente, frente-noche, sala-noche (visor 3D de la demo, recortado al lienzo)
python3 generador/voz.py CARPETA_MODELOS SALIDA
AXIONA_FUENTES=CARPETA_FUENTES python3 generador/video.py axiona-render-medellin.mp4 --medios MEDIOS --tiempos SALIDA/tiempos.json --voz SALIDA/voz.wav
```
