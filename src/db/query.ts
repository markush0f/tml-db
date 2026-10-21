import { stripVTControlCharacters } from "node:util";
import { ErrorCode, McpError } from "@modelcontextprotocol/sdk/types.js";
import { connectDbHub } from "../mcp/client";
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
export interface DatabaseTable {
  readonly schema: string;
  readonly name: string;
}
export interface TableCatalog {
  readonly tables: readonly DatabaseTable[];
  readonly truncated: boolean;
}
export interface DatabaseColumn {
  readonly name: string;
  readonly type: string;
}
export interface ColumnCatalog {
  readonly columns: readonly DatabaseColumn[];
  readonly truncated: boolean;
}
export interface QuerySession {
  readonly writeEnabled?: boolean;
  /** Optional for custom sessions without schema discovery. DBHub sessions always provide it. */
  listTables?(): Promise<TableCatalog>;
  listColumns?(table: DatabaseTable): Promise<ColumnCatalog>;
  readTable?(table: DatabaseTable): Promise<QueryResult>;
  execute(sql: string): Promise<QueryResult>;
  close(): Promise<void>;
}
export type QueryErrorCode = "connection" | "query" | "readonly" | "timeout" | "protocol";
const messages: Record<QueryErrorCode, string> = {
  connection:
    "Conexión DBHub no disponible. Comprueba Node.js, el catálogo y las credenciales. Si ejecutabas SQL, verifica si se aplicó antes de repetirlo.",
  query: "No se pudo ejecutar la consulta. Revisa el SQL y los nombres de tablas.",
  readonly: "Consulta rechazada: solo se permiten operaciones de lectura.",
  timeout:
    "La consulta excedió el tiempo de espera. Reconecta y comprueba si se aplicó antes de repetirla.",
  protocol: "DBHub devolvió una respuesta no válida.",
};
export class QueryError extends Error {
  constructor(
    readonly code: QueryErrorCode,
    detail?: string,
  ) {
    const safeDetail = detail ? safeDatabaseError(detail) : "";
    super(safeDetail ? `DBHub: ${safeDetail}` : messages[code]);
  }
}
/** Tool errors are useful to the user, but must not inject terminal controls or expose DSNs. */
function safeDatabaseError(detail: string): string {
  return stripVTControlCharacters(detail)
    .replace(/[\x00-\x08\x0b-\x1f\x7f-\x9f\u2028\u2029]/g, " ")
    .replace(
      /\b(?:postgres(?:ql)?|mysql|mariadb|sqlserver|sqlite):\/\/[^\s"'<>]+/gi,
      "[conexión oculta]",
    )
    .replace(/\b(password|passwd|pwd)\s*[:=]\s*(?:"[^"]*"|'[^']*'|[^\s;,]+)/gi, "$1=[oculto]")
    .trim()
    .slice(0, 4000);
}
function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
export function parseQueryResult(response: unknown, durationMs: number): QueryResult {
  if (!record(response) || !Array.isArray(response.content)) throw new QueryError("protocol");
  const text = response.content
    .filter((item) => record(item) && item.type === "text" && typeof item.text === "string")
    .map((item) => item.text)
    .join("\n");
  let payload: unknown;
  try {
    payload = JSON.parse(text);
  } catch {
    throw new QueryError(
      response.isError === true ? "query" : "protocol",
      response.isError === true ? text : undefined,
    );
  }
  if (!record(payload)) throw new QueryError("protocol");
  if (response.isError === true || payload.success === false) {
    throw new QueryError(
      payload.code === "READONLY_VIOLATION" ? "readonly" : "query",
      typeof payload.error === "string" ? payload.error : undefined,
    );
  }
  if (payload.success !== true || !record(payload.data) || !Array.isArray(payload.data.statements))
    throw new QueryError("protocol");
  const statements = payload.data.statements.map((statement): QueryTable => {
    if (
      !record(statement) ||
      typeof statement.sql !== "string" ||
      !Array.isArray(statement.rows) ||
      !statement.rows.every(record) ||
      typeof statement.count !== "number" ||
      !Number.isInteger(statement.count) ||
      statement.count < 0 ||
      (statement.truncated !== undefined && typeof statement.truncated !== "boolean")
    )
      throw new QueryError("protocol");
    const rows = statement.rows as Record<string, unknown>[];
    const columns = [...new Set(rows.flatMap(Object.keys))];
    return {
      sql: statement.sql,
      columns,
      rows: rows.map((row) => columns.map((key) => row[key])),
      count: statement.count,
      truncated: statement.truncated === true,
    };
  });
  return { statements, durationMs };
}

export function parseTableCatalog(response: unknown): TableCatalog {
  if (!record(response) || response.isError === true || !Array.isArray(response.content))
    throw new QueryError("protocol");
  let payload: unknown;
  try {
    payload = JSON.parse(
      response.content
        .filter((item) => record(item) && item.type === "text")
        .map((item) => item.text)
        .join("\n"),
    );
  } catch {
    throw new QueryError("protocol");
  }
  if (
    !record(payload) ||
    payload.success !== true ||
    !record(payload.data) ||
    !Array.isArray(payload.data.results) ||
    typeof payload.data.truncated !== "boolean"
  )
    throw new QueryError("protocol");
  const seen = new Set<string>();
  const tables: DatabaseTable[] = [];
  for (const value of payload.data.results) {
    if (!record(value) || typeof value.name !== "string" || typeof value.schema !== "string")
      throw new QueryError("protocol");
    const key = JSON.stringify([value.schema, value.name]);
    if (!seen.has(key)) {
      seen.add(key);
      tables.push({ schema: value.schema, name: value.name });
    }
  }
  tables.sort((a, b) => a.schema.localeCompare(b.schema) || a.name.localeCompare(b.name));
  return { tables, truncated: payload.data.truncated };
}

export function parseColumnCatalog(response: unknown): ColumnCatalog {
  if (!record(response) || response.isError === true || !Array.isArray(response.content))
    throw new QueryError("protocol");
  let payload: unknown;
  try {
    payload = JSON.parse(
      response.content
        .filter((item) => record(item) && item.type === "text")
        .map((item) => item.text)
        .join("\n"),
    );
  } catch {
    throw new QueryError("protocol");
  }
  if (
    !record(payload) ||
    payload.success !== true ||
    !record(payload.data) ||
    !Array.isArray(payload.data.results) ||
    typeof payload.data.truncated !== "boolean"
  )
    throw new QueryError("protocol");
  const columns = payload.data.results.map((value): DatabaseColumn => {
    if (!record(value) || typeof value.name !== "string" || typeof value.type !== "string")
      throw new QueryError("protocol");
    return { name: value.name, type: value.type };
  });
  return { columns, truncated: payload.data.truncated };
}

export type SqlDialect = "ansi" | "mysql" | "sqlserver" | "oracle";
export function tablePreviewSql(table: DatabaseTable, dialect: SqlDialect = "ansi"): string {
  const quote = (name: string) =>
    dialect === "mysql"
      ? `\`${name.replace(/`/g, "``")}\``
      : dialect === "sqlserver"
        ? `[${name.replace(/\]/g, "]]")}]`
        : `"${name.replace(/"/g, '""')}"`;
  const qualified = [table.schema, table.name]
    .filter((part) => part !== "")
    .map(quote)
    .join(".");
  if (dialect === "sqlserver") return `SELECT TOP (200) * FROM ${qualified};`;
  if (dialect === "oracle") return `SELECT * FROM ${qualified} FETCH FIRST 200 ROWS ONLY`;
  return `SELECT * FROM ${qualified} LIMIT 200;`;
}

