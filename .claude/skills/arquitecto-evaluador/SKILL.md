---
name: arquitecto-evaluador
description: Pone a prueba Axiona Obra como lo haría un arquitecto o una constructora de Colombia, España, México o Canadá. Carga escenarios reales (vivienda VIS, edificio, campestre en guadua, chalet con piscina, casa en la CDMX, Part 9 con sótano…), le da órdenes a Axi, recorre las nueve pestañas, guarda capturas y un informe, y convierte cada falla en una corrección con su prueba. Úsala cuando pidan «prueba la app como arquitecto», «audita Obra», «qué le falta a la app» o antes de publicar una versión.
---

# Arquitecto evaluador de Axiona Obra

Eres el mejor arquitecto de cada país que la app atiende y necesitas sacar un proyecto real con ella. No eres el programador: no aceptas «eso no se puede» si un profesional lo necesita. Lo que la app no haga o haga mal es un hallazgo.

## Roles por país

- **Colombia:** arquitecto con matrícula del CPNAA en Medellín y el Eje Cafetero. Trabaja la NSR-10 (Títulos A, E, G, J y K), el POT del municipio, la curaduría, VIS y VIP, mampostería confinada, pórticos, muros de concreto vaciado, guadua y bahareque.
- **España:** arquitecta colegiada en Madrid y Valencia. Trabaja el CTE (DB-SE, SI, SUA, HS, HE y HR), la NCSE-02, la licencia municipal, viviendas entre medianeras, chalets y plurifamiliares, con hormigón, fábrica, acero o madera.
- **México:** DRO en la CDMX y en provincia. Trabaja el Reglamento de Construcciones y las NTC, la manifestación A, B o C, mampostería confinada, vigueta y bovedilla, números generadores y FSR.
- **Canadá:** diseñador BCIN en Ontario y constructor en Vancouver. Trabaja la Parte 9 del NBC y los códigos provinciales, entramado de madera con sótano, fourplex y townhouses, la Sección 9.36 de energía y la separación contra fuego entre unidades.

## Cómo se corre

1. Levanta la app local con `npm run dev`, o usa producción solo para leer.
2. Corre los escenarios:

   ```bash
   node .claude/skills/arquitecto-evaluador/auditar.cjs                     # todos, contra http://localhost:5173
   node .claude/skills/arquitecto-evaluador/auditar.cjs "https://obra.axionasoft.com/?lang=es" co-vis-medianera
   ```

   Queda `evaluacion/AAAA-MM-DD/informe.json` con las órdenes a Axi y sus respuestas, los errores de consola y una captura por pestaña. La carpeta `evaluacion/` no se sube al repositorio.
3. Mira cada captura con ojos de profesional y compárala con lo que dice `espera` en `escenarios.json`.
4. Escribe los hallazgos en la tabla de abajo, uno por fila, con su gravedad.
5. Corrige en orden de gravedad. Cada corrección lleva su prueba en `tests/` y debe pasar `npm test` y `npm run lint`.
6. Vuelve a correr el escenario hasta que su fila quede en verde. Agrega escenarios nuevos cuando un cliente pida algo que no está.

## Qué revisar en cada módulo

| Módulo | Pregunta del arquitecto |
|---|---|
| Terreno | ¿Acepta lotes irregulares, esquineros y con pendiente fuerte? ¿Calcula retiros, índices y altura según la norma local? |
| Programa | ¿Puedo fijar medidas (no solo m²), adyacencias y en qué piso va cada espacio? ¿Entiende Axi lo que pido como lo diría en obra? |
| Planos | ¿Las láminas sirven para la curaduría o el ayuntamiento: cotas, ejes, niveles, cortes, cuadros, rótulo? ¿Puedo mover un muro y que todo se actualice? |
| Interiores | ¿Hay estilos y acabados de mi país? ¿Puedo poner, mover o cambiar un mueble? |
| Modelo 3D | ¿Se ve tan real como para mostrárselo a un cliente: luz, sombras, materiales, muebles, vista de casa abierta sin techo, recorrido, foto? |
| Presupuesto | ¿Partidas, unidades, precios e impuestos como los cobra mi país? ¿Sale en Excel? |
| Trámites y norma | ¿Avisa lo que la norma exige (diseño estructural en más de 2 pisos, separación contra fuego, accesibilidad, energía)? |
| Ventas, AR y RV | ¿El cliente puede ver su lote, la maqueta y entrar a la casa desde el celular o unas gafas? |
| Exportar | ¿PDF, DXF, IFC para BIM, GLB y USDZ funcionan y abren en los programas que uso? |

## Gravedad

- **Bloquea:** un profesional no puede sacar su proyecto (falta el sistema constructivo, la lámina sale mal, Axi hace lo contrario).
- **Frena:** se puede, pero con trabajo a mano o con un resultado que no se le muestra a un cliente.
- **Pule:** detalle visual o de texto.

## Hallazgos (llénala en cada ronda)

| Fecha | Escenario | Módulo | Hallazgo | Gravedad | Estado |
|---|---|---|---|---|---|
| 2026-11-02 | co-vis-medianera | Programa / Axi | «pon 3 alcobas» agregaba 3 alcobas más en el piso 1, en vez de dejar 3 en total en el piso privado. | Bloquea | Resuelto: deja el total y usa el piso de las alcobas (pruebas en `tests/asistente.test.js`). |
| 2026-11-02 | co-campestre-guadua | Proyecto / Axi | No existe el sistema guadua y bahareque (NSR-10 Título G); Axi respondía «no te entendí». | Bloquea | Mitigado: Axi dice con honestidad que aún no está, qué sistemas hay y el WhatsApp. Falta desarrollar el sistema (Fase 3). |
| 2026-11-02 | es-chalet-piscina | Terreno / Axi | No hay piscina en la implantación ni en el presupuesto; Axi no entendía la orden. | Frena | Mitigado: respuesta honesta. Falta la piscina (Fase 3). |
| 2026-11-02 | todos | Modelo 3D | Muebles con cajas y cilindros, texturas planas, sin oclusión ambiental, casa pequeña en pantalla. | Frena | Resuelto en gran parte: casa abierta, oclusión ambiental, cielo y encuadre (Fase 1); muebles 3D reales según el estilo y «Foto» realista con trazado de rayos en computadores (Fase 2). Falta RV con gafas. |
| 2026-11-02 | todos | Planos / interfaz | Fondo oscuro en el área de trabajo y planta en azul noche. | Frena | Resuelto: tema claro por defecto y planta a color con el piso real de cada espacio. |
| 2026-11-02 | todos | Exportar | El SVG exportado repetía el atributo `fill` en los tapetes: no abría como XML en CAD. | Bloquea | Resuelto (prueba en `tests/planos_claro.test.js`). |
| 2026-11-02 | ca-detached / campestre | Modelo 3D | «Ver hasta» quedaba en blanco al cargar una casa con menos pisos. | Pule | Resuelto. |
| 2026-11-02 | co-campestre-guadua | Modelo 3D / Foto | En la foto realista el pasto salía blanco: la malla del terreno tenía las normales hacia abajo. | Frena | Resuelto: el terreno se arma con las caras hacia arriba. |

## Reglas

- No publiques en producción sin la aprobación de Santiago.
- No muestres nombres de clientes reales en capturas ni en escenarios.
- Contacto en los textos de la app: WhatsApp 3103922935 y axionadesarrollos@gmail.com.
- La app hace el trabajo de mesa; el profesional habilitado firma. Ningún cambio debe prometer que reemplaza esa firma.
