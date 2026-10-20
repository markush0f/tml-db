import { randomBytes } from "node:crypto";
import { resolve } from "node:path";
import { createConnectionManager } from "../db/connection-manager";
import { loadConnectionCatalog } from "../db/connections";
import { credentialDsn } from "../db/credentials";
import { projectDirectory, resolvedConnectionsPath } from "../db/config";
import { connectQuerySession, QueryError } from "../db/query";

const action = process.argv[2] ?? "up";
const service = "tml-db-docker";
const keys = ["POSTGRES_ADMIN", "POSTGRES_READER", "MYSQL_ROOT", "MYSQL_READER"] as const;
async function compose(command: string[], credentials: Record<string, string> = {}) {
  // Docker needs these variables even when parsing a stop/status command.
  const defaults = Object.fromEntries(keys.map((key) => [`TML_DEMO_${key}_PASSWORD`, "unused"]));
  const child = Bun.spawn(
    ["docker", "compose", "-f", resolve(projectDirectory, "compose.yaml"), ...command],
    {
      cwd: projectDirectory,
      env: { ...process.env, ...defaults, ...credentials },
      stdin: "ignore",
      stdout: "inherit",
      stderr: "inherit",
    },
  );
  if ((await child.exited) !== 0)
    throw new Error(
      "Docker Compose no pudo completar la operación. Revisa los mensajes anteriores.",
    );
}
async function password(key: string, allowCreate: boolean): Promise<string> {
  try {
    const existing = await Bun.secrets.get({ service, name: key });
    if (existing) return existing;
    if (!allowCreate) throw new Error("existing-volumes");
    const value = randomBytes(24).toString("hex");
    await Bun.secrets.set({ service, name: key, value, persist: "local" });
    return value;
  } catch {
    throw new Error(
      "No se pudieron recuperar las credenciales Docker. Desbloquea el llavero; si ya existen volúmenes, restaura sus claves antes de continuar.",
    );
  }
}
function port(value: string | undefined, fallback: number) {
  const parsed = value === undefined ? fallback : Number(value);
  if (!Number.isInteger(parsed) || parsed < 1024 || parsed > 65535)
    throw new Error("Puerto Docker no válido: usa un número entre 1024 y 65535.");
  return parsed;
}
async function register(name: string, dsn: string) {
  const catalog = await loadConnectionCatalog(await resolvedConnectionsPath());
  const existing = catalog?.connections[name];
  if (existing) {
    if (existing.secretRef && (await credentialDsn(existing.secretRef)) === dsn) return;
    throw new Error(
      `Ya existe ${name} con otra configuración. No se ha sobrescrito; revísala en Gestionar conexiones.`,
    );
  }
  await createConnectionManager().save(name, dsn);
}
async function verify() {
  for (const name of ["docker-postgres", "docker-mysql"]) {
    const session = await connectQuerySession({ connectionName: name });
    try {
      const catalog = await session.listTables!();
      if (catalog.tables.length !== 3)
        throw new Error(`No se encontraron las tres tablas esperadas en ${name}.`);
      const result = await session.execute("SELECT id, name, email FROM users ORDER BY id;");
      if (result.statements[0]?.rows.length !== 3)
        throw new Error(`Lectura de prueba no válida en ${name}.`);
      let readonly = false;
      try {
        await session.execute("DELETE FROM users WHERE 1 = 0;");
      } catch (error) {
        readonly = error instanceof QueryError && error.code === "readonly";
      }
      if (!readonly) throw new Error(`No se confirmó la protección de solo lectura en ${name}.`);
      console.log(
        `${name}: ${catalog.tables.map((table) => `${table.schema}.${table.name}`).join(", ")} · 3 usuarios · solo lectura OK`,
      );
    } finally {
      await session.close();
    }
  }
}
async function main() {
  if (action === "down") return compose(["down"]);
  if (action === "status") return compose(["ps"]);
  if (action === "verify") return verify();
  if (action !== "up") throw new Error("Uso: bun src/dev/docker.ts up|down|status|verify");
  const volumes = Bun.spawn(
    [
      "docker",
      "volume",
      "ls",
      "--filter",
      "label=com.docker.compose.project=tml-db-demo",
      "--format",
      "{{.Name}}",
    ],
    { stdout: "pipe", stderr: "pipe" },
  );
  const existingVolumes = (await new Response(volumes.stdout).text()).trim();
  if ((await volumes.exited) !== 0)
    throw new Error("No se pudo acceder a Docker. Comprueba que está arrancado.");
  const credentials: Record<string, string> = {};
  for (const key of keys)
    credentials[`TML_DEMO_${key}_PASSWORD`] = await password(key, !existingVolumes);
  const pgPort = port(process.env.TML_DEMO_POSTGRES_PORT, 15432);
  const mysqlPort = port(process.env.TML_DEMO_MYSQL_PORT, 13306);
  await compose(["up", "-d", "--wait", "--wait-timeout", "180"], credentials);
  await register(
    "docker-postgres",
    `postgres://tml_reader:${credentials.TML_DEMO_POSTGRES_READER_PASSWORD}@127.0.0.1:${pgPort}/tml_demo?sslmode=disable`,
  );
  await register(
    "docker-mysql",
    `mysql://tml_reader:${credentials.TML_DEMO_MYSQL_READER_PASSWORD}@127.0.0.1:${mysqlPort}/tml_demo`,
  );
  await verify();
  console.log("Conexiones registradas. Abre la TUI y pulsa Ctrl+K para seleccionarlas.");
}
try {
  await main();
} catch (error) {
  // Never print raw driver, keyring or subprocess errors that could contain credentials.
  console.error(
    error instanceof QueryError
      ? error.message
      : error instanceof Error && !/password|mysql:\/\/|postgres:\/\//i.test(error.message)
        ? error.message
        : "No se pudo preparar o verificar el entorno Docker.",
  );
  process.exitCode = 1;
}
