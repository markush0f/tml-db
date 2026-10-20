import { expect, test } from "bun:test";
import { testRender } from "@opentui/solid";
import type { Renderable, TextareaRenderable, ScrollBoxRenderable } from "@opentui/core";
import { App as RealApp } from "./app";
import { type QuerySession, type QueryResult } from "../mcp";
const sample: QueryResult = { durationMs: 2, statements: [{ sql: "SELECT", columns: ["id", "name", "email"], rows: [[1, "Ana", "ana@example.com"], [2, "Luis", "luis@example.com"], [3, "Marta", "marta@example.com"]], count: 3, truncated: false }] };
const fakeConnect = async (): Promise<QuerySession> => ({ execute: async () => sample, close: async () => {} });
const App = () => <RealApp connect={fakeConnect} />;
import { demoWorkspace } from "./demo-data";
import { workspaceLayout } from "./workspace-layout";
import { DatabaseSidebar } from "./components/DatabaseSidebar";
import { ResultsPanel } from "./components/ResultsPanel";

type View = Awaited<ReturnType<typeof testRender>>;
async function draw(view: View) {
  await Bun.sleep(10);
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
  if (!node) throw new Error(`Missing renderable: ${id}`);
  return node;
}
function expectBounds(frame: string, width: number, height: number) {
  const lines = frame.trimEnd().split("\n");
  expect(lines.length).toBeLessThanOrEqual(height);
  for (const line of lines) expect(Array.from(line).length).toBeLessThanOrEqual(width);
}
async function click(view: View, id: string, dx = 0, dy = 0) {
  const node = find(view, id);
  await view.mockMouse.click(node.x + dx, node.y + dy);
  if (!view.renderer.isDestroyed) await draw(view);
}
async function drag(view: View, id: string, dx: number, dy: number) {
  const node = find(view, id);
  const x = node.x, y = node.y;
  await view.mockMouse.pressDown(x, y);
  await draw(view); // Mount the capture surface before the pointer leaves the divider.
  const targetX = Math.max(0, Math.min(view.renderer.width - 1, x + dx));
  const targetY = Math.max(0, Math.min(view.renderer.height - 1, y + dy));
  await view.mockMouse.moveTo(targetX, targetY);
  await draw(view);
  await view.mockMouse.release(targetX, targetY);
  await draw(view);
}

for (const [width, height] of [[120, 40], [80, 24], [40, 24], [30, 16], [40, 20]] as const) {
  test(`interfaz en ${width}×${height}`, async () => {
    const view = await testRender(() => <App />, { width, height, useMouse: true });
    try {
      const frame = await draw(view);
      expectBounds(frame, width, height);
      expect(frame).not.toContain("Contador");
      if (width < 40) {
        expect(frame).toContain("Terminal pequeña");
        expect(frame).toContain("40×20");
        expect(frame).not.toContain("Consultas");
      } else {
        for (const text of ["DBHub local", "Consultas", "SELECT * FROM users LIMIT 200;", "Resultados", "Ejecuta una consulta", "Asistente LLM", "Modelo no conectado", "[Salir]", "[Ejecutar]"]) expect(frame).toContain(text);
        expect(frame).not.toContain("Ana");
        expect(frame).not.toContain("DEMO");
        expect(frame).toContain("╭");
        expect(frame).toContain("╯");
        if (width >= 80) {
          expect(frame).toContain("Explorador");
          expect(frame).not.toContain("pg_catalog");
        } else {
          expect(frame).not.toContain("Entidades");
          expect(frame).not.toContain("example.com");
          expect(frame).toContain("DBHub local");
        }
        const resultLines = frame.split("\n").filter((line) => /Ana|Luis|Marta/.test(line));
        expect(resultLines).toHaveLength(0);
      }
    } finally { await view.dispose(); }
  });
}

