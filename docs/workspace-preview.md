# Workspace — contrato de superficie

Modo: Operate. Espacio SQL de terminal con edición y resultados reales mediante DBHub local. El explorador de esquema está pendiente; el asistente conserva un borrador sin conexión a un modelo.

## Dirección

Conservar el boceto: lateral estrecho y tres regiones apiladas a la derecha. Negro y amarillo existentes, celdas de terminal, gris para jerarquía, marco redondeado y separadores únicos. Foco y arrastre amarillos. Sin tarjetas, nuevas fuentes, imágenes ni animación.

Cabecera con estado seguro DBHub local y Salir siempre visible; pie de ayuda. Lateral inicial de 26/22 columnas y texto honesto `Explorador pendiente de conectar`, sin datos falsos. Editor sobre resultados y asistente; mínimos de cuatro/cinco/tres filas y separadores arrastrables. Vista compacta sin lateral; aviso bajo 40×20, donde no se permite ejecutar.

## Flujo y estados

1. Conectar al montar, sin bloquear edición ni ejecutar consultas. SQL inicial sugerido: `SELECT * FROM users LIMIT 200;`.
2. Ejecutar el buffer completo con Ctrl+Enter o clic en Ejecutar. Enter normal añade líneas. Ignorar duplicados, texto vacío y activaciones mientras conecta/ejecuta.
3. Limpiar filas y selección anteriores; mostrar Ejecutando. Capturar el SQL al lanzar, permitiendo seguir editando.
4. Mostrar resultados reales, duración, filas recibidas y todos los conjuntos. Columnas dinámicas de 4–40 celdas, controles escapados, NULL y JSON. Encabezados y filas comparten scroll horizontal/vertical. Cero filas y cero conjuntos tienen mensajes propios.
5. Solo lectura y hasta 200 filas por conjunto; aviso solo ante `truncated: true`. Errores SQL permiten corregir y reintentar. Timeout de solicitud de 35 segundos o pérdida de transporte cierran la sesión y ofrecen Reconectar, sin ejecución automática ni promesa de cancelación SQL.
6. Salir cierra DBHub y el renderer. Resoluciones tardías no actualizan la interfaz y las conexiones adquiridas después de salir se cierran.

## Estado y límites

`src/mcp/query.ts` encapsula MCP y expone QuerySession/QueryResult/QueryTable; el controlador de `src/tui/query-session.ts` separa estados de conexión y ejecución. Componentes reciben datos y callbacks, sin diagnósticos crudos, DSN ni stderr. Las pruebas de renderer inyectan sesiones falsas sin leer la configuración del usuario.

`workspaceLayout` conserva mínimos y ajustes preferidos. El arrastre se descarta al soltar, pulsar Escape o redimensionar. Redimensionar no reconecta ni ejecuta SQL y conserva buffers y resultados. Tab recorre editor, resultados y asistente. Escape vuelve al editor, no cancela consultas. Q es texto.

Sin descubrimiento de esquema, nuevas variables de entorno, dependencias, historial persistente, escrituras ni envío al LLM. Verificar frames amplios/compactos, estados reales, edición, selección, scrollbars, ratón, separadores y cierre; tipos y suites de TUI/MCP deben pasar.
