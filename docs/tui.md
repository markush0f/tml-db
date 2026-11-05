# tml-db / TUI

Espacio SQL de terminal con Bun, OpenTUI y SolidJS. Editor conectado al [DBHub local](mcp.md), resultados reales y borrador de asistente sin modelo. Sin nuevas dependencias.

## Inicio

```sh
bun install
bun run start
```

Requiere Bun >= 1.3.14 y Node.js >= 22.5.0 disponible como `node`. La conexión activa se guarda en `config/connections.toml` (copia `config/connections.example.toml` si falta). `active = "demo"` utiliza SQLite de prueba con tres usuarios. Para una base propia, selecciona una entrada con `dsn_env` y define esa variable en `.env` o el entorno. Las credenciales nunca van en TOML; las conexiones inactivas no requieren sus variables. Usa **Ctrl+K** para seleccionar otra conexión sin reiniciar. **+ Nueva conexión** guarda una URL completa en el llavero nativo, con solo una referencia en el TOML. El llavero debe estar disponible y desbloqueado; no hay fallback inseguro a archivos. Sin catálogo se mantiene el fallback antiguo a `DBHUB_DSN` y SQLite. No hace falta ejecutar `mcp:start` por separado.

La conexión comienza al abrir la TUI, pero ninguna consulta se ejecuta automáticamente. El SQL inicial `SELECT * FROM users LIMIT 200;` es una sugerencia para la SQLite de prueba: cámbialo según las tablas de tu base.

## Uso

- **Conexiones:** acceso en el explorador, en la cabecera compacta o con Ctrl+K. Escribe para buscar, ↑/↓ para seleccionar y Enter para conectar; Esc cierra y Ctrl+U limpia la búsqueda. El pie separa Nueva conexión, Acciones y Conectar. Acciones abre el menú para editar URL, cambiar acceso o eliminar; ↑/↓ y Enter lo manejan, Esc vuelve. Los atajos Ctrl+N/E/W/D funcionan también desde la lista. Todas las pantallas comparten cabecera, cuerpo separado y botones fijos; las confirmaciones distinguen conexión, consecuencias y Cancelar/Confirmar, con Tab o ←/→ para cambiar de botón. El formulario ofrece Por campos / Por URL (Ctrl+I), con URL y contraseña ocultas. El selector de motor muestra las cinco opciones en una pantalla propia: ↑/↓ y Enter, teclas 1–5 o clic; Esc descarta el cambio. Tab/Shift+Tab recorre campos/acciones, Enter avanza, Ctrl+Enter guarda y Ctrl+U vacía el campo. Cambiar conserva SQL y borrador, limpia resultados y no ejecuta consultas. Se bloquea mientras conecta/ejecuta. No se puede eliminar la activa ni la última conexión. La selección no modifica el `active` del próximo arranque.
- **Consultas:** editor multilínea con números de línea, resaltado local, cursor, selección, pegado, deshacer y scroll. Foco inicial en el editor.
- **Ejecutar:** **Ctrl+Enter** o clic en `[Ejecutar]` envía el buffer íntegro, no solo la selección. Enter normal añade una línea. En terminales que no distingan Ctrl+Enter, usa el botón. La ejecución está deshabilitada con SQL vacío, mientras conecta/ejecuta y por debajo del tamaño mínimo. Puedes editar durante la consulta: el resultado corresponde al texto capturado al lanzarla. No se encolan ejecuciones.
- **Resultados:** columnas dinámicas y todos los conjuntos en orden; varias sentencias muestran `Resultado 1`, etc. Encabezados y filas comparten scroll horizontal/vertical. Clic selecciona una fila. Anchos entre 4 y 40 celdas por columna; valores largos se truncan. `NULL` distingue valores nulos; objetos usan JSON y controles se escapan. Cero filas muestra `Sin filas`; no se inventan columnas cuando DBHub no las proporciona.
- **Seguridad:** solo lectura por defecto, máximo 200 filas devueltas por conjunto. Ctrl+W directamente en el espacio de trabajo o el botón Escritura del pie cambia el modo de la conexión activa, sin abrir el gestor; al habilitar pide confirmación y al deshabilitar vuelve directamente a solo lectura. También puedes hacerlo desde Ctrl+K seleccionando una conexión y pulsando Ctrl+W; se guarda por conexión y reconecta la activa sin ejecutar SQL. La misma acción vuelve a solo lectura. La cabecera muestra el modo. Con escritura habilitada no hay más confirmaciones: INSERT, UPDATE, DELETE y DDL respetan los permisos de la base, y el límite de resultados no limita filas modificadas. El aviso de límite aparece únicamente si DBHub informa truncamiento. La cabecera de resultados indica filas recibidas y duración. Al ejecutar se eliminan los resultados anteriores, incluso si la nueva consulta falla.
- **Errores:** SQL inválido o escritura rechazada muestran el detalle devuelto por DBHub con prefijo `DBHub:` y permiten corregir y volver a ejecutar. Se ocultan URLs de conexión y contraseñas reconocibles, se limpian controles de terminal y se limita el detalle a 4000 caracteres. Sin detalle se usa el genérico. Pérdida de transporte o timeout de 35 segundos cierran la sesión. `[Reconectar]` o Ctrl+Enter reconecta sin ejecutar el SQL. No hay reintentos automáticos ni errores crudos con credenciales.
- **Explorador:** muestra las tablas reales debajo de la conexión activa, agrupadas por esquema y con scroll vertical. Carga metadatos al conectar y permite `[Actualizar]`; estados de carga, sin tablas y error seguro. Hasta 1000 tablas, con aviso cuando la lista es parcial. Cambiar limpia el catálogo e ignora respuestas anteriores; no ejecuta consultas del editor ni lee filas.
- **Asistente:** editor de borrador local; no envía mensajes ni se conecta a un modelo.
- **Tamaños:** arrastra los tres separadores para cambiar anchos y alturas. Escape termina el arrastre y vuelve al editor; no cancela SQL.
- **Salir:** `[Salir]` o **Ctrl+C** cierran la conexión y el proceso DBHub. Q sigue siendo texto normal.

