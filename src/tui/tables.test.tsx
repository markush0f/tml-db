import { expect, test } from "bun:test";
import { testRender } from "@opentui/solid";
import { App } from "./app";
import { createQueryController } from "./query-session";
import { QueryError, type TableCatalog } from "../db";
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
test("ignora tablas tardías de otra conexión y limpia el catálogo al cambiar", async () => {
  const old = deferred<TableCatalog>();
  const controller = createQueryController(async (name) => ({
    execute: async () => ({ statements: [], durationMs: 1 }),
    close: async () => {},
    listTables: () =>
      name === "old"
        ? old.promise
        : Promise.resolve({ tables: [{ schema: "public", name: "new_table" }], truncated: false }),
  }));
  await controller.reconnect("old");
  expect(controller.tables().status).toBe("loading");
  await controller.switchConnection("new");
  await Promise.resolve();
  old.resolve({ tables: [{ schema: "main", name: "old_table" }], truncated: false });
  await Promise.resolve();
  expect(controller.tables().catalog?.tables[0]?.name).toBe("new_table");
  await controller.close();
  expect(controller.tables().catalog).toBeNull();
});
test("error de metadatos no filtra secretos y permite reintentar; timeout exige reconectar", async () => {
  let calls = 0;
  const controller = createQueryController(async () => ({
    execute: async () => ({ statements: [], durationMs: 1 }),
    close: async () => {},
    listTables: async () => {
      calls++;
      if (calls === 1) throw new Error("private-password");
      if (calls === 3) throw new QueryError("timeout");
      return { tables: [], truncated: false };
    },
  }));
  await controller.reconnect();
  expect(controller.state().connection).toBe("ready");
  expect(controller.tables().status).toBe("error");
  expect(JSON.stringify(controller.state())).not.toContain("private-password");
  await controller.refreshTables();
  expect(controller.tables().status).toBe("ready");
  await controller.refreshTables();
  expect(controller.state().connection).toBe("error");
  await controller.close();
});
test("sidebar muestra tablas debajo de la conexión, esquemas, scroll y catálogo parcial", async () => {
  const view = await testRender(
    () => (
      <App
        connections={{
          list: async () => ({ active: "test", connections: [{ name: "test", kind: "demo" }] }),
          save: async () => {},
          remove: async () => {},
        }}
        connect={async () => ({
          close: async () => {},
          execute: async () => ({ statements: [], durationMs: 1 }),
          listTables: async () => ({
            tables: Array.from({ length: 60 }, (_, i) => ({
              schema: "public",
              name: `table_${String(i).padStart(2, "0")}`,
            })),
            truncated: true,
          }),
        })}
      />
    ),
    { width: 80, height: 24, useMouse: true },
  );
  try {
    await Bun.sleep(15);
    await view.renderOnce();
    await view.renderOnce();
    const frame = view.captureCharFrame();
    expect(frame).toContain("Tablas · 60");
    expect(frame).toContain("public");
    expect(frame).toContain("table_00");
    expect(frame).toContain("Lista parcial");
    expect(frame.indexOf("[test v]")).toBeLessThan(frame.indexOf("table_00"));
    view.resize(40, 24);
    await view.renderOnce();
    expect(view.captureCharFrame()).not.toContain("table_00");
  } finally {
    view.renderer.destroy();
  }
});
