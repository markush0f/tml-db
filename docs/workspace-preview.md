# Workspace — contrato de superficie

Modo: Operate. Espacio SQL de terminal con edición y resultados reales mediante DBHub local. El explorador lista tablas reales por esquema; el asistente conserva un borrador sin conexión a un modelo.

## Dirección

Conservar el boceto: lateral estrecho y tres regiones apiladas a la derecha. Negro y amarillo existentes, celdas de terminal, gris para jerarquía, marco redondeado y separadores únicos. Foco y arrastre amarillos. Sin tarjetas, nuevas fuentes, imágenes ni animación.

Cabecera con estado seguro DBHub local y Salir siempre visible; pie de ayuda. Lateral inicial de 26/22 columnas: conexión arriba y tablas reales debajo, agrupadas por esquema, con recuento, scroll, Actualizar y estados de carga/vacío/error/lista parcial. Máximo 1000 tablas mediante search_objects, sin leer filas. Editor sobre resultados y asistente; mínimos de cuatro/cinco/tres filas y separadores arrastrables. Vista compacta sin lateral; aviso bajo 40×20, donde no se permite ejecutar.

## Flujo y estados

1. Conectar al montar, sin bloquear edición ni ejecutar consultas. SQL inicial sugerido: `SELECT * FROM users LIMIT 200;`.
2. Ejecutar el buffer completo con Ctrl+Enter o clic en Ejecutar. Enter normal añade líneas. Ignorar duplicados, texto vacío y activaciones mientras conecta/ejecuta.
3. Limpiar filas y selección anteriores; mostrar Ejecutando. Capturar el SQL al lanzar, permitiendo seguir editando.
4. Mostrar resultados reales, duración, filas recibidas y todos los conjuntos. Columnas dinámicas de 4–40 celdas, controles escapados, NULL y JSON. Encabezados y filas comparten scroll horizontal/vertical. Cero filas y cero conjuntos tienen mensajes propios.
5. Solo lectura y hasta 200 filas por conjunto; aviso solo ante `truncated: true`. Errores SQL permiten corregir y reintentar. Timeout de solicitud de 35 segundos o pérdida de transporte cierran la sesión y ofrecen Reconectar, sin ejecución automática ni promesa de cancelación SQL.
6. Ctrl+K o el selector del explorador/cabecera abre Gestión de conexiones con búsqueda, lista navegable, registro, sustitución y borrado confirmado. La URL se oculta y se guarda completa en el llavero; el TOML solo conserva referencias. Tab recorre campos y acciones. Escape cancela sin guardar y restaura foco. Cambiar conserva buffers y limpia resultados, cierra antes de abrir y no ejecuta SQL. Cambios bloqueados durante conexión/consulta, borrado bloqueado para conexión activa/última. La selección no persiste como active.
7. Salir cierra DBHub y el renderer. Resoluciones tardías no actualizan la interfaz y las conexiones adquiridas después de salir se cierran.

## Estado y límites

`src/db/query.ts` encapsula MCP y expone QuerySession/QueryResult/QueryTable; el controlador de `src/tui/query-session.ts` separa estados de conexión y ejecución. Los paneles SQL reciben datos y callbacks, sin diagnósticos crudos, DSN ni stderr. ConnectionPicker conserva temporalmente la URL oculta y la entrega al gestor de llavero, sin pasarla al resto del workspace. Las pruebas de renderer inyectan sesiones falsas sin leer la configuración del usuario.

`workspaceLayout` conserva mínimos y ajustes preferidos. El arrastre se descarta al soltar, pulsar Escape o redimensionar. Redimensionar no reconecta ni ejecuta SQL y conserva buffers y resultados. Tab recorre editor, resultados y asistente. Escape vuelve al editor, no cancela consultas. Q es texto.

Sin descubrimiento de columnas, nuevas variables de entorno de aplicación, dependencias, historial persistente, escrituras SQL ni envío al LLM. El gestor escribe exclusivamente el catálogo y el llavero. Verificar frames amplios/compactos, estados reales, edición, selección, scrollbars, ratón, separadores y cierre; tipos y suites de TUI/MCP deben pasar.
