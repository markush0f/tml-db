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

Configura TLS según tu servidor y utiliza un usuario con permisos de solo lectura. Codifica caracteres especiales de usuario/contraseña según el formato URL. El TOML **no acepta DSN literales ni contraseñas**: cada entrada debe tener solo `dsn_env = "VARIABLE"` o `demo = true`. Las conexiones inactivas no necesitan sus variables todavía. Nombres de conexión: letras, números, guiones y guiones bajos. Campos desconocidos, activa inexistente, TOML inválido o variable activa vacía/ausente dan error; nunca provocan fallback silencioso a otra base.

El catálogo local y `.env` están excluidos de Git; solo se versionan plantillas. Para cambiar de conexión, edita `active` y reinicia la TUI (o reconecta si la sesión ya está desconectada). No hay selector ni escritura de catálogos desde la interfaz. Cada conexión nueva relee el archivo; una sesión abierta conserva su base.

Precedencia:
1. `connectDbHub({ dsn })`: ignora catálogo y `.env`.
2. Si existe catálogo, usar exclusivamente su conexión `active`. Las variables de proceso prevalecen sobre `.env`; `demo = true` selecciona expresamente SQLite de prueba, aunque exista `DBHUB_DSN`.
3. Sin catálogo predeterminado, compatibilidad: `DBHUB_DSN` del proceso → `.env` → SQLite de prueba.

Ruta del catálogo: opción `connectionsFile` → `DBHUB_CONNECTIONS_FILE` del proceso → la misma variable en `.env` → `config/connections.toml`. Si una ruta explícita no existe, se devuelve error; solo la ausencia del catálogo predeterminado permite el fallback antiguo. Las rutas relativas se resuelven desde la raíz del proyecto, no desde el directorio de invocación.

`loadConnectionCatalog()` y los tipos `ConnectionCatalog`/`ConnectionDefinition` están exportados desde `src/mcp/index.ts` para consumidores. `config/dbhub.toml` sigue separado: contiene las políticas del servidor, no la lista de conexiones.

Nunca incluyas credenciales en código, argumentos CLI o archivos versionados. El cliente las pasa mediante el entorno del proceso DBHub y descarta sus diagnósticos stderr para no volcarlos en la TUI. Los errores de conexión que devuelve son genéricos por la misma razón.

## Configuración y herramientas

`config/dbhub.toml` define una fuente `local` cuya DSN se interpola desde `${DBHUB_DSN}`:

- `execute_sql`: solo lectura, máximo 200 filas.
- `search_objects`: inspección de esquemas, tablas, columnas e índices.
- Timeout de conexión: 10 segundos; consulta: 30 segundos (DBHub no aplica timeout de consulta al driver SQLite).
- El cliente limita la negociación inicial a 15 segundos, configurable con `timeoutMs`.

El modo de solo lectura de DBHub es una protección adicional, no sustituye permisos restringidos en la base de datos. No hay LLM ni envío de consultas automático.

## Usar desde código

El módulo `src/mcp/index.ts` exporta `connectDbHub`, `DbHubOptions`, `connectQuerySession`, `QueryError` y los contratos `QuerySession`, `QueryResult`, `QueryTable`. Desde un archivo directamente dentro de `src/tui/` se puede importar así, sin dependencias entre workspaces:

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

`close()` es idempotente y termina el servidor hijo; también se admite `await using connection = await connectDbHub()`. No se conecta al importar el módulo. La TUI utiliza el adaptador `connectQuerySession()`: descubre `execute_sql`, normaliza sus conjuntos de resultados y oculta errores crudos. `execute(sql)` devuelve `{ statements, durationMs }`; cada conjunto contiene SQL, columnas derivadas de las filas, filas, recuento y `truncated`. Sin filas, DBHub no proporciona nombres de columnas y no se inventan. El buffer se envía íntegro, sin dividir ni reescribir SQL.

La solicitud tiene un timeout de 35 segundos; si vence o se pierde el transporte, se cierra la sesión y es necesario reconectar. Esto no garantiza cancelación SQL en el servidor, particularmente con SQLite. Un error de SQL o rechazo por solo lectura permite corregir y reintentar sin reconectar. Los errores visibles usan mensajes españoles seguros; no incluyen DSN, stderr ni mensajes crudos del driver.

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
```

Las pruebas arrancan el DBHub real con SQLite temporal, sin usar tu DSN: negociación, herramientas, búsqueda de tablas, lectura de filas, rechazo de escrituras, límite de resultados, cierre y entrypoint desde otro directorio. No requieren red tras `bun install`.

Referencias oficiales: [DBHub](https://github.com/bytebase/dbhub), [stdio y CLI](https://dbhub.ai/config/command-line), [TOML](https://dbhub.ai/config/toml).
