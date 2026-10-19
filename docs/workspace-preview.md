# Workspace preview — contrato de superficie

Modo: Operate. Espacio SQL local preparado para integración posterior: exploración, edición, resultados ilustrativos y borrador de ayuda. Ninguna acción implica consultas ejecutadas ni respuestas de un modelo real.

## Direction contract

**THESIS:** conservar el boceto: árbol estrecho a la izquierda y tres regiones apiladas a la derecha. La interacción debe servir a esa composición, sin dashboard de tarjetas ni nuevos servicios.

**OWN-WORLD:** negro y amarillo existentes, celdas de terminal, gris para jerarquía, marco redondeado y separadores únicos. Foco y arrastre amarillos. Sin nuevas fuentes, imágenes ni animación.

**STORY:** filtrar/seleccionar tablas, editar SQL y ajustar el espacio con el ratón; reconocer que resultados y asistente no están conectados. El usuario puede salir con el ratón sin sacrificar Q como carácter.

**FIRST VIEWPORT:** cabecera con Salir y pie de ayuda; explorador inicial de 26/22 columnas; editor sobre resultados y asistente. Separadores arrastrables, mínimos de cuatro/cinco/tres filas. Compacto sin explorador y estado mínimo bajo 40×20.

**FORM:** composición fijada por la referencia del usuario, ampliada con edición y ratón por petición expresa. Edición nativa OpenTUI con números de línea vinculados, selección y scroll. Captura temporal durante arrastre; el redimensionado conserva los buffers.

**FINISH:** verificar frames amplios/compactos, edición, cursor y selección, foco, ratón, scrollbars, límites y cancelación de arrastre, redimensionado y salida. Tipos, pruebas y documentación al día. No hay imágenes raster distribuidas.

## Estado y límites

`demoWorkspace` sigue proporcionando los datos ficticios. El contenedor mantiene en memoria consultas, borrador, filtro, esquemas cerrados, tabla/fila seleccionadas, foco y tamaños preferidos. Los componentes reciben datos y callbacks de interfaz; no conocen servicios ni conexiones.

`workspaceLayout` aplica mínimos y conserva el ancho útil principal. El estado de arrastre contiene las coordenadas/tamaños iniciales y se descarta al soltar, pulsar Escape o redimensionar. Árbol, tabla y editores usan los mecanismos nativos de OpenTUI.

No hay conexión, ejecución SQL, envío al LLM, almacenamiento ni variables de entorno nuevas. Cualquier integración futura requerirá una petición independiente.
