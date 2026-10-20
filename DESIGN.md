# Espacio de trabajo de terminal

Interfaz local interactiva basada en el boceto del usuario. La terminal proporciona la fuente monoespaciada y el tamaño de celda. Sin animaciones.

## Composición

Marco exterior redondeado, cabecera y pie de una fila. La cabecera incluye `[Salir]`, accesible con el ratón. El cuerpo tiene una división vertical y dos horizontales; sin tarjetas ni separadores duplicados.

Espacio de explorador de 26 columnas desde 100 columnas; de 22 entre 80 y 99 (incluido su separador). Muestra DBHub local y `Explorador pendiente de conectar`, sin tablas ni controles ficticios. El componente de árbol se conserva para una integración posterior, pero no se monta en la aplicación activa.

A la derecha: Consultas con gutter vinculado al editor, palabras clave SQL amarillas y acción Ejecutar/Reconectar en el título; Resultados con columnas dinámicas alineadas, selección de fila por conjunto, scroll horizontal/vertical, recuento y duración; Asistente LLM con estado no conectado y editor de borrador. Los títulos de la región enfocada son amarillos. Cursor amarillo y selección gris/amarilla.

## Redimensionado

Tres separadores de una celda, amarillos al apuntarlos o arrastrarlos. La línea vertical modifica el ancho del explorador (mínimo 18 columnas incluido el separador), dejando al menos 36 para el área principal. La línea sobre Resultados redistribuye altura entre consultas y tabla. La línea inferior redistribuye resultados/asistente sin mover la división superior.

Mínimos: Consultas cuatro filas, Resultados cinco y Asistente tres, sin contar los separadores. Tamaños iniciales aproximados: 60/25/15; los mínimos tienen prioridad. Captura de ratón durante el arrastre, incluso al salir del separador, sin seleccionar texto accidentalmente. Soltar el botón, Escape o redimensionar la terminal termina el arrastre. Los tamaños se limitan al espacio disponible; los preferidos se recuperan al volver a ampliar la terminal.

## Colores

Tokens en `src/tui/theme.ts`: fondo `#000000`, superficie `#111111`, selección `#292929`, texto `#f5f5f5`, secundario `#b8b8b8`, bordes `#777777`, acento `#ffdf00`. Amarillo para identidad, foco, selección, palabras clave y separadores activos. Sin brillos ni gradientes.

## Adaptación

De 40 a 79 columnas se oculta el explorador. La cabecera muestra DBHub local y estado seguro de conexión, reservando espacio para Salir. La tabla conserva todas las columnas mediante scroll horizontal; cada columna mide entre 4 y 40 celdas de terminal. Valores largos se truncan; controles se escapan y nulos se representan como NULL. Por debajo de 40 columnas o 20 filas se muestra `Terminal pequeña`, `Mínimo: 40×20` y salida con Ctrl+C o Salir. Los editores permanecen montados y conservan texto/historial, aunque no reciben entrada mientras están ocultos.

SQL no se envuelve; admite desplazamiento vertical y horizontal mediante rueda compatible. El borrador LLM sí se envuelve. Resultados tienen rueda y barras de desplazamiento nativas; encabezados y filas comparten la superficie desplazable. Etiquetas largas se truncan con puntos suspensivos. Sin persistencia de ajustes.

## Teclado y alcance

Ctrl+C o clic en Salir cierra la aplicación; Q se escribe normalmente. Tab/Shift+Tab recorre consultas, resultados y asistente. Escape finaliza un arrastre y vuelve a consultas. Ctrl+Z deshace; Ctrl+Y/Ctrl+Shift+Z rehace. Enter añade líneas; Tab cambia foco.

DBHub conecta al abrir, sin ejecutar consultas. Ctrl+Enter o Ejecutar envía el buffer completo; Enter normal conserva su función de edición. Solo lectura y hasta 200 filas por conjunto, con aviso únicamente si se informa truncamiento. Estados explícitos: conexión, espera de consulta, ejecución, vacío y error seguro. Se borran filas anteriores al ejecutar. Timeout de solicitud de 35 segundos o transporte perdido exige Reconectar, que no ejecuta SQL. La aplicación cierra también DBHub al salir. El borrador LLM no se envía. Pruebas de renderer con sesiones falsas cubren ejecución, errores, selección, ratón, scrollbars, foco, límites de arrastre, cancelación, redimensionado y salida. Contrato de superficie: `docs/workspace-preview.md`.