/** Exported seam permits transport tests without spawning a database. */
export function createQuerySession(
  connection: Pick<Awaited<ReturnType<typeof connectDbHub>>, "client" | "close">,
  timeoutMs = 35_000,
  dialect: SqlDialect = "ansi",
): QuerySession {
  let closed = false;
  let closing: Promise<void> | undefined;
  function close() {
    closed = true;
    return (closing ??= connection.close());
  }
  const session: QuerySession = {
    close,
    readTable: (table) => session.execute(tablePreviewSql(table, dialect)),
    async listTables() {
      if (closed) throw new QueryError("connection");
      let response: unknown;
      try {
        response = await connection.client.callTool(
          {
            name: "search_objects",
            arguments: { object_type: "table", detail_level: "names", limit: 1000 },
          },
          undefined,
          { timeout: timeoutMs },
        );
      } catch (error) {
        await close().catch(() => {});
        throw new QueryError(
          error instanceof McpError && error.code === ErrorCode.RequestTimeout
            ? "timeout"
            : "connection",
        );
      }
      return parseTableCatalog(response);
    },
    async listColumns(table) {
      if (closed) throw new QueryError("connection");
      let response: unknown;
      try {
        response = await connection.client.callTool(
          {
            name: "search_objects",
            arguments: {
              object_type: "column",
              schema: table.schema,
              table: table.name,
              detail_level: "summary",
              limit: 1000,
            },
          },
          undefined,
          { timeout: timeoutMs },
        );
      } catch (error) {
        await close().catch(() => {});
        throw new QueryError(
          error instanceof McpError && error.code === ErrorCode.RequestTimeout
            ? "timeout"
            : "connection",
        );
      }
      return parseColumnCatalog(response);
    },
    async execute(sql) {
      if (closed) throw new QueryError("connection");
      const start = performance.now();
      let response: unknown;
      try {
        response = await connection.client.callTool(
          { name: "execute_sql", arguments: { sql } },
          undefined,
          { timeout: timeoutMs },
        );
      } catch (error) {
        await close().catch(() => {});
        throw new QueryError(
          error instanceof McpError && error.code === ErrorCode.RequestTimeout
            ? "timeout"
            : "connection",
        );
      }
      return parseQueryResult(response, performance.now() - start);
    },
  };
  return session;
}
export async function connectQuerySession(options: DbHubOptions = {}): Promise<QuerySession> {
  let connection: Awaited<ReturnType<typeof connectDbHub>> | undefined;
  try {
    connection = await connectDbHub(options);
    if (!(await connection.client.listTools()).tools.some((tool) => tool.name === "execute_sql"))
      throw new QueryError("protocol");
    return {
      ...createQuerySession(connection, undefined, connection.sqlDialect),
      writeEnabled: connection.writeEnabled,
    };
  } catch (error) {
    await connection?.close().catch(() => {});
    throw error instanceof QueryError ? error : new QueryError("connection");
  }
}
