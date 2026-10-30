# Axiona Topo · el topógrafo en tu celular

Axiona Topo mide el lote con el celular: el lindero con GPS, cámara o cinta, y las cotas con la mira. Con eso entrega:
- área, medidas y rumbos;
- curvas de nivel y pendientes;
- el corte y el relleno de la plataforma de la obra, con los viajes de volqueta;
- el terreno en 3D con rayos X, que también se muestra en realidad aumentada, en pequeño, sobre la mano o una mesa.

Todo pasa en el navegador, sin estación total, sin trípode y sin libreta:
- **El celular mide** en el lote.
- **El computador** recibe en vivo lo medido, lo revisa y saca el **plano topográfico en PDF** (A3 o carta), con cuadro de coordenadas, linderos, curvas, escala normalizada y rótulo para la firma del topógrafo.
- **En la obra**, el **replanteo en AR** pone estacas virtuales donde va la casa, cada una con lo que hay que cortar o rellenar.

El levantamiento se comparte con un enlace y abre en Axiona Obra para diseñar la casa.

## Celular y computador en vivo

Un equipo abre la sesión y muestra un código QR, y el otro lo escanea. Cada cambio viaja comprimido y **cifrado con AES-GCM de 256 bits** por un canal de paso, [ntfy.sh](https://ntfy.sh), gratuito y de código abierto. La llave va en el enlace después del `#`, y el navegador nunca la manda a ningún servidor. Gana el cambio más reciente.

- Cabe un levantamiento de unos 150 puntos por mensaje (el límite de ntfy es de 4 KB).
- Si el uso crece, ntfy se puede montar en un servidor propio sin cambiar la app.

Para probarlo de punta a punta: `node --experimental-eventsource tests/envivo.e2e.mjs`.

Sitio: https://topo.axionasoft.com

## Cómo se mide

| Método | Cómo funciona | Precisión |
|---|---|---|
| GPS | En cada esquina junta lecturas unos 12 s y las promedia. Descarta las malas y los saltos, y pondera por la precisión que reporta el celular. Pasa de latitud y longitud a metros por ECEF y plano local este-norte. | ±2 a 5 m a cielo abierto |
| Cámara (AR) | WebXR con detección de superficies (Android con ARCore). Cada toque es un punto 3D. | ±2 a 5 cm hasta 10 m |
| Cinta | Lados y diagonales desde la esquina 1, como miden los maestros. Cada triángulo sale del corte de dos círculos. Una medida de comprobación (2→4) da el error de cierre. | La de la cinta |
| Mira | Nivelación trigonométrica con el ángulo vertical de los sensores: con distancia a cinta, `dH = D·tan α + hi − ht`; con una mira de largo L, `D = L / (tan α_punta − tan α_pie)`. | ±3 a 15 cm de cota, según distancia y pulso |
| Archivo | Puntos PNEZD, PENZD o XYZ de una estación total. | La del equipo |

## Cómo se calcula

- **Terreno:** red de triángulos de Delaunay (Delaunator, predicados exactos) recortada al lindero. La cota de un punto se interpola en línea recta dentro de su triángulo.
- **Curvas de nivel:** cada triángulo corta un nivel en un segmento, y los segmentos se unen en polilíneas.
- **Pendiente:** el gradiente del plano de cada triángulo. Se informan la general (plano promedio), la fuerte (95 % del área) y hacia dónde corre el agua.
- **Corte y relleno:** integral exacta entre el terreno y la plataforma horizontal Z0. Cuando un vértice queda solo a un lado, su cuña vale `A·h³ / (3·(h−h₁)·(h−h₂))`. La plataforma de equilibrio es la cota media del terreno. Se puede limitar a la huella de la obra, que se recorta por Sutherland-Hodgman.
- **Volquetas:** el volumen sale con un esponjamiento del 25 %, en viajes de 6 o 14 m³.

## Importante

- Es un levantamiento preliminar: sirve para el anteproyecto, la cotización y para decidir. El plano oficial para la licencia lo firma un topógrafo con licencia profesional.
- Los rayos X muestran el modelo: la tierra a cortar o rellenar y la profundidad hasta la plataforma. El celular no ve lo que hay enterrado. Para eso hacen falta un georradar o el estudio de suelos.

## Desarrollo

```
cd topo
npm install
npm run dev     # http://localhost:8161
npm test        # pruebas del motor
npm run build   # dist/
```

Se publica en Netlify desde esta carpeta, con su propio `netlify.toml`, aparte de Axiona Obra.
