import { expect, test } from "bun:test";
import { testRender } from "@opentui/solid";
import type { Renderable } from "@opentui/core";

function find(node: Renderable, id: string): Renderable | undefined {
  if (node.id === id) return node;
  for (const child of node.getChildren()) {
    const found = find(child as Renderable, id);
    if (found) return found;
  }
}
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
          execute: async (sql) => ({
            statements: [
              { sql, columns: ["id", "name"], rows: [[1, "Ana"]], count: 1, truncated: false },
            ],
            durationMs: 1,
          }),
          listColumns: async () => ({
            columns: [
              { name: "id", type: "uuid" },
              { name: "created", type: "timestamp" },
            ],
            truncated: false,
          }),
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
    expect(frame).toContain("ENTIDADES · 60");
    expect(frame).toContain("Filtrar…");
    expect(frame).toContain("▦");
    expect(frame).toContain("public");
    expect(frame).toContain("table_00");
    expect(frame).toContain("Lista parcial");
    expect(frame.indexOf("test")).toBeLessThan(frame.indexOf("table_00"));
    const table = find(view.renderer.root, "table-public-table_00")!;
    await view.mockMouse.click(table.x, table.y);
    await Bun.sleep(15);
    await view.renderOnce();
    expect(view.captureCharFrame()).toContain("uuid");
    expect(view.captureCharFrame()).toContain("id");
    expect(view.captureCharFrame()).toContain("Resultados · public.table_00");
    expect(view.captureCharFrame()).toContain("Ana");
    expect(view.captureCharFrame()).toContain("SELECT * FROM users LIMIT 200;");
    await view.mockMouse.click(table.x, table.y);
    await view.renderOnce();
    expect(view.captureCharFrame()).toContain("uuid");
    const schema = find(view.renderer.root, "schema-public")!;
    await view.mockMouse.click(schema.x, schema.y);
    await view.renderOnce();
    expect(find(view.renderer.root, "table-public-table_00")).toBeUndefined();
    await view.mockMouse.click(schema.x, schema.y);
    await view.renderOnce();
    expect(view.captureCharFrame()).toContain("table_00");
    const filter = find(view.renderer.root, "table-filter")!;
    await view.mockMouse.click(filter.x, filter.y);
    await view.renderOnce();
    await view.mockInput.typeText("table_59");
    await view.renderOnce();
    expect(view.captureCharFrame()).toContain("table_59");
    expect(find(view.renderer.root, "table-public-table_00")).toBeUndefined();
    await view.mockInput.typeText("missing");
    await view.renderOnce();
    expect(view.captureCharFrame()).toContain("Sin coincidencias");
    view.mockInput.pressEscape();
    await Bun.sleep(40);
    await view.renderOnce();
    expect(find(view.renderer.root, "query-editor")?.focused).toBe(true);
    view.resize(40, 24);
    await view.renderOnce();
    expect(find(view.renderer.root, "table-public-table_00")).toBeUndefined();
  } finally {
    view.renderer.destroy();
  }
});
