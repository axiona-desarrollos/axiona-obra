# Qué medir con Axiona Topo para la fase de planos

Video vertical de 2 min 23 s para Walter (y para cualquier topógrafo, maestro o arquitecto que mida un lote para Axiona). Explica qué tiene que medir con Axiona Topo y qué documentos pedir para que Axiona Obra saque los planos.

| Pieza | Archivo |
|---|---|
| Video 1080 × 1920 con voz en español latino y subtítulos | `axiona-topo-que-medir.mp4` |
| Pantallas reales de Axiona Topo y Axiona Obra | `tomas/` |
| Generador: pantallas, voz y video | `generador/` |

## Lo que tiene que entregar

### 1. Las esquinas del lote, desde el frente

- **P1:** una esquina del frente, sobre la línea del andén.
- **P2:** la siguiente, también en el frente.
- **El resto:** sigue alrededor del lote, siempre en el mismo sentido, hasta volver a P1.
- **Por qué importa:** Axiona Obra toma el lado P1 → P2 como la fachada hacia la calle. Si no quedó así, se puede cambiar en Obra › Terreno › Frente (calle).

### 2. Con qué medir

- **Cinta métrica:** lados y diagonales desde P1, más una medida de comprobación. Topo da el error de cierre. Sirve para planos.
- **GPS con antena RTK:** ±1 a 3 cm. Sirve para planos.
- **Cámara (Android con ARCore):** ±2 a 5 cm hasta 10 m.
- **GPS del celular:** ±2 a 5 m. Solo para fincas y para tantear, no para planos.
- **Estación total:** se importan los puntos (PNEZD, PENZD o XYZ).

### 3. Las cotas

- Antes de empezar, calibra la mira con las dos lecturas contra un libro, como indica la app.
- La cota de cada esquina.
- Puntos de nivel por dentro del lote:
  - el punto más alto;
  - el más bajo;
  - donde cambia la pendiente;
  - más o menos cada 5 a 10 m.
- El nivel del andén al frente. De ahí sale el nivel del primer piso.

### 4. Lo que ya hay en el lote

- Árboles grandes, postes, cajas de agua y alcantarillado, quebradas, muros y construcciones.
- Una foto de cada cosa, con la esquina o el punto más cercano.

### 5. Revisar y enviar

- Revisa en el computador, en vivo, que el lote cierre bien.
- Toca «Abrir en Axiona Obra»: el lote llega con sus medidas y cotas.
- Envía también el plano topográfico en PDF y el archivo de puntos.

### 6. Lo que no se mide: dos documentos

| Documento | Quién lo da | Qué trae |
|---|---|---|
| Certificado de uso del suelo o norma urbanística | Planeación del municipio | Uso permitido, índice de ocupación, altura máxima, retiros de frente, fondo y lados |
| Estudio de suelos | Un laboratorio, con perforaciones | Capacidad portante, profundidad de cimentación, nivel freático |

Los dos se suben en Axiona Obra › Proyecto › Adjuntar documentos. La app lee los datos y una persona los revisa y aprueba. Topo no reemplaza el estudio de suelos: el tipo de suelo que se escoge en Topo solo sirve para calcular el esponjamiento y los viajes de volqueta.

El levantamiento de Topo es preliminar: sirve para el anteproyecto, la cotización y para decidir. El plano oficial para la licencia lo firma un topógrafo con tarjeta profesional.

## Texto para WhatsApp

```
Walter, este video explica qué medir con Axiona Topo para que Axiona Obra saque los planos:

1. Esquinas: empieza en una del frente (P1), la siguiente también en el frente (P2), y sigue alrededor hasta volver a P1.
2. Con cinta o antena GPS RTK (el GPS del celular solo da de 2 a 5 m).
3. Cotas: cada esquina, puntos de nivel cada 5 a 10 m y el nivel del andén.
4. Lo que ya hay: árboles, postes, cajas, quebradas, muros, con foto.
5. «Abrir en Axiona Obra» y envíanos el PDF y el archivo de puntos.
6. Pide en Planeación el certificado de uso del suelo, y el estudio de suelos al laboratorio. Se suben en Axiona Obra › Proyecto › Adjuntar documentos.

topo.axionasoft.com · obra.axionasoft.com
```

## Cómo se rehace

Hace falta lo siguiente:
- Python 3 con Pillow, NumPy y `kokoro-onnx`;
- ffmpeg con libx264;
- Playwright;
- las fuentes y modelos de voz de `../servicio-redes`.

```
# 1. Pantallas: Axiona Topo en :8171 y Axiona Obra en :4173 (vite preview)
node generador/tomas.cjs
# 2. Voz (Kokoro, «em_alex»)
python3 generador/voz.py CARPETA_MODELOS SALIDA
# 3. Video
AXIONA_FUENTES=CARPETA_FUENTES python3 generador/video.py axiona-topo-que-medir.mp4 --tiempos SALIDA/tiempos.json --voz SALIDA/voz.wav
```
