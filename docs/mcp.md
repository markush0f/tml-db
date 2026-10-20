# MCP / DBHub local

Servidor oficial `@bytebase/dbhub` **1.5.0**, instalado como dependencia local y ejecutado con Node.js. Cliente TypeScript con `@modelcontextprotocol/sdk` **1.32.1**. No hay servidor remoto, Docker, descarga de paquetes al arrancar ni puertos abiertos: la comunicación usa **stdio**.

## Inicio rápido

Desde la raíz del repositorio:

```sh
bun install
bun run mcp:check
```

Salida esperada:

```text
DBHub local conectado por stdio (solo lectura).
Herramientas: execute_sql, search_objects
SELECT 1: OK
```

El cliente crea un proceso DBHub, negocia MCP, descubre herramientas y hace una consulta mínima. Al terminar cierra el proceso. Sin configuración utiliza `data/dbhub/demo.sqlite`, creada automáticamente con usuarios ficticios Ana, Luis y Marta. La inicialización es idempotente y no sobrescribe filas existentes. Los archivos de datos no se versionan.

Node.js >= 22.5.0 debe estar disponible como `node`. Aunque el código de integración se ejecuta con Bun, **DBHub se ejecuta con Node** porque usa `node:sqlite`.

## Base de datos propia

```sh
cp config/connections.example.toml config/connections.toml
cp .env.example .env
```

El catálogo local `config/connections.toml` permite conexiones nombradas y una activa:

```toml
active = "desarrollo"

[connections.demo]
demo = true

[connections.desarrollo]
dsn_env = "DEV_DATABASE_URL"

[connections.produccion]
dsn_env = "PROD_DATABASE_URL"
```

En `.env` en la raíz, define la variable referenciada por la conexión activa:

```dotenv
DEV_DATABASE_URL=postgres://readonly:CHANGE_ME@127.0.0.1:5432/database?sslmode=disable
```

Configura TLS según tu servidor y utiliza un usuario con los mínimos permisos necesarios. Codifica caracteres especiales de usuario/contraseña según el formato URL. El TOML **no acepta DSN literales ni contraseñas**: cada entrada debe tener `dsn_env = "VARIABLE"`, `secret_ref = "identificador"` o `demo = true`, y opcionalmente `write_enabled = true` (por defecto false). Las conexiones inactivas no necesitan sus variables todavía. Nombres de conexión: letras, números, guiones y guiones bajos. Campos desconocidos, activa inexistente, TOML inválido o variable activa vacía/ausente dan error; nunca provocan fallback silencioso a otra base.

El catálogo local y `.env` están excluidos de Git; solo se versionan plantillas. **Ctrl+K** abre el selector y gestor: buscar por nombre, conectar con Enter, crear con Ctrl+N, sustituir la URL con Ctrl+E y eliminar con Ctrl+D y confirmación. La conexión activa de la sesión no se puede eliminar; primero cambia a otra. Tampoco se puede eliminar la última conexión. El cambio es temporal; `active` sigue definiendo el próximo arranque. Cada conexión nueva relee el archivo; una sesión abierta conserva su base.

### Credenciales en el llavero

Al registrar una conexión desde la TUI se introduce una **URL completa**, incluyendo usuario y contraseña, en un campo oculto. Se guarda la URL entera con `Bun.secrets`, bajo el servicio `tml-db`, con identificador aleatorio y persistencia local en Windows. El TOML solo contiene la referencia:

```toml
[connections.mi_base]
secret_ref = "identificador-generado-por-la-aplicacion"
```

No copies esta referencia a otro equipo esperando que incluya las credenciales: el secreto pertenece al llavero del usuario. En Linux se requiere libsecret y un servicio Secret Service desbloqueado (GNOME Keyring/KWallet); en macOS, Keychain; en Windows, Credential Manager. `Bun.secrets` es experimental. No hay fallback a archivos cuando el llavero falla, ni se imprimen errores crudos. Las credenciales necesariamente pasan por memoria y el entorno del proceso DBHub durante su uso; el llavero protege su almacenamiento, no contra procesos con acceso a tu sesión.

Sustituir la URL no muestra la anterior y elimina el secreto anterior después de guardar su reemplazo. Eliminar una conexión elimina también su secreto, salvo si otra entrada comparte la referencia. Las variables de entorno y `.env` nunca se borran ni editan. Los guardados normalizan el TOML (no conservan comentarios), utilizan archivo temporal con permisos 0600, reemplazo por rename y un bloqueo entre instancias. Si un cierre abrupto deja `<catálogo>.lock`, comprueba que no hay otra instancia guardando antes de borrarlo. Un fallo de limpieza de un secreto anterior se informa para revisión en el gestor del sistema.

Precedencia:

1. `connectDbHub({ dsn })`: ignora catálogo y `.env`.
2. Si existe catálogo, usar exclusivamente `connectionName` si se especifica, o su conexión `active`. Las variables de proceso prevalecen sobre `.env`; `demo = true` selecciona expresamente SQLite de prueba, aunque exista `DBHUB_DSN`.
3. Sin catálogo predeterminado, compatibilidad: `DBHUB_DSN` del proceso → `.env` → SQLite de prueba.

Ruta del catálogo: opción `connectionsFile` → `DBHUB_CONNECTIONS_FILE` del proceso → la misma variable en `.env` → `config/connections.toml`. Si una ruta explícita no existe, se devuelve error; solo la ausencia del catálogo predeterminado permite el fallback antiguo. Las rutas relativas se resuelven desde la raíz del proyecto, no desde el directorio de invocación.

