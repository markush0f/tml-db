# Espacio de trabajo de terminal

Interfaz local interactiva basada en el boceto del usuario. La terminal proporciona la fuente monoespaciada y el tamaño de celda. Sin animaciones.

## Composición

Marco exterior redondeado, cabecera y pie de una fila. La cabecera incluye `[Salir]`, accesible con el ratón. El cuerpo tiene una división vertical y dos horizontales; sin tarjetas ni separadores duplicados.

Explorador de 26 columnas desde 100 columnas; de 22 entre 80 y 99 (incluido su separador). Campo de filtro, recuento de coincidencias y árbol desplazable. Los esquemas se abren/cierran con clic; las tablas se seleccionan con clic. La tabla seleccionada usa fondo gris y marcador `>` amarillo para no depender solo del color. Filtro vacío sin coincidencias: mensaje explícito `Sin coincidencias`.

A la derecha: Consultas con gutter vinculado al editor y palabras clave SQL amarillas; Resultados con columnas alineadas, selección de fila y scroll; Asistente LLM con estado no conectado y editor de borrador. Los títulos de la región enfocada son amarillos. Cursor amarillo y selección gris/amarilla.

## Redimensionado

Tres separadores de una celda, amarillos al apuntarlos o arrastrarlos. La línea vertical modifica el ancho del explorador (mínimo 18 columnas incluido el separador), dejando al menos 36 para el área principal. La línea sobre Resultados redistribuye altura entre consultas y tabla. La línea inferior redistribuye resultados/asistente sin mover la división superior.

Mínimos: Consultas cuatro filas, Resultados cinco y Asistente tres, sin contar los separadores. Tamaños iniciales aproximados: 60/25/15; los mínimos tienen prioridad. Captura de ratón durante el arrastre, incluso al salir del separador, sin seleccionar texto accidentalmente. Soltar el botón, Escape o redimensionar la terminal termina el arrastre. Los tamaños se limitan al espacio disponible; los preferidos se recuperan al volver a ampliar la terminal.

## Colores

Tokens en `src/theme.ts`: fondo `#000000`, superficie `#111111`, selección `#292929`, texto `#f5f5f5`, secundario `#b8b8b8`, bordes `#777777`, acento `#ffdf00`. Amarillo para identidad, foco, selección, palabras clave y separadores activos. Sin brillos ni gradientes.

## Adaptación

De 40 a 79 columnas se oculta el explorador y la cabecera muestra `demo_local · DEMO`. La tabla omite email cuando su panel tiene menos de 56 columnas, también al ampliar mucho el explorador. Por debajo de 40 columnas o 20 filas se muestra `Terminal pequeña`, `Mínimo: 40×20` y salida con Ctrl+C o Salir. Los editores permanecen montados y conservan texto/historial, aunque no reciben entrada mientras están ocultos.

SQL no se envuelve; admite desplazamiento vertical y horizontal mediante rueda compatible. El borrador LLM sí se envuelve. Árbol y resultados tienen rueda y barras de desplazamiento nativas. Etiquetas largas se truncan con puntos suspensivos. Sin persistencia de ajustes.

## Teclado y alcance

Ctrl+C o clic en Salir cierra la aplicación; Q se escribe normalmente. Tab/Shift+Tab recorre consultas, resultados, asistente, filtro y árbol (los dos últimos solo si son visibles). Escape finaliza un arrastre y vuelve a consultas. Ctrl+Z deshace; Ctrl+Y/Ctrl+Shift+Z rehace. Enter añade líneas; Tab cambia foco.

Los resultados siguen siendo ficticios: editar SQL o seleccionar tablas no ejecuta consultas. El borrador LLM no se envía. Pruebas de renderer cubren edición, selección, ratón, scrollbars, foco, límites de arrastre, cancelación, redimensionado y salida. Contrato de superficie: `docs/workspace-preview.md`.
