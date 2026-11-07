# Axiona Podcast · «El propósito y el para qué»

Video podcast horizontal (1920 × 1080, 30 fps) de 3 min 8 s. Es un diálogo entre una presentadora y Claude, el agente de IA, sobre el verdadero «para qué» de la inteligencia artificial y los agentes autónomos. Parte del análisis que hizo Santiago construyendo con agentes de código.

| Pieza | Archivo |
|---|---|
| Video con las dos voces, música de fondo y subtítulos | `axiona-podcast-proposito.mp4` (74 MB: no va en el repositorio; se rehace con los pasos de abajo) |
| Voces y tiempos por frase | `generador/voz.py` |
| Composición del video | `generador/video.py` |

## Decisiones sobre el pedido original

- **Nombre:** «Axiona Podcast», no «Acciona». ACCIONA es una multinacional de construcción e infraestructura, y su nombre en el mismo sector confundiría a la audiencia y expondría a un reclamo de marca.
- **Sin rostros hiperrealistas:** un rostro falso con una voz sintética haría creer que habla una persona real. Los hablantes son avatares de marca que reaccionan a la intensidad real de su voz, y el video dice en pantalla que las voces son sintéticas.
- **Sin cifras ni intenciones que no se puedan comprobar:**
  - «el 99 % de la gente» se cambió por «mucha gente»;
  - «los creadores la construyeron para…» se cambió por una lectura propia: «sirve para destruir la fricción».
- **Sin mencionar herramientas de terceros:** el análisis se atribuye al trabajo de Santiago con agentes de código.

## Voces

| Hablante | Voz | Velocidad | Carácter |
|---|---|---|---|
| Presentadora | Kokoro `ef_dora`, español latino | 1,04 | Cálida y dinámica, de anfitriona. |
| Claude (agente) | Kokoro `em_alex`, español latino | 1,00 | Analítica y pausada. Es la voz de los otros videos de Axiona. |

- **Pausas:** 0,5 s al cambiar de hablante, 0,28 s entre frases del mismo hablante y 0,9 s extra entre bloques.
- **Pronunciación:** en la locución se escribe como se dice («Clod», «i a», «a pe u», «tres de») y en los subtítulos, como se lee.

## Guion sincronizado

### Bloque 1 · El espejismo del futuro (0:00 a 0:51)

| Tiempo | Quién | Texto | En pantalla |
|---|---|---|---|
| 0:00 | — | — | «AXIONA PODCAST» y el título tecleado. |
| 0:03 | Presentadora | Bienvenidos a un nuevo episodio especial de Axiona Podcast. Hoy no venimos a hablar de software convencional ni de trucos rápidos de redes sociales. | «El propósito y el para qué» sobre el glamping girando; la app real. |
| 0:12 | Presentadora | Venimos a hablar de fondo: del verdadero trasfondo de lo que está pasando en el mundo con la inteligencia artificial y la automatización. | «EL TRASFONDO». |
| 0:20 | Claude | Hola. Soy Claude, el agente que diseña, programa y despliega junto a Santiago. | Consola con las pruebas reales del motor. |
| 0:24 | Claude | Mientras mucha gente se asusta con videos virales de androides o con noticias apocalípticas sobre el fin de los oficios, hay una lectura mucho más profunda que pocos están entendiendo. | Titulares genéricos de miedo; «UNA LECTURA MÁS PROFUNDA». |
| 0:36 | Presentadora | Así es. Se habla de un futuro post-escasez, de economías donde el dinero tradicional se transforma y de robots haciendo el trabajo pesado. | «¿POST-ESCASEZ?». |
| 0:44 | Presentadora | Pero la pregunta que Santiago se hizo no es qué pasará en el año 2036, sino: ¿para qué sirve realmente esta tecnología hoy? | «2036» y luego «¿PARA QUÉ?» en dorado. |

### Bloque 2 · El fin de la fricción (0:52 a 1:46)

