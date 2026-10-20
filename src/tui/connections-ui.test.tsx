import { expect, test } from "bun:test";
import { testRender } from "@opentui/solid";
import type { Renderable, TextareaRenderable } from "@opentui/core";
import { App } from "./app";
import type { ConnectionManager, ConnectionSummary } from "../db/connection-manager";

type View = Awaited<ReturnType<typeof testRender>>;
async function draw(view: View) {
  await Bun.sleep(15);
  await view.renderOnce();
  await Bun.sleep(5);
  await view.renderOnce();
  return view.captureCharFrame();
}
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
async function click(view: View, id: string) {
  const node = find(view, id);
  await view.mockMouse.click(node.x, node.y);
  return draw(view);
}
function setup() {
  let entries: ConnectionSummary[] = [
    { name: "dev", kind: "llavero" },
    { name: "demo", kind: "demo" },
  ];
  const saved: string[][] = [];
  const removed: string[] = [];
  const connected: (string | undefined)[] = [];
  let closes = 0;
  const manager: ConnectionManager = {
    list: async () => ({ active: "dev", connections: entries }),
    save: async (name, dsn, replace) => {
      saved.push([name, dsn, String(replace)]);
      if (!replace) entries = [...entries, { name, kind: "llavero" }];
    },
    remove: async (name) => {
      removed.push(name);
      entries = entries.filter((e) => e.name !== name);
    },
  };
  const connect = async (name?: string) => {
    connected.push(name);
    return {
      close: async () => {
        closes++;
      },
      execute: async () => ({ statements: [], durationMs: 1 }),
    };
  };
  return { manager, connect, saved, removed, connected, closes: () => closes };
}
for (const width of [120, 40]) {
  test(`selector ${width}: buscar, cambiar, conservar SQL y restaurar foco`, async () => {
    const fixture = setup();
    const view = await testRender(
      () => <App connect={fixture.connect} connections={fixture.manager} />,
      { width, height: 24, useMouse: true },
    );
    try {
      await draw(view);
      const editor = find(view, "query-editor") as TextareaRenderable;
      const sql = editor.plainText;
      await click(view, width === 40 ? "connection-header" : "connection-sidebar");
      expect(await draw(view)).toContain("Gestionar conexiones");
      await view.mockInput.typeText("demo");
      await draw(view);
      view.mockInput.pressEnter();
      await draw(view);
      expect(fixture.connected).toEqual([undefined, "demo"]);
      expect(fixture.closes()).toBe(1);
      expect(editor.plainText).toBe(sql);
      view.mockInput.pressKey("k", { ctrl: true });
      await draw(view);
      view.mockInput.pressEscape();
      await draw(view);
      expect(editor.focused).toBe(true);
    } finally {
      view.renderer.destroy();
    }
  });
}
test("registro oculto, sustitución, cancelación y eliminación con confirmación", async () => {
  const fixture = setup();
  const view = await testRender(
    () => <App connect={fixture.connect} connections={fixture.manager} />,
    { width: 80, height: 24, useMouse: true },
  );
  try {
    await draw(view);
    view.mockInput.pressKey("k", { ctrl: true });
    await draw(view);
    await click(view, "connection-new");
    await view.mockInput.typeText("prod");
    view.mockInput.pressTab();
    await draw(view);
    const dsn = "postgres://alice:super-secret@localhost/db";
    await view.mockInput.pasteBracketedText(dsn);
    const frame = await draw(view);
    expect(frame).toContain("***");
    expect(frame).not.toContain("super-secret");
    expect(frame).not.toContain("alice");
    view.mockInput.pressEnter();
    await draw(view);
    expect(fixture.saved).toEqual([["prod", dsn, "false"]]);
    await view.mockInput.typeText("prod");
    await draw(view);
    await click(view, "connection-edit");
    expect(await draw(view)).not.toContain("super-secret");
    await view.mockInput.pasteBracketedText("postgres://new-secret@localhost/db");
    await click(view, "connection-save");
    expect(fixture.saved[1]).toEqual(["prod", "postgres://new-secret@localhost/db", "true"]);
    await view.mockInput.typeText("prod");
    await draw(view);
    await click(view, "connection-delete");
    expect(fixture.removed).toEqual([]);
    view.mockInput.pressEscape();
    await draw(view);
    await click(view, "connection-delete");
    await click(view, "connection-confirm-delete");
    expect(fixture.removed).toEqual(["prod"]);
    await click(view, "connection-new");
    await view.mockInput.typeText("cancelled");
    view.mockInput.pressTab();
    await draw(view);
    await view.mockInput.pasteBracketedText(dsn);
    view.mockInput.pressEscape();
    await draw(view);
    await click(view, "connection-new");
    expect(await draw(view)).not.toContain("***");
    expect(fixture.saved.length).toBe(2);
  } finally {
    view.renderer.destroy();
  }
});
test("no permite eliminar la conexión activa y aísla Ctrl+Enter del editor", async () => {
  const fixture = setup();
  const view = await testRender(
    () => <App connect={fixture.connect} connections={fixture.manager} />,
    { width: 40, height: 20, useMouse: true },
  );
  try {
    await draw(view);
    view.mockInput.pressKey("k", { ctrl: true });
    await draw(view);
    await click(view, "connection-delete");
    expect(await draw(view)).toContain("Cambia a otra conexión");
    await click(view, "connection-new");
    await view.mockInput.pressKeys(["\x1b[13;5u"]);
    await draw(view);
    expect(fixture.connected.length).toBe(1);
    expect(fixture.removed.length).toBe(0);
    const frame = await draw(view);
    expect(frame.split("\n").length).toBeLessThanOrEqual(21);
    for (const line of frame.split("\n")) expect(Array.from(line).length).toBeLessThanOrEqual(40);
  } finally {
    view.renderer.destroy();
  }
});
