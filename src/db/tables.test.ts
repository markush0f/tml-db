import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  connectQuerySession,
  parseTableCatalog,
  parseColumnCatalog,
  tablePreviewSql,
} from "./query";
import { initializeDemoDatabase, sqliteDsn } from "./config";
const response = (data: unknown) => ({
  content: [{ type: "text", text: JSON.stringify({ success: true, data }) }],
});
test("vista previa acotada y nombres escapados por dialecto", () => {
  expect(tablePreviewSql({ schema: 'odd"schema', name: 'users"; DROP TABLE users;--' })).toBe(
    'SELECT * FROM "odd""schema"."users""; DROP TABLE users;--" LIMIT 200;',
  );
  expect(tablePreviewSql({ schema: "test", name: "a`b" }, "mysql")).toBe(
    "SELECT * FROM `test`.`a``b` LIMIT 200;",
  );
  expect(tablePreviewSql({ schema: "dbo", name: "a]b" }, "sqlserver")).toBe(
    "SELECT TOP (200) * FROM [dbo].[a]]b];",
  );
  expect(tablePreviewSql({ schema: "APP", name: "USERS" }, "oracle")).toBe(
    'SELECT * FROM "APP"."USERS" FETCH FIRST 200 ROWS ONLY',
  );
});
test("normaliza tablas por esquema, elimina duplicados y conserva truncamiento", () => {
  expect(
    parseTableCatalog(
      response({
        results: [
          { schema: "public", name: "users" },
          { schema: "main", name: "orders" },
          { schema: "public", name: "users" },
        ],
        truncated: true,
      }),
    ),
  ).toEqual({
    tables: [
      { schema: "main", name: "orders" },
      { schema: "public", name: "users" },
    ],
    truncated: true,
  });
  expect(parseTableCatalog(response({ results: [], truncated: false })).tables).toEqual([]);
  expect(() =>
    parseTableCatalog(response({ results: [{ name: "invalid" }], truncated: false })),
  ).toThrow();
  expect(() =>
    parseTableCatalog({ isError: true, content: [{ type: "text", text: "secret" }] }),
  ).toThrow("no válida");
});
test("normaliza columnas y rechaza respuestas inválidas sin revelar errores", () => {
  expect(
    parseColumnCatalog(response({ results: [{ name: "id", type: "uuid" }], truncated: true })),
  ).toEqual({ columns: [{ name: "id", type: "uuid" }], truncated: true });
  expect(() =>
    parseColumnCatalog(response({ results: [{ name: "id" }], truncated: false })),
  ).toThrow("no válida");
  expect(() =>
    parseColumnCatalog({ isError: true, content: [{ type: "text", text: "secret" }] }),
  ).toThrow("no válida");
});
test("descubre tablas reales de SQLite sin ejecutar el SQL del editor", async () => {
  const dir = await mkdtemp(join(tmpdir(), "tml-tables-"));
  try {
    const file = join(dir, "test.sqlite");
    await initializeDemoDatabase(file);
    const session = await connectQuerySession({ dsn: sqliteDsn(file) });
    try {
      expect(await session.listTables!()).toEqual({
        tables: [{ schema: "main", name: "users" }],
        truncated: false,
      });
      const preview = await session.readTable!({ schema: "main", name: "users" });
      expect(preview.statements[0]!.rows).toHaveLength(3);
      expect(preview.statements[0]!.columns).toEqual(["id", "name", "email"]);
      expect(await session.listColumns!({ schema: "main", name: "users" })).toEqual({
        columns: [
          { name: "id", type: "INTEGER" },
          { name: "name", type: "TEXT" },
          { name: "email", type: "TEXT" },
        ],
        truncated: false,
      });
    } finally {
      await session.close();
    }
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
