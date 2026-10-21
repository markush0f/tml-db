# Espacio de trabajo de terminal

Interfaz local interactiva basada en el boceto del usuario. La terminal proporciona la fuente monoespaciada y el tamaño de celda. Sin animaciones.

## Composición

Marco exterior redondeado, cabecera y pie de una fila. La cabecera incluye `[Salir]`, accesible con el ratón. El cuerpo tiene una división vertical y dos horizontales; sin tarjetas ni separadores duplicados.

Espacio de explorador de 26 columnas desde 100 columnas; de 22 entre 80 y 99 (incluido su separador). Barra lateral sobre superficie gris oscura: selector de conexión compacto sobre fondo de selección, flecha de apertura y acción ↻ para actualizar en la misma fila. Debajo, filtro de tablas, título ENTIDADES con recuento y árbol compacto de esquemas plegables e iconos de tabla amarillos. Identificadores en gris claro, sin resaltar todo el árbol en amarillo. Nombres reales obtenidos mediante search_objects; filtra por esquema o tabla sin ejecutar SQL. Clic en una tabla la mantiene seleccionada con fondo gris y texto amarillo y despliega debajo sus columnas y tipos reales, alineados en dos columnas con guía vertical. Además carga hasta 200 registros en Resultados, con nombre de esquema/tabla y aviso de vista previa; otro clic conserva la selección y recarga registros. Solo una tabla seleccionada a la vez, identificada por esquema y nombre. Metadatos de columnas bajo demanda con carga, vacío, error reintentable pulsando la tabla y aviso de límite 1000. Cambiar conexión, actualizar catálogo o cerrar descarta selección y respuestas tardías. El filtro recibe foco con clic; Escape vuelve al editor y Tab/Shift+Tab regresa al recorrido principal. Lista con scroll vertical; carga, vacío, sin coincidencias, error seguro y aviso de lista parcial (1000) explícitos. Cambiar de conexión limpia inmediatamente el catálogo e ignora respuestas tardías. La vista previa genera únicamente SELECT acotado con identificadores escapados según el motor; no modifica ni ejecuta el SQL del editor. Durante la carga bloquea nuevas selecciones y limpia filas anteriores. Ejecutar SQL manual sustituye la vista previa y elimina su título de tabla. El árbol de fixtures se conserva solo para pruebas.

A la derecha: Consultas con gutter vinculado al editor, palabras clave SQL amarillas y acción Ejecutar/Reconectar en el título; Resultados como tabla de terminal con bordes finos, separadores verticales, regla bajo cabecera y cierre inferior. Cabecera en negrita sobre fondo gris; columnas dinámicas alineadas, selección de fila por conjunto, scroll horizontal/vertical, recuento y duración. En paneles de menos de siete filas se omite el borde superior para mantener visibles los datos; Asistente LLM con estado no conectado y editor de borrador. Los títulos de la región enfocada son amarillos. Cursor amarillo y selección gris/amarilla.

## Redimensionado

Tres separadores de una celda, amarillos al apuntarlos o arrastrarlos. La línea vertical modifica el ancho del explorador (mínimo 18 columnas incluido el separador), dejando al menos 36 para el área principal. La línea sobre Resultados redistribuye altura entre consultas y tabla. La línea inferior redistribuye resultados/asistente sin mover la división superior.

Mínimos: Consultas cuatro filas, Resultados cinco y Asistente tres, sin contar los separadores. Tamaños iniciales aproximados: 60/25/15; los mínimos tienen prioridad. Captura de ratón durante el arrastre, incluso al salir del separador, sin seleccionar texto accidentalmente. Soltar el botón, Escape o redimensionar la terminal termina el arrastre. Los tamaños se limitan al espacio disponible; los preferidos se recuperan al volver a ampliar la terminal.

## Colores

Tokens en `src/tui/theme.ts`: fondo `#000000`, superficie `#111111`, selección `#292929`, texto `#f5f5f5`, secundario `#b8b8b8`, bordes `#777777`, acento `#ffdf00`. Amarillo para identidad, foco, selección, palabras clave y separadores activos. Sin brillos ni gradientes.

## Adaptación

