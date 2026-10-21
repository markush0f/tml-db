import { expect, test } from "bun:test";
import { QueryError, type QueryResult } from "../db";
import { createQueryController } from "./query-session";
const table = { schema: "public", name: "users" };
const result: QueryResult = {
  statements: [{ sql: "preview", columns: ["id"], rows: [[1]], count: 1, truncated: false }],
  durationMs: 1,
};

test("seleccionar carga registros, conserva selección y distingue SQL manual", async () => {
  const reads: unknown[] = [];
  const sql: string[] = [];
  const controller = createQueryController(async () => ({
    close: async () => {},
    listColumns: async () => ({ columns: [{ name: "id", type: "integer" }], truncated: false }),
    readTable: async (selected) => {
      reads.push(selected);
      return result;
    },
    execute: async (query) => {
      sql.push(query);
      return result;
    },
  }));
  await controller.reconnect();
  await controller.browseTable(table);
  expect(controller.columns().table).toEqual(table);
  expect(controller.state().resultTable).toEqual(table);
  expect(controller.state().result).toEqual(result);
  expect(sql).toEqual([]);
  await controller.browseTable(table);
  expect(controller.columns().table).toEqual(table);
  expect(reads).toEqual([table, table]);
  await controller.execute("SELECT 42;");
  expect(controller.state().resultTable).toBeUndefined();
  expect(controller.state().executedSql).toBe("SELECT 42;");
  expect(sql).toEqual(["SELECT 42;"]);
  await controller.close();
});

test("bloquea selecciones duplicadas durante carga y descarta datos al cerrar", async () => {
  let resolve!: (result: QueryResult) => void;
  let calls = 0;
  const controller = createQueryController(async () => ({
    close: async () => {},
    readTable: async () => {
      calls++;
      return new Promise((done) => {
        resolve = done;
      });
    },
    execute: async () => result,
  }));
  await controller.reconnect();
  const pending = controller.browseTable(table);
  expect(controller.state().query).toBe("running");
  expect(controller.state().result).toBeNull();
  await controller.browseTable({ schema: "other", name: "users" });
  expect(calls).toBe(1);
  await controller.close();
  resolve(result);
  await pending;
  expect(controller.state().connection).toBe("closed");
  expect(controller.state().result).toBeNull();
});

test("errores al leer registros se muestran sin mantener datos anteriores", async () => {
  let fail = false;
  const controller = createQueryController(async () => ({
    close: async () => {},
    readTable: async () => {
      if (fail) throw new QueryError("query", "permission denied");
      return result;
    },
    execute: async () => result,
  }));
  await controller.reconnect();
  await controller.browseTable(table);
  fail = true;
  await controller.browseTable(table);
  expect(controller.state().query).toBe("error");
  expect(controller.state().result).toBeNull();
  expect(controller.state().message).toContain("permission denied");
  expect(controller.state().resultTable).toEqual(table);
  await controller.close();
});
