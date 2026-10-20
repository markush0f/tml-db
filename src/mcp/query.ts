import { ErrorCode, McpError } from "@modelcontextprotocol/sdk/types.js";
import { connectDbHub } from "./client";
import type { DbHubOptions } from "./config";

export interface QueryTable {
  readonly sql: string;
  readonly columns: readonly string[];
  readonly rows: readonly (readonly unknown[])[];
  readonly count: number;
  readonly truncated: boolean;
}
export interface QueryResult {
  readonly statements: readonly QueryTable[];
  readonly durationMs: number;
}
export interface QuerySession {
  execute(sql: string): Promise<QueryResult>;
  close(): Promise<void>;
}
export type QueryErrorCode = "connection" | "query" | "readonly" | "timeout" | "protocol";
const messages: Record<QueryErrorCode, string> = {
  connection: "No se pudo conectar a DBHub local. Comprueba Node.js, bun install, config/connections.toml y .env.",
  query: "No se pudo ejecutar la consulta. Revisa el SQL y los nombres de tablas.",
  readonly: "Consulta rechazada: solo se permiten operaciones de lectura.",
  timeout: "La consulta excedió el tiempo de espera. Reconecta para continuar.",
  protocol: "DBHub devolvió una respuesta no válida.",
};
export class QueryError extends Error {
  constructor(readonly code: QueryErrorCode) { super(messages[code]); }
}
function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
export function parseQueryResult(response: unknown, durationMs: number): QueryResult {
  if (!record(response) || !Array.isArray(response.content)) throw new QueryError("protocol");
  let payload: unknown;
  try {
    payload = JSON.parse(response.content.filter((item) => record(item) && item.type === "text").map((item) => item.text).join("\n"));
  } catch { throw new QueryError(response.isError === true ? "query" : "protocol"); }
  if (!record(payload)) throw new QueryError("protocol");
  if (response.isError === true || payload.success === false) {
    throw new QueryError(payload.code === "READONLY_VIOLATION" ? "readonly" : "query");
  }
  if (payload.success !== true || !record(payload.data) || !Array.isArray(payload.data.statements)) throw new QueryError("protocol");
  const statements = payload.data.statements.map((statement): QueryTable => {
    if (!record(statement) || typeof statement.sql !== "string" || !Array.isArray(statement.rows) ||
      !statement.rows.every(record) || typeof statement.count !== "number" || !Number.isInteger(statement.count) || statement.count < 0 ||
      (statement.truncated !== undefined && typeof statement.truncated !== "boolean")) throw new QueryError("protocol");
    const rows = statement.rows as Record<string, unknown>[];
    const columns = [...new Set(rows.flatMap(Object.keys))];
    return { sql: statement.sql, columns, rows: rows.map((row) => columns.map((key) => row[key])), count: statement.count, truncated: statement.truncated === true };
  });
  return { statements, durationMs };
}

/** Exported seam permits transport tests without spawning a database. */
export function createQuerySession(connection: Pick<Awaited<ReturnType<typeof connectDbHub>>, "client" | "close">, timeoutMs = 35_000): QuerySession {
  let closed = false;
  let closing: Promise<void> | undefined;
  function close() {
    closed = true;
    return closing ??= connection.close();
  }
  return {
    close,
    async execute(sql) {
      if (closed) throw new QueryError("connection");
      const start = performance.now();
      let response: unknown;
      try {
        response = await connection.client.callTool({ name: "execute_sql", arguments: { sql } }, undefined, { timeout: timeoutMs });
      } catch (error) {
        await close().catch(() => {});
        throw new QueryError(error instanceof McpError && error.code === ErrorCode.RequestTimeout ? "timeout" : "connection");
      }
      return parseQueryResult(response, performance.now() - start);
    },
  };
}
export async function connectQuerySession(options: DbHubOptions = {}): Promise<QuerySession> {
  let connection: Awaited<ReturnType<typeof connectDbHub>> | undefined;
  try {
    connection = await connectDbHub(options);
    if (!(await connection.client.listTools()).tools.some((tool) => tool.name === "execute_sql")) throw new QueryError("protocol");
    return createQuerySession(connection);
  } catch (error) {
    await connection?.close().catch(() => {});
    throw error instanceof QueryError ? error : new QueryError("connection");
  }
}
