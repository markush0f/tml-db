import { expect, test } from "bun:test";
import { testRender } from "@opentui/solid";
import { App } from "./app";

async function draw(view: Awaited<ReturnType<typeof testRender>>) {
  await Bun.sleep(10);
  await view.renderOnce();
  return view.captureCharFrame();
}

function expectBounds(frame: string, width: number, height: number) {
  const lines = frame.trimEnd().split("\n");
  expect(lines.length).toBeLessThanOrEqual(height);
  for (const line of lines) expect(Array.from(line).length).toBeLessThanOrEqual(width);
}

for (const [width, height] of [[120, 40], [80, 24], [40, 24], [30, 16]] as const) {
  test(`maqueta estática en ${width}×${height}`, async () => {
    const view = await testRender(() => <App />, { width, height });
    try {
      const frame = await draw(view);
      expectBounds(frame, width, height);
      expect(frame).not.toContain("Contador");
      if (width < 40) {
        expect(frame).toContain("Terminal pequeña");
        expect(frame).toContain("40×20");
        expect(frame).not.toContain("Consultas");
      } else {
        for (const text of ["DEMO", "Consultas", "SELECT id, name, email", "FROM public.users", "LIMIT 3;", "Resultados", "3 filas de ejemplo", "Ana", "Luis", "Marta", "Asistente LLM", "Modelo no conectado", "Datos ficticios", "Sin conexión", "Q: salir"]) {
          expect(frame).toContain(text);
        }
        expect(frame).toContain("╭");
        expect(frame).toContain("╯");
        if (width >= 80) {
          for (const text of ["Entidades · 8", "public", "users", "pg_catalog", "ana@example.com"]) expect(frame).toContain(text);
        } else {
          expect(frame).not.toContain("Entidades");
          expect(frame).not.toContain("example.com");
          expect(frame).toContain("demo_local");
        }
        // Three result rows remain aligned in their own terminal rows.
        const resultLines = frame.split("\n").filter((line) => /Ana|Luis|Marta/.test(line));
        expect(resultLines).toHaveLength(3);
        expect(new Set(resultLines.map((line) => line.indexOf(" | "))).size).toBe(1);
      }
      view.mockInput.pressTab();
      view.mockInput.pressArrow("right");
      view.mockInput.pressArrow("left");
      for (const key of [" ", "r", "a"]) view.mockInput.pressKey(key);
      expect(await draw(view)).toBe(frame);
    } finally {
      await view.dispose();
    }
  });
}

for (const key of ["q", "ctrl+c"]) {
  test(`salida con ${key}`, async () => {
    const view = await testRender(() => <App />, { width: 80, height: 24 });
    try {
      await draw(view);
      if (key === "q") view.mockInput.pressKey("q");
      else view.mockInput.pressKey("c", { ctrl: true });
      await Bun.sleep(10);
      expect(view.renderer.isDestroyed).toBe(true);
    } finally {
      await view.dispose();
    }
  });
}

test("adapta la composición al redimensionar y recupera la vista amplia", async () => {
  const view = await testRender(() => <App />, { width: 120, height: 40 });
  try {
    const initial = await draw(view);
    expect(initial).toContain("Entidades");
    view.resize(40, 24);
    const compact = await draw(view);
    expect(compact).not.toContain("Entidades");
    expect(compact).toContain("Asistente LLM");
    expectBounds(compact, 40, 24);
    view.resize(30, 16);
    const small = await draw(view);
    expect(small).toContain("Terminal pequeña");
    expect(small).not.toContain("Consultas");
    expectBounds(small, 30, 16);
    view.resize(120, 40);
    expect(await draw(view)).toBe(initial);
  } finally {
    await view.dispose();
  }
});

test("límites mínimos y altura insuficiente", async () => {
  const view = await testRender(() => <App />, { width: 40, height: 20 });
  try {
    const minimum = await draw(view);
    expect(minimum).toContain("Asistente LLM");
    expect(minimum).toContain("Marta");
    expectBounds(minimum, 40, 20);
    view.resize(100, 19);
    const short = await draw(view);
    expect(short).toContain("Terminal pequeña");
    expect(short).not.toContain("Consultas");
  } finally {
    await view.dispose();
  }
});
