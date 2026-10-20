# tml-db

Una aplicación Bun con dos módulos y una configuración compartida:

```text
src/
  tui/              Interfaz de terminal OpenTUI + SolidJS
  mcp/              Cliente MCP y lanzamiento del DBHub local
config/dbhub.toml   Política interna de DBHub, de solo lectura
config/connections.toml  Conexiones locales y conexión activa (excluido de Git)
config/connections.example.toml  Plantilla del catálogo
.env.example       Ejemplo de conexión (copiar a .env)
data/dbhub/        SQLite de prueba, excluida de Git
docs/              Guías de la TUI y de MCP
package.json       Dependencias y comandos de toda la aplicación
bun.lock           Versiones fijadas
```

## Requisitos

- Bun >= 1.3.14 (en Windows ARM64, >= 1.4.0).
- Node.js >= 22.5.0 para DBHub y su driver SQLite nativo. Disponible como `node`.
- No se necesita Docker ni una base de datos externa para probar la conexión.

## Comandos desde la raíz

```sh
bun install
bun run dev          # TUI en modo watch
bun run start        # TUI
bun run mcp:check    # DBHub local: conexión, herramientas y SELECT 1
bun run mcp:start    # Servidor MCP independiente por stdio
bun run typecheck   # Tipos de toda la aplicación
bun test            # Todas las pruebas (también bun run test)
bun run test:tui    # Solo interfaz
bun run test:mcp    # Solo integración MCP
```

`mcp:check` inicia y cierra su propio proceso DBHub; no requiere ejecutar `mcp:start` antes. Cada conexión por stdio tiene su propio servidor y no abre puertos.

Las conexiones se guardan en **`config/connections.toml`**, un fichero local excluido de Git. Si no lo tienes, copia `config/connections.example.toml`. Permite varias conexiones y una activa:

```toml
active = "desarrollo"

[connections.demo]
demo = true

[connections.desarrollo]
dsn_env = "DEV_DATABASE_URL"

[connections.produccion]
dsn_env = "PROD_DATABASE_URL"
```

Las credenciales no van en el TOML: define `DEV_DATABASE_URL` y/o `PROD_DATABASE_URL` en el entorno o en `.env` (puedes copiar `.env.example`). Solo hace falta la variable de la conexión activa. Cambia `active` y reinicia la TUI para cambiar de base; no hay selector de conexiones en la interfaz todavía.

Con `active = "demo"` se usa `data/dbhub/demo.sqlite`, con tres usuarios ficticios. Sin catálogo se mantiene la compatibilidad con `DBHUB_DSN` y, si no está definida, SQLite de prueba. Un catálogo inválido o una variable activa ausente dan error, sin cambiar de base silenciosamente. El acceso SQL sigue siendo de solo lectura y con límite de 200 filas.

La TUI conecta con DBHub al abrir, **sin ejecutar SQL automáticamente**. Pulsa **Ctrl+Enter** o `[Ejecutar]` para enviar el buffer completo del editor y ver resultados reales. Enter normal añade líneas. Ante pérdida de conexión, `[Reconectar]` prepara una sesión nueva sin ejecutar el SQL. En terminales que no distingan Ctrl+Enter, usa el botón con el ratón.

El explorador real está pendiente y no muestra tablas ficticias; el asistente sigue siendo un borrador local sin modelo. Los resultados admiten varias consultas de lectura y desplazamiento horizontal/vertical, indican duración y avisan si DBHub trunca a 200 filas. Ctrl+C o `[Salir]` cierran también el proceso DBHub.

- [Interfaz, ratón y atajos](docs/tui.md)
- [DBHub local, credenciales y uso del cliente](docs/mcp.md)
