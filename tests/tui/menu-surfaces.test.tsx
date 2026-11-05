import { expect, test } from "bun:test";
import { testRender } from "@opentui/solid";
import type { Renderable } from "@opentui/core";
import type { ConnectionManager } from "../../src/db/connection-manager";
import { ConnectionPicker } from "../../src/tui/components/ConnectionPicker";

type View = Awaited<ReturnType<typeof testRender>>;
function find(view: View, id: string): Renderable {
  const walk = (node: Renderable): Renderable | undefined => {
    if (node.id === id) return node;
    for (const child of node.getChildren()) {
      const match = walk(child);
      if (match) return match;
    }
  };
  const node = walk(view.renderer.root);
  if (!node) throw new Error(`Missing ${id}`);
  return node;
}
async function draw(view: View) {
  await Bun.sleep(20);
  await view.renderOnce();
  await Bun.sleep(5);
  await view.renderOnce();
  return view.captureCharFrame();
}
async function click(view: View, id: string) {
  const node = find(view, id);
  await view.mockMouse.click(node.x + 1, node.y + Math.floor(node.height / 2));
  return draw(view);
}
for (const [width, height] of [
  [120, 40],
  [80, 24],
  [40, 20],
] as const) {
  test(`todos los menús ${width}×${height}: jerarquía común, límites y cancelación`, async () => {
    const mutations: string[] = [];
    const manager: ConnectionManager = {
      list: async () => ({
        active: "desarrollo",
        connections: [
          { name: "desarrollo", kind: "llavero" },
          { name: "produccion", kind: "entorno" },
          { name: "demo", kind: "demo", writeEnabled: true },
        ],
      }),
      save: async () => {
        mutations.push("save");
      },
      remove: async () => {
        mutations.push("delete");
      },
      setWriteEnabled: async () => {
        mutations.push("write");
      },
    };
    const view = await testRender(
      () => (
        <ConnectionPicker
          manager={manager}
          active="desarrollo"
          width={width}
          height={height}
          onSelect={() => {}}
          onClose={() => {}}
        />
      ),
      { width, height, useMouse: true },
    );
    async function inspect(name: string, buttons: string[]) {
      const frame = await draw(view);
      const shell = find(view, "connection-picker");
      const heading = find(view, "menu-heading");
      const body = find(view, "menu-body");
      const footer = find(view, "menu-footer");
      expect(shell.x).toBeGreaterThanOrEqual(1);
      expect(shell.y).toBeGreaterThanOrEqual(1);
      expect(shell.x + shell.width).toBeLessThanOrEqual(width - 1);
      expect(shell.y + shell.height).toBeLessThanOrEqual(height - 1);
      expect(body.y).toBeGreaterThan(heading.y + heading.height);
      expect(body.y + body.height).toBeLessThanOrEqual(footer.y);
      for (const id of buttons) {
        const button = find(view, id);
        expect(button.height).toBe(3);
        expect(button.y).toBeGreaterThan(footer.y);
        expect(button.y + button.height).toBeLessThanOrEqual(shell.y + shell.height - 2);
        expect(button.x).toBeGreaterThan(shell.x);
        expect(button.x + button.width).toBeLessThan(shell.x + shell.width);
      }
      if (process.env.TML_MENU_CAPTURES)
        await Bun.write(`${process.env.TML_MENU_CAPTURES}/${width}x${height}-${name}.txt`, frame);
      return frame;
    }
    try {
      await inspect("conexiones", ["connection-new", "connection-more", "connection-select"]);
      await click(view, "connection-more");
      expect(await inspect("acciones", ["connection-actions-back"])).toContain("Editar URL");
      // Arrow navigation selects an action, while Escape/Volver returns without losing the selection.
      view.mockInput.pressArrow("down");
      view.mockInput.pressEnter();
      let frame = await inspect("confirmar-escritura", [
        "connection-cancel-write",
        "connection-confirm-write",
      ]);
      expect(frame).toContain("desarrollo");
      expect(frame).toContain("El SQL podrá");
      expect(frame).toContain("Sin más");
      expect(find(view, "connection-confirm-policy").y + 2).toBeLessThanOrEqual(
        find(view, "menu-footer").y,
      );
      view.mockInput.pressTab();
      view.mockInput.pressEnter();
      expect(await draw(view)).toContain("Gestionar conexiones");
      expect(mutations).toEqual([]);
      await view.mockInput.typeText("produccion");
      await draw(view);
      view.mockInput.pressKey("d", { ctrl: true });
      frame = await inspect("confirmar-borrado", [
        "connection-cancel-delete",
        "connection-confirm-delete",
      ]);
      expect(frame).toContain("produccion");
      expect(frame).toContain("no elimina");
      view.mockInput.pressEscape();
      await draw(view);
      view.mockInput.pressKey("n", { ctrl: true });
      frame = await inspect("formulario", ["connection-cancel", "connection-save"]);
      if (height >= 40) expect(frame).toContain("Nombre de la conexión");
      const engine = find(view, "connection-engine");
      expect(engine.y + engine.height).toBeLessThanOrEqual(find(view, "menu-footer").y);
      view.mockInput.pressEnter();
      frame = await inspect("motores", ["connection-engine-back", "connection-engine-apply"]);
      for (const label of ["PostgreSQL", "MySQL", "MariaDB", "SQL Server", "SQLite"])
        expect(frame).toContain(label);
      view.mockInput.pressArrow("down");
      view.mockInput.pressEscape();
      expect(await draw(view)).toContain("PostgreSQL");
      view.mockInput.pressEnter();
      await draw(view);
      view.mockInput.pressArrow("down");
      view.mockInput.pressEnter();
      expect(await draw(view)).toContain("MySQL");
      await click(view, "connection-import");
      frame = await inspect("url", ["connection-cancel", "connection-save"]);
      expect(frame).toContain("URL de conexión");
      await view.mockInput.typeText("postgres://private:secret@localhost/db");
      frame = await draw(view);
      expect(frame).toContain("***");
      expect(frame).not.toContain("private");
      expect(frame).not.toContain("secret@");
      view.mockInput.pressEscape();
      expect(await draw(view)).toContain("Gestionar conexiones");
      view.mockInput.pressKey("e", { ctrl: true });
      frame = await inspect("sustituir-url", ["connection-cancel", "connection-save"]);
      expect(frame).toContain("Sustituir credenciales");
      expect(frame).not.toContain("***");
      expect(mutations).toEqual([]);
    } finally {
      view.renderer.destroy();
    }
  });
}
