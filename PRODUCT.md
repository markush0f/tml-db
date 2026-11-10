# Product

<!-- impeccable:product-schema 1 -->

## Platform

Terminal (TUI), no navegador ni aplicación móvil. La plataforma TUI no está contemplada por el clasificador web/native de la herramienta de diseño.

## Product Purpose

Preparar un espacio de trabajo SQL con explorador de tablas, editor de consultas, resultados y asistente LLM, usando OpenTUI y SolidJS.

## Capabilities and Constraints

Varias hojas SQL con nombre, compartidas entre conexiones: crear, seleccionar, renombrar, editar y borrar con confirmación desde el nombre de la hoja o Ctrl+O. Editor SQL multilínea con cursor, selección, pegado y deshacer independientes por hoja. Guardado automático local de nombres, SQL y hoja activa en `data/workspace/sql-sheets.json` (texto plano, ignorado por Git, sin credenciales ni resultados); edición con debounce de 400 ms y escrituras atómicas serializadas. Nueva hoja vacía, nombres únicos de 1–80 caracteres sin controles. Ctrl+N/E/D en el gestor crea/renombra/elimina; Enter abre y Escape vuelve. Siempre hay al menos una hoja. Resultados compartidos con nombre de origen capturado al ejecutar; cambiar hojas no ejecuta SQL ni borra resultados. No se permite borrar el origen mientras ejecuta. Errores de guardado conservan el trabajo y permiten reintentar; un archivo ilegible queda protegido hasta restablecer explícitamente con copia de seguridad. Salir espera el guardado o pide reintentar, volver o salir sin guardar. Ratón para enfocar campos, ejecutar consultas, seleccionar filas, desplazar contenido y arrastrar separadores. Borrador local en el asistente, sin envío.

Conexión automática a DBHub local, sin ejecutar SQL al abrir. Catálogo de conexiones nombradas en `config/connections.toml` con una conexión activa inicial; credenciales en el llavero nativo mediante Bun.secrets o referenciadas por variable de entorno/.env, nunca guardadas en TOML. Selector con búsqueda accesible en explorador, cabecera compacta y Ctrl+K. Registro en formulario amplio por campos (motor, host, puerto, usuario, contraseña oculta, base de datos y nombre), con alternativa URL oculta; SQLite mediante archivo. Sin SSL ni SSH. Cuerpo desplazable, pie de acciones fijo y conservación de datos al redimensionar. Sustitución y borrado confirmado desde el selector. Cambiar de base conserva SQL, limpia resultados y cierra la sesión anterior; selección temporal, sin cambiar active en disco. Cambio bloqueado durante conexión/consulta, borrado bloqueado para activa/última conexión. Sin fallback inseguro si el llavero falla. Ctrl+Enter o Ejecutar envía el buffer completo, con solo lectura por defecto y hasta 200 filas devueltas por conjunto. Escritura opt-in por conexión: Ctrl+W directo o botón Escritura del pie actúa sobre la conexión actual sin entrar al gestor; también disponible con Ctrl+K → Ctrl+W para la seleccionada. Pide confirmación al habilitar, guarda write_enabled y reconecta la activa sin ejecutar SQL. Modo visible en cabecera, también compacta. INSERT/UPDATE/DELETE/DDL desde el editor sin más avisos, sujetos a permisos de la base; el límite no restringe modificaciones. Resultados reales con columnas dinámicas, múltiples conjuntos, duración y aviso de truncamiento. Reconexión explícita tras timeout o pérdida de transporte; errores seguros sin credenciales. El explorador muestra tablas reales agrupadas por esquema bajo la conexión, con carga automática de metadatos, actualización manual, scroll, vacío/error y aviso de lista parcial (máximo 1000). Clic en tabla la resalta, despliega columnas y tipos reales mediante metadatos y carga hasta 200 registros en Resultados con nombre de esquema/tabla y aviso de vista previa. Otro clic mantiene selección y recarga registros. Selección única por esquema y tabla, con carga, vacío, error reintentable y aviso de truncamiento de columnas; se limpia al cambiar conexión o actualizar catálogo y se ignoran respuestas tardías. Vista previa mediante SELECT acotado e identificadores escapados por motor, sin sustituir ni ejecutar el SQL del editor. No consulta filas al abrir; solo al seleccionar una tabla o ejecutar SQL explícitamente. No hay modelo LLM. Las hojas SQL persisten; resultados, borrador LLM, historial de edición y ajustes de paneles son temporales, se conservan al redimensionar y se descartan al salir. Cerrar termina el proceso DBHub.

Adaptación automática: explorador desde 80 columnas, vista compacta desde 40 y aviso por debajo de 40×20. Español en la interfaz e identificadores SQL en inglés. Salida con Ctrl+C o clic en Salir; Q es texto. Tab/Shift+Tab recorre editor, resultados y asistente. Enter añade líneas. Ejecución deshabilitada bajo 40×20, mientras conecta/ejecuta o con SQL vacío.

## Brand Commitments

Paleta principalmente negra y amarilla indicada por el usuario. Composición basada en su boceto: explorador lateral y tres paneles apilados, sin caligrafía ni efectos decorativos.

## Stack

TypeScript estricto, Bun, OpenTUI y SolidJS. Ratón, editores, selección y scroll nativos de OpenTUI. Sin dependencias nuevas.