| Tiempo | Quién | Texto | En pantalla |
|---|---|---|---|
| 0:52 | Claude | La mayoría de profesionales usa la IA como un buscador glorificado o como un asistente para redactar correos. | «LA SUPERFICIE»; buscador con un correo a medio escribir. |
| 0:59 | Claude | Se quedan en la superficie: prueban una vez, no les sale perfecto y la abandonan. | «PROBAR UNA VEZ ≠ CONSTRUIR». |
| 1:04 | Presentadora | Lo que Santiago hizo fue lo contrario: bajó al barro de la ejecución. | «AL BARRO DE LA EJECUCIÓN». |
| 1:08 | Presentadora | Usó agentes de código para automatizar todo el ciclo de un proyecto arquitectónico: desde el análisis del lote y las normas urbanísticas de cada país, hasta los planos, el modelo en 3D y el presupuesto con análisis de precios unitarios. | Cambia con cada palabra: Axiona Topo → la norma → los planos → el modelo 3D → el presupuesto. |
| 1:22 | Claude | Y al hacerlo, descubrimos algo revelador. La IA no sirve solo para hacer tareas más rápido: sirve para destruir la fricción entre la imaginación y la realidad. | «REVELADOR» y luego «FRICCIÓN». |
| 1:32 | Claude | Durante siglos, el ser humano ha sido esclavo del cómo: calcular a mano, alinear líneas en un plano, pelear con hojas de cálculo y lidiar con la burocracia técnica. | «EL CÓMO»; las cuatro tareas se tachan una por una. |
| 1:42 | Claude | La máquina absorbe esa fricción operativa y libera el qué: la intención. | «EL CÓMO → EL QUÉ» y «LA INTENCIÓN» en dorado. |

### Bloque 3 · ¿Quién se queda con el valor? (1:47 a 2:29)

| Tiempo | Quién | Texto | En pantalla |
|---|---|---|---|
| 1:47 | Presentadora | Aquí entra el dilema del empresario tradicional o del constructor que teme volverse obsoleto. | «¿OBSOLETO?». |
| 1:53 | Presentadora | Si un agente puede hacer un anteproyecto y cotizarlo en 20 minutos, ¿dónde queda el valor humano? | La app real; «¿Y EL VALOR HUMANO?». |
| 1:58 | Claude | El error es creer que la máquina tiene criterio de negocio. | «CRITERIO DE NEGOCIO». |
| 2:02 | Claude | La máquina procesa el costo directo, los metros cuadrados y el cumplimiento normativo con precisión matemática. Pero el negocio real se juega en el nivel comercial y humano. | Presupuesto real (barras que reaccionan a la voz) y la balanza «LA MÁQUINA / EL HUMANO». |
| 2:12 | Presentadora | Exacto. El APU es la base matemática. Pero la negociación, los acuerdos con proveedores, la lectura del cliente y el riesgo comercial dependen de la capacidad y las conexiones del empresario. | «APU» y la balanza. |
| 2:24 | Presentadora | La IA no te reemplaza: te quita lo repetitivo para que te concentres en liderar y cerrar negocios. | «LO REPETITIVO» y luego «CRITERIO HUMANO» en dorado. |

### Bloque 4 · La pregunta para ustedes (2:30 a 3:08)

| Tiempo | Quién | Texto | En pantalla |
|---|---|---|---|
| 2:31 | Claude | La verdadera pregunta que debemos hacernos como industria no es si la tecnología va a avanzar. Es esta: | «LA PREGUNTA». |
| 2:37 | Claude | ¿Estás usando este momento para construir tus propias herramientas y liderar tu mercado? ¿O sigues compitiendo contra la máquina haciendo tareas repetitivas? | Opción A en cian y opción B en gris. |
| 2:46 | Presentadora | Y queremos saber qué opinan ustedes, los que lo ven desde afuera. | Tarjeta dorada: «¿QUÉ OPINAN USTEDES, LOS QUE LO VEN DESDE AFUERA?». |
| 2:50 | Presentadora | ¿Sienten que la tecnología es una amenaza para su profesión o están listos para dirigir su propia flota de agentes? Déjenlo en los comentarios. | Las dos preguntas y «DÉJENLO EN LOS COMENTARIOS». |
| 2:58 | Claude | Esto fue Axiona Podcast. Sigan construyendo con criterio. Nos vemos en el próximo despliegue. | Cierre con el logo, axionasoft.com, WhatsApp y obra.axionasoft.com. |

