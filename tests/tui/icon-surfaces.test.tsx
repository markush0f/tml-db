import { memorySqlSheetStore } from "../../src/tui/sql-sheet-store";
import { expect, test } from "bun:test";
import { testRender } from "@opentui/solid";
import type { Renderable } from "@opentui/core";
import { App } from "../../src/tui/app";
import { configureIcons, icons } from "../../src/tui/icons";
import type { ConnectionManager } from "../../src/db/connection-manager";

type View = Awaited<ReturnType<typeof testRender>>;
function find(view: View, id: string): Renderable {
  function visit(node: Renderable): Renderable | undefined {
    if (node.id === id) return node;
    for (const child of node.getChildren()) {
      const found = visit(child as Renderable);
      if (found) return found;
    }
  }
  const node = visit(view.renderer.root);
  if (!node) throw new Error(`Missing ${id}`);
  return node;
}
async function draw(view: View) {
  await Bun.sleep(20);
  await view.renderOnce();
  return view.captureCharFrame();
}
async function click(view: View, id: string) {
  const node = find(view, id);
  await view.mockMouse.click(node.x, node.y);
  return draw(view);
}

for (const mode of ["unicode", "nerd-font", "ascii"] as const) {
  for (const width of [40, 64, 80, 120]) {
    test(`iconos ${mode} en ${width}: cabecera, acciones, formulario y confirmación`, async () => {
      configureIcons(mode);
      const manager: ConnectionManager = {
        list: async () => ({ active: "dev", connections: [{ name: "dev", kind: "demo" }] }),
        save: async () => {},
        remove: async () => {},
        setWriteEnabled: async () => {},
      };
      const view = await testRender(
        () => (
          <App sheetStore={memorySqlSheetStore()}
            connections={manager}
            connect={async () => ({
              writeEnabled: true,
              close: async () => {},
              listTables: async () => ({ tables: [], truncated: false }),
              execute: async () => ({ statements: [], durationMs: 0 }),
            })}
          />
        ),
        { width, height: 24, useMouse: true },
      );
      try {
        const workspace = await draw(view);
        expect(workspace).toContain(`${icons.database} dev`);
        expect(workspace).toContain(`${icons.query} SQL`);
        expect(workspace).toContain(`${icons.execute} Ejecutar`);
        expect(workspace).toContain(`${icons.assistant} Asistente LLM`);
        expect(workspace).toContain(`${icons.row} Resultados`);
        expect(workspace).toContain(`${icons.close} Salir`);
        expect(workspace).toContain(`${icons.write} Escritura`);
        expect(workspace.split("\n")[find(view, "connection-change-button").y]).toContain("dev ▾");
        const status = find(view, "connection-status");
        expect(status.x + status.width).toBeLessThan(find(view, "exit-button").x);

        let frame = await click(view, "connection-change-button");
        expect(frame).toContain(`${icons.database} dev`);
        expect(frame).toContain(`${icons.add} ${width < 80 ? "Alta" : "Nueva conexión"}`);
        expect(frame).toContain(`${icons.execute} Conectar`);
        for (const id of ["connection-new", "connection-more", "connection-select"]) {
          const button = find(view, id);
          expect(button.x + button.width).toBeLessThan(width - 2);
        }
        frame = await click(view, "connection-more");
        expect(frame).toContain(`${icons.database} dev`);
        expect(frame).toContain(`${icons.edit} Editar URL`);
        expect(frame).toContain(`${icons.delete} Eliminar conexión`);
        frame = await click(view, "connection-edit");
        expect(frame).toContain(`${icons.database} Conexión: dev`);
        expect(frame).toContain(`${icons.link} URL de conexión`);
        await click(view, "connection-cancel");
        await click(view, "connection-more");
        frame = await click(view, "connection-write");
        expect(frame).toContain(`${icons.database} dev`);
        expect(frame).toContain(`${icons.write} Habilitar`);
      } finally {
        view.renderer.destroy();
        configureIcons("unicode");
      }
    });
  }
}
