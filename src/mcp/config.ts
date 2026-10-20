import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseEnv, promisify } from "node:util";
import { getDefaultEnvironment } from "@modelcontextprotocol/sdk/client/stdio.js";
import { catalogDsn, defaultConnectionsPath, loadConnectionCatalog } from "./connections";

export const projectDirectory = fileURLToPath(new URL("../../", import.meta.url));
export const defaultDemoPath = resolve(projectDirectory, "data/dbhub/demo.sqlite");
const execFileAsync = promisify(execFile);

export interface DbHubOptions {
  readonly dsn?: string;
  readonly timeoutMs?: number;
  /** Optional catalog path; relative paths are resolved from the project root. */
  readonly connectionsFile?: string;
}

export async function initializeDemoDatabase(filename = defaultDemoPath): Promise<void> {
  try {
    await execFileAsync("node", [fileURLToPath(new URL("./seed-demo.mjs", import.meta.url)), resolve(filename)], { timeout: 10_000 });
  } catch {
    throw new Error("No se pudo preparar SQLite de prueba. DBHub requiere Node.js >= 22.5.0 disponible como node.");
  }
}

export function sqliteDsn(filename: string): string {
  return `sqlite://${resolve(filename)}`;
}

async function localEnvironment(): Promise<NodeJS.Dict<string>> {
  try {
    return parseEnv(await readFile(resolve(projectDirectory, ".env"), "utf8"));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return {};
    throw new Error("No se pudo leer .env en la raíz del proyecto.");
  }
}

export async function dbHubLaunch(options: DbHubOptions = {}) {
  // An explicit DSN is independent of local files (also isolates integration tests).
  let dsn = options.dsn;
  if (dsn !== undefined && !dsn.trim()) throw new Error("La DSN explícita no puede estar vacía.");
  if (dsn === undefined) {
    const local = await localEnvironment();
    const connectionsFile = options.connectionsFile ?? process.env.DBHUB_CONNECTIONS_FILE ?? local.DBHUB_CONNECTIONS_FILE;
    const catalog = await loadConnectionCatalog(connectionsFile === undefined ? defaultConnectionsPath : resolve(projectDirectory, connectionsFile));
    if (connectionsFile !== undefined && catalog === null) throw new Error("No existe el fichero TOML de conexiones solicitado.");
    dsn = catalog ? catalogDsn(catalog, { ...local, ...process.env }) : process.env.DBHUB_DSN ?? local.DBHUB_DSN;
    if (!dsn?.trim()) {
      await initializeDemoDatabase();
      dsn = sqliteDsn(defaultDemoPath);
    }

  }
  return {
    command: "node",
    args: [fileURLToPath(import.meta.resolve("@bytebase/dbhub")), "--transport", "stdio", "--config", resolve(projectDirectory, "config/dbhub.toml")],
    cwd: projectDirectory,
    // Credentials go through the environment, never command-line arguments.
    env: { ...getDefaultEnvironment(), DBHUB_DSN: dsn },
  };
}
