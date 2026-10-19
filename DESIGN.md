# Espacio de trabajo de terminal

Maqueta estática orientada a lectura, basada en el boceto del usuario. La terminal proporciona la fuente monoespaciada y el tamaño de celda. No hay animaciones, foco ni cursor editable.

## Composición

Marco exterior redondeado, cabecera de una fila y pie de una fila. El cuerpo tiene una división vertical y dos horizontales; no hay tarjetas ni separadores duplicados.

Explorador de 26 columnas desde 100 columnas; de 22 entre 80 y 99. Conexión `demo_local`, filtro marcado como no disponible, recuento de ocho entidades y árbol de esquemas. La tabla `users` tiene fondo gris y marcador `>` amarillo para no depender solo del color. Otros indicadores son `v`, `>` y `-`.

A la derecha: Consultas con gutter numerado y palabras clave SQL amarillas; Resultados con columnas alineadas y tres filas ficticias; Asistente LLM con estado no conectado y prompt de texto sin interacción. Resultados recibe el 25% del cuerpo (mínimo seis filas), asistente el 15% (mínimo cuatro) y consultas el resto, aproximadamente 60% en terminales amplias. En alturas cortas los mínimos tienen prioridad.

## Colores

Tokens en `src/theme.ts`: fondo `#000000`, superficie `#111111`, selección `#292929`, texto `#f5f5f5`, secundario `#b8b8b8`, bordes `#777777` y acento `#ffdf00`. Amarillo reservado para identidad, selección y palabras clave; sin brillos ni gradientes.

## Adaptación

De 40 a 79 columnas se oculta el explorador, la cabecera muestra `demo_local · DEMO` y la tabla conserva `id` y `name`. Por debajo de 40 columnas o 20 filas se muestra `Terminal pequeña`, `Mínimo: 40×20` y salida con Q/Ctrl+C.

SQL y filas no se envuelven. Etiquetas largas se truncan con puntos suspensivos; el contenido se recorta al panel sin desplazar divisores. Sin scroll ni redimensionado manual. El pie identifica los datos ficticios y la ausencia de conexión.

## Comportamiento y evidencia

Únicas teclas activas: Q y Ctrl+C. Tab, flechas, Espacio, R y escritura no alteran la vista. Los datos son de demostración y no representan resultados ejecutados ni respuestas de un modelo.

Pruebas de renderer a 120×40, 80×24, 40×24, 30×16 y mínimo 40×20; comprueban contenido, alineación de tabla, límites, teclas inertes, salida y redimensionado de ida y vuelta. Contrato de superficie: `docs/workspace-preview.md`.