test("edición SQL, q como texto, saltos de línea, pegado y deshacer", async () => {
  const view = await testRender(() => <App />, { width: 120, height: 40, useMouse: true });
  try {
    await draw(view);
    const editor = find(view, "query-editor") as TextareaRenderable;
    expect(editor.focused).toBe(true);
    editor.selectAll();
    await view.mockInput.typeText("select q");
    view.mockInput.pressEnter();
    await view.mockInput.pasteBracketedText("-- consulta\nSELECT 'á😀';");
    await draw(view);
    expect(editor.plainText).toBe("select q\n-- consulta\nSELECT 'á😀';");
    expect(view.renderer.isDestroyed).toBe(false);
    expect(editor.lineCount).toBe(3);
    expect(editor.getLineHighlights(0).length).toBeGreaterThan(0);
    const before = editor.plainText;
    await view.mockInput.typeText("x");
    view.mockInput.pressKey("z", { ctrl: true });
    await draw(view);
    expect(editor.plainText).toBe(before);
    // Mouse places the insertion point, not just the focus.
    await click(view, "query-editor", 0, 0);
    await view.mockInput.typeText("X");
    await draw(view);
    expect(editor.plainText.startsWith("Xselect")).toBe(true);
    // A pointer drag selects SQL text for replacement.
    await view.mockMouse.drag(editor.x, editor.y, editor.x + 7, editor.y);
    await draw(view);
    expect(editor.hasSelection()).toBe(true);
    expect(editor.getSelectedText().length).toBeGreaterThan(0);
  } finally { await view.dispose(); }
});

test("ratón: ejecución, filas, asistente y retorno al editor", async () => {
  const view = await testRender(() => <App />, { width: 120, height: 40, useMouse: true });
  try {
    await draw(view);
    await click(view, "execute-button");
    expect(view.captureCharFrame()).toContain("Ana");
    await click(view, "result-row-0-1");
    expect(view.renderer.currentFocusedRenderable?.id).toBe("result-rows");
    const before = (find(view, "query-editor") as TextareaRenderable).plainText;
    await click(view, "assistant-editor");
    await view.mockInput.typeText("Que tablas hay?");
    await draw(view);
    expect((find(view, "assistant-editor") as TextareaRenderable).plainText).toBe("Que tablas hay?");
    expect((find(view, "query-editor") as TextareaRenderable).plainText).toBe(before);
    await click(view, "query-editor");
    expect(view.renderer.currentFocusedRenderable?.id).toBe("query-editor");
  } finally { await view.dispose(); }
});

test("separadores arrastrables, límites y captura fuera del separador", async () => {
  const view = await testRender(() => <App />, { width: 120, height: 40, useMouse: true });
  try {
    await draw(view);
    const editor = find(view, "query-editor") as TextareaRenderable;
    const before = editor.plainText;
    const initialX = find(view, "sidebar-resizer").x;
    await drag(view, "sidebar-resizer", 12, 0);
    expect(find(view, "sidebar-resizer").x).toBe(initialX + 12);
    await drag(view, "sidebar-resizer", 999, 0);
    expect(find(view, "sidebar-resizer").x).toBeLessThanOrEqual(120 - 37);
    await drag(view, "sidebar-resizer", -999, 0);
    expect(find(view, "database-sidebar").width).toBe(17);
    const initialResults = find(view, "results-panel").height;
    const initialQuery = find(view, "query-panel").height;
    await drag(view, "results-resizer", 0, -6);
    expect(find(view, "results-panel").height).toBe(initialResults + 6);
    expect(find(view, "query-panel").height).toBe(initialQuery - 6);
    await drag(view, "results-resizer", 0, -999);
    expect(find(view, "query-panel").height).toBe(4);
    await drag(view, "results-resizer", 0, 999);
    expect(find(view, "results-panel").height).toBe(5);
    // First grow the results, then use the lower divider to grow the assistant.
    await drag(view, "results-resizer", 0, -8);
    const topDivider = find(view, "results-resizer").y;
    const assistantHeight = find(view, "assistant-panel").height;
    await drag(view, "assistant-resizer", 0, -3);
    expect(find(view, "assistant-panel").height).toBe(assistantHeight + 3);
    expect(find(view, "results-resizer").y).toBe(topDivider);
    expect(editor.plainText).toBe(before);
    // Release must end capture: moving later cannot resize any panel.
    const resultHeight = find(view, "results-panel").height;
    await view.mockMouse.moveTo(2, 2);
    await draw(view);
    expect(find(view, "results-panel").height).toBe(resultHeight);
    expectBounds(view.captureCharFrame(), 120, 40);
  } finally { await view.dispose(); }
});

