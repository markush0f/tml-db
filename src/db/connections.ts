import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const defaultConnectionsPath = fileURLToPath(
  new URL("../../config/connections.toml", import.meta.url),
);

export interface ConnectionDefinition {
  readonly dsnEnv?: string;
  readonly secretRef?: string;
  readonly demo: boolean;
  readonly writeEnabled?: boolean;
}

export interface ConnectionCatalog {
  readonly active: string;
  readonly connections: Readonly<Record<string, ConnectionDefinition>>;
}

const invalid = () =>
  new Error(
    "Configuración de conexiones no válida. Revisa active y connections en config/connections.toml; usa dsn_env, secret_ref o demo = true, sin credenciales.",
  );
function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function parseConnectionCatalog(text: string): ConnectionCatalog {
  let value: unknown;
  try {
    value = Bun.TOML.parse(text);
  } catch {
    throw invalid();
  }
  if (
    !object(value) ||
    Object.keys(value).some((key) => key !== "active" && key !== "connections") ||
    typeof value.active !== "string" ||
    !object(value.connections)
  )
    throw invalid();
  const connections: Record<string, ConnectionDefinition> = Object.create(null);
  for (const [name, entry] of Object.entries(value.connections)) {
    if (
      !/^[a-zA-Z0-9_-]+$/.test(name) ||
      !object(entry) ||
      Object.keys(entry).some(
        (key) =>
          key !== "dsn_env" && key !== "demo" && key !== "secret_ref" && key !== "write_enabled",
      )
    )
      throw invalid();
    if (entry.write_enabled !== undefined && typeof entry.write_enabled !== "boolean")
      throw invalid();
    if (entry.demo === true && entry.dsn_env === undefined && entry.secret_ref === undefined)
      connections[name] = { demo: true };
    else if (
      entry.demo === undefined &&
      entry.dsn_env === undefined &&
      typeof entry.secret_ref === "string" &&
      /^[a-zA-Z0-9_-]{1,100}$/.test(entry.secret_ref)
    )
      connections[name] = { demo: false, secretRef: entry.secret_ref };
    else if (
      entry.demo === undefined &&
      entry.secret_ref === undefined &&
      typeof entry.dsn_env === "string" &&
      /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(entry.dsn_env)
    ) {
      connections[name] = { demo: false, dsnEnv: entry.dsn_env };
    } else throw invalid();
    if (entry.write_enabled !== undefined)
      connections[name] = { ...connections[name]!, writeEnabled: entry.write_enabled as boolean };
  }
  if (!Object.hasOwn(connections, value.active)) throw invalid();
  return { active: value.active, connections };
}
export async function loadConnectionCatalog(
  filename = defaultConnectionsPath,
): Promise<ConnectionCatalog | null> {
  let text: string;
  try {
    text = await readFile(resolve(filename), "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw new Error("No se pudo leer el fichero TOML de conexiones.");
  }
  return parseConnectionCatalog(text);
}
/** Resolve only the active entry; inactive connections need no credentials. */
export function catalogDsn(
  catalog: ConnectionCatalog,
  environment: NodeJS.Dict<string>,
): string | undefined {
  const connection = catalog.connections[catalog.active]!;
  if (connection.demo) return undefined;
  if (connection.secretRef)
    throw new Error("La conexión requiere resolver el llavero del sistema.");
  const dsn = environment[connection.dsnEnv!];
  if (!dsn?.trim())
    throw new Error(
      "Falta la variable de entorno de la conexión activa. Defínela en el entorno o en .env; revisa dsn_env en el TOML.",
    );
  return dsn;
}
