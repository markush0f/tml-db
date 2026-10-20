# tml-db

Una aplicación Bun con tres módulos y una configuración compartida:

```text
src/
  tui/              Interfaz de terminal OpenTUI + SolidJS
  mcp/              Cliente MCP y lanzamiento del DBHub local
  db/               Conexiones, credenciales, configuración y consultas
config/dbhub.toml   Política de solo lectura (predeterminada)
config/dbhub-write.toml  Política de escritura opt-in
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
bun run docker:up    # PostgreSQL + MySQL locales; registra conexiones en el llavero
bun run docker:down  # Detener las bases Docker conservando sus datos
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

Pulsa **Ctrl+K** o la conexión del explorador (cabecera en vista compacta) para abrir **Gestionar conexiones**. Puedes buscar, conectar, registrar una URL completa, sustituirla o eliminar una conexión con confirmación. Cambiar conserva el SQL y limpia los resultados; no ejecuta consultas ni modifica `active` en disco. No se permite cambiar durante conexión o ejecución.

Las conexiones creadas desde la TUI guardan su URL completa **en el llavero del sistema**, mediante `Bun.secrets`: Secret Service/libsecret en Linux, Keychain en macOS y Credential Manager en Windows. El formulario oculta la URL, no recupera secretos para mostrarlos y el TOML contiene solo `secret_ref`. Linux requiere GNOME Keyring, KWallet u otro servicio compatible, disponible y desbloqueado. Si falla, no se guardan secretos en archivos. Esta API de Bun es experimental.

También puedes mantener `dsn_env`: define `DEV_DATABASE_URL` y/o `PROD_DATABASE_URL` en el entorno o en `.env` (puedes copiar `.env.example`). Solo hace falta la variable de la conexión seleccionada. `.env` no está cifrado. Sustituir una URL desde la interfaz migra esa conexión al llavero, sin modificar `.env`. Eliminar una conexión de entorno no elimina su variable.

Con `active = "demo"` se usa `data/dbhub/demo.sqlite`, con tres usuarios ficticios. Sin catálogo se mantiene la compatibilidad con `DBHUB_DSN` y, si no está definida, SQLite de prueba. Un catálogo inválido o una variable activa ausente dan error, sin cambiar de base silenciosamente. El acceso SQL es de solo lectura por defecto y tiene un límite de 200 filas devueltas.

Para permitir escritura en la conexión actual, pulsa directamente **Ctrl+W** o el botón **[Escritura · Ctrl+W]** del pie, sin abrir el gestor ni desconectarte manualmente. También puedes abrir **Ctrl+K**, seleccionar una conexión y pulsar **Ctrl+W** o **Habilitar escritura**. La confirmación advierte de cambios y borrados; después el editor ejecuta INSERT, UPDATE, DELETE y DDL sin más avisos. La preferencia se guarda por conexión como `write_enabled = true` en el TOML (también se puede editar manualmente). Si cambias la activa, se reconecta sin ejecutar SQL. La cabecera indica **Escritura** o **Solo lectura**. La misma acción permite volver a solo lectura. Sustituir la URL conserva el modo.

El modo escritura respeta los permisos del usuario de base de datos: no concede privilegios. El límite de 200 filas no limita las filas modificadas. `mcp:start` y `mcp:check` también respetan la política de la conexión seleccionada. Sin catálogo o con DSN explícita se mantiene solo lectura. Un timeout o pérdida de transporte no garantiza que una escritura no se haya aplicado: comprueba el estado antes de repetirla.

La TUI conecta con DBHub al abrir, **sin ejecutar SQL automáticamente**. Pulsa **Ctrl+Enter** o `[Ejecutar]` para enviar el buffer completo del editor y ver resultados reales. Enter normal añade líneas. Ante pérdida de conexión, `[Reconectar]` prepara una sesión nueva sin ejecutar el SQL. En terminales que no distingan Ctrl+Enter, usa el botón con el ratón.

La sidebar muestra las tablas reales debajo de la conexión, agrupadas por esquema, con scroll y `[Actualizar]`. Se cargan metadatos al conectar, sin ejecutar el SQL del editor ni leer filas; el límite es de 1000 tablas con aviso de lista parcial. El asistente sigue siendo un borrador local sin modelo. Los resultados admiten varias sentencias SQL y desplazamiento horizontal/vertical, indican duración y avisan si DBHub trunca a 200 filas. Ctrl+C o `[Salir]` cierran también el proceso DBHub.

- [PostgreSQL y MySQL de prueba en Docker](docs/docker.md)
- [Interfaz, ratón y atajos](docs/tui.md)
- [DBHub local, credenciales y uso del cliente](docs/mcp.md)
