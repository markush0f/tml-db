import { expect, test } from "bun:test";
import { testRender } from "@opentui/solid";
import type { Renderable } from "@opentui/core";
import { App } from "./app";

const dockerTest = process.env.TML_DB_TEST_DOCKER === "1" ? test : test.skip;
dockerTest(
  "TUI real: cambiar entre PostgreSQL y MySQL, cargar tablas y consultar",
  async () => {
    const view = await testRender(() => <App />, { width: 120, height: 40, useMouse: true });
    async function waitFor(text: string) {
      const deadline = Date.now() + 10_000;
      while (Date.now() < deadline) {
        await Bun.sleep(25);
        await view.renderOnce();
        const frame = view.captureCharFrame();
        if (frame.includes(text)) return frame;
      }
      throw new Error(`No apareció ${text} en la TUI`);
    }
    function find(node: Renderable, id: string): Renderable | undefined {
      if (node.id === id) return node;
      for (const child of node.getChildren()) {
        const found = find(child as Renderable, id);
        if (found) return found;
      }
    }
    try {
      await waitFor("Conectado");
      for (const [name, table, person] of [
        ["docker-postgres", "projects", "Ana"],
        ["docker-mysql", "products", "Sofía"],
      ]) {
        view.mockInput.pressKey("k", { ctrl: true });
        await waitFor("Gestionar conexiones");
        await view.mockInput.typeText(name!);
        await view.renderOnce();
        view.mockInput.pressEnter();
        const frame = await waitFor(table!);
        expect(frame).toContain("Tablas · 3");
        expect(frame).toContain(name!);
        const execute = find(view.renderer.root, "execute-button")!;
        await view.mockMouse.click(execute.x, execute.y);
        await waitFor(person!);
      }
    } finally {
      await view.dispose();
    }
  },
  30_000,
);