**Tab / Shift+Tab** recorre consultas, resultados y asistente. **Ctrl+Z** deshace; **Ctrl+Y / Ctrl+Shift+Z** rehace. Tab cambia foco; para sangrar usa espacios.

Desde 80 columnas aparece el espacio del explorador; entre 40 y 79 se oculta. Por debajo de 40×20 se muestra un aviso. Redimensionar conserva buffers, resultados y ajustes, sin reconectar ni ejecutar. Los buffers, resultados y selección de conexión son temporales; las conexiones registradas y sus credenciales sí persisten.

## Organización y pruebas

- `src/tui/index.tsx`: renderer y configuración de entrada.
- `src/tui/app.tsx`: composición, foco, acciones y ciclo de vida.
- `src/tui/query-session.ts`: controlador de conexión/consulta y protección frente a resoluciones tardías.
- `src/db/query.ts`: adaptador MCP tipado, errores seguros y timeout.
- `src/tui/components/`: editor, resultados, borrador y separadores; el explorador activo usa metadatos de DBHub; el árbol reutilizable de fixtures queda para pruebas.
- `src/tui/workspace-layout.ts` y `theme.ts`: layout, mínimos y paleta.
- `tests/tui/`: pruebas de interfaz, interacción y controladores, separadas de la aplicación.
- `tests/fixtures/workspace.ts`: datos ficticios del explorador y resultados, exclusivos de las pruebas.

```sh
bun run dev
bun run typecheck
bun run test:tui
bun run test:mcp
bun test
```

Las pruebas de renderer inyectan sesiones falsas y nunca leen la DSN del usuario. Las pruebas de integración usan SQLite temporal y DBHub real. Contrato de superficie: [workspace-preview.md](workspace-preview.md).
