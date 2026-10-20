import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";
import { connectDbHub } from "../mcp/client";
import { initializeDemoDatabase, sqliteDsn } from "./config";
import { connectQuerySession, createQuerySession, parseQueryResult, QueryError } from "./query";
const response = (payload: unknown) => ({
  content: [{ type: "text", text: JSON.stringify(payload) }],
});
test("normaliza conjuntos, columnas variables, NULL, vacíos y truncamiento", () => {
  const result = parseQueryResult(
    response({
      success: true,
      data: {
        statements: [
          {
            sql: "select",
            rows: [{ id: 1, value: null }, { extra: { a: 2 } }],
            count: 2,
            truncated: true,
          },
          { sql: "empty", rows: [], count: 0 },
        ],
      },
    }),
    12,
  );
  expect(result.statements[0]!.columns).toEqual(["id", "value", "extra"]);
  expect(result.statements[0]!.rows[0]).toEqual([1, null, undefined]);
  expect(result.statements[0]!.truncated).toBe(true);
  expect(result.statements[1]!.columns).toEqual([]);
  expect(
    parseQueryResult(response({ success: true, data: { statements: [] } }), 0).statements,
  ).toEqual([]);
});
test("rechaza protocolo inválido y oculta errores crudos", () => {
  for (const payload of [
    {},
    { success: true, data: { statements: [{}] } },
    { success: true, data: { statements: [{ sql: "x", rows: [], count: -1 }] } },
  ]) {
    expect(() => parseQueryResult(response(payload), 0)).toThrow(new QueryError("protocol"));
  }
  expect(() => parseQueryResult({ content: [{ type: "text", text: "secret" }] }, 0)).toThrow(
    new QueryError("protocol"),
  );
  expect(() =>
    parseQueryResult(
      { ...response({ success: false, error: "password=secret" }), isError: true },
      0,
    ),
  ).toThrow(new QueryError("query"));
  expect(() =>
    parseQueryResult(response({ success: false, code: "READONLY_VIOLATION" }), 0),
  ).toThrow(new QueryError("readonly"));
});
test("timeout y pérdida de transporte cierran una sola vez sin filtrar secretos", async () => {
  for (const error of [new McpError(ErrorCode.RequestTimeout, "secret"), new Error("secret")]) {
    let closed = 0;
    const session = createQuerySession(
      {
        client: {
          callTool: async () => {
            throw error;
          },
        } as unknown as Awaited<ReturnType<typeof connectDbHub>>["client"],
        close: async () => {
          closed++;
        },
      },
      1,
    );
    await expect(session.execute("SELECT 1")).rejects.toThrow(
      new QueryError(error instanceof McpError ? "timeout" : "connection"),
    );
    await session.close();
    expect(closed).toBe(1);
    await expect(session.execute("SELECT 1")).rejects.toThrow(new QueryError("connection"));
  }
});
test("adaptador con SQLite real: lecturas, varios conjuntos, vacío, límite y rechazo de escritura", async () => {
  const directory = await mkdtemp(join(tmpdir(), "tml-query-"));
  const path = join(directory, "test.sqlite");
  let session;
  try {
    await initializeDemoDatabase(path);
    session = await connectQuerySession({ dsn: sqliteDsn(path) });
    expect(
      (await session.execute("SELECT name FROM users ORDER BY id")).statements[0]!.rows,
    ).toEqual([["Ana"], ["Luis"], ["Marta"]]);
    expect((await session.execute("SELECT 1 AS n; SELECT 2 AS n;")).statements).toHaveLength(2);
    expect((await session.execute("SELECT * FROM users WHERE 1=0")).statements[0]!.rows).toEqual(
      [],
    );
    await expect(session.execute("DELETE FROM users")).rejects.toThrow(new QueryError("readonly"));
    expect((await session.execute("SELECT COUNT(*) AS n FROM users")).statements[0]!.rows).toEqual([
      [3],
    ]);
    const limited = (
      await session.execute(
        "WITH RECURSIVE seq(n) AS (SELECT 1 UNION ALL SELECT n+1 FROM seq WHERE n<500) SELECT n FROM seq",
      )
    ).statements[0]!;
    expect(limited.rows).toHaveLength(200);
    expect(limited.truncated).toBe(true);
  } finally {
    await session?.close();
    await rm(directory, { recursive: true, force: true });
  }
}, 20_000);