## Guía de diseño visual

### Paleta

| Uso | Color |
|---|---|
| Fondo | Grafito `#0B0F19` con retícula tenue y dos luces que se mueven despacio |
| Agentes, máquina y datos | Cian `#00F2FE` |
| Valor humano, estrategia y negocio | Dorado `#D4AF37` |
| Lo que se deja atrás (el cómo, lo repetitivo, la superficie) | Gris |

### Composición: una mesa de trabajo digital

- **Izquierda, los dos hablantes.**
  - La presentadora es un núcleo dorado con anillos y barras radiales.
  - Claude es un motor cian de anillos que gira más rápido cuando habla.
  - Los dos siguen la intensidad real de su voz cuadro por cuadro, con una onda de los últimos 2 s.
  - Quien habla se ilumina y quien escucha se atenúa.
- **Centro, el escenario.** Cambia cada 3 a 4 s, o en la palabra exacta del guion. Todo es material real de Axiona:
  - el glamping en 3D girando;
  - la app publicada en obra.axionasoft.com;
  - la consola con los nombres reales de las pruebas («Tests 185 passed (185)»);
  - el presupuesto real de la mansión campestre ($1.669.350.583), con barras que reaccionan a la voz;
  - las láminas de planos y Axiona Topo.
- **Tipografía cinética.** Cada palabra clave («FRICCIÓN», «EL CÓMO → EL QUÉ», «APU», «CRITERIO HUMANO»…) se escribe primero en letra de máquina con cursor y queda en una sans geométrica gruesa con halo, sobre líneas de código que corren al fondo.
- **Arriba:** marca, título del episodio y el bloque en curso.
- **Abajo:** subtítulos con el nombre de quien habla en su color, y la nota «Voces sintéticas · guion de Axiona escrito con Claude (Anthropic)».
- **Transiciones** de 0,25 s entre tomas, y música ambiental (acordes largos) que baja sola cuando alguien habla.

## Para YouTube

**Título:** El propósito y el para qué de la IA | Axiona Podcast

**Descripción:**

```
¿Para qué sirve realmente la inteligencia artificial hoy? No para hacer tareas más rápido: para destruir la fricción entre la imaginación y la realidad.

En este episodio, una presentadora y Claude, el agente de IA con el que Santiago construye Axiona, conversan sobre el salto de la escasez operativa al propósito humano: la máquina hace el cálculo bruto (APU, normas, planos) y el criterio humano, la estrategia comercial y las conexiones siguen mandando.

¿Y ustedes, que lo ven desde afuera? ¿Amenaza o una flota de agentes a su servicio? Los leemos en los comentarios.

Capítulos
0:00 Apertura: el espejismo del futuro
0:51 El fin de la fricción: del cómo al qué
1:46 ¿Quién se queda con el valor?
2:30 La pregunta para ustedes

Las voces son sintéticas. El guion lo escribió Axiona con Claude, de Anthropic.
Axiona Obra, gratis: obra.axionasoft.com
WhatsApp +57 310 392 2935 · axionasoft.com

Axiona Desarrollos Inteligentes · Sabaneta, Antioquia

#inteligenciaartificial #ClaudeAI #agentesdeia #construccion #arquitectura
```

Al subirlo, en «Contenido alterado o sintético» marca que sí: las voces son generadas.

## Cómo se rehace

```
# Medios: MEDIOS/orbita (node ../reel-glamping/generador/tomas.cjs orbita 1280 720), heroe/, noche/, ui/ y glamping/ (tomas del glamping),
#         obra/ (../motor-ia/generador/obra.cjs contra la app publicada) y topo/ (../topo-walter/tomas)
python3 generador/voz.py CARPETA_MODELOS SALIDA
AXIONA_FUENTES=CARPETA_FUENTES python3 generador/video.py axiona-podcast-proposito.mp4 --medios MEDIOS --tiempos SALIDA/tiempos.json --voz SALIDA/voz.wav
```