test("rueda en SQL; Tab cambia el foco sin insertar texto", async () => {
  const view = await testRender(() => <App />, { width: 80, height: 24, useMouse: true });
  try {
    await draw(view);
    const editor = find(view, "query-editor") as TextareaRenderable;
    editor.setText(Array.from({ length: 50 }, (_, i) => `SELECT ${i};`).join("\n"));
    await draw(view);
    await view.mockMouse.scroll(editor.x + 2, editor.y + 1, "down");
    await draw(view);
    expect(editor.scrollY).toBeGreaterThan(0);
    const before = editor.plainText;
    view.mockInput.pressTab();
    await draw(view);
    expect(view.renderer.currentFocusedRenderable?.id).toBe("result-rows");
    view.mockInput.pressTab();
    await draw(view);
    expect(view.renderer.currentFocusedRenderable?.id).toBe("assistant-editor");
    view.mockInput.pressTab({ shift: true });
    await draw(view);
    expect(view.renderer.currentFocusedRenderable?.id).toBe("result-rows");
    expect(editor.plainText).toBe(before);
    // The pending explorer has no fake tree after resizing.
    view.resize(80, 20);
    await draw(view);
    expect(view.captureCharFrame()).toContain("Explorador");
    expect(view.captureCharFrame()).not.toContain("> users");
  } finally { await view.dispose(); }
});

test("conserva texto y ajustes al cambiar tamaño; termina arrastre al redimensionar", async () => {
  const view = await testRender(() => <App />, { width: 120, height: 40, useMouse: true });
  try {
    await draw(view);
    const editor = find(view, "query-editor") as TextareaRenderable;
    editor.setText("SELECT 'conservar q';");
    await drag(view, "sidebar-resizer", 9, 0);
    const preferredX = find(view, "sidebar-resizer").x;
    view.resize(40, 24);
    await draw(view);
    expect(view.captureCharFrame()).not.toContain("Entidades");
    expect(editor.plainText).toBe("SELECT 'conservar q';");
    expectBounds(view.captureCharFrame(), 40, 24);
    await drag(view, "results-resizer", 0, -2);
    view.resize(30, 16);
    await draw(view);
    expect(view.captureCharFrame()).toContain("Terminal pequeña");
    view.resize(120, 40);
    await draw(view);
    expect(find(view, "query-editor")).toBe(editor);
    expect(editor.plainText).toBe("SELECT 'conservar q';");
    expect(find(view, "sidebar-resizer").x).toBe(preferredX);
    const divider = find(view, "results-resizer");
    await view.mockMouse.pressDown(divider.x, divider.y);
    await draw(view);
    view.resize(100, 30);
    await draw(view);
    await view.mockMouse.release(3, 3);
    const resultsHeight = find(view, "results-panel").height;
    await view.mockMouse.moveTo(4, 4);
    await draw(view);
    expect(find(view, "results-panel").height).toBe(resultsHeight);
    expectBounds(view.captureCharFrame(), 100, 30);
  } finally { await view.dispose(); }
});

for (const method of ["ctrl+c", "mouse"]) {
  test(`salida con ${method}`, async () => {
    const view = await testRender(() => <App />, { width: 80, height: 24, useMouse: true });
    try {
      await draw(view);
      if (method === "mouse") await click(view, "exit-button");
      else view.mockInput.pressKey("c", { ctrl: true });
      await Bun.sleep(10);
      expect(view.renderer.isDestroyed).toBe(true);
    } finally { await view.dispose(); }
  });
}

