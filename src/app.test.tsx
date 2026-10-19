import { expect, test } from "bun:test";
import { testRender } from "@opentui/solid";
import { App } from "./app";

for (const width of [80, 40]) {
  test(`panel y atajos en ${width} columnas`, async () => {
    const view = await testRender(() => <App />, { width, height: 24 });
    const draw = async () => {
      await Bun.sleep(10); // La entrada de terminal se procesa de forma asíncrona.
      await view.renderOnce();
    };
    try {
      await draw();
      expect(view.captureCharFrame()).toContain("Contador: 0");
      view.mockInput.pressKey(" ");
      await draw();
      expect(view.captureCharFrame()).toContain("Contador: 1");
      view.mockInput.pressTab();
      await draw();
      expect(view.captureCharFrame()).toContain("Contador incrementado a 1");
      view.mockInput.pressKey("r");
      await draw();
      expect(view.captureCharFrame()).toContain("Contador reiniciado");
      view.mockInput.pressArrow("right");
      await draw();
      expect(view.captureCharFrame()).toContain("Atajos de teclado");
      view.mockInput.pressArrow("left");
      await draw();
      view.mockInput.pressArrow("left");
      await draw();
      expect(view.captureCharFrame()).toContain("Contador: 0");
      view.mockInput.pressKey("q");
      await Bun.sleep(10);
      expect(view.renderer.isDestroyed).toBe(true);
    } finally {
      await view.dispose();
    }
  });
}
