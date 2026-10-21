import { expect, test } from "bun:test";
import { QueryError, type ColumnCatalog } from "../db";
import { createQueryController } from "./query-session";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
const first = { schema: "public", name: "users" };
const second = { schema: "other", name: "users" };
const catalog: ColumnCatalog = { columns: [{ name: "id", type: "uuid" }], truncated: false };

test("selección distingue esquemas, ignora columnas tardías y no ejecuta SQL", async () => {
  const old = deferred<ColumnCatalog>();
  let executions = 0;
  const controller = createQueryController(async () => ({
    close: async () => {},
    execute: async () => {
      executions++;
      return { statements: [], durationMs: 0 };
    },
    listTables: async () => ({ tables: [first, second], truncated: false }),
    listColumns: (table) =>
      table.schema === first.schema ? old.promise : Promise.resolve(catalog),
  }));
  await controller.reconnect("old");
  const pending = controller.selectTable(first);
  expect(controller.columns().status).toBe("loading");
  await controller.selectTable(second);
  old.resolve({ columns: [{ name: "wrong", type: "text" }], truncated: false });
  await pending;
  expect(controller.columns()).toEqual({ table: second, status: "ready", catalog });
  expect(executions).toBe(0);
  await controller.selectTable(second);
  expect(controller.columns().table).toBeNull();
  await controller.selectTable(first);
  await controller.switchConnection("new");
  expect(controller.columns().table).toBeNull();
  await controller.close();
});

test("cambiar conexión o cerrar descarta solicitudes pendientes de columnas", async () => {
  for (const close of [false, true]) {
    const late = deferred<ColumnCatalog>();
    const controller = createQueryController(async () => ({
      close: async () => {},
      execute: async () => ({ statements: [], durationMs: 0 }),
      listColumns: () => late.promise,
    }));
    await controller.reconnect("old");
    const pending = controller.selectTable(first);
    if (close) await controller.close();
    else await controller.switchConnection("new");
    late.resolve(catalog);
    await pending;
    expect(controller.columns().table).toBeNull();
    await controller.close();
  }
});

test("errores de columnas son seguros, reintentables y timeout exige reconectar", async () => {
  let calls = 0;
  const controller = createQueryController(async () => ({
    close: async () => {},
    execute: async () => ({ statements: [], durationMs: 0 }),
    listColumns: async () => {
      calls++;
      if (calls === 1) throw new Error("private-password");
      if (calls === 3) throw new QueryError("timeout");
      return catalog;
    },
  }));
  await controller.reconnect();
  await controller.selectTable(first);
  expect(controller.columns().status).toBe("error");
  expect(JSON.stringify(controller.columns())).not.toContain("private-password");
  await controller.selectTable(first);
  expect(controller.columns().status).toBe("ready");
  await controller.selectTable(second);
  expect(controller.state().connection).toBe("error");
  expect(controller.columns().table).toBeNull();
  await controller.close();
});
