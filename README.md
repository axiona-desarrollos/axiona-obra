# Axiona Obra · del lote a la obra en 3D

**Úsala gratis:** https://obra.axionasoft.com — en el navegador del computador, Android o iPhone. Se instala como app y funciona sin señal.

![Axiona Obra](public/compartir.jpg)

Escribes (o mides con el celular) las esquinas del lote y los espacios que quieres, y Axiona Obra arma el anteproyecto completo:

1. **Terreno** — área, linderos con azimut, pendiente, curvas de nivel, plataforma y movimiento de tierras (corte y relleno).
2. **Programa** — los espacios se distribuyen solos en la huella construible, con muros, puertas, ventanas y escalera.
3. **Planos** — implantación, plantas por piso y cimentación con ejes, cotas, zapatas y replanteo desde P1.
4. **Modelo 3D** — diez fases de obra: terreno, explanación, cimentación, estructura, mampostería, cubierta, pañetes, pintura, pisos y carpintería.
5. **Cantidades y presupuesto** — por capítulos, en pesos colombianos y editables, con materiales y cronograma.
6. **Realidad aumentada** — mide el lote caminándolo (Android) y mira la casa sobre el terreno real o como maqueta (Android y iPhone).

Exporta planos a **DXF** (AutoCAD, BricsCAD), el plano actual a **SVG**, el modelo a **GLB** y **USDZ**, el presupuesto a **CSV** y el proyecto a **JSON**. El botón **Compartir** mete el proyecto entero en un enlace: quien lo abre ve la misma casa. Nada se sube a ningún servidor.

Hecho por [Axiona Desarrollos Inteligentes S.A.S.](https://axionasoft.com) (Sabaneta, Colombia).

## Cómo distribuye los espacios

El motor (`src/motor/`) no arma una sola distribución: para cada piso prueba decenas de variantes (orden de los espacios por zona, reparto en un sentido o en el otro), las dos posiciones de la escalera y tres formas de casa, y se queda con la de menos castigos:

- espacio sin puerta;
- espacio habitable sin fachada (sin ventana);
- espacio más angosto de lo útil (2.4 m alcobas y sala, 1.8 m servicios, 1.2 m baños) o muy alargado;
- sala lejos de la entrada, alcobas hacia la calle o alcoba que se atraviesa para llegar a otra.

Todo se calcula en el **marco del frente**: el lado del lote que da a la calle es el eje x. Así la casa se alinea con el frente aunque el lote venga girado o medido en AR.

## Desarrollo

```bash
npm install
npm run dev        # http://localhost:8160
npm test           # pruebas del motor (Vitest)
npm run build      # versión pública en dist/
```

Estructura:

| Carpeta | Qué hay |
|---|---|
| `src/motor/` | Cálculo puro, sin DOM: geometría, distribución, modelo, cantidades, cronograma. Se prueba en Node. |
| `src/ui/` | Planos SVG, utilidades de interfaz, enlace para compartir. |
| `src/vista3d/` | Modelo 3D por fases con [three.js](https://threejs.org). |
| `src/ar/` | Realidad aumentada: WebXR (Android) y AR Quick Look (iPhone). |
| `src/exportar/` | DXF, CSV, GLB y USDZ. |
| `tests/` | Pruebas del motor. |

## Alcance y responsabilidad

Es **predimensionamiento para anteproyecto y estimación**. Las cargas son supuestas (1.0 t/m² por nivel), las columnas se predimensionan por número de pisos y las zapatas por capacidad portante del suelo elegido. El diseño estructural, el estudio de suelos y la licencia de construcción requieren profesionales con matrícula vigente conforme a la **NSR-10** y la **Ley 400 de 1997**. Los precios unitarios son de referencia y se deben cambiar por cotizaciones reales.

## Licencia

[MIT](LICENSE) © Axiona Desarrollos Inteligentes S.A.S. — Motor 3D: three.js (MIT).