De 40 a 79 columnas se oculta el explorador. La cabecera muestra DBHub local, acceso al selector con nombre activo y estado seguro de conexión, reservando espacio para Salir. La tabla conserva todas las columnas mediante scroll horizontal; cada columna mide entre 4 y 40 celdas de terminal. Valores largos se truncan; controles se escapan y nulos se representan como NULL. Por debajo de 40 columnas o 20 filas se muestra `Terminal pequeña`, `Mínimo: 40×20` y salida con Ctrl+C o Salir. Los editores permanecen montados y conservan texto/historial, aunque no reciben entrada mientras están ocultos.

SQL no se envuelve; admite desplazamiento vertical y horizontal mediante rueda compatible. El borrador LLM sí se envuelve. Resultados tienen rueda y barras de desplazamiento nativas; encabezados y filas comparten la superficie desplazable. Etiquetas largas se truncan con puntos suspensivos. Sin persistencia de ajustes.

## Gestión de conexiones

Ctrl+K o clic en la conexión abre un selector centrado, negro/gris con borde amarillo, y aísla el foco del editor. Buscar escribiendo; ↑/↓ selecciona, Enter conecta y Escape cierra/restaura foco. Lista acotada a la altura disponible con indicador de cantidad. Acciones visibles para conectar, registrar (Ctrl+N), sustituir URL (Ctrl+E) y eliminar (Ctrl+D). No se abre durante conexión/ejecución ni bajo el mínimo de terminal.

Registro y sustitución dentro de la misma superficie: nombre, URL completa oculta, Guardar y Cancelar; Tab/Shift+Tab recorre campos y acciones. No se recupera el secreto anterior al editar. Pegar no revela URL, la representación solo usa asteriscos; Ctrl+U vacía el campo. Errores y espera explícitos, sin almacenar en archivos cuando falla el llavero. Cancelar o cerrar descarta el secreto del formulario. El borrado pide confirmación y no permite eliminar la conexión activa ni la última.

El cambio conserva SQL/borrador, limpia resultados y selección, cierra la sesión anterior y no ejecuta SQL. No cambia active en disco. El gestor persiste referencias secret_ref y almacena las URLs en el llavero mediante Bun.secrets; conserva compatibilidad con dsn_env y demo. Sin dependencias nuevas ni cambios de paleta. Ctrl+W directamente desde el espacio de trabajo o el botón del pie [Escritura · Ctrl+W] permite cambiar el modo de la conexión activa sin navegar por el gestor; bloqueado mientras conecta o ejecuta SQL. En escritura el botón ofrece [Solo lectura · Ctrl+W]. Conserva SQL y borrador, sustituye la sesión automáticamente y no ejecuta SQL. Ctrl+W dentro del gestor o su acción visible permite habilitar escritura por conexión con confirmación explícita del riesgo de modificar/eliminar datos y tablas; se persiste write_enabled. No hay más confirmaciones al ejecutar. La acción inversa vuelve a solo lectura sin confirmación. Cambiar el modo de la activa sustituye la sesión sin ejecutar SQL. Lista y cabecera indican el modo; la cabecera prioriza ese indicador sobre el nombre en compacto.

## Teclado y alcance

Ctrl+C o clic en Salir cierra la aplicación; Q se escribe normalmente. Tab/Shift+Tab recorre consultas, resultados y asistente. Escape finaliza un arrastre y vuelve a consultas. Ctrl+Z deshace; Ctrl+Y/Ctrl+Shift+Z rehace. Enter añade líneas; Tab cambia foco.

DBHub conecta al abrir, sin ejecutar consultas. Ctrl+Enter o Ejecutar envía el buffer completo; Enter normal conserva su función de edición. Solo lectura por defecto y hasta 200 filas devueltas por conjunto, con aviso únicamente si se informa truncamiento. Estados explícitos: conexión, espera de consulta, ejecución, vacío y error seguro. Se borran filas anteriores al ejecutar. Timeout de solicitud de 35 segundos o transporte perdido exige Reconectar, que no ejecuta SQL. La aplicación cierra también DBHub al salir. El borrador LLM no se envía. Pruebas de renderer con sesiones falsas cubren ejecución, errores, selección, ratón, scrollbars, foco, límites de arrastre, cancelación, redimensionado y salida. Contrato de superficie: `docs/workspace-preview.md`.
