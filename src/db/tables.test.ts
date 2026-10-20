import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { connectQuerySession, parseTableCatalog } from "./query";
import { initializeDemoDatabase, sqliteDsn } from "./config";
const response = (data: unknown) => ({
  content: [{ type: "text", text: JSON.stringify({ success: true, data }) }],
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
    } finally {
      await session.close();
    }
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
