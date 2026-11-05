import { resolve } from "node:path";

export const connectionEngines = [
  { label: "PostgreSQL", scheme: "postgres", port: "5432" },
  { label: "MySQL", scheme: "mysql", port: "3306" },
  { label: "MariaDB", scheme: "mariadb", port: "3306" },
  { label: "SQL Server", scheme: "sqlserver", port: "1433" },
  { label: "SQLite", scheme: "sqlite", port: "" },
] as const;

export interface ConnectionFields {
  engine: number;
  host: string;
  port: string;
  user: string;
  password: string;
  database: string;
}

/** Build a DSN without ever including credentials in validation errors. */
export function connectionDsn(fields: ConnectionFields): string {
  const engine = connectionEngines[fields.engine];
  if (!engine) throw new Error("Selecciona un motor de base de datos.");
  if (engine.scheme === "sqlite") {
    const path = fields.database.trim();
    if (!path) throw new Error("Introduce la ruta del archivo SQLite.");
    if (/[\s?#%\x00-\x1f\x7f]/.test(path))
      throw new Error("La ruta SQLite no puede contener espacios ni los caracteres ?, # o %.");
    return path === ":memory:" ? "sqlite:///:memory:" : `sqlite://${resolve(path)}`;
  }
  const host = fields.host.trim();
  if (!host || !/^[\p{L}\p{N}._-]+$/u.test(host))
    throw new Error("Introduce un nombre de host o IPv4, sin protocolo, puerto ni ruta.");
  const port = fields.port.trim();
  if (!/^\d+$/.test(port) || Number(port) < 1 || Number(port) > 65535)
    throw new Error("El puerto debe ser un número entre 1 y 65535.");
  if (!fields.user.trim()) throw new Error("Introduce el usuario de la conexión.");
  const credentials = `${encodeURIComponent(fields.user)}:${encodeURIComponent(fields.password)}`;
  // DBHub decodes credentials, but uses database/path literally (not URL-decoded).
  if (/[\s/?#%\x00-\x1f\x7f]/.test(fields.database))
    throw new Error("La base de datos no puede contener espacios ni /, ?, # o %.");
  return `${engine.scheme}://${credentials}@${host}:${port}/${fields.database}`;
}