`loadConnectionCatalog()` y los tipos `ConnectionCatalog`/`ConnectionDefinition` están exportados desde `src/db/index.ts` para consumidores. `config/dbhub.toml` sigue separado: contiene las políticas del servidor, no la lista de conexiones.

Nunca incluyas credenciales en código, argumentos CLI o archivos versionados. El cliente las pasa mediante el entorno del proceso DBHub y descarta sus diagnósticos stderr para no volcarlos en la TUI. Los errores de conexión que devuelve son genéricos por la misma razón.

## Configuración y herramientas

`config/dbhub.toml` define una fuente `local` cuya DSN se interpola desde `${DBHUB_DSN}`:

- `execute_sql`: solo lectura por defecto, máximo 200 filas devueltas.

Si la conexión seleccionada tiene `write_enabled = true`, el launcher usa `config/dbhub-write.toml`, con `readonly = false`. Se permiten INSERT, UPDATE, DELETE y DDL sujetos a permisos de la base. El límite no acota filas modificadas. La TUI pide confirmación solo al habilitar este ajuste desde Ctrl+K → Ctrl+W, lo persiste y reconecta si afecta a la activa; no pide confirmación al ejecutar SQL. Editar el TOML es otra forma explícita de habilitarlo. Sin catálogo o con DSN explícita se mantiene solo lectura.
- `search_objects`: inspección de esquemas, tablas, columnas e índices.
- Timeout de conexión: 10 segundos; consulta: 30 segundos (DBHub no aplica timeout de consulta al driver SQLite).
- El cliente limita la negociación inicial a 15 segundos, configurable con `timeoutMs`.

El modo de solo lectura de DBHub es una protección adicional, no sustituye permisos restringidos en la base de datos. No hay LLM ni envío de consultas automático.

## Usar desde código

El módulo `src/mcp/index.ts` exporta el cliente de transporte `connectDbHub` y `DbHubOptions`. La gestión de bases de datos está en `src/db/index.ts`: exporta `connectQuerySession`, `QueryError`, los contratos `QuerySession`, `QueryResult`, `QueryTable` y el gestor de conexiones. La TUI consume esta capa con `import { connectQuerySession } from "../db"`. Desde un archivo directamente dentro de `src/tui/` se puede importar así, sin dependencias entre workspaces:

```ts
import { connectDbHub } from "../mcp";

const connection = await connectDbHub();
try {
  const { tools } = await connection.client.listTools();
  const result = await connection.client.callTool({
    name: "execute_sql",
    arguments: { sql: "SELECT 1 AS connected;" },
  });
  // El consumidor debe comprobar result.isError y leer el contenido MCP.
} finally {
  await connection.close();
}
```

`close()` es idempotente y termina el servidor hijo; también se admite `await using connection = await connectDbHub()`. No se conecta al importar el módulo. La TUI utiliza el adaptador `connectQuerySession()`: descubre `execute_sql`, normaliza sus conjuntos de resultados y muestra el mensaje de error SQL devuelto por DBHub, con prefijo `DBHub:`. `execute(sql)` devuelve `{ statements, durationMs }`; cada conjunto contiene SQL, columnas derivadas de las filas, filas, recuento y `truncated`. Sin filas, DBHub no proporciona nombres de columnas y no se inventan. El buffer se envía íntegro, sin dividir ni reescribir SQL.

La solicitud tiene un timeout de 35 segundos; si vence o se pierde el transporte, se cierra la sesión y es necesario reconectar. Esto no garantiza cancelación SQL en el servidor, particularmente con SQLite. Una escritura podría haberse aplicado: verifica el estado antes de repetirla. Un error de SQL o rechazo por solo lectura permite corregir y reintentar sin reconectar. Los errores SQL muestran el campo `error` que devuelve DBHub (o su texto de error MCP), sin traducirlo ni sustituirlo por el genérico. Se eliminan controles de terminal y se ocultan URLs de conexión y asignaciones de contraseña reconocibles; el detalle se limita a 4000 caracteres. El mensaje puede contener nombres o valores de la base de datos. Si falta detalle, se conserva el mensaje genérico. Los fallos de transporte/protocolo siguen usando mensajes genéricos, sin mostrar excepciones ni stderr. No se crean logs.

## Servidor independiente para otros clientes MCP

```sh
bun run mcp:start
```

Ese comando inicia **un servidor stdio**, no un endpoint HTTP: espera mensajes MCP en stdin y responde en stdout. Los logs van a stderr. Normalmente es el cliente MCP quien debe lanzarlo, por ejemplo:

```json
{
  "mcpServers": {
    "dbhub": {
      "command": "bun",
      "args": ["/RUTA/ABSOLUTA/tml-db/src/mcp/server.ts"]
    }
  }
}
```

Sustituye la ruta por la de tu repositorio. No hace falta `mcp:start` si usas `connectDbHub()`: cada cliente posee su propio proceso. Al recibir SIGINT/SIGTERM, el entrypoint independiente reenvía la señal y espera la salida del servidor hijo.

## Pruebas

```sh
bun run typecheck
bun run test:mcp
# Opcional: requiere llavero disponible; crea y elimina una credencial temporal.
TML_DB_TEST_KEYRING=1 bun test src/db/keyring.integration.test.ts
```

Las pruebas arrancan el DBHub real con SQLite temporal, sin usar tu DSN: negociación, herramientas, búsqueda de tablas, lectura de filas, rechazo de escrituras, límite de resultados, cierre y entrypoint desde otro directorio. No requieren red tras `bun install`.

Referencias oficiales: [DBHub](https://github.com/bytebase/dbhub), [stdio y CLI](https://dbhub.ai/config/command-line), [TOML](https://dbhub.ai/config/toml).
