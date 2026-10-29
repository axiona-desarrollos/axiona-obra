# Axiona Obra · del lote al juego de planos, el 3D amoblado y la obra

**Úsala gratis:** https://obra.axionasoft.com. Funciona en el navegador del computador, en Android y en iPhone. Se instala como app y abre sin señal.

![Axiona Obra](public/compartir.jpg)

Escribes el lote o lo mides con el celular, eliges el país y escribes los espacios que quieres. Con eso, Axiona Obra hace el trabajo de mesa que antes tomaba semanas. El profesional habilitado lo **lee, verifica y firma**.

## Qué hace

1. **País (Colombia, España o Canadá).** Cada uno carga lo suyo:
   - normas y trámites antes de construir, con sus fuentes;
   - moneda y unidades (en Canadá, pies y pulgadas);
   - sistema constructivo: pórticos de concreto o mampostería confinada (NSR-10 Título E), hormigón y ladrillo, o entramado de madera con sótano;
   - techo típico, formato de láminas, quién firma y precios calibrados con rangos de mercado.
2. **Terreno.** Calcula:
   - área, linderos con azimut y pendiente;
   - curvas de nivel, plataforma, corte y relleno;
   - retiros e índices;
   - capacidad portante del estudio de suelos, sismo, nieve y helada.
3. **Programa.** Reparte los espacios en la huella:
   - pone muros, puertas, ventanas, escalera y ascensor;
   - escoge la mejor de muchas distribuciones posibles;
   - revisa en automático los espacios sin puerta o sin ventana, las proporciones, el Título E de la NSR-10, la Parte 9 en Canadá y la NCSE-02 en España.
4. **Juego de planos en PDF.** Son unas 15 láminas como las de una oficina:
   - portada con índice, localización y cuadro de áreas;
   - una planta por piso con muebles, cotas, ejes y códigos de puertas y ventanas;
   - planta de cubierta, cuatro fachadas y dos cortes;
   - cimentación y replanteo;
   - planos eléctricos e hidrosanitarios;
   - cuadros de puertas, ventanas y acabados;
   - detalles constructivos y resumen de presupuesto.

   Cada lámina lleva rótulo, firmas y matrícula, sello oficial, revisiones y su código según la costumbre del país. La escala se escoge sola. También sale en DXF para AutoCAD.
5. **Interiores.** Hay cinco estilos: moderno, cálido, lujo, nórdico y campestre. Cada uno pone pisos, enchapes, maderas y telas. La casa se amobla sola (camas, sofás, comedor, cocina, baños, clósets, cortinas, cuadros, plantas y jardín); cada mueble se puede quitar.
6. **Modelo 3D.** Tiene once fases, del terreno a la entrega amoblada. También permite:
   - verla sin techo, piso por piso;
   - recorrerla a pie;
   - usar el ascensor por voz («piso tres» o «third floor») sin perder los botones.
7. **Presupuesto.** Muestra:
   - las partidas de cada país;
   - los costos indirectos: AIU con IVA sobre la utilidad, gastos generales con beneficio e IVA, u overhead con imprevistos e impuesto;
   - cuánto cuesta el m² frente al rango del mercado;
   - los materiales principales y el cronograma.
8. **Adjuntar documentos.** Lee un PDF con texto (estudio de suelos, norma urbanística, escrituras, memoria), un DXF o un .txt. Saca medidas, linderos, capacidad portante, desplante, retiros, pisos, alcobas, propietario, predio y profesionales. Cada dato muestra el fragmento de donde salió, para que una persona lo apruebe antes de aplicarlo.
9. **Ventas.** Arma el condominio: lotes a lado y lado de una vía, con la casa en cada lote y su estado (libre, reservado o vendido). El cliente lo ve en 3D o como maqueta en realidad aumentada, escoge su lote y entra caminando a la casa.
10. **Domótica.** En Canadá trae las opciones del frío: sensores de fuga y congelamiento, cables antihielo, respaldo eléctrico y monitor de radón. En los otros países trae cerradura, iluminación, persianas, cámaras y paneles solares. Todo sale en el plano eléctrico y en el presupuesto.
11. **¿El proyecto va bien encaminado?** Un semáforo junta:
    - los trámites;
    - los avisos del diseño;
    - el costo por m²;
    - los profesionales en el rótulo;
    - la aprobación del profesional.

Exporta el juego de planos en **PDF** y **DXF**, la vista actual en **SVG**, el modelo en **GLB** y **USDZ**, el presupuesto en **CSV** y el proyecto en **JSON**. «Compartir» mete el proyecto entero en un enlace. Nada se sube a ningún servidor.

Hecho por [Axiona Desarrollos Inteligentes S.A.S.](https://axionasoft.com) (Sabaneta, Colombia).

## In English

Axiona Obra turns a lot and a room list into a preliminary design package for **Colombia, Spain or Canada**. It includes:
- a complete PDF drawing set (plans, elevations, sections, roof, foundation, electrical, plumbing, schedules, details), with title blocks ready for the professional's seal;
- a furnished 3D model with a walkthrough and a voice-controlled elevator;
- an AR site visit;
- a country-specific budget and permit checklist;
- a document reader that pre-fills fields from PDFs;
- a subdivision tool for sales offices.

Canadian projects use feet and inches, Part 9 wood-frame with basement, and English sheets (A0.0, A1.0, A2.1…). It is free, open source and runs fully in the browser.

## Desarrollo

```bash
npm install
npm run dev        # http://localhost:8160
npm test           # pruebas del motor (Vitest)
npm run build      # versión pública en dist/
```

| Carpeta | Qué hay |
|---|---|
| `src/motor/` | Cálculo puro, sin DOM, que se prueba en Node: geometría, países, distribución, amoblado, redes, cubierta, fachadas y cortes, cuadros, cantidades, cronograma, domótica, lector de documentos y loteo. |
| `src/ui/` | Planos SVG, láminas y PDF, dibujo de primitivas, lector de archivos y enlace para compartir. |
| `src/vista3d/` | 3D con [three.js](https://threejs.org): fases, texturas hechas por programa, muebles, recorrido, ascensor y condominio. |
| `src/ar/` | Realidad aumentada: WebXR en Android y AR Quick Look en iPhone. |
| `src/exportar/` | DXF, CSV, GLB y USDZ. |
| `tests/` | Pruebas del motor. |

## Alcance y responsabilidad

Es **predimensionamiento para anteproyecto y estimación**:
- Las cargas son supuestas (1,0 t/m² por nivel).
- Las columnas se predimensionan por número de pisos.
- Las zapatas salen de la capacidad portante.
- Las redes son esquemáticas.

El diseño estructural, el estudio de suelos, los diseños de redes y la licencia o permiso los firman profesionales habilitados en cada país:
- **Colombia:** NSR-10 y Ley 400 de 1997.
- **España:** CTE y Código Estructural.
- **Canadá:** el código de construcción de la provincia.

Hasta que el profesional marca el proyecto como revisado y aprobado, cada lámina dice «Anteproyecto · para revisión». Los precios son de referencia y hay que reemplazarlos por cotizaciones. Las normas y los trámites se verificaron en octubre de 2026 con las fuentes que muestra la app, y cambian: hay que confirmarlos con la autoridad local.

## Licencia

[MIT](LICENSE) © Axiona Desarrollos Inteligentes S.A.S. Motor 3D: three.js (MIT). PDF: jsPDF y svg2pdf.js (MIT). Lectura de PDF: pdf.js (Apache 2.0).