test("rueda y barras de desplazamiento con árboles y resultados largos", async () => {
  const tables = Array.from({ length: 60 }, (_, index) => `table_${index}`);
  const results: QueryResult = { durationMs: 1, statements: [{ sql: "SELECT", count: 60, truncated: false, columns: ["id", "name"], rows: tables.map((table, index) => [String(index), table]) }] };
  const view = await testRender(() => <box flexDirection="row" height={12}>
    <DatabaseSidebar width={26} connectionName="demo" schemas={[{ name: "public", expanded: true, tables }]} selectedTable="table_0"
      collapsed={new Set<string>()} filter="" focused={false} filterFocused={false}
      onFocus={() => {}} onFilterFocus={() => {}} onFilter={() => {}} onToggle={() => {}} onSelect={() => {}} />
    <ResultsPanel width={54} height={12} results={results} focused={false} selectedRow={null} onFocus={() => {}} onSelectRow={() => {}} />
  </box>, { width: 80, height: 24, useMouse: true });
  try {
    await draw(view);
    const tree = find(view, "schema-tree") as ScrollBoxRenderable;
    const rows = find(view, "result-rows") as ScrollBoxRenderable;
    for (const scrollbox of [tree, rows]) {
      await view.mockMouse.scroll(scrollbox.x + 1, scrollbox.y + 1, "down");
      await draw(view);
      expect(scrollbox.scrollTop).toBeGreaterThan(0);
      // The scrollbar itself is mouse-operable, not merely decorative.
      const track = scrollbox.verticalScrollBar.slider;
      await view.mockMouse.drag(track.x, track.y, track.x, track.y + track.height - 1);
      await draw(view);
      expect(scrollbox.scrollTop).toBeGreaterThan(3);
    }
    expectBounds(view.captureCharFrame(), 80, 24);
  } finally { await view.dispose(); }
});

test("botón derecho no redimensiona; Escape cancela captura", async () => {
  const view = await testRender(() => <App />, { width: 120, height: 40, useMouse: true });
  try {
    await draw(view);
    const divider = find(view, "sidebar-resizer");
    const x = divider.x;
    await view.mockMouse.pressDown(x, divider.y, 2);
    await view.mockMouse.moveTo(x + 10, divider.y);
    await view.mockMouse.release(x + 10, divider.y, 2);
    await draw(view);
    expect(find(view, "sidebar-resizer").x).toBe(x);
    await view.mockMouse.pressDown(x, divider.y);
    await draw(view);
    view.mockInput.pressEscape();
    await Bun.sleep(30); // Standalone Escape is disambiguated from ANSI sequences.
    await draw(view);
    await view.mockMouse.moveTo(x + 10, divider.y);
    await view.mockMouse.release(x + 10, divider.y);
    await draw(view);
    expect(find(view, "sidebar-resizer").x).toBe(x);
    expect(view.renderer.currentFocusedRenderable?.id).toBe("query-editor");
  } finally { await view.dispose(); }
});

test("layout respeta mínimos y suma las filas disponibles", () => {
  for (const width of [40, 80, 120]) for (const height of [20, 24, 40]) {
    for (const preferences of [{}, { sidebar: 999, results: 999, assistant: 999 }, { sidebar: -10, results: -10, assistant: -10 }]) {
      const layout = workspaceLayout(width, height, preferences);
      expect(layout.queryHeight).toBeGreaterThanOrEqual(4);
      expect(layout.resultsHeight).toBeGreaterThanOrEqual(5);
      expect(layout.assistantHeight).toBeGreaterThanOrEqual(3);
      expect(layout.queryHeight + layout.resultsHeight + layout.assistantHeight + 2).toBe(layout.bodyHeight);
      expect(layout.mainWidth + layout.sidebarWidth).toBe(width - 2);
    }
  }
  expect(demoWorkspace.results.rows).toHaveLength(3);
});
