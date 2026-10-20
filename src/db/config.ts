import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseEnv, promisify } from "node:util";
import { catalogDsn, defaultConnectionsPath, loadConnectionCatalog } from "./connections";
import { credentialDsn } from "./credentials";

export const projectDirectory = fileURLToPath(new URL("../../", import.meta.url));
export const defaultDemoPath = resolve(projectDirectory, "data/dbhub/demo.sqlite");
const execFileAsync = promisify(execFile);

export interface DbHubOptions {
  readonly dsn?: string;
  readonly connectionName?: string;
  readonly timeoutMs?: number;
  /** Optional catalog path; relative paths are resolved from the project root. */
  readonly connectionsFile?: string;
}

export async function initializeDemoDatabase(filename = defaultDemoPath): Promise<void> {
  try {
    await execFileAsync(
      "node",
      [fileURLToPath(new URL("./seed-demo.mjs", import.meta.url)), resolve(filename)],
      { timeout: 10_000 },
    );
  } catch {
    throw new Error(
      "No se pudo preparar SQLite de prueba. DBHub requiere Node.js >= 22.5.0 disponible como node.",
    );
  }
}

export function sqliteDsn(filename: string): string {
  return `sqlite://${resolve(filename)}`;
}

export async function localEnvironment(): Promise<NodeJS.Dict<string>> {
  try {
    return parseEnv(await readFile(resolve(projectDirectory, ".env"), "utf8"));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return {};
    throw new Error("No se pudo leer .env en la raíz del proyecto.");
  }
}

export async function resolvedConnectionsPath(filename?: string): Promise<string> {
  const local = await localEnvironment();
  return resolve(
    projectDirectory,
    filename ??
      process.env.DBHUB_CONNECTIONS_FILE ??
      local.DBHUB_CONNECTIONS_FILE ??
      defaultConnectionsPath,
  );
}

export async function resolveDatabaseDsn(options: DbHubOptions = {}): Promise<string> {
  // An explicit DSN is independent of local files (also isolates integration tests).
  let dsn = options.dsn;
  if (dsn !== undefined && !dsn.trim()) throw new Error("La DSN explícita no puede estar vacía.");
  if (dsn === undefined) {
    const local = await localEnvironment();
    const connectionsFile =
      options.connectionsFile ?? process.env.DBHUB_CONNECTIONS_FILE ?? local.DBHUB_CONNECTIONS_FILE;
    const catalog = await loadConnectionCatalog(
      connectionsFile === undefined
        ? defaultConnectionsPath
        : resolve(projectDirectory, connectionsFile),
    );
    if (connectionsFile !== undefined && catalog === null)
      throw new Error("No existe el fichero TOML de conexiones solicitado.");
    if (
      options.connectionName &&
      (!catalog || !Object.hasOwn(catalog.connections, options.connectionName))
    )
      throw new Error("La conexión seleccionada ya no existe.");
    const selected = catalog && { ...catalog, active: options.connectionName ?? catalog.active };
    const entry = selected?.connections[selected.active];
    dsn = entry?.secretRef
      ? await credentialDsn(entry.secretRef)
      : selected
        ? catalogDsn(selected, { ...local, ...process.env })
        : (process.env.DBHUB_DSN ?? local.DBHUB_DSN);
    if (!dsn?.trim()) {
      await initializeDemoDatabase();
      dsn = sqliteDsn(defaultDemoPath);
    }
  }
  return dsn;
}
