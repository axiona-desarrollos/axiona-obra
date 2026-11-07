# «No es usar IA: es construir el motor»

Video vertical de unos 68 s para Instagram, TikTok, Shorts y LinkedIn. Va para empresarios que siguen trabajando con métodos tradicionales y su mensaje es este:

- Un chat de IA puede inventarse un dato.
- Axiona construye motores de cálculo con datos verificados que no adivinan.
- La persona vuelve a lo que no se reemplaza: el criterio, la visión y la confianza.

Las ideas vienen de la investigación que Santiago hizo con Gemini:

- **Del cómo al qué:** eliminar el «impuesto de fricción».
- **Superar la escala lineal:** una persona con la fuerza de un equipo.
- **Redefinir el trabajo humano** hacia lo irremplazable.
- **Orquestar sistemas** en vez de vender horas de ejecución.

Se dejaron fuera dos afirmaciones de esa investigación que no se pueden comprobar: la predicción atribuida a Musk para 2036 y el «90 % de la energía mental». Sin ellas, nadie puede desmentir el video.

| Pieza | Archivo |
|---|---|
| Video 1080 × 1920 con voz en español latino y subtítulos | `axiona-motor-ia.mp4` |
| Locución y tiempos | `generador/voz.py` |
| Composición del video | `generador/video.py` |
| Pantallas reales de Axiona Obra | `generador/obra.cjs` |

## Lo que se puede comprobar

- **185 pruebas automáticas.** Corren con `npx vitest run` en la raíz del repositorio: 13 archivos, todas pasan (6 de noviembre de 2026).
- **Los nombres de las pruebas en pantalla son los reales**, por ejemplo:
  - «la casa de ejemplo › es determinista»;
  - «si no cabe lo dice, y no la cobra»;
  - «ningun eje deja una luz mayor a 4.5 m».
- **Las pantallas son las de Axiona Obra**, con la mansión campestre Llano Grande: presupuesto, planos, 3D y trámites.
- **El chat que inventa un dato es una ilustración genérica**, sin la marca de ningún producto.

## Texto para publicar

```
Tu empresa no necesita usar IA. Necesita construir su motor. ⚙️

Un chat de IA puede inventarse un dato con toda seguridad. En una obra, un número inventado cuesta millones.

En Axiona no usamos la IA para adivinar: construimos motores de cálculo con datos verificados (normas, precios unitarios y cantidades reales). Sus reglas tienen pruebas automáticas: hoy son 185 en Axiona Obra y pasan todas. Mismo dato, mismo resultado; si algo no cabe, el sistema lo dice.

Tú dices qué quieres lograr y el sistema hace el resto: planos, presupuesto, 3D y trámites. Y la persona vuelve a lo que no se reemplaza: el criterio, la visión y la confianza de su cliente.

Lo construimos con agentes de IA (Claude, de Anthropic) y con ingeniería que se puede verificar.

¿Qué motor necesita tu empresa? Escríbenos y te mostramos cómo lo construimos.
WhatsApp +57 310 392 2935 · axionasoft.com
Prueba gratis Axiona Obra: obra.axionasoft.com

Axiona Desarrollos Inteligentes · Sabaneta, Antioquia

#inteligenciaartificial #ClaudeAI #transformaciondigital #construccion #empresas
```

## Cómo se rehace

Hace falta lo mismo que en `../reel-glamping`, más un build de Axiona Obra servido en el puerto 4173.

```
# 1. Pantallas de Axiona Obra (tema oscuro, en español)
npm run build && npx vite preview --port 4173 &
node generador/obra.cjs MEDIOS/obra
# 2. MEDIOS/topo → ../topo-walter/tomas; MEDIOS/glamping → tomas del reel del glamping (fijas/esc-noche.jpg)
# 3. Voz
python3 generador/voz.py CARPETA_MODELOS SALIDA
# 4. Video
AXIONA_FUENTES=CARPETA_FUENTES python3 generador/video.py axiona-motor-ia.mp4 --medios MEDIOS --tiempos SALIDA/tiempos.json --voz SALIDA/voz.wav
```
