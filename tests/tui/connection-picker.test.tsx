import { expect, test } from "bun:test";
import { testRender } from "@opentui/solid";
import { icons } from "../../src/tui/icons";
import type { Renderable } from "@opentui/core";
import { ConnectionPicker } from "../../src/tui/components/ConnectionPicker";
import type { ConnectionManager, ConnectionSummary } from "../../src/db/connection-manager";

type View = Awaited<ReturnType<typeof testRender>>;
async function draw(view: View) {
  await Bun.sleep(20);
  await view.renderOnce();
  await Bun.sleep(5);
  await view.renderOnce();
  return view.captureCharFrame();
}
function find(view: View, id: string): Renderable {
  function visit(node: Renderable): Renderable | undefined {
    if (node.id === id) return node;
    for (const child of node.getChildren()) {
      const match = visit(child);
      if (match) return match;
    }
  }
  const node = visit(view.renderer.root);
  if (!node) throw new Error(`Missing ${id}`);
  return node;
}
const entries: ConnectionSummary[] = [
  { name: "demo", kind: "demo", writeEnabled: true },
  { name: "desarrollo", kind: "entorno" },
  { name: "produccion", kind: "entorno" },
  { name: "docker-postgres", kind: "llavero" },
  { name: "docker-mysql", kind: "llavero" },
];
function fixture(connections = entries) {
  const selected: string[] = [];
  let closed = false;
  const manager: ConnectionManager = {
    list: async () => ({ active: "demo", connections }),
    save: async () => {},
    remove: async () => {},
    setWriteEnabled: async () => {},
  };
  return {
    manager,
    selected,
    onSelect: (name: string) => selected.push(name),
    onClose: () => {
      closed = true;
    },
    closed: () => closed,
  };
}
for (const [width, height] of [
  [120, 40],
  [80, 24],
  [40, 20],
] as const) {
  test(`menú ${width}×${height}: grupos diferenciados y controles visibles`, async () => {
    const f = fixture();
    const view = await testRender(
      () => (
        <ConnectionPicker
          manager={f.manager}
          active="demo"
          width={width}
          height={height}
          onSelect={f.onSelect}
          onClose={f.onClose}
        />
      ),
      { width, height, useMouse: true },
    );
    try {
      const frame = await draw(view);
      expect(frame).toContain("Gestionar conexiones");
      expect(frame).toContain("Buscar conexión");
      expect(frame).toContain("CONEXIÓN");
      expect(frame).toContain("ESTADO");
      expect(frame).toContain("En uso");
      expect(frame).toContain("Conectar");
      if (width >= 80) expect(frame).toContain("CREDENCIALES");
      const picker = find(view, "connection-picker");
      for (const id of [
        "connection-search",
        "connection-list",
        "connection-more",
        "connection-new",
        "connection-select",
        "connection-close",
      ]) {
        const node = find(view, id);
        expect(node.height).toBeGreaterThan(0);
        expect(node.y).toBeGreaterThanOrEqual(picker.y + 1);
        expect(node.y + node.height).toBeLessThanOrEqual(picker.y + picker.height - 1);
      }
      const more = find(view, "connection-more");
      await view.mockMouse.click(more.x, more.y);
      expect(await draw(view)).toContain("Acciones de conexión");
      for (const id of ["connection-edit", "connection-write", "connection-delete"]) {
        const action = find(view, id);
        expect(action.height).toBeGreaterThan(0);
        expect(action.y + action.height).toBeLessThanOrEqual(find(view, "menu-footer").y);
      }
      const remove = find(view, "connection-delete");
      await view.mockMouse.click(remove.x, remove.y);
      expect(await draw(view)).toContain("Cambia a otra conexión");
    } finally {
      view.renderer.destroy();
    }
  });
}

test("selección y conexión activa distintas; Tab activa acciones y búsqueda vacía segura", async () => {
  const f = fixture();
  const view = await testRender(
    () => (
      <ConnectionPicker
        manager={f.manager}
        active="demo"
        width={100}
        height={32}
        onSelect={f.onSelect}
        onClose={f.onClose}
      />
    ),
    { width: 100, height: 32, useMouse: true },
  );
  try {
    await draw(view);
    view.mockInput.pressArrow("down");
    let frame = await draw(view);
    expect(frame).toContain(`> ${icons.database} desarrollo`);
    expect(frame).toContain("En uso");
    view.mockInput.pressTab();
    view.mockInput.pressEnter();
    await draw(view);
    expect(f.selected).toEqual(["desarrollo"]);
    await view.mockInput.typeText("no-existe");
    frame = await draw(view);
    expect(frame).toContain("Sin coincidencias");
    view.mockInput.pressEnter();
    expect(f.selected).toHaveLength(1);
    view.mockInput.pressKey("u", { ctrl: true });
    expect(await draw(view)).toContain("demo");
    view.mockInput.pressTab({ shift: true });
    view.mockInput.pressEnter();
    await draw(view);
    expect(f.closed()).toBe(true);
  } finally {
    view.renderer.destroy();
  }
});
